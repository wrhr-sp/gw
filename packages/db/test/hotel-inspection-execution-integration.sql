\set ON_ERROR_STOP on

do $execution_journey$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_token text := repeat('I', 43);
  v_inspection uuid := 'e1000000-0000-4000-8000-000000000001';
  v_execution uuid := 'e2000000-0000-4000-8000-000000000001';
  v_room uuid := 'bc000000-0000-4000-8000-000000000001';
  v_second_room uuid := 'bc000000-0000-4000-8000-000000000002';
  v_actor_user uuid := '2f000000-0000-4000-8000-000000000001';
  v_item_source uuid := 'c5000000-0000-4000-8000-000000000001';
  v_item_snapshot uuid;
  v_second_item_snapshot uuid;
  v_room_number text;
  v_floor_label text;
  v_floor_sort_key integer;
  v_room_type uuid;
  v_room_type_name text;
  v_result record;
begin
  perform set_config('app.session_id', v_session::text, true);

  select room.room_number, room.floor_label, room.floor_sort_key,
         room.room_type_id, room_type.name
    into strict v_room_number, v_floor_label, v_floor_sort_key,
                v_room_type, v_room_type_name
    from public.hotel_rooms room
    join public.hotel_room_types room_type
      on room_type.company_id = room.company_id
     and room_type.id = room.room_type_id
   where room.company_id = v_company
     and room.branch_id = v_hotel
     and room.id = v_room;

  insert into public.hotel_rooms (
    id, company_id, branch_id, room_number, floor_label, floor_sort_key,
    room_type_id, status, created_by, updated_by
  ) values (
    v_second_room, v_company, v_hotel, 'INSPECT-9002', '통합시험2', 901,
    v_room_type, 'ACTIVE', v_actor_user, v_actor_user
  );

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'CREATE_MANUAL', 0,
    jsonb_build_object(
      'processDefinitionId', null,
      'processExecutionId', v_execution,
      'reason', '수행 통합시험 수시점검',
      'targets', jsonb_build_array(
        jsonb_build_object(
          'roomId', v_room,
          'selectedItemIds', jsonb_build_array(v_item_source)
        ),
        jsonb_build_object(
          'roomId', v_second_room,
          'selectedItemIds', jsonb_build_array(v_item_source)
        )
      )
    ),
    v_token,
    'e3000000-0000-4000-8000-000000000001',
    'execution-create', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/manual',
    'hash-execution-create',
    'e4000000-0000-4000-8000-000000000001',
    'e5000000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'manual execution create failed: %', v_result.command_status;
  end if;

  select * into v_result from public.hotel_inspection_executions_read_v1(
    v_company, v_hotel, null,
    jsonb_build_object('page', 1, 'pageSize', 20, 'status', 'PENDING_INPUT'),
    v_token
  );
  if v_result.command_status <> 'OK'
     or not exists (
       select 1
         from jsonb_array_elements(v_result.result_snapshot -> 'inspections') value
        where value ->> 'id' = v_inspection::text
          and value #>> '{rooms,0,roomNumber}' = 'INSPECT-9001'
     )
     or (v_result.result_snapshot #>> '{pagination,page}')::integer <> 1 then
    raise exception 'canonical execution list failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_executions_read_v1(
    v_company, v_hotel, v_inspection, '{}'::jsonb, v_token
  );
  if v_result.command_status <> 'OK'
     or v_result.result_snapshot #>> '{inspection,id}' <> v_inspection::text
     or v_result.result_snapshot #>> '{inspection,rooms,0,roomNumber}' <> v_room_number then
    raise exception 'canonical execution detail failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  update public.hotel_rooms
     set room_number = 'INSPECT-Z', floor_label = '99층',
         floor_sort_key = 1000, version = version + 1
   where company_id = v_company and branch_id = v_hotel and id = v_room;
  update public.hotel_rooms
     set room_number = 'INSPECT-A', floor_label = '-99층',
         floor_sort_key = -1000, version = version + 1
   where company_id = v_company and branch_id = v_hotel and id = v_second_room;
  update public.hotel_room_types
     set name = v_room_type_name || '-변경', version = version + 1
   where company_id = v_company and id = v_room_type;

  select * into v_result from public.hotel_inspection_executions_read_v1(
    v_company, v_hotel, v_inspection, '{}'::jsonb, v_token
  );
  if v_result.command_status <> 'OK'
     or v_result.result_snapshot #>> '{inspection,rooms,0,id}' <> v_room::text
     or v_result.result_snapshot #>> '{inspection,rooms,0,roomNumber}' <> v_room_number
     or v_result.result_snapshot #>> '{inspection,rooms,0,floorLabel}' <> v_floor_label
     or v_result.result_snapshot #>> '{inspection,rooms,0,roomTypeName}' <> v_room_type_name
     or v_result.result_snapshot #>> '{inspection,rooms,1,id}' <> v_second_room::text
     or v_result.result_snapshot #>> '{inspection,rooms,1,roomNumber}' <> 'INSPECT-9002'
     or v_result.result_snapshot #>> '{inspection,items,0,roomId}' <> v_room::text
     or v_result.result_snapshot #>> '{inspection,items,1,roomId}' <> v_second_room::text then
    raise exception 'immutable room and item order changed with reference data: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  update public.hotel_rooms
     set room_number = v_room_number, floor_label = v_floor_label,
         floor_sort_key = v_floor_sort_key, version = version + 1
   where company_id = v_company and branch_id = v_hotel and id = v_room;
  update public.hotel_rooms
     set room_number = 'INSPECT-9002', floor_label = '통합시험2',
         floor_sort_key = 901, version = version + 1
   where company_id = v_company and branch_id = v_hotel and id = v_second_room;
  update public.hotel_room_types
     set name = v_room_type_name, version = version + 1
   where company_id = v_company and id = v_room_type;

  select item.id into strict v_item_snapshot
    from public.inspection_item_snapshots item
   where item.company_id = v_company
     and item.inspection_id = v_inspection
     and item.room_id = v_room
     and item.source_item_id = v_item_source;

  select item.id into strict v_second_item_snapshot
    from public.inspection_item_snapshots item
   where item.company_id = v_company
     and item.inspection_id = v_inspection
     and item.room_id = v_second_room
     and item.source_item_id = v_item_source;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'SAVE_RESULT', 0,
    jsonb_build_object(
      'itemSnapshotId', v_item_snapshot,
      'resultId', 'e6000000-0000-4000-8000-000000000001',
      'historyId', 'e7000000-0000-4000-8000-000000000001',
      'result', 'ABNORMAL',
      'description', '배수구 아래 누수 확인',
      'severity', 'MAJOR',
      'fileVersionIds', jsonb_build_array(),
      'changeReason', null
    ),
    v_token,
    'e8000000-0000-4000-8000-000000000001',
    'execution-abnormal-draft', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/e1000000-0000-4000-8000-000000000001/items/result',
    'hash-execution-abnormal-draft',
    'e9000000-0000-4000-8000-000000000001',
    'ea000000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'CREATED'
     or v_result.result_snapshot #>> '{items,0,result,result}' <> 'ABNORMAL' then
    raise exception 'abnormal draft save failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'SAVE_RESULT', 0,
    jsonb_build_object(
      'itemSnapshotId', v_second_item_snapshot,
      'resultId', 'f1000000-0000-4000-8000-000000000001',
      'historyId', 'f2000000-0000-4000-8000-000000000001',
      'result', 'NORMAL',
      'description', null,
      'severity', null,
      'fileVersionIds', jsonb_build_array(),
      'changeReason', null
    ),
    v_token,
    'f3000000-0000-4000-8000-000000000001',
    'execution-second-room-normal', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/e1000000-0000-4000-8000-000000000001/items/result',
    'hash-execution-second-room-normal',
    'f4000000-0000-4000-8000-000000000001',
    'f5000000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'CREATED'
     or v_result.result_snapshot #>> '{items,1,result,result}' <> 'NORMAL' then
    raise exception 'second room normal result save failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_inspection, 'SUBMIT', 1,
    jsonb_build_object(
      'historyId', 'eb000000-0000-4000-8000-000000000001',
      'reason', '증빙 없는 제출 차단 검증'
    ),
    v_token,
    'ec000000-0000-4000-8000-000000000001',
    'execution-submit-without-evidence', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/e1000000-0000-4000-8000-000000000001/submit',
    'hash-execution-submit-without-evidence',
    'ed000000-0000-4000-8000-000000000001',
    'ee000000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'INSPECTION_RESULT_EVIDENCE_REQUIRED' then
    raise exception 'evidence-free submit was not blocked: %', v_result.command_status;
  end if;

  execute 'alter table public.inspection_item_snapshots disable trigger inspection_item_snapshots_append_only';
  execute 'alter table public.inspection_item_snapshots alter column room_number_snapshot drop not null, alter column floor_label_snapshot drop not null, alter column floor_sort_key_snapshot drop not null, alter column room_type_name_snapshot drop not null';
  update public.inspection_item_snapshots
     set room_number_snapshot = null,
         floor_label_snapshot = null,
         floor_sort_key_snapshot = null,
         room_type_name_snapshot = null
   where company_id = v_company and inspection_id = v_inspection;
  execute 'alter table public.inspection_item_snapshots enable trigger inspection_item_snapshots_append_only';

  begin
    update public.inspection_item_snapshots
       set name = name
     where company_id = v_company and inspection_id = v_inspection;
    raise exception 'append-only trigger was not restored before upgrade backfill';
  exception when object_not_in_prerequisite_state then
    null;
  end;

  execute 'alter table public.inspection_item_snapshots disable trigger inspection_item_snapshots_append_only';
  update public.inspection_item_snapshots item
     set room_number_snapshot = room.room_number,
         floor_label_snapshot = room.floor_label,
         floor_sort_key_snapshot = room.floor_sort_key,
         room_type_name_snapshot = room_type.name
    from public.hotel_rooms room
    join public.hotel_room_types room_type
      on room_type.company_id = room.company_id
     and room_type.id = room.room_type_id
   where room.company_id = item.company_id
     and room.branch_id = item.branch_id
     and room.id = item.room_id
     and item.company_id = v_company
     and item.inspection_id = v_inspection;
  execute 'alter table public.inspection_item_snapshots enable trigger inspection_item_snapshots_append_only';
  execute 'alter table public.inspection_item_snapshots alter column room_number_snapshot set not null, alter column floor_label_snapshot set not null, alter column floor_sort_key_snapshot set not null, alter column room_type_name_snapshot set not null';

  if exists (
    select 1 from public.inspection_item_snapshots item
     where item.company_id = v_company
       and item.inspection_id = v_inspection
       and (item.room_number_snapshot is null
         or item.floor_label_snapshot is null
         or item.floor_sort_key_snapshot is null
         or item.room_type_name_snapshot is null)
  ) or not exists (
    select 1 from pg_catalog.pg_trigger trigger_record
     where trigger_record.tgrelid = 'public.inspection_item_snapshots'::regclass
       and trigger_record.tgname = 'inspection_item_snapshots_append_only'
       and trigger_record.tgenabled = 'O'
  ) then
    raise exception 'legacy snapshot upgrade backfill or trigger restoration failed';
  end if;

  select * into v_result from public.hotel_inspection_executions_read_v1(
    v_company, '5f000000-0000-4000-8000-000000000099', v_inspection,
    '{}'::jsonb, v_token
  );
  if v_result.command_status <> 'FORBIDDEN' then
    raise exception 'other-hotel execution read was not blocked: %', v_result.command_status;
  end if;
end
$execution_journey$;

select 'HOTEL_INSPECTION_EXECUTION_OK';
