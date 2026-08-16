-- Forward-only scanner-agent authority and durable completion replay.
-- Existing file migrations remain immutable.

begin;

create table if not exists public.hotel_file_scanner_agent_capabilities (
  role_name name primary key,
  created_at timestamptz not null default pg_catalog.now()
);
revoke all on public.hotel_file_scanner_agent_capabilities from public;

alter table public.hotel_file_scan_jobs
  add column if not exists retry_receipt_token_hash bytea,
  add column if not exists retry_receipt_generation bigint,
  add column if not exists retry_receipt_source_sha256 bytea;

create or replace function public.file_scanner_agent_has_capability()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1 from public.hotel_file_scanner_agent_capabilities capability
     where capability.role_name = session_user
  )
$function$;
revoke all on function public.file_scanner_agent_has_capability() from public;

create or replace function public.hotel_file_scanner_agent_command_v1(
  p_upload_id uuid, p_action text, p_claim_token text, p_generation bigint,
  p_value jsonb, p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_job public.hotel_file_scan_jobs%rowtype;
  v_upload public.hotel_file_uploads%rowtype;
  v_file_version_id uuid;
  v_token_hash bytea;
  v_snapshot jsonb;
begin
  if not public.file_scanner_agent_has_capability()
     or p_upload_id is null
     or p_action is null
     or p_claim_token is null
     or p_generation is null
     or p_value is null
     or p_trace_id is null
     or p_action not in ('CLAIM', 'SCAN_CLEAN', 'PROMOTE_COMPLETE', 'REJECT', 'FAIL')
     or p_claim_token !~ '^[A-Za-z0-9_-]{43}$' then
    return query select 'FORBIDDEN'::text, null::jsonb; return;
  end if;
  v_token_hash := pg_catalog.sha256(pg_catalog.convert_to(p_claim_token, 'UTF8'));
  select job.* into v_job
    from public.hotel_file_scan_jobs job
   where job.upload_id = p_upload_id
   for update;
  if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
  select upload.* into v_upload
    from public.hotel_file_uploads upload
   where upload.company_id = v_job.company_id
     and upload.id = v_job.upload_id
   for update;
  if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;

  if p_action = 'CLAIM' then
    if (v_job).status = 'PENDING'
       and (v_job).retry_receipt_token_hash = v_token_hash
       and (v_job).retry_receipt_generation = p_generation
       and p_value ->> 'completionVerdict' = 'FAILED'
       and (p_value ->> 'sourceSha256') ~ '^[a-f0-9]{64}$'
       and (v_job).retry_receipt_source_sha256 = pg_catalog.decode(p_value ->> 'sourceSha256', 'hex') then
      return query select 'REPLAYED'::text, pg_catalog.jsonb_build_object(
        'phase', 'RETRY_SCHEDULED',
        'completionVerdict', 'FAILED',
        'generation', (v_job).retry_receipt_generation,
        'sourceSha256', pg_catalog.encode((v_job).retry_receipt_source_sha256, 'hex')
      );
      return;
    end if;
    if (v_job).claim_token_hash = v_token_hash
       and (v_job).claim_generation = p_generation
       and (v_job).status in ('COMPLETED', 'FAILED') then
      return query select 'REPLAYED'::text, pg_catalog.jsonb_build_object(
        'phase', 'TERMINAL',
        'completionVerdict', case
          when (v_job).status = 'COMPLETED' then 'CLEAN'
          when (v_job).failure_code = 'MALWARE_DETECTED' then 'INFECTED'
          when (v_job).failure_code = 'SCAN_ENGINE' then 'FAILED'
          else 'SOURCE_INTEGRITY'
        end,
        'generation', (v_job).claim_generation,
        'quarantineObjectKey', v_upload.quarantine_object_key,
        'sourceSha256', pg_catalog.encode((v_job).scanner_sha256, 'hex'),
        'cleanSha256', case when (v_job).clean_sha256 is null then null
          else pg_catalog.encode((v_job).clean_sha256, 'hex') end,
        'detectedMime', (v_job).detected_mime,
        'snapshot', public.hotel_file_status_snapshot_v1((v_job).company_id, p_upload_id)
      );
      return;
    end if;
    if (v_job).status = 'CLEAN_PENDING_PROMOTION' then
      if (v_job).claim_token_hash = v_token_hash and (v_job).claim_expires_at > v_now then
        return query select 'REPLAYED'::text, pg_catalog.jsonb_build_object(
          'jobId', (v_job).id, 'generation', (v_job).claim_generation,
          'phase', 'CLEAN_PENDING_PROMOTION',
          'fileVersionId', (v_job).file_version_id,
          'cleanObjectKey', (v_job).clean_object_key,
          'detectedMime', (v_job).detected_mime
        );
        return;
      end if;
      if (v_job).claim_expires_at > v_now then
        return query select 'BUSY'::text, null::jsonb; return;
      end if;
      update public.hotel_file_scan_jobs job set
        claim_token_hash = v_token_hash,
        claim_generation = job.claim_generation + 1,
        claim_expires_at = v_now + interval '5 minutes',
        attempt_count = job.attempt_count + 1,
        retry_receipt_token_hash = null,
        retry_receipt_generation = null,
        retry_receipt_source_sha256 = null,
        updated_at = v_now
       where job.id = (v_job).id
       returning job.claim_generation into p_generation;
      return query select 'CLAIMED'::text, pg_catalog.jsonb_build_object(
        'jobId', (v_job).id, 'generation', p_generation,
        'phase', 'CLEAN_PENDING_PROMOTION',
        'fileVersionId', (v_job).file_version_id,
        'cleanObjectKey', (v_job).clean_object_key,
        'detectedMime', (v_job).detected_mime
      );
      return;
    end if;
    if (v_job).status = 'CLAIMED' and (v_job).claim_token_hash = v_token_hash
       and (v_job).claim_expires_at > v_now then
      return query select 'REPLAYED'::text, pg_catalog.jsonb_build_object(
        'jobId', (v_job).id, 'generation', (v_job).claim_generation,
        'phase', 'SCANNING',
        'quarantineObjectKey', v_upload.quarantine_object_key,
        'sourceEtag', v_upload.source_etag,
        'sourceObjectVersion', v_upload.source_object_version,
        'sizeBytes', v_upload.reserved_size, 'mimeType', v_upload.declared_mime
      );
      return;
    end if;
    if (v_job).status not in ('PENDING', 'CLAIMED')
       or (v_job).status = 'CLAIMED' and (v_job).claim_expires_at > v_now
       or (v_job).available_at > v_now then
      return query select 'BUSY'::text, null::jsonb; return;
    end if;
    update public.hotel_file_scan_jobs job set status = 'CLAIMED',
      claim_token_hash = v_token_hash, claim_generation = job.claim_generation + 1,
      claim_expires_at = v_now + interval '5 minutes',
      attempt_count = job.attempt_count + 1,
      retry_receipt_token_hash = null,
      retry_receipt_generation = null,
      retry_receipt_source_sha256 = null,
      updated_at = v_now
     where job.id = (v_job).id
     returning job.claim_generation into p_generation;
    update public.hotel_file_uploads set status = 'SCANNING', updated_at = v_now
     where company_id = (v_job).company_id and id = p_upload_id;
    return query select 'CLAIMED'::text, pg_catalog.jsonb_build_object(
      'jobId', (v_job).id, 'generation', p_generation,
      'phase', 'SCANNING',
      'quarantineObjectKey', v_upload.quarantine_object_key,
      'sourceEtag', v_upload.source_etag,
      'sourceObjectVersion', v_upload.source_object_version,
      'sizeBytes', v_upload.reserved_size, 'mimeType', v_upload.declared_mime
    );
    return;
  end if;

  if (v_job).claim_token_hash is distinct from v_token_hash
     or (v_job).claim_generation is distinct from p_generation
     or (v_job).claim_expires_at is null
     or (v_job).claim_expires_at <= v_now then
    return query select 'STALE_CLAIM'::text, null::jsonb; return;
  end if;

  if p_action = 'SCAN_CLEAN' then
    if (v_job).status = 'CLEAN_PENDING_PROMOTION' then
      if (p_value ->> 'fileVersionId')::uuid is distinct from (v_job).file_version_id then
        return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb; return;
      end if;
      return query select 'REPLAYED'::text, pg_catalog.jsonb_build_object(
        'fileVersionId', (v_job).file_version_id,
        'cleanObjectKey', (v_job).clean_object_key,
        'generation', (v_job).claim_generation
      );
      return;
    end if;
    if (v_job).status <> 'CLAIMED'
       or p_value ->> 'scannerSha256' is null
       or (p_value ->> 'scannerSha256') !~ '^[a-f0-9]{64}$'
       or p_value ->> 'detectedMime' is null
       or (p_value ->> 'detectedMime') not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')
       or p_value ->> 'fileVersionId' is null
       or p_value ->> 'cleanObjectKey' is null
       or (p_value ->> 'cleanObjectKey') is distinct from ('clean/' || (p_value ->> 'fileVersionId')) then
      return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb; return;
    end if;
    update public.hotel_file_scan_jobs set status = 'CLEAN_PENDING_PROMOTION',
      scanner_sha256 = pg_catalog.decode(p_value ->> 'scannerSha256', 'hex'),
      detected_mime = p_value ->> 'detectedMime',
      file_version_id = (p_value ->> 'fileVersionId')::uuid,
      clean_object_key = p_value ->> 'cleanObjectKey', updated_at = v_now
     where id = (v_job).id;
    update public.hotel_file_uploads set status = 'CLEAN_PENDING_PROMOTION', updated_at = v_now
     where company_id = (v_job).company_id and id = p_upload_id;
    return query select 'RECORDED'::text, pg_catalog.jsonb_build_object(
      'fileVersionId', p_value ->> 'fileVersionId',
      'cleanObjectKey', p_value ->> 'cleanObjectKey', 'generation', p_generation
    );
    return;
  elsif p_action = 'PROMOTE_COMPLETE' then
    if (v_job).status = 'COMPLETED' then
      v_snapshot := public.hotel_file_status_snapshot_v1((v_job).company_id, p_upload_id);
      return query select 'REPLAYED'::text, v_snapshot; return;
    end if;
    if (v_job).status <> 'CLEAN_PENDING_PROMOTION'
       or (p_value ->> 'fileVersionId')::uuid is distinct from (v_job).file_version_id
       or p_value ->> 'cleanSha256' is null
       or (p_value ->> 'cleanSha256') !~ '^[a-f0-9]{64}$'
       or p_value ->> 'cleanEtag' is null
       or (p_value ->> 'cleanEtag') !~ '^"[a-f0-9]{32}"$'
       or pg_catalog.btrim(coalesce(p_value ->> 'cleanObjectVersion', '')) = ''
       or p_value ->> 'cleanSize' is null
       or (p_value ->> 'cleanSize')::bigint not between 1 and 20971520
       or (p_value ->> 'exifLocationRemoved')::boolean is not true then
      return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb; return;
    end if;
    v_file_version_id := (v_job).file_version_id;
    insert into public.hotel_file_versions (
      id, company_id, branch_id, upload_id, clean_object_key, clean_etag,
      clean_object_version, clean_sha256, clean_size, detected_mime,
      display_name, exif_location_removed, original_retention_until
    ) values (
      v_file_version_id, (v_job).company_id, (v_job).branch_id, p_upload_id,
      (v_job).clean_object_key, p_value ->> 'cleanEtag',
      p_value ->> 'cleanObjectVersion', pg_catalog.decode(p_value ->> 'cleanSha256', 'hex'),
      (p_value ->> 'cleanSize')::bigint, (v_job).detected_mime,
      v_upload.display_name, true, v_now + interval '1 year'
    );
    update public.hotel_file_scan_jobs set status = 'COMPLETED',
      clean_etag = p_value ->> 'cleanEtag', clean_object_version = p_value ->> 'cleanObjectVersion',
      clean_sha256 = pg_catalog.decode(p_value ->> 'cleanSha256', 'hex'),
      clean_size = (p_value ->> 'cleanSize')::bigint,
      completed_at = v_now, updated_at = v_now
     where id = (v_job).id;
    update public.hotel_file_uploads set status = 'READY_UNLINKED',
      quota_released_at = v_now, updated_at = v_now
     where company_id = (v_job).company_id and id = p_upload_id;
    update public.outbox_jobs set status = 'SUCCEEDED', completed_at = v_now, updated_at = v_now
     where id = (v_job).dispatch_job_id;
    v_snapshot := public.hotel_file_status_snapshot_v1((v_job).company_id, p_upload_id);
    return query select 'COMPLETED'::text, v_snapshot; return;
  elsif p_action = 'REJECT' then
    if (v_job).status <> 'CLAIMED'
       or p_value ->> 'sourceSha256' is null
       or (p_value ->> 'sourceSha256') !~ '^[a-f0-9]{64}$'
       or p_value ->> 'failureCode' is null
       or (p_value ->> 'failureCode') not in ('MALWARE_DETECTED', 'SOURCE_INTEGRITY') then
      return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb; return;
    end if;
    update public.hotel_file_scan_jobs set status = 'FAILED',
      scanner_sha256 = pg_catalog.decode(p_value ->> 'sourceSha256', 'hex'),
      detected_mime = null, file_version_id = null,
      clean_object_key = null, clean_etag = null, clean_object_version = null,
      clean_sha256 = null, clean_size = null,
      failure_code = case when p_value ->> 'failureCode' = 'MALWARE_DETECTED' then 'MALWARE_DETECTED' else 'SOURCE_INTEGRITY' end,
      completed_at = v_now, updated_at = v_now where id = (v_job).id;
    update public.hotel_file_uploads set status = 'REJECTED',
      failure_code = case when p_value ->> 'failureCode' = 'MALWARE_DETECTED' then 'MALWARE_DETECTED' else 'SOURCE_INTEGRITY' end,
      quota_released_at = v_now, updated_at = v_now
     where company_id = (v_job).company_id and id = p_upload_id;
    update public.outbox_jobs set status = 'CANCELLED', completed_at = v_now,
      last_error_code = 'FILE_REJECTED', updated_at = v_now
     where id = (v_job).dispatch_job_id;
    return query select 'REJECTED'::text, public.hotel_file_status_snapshot_v1((v_job).company_id, p_upload_id); return;
  else
    if (v_job).status <> 'CLAIMED'
       or p_value ->> 'sourceSha256' is null
       or (p_value ->> 'sourceSha256') !~ '^[a-f0-9]{64}$'
       or (p_value ->> 'failureCode') is distinct from 'SCAN_ENGINE' then
      return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb; return;
    end if;
    if (v_job).attempt_count >= 5 then
      update public.hotel_file_scan_jobs set status = 'FAILED', failure_code = 'SCAN_ENGINE',
        scanner_sha256 = pg_catalog.decode(p_value ->> 'sourceSha256', 'hex'),
        detected_mime = null, file_version_id = null,
        clean_object_key = null, clean_etag = null, clean_object_version = null,
        clean_sha256 = null, clean_size = null,
        completed_at = v_now, updated_at = v_now where id = (v_job).id;
      update public.hotel_file_uploads set status = 'SCAN_FAILED', failure_code = 'SCAN_ENGINE',
        quota_released_at = v_now, updated_at = v_now
       where company_id = (v_job).company_id and id = p_upload_id;
      update public.outbox_jobs set status = 'CANCELLED', completed_at = v_now,
        last_error_code = 'SCAN_ENGINE', updated_at = v_now where id = (v_job).dispatch_job_id;
      return query select 'SCAN_FAILED'::text, public.hotel_file_status_snapshot_v1((v_job).company_id, p_upload_id); return;
    end if;
    update public.hotel_file_scan_jobs set status = 'PENDING',
      retry_receipt_token_hash = v_token_hash,
      retry_receipt_generation = p_generation,
      retry_receipt_source_sha256 = pg_catalog.decode(p_value ->> 'sourceSha256', 'hex'),
      claim_token_hash = null,
      claim_expires_at = null, available_at = v_now + pg_catalog.make_interval(secs => least(300, 5 * (2 ^ (v_job).attempt_count)::integer)),
      scanner_sha256 = null, detected_mime = null, file_version_id = null,
      clean_object_key = null, clean_etag = null, clean_object_version = null,
      clean_sha256 = null, clean_size = null,
      updated_at = v_now where id = (v_job).id;
    update public.hotel_file_uploads set status = 'QUARANTINED', updated_at = v_now
     where company_id = (v_job).company_id and id = p_upload_id;
    update public.outbox_jobs set status = 'FAILED', attempt_count = attempt_count + 1,
      available_at = v_now + interval '30 seconds', last_error_code = 'SCAN_ENGINE', updated_at = v_now
     where id = (v_job).dispatch_job_id;
    return query select 'RETRY_SCHEDULED'::text, null::jsonb; return;
  end if;
exception
  when invalid_text_representation or check_violation or foreign_key_violation then
    return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_file_scanner_agent_command_v1(uuid, text, text, bigint, jsonb, uuid) from public;

create or replace function public.hotel_file_scanner_agent_candidates_v1(p_limit integer)
returns table (upload_id uuid)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
begin
  if not public.file_scanner_agent_has_capability()
     or p_limit is null
     or p_limit < 1 then
    return;
  end if;

  return query
  select job.upload_id
    from public.hotel_file_scan_jobs job
   where job.attempt_count < 5
     and job.available_at <= pg_catalog.statement_timestamp()
     and (
       job.status = 'PENDING'
       or (
         job.status in ('CLAIMED', 'CLEAN_PENDING_PROMOTION')
         and job.claim_expires_at <= pg_catalog.statement_timestamp()
       )
     )
   order by job.available_at, job.created_at, job.id
   limit least(p_limit, 25);
end
$function$;
revoke all on function public.hotel_file_scanner_agent_candidates_v1(integer) from public;

insert into public.schema_migrations (version)
values ('0051_file_scanner_agent_authority')
on conflict (version) do nothing;

commit;


