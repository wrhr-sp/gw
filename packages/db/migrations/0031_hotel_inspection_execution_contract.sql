begin;

alter table public.inspection_item_snapshots
  add column room_number_snapshot text,
  add column floor_label_snapshot text,
  add column floor_sort_key_snapshot integer,
  add column room_type_name_snapshot text;

alter table public.inspection_item_snapshots
  disable trigger inspection_item_snapshots_append_only;

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
   and room.id = item.room_id;

alter table public.inspection_item_snapshots
  enable trigger inspection_item_snapshots_append_only;

alter table public.inspection_item_snapshots
  alter column room_number_snapshot set not null,
  alter column floor_label_snapshot set not null,
  alter column floor_sort_key_snapshot set not null,
  alter column room_type_name_snapshot set not null;

create function public.inspection_item_room_snapshot_capture_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  select room.room_number, room.floor_label, room.floor_sort_key, room_type.name
    into new.room_number_snapshot, new.floor_label_snapshot,
         new.floor_sort_key_snapshot, new.room_type_name_snapshot
    from public.hotel_rooms room
    join public.hotel_room_types room_type
      on room_type.company_id = room.company_id
     and room_type.id = room.room_type_id
   where room.company_id = new.company_id
     and room.branch_id = new.branch_id
     and room.id = new.room_id;
  if not found then
    raise check_violation using message = 'inspection room snapshot source is invalid';
  end if;
  return new;
end
$function$;
revoke all on function public.inspection_item_room_snapshot_capture_v1() from public;

create trigger inspection_item_room_snapshot_capture
before insert on public.inspection_item_snapshots
for each row execute function public.inspection_item_room_snapshot_capture_v1();

create or replace function public.inspection_execution_snapshot_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_inspection_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select pg_catalog.jsonb_build_object(
    'id', inspection.id,
    'hotelId', inspection.branch_id,
    'source', inspection.source,
    'businessDate', inspection.business_date,
    'dueAt', pg_catalog.to_char(inspection.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'status', inspection.status,
    'version', inspection.version,
    'process', pg_catalog.jsonb_build_object(
      'executionId', execution.id,
      'definitionId', execution.definition_id,
      'revisionId', execution.revision_id,
      'currentStageKey', execution.current_stage_key,
      'currentStageName', execution.current_stage_name,
      'state', execution.state,
      'version', execution.version
    ),
    'items', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', snapshot.id,
          'roomId', snapshot.room_id,
          'itemId', snapshot.source_item_id,
          'name', snapshot.name,
          'description', snapshot.description,
          'isRequired', snapshot.is_required,
          'displayOrder', snapshot.display_order,
          'defaultSeverity', snapshot.default_severity,
          'result', case when result_record.id is null then null else
            pg_catalog.jsonb_build_object(
              'result', result_record.result,
              'description', result_record.description,
              'severity', result_record.severity,
              'fileVersionIds', coalesce((
                select pg_catalog.jsonb_agg(link.file_version_id order by link.linked_at)
                  from public.hotel_file_links link
                 where link.company_id = snapshot.company_id
                   and link.result_id = result_record.id
                   and link.result_version = result_record.version
              ), '[]'::jsonb),
              'version', result_record.version
            ) end
        ) order by snapshot.floor_sort_key_snapshot,
                   snapshot.room_number_snapshot, snapshot.room_id,
                   snapshot.display_order, snapshot.id
      )
        from public.inspection_item_snapshots snapshot
        left join public.inspection_item_results result_record
          on result_record.company_id = snapshot.company_id
         and result_record.inspection_id = snapshot.inspection_id
         and result_record.item_snapshot_id = snapshot.id
       where snapshot.company_id = inspection.company_id
         and snapshot.branch_id = inspection.branch_id
         and snapshot.inspection_id = inspection.id
    ), '[]'::jsonb),
    'createdAt', pg_catalog.to_char(inspection.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', pg_catalog.to_char(inspection.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
    from public.hotel_inspections inspection
    join public.process_executions execution
      on execution.company_id = inspection.company_id
     and execution.id = inspection.process_execution_id
   where inspection.company_id = p_company_id
     and inspection.branch_id = p_branch_id
     and inspection.id = p_inspection_id
$function$;
revoke all on function public.inspection_execution_snapshot_v1(uuid, uuid, uuid) from public;

create function public.inspection_execution_read_snapshot_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_inspection_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select case when snapshot.value is null then null::jsonb else
    snapshot.value || pg_catalog.jsonb_build_object(
      'rooms', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', selected_room.room_id,
          'roomNumber', selected_room.room_number_snapshot,
          'floorLabel', selected_room.floor_label_snapshot,
          'roomTypeName', selected_room.room_type_name_snapshot
        ) order by selected_room.floor_sort_key_snapshot,
                   selected_room.room_number_snapshot, selected_room.room_id)
          from (
            select distinct item.room_id, item.room_number_snapshot,
                   item.floor_label_snapshot, item.floor_sort_key_snapshot,
                   item.room_type_name_snapshot
              from public.inspection_item_snapshots item
             where item.company_id = p_company_id
               and item.branch_id = p_branch_id
               and item.inspection_id = p_inspection_id
          ) selected_room
      ), '[]'::jsonb)
    ) end
    from (select public.inspection_execution_snapshot_v1(
      p_company_id, p_branch_id, p_inspection_id
    ) as value) snapshot
$function$;
revoke all on function public.inspection_execution_read_snapshot_v1(uuid, uuid, uuid) from public;

create function public.hotel_inspection_executions_read_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_inspection_id uuid,
  p_query jsonb,
  p_session_token text
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_snapshot jsonb;
  v_page integer := coalesce(nullif(p_query ->> 'page', '')::integer, 1);
  v_page_size integer := coalesce(nullif(p_query ->> 'pageSize', '')::integer, 20);
  v_total integer;
  v_total_pages integer;
begin
  if not exists (
    select 1 from public.hotel_command_actor_v1(
      p_company_id, p_branch_id, p_session_token, 'HOTEL_INSPECTION_RUN', true
    )
  ) then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;
  if p_inspection_id is not null then
    v_snapshot := public.inspection_execution_read_snapshot_v1(
      p_company_id, p_branch_id, p_inspection_id
    );
    return query select
      case when v_snapshot is null then 'NOT_FOUND' else 'OK' end::text,
      case when v_snapshot is null then null::jsonb
           else pg_catalog.jsonb_build_object('inspection', v_snapshot) end;
    return;
  end if;
  if v_page < 1 or v_page_size not between 1 and 100
     or (p_query ? 'status' and p_query ->> 'status' not in (
       'PENDING_INPUT', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'UNFINISHED_CLOSED'
     ))
     or (p_query ? 'source' and p_query ->> 'source' not in ('MANUAL', 'ROUTINE')) then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  select pg_catalog.count(*)::integer into v_total
    from public.hotel_inspections inspection
   where inspection.company_id = p_company_id
     and inspection.branch_id = p_branch_id
     and (not (p_query ? 'status') or inspection.status = p_query ->> 'status')
     and (not (p_query ? 'source') or inspection.source = p_query ->> 'source');
  v_total_pages := case when v_total = 0 then 0
    else ((v_total + v_page_size - 1) / v_page_size) end;
  select pg_catalog.jsonb_build_object(
    'inspections', coalesce(pg_catalog.jsonb_agg(
      (public.inspection_execution_read_snapshot_v1(
        p_company_id, p_branch_id, page.id
      ) - 'items') order by page.business_date desc, page.created_at desc, page.id
    ), '[]'::jsonb),
    'pagination', pg_catalog.jsonb_build_object(
      'page', v_page, 'pageSize', v_page_size,
      'total', v_total, 'totalPages', v_total_pages
    )
  ) into v_snapshot
    from (
      select inspection.id, inspection.business_date, inspection.created_at
        from public.hotel_inspections inspection
       where inspection.company_id = p_company_id
         and inspection.branch_id = p_branch_id
         and (not (p_query ? 'status') or inspection.status = p_query ->> 'status')
         and (not (p_query ? 'source') or inspection.source = p_query ->> 'source')
       order by inspection.business_date desc, inspection.created_at desc, inspection.id
       limit v_page_size offset (v_page - 1) * v_page_size
    ) page;
  return query select 'OK'::text, v_snapshot;
exception
  when invalid_text_representation then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_inspection_executions_read_v1(uuid, uuid, uuid, jsonb, text) from public;

create or replace function public.hotel_inspection_command_v1(
  p_company_id uuid, p_branch_id uuid, p_resource_id uuid, p_action text,
  p_expected_version integer, p_value jsonb, p_session_token text,
  p_idempotency_record_id uuid, p_idempotency_key text, p_http_method text,
  p_operation_path text, p_request_hash text, p_audit_event_id uuid, p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_actor record;
  v_existing record;
  v_current_version integer;
  v_inspection_status text;
  v_inspection_process_execution_id uuid;
  v_current_result_id uuid;
  v_current_result_version integer;
  v_process_definition_id uuid;
  v_process_revision_id uuid;
  v_process_execution public.process_executions%rowtype;
  v_start_stage_key text;
  v_stage public.process_stage_snapshots%rowtype;
  v_transition public.process_transition_snapshots%rowtype;
  v_revision_id uuid;
  v_checklist_revision_id uuid;
  v_process_execution_id uuid;
  v_result_id uuid;
  v_effective_resource_id uuid;
  v_snapshot jsonb;
  v_item jsonb;
  v_exclusion jsonb;
  v_round jsonb;
  v_target jsonb;
  v_file_id text;
  v_permission text;
  v_mutation boolean;
  v_next_version integer;
  v_count integer;
  v_business_date date;
  v_due_at timestamptz;
  v_result text;
  v_description text;
  v_severity text;
  v_reason text;
begin
  if p_action not in (
    'READ_CHECKLIST', 'SAVE_CHECKLIST', 'LIST_ROUTINES', 'SAVE_ROUTINE',
    'LIST_INSPECTIONS', 'READ_INSPECTION', 'CREATE_MANUAL', 'SAVE_RESULT',
    'SUBMIT', 'TRANSITION'
  ) then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  v_permission := case
    when p_action in ('SAVE_CHECKLIST', 'SAVE_ROUTINE') then 'HOTEL_INSPECTION_CONFIG'
    when p_action = 'TRANSITION' then 'HOTEL_INSPECTION_REVIEW'
    else 'HOTEL_INSPECTION_RUN'
  end;
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id, p_branch_id, p_session_token, v_permission, true
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  if p_action = 'READ_CHECKLIST' then
    v_snapshot := public.inspection_checklist_snapshot_v1(p_company_id, p_branch_id);
    return query select 'OK'::text, v_snapshot;
    return;
  elsif p_action = 'LIST_ROUTINES' then
    select pg_catalog.jsonb_build_object(
      'routines', coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', routine.id, 'hotelId', routine.branch_id, 'name', routine.name,
          'status', routine.status, 'version', routine.version,
          'nextDueDate', routine.next_due_date,
          'createdAt', pg_catalog.to_char(routine.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'updatedAt', pg_catalog.to_char(routine.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) order by routine.updated_at desc
      ), '[]'::jsonb)
    ) into v_snapshot
      from public.inspection_routines routine
     where routine.company_id = p_company_id and routine.branch_id = p_branch_id;
    return query select 'OK'::text, v_snapshot;
    return;
  elsif p_action = 'READ_INSPECTION' then
    v_snapshot := public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, p_resource_id);
    return query select case when v_snapshot is null then 'NOT_FOUND' else 'OK' end::text, v_snapshot;
    return;
  elsif p_action = 'LIST_INSPECTIONS' then
    select pg_catalog.jsonb_build_object(
      'inspections', coalesce(pg_catalog.jsonb_agg(
        public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, inspection.id)
        order by inspection.business_date desc, inspection.created_at desc
      ), '[]'::jsonb),
      'total', pg_catalog.count(*)
    ) into v_snapshot
      from public.hotel_inspections inspection
     where inspection.company_id = p_company_id
       and inspection.branch_id = p_branch_id
       and (p_value ->> 'status' is null or inspection.status = p_value ->> 'status')
       and (p_value ->> 'startDate' is null or inspection.business_date >= (p_value ->> 'startDate')::date)
       and (p_value ->> 'endDate' is null or inspection.business_date <= (p_value ->> 'endDate')::date);
    return query select 'OK'::text, v_snapshot;
    return;
  end if;

  v_mutation := true;
  if pg_catalog.btrim(coalesce(p_idempotency_key, '')) = ''
     or p_http_method not in ('POST', 'PUT', 'PATCH')
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
   where company_id = p_company_id and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key and http_method = p_http_method
     and operation_path = p_operation_path and status = 'COMPLETED';
  if found then
    return query select
      case when v_existing.request_hash = p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end::text,
      case when v_existing.request_hash = p_request_hash then v_existing.result_snapshot else null::jsonb end;
    return;
  end if;

  if p_action = 'SAVE_CHECKLIST' then
    select revision.version into v_current_version
      from public.inspection_checklist_revisions revision
     where revision.company_id = p_company_id and revision.branch_id = p_branch_id
     order by revision.version desc limit 1 for update;
    if (not found and p_expected_version <> 0)
       or (found and v_current_version <> p_expected_version) then
      return query select 'VERSION_CONFLICT'::text, null::jsonb;
      return;
    end if;
    if pg_catalog.jsonb_typeof(p_value -> 'items') <> 'array'
       or pg_catalog.jsonb_array_length(p_value -> 'items') < 1
       or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_value ->> 'reason', ''))) not between 2 and 500 then
      return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb;
      return;
    end if;
    v_revision_id := (p_value ->> 'revisionId')::uuid;
    v_next_version := p_expected_version + 1;
    insert into public.inspection_checklist_revisions (
      id, company_id, branch_id, version, reason, created_by
    ) values (
      v_revision_id, p_company_id, p_branch_id, v_next_version,
      p_value ->> 'reason', v_actor.user_id
    );
    for v_item in select * from pg_catalog.jsonb_array_elements(p_value -> 'items') loop
      if (v_item ->> 'source' = 'HOTEL_COMMON' and v_item ->> 'roomTypeId' is not null)
         or (v_item ->> 'source' = 'ROOM_TYPE_ADDED' and not exists (
           select 1 from public.hotel_room_types room_type
            where room_type.company_id = p_company_id
              and room_type.id = (v_item ->> 'roomTypeId')::uuid
              and room_type.is_active
              and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
         )) then
        return query select 'INVALID_TARGET'::text, null::jsonb;
        return;
      end if;
      insert into public.inspection_checklist_items (
        id, company_id, revision_id, source_item_id, source, room_type_id,
        name, description, is_required, display_order, default_severity
      ) values (
        (v_item ->> 'snapshotId')::uuid, p_company_id, v_revision_id,
        (v_item ->> 'itemId')::uuid, v_item ->> 'source',
        nullif(v_item ->> 'roomTypeId', '')::uuid,
        v_item ->> 'name', v_item ->> 'description',
        (v_item ->> 'isRequired')::boolean, (v_item ->> 'displayOrder')::integer,
        v_item ->> 'defaultSeverity'
      );
      for v_exclusion in select * from pg_catalog.jsonb_array_elements(v_item -> 'excludedRoomTypeIds') loop
        if not exists (
          select 1 from public.hotel_room_types room_type
           where room_type.company_id = p_company_id
             and room_type.id = (v_exclusion #>> '{}')::uuid
             and room_type.is_active
             and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
        ) then
          return query select 'INVALID_TARGET'::text, null::jsonb;
          return;
        end if;
        insert into public.inspection_checklist_item_exclusions (
          id, company_id, revision_id, checklist_item_id, room_type_id
        ) values (
          pg_catalog.gen_random_uuid(), p_company_id, v_revision_id,
          (v_item ->> 'snapshotId')::uuid, (v_exclusion #>> '{}')::uuid
        );
      end loop;
    end loop;
    v_snapshot := public.inspection_checklist_snapshot_v1(p_company_id, p_branch_id);

  elsif p_action = 'SAVE_ROUTINE' then
    if p_expected_version = 0 then
      insert into public.inspection_routines (
        id, company_id, branch_id, name, status, next_due_date,
        created_by, updated_by
      ) values (
        p_resource_id, p_company_id, p_branch_id, p_value ->> 'name',
        p_value ->> 'status', (p_value ->> 'startDate')::date,
        v_actor.user_id, v_actor.user_id
      );
      v_next_version := 1;
    else
      select routine.version into v_current_version
        from public.inspection_routines routine
       where routine.company_id = p_company_id and routine.branch_id = p_branch_id
         and routine.id = p_resource_id for update;
      if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
      if v_current_version <> p_expected_version then
        return query select 'INSPECTION_ROUTINE_VERSION_CONFLICT'::text, null::jsonb; return;
      end if;
      update public.inspection_routines
         set name = p_value ->> 'name', status = p_value ->> 'status',
             next_due_date = greatest(next_due_date, (p_value ->> 'startDate')::date),
             version = version + 1, updated_by = v_actor.user_id, updated_at = v_now
       where company_id = p_company_id and id = p_resource_id;
      v_next_version := p_expected_version + 1;
    end if;
    select definition.id, definition.current_revision_id
      into v_process_definition_id, v_process_revision_id
      from public.process_definitions definition
     where definition.company_id = p_company_id
       and definition.id = coalesce(
         nullif(p_value ->> 'processDefinitionId', '')::uuid,
         (select default_record.definition_id from public.hotel_process_defaults default_record
           where default_record.company_id = p_company_id and default_record.branch_id = p_branch_id
             and default_record.application_type = 'ROOM_INSPECTION')
       )
       and (definition.branch_id is null or definition.branch_id = p_branch_id);
    if not found then return query select 'PROCESS_DEFAULT_REQUIRED'::text, null::jsonb; return; end if;
    v_revision_id := (p_value ->> 'revisionId')::uuid;
    insert into public.inspection_routine_revisions (
      id, company_id, routine_id, version, mode, recurrence_type,
      day_of_week, day_of_month, recurrence_interval, start_date, end_date,
      local_due_time, process_definition_id, process_revision_id, created_by
    ) values (
      v_revision_id, p_company_id, p_resource_id, v_next_version,
      p_value ->> 'mode', p_value -> 'recurrence' ->> 'type',
      p_value -> 'recurrence' ->> 'dayOfWeek',
      nullif(p_value -> 'recurrence' ->> 'dayOfMonth', '')::integer,
      nullif(p_value -> 'recurrence' ->> 'interval', '')::integer,
      (p_value ->> 'startDate')::date, nullif(p_value ->> 'endDate', '')::date,
      (p_value ->> 'localDueTime')::time, v_process_definition_id,
      v_process_revision_id, v_actor.user_id
    );
    for v_round in select * from pg_catalog.jsonb_array_elements(p_value -> 'rounds') loop
      insert into public.inspection_routine_rounds (
        id, company_id, revision_id, round_order, target_type, target_value
      ) values (
        (v_round ->> 'id')::uuid, p_company_id, v_revision_id,
        (v_round ->> 'order')::integer, v_round -> 'target' ->> 'type',
        v_round -> 'target'
      );
    end loop;
    update public.inspection_routines set current_revision_id = v_revision_id
     where company_id = p_company_id and id = p_resource_id;
    select pg_catalog.jsonb_build_object(
      'id', routine.id, 'hotelId', routine.branch_id, 'name', routine.name,
      'status', routine.status, 'version', routine.version,
      'nextDueDate', routine.next_due_date
    ) into v_snapshot from public.inspection_routines routine
     where routine.company_id = p_company_id and routine.id = p_resource_id;

  elsif p_action = 'CREATE_MANUAL' then
    v_business_date := (v_now at time zone 'Asia/Seoul')::date;
    v_due_at := ((v_business_date + 1)::timestamp at time zone 'Asia/Seoul') - interval '1 millisecond';
    select definition.id, definition.current_revision_id
      into v_process_definition_id, v_process_revision_id
      from public.process_definitions definition
     where definition.company_id = p_company_id
       and definition.id = coalesce(
         nullif(p_value ->> 'processDefinitionId', '')::uuid,
         (select default_record.definition_id from public.hotel_process_defaults default_record
           where default_record.company_id = p_company_id and default_record.branch_id = p_branch_id
             and default_record.application_type = 'ROOM_INSPECTION')
       )
       and (definition.branch_id is null or definition.branch_id = p_branch_id);
    if not found then return query select 'PROCESS_DEFAULT_REQUIRED'::text, null::jsonb; return; end if;
    select revision.id into v_checklist_revision_id
      from public.inspection_checklist_revisions revision
     where revision.company_id = p_company_id and revision.branch_id = p_branch_id
     order by revision.version desc limit 1;
    if not found then return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb; return; end if;
    v_process_execution_id := (p_value ->> 'processExecutionId')::uuid;
    insert into public.process_executions (
      id, company_id, branch_id, application_type, resource_id,
      definition_id, revision_id, state, created_by
    ) values (
      v_process_execution_id, p_company_id, p_branch_id, 'ROOM_INSPECTION',
      p_resource_id, v_process_definition_id, v_process_revision_id,
      'PENDING_INPUT', v_actor.user_id
    );
    insert into public.hotel_inspections (
      id, company_id, branch_id, source, business_date, due_at, status,
      process_execution_id, created_by
    ) values (
      p_resource_id, p_company_id, p_branch_id, 'MANUAL', v_business_date,
      v_due_at, 'PENDING_INPUT', v_process_execution_id, v_actor.user_id
    );
    for v_target in select * from pg_catalog.jsonb_array_elements(p_value -> 'targets') loop
      if not exists (
        select 1 from public.hotel_rooms room
         where room.company_id = p_company_id and room.branch_id = p_branch_id
           and room.id = (v_target ->> 'roomId')::uuid and room.status = 'ACTIVE'
      ) then return query select 'INVALID_TARGET'::text, null::jsonb; return; end if;
      insert into public.inspection_item_snapshots (
        id, company_id, branch_id, inspection_id, room_id, source_item_id,
        checklist_revision_id, name, description, is_required, display_order,
        default_severity
      )
      select pg_catalog.gen_random_uuid(), p_company_id, p_branch_id, p_resource_id,
             (v_target ->> 'roomId')::uuid, item.source_item_id,
             v_checklist_revision_id, item.name, item.description,
             item.is_required, item.display_order, item.default_severity
        from public.inspection_checklist_items item
        join public.hotel_rooms room
          on room.company_id = p_company_id and room.branch_id = p_branch_id
         and room.id = (v_target ->> 'roomId')::uuid
       where item.company_id = p_company_id and item.revision_id = v_checklist_revision_id
         and item.source_item_id in (
           select (selected #>> '{}')::uuid
             from pg_catalog.jsonb_array_elements(v_target -> 'selectedItemIds') selected
         )
         and (
           (item.source = 'HOTEL_COMMON' and not exists (
             select 1 from public.inspection_checklist_item_exclusions exclusion
              where exclusion.company_id = p_company_id
                and exclusion.checklist_item_id = item.id
                and exclusion.room_type_id = room.room_type_id
           ))
           or (item.source = 'ROOM_TYPE_ADDED' and item.room_type_id = room.room_type_id)
         );
      get diagnostics v_count = row_count;
      if v_count <> pg_catalog.jsonb_array_length(v_target -> 'selectedItemIds') then
        return query select 'INVALID_TARGET'::text, null::jsonb; return;
      end if;
    end loop;
    v_snapshot := public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, p_resource_id);

  elsif p_action = 'SAVE_RESULT' then
    select inspection.status into v_inspection_status
      from public.hotel_inspections inspection
     where inspection.company_id = p_company_id and inspection.branch_id = p_branch_id
       and inspection.id = p_resource_id for update;
    if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
    if v_inspection_status in ('COMPLETED', 'CANCELLED', 'UNFINISHED_CLOSED') then
      return query select 'INSPECTION_FINAL_LOCKED'::text, null::jsonb; return;
    end if;
    if not exists (
      select 1 from public.inspection_item_snapshots item
       where item.company_id = p_company_id and item.inspection_id = p_resource_id
         and item.id = (p_value ->> 'itemSnapshotId')::uuid
    ) then return query select 'INVALID_TARGET'::text, null::jsonb; return; end if;
    v_result := p_value ->> 'result';
    v_description := p_value ->> 'description';
    v_severity := p_value ->> 'severity';
    v_reason := p_value ->> 'changeReason';
    if (v_result = 'NORMAL' and (v_description is not null or v_severity is not null or pg_catalog.jsonb_array_length(p_value -> 'fileVersionIds') <> 0))
       or (v_result = 'CAUTION' and (pg_catalog.char_length(pg_catalog.btrim(coalesce(v_description, ''))) < 2 or v_severity is not null or pg_catalog.jsonb_array_length(p_value -> 'fileVersionIds') <> 0))
       -- ABNORMAL_DRAFT_WITHOUT_EVIDENCE: evidence is enforced when the inspection is submitted.
       or (v_result = 'ABNORMAL' and (pg_catalog.char_length(pg_catalog.btrim(coalesce(v_description, ''))) < 2 or v_severity not in ('OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL') or pg_catalog.jsonb_array_length(p_value -> 'fileVersionIds') not between 0 and 5)) then
      return query select 'INSPECTION_RESULT_EVIDENCE_REQUIRED'::text, null::jsonb; return;
    end if;
    if v_result = 'ABNORMAL' and exists (
      select 1 from pg_catalog.jsonb_array_elements_text(p_value -> 'fileVersionIds') file_id
       where not exists (
         select 1 from public.hotel_file_versions version_record
         join public.hotel_file_uploads upload
           on upload.company_id = version_record.company_id and upload.id = version_record.upload_id
        where version_record.company_id = p_company_id
          and version_record.id = file_id::uuid
          and upload.branch_id = p_branch_id
          and upload.inspection_id = p_resource_id
          and upload.item_snapshot_id = (p_value ->> 'itemSnapshotId')::uuid
          and upload.status = 'READY_UNLINKED'
       )
    ) then return query select 'INSPECTION_RESULT_EVIDENCE_REQUIRED'::text, null::jsonb; return; end if;
    select result_record.id, result_record.version
      into v_current_result_id, v_current_result_version
      from public.inspection_item_results result_record
     where result_record.company_id = p_company_id and result_record.inspection_id = p_resource_id
       and result_record.item_snapshot_id = (p_value ->> 'itemSnapshotId')::uuid
     for update;
    if not found then
      if p_expected_version <> 0 then return query select 'VERSION_CONFLICT'::text, null::jsonb; return; end if;
      v_result_id := (p_value ->> 'resultId')::uuid;
      v_next_version := 1;
      insert into public.inspection_item_results (
        id, company_id, branch_id, inspection_id, item_snapshot_id,
        result, description, severity, updated_by
      ) values (
        v_result_id, p_company_id, p_branch_id, p_resource_id,
        (p_value ->> 'itemSnapshotId')::uuid, v_result, v_description,
        v_severity, v_actor.user_id
      );
      v_reason := coalesce(v_reason, '점검 결과 최초 저장');
    else
      if v_current_result_version <> p_expected_version
         or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_reason, ''))) not between 2 and 500 then
        return query select 'VERSION_CONFLICT'::text, null::jsonb; return;
      end if;
      v_result_id := v_current_result_id;
      v_next_version := p_expected_version + 1;
      update public.inspection_item_results
         set result = v_result, description = v_description, severity = v_severity,
             version = version + 1, updated_by = v_actor.user_id, updated_at = v_now
       where company_id = p_company_id and id = v_result_id;
    end if;
    if v_result = 'ABNORMAL' then
      for v_file_id in select * from pg_catalog.jsonb_array_elements_text(p_value -> 'fileVersionIds') loop
        insert into public.hotel_file_links (
          id, company_id, branch_id, file_version_id, parent_type,
          inspection_id, item_snapshot_id, result_id, result_version, linked_by
        ) values (
          pg_catalog.gen_random_uuid(), p_company_id, p_branch_id, v_file_id::uuid,
          'INSPECTION_ITEM_EVIDENCE', p_resource_id,
          (p_value ->> 'itemSnapshotId')::uuid, v_result_id, v_next_version,
          v_actor.user_id
        );
        update public.hotel_file_uploads upload set status = 'LINKED', updated_at = v_now
         where upload.company_id = p_company_id
           and upload.id = (select version_record.upload_id from public.hotel_file_versions version_record where version_record.company_id = p_company_id and version_record.id = v_file_id::uuid)
           and upload.status = 'READY_UNLINKED';
      end loop;
    end if;
    insert into public.inspection_item_result_history (
      id, company_id, branch_id, inspection_id, item_snapshot_id, result_id,
      version, result, description, severity, file_version_ids,
      change_reason, changed_by
    ) values (
      (p_value ->> 'historyId')::uuid, p_company_id, p_branch_id, p_resource_id,
      (p_value ->> 'itemSnapshotId')::uuid, v_result_id, v_next_version,
      v_result, v_description, v_severity,
      array(select value::uuid from pg_catalog.jsonb_array_elements_text(p_value -> 'fileVersionIds')),
      v_reason, v_actor.user_id
    );
    v_snapshot := public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, p_resource_id);

  elsif p_action = 'SUBMIT' then
    select inspection.status, inspection.version, inspection.process_execution_id
      into v_inspection_status, v_current_version, v_inspection_process_execution_id
      from public.hotel_inspections inspection
     where inspection.company_id = p_company_id and inspection.branch_id = p_branch_id
       and inspection.id = p_resource_id for update;
    if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
    if v_inspection_status <> 'PENDING_INPUT' or v_current_version <> p_expected_version then
      return query select 'VERSION_CONFLICT'::text, null::jsonb; return;
    end if;
    if exists (
      select 1 from public.inspection_item_snapshots item
       left join public.inspection_item_results result_record
         on result_record.company_id = item.company_id
        and result_record.inspection_id = item.inspection_id
        and result_record.item_snapshot_id = item.id
      where item.company_id = p_company_id and item.inspection_id = p_resource_id
        and item.is_required and result_record.id is null
    ) then return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb; return; end if;
    if exists (
      select 1
        from public.inspection_item_results result_record
       where result_record.company_id = p_company_id
         and result_record.inspection_id = p_resource_id
         and result_record.result = 'ABNORMAL'
         and not exists (
           select 1
             from public.hotel_file_links file_link
            where file_link.company_id = result_record.company_id
              and file_link.inspection_id = result_record.inspection_id
              and file_link.result_id = result_record.id
              and file_link.result_version = result_record.version
         )
    ) then return query select 'INSPECTION_RESULT_EVIDENCE_REQUIRED'::text, null::jsonb; return; end if;
    select execution.* into v_process_execution
      from public.process_executions execution
     where execution.company_id = p_company_id and execution.id = v_inspection_process_execution_id
     for update of execution;
    select revision.start_stage_key into v_start_stage_key
      from public.process_definition_revisions revision
     where revision.company_id = p_company_id
       and revision.id = v_process_execution.revision_id;
    select stage.* into v_stage from public.process_stage_snapshots stage
     where stage.company_id = p_company_id and stage.revision_id = v_process_execution.revision_id
       and stage.stage_key = v_start_stage_key;
    if not exists (
      select 1 from public.hotel_staff_assignments assignment
       where assignment.company_id = p_company_id and assignment.branch_id = p_branch_id
         and assignment.user_id = (v_stage).reviewer_user_id and assignment.terminated_at is null
         and assignment.start_date <= v_now::date and (assignment.end_date is null or assignment.end_date >= v_now::date)
    ) then return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb; return; end if;
    update public.process_executions set state = 'IN_REVIEW',
      current_stage_key = (v_stage).stage_key, current_stage_name = (v_stage).stage_name,
      current_reviewer_user_id = (v_stage).reviewer_user_id,
      current_delegate_user_id = case when (v_stage).delegate_starts_at <= v_now and ((v_stage).delegate_ends_at is null or (v_stage).delegate_ends_at > v_now) then (v_stage).delegate_user_id else null end,
      current_due_at = case when (v_stage).due_unit = 'HOURS' then v_now + pg_catalog.make_interval(hours => (v_stage).due_amount) when (v_stage).due_unit = 'DAYS' then v_now + pg_catalog.make_interval(days => (v_stage).due_amount) else null end,
      version = version + 1, started_at = v_now, updated_at = v_now
     where company_id = p_company_id and id = v_inspection_process_execution_id;
    update public.hotel_inspections set status = 'IN_REVIEW', version = version + 1, updated_at = v_now
     where company_id = p_company_id and id = p_resource_id;
    insert into public.process_execution_history (
      id, company_id, branch_id, execution_id, previous_state, next_state,
      previous_stage_key, next_stage_key, event, reason, actor_user_id
    ) values (
      (p_value ->> 'historyId')::uuid, p_company_id, p_branch_id,
      v_inspection_process_execution_id, 'PENDING_INPUT', 'IN_REVIEW', null,
      (v_stage).stage_key, 'SUBMIT', p_value ->> 'reason', v_actor.user_id
    );
    v_snapshot := public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, p_resource_id);

  else
    select execution.* into v_process_execution
      from public.process_executions execution
     where execution.company_id = p_company_id and execution.branch_id = p_branch_id
       and execution.resource_id = p_resource_id for update;
    if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
    if v_process_execution.state <> 'IN_REVIEW' or v_process_execution.version <> p_expected_version then
      return query select 'VERSION_CONFLICT'::text, null::jsonb; return;
    end if;
    if v_actor.user_id not in (v_process_execution.current_reviewer_user_id, v_process_execution.current_delegate_user_id) then
      return query select 'FORBIDDEN'::text, null::jsonb; return;
    end if;
    select stage.* into v_stage from public.process_stage_snapshots stage
     where stage.company_id = p_company_id and stage.revision_id = v_process_execution.revision_id
       and stage.stage_key = v_process_execution.current_stage_key;
    if p_value ->> 'event' = 'REJECT' then
      update public.process_executions set state = 'PENDING_INPUT', current_stage_key = null,
        current_stage_name = null, current_reviewer_user_id = null,
        current_delegate_user_id = null, current_due_at = null,
        version = version + 1, updated_at = v_now
       where company_id = p_company_id and id = v_process_execution.id;
      update public.hotel_inspections set status = 'PENDING_INPUT', version = version + 1, updated_at = v_now
       where company_id = p_company_id and id = p_resource_id;
    elsif (v_stage).is_final then
      update public.process_executions set state = 'COMPLETED', current_stage_key = null,
        current_stage_name = null, current_reviewer_user_id = null,
        current_delegate_user_id = null, current_due_at = null,
        version = version + 1, completed_at = v_now, updated_at = v_now
       where company_id = p_company_id and id = v_process_execution.id;
      update public.hotel_inspections set status = 'COMPLETED', version = version + 1, updated_at = v_now
       where company_id = p_company_id and id = p_resource_id;
    else
      select transition.* into v_transition
        from public.process_transition_snapshots transition
       where transition.company_id = p_company_id and transition.revision_id = v_process_execution.revision_id
         and transition.from_stage_key = v_process_execution.current_stage_key
         and transition.event = p_value ->> 'event'
         and transition.choice_value is not distinct from p_value ->> 'choiceValue';
      if not found then return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb; return; end if;
      select stage.* into v_stage from public.process_stage_snapshots stage
       where stage.company_id = p_company_id and stage.revision_id = v_process_execution.revision_id
         and stage.stage_key = (v_transition).to_stage_key;
      if not exists (
        select 1 from public.hotel_staff_assignments assignment
         where assignment.company_id = p_company_id and assignment.branch_id = p_branch_id
           and assignment.user_id = (v_stage).reviewer_user_id and assignment.terminated_at is null
           and assignment.start_date <= v_now::date and (assignment.end_date is null or assignment.end_date >= v_now::date)
      ) then return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb; return; end if;
      update public.process_executions set current_stage_key = (v_stage).stage_key,
        current_stage_name = (v_stage).stage_name,
        current_reviewer_user_id = (v_stage).reviewer_user_id,
        current_delegate_user_id = case when (v_stage).delegate_starts_at <= v_now and ((v_stage).delegate_ends_at is null or (v_stage).delegate_ends_at > v_now) then (v_stage).delegate_user_id else null end,
        current_due_at = case when (v_stage).due_unit = 'HOURS' then v_now + pg_catalog.make_interval(hours => (v_stage).due_amount) when (v_stage).due_unit = 'DAYS' then v_now + pg_catalog.make_interval(days => (v_stage).due_amount) else null end,
        version = version + 1, updated_at = v_now
       where company_id = p_company_id and id = v_process_execution.id;
    end if;
    insert into public.process_execution_history (
      id, company_id, branch_id, execution_id, previous_state, next_state,
      previous_stage_key, next_stage_key, event, choice_value, reason, actor_user_id
    ) select (p_value ->> 'historyId')::uuid, p_company_id, p_branch_id,
      v_process_execution.id, 'IN_REVIEW', execution.state, v_process_execution.current_stage_key,
      execution.current_stage_key, p_value ->> 'event', p_value ->> 'choiceValue',
      p_value ->> 'reason', v_actor.user_id
      from public.process_executions execution
     where execution.company_id = p_company_id and execution.id = v_process_execution.id;
    v_snapshot := public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, p_resource_id);
  end if;

  v_effective_resource_id := coalesce(p_resource_id, nullif(v_snapshot ->> 'id', '')::uuid);
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id, 'HOTEL_INSPECTION_' || p_action, v_actor.user_id,
    v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
    case when p_action = 'SAVE_ROUTINE' then 'INSPECTION_ROUTINE' when p_action = 'SAVE_CHECKLIST' then 'INSPECTION_CHECKLIST' else 'HOTEL_INSPECTION' end,
    v_effective_resource_id, pg_catalog.jsonb_build_object('resourceId', v_effective_resource_id),
    coalesce(p_value ->> 'reason', p_value ->> 'changeReason', '점검 업무 처리'),
    'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id, p_idempotency_key,
    p_http_method, p_operation_path, p_request_hash, 'COMPLETED',
    'HOTEL_INSPECTION', v_effective_resource_id, p_audit_event_id, v_snapshot,
    v_now, v_now + interval '24 hours'
  );
  return query select case when p_expected_version = 0 then 'CREATED' else 'UPDATED' end::text, v_snapshot;
exception
  when invalid_text_representation or foreign_key_violation or check_violation then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
  when unique_violation then
    return query select 'DUPLICATE'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_inspection_command_v1(uuid, uuid, uuid, text, integer, jsonb, text, uuid, text, text, text, text, uuid, uuid) from public;

insert into public.schema_migrations(version)
values ('0031_hotel_inspection_execution_contract')
on conflict (version) do nothing;

commit;
