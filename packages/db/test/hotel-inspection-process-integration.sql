\set ON_ERROR_STOP on

insert into runtime_database_capabilities (role_name, capability)
values (session_user, 'API_RUNTIME')
on conflict (role_name) do update set capability = excluded.capability;

insert into hotel_file_finalizer_capabilities (role_name)
values (session_user)
on conflict do nothing;

insert into users (id, company_id, user_type, display_name)
values (
  '2f000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'INTERNAL_STAFF', '점검 통합시험 전용 사용자'
) on conflict (id) do nothing;

insert into auth_identities (id, company_id, user_id, provider, provider_subject)
values (
  '3f000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '2f000000-0000-4000-8000-000000000001',
  'ZITADEL', 'inspection-process-integration'
) on conflict (id) do nothing;

insert into auth_sessions (
  id, company_id, user_id, identity_id, token_hash,
  idle_expires_at, absolute_expires_at, auth_time, authentication_method
) values (
  '4f000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '2f000000-0000-4000-8000-000000000001',
  '3f000000-0000-4000-8000-000000000001',
  sha256(convert_to(repeat('I', 43), 'UTF8')),
  now() + interval '7 hours', now() + interval '23 hours', now(), 'OIDC_PKCE'
) on conflict (id) do update set
  token_hash = excluded.token_hash,
  idle_expires_at = excluded.idle_expires_at,
  absolute_expires_at = excluded.absolute_expires_at,
  revoked_at = null;

insert into hotel_staff_assignments (
  id, company_id, branch_id, user_id, assignment_type,
  start_date, reason, created_by
)
select 'aa000000-0000-4000-8000-000000000001',
       '10000000-0000-0000-0000-000000000001',
       '50000000-0000-4000-8000-000000000001',
       '2f000000-0000-4000-8000-000000000001',
       'PRIMARY', current_date, '점검 통합시험 배정',
       '2f000000-0000-4000-8000-000000000001'
where not exists (
  select 1 from hotel_staff_assignments
   where company_id = '10000000-0000-0000-0000-000000000001'
     and user_id = '2f000000-0000-4000-8000-000000000001'
     and assignment_type = 'PRIMARY'
     and terminated_at is null
);

insert into permission_grants (
  id, company_id, subject_type, subject_id, permission_code,
  effect, valid_from, granted_by, reason
)
select gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
       'USER', '2f000000-0000-4000-8000-000000000001', permission_code,
       'ALLOW', now(), '2f000000-0000-4000-8000-000000000001', '점검 통합시험 권한'
  from unnest(array[
    'PROCESS_DEFINITION_MANAGE', 'HOTEL_INSPECTION_CONFIG',
    'HOTEL_INSPECTION_RUN', 'HOTEL_INSPECTION_REVIEW',
    'HOTEL_FILE_UPLOAD', 'HOTEL_FILE_READ'
  ]) permission_code
where not exists (
  select 1 from permission_grants grant_record
   where grant_record.company_id = '10000000-0000-0000-0000-000000000001'
     and grant_record.subject_type = 'USER'
     and grant_record.subject_id = '2f000000-0000-4000-8000-000000000001'
     and grant_record.permission_code = permission_code
     and grant_record.effect = 'ALLOW'
);

insert into hotel_room_types (
  id, company_id, branch_id, scope, name, display_order,
  is_active, created_by, updated_by
) values (
  'bb000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001', null, 'COMPANY',
  '점검 스탠다드', 10, true,
  '2f000000-0000-4000-8000-000000000001',
  '2f000000-0000-4000-8000-000000000001'
) on conflict do nothing;

insert into hotel_rooms (
  id, company_id, branch_id, room_number, floor_label, floor_sort_key,
  room_type_id, status, created_by, updated_by
) values (
  'bc000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'INSPECT-9001', '통합시험', 900,
  'bb000000-0000-4000-8000-000000000001', 'ACTIVE',
  '2f000000-0000-4000-8000-000000000001',
  '2f000000-0000-4000-8000-000000000001'
) on conflict do nothing;

do $journey$
declare
  v_result record;
  v_token text := repeat('I', 43);
  v_claim text := repeat('C', 43);
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_definition uuid := 'c1000000-0000-4000-8000-000000000001';
  v_revision uuid := 'c2000000-0000-4000-8000-000000000001';
  v_inspection uuid := 'c3000000-0000-4000-8000-000000000001';
  v_execution uuid := 'c4000000-0000-4000-8000-000000000001';
  v_item_source uuid := 'c5000000-0000-4000-8000-000000000001';
  v_upload uuid := 'c6000000-0000-4000-8000-000000000001';
  v_file_version uuid := 'c7000000-0000-4000-8000-000000000001';
  v_item_snapshot uuid;
  v_generation bigint;
  v_materialization_status text;
  v_materialized_from date;
  v_materialized_through date;
  v_created_count integer;
begin
  perform set_config('app.session_id', v_session::text, true);

  select * into v_result from public.hotel_process_command_v1(
    v_company, null, v_definition, 'SAVE_DEFINITION', 0,
    jsonb_build_object(
      'revisionId', v_revision, 'applicationType', 'ROOM_INSPECTION',
      'scope', 'COMPANY', 'name', '객실점검 2단계 검토',
      'startStageKey', 'MANAGER_REVIEW', 'reason', '통합시험 정의 생성',
      'stages', jsonb_build_array(
        jsonb_build_object(
          'id', 'c2100000-0000-4000-8000-000000000001',
          'key', 'MANAGER_REVIEW', 'name', '관리자 검토',
          'reviewerUserId', '2f000000-0000-4000-8000-000000000001',
          'delegate', null, 'due', jsonb_build_object('amount', 4, 'unit', 'HOURS'),
          'isFinal', false
        ),
        jsonb_build_object(
          'id', 'c2100000-0000-4000-8000-000000000002',
          'key', 'FINAL_REVIEW', 'name', '최종 검토',
          'reviewerUserId', '2f000000-0000-4000-8000-000000000001',
          'delegate', null, 'due', null, 'isFinal', true
        )
      ),
      'transitions', jsonb_build_array(
        jsonb_build_object(
          'id', 'c2200000-0000-4000-8000-000000000001',
          'fromStageKey', 'MANAGER_REVIEW', 'event', 'APPROVE',
          'choiceValue', null, 'toStageKey', 'FINAL_REVIEW'
        )
      )
    ),
    v_token, 'd1000000-0000-4000-8000-000000000001', 'process-create',
    'POST', '/api/admin/process-definitions', 'hash-process-create',
    'd2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'process create failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;
  select * into v_result from public.hotel_process_command_v1(
    v_company, v_hotel, v_definition, 'SET_DEFAULT', 0,
    jsonb_build_object(
      'processDefinitionId', v_definition,
      'reason', '통합시험 기본 process 지정'),
    v_token, 'd1000000-0000-4000-8000-000000000002', 'process-default',
    'PUT', '/api/hotels/default-process', 'hash-process-default',
    'd2000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000002'
  );
  if v_result.command_status <> 'UPDATED' then
    raise exception 'default process failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, null, 'SAVE_CHECKLIST', 0,
    jsonb_build_object(
      'revisionId', 'c2300000-0000-4000-8000-000000000001',
      'reason', '통합시험 점검표 생성',
      'items', jsonb_build_array(jsonb_build_object(
        'snapshotId', 'c2400000-0000-4000-8000-000000000001',
        'itemId', v_item_source, 'source', 'HOTEL_COMMON', 'roomTypeId', null,
        'excludedRoomTypeIds', jsonb_build_array(), 'name', '욕실 누수 확인',
        'description', '욕실 바닥과 배관을 확인합니다.', 'isRequired', true,
        'displayOrder', 10, 'defaultSeverity', 'MAJOR'
      ))
    ),
    v_token, 'd1000000-0000-4000-8000-000000000003', 'checklist-create',
    'PUT', '/api/hotels/checklist', 'hash-checklist-create',
    'd2000000-0000-4000-8000-000000000003', 'd3000000-0000-4000-8000-000000000003'
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'checklist save failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, 'ca000000-0000-4000-8000-000000000001', 'SAVE_ROUTINE', 0,
    jsonb_build_object(
      'revisionId', 'ca100000-0000-4000-8000-000000000001',
      'name', '매일 객실점검', 'status', 'ACTIVE', 'mode', 'FIXED',
      'recurrence', jsonb_build_object('type', 'DAILY'),
      'startDate', current_date, 'endDate', null, 'localDueTime', '18:00',
      'processDefinitionId', v_definition,
      'rounds', jsonb_build_array(jsonb_build_object(
        'id', 'ca200000-0000-4000-8000-000000000001', 'order', 1,
        'target', jsonb_build_object('type', 'HOTEL')
      )),
      'reason', '통합시험 정기루틴 생성'
    ),
    v_token, 'ea000000-0000-4000-8000-000000000001', 'routine-create',
    'POST', '/api/hotels/inspection-routines', 'hash-routine-create',
    'ea100000-0000-4000-8000-000000000001', 'ea200000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'routine save failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'CREATE_MANUAL', 0,
    jsonb_build_object(
      'processExecutionId', v_execution, 'processDefinitionId', null,
      'reason', '통합시험 수시점검 생성',
      'targets', jsonb_build_array(jsonb_build_object(
        'roomId', 'bc000000-0000-4000-8000-000000000001',
        'selectedItemIds', jsonb_build_array(v_item_source)
      ))
    ),
    v_token, 'd1000000-0000-4000-8000-000000000004', 'inspection-create',
    'POST', '/api/hotels/inspections/manual', 'hash-inspection-create',
    'd2000000-0000-4000-8000-000000000004', 'd3000000-0000-4000-8000-000000000004'
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'manual inspection failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;
  select id into strict v_item_snapshot from inspection_item_snapshots
   where company_id = v_company and inspection_id = v_inspection;

  select * into v_result from public.hotel_file_command_v1(
    v_company, v_hotel, v_upload, 'UPLOAD_INIT', 0,
    jsonb_build_object(
      'inspectionId', v_inspection, 'itemSnapshotId', v_item_snapshot,
      'fileName', '욕실누수.jpg', 'mimeType', 'image/jpeg', 'sizeBytes', 12,
      'quarantineObjectKey', 'quarantine/' || v_upload::text || '/' || repeat('Q', 43),
      'reservationFingerprint', repeat('a', 64)
    ),
    v_token, 'd1000000-0000-4000-8000-000000000005', 'file-init',
    'POST', '/api/hotels/files/upload-init', 'hash-file-init',
    'd2000000-0000-4000-8000-000000000005', 'd3000000-0000-4000-8000-000000000005'
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'upload init failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_file_command_v1(
    v_company, v_hotel, v_upload, 'UPLOAD_COMPLETE', 0,
    jsonb_build_object(
      'etag', '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"', 'objectVersion', 'version-1',
      'sizeBytes', 12, 'mimeType', 'image/jpeg',
      'reservationFingerprint', repeat('a', 64),
      'scanJobId', 'c6100000-0000-4000-8000-000000000001'
    ),
    v_token, 'd1000000-0000-4000-8000-000000000006', 'file-complete',
    'POST', '/api/files/complete', 'hash-file-complete',
    'd2000000-0000-4000-8000-000000000006', 'd3000000-0000-4000-8000-000000000006'
  );
  if v_result.command_status <> 'UPDATED' then
    raise exception 'upload complete failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_file_scan_command_v1(
    v_upload, 'CLAIM', v_claim, 0, '{}'::jsonb,
    'd3000000-0000-4000-8000-000000000007'
  );
  if v_result.command_status <> 'CLAIMED' then
    raise exception 'scan claim failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;
  v_generation := (v_result.result_snapshot ->> 'generation')::bigint;

  select * into v_result from public.hotel_file_scan_command_v1(
    v_upload, 'SCAN_CLEAN', v_claim, v_generation,
    jsonb_build_object(
      'fileVersionId', v_file_version, 'scannerSha256', repeat('b', 64),
      'detectedMime', 'image/jpeg', 'cleanObjectKey', 'clean/' || v_file_version::text
    ), 'd3000000-0000-4000-8000-000000000008'
  );
  if v_result.command_status <> 'RECORDED' then
    raise exception 'scan clean failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_file_scan_command_v1(
    v_upload, 'PROMOTE_COMPLETE', v_claim, v_generation,
    jsonb_build_object(
      'fileVersionId', v_file_version, 'cleanSha256', repeat('c', 64),
      'cleanEtag', '"cccccccccccccccccccccccccccccccc"',
      'cleanObjectVersion', 'clean-version-1', 'cleanSize', 10,
      'exifLocationRemoved', true
    ), 'd3000000-0000-4000-8000-000000000009'
  );
  if v_result.command_status <> 'COMPLETED' then
    raise exception 'promotion failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'SAVE_RESULT', 0,
    jsonb_build_object(
      'itemSnapshotId', v_item_snapshot,
      'resultId', 'c8000000-0000-4000-8000-000000000001',
      'historyId', 'c8100000-0000-4000-8000-000000000001',
      'result', 'ABNORMAL', 'description', '욕실 배관 누수가 확인되었습니다.',
      'severity', 'MAJOR', 'fileVersionIds', jsonb_build_array(v_file_version),
      'changeReason', null
    ),
    v_token, 'd1000000-0000-4000-8000-000000000010', 'result-save',
    'PUT', '/api/inspections/result', 'hash-result-save',
    'd2000000-0000-4000-8000-000000000010', 'd3000000-0000-4000-8000-000000000010'
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'abnormal result failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'SAVE_RESULT', 1,
    jsonb_build_object(
      'itemSnapshotId', v_item_snapshot,
      'resultId', 'c8000000-0000-4000-8000-000000000001',
      'historyId', 'c8100000-0000-4000-8000-000000000002',
      'result', 'CAUTION', 'description', '누수 흔적을 재확인했으며 경과 관찰합니다.',
      'severity', null, 'fileVersionIds', jsonb_build_array(),
      'changeReason', '현장 재확인 결과 반영'
    ),
    v_token, 'e1000000-0000-4000-8000-000000000001', 'result-update',
    'PUT', '/api/inspections/result', 'hash-result-update',
    'e2000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'UPDATED'
     or v_result.result_snapshot #>> '{items,0,result,result}' <> 'CAUTION'
     or jsonb_array_length(v_result.result_snapshot #> '{items,0,result,fileVersionIds}') <> 0 then
    raise exception 'editable result version read-back failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'SUBMIT', 1,
    jsonb_build_object('historyId', 'c9000000-0000-4000-8000-000000000001', 'reason', '현장점검 제출'),
    v_token, 'd1000000-0000-4000-8000-000000000011', 'inspection-submit',
    'POST', '/api/inspections/submit', 'hash-inspection-submit',
    'd2000000-0000-4000-8000-000000000011', 'd3000000-0000-4000-8000-000000000011'
  );
  if v_result.command_status <> 'UPDATED' then
    raise exception 'inspection submit failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'TRANSITION', 2,
    jsonb_build_object(
      'historyId', 'c9000000-0000-4000-8000-000000000002',
      'event', 'APPROVE', 'choiceValue', null, 'reason', '관리자 승인'
    ),
    v_token, 'd1000000-0000-4000-8000-000000000012', 'transition-one',
    'POST', '/api/inspections/transition', 'hash-transition-one',
    'd2000000-0000-4000-8000-000000000012', 'd3000000-0000-4000-8000-000000000012'
  );
  if v_result.command_status <> 'UPDATED' then
    raise exception 'first transition failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'TRANSITION', 3,
    jsonb_build_object(
      'historyId', 'c9000000-0000-4000-8000-000000000003',
      'event', 'APPROVE', 'choiceValue', null, 'reason', '최종 승인'
    ),
    v_token, 'd1000000-0000-4000-8000-000000000013', 'transition-two',
    'POST', '/api/inspections/transition', 'hash-transition-two',
    'd2000000-0000-4000-8000-000000000013', 'd3000000-0000-4000-8000-000000000013'
  );
  if v_result.command_status <> 'UPDATED'
     or v_result.result_snapshot ->> 'status' <> 'COMPLETED' then
    raise exception 'final transition failed: % %', v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'SAVE_RESULT', 1,
    jsonb_build_object(
      'itemSnapshotId', v_item_snapshot,
      'resultId', 'c8000000-0000-4000-8000-000000000001',
      'historyId', 'c8100000-0000-4000-8000-000000000002',
      'result', 'NORMAL', 'description', null, 'severity', null,
      'fileVersionIds', jsonb_build_array(), 'changeReason', '완료 후 변경 시도'
    ),
    v_token, 'd1000000-0000-4000-8000-000000000014', 'result-final-lock',
    'PUT', '/api/inspections/result', 'hash-result-final-lock',
    'd2000000-0000-4000-8000-000000000014', 'd3000000-0000-4000-8000-000000000014'
  );
  if v_result.command_status <> 'INSPECTION_FINAL_LOCKED' then
    raise exception 'completed inspection mutation was not blocked: %', v_result.command_status;
  end if;

  update runtime_database_capabilities
     set capability = 'RECONCILER', provisioned_at = now()
   where role_name = session_user;
  perform set_config('app.reconciler_company_id', v_company::text, true);
  select result_status, claim_generation, from_date, through_date
    into v_materialization_status, v_generation, v_materialized_from, v_materialized_through
    from public.hotel_inspection_claim_materialization_v1(
      'ca000000-0000-4000-8000-000000000001',
      decode(repeat('dd', 32), 'hex'), 120
    );
  if v_materialization_status <> 'CLAIMED'
     or v_materialized_from <> current_date
     or v_materialized_through <> current_date then
    raise exception 'routine claim failed: % % %', v_materialization_status, v_materialized_from, v_materialized_through;
  end if;
  select result_status, created_count
    into v_materialization_status, v_created_count
    from public.hotel_inspection_complete_materialization_v1(
      'ca000000-0000-4000-8000-000000000001', v_generation,
      decode(repeat('dd', 32), 'hex'),
      'ea300000-0000-4000-8000-000000000001'
    );
  if v_materialization_status <> 'COMPLETED' or v_created_count <> 1 then
    raise exception 'routine materialization failed: % %', v_materialization_status, v_created_count;
  end if;
  if (select count(*) from hotel_inspections
       where company_id = v_company
         and routine_id = 'ca000000-0000-4000-8000-000000000001'
         and business_date = current_date) <> 1
     or (select count(*) from inspection_item_snapshots snapshot
          join hotel_inspections inspection
            on inspection.company_id = snapshot.company_id
           and inspection.id = snapshot.inspection_id
         where inspection.company_id = v_company
           and inspection.routine_id = 'ca000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'materialized routine read-back mismatch';
  end if;

  update runtime_database_capabilities
     set capability = 'API_RUNTIME', provisioned_at = now()
   where role_name = session_user;
  delete from hotel_file_finalizer_capabilities where role_name = session_user;
end
$journey$;

select 'INSPECTION_FILE_PROCESS_JOURNEY_OK' as result;
