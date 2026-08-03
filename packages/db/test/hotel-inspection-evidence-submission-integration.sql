\set ON_ERROR_STOP on

begin;

do $evidence_submission$
declare
  v_company constant uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel constant uuid := '50000000-0000-4000-8000-000000000001';
  v_session constant uuid := '4f000000-0000-4000-8000-000000000001';
  v_token constant text := repeat('I', 43);
  v_inspection constant uuid := 'c3000000-0000-4000-8000-000000000001';
  v_execution constant uuid := 'c4000000-0000-4000-8000-000000000001';
  v_upload constant uuid := 'c6000000-0000-4000-8000-000000000001';
  v_result_id constant uuid := 'c8000000-0000-4000-8000-000000000001';
  v_item_snapshot uuid;
  v_inspection_version integer;
  v_result record;
begin
  perform set_config('app.session_id', v_session::text, true);

  update public.hotel_inspections
     set status = 'PENDING_INPUT', version = version + 1
   where company_id = v_company and id = v_inspection;
  select version into strict v_inspection_version
    from public.hotel_inspections
   where company_id = v_company and id = v_inspection;

  update public.process_executions
     set state = 'PENDING_INPUT', current_stage_key = null,
         current_stage_name = null, current_reviewer_user_id = null,
         current_delegate_user_id = null, current_due_at = null,
         completed_at = null, version = version + 1
   where company_id = v_company and id = v_execution;

  select item_snapshot_id into strict v_item_snapshot
    from public.inspection_item_results
   where company_id = v_company and id = v_result_id;

  update public.inspection_item_results
     set result = 'ABNORMAL', description = '제출 증빙 정본 재검증',
         severity = 'MAJOR', version = 1
   where company_id = v_company and id = v_result_id;

  update public.hotel_file_uploads
     set status = 'READY_UNLINKED'
   where company_id = v_company and id = v_upload;

  select * into v_result from public.hotel_inspection_command_v2(
    v_company, v_hotel, v_inspection, 'SUBMIT', v_inspection_version,
    jsonb_build_object(
      'historyId', 'fa000000-0000-4000-8000-000000000001',
      'reason', '손상된 파일 상태 제출 차단'
    ),
    v_token, 'fa000000-0000-4000-8000-000000000002',
    'evidence-submit-invalid-file', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/c3000000-0000-4000-8000-000000000001/submit',
    'hash-evidence-submit-invalid-file',
    'fa000000-0000-4000-8000-000000000003',
    'fa000000-0000-4000-8000-000000000004'
  );
  if v_result.command_status <> 'INSPECTION_RESULT_EVIDENCE_REQUIRED' then
    raise exception 'non-LINKED evidence submit was not blocked: %',
      v_result.command_status;
  end if;

  update public.hotel_file_uploads
     set status = 'LINKED'
   where company_id = v_company and id = v_upload;

  select * into v_result from public.hotel_inspection_command_v2(
    v_company, v_hotel, v_inspection, 'SUBMIT', v_inspection_version,
    jsonb_build_object(
      'historyId', 'fa000000-0000-4000-8000-000000000005',
      'reason', '현재 CLEAN 증빙 제출'
    ),
    v_token, 'fa000000-0000-4000-8000-000000000006',
    'evidence-submit-clean', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/c3000000-0000-4000-8000-000000000001/submit',
    'hash-evidence-submit-clean',
    'fa000000-0000-4000-8000-000000000007',
    'fa000000-0000-4000-8000-000000000008'
  );
  if v_result.command_status <> 'UPDATED'
     or v_result.result_snapshot ->> 'status' <> 'IN_REVIEW' then
    raise exception 'current CLEAN evidence submit failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v2(
    v_company, v_hotel, v_inspection, 'SAVE_RESULT', 1,
    '{}'::jsonb, v_token,
    'fa000000-0000-4000-8000-000000000009',
    'evidence-post-submit-save', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/c3000000-0000-4000-8000-000000000001/items/result',
    'hash-evidence-post-submit-save',
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000011'
  );
  if v_result.command_status <> 'INSPECTION_FINAL_LOCKED' then
    raise exception 'post-submit result mutation was not blocked: %',
      v_result.command_status;
  end if;

  select * into v_result from public.hotel_inspection_command_v2(
    v_company, v_hotel, v_inspection, 'SAVE_RESULT', 0,
    '{}'::jsonb, v_token,
    'fa000000-0000-4000-8000-000000000012',
    'result-save', 'PUT', '/api/inspections/result',
    'hash-result-save',
    'fa000000-0000-4000-8000-000000000013',
    'fa000000-0000-4000-8000-000000000014'
  );
  if v_result.command_status <> 'REPLAYED' then
    raise exception 'completed pre-submit result replay was not preserved: %',
      v_result.command_status;
  end if;
end
$evidence_submission$;

rollback;

select 'HOTEL_INSPECTION_EVIDENCE_SUBMISSION_OK';
