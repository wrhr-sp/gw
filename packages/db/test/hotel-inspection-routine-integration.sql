\set ON_ERROR_STOP on

do $routine_journey$
declare
  v_result record;
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_token text := repeat('I', 43);
  v_definition uuid := 'c1000000-0000-4000-8000-000000000001';
  v_checklist uuid := 'c2300000-0000-4000-8000-000000000001';
  v_routine uuid := 'ef000000-0000-4000-8000-000000000001';
  v_future_routine uuid := 'ef000000-0000-4000-8000-000000000002';
  v_new_checklist uuid := 'ef400000-0000-4000-8000-000000000001';
  v_routine_revision uuid;
  v_value jsonb;
  v_claim record;
  v_complete record;
begin
  perform set_config('app.session_id', v_session::text, true);

  if not exists (
    select 1 from public.inspection_routine_revisions
     where id = 'ca100000-0000-4000-8000-000000000001'
       and checklist_revision_id = v_checklist
  ) then
    raise exception 'legacy routine checklist was not pinned';
  end if;

  v_value := jsonb_build_object(
    'name', '월말 객실점검', 'status', 'ACTIVE', 'version', 0,
    'mode', 'FIXED',
    'recurrence', jsonb_build_object('type', 'MONTHLY', 'dayOfMonth', 31),
    'startDate', current_date, 'endDate', null, 'localDueTime', '15:00',
    'processDefinitionId', v_definition,
    'rounds', jsonb_build_array(jsonb_build_object(
      'order', 1,
      'target', jsonb_build_object(
        'type', 'ROOMS',
        'roomIds', jsonb_build_array('ffffffff-ffff-4fff-8fff-ffffffffffff')
      )
    ))
  );
  select * into v_result from public.hotel_inspection_routine_command_v1(
    v_company, v_hotel, v_routine, 0, v_value, v_token,
    'routine-invalid-target', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines',
    'hash-invalid-target',
    'ef100000-0000-4000-8000-000000000001',
    'ef200000-0000-4000-8000-000000000001',
    'ef300000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'INVALID_TARGET' then
    raise exception 'invalid room target was accepted: %', v_result.command_status;
  end if;
  if exists (select 1 from public.inspection_routines where id = v_routine) then
    raise exception 'invalid target partially mutated the routine aggregate';
  end if;

  v_value := jsonb_build_object(
    'name', '월말 객실점검', 'status', 'ACTIVE', 'version', 0,
    'mode', 'FIXED',
    'recurrence', jsonb_build_object('type', 'MONTHLY', 'dayOfMonth', 31),
    'startDate', current_date, 'endDate', null, 'localDueTime', '15:00',
    'processDefinitionId', v_definition,
    'rounds', jsonb_build_array(jsonb_build_object(
      'order', 1,
      'target', jsonb_build_object(
        'type', 'ROOMS',
        'roomIds', jsonb_build_array('bc000000-0000-4000-8000-000000000001')
      )
    ))
  );
  select * into v_result from public.hotel_inspection_routine_command_v1(
    v_company, v_hotel, v_routine, 0, v_value, v_token,
    'routine-create', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines',
    'hash-routine-create',
    'ef100000-0000-4000-8000-000000000002',
    'ef200000-0000-4000-8000-000000000002',
    'ef300000-0000-4000-8000-000000000002'
  );
  if v_result.command_status <> 'OK'
     or (v_result.result_snapshot ->> 'version')::integer <> 1
     or v_result.result_snapshot #>> '{revision,checklistRevisionId}' <> v_checklist::text
     or jsonb_array_length(v_result.result_snapshot #> '{revision,rounds}') <> 1 then
    raise exception 'routine create snapshot mismatch: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_routine_command_v1(
    v_company, v_hotel, v_routine, 0, v_value, v_token,
    'routine-create', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines',
    'hash-routine-create',
    'ef100000-0000-4000-8000-000000000003',
    'ef200000-0000-4000-8000-000000000003',
    'ef300000-0000-4000-8000-000000000003'
  );
  if v_result.command_status <> 'REPLAYED'
     or (v_result.result_snapshot ->> 'id')::uuid <> v_routine then
    raise exception 'routine replay mismatch: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_routine_command_v1(
    v_company, v_hotel, v_routine, 0, v_value, v_token,
    'routine-create', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines',
    'different-hash',
    'ef100000-0000-4000-8000-000000000004',
    'ef200000-0000-4000-8000-000000000004',
    'ef300000-0000-4000-8000-000000000004'
  );
  if v_result.command_status <> 'IDEMPOTENCY_CONFLICT' then
    raise exception 'routine idempotency conflict missing: %', v_result.command_status;
  end if;

  select * into v_result from public.hotel_inspection_routine_command_v1(
    v_company, v_hotel, v_routine, 9, v_value, v_token,
    'routine-version-conflict', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines/ef000000-0000-4000-8000-000000000001',
    'hash-version-conflict',
    'ef100000-0000-4000-8000-000000000005',
    'ef200000-0000-4000-8000-000000000005',
    'ef300000-0000-4000-8000-000000000005'
  );
  if v_result.command_status <> 'INSPECTION_ROUTINE_VERSION_CONFLICT' then
    raise exception 'routine version conflict missing: %', v_result.command_status;
  end if;

  v_value := jsonb_build_object(
    'name', '순환 객실점검', 'status', 'INACTIVE', 'version', 1,
    'mode', 'ROTATING',
    'recurrence', jsonb_build_object('type', 'WEEKLY', 'dayOfWeek', 'MONDAY'),
    'startDate', current_date, 'endDate', null, 'localDueTime', '16:00',
    'processDefinitionId', v_definition,
    'rounds', jsonb_build_array(
      jsonb_build_object('order', 1, 'target', jsonb_build_object('type', 'HOTEL')),
      jsonb_build_object(
        'order', 2,
        'target', jsonb_build_object(
          'type', 'FLOOR', 'floorLabels', jsonb_build_array('통합시험')
        )
      )
    )
  );
  select * into v_result from public.hotel_inspection_routine_command_v1(
    v_company, v_hotel, v_routine, 1, v_value, v_token,
    'routine-update', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines/ef000000-0000-4000-8000-000000000001',
    'hash-routine-update',
    'ef100000-0000-4000-8000-000000000006',
    'ef200000-0000-4000-8000-000000000006',
    'ef300000-0000-4000-8000-000000000006'
  );
  if v_result.command_status <> 'OK'
     or (v_result.result_snapshot ->> 'version')::integer <> 2
     or v_result.result_snapshot ->> 'status' <> 'INACTIVE'
     or jsonb_array_length(v_result.result_snapshot #> '{revision,rounds}') <> 2 then
    raise exception 'routine update snapshot mismatch: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_routines_read_v1(
    v_company, v_hotel, v_routine, v_token
  );
  if v_result.command_status <> 'OK'
     or v_result.result_snapshot #>> '{routine,id}' <> v_routine::text
     or v_result.result_snapshot #>> '{routine,revision,checklistRevisionId}' <> v_checklist::text then
    raise exception 'routine canonical detail mismatch: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  v_value := jsonb_build_object(
    'name', '고정 체크리스트 일일점검', 'status', 'ACTIVE', 'version', 2,
    'mode', 'FIXED',
    'recurrence', jsonb_build_object('type', 'DAILY'),
    'startDate', current_date, 'endDate', null, 'localDueTime', '16:30',
    'processDefinitionId', v_definition,
    'rounds', jsonb_build_array(jsonb_build_object(
      'order', 1, 'target', jsonb_build_object('type', 'HOTEL')
    ))
  );
  select * into v_result from public.hotel_inspection_routine_command_v1(
    v_company, v_hotel, v_routine, 2, v_value, v_token,
    'routine-pin-checklist', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines/ef000000-0000-4000-8000-000000000001',
    'hash-routine-pin-checklist',
    'ef100000-0000-4000-8000-000000000008',
    'ef200000-0000-4000-8000-000000000008',
    'ef300000-0000-4000-8000-000000000008'
  );
  if v_result.command_status <> 'OK'
     or v_result.result_snapshot #>> '{revision,checklistRevisionId}' <> v_checklist::text then
    raise exception 'routine checklist pin update failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;
  v_routine_revision := (v_result.result_snapshot #>> '{revision,id}')::uuid;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_new_checklist, 'SAVE_CHECKLIST', 1,
    jsonb_build_object(
      'revisionId', v_new_checklist,
      'reason', '고정 검증용 새 체크리스트',
      'items', jsonb_build_array(jsonb_build_object(
        'itemId', 'ef400000-0000-4000-8000-000000000002',
        'snapshotId', 'ef400000-0000-4000-8000-000000000003',
        'source', 'HOTEL_COMMON', 'roomTypeId', null,
        'excludedRoomTypeIds', jsonb_build_array(), 'name', '새 기준 항목',
        'description', null, 'isRequired', true, 'displayOrder', 10,
        'defaultSeverity', 'OBSERVATION'
      ))
    ),
    v_token,
    'ef500000-0000-4000-8000-000000000001',
    'routine-new-checklist',
    'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-checklist',
    'hash-routine-new-checklist',
    'ef600000-0000-4000-8000-000000000001',
    'ef700000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'UPDATED' then
    raise exception 'new checklist revision setup failed: %', v_result.command_status;
  end if;

  update public.runtime_database_capabilities
     set capability = 'RECONCILER'
   where role_name = session_user;
  perform set_config('app.reconciler_company_id', v_company::text, true);
  select * into v_claim from public.hotel_inspection_claim_materialization_v1(
    v_routine, sha256(convert_to(repeat('P', 43), 'UTF8')), 60
  );
  if v_claim.result_status <> 'CLAIMED' then
    raise exception 'pinned routine claim failed: %', v_claim.result_status;
  end if;
  select * into v_complete from public.hotel_inspection_complete_materialization_v1(
    v_routine, v_claim.claim_generation,
    sha256(convert_to(repeat('P', 43), 'UTF8')),
    'ef800000-0000-4000-8000-000000000001'
  );
  perform set_config('app.reconciler_company_id', '', true);
  update public.runtime_database_capabilities
     set capability = 'API_RUNTIME'
   where role_name = session_user;
  if v_complete.result_status <> 'COMPLETED'
     or v_complete.created_count <> 1
     or not exists (
       select 1
         from public.hotel_inspections inspection
         join public.inspection_item_snapshots item
           on item.company_id = inspection.company_id
          and item.inspection_id = inspection.id
        where inspection.company_id = v_company
          and inspection.branch_id = v_hotel
          and inspection.routine_revision_id = v_routine_revision
          and item.checklist_revision_id = v_checklist
     )
     or exists (
       select 1
         from public.hotel_inspections inspection
         join public.inspection_item_snapshots item
           on item.company_id = inspection.company_id
          and item.inspection_id = inspection.id
        where inspection.company_id = v_company
          and inspection.routine_revision_id = v_routine_revision
          and item.checklist_revision_id = v_new_checklist
     ) then
    raise exception 'materializer did not preserve pinned checklist: % %',
      v_complete.result_status, v_complete.created_count;
  end if;

  select * into v_result from public.hotel_inspection_routines_read_v1(
    v_company, '5f000000-0000-4000-8000-000000000099', v_routine, v_token
  );
  if v_result.command_status <> 'FORBIDDEN' then
    raise exception 'cross-hotel routine read was not forbidden: %', v_result.command_status;
  end if;

  v_value := jsonb_build_object(
    'name', '미래 월말점검', 'status', 'ACTIVE', 'version', 0,
    'mode', 'FIXED',
    'recurrence', jsonb_build_object('type', 'MONTHLY', 'dayOfMonth', 31),
    'startDate', current_date + 5, 'endDate', null, 'localDueTime', '17:00',
    'processDefinitionId', v_definition,
    'rounds', jsonb_build_array(jsonb_build_object(
      'order', 1, 'target', jsonb_build_object('type', 'HOTEL')
    ))
  );
  select * into v_result from public.hotel_inspection_routine_command_v1(
    v_company, v_hotel, v_future_routine, 0, v_value, v_token,
    'routine-future', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-routines',
    'hash-routine-future',
    'ef100000-0000-4000-8000-000000000007',
    'ef200000-0000-4000-8000-000000000007',
    'ef300000-0000-4000-8000-000000000007'
  );
  if v_result.command_status <> 'OK' then
    raise exception 'future routine create failed: %', v_result.command_status;
  end if;
  update public.runtime_database_capabilities
     set capability = 'RECONCILER'
   where role_name = session_user;
  perform set_config('app.reconciler_company_id', v_company::text, true);
  select * into v_claim from public.hotel_inspection_claim_materialization_v1(
    v_future_routine, sha256(convert_to(repeat('F', 43), 'UTF8')), 60
  );
  perform set_config('app.reconciler_company_id', '', true);
  update public.runtime_database_capabilities
     set capability = 'API_RUNTIME'
   where role_name = session_user;
  if v_claim.result_status <> 'NOT_DUE'
     or exists (
       select 1 from public.hotel_inspections inspection
        where inspection.company_id = v_company
          and inspection.branch_id = v_hotel
          and inspection.business_date > current_date
     ) then
    raise exception 'future inspection was materialized: %', v_claim.result_status;
  end if;

  if position(
    'v_revision.day_of_month <= extract(day from (date_trunc(''month'', v_business_date) + interval ''1 month - 1 day''))'
    in pg_get_functiondef(
      'public.hotel_inspection_complete_materialization_v1(uuid,bigint,bytea,uuid)'::regprocedure
    )
  ) = 0 then
    raise exception 'monthly missing-date skip policy is not sealed';
  end if;
  if position(
    'v_today - 31'
    in pg_get_functiondef(
      'public.hotel_inspection_claim_materialization_v1(uuid,bytea,integer)'::regprocedure
    )
  ) = 0 then
    raise exception '31-day catch-up boundary is not sealed';
  end if;
end
$routine_journey$;

select 'HOTEL_INSPECTION_ROUTINE_OK';
