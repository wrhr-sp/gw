\set ON_ERROR_STOP on

do $checklist_v2$
declare
  v_company uuid := '10000000-0000-0000-0000-000000000001';
  v_hotel uuid := '50000000-0000-4000-8000-000000000001';
  v_token text := repeat('I', 43);
  v_session uuid := '4f000000-0000-4000-8000-000000000001';
  v_facility_type uuid := '7ab00000-0000-4000-8000-000000000001';
  v_room_type uuid;
  v_version integer;
  v_result record;
  v_v1 jsonb;
  v_command_items jsonb;
begin
  perform set_config('app.session_id', v_session::text, true);
  if not exists (
    select 1 from public.schema_migrations
     where version = '0038_hotel_inspection_checklist_targets'
  ) or not exists (
    select 1 from public.schema_migrations
     where version = '0039_hotel_inspection_checklist_v2_hardening'
  ) then
    raise exception 'checklist target marker is missing';
  end if;
  select max(version) into strict v_version
    from public.inspection_checklist_revisions
   where company_id = v_company and branch_id = v_hotel;
  if not exists (
    select 1 from public.inspection_checklist_v2_revisions
     where company_id = v_company and branch_id = v_hotel and version = v_version
  ) then
    raise exception 'legacy checklist revision was not backfilled';
  end if;
  select item.room_type_id into v_room_type
    from public.inspection_checklist_items item
    join public.inspection_checklist_revisions revision
      on revision.company_id = item.company_id and revision.id = item.revision_id
   where revision.company_id = v_company and revision.branch_id = v_hotel
     and item.room_type_id is not null
   order by revision.version desc limit 1;
  if v_room_type is null then
    select id into strict v_room_type from public.hotel_room_types
     where company_id = v_company and is_active
       and (branch_id is null or branch_id = v_hotel)
     order by branch_id nulls last, id limit 1;
  end if;
  select * into v_result from public.hotel_inspection_checklist_v3_command(
    v_company, v_hotel, 'd8100000-0000-4000-8000-000000000001',
    'SAVE_CHECKLIST_V2', v_version,
    jsonb_build_object(
      'revisionId', 'd8100000-0000-4000-8000-000000000001',
      'legacyRevisionId', 'd8200000-0000-4000-8000-000000000001',
      'reason', '시설물 체크리스트 통합 저장',
      'items', jsonb_build_array(
        jsonb_build_object(
          'itemId', 'd8300000-0000-4000-8000-000000000001',
          'itemIsNew', true,
          'snapshotId', 'd8400000-0000-4000-8000-000000000001',
          'legacySnapshotId', 'd8500000-0000-4000-8000-000000000001',
          'targetType', 'ROOM', 'source', 'TARGET_TYPE_ADDED',
          'roomTypeId', v_room_type, 'excludedRoomTypeIds', '[]'::jsonb,
          'name', '객실 통합 확인', 'description', null,
          'isRequired', true, 'displayOrder', 10, 'defaultSeverity', 'MAJOR'
        ),
        jsonb_build_object(
          'itemId', 'd8600000-0000-4000-8000-000000000001',
          'itemIsNew', true,
          'snapshotId', 'd8700000-0000-4000-8000-000000000001',
          'legacySnapshotId', 'd8800000-0000-4000-8000-000000000001',
          'targetType', 'FACILITY', 'source', 'TARGET_TYPE_ADDED',
          'facilityTypeId', v_facility_type, 'excludedFacilityTypeIds', '[]'::jsonb,
          'name', '시설물 통합 확인', 'description', '시설물 외관을 확인합니다.',
          'isRequired', true, 'displayOrder', 20, 'defaultSeverity', 'CRITICAL'
        )
      )
    ),
    v_token,
    'd8900000-0000-4000-8000-000000000001', 'checklist-v2-save', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-checklist/v2',
    'hash-checklist-v2-save',
    'd8a00000-0000-4000-8000-000000000001',
    'd8b00000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'UPDATED'
     or jsonb_array_length(v_result.result_snapshot -> 'items') <> 2
     or not exists (
       select 1 from jsonb_array_elements(v_result.result_snapshot -> 'items') item
        where item ->> 'targetType' = 'FACILITY'
          and item ->> 'facilityTypeId' = v_facility_type::text
     ) then
    raise exception 'v2 checklist canonical save failed: % %',
      v_result.command_status, v_result.result_snapshot;
  end if;
  v_version := (v_result.result_snapshot ->> 'version')::integer;
  select pg_catalog.jsonb_agg(
    item || pg_catalog.jsonb_build_object(
      'itemIsNew', false,
      'snapshotId', case item ->> 'targetType'
        when 'ROOM' then 'da100000-0000-4000-8000-000000000001'
        else 'da100000-0000-4000-8000-000000000002' end,
      'legacySnapshotId', case item ->> 'targetType'
        when 'ROOM' then 'da200000-0000-4000-8000-000000000001'
        else 'da200000-0000-4000-8000-000000000002' end
    ) order by item ->> 'targetType'
  ) into strict v_command_items
    from pg_catalog.jsonb_array_elements(v_result.result_snapshot -> 'items') item;
  select * into v_result from public.hotel_inspection_checklist_v3_command(
    v_company, v_hotel, 'da300000-0000-4000-8000-000000000001',
    'SAVE_CHECKLIST_V2', v_version,
    jsonb_build_object(
      'revisionId', 'da300000-0000-4000-8000-000000000001',
      'legacyRevisionId', 'da400000-0000-4000-8000-000000000001',
      'reason', 'missing required exclusion array',
      'items', jsonb_set(
        v_command_items, '{1}', (v_command_items -> 1) - 'excludedRoomTypeIds'
      )
    ),
    v_token,
    'da500000-0000-4000-8000-000000000001', 'checklist-v2-missing-array', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-checklist/v2',
    'hash-checklist-v2-missing-array',
    'da600000-0000-4000-8000-000000000001',
    'da700000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'INVALID_TARGET'
     or (select max(version) from public.inspection_checklist_v2_revisions
          where company_id = v_company and branch_id = v_hotel) <> v_version then
    raise exception 'missing required checklist array was not rejected atomically: %',
      v_result.command_status;
  end if;
  select * into v_result from public.hotel_inspection_checklist_v3_command(
    v_company, v_hotel, 'da800000-0000-4000-8000-000000000001',
    'SAVE_CHECKLIST_V2', v_version,
    jsonb_build_object(
      'revisionId', 'da800000-0000-4000-8000-000000000001',
      'legacyRevisionId', 'da900000-0000-4000-8000-000000000001',
      'reason', 'cross-target key injection',
      'items', jsonb_set(
        v_command_items, '{0}',
        (v_command_items -> 0) || jsonb_build_object('roomTypeId', null)
      )
    ),
    v_token,
    'daa00000-0000-4000-8000-000000000001', 'checklist-v2-cross-target', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-checklist/v2',
    'hash-checklist-v2-cross-target',
    'dab00000-0000-4000-8000-000000000001',
    'dac00000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'INVALID_TARGET'
     or (select max(version) from public.inspection_checklist_v2_revisions
          where company_id = v_company and branch_id = v_hotel) <> v_version then
    raise exception 'cross-target checklist keys were not rejected atomically: %',
      v_result.command_status;
  end if;
  v_v1 := public.inspection_checklist_snapshot_v1(v_company, v_hotel);
  if jsonb_array_length(v_v1 -> 'items') <> 1
     or exists (
       select 1 from jsonb_array_elements(v_v1 -> 'items') item
        where item ? 'targetType' or item ? 'facilityTypeId'
     ) then
    raise exception 'legacy v1 checklist leaked facility contract: %', v_v1;
  end if;
  select * into v_result from public.hotel_inspection_checklist_v3_command(
    v_company, v_hotel, 'd9200000-0000-4000-8000-000000000001',
    'SAVE_CHECKLIST_V2', v_version,
    jsonb_build_object(
      'revisionId', 'd9200000-0000-4000-8000-000000000001',
      'legacyRevisionId', 'd9300000-0000-4000-8000-000000000001',
      'reason', 'forged item lineage',
      'items', jsonb_set(
        v_command_items,
        '{0,itemId}',
        '"d9400000-0000-4000-8000-000000000001"'::jsonb
      )
    ),
    v_token,
    'd9500000-0000-4000-8000-000000000001', 'checklist-v2-forged', 'PUT',
    '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-checklist/v2',
    'hash-checklist-v2-forged',
    'd9600000-0000-4000-8000-000000000001',
    'd9700000-0000-4000-8000-000000000001'
  );
  if v_result.command_status <> 'INVALID_TARGET' then
    raise exception 'forged checklist item lineage was not rejected: %',
      v_result.command_status;
  end if;
end
$checklist_v2$;

-- Exercise an old v1 writer and force its deferred bridge before verification.
begin;
select set_config('app.session_id', '4f000000-0000-4000-8000-000000000001', true);
select * from public.hotel_inspection_command_v2(
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'd8c00000-0000-4000-8000-000000000001',
  'SAVE_CHECKLIST',
  (select max(version) from public.inspection_checklist_revisions
    where company_id='10000000-0000-0000-0000-000000000001'
      and branch_id='50000000-0000-4000-8000-000000000001'),
  jsonb_build_object(
    'revisionId','d8c00000-0000-4000-8000-000000000001',
    'reason','legacy ROOM bridge 확인',
    'items',jsonb_build_array(jsonb_build_object(
      'itemId','d8d00000-0000-4000-8000-000000000001',
      'snapshotId','d8e00000-0000-4000-8000-000000000001',
      'source','HOTEL_COMMON','roomTypeId',null,
      'excludedRoomTypeIds','[]'::jsonb,
      'name','legacy ROOM 항목','description',null,
      'isRequired',true,'displayOrder',10,'defaultSeverity','MAJOR'
    ))
  ),
  repeat('I',43),
  'd8f00000-0000-4000-8000-000000000001','legacy-checklist-save','PUT',
  '/api/hotels/50000000-0000-4000-8000-000000000001/inspection-checklist',
  'hash-legacy-checklist-save',
  'd9000000-0000-4000-8000-000000000001',
  'd9100000-0000-4000-8000-000000000001'
);
set constraints inspection_checklist_v1_sync_v2 immediate;
commit;

do $legacy_bridge$
declare
  v_legacy_version integer;
  v_v2 jsonb;
begin
  select max(version) into strict v_legacy_version
    from public.inspection_checklist_revisions
   where company_id='10000000-0000-0000-0000-000000000001'
     and branch_id='50000000-0000-4000-8000-000000000001';
  v_v2 := public.inspection_checklist_v2_snapshot_v1(
    '10000000-0000-0000-0000-000000000001',
    '50000000-0000-4000-8000-000000000001'
  );
  if (v_v2 ->> 'version')::integer <> v_legacy_version
     or jsonb_array_length(v_v2 -> 'items') <> 2
     or jsonb_array_length(jsonb_path_query_array(v_v2 -> 'items', '$[*] ? (@.targetType == "ROOM")')) <> 1
     or jsonb_array_length(jsonb_path_query_array(v_v2 -> 'items', '$[*] ? (@.targetType == "FACILITY")')) <> 1 then
    raise exception 'legacy v1 deferred bridge failed to preserve FACILITY definitions: %', v_v2;
  end if;
end
$legacy_bridge$;

select 'HOTEL_INSPECTION_CHECKLIST_TARGETS_OK';
