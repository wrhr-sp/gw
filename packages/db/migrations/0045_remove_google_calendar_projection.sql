begin;

-- PostgreSQL inspection and repair schedules remain canonical. Remove only the retired
-- Google Calendar projection surface, after restoring canonical JSON contracts.
do $calendar_disposition_preflight$
declare
  relation_name text;
  relation_has_rows boolean;
begin
  foreach relation_name in array array[
    'calendar_connection_credentials',
    'calendar_connections',
    'calendar_oauth_transactions',
    'calendar_hotel_links',
    'calendar_event_links',
    'calendar_projection_jobs',
    'calendar_projection_attempts',
    'calendar_sync_failures',
    'calendar_catch_up_items'
  ] loop
    if pg_catalog.to_regclass('public.' || relation_name) is not null then
      execute pg_catalog.format(
        'select exists(select 1 from public.%I where true)',
        relation_name
      ) into relation_has_rows;
      if relation_has_rows then
        raise exception using
          errcode = 'P0001',
          message = 'GOOGLE_CALENDAR_DISPOSITION_REQUIRED';
      end if;
    end if;
  end loop;
end
$calendar_disposition_preflight$;

drop trigger if exists calendar_projection_visit_signal on public.hotel_repair_visits;
drop function if exists public.calendar_projection_visit_signal_v1();

create or replace function public.repair_snapshot_v1(p_company_id uuid,p_branch_id uuid,p_repair_id uuid,p_show_contact boolean) returns jsonb language sql stable set search_path=pg_catalog as $function$
 select jsonb_build_object(
  'id',c.id,'hotelId',c.branch_id,'status',c.status,'version',c.version,
  'target',jsonb_build_object('type',c.target_type,'id',coalesce(c.room_id,c.common_area_id,c.facility_id),'name',c.target_name_snapshot,'facilityTypeName',c.facility_type_name_snapshot,'locationName',c.location_name_snapshot),
  'priority',jsonb_build_object('id',c.priority_id,'version',c.priority_version_snapshot,'name',c.priority_name_snapshot,'sortOrder',c.priority_sort_order_snapshot,'color',c.priority_color_snapshot),
  'source',case when c.source_type='INSPECTION' then jsonb_build_object('type','INSPECTION','inspectionId',c.inspection_id,'executionTargetId',c.inspection_execution_target_id,'itemSnapshotId',c.inspection_item_snapshot_id,'resultId',c.inspection_result_id,'resultVersion',c.inspection_result_version) else jsonb_build_object('type','DIRECT','description',c.defect_description,'fileVersionIds',to_jsonb(c.defect_file_version_ids),'unavailableReason',c.defect_unavailable_reason) end,
  'process',jsonb_build_object('executionId',p.id,'version',p.version,'state',p.state,'currentStageName',p.current_stage_name),
  'visits',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'repairCaseId',v.repair_case_id,'title',v.title,'startsAt',to_char(v.starts_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'endsAt',to_char(v.ends_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'status',v.status,'version',v.version,'performer',case when pf.performer_type='INTERNAL' then jsonb_build_object('type','INTERNAL','userId',pf.internal_user_id) else jsonb_build_object('type','EXTERNAL','contractorName',pf.contractor_name,'contactName',case when p_show_contact then pf.contact_name else null end,'contactPhone',case when p_show_contact then pf.contact_phone else regexp_replace(pf.contact_phone,'.(?=.{2})','*','g') end) end,'result',v.result,'unavailableReason',v.completion_unavailable_reason,'fileVersionIds',to_jsonb(v.completion_file_version_ids)) order by v.starts_at,v.id) from public.hotel_repair_visits v join public.hotel_repair_visit_performers pf on pf.company_id=v.company_id and pf.branch_id=v.branch_id and pf.repair_visit_id=v.id where v.company_id=c.company_id and v.branch_id=c.branch_id and v.repair_case_id=c.id),'[]'::jsonb),
  'predecessor',(select jsonb_build_object('id',parent.id,'targetName',parent.target_name_snapshot,'completedAt',to_char(parent.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) from public.hotel_repair_cases parent where parent.company_id=c.company_id and parent.branch_id=c.branch_id and parent.id=c.follow_up_of_repair_case_id),
  'followUpCount',(select count(*) from public.hotel_repair_cases child where child.company_id=c.company_id and child.branch_id=c.branch_id and child.follow_up_of_repair_case_id=c.id),
  'createdAt',to_char(c.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(c.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 ) from public.hotel_repair_cases c join public.process_executions p on p.company_id=c.company_id and p.id=c.process_execution_id where c.company_id=p_company_id and c.branch_id=p_branch_id and c.id=p_repair_id
$function$;
revoke all on function public.repair_snapshot_v1(uuid,uuid,uuid,boolean) from public;

create or replace function public.hotel_calendar_events_read_v1(
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

drop function if exists public.calendar_projection_evidence_read_v1(uuid,text,bytea,uuid,integer,uuid,timestamptz);
drop function if exists public.calendar_projection_finalize_v1(uuid,uuid,bytea,text,text,text,timestamptz,bytea,bytea,integer,integer);
drop function if exists public.calendar_projection_repair_stale_v1(uuid,uuid);
drop function if exists public.calendar_projection_reset_event_existence_v1(uuid,uuid,bytea);
drop function if exists public.calendar_projection_mark_create_dispatched_v1(uuid,uuid,bytea);
drop function if exists public.calendar_projection_claim_v1(uuid,bytea,integer);
drop function if exists public.calendar_repair_projection_status_v1(uuid,uuid,uuid);
drop function if exists public.calendar_visit_projection_status_v1(uuid,uuid,uuid);
drop function if exists public.calendar_projection_failure_retry_v1(uuid,uuid,text,uuid,integer,text,uuid,text,text,text);
drop function if exists public.calendar_hotel_link_command_v1(uuid,uuid,uuid,text,text,integer,integer,integer,uuid,bytea,bytea,integer,bytea,text,uuid,text,text,text);
drop function if exists public.calendar_connection_command_v1(uuid,uuid,text,text,integer,uuid,integer,jsonb,text,uuid,text,text,text);
drop function if exists public.calendar_candidate_finalize_v1(uuid,uuid,bytea,integer,integer,text,text,timestamptz);
drop function if exists public.calendar_candidate_claim_v1(uuid,bytea);
drop function if exists public.calendar_oauth_finalize_v1(uuid,bytea,uuid,uuid,integer,bytea,bytea,integer,bytea,integer,text[]);
drop function if exists public.calendar_oauth_fail_v1(uuid,bytea,text);
drop function if exists public.calendar_oauth_claim_v1(bytea,bytea,bytea);
drop function if exists public.calendar_oauth_start_v1(uuid,text,uuid,bytea,bytea,bytea,bytea,bytea,integer,text,boolean,integer,integer,uuid,text,text,text);
drop function if exists public.calendar_authorization_lock_v1(uuid,uuid,uuid);
drop function if exists public.calendar_connection_status_read_v1(uuid,text);
drop function if exists public.calendar_connection_manage_hotel_allowed_v1(uuid,uuid,uuid);

alter table if exists public.calendar_connections
  drop constraint if exists calendar_connections_active_credential_fk;

drop table if exists public.calendar_catch_up_items;
drop table if exists public.calendar_sync_failures;
drop table if exists public.calendar_projection_attempts;
drop table if exists public.calendar_projection_jobs;
drop table if exists public.calendar_event_links;
drop table if exists public.calendar_hotel_links;
drop table if exists public.calendar_oauth_transactions;
drop table if exists public.calendar_crypto_settings;
drop table if exists public.calendar_connection_credentials;
drop table if exists public.calendar_connections;

delete from public.permission_grants
 where permission_code in ('CALENDAR_CONNECTION_MANAGE', 'CALENDAR_PROJECTION_RETRY');
delete from public.permissions
 where code in ('CALENDAR_CONNECTION_MANAGE', 'CALENDAR_PROJECTION_RETRY');

insert into public.schema_migrations(version)
values('0045_remove_google_calendar_projection')
on conflict(version) do nothing;

commit;
