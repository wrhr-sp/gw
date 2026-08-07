begin;

-- 0043_hotel_calendar_read_model
-- Calendar is a read model over existing FORCE ROW LEVEL SECURITY protected
-- inspection and repair tables. No provider identifiers or credentials are stored.
insert into public.permissions(code, description) values
  ('HOTEL_CALENDAR_READ', '호텔 업무 달력 조회'),
  ('HOTEL_CALENDAR_ALL_READ', '전체 호텔 업무 달력 조회'),
  ('REPAIR_VISIT_CANCELLED_READ', '취소된 보수 방문일정 조회'),
  ('REPAIR_VISIT_CANCEL_REASON_READ', '보수 방문일정 취소사유 조회')
on conflict(code) do update set description = excluded.description;

create function public.hotel_calendar_actor_v1(
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
     and app_user.user_type in ('INTERNAL_STAFF', 'HOUSEKEEPING')
     and company_record.status = 'ACTIVE'
$function$;
revoke all on function public.hotel_calendar_actor_v1(uuid, text) from public;

create function public.hotel_calendar_permission_allowed_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_user_id uuid,
  p_permission_code text
)
returns boolean
language sql stable security definer set search_path = pg_catalog
as $function$
  with effective_subjects as (
    select 'USER'::text as subject_type, p_user_id as subject_id
    union all
    select 'ROLE', membership.role_id
      from public.user_role_memberships membership
      join public.roles role_record
        on role_record.company_id = membership.company_id
       and role_record.id = membership.role_id
     where membership.company_id = p_company_id
       and membership.user_id = p_user_id
       and membership.valid_from <= pg_catalog.statement_timestamp()
       and (membership.valid_until is null or membership.valid_until > pg_catalog.statement_timestamp())
       and role_record.status = 'ACTIVE'
    union all
    select 'GROUP', membership.group_id
      from public.user_group_memberships membership
      join public.user_groups group_record
        on group_record.company_id = membership.company_id
       and group_record.id = membership.group_id
     where membership.company_id = p_company_id
       and membership.user_id = p_user_id
       and membership.valid_from <= pg_catalog.statement_timestamp()
       and (membership.valid_until is null or membership.valid_until > pg_catalog.statement_timestamp())
       and group_record.status = 'ACTIVE'
  ), effects as (
    select permission_grant.effect
      from public.permission_grants permission_grant
      join effective_subjects subject
        on subject.subject_type = permission_grant.subject_type
       and subject.subject_id = permission_grant.subject_id
     where permission_grant.company_id = p_company_id
       and permission_grant.permission_code = p_permission_code
       and (
         (p_branch_id is null and permission_grant.branch_id is null)
         or (p_branch_id is not null and (permission_grant.branch_id is null or permission_grant.branch_id = p_branch_id))
       )
       and permission_grant.valid_from <= pg_catalog.statement_timestamp()
       and (permission_grant.valid_until is null or permission_grant.valid_until > pg_catalog.statement_timestamp())
  )
  select coalesce(pg_catalog.bool_or(effect = 'ALLOW'), false)
     and not coalesce(pg_catalog.bool_or(effect = 'DENY'), false)
    from effects
$function$;
revoke all on function public.hotel_calendar_permission_allowed_v1(uuid, uuid, uuid, text) from public;

create function public.hotel_calendar_accessible_hotels_v1(
  p_company_id uuid,
  p_user_id uuid,
  p_user_type text
)
returns table(branch_id uuid, hotel_name text, can_create_visit boolean)
language sql stable security definer set search_path = pg_catalog
as $function$
  select branch_record.id,
         branch_record.name,
         (
           p_user_type = 'INTERNAL_STAFF'
           and public.hotel_calendar_permission_allowed_v1(p_company_id, branch_record.id, p_user_id, 'REPAIR_READ')
           and public.hotel_calendar_permission_allowed_v1(p_company_id, branch_record.id, p_user_id, 'REPAIR_VISIT_CREATE')
         ) as can_create_visit
    from public.branches branch_record
    join public.hotel_profiles hotel_profile
      on hotel_profile.company_id = branch_record.company_id
     and hotel_profile.branch_id = branch_record.id
   where branch_record.company_id = p_company_id
     and branch_record.branch_type = 'HOTEL'
     and branch_record.status = 'ACTIVE'
     and hotel_profile.hotel_status = 'ACTIVE'
     and public.hotel_calendar_permission_allowed_v1(
       p_company_id, branch_record.id, p_user_id, 'HOTEL_CALENDAR_READ'
     )
     and (
       (
         p_user_type = 'INTERNAL_STAFF'
         and exists (
           select 1 from public.hotel_staff_assignments assignment
            where assignment.company_id = p_company_id
              and assignment.branch_id = branch_record.id
              and assignment.user_id = p_user_id
              and assignment.terminated_at is null
              and assignment.start_date <= (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date
              and (assignment.end_date is null or assignment.end_date >= (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date)
         )
       )
       or (
         p_user_type = 'HOUSEKEEPING'
         and exists (
           select 1 from public.housekeeping_hotel_links link
            where link.company_id = p_company_id
              and link.branch_id = branch_record.id
              and link.user_id = p_user_id
              and link.terminated_at is null
              and link.start_date <= (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date
              and (link.end_date is null or link.end_date >= (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date)
         )
       )
     )
   order by branch_record.name, branch_record.id
$function$;
revoke all on function public.hotel_calendar_accessible_hotels_v1(uuid, uuid, text) from public;

create function public.hotel_calendar_capabilities_v1(
  p_company_id uuid,
  p_session_token text
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql volatile security definer set search_path = pg_catalog
as $function$
declare
  v_actor record;
  v_snapshot jsonb;
begin
  select * into v_actor
    from public.hotel_calendar_actor_v1(p_company_id, p_session_token);
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  select pg_catalog.jsonb_build_object(
    'canViewAllHotels',
      v_actor.user_type = 'INTERNAL_STAFF'
      and public.hotel_calendar_permission_allowed_v1(
        p_company_id, null, v_actor.user_id, 'HOTEL_CALENDAR_ALL_READ'
      ),
    'hotels', coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', hotel.branch_id,
        'name', hotel.hotel_name,
        'canCreateVisit', hotel.can_create_visit
      ) order by hotel.hotel_name, hotel.branch_id
    ), '[]'::jsonb)
  ) into v_snapshot
    from public.hotel_calendar_accessible_hotels_v1(
      p_company_id, v_actor.user_id, v_actor.user_type
    ) hotel;

  return query select 'OK'::text, v_snapshot;
end
$function$;
revoke all on function public.hotel_calendar_capabilities_v1(uuid, text) from public;

create function public.hotel_calendar_events_read_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_query jsonb,
  p_session_token text
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql volatile security definer set search_path = pg_catalog
as $function$
declare
  v_actor record;
  v_from date;
  v_to date;
  v_page_size integer;
  v_cursor jsonb;
  v_all jsonb;
  v_page jsonb;
  v_visible_page jsonb;
  v_last jsonb;
  v_next_cursor text;
  v_hotels jsonb;
  v_can_all boolean;
  v_can_create boolean;
  v_more boolean;
  v_density integer;
begin
  select * into v_actor
    from public.hotel_calendar_actor_v1(p_company_id, p_session_token);
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  begin
    v_from := (p_query ->> 'from')::date;
    v_to := (p_query ->> 'to')::date;
    v_page_size := coalesce((p_query ->> 'pageSize')::integer, 200);
  exception when others then
    return query select 'CALENDAR_RANGE_INVALID'::text, null::jsonb;
    return;
  end;
  if v_to <= v_from then
    return query select 'CALENDAR_RANGE_INVALID'::text, null::jsonb;
    return;
  end if;
  if v_to - v_from > 42 then
    return query select 'CALENDAR_RANGE_TOO_LARGE'::text, null::jsonb;
    return;
  end if;
  if v_page_size < 1 or v_page_size > 200 then
    return query select 'VALIDATION_ERROR'::text, null::jsonb;
    return;
  end if;

  if nullif(p_query ->> 'cursor', '') is not null then
    begin
      v_cursor := pg_catalog.convert_from(
        pg_catalog.decode(p_query ->> 'cursor', 'hex'), 'UTF8'
      )::jsonb;
      perform (v_cursor ->> 'startsAt')::timestamptz;
      perform (v_cursor ->> 'id')::uuid;
      if v_cursor ->> 'type' not in ('INSPECTION', 'REPAIR_VISIT') then
        raise invalid_text_representation;
      end if;
    exception when others then
      return query select 'CALENDAR_CURSOR_INVALID'::text, null::jsonb;
      return;
    end;
  end if;

  v_can_all := v_actor.user_type = 'INTERNAL_STAFF'
    and public.hotel_calendar_permission_allowed_v1(
      p_company_id, null, v_actor.user_id, 'HOTEL_CALENDAR_ALL_READ'
    );
  if p_branch_id is null and not v_can_all then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.hotel_calendar_accessible_hotels_v1(
      p_company_id, v_actor.user_id, v_actor.user_type
    ) hotel where hotel.branch_id = p_branch_id
  ) then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  select pg_catalog.count(*) into v_density
    from (
      select inspection.id
        from public.hotel_inspections inspection
       where inspection.company_id = p_company_id
         and (p_branch_id is null or inspection.branch_id = p_branch_id)
         and inspection.business_date >= v_from
         and inspection.business_date < v_to
         and exists (
           select 1 from public.hotel_calendar_accessible_hotels_v1(
             p_company_id, v_actor.user_id, v_actor.user_type
           ) hotel where hotel.branch_id = inspection.branch_id
         )
         and public.hotel_calendar_permission_allowed_v1(
           p_company_id, inspection.branch_id, v_actor.user_id, 'HOTEL_INSPECTION_RUN'
         )
      union all
      select visit.id
        from public.hotel_repair_visits visit
       where visit.company_id = p_company_id
         and (p_branch_id is null or visit.branch_id = p_branch_id)
         and visit.status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')
         and visit.starts_at < (v_to::timestamp at time zone 'Asia/Seoul')
         and visit.ends_at > (v_from::timestamp at time zone 'Asia/Seoul')
         and exists (
           select 1 from public.hotel_calendar_accessible_hotels_v1(
             p_company_id, v_actor.user_id, v_actor.user_type
           ) hotel where hotel.branch_id = visit.branch_id
         )
         and public.hotel_calendar_permission_allowed_v1(
           p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_READ'
         )
         and (
           visit.status <> 'CANCELLED'
           or public.hotel_calendar_permission_allowed_v1(
             p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_VISIT_CANCELLED_READ'
           )
         )
         and (
           v_actor.user_type = 'INTERNAL_STAFF'
           or exists (
             select 1 from public.hotel_repair_visit_performers performer
              where performer.company_id = visit.company_id
                and performer.branch_id = visit.branch_id
                and performer.repair_visit_id = visit.id
                and performer.performer_type = 'INTERNAL'
                and performer.internal_user_id = v_actor.user_id
           )
         )
       limit 5001
    ) bounded_candidates;
  if v_density > 5000 then
    return query select 'CALENDAR_RESULT_TOO_DENSE'::text, null::jsonb;
    return;
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    event_record.event_json
    order by event_record.sort_at, event_record.event_type, event_record.event_id
  ), '[]'::jsonb)
  into v_all
  from (
    select inspection.due_at as sort_at,
           'INSPECTION'::text as event_type,
           inspection.id as event_id,
           pg_catalog.jsonb_build_object(
             'id', inspection.id,
             'type', 'INSPECTION',
             'hotelId', inspection.branch_id,
             'hotelName', branch_record.name,
             'title', '점검 마감',
             'businessDate', inspection.business_date,
             'startsAt', pg_catalog.to_char(inspection.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'endsAt', null,
             'status', inspection.status,
             'targetSummary', pg_catalog.concat(
               (select pg_catalog.count(*) from public.inspection_execution_targets target
                 where target.company_id = inspection.company_id
                   and target.branch_id = inspection.branch_id
                   and target.execution_id = inspection.id), '개 대상'
             ),
             'detailHref', '/hotels/' || inspection.branch_id::text || '/inspections'
           ) as event_json
      from public.hotel_inspections inspection
      join public.branches branch_record
        on branch_record.company_id = inspection.company_id
       and branch_record.id = inspection.branch_id
     where inspection.company_id = p_company_id
       and (p_branch_id is null or inspection.branch_id = p_branch_id)
       and inspection.business_date >= v_from
       and inspection.business_date < v_to
       and exists (
         select 1 from public.hotel_calendar_accessible_hotels_v1(
           p_company_id, v_actor.user_id, v_actor.user_type
         ) hotel where hotel.branch_id = inspection.branch_id
       )
       and public.hotel_calendar_permission_allowed_v1(
         p_company_id, inspection.branch_id, v_actor.user_id, 'HOTEL_INSPECTION_RUN'
       )
    union all
    select visit.starts_at as sort_at,
           'REPAIR_VISIT'::text as event_type,
           visit.id as event_id,
           pg_catalog.jsonb_build_object(
             'id', visit.id,
             'type', 'REPAIR_VISIT',
             'hotelId', visit.branch_id,
             'hotelName', branch_record.name,
             'title', visit.title,
             'startsAt', pg_catalog.to_char(visit.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'endsAt', pg_catalog.to_char(visit.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'status', visit.status,
             'targetSummary', repair.target_name_snapshot,
             'priority', pg_catalog.jsonb_build_object(
               'name', repair.priority_name_snapshot,
               'color', repair.priority_color_snapshot
             ),
             'calendarProjectionStatus', 'NOT_CONNECTED',
             'cancellationReason', case
               when visit.status = 'CANCELLED'
                and public.hotel_calendar_permission_allowed_v1(
                  p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_VISIT_CANCEL_REASON_READ'
                ) then visit.cancel_reason
               else null
             end,
             'canUpdate',
               v_actor.user_type = 'INTERNAL_STAFF'
               and public.hotel_calendar_permission_allowed_v1(
                 p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_VISIT_UPDATE'
               ),
             'detailHref', '/hotels/' || visit.branch_id::text || '/repairs'
           ) as event_json
      from public.hotel_repair_visits visit
      join public.hotel_repair_cases repair
        on repair.company_id = visit.company_id
       and repair.branch_id = visit.branch_id
       and repair.id = visit.repair_case_id
      join public.branches branch_record
        on branch_record.company_id = visit.company_id
       and branch_record.id = visit.branch_id
     where visit.company_id = p_company_id
       and (p_branch_id is null or visit.branch_id = p_branch_id)
       and visit.status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')
       and visit.starts_at < (v_to::timestamp at time zone 'Asia/Seoul')
       and visit.ends_at > (v_from::timestamp at time zone 'Asia/Seoul')
       and exists (
         select 1 from public.hotel_calendar_accessible_hotels_v1(
           p_company_id, v_actor.user_id, v_actor.user_type
         ) hotel where hotel.branch_id = visit.branch_id
       )
       and public.hotel_calendar_permission_allowed_v1(
         p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_READ'
       )
       and (
         visit.status <> 'CANCELLED'
         or public.hotel_calendar_permission_allowed_v1(
           p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_VISIT_CANCELLED_READ'
         )
       )
       and (
         v_actor.user_type = 'INTERNAL_STAFF'
         or exists (
           select 1 from public.hotel_repair_visit_performers performer
            where performer.company_id = visit.company_id
              and performer.branch_id = visit.branch_id
              and performer.repair_visit_id = visit.id
              and performer.performer_type = 'INTERNAL'
              and performer.internal_user_id = v_actor.user_id
         )
       )
  ) event_record;

  select coalesce(pg_catalog.jsonb_agg(filtered.event order by filtered.ordinality), '[]'::jsonb)
    into v_page
    from (
      select item.value as event, item.ordinality
        from pg_catalog.jsonb_array_elements(v_all) with ordinality item(value, ordinality)
       where v_cursor is null
          or (
            (item.value ->> 'startsAt')::timestamptz,
            item.value ->> 'type',
            (item.value ->> 'id')::uuid
          ) > (
            (v_cursor ->> 'startsAt')::timestamptz,
            v_cursor ->> 'type',
            (v_cursor ->> 'id')::uuid
          )
       order by (item.value ->> 'startsAt')::timestamptz,
                item.value ->> 'type',
                (item.value ->> 'id')::uuid
       limit v_page_size + 1
    ) filtered;

  v_more := pg_catalog.jsonb_array_length(v_page) > v_page_size;
  select coalesce(pg_catalog.jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
    into v_visible_page
    from pg_catalog.jsonb_array_elements(v_page) with ordinality item(value, ordinality)
   where item.ordinality <= v_page_size;
  if v_more then
    v_last := v_visible_page -> (pg_catalog.jsonb_array_length(v_visible_page) - 1);
    v_next_cursor := pg_catalog.encode(pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'startsAt', v_last ->> 'startsAt',
        'type', v_last ->> 'type',
        'id', v_last ->> 'id'
      )::text, 'UTF8'
    ), 'hex');
  else
    v_next_cursor := null;
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('id', hotel.branch_id, 'name', hotel.hotel_name)
    order by hotel.hotel_name, hotel.branch_id
  ), '[]'::jsonb),
  coalesce(pg_catalog.bool_or(hotel.branch_id = p_branch_id and hotel.can_create_visit), false)
  into v_hotels, v_can_create
  from public.hotel_calendar_accessible_hotels_v1(
    p_company_id, v_actor.user_id, v_actor.user_type
  ) hotel;

  return query select 'OK'::text, pg_catalog.jsonb_build_object(
    'events', v_visible_page,
    'pagination', pg_catalog.jsonb_build_object('nextCursor', v_next_cursor),
    'range', pg_catalog.jsonb_build_object(
      'from', v_from, 'to', v_to, 'timeZone', 'Asia/Seoul'
    ),
    'hotels', v_hotels,
    'capabilities', pg_catalog.jsonb_build_object(
      'canCreateVisit', case when p_branch_id is null then false else v_can_create end,
      'canViewAllHotels', v_can_all
    )
  );
end
$function$;
revoke all on function public.hotel_calendar_events_read_v1(uuid, uuid, jsonb, text) from public;

create function public.hotel_calendar_visit_options_read_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_session_token text
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql volatile security definer set search_path = pg_catalog
as $function$
declare
  v_actor record;
  v_snapshot jsonb;
begin
  select * into v_actor
    from public.hotel_calendar_actor_v1(p_company_id, p_session_token);
  if not found or v_actor.user_type <> 'INTERNAL_STAFF' then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;
  if not exists (
    select 1 from public.hotel_calendar_accessible_hotels_v1(
      p_company_id, v_actor.user_id, v_actor.user_type
    ) hotel
     where hotel.branch_id = p_branch_id
       and hotel.can_create_visit
  ) then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  select pg_catalog.jsonb_build_object(
    'repairs', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', repair.id,
        'targetName', repair.target_name_snapshot,
        'priorityName', repair.priority_name_snapshot
      ) order by repair.updated_at desc, repair.id)
        from (
          select * from public.hotel_repair_cases candidate
           where candidate.company_id = p_company_id
             and candidate.branch_id = p_branch_id
             and candidate.status = 'OPEN'
           order by candidate.updated_at desc, candidate.id
           limit 500
        ) repair
    ), '[]'::jsonb),
    'internalPerformers', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'userId', app_user.id,
        'displayName', app_user.display_name
      ) order by app_user.display_name, app_user.id)
        from (
          select candidate.* from public.users candidate
           where candidate.company_id = p_company_id
             and candidate.status = 'ACTIVE'
             and candidate.user_type in ('INTERNAL_STAFF', 'HOUSEKEEPING')
             and exists (
               select 1 from public.hotel_staff_assignments assignment
                where assignment.company_id = p_company_id
                  and assignment.branch_id = p_branch_id
                  and assignment.user_id = candidate.id
                  and assignment.terminated_at is null
                  and assignment.start_date <= (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date
                  and (assignment.end_date is null or assignment.end_date >= (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date)
             )
             and public.hotel_calendar_permission_allowed_v1(
               p_company_id, p_branch_id, candidate.id, 'REPAIR_VISIT_UPDATE'
             )
           order by candidate.display_name, candidate.id
           limit 500
        ) app_user
    ), '[]'::jsonb)
  ) into v_snapshot;

  return query select 'OK'::text, v_snapshot;
end
$function$;
revoke all on function public.hotel_calendar_visit_options_read_v1(uuid, uuid, text) from public;

-- Existing calendar source tables already have RLS and FORCE ROW LEVEL SECURITY.
-- Runtime EXECUTE grants are applied only by capability-aware provisioning.
insert into public.schema_migrations(version)
values ('0043_hotel_calendar_read_model')
on conflict(version) do nothing;

commit;
