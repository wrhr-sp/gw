begin;

alter table public.process_transition_snapshots
  drop constraint process_transition_snapshots_event_check;
alter table public.process_transition_snapshots
  drop constraint process_transition_snapshots_check1;
alter table public.process_transition_snapshots
  add constraint process_transition_snapshots_event_check
  check (event in ('APPROVE', 'REJECT', 'SELECT'));
alter table public.process_transition_snapshots
  add constraint process_transition_snapshots_choice_check
  check (
    (event = 'SELECT' and pg_catalog.btrim(choice_value) <> '')
    or (event in ('APPROVE', 'REJECT') and choice_value is null)
  );

create table public.hotel_file_access_rate_windows (
  company_id uuid not null,
  branch_id uuid not null,
  scope_type text not null,
  scope_id uuid not null,
  window_started_at timestamptz not null,
  request_count integer not null,
  updated_at timestamptz not null default now(),
  constraint hotel_file_access_rate_windows_pkey
    primary key (company_id, branch_id, scope_type, scope_id, window_started_at),
  constraint hotel_file_access_rate_windows_company_id_branch_id_fkey
    foreign key (company_id, branch_id)
    references public.hotel_profiles(company_id, branch_id),
  constraint hotel_file_access_rate_windows_scope_type_check
    check (scope_type in ('USER', 'HOTEL')),
  constraint hotel_file_access_rate_windows_request_count_check
    check (request_count between 1 and 100),
  constraint hotel_file_access_rate_windows_window_bucket_check
    check (window_started_at = pg_catalog.date_bin(
    interval '5 minutes', window_started_at, timestamptz '1970-01-01 00:00:00+00'
  )),
  constraint hotel_file_access_rate_windows_scope_check
    check ((scope_type = 'HOTEL' and scope_id = branch_id) or scope_type = 'USER')
);

create table public.hotel_file_access_grants (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  actor_user_id uuid not null,
  actor_type text not null,
  session_id uuid not null,
  inspection_id uuid not null,
  file_version_id uuid not null,
  completion_token_hash bytea not null,
  status text not null,
  trace_id uuid not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz,
  constraint hotel_file_access_grants_company_id_id_key unique (company_id, id),
  constraint hotel_file_access_grants_company_id_branch_id_fkey
    foreign key (company_id, branch_id)
    references public.hotel_profiles(company_id, branch_id),
  constraint hotel_file_access_grants_company_id_actor_user_id_fkey
    foreign key (company_id, actor_user_id) references public.users(company_id, id),
  constraint hotel_file_access_grants_company_id_session_id_fkey
    foreign key (company_id, session_id) references public.auth_sessions(company_id, id),
  constraint hotel_file_access_grants_inspection_fkey
    foreign key (company_id, branch_id, inspection_id)
    references public.hotel_inspections(company_id, branch_id, id),
  constraint hotel_file_access_grants_company_id_file_version_id_fkey
    foreign key (company_id, file_version_id)
    references public.hotel_file_versions(company_id, id),
  constraint hotel_file_access_grants_completion_token_hash_check
    check (pg_catalog.octet_length(completion_token_hash) = 32),
  constraint hotel_file_access_grants_status_check
    check (status in ('STARTED', 'SUCCEEDED', 'FAILED', 'ABORTED')),
  constraint hotel_file_access_grants_expiry_check check (expires_at > started_at),
  constraint hotel_file_access_grants_terminal_check
    check ((status = 'STARTED' and completed_at is null)
    or (status <> 'STARTED' and completed_at is not null))
);

alter table public.hotel_file_access_rate_windows enable row level security;
alter table public.hotel_file_access_rate_windows force row level security;
alter table public.hotel_file_access_grants enable row level security;
alter table public.hotel_file_access_grants force row level security;
do $tenant_security$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    'hotel_file_access_rate_windows', 'hotel_file_access_grants'
  ] loop
    execute pg_catalog.format(
      'create policy %I_company_isolation on %I using (
        case
          when public.runtime_is_schema_owner() then true
          when current_user = ''werehere_auth_session_definer'' then true
          when current_user = ''werehere_tenant_authority_definer'' then true
          when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
          else false
        end
      ) with check (
        case
          when public.runtime_is_schema_owner() then true
          when current_user = ''werehere_auth_session_definer'' then true
          when current_user = ''werehere_tenant_authority_definer'' then true
          when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
          else false
        end
      )', tenant_table, tenant_table
    );
  end loop;
end
$tenant_security$;

create function public.hotel_file_access_recover_expired_v1(p_limit integer)
returns table(recovered_count integer)
language plpgsql volatile security definer set search_path = pg_catalog
as $function$
declare
  v_recovered_count integer;
begin
  if not public.runtime_has_capability('RECONCILER') then
    raise exception 'hotel file access recovery requires reconciler capability'
      using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'hotel file access recovery limit is invalid'
      using errcode = '22023';
  end if;

  with candidates as (
    select grant_record.company_id, grant_record.id
      from public.hotel_file_access_grants grant_record
     where grant_record.status = 'STARTED'
       and grant_record.expires_at <= pg_catalog.statement_timestamp()
     order by grant_record.expires_at, grant_record.id
     for update skip locked
     limit p_limit
  ), recovered as (
    update public.hotel_file_access_grants grant_record
       set status = 'ABORTED', completed_at = pg_catalog.statement_timestamp()
      from candidates
     where grant_record.company_id = candidates.company_id
       and grant_record.id = candidates.id
       and grant_record.status = 'STARTED'
    returning grant_record.*
  ), recorded_audits as (
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, result, trace_id
    )
    select pg_catalog.md5(recovered.id::text || ':stale-file-view')::uuid,
           'HOTEL_FILE_VIEW_ABANDONED', recovered.actor_user_id,
           recovered.actor_type, recovered.session_id, recovered.company_id,
           recovered.branch_id, 'HOTEL_FILE_VERSION', recovered.file_version_id,
           pg_catalog.jsonb_build_object('inspectionId', recovered.inspection_id),
           'FAILED', recovered.trace_id
      from recovered
    on conflict (id) do nothing
    returning 1
  )
  select count(*)::integer into v_recovered_count from recovered;

  return query select v_recovered_count;
end
$function$;
revoke all on function public.hotel_file_access_recover_expired_v1(integer) from public;

create function public.hotel_active_actor_v1(
  p_company_id uuid,
  p_session_token text
)
returns table(session_id uuid, user_id uuid, user_type text)
language sql stable security definer set search_path = pg_catalog
as $function$
  select session_record.id, app_user.id, app_user.user_type
    from public.auth_sessions session_record
    join public.users app_user
      on app_user.company_id = session_record.company_id
     and app_user.id = session_record.user_id
    join public.companies company_record on company_record.id = session_record.company_id
   where public.runtime_has_capability('API_RUNTIME')
     and p_session_token ~ '^[A-Za-z0-9_-]{43}$'
     and session_record.id = nullif(pg_catalog.current_setting('app.session_id', true), '')::uuid
     and session_record.company_id = p_company_id
     and session_record.token_hash = pg_catalog.sha256(pg_catalog.convert_to(p_session_token, 'UTF8'))
     and session_record.revoked_at is null
     and session_record.idle_expires_at > pg_catalog.statement_timestamp()
     and session_record.absolute_expires_at > pg_catalog.statement_timestamp()
     and app_user.status = 'ACTIVE'
     and app_user.user_type = 'INTERNAL_STAFF'
     and company_record.status = 'ACTIVE'
$function$;
revoke all on function public.hotel_active_actor_v1(uuid, text) from public;

create function public.hotel_process_reviewer_is_eligible_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_user_id uuid,
  p_at timestamptz
)
returns boolean
language sql stable security definer set search_path = pg_catalog
as $function$
  with candidate as (
    select app_user.id
      from public.users app_user
      join public.companies company_record on company_record.id = app_user.company_id
     where app_user.company_id = p_company_id
       and app_user.id = p_user_id
       and app_user.status = 'ACTIVE'
       and app_user.user_type = 'INTERNAL_STAFF'
       and company_record.status = 'ACTIVE'
       and exists (
         select 1 from public.hotel_staff_assignments assignment
          where assignment.company_id = p_company_id
            and assignment.branch_id = p_branch_id
            and assignment.user_id = app_user.id
            and assignment.terminated_at is null
            and assignment.start_date <= p_at::date
            and (assignment.end_date is null or assignment.end_date >= p_at::date)
       )
  ), effective_subjects as (
    select 'USER'::text as subject_type, candidate.id as subject_id from candidate
    union all
    select 'ROLE', membership.role_id
      from candidate
      join public.user_role_memberships membership
        on membership.company_id = p_company_id
       and membership.user_id = candidate.id
      join public.roles role_record
        on role_record.company_id = membership.company_id
       and role_record.id = membership.role_id
     where membership.valid_from <= p_at
       and (membership.valid_until is null or membership.valid_until > p_at)
       and role_record.status = 'ACTIVE'
    union all
    select 'GROUP', membership.group_id
      from candidate
      join public.user_group_memberships membership
        on membership.company_id = p_company_id
       and membership.user_id = candidate.id
      join public.user_groups group_record
        on group_record.company_id = membership.company_id
       and group_record.id = membership.group_id
     where membership.valid_from <= p_at
       and (membership.valid_until is null or membership.valid_until > p_at)
       and group_record.status = 'ACTIVE'
  ), effects as (
    select grant_record.effect
      from public.permission_grants grant_record
      join effective_subjects subject_record
        on subject_record.subject_type = grant_record.subject_type
       and subject_record.subject_id = grant_record.subject_id
     where grant_record.company_id = p_company_id
       and grant_record.permission_code = 'HOTEL_INSPECTION_REVIEW'
       and (grant_record.branch_id is null or grant_record.branch_id = p_branch_id)
       and grant_record.valid_from <= p_at
       and (grant_record.valid_until is null or grant_record.valid_until > p_at)
  )
  select exists(select 1 from candidate)
     and exists(select 1 from effects where effect = 'ALLOW')
     and not exists(select 1 from effects where effect = 'DENY')
$function$;
revoke all on function public.hotel_process_reviewer_is_eligible_v1(
  uuid, uuid, uuid, timestamptz
) from public;

create function public.hotel_process_actor_is_assigned_v1(
  p_company_id uuid,
  p_execution_id uuid,
  p_actor_user_id uuid,
  p_at timestamptz
)
returns boolean
language sql stable security invoker set search_path = pg_catalog
as $function$
  select exists (
    select 1
      from public.process_executions execution
      join public.process_stage_snapshots stage
        on stage.company_id = execution.company_id
       and stage.revision_id = execution.revision_id
       and stage.stage_key = execution.current_stage_key
     where execution.company_id = p_company_id
       and execution.id = p_execution_id
       and (
         execution.current_reviewer_user_id = p_actor_user_id
         or (
           stage.delegate_user_id = p_actor_user_id
           and stage.delegate_starts_at <= p_at
           and (stage.delegate_ends_at is null or stage.delegate_ends_at > p_at)
         )
       )
  )
$function$;
revoke all on function public.hotel_process_actor_is_assigned_v1(uuid, uuid, uuid, timestamptz) from public;


create function public.hotel_inspection_review_snapshot_v1(
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
  with selected as (
    select inspection.id as inspection_id,
           inspection.source,
           inspection.business_date,
           inspection.due_at as inspection_due_at,
           execution.*,
           current_stage.stage_key as effective_stage_key,
           current_stage.stage_name as effective_stage_name,
           current_stage.reviewer_user_id as effective_reviewer_id,
           reviewer.display_name as reviewer_name,
           case when execution.state = 'IN_REVIEW' then delegate_user.id end as delegate_id,
           case when execution.state = 'IN_REVIEW' then delegate_user.display_name end as delegate_name
      from public.hotel_inspections inspection
      join public.process_executions execution
        on execution.company_id = inspection.company_id
       and execution.id = inspection.process_execution_id
      left join lateral (
        select history.previous_stage_key
          from public.process_execution_history history
         where history.company_id = execution.company_id
           and history.execution_id = execution.id
           and history.next_state = 'COMPLETED'
         order by history.occurred_at desc, history.id desc limit 1
      ) completion on true
      join public.process_stage_snapshots current_stage
        on current_stage.company_id = execution.company_id
       and current_stage.revision_id = execution.revision_id
       and current_stage.stage_key = coalesce(
         execution.current_stage_key, completion.previous_stage_key
       )
      join public.users reviewer
        on reviewer.company_id = execution.company_id
       and reviewer.id = current_stage.reviewer_user_id
      left join public.users delegate_user
        on delegate_user.company_id = execution.company_id
       and delegate_user.id = current_stage.delegate_user_id
       and current_stage.delegate_starts_at <= pg_catalog.statement_timestamp()
       and (current_stage.delegate_ends_at is null
         or current_stage.delegate_ends_at > pg_catalog.statement_timestamp())
     where inspection.company_id = p_company_id
       and inspection.branch_id = p_branch_id
       and inspection.id = p_inspection_id
  ), actions as (
    select action.event, action.choice_value, action.label,
           action.to_stage_key, action.to_stage_name,
           action.completes_process, action.sort_order
      from selected execution
      cross join lateral (
        select transition.event,
               transition.choice_value,
               case
                 when transition.event = 'SELECT' then
                   coalesce(transition.choice_value, destination.stage_name) || ' 선택'
                 when transition.event = 'REJECT' then
                   '반려 · ' || destination.stage_name
                 else destination.stage_name || '로 보내기'
               end as label,
               transition.to_stage_key,
               destination.stage_name as to_stage_name,
               false as completes_process,
               10 as sort_order
          from public.process_transition_snapshots transition
          join public.process_stage_snapshots destination
            on destination.company_id = transition.company_id
           and destination.revision_id = transition.revision_id
           and destination.stage_key = transition.to_stage_key
         where execution.state = 'IN_REVIEW'
           and transition.company_id = execution.company_id
           and transition.revision_id = execution.revision_id
           and transition.from_stage_key = execution.effective_stage_key
        union all
        select 'APPROVE'::text, null::text, '검토 완료'::text,
               null::text, null::text, true, 10
         where execution.state = 'IN_REVIEW'
           and exists (
           select 1 from public.process_stage_snapshots stage
            where stage.company_id = execution.company_id
              and stage.revision_id = execution.revision_id
              and stage.stage_key = execution.effective_stage_key
              and stage.is_final
         )
      ) action
  ), review_history as (
    select history.id, history.previous_state, history.next_state,
           previous_stage.stage_name as previous_stage_name,
           next_stage.stage_name as next_stage_name,
           history.event, history.reason,
           actor.id as actor_id, actor.display_name as actor_name,
           history.occurred_at
      from selected execution
      join public.process_execution_history history
        on history.company_id = execution.company_id
       and history.execution_id = execution.id
      left join public.process_stage_snapshots previous_stage
        on previous_stage.company_id = execution.company_id
       and previous_stage.revision_id = execution.revision_id
       and previous_stage.stage_key = history.previous_stage_key
      left join public.process_stage_snapshots next_stage
        on next_stage.company_id = execution.company_id
       and next_stage.revision_id = execution.revision_id
       and next_stage.stage_key = history.next_stage_key
      join public.users actor
        on actor.company_id = history.company_id
       and actor.id = history.actor_user_id
  ), provenance as (
    select submit_actor.id as submitted_by_id,
           submit_actor.display_name as submitted_by_name,
           submitted.occurred_at as submitted_at,
           change_actor.id as changed_by_id,
           change_actor.display_name as changed_by_name,
           changed.changed_at as changed_at
      from selected execution
      cross join lateral (
        select history.actor_user_id, history.occurred_at
          from public.process_execution_history history
         where history.company_id = execution.company_id
           and history.execution_id = execution.id
           and history.event = 'SUBMIT'
         order by history.occurred_at, history.id limit 1
      ) submitted
      join public.users submit_actor
        on submit_actor.company_id = execution.company_id
       and submit_actor.id = submitted.actor_user_id
      cross join lateral (
        select history.changed_by, history.changed_at
          from public.inspection_item_result_history history
         where history.company_id = execution.company_id
           and history.inspection_id = execution.resource_id
         order by history.changed_at desc, history.id desc limit 1
      ) changed
      join public.users change_actor
        on change_actor.company_id = execution.company_id
       and change_actor.id = changed.changed_by
  ), evidence as (
    select link.file_version_id as id,
           link.item_snapshot_id,
           version_record.display_name,
           version_record.detected_mime,
           version_record.clean_size
      from public.hotel_file_links link
      join public.inspection_item_results result_record
        on result_record.company_id = link.company_id
       and result_record.branch_id = link.branch_id
       and result_record.inspection_id = link.inspection_id
       and result_record.item_snapshot_id = link.item_snapshot_id
       and result_record.id = link.result_id
       and result_record.version = link.result_version
      join public.hotel_file_versions version_record
        on version_record.company_id = link.company_id
       and version_record.id = link.file_version_id
      join public.hotel_file_uploads upload
        on upload.company_id = version_record.company_id
       and upload.id = version_record.upload_id
       and upload.status = 'LINKED'
      join public.hotel_file_scan_jobs scan_job
        on scan_job.company_id = version_record.company_id
       and scan_job.upload_id = version_record.upload_id
       and scan_job.file_version_id = version_record.id
       and scan_job.status = 'COMPLETED'
     where link.company_id = p_company_id
       and link.branch_id = p_branch_id
       and link.inspection_id = p_inspection_id
       and link.parent_type = 'INSPECTION_ITEM_EVIDENCE'
  )
  select case when base.value is null or execution.id is null then null::jsonb else
    pg_catalog.jsonb_build_object(
      'inspection', base.value,
      'provenance', (
        select pg_catalog.jsonb_build_object(
          'submittedBy', pg_catalog.jsonb_build_object(
            'id', record.submitted_by_id,
            'displayName', record.submitted_by_name
          ),
          'submittedAt', pg_catalog.to_char(record.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'lastResultChangedBy', pg_catalog.jsonb_build_object(
            'id', record.changed_by_id,
            'displayName', record.changed_by_name
          ),
          'lastResultChangedAt', pg_catalog.to_char(record.changed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) from provenance record
      ),
      'review', pg_catalog.jsonb_build_object(
        'executionId', execution.id,
        'version', execution.version,
        'currentStage', pg_catalog.jsonb_build_object(
          'key', execution.effective_stage_key,
          'name', execution.effective_stage_name
        ),
        'reviewer', pg_catalog.jsonb_build_object(
          'id', execution.effective_reviewer_id,
          'displayName', execution.reviewer_name
        ),
        'delegate', case when execution.delegate_id is null then null::jsonb
          else pg_catalog.jsonb_build_object(
            'id', execution.delegate_id,
            'displayName', execution.delegate_name
          ) end,
        'dueAt', case when execution.current_due_at is null then null
          else pg_catalog.to_char(execution.current_due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
        'overdue', execution.current_due_at is not null
          and execution.current_due_at < pg_catalog.statement_timestamp(),
        'actions', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'event', action.event,
            'choiceValue', action.choice_value,
            'label', action.label,
            'toStageKey', action.to_stage_key,
            'toStageName', action.to_stage_name,
            'completesProcess', action.completes_process
          ) order by action.sort_order, action.label)
          from actions action
        ), '[]'::jsonb),
        'history', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', history.id,
            'previousState', history.previous_state,
            'nextState', history.next_state,
            'previousStageName', history.previous_stage_name,
            'nextStageName', history.next_stage_name,
            'event', history.event,
            'reason', history.reason,
            'actor', pg_catalog.jsonb_build_object(
              'id', history.actor_id,
              'displayName', history.actor_name
            ),
            'occurredAt', pg_catalog.to_char(history.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          ) order by history.occurred_at, history.id)
          from review_history history
        ), '[]'::jsonb)
      ),
      'evidence', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', file.id,
          'itemSnapshotId', file.item_snapshot_id,
          'displayName', file.display_name,
          'mimeType', file.detected_mime,
          'sizeBytes', file.clean_size
        ) order by file.item_snapshot_id, file.id)
        from evidence file
      ), '[]'::jsonb)
    ) end
  from (select public.inspection_execution_read_snapshot_v1(
    p_company_id, p_branch_id, p_inspection_id
  ) as value) base
  left join selected execution on true
$function$;
revoke all on function public.hotel_inspection_review_snapshot_v1(uuid, uuid, uuid) from public;

create function public.hotel_inspection_reviews_read_v1(
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
  v_actor record;
  v_snapshot jsonb;
  v_page integer := coalesce(nullif(p_query ->> 'page', '')::integer, 1);
  v_page_size integer := coalesce(nullif(p_query ->> 'pageSize', '')::integer, 20);
  v_total integer;
  v_total_pages integer;
begin
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id, p_branch_id, p_session_token, 'HOTEL_INSPECTION_REVIEW', true
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  if p_inspection_id is not null then
    if p_query <> '{}'::jsonb then
      return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
      return;
    end if;
    if not exists (
      select 1
        from public.hotel_inspections inspection
        join public.process_executions execution
          on execution.company_id = inspection.company_id
         and execution.id = inspection.process_execution_id
       where inspection.company_id = p_company_id
         and inspection.branch_id = p_branch_id
         and inspection.id = p_inspection_id
         and (
           (
             execution.state = 'IN_REVIEW'
             and public.hotel_process_actor_is_assigned_v1(
               p_company_id, execution.id, v_actor.user_id,
               pg_catalog.statement_timestamp()
             )
           )
           or (
             execution.state = 'COMPLETED'
             and exists (
               select 1
                 from public.process_execution_history completion_history
                where completion_history.company_id = execution.company_id
                  and completion_history.execution_id = execution.id
                  and completion_history.next_state = 'COMPLETED'
                  and completion_history.actor_user_id = v_actor.user_id
             )
           )
         )
    ) then
      return query select 'NOT_FOUND'::text, null::jsonb;
      return;
    end if;
    v_snapshot := public.hotel_inspection_review_snapshot_v1(
      p_company_id, p_branch_id, p_inspection_id
    );
    return query select case when v_snapshot is null then 'NOT_FOUND' else 'OK' end,
      case when v_snapshot is null then null::jsonb
           else pg_catalog.jsonb_build_object('review', v_snapshot) end;
    return;
  end if;

  if v_page < 1 or v_page_size not between 1 and 100
     or (p_query - 'page' - 'pageSize') <> '{}'::jsonb then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;

  select pg_catalog.count(*)::integer into v_total
    from public.hotel_inspections inspection
    join public.process_executions execution
      on execution.company_id = inspection.company_id
     and execution.id = inspection.process_execution_id
   where inspection.company_id = p_company_id
     and inspection.branch_id = p_branch_id
     and inspection.status = 'IN_REVIEW'
     and execution.state = 'IN_REVIEW'
     and public.hotel_process_actor_is_assigned_v1(
       p_company_id, execution.id, v_actor.user_id,
       pg_catalog.statement_timestamp()
     );
  v_total_pages := case when v_total = 0 then 0
    else ((v_total + v_page_size - 1) / v_page_size) end;

  select pg_catalog.jsonb_build_object(
    'reviews', coalesce(pg_catalog.jsonb_agg(page.summary
      order by page.business_date, page.current_due_at nulls last, page.inspection_id), '[]'::jsonb),
    'pagination', pg_catalog.jsonb_build_object(
      'page', v_page, 'pageSize', v_page_size,
      'total', v_total, 'totalPages', v_total_pages
    )
  ) into v_snapshot
  from (
    select inspection.id as inspection_id,
           inspection.business_date,
           execution.current_due_at,
           pg_catalog.jsonb_build_object(
             'id', inspection.id,
             'hotelId', inspection.branch_id,
             'source', inspection.source,
             'businessDate', inspection.business_date::text,
             'dueAt', pg_catalog.to_char(inspection.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'targetSummary', pg_catalog.left(coalesce((
               select pg_catalog.string_agg(target.room_number_snapshot || '호', ', ' order by target.floor_sort_key_snapshot, target.room_number_snapshot)
                 from (select distinct snapshot.room_id, snapshot.room_number_snapshot,
                                      snapshot.floor_sort_key_snapshot
                         from public.inspection_item_snapshots snapshot
                        where snapshot.company_id = inspection.company_id
                          and snapshot.inspection_id = inspection.id) target
             ), '대상 미확인'), 300),
             'itemCount', (select pg_catalog.count(*)::integer
               from public.inspection_item_snapshots item
              where item.company_id = inspection.company_id and item.inspection_id = inspection.id),
             'abnormalCount', (select pg_catalog.count(*)::integer
               from public.inspection_item_results result_record
              where result_record.company_id = inspection.company_id
                and result_record.inspection_id = inspection.id
                and result_record.result = 'ABNORMAL'),
             'cautionCount', (select pg_catalog.count(*)::integer
               from public.inspection_item_results result_record
              where result_record.company_id = inspection.company_id
                and result_record.inspection_id = inspection.id
                and result_record.result = 'CAUTION'),
             'process', pg_catalog.jsonb_build_object(
               'executionId', execution.id,
               'version', execution.version,
               'currentStageName', execution.current_stage_name,
               'reviewer', pg_catalog.jsonb_build_object(
                 'id', reviewer.id, 'displayName', reviewer.display_name
               ),
               'delegate', case when delegate_user.id is null then null::jsonb
                 else pg_catalog.jsonb_build_object(
                   'id', delegate_user.id, 'displayName', delegate_user.display_name
                 ) end,
               'dueAt', case when execution.current_due_at is null then null
                 else pg_catalog.to_char(execution.current_due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
               'overdue', execution.current_due_at is not null
                 and execution.current_due_at < pg_catalog.statement_timestamp()
             )
           ) as summary
      from public.hotel_inspections inspection
      join public.process_executions execution
        on execution.company_id = inspection.company_id
       and execution.id = inspection.process_execution_id
      join public.users reviewer
        on reviewer.company_id = execution.company_id
       and reviewer.id = execution.current_reviewer_user_id
      join public.process_stage_snapshots current_stage
        on current_stage.company_id = execution.company_id
       and current_stage.revision_id = execution.revision_id
       and current_stage.stage_key = execution.current_stage_key
      left join public.users delegate_user
        on delegate_user.company_id = execution.company_id
       and delegate_user.id = current_stage.delegate_user_id
       and current_stage.delegate_starts_at <= pg_catalog.statement_timestamp()
       and (current_stage.delegate_ends_at is null
         or current_stage.delegate_ends_at > pg_catalog.statement_timestamp())
     where inspection.company_id = p_company_id
       and inspection.branch_id = p_branch_id
       and inspection.status = 'IN_REVIEW'
       and execution.state = 'IN_REVIEW'
       and public.hotel_process_actor_is_assigned_v1(
         p_company_id, execution.id, v_actor.user_id,
         pg_catalog.statement_timestamp()
       )
     order by inspection.business_date, execution.current_due_at nulls last, inspection.id
     limit v_page_size offset (v_page - 1) * v_page_size
  ) page;
  return query select 'OK'::text, v_snapshot;
exception
  when invalid_text_representation then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_inspection_reviews_read_v1(uuid, uuid, uuid, jsonb, text) from public;

create function public.hotel_inspection_transition_v1(
  p_company_id uuid, p_branch_id uuid, p_inspection_id uuid,
  p_expected_version integer, p_value jsonb, p_session_token text,
  p_idempotency_record_id uuid, p_idempotency_key text,
  p_operation_path text, p_request_hash text,
  p_audit_event_id uuid, p_trace_id uuid
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_actor record;
  v_review_actor record;
  v_existing public.idempotency_records%rowtype;
  v_execution public.process_executions%rowtype;
  v_current_stage public.process_stage_snapshots%rowtype;
  v_next_stage public.process_stage_snapshots%rowtype;
  v_transition public.process_transition_snapshots%rowtype;
  v_snapshot jsonb;
  v_denial_code text;
begin
  select * into v_actor from public.hotel_active_actor_v1(p_company_id, p_session_token);
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;
  select * into v_review_actor from public.hotel_command_actor_v1(
    p_company_id, p_branch_id, p_session_token, 'HOTEL_INSPECTION_REVIEW', true
  );
  if v_review_actor.user_id is distinct from v_actor.user_id then
    v_denial_code := 'PERMISSION_OR_ASSIGNMENT';
  end if;
  if v_denial_code is not null then
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, result, trace_id
    ) values (
      p_audit_event_id, 'HOTEL_INSPECTION_TRANSITION_DENIED', v_actor.user_id,
      v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
      'HOTEL_INSPECTION', p_inspection_id,
      pg_catalog.jsonb_build_object('code', v_denial_code), 'DENIED', p_trace_id
    );
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_company_id::text || ':' || v_actor.user_id::text || ':'
        || p_idempotency_key || ':POST:' || p_operation_path,
      0
    )
  );

  select * into v_existing from public.idempotency_records record
   where record.company_id = p_company_id
     and record.actor_user_id = v_actor.user_id
     and record.idempotency_key = p_idempotency_key
     and record.http_method = 'POST'
     and record.operation_path = p_operation_path
     and record.status = 'COMPLETED';
  if found then
    return query select
      case when v_existing.request_hash = p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end,
      case when v_existing.request_hash = p_request_hash then v_existing.result_snapshot else null::jsonb end;
    return;
  end if;

  select execution.* into v_execution
    from public.process_executions execution
   where execution.company_id = p_company_id
     and execution.branch_id = p_branch_id
     and execution.resource_id = p_inspection_id
   for update;
  if not found then
    return query select 'NOT_FOUND'::text, null::jsonb;
    return;
  end if;
  if v_execution.state <> 'IN_REVIEW' or v_execution.version <> p_expected_version then
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, result, trace_id
    ) values (
      p_audit_event_id, 'HOTEL_INSPECTION_TRANSITION_DENIED', v_actor.user_id,
      v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
      'HOTEL_INSPECTION', p_inspection_id,
      pg_catalog.jsonb_build_object('code', 'STALE_VERSION'), 'DENIED', p_trace_id
    );
    return query select 'VERSION_CONFLICT'::text, null::jsonb;
    return;
  end if;
  if not public.hotel_process_actor_is_assigned_v1(
    p_company_id, v_execution.id, v_actor.user_id, v_now
  ) then
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, result, trace_id
    ) values (
      p_audit_event_id, 'HOTEL_INSPECTION_TRANSITION_DENIED', v_actor.user_id,
      v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
      'HOTEL_INSPECTION', p_inspection_id,
      pg_catalog.jsonb_build_object('code', 'NOT_CURRENT_REVIEWER'), 'DENIED', p_trace_id
    );
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  select stage.* into v_current_stage from public.process_stage_snapshots stage
   where stage.company_id = p_company_id
     and stage.revision_id = v_execution.revision_id
     and stage.stage_key = v_execution.current_stage_key;
  if v_current_stage.is_final then
    if p_value ->> 'event' <> 'APPROVE' or p_value ->> 'choiceValue' is not null then
      v_denial_code := 'FINAL_APPROVE_REQUIRED';
    else
      update public.process_executions
         set state = 'COMPLETED', current_stage_key = null,
             current_stage_name = null, current_reviewer_user_id = null,
             current_delegate_user_id = null, current_due_at = null,
             version = version + 1, completed_at = v_now, updated_at = v_now
       where company_id = p_company_id and id = v_execution.id;
      update public.hotel_inspections
         set status = 'COMPLETED', version = version + 1, updated_at = v_now
       where company_id = p_company_id and branch_id = p_branch_id
         and id = p_inspection_id and status = 'IN_REVIEW';
    end if;
  else
    select transition.* into v_transition
      from public.process_transition_snapshots transition
     where transition.company_id = p_company_id
       and transition.revision_id = v_execution.revision_id
       and transition.from_stage_key = v_execution.current_stage_key
       and transition.event = p_value ->> 'event'
       and transition.choice_value is not distinct from p_value ->> 'choiceValue';
    if not found then
      v_denial_code := 'REVISION_EDGE_REQUIRED';
    else
      select stage.* into v_next_stage from public.process_stage_snapshots stage
       where stage.company_id = p_company_id
         and stage.revision_id = v_execution.revision_id
         and stage.stage_key = v_transition.to_stage_key;
      if not public.hotel_process_reviewer_is_eligible_v1(
        p_company_id, p_branch_id, v_next_stage.reviewer_user_id, v_now
      ) then
        return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb;
        return;
      end if;
      update public.process_executions
         set current_stage_key = v_next_stage.stage_key,
             current_stage_name = v_next_stage.stage_name,
             current_reviewer_user_id = v_next_stage.reviewer_user_id,
             current_delegate_user_id = null,
             current_due_at = case
               when v_next_stage.due_unit = 'HOURS' then v_now + pg_catalog.make_interval(hours => v_next_stage.due_amount)
               when v_next_stage.due_unit = 'DAYS' then v_now + pg_catalog.make_interval(days => v_next_stage.due_amount)
               else null end,
             version = version + 1, updated_at = v_now
       where company_id = p_company_id and id = v_execution.id;
    end if;
  end if;

  if v_denial_code is not null then
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, result, trace_id
    ) values (
      p_audit_event_id, 'HOTEL_INSPECTION_TRANSITION_DENIED', v_actor.user_id,
      v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
      'HOTEL_INSPECTION', p_inspection_id,
      pg_catalog.jsonb_build_object('code', v_denial_code), 'DENIED', p_trace_id
    );
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;

  insert into public.process_execution_history (
    id, company_id, branch_id, execution_id, previous_state, next_state,
    previous_stage_key, next_stage_key, event, choice_value, reason, actor_user_id
  ) select (p_value ->> 'historyId')::uuid, p_company_id, p_branch_id,
      v_execution.id, 'IN_REVIEW', execution.state,
      v_execution.current_stage_key, execution.current_stage_key,
      p_value ->> 'event', p_value ->> 'choiceValue',
      p_value ->> 'reason', v_actor.user_id
    from public.process_executions execution
   where execution.company_id = p_company_id and execution.id = v_execution.id;

  v_snapshot := public.hotel_inspection_review_snapshot_v1(
    p_company_id, p_branch_id, p_inspection_id
  );
  if v_snapshot is null then
    raise exception 'review receipt snapshot missing';
  end if;
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id, 'HOTEL_INSPECTION_TRANSITION', v_actor.user_id,
    v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
    'HOTEL_INSPECTION', p_inspection_id,
    pg_catalog.jsonb_build_object('resourceId', p_inspection_id),
    p_value ->> 'reason', 'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id,
    p_idempotency_key, 'POST', p_operation_path, p_request_hash,
    'COMPLETED', 'HOTEL_INSPECTION', p_inspection_id,
    p_audit_event_id, v_snapshot, v_now, v_now + interval '24 hours'
  );
  return query select 'UPDATED'::text, v_snapshot;
exception
  when invalid_text_representation or foreign_key_violation or check_violation then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
  when unique_violation then
    return query select 'IDEMPOTENCY_CONFLICT'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_inspection_transition_v1(
  uuid, uuid, uuid, integer, jsonb, text, uuid, text, text, text, uuid, uuid
) from public;

create function public.hotel_file_view_command_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_inspection_id uuid,
  p_file_version_id uuid,
  p_action text,
  p_session_token text,
  p_grant_id uuid,
  p_completion_token text,
  p_audit_event_id uuid,
  p_alert_audit_event_id uuid,
  p_trace_id uuid
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_actor record;
  v_review_actor record;
  v_file_actor record;
  v_file record;
  v_grant public.hotel_file_access_grants%rowtype;
  v_window timestamptz := pg_catalog.date_bin(
    interval '5 minutes', pg_catalog.statement_timestamp(),
    timestamptz '1970-01-01 00:00:00+00'
  );
  v_user_count integer;
  v_hotel_count integer;
  v_terminal_status text;
begin
  if p_action not in ('AUTHORIZE', 'SUCCEEDED', 'FAILED', 'ABORTED')
     or p_completion_token !~ '^[A-Za-z0-9_-]{43}$' then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;

  if p_action <> 'AUTHORIZE' then
    select grant_record.* into v_grant
      from public.hotel_file_access_grants grant_record
     where grant_record.company_id = p_company_id
       and grant_record.branch_id = p_branch_id
       and grant_record.id = p_grant_id
       and grant_record.inspection_id = p_inspection_id
       and grant_record.file_version_id = p_file_version_id
       and grant_record.trace_id = p_trace_id
       and grant_record.completion_token_hash = pg_catalog.sha256(
         pg_catalog.convert_to(p_completion_token, 'UTF8')
       )
     for update;
    if not found then
      return query select 'NOT_FOUND'::text, null::jsonb;
      return;
    end if;
    if v_grant.status = p_action then
      return query select 'RECORDED'::text, null::jsonb;
      return;
    end if;
    if v_grant.status <> 'STARTED' then
      return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
      return;
    end if;
    update public.hotel_file_access_grants
       set status = p_action, completed_at = pg_catalog.statement_timestamp()
     where company_id = p_company_id and id = p_grant_id;
    v_terminal_status := case when p_action = 'SUCCEEDED' then 'SUCCEEDED' else 'FAILED' end;
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, result, trace_id
    ) values (
      p_audit_event_id, 'HOTEL_FILE_VIEW_' || p_action,
      v_grant.actor_user_id, v_grant.actor_type, v_grant.session_id,
      p_company_id, p_branch_id, 'HOTEL_FILE_VERSION', p_file_version_id,
      pg_catalog.jsonb_build_object('inspectionId', p_inspection_id),
      v_terminal_status, p_trace_id
    );
    return query select 'RECORDED'::text, null::jsonb;
    return;
  end if;

  select * into v_actor from public.hotel_active_actor_v1(p_company_id, p_session_token);
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  with recovered as (
    update public.hotel_file_access_grants grant_record
       set status = 'ABORTED', completed_at = pg_catalog.statement_timestamp()
     where grant_record.company_id = p_company_id
       and grant_record.branch_id = p_branch_id
       and grant_record.status = 'STARTED'
       and grant_record.expires_at <= pg_catalog.statement_timestamp()
    returning grant_record.*
  )
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, result, trace_id
  )
  select pg_catalog.md5(recovered.id::text || ':stale-file-view')::uuid,
         'HOTEL_FILE_VIEW_ABANDONED', recovered.actor_user_id,
         recovered.actor_type, recovered.session_id, recovered.company_id,
         recovered.branch_id, 'HOTEL_FILE_VERSION', recovered.file_version_id,
         pg_catalog.jsonb_build_object('inspectionId', recovered.inspection_id),
         'FAILED', recovered.trace_id
    from recovered
  on conflict (id) do nothing;

  insert into public.hotel_file_access_rate_windows (
    company_id, branch_id, scope_type, scope_id, window_started_at, request_count
  ) values (p_company_id, p_branch_id, 'USER', v_actor.user_id, v_window, 1)
  on conflict (company_id, branch_id, scope_type, scope_id, window_started_at)
  do update set request_count = public.hotel_file_access_rate_windows.request_count + 1,
                updated_at = pg_catalog.statement_timestamp()
    where public.hotel_file_access_rate_windows.request_count < 30
  returning request_count into v_user_count;

  insert into public.hotel_file_access_rate_windows (
    company_id, branch_id, scope_type, scope_id, window_started_at, request_count
  ) values (p_company_id, p_branch_id, 'HOTEL', p_branch_id, v_window, 1)
  on conflict (company_id, branch_id, scope_type, scope_id, window_started_at)
  do update set request_count = public.hotel_file_access_rate_windows.request_count + 1,
                updated_at = pg_catalog.statement_timestamp()
    where public.hotel_file_access_rate_windows.request_count < 100
  returning request_count into v_hotel_count;

  if v_hotel_count = 80 then
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, result, trace_id
    ) values (
      p_alert_audit_event_id, 'HOTEL_FILE_BULK_EXPORT_ALERT', v_actor.user_id,
      v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
      'HOTEL_FILE_ACCESS_WINDOW', p_branch_id,
      pg_catalog.jsonb_build_object('windowStartedAt', v_window, 'requestCount', 80),
      'SUCCEEDED', p_trace_id
    );
  end if;
  if v_user_count is null or v_hotel_count is null then
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, result, trace_id
    ) values (
      p_audit_event_id, 'HOTEL_FILE_VIEW_RATE_LIMITED', v_actor.user_id,
      v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
      'HOTEL_FILE_VERSION', p_file_version_id,
      pg_catalog.jsonb_build_object('inspectionId', p_inspection_id),
      'DENIED', p_trace_id
    );
    return query select 'RATE_LIMITED'::text, null::jsonb;
    return;
  end if;

  select * into v_review_actor from public.hotel_command_actor_v1(
    p_company_id, p_branch_id, p_session_token, 'HOTEL_INSPECTION_REVIEW', true
  );
  select * into v_file_actor from public.hotel_command_actor_v1(
    p_company_id, p_branch_id, p_session_token, 'HOTEL_FILE_READ', true
  );
  if v_review_actor.user_id is distinct from v_actor.user_id
     or v_file_actor.user_id is distinct from v_actor.user_id then
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, result, trace_id
    ) values (
      p_audit_event_id, 'HOTEL_FILE_VIEW_DENIED', v_actor.user_id,
      v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
      'HOTEL_FILE_VERSION', p_file_version_id,
      pg_catalog.jsonb_build_object('inspectionId', p_inspection_id),
      'DENIED', p_trace_id
    );
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  select version_record.clean_object_key, version_record.clean_etag,
         version_record.clean_object_version,
         pg_catalog.encode(version_record.clean_sha256, 'hex') as clean_sha256,
         version_record.clean_size, version_record.detected_mime,
         version_record.display_name
    into v_file
    from public.hotel_inspections inspection
    join public.process_executions execution
      on execution.company_id = inspection.company_id
     and execution.id = inspection.process_execution_id
    join public.inspection_item_results result_record
      on result_record.company_id = inspection.company_id
     and result_record.branch_id = inspection.branch_id
     and result_record.inspection_id = inspection.id
    join public.hotel_file_links link
      on link.company_id = result_record.company_id
     and link.branch_id = result_record.branch_id
     and link.inspection_id = result_record.inspection_id
     and link.item_snapshot_id = result_record.item_snapshot_id
     and link.result_id = result_record.id
     and link.result_version = result_record.version
     and link.parent_type = 'INSPECTION_ITEM_EVIDENCE'
    join public.hotel_file_versions version_record
      on version_record.company_id = link.company_id
     and version_record.branch_id = link.branch_id
     and version_record.id = link.file_version_id
    join public.hotel_file_uploads upload
      on upload.company_id = version_record.company_id
     and upload.branch_id = link.branch_id
     and upload.inspection_id = link.inspection_id
     and upload.item_snapshot_id = link.item_snapshot_id
     and upload.id = version_record.upload_id
     and upload.status = 'LINKED'
    join public.hotel_file_scan_jobs scan_job
      on scan_job.company_id = version_record.company_id
     and scan_job.branch_id = link.branch_id
     and scan_job.upload_id = version_record.upload_id
     and scan_job.file_version_id = version_record.id
     and scan_job.status = 'COMPLETED'
   where inspection.company_id = p_company_id
     and inspection.branch_id = p_branch_id
     and inspection.id = p_inspection_id
     and inspection.status = 'IN_REVIEW'
     and execution.state = 'IN_REVIEW'
     and public.hotel_process_actor_is_assigned_v1(
       p_company_id, execution.id, v_actor.user_id, pg_catalog.statement_timestamp()
     )
     and link.file_version_id = p_file_version_id
   for share of execution;
  if not found then
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, result, trace_id
    ) values (
      p_audit_event_id, 'HOTEL_FILE_VIEW_DENIED', v_actor.user_id,
      v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
      'HOTEL_FILE_VERSION', p_file_version_id,
      pg_catalog.jsonb_build_object('inspectionId', p_inspection_id),
      'DENIED', p_trace_id
    );
    return query select 'NOT_FOUND'::text, null::jsonb;
    return;
  end if;

  insert into public.hotel_file_access_grants (
    id, company_id, branch_id, actor_user_id, actor_type, session_id,
    inspection_id, file_version_id, completion_token_hash, status, trace_id
  ) values (
    p_grant_id, p_company_id, p_branch_id, v_actor.user_id, v_actor.user_type,
    v_actor.session_id, p_inspection_id, p_file_version_id,
    pg_catalog.sha256(pg_catalog.convert_to(p_completion_token, 'UTF8')),
    'STARTED', p_trace_id
  );
  return query select 'OK'::text, pg_catalog.jsonb_build_object(
    'grantId', p_grant_id,
    'cleanObjectKey', v_file.clean_object_key,
    'etag', v_file.clean_etag,
    'objectVersion', v_file.clean_object_version,
    'sha256', v_file.clean_sha256,
    'sizeBytes', v_file.clean_size,
    'mimeType', v_file.detected_mime,
    'displayName', v_file.display_name
  );
end
$function$;
revoke all on function public.hotel_file_view_command_v1(
  uuid, uuid, uuid, uuid, text, text, uuid, text, uuid, uuid, uuid
) from public;
do $capability_grants$
declare
  runtime_role text;
begin
  for runtime_role in
    select capability.role_name
      from public.runtime_database_capabilities capability
     where capability.capability = 'API_RUNTIME'
  loop
    execute pg_catalog.format(
      'grant execute on function public.hotel_inspection_reviews_read_v1(uuid,uuid,uuid,jsonb,text) to %I',
      runtime_role
    );
    execute pg_catalog.format(
      'grant execute on function public.hotel_inspection_transition_v1(uuid,uuid,uuid,integer,jsonb,text,uuid,text,text,text,uuid,uuid) to %I',
      runtime_role
    );
    execute pg_catalog.format(
      'grant execute on function public.hotel_file_view_command_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid) to %I',
      runtime_role
    );
  end loop;
  for runtime_role in
    select capability.role_name
      from public.runtime_database_capabilities capability
     where capability.capability = 'RECONCILER'
  loop
    execute pg_catalog.format(
      'grant execute on function public.hotel_file_access_recover_expired_v1(integer) to %I',
      runtime_role
    );
  end loop;
end
$capability_grants$;

insert into public.schema_migrations(version)
values ('0035_hotel_inspection_review_and_file_view')
on conflict (version) do nothing;

commit;
