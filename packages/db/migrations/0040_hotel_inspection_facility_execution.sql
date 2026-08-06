-- Forward-only FACILITY routine/manual inspection execution.
-- ROOM v1 contracts and functions remain callable and unchanged.

begin;

alter table public.inspection_routines
  add column materialized_occurrence_count bigint not null default 0,
  add column claim_revision_id uuid,
  add constraint inspection_routines_materialized_occurrence_count_check
    check (materialized_occurrence_count >= 0),
  add constraint inspection_routines_claim_revision_fk
    foreign key (company_id, claim_revision_id)
    references public.inspection_routine_revisions(company_id, id);

create function public.inspection_routine_invalidate_claim_v2()
returns trigger
language plpgsql volatile security definer set search_path=pg_catalog
as $function$
begin
  if old.current_revision_id is distinct from new.current_revision_id
     or old.status is distinct from new.status then
    new.claim_generation:=old.claim_generation+1;
    new.claim_token_hash:=pg_catalog.decode(pg_catalog.repeat('00',32),'hex');
    new.claim_expires_at:='-infinity'::timestamptz;
    new.claim_revision_id:=null;
    new.materialized_occurrence_count:=0;
  end if;
  return new;
end
$function$;
revoke all on function public.inspection_routine_invalidate_claim_v2() from public;
create trigger inspection_routine_claim_invalidation
before update of current_revision_id,status on public.inspection_routines
for each row execute function public.inspection_routine_invalidate_claim_v2();

alter table public.inspection_routine_revisions
  add column checklist_v2_revision_id uuid,
  add constraint inspection_routine_revisions_checklist_v2_revision_fk
    foreign key (company_id, checklist_v2_revision_id)
    references public.inspection_checklist_v2_revisions(company_id, id);

alter table public.inspection_routine_rounds
  drop constraint inspection_routine_rounds_target_type_check,
  add constraint inspection_routine_rounds_target_type_check check (
    target_type in (
      'HOTEL','FLOOR','ROOM_TYPE','ROOMS',
      'ROOM_HOTEL','ROOM_FLOORS','ROOM_TYPES',
      'FACILITY_HOTEL','FACILITY_TYPES','FACILITIES'
    )
  );

do $drop_room_constraints$
declare found_constraint record;
begin
  for found_constraint in
    select constraint_row.conname
      from pg_catalog.pg_constraint constraint_row
     where constraint_row.conrelid='public.inspection_item_snapshots'::regclass
       and (
         constraint_row.contype='u'
         and pg_catalog.pg_get_constraintdef(constraint_row.oid)
           = 'UNIQUE (company_id, inspection_id, room_id, source_item_id)'
       )
  loop
    execute pg_catalog.format(
      'alter table public.inspection_item_snapshots drop constraint %I',
      found_constraint.conname
    );
  end loop;
end
$drop_room_constraints$;

alter table public.inspection_item_snapshots
  alter column room_id drop not null,
  alter column room_number_snapshot drop not null,
  alter column floor_label_snapshot drop not null,
  alter column floor_sort_key_snapshot drop not null,
  alter column room_type_name_snapshot drop not null,
  add column facility_id uuid,
  add column checklist_v2_revision_id uuid,
  add column facility_name_snapshot text,
  add column facility_type_name_snapshot text,
  add column facility_location_name_snapshot text,
  add constraint inspection_item_snapshots_facility_fkey
    foreign key (company_id, branch_id, facility_id)
    references public.hotel_facilities(company_id, branch_id, id),
  add constraint inspection_item_snapshots_checklist_v2_revision_fkey
    foreign key (company_id, branch_id, checklist_v2_revision_id)
    references public.inspection_checklist_v2_revisions(company_id, branch_id, id),
  add constraint inspection_item_snapshots_target_exactly_one_check check (
    (room_id is not null and facility_id is null
      and room_number_snapshot is not null
      and floor_label_snapshot is not null
      and floor_sort_key_snapshot is not null
      and room_type_name_snapshot is not null
      and facility_name_snapshot is null
      and facility_type_name_snapshot is null
      and facility_location_name_snapshot is null)
    or
    (room_id is null and facility_id is not null
      and room_number_snapshot is null
      and floor_label_snapshot is null
      and floor_sort_key_snapshot is null
      and room_type_name_snapshot is null
      and facility_name_snapshot is not null
      and facility_type_name_snapshot is not null
      and facility_location_name_snapshot is not null)
  );

create unique index inspection_item_snapshots_room_item_key
  on public.inspection_item_snapshots(company_id, inspection_id, room_id, source_item_id)
  where room_id is not null;
create unique index inspection_item_snapshots_facility_item_key
  on public.inspection_item_snapshots(company_id, inspection_id, facility_id, source_item_id)
  where facility_id is not null;

alter table public.inspection_item_snapshots force row level security;

create function public.inspection_routine_target_valid_v2(
  p_company_id uuid, p_branch_id uuid, p_target jsonb
)
returns boolean
language plpgsql stable security definer set search_path = pg_catalog
as $function$
declare
  v_count integer;
  v_distinct_count integer;
begin
  if pg_catalog.jsonb_typeof(p_target) is distinct from 'object' then return false; end if;
  if p_target ->> 'type' in ('ROOM_HOTEL','FACILITY_HOTEL') then
    return p_target = pg_catalog.jsonb_build_object('type',p_target ->> 'type');
  elsif p_target ->> 'type' = 'ROOM_FLOORS' then
    if pg_catalog.jsonb_typeof(p_target -> 'floorLabels') is distinct from 'array' then return false; end if;
    select pg_catalog.count(*),pg_catalog.count(distinct value) into v_count,v_distinct_count
      from pg_catalog.jsonb_array_elements_text(p_target -> 'floorLabels');
    return v_count between 1 and 100 and v_count=v_distinct_count and not exists (
      select 1 from pg_catalog.jsonb_array_elements_text(p_target -> 'floorLabels') value
       where not exists (select 1 from public.hotel_rooms room where room.company_id=p_company_id and room.branch_id=p_branch_id and room.floor_label=value and room.status='ACTIVE'));
  elsif p_target ->> 'type' in ('ROOM_TYPES','ROOMS','FACILITY_TYPES','FACILITIES') then
    declare
      key_name text := case p_target ->> 'type'
        when 'ROOM_TYPES' then 'roomTypeIds' when 'ROOMS' then 'roomIds'
        when 'FACILITY_TYPES' then 'facilityTypeIds' else 'facilityIds' end;
    begin
      if pg_catalog.jsonb_typeof(p_target -> key_name) is distinct from 'array' then return false; end if;
      select pg_catalog.count(*),pg_catalog.count(distinct value) into v_count,v_distinct_count
        from pg_catalog.jsonb_array_elements_text(p_target -> key_name);
      if v_count not between 1 and 500 or v_count<>v_distinct_count then return false; end if;
      if p_target ->> 'type'='ROOM_TYPES' then
        return not exists (select 1 from pg_catalog.jsonb_array_elements_text(p_target -> key_name) value where not exists (
          select 1 from public.hotel_room_types target where target.company_id=p_company_id and target.id=value::uuid and target.is_active and (target.branch_id is null or target.branch_id=p_branch_id)));
      elsif p_target ->> 'type'='ROOMS' then
        return not exists (select 1 from pg_catalog.jsonb_array_elements_text(p_target -> key_name) value where not exists (
          select 1 from public.hotel_rooms target where target.company_id=p_company_id and target.branch_id=p_branch_id and target.id=value::uuid and target.status='ACTIVE'));
      elsif p_target ->> 'type'='FACILITY_TYPES' then
        return not exists (select 1 from pg_catalog.jsonb_array_elements_text(p_target -> key_name) value where not exists (
          select 1 from public.hotel_facility_types target where target.company_id=p_company_id and target.branch_id=p_branch_id and target.id=value::uuid and target.status='ACTIVE'));
      else
        return not exists (select 1 from pg_catalog.jsonb_array_elements_text(p_target -> key_name) value where not exists (
          select 1 from public.hotel_facilities target join public.hotel_facility_types facility_type on facility_type.company_id=target.company_id and facility_type.branch_id=target.branch_id and facility_type.id=target.facility_type_id
           where target.company_id=p_company_id and target.branch_id=p_branch_id and target.id=value::uuid and target.status='ACTIVE' and facility_type.status='ACTIVE'));
      end if;
    end;
  end if;
  return false;
exception when invalid_text_representation then return false;
end
$function$;
revoke all on function public.inspection_routine_target_valid_v2(uuid,uuid,jsonb) from public;

create function public.inspection_routine_snapshot_v2(p_company_id uuid,p_branch_id uuid,p_routine_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $function$
  select case when snapshot is null then null else pg_catalog.jsonb_set(
    snapshot,'{revision,checklistRevisionId}',pg_catalog.to_jsonb(coalesce(
      revision.checklist_v2_revision_id,
      (select v2.id from public.inspection_checklist_revisions legacy
       join public.inspection_checklist_v2_revisions v2 on v2.company_id=legacy.company_id and v2.branch_id=routine.branch_id and v2.version=legacy.version
       where legacy.company_id=revision.company_id and legacy.id=revision.checklist_revision_id)
    )),true) end
  from public.inspection_routines routine
  join public.inspection_routine_revisions revision on revision.company_id=routine.company_id and revision.id=routine.current_revision_id
  cross join lateral (select public.inspection_routine_snapshot_v1(p_company_id,p_branch_id,p_routine_id) snapshot) source
  where routine.company_id=p_company_id and routine.branch_id=p_branch_id and routine.id=p_routine_id
$function$;
revoke all on function public.inspection_routine_snapshot_v2(uuid,uuid,uuid) from public;

create function public.hotel_inspection_routines_read_v2(p_company_id uuid,p_branch_id uuid,p_routine_id uuid,p_session_token text)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog
as $function$
declare v_snapshot jsonb;
begin
  if not exists (select 1 from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_INSPECTION_CONFIG',true)) then
    return query select 'FORBIDDEN'::text,null::jsonb; return;
  end if;
  if p_routine_id is not null then
    v_snapshot:=public.inspection_routine_snapshot_v2(p_company_id,p_branch_id,p_routine_id);
    return query select case when v_snapshot is null then 'NOT_FOUND' else 'OK' end,
      case when v_snapshot is null then null else pg_catalog.jsonb_build_object('routine',v_snapshot) end; return;
  end if;
  select pg_catalog.jsonb_build_object('routines',coalesce(pg_catalog.jsonb_agg(public.inspection_routine_snapshot_v2(p_company_id,p_branch_id,routine.id) order by routine.updated_at desc),'[]'::jsonb)) into v_snapshot
    from public.inspection_routines routine where routine.company_id=p_company_id and routine.branch_id=p_branch_id;
  return query select 'OK'::text,v_snapshot;
end
$function$;
revoke all on function public.hotel_inspection_routines_read_v2(uuid,uuid,uuid,text) from public;

create function public.hotel_inspection_routine_command_v2(
  p_company_id uuid,
  p_branch_id uuid,
  p_routine_id uuid,
  p_expected_version integer,
  p_value jsonb,
  p_session_token text,
  p_idempotency_key text,
  p_http_method text,
  p_operation_path text,
  p_request_hash text,
  p_idempotency_record_id uuid,
  p_audit_event_id uuid,
  p_trace_id uuid
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor record;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_existing record;
  v_current_version integer;
  v_next_version integer;
  v_revision_id uuid;
  v_checklist_revision_id uuid;
  v_checklist_v2_revision_id uuid;
  v_process_definition_id uuid;
  v_process_revision_id uuid;
  v_round jsonb;
  v_round_number integer := 0;
  v_snapshot jsonb;
begin
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id,
      p_branch_id,
      p_session_token,
      'HOTEL_INSPECTION_CONFIG',
      true
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;
  if p_expected_version < 0
     or pg_catalog.btrim(coalesce(p_idempotency_key, '')) = ''
     or p_http_method not in ('POST', 'PUT')
     or p_operation_path not like '/api/hotels/%/inspection-routines%'
     or pg_catalog.btrim(coalesce(p_request_hash, '')) = '' then
    return query select 'INVALID_TARGET'::text, null::jsonb;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_company_id::text || ':' || v_actor.user_id::text || ':' ||
    p_idempotency_key || ':' || p_http_method || ':' || p_operation_path,
    0
  ));
  delete from public.idempotency_records
   where company_id = p_company_id
     and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key
     and http_method = p_http_method
     and operation_path = p_operation_path
     and expires_at <= v_now;
  select receipt.request_hash, receipt.result_snapshot
    into v_existing
    from public.idempotency_records receipt
   where receipt.company_id = p_company_id
     and receipt.actor_user_id = v_actor.user_id
     and receipt.idempotency_key = p_idempotency_key
     and receipt.http_method = p_http_method
     and receipt.operation_path = p_operation_path
     and receipt.status = 'COMPLETED';
  if found then
    return query select
      case when v_existing.request_hash = p_request_hash
           then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end::text,
      case when v_existing.request_hash = p_request_hash
           then v_existing.result_snapshot else null::jsonb end;
    return;
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_value ->> 'name', ''))) not between 1 and 100
     or coalesce(p_value ->> 'status', '') not in ('ACTIVE', 'INACTIVE')
     or coalesce(p_value ->> 'mode', '') not in ('FIXED', 'ROTATING')
     or pg_catalog.jsonb_typeof(p_value -> 'recurrence') is distinct from 'object'
     or coalesce(p_value -> 'recurrence' ->> 'type', '') not in (
       'DAILY', 'WEEKLY', 'MONTHLY',
       'INTERVAL_DAYS', 'INTERVAL_WEEKS', 'INTERVAL_MONTHS'
     )
     or pg_catalog.jsonb_typeof(p_value -> 'rounds') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_value -> 'rounds') not between 1 and 100
     or (nullif(p_value ->> 'endDate', '')::date is not null
         and nullif(p_value ->> 'endDate', '')::date < (p_value ->> 'startDate')::date) then
    return query select 'INVALID_TARGET'::text, null::jsonb;
    return;
  end if;
  if (p_value ->> 'mode' = 'FIXED'
       and pg_catalog.jsonb_array_length(p_value -> 'rounds') <> 1)
     or (p_value ->> 'mode' = 'ROTATING'
       and pg_catalog.jsonb_array_length(p_value -> 'rounds') < 2) then
    return query select 'INVALID_TARGET'::text, null::jsonb;
    return;
  end if;

  if (p_value -> 'recurrence' ->> 'type' = 'WEEKLY'
      and coalesce(p_value -> 'recurrence' ->> 'dayOfWeek', '') not in (
        'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
        'FRIDAY', 'SATURDAY', 'SUNDAY'
      ))
     or (p_value -> 'recurrence' ->> 'type' = 'MONTHLY'
      and coalesce((p_value -> 'recurrence' ->> 'dayOfMonth')::integer, 0)
          not between 1 and 31)
     or (p_value -> 'recurrence' ->> 'type' = 'INTERVAL_DAYS'
      and coalesce((p_value -> 'recurrence' ->> 'interval')::integer, 0)
          not between 1 and 365)
     or (p_value -> 'recurrence' ->> 'type' = 'INTERVAL_WEEKS'
      and coalesce((p_value -> 'recurrence' ->> 'interval')::integer, 0)
          not between 1 and 52)
     or (p_value -> 'recurrence' ->> 'type' = 'INTERVAL_MONTHS'
      and coalesce((p_value -> 'recurrence' ->> 'interval')::integer, 0)
          not between 1 and 12) then
    return query select 'INVALID_TARGET'::text, null::jsonb;
    return;
  end if;

  select checklist.id into v_checklist_revision_id
    from public.inspection_checklist_revisions checklist
   where checklist.company_id = p_company_id
     and checklist.branch_id = p_branch_id
   order by checklist.version desc
   limit 1;
  if not found then
    return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb;
    return;
  end if;
  select revision.id into v_checklist_v2_revision_id
    from public.inspection_checklist_v2_revisions revision
   where revision.company_id = p_company_id
     and revision.branch_id = p_branch_id
   order by revision.version desc
   limit 1;
  if not found then
    return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb;
    return;
  end if;

  select definition.id, definition.current_revision_id
    into v_process_definition_id, v_process_revision_id
    from public.process_definitions definition
   where definition.company_id = p_company_id
     and definition.id = coalesce(
       nullif(p_value ->> 'processDefinitionId', '')::uuid,
       (
         select default_record.definition_id
           from public.hotel_process_defaults default_record
          where default_record.company_id = p_company_id
            and default_record.branch_id = p_branch_id
            and default_record.application_type = 'ROOM_INSPECTION'
       )
     )
     and definition.application_type = 'ROOM_INSPECTION'
     and (definition.branch_id is null or definition.branch_id = p_branch_id);
  if not found then
    return query select 'PROCESS_DEFAULT_REQUIRED'::text, null::jsonb;
    return;
  end if;

  for v_round in
    select value from pg_catalog.jsonb_array_elements(p_value -> 'rounds')
  loop
    v_round_number := v_round_number + 1;
    if (v_round ->> 'order')::integer <> v_round_number
       or not public.inspection_routine_target_valid_v2(
         p_company_id, p_branch_id, v_round -> 'target'
       ) then
      return query select 'INVALID_TARGET'::text, null::jsonb;
      return;
    end if;
  end loop;

  if p_expected_version = 0 then
    insert into public.inspection_routines (
      id, company_id, branch_id, name, status, next_due_date,
      created_by, updated_by
    ) values (
      p_routine_id, p_company_id, p_branch_id,
      p_value ->> 'name', p_value ->> 'status',
      (p_value ->> 'startDate')::date,
      v_actor.user_id, v_actor.user_id
    );
    v_next_version := 1;
  else
    select routine.version into v_current_version
      from public.inspection_routines routine
     where routine.company_id = p_company_id
       and routine.branch_id = p_branch_id
       and routine.id = p_routine_id
     for update;
    if not found then
      return query select 'NOT_FOUND'::text, null::jsonb;
      return;
    end if;
    if v_current_version <> p_expected_version then
      return query select 'INSPECTION_ROUTINE_VERSION_CONFLICT'::text, null::jsonb;
      return;
    end if;
    update public.inspection_routines routine
       set name = p_value ->> 'name',
           status = p_value ->> 'status',
           next_due_date = greatest(
             coalesce(
               routine.materialized_through_date + 1,
               (p_value ->> 'startDate')::date
             ),
             (p_value ->> 'startDate')::date
           ),
           version = routine.version + 1,
           claim_generation = routine.claim_generation + 1,
           claim_token_hash = null,
           claim_expires_at = null,
           materialized_occurrence_count = 0,
           updated_by = v_actor.user_id,
           updated_at = v_now
     where routine.company_id = p_company_id
       and routine.id = p_routine_id;
    v_next_version := p_expected_version + 1;
  end if;

  v_revision_id := pg_catalog.gen_random_uuid();
  insert into public.inspection_routine_revisions (
    id, company_id, routine_id, version, mode, recurrence_type,
    day_of_week, day_of_month, recurrence_interval, start_date, end_date,
    local_due_time, process_definition_id, process_revision_id,
    checklist_revision_id, checklist_v2_revision_id, created_by
  ) values (
    v_revision_id, p_company_id, p_routine_id, v_next_version,
    p_value ->> 'mode', p_value -> 'recurrence' ->> 'type',
    p_value -> 'recurrence' ->> 'dayOfWeek',
    nullif(p_value -> 'recurrence' ->> 'dayOfMonth', '')::integer,
    nullif(p_value -> 'recurrence' ->> 'interval', '')::integer,
    (p_value ->> 'startDate')::date,
    nullif(p_value ->> 'endDate', '')::date,
    (p_value ->> 'localDueTime')::time,
    v_process_definition_id, v_process_revision_id,
    v_checklist_revision_id, v_checklist_v2_revision_id, v_actor.user_id
  );
  for v_round in
    select value from pg_catalog.jsonb_array_elements(p_value -> 'rounds')
  loop
    insert into public.inspection_routine_rounds (
      id, company_id, revision_id, round_order, target_type, target_value
    ) values (
      pg_catalog.gen_random_uuid(), p_company_id, v_revision_id,
      (v_round ->> 'order')::integer,
      v_round -> 'target' ->> 'type', v_round -> 'target'
    );
  end loop;
  update public.inspection_routines
     set current_revision_id = v_revision_id
   where company_id = p_company_id and id = p_routine_id;

  v_snapshot := public.inspection_routine_snapshot_v2(
    p_company_id, p_branch_id, p_routine_id
  );
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id, 'HOTEL_INSPECTION_SAVE_ROUTINE',
    v_actor.user_id, v_actor.user_type, v_actor.session_id, p_company_id,
    p_branch_id, 'INSPECTION_ROUTINE', p_routine_id,
    pg_catalog.jsonb_build_object('resourceId', p_routine_id, 'version', v_next_version),
    '정기점검 루틴 저장', 'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id,
    p_idempotency_key, p_http_method, p_operation_path, p_request_hash,
    'COMPLETED', 'INSPECTION_ROUTINE', p_routine_id,
    p_audit_event_id, v_snapshot, v_now, v_now + interval '24 hours'
  );
  return query select 'OK'::text, v_snapshot;
exception
  when invalid_text_representation or check_violation or foreign_key_violation
       or unique_violation or not_null_violation then
    return query select 'INVALID_TARGET'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_inspection_routine_command_v2(uuid,uuid,uuid,integer,jsonb,text,text,text,text,text,uuid,uuid,uuid) from public;

create function public.inspection_item_execution_target_capture_v2()
returns trigger language plpgsql volatile security definer set search_path=pg_catalog
as $function$
declare target_record public.inspection_execution_targets%rowtype; room_record record;
begin
  if new.execution_target_id is null then
    if new.room_id is null then raise foreign_key_violation using message='inspection item target is required'; end if;
    select target.* into target_record from public.inspection_execution_targets target
     where target.company_id=new.company_id and target.branch_id=new.branch_id and target.execution_id=new.inspection_id and target.target_type='ROOM' and target.room_id=new.room_id for key share;
    if not found then
      select room.id,room.room_number,room.floor_label,room.floor_sort_key,room_type.name room_type_name into room_record
        from public.hotel_rooms room join public.hotel_room_types room_type on room_type.company_id=room.company_id and room_type.id=room.room_type_id
       where room.company_id=new.company_id and room.branch_id=new.branch_id and room.id=new.room_id for key share of room,room_type;
      if not found then raise foreign_key_violation using message='inspection execution ROOM target is invalid'; end if;
      insert into public.inspection_execution_targets(id,company_id,branch_id,execution_id,target_type,room_id,room_number_snapshot,floor_label_snapshot,floor_sort_key_snapshot,room_type_name_snapshot)
      values(pg_catalog.gen_random_uuid(),new.company_id,new.branch_id,new.inspection_id,'ROOM',new.room_id,room_record.room_number,room_record.floor_label,room_record.floor_sort_key,room_record.room_type_name)
      on conflict(company_id,branch_id,execution_id,room_id) where target_type='ROOM' do nothing returning * into target_record;
      if not found then select target.* into strict target_record from public.inspection_execution_targets target where target.company_id=new.company_id and target.branch_id=new.branch_id and target.execution_id=new.inspection_id and target.target_type='ROOM' and target.room_id=new.room_id; end if;
    end if;
  else
    select target.* into target_record from public.inspection_execution_targets target
     where target.company_id=new.company_id and target.branch_id=new.branch_id and target.execution_id=new.inspection_id and target.id=new.execution_target_id for key share;
    if not found then raise foreign_key_violation using message='inspection item execution target is invalid'; end if;
  end if;
  if target_record.target_type='ROOM' then
    if new.facility_id is not null or (new.room_id is not null and new.room_id<>target_record.room_id) then raise check_violation using message='inspection ROOM target mismatch'; end if;
    new.room_id:=target_record.room_id; new.facility_id:=null;
    new.room_number_snapshot:=target_record.room_number_snapshot; new.floor_label_snapshot:=target_record.floor_label_snapshot;
    new.floor_sort_key_snapshot:=target_record.floor_sort_key_snapshot; new.room_type_name_snapshot:=target_record.room_type_name_snapshot;
    new.facility_name_snapshot:=null; new.facility_type_name_snapshot:=null; new.facility_location_name_snapshot:=null;
  else
    if new.room_id is not null or (new.facility_id is not null and new.facility_id<>target_record.facility_id) then raise check_violation using message='inspection FACILITY target mismatch'; end if;
    new.room_id:=null; new.facility_id:=target_record.facility_id;
    new.room_number_snapshot:=null; new.floor_label_snapshot:=null; new.floor_sort_key_snapshot:=null; new.room_type_name_snapshot:=null;
    new.facility_name_snapshot:=target_record.facility_name_snapshot; new.facility_type_name_snapshot:=target_record.facility_type_name_snapshot;
    new.facility_location_name_snapshot:=target_record.facility_location_name_snapshot;
  end if;
  new.execution_target_id:=target_record.id; return new;
end
$function$;
revoke all on function public.inspection_item_execution_target_capture_v2() from public;

create function public.inspection_execution_snapshot_v2(p_company_id uuid,p_branch_id uuid,p_inspection_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $function$
select pg_catalog.jsonb_build_object(
'id',inspection.id,'hotelId',inspection.branch_id,'source',inspection.source,'businessDate',inspection.business_date,
'dueAt',pg_catalog.to_char(inspection.due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'status',inspection.status,'version',inspection.version,
'process',pg_catalog.jsonb_build_object('executionId',execution.id,'definitionId',execution.definition_id,'revisionId',execution.revision_id,'currentStageKey',execution.current_stage_key,'currentStageName',execution.current_stage_name,'state',execution.state,'version',execution.version),
'targets',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
'id',target.id,'type',target.target_type,'roomId',target.room_id,'roomNumberSnapshot',target.room_number_snapshot,'roomTypeNameSnapshot',target.room_type_name_snapshot,'floorLabelSnapshot',target.floor_label_snapshot,
'facilityId',target.facility_id,'facilityNameSnapshot',target.facility_name_snapshot,'facilityTypeNameSnapshot',target.facility_type_name_snapshot,'facilityLocationNameSnapshot',target.facility_location_name_snapshot)) order by target.created_at,target.id)
from public.inspection_execution_targets target where target.company_id=inspection.company_id and target.branch_id=inspection.branch_id and target.execution_id=inspection.id),'[]'::jsonb),
'items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
'id',item.id,'executionTargetId',item.execution_target_id,'targetType',case when item.room_id is not null then 'ROOM' else 'FACILITY' end,'itemId',item.source_item_id,'name',item.name,'description',item.description,'isRequired',item.is_required,'displayOrder',item.display_order,'defaultSeverity',item.default_severity,
'result',case when result_record.id is null then null else pg_catalog.jsonb_build_object('result',result_record.result,'description',result_record.description,'severity',result_record.severity,'fileVersionIds',coalesce((select pg_catalog.jsonb_agg(link.file_version_id order by link.linked_at) from public.hotel_file_links link where link.company_id=item.company_id and link.result_id=result_record.id and link.result_version=result_record.version),'[]'::jsonb),'version',result_record.version) end) order by item.execution_target_id,item.display_order,item.id)
from public.inspection_item_snapshots item left join public.inspection_item_results result_record on result_record.company_id=item.company_id and result_record.inspection_id=item.inspection_id and result_record.item_snapshot_id=item.id where item.company_id=inspection.company_id and item.inspection_id=inspection.id),'[]'::jsonb),
'createdAt',pg_catalog.to_char(inspection.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',pg_catalog.to_char(inspection.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
from public.hotel_inspections inspection join public.process_executions execution on execution.company_id=inspection.company_id and execution.id=inspection.process_execution_id
where inspection.company_id=p_company_id and inspection.branch_id=p_branch_id and inspection.id=p_inspection_id
$function$;
revoke all on function public.inspection_execution_snapshot_v2(uuid,uuid,uuid) from public;

create function public.hotel_inspection_execution_read_v2(p_company_id uuid,p_branch_id uuid,p_inspection_id uuid,p_query jsonb,p_session_token text)
returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog
as $function$
declare
  v_snapshot jsonb;
  v_inspections jsonb;
  v_total bigint;
  v_page integer:=case when coalesce(p_query->>'page','')~'^[1-9][0-9]*$' then least((p_query->>'page')::numeric,2147483647)::integer else 1 end;
  v_page_size integer:=case when coalesce(p_query->>'pageSize','')~'^[1-9][0-9]*$' then least((p_query->>'pageSize')::numeric,100)::integer else 20 end;
begin
 if not exists(select 1 from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_INSPECTION_RUN',true)) then return query select 'FORBIDDEN'::text,null::jsonb; return; end if;
 if p_inspection_id is not null then v_snapshot:=public.inspection_execution_snapshot_v2(p_company_id,p_branch_id,p_inspection_id); return query select case when v_snapshot is null then 'NOT_FOUND' else 'OK' end,v_snapshot; return; end if;
 select pg_catalog.count(*) into v_total
 from public.hotel_inspections inspection where inspection.company_id=p_company_id and inspection.branch_id=p_branch_id and (p_query->>'source' is null or inspection.source=p_query->>'source') and (p_query->>'status' is null or inspection.status=p_query->>'status');
 select coalesce(pg_catalog.jsonb_agg(public.inspection_execution_snapshot_v2(p_company_id,p_branch_id,page_record.id)-'items' order by page_record.business_date desc,page_record.created_at desc),'[]'::jsonb) into v_inspections
 from (select inspection.id,inspection.business_date,inspection.created_at from public.hotel_inspections inspection where inspection.company_id=p_company_id and inspection.branch_id=p_branch_id and (p_query->>'source' is null or inspection.source=p_query->>'source') and (p_query->>'status' is null or inspection.status=p_query->>'status') order by inspection.business_date desc,inspection.created_at desc,inspection.id desc limit v_page_size offset ((v_page-1)::bigint*v_page_size)) page_record;
 v_snapshot:=pg_catalog.jsonb_build_object('inspections',v_inspections,'pagination',pg_catalog.jsonb_build_object('page',v_page,'pageSize',v_page_size,'total',v_total,'totalPages',case when v_total=0 then 0 else pg_catalog.ceil(v_total::numeric/v_page_size)::integer end));
 return query select 'OK'::text,v_snapshot;
end
$function$;
revoke all on function public.hotel_inspection_execution_read_v2(uuid,uuid,uuid,jsonb,text) from public;

create function public.inspection_submission_nonempty_v2()
returns trigger language plpgsql volatile security definer set search_path=pg_catalog
as $function$
begin
  if new.status='IN_REVIEW' and old.status is distinct from new.status
     and (
       not exists(
         select 1 from public.inspection_item_snapshots item
          where item.company_id=new.company_id and item.inspection_id=new.id
       )
       or exists(
         select 1 from public.inspection_execution_targets target
          where target.company_id=new.company_id and target.execution_id=new.id
            and not exists(
              select 1 from public.inspection_item_snapshots item
               where item.company_id=target.company_id
                 and item.inspection_id=target.execution_id
                 and item.execution_target_id=target.id
            )
       )
     ) then
    raise check_violation using message='inspection submission requires applicable items for every target';
  end if;
  return new;
end
$function$;
revoke all on function public.inspection_submission_nonempty_v2() from public;
create trigger inspection_submission_nonempty
before update of status on public.hotel_inspections
for each row execute function public.inspection_submission_nonempty_v2();

create function public.hotel_inspection_command_v3(
p_company_id uuid,p_branch_id uuid,p_resource_id uuid,p_action text,p_expected_version integer,p_value jsonb,p_session_token text,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_audit_event_id uuid,p_trace_id uuid)
returns table(command_status text,result_snapshot jsonb) language plpgsql volatile security definer set search_path=pg_catalog
as $function$
declare
  v_actor record;
  v_now timestamptz:=pg_catalog.statement_timestamp();
  v_existing record;
  v_delegated record;
  v_definition_id uuid;
  v_process_revision_id uuid;
  v_process_execution_id uuid;
  v_checklist_revision_id uuid;
  v_checklist_v2_revision_id uuid;
  v_target jsonb;
  v_count integer;
  v_target_id uuid;
  v_snapshot jsonb;
  v_business_date date;
begin
 select * into v_actor from public.hotel_command_actor_v1(p_company_id,p_branch_id,p_session_token,'HOTEL_INSPECTION_RUN',true);
 if not found then return query select 'FORBIDDEN'::text,null::jsonb; return; end if;
 if p_action<>'CREATE_MANUAL_V2' then
   if p_action='SUBMIT' and (
     not exists(
       select 1 from public.inspection_item_snapshots item
        where item.company_id=p_company_id and item.inspection_id=p_resource_id
     )
     or exists(
       select 1 from public.inspection_execution_targets target
        where target.company_id=p_company_id and target.execution_id=p_resource_id
          and not exists(
            select 1 from public.inspection_item_snapshots item
             where item.company_id=target.company_id
               and item.inspection_id=target.execution_id
               and item.execution_target_id=target.id
          )
     )
   ) then
     return query select 'INSPECTION_CHECKLIST_EMPTY'::text,null::jsonb;
     return;
   end if;
   select * into v_delegated from public.hotel_inspection_command_v2(
     p_company_id,p_branch_id,p_resource_id,p_action,p_expected_version,p_value,
     p_session_token,p_idempotency_record_id,p_idempotency_key,p_http_method,
     p_operation_path,p_request_hash,p_audit_event_id,p_trace_id
   );
   if v_delegated.result_snapshot is not null
      and exists(
        select 1 from public.hotel_inspections inspection
         where inspection.company_id=p_company_id
           and inspection.branch_id=p_branch_id
           and inspection.id=p_resource_id
      ) then
     v_delegated.result_snapshot:=public.inspection_execution_snapshot_v2(
       p_company_id,p_branch_id,p_resource_id
     );
   end if;
   return query select v_delegated.command_status,v_delegated.result_snapshot;
   return;
 end if;
 if p_expected_version<>0 or p_http_method<>'POST' or p_operation_path not like '/api/hotels/%/inspections/v2/manual' or pg_catalog.btrim(coalesce(p_idempotency_key,''))='' or pg_catalog.btrim(coalesce(p_request_hash,''))='' or pg_catalog.jsonb_typeof(p_value->'targets') is distinct from 'array' or pg_catalog.jsonb_array_length(p_value->'targets') not between 1 and 100 then return query select 'INVALID_TARGET'::text,null::jsonb; return; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text||':'||v_actor.user_id::text||':'||p_idempotency_key||':'||p_http_method||':'||p_operation_path,0));
 delete from public.idempotency_records receipt
  where receipt.company_id=p_company_id
    and receipt.actor_user_id=v_actor.user_id
    and receipt.idempotency_key=p_idempotency_key
    and receipt.http_method=p_http_method
    and receipt.operation_path=p_operation_path
    and receipt.expires_at<=v_now;
 select receipt.request_hash,receipt.result_snapshot into v_existing from public.idempotency_records receipt where receipt.company_id=p_company_id and receipt.actor_user_id=v_actor.user_id and receipt.idempotency_key=p_idempotency_key and receipt.http_method=p_http_method and receipt.operation_path=p_operation_path and receipt.status='COMPLETED';
 if found then return query select case when v_existing.request_hash=p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end,case when v_existing.request_hash=p_request_hash then v_existing.result_snapshot else null end; return; end if;
 select definition.id,definition.current_revision_id into v_definition_id,v_process_revision_id from public.process_definitions definition where definition.company_id=p_company_id and definition.id=coalesce(nullif(p_value->>'processDefinitionId','')::uuid,(select default_record.definition_id from public.hotel_process_defaults default_record where default_record.company_id=p_company_id and default_record.branch_id=p_branch_id and default_record.application_type='ROOM_INSPECTION')) and (definition.branch_id is null or definition.branch_id=p_branch_id); if not found then return query select 'PROCESS_DEFAULT_REQUIRED'::text,null::jsonb; return; end if;
 select revision.id into v_checklist_v2_revision_id from public.inspection_checklist_v2_revisions revision where revision.company_id=p_company_id and revision.branch_id=p_branch_id order by revision.version desc limit 1; if not found then return query select 'INSPECTION_CHECKLIST_EMPTY'::text,null::jsonb; return; end if;
 select legacy.id into v_checklist_revision_id
   from public.inspection_checklist_revisions legacy
   join public.inspection_checklist_v2_revisions v2
     on v2.company_id=legacy.company_id and v2.branch_id=legacy.branch_id
    and v2.version=legacy.version
  where v2.company_id=p_company_id and v2.branch_id=p_branch_id
    and v2.id=v_checklist_v2_revision_id;
 if not found then return query select 'INSPECTION_CHECKLIST_EMPTY'::text,null::jsonb; return; end if;
 for v_target in
   select value from pg_catalog.jsonb_array_elements(p_value->'targets')
    order by value->>'type',coalesce(value->>'roomId',value->>'facilityId')
 loop
  if pg_catalog.jsonb_typeof(v_target->'selectedItemIds') is distinct from 'array'
     or pg_catalog.jsonb_array_length(v_target->'selectedItemIds') not between 1 and 200 then
    return query select 'INVALID_TARGET'::text,null::jsonb; return;
  end if;
  if v_target->>'type'='ROOM' then
   perform room.id from public.hotel_rooms room
   join public.hotel_room_types room_type
     on room_type.company_id=room.company_id and room_type.id=room.room_type_id
   where room.company_id=p_company_id and room.branch_id=p_branch_id
     and room.id=(v_target->>'roomId')::uuid and room.status='ACTIVE'
   for update of room,room_type;
   if not found then return query select 'INVALID_TARGET'::text,null::jsonb; return; end if;
   select pg_catalog.count(*) into v_count from public.inspection_checklist_v2_items item join public.hotel_rooms room on room.company_id=p_company_id and room.branch_id=p_branch_id and room.id=(v_target->>'roomId')::uuid where item.company_id=p_company_id and item.branch_id=p_branch_id and item.revision_id=v_checklist_v2_revision_id and item.target_type='ROOM' and item.source_item_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_target->'selectedItemIds') value) and ((item.source='HOTEL_COMMON' and not exists(select 1 from public.inspection_checklist_v2_item_exclusions exclusion where exclusion.company_id=item.company_id and exclusion.branch_id=item.branch_id and exclusion.checklist_item_id=item.id and exclusion.target_type='ROOM' and exclusion.room_type_id=room.room_type_id)) or (item.source='TARGET_TYPE_ADDED' and item.room_type_id=room.room_type_id));
  elsif v_target->>'type'='FACILITY' then
   perform facility.id from public.hotel_facilities facility
   join public.hotel_facility_types facility_type
     on facility_type.company_id=facility.company_id
    and facility_type.branch_id=facility.branch_id
    and facility_type.id=facility.facility_type_id
   where facility.company_id=p_company_id and facility.branch_id=p_branch_id
     and facility.id=(v_target->>'facilityId')::uuid
     and facility.status='ACTIVE' and facility_type.status='ACTIVE'
   for update of facility,facility_type;
   if not found then return query select 'INVALID_TARGET'::text,null::jsonb; return; end if;
   perform room.id from public.hotel_facilities facility
   join public.hotel_rooms room
     on room.company_id=facility.company_id and room.branch_id=facility.branch_id
    and room.id=facility.room_id
   where facility.company_id=p_company_id and facility.branch_id=p_branch_id
     and facility.id=(v_target->>'facilityId')::uuid
     and facility.location_type='ROOM'
   for share of room;
   if not found and exists(
     select 1 from public.hotel_facilities facility
      where facility.company_id=p_company_id and facility.branch_id=p_branch_id
        and facility.id=(v_target->>'facilityId')::uuid and facility.location_type='ROOM'
   ) then return query select 'INVALID_TARGET'::text,null::jsonb; return; end if;
   perform area.id from public.hotel_facilities facility
   join public.hotel_common_areas area
     on area.company_id=facility.company_id and area.branch_id=facility.branch_id
    and area.id=facility.common_area_id
   where facility.company_id=p_company_id and facility.branch_id=p_branch_id
     and facility.id=(v_target->>'facilityId')::uuid
     and facility.location_type='COMMON_AREA'
   for share of area;
   if not found and exists(
     select 1 from public.hotel_facilities facility
      where facility.company_id=p_company_id and facility.branch_id=p_branch_id
        and facility.id=(v_target->>'facilityId')::uuid and facility.location_type='COMMON_AREA'
   ) then return query select 'INVALID_TARGET'::text,null::jsonb; return; end if;
   select pg_catalog.count(*) into v_count from public.inspection_checklist_v2_items item join public.hotel_facilities facility on facility.company_id=p_company_id and facility.branch_id=p_branch_id and facility.id=(v_target->>'facilityId')::uuid where item.company_id=p_company_id and item.branch_id=p_branch_id and item.revision_id=v_checklist_v2_revision_id and item.target_type='FACILITY' and item.source_item_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_target->'selectedItemIds') value) and ((item.source='HOTEL_COMMON' and not exists(select 1 from public.inspection_checklist_v2_item_exclusions exclusion where exclusion.company_id=item.company_id and exclusion.branch_id=item.branch_id and exclusion.checklist_item_id=item.id and exclusion.target_type='FACILITY' and exclusion.facility_type_id=facility.facility_type_id)) or (item.source='TARGET_TYPE_ADDED' and item.facility_type_id=facility.facility_type_id));
  else return query select 'INVALID_TARGET'::text,null::jsonb; return; end if;
  if pg_catalog.jsonb_typeof(v_target->'selectedItemIds') is distinct from 'array' or v_count<>pg_catalog.jsonb_array_length(v_target->'selectedItemIds') then return query select 'INVALID_TARGET'::text,null::jsonb; return; end if;
 end loop;
 v_business_date:=(v_now at time zone 'Asia/Seoul')::date; v_process_execution_id:=(p_value->>'processExecutionId')::uuid;
 insert into public.process_executions(id,company_id,branch_id,application_type,resource_id,definition_id,revision_id,state,created_by) values(v_process_execution_id,p_company_id,p_branch_id,'ROOM_INSPECTION',p_resource_id,v_definition_id,v_process_revision_id,'PENDING_INPUT',v_actor.user_id);
 insert into public.hotel_inspections(id,company_id,branch_id,source,business_date,due_at,status,process_execution_id,created_by) values(p_resource_id,p_company_id,p_branch_id,'MANUAL',v_business_date,((v_business_date+1)::timestamp at time zone 'Asia/Seoul')-interval '1 millisecond','PENDING_INPUT',v_process_execution_id,v_actor.user_id);
 for v_target in
   select value from pg_catalog.jsonb_array_elements(p_value->'targets')
    order by value->>'type',coalesce(value->>'roomId',value->>'facilityId')
 loop
  v_target_id:=pg_catalog.gen_random_uuid();
  if v_target->>'type'='ROOM' then
   insert into public.inspection_execution_targets(id,company_id,branch_id,execution_id,target_type,room_id,room_number_snapshot,floor_label_snapshot,floor_sort_key_snapshot,room_type_name_snapshot)
   select v_target_id,p_company_id,p_branch_id,p_resource_id,'ROOM',room.id,room.room_number,room.floor_label,room.floor_sort_key,room_type.name from public.hotel_rooms room join public.hotel_room_types room_type on room_type.company_id=room.company_id and room_type.id=room.room_type_id where room.company_id=p_company_id and room.branch_id=p_branch_id and room.id=(v_target->>'roomId')::uuid;
  else
   insert into public.inspection_execution_targets(id,company_id,branch_id,execution_id,target_type,facility_id,facility_name_snapshot,facility_type_id_snapshot,facility_type_name_snapshot,facility_location_type_snapshot,facility_location_room_id_snapshot,facility_location_common_area_id_snapshot,facility_location_name_snapshot)
   select v_target_id,p_company_id,p_branch_id,p_resource_id,'FACILITY',facility.id,facility.name,facility_type.id,facility_type.name,facility.location_type,facility.room_id,facility.common_area_id,case facility.location_type when 'ROOM' then room.room_number else area.name end from public.hotel_facilities facility join public.hotel_facility_types facility_type on facility_type.company_id=facility.company_id and facility_type.branch_id=facility.branch_id and facility_type.id=facility.facility_type_id left join public.hotel_rooms room on room.company_id=facility.company_id and room.branch_id=facility.branch_id and room.id=facility.room_id left join public.hotel_common_areas area on area.company_id=facility.company_id and area.branch_id=facility.branch_id and area.id=facility.common_area_id where facility.company_id=p_company_id and facility.branch_id=p_branch_id and facility.id=(v_target->>'facilityId')::uuid;
  end if;
  if v_target->>'type'='ROOM' then
   insert into public.inspection_item_snapshots(id,company_id,branch_id,inspection_id,room_id,facility_id,execution_target_id,source_item_id,checklist_revision_id,checklist_v2_revision_id,name,description,is_required,display_order,default_severity)
   select pg_catalog.gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,room.id,null,v_target_id,item.source_item_id,v_checklist_revision_id,v_checklist_v2_revision_id,item.name,item.description,item.is_required,item.display_order,item.default_severity
     from public.inspection_checklist_v2_items item
     join public.hotel_rooms room
       on room.company_id=p_company_id and room.branch_id=p_branch_id
      and room.id=(v_target->>'roomId')::uuid
    where item.company_id=p_company_id and item.branch_id=p_branch_id
      and item.revision_id=v_checklist_v2_revision_id and item.target_type='ROOM'
      and item.source_item_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_target->'selectedItemIds') value)
      and (
        (item.source='HOTEL_COMMON' and not exists(
          select 1 from public.inspection_checklist_v2_item_exclusions exclusion
           where exclusion.company_id=item.company_id and exclusion.branch_id=item.branch_id
             and exclusion.checklist_item_id=item.id and exclusion.target_type='ROOM'
             and exclusion.room_type_id=room.room_type_id
        ))
        or (item.source='TARGET_TYPE_ADDED' and item.room_type_id=room.room_type_id)
      );
  else
   insert into public.inspection_item_snapshots(id,company_id,branch_id,inspection_id,room_id,facility_id,execution_target_id,source_item_id,checklist_revision_id,checklist_v2_revision_id,name,description,is_required,display_order,default_severity)
   select pg_catalog.gen_random_uuid(),p_company_id,p_branch_id,p_resource_id,null,facility.id,v_target_id,item.source_item_id,v_checklist_revision_id,v_checklist_v2_revision_id,item.name,item.description,item.is_required,item.display_order,item.default_severity
     from public.inspection_checklist_v2_items item
     join public.hotel_facilities facility
       on facility.company_id=p_company_id and facility.branch_id=p_branch_id
      and facility.id=(v_target->>'facilityId')::uuid
    where item.company_id=p_company_id and item.branch_id=p_branch_id
      and item.revision_id=v_checklist_v2_revision_id and item.target_type='FACILITY'
      and item.source_item_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_target->'selectedItemIds') value)
      and (
        (item.source='HOTEL_COMMON' and not exists(
          select 1 from public.inspection_checklist_v2_item_exclusions exclusion
           where exclusion.company_id=item.company_id and exclusion.branch_id=item.branch_id
             and exclusion.checklist_item_id=item.id and exclusion.target_type='FACILITY'
             and exclusion.facility_type_id=facility.facility_type_id
        ))
        or (item.source='TARGET_TYPE_ADDED' and item.facility_type_id=facility.facility_type_id)
      );
  end if;
  get diagnostics v_count=row_count;
  if v_count is distinct from pg_catalog.jsonb_array_length(v_target->'selectedItemIds') then
    raise check_violation using message='manual inspection applicability changed';
  end if;
 end loop;
 v_snapshot:=public.inspection_execution_snapshot_v2(p_company_id,p_branch_id,p_resource_id);
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_INSPECTION_CREATE_MANUAL',v_actor.user_id,v_actor.user_type,v_actor.session_id,p_company_id,p_branch_id,'HOTEL_INSPECTION',p_resource_id,pg_catalog.jsonb_build_object('targetCount',pg_catalog.jsonb_array_length(p_value->'targets')),'수시점검 생성','SUCCEEDED',p_trace_id);
 insert into public.idempotency_records(id,company_id,actor_user_id,idempotency_key,http_method,operation_path,request_hash,status,resource_type,resource_id,audit_event_id,result_snapshot,completed_at,expires_at) values(p_idempotency_record_id,p_company_id,v_actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'COMPLETED','HOTEL_INSPECTION',p_resource_id,p_audit_event_id,v_snapshot,v_now,v_now+interval '24 hours');
 return query select 'CREATED'::text,v_snapshot;
exception when invalid_text_representation or check_violation or foreign_key_violation or unique_violation or not_null_violation then return query select 'INVALID_TARGET'::text,null::jsonb;
end
$function$;
revoke all on function public.hotel_inspection_command_v3(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from public;

create function public.hotel_inspection_claim_next_materialization_v2(
  p_claim_token bytea,
  p_lease_seconds integer
)
returns table(
  result_status text,
  company_id uuid,
  routine_id uuid,
  claim_generation bigint,
  from_date date,
  through_date date
)
language plpgsql volatile security definer set search_path=pg_catalog
as $function$
declare
  v_now timestamptz:=pg_catalog.statement_timestamp();
  v_today date:=(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date;
  v_routine public.inspection_routines%rowtype;
  v_revision public.inspection_routine_revisions%rowtype;
  v_from date;
  v_through date;
  v_generation bigint;
begin
  if not public.runtime_has_capability('RECONCILER')
     or p_claim_token is null
     or pg_catalog.octet_length(p_claim_token)<>32
     or p_lease_seconds is null
     or p_lease_seconds not between 30 and 900 then
    return query select 'FORBIDDEN'::text,null::uuid,null::uuid,null::bigint,null::date,null::date;
    return;
  end if;
  select routine.* into v_routine
    from public.inspection_routines routine
    join public.inspection_routine_revisions revision
      on revision.company_id=routine.company_id
     and revision.id=routine.current_revision_id
   where routine.status='ACTIVE'
     and routine.next_due_date<=v_today
     and (routine.claim_token_hash is null or routine.claim_expires_at<=v_now)
     and revision.start_date<=v_today
     and greatest(
       revision.start_date,
       coalesce(routine.materialized_through_date+1,revision.start_date),
       v_today-31
     )<=least(v_today,coalesce(revision.end_date,v_today))
   order by routine.next_due_date,routine.company_id,routine.id
   for update of routine skip locked
   limit 1;
  if not found then
    return query select 'NO_WORK'::text,null::uuid,null::uuid,null::bigint,null::date,null::date;
    return;
  end if;
  select revision.* into strict v_revision
    from public.inspection_routine_revisions revision
   where revision.company_id=v_routine.company_id
     and revision.id=v_routine.current_revision_id;
  v_from:=greatest(
    v_revision.start_date,
    coalesce(v_routine.materialized_through_date+1,v_revision.start_date),
    v_today-31
  );
  v_through:=least(v_today,coalesce(v_revision.end_date,v_today));
  update public.inspection_routines routine
     set claim_token_hash=p_claim_token,
         claim_generation=routine.claim_generation+1,
         claim_expires_at=v_now+pg_catalog.make_interval(secs=>p_lease_seconds),
         claim_revision_id=v_revision.id,
         updated_at=v_now
   where routine.company_id=v_routine.company_id and routine.id=v_routine.id
   returning routine.claim_generation into v_generation;
  return query select 'CLAIMED'::text,v_routine.company_id,v_routine.id,v_generation,v_from,v_through;
end
$function$;
revoke all on function public.hotel_inspection_claim_next_materialization_v2(bytea,integer) from public;

create function public.hotel_inspection_complete_materialization_v2(
  p_routine_id uuid,
  p_claim_generation bigint,
  p_claim_token bytea,
  p_trace_id uuid
)
returns table(result_status text,created_count integer)
language plpgsql volatile security definer set search_path=pg_catalog
as $function$
declare
  v_company_id uuid;
  v_now timestamptz:=pg_catalog.statement_timestamp();
  v_today date:=(pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date;
  v_routine public.inspection_routines%rowtype;
  v_revision public.inspection_routine_revisions%rowtype;
  v_business_date date;
  v_from date;
  v_through date;
  v_due boolean;
  v_round_count integer;
  v_round_order integer;
  v_round public.inspection_routine_rounds%rowtype;
  v_occurrence_index bigint:=0;
  v_inspection_id uuid;
  v_process_execution_id uuid;
  v_checklist_revision_id uuid;
  v_legacy_checklist_revision_id uuid;
  v_created integer:=0;
  v_expected_target_count integer:=0;
  v_expected_item_count integer:=0;
  v_inserted_target_count integer:=0;
  v_inserted_item_count integer:=0;
  v_row_count integer:=0;
begin
  if not public.runtime_has_capability('RECONCILER')
     or p_claim_generation is null
     or p_claim_token is null
     or pg_catalog.octet_length(p_claim_token)<>32
     or p_trace_id is null then
    return query select 'FORBIDDEN'::text,0; return;
  end if;
  v_company_id:=public.reconciler_current_company_id();
  select routine.* into v_routine from public.inspection_routines routine
   where routine.company_id=v_company_id and routine.id=p_routine_id for update;
  if not found then return query select 'NOT_FOUND'::text,0; return; end if;
  if v_routine.status is distinct from 'ACTIVE'
     or v_routine.claim_generation is distinct from p_claim_generation
     or v_routine.claim_token_hash is distinct from p_claim_token
     or v_routine.claim_expires_at is null
     or v_routine.claim_expires_at<=v_now
     or v_routine.claim_revision_id is null
     or v_routine.claim_revision_id is distinct from v_routine.current_revision_id then
    return query select 'STALE_CLAIM'::text,0; return;
  end if;
  select revision.* into v_revision from public.inspection_routine_revisions revision
   where revision.company_id=v_company_id and revision.id=v_routine.claim_revision_id;
  if not found then return query select 'STALE_CLAIM'::text,0; return; end if;
  v_occurrence_index:=v_routine.materialized_occurrence_count;
  v_checklist_revision_id:=coalesce(
    v_revision.checklist_v2_revision_id,
    (
      select v2.id
        from public.inspection_checklist_revisions legacy
        join public.inspection_checklist_v2_revisions v2
          on v2.company_id=legacy.company_id
         and v2.branch_id=v_routine.branch_id
         and v2.version=legacy.version
       where legacy.company_id=v_revision.company_id
         and legacy.id=v_revision.checklist_revision_id
    )
  );
  if v_checklist_revision_id is null then
    return query select 'INSPECTION_CHECKLIST_EMPTY'::text,0; return;
  end if;
  select legacy.id into v_legacy_checklist_revision_id
    from public.inspection_checklist_revisions legacy
    join public.inspection_checklist_v2_revisions v2
      on v2.company_id=legacy.company_id and v2.branch_id=legacy.branch_id
     and v2.version=legacy.version
   where v2.company_id=v_company_id and v2.branch_id=v_routine.branch_id
     and v2.id=v_checklist_revision_id;
  if not found then
    return query select 'INSPECTION_CHECKLIST_EMPTY'::text,0; return;
  end if;
  if not exists(
    select 1 from public.process_definition_revisions definition_revision
     where definition_revision.company_id=v_company_id
       and definition_revision.id=v_revision.process_revision_id
  ) then return query select 'PROCESS_DEFAULT_REQUIRED'::text,0; return; end if;
  select pg_catalog.count(*) into v_round_count
    from public.inspection_routine_rounds round_record
   where round_record.company_id=v_company_id
     and round_record.revision_id=v_revision.id;
  v_from:=greatest(
    v_revision.start_date,
    coalesce(v_routine.materialized_through_date+1,v_revision.start_date),
    v_today-31
  );
  v_through:=least(v_today,coalesce(v_revision.end_date,v_today));

  for v_business_date in
    select value::date from pg_catalog.generate_series(v_from,v_through,interval '1 day') value
  loop
    v_due:=case v_revision.recurrence_type
      when 'DAILY' then true
      when 'WEEKLY' then extract(isodow from v_business_date)::integer=case v_revision.day_of_week
        when 'MONDAY' then 1 when 'TUESDAY' then 2 when 'WEDNESDAY' then 3
        when 'THURSDAY' then 4 when 'FRIDAY' then 5 when 'SATURDAY' then 6 else 7 end
      when 'MONTHLY' then v_revision.day_of_month<=extract(day from(date_trunc('month',v_business_date)+interval '1 month - 1 day'))
        and extract(day from v_business_date)::integer=v_revision.day_of_month
      when 'INTERVAL_DAYS' then (v_business_date-v_revision.start_date)%v_revision.recurrence_interval=0
      when 'INTERVAL_WEEKS' then (v_business_date-v_revision.start_date)%(7*v_revision.recurrence_interval)=0
      when 'INTERVAL_MONTHS' then
        ((extract(year from v_business_date)::integer*12+extract(month from v_business_date)::integer)
        -(extract(year from v_revision.start_date)::integer*12+extract(month from v_revision.start_date)::integer))%v_revision.recurrence_interval=0
        and extract(day from v_business_date)=extract(day from v_revision.start_date)
      else false
    end;
    if not v_due then continue; end if;
    v_occurrence_index:=v_occurrence_index+1;
    v_round_order:=case when v_revision.mode='FIXED' then 1 else ((v_occurrence_index-1)%v_round_count)+1 end;
    select round_record.* into v_round from public.inspection_routine_rounds round_record
     where round_record.company_id=v_company_id and round_record.revision_id=v_revision.id and round_record.round_order=v_round_order;

    if v_round.target_type in ('HOTEL','ROOM_HOTEL','FLOOR','ROOM_FLOORS','ROOM_TYPE','ROOM_TYPES','ROOMS') then
      perform room_type.id
        from public.hotel_room_types room_type
       where room_type.company_id=v_company_id
         and room_type.id in (
           select room.room_type_id from public.hotel_rooms room
            where room.company_id=v_company_id and room.branch_id=v_routine.branch_id
              and room.status='ACTIVE'
              and (
                v_round.target_type in ('HOTEL','ROOM_HOTEL')
                or (v_round.target_type in ('FLOOR','ROOM_FLOORS') and room.floor_label in(select value from pg_catalog.jsonb_array_elements_text(v_round.target_value->'floorLabels') value))
                or (v_round.target_type in ('ROOM_TYPE','ROOM_TYPES') and room.room_type_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'roomTypeIds') value))
                or (v_round.target_type='ROOMS' and room.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'roomIds') value))
              )
         )
       order by room_type.id
       for share of room_type;
      perform room.id
        from public.hotel_rooms room
        join public.hotel_room_types room_type
          on room_type.company_id=room.company_id and room_type.id=room.room_type_id
       where room.company_id=v_company_id and room.branch_id=v_routine.branch_id
         and room.status='ACTIVE'
         and (
           v_round.target_type in ('HOTEL','ROOM_HOTEL')
           or (v_round.target_type in ('FLOOR','ROOM_FLOORS') and room.floor_label in(select value from pg_catalog.jsonb_array_elements_text(v_round.target_value->'floorLabels') value))
           or (v_round.target_type in ('ROOM_TYPE','ROOM_TYPES') and room.room_type_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'roomTypeIds') value))
           or (v_round.target_type='ROOMS' and room.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'roomIds') value))
         )
       order by room.id
       for share of room;
      get diagnostics v_expected_target_count = row_count;
      if v_expected_target_count=0 or exists(
        select 1 from public.hotel_rooms room
         where room.company_id=v_company_id and room.branch_id=v_routine.branch_id
           and room.status='ACTIVE'
           and (
             v_round.target_type in ('HOTEL','ROOM_HOTEL')
             or (v_round.target_type in ('FLOOR','ROOM_FLOORS') and room.floor_label in(select value from pg_catalog.jsonb_array_elements_text(v_round.target_value->'floorLabels') value))
             or (v_round.target_type in ('ROOM_TYPE','ROOM_TYPES') and room.room_type_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'roomTypeIds') value))
             or (v_round.target_type='ROOMS' and room.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'roomIds') value))
           )
           and not exists(
             select 1 from public.inspection_checklist_v2_items item
              where item.company_id=v_company_id and item.branch_id=v_routine.branch_id
                and item.revision_id=v_checklist_revision_id and item.target_type='ROOM'
                and (
                  (item.source='HOTEL_COMMON' and not exists(
                    select 1 from public.inspection_checklist_v2_item_exclusions exclusion
                     where exclusion.company_id=item.company_id and exclusion.branch_id=item.branch_id
                       and exclusion.checklist_item_id=item.id and exclusion.target_type='ROOM'
                       and exclusion.room_type_id=room.room_type_id
                  ))
                  or (item.source='TARGET_TYPE_ADDED' and item.room_type_id=room.room_type_id)
                )
           )
      ) then continue; end if;
    else
      perform facility_type.id
        from public.hotel_facility_types facility_type
       where facility_type.company_id=v_company_id and facility_type.branch_id=v_routine.branch_id
         and facility_type.id in (
           select facility.facility_type_id from public.hotel_facilities facility
            where facility.company_id=v_company_id and facility.branch_id=v_routine.branch_id
              and facility.status='ACTIVE'
              and (
                v_round.target_type='FACILITY_HOTEL'
                or (v_round.target_type='FACILITY_TYPES' and facility.facility_type_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityTypeIds') value))
                or (v_round.target_type='FACILITIES' and facility.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityIds') value))
              )
         )
       order by facility_type.id
       for share of facility_type;
      perform facility.id
        from public.hotel_facilities facility
        join public.hotel_facility_types facility_type
          on facility_type.company_id=facility.company_id
         and facility_type.branch_id=facility.branch_id
         and facility_type.id=facility.facility_type_id
       where facility.company_id=v_company_id and facility.branch_id=v_routine.branch_id
         and facility.status='ACTIVE' and facility_type.status='ACTIVE'
         and (
           v_round.target_type='FACILITY_HOTEL'
           or (v_round.target_type='FACILITY_TYPES' and facility.facility_type_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityTypeIds') value))
           or (v_round.target_type='FACILITIES' and facility.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityIds') value))
         )
       order by facility.id
       for share of facility;
      get diagnostics v_expected_target_count = row_count;
      perform room.id
        from public.hotel_rooms room
       where room.company_id=v_company_id and room.branch_id=v_routine.branch_id
         and room.id in (
           select facility.room_id from public.hotel_facilities facility
            where facility.company_id=v_company_id and facility.branch_id=v_routine.branch_id
              and facility.status='ACTIVE' and facility.location_type='ROOM'
              and (
                v_round.target_type='FACILITY_HOTEL'
                or (v_round.target_type='FACILITY_TYPES' and facility.facility_type_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityTypeIds') value))
                or (v_round.target_type='FACILITIES' and facility.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityIds') value))
              )
         )
       order by room.id
       for share of room;
      perform area.id
        from public.hotel_common_areas area
       where area.company_id=v_company_id and area.branch_id=v_routine.branch_id
         and area.id in (
           select facility.common_area_id from public.hotel_facilities facility
            where facility.company_id=v_company_id and facility.branch_id=v_routine.branch_id
              and facility.status='ACTIVE' and facility.location_type='COMMON_AREA'
              and (
                v_round.target_type='FACILITY_HOTEL'
                or (v_round.target_type='FACILITY_TYPES' and facility.facility_type_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityTypeIds') value))
                or (v_round.target_type='FACILITIES' and facility.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityIds') value))
              )
         )
       order by area.id
       for share of area;
      if v_expected_target_count=0 or exists(
        select 1 from public.hotel_facilities facility
        join public.hotel_facility_types facility_type
          on facility_type.company_id=facility.company_id
         and facility_type.branch_id=facility.branch_id
         and facility_type.id=facility.facility_type_id
         where facility.company_id=v_company_id and facility.branch_id=v_routine.branch_id
           and facility.status='ACTIVE' and facility_type.status='ACTIVE'
           and (
             v_round.target_type='FACILITY_HOTEL'
             or (v_round.target_type='FACILITY_TYPES' and facility.facility_type_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityTypeIds') value))
             or (v_round.target_type='FACILITIES' and facility.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityIds') value))
           )
           and not exists(
             select 1 from public.inspection_checklist_v2_items item
              where item.company_id=v_company_id and item.branch_id=v_routine.branch_id
                and item.revision_id=v_checklist_revision_id and item.target_type='FACILITY'
                and (
                  (item.source='HOTEL_COMMON' and not exists(
                    select 1 from public.inspection_checklist_v2_item_exclusions exclusion
                     where exclusion.company_id=item.company_id and exclusion.branch_id=item.branch_id
                       and exclusion.checklist_item_id=item.id and exclusion.target_type='FACILITY'
                       and exclusion.facility_type_id=facility.facility_type_id
                  ))
                  or (item.source='TARGET_TYPE_ADDED' and item.facility_type_id=facility.facility_type_id)
                )
           )
      ) then continue; end if;
    end if;

    v_inspection_id:=pg_catalog.gen_random_uuid();
    v_process_execution_id:=pg_catalog.gen_random_uuid();
    insert into public.process_executions(
      id,company_id,branch_id,application_type,resource_id,
      definition_id,revision_id,state,created_by
    ) values(
      v_process_execution_id,v_company_id,v_routine.branch_id,'ROOM_INSPECTION',
      v_inspection_id,v_revision.process_definition_id,v_revision.process_revision_id,
      'PENDING_INPUT',null
    );
    insert into public.hotel_inspections(
      id,company_id,branch_id,source,routine_id,routine_revision_id,
      routine_round_order,business_date,due_at,status,process_execution_id,created_by
    ) values(
      v_inspection_id,v_company_id,v_routine.branch_id,'ROUTINE',p_routine_id,
      v_revision.id,v_round_order,v_business_date,
      (v_business_date::timestamp+v_revision.local_due_time) at time zone 'Asia/Seoul',
      'PENDING_INPUT',v_process_execution_id,null
    ) on conflict do nothing;
    if not found then
      delete from public.process_executions where company_id=v_company_id and id=v_process_execution_id;
      continue;
    end if;

    v_inserted_target_count:=0;
    insert into public.inspection_execution_targets(
      id,company_id,branch_id,execution_id,target_type,room_id,
      room_number_snapshot,floor_label_snapshot,floor_sort_key_snapshot,
      room_type_name_snapshot
    )
    select pg_catalog.gen_random_uuid(),v_company_id,v_routine.branch_id,
      v_inspection_id,'ROOM',room.id,room.room_number,room.floor_label,
      room.floor_sort_key,room_type.name
    from public.hotel_rooms room
    join public.hotel_room_types room_type on room_type.company_id=room.company_id and room_type.id=room.room_type_id
    where room.company_id=v_company_id and room.branch_id=v_routine.branch_id and room.status='ACTIVE'
      and (
        v_round.target_type in ('HOTEL','ROOM_HOTEL')
        or (v_round.target_type in ('FLOOR','ROOM_FLOORS') and room.floor_label in(select value from pg_catalog.jsonb_array_elements_text(v_round.target_value->'floorLabels') value))
        or (v_round.target_type in ('ROOM_TYPE','ROOM_TYPES') and room.room_type_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'roomTypeIds') value))
        or (v_round.target_type='ROOMS' and room.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'roomIds') value))
      );
    get diagnostics v_row_count = row_count;
    v_inserted_target_count:=v_inserted_target_count+v_row_count;

    insert into public.inspection_execution_targets(
      id,company_id,branch_id,execution_id,target_type,facility_id,
      facility_name_snapshot,facility_type_id_snapshot,facility_type_name_snapshot,
      facility_location_type_snapshot,facility_location_room_id_snapshot,
      facility_location_common_area_id_snapshot,facility_location_name_snapshot
    )
    select pg_catalog.gen_random_uuid(),v_company_id,v_routine.branch_id,
      v_inspection_id,'FACILITY',facility.id,facility.name,facility_type.id,
      facility_type.name,facility.location_type,facility.room_id,facility.common_area_id,
      case facility.location_type when 'ROOM' then room.room_number else area.name end
    from public.hotel_facilities facility
    join public.hotel_facility_types facility_type on facility_type.company_id=facility.company_id and facility_type.branch_id=facility.branch_id and facility_type.id=facility.facility_type_id
    left join public.hotel_rooms room on room.company_id=facility.company_id and room.branch_id=facility.branch_id and room.id=facility.room_id
    left join public.hotel_common_areas area on area.company_id=facility.company_id and area.branch_id=facility.branch_id and area.id=facility.common_area_id
    where facility.company_id=v_company_id and facility.branch_id=v_routine.branch_id
      and facility.status='ACTIVE' and facility_type.status='ACTIVE'
      and (
        v_round.target_type='FACILITY_HOTEL'
        or (v_round.target_type='FACILITY_TYPES' and facility.facility_type_id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityTypeIds') value))
        or (v_round.target_type='FACILITIES' and facility.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(v_round.target_value->'facilityIds') value))
      );
    get diagnostics v_row_count = row_count;
    v_inserted_target_count:=v_inserted_target_count+v_row_count;
    if v_inserted_target_count<>v_expected_target_count then
      raise check_violation using message='inspection materialization target snapshot cardinality changed';
    end if;

    select pg_catalog.count(*) into v_expected_item_count
    from public.inspection_execution_targets target
    join public.inspection_checklist_v2_items item
      on item.company_id=target.company_id and item.branch_id=target.branch_id
     and item.revision_id=v_checklist_revision_id and item.target_type=target.target_type
    left join public.hotel_rooms target_room
      on target_room.company_id=target.company_id and target_room.branch_id=target.branch_id and target_room.id=target.room_id
    left join public.hotel_facilities target_facility
      on target_facility.company_id=target.company_id and target_facility.branch_id=target.branch_id and target_facility.id=target.facility_id
    where target.company_id=v_company_id and target.branch_id=v_routine.branch_id
      and target.execution_id=v_inspection_id
      and (
        (target.target_type='ROOM' and (
          (item.source='HOTEL_COMMON' and not exists(
            select 1 from public.inspection_checklist_v2_item_exclusions exclusion
             where exclusion.company_id=item.company_id and exclusion.branch_id=item.branch_id
               and exclusion.checklist_item_id=item.id and exclusion.target_type='ROOM'
               and exclusion.room_type_id=target_room.room_type_id
          )) or (item.source='TARGET_TYPE_ADDED' and item.room_type_id=target_room.room_type_id)
        ))
        or
        (target.target_type='FACILITY' and (
          (item.source='HOTEL_COMMON' and not exists(
            select 1 from public.inspection_checklist_v2_item_exclusions exclusion
             where exclusion.company_id=item.company_id and exclusion.branch_id=item.branch_id
               and exclusion.checklist_item_id=item.id and exclusion.target_type='FACILITY'
               and exclusion.facility_type_id=target_facility.facility_type_id
          )) or (item.source='TARGET_TYPE_ADDED' and item.facility_type_id=target_facility.facility_type_id)
        ))
      );

    insert into public.inspection_item_snapshots(
      id,company_id,branch_id,inspection_id,room_id,facility_id,
      execution_target_id,source_item_id,checklist_revision_id,
      checklist_v2_revision_id,name,
      description,is_required,display_order,default_severity
    )
    select pg_catalog.gen_random_uuid(),target.company_id,target.branch_id,
      target.execution_id,target.room_id,target.facility_id,target.id,item.source_item_id,
      v_legacy_checklist_revision_id,v_checklist_revision_id,
      item.name,item.description,item.is_required,
      item.display_order,item.default_severity
    from public.inspection_execution_targets target
    join public.inspection_checklist_v2_items item
      on item.company_id=target.company_id and item.branch_id=target.branch_id
     and item.revision_id=v_checklist_revision_id and item.target_type=target.target_type
    left join public.hotel_rooms target_room
      on target_room.company_id=target.company_id and target_room.branch_id=target.branch_id and target_room.id=target.room_id
    left join public.hotel_facilities target_facility
      on target_facility.company_id=target.company_id and target_facility.branch_id=target.branch_id and target_facility.id=target.facility_id
    where target.company_id=v_company_id and target.branch_id=v_routine.branch_id
      and target.execution_id=v_inspection_id
      and (
        (target.target_type='ROOM' and (
          (item.source='HOTEL_COMMON' and not exists(
            select 1 from public.inspection_checklist_v2_item_exclusions exclusion
             where exclusion.company_id=item.company_id and exclusion.branch_id=item.branch_id
               and exclusion.checklist_item_id=item.id and exclusion.target_type='ROOM'
               and exclusion.room_type_id=target_room.room_type_id
          )) or (item.source='TARGET_TYPE_ADDED' and item.room_type_id=target_room.room_type_id)
        ))
        or
        (target.target_type='FACILITY' and (
          (item.source='HOTEL_COMMON' and not exists(
            select 1 from public.inspection_checklist_v2_item_exclusions exclusion
             where exclusion.company_id=item.company_id and exclusion.branch_id=item.branch_id
               and exclusion.checklist_item_id=item.id and exclusion.target_type='FACILITY'
               and exclusion.facility_type_id=target_facility.facility_type_id
          )) or (item.source='TARGET_TYPE_ADDED' and item.facility_type_id=target_facility.facility_type_id)
        ))
      );
    get diagnostics v_inserted_item_count = row_count;
    if v_inserted_item_count<>v_expected_item_count or v_inserted_item_count=0 then
      raise check_violation using message='inspection materialization item snapshot cardinality changed';
    end if;
    v_created:=v_created+1;
  end loop;

  update public.inspection_routines
     set materialized_through_date=v_through,next_due_date=v_through+1,
         materialized_occurrence_count=v_occurrence_index,
         claim_token_hash=null,claim_expires_at=null,claim_revision_id=null,
         updated_at=v_now
   where company_id=v_company_id and id=p_routine_id;
  insert into public.audit_events(
    id,event_code,actor_user_id,actor_type,session_id,company_id,
    branch_id,resource_type,resource_id,after_summary,result,trace_id
  ) values(
    pg_catalog.gen_random_uuid(),'HOTEL_INSPECTION_MATERIALIZED',null,'SYSTEM',null,
    v_company_id,v_routine.branch_id,'INSPECTION_ROUTINE',p_routine_id,
    pg_catalog.jsonb_build_object('createdCount',v_created,'throughDate',v_through),
    'SUCCEEDED',p_trace_id
  );
  return query select 'COMPLETED'::text,v_created;
exception when unique_violation then
  return query select 'REPLAYED'::text,v_created;
end
$function$;
revoke all on function public.hotel_inspection_complete_materialization_v2(uuid,bigint,bytea,uuid) from public;

revoke all on table public.inspection_execution_targets from public;
revoke all on table public.inspection_item_snapshots from public;

-- Provisioning/readiness promotes v2 runtime capabilities only after this marker.
insert into public.schema_migrations(version)
values('0040_hotel_inspection_facility_execution')
on conflict(version) do nothing;
commit;
