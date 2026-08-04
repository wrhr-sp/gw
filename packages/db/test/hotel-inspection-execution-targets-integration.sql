\set ON_ERROR_STOP on

do $target_foundation$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_token text := repeat('I', 43);
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_legacy_inspection uuid := 'e1000000-0000-4000-8000-000000000001';
  v_new_inspection uuid := '7a100000-0000-4000-8000-000000000001';
  v_new_execution uuid := '7a200000-0000-4000-8000-000000000001';
  v_room uuid := 'bc000000-0000-4000-8000-000000000001';
  v_actor uuid := '2f000000-0000-4000-8000-000000000001';
  v_facility_type uuid := '7ab00000-0000-4000-8000-000000000001';
  v_facility_id uuid := '7ac00000-0000-4000-8000-000000000001';
  v_item_source uuid := 'c5000000-0000-4000-8000-000000000001';
  v_first_target uuid;
  v_second_target uuid;
  v_facility record;
  v_item public.inspection_item_snapshots%rowtype;
  v_result record;
begin
  perform set_config('app.session_id', v_session::text, true);

  if not exists (
    select 1 from public.schema_migrations
     where version = '0037_hotel_inspection_execution_targets'
  ) then
    raise exception 'inspection execution target marker is missing';
  end if;

  if (select count(*) from public.inspection_execution_targets
       where company_id = v_company and execution_id = v_legacy_inspection) <> 2
     or exists (
       select 1 from public.inspection_item_snapshots item
        where item.company_id = v_company
          and item.inspection_id = v_legacy_inspection
          and item.execution_target_id is null
     )
     or exists (
       select 1
         from public.inspection_item_snapshots item
         join public.inspection_execution_targets target
           on target.company_id = item.company_id
          and target.branch_id = item.branch_id
          and target.execution_id = item.inspection_id
          and target.id = item.execution_target_id
        where item.company_id = v_company
          and item.inspection_id = v_legacy_inspection
          and (
            target.target_type <> 'ROOM'
            or target.room_id <> item.room_id
            or target.room_number_snapshot <> item.room_number_snapshot
            or target.floor_label_snapshot <> item.floor_label_snapshot
            or target.floor_sort_key_snapshot <> item.floor_sort_key_snapshot
            or target.room_type_name_snapshot <> item.room_type_name_snapshot
          )
     ) then
    raise exception 'legacy ROOM target backfill is not material-preserving';
  end if;

  select * into v_result from public.hotel_inspection_executions_read_v1(
    v_company, v_hotel, v_legacy_inspection, '{}'::jsonb, v_token
  );
  if v_result.command_status <> 'OK'
     or v_result.result_snapshot #>> '{inspection,id}' <> v_legacy_inspection::text
     or jsonb_array_length(v_result.result_snapshot #> '{inspection,rooms}') <> 2
     or (v_result.result_snapshot #> '{inspection,targets}') is not null then
    raise exception 'legacy public execution response changed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;

  select * into v_result from public.hotel_inspection_command_v1(
    v_company, v_hotel, v_new_inspection, 'CREATE_MANUAL', 0,
    jsonb_build_object(
      'processDefinitionId', null,
      'processExecutionId', v_new_execution,
      'reason', 'target 호환 trigger 수시점검',
      'targets', jsonb_build_array(
        jsonb_build_object(
          'roomId', v_room,
          'selectedItemIds', jsonb_build_array(v_item_source)
        )
      )
    ),
    v_token,
    '7a300000-0000-4000-8000-000000000001',
    'target-create', 'POST',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspections/manual',
    'hash-target-create',
    '7a400000-0000-4000-8000-000000000001',
    '7a500000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'CREATED' then
    raise exception 'old writer target capture failed: %', v_result.command_status;
  end if;

  select target.id into strict v_first_target
    from public.inspection_execution_targets target
   where target.company_id = v_company
     and target.branch_id = v_hotel
     and target.execution_id = v_new_inspection
     and target.target_type = 'ROOM'
     and target.room_id = v_room;

  select * into strict v_item
    from public.inspection_item_snapshots item
   where item.company_id = v_company
     and item.inspection_id = v_new_inspection;
  if v_item.execution_target_id <> v_first_target then
    raise exception 'old writer item did not reference its ROOM target';
  end if;

  insert into public.hotel_facility_types (
    id, company_id, branch_id, name, created_by, updated_by
  ) values (
    v_facility_type, v_company, v_hotel,
    'Target 통합시험 시설물유형', v_actor, v_actor
  );
  insert into public.hotel_facilities (
    id, company_id, branch_id, facility_type_id, name,
    location_type, room_id, created_by, updated_by
  ) values (
    v_facility_id, v_company, v_hotel, v_facility_type,
    'Target 통합시험 시설물', 'ROOM', v_room, v_actor, v_actor
  );

  select facility.id, facility.name, facility.facility_type_id,
         facility_type.name as facility_type_name,
         facility.location_type, facility.room_id,
         facility.common_area_id,
         coalesce(room.room_number, common_area.name) as location_name
    into strict v_facility
    from public.hotel_facilities facility
    join public.hotel_facility_types facility_type
      on facility_type.company_id = facility.company_id
     and facility_type.branch_id = facility.branch_id
     and facility_type.id = facility.facility_type_id
    left join public.hotel_rooms room
      on room.company_id = facility.company_id
     and room.branch_id = facility.branch_id
     and room.id = facility.room_id
    left join public.hotel_common_areas common_area
      on common_area.company_id = facility.company_id
     and common_area.branch_id = facility.branch_id
     and common_area.id = facility.common_area_id
   where facility.company_id = v_company
     and facility.branch_id = v_hotel
     and facility.id = v_facility_id
   limit 1;

  insert into public.inspection_execution_targets (
    id, company_id, branch_id, execution_id, target_type, facility_id,
    facility_name_snapshot, facility_type_id_snapshot,
    facility_type_name_snapshot, facility_location_type_snapshot,
    facility_location_room_id_snapshot,
    facility_location_common_area_id_snapshot, facility_location_name_snapshot
  ) values (
    '7aa00000-0000-4000-8000-000000000001', v_company, v_hotel,
    v_new_inspection, 'FACILITY', v_facility.id, v_facility.name,
    v_facility.facility_type_id, v_facility.facility_type_name,
    v_facility.location_type,
    case when v_facility.location_type = 'ROOM' then v_facility.room_id end,
    case when v_facility.location_type = 'COMMON_AREA' then v_facility.common_area_id end,
    v_facility.location_name
  );
  if not exists (
    select 1 from public.inspection_execution_targets target
     where target.company_id = v_company
       and target.execution_id = v_new_inspection
       and target.target_type = 'FACILITY'
       and target.facility_id = v_facility.id
       and target.facility_name_snapshot = v_facility.name
       and target.facility_type_name_snapshot = v_facility.facility_type_name
       and target.facility_location_name_snapshot = v_facility.location_name
  ) then
    raise exception 'typed FACILITY target snapshot was not persisted';
  end if;

  begin
    update public.inspection_execution_targets
       set room_number_snapshot = room_number_snapshot
     where company_id = v_company and id = v_first_target;
    raise exception 'target append-only update was accepted';
  exception when object_not_in_prerequisite_state then
    null;
  end;

  select target.id into strict v_second_target
    from public.inspection_execution_targets target
   where target.company_id = v_company
     and target.execution_id = v_legacy_inspection
     and target.room_id <> v_room
   limit 1;

  begin
    insert into public.inspection_item_snapshots (
      id, company_id, branch_id, inspection_id, room_id, source_item_id,
      checklist_revision_id, name, description, is_required, display_order,
      default_severity, execution_target_id
    ) values (
      '7a600000-0000-4000-8000-000000000001', v_company, v_hotel,
      v_new_inspection, v_room, '7a700000-0000-4000-8000-000000000001',
      v_item.checklist_revision_id, '잘못된 target', null, true, 999,
      'MINOR', v_second_target
    );
    raise exception 'cross-execution target item was accepted';
  exception when foreign_key_violation then
    null;
  end;

  begin
    insert into public.inspection_execution_targets (
      id, company_id, branch_id, execution_id, target_type, room_id,
      facility_id, room_number_snapshot, floor_label_snapshot,
      floor_sort_key_snapshot, room_type_name_snapshot
    ) values (
      '7a800000-0000-4000-8000-000000000001', v_company, v_hotel,
      v_new_inspection, 'ROOM', v_room, '7a900000-0000-4000-8000-000000000001',
      v_item.room_number_snapshot, v_item.floor_label_snapshot,
      v_item.floor_sort_key_snapshot, v_item.room_type_name_snapshot
    );
    raise exception 'invalid ROOM/FACILITY exact-one target was accepted';
  exception when check_violation then
    null;
  end;

  if exists (
    select 1
      from public.inspection_item_results result_record
     where result_record.company_id = v_company
       and result_record.inspection_id = v_legacy_inspection
       and not exists (
         select 1 from public.inspection_item_snapshots item
          where item.company_id = result_record.company_id
            and item.id = result_record.item_snapshot_id
       )
  ) or exists (
    select 1
      from public.process_execution_history history
     where history.company_id = v_company
       and not exists (
         select 1 from public.process_executions execution
          where execution.company_id = history.company_id
            and execution.id = history.execution_id
       )
  ) then
    raise exception 'existing result or process history linkage changed';
  end if;
end
$target_foundation$;

select 'HOTEL_INSPECTION_TARGET_FOUNDATION_OK';
