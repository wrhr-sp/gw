begin;

alter table hotel_room_status_history
  add column change_source text not null default 'LEGACY_USER';

alter table hotel_room_status_history
  alter column changed_by drop not null,
  drop constraint hotel_room_status_history_previous_status_check,
  drop constraint hotel_room_status_history_next_status_check,
  drop constraint hotel_room_status_history_resume_shape;

alter table hotel_room_status_history
  add constraint hotel_room_status_history_previous_status_check
    check (previous_status in (
      'ACTIVE', 'INACTIVE', 'DELETED', 'TEMP_SUSPENDED', 'OUT_OF_SERVICE'
    )),
  add constraint hotel_room_status_history_next_status_check
    check (next_status in (
      'ACTIVE', 'INACTIVE', 'DELETED', 'TEMP_SUSPENDED', 'OUT_OF_SERVICE'
    )),
  add constraint hotel_room_status_history_source_shape check (
    (
      change_source = 'LEGACY_USER'
      and changed_by is not null
      and previous_status in ('ACTIVE', 'TEMP_SUSPENDED', 'OUT_OF_SERVICE')
      and next_status in ('ACTIVE', 'TEMP_SUSPENDED', 'OUT_OF_SERVICE')
    )
    or (
      change_source = 'SYSTEM_LIFECYCLE_MIGRATION'
      and changed_by is null
      and previous_status in ('TEMP_SUSPENDED', 'OUT_OF_SERVICE')
      and next_status = 'INACTIVE'
    )
    or (
      change_source = 'USER'
      and changed_by is not null
      and (
        (previous_status = 'ACTIVE' and next_status = 'INACTIVE')
        or (
          previous_status = 'INACTIVE'
          and next_status in ('ACTIVE', 'DELETED')
        )
      )
      and planned_resume_date is null
    )
  );

do $preflight$
begin
  if exists (
    select 1
      from public.hotel_rooms room
     where pg_catalog.btrim(room.room_number)
             !~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$'
  ) then
    raise exception 'HOTEL_ROOM_NUMBER_UNSUPPORTED'
      using errcode = '23514';
  end if;
  if exists (
    select 1
      from public.hotel_rooms room
     group by room.company_id, room.branch_id,
              pg_catalog.upper(pg_catalog.btrim(room.room_number))
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'HOTEL_ROOM_CANONICAL_COLLISION'
      using errcode = '23505';
  end if;
end
$preflight$;

alter table hotel_rooms
  drop constraint hotel_rooms_company_id_branch_id_room_number_key,
  drop constraint hotel_rooms_status_check,
  drop constraint hotel_rooms_resume_shape;

insert into hotel_room_status_history (
  id,
  company_id,
  branch_id,
  room_id,
  previous_status,
  next_status,
  reason,
  planned_resume_date,
  changed_by,
  changed_at,
  change_source
)
select
  pg_catalog.gen_random_uuid(),
  room.company_id,
  room.branch_id,
  room.id,
  room.status,
  'INACTIVE',
  'SYSTEM_LIFECYCLE_MIGRATION',
  room.planned_resume_date,
  null,
  transaction_timestamp(),
  'SYSTEM_LIFECYCLE_MIGRATION'
from hotel_rooms room
where room.status in ('TEMP_SUSPENDED', 'OUT_OF_SERVICE');

update hotel_rooms room
set status = 'INACTIVE',
    version = room.version + 1,
    updated_at = transaction_timestamp()
where room.status in ('TEMP_SUSPENDED', 'OUT_OF_SERVICE');

alter table hotel_rooms
  drop column planned_resume_date,
  add constraint hotel_rooms_status_check
    check (status in ('ACTIVE', 'INACTIVE', 'DELETED'));

update hotel_rooms
set room_number = pg_catalog.upper(pg_catalog.btrim(room_number))
where room_number is distinct from pg_catalog.upper(pg_catalog.btrim(room_number));

alter table hotel_rooms
  add constraint hotel_rooms_room_number_canonical_check
    check (
      room_number = pg_catalog.upper(pg_catalog.btrim(room_number))
      and room_number ~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$'
    );

create unique index hotel_rooms_live_room_number_key
on hotel_rooms (company_id, branch_id, room_number)
where status <> 'DELETED';

create function public.reject_deleted_hotel_room_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status = 'DELETED' then
    raise exception 'hotel room deletion is terminal' using errcode = '55000';
  end if;
  if new.status = 'DELETED' and old.status <> 'INACTIVE' then
    raise exception 'active hotel room cannot be deleted' using errcode = '55000';
  end if;
  return new;
end
$$;
revoke all on function public.reject_deleted_hotel_room_change() from public;

create trigger hotel_rooms_deleted_immutable
before update on hotel_rooms
for each row execute function public.reject_deleted_hotel_room_change();

alter table hotel_room_status_history
  alter column change_source set default 'USER';

create function public.enforce_new_hotel_room_history_insert()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.change_source <> 'USER' then
    raise exception 'hotel room history source is not writable' using errcode = '55000';
  end if;
  return new;
end
$$;
revoke all on function public.enforce_new_hotel_room_history_insert() from public;

create trigger hotel_room_status_history_insert_guard
before insert on hotel_room_status_history
for each row execute function public.enforce_new_hotel_room_history_insert();

create function public.hotel_room_lifecycle_command_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_room_id uuid,
  p_expected_version integer,
  p_next_status text,
  p_reason text,
  p_history_id uuid,
  p_audit_event_id uuid,
  p_idempotency_record_id uuid,
  p_idempotency_key text,
  p_http_method text,
  p_operation_path text,
  p_request_hash text,
  p_session_token text,
  p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_actor record;
  v_current record;
  v_existing record;
  v_allowed boolean := false;
  v_snapshot jsonb;
  v_event_code text;
begin
  if not public.runtime_has_capability('API_RUNTIME') then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;
  if p_expected_version < 1
     or p_next_status not in ('ACTIVE', 'INACTIVE', 'DELETED')
     or pg_catalog.char_length(pg_catalog.btrim(p_reason)) < 2
     or pg_catalog.char_length(pg_catalog.btrim(p_reason)) > 500
     or pg_catalog.btrim(p_idempotency_key) = ''
     or p_http_method <> 'POST'
     or pg_catalog.btrim(p_operation_path) = ''
     or pg_catalog.btrim(p_request_hash) = ''
     or p_session_token !~ '^[A-Za-z0-9_-]{43}$'
     or p_trace_id is null then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;

  select session_record.id as session_id,
         app_user.id as user_id,
         app_user.user_type
    into v_actor
    from public.auth_sessions session_record
    join public.users app_user
      on app_user.company_id = session_record.company_id
     and app_user.id = session_record.user_id
    join public.companies company_record on company_record.id = app_user.company_id
   where session_record.id = nullif(
           pg_catalog.current_setting('app.session_id', true), ''
         )::uuid
     and session_record.company_id = p_company_id
     and session_record.token_hash = pg_catalog.sha256(
           pg_catalog.convert_to(p_session_token, 'UTF8')
         )
     and session_record.revoked_at is null
     and session_record.idle_expires_at > v_now
     and session_record.absolute_expires_at > v_now
     and app_user.status = 'ACTIVE'
     and app_user.user_type = 'INTERNAL_STAFF'
     and company_record.status = 'ACTIVE';
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_company_id::text || ':' || v_actor.user_id::text || ':' || p_idempotency_key || ':' ||
    p_http_method || ':' || p_operation_path,
    0
  ));
  delete from public.idempotency_records
   where company_id = p_company_id
     and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key
     and http_method = p_http_method
     and operation_path = p_operation_path
     and expires_at <= v_now;

  with effective_subjects as (
    select 'USER'::text as subject_type, v_actor.user_id::uuid as subject_id
    union all
    select 'ROLE', membership.role_id
      from public.user_role_memberships membership
      join public.roles role_record
        on role_record.company_id = membership.company_id
       and role_record.id = membership.role_id
     where membership.company_id = p_company_id
       and membership.user_id = v_actor.user_id
       and membership.valid_from <= v_now
       and (membership.valid_until is null or membership.valid_until > v_now)
       and role_record.status = 'ACTIVE'
    union all
    select 'GROUP', membership.group_id
      from public.user_group_memberships membership
      join public.user_groups group_record
        on group_record.company_id = membership.company_id
       and group_record.id = membership.group_id
     where membership.company_id = p_company_id
       and membership.user_id = v_actor.user_id
       and membership.valid_from <= v_now
       and (membership.valid_until is null or membership.valid_until > v_now)
       and group_record.status = 'ACTIVE'
  ), permission_effects as (
    select grant_record.branch_id, grant_record.effect
      from public.permission_grants grant_record
      join effective_subjects subject_record
        on subject_record.subject_type = grant_record.subject_type
       and subject_record.subject_id = grant_record.subject_id
     where grant_record.company_id = p_company_id
       and grant_record.permission_code = 'HOTEL_ROOM_MANAGE'
       and (grant_record.branch_id is null or grant_record.branch_id = p_branch_id)
       and grant_record.valid_from <= v_now
       and (grant_record.valid_until is null or grant_record.valid_until > v_now)
  )
  select exists (
           select 1 from public.branches branch_record
            where branch_record.company_id = p_company_id
              and branch_record.id = p_branch_id
              and branch_record.branch_type = 'HOTEL'
         )
         and not exists (select 1 from permission_effects where effect = 'DENY')
         and exists (select 1 from permission_effects where effect = 'ALLOW')
         and exists (
           select 1 from public.hotel_staff_assignments assignment
            where assignment.company_id = p_company_id
              and assignment.branch_id = p_branch_id
              and assignment.user_id = v_actor.user_id
              and assignment.terminated_at is null
              and assignment.start_date <= v_now::date
              and (assignment.end_date is null or assignment.end_date >= v_now::date)
         )
    into v_allowed;
  if not v_allowed then
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
    ) values (
      p_audit_event_id, 'HOTEL_ROOM_ACCESS_DENIED', v_actor.user_id,
      v_actor.user_type, v_actor.session_id, p_company_id, null,
      'HOTEL_ROOM', p_room_id,
      pg_catalog.jsonb_build_object('operation', p_operation_path, 'outcome', 'DENIED'),
      null, 'DENIED', p_trace_id
    );
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  select existing_record.request_hash, existing_record.result_snapshot
    into v_existing
    from public.idempotency_records existing_record
   where existing_record.company_id = p_company_id
     and existing_record.actor_user_id = v_actor.user_id
     and existing_record.idempotency_key = p_idempotency_key
     and existing_record.http_method = p_http_method
     and existing_record.operation_path = p_operation_path
     and existing_record.status = 'COMPLETED'
     and existing_record.expires_at > v_now;
  if found then
    if v_existing.request_hash <> p_request_hash then
      return query select 'IDEMPOTENCY_CONFLICT'::text, null::jsonb;
    else
      return query select 'REPLAYED'::text, v_existing.result_snapshot;
    end if;
    return;
  end if;

  select room.status, room.version
    into v_current
    from public.hotel_rooms room
   where room.company_id = p_company_id
     and room.branch_id = p_branch_id
     and room.id = p_room_id
   for update;
  if not found then
    return query select 'NOT_FOUND'::text, null::jsonb;
    return;
  end if;
  if v_current.version <> p_expected_version then
    return query select 'VERSION_CONFLICT'::text, null::jsonb;
    return;
  end if;
  if not (
    (v_current.status = 'ACTIVE' and p_next_status = 'INACTIVE')
    or (v_current.status = 'INACTIVE' and p_next_status in ('ACTIVE', 'DELETED'))
  ) then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;

  update public.hotel_rooms
     set status = p_next_status,
         version = version + 1,
         updated_by = v_actor.user_id,
         updated_at = v_now
   where company_id = p_company_id
     and branch_id = p_branch_id
     and id = p_room_id
     and version = p_expected_version;
  if not found then
    return query select 'VERSION_CONFLICT'::text, null::jsonb;
    return;
  end if;
  insert into public.hotel_room_status_history (
    id, company_id, branch_id, room_id, previous_status, next_status,
    reason, changed_by, change_source
  ) values (
    p_history_id, p_company_id, p_branch_id, p_room_id,
    v_current.status, p_next_status, p_reason, v_actor.user_id, 'USER'
  );

  select pg_catalog.jsonb_build_object(
           'id', room.id,
           'hotelId', room.branch_id,
           'roomNumber', room.room_number,
           'floorLabel', room.floor_label,
           'floorSortKey', room.floor_sort_key,
           'roomType', pg_catalog.jsonb_build_object(
             'id', room_type.id,
             'name', room_type.name,
             'scope', room_type.scope
           ),
           'status', room.status,
           'internalNote', room.internal_note,
           'ownerVisibleNote', room.owner_visible_note,
           'version', room.version,
           'createdAt', pg_catalog.to_char(room.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'updatedAt', pg_catalog.to_char(room.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         )
    into v_snapshot
    from public.hotel_rooms room
    join public.hotel_room_types room_type
      on room_type.company_id = room.company_id
     and room_type.id = room.room_type_id
   where room.company_id = p_company_id
     and room.branch_id = p_branch_id
     and room.id = p_room_id;
  v_event_code := case
    when p_next_status = 'DELETED' then 'HOTEL_ROOM_DELETED'
    else 'HOTEL_ROOM_STATUS_CHANGED'
  end;
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id, v_event_code, v_actor.user_id, v_actor.user_type,
    v_actor.session_id, p_company_id, p_branch_id, 'HOTEL_ROOM', p_room_id,
    pg_catalog.jsonb_build_object(
      'resourceId', p_room_id,
      'status', p_next_status,
      'version', p_expected_version + 1
    ), p_reason, 'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id,
    p_idempotency_key, p_http_method, p_operation_path, p_request_hash,
    'COMPLETED', 'HOTEL_ROOM', p_room_id, p_audit_event_id,
    v_snapshot, v_now, v_now + interval '24 hours'
  );
  return query select 'STATUS_CHANGED'::text, v_snapshot;
end
$function$;
revoke all on function public.hotel_room_lifecycle_command_v1(
  uuid, uuid, uuid, integer, text, text, uuid, uuid, uuid,
  text, text, text, text, text, uuid
) from public;

create function public.hotel_room_write_command_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_room_id uuid,
  p_action text,
  p_expected_version integer,
  p_value jsonb,
  p_audit_event_id uuid,
  p_idempotency_record_id uuid,
  p_idempotency_key text,
  p_http_method text,
  p_operation_path text,
  p_request_hash text,
  p_session_token text,
  p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_actor record;
  v_current record;
  v_existing record;
  v_allowed boolean := false;
  v_snapshot jsonb;
  v_room_type_id uuid;
  v_room_number text;
begin
  if not public.runtime_has_capability('API_RUNTIME') then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;
  if p_action not in ('CREATE', 'UPDATE')
     or p_value is null
     or pg_catalog.jsonb_typeof(p_value) <> 'object'
     or pg_catalog.btrim(p_idempotency_key) = ''
     or p_http_method <> (case when p_action = 'CREATE' then 'POST' else 'PATCH' end)
     or pg_catalog.btrim(p_operation_path) = ''
     or pg_catalog.btrim(p_request_hash) = ''
     or p_session_token !~ '^[A-Za-z0-9_-]{43}$'
     or p_trace_id is null then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  if p_action = 'CREATE' and (
       p_expected_version is not null
       or not (p_value ?& array[
         'roomNumber', 'floorLabel', 'floorSortKey', 'roomTypeId',
         'internalNote', 'ownerVisibleNote'
       ])
       or p_value - array[
         'roomNumber', 'floorLabel', 'floorSortKey', 'roomTypeId',
         'internalNote', 'ownerVisibleNote'
       ] <> '{}'::jsonb
     ) then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  if p_action = 'UPDATE' and (
       p_expected_version is null or p_expected_version < 1
       or not (p_value ?| array[
         'roomNumber', 'floorLabel', 'floorSortKey', 'roomTypeId',
         'internalNote', 'ownerVisibleNote'
       ])
       or p_value - array[
         'roomNumber', 'floorLabel', 'floorSortKey', 'roomTypeId',
         'internalNote', 'ownerVisibleNote'
       ] <> '{}'::jsonb
     ) then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;

  select session_record.id as session_id,
         app_user.id as user_id,
         app_user.user_type
    into v_actor
    from public.auth_sessions session_record
    join public.users app_user
      on app_user.company_id = session_record.company_id
     and app_user.id = session_record.user_id
    join public.companies company_record on company_record.id = app_user.company_id
   where session_record.id = nullif(
           pg_catalog.current_setting('app.session_id', true), ''
         )::uuid
     and session_record.company_id = p_company_id
     and session_record.token_hash = pg_catalog.sha256(
           pg_catalog.convert_to(p_session_token, 'UTF8')
         )
     and session_record.revoked_at is null
     and session_record.idle_expires_at > v_now
     and session_record.absolute_expires_at > v_now
     and app_user.status = 'ACTIVE'
     and app_user.user_type = 'INTERNAL_STAFF'
     and company_record.status = 'ACTIVE';
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_company_id::text || ':' || v_actor.user_id::text || ':' || p_idempotency_key || ':' ||
    p_http_method || ':' || p_operation_path,
    0
  ));
  delete from public.idempotency_records
   where company_id = p_company_id
     and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key
     and http_method = p_http_method
     and operation_path = p_operation_path
     and expires_at <= v_now;

  with effective_subjects as (
    select 'USER'::text as subject_type, v_actor.user_id::uuid as subject_id
    union all
    select 'ROLE', membership.role_id
      from public.user_role_memberships membership
      join public.roles role_record
        on role_record.company_id = membership.company_id
       and role_record.id = membership.role_id
     where membership.company_id = p_company_id
       and membership.user_id = v_actor.user_id
       and membership.valid_from <= v_now
       and (membership.valid_until is null or membership.valid_until > v_now)
       and role_record.status = 'ACTIVE'
    union all
    select 'GROUP', membership.group_id
      from public.user_group_memberships membership
      join public.user_groups group_record
        on group_record.company_id = membership.company_id
       and group_record.id = membership.group_id
     where membership.company_id = p_company_id
       and membership.user_id = v_actor.user_id
       and membership.valid_from <= v_now
       and (membership.valid_until is null or membership.valid_until > v_now)
       and group_record.status = 'ACTIVE'
  ), permission_effects as (
    select grant_record.branch_id, grant_record.effect
      from public.permission_grants grant_record
      join effective_subjects subject_record
        on subject_record.subject_type = grant_record.subject_type
       and subject_record.subject_id = grant_record.subject_id
     where grant_record.company_id = p_company_id
       and grant_record.permission_code = 'HOTEL_ROOM_MANAGE'
       and (grant_record.branch_id is null or grant_record.branch_id = p_branch_id)
       and grant_record.valid_from <= v_now
       and (grant_record.valid_until is null or grant_record.valid_until > v_now)
  )
  select exists (
           select 1 from public.branches branch_record
            where branch_record.company_id = p_company_id
              and branch_record.id = p_branch_id
              and branch_record.branch_type = 'HOTEL'
         )
         and not exists (select 1 from permission_effects where effect = 'DENY')
         and exists (select 1 from permission_effects where effect = 'ALLOW')
         and exists (
           select 1 from public.hotel_staff_assignments assignment
            where assignment.company_id = p_company_id
              and assignment.branch_id = p_branch_id
              and assignment.user_id = v_actor.user_id
              and assignment.terminated_at is null
              and assignment.start_date <= v_now::date
              and (assignment.end_date is null or assignment.end_date >= v_now::date)
         )
    into v_allowed;
  if not v_allowed then
    insert into public.audit_events (
      id, event_code, actor_user_id, actor_type, session_id, company_id,
      branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
    ) values (
      p_audit_event_id, 'HOTEL_ROOM_ACCESS_DENIED', v_actor.user_id,
      v_actor.user_type, v_actor.session_id, p_company_id, null,
      'HOTEL_ROOM', p_room_id,
      pg_catalog.jsonb_build_object('operation', p_operation_path, 'outcome', 'DENIED'),
      null, 'DENIED', p_trace_id
    );
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  select existing_record.request_hash, existing_record.result_snapshot
    into v_existing
    from public.idempotency_records existing_record
   where existing_record.company_id = p_company_id
     and existing_record.actor_user_id = v_actor.user_id
     and existing_record.idempotency_key = p_idempotency_key
     and existing_record.http_method = p_http_method
     and existing_record.operation_path = p_operation_path
     and existing_record.status = 'COMPLETED'
     and existing_record.expires_at > v_now;
  if found then
    if v_existing.request_hash <> p_request_hash then
      return query select 'IDEMPOTENCY_CONFLICT'::text, null::jsonb;
    else
      return query select 'REPLAYED'::text, v_existing.result_snapshot;
    end if;
    return;
  end if;

  begin
    v_room_number := pg_catalog.upper(pg_catalog.btrim(p_value ->> 'roomNumber'));
    v_room_type_id := (p_value ->> 'roomTypeId')::uuid;
  exception when others then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end;

  if p_value ? 'roomNumber'
     and (
       v_room_number is null
       or v_room_number !~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$'
     ) then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;

  if p_action = 'CREATE' then
    if v_room_number is null or v_room_number = ''
       or pg_catalog.length(v_room_number) > 40
       or pg_catalog.btrim(p_value ->> 'floorLabel') = ''
       or (p_value ->> 'floorSortKey') is null then
      return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
      return;
    end if;
    if not exists (
      select 1 from public.hotel_room_types room_type
       where room_type.company_id = p_company_id
         and room_type.id = v_room_type_id
         and room_type.is_active
         and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
    ) then
      return query select 'ROOM_TYPE_UNAVAILABLE'::text, null::jsonb;
      return;
    end if;
    insert into public.hotel_rooms (
      id, company_id, branch_id, room_number, floor_label, floor_sort_key,
      room_type_id, internal_note, owner_visible_note, status,
      created_by, updated_by
    ) values (
      p_room_id, p_company_id, p_branch_id, v_room_number,
      p_value ->> 'floorLabel', (p_value ->> 'floorSortKey')::integer,
      v_room_type_id, p_value ->> 'internalNote', p_value ->> 'ownerVisibleNote',
      'ACTIVE', v_actor.user_id, v_actor.user_id
    );
  else
    select room.status, room.version
      into v_current
      from public.hotel_rooms room
     where room.company_id = p_company_id
       and room.branch_id = p_branch_id
       and room.id = p_room_id
     for update;
    if not found then
      return query select 'NOT_FOUND'::text, null::jsonb;
      return;
    end if;
    if v_current.version <> p_expected_version then
      return query select 'VERSION_CONFLICT'::text, null::jsonb;
      return;
    end if;
    if v_current.status = 'DELETED' then
      return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
      return;
    end if;
    if p_value ? 'roomTypeId' and not exists (
      select 1 from public.hotel_room_types room_type
       where room_type.company_id = p_company_id
         and room_type.id = v_room_type_id
         and room_type.is_active
         and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
    ) then
      return query select 'ROOM_TYPE_UNAVAILABLE'::text, null::jsonb;
      return;
    end if;
    update public.hotel_rooms
       set room_number = case when p_value ? 'roomNumber' then v_room_number else room_number end,
           floor_label = case when p_value ? 'floorLabel' then p_value ->> 'floorLabel' else floor_label end,
           floor_sort_key = case when p_value ? 'floorSortKey' then (p_value ->> 'floorSortKey')::integer else floor_sort_key end,
           room_type_id = case when p_value ? 'roomTypeId' then v_room_type_id else room_type_id end,
           internal_note = case when p_value ? 'internalNote' then p_value ->> 'internalNote' else internal_note end,
           owner_visible_note = case when p_value ? 'ownerVisibleNote' then p_value ->> 'ownerVisibleNote' else owner_visible_note end,
           version = version + 1,
           updated_by = v_actor.user_id,
           updated_at = v_now
     where company_id = p_company_id
       and branch_id = p_branch_id
       and id = p_room_id
       and version = p_expected_version;
    if not found then
      return query select 'VERSION_CONFLICT'::text, null::jsonb;
      return;
    end if;
  end if;

  select pg_catalog.jsonb_build_object(
           'id', room.id,
           'hotelId', room.branch_id,
           'roomNumber', room.room_number,
           'floorLabel', room.floor_label,
           'floorSortKey', room.floor_sort_key,
           'roomType', pg_catalog.jsonb_build_object(
             'id', room_type.id,
             'name', room_type.name,
             'scope', room_type.scope
           ),
           'status', room.status,
           'internalNote', room.internal_note,
           'ownerVisibleNote', room.owner_visible_note,
           'version', room.version,
           'createdAt', pg_catalog.to_char(room.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'updatedAt', pg_catalog.to_char(room.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         )
    into v_snapshot
    from public.hotel_rooms room
    join public.hotel_room_types room_type
      on room_type.company_id = room.company_id
     and room_type.id = room.room_type_id
   where room.company_id = p_company_id
     and room.branch_id = p_branch_id
     and room.id = p_room_id;

  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id,
    case when p_action = 'CREATE' then 'HOTEL_ROOM_CREATED' else 'HOTEL_ROOM_UPDATED' end,
    v_actor.user_id, v_actor.user_type, v_actor.session_id,
    p_company_id, p_branch_id, 'HOTEL_ROOM', p_room_id,
    pg_catalog.jsonb_build_object(
      'resourceId', p_room_id,
      'status', v_snapshot ->> 'status',
      'version', (v_snapshot ->> 'version')::integer
    ), null, 'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id,
    p_idempotency_key, p_http_method, p_operation_path, p_request_hash,
    'COMPLETED', 'HOTEL_ROOM', p_room_id, p_audit_event_id,
    v_snapshot, v_now, v_now + interval '24 hours'
  );
  return query select
    case when p_action = 'CREATE' then 'CREATED' else 'UPDATED' end::text,
    v_snapshot;
exception
  when unique_violation then
    return query select 'DUPLICATE'::text, null::jsonb;
  when foreign_key_violation or check_violation or invalid_text_representation then
    return query select 'ROOM_TYPE_UNAVAILABLE'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_room_write_command_v1(
  uuid, uuid, uuid, text, integer, jsonb, uuid, uuid,
  text, text, text, text, text, uuid
) from public;

update permissions
set description = '호텔 객실 기준정보·상태 관리'
where code = 'HOTEL_ROOM_MANAGE';

insert into schema_migrations (version)
values ('0025_hotel_room_reference_lifecycle');

commit;
