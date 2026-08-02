\set ON_ERROR_STOP on

begin;

do $test$
declare
  v_source_upload constant uuid := 'c6000000-0000-4000-8000-000000000001';
  v_upload constant uuid := 'c6000000-0000-4000-8000-000000000002';
  v_job constant uuid := 'c8000000-0000-4000-8000-000000000002';
  v_dispatch constant uuid := 'c9000000-0000-4000-8000-000000000002';
  v_file_version constant uuid := 'c7000000-0000-4000-8000-000000000002';
  v_old_token constant text := repeat('O', 43);
  v_new_token constant text := repeat('N', 43);
  v_foreign_token constant text := repeat('F', 43);
  v_company uuid;
  v_branch uuid;
  v_generation bigint;
  v_result record;
begin
  select company_id, branch_id into strict v_company, v_branch
    from public.hotel_file_uploads where id = v_source_upload;

  update public.runtime_database_capabilities
     set capability = 'RECONCILER', provisioned_at = pg_catalog.now()
   where role_name = session_user;
  insert into public.hotel_file_finalizer_capabilities (role_name)
  values (session_user)
  on conflict (role_name) do nothing;
  perform pg_catalog.set_config('app.reconciler_company_id', v_company::text, true);

  insert into public.hotel_file_uploads (
    id, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    display_name, declared_mime, reserved_size, quarantine_object_key,
    reservation_fingerprint, status, source_etag, source_object_version,
    initiated_by, initiated_session_id, expires_at, created_at, updated_at
  )
  select v_upload, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    'recovery.jpg', declared_mime, reserved_size,
    'quarantine/' || v_upload::text || '/' || repeat('R', 43),
    repeat('d', 64), 'CLEAN_PENDING_PROMOTION', source_etag, source_object_version,
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
    pg_catalog.sha256(pg_catalog.convert_to(v_old_token, 'UTF8')), 7,
    pg_catalog.now() - interval '1 minute',
    pg_catalog.decode(repeat('b', 64), 'hex'), 'image/jpeg', v_file_version,
    'clean/' || v_file_version::text, 1, pg_catalog.now() - interval '1 minute'
  );

  select * into strict v_result from public.hotel_file_scan_command_v1(
    v_upload, 'CLAIM', v_new_token, 0, '{}'::jsonb,
    'd3000000-0000-4000-8000-000000000020'
  );
  if v_result.command_status <> 'CLAIMED'
     or v_result.result_snapshot ->> 'phase' <> 'CLEAN_PENDING_PROMOTION'
     or (v_result.result_snapshot ->> 'fileVersionId')::uuid <> v_file_version
     or v_result.result_snapshot ->> 'cleanObjectKey' <> 'clean/' || v_file_version::text then
    raise exception 'expired promotion claim was not recovered: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;
  v_generation := (v_result.result_snapshot ->> 'generation')::bigint;
  if v_generation <> 8 then
    raise exception 'unexpected recovery generation: %', v_generation;
  end if;

  select * into strict v_result from public.hotel_file_scan_command_v1(
    v_upload, 'CLAIM', v_new_token, 0, '{}'::jsonb,
    'd3000000-0000-4000-8000-000000000021'
  );
  if v_result.command_status <> 'REPLAYED' then
    raise exception 'same-token recovery replay failed: %', v_result.command_status;
  end if;

  select * into strict v_result from public.hotel_file_scan_command_v1(
    v_upload, 'CLAIM', v_foreign_token, 0, '{}'::jsonb,
    'd3000000-0000-4000-8000-000000000022'
  );
  if v_result.command_status <> 'BUSY' then
    raise exception 'active foreign recovery claim was not blocked: %', v_result.command_status;
  end if;

  select * into strict v_result from public.hotel_file_scan_command_v1(
    v_upload, 'PROMOTE_COMPLETE', v_new_token, v_generation,
    pg_catalog.jsonb_build_object(
      'fileVersionId', v_file_version,
      'cleanSha256', repeat('c', 64),
      'cleanEtag', '"cccccccccccccccccccccccccccccccc"',
      'cleanObjectVersion', 'recovered-clean-version-1',
      'cleanSize', 10,
      'exifLocationRemoved', true
    ), 'd3000000-0000-4000-8000-000000000023'
  );
  if v_result.command_status <> 'COMPLETED'
     or v_result.result_snapshot ->> 'status' <> 'READY_UNLINKED' then
    raise exception 'promotion recovery did not complete: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;
  if not exists (
    select 1 from public.hotel_file_versions
     where company_id = v_company and id = v_file_version
       and upload_id = v_upload and exif_location_removed
  ) then
    raise exception 'recovered immutable file version missing';
  end if;
  if not exists (
    select 1 from public.outbox_jobs
     where id = v_dispatch and status = 'SUCCEEDED'
  ) then
    raise exception 'recovered dispatch not completed';
  end if;
end
$test$;

rollback;

select 'HOTEL_FILE_FINALIZER_RECOVERY_OK';
