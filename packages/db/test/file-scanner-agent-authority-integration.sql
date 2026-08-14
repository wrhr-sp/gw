\set ON_ERROR_STOP on

begin;

do $test$
declare
  v_source_upload constant uuid := 'c6000000-0000-4000-8000-000000000001';
  v_upload constant uuid := 'ca000000-0000-4000-8000-000000000001';
  v_job constant uuid := 'ca000000-0000-4000-8000-000000000002';
  v_dispatch constant uuid := 'ca000000-0000-4000-8000-000000000003';
  v_file_version constant uuid := 'ca000000-0000-4000-8000-000000000004';
  v_retry_upload constant uuid := 'ca000000-0000-4000-8000-000000000010';
  v_retry_job constant uuid := 'ca000000-0000-4000-8000-000000000011';
  v_retry_dispatch constant uuid := 'ca000000-0000-4000-8000-000000000012';
  v_retry_token constant text := repeat('R', 43);
  v_claim_token constant text := repeat('S', 43);
  v_company uuid;
  v_branch uuid;
  v_generation bigint;
  v_result record;
begin
  select company_id, branch_id into strict v_company, v_branch
    from public.hotel_file_uploads where id = v_source_upload;

  update public.runtime_database_capabilities
     set capability = 'API_RUNTIME', provisioned_at = pg_catalog.now()
   where role_name = session_user;
  insert into public.hotel_file_scanner_agent_capabilities (role_name)
  values (session_user)
  on conflict (role_name) do nothing;

  insert into public.hotel_file_uploads (
    id, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    display_name, declared_mime, reserved_size, quarantine_object_key,
    reservation_fingerprint, status, source_etag, source_object_version,
    initiated_by, initiated_session_id, expires_at, created_at, updated_at
  )
  select v_upload, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    'scanner-agent-replay.jpg', declared_mime, reserved_size,
    'quarantine/' || v_upload::text || '/' || repeat('Q', 43),
    repeat('e', 64), 'CLEAN_PENDING_PROMOTION', source_etag, source_object_version,
    initiated_by, initiated_session_id, pg_catalog.now() + interval '1 hour',
    pg_catalog.now(), pg_catalog.now()
    from public.hotel_file_uploads where id = v_source_upload;

  insert into public.outbox_jobs (
    id, company_id, branch_id, job_type, payload, status, attempt_count, available_at
  ) values (
    v_dispatch, v_company, v_branch, 'HOTEL_FILE_SCAN',
    pg_catalog.jsonb_build_object('uploadId', v_upload),
    'PROCESSING', 1, pg_catalog.now()
  );

  insert into public.hotel_file_scan_jobs (
    id, company_id, branch_id, upload_id, dispatch_job_id, status,
    claim_token_hash, claim_generation, claim_expires_at,
    scanner_sha256, detected_mime, file_version_id, clean_object_key,
    attempt_count, available_at
  ) values (
    v_job, v_company, v_branch, v_upload, v_dispatch, 'CLEAN_PENDING_PROMOTION',
    pg_catalog.sha256(pg_catalog.convert_to(v_claim_token, 'UTF8')), 4,
    pg_catalog.now() + interval '5 minutes',
    pg_catalog.decode(repeat('b', 64), 'hex'), 'image/jpeg', v_file_version,
    'clean/' || v_file_version::text, 1, pg_catalog.now()
  );

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_upload, 'CLAIM', null, 4, '{}'::jsonb,
      'ca000000-0000-4000-8000-000000000020'
    );
  if v_result.command_status <> 'FORBIDDEN' then
    raise exception 'null claim token bypassed the scanner fence';
  end if;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_upload, null, v_claim_token, 4, '{}'::jsonb,
      'ca000000-0000-4000-8000-000000000021'
    );
  if v_result.command_status <> 'FORBIDDEN' then
    raise exception 'null action bypassed the scanner fence';
  end if;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_upload, 'CLAIM', v_claim_token, null, '{}'::jsonb,
      'ca000000-0000-4000-8000-000000000022'
    );
  if v_result.command_status <> 'FORBIDDEN' then
    raise exception 'null generation bypassed the scanner fence';
  end if;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_upload, 'CLAIM', v_claim_token, 4, '{}'::jsonb,
      'ca000000-0000-4000-8000-000000000005'
    );
  if v_result.command_status <> 'REPLAYED'
     or v_result.result_snapshot ->> 'phase' <> 'CLEAN_PENDING_PROMOTION' then
    raise exception 'active promotion replay failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;
  v_generation := (v_result.result_snapshot ->> 'generation')::bigint;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_upload, 'PROMOTE_COMPLETE', v_claim_token, v_generation,
      pg_catalog.jsonb_build_object(
        'fileVersionId', v_file_version,
        'cleanSha256', repeat('c', 64),
        'cleanEtag', '"cccccccccccccccccccccccccccccccc"',
        'cleanObjectVersion', 'scanner-agent-clean-version-1',
        'cleanSize', 10,
        'exifLocationRemoved', true
      ), 'ca000000-0000-4000-8000-000000000006'
    );
  if v_result.command_status <> 'COMPLETED'
     or v_result.result_snapshot ->> 'status' <> 'READY_UNLINKED' then
    raise exception 'scanner-agent promotion failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_upload, 'CLAIM', v_claim_token, v_generation, '{}'::jsonb,
      'ca000000-0000-4000-8000-000000000007'
    );
  if v_result.command_status <> 'REPLAYED'
     or v_result.result_snapshot ->> 'phase' <> 'TERMINAL'
     or v_result.result_snapshot ->> 'completionVerdict' <> 'CLEAN'
     or v_result.result_snapshot ->> 'sourceSha256' <> repeat('b', 64)
     or v_result.result_snapshot ->> 'cleanSha256' <> repeat('c', 64)
     or v_result.result_snapshot ->> 'detectedMime' <> 'image/jpeg'
     or v_result.result_snapshot #>> '{snapshot,status}' <> 'READY_UNLINKED' then
    raise exception 'terminal completion receipt was not durable: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_upload, 'CLAIM', repeat('X', 43), v_generation, '{}'::jsonb,
      'ca000000-0000-4000-8000-000000000008'
    );
  if v_result.command_status <> 'BUSY' then
    raise exception 'foreign terminal replay was not fenced: %',
      v_result.command_status;
  end if;

  insert into public.hotel_file_uploads (
    id, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    display_name, declared_mime, reserved_size, quarantine_object_key,
    reservation_fingerprint, status, source_etag, source_object_version,
    initiated_by, initiated_session_id, expires_at, created_at, updated_at
  )
  select v_retry_upload, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    'scanner-agent-failed-replay.jpg', declared_mime, reserved_size,
    'quarantine/' || v_retry_upload::text || '/' || repeat('T', 43),
    repeat('f', 64), 'SCANNING', source_etag, source_object_version,
    initiated_by, initiated_session_id, pg_catalog.now() + interval '1 hour',
    pg_catalog.now(), pg_catalog.now()
    from public.hotel_file_uploads where id = v_source_upload;

  insert into public.outbox_jobs (
    id, company_id, branch_id, job_type, payload, status, attempt_count, available_at
  ) values (
    v_retry_dispatch, v_company, v_branch, 'HOTEL_FILE_SCAN',
    pg_catalog.jsonb_build_object('uploadId', v_retry_upload),
    'PROCESSING', 1, pg_catalog.now()
  );

  insert into public.hotel_file_scan_jobs (
    id, company_id, branch_id, upload_id, dispatch_job_id, status,
    claim_token_hash, claim_generation, claim_expires_at,
    attempt_count, available_at
  ) values (
    v_retry_job, v_company, v_branch, v_retry_upload, v_retry_dispatch, 'CLAIMED',
    pg_catalog.sha256(pg_catalog.convert_to(v_retry_token, 'UTF8')), 2,
    pg_catalog.now() + interval '5 minutes', 1, pg_catalog.now()
  );

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_retry_upload, 'FAIL', v_retry_token, 2,
      pg_catalog.jsonb_build_object(
        'failureCode', 'SCAN_ENGINE', 'sourceSha256', repeat('d', 64)
      ),
      'ca000000-0000-4000-8000-000000000013'
    );
  if v_result.command_status <> 'RETRY_SCHEDULED' then
    raise exception 'retry receipt was not scheduled: %', v_result.command_status;
  end if;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_retry_upload, 'CLAIM', v_retry_token, 2,
      pg_catalog.jsonb_build_object(
        'completionVerdict', 'FAILED', 'sourceSha256', repeat('d', 64)
      ), 'ca000000-0000-4000-8000-000000000014'
    );
  if v_result.command_status <> 'REPLAYED'
     or v_result.result_snapshot ->> 'phase' <> 'RETRY_SCHEDULED' then
    raise exception 'failed completion receipt did not replay exactly: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_retry_upload, 'CLAIM', v_retry_token, 2,
      pg_catalog.jsonb_build_object(
        'completionVerdict', 'FAILED', 'sourceSha256', repeat('e', 64)
      ), 'ca000000-0000-4000-8000-000000000015'
    );
  if v_result.command_status <> 'BUSY' then
    raise exception 'modified failed receipt was not fenced: %',
      v_result.command_status;
  end if;

  update public.hotel_file_scan_jobs
     set status = 'CLAIMED',
         claim_token_hash = pg_catalog.sha256(pg_catalog.convert_to(v_retry_token, 'UTF8')),
         claim_generation = 3,
         claim_expires_at = pg_catalog.now() + interval '5 minutes',
         retry_receipt_token_hash = null,
         retry_receipt_generation = null,
         retry_receipt_source_sha256 = null
   where id = v_retry_job;
  update public.hotel_file_uploads set status = 'SCANNING' where id = v_retry_upload;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_retry_upload, 'REJECT', v_retry_token, 3,
      pg_catalog.jsonb_build_object('failureCode', 'MALWARE_DETECTED'),
      'ca000000-0000-4000-8000-000000000016'
    );
  if v_result.command_status <> 'FILE_INTEGRITY_MISMATCH' then
    raise exception 'REJECT NULL source digest was not rejected: %',
      v_result.command_status;
  end if;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_retry_upload, 'FAIL', v_retry_token, 3,
      pg_catalog.jsonb_build_object('sourceSha256', repeat('d', 64)),
      'ca000000-0000-4000-8000-000000000017'
    );
  if v_result.command_status <> 'FILE_INTEGRITY_MISMATCH' then
    raise exception 'FAIL NULL failure code was not rejected: %',
      v_result.command_status;
  end if;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_retry_upload, 'SCAN_CLEAN', v_retry_token, 3,
      pg_catalog.jsonb_build_object(
        'fileVersionId', v_file_version,
        'cleanObjectKey', 'clean/' || v_file_version::text
      ),
      'ca000000-0000-4000-8000-000000000018'
    );
  if v_result.command_status <> 'FILE_INTEGRITY_MISMATCH' then
    raise exception 'SCAN_CLEAN NULL scanner fields were not rejected: %',
      v_result.command_status;
  end if;

  update public.hotel_file_scan_jobs
     set status = 'CLEAN_PENDING_PROMOTION',
         scanner_sha256 = pg_catalog.decode(repeat('d', 64), 'hex'),
         detected_mime = 'image/jpeg',
         file_version_id = v_file_version,
         clean_object_key = 'clean/' || v_file_version::text
   where id = v_retry_job;
  update public.hotel_file_uploads
     set status = 'CLEAN_PENDING_PROMOTION'
   where id = v_retry_upload;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_retry_upload, 'PROMOTE_COMPLETE', v_retry_token, 3,
      pg_catalog.jsonb_build_object(
        'fileVersionId', v_file_version,
        'cleanSha256', repeat('e', 64),
        'cleanEtag', '"' || repeat('f', 32) || '"',
        'cleanObjectVersion', 'clean-version-null-size',
        'exifLocationRemoved', true
      ),
      'ca000000-0000-4000-8000-000000000019'
    );
  if v_result.command_status <> 'FILE_INTEGRITY_MISMATCH' then
    raise exception 'PROMOTE_COMPLETE NULL clean size was not rejected: %',
      v_result.command_status;
  end if;

  update public.hotel_file_scan_jobs
     set status = 'PENDING',
         claim_token_hash = null,
         claim_expires_at = null,
         claim_generation = 3,
         scanner_sha256 = null,
         detected_mime = null,
         file_version_id = null,
         clean_object_key = null
   where id = v_retry_job;
  update public.hotel_file_uploads
     set status = 'QUARANTINED'
   where id = v_retry_upload;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_retry_upload, 'REJECT', v_retry_token, 3,
      pg_catalog.jsonb_build_object(
        'failureCode', 'MALWARE_DETECTED',
        'sourceSha256', repeat('d', 64)
      ),
      'ca000000-0000-4000-8000-000000000020'
    );
  if v_result.command_status <> 'STALE_CLAIM' then
    raise exception 'PENDING NULL lease REJECT was not fenced: %',
      v_result.command_status;
  end if;

  select * into strict v_result
    from public.hotel_file_scanner_agent_command_v1(
      v_retry_upload, 'FAIL', v_retry_token, 3,
      pg_catalog.jsonb_build_object(
        'failureCode', 'SCAN_ENGINE',
        'sourceSha256', repeat('d', 64)
      ),
      'ca000000-0000-4000-8000-000000000021'
    );
  if v_result.command_status <> 'STALE_CLAIM' then
    raise exception 'PENDING NULL lease FAIL was not fenced: %',
      v_result.command_status;
  end if;

  if not exists (
    select 1 from public.hotel_file_scan_jobs
     where id = v_retry_job
       and status = 'PENDING'
       and claim_token_hash is null
       and claim_expires_at is null
  ) or not exists (
    select 1 from public.hotel_file_uploads
     where id = v_retry_upload and status = 'QUARANTINED'
  ) then
    raise exception 'PENDING NULL lease fence mutated durable state';
  end if;
end
$test$;

rollback;

select 'FILE_SCANNER_AGENT_AUTHORITY_INTEGRATION_OK';
