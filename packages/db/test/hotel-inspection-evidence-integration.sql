\set ON_ERROR_STOP on

begin;

do $evidence_processing$
declare
  v_company constant uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel constant uuid := '50000000-0000-4000-8000-000000000001';
  v_pending_inspection constant uuid := 'e1000000-0000-4000-8000-000000000001';
  v_completed_inspection constant uuid := 'c3000000-0000-4000-8000-000000000001';
  v_pending_result constant uuid := 'e6000000-0000-4000-8000-000000000001';
  v_other_result constant uuid := 'f1000000-0000-4000-8000-000000000001';
  v_completed_result constant uuid := 'c8000000-0000-4000-8000-000000000001';
  v_item uuid;
  v_completed_item uuid;
  v_candidate_upload constant uuid := 'c6200000-0000-4000-8000-000000000001';
  v_candidate_dispatch constant uuid := 'c9200000-0000-4000-8000-000000000001';
  v_candidate_job constant uuid := 'c8200000-0000-4000-8000-000000000001';
  v_reuse_upload constant uuid := 'c6300000-0000-4000-8000-000000000001';
  v_reuse_file constant uuid := 'c7300000-0000-4000-8000-000000000001';
  v_terminal_upload constant uuid := 'c6300000-0000-4000-8000-000000000002';
  v_terminal_file constant uuid := 'c7300000-0000-4000-8000-000000000002';
  v_count integer;
begin
  insert into public.runtime_database_capabilities(role_name, capability)
  values (session_user, 'RECONCILER')
  on conflict (role_name) do update set capability = excluded.capability;
  insert into public.hotel_file_finalizer_capabilities(role_name)
  values (session_user)
  on conflict (role_name) do nothing;
  perform pg_catalog.set_config('app.reconciler_company_id', v_company::text, true);

  select result_record.item_snapshot_id into strict v_item
    from public.inspection_item_results result_record
   where result_record.company_id = v_company and result_record.id = v_pending_result;
  select result_record.item_snapshot_id into strict v_completed_item
    from public.inspection_item_results result_record
   where result_record.company_id = v_company and result_record.id = v_completed_result;

  insert into public.hotel_file_uploads (
    id, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    display_name, declared_mime, reserved_size, quarantine_object_key,
    reservation_fingerprint, status, source_etag, source_object_version,
    initiated_by, initiated_session_id, expires_at, quota_released_at
  )
  select v_candidate_upload, company_id, branch_id, parent_type,
    v_pending_inspection, v_item, 'candidate.jpg', declared_mime, reserved_size,
    'quarantine/' || v_candidate_upload || '/' || repeat('D', 43),
    repeat('d', 64), 'QUARANTINED', source_etag, source_object_version,
    initiated_by, initiated_session_id, pg_catalog.now() + interval '1 hour', null
    from public.hotel_file_uploads where id = 'c6000000-0000-4000-8000-000000000001';
  insert into public.outbox_jobs(
    id, company_id, branch_id, job_type, payload, status, attempt_count, available_at
  ) values (
    v_candidate_dispatch, v_company, v_hotel, 'HOTEL_FILE_SCAN',
    pg_catalog.jsonb_build_object('uploadId', v_candidate_upload),
    'PENDING', 0, pg_catalog.now() - interval '1 minute'
  );
  insert into public.hotel_file_scan_jobs(
    id, company_id, branch_id, upload_id, dispatch_job_id, status,
    attempt_count, available_at
  ) values (
    v_candidate_job, v_company, v_hotel, v_candidate_upload,
    v_candidate_dispatch, 'PENDING', 0, pg_catalog.now() - interval '1 minute'
  );

  select pg_catalog.count(*) into v_count
    from public.hotel_file_scan_candidates_v1(25) candidate
   where candidate.upload_id = v_candidate_upload;
  if v_count <> 1 then raise exception 'due candidate was not listed'; end if;

  update public.hotel_file_scan_jobs
     set available_at = pg_catalog.now() + interval '1 hour'
   where id = v_candidate_job;
  select pg_catalog.count(*) into v_count
    from public.hotel_file_scan_candidates_v1(25) candidate
   where candidate.upload_id = v_candidate_upload;
  if v_count <> 0 then raise exception 'future candidate was listed'; end if;

  update public.hotel_file_scan_jobs
     set status = 'CLAIMED', available_at = pg_catalog.now() - interval '1 minute',
         claim_token_hash = pg_catalog.sha256(pg_catalog.convert_to(repeat('L', 43), 'UTF8')),
         claim_generation = 1, claim_expires_at = pg_catalog.now() - interval '1 minute'
   where id = v_candidate_job;
  select pg_catalog.count(*) into v_count
    from public.hotel_file_scan_candidates_v1(25) candidate
   where candidate.upload_id = v_candidate_upload;
  if v_count <> 1 then raise exception 'expired claim was not reclaimed'; end if;

  update public.hotel_file_scan_jobs set attempt_count = 5 where id = v_candidate_job;
  select pg_catalog.count(*) into v_count
    from public.hotel_file_scan_candidates_v1(25) candidate
   where candidate.upload_id = v_candidate_upload;
  if v_count <> 0 then raise exception 'exhausted candidate was listed'; end if;

  insert into public.hotel_file_uploads (
    id, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    display_name, declared_mime, reserved_size, quarantine_object_key,
    reservation_fingerprint, status, source_etag, source_object_version,
    initiated_by, initiated_session_id, expires_at, quota_released_at
  )
  select v_reuse_upload, company_id, branch_id, parent_type,
    v_pending_inspection, v_item, 'reuse.jpg', declared_mime, reserved_size,
    'quarantine/' || v_reuse_upload || '/' || repeat('E', 43),
    repeat('e', 64), 'READY_UNLINKED', source_etag, source_object_version,
    initiated_by, initiated_session_id, pg_catalog.now() + interval '1 hour', pg_catalog.now()
    from public.hotel_file_uploads where id = 'c6000000-0000-4000-8000-000000000001';
  insert into public.hotel_file_versions(
    id, company_id, branch_id, upload_id, version, clean_object_key,
    clean_etag, clean_object_version, clean_sha256, clean_size, detected_mime,
    display_name, exif_location_removed, original_retention_until
  )
  select v_reuse_file, company_id, branch_id, v_reuse_upload, version,
    'clean/' || v_reuse_file, clean_etag, 'reuse-version', clean_sha256,
    clean_size, detected_mime, 'reuse.jpg', true, pg_catalog.now() + interval '1 year'
    from public.hotel_file_versions where id = 'c7000000-0000-4000-8000-000000000001';

  insert into public.hotel_file_links(
    id, company_id, branch_id, file_version_id, parent_type,
    inspection_id, item_snapshot_id, result_id, result_version, linked_by
  ) values (
    'c7400000-0000-4000-8000-000000000001', v_company, v_hotel, v_reuse_file,
    'INSPECTION_ITEM_EVIDENCE', v_pending_inspection, v_item,
    v_pending_result, 1, '2f000000-0000-4000-8000-000000000001'
  );
  insert into public.hotel_file_links(
    id, company_id, branch_id, file_version_id, parent_type,
    inspection_id, item_snapshot_id, result_id, result_version, linked_by
  ) values (
    'c7400000-0000-4000-8000-000000000002', v_company, v_hotel, v_reuse_file,
    'INSPECTION_ITEM_EVIDENCE', v_pending_inspection, v_item,
    v_pending_result, 2, '2f000000-0000-4000-8000-000000000001'
  );

  begin
    insert into public.hotel_file_links(
      id, company_id, branch_id, file_version_id, parent_type,
      inspection_id, item_snapshot_id, result_id, result_version, linked_by
    )
    select 'c7400000-0000-4000-8000-000000000003', v_company, v_hotel,
      v_reuse_file, 'INSPECTION_ITEM_EVIDENCE', v_pending_inspection,
      result_record.item_snapshot_id, v_other_result, 1,
      '2f000000-0000-4000-8000-000000000001'
      from public.inspection_item_results result_record
     where result_record.company_id = v_company and result_record.id = v_other_result;
    raise exception 'cross-result evidence move was accepted';
  exception when check_violation then
    if sqlerrm <> 'EVIDENCE_PARENT_IMMUTABLE' then raise; end if;
  end;

  insert into public.hotel_file_uploads (
    id, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
    display_name, declared_mime, reserved_size, quarantine_object_key,
    reservation_fingerprint, status, source_etag, source_object_version,
    initiated_by, initiated_session_id, expires_at, quota_released_at
  )
  select v_terminal_upload, company_id, branch_id, parent_type,
    v_completed_inspection, v_completed_item, 'terminal.jpg', declared_mime, reserved_size,
    'quarantine/' || v_terminal_upload || '/' || repeat('F', 43),
    repeat('f', 64), 'READY_UNLINKED', source_etag, source_object_version,
    initiated_by, initiated_session_id, pg_catalog.now() + interval '1 hour', pg_catalog.now()
    from public.hotel_file_uploads where id = 'c6000000-0000-4000-8000-000000000001';
  insert into public.hotel_file_versions(
    id, company_id, branch_id, upload_id, version, clean_object_key,
    clean_etag, clean_object_version, clean_sha256, clean_size, detected_mime,
    display_name, exif_location_removed, original_retention_until
  )
  select v_terminal_file, company_id, branch_id, v_terminal_upload, version,
    'clean/' || v_terminal_file, clean_etag, 'terminal-version', clean_sha256,
    clean_size, detected_mime, 'terminal.jpg', true, pg_catalog.now() + interval '1 year'
    from public.hotel_file_versions where id = 'c7000000-0000-4000-8000-000000000001';

  begin
    insert into public.hotel_file_links(
      id, company_id, branch_id, file_version_id, parent_type,
      inspection_id, item_snapshot_id, result_id, result_version, linked_by
    ) values (
      'c7400000-0000-4000-8000-000000000004', v_company, v_hotel,
      v_terminal_file, 'INSPECTION_ITEM_EVIDENCE', v_completed_inspection,
      v_completed_item, v_completed_result, 2,
      '2f000000-0000-4000-8000-000000000001'
    );
    raise exception 'terminal inspection evidence insert was accepted';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'INSPECTION_FINAL_LOCKED' then raise; end if;
  end;
end
$evidence_processing$;

select 'HOTEL_INSPECTION_EVIDENCE_PROCESSING_OK';

rollback;
