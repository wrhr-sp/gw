begin;

alter table public.inspection_routine_revisions
  add column checklist_revision_id uuid;

update public.inspection_routine_revisions revision
   set checklist_revision_id = (
     select checklist.id
       from public.inspection_checklist_revisions checklist
       join public.inspection_routines routine
         on routine.company_id = revision.company_id
        and routine.id = revision.routine_id
      where checklist.company_id = revision.company_id
        and checklist.branch_id = routine.branch_id
        and checklist.created_at <= revision.created_at
      order by checklist.version desc
      limit 1
   );

do $routine_checklist_backfill$
begin
  if exists (
    select 1 from public.inspection_routine_revisions
     where checklist_revision_id is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'inspection routine checklist revision backfill requires remediation';
  end if;
end
$routine_checklist_backfill$;

alter table public.inspection_routine_revisions
  alter column checklist_revision_id set not null,
  add constraint inspection_routine_revisions_checklist_revision_fk
    foreign key (company_id, checklist_revision_id)
    references public.inspection_checklist_revisions(company_id, id);

create function public.pin_inspection_routine_checklist_revision_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if new.checklist_revision_id is null then
    select checklist.id into new.checklist_revision_id
      from public.inspection_checklist_revisions checklist
      join public.inspection_routines routine
        on routine.company_id = new.company_id
       and routine.id = new.routine_id
     where checklist.company_id = new.company_id
       and checklist.branch_id = routine.branch_id
     order by checklist.version desc
     limit 1;
  end if;
  if new.checklist_revision_id is null then
    raise exception using
      errcode = '23514',
      message = 'inspection checklist revision is required';
  end if;
  return new;
end
$function$;
revoke all on function public.pin_inspection_routine_checklist_revision_v1() from public;

create trigger pin_inspection_routine_checklist_revision_v1
before insert on public.inspection_routine_revisions
for each row execute function public.pin_inspection_routine_checklist_revision_v1();

create function public.inspection_routine_snapshot_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_routine_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select pg_catalog.jsonb_build_object(
    'id', routine.id,
    'hotelId', routine.branch_id,
    'name', routine.name,
    'status', routine.status,
    'version', routine.version,
    'nextDueDate', routine.next_due_date,
    'materializedThroughDate', routine.materialized_through_date,
    'revision', pg_catalog.jsonb_build_object(
      'id', revision.id,
      'version', revision.version,
      'mode', revision.mode,
      'recurrence', pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'type', revision.recurrence_type,
        'dayOfWeek', revision.day_of_week,
        'dayOfMonth', revision.day_of_month,
        'interval', revision.recurrence_interval
      )),
      'startDate', revision.start_date,
      'endDate', revision.end_date,
      'localDueTime', pg_catalog.to_char(revision.local_due_time, 'HH24:MI'),
      'processDefinitionId', revision.process_definition_id,
      'processRevisionId', revision.process_revision_id,
      'checklistRevisionId', revision.checklist_revision_id,
      'rounds', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', round.id,
          'order', round.round_order,
          'target', round.target_value
        ) order by round.round_order)
          from public.inspection_routine_rounds round
         where round.company_id = routine.company_id
           and round.revision_id = revision.id
      ), '[]'::jsonb)
    ),
    'createdAt', pg_catalog.to_char(
      routine.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'updatedAt', pg_catalog.to_char(
      routine.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  )
  from public.inspection_routines routine
  join public.inspection_routine_revisions revision
    on revision.company_id = routine.company_id
   and revision.id = routine.current_revision_id
  where routine.company_id = p_company_id
    and routine.branch_id = p_branch_id
    and routine.id = p_routine_id
$function$;
revoke all on function public.inspection_routine_snapshot_v1(uuid, uuid, uuid) from public;

create function public.hotel_inspection_routines_read_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_routine_id uuid,
  p_session_token text
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_snapshot jsonb;
begin
  if not exists (
    select 1 from public.hotel_command_actor_v1(
      p_company_id,
      p_branch_id,
      p_session_token,
      'HOTEL_INSPECTION_CONFIG',
      true
    )
  ) then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  if p_routine_id is not null then
    v_snapshot := public.inspection_routine_snapshot_v1(
      p_company_id, p_branch_id, p_routine_id
    );
    return query
      select case when v_snapshot is null then 'NOT_FOUND' else 'OK' end::text,
             case when v_snapshot is null then null::jsonb
                  else pg_catalog.jsonb_build_object('routine', v_snapshot) end;
    return;
  end if;

  select pg_catalog.jsonb_build_object(
    'routines', coalesce(pg_catalog.jsonb_agg(
      public.inspection_routine_snapshot_v1(
        p_company_id, p_branch_id, routine.id
      ) order by routine.updated_at desc, routine.id
    ), '[]'::jsonb)
  ) into v_snapshot
    from public.inspection_routines routine
   where routine.company_id = p_company_id
     and routine.branch_id = p_branch_id;
  return query select 'OK'::text, v_snapshot;
end
$function$;
revoke all on function public.hotel_inspection_routines_read_v1(uuid, uuid, uuid, text) from public;

create function public.inspection_routine_target_valid_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_target jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_count integer;
  v_distinct_count integer;
begin
  if pg_catalog.jsonb_typeof(p_target) is distinct from 'object' then
    return false;
  end if;
  if p_target ->> 'type' = 'HOTEL' then
    return p_target = '{"type":"HOTEL"}'::jsonb;
  elsif p_target ->> 'type' = 'FLOOR' then
    if pg_catalog.jsonb_typeof(p_target -> 'floorLabels') is distinct from 'array'
       or pg_catalog.jsonb_array_length(p_target -> 'floorLabels') < 1 then
      return false;
    end if;
    select pg_catalog.count(*), pg_catalog.count(distinct label)
      into v_count, v_distinct_count
      from pg_catalog.jsonb_array_elements_text(p_target -> 'floorLabels') label;
    return v_count = v_distinct_count and not exists (
      select 1
        from pg_catalog.jsonb_array_elements_text(p_target -> 'floorLabels') label
       where pg_catalog.btrim(label) = ''
          or not exists (
            select 1 from public.hotel_rooms room
             where room.company_id = p_company_id
               and room.branch_id = p_branch_id
               and room.status = 'ACTIVE'
               and room.floor_label = label
          )
    );
  elsif p_target ->> 'type' = 'ROOM_TYPE' then
    if pg_catalog.jsonb_typeof(p_target -> 'roomTypeIds') is distinct from 'array'
       or pg_catalog.jsonb_array_length(p_target -> 'roomTypeIds') < 1 then
      return false;
    end if;
    select pg_catalog.count(*), pg_catalog.count(distinct target_id)
      into v_count, v_distinct_count
      from pg_catalog.jsonb_array_elements_text(p_target -> 'roomTypeIds') target_id;
    return v_count = v_distinct_count and not exists (
      select 1
        from pg_catalog.jsonb_array_elements_text(p_target -> 'roomTypeIds') target_id
       where not exists (
         select 1 from public.hotel_room_types room_type
          where room_type.company_id = p_company_id
            and room_type.id = target_id::uuid
            and room_type.is_active
            and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
       )
    );
  elsif p_target ->> 'type' = 'ROOMS' then
    if pg_catalog.jsonb_typeof(p_target -> 'roomIds') is distinct from 'array'
       or pg_catalog.jsonb_array_length(p_target -> 'roomIds') < 1 then
      return false;
    end if;
    select pg_catalog.count(*), pg_catalog.count(distinct target_id)
      into v_count, v_distinct_count
      from pg_catalog.jsonb_array_elements_text(p_target -> 'roomIds') target_id;
    return v_count = v_distinct_count and not exists (
      select 1
        from pg_catalog.jsonb_array_elements_text(p_target -> 'roomIds') target_id
       where not exists (
         select 1 from public.hotel_rooms room
          where room.company_id = p_company_id
            and room.branch_id = p_branch_id
            and room.id = target_id::uuid
            and room.status = 'ACTIVE'
       )
    );
  end if;
  return false;
exception
  when invalid_text_representation then
    return false;
end
$function$;
revoke all on function public.inspection_routine_target_valid_v1(uuid, uuid, jsonb) from public;

create function public.hotel_inspection_routine_command_v1(
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
       or not public.inspection_routine_target_valid_v1(
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
    checklist_revision_id, created_by
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
    v_checklist_revision_id, v_actor.user_id
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

  v_snapshot := public.inspection_routine_snapshot_v1(
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
revoke all on function public.hotel_inspection_routine_command_v1(
  uuid, uuid, uuid, integer, jsonb, text, text, text, text, text,
  uuid, uuid, uuid
) from public;

create or replace function public.hotel_inspection_complete_materialization_v1(
  p_routine_id uuid, p_claim_generation bigint, p_claim_token bytea, p_trace_id uuid
)
returns table (result_status text, created_count integer)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_company_id uuid;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_today date := (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date;
  v_routine public.inspection_routines%rowtype;
  v_revision public.inspection_routine_revisions%rowtype;
  v_business_date date;
  v_from date;
  v_through date;
  v_due boolean;
  v_round_count integer;
  v_round_order integer;
  v_round public.inspection_routine_rounds%rowtype;
  v_occurrence_index integer := 0;
  v_inspection_id uuid;
  v_execution_id uuid;
  v_checklist_revision_id uuid;
  v_created integer := 0;
begin
  if not public.runtime_has_capability('RECONCILER')
     or pg_catalog.octet_length(p_claim_token) <> 32 then
    return query select 'FORBIDDEN'::text, 0; return;
  end if;
  v_company_id := public.reconciler_current_company_id();
  select routine.* into v_routine
    from public.inspection_routines routine
   where routine.company_id = v_company_id and routine.id = p_routine_id
   for update;
  if not found then return query select 'NOT_FOUND'::text, 0; return; end if;
  select revision.* into v_revision
    from public.inspection_routine_revisions revision
   where revision.company_id = v_company_id
     and revision.id = v_routine.current_revision_id;
  if not found then return query select 'NOT_FOUND'::text, 0; return; end if;
  if v_routine.claim_generation <> p_claim_generation
     or v_routine.claim_token_hash <> p_claim_token
     or v_routine.claim_expires_at <= v_now then
    return query select 'STALE_CLAIM'::text, 0; return;
  end if;
  v_checklist_revision_id := v_revision.checklist_revision_id;
  if not exists (
    select 1 from public.inspection_checklist_revisions checklist
     where checklist.company_id = v_company_id
       and checklist.branch_id = v_routine.branch_id
       and checklist.id = v_checklist_revision_id
  ) then return query select 'INSPECTION_CHECKLIST_EMPTY'::text, 0; return; end if;
  if not exists (
    select 1 from public.process_definition_revisions revision
     where revision.company_id = v_company_id and revision.id = v_revision.process_revision_id
  ) then return query select 'PROCESS_DEFAULT_REQUIRED'::text, 0; return; end if;
  select pg_catalog.count(*) into v_round_count
    from public.inspection_routine_rounds round_record
   where round_record.company_id = v_company_id
     and round_record.revision_id = v_revision.id;
  v_from := greatest(
    v_revision.start_date,
    coalesce(v_routine.materialized_through_date + 1, v_revision.start_date),
    v_today - 31
  );
  v_through := least(v_today, coalesce(v_revision.end_date, v_today));

  for v_business_date in select value::date from pg_catalog.generate_series(v_from, v_through, interval '1 day') value loop
    v_due := case v_revision.recurrence_type
      when 'DAILY' then true
      when 'WEEKLY' then extract(isodow from v_business_date)::integer = case v_revision.day_of_week
        when 'MONDAY' then 1 when 'TUESDAY' then 2 when 'WEDNESDAY' then 3
        when 'THURSDAY' then 4 when 'FRIDAY' then 5 when 'SATURDAY' then 6 else 7 end
      when 'MONTHLY' then (
        v_revision.day_of_month <= extract(day from (date_trunc('month', v_business_date) + interval '1 month - 1 day'))
        and extract(day from v_business_date)::integer = v_revision.day_of_month
      )
      when 'INTERVAL_DAYS' then (v_business_date - v_revision.start_date) % v_revision.recurrence_interval = 0
      when 'INTERVAL_WEEKS' then (v_business_date - v_revision.start_date) % (7 * v_revision.recurrence_interval) = 0
      when 'INTERVAL_MONTHS' then
        ((extract(year from v_business_date)::integer * 12 + extract(month from v_business_date)::integer)
         - (extract(year from v_revision.start_date)::integer * 12 + extract(month from v_revision.start_date)::integer))
          % v_revision.recurrence_interval = 0
        and extract(day from v_business_date) = extract(day from v_revision.start_date)
      else false
    end;
    if not v_due then continue; end if;
    v_occurrence_index := v_occurrence_index + 1;
    v_round_order := case when v_revision.mode = 'FIXED' then 1 else ((v_occurrence_index - 1) % v_round_count) + 1 end;
    select round_record.* into v_round
      from public.inspection_routine_rounds round_record
     where round_record.company_id = v_company_id
       and round_record.revision_id = v_revision.id
       and round_record.round_order = v_round_order;
    if not exists (
      select 1 from public.hotel_rooms room
       where room.company_id = v_company_id and room.branch_id = v_routine.branch_id
         and room.status = 'ACTIVE'
         and (
           v_round.target_type = 'HOTEL'
           or (v_round.target_type = 'FLOOR' and room.floor_label in (select value #>> '{}' from pg_catalog.jsonb_array_elements(v_round.target_value -> 'floorLabels')))
           or (v_round.target_type = 'ROOM_TYPE' and room.room_type_id in (select (value #>> '{}')::uuid from pg_catalog.jsonb_array_elements(v_round.target_value -> 'roomTypeIds')))
           or (v_round.target_type = 'ROOMS' and room.id in (select (value #>> '{}')::uuid from pg_catalog.jsonb_array_elements(v_round.target_value -> 'roomIds')))
         )
    ) then continue; end if;
    v_inspection_id := pg_catalog.gen_random_uuid();
    v_execution_id := pg_catalog.gen_random_uuid();
    insert into public.process_executions (
      id, company_id, branch_id, application_type, resource_id,
      definition_id, revision_id, state, created_by
    ) values (
      v_execution_id, v_company_id, v_routine.branch_id, 'ROOM_INSPECTION',
      v_inspection_id, v_revision.process_definition_id,
      v_revision.process_revision_id, 'PENDING_INPUT', null
    );
    insert into public.hotel_inspections (
      id, company_id, branch_id, source, routine_id, routine_revision_id,
      routine_round_order, business_date, due_at, status, process_execution_id,
      created_by
    ) values (
      v_inspection_id, v_company_id, v_routine.branch_id, 'ROUTINE',
      p_routine_id, v_revision.id, v_round_order, v_business_date,
      (v_business_date::timestamp + v_revision.local_due_time) at time zone 'Asia/Seoul',
      'PENDING_INPUT', v_execution_id, null
    ) on conflict do nothing;
    if not found then
      delete from public.process_executions where company_id = v_company_id and id = v_execution_id;
      continue;
    end if;
    insert into public.inspection_item_snapshots (
      id, company_id, branch_id, inspection_id, room_id, source_item_id,
      checklist_revision_id, name, description, is_required, display_order,
      default_severity
    )
    select pg_catalog.gen_random_uuid(), v_company_id, v_routine.branch_id,
           v_inspection_id, room.id, item.source_item_id, v_checklist_revision_id,
           item.name, item.description, item.is_required, item.display_order,
           item.default_severity
      from public.hotel_rooms room
      join public.inspection_checklist_items item
        on item.company_id = room.company_id and item.revision_id = v_checklist_revision_id
     where room.company_id = v_company_id and room.branch_id = v_routine.branch_id
       and room.status = 'ACTIVE'
       and (
         v_round.target_type = 'HOTEL'
         or (v_round.target_type = 'FLOOR' and room.floor_label in (select value #>> '{}' from pg_catalog.jsonb_array_elements(v_round.target_value -> 'floorLabels')))
         or (v_round.target_type = 'ROOM_TYPE' and room.room_type_id in (select (value #>> '{}')::uuid from pg_catalog.jsonb_array_elements(v_round.target_value -> 'roomTypeIds')))
         or (v_round.target_type = 'ROOMS' and room.id in (select (value #>> '{}')::uuid from pg_catalog.jsonb_array_elements(v_round.target_value -> 'roomIds')))
       )
       and (
         (item.source = 'HOTEL_COMMON' and not exists (
           select 1 from public.inspection_checklist_item_exclusions exclusion
            where exclusion.company_id = v_company_id and exclusion.checklist_item_id = item.id
              and exclusion.room_type_id = room.room_type_id
         ))
         or (item.source = 'ROOM_TYPE_ADDED' and item.room_type_id = room.room_type_id)
       );
    v_created := v_created + 1;
  end loop;
  update public.inspection_routines set materialized_through_date = v_through,
    next_due_date = v_through + 1, claim_token_hash = null, claim_expires_at = null,
    updated_at = v_now
   where company_id = v_company_id and id = p_routine_id;
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, result, trace_id
  ) values (
    pg_catalog.gen_random_uuid(), 'HOTEL_INSPECTION_MATERIALIZED', null,
    'SYSTEM', null, v_company_id, v_routine.branch_id,
    'INSPECTION_ROUTINE', p_routine_id,
    pg_catalog.jsonb_build_object('createdCount', v_created, 'throughDate', v_through),
    'SUCCEEDED', p_trace_id
  );
  return query select 'COMPLETED'::text, v_created;
exception
  when unique_violation then
    return query select 'REPLAYED'::text, v_created;
end
$function$;
revoke all on function public.hotel_inspection_complete_materialization_v1(uuid, bigint, bytea, uuid) from public;

insert into public.schema_migrations(version)
values ('0030_hotel_inspection_routine_contract')
on conflict (version) do nothing;

commit;

