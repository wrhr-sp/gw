begin;

-- Forward-only hardening after 0038 reached Preview.

create or replace function public.inspection_checklist_v1_sync_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_revision_id uuid;
  v_previous_revision_id uuid;
  v_item record;
begin
  if current_setting('app.checklist_v2_dual_write', true) = '1' then
    return new;
  end if;
  if exists (
    select 1 from public.inspection_checklist_v2_revisions revision
     where revision.company_id = new.company_id
       and revision.branch_id = new.branch_id
       and revision.version = new.version
  ) then
    return new;
  end if;
  select revision.id into v_previous_revision_id
    from public.inspection_checklist_v2_revisions revision
   where revision.company_id = new.company_id
     and revision.branch_id = new.branch_id
     and revision.version < new.version
   order by revision.version desc
   limit 1;
  v_revision_id := pg_catalog.gen_random_uuid();
  insert into public.inspection_checklist_v2_revisions (
    id, company_id, branch_id, version, reason, created_by, created_at
  ) values (
    v_revision_id, new.company_id, new.branch_id, new.version,
    new.reason, new.created_by, new.created_at
  );
  for v_item in
    select item.* from public.inspection_checklist_items item
     where item.company_id = new.company_id and item.revision_id = new.id
     order by item.display_order, item.id
  loop
    insert into public.inspection_checklist_v2_items (
      id, company_id, branch_id, revision_id, source_item_id,
      target_type, source, room_type_id, name, description,
      is_required, display_order, default_severity, created_at
    ) values (
      pg_catalog.gen_random_uuid(), new.company_id, new.branch_id, v_revision_id,
      v_item.source_item_id, 'ROOM',
      case v_item.source when 'ROOM_TYPE_ADDED' then 'TARGET_TYPE_ADDED' else 'HOTEL_COMMON' end,
      v_item.room_type_id, v_item.name, v_item.description,
      v_item.is_required, v_item.display_order, v_item.default_severity, v_item.created_at
    );
  end loop;
  insert into public.inspection_checklist_v2_item_exclusions (
    id, company_id, branch_id, revision_id, checklist_item_id,
    target_type, room_type_id, created_at
  )
  select pg_catalog.gen_random_uuid(), new.company_id, new.branch_id, v_revision_id,
         v2_item.id, 'ROOM', exclusion.room_type_id, exclusion.created_at
    from public.inspection_checklist_item_exclusions exclusion
    join public.inspection_checklist_items legacy_item
      on legacy_item.company_id = exclusion.company_id
     and legacy_item.id = exclusion.checklist_item_id
    join public.inspection_checklist_v2_items v2_item
      on v2_item.company_id = legacy_item.company_id
     and v2_item.branch_id = new.branch_id
     and v2_item.revision_id = v_revision_id
     and v2_item.source_item_id = legacy_item.source_item_id
   where exclusion.company_id = new.company_id
     and exclusion.revision_id = new.id;
  if v_previous_revision_id is not null then
    insert into public.inspection_checklist_v2_items (
      id, company_id, branch_id, revision_id, source_item_id,
      target_type, source, facility_type_id, name, description,
      is_required, display_order, default_severity, created_at
    )
    select pg_catalog.gen_random_uuid(), previous_item.company_id,
           previous_item.branch_id, v_revision_id, previous_item.source_item_id,
           'FACILITY', previous_item.source, previous_item.facility_type_id,
           previous_item.name, previous_item.description, previous_item.is_required,
           previous_item.display_order, previous_item.default_severity,
           previous_item.created_at
      from public.inspection_checklist_v2_items previous_item
     where previous_item.company_id = new.company_id
       and previous_item.branch_id = new.branch_id
       and previous_item.revision_id = v_previous_revision_id
       and previous_item.target_type = 'FACILITY';
    insert into public.inspection_checklist_v2_item_exclusions (
      id, company_id, branch_id, revision_id, checklist_item_id,
      target_type, facility_type_id, created_at
    )
    select pg_catalog.gen_random_uuid(), previous_exclusion.company_id,
           previous_exclusion.branch_id, v_revision_id, current_item.id,
           'FACILITY', previous_exclusion.facility_type_id,
           previous_exclusion.created_at
      from public.inspection_checklist_v2_item_exclusions previous_exclusion
      join public.inspection_checklist_v2_items previous_item
        on previous_item.company_id = previous_exclusion.company_id
       and previous_item.branch_id = previous_exclusion.branch_id
       and previous_item.revision_id = previous_exclusion.revision_id
       and previous_item.id = previous_exclusion.checklist_item_id
       and previous_item.target_type = 'FACILITY'
      join public.inspection_checklist_v2_items current_item
        on current_item.company_id = previous_item.company_id
       and current_item.branch_id = previous_item.branch_id
       and current_item.revision_id = v_revision_id
       and current_item.source_item_id = previous_item.source_item_id
       and current_item.target_type = 'FACILITY'
     where previous_exclusion.company_id = new.company_id
       and previous_exclusion.branch_id = new.branch_id
       and previous_exclusion.revision_id = v_previous_revision_id
       and previous_exclusion.target_type = 'FACILITY';
  end if;
  return new;
end
$function$;
revoke all on function public.inspection_checklist_v1_sync_v2() from public;

create or replace function public.hotel_inspection_checklist_v3_command(
  p_company_id uuid, p_branch_id uuid, p_resource_id uuid, p_action text,
  p_expected_version integer, p_value jsonb, p_session_token text,
  p_idempotency_record_id uuid, p_idempotency_key text, p_http_method text,
  p_operation_path text, p_request_hash text, p_audit_event_id uuid, p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_actor record;
  v_existing record;
  v_current_version integer;
  v_legacy_version integer;
  v_next_version integer;
  v_revision_id uuid;
  v_legacy_revision_id uuid;
  v_snapshot jsonb;
  v_item jsonb;
  v_exclusion jsonb;
  v_snapshot_id uuid;
  v_legacy_snapshot_id uuid;
  v_target_type text;
  v_source text;
  v_type_id uuid;
  v_source_item_id uuid;
  v_room_count integer := 0;
  v_facility_count integer := 0;
begin
  if p_action not in ('READ_CHECKLIST_V2', 'SAVE_CHECKLIST_V2') then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id, p_branch_id, p_session_token,
      case when p_action = 'SAVE_CHECKLIST_V2' then 'HOTEL_INSPECTION_CONFIG' else 'HOTEL_INSPECTION_RUN' end,
      true
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;
  if p_action = 'READ_CHECKLIST_V2' then
    return query select 'OK'::text,
      public.inspection_checklist_v2_snapshot_v1(p_company_id, p_branch_id);
    return;
  end if;
  if pg_catalog.btrim(coalesce(p_idempotency_key, '')) = ''
     or p_http_method <> 'PUT'
     or p_operation_path not like '/api/%'
     or pg_catalog.btrim(coalesce(p_request_hash, '')) = '' then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_company_id::text || ':' || v_actor.user_id::text || ':' || p_idempotency_key || ':' ||
    p_http_method || ':' || p_operation_path, 0
  ));
  delete from public.idempotency_records
   where company_id = p_company_id and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key and http_method = p_http_method
     and operation_path = p_operation_path and expires_at <= v_now;
  select idempotency.request_hash, idempotency.result_snapshot into v_existing
    from public.idempotency_records idempotency
   where idempotency.company_id = p_company_id
     and idempotency.actor_user_id = v_actor.user_id
     and idempotency.idempotency_key = p_idempotency_key
     and idempotency.http_method = p_http_method
     and idempotency.operation_path = p_operation_path
     and idempotency.status = 'COMPLETED';
  if found then
    return query select
      case when v_existing.request_hash = p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end,
      case when v_existing.request_hash = p_request_hash then v_existing.result_snapshot else null::jsonb end;
    return;
  end if;
  select version into v_current_version
    from public.inspection_checklist_v2_revisions
   where company_id = p_company_id and branch_id = p_branch_id
   order by version desc limit 1 for update;
  if (not found and p_expected_version <> 0)
     or (found and v_current_version <> p_expected_version) then
    return query select 'VERSION_CONFLICT'::text, null::jsonb;
    return;
  end if;
  select version into v_legacy_version
    from public.inspection_checklist_revisions
   where company_id = p_company_id and branch_id = p_branch_id
   order by version desc limit 1 for update;
  if coalesce(v_legacy_version, 0) <> p_expected_version then
    return query select 'VERSION_CONFLICT'::text, null::jsonb;
    return;
  end if;
  if pg_catalog.jsonb_typeof(p_value -> 'items') <> 'array'
     or pg_catalog.jsonb_array_length(p_value -> 'items') < 2
     or pg_catalog.jsonb_array_length(p_value -> 'items') > 400
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_value ->> 'reason', ''))) not between 2 and 500 then
    return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb;
    return;
  end if;
  select count(*) filter (where item ->> 'targetType' = 'ROOM'),
         count(*) filter (where item ->> 'targetType' = 'FACILITY')
    into v_room_count, v_facility_count
    from pg_catalog.jsonb_array_elements(p_value -> 'items') item;
  if v_room_count = 0 or v_facility_count = 0 then
    return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb;
    return;
  end if;
  v_revision_id := (p_value ->> 'revisionId')::uuid;
  v_legacy_revision_id := (p_value ->> 'legacyRevisionId')::uuid;
  v_next_version := p_expected_version + 1;
  insert into public.inspection_checklist_v2_revisions (
    id, company_id, branch_id, version, reason, created_by
  ) values (
    v_revision_id, p_company_id, p_branch_id, v_next_version,
    p_value ->> 'reason', v_actor.user_id
  );
  for v_item in select * from pg_catalog.jsonb_array_elements(p_value -> 'items') loop
    v_target_type := v_item ->> 'targetType';
    v_source := v_item ->> 'source';
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
       or not pg_catalog.jsonb_exists_all(v_item, array[
         'itemId', 'itemIsNew', 'targetType', 'source', 'name', 'description',
         'isRequired', 'displayOrder', 'defaultSeverity', 'snapshotId',
         'legacySnapshotId'
       ]::text[]) then
      raise check_violation using message = 'invalid checklist target';
    end if;
    if v_target_type = 'ROOM' then
      if not pg_catalog.jsonb_exists_all(
           v_item, array['roomTypeId', 'excludedRoomTypeIds']::text[]
         )
         or pg_catalog.jsonb_exists(v_item, 'facilityTypeId')
         or pg_catalog.jsonb_exists(v_item, 'excludedFacilityTypeIds')
         or exists (
           select 1 from pg_catalog.jsonb_object_keys(v_item) item_key
            where item_key not in (
              'itemId', 'itemIsNew', 'targetType', 'source', 'roomTypeId',
              'excludedRoomTypeIds', 'name', 'description', 'isRequired',
              'displayOrder', 'defaultSeverity', 'snapshotId',
              'legacySnapshotId'
            )
         ) then
        raise check_violation using message = 'invalid checklist target';
      end if;
    elsif v_target_type = 'FACILITY' then
      if not pg_catalog.jsonb_exists_all(
           v_item, array['facilityTypeId', 'excludedFacilityTypeIds']::text[]
         )
         or pg_catalog.jsonb_exists(v_item, 'roomTypeId')
         or pg_catalog.jsonb_exists(v_item, 'excludedRoomTypeIds')
         or exists (
           select 1 from pg_catalog.jsonb_object_keys(v_item) item_key
            where item_key not in (
              'itemId', 'itemIsNew', 'targetType', 'source', 'facilityTypeId',
              'excludedFacilityTypeIds', 'name', 'description', 'isRequired',
              'displayOrder', 'defaultSeverity', 'snapshotId',
              'legacySnapshotId'
            )
         ) then
        raise check_violation using message = 'invalid checklist target';
      end if;
    else
      raise check_violation using message = 'invalid checklist target';
    end if;
    if coalesce(pg_catalog.jsonb_typeof(
         case when v_target_type = 'ROOM'
           then v_item -> 'excludedRoomTypeIds'
           else v_item -> 'excludedFacilityTypeIds' end
       ), '') <> 'array'
       or pg_catalog.jsonb_array_length(
         case when v_target_type = 'ROOM'
           then v_item -> 'excludedRoomTypeIds'
           else v_item -> 'excludedFacilityTypeIds' end
       ) > 100
       or (v_source = 'TARGET_TYPE_ADDED' and pg_catalog.jsonb_array_length(
         case when v_target_type = 'ROOM'
           then v_item -> 'excludedRoomTypeIds'
           else v_item -> 'excludedFacilityTypeIds' end
       ) > 0) then
      raise check_violation using message = 'invalid checklist target';
    end if;
    v_source_item_id := nullif(v_item ->> 'itemId', '')::uuid;
    if coalesce((v_item ->> 'itemIsNew')::boolean, false) then
      if v_source_item_id is null or exists (
        select 1 from public.inspection_checklist_v2_items existing_item
         where existing_item.company_id = p_company_id
           and existing_item.branch_id = p_branch_id
           and existing_item.source_item_id = v_source_item_id
      ) then
        raise check_violation using message = 'invalid checklist target';
      end if;
    elsif v_source_item_id is null or not exists (
      select 1
        from public.inspection_checklist_v2_items existing_item
        join public.inspection_checklist_v2_revisions existing_revision
          on existing_revision.company_id = existing_item.company_id
         and existing_revision.branch_id = existing_item.branch_id
         and existing_revision.id = existing_item.revision_id
       where existing_item.company_id = p_company_id
         and existing_item.branch_id = p_branch_id
         and existing_item.source_item_id = v_source_item_id
         and existing_item.target_type = v_target_type
         and existing_revision.version = p_expected_version
    ) then
      raise check_violation using message = 'invalid checklist target';
    end if;
    if v_target_type = 'ROOM' then
      v_room_count := v_room_count + 1;
      v_type_id := nullif(v_item ->> 'roomTypeId', '')::uuid;
      if (v_source = 'HOTEL_COMMON' and v_type_id is not null)
         or (v_source = 'TARGET_TYPE_ADDED' and not exists (
           select 1 from public.hotel_room_types room_type
            where room_type.company_id = p_company_id
              and room_type.id = v_type_id and room_type.is_active
              and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
         )) then
        raise check_violation using message = 'invalid checklist target';
      end if;
    elsif v_target_type = 'FACILITY' then
      v_facility_count := v_facility_count + 1;
      v_type_id := nullif(v_item ->> 'facilityTypeId', '')::uuid;
      if (v_source = 'HOTEL_COMMON' and v_type_id is not null)
         or (v_source = 'TARGET_TYPE_ADDED' and not exists (
           select 1 from public.hotel_facility_types facility_type
            where facility_type.company_id = p_company_id and facility_type.branch_id = p_branch_id
              and facility_type.id = v_type_id and facility_type.status = 'ACTIVE'
         )) then
        raise check_violation using message = 'invalid checklist target';
      end if;
    else
      raise check_violation using message = 'invalid checklist target';
    end if;
    v_snapshot_id := (v_item ->> 'snapshotId')::uuid;
    insert into public.inspection_checklist_v2_items (
      id, company_id, branch_id, revision_id, source_item_id,
      target_type, source, room_type_id, facility_type_id,
      name, description, is_required, display_order, default_severity
    ) values (
      v_snapshot_id, p_company_id, p_branch_id, v_revision_id,
      v_source_item_id, v_target_type, v_source,
      case when v_target_type = 'ROOM' then v_type_id else null end,
      case when v_target_type = 'FACILITY' then v_type_id else null end,
      v_item ->> 'name', v_item ->> 'description',
      (v_item ->> 'isRequired')::boolean,
      (v_item ->> 'displayOrder')::integer,
      v_item ->> 'defaultSeverity'
    );
    for v_exclusion in select * from pg_catalog.jsonb_array_elements(
      case when v_target_type = 'ROOM'
        then v_item -> 'excludedRoomTypeIds'
        else v_item -> 'excludedFacilityTypeIds' end
    ) loop
      v_type_id := (v_exclusion #>> '{}')::uuid;
      if (v_target_type = 'ROOM' and not exists (
          select 1 from public.hotel_room_types room_type
           where room_type.company_id = p_company_id
             and room_type.id = v_type_id and room_type.is_active
             and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
        )) or (v_target_type = 'FACILITY' and not exists (
          select 1 from public.hotel_facility_types facility_type
           where facility_type.company_id = p_company_id and facility_type.branch_id = p_branch_id
             and facility_type.id = v_type_id and facility_type.status = 'ACTIVE'
        )) then
        raise check_violation using message = 'invalid checklist target';
      end if;
      insert into public.inspection_checklist_v2_item_exclusions (
        id, company_id, branch_id, revision_id, checklist_item_id,
        target_type, room_type_id, facility_type_id
      ) values (
        pg_catalog.gen_random_uuid(), p_company_id, p_branch_id, v_revision_id,
        v_snapshot_id, v_target_type,
        case when v_target_type = 'ROOM' then v_type_id else null end,
        case when v_target_type = 'FACILITY' then v_type_id else null end
      );
    end loop;
  end loop;
  if v_room_count = 0 or v_facility_count = 0 then
    return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb;
    return;
  end if;
  perform pg_catalog.set_config('app.checklist_v2_dual_write', '1', true);
  insert into public.inspection_checklist_revisions (
    id, company_id, branch_id, version, reason, created_by
  ) values (
    v_legacy_revision_id, p_company_id, p_branch_id, v_next_version,
    p_value ->> 'reason', v_actor.user_id
  );
  for v_item in
    select * from pg_catalog.jsonb_array_elements(p_value -> 'items')
     where value ->> 'targetType' = 'ROOM'
  loop
    v_legacy_snapshot_id := (v_item ->> 'legacySnapshotId')::uuid;
    insert into public.inspection_checklist_items (
      id, company_id, revision_id, source_item_id, source, room_type_id,
      name, description, is_required, display_order, default_severity
    ) values (
      v_legacy_snapshot_id, p_company_id, v_legacy_revision_id,
      (v_item ->> 'itemId')::uuid,
      case v_item ->> 'source' when 'TARGET_TYPE_ADDED' then 'ROOM_TYPE_ADDED' else 'HOTEL_COMMON' end,
      nullif(v_item ->> 'roomTypeId', '')::uuid,
      v_item ->> 'name', v_item ->> 'description',
      (v_item ->> 'isRequired')::boolean,
      (v_item ->> 'displayOrder')::integer,
      v_item ->> 'defaultSeverity'
    );
    for v_exclusion in select * from pg_catalog.jsonb_array_elements(v_item -> 'excludedRoomTypeIds') loop
      insert into public.inspection_checklist_item_exclusions (
        id, company_id, revision_id, checklist_item_id, room_type_id
      ) values (
        pg_catalog.gen_random_uuid(), p_company_id, v_legacy_revision_id,
        v_legacy_snapshot_id, (v_exclusion #>> '{}')::uuid
      );
    end loop;
  end loop;
  v_snapshot := public.inspection_checklist_v2_snapshot_v1(p_company_id, p_branch_id);
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id, 'HOTEL_INSPECTION_SAVE_CHECKLIST_V2', v_actor.user_id,
    v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
    'INSPECTION_CHECKLIST', v_revision_id,
    pg_catalog.jsonb_build_object('resourceId', v_revision_id, 'version', v_next_version),
    p_value ->> 'reason', 'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id, p_idempotency_key,
    p_http_method, p_operation_path, p_request_hash, 'COMPLETED',
    'INSPECTION_CHECKLIST', v_revision_id, p_audit_event_id, v_snapshot,
    v_now, v_now + interval '24 hours'
  );
  return query select case when p_expected_version = 0 then 'CREATED' else 'UPDATED' end, v_snapshot;
exception
  when invalid_text_representation or foreign_key_violation or check_violation then
    return query select 'INVALID_TARGET'::text, null::jsonb;
  when unique_violation then
    return query select 'DUPLICATE'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_inspection_checklist_v3_command(
  uuid, uuid, uuid, text, integer, jsonb, text, uuid, text,
  text, text, text, uuid, uuid
) from public;

insert into public.schema_migrations(version)
values ('0039_hotel_inspection_checklist_v2_hardening')
on conflict (version) do nothing;

commit;
