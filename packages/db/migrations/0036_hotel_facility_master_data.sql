begin;

insert into permissions (code, description) values
  ('HOTEL_FACILITY_READ', '호텔 공용공간·시설물 기준정보 조회'),
  ('HOTEL_FACILITY_MANAGE', '호텔 공용공간·시설물 기준정보 관리')
on conflict (code) do update set description = excluded.description;

create table hotel_common_areas (
  id uuid primary key,
  company_id uuid not null references companies(id),
  branch_id uuid not null,
  name text not null check (btrim(name) <> '' and char_length(btrim(name)) <= 100),
  normalized_name text generated always as (lower(btrim(name))) stored,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, branch_id, id),
  unique (company_id, branch_id, normalized_name),
  constraint hotel_common_areas_company_branch_fkey foreign key (company_id, branch_id) references branches(company_id,id),
  constraint hotel_common_areas_created_by_fkey foreign key (company_id, created_by) references users(company_id,id),
  constraint hotel_common_areas_updated_by_fkey foreign key (company_id, updated_by) references users(company_id,id)
);

create table hotel_facility_types (
  id uuid primary key,
  company_id uuid not null references companies(id),
  branch_id uuid not null,
  name text not null check (btrim(name) <> '' and char_length(btrim(name)) <= 100),
  normalized_name text generated always as (lower(btrim(name))) stored,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, branch_id, id),
  unique (company_id, branch_id, normalized_name),
  constraint hotel_facility_types_company_branch_fkey foreign key (company_id, branch_id) references branches(company_id,id),
  constraint hotel_facility_types_created_by_fkey foreign key (company_id, created_by) references users(company_id,id),
  constraint hotel_facility_types_updated_by_fkey foreign key (company_id, updated_by) references users(company_id,id)
);

create table hotel_facilities (
  id uuid primary key,
  company_id uuid not null references companies(id),
  branch_id uuid not null,
  facility_type_id uuid not null,
  name text not null check (btrim(name) <> '' and char_length(btrim(name)) <= 100),
  normalized_name text generated always as (lower(btrim(name))) stored,
  location_type text not null check (location_type in ('ROOM','COMMON_AREA')),
  room_id uuid,
  common_area_id uuid,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, branch_id, id),
  constraint hotel_facilities_location_exactly_one_check check (
    (location_type = 'ROOM' and room_id is not null and common_area_id is null)
    or (location_type = 'COMMON_AREA' and room_id is null and common_area_id is not null)
  ),
  constraint hotel_facilities_company_branch_fkey foreign key (company_id, branch_id) references branches(company_id,id),
  constraint hotel_facilities_type_fkey foreign key (company_id, branch_id, facility_type_id) references hotel_facility_types(company_id,branch_id,id),
  constraint hotel_facilities_room_fkey foreign key (company_id, branch_id, room_id) references hotel_rooms(company_id,branch_id,id),
  constraint hotel_facilities_common_area_fkey foreign key (company_id, branch_id, common_area_id) references hotel_common_areas(company_id,branch_id,id),
  constraint hotel_facilities_created_by_fkey foreign key (company_id, created_by) references users(company_id,id),
  constraint hotel_facilities_updated_by_fkey foreign key (company_id, updated_by) references users(company_id,id)
);
create unique index hotel_facilities_room_name_key on hotel_facilities(company_id,branch_id,facility_type_id,room_id,normalized_name) where location_type = 'ROOM';
create unique index hotel_facilities_common_area_name_key on hotel_facilities(company_id,branch_id,facility_type_id,common_area_id,normalized_name) where location_type = 'COMMON_AREA';

create table hotel_common_area_history (
  id uuid primary key, company_id uuid not null, branch_id uuid not null, common_area_id uuid not null,
  previous_status text, next_status text not null, previous_name text, next_name text not null,
  reason text not null check (char_length(btrim(reason)) between 2 and 500), actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint hotel_common_area_history_parent_fkey foreign key (company_id,branch_id,common_area_id) references hotel_common_areas(company_id,branch_id,id),
  constraint hotel_common_area_history_actor_fkey foreign key (company_id,actor_user_id) references users(company_id,id)
);
create table hotel_facility_type_history (
  id uuid primary key, company_id uuid not null, branch_id uuid not null, facility_type_id uuid not null,
  previous_status text, next_status text not null, previous_name text, next_name text not null,
  reason text not null check (char_length(btrim(reason)) between 2 and 500), actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint hotel_facility_type_history_parent_fkey foreign key (company_id,branch_id,facility_type_id) references hotel_facility_types(company_id,branch_id,id),
  constraint hotel_facility_type_history_actor_fkey foreign key (company_id,actor_user_id) references users(company_id,id)
);
create table hotel_facility_history (
  id uuid primary key, company_id uuid not null, branch_id uuid not null, facility_id uuid not null,
  previous_status text, next_status text not null, previous_name text, next_name text not null,
  previous_location_type text, previous_room_id uuid, previous_common_area_id uuid,
  next_location_type text not null, next_room_id uuid, next_common_area_id uuid,
  reason text not null check (char_length(btrim(reason)) between 2 and 500), actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint hotel_facility_history_parent_fkey foreign key (company_id,branch_id,facility_id) references hotel_facilities(company_id,branch_id,id),
  constraint hotel_facility_history_actor_fkey foreign key (company_id,actor_user_id) references users(company_id,id)
);

create function reject_hotel_facility_reference_delete() returns trigger language plpgsql set search_path=pg_catalog as $$ begin raise exception 'hotel facility reference physical deletion is forbidden' using errcode='55000'; end $$;
revoke all on function reject_hotel_facility_reference_delete() from public;
create function reject_hotel_facility_history_change() returns trigger language plpgsql set search_path=pg_catalog as $$ begin raise exception 'hotel facility history is append-only' using errcode='55000'; end $$;
revoke all on function reject_hotel_facility_history_change() from public;
create function enforce_hotel_facility_reference_lifecycle()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if old.status = 'DELETED' then
    raise exception 'deleted hotel facility reference is immutable'
      using errcode = '55000';
  end if;
  if new.status = 'DELETED' and old.status <> 'INACTIVE' then
    raise exception 'active hotel facility reference cannot be deleted'
      using errcode = '55000';
  end if;
  if tg_table_name in ('hotel_common_areas', 'hotel_facility_types')
     and new.status <> 'ACTIVE'
     and exists (
       select 1
         from public.hotel_facilities facility
        where facility.company_id = old.company_id
          and facility.branch_id = old.branch_id
          and (
            (tg_table_name = 'hotel_common_areas'
             and facility.common_area_id = old.id)
            or (tg_table_name = 'hotel_facility_types'
                and facility.facility_type_id = old.id)
          )
          and facility.status = 'ACTIVE'
     ) then
    raise exception 'linked_active_facilities' using errcode = '55000';
  end if;
  return new;
end
$function$;
revoke all on function enforce_hotel_facility_reference_lifecycle() from public;

create function enforce_hotel_room_facility_location_lifecycle()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if old.status = 'ACTIVE'
     and new.status <> 'ACTIVE'
     and exists (
       select 1
         from public.hotel_facilities facility
        where facility.company_id = old.company_id
          and facility.branch_id = old.branch_id
          and facility.room_id = old.id
          and facility.status = 'ACTIVE'
     ) then
    raise exception 'linked_active_facilities' using errcode = '55000';
  end if;
  return new;
end
$function$;
revoke all on function enforce_hotel_room_facility_location_lifecycle() from public;

create trigger hotel_rooms_facility_location_guard before update of status on hotel_rooms for each row execute function enforce_hotel_room_facility_location_lifecycle();
create trigger hotel_common_areas_no_delete before delete on hotel_common_areas for each row execute function reject_hotel_facility_reference_delete();
create trigger hotel_facility_types_no_delete before delete on hotel_facility_types for each row execute function reject_hotel_facility_reference_delete();
create trigger hotel_facilities_no_delete before delete on hotel_facilities for each row execute function reject_hotel_facility_reference_delete();
create trigger hotel_common_areas_lifecycle before update on hotel_common_areas for each row execute function enforce_hotel_facility_reference_lifecycle();
create trigger hotel_facility_types_lifecycle before update on hotel_facility_types for each row execute function enforce_hotel_facility_reference_lifecycle();
create trigger hotel_facilities_lifecycle before update on hotel_facilities for each row execute function enforce_hotel_facility_reference_lifecycle();
create trigger hotel_common_area_history_immutable before update or delete on hotel_common_area_history for each row execute function reject_hotel_facility_history_change();
create trigger hotel_facility_type_history_immutable before update or delete on hotel_facility_type_history for each row execute function reject_hotel_facility_history_change();
create trigger hotel_facility_history_immutable before update or delete on hotel_facility_history for each row execute function reject_hotel_facility_history_change();

alter table hotel_common_areas enable row level security; alter table hotel_common_areas force row level security;
alter table hotel_facility_types enable row level security; alter table hotel_facility_types force row level security;
alter table hotel_facilities enable row level security; alter table hotel_facilities force row level security;
alter table hotel_common_area_history enable row level security; alter table hotel_common_area_history force row level security;
alter table hotel_facility_type_history enable row level security; alter table hotel_facility_type_history force row level security;
alter table hotel_facility_history enable row level security; alter table hotel_facility_history force row level security;
do $policies$ declare t text; begin
 for t in select unnest(array['hotel_common_areas','hotel_facility_types','hotel_facilities','hotel_common_area_history','hotel_facility_type_history','hotel_facility_history']) loop
  execute format('create policy %I_company_isolation on %I using (case when public.runtime_is_schema_owner() then true when current_user = ''werehere_auth_session_definer'' then true when current_user = ''werehere_tenant_authority_definer'' then true when public.runtime_has_capability(''API_RUNTIME'') then company_id=public.api_current_company_id() when public.runtime_has_capability(''RECONCILER'') then company_id=public.reconciler_current_company_id() else false end) with check (case when public.runtime_is_schema_owner() then true when current_user = ''werehere_auth_session_definer'' then true when current_user = ''werehere_tenant_authority_definer'' then true when public.runtime_has_capability(''API_RUNTIME'') then company_id=public.api_current_company_id() when public.runtime_has_capability(''RECONCILER'') then company_id=public.reconciler_current_company_id() else false end)',t,t);
 end loop;
end $policies$;

do $table_acl$ declare r text; begin
 for r in select role_name from runtime_database_capabilities where capability='API_RUNTIME' loop
  execute format('grant select on hotel_common_areas,hotel_facility_types,hotel_facilities,hotel_common_area_history,hotel_facility_type_history,hotel_facility_history to %I',r);
  execute format('revoke insert, update, delete on hotel_common_areas,hotel_facility_types,hotel_facilities,hotel_common_area_history,hotel_facility_type_history,hotel_facility_history from %I',r);
 end loop;
end $table_acl$;

create function hotel_facility_reference_command_v1(
 p_company_id uuid,p_branch_id uuid,p_entity text,p_action text,p_resource_id uuid,p_expected_version integer,p_value jsonb,p_reason text,
 p_history_id uuid,p_audit_event_id uuid,p_idempotency_record_id uuid,p_idempotency_key text,p_http_method text,p_operation_path text,p_request_hash text,p_session_token text,p_trace_id uuid
) returns table(command_status text,result_snapshot jsonb) language plpgsql security definer set search_path=pg_catalog as $function$
declare
 v_now timestamptz:=clock_timestamp(); v_actor record; v_current record; v_allowed boolean:=false; v_snapshot jsonb; v_status text; v_name text;
 v_type_id uuid; v_location_type text; v_room_id uuid; v_common_area_id uuid; v_replay record;
begin
 if not public.runtime_has_capability('API_RUNTIME') or p_entity not in ('COMMON_AREA','FACILITY_TYPE','FACILITY') or p_action not in ('CREATE','UPDATE','STATUS','DELETE') or p_idempotency_key is null or btrim(p_idempotency_key)='' or p_session_token is null or p_session_token !~ '^[A-Za-z0-9_-]{43}$' then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select s.id session_id,u.id user_id,u.user_type into v_actor from public.auth_sessions s join public.users u on u.company_id=s.company_id and u.id=s.user_id join public.companies c on c.id=u.company_id where s.id=nullif(current_setting('app.session_id',true),'')::uuid and s.company_id=p_company_id and s.token_hash=sha256(convert_to(p_session_token,'UTF8')) and s.revoked_at is null and s.idle_expires_at>v_now and s.absolute_expires_at>v_now and u.status='ACTIVE' and u.user_type='INTERNAL_STAFF' and c.status='ACTIVE';
 if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company_id::text||':'||v_actor.user_id::text||':'||p_idempotency_key||':'||p_http_method||':'||p_operation_path,0));
 select idempotency.request_hash, idempotency.result_snapshot
   into v_replay
   from public.idempotency_records idempotency
  where idempotency.company_id = p_company_id
    and idempotency.actor_user_id = v_actor.user_id
    and idempotency.idempotency_key = p_idempotency_key
    and idempotency.http_method = p_http_method
    and idempotency.operation_path = p_operation_path
    and idempotency.status = 'COMPLETED'
    and idempotency.expires_at > v_now;
 if found then if v_replay.request_hash<>p_request_hash then return query select 'IDEMPOTENCY_CONFLICT',null::jsonb; else return query select 'REPLAYED',v_replay.result_snapshot; end if; return; end if;
 with subjects as (select 'USER'::text subject_type,v_actor.user_id::uuid subject_id union all select 'ROLE',m.role_id from public.user_role_memberships m join public.roles r on r.company_id=m.company_id and r.id=m.role_id where m.company_id=p_company_id and m.user_id=v_actor.user_id and m.valid_from<=v_now and (m.valid_until is null or m.valid_until>v_now) and r.status='ACTIVE' union all select 'GROUP',m.group_id from public.user_group_memberships m join public.user_groups g on g.company_id=m.company_id and g.id=m.group_id where m.company_id=p_company_id and m.user_id=v_actor.user_id and m.valid_from<=v_now and (m.valid_until is null or m.valid_until>v_now) and g.status='ACTIVE'), effects as (select pg.branch_id,pg.effect from public.permission_grants pg join subjects s on s.subject_type=pg.subject_type and s.subject_id=pg.subject_id where pg.company_id=p_company_id and pg.permission_code='HOTEL_FACILITY_MANAGE' and (pg.branch_id is null or pg.branch_id=p_branch_id) and pg.valid_from<=v_now and (pg.valid_until is null or pg.valid_until>v_now)) select exists(select 1 from public.branches b where b.company_id=p_company_id and b.id=p_branch_id and b.branch_type='HOTEL') and exists(select 1 from public.hotel_staff_assignments a where a.company_id=p_company_id and a.branch_id=p_branch_id and a.user_id=v_actor.user_id and a.terminated_at is null and a.start_date<=v_now::date and (a.end_date is null or a.end_date>=v_now::date)) and exists(select 1 from effects where effect='ALLOW') and not exists(select 1 from effects where effect='DENY') into v_allowed;
 if not v_allowed then return query select 'FORBIDDEN',null::jsonb; return; end if;
 v_name:=btrim(p_value->>'name'); v_status:=coalesce(p_value->>'status','ACTIVE');
 if p_action in ('CREATE','UPDATE') and (v_name is null or char_length(v_name) not between 1 and 100) then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
 if p_action='UPDATE' and (p_expected_version is null or p_expected_version<1) then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
 if p_action in ('STATUS','DELETE') and (p_expected_version is null or p_expected_version<1 or p_reason is null or char_length(btrim(p_reason)) not between 2 and 500) then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
 if p_action='STATUS' and v_status not in ('ACTIVE','INACTIVE') then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if;
 if p_entity='FACILITY' then
  v_type_id:=nullif(p_value->>'facilityTypeId','')::uuid; v_location_type:=p_value#>>'{location,type}'; v_room_id:=nullif(p_value#>>'{location,roomId}','')::uuid; v_common_area_id:=nullif(p_value#>>'{location,commonAreaId}','')::uuid;
  if p_action in ('CREATE','UPDATE') then
   perform 1 from public.hotel_facility_types where company_id=p_company_id and branch_id=p_branch_id and id=v_type_id and status='ACTIVE' for update; if not found then return query select 'REFERENCE_UNAVAILABLE',null::jsonb; return; end if;
   if v_location_type='ROOM' then perform 1 from public.hotel_rooms where company_id=p_company_id and branch_id=p_branch_id and id=v_room_id and status='ACTIVE' for update; elsif v_location_type='COMMON_AREA' then perform 1 from public.hotel_common_areas where company_id=p_company_id and branch_id=p_branch_id and id=v_common_area_id and status='ACTIVE' for update; else return query select 'REFERENCE_UNAVAILABLE',null::jsonb; return; end if; if not found then return query select 'REFERENCE_UNAVAILABLE',null::jsonb; return; end if;
  end if;
 end if;
 if p_entity='COMMON_AREA' then
  if p_action='CREATE' then insert into public.hotel_common_areas(id,company_id,branch_id,name,created_by,updated_by) values(p_resource_id,p_company_id,p_branch_id,v_name,v_actor.user_id,v_actor.user_id);
  else select * into v_current from public.hotel_common_areas where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id for update; if not found then return query select 'NOT_FOUND',null::jsonb; return; end if; if v_current.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if; if v_current.status='DELETED' or (p_action='STATUS' and v_current.status=v_status) or (p_action='DELETE' and v_current.status<>'INACTIVE') then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if; if p_action='UPDATE' then update public.hotel_common_areas set name=v_name,version=version+1,updated_by=v_actor.user_id,updated_at=v_now where id=p_resource_id; elsif p_action='STATUS' then update public.hotel_common_areas set status=v_status,version=version+1,updated_by=v_actor.user_id,updated_at=v_now where id=p_resource_id; else update public.hotel_common_areas set status='DELETED',version=version+1,updated_by=v_actor.user_id,updated_at=v_now where id=p_resource_id; end if; insert into public.hotel_common_area_history(id,company_id,branch_id,common_area_id,previous_status,next_status,previous_name,next_name,reason,actor_user_id) select p_history_id,p_company_id,p_branch_id,id,v_current.status,status,v_current.name,name,coalesce(nullif(btrim(p_reason),''),'정보 수정'),v_actor.user_id from public.hotel_common_areas where id=p_resource_id; end if;
  select jsonb_build_object('id',id,'hotelId',branch_id,'name',name,'status',status,'version',version,'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) into v_snapshot from public.hotel_common_areas where id=p_resource_id;
 elsif p_entity='FACILITY_TYPE' then
  if p_action='CREATE' then insert into public.hotel_facility_types(id,company_id,branch_id,name,created_by,updated_by) values(p_resource_id,p_company_id,p_branch_id,v_name,v_actor.user_id,v_actor.user_id);
  else select * into v_current from public.hotel_facility_types where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id for update; if not found then return query select 'NOT_FOUND',null::jsonb; return; end if; if v_current.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if; if v_current.status='DELETED' or (p_action='STATUS' and v_current.status=v_status) or (p_action='DELETE' and v_current.status<>'INACTIVE') then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if; if p_action='UPDATE' then update public.hotel_facility_types set name=v_name,version=version+1,updated_by=v_actor.user_id,updated_at=v_now where id=p_resource_id; elsif p_action='STATUS' then update public.hotel_facility_types set status=v_status,version=version+1,updated_by=v_actor.user_id,updated_at=v_now where id=p_resource_id; else update public.hotel_facility_types set status='DELETED',version=version+1,updated_by=v_actor.user_id,updated_at=v_now where id=p_resource_id; end if; insert into public.hotel_facility_type_history(id,company_id,branch_id,facility_type_id,previous_status,next_status,previous_name,next_name,reason,actor_user_id) select p_history_id,p_company_id,p_branch_id,id,v_current.status,status,v_current.name,name,coalesce(nullif(btrim(p_reason),''),'정보 수정'),v_actor.user_id from public.hotel_facility_types where id=p_resource_id; end if;
  select jsonb_build_object('id',id,'hotelId',branch_id,'name',name,'status',status,'version',version,'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) into v_snapshot from public.hotel_facility_types where id=p_resource_id;
 else
  if p_action='CREATE' then insert into public.hotel_facilities(id,company_id,branch_id,facility_type_id,name,location_type,room_id,common_area_id,created_by,updated_by) values(p_resource_id,p_company_id,p_branch_id,v_type_id,v_name,v_location_type,v_room_id,v_common_area_id,v_actor.user_id,v_actor.user_id);
  else select * into v_current from public.hotel_facilities where company_id=p_company_id and branch_id=p_branch_id and id=p_resource_id for update; if not found then return query select 'NOT_FOUND',null::jsonb; return; end if; if v_current.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if; if v_current.status='DELETED' or (p_action='STATUS' and v_current.status=v_status) or (p_action='DELETE' and v_current.status<>'INACTIVE') then return query select 'INVALID_STATE_TRANSITION',null::jsonb; return; end if; if p_action='UPDATE' then update public.hotel_facilities set name=v_name,facility_type_id=v_type_id,location_type=v_location_type,room_id=v_room_id,common_area_id=v_common_area_id,version=version+1,updated_by=v_actor.user_id,updated_at=v_now where id=p_resource_id; elsif p_action='STATUS' then if v_status='ACTIVE' then perform 1 from public.hotel_facility_types where company_id=p_company_id and branch_id=p_branch_id and id=v_current.facility_type_id and status='ACTIVE' for update; if not found then return query select 'REFERENCE_UNAVAILABLE',null::jsonb; return; end if; if v_current.location_type='ROOM' then perform 1 from public.hotel_rooms where company_id=p_company_id and branch_id=p_branch_id and id=v_current.room_id and status='ACTIVE' for update; else perform 1 from public.hotel_common_areas where company_id=p_company_id and branch_id=p_branch_id and id=v_current.common_area_id and status='ACTIVE' for update; end if; if not found then return query select 'REFERENCE_UNAVAILABLE',null::jsonb; return; end if; end if; update public.hotel_facilities set status=v_status,version=version+1,updated_by=v_actor.user_id,updated_at=v_now where id=p_resource_id; else update public.hotel_facilities set status='DELETED',version=version+1,updated_by=v_actor.user_id,updated_at=v_now where id=p_resource_id; end if; insert into public.hotel_facility_history(id,company_id,branch_id,facility_id,previous_status,next_status,previous_name,next_name,previous_location_type,previous_room_id,previous_common_area_id,next_location_type,next_room_id,next_common_area_id,reason,actor_user_id) select p_history_id,p_company_id,p_branch_id,id,v_current.status,status,v_current.name,name,v_current.location_type,v_current.room_id,v_current.common_area_id,location_type,room_id,common_area_id,coalesce(nullif(btrim(p_reason),''),'정보 수정'),v_actor.user_id from public.hotel_facilities where id=p_resource_id; end if;
  select jsonb_build_object('id',f.id,'hotelId',f.branch_id,'name',f.name,'status',f.status,'version',f.version,'createdAt',to_char(f.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(f.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'facilityType',jsonb_build_object('id',t.id,'name',t.name,'status',t.status),'location',case when f.location_type='ROOM' then jsonb_build_object('type','ROOM','roomId',r.id,'name',r.room_number) else jsonb_build_object('type','COMMON_AREA','commonAreaId',a.id,'name',a.name) end) into v_snapshot from public.hotel_facilities f join public.hotel_facility_types t on t.company_id=f.company_id and t.branch_id=f.branch_id and t.id=f.facility_type_id left join public.hotel_rooms r on r.company_id=f.company_id and r.branch_id=f.branch_id and r.id=f.room_id left join public.hotel_common_areas a on a.company_id=f.company_id and a.branch_id=f.branch_id and a.id=f.common_area_id where f.id=p_resource_id;
 end if;
 insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(p_audit_event_id,'HOTEL_FACILITY_REFERENCE_'||p_action,v_actor.user_id,v_actor.user_type,v_actor.session_id,p_company_id,p_branch_id,'HOTEL_'||p_entity,p_resource_id,jsonb_build_object('resourceId',p_resource_id,'version',(v_snapshot->>'version')::integer,'status',v_snapshot->>'status'),nullif(btrim(p_reason),''),'SUCCEEDED',p_trace_id);
 insert into public.idempotency_records(id,company_id,actor_user_id,idempotency_key,http_method,operation_path,request_hash,status,resource_type,resource_id,audit_event_id,result_snapshot,completed_at,expires_at) values(p_idempotency_record_id,p_company_id,v_actor.user_id,p_idempotency_key,p_http_method,p_operation_path,p_request_hash,'COMPLETED','HOTEL_'||p_entity,p_resource_id,p_audit_event_id,v_snapshot,v_now,v_now+interval '24 hours');
 return query select case when p_action='CREATE' then 'CREATED' when p_action='STATUS' or p_action='DELETE' then 'STATUS_CHANGED' else 'UPDATED' end,v_snapshot;
exception when unique_violation then return query select 'DUPLICATE',null::jsonb; when foreign_key_violation or check_violation or invalid_text_representation then return query select 'REFERENCE_UNAVAILABLE',null::jsonb; when sqlstate '55000' then if sqlerrm in ('linked_active_facilities','linked_facilities') then return query select upper(sqlerrm),null::jsonb; else return query select 'INVALID_STATE_TRANSITION',null::jsonb; end if;
end $function$;
revoke all on function hotel_facility_reference_command_v1(uuid,uuid,text,text,uuid,integer,jsonb,text,uuid,uuid,uuid,text,text,text,text,text,uuid) from public;
do $command_acl$ declare r text; begin for r in select role_name from runtime_database_capabilities where capability='API_RUNTIME' loop execute format('grant execute on function hotel_facility_reference_command_v1(uuid,uuid,text,text,uuid,integer,jsonb,text,uuid,uuid,uuid,text,text,text,text,text,uuid) to %I',r); end loop; end $command_acl$;

insert into schema_migrations(version) values('0036_hotel_facility_master_data') on conflict(version) do nothing;
commit;
