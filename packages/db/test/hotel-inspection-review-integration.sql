\set ON_ERROR_STOP on

begin;

do $inspection_review$
declare
  v_company constant uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel constant uuid := '50000000-0000-4000-8000-000000000001';
  v_session constant uuid := '4f000000-0000-4000-8000-000000000001';
  v_user constant uuid := '2f000000-0000-4000-8000-000000000001';
  v_token constant text := repeat('I', 43);
  v_definition constant uuid := 'db100000-0000-4000-8000-000000000001';
  v_revision constant uuid := 'db200000-0000-4000-8000-000000000001';
  v_inspection constant uuid := 'db300000-0000-4000-8000-000000000001';
  v_execution constant uuid := 'db400000-0000-4000-8000-000000000001';
  v_item_source constant uuid := 'db500000-0000-4000-8000-000000000001';
  v_upload constant uuid := 'db600000-0000-4000-8000-000000000001';
  v_file_version constant uuid := 'db700000-0000-4000-8000-000000000001';
  v_result_id constant uuid := 'db800000-0000-4000-8000-000000000001';
  v_item_snapshot uuid;
  v_generation bigint;
  v_process_version integer;
  v_default_version integer;
  v_previous_default_definition uuid;
  v_checklist_version integer;
  v_inspection_version integer;
  v_result record;
  v_payload jsonb;
  v_grant uuid;
  v_trace uuid;
  v_completion constant text := repeat('Z', 43);
  v_recovered integer;
  v_other_user uuid;
  v_owner_finalizer_was_registered boolean;
  v_window timestamptz := pg_catalog.date_bin(
    interval '5 minutes', pg_catalog.statement_timestamp(),
    timestamptz '1970-01-01 00:00:00+00'
  );
begin
  perform set_config('app.session_id', v_session::text, true);
  select exists (
    select 1 from public.hotel_file_finalizer_capabilities
     where role_name = session_user
  ) into v_owner_finalizer_was_registered;
  insert into public.hotel_file_finalizer_capabilities (role_name)
  values (session_user)
  on conflict do nothing;

  select * into v_result from public.hotel_process_command_v1(
    v_company, null, v_definition, 'SAVE_DEFINITION', 0,
    jsonb_build_object(
      'revisionId', v_revision, 'applicationType', 'ROOM_INSPECTION',
      'scope', 'COMPANY', 'name', '점검 검토 revision 통합시험',
      'startStageKey', 'MANAGER_REVIEW', 'reason', '검토 통합시험 정의',
      'stages', jsonb_build_array(
        jsonb_build_object(
          'id', 'db210000-0000-4000-8000-000000000001',
          'key', 'MANAGER_REVIEW', 'name', '관리자 검토',
          'reviewerUserId', v_user, 'delegate', null,
          'due', jsonb_build_object('amount', 4, 'unit', 'HOURS'),
          'isFinal', false
        ),
        jsonb_build_object(
          'id', 'db210000-0000-4000-8000-000000000002',
          'key', 'RECHECK', 'name', '최종 재검토',
          'reviewerUserId', v_user, 'delegate', null,
          'due', null, 'isFinal', true
        )
      ),
      'transitions', jsonb_build_array(
        jsonb_build_object(
          'id', 'db220000-0000-4000-8000-000000000002',
          'fromStageKey', 'MANAGER_REVIEW', 'event', 'REJECT',
          'choiceValue', null, 'toStageKey', 'RECHECK'
        )
      )
    ),
    v_token, gen_random_uuid(), 'review-process-create', 'POST',
    '/api/admin/process-definitions', 'hash-review-process-create',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'revision REJECT definition failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select default_record.definition_id, default_record.version
    into v_previous_default_definition, v_default_version
    from public.hotel_process_defaults default_record
   where default_record.company_id = v_company
     and default_record.branch_id = v_hotel
     and default_record.application_type = 'ROOM_INSPECTION';
  v_default_version := coalesce(v_default_version, 0);
  if v_previous_default_definition is null then
    raise exception 'review fixture requires an existing room inspection default';
  end if;
  select * into v_result from public.hotel_process_command_v1(
    v_company, v_hotel, v_definition, 'SET_DEFAULT', v_default_version,
    jsonb_build_object('processDefinitionId', v_definition, 'reason', '검토 통합시험 기본 process'),
    v_token, gen_random_uuid(), 'review-process-default', 'PUT',
    '/api/hotels/default-process', 'hash-review-process-default',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'UPDATED' then
    raise exception 'review default failed: %', v_result.command_status;
  end if;

  select coalesce(max(revision.version), 0) into v_checklist_version
    from public.inspection_checklist_revisions revision
   where revision.company_id = v_company and revision.branch_id = v_hotel;
  select * into v_result from public.hotel_inspection_command_v2(
    v_company, v_hotel, null, 'SAVE_CHECKLIST', v_checklist_version,
    jsonb_build_object(
      'revisionId', 'db230000-0000-4000-8000-000000000001',
      'reason', '검토 통합시험 점검표',
      'items', jsonb_build_array(jsonb_build_object(
        'snapshotId', 'db240000-0000-4000-8000-000000000001',
        'itemId', v_item_source, 'source', 'HOTEL_COMMON', 'roomTypeId', null,
        'excludedRoomTypeIds', jsonb_build_array(), 'name', '욕실 누수 확인',
        'description', '욕실 배관을 확인합니다.', 'isRequired', true,
        'displayOrder', 10, 'defaultSeverity', 'MAJOR'
      ))
    ),
    v_token, gen_random_uuid(), 'review-checklist-create', 'PUT',
    '/api/hotels/checklist', 'hash-review-checklist-create',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status not in ('CREATED', 'UPDATED') then
    raise exception 'review checklist failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v2(
    v_company, v_hotel, v_inspection, 'CREATE_MANUAL', 0,
    jsonb_build_object(
      'processExecutionId', v_execution, 'processDefinitionId', null,
      'reason', '검토 통합시험 수시점검',
      'targets', jsonb_build_array(jsonb_build_object(
        'roomId', 'bc000000-0000-4000-8000-000000000001',
        'selectedItemIds', jsonb_build_array(v_item_source)
      ))
    ),
    v_token, gen_random_uuid(), 'review-inspection-create', 'POST',
    '/api/hotels/inspections/manual', 'hash-review-inspection-create',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'review inspection failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;
  select id into strict v_item_snapshot from public.inspection_item_snapshots
   where company_id = v_company and inspection_id = v_inspection;

  select * into v_result from public.hotel_file_command_v1(
    v_company, v_hotel, v_upload, 'UPLOAD_INIT', 0,
    jsonb_build_object(
      'inspectionId', v_inspection, 'itemSnapshotId', v_item_snapshot,
      'fileName', '욕실누수.jpg', 'mimeType', 'image/jpeg', 'sizeBytes', 12,
      'quarantineObjectKey', 'quarantine/' || v_upload::text || '/' || repeat('Q', 43),
      'reservationFingerprint', repeat('a', 64)
    ),
    v_token, gen_random_uuid(), 'review-file-init', 'POST',
    '/api/hotels/files/upload-init', 'hash-review-file-init',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'review upload init failed: %', v_result.command_status;
  end if;
  select * into v_result from public.hotel_file_command_v1(
    v_company, v_hotel, v_upload, 'UPLOAD_COMPLETE', 0,
    jsonb_build_object(
      'etag', '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"', 'objectVersion', 'version-1',
      'sizeBytes', 12, 'mimeType', 'image/jpeg',
      'reservationFingerprint', repeat('a', 64), 'scanJobId', gen_random_uuid()
    ),
    v_token, gen_random_uuid(), 'review-file-complete', 'POST',
    '/api/files/complete', 'hash-review-file-complete',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'UPDATED' then
    raise exception 'review upload complete failed: %', v_result.command_status;
  end if;
  select * into v_result from public.hotel_file_scan_command_v1(
    v_upload, 'CLAIM', repeat('C', 43), 0, '{}'::jsonb, gen_random_uuid()
  );
  v_generation := (v_result.result_snapshot ->> 'generation')::bigint;
  select * into v_result from public.hotel_file_scan_command_v1(
    v_upload, 'SCAN_CLEAN', repeat('C', 43), v_generation,
    jsonb_build_object(
      'fileVersionId', v_file_version, 'scannerSha256', repeat('b', 64),
      'detectedMime', 'image/jpeg', 'cleanObjectKey', 'clean/' || v_file_version::text
    ), gen_random_uuid()
  );
  if v_result.command_status <> 'RECORDED' then
    raise exception 'review scan clean failed: %', v_result.command_status;
  end if;
  select * into v_result from public.hotel_file_scan_command_v1(
    v_upload, 'PROMOTE_COMPLETE', repeat('C', 43), v_generation,
    jsonb_build_object(
      'fileVersionId', v_file_version, 'cleanSha256', repeat('c', 64),
      'cleanEtag', '"cccccccccccccccccccccccccccccccc"',
      'cleanObjectVersion', 'clean-version-1', 'cleanSize', 10,
      'exifLocationRemoved', true
    ), gen_random_uuid()
  );
  if v_result.command_status <> 'COMPLETED' then
    raise exception 'review promotion failed: %', v_result.command_status;
  end if;

  select * into v_result from public.hotel_inspection_command_v2(
    v_company, v_hotel, v_inspection, 'SAVE_RESULT', 0,
    jsonb_build_object(
      'itemSnapshotId', v_item_snapshot, 'resultId', v_result_id,
      'historyId', 'db810000-0000-4000-8000-000000000001',
      'result', 'ABNORMAL', 'description', '욕실 하부 누수',
      'severity', 'MAJOR', 'fileVersionIds', jsonb_build_array(v_file_version),
      'changeReason', null
    ),
    v_token, gen_random_uuid(), 'review-result-save', 'PUT',
    '/api/inspections/result', 'hash-review-result-save',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'review result save failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;
  select version into strict v_inspection_version from public.hotel_inspections
   where company_id = v_company and id = v_inspection;
  select * into v_result from public.hotel_inspection_command_v2(
    v_company, v_hotel, v_inspection, 'SUBMIT', v_inspection_version,
    jsonb_build_object('historyId', gen_random_uuid(), 'reason', '검토 통합시험 제출'),
    v_token, gen_random_uuid(), 'review-submit', 'POST',
    '/api/hotels/review/submit', 'hash-review-submit',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'UPDATED' then
    raise exception 'review submit failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_reviews_read_v1(
    v_company, v_hotel, v_inspection, '{}'::jsonb, v_token
  );
  if v_result.command_status <> 'OK'
     or v_result.result_snapshot #>> '{review,review,currentStage,key}' <> 'MANAGER_REVIEW'
     or v_result.result_snapshot #>> '{review,provenance,submittedBy,id}' <> v_user::text
     or jsonb_array_length(v_result.result_snapshot #> '{review,evidence}') <> 1
     or not exists (
       select 1 from jsonb_array_elements(v_result.result_snapshot #> '{review,review,actions}') action
        where action ->> 'event' = 'REJECT' and action ->> 'toStageKey' = 'RECHECK'
     ) then
    raise exception 'assigned review snapshot invalid: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  v_grant := gen_random_uuid(); v_trace := gen_random_uuid();
  select * into v_result from public.hotel_file_view_command_v1(
    v_company, v_hotel, v_inspection, v_file_version, 'AUTHORIZE', v_token,
    v_grant, v_completion, gen_random_uuid(), gen_random_uuid(), v_trace
  );
  if v_result.command_status <> 'OK'
     or v_result.result_snapshot ->> 'cleanObjectKey' <> 'clean/' || v_file_version::text then
    raise exception 'CLEAN file authorization failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;
  select * into v_result from public.hotel_file_view_command_v1(
    v_company, v_hotel, v_inspection, v_file_version, 'SUCCEEDED', v_token,
    v_grant, v_completion, gen_random_uuid(), gen_random_uuid(), v_trace
  );
  if v_result.command_status <> 'RECORDED' then
    raise exception 'file terminal success failed: %', v_result.command_status;
  end if;
  select * into v_result from public.hotel_file_view_command_v1(
    v_company, v_hotel, v_inspection, v_file_version, 'FAILED', v_token,
    v_grant, v_completion, gen_random_uuid(), gen_random_uuid(), v_trace
  );
  if v_result.command_status <> 'INVALID_STATE_TRANSITION' then
    raise exception 'file grant terminal state changed twice: %', v_result.command_status;
  end if;

  delete from public.hotel_file_access_rate_windows where company_id = v_company;
  v_grant := gen_random_uuid(); v_trace := gen_random_uuid();
  insert into public.hotel_file_access_grants (
    id, company_id, branch_id, actor_user_id, actor_type, session_id,
    inspection_id, file_version_id, completion_token_hash, status, trace_id,
    started_at, expires_at
  ) values (
    v_grant, v_company, v_hotel, v_user, 'EMPLOYEE', v_session,
    v_inspection, v_file_version,
    pg_catalog.sha256(pg_catalog.convert_to(v_completion, 'UTF8')),
    'STARTED', v_trace,
    pg_catalog.statement_timestamp() - interval '20 minutes',
    pg_catalog.statement_timestamp() - interval '5 minutes'
  );
  select * into v_result from public.hotel_file_view_command_v1(
    v_company, v_hotel, v_inspection, v_file_version, 'AUTHORIZE', v_token,
    gen_random_uuid(), v_completion, gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid()
  );
  if v_result.command_status <> 'OK'
     or (select status from public.hotel_file_access_grants
          where company_id = v_company and id = v_grant) <> 'ABORTED'
     or not exists (
       select 1 from public.audit_events
        where company_id = v_company
          and event_code = 'HOTEL_FILE_VIEW_ABANDONED'
          and resource_id = v_file_version
          and trace_id = v_trace
     ) then
    raise exception 'stale file grant recovery failed: %', v_result.command_status;
  end if;

  delete from public.hotel_file_access_rate_windows where company_id = v_company;
  select * into v_result from public.hotel_file_view_command_v1(
    v_company, v_hotel, v_inspection, gen_random_uuid(), 'AUTHORIZE', v_token,
    gen_random_uuid(), v_completion, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'NOT_FOUND'
     or (select request_count from public.hotel_file_access_rate_windows
          where company_id = v_company and scope_type = 'USER') <> 1 then
    raise exception 'authenticated denied probe was not counted: %', v_result.command_status;
  end if;

  delete from public.hotel_file_access_rate_windows where company_id = v_company;
  insert into public.hotel_file_access_rate_windows(
    company_id, branch_id, scope_type, scope_id, window_started_at, request_count
  ) values (v_company, v_hotel, 'HOTEL', v_hotel, v_window, 79);
  v_trace := gen_random_uuid();
  select * into v_result from public.hotel_file_view_command_v1(
    v_company, v_hotel, v_inspection, v_file_version, 'AUTHORIZE', v_token,
    gen_random_uuid(), v_completion, gen_random_uuid(), gen_random_uuid(), v_trace
  );
  if v_result.command_status <> 'OK'
     or not exists (select 1 from public.audit_events
       where company_id = v_company and event_code = 'HOTEL_FILE_BULK_EXPORT_ALERT'
         and trace_id = v_trace) then
    raise exception 'hotel bulk export alert failed: %', v_result.command_status;
  end if;

  delete from public.hotel_file_access_rate_windows where company_id = v_company;
  insert into public.hotel_file_access_rate_windows(
    company_id, branch_id, scope_type, scope_id, window_started_at, request_count
  ) values (v_company, v_hotel, 'USER', v_user, v_window, 30);
  select * into v_result from public.hotel_file_view_command_v1(
    v_company, v_hotel, v_inspection, v_file_version, 'AUTHORIZE', v_token,
    gen_random_uuid(), v_completion, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'RATE_LIMITED' then
    raise exception 'user export threshold failed: %', v_result.command_status;
  end if;

  delete from public.hotel_file_access_rate_windows where company_id = v_company;
  insert into public.hotel_file_access_rate_windows(
    company_id, branch_id, scope_type, scope_id, window_started_at, request_count
  ) values (v_company, v_hotel, 'HOTEL', v_hotel, v_window, 100);
  select * into v_result from public.hotel_file_view_command_v1(
    v_company, v_hotel, v_inspection, v_file_version, 'AUTHORIZE', v_token,
    gen_random_uuid(), v_completion, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'RATE_LIMITED' then
    raise exception 'hotel export threshold failed: %', v_result.command_status;
  end if;

  select version into strict v_process_version from public.process_executions
   where company_id = v_company and id = v_execution;
  select * into v_result from public.hotel_inspection_transition_v1(
    v_company, v_hotel, v_inspection, v_process_version,
    jsonb_build_object('historyId', gen_random_uuid(), 'event', 'REJECT',
      'choiceValue', null, 'reason', 'revision 반려'),
    v_token, gen_random_uuid(), 'review-reject',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/db300000-0000-4000-8000-000000000001/process/transition', 'hash-review-reject',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'UPDATED'
     or (select current_stage_key from public.process_executions
          where company_id = v_company and id = v_execution) <> 'RECHECK'
     or (select status from public.hotel_inspections
          where company_id = v_company and id = v_inspection) <> 'IN_REVIEW' then
    raise exception 'revision REJECT destination failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_transition_v1(
    v_company, v_hotel, v_inspection, v_process_version,
    jsonb_build_object('historyId', gen_random_uuid(), 'event', 'REJECT',
      'choiceValue', null, 'reason', 'stale 동시 반려'),
    v_token, gen_random_uuid(), 'review-stale-reject',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/db300000-0000-4000-8000-000000000001/process/transition',
    'hash-review-stale-reject', gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'VERSION_CONFLICT'
     or (select version from public.process_executions
          where company_id = v_company and id = v_execution) <> v_process_version + 1
     or (select current_stage_key from public.process_executions
          where company_id = v_company and id = v_execution) <> 'RECHECK' then
    raise exception 'stale concurrent transition was not side-effect free: %', v_result.command_status;
  end if;

  select version into strict v_process_version from public.process_executions
   where company_id = v_company and id = v_execution;
  select * into v_result from public.hotel_inspection_transition_v1(
    v_company, v_hotel, v_inspection, v_process_version,
    jsonb_build_object('historyId', gen_random_uuid(), 'event', 'SELECT',
      'choiceValue', 'BYPASS', 'reason', '우회 시도'),
    v_token, gen_random_uuid(), 'review-final-select',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/db300000-0000-4000-8000-000000000001/process/transition', 'hash-review-final-select',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'INVALID_STATE_TRANSITION'
     or (select version from public.process_executions
          where company_id = v_company and id = v_execution) <> v_process_version
     or (select state from public.process_executions
          where company_id = v_company and id = v_execution) <> 'IN_REVIEW' then
    raise exception 'final SELECT bypass was not side-effect free: %', v_result.command_status;
  end if;

  select * into v_result from public.hotel_inspection_transition_v1(
    v_company, v_hotel, v_inspection, v_process_version,
    jsonb_build_object('historyId', gen_random_uuid(), 'event', 'APPROVE',
      'choiceValue', null, 'reason', '최종 승인'),
    v_token, gen_random_uuid(), 'review-final-approve',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/db300000-0000-4000-8000-000000000001/process/transition', 'hash-review-final-approve',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'UPDATED'
     or v_result.result_snapshot #>> '{inspection,status}' <> 'COMPLETED'
     or (select state from public.process_executions
          where company_id = v_company and id = v_execution) <> 'COMPLETED' then
    raise exception 'final APPROVE receipt failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;
  select * into v_result from public.hotel_inspection_reviews_read_v1(
    v_company, v_hotel, v_inspection, '{}'::jsonb, v_token
  );
  if v_result.command_status <> 'OK'
     or v_result.result_snapshot #>> '{review,inspection,status}' <> 'COMPLETED' then
    raise exception 'authorized completed read-only detail failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;
  select id into strict v_other_user
    from public.users
   where company_id = v_company and id <> v_user
   order by id
   limit 1;
  alter table public.process_execution_history
    disable trigger process_execution_history_append_only;
  update public.process_execution_history
     set actor_user_id = v_other_user
   where company_id = v_company
     and execution_id = v_execution
     and next_state = 'COMPLETED';
  alter table public.process_execution_history
    enable trigger process_execution_history_append_only;
  select * into v_result from public.hotel_inspection_reviews_read_v1(
    v_company, v_hotel, v_inspection, '{}'::jsonb, v_token
  );
  if v_result.command_status <> 'NOT_FOUND' then
    raise exception 'unassigned completed detail was exposed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;
  select * into v_result from public.hotel_inspection_reviews_read_v1(
    v_company, v_hotel, v_inspection,
    jsonb_build_object('transitionIdempotencyKey', 'review-final-approve'),
    v_token
  );
  if v_result.command_status <> 'INVALID_STATE_TRANSITION' then
    raise exception 'detail query receipt bypass was not rejected: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select default_record.version into strict v_default_version
    from public.hotel_process_defaults default_record
   where default_record.company_id = v_company
     and default_record.branch_id = v_hotel
     and default_record.application_type = 'ROOM_INSPECTION';
  select * into v_result from public.hotel_process_command_v1(
    v_company, v_hotel, v_previous_default_definition, 'SET_DEFAULT',
    v_default_version,
    jsonb_build_object(
      'processDefinitionId', v_previous_default_definition,
      'reason', '검토 통합시험 기본 process 복원'
    ),
    v_token, gen_random_uuid(), 'review-process-default-restore', 'PUT',
    '/api/hotels/default-process', 'hash-review-process-default-restore',
    gen_random_uuid(), gen_random_uuid()
  );
  if v_result.command_status <> 'UPDATED' then
    raise exception 'review default restore failed: %', v_result.command_status;
  end if;

  v_grant := gen_random_uuid();
  v_trace := gen_random_uuid();
  insert into public.hotel_file_access_grants (
    id, company_id, branch_id, actor_user_id, actor_type, session_id,
    inspection_id, file_version_id, completion_token_hash, status, trace_id,
    started_at, expires_at
  ) values (
    v_grant, v_company, v_hotel, v_user, 'EMPLOYEE', v_session,
    v_inspection, v_file_version,
    pg_catalog.sha256(pg_catalog.convert_to(v_completion, 'UTF8')),
    'STARTED', v_trace,
    pg_catalog.statement_timestamp() - interval '20 minutes',
    pg_catalog.statement_timestamp() - interval '5 minutes'
  );
  update public.runtime_database_capabilities
     set capability = 'RECONCILER'
   where role_name = session_user;
  select recovered_count into strict v_recovered
    from public.hotel_file_access_recover_expired_v1(500);
  if v_recovered <> 1
     or (select status from public.hotel_file_access_grants
          where company_id = v_company and id = v_grant) <> 'ABORTED'
     or not exists (
       select 1 from public.audit_events
        where company_id = v_company
          and event_code = 'HOTEL_FILE_VIEW_ABANDONED'
          and resource_id = v_file_version
          and trace_id = v_trace
     ) then
    raise exception 'scheduled file access recovery failed: %', v_recovered;
  end if;
  select recovered_count into strict v_recovered
    from public.hotel_file_access_recover_expired_v1(500);
  if v_recovered <> 0 then
    raise exception 'scheduled file access recovery was not idempotent: %', v_recovered;
  end if;
  update public.runtime_database_capabilities
     set capability = 'API_RUNTIME'
   where role_name = session_user;
  if not v_owner_finalizer_was_registered then
    delete from public.hotel_file_finalizer_capabilities
     where role_name = session_user;
  end if;
end
$inspection_review$;

commit;

select 'HOTEL_INSPECTION_REVIEW_OK';
