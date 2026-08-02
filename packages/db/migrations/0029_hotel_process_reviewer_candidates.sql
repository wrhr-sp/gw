begin;

create or replace function public.hotel_process_reviewer_candidates_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_session_token text
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor record;
  v_snapshot jsonb;
begin
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id, p_branch_id, p_session_token,
      'PROCESS_DEFINITION_MANAGE', true
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  select pg_catalog.jsonb_build_object(
    'candidates', coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', candidate.id,
        'displayName', candidate.display_name
      ) order by pg_catalog.lower(candidate.display_name), candidate.id
    ), '[]'::jsonb)
  ) into v_snapshot
    from (
      select distinct app_user.id, app_user.display_name
        from public.users app_user
        join public.hotel_staff_assignments assignment
          on assignment.company_id = app_user.company_id
         and assignment.user_id = app_user.id
       where app_user.company_id = p_company_id
         and app_user.status = 'ACTIVE'
         and app_user.user_type = 'INTERNAL_STAFF'
         and assignment.branch_id = p_branch_id
         and assignment.terminated_at is null
         and assignment.start_date <= pg_catalog.statement_timestamp()::date
         and (assignment.end_date is null
              or assignment.end_date >= pg_catalog.statement_timestamp()::date)
    ) candidate;

  return query select 'OK'::text, v_snapshot;
end
$function$;

revoke all on function public.hotel_process_reviewer_candidates_v1(uuid, uuid, text) from public;

create or replace function public.hotel_process_command_v1(
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
  v_definition_id uuid;
  v_current_revision_id uuid;
  v_current_version integer;
  v_revision_id uuid;
  v_snapshot jsonb;
  v_scope text;
  v_target_branch_id uuid;
  v_stage jsonb;
  v_transition jsonb;
  v_next_version integer;
  v_reachable_count integer;
  v_has_cycle boolean;
begin
  if p_action not in ('SAVE_DEFINITION', 'SET_DEFAULT', 'LIST_DEFINITIONS', 'READ_DEFAULT') then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  v_scope := coalesce(p_value ->> 'scope', 'HOTEL');
  v_target_branch_id := case
    when p_action = 'SAVE_DEFINITION' and v_scope = 'COMPANY' then null
    else p_branch_id
  end;
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id, v_target_branch_id, p_session_token,
      'PROCESS_DEFINITION_MANAGE', v_target_branch_id is not null
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  if p_action = 'LIST_DEFINITIONS' then
    select pg_catalog.jsonb_build_object(
      'definitions', coalesce(pg_catalog.jsonb_agg(
        public.process_definition_snapshot_v1(p_company_id, definition.id)
        order by definition.updated_at desc
      ), '[]'::jsonb)
    ) into v_snapshot
      from public.process_definitions definition
     where definition.company_id = p_company_id
       and (definition.branch_id is null or definition.branch_id = p_branch_id);
    return query select 'OK'::text, v_snapshot;
    return;
  end if;

  if p_action = 'READ_DEFAULT' then
    select public.process_definition_snapshot_v1(p_company_id, default_record.definition_id)
      into v_snapshot
      from public.hotel_process_defaults default_record
     where default_record.company_id = p_company_id
       and default_record.branch_id = p_branch_id
       and default_record.application_type = 'ROOM_INSPECTION';
    if not found then
      return query select 'PROCESS_DEFAULT_REQUIRED'::text, null::jsonb;
    else
      return query select 'OK'::text, v_snapshot;
    end if;
    return;
  end if;

  if pg_catalog.btrim(coalesce(p_idempotency_key, '')) = ''
     or p_http_method not in ('POST', 'PUT')
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
   where company_id = p_company_id
     and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key
     and http_method = p_http_method
     and operation_path = p_operation_path
     and expires_at <= v_now;
  select idempotency.request_hash, idempotency.result_snapshot into v_existing
    from public.idempotency_records idempotency
   where company_id = p_company_id
     and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key
     and http_method = p_http_method
     and operation_path = p_operation_path
     and status = 'COMPLETED';
  if found then
    return query select
      case when v_existing.request_hash = p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end::text,
      case when v_existing.request_hash = p_request_hash then v_existing.result_snapshot else null::jsonb end;
    return;
  end if;

  if p_action = 'SAVE_DEFINITION' then
    if v_scope not in ('COMPANY', 'HOTEL')
       or (v_scope = 'COMPANY' and p_branch_id is not null)
       or (v_scope = 'HOTEL' and p_branch_id is null)
       or p_value ->> 'applicationType' <> 'ROOM_INSPECTION'
       or pg_catalog.btrim(coalesce(p_value ->> 'name', '')) = ''
       or pg_catalog.jsonb_typeof(p_value -> 'stages') <> 'array'
       or pg_catalog.jsonb_array_length(p_value -> 'stages') < 1
       or pg_catalog.jsonb_typeof(p_value -> 'transitions') <> 'array'
       or coalesce(p_value ->> 'startStageKey', '') !~ '^[A-Z][A-Z0-9_]{0,39}$'
       or (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(p_value -> 'stages') item where (item ->> 'isFinal')::boolean) <> 1
       or not exists (
         select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') item
          where item ->> 'key' = p_value ->> 'startStageKey'
       ) then
      return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
      return;
    end if;
    if exists (
      select 1
        from pg_catalog.jsonb_array_elements(p_value -> 'stages') item
       where coalesce(item ->> 'key', '') !~ '^[A-Z][A-Z0-9_]{0,39}$'
          or not exists (
            select 1 from public.users app_user
             where app_user.company_id = p_company_id
               and app_user.id = (item ->> 'reviewerUserId')::uuid
               and app_user.status = 'ACTIVE'
               and app_user.user_type = 'INTERNAL_STAFF'
               and (
                 v_scope = 'COMPANY'
                 or exists (
                   select 1 from public.hotel_staff_assignments assignment
                    where assignment.company_id = p_company_id
                      and assignment.branch_id = p_branch_id
                      and assignment.user_id = app_user.id
                      and assignment.terminated_at is null
                      and assignment.start_date <= v_now::date
                      and (assignment.end_date is null or assignment.end_date >= v_now::date)
                 )
               )
          )
          or (
            item -> 'delegate' <> 'null'::jsonb
            and not exists (
              select 1 from public.users delegate_user
               where delegate_user.company_id = p_company_id
                 and delegate_user.id = (item -> 'delegate' ->> 'userId')::uuid
                 and delegate_user.status = 'ACTIVE'
                 and delegate_user.user_type = 'INTERNAL_STAFF'
                 and (
                   v_scope = 'COMPANY'
                   or exists (
                     select 1 from public.hotel_staff_assignments assignment
                      where assignment.company_id = p_company_id
                        and assignment.branch_id = p_branch_id
                        and assignment.user_id = delegate_user.id
                        and assignment.terminated_at is null
                        and assignment.start_date <= v_now::date
                        and (assignment.end_date is null or assignment.end_date >= v_now::date)
                   )
                 )
            )
          )
    ) then
      return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb;
      return;
    end if;
    if exists (
      select 1
        from pg_catalog.jsonb_array_elements(p_value -> 'transitions') edge
       where edge ->> 'fromStageKey' = edge ->> 'toStageKey'
          or not exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage where stage ->> 'key' = edge ->> 'fromStageKey')
          or not exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage where stage ->> 'key' = edge ->> 'toStageKey')
          or exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage where stage ->> 'key' = edge ->> 'fromStageKey' and (stage ->> 'isFinal')::boolean)
    ) or exists (
      select 1
        from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage
       where not (stage ->> 'isFinal')::boolean
         and not exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'transitions') edge where edge ->> 'fromStageKey' = stage ->> 'key')
    ) then
      return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
      return;
    end if;
    with recursive reachable(stage_key, path, cyclic) as (
      select p_value ->> 'startStageKey', array[p_value ->> 'startStageKey'], false
      union all
      select edge ->> 'toStageKey', reachable.path || (edge ->> 'toStageKey'),
             (edge ->> 'toStageKey') = any(reachable.path)
        from reachable
        join lateral pg_catalog.jsonb_array_elements(p_value -> 'transitions') edge
          on edge ->> 'fromStageKey' = reachable.stage_key
       where not reachable.cyclic
    )
    select pg_catalog.count(distinct stage_key), pg_catalog.bool_or(cyclic)
      into v_reachable_count, v_has_cycle
      from reachable;
    if v_reachable_count <> pg_catalog.jsonb_array_length(p_value -> 'stages')
       or coalesce(v_has_cycle, false) then
      return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
      return;
    end if;

    if p_expected_version = 0 then
      insert into public.process_definitions (
        id, company_id, branch_id, application_type, scope, name,
        created_by, updated_by
      ) values (
        p_resource_id, p_company_id, p_branch_id, 'ROOM_INSPECTION', v_scope,
        p_value ->> 'name', v_actor.user_id, v_actor.user_id
      );
      v_next_version := 1;
    else
      select definition.version into v_current_version
        from public.process_definitions definition
       where definition.company_id = p_company_id
         and definition.id = p_resource_id
       for update;
      if not found then
        return query select 'NOT_FOUND'::text, null::jsonb;
        return;
      end if;
      if v_current_version <> p_expected_version then
        return query select 'PROCESS_VERSION_CONFLICT'::text, null::jsonb;
        return;
      end if;
      update public.process_definitions
         set name = p_value ->> 'name', version = version + 1,
             updated_by = v_actor.user_id, updated_at = v_now
       where company_id = p_company_id and id = p_resource_id;
      v_next_version := p_expected_version + 1;
    end if;
    v_revision_id := (p_value ->> 'revisionId')::uuid;
    insert into public.process_definition_revisions (
      id, company_id, definition_id, version, start_stage_key, reason, created_by
    ) values (
      v_revision_id, p_company_id, p_resource_id, v_next_version,
      p_value ->> 'startStageKey', '프로세스 설정 저장', v_actor.user_id
    );
    for v_stage in select * from pg_catalog.jsonb_array_elements(p_value -> 'stages') loop
      insert into public.process_stage_snapshots (
        id, company_id, revision_id, stage_key, stage_name, reviewer_user_id,
        delegate_user_id, delegate_starts_at, delegate_ends_at,
        due_amount, due_unit, is_final
      ) values (
        (v_stage ->> 'id')::uuid, p_company_id, v_revision_id,
        v_stage ->> 'key', v_stage ->> 'name', (v_stage ->> 'reviewerUserId')::uuid,
        case when v_stage -> 'delegate' = 'null'::jsonb then null else (v_stage -> 'delegate' ->> 'userId')::uuid end,
        case when v_stage -> 'delegate' = 'null'::jsonb then null else (v_stage -> 'delegate' ->> 'startsAt')::timestamptz end,
        case when v_stage -> 'delegate' = 'null'::jsonb or v_stage -> 'delegate' ->> 'endsAt' is null then null else (v_stage -> 'delegate' ->> 'endsAt')::timestamptz end,
        case when v_stage -> 'due' = 'null'::jsonb then null else (v_stage -> 'due' ->> 'amount')::integer end,
        case when v_stage -> 'due' = 'null'::jsonb then null else v_stage -> 'due' ->> 'unit' end,
        (v_stage ->> 'isFinal')::boolean
      );
    end loop;
    for v_transition in select * from pg_catalog.jsonb_array_elements(p_value -> 'transitions') loop
      insert into public.process_transition_snapshots (
        id, company_id, revision_id, from_stage_key, event, choice_value, to_stage_key
      ) values (
        (v_transition ->> 'id')::uuid, p_company_id, v_revision_id,
        v_transition ->> 'fromStageKey', v_transition ->> 'event',
        v_transition ->> 'choiceValue', v_transition ->> 'toStageKey'
      );
    end loop;
    update public.process_definitions
       set current_revision_id = v_revision_id
     where company_id = p_company_id and id = p_resource_id;
    v_snapshot := public.process_definition_snapshot_v1(p_company_id, p_resource_id);
  else
    select definition.id, definition.current_revision_id
      into v_definition_id, v_current_revision_id
      from public.process_definitions definition
     where definition.company_id = p_company_id
       and definition.id = (p_value ->> 'processDefinitionId')::uuid
       and (definition.branch_id is null or definition.branch_id = p_branch_id)
     for share;
    if not found then
      return query select 'NOT_FOUND'::text, null::jsonb;
      return;
    end if;
    if exists (
      select 1 from public.process_stage_snapshots stage
       where stage.company_id = p_company_id
         and stage.revision_id = v_current_revision_id
         and (
           not exists (
             select 1 from public.hotel_staff_assignments assignment
              where assignment.company_id = p_company_id
                and assignment.branch_id = p_branch_id
                and assignment.user_id = stage.reviewer_user_id
                and assignment.terminated_at is null
                and assignment.start_date <= v_now::date
                and (assignment.end_date is null or assignment.end_date >= v_now::date)
           )
           or (
             stage.delegate_user_id is not null
             and not exists (
               select 1 from public.hotel_staff_assignments assignment
                where assignment.company_id = p_company_id
                  and assignment.branch_id = p_branch_id
                  and assignment.user_id = stage.delegate_user_id
                  and assignment.terminated_at is null
                  and assignment.start_date <= v_now::date
                  and (assignment.end_date is null or assignment.end_date >= v_now::date)
             )
           )
         )
    ) then
      return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb;
      return;
    end if;
    insert into public.hotel_process_defaults (
      company_id, branch_id, application_type, definition_id, revision_id,
      version, updated_by, updated_at
    ) values (
      p_company_id, p_branch_id, 'ROOM_INSPECTION', v_definition_id,
      v_current_revision_id, 1, v_actor.user_id, v_now
    )
    on conflict (company_id, branch_id, application_type) do update
      set definition_id = excluded.definition_id,
          revision_id = excluded.revision_id,
          version = hotel_process_defaults.version + 1,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at
      where hotel_process_defaults.version = p_expected_version;
    if not found then
      return query select 'PROCESS_VERSION_CONFLICT'::text, null::jsonb;
      return;
    end if;
    v_snapshot := public.process_definition_snapshot_v1(p_company_id, v_definition_id);
  end if;

  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id,
    case when p_action = 'SAVE_DEFINITION' then 'PROCESS_DEFINITION_SAVED' else 'HOTEL_PROCESS_DEFAULT_SET' end,
    v_actor.user_id, v_actor.user_type, v_actor.session_id, p_company_id,
    p_branch_id, 'PROCESS_DEFINITION', p_resource_id,
    pg_catalog.jsonb_build_object('resourceId', p_resource_id),
    '프로세스 설정 저장', 'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id, p_idempotency_key,
    p_http_method, p_operation_path, p_request_hash, 'COMPLETED',
    'PROCESS_DEFINITION', p_resource_id, p_audit_event_id, v_snapshot,
    v_now, v_now + interval '24 hours'
  );
  return query select
    case when p_action = 'SAVE_DEFINITION' and p_expected_version = 0 then 'CREATED' else 'UPDATED' end::text,
    v_snapshot;
exception
  when invalid_text_representation or foreign_key_violation or check_violation or unique_violation then
    return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_process_command_v1(uuid, uuid, uuid, text, integer, jsonb, text, uuid, text, text, text, text, uuid, uuid) from public;

insert into schema_migrations (version)
values ('0029_hotel_process_reviewer_candidates');

commit;
