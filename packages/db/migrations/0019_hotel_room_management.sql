begin;

do $$
begin
  if not exists (
    select 1 from schema_migrations where version = '0018_hotel_support_assignment_overlap'
  ) then
    raise exception 'migration 0018 must be applied first' using errcode = '55000';
  end if;
end
$$;

create table hotel_room_types (
  id uuid primary key,
  company_id uuid not null references companies(id),
  branch_id uuid,
  scope text not null check (scope in ('COMPANY', 'HOTEL')),
  name text not null check (btrim(name) <> '' and char_length(name) <= 100),
  normalized_name text generated always as (lower(btrim(name))) stored,
  display_order integer not null default 0 check (display_order between 0 and 100000),
  is_active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique nulls not distinct (company_id, branch_id, normalized_name),
  foreign key (company_id, branch_id) references branches(company_id, id),
  foreign key (company_id, created_by) references users(company_id, id),
  foreign key (company_id, updated_by) references users(company_id, id),
  constraint hotel_room_types_scope_shape check (
    (scope = 'COMPANY' and branch_id is null)
    or (scope = 'HOTEL' and branch_id is not null)
  )
);

create table hotel_rooms (
  id uuid primary key,
  company_id uuid not null references companies(id),
  branch_id uuid not null,
  room_number text not null check (btrim(room_number) <> '' and char_length(room_number) <= 40),
  floor_label text not null check (btrim(floor_label) <> '' and char_length(floor_label) <= 40),
  floor_sort_key integer not null check (floor_sort_key between -1000 and 1000),
  room_type_id uuid not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'TEMP_SUSPENDED', 'OUT_OF_SERVICE')),
  internal_note text check (internal_note is null or char_length(internal_note) <= 1000),
  owner_visible_note text check (owner_visible_note is null or char_length(owner_visible_note) <= 1000),
  planned_resume_date date,
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  constraint hotel_rooms_company_branch_id_key unique (company_id, branch_id, id),
  unique (company_id, branch_id, room_number),
  foreign key (company_id, branch_id) references branches(company_id, id),
  foreign key (company_id, room_type_id) references hotel_room_types(company_id, id),
  foreign key (company_id, created_by) references users(company_id, id),
  foreign key (company_id, updated_by) references users(company_id, id),
  constraint hotel_rooms_resume_shape check (
    status <> 'ACTIVE' or planned_resume_date is null
  )
);

create table hotel_room_status_history (
  id uuid primary key,
  company_id uuid not null references companies(id),
  branch_id uuid not null,
  room_id uuid not null,
  previous_status text not null
    check (previous_status in ('ACTIVE', 'TEMP_SUSPENDED', 'OUT_OF_SERVICE')),
  next_status text not null
    check (next_status in ('ACTIVE', 'TEMP_SUSPENDED', 'OUT_OF_SERVICE')),
  reason text not null check (btrim(reason) <> '' and char_length(reason) <= 500),
  planned_resume_date date,
  changed_by uuid not null,
  changed_at timestamptz not null default now(),
  foreign key (company_id, branch_id) references branches(company_id, id),
  constraint hotel_room_status_history_room_hotel_fkey
    foreign key (company_id, branch_id, room_id)
    references hotel_rooms(company_id, branch_id, id),
  foreign key (company_id, changed_by) references users(company_id, id),
  constraint hotel_room_status_history_transition check (previous_status <> next_status),
  constraint hotel_room_status_history_resume_shape check (
    next_status <> 'ACTIVE' or planned_resume_date is null
  )
);

create index hotel_room_types_scope_list_idx
  on hotel_room_types (company_id, branch_id, is_active, display_order, normalized_name);
create index hotel_rooms_hotel_list_idx
  on hotel_rooms (company_id, branch_id, floor_sort_key, room_number, id);
create index hotel_rooms_hotel_status_idx
  on hotel_rooms (company_id, branch_id, status, floor_sort_key, room_number);
create index hotel_room_status_history_room_idx
  on hotel_room_status_history (company_id, branch_id, room_id, changed_at desc);

create function public.reject_hotel_room_type_scope_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.company_id is distinct from new.company_id
    or old.scope is distinct from new.scope
    or old.branch_id is distinct from new.branch_id then
    raise exception 'hotel room type scope is immutable' using errcode = '55000';
  end if;
  return new;
end
$$;
revoke all on function public.reject_hotel_room_type_scope_change() from public;

create trigger hotel_room_types_scope_immutable
before update of company_id, scope, branch_id on hotel_room_types
for each row execute function public.reject_hotel_room_type_scope_change();

create function public.enforce_hotel_room_type_scope()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  selected_scope text;
  selected_branch_id uuid;
  selected_active boolean;
begin
  select room_type.scope, room_type.branch_id, room_type.is_active
    into selected_scope, selected_branch_id, selected_active
    from public.hotel_room_types room_type
   where room_type.company_id = new.company_id
     and room_type.id = new.room_type_id;

  if not found then
    raise foreign_key_violation using message = 'room type is not available';
  end if;
  if not selected_active then
    raise check_violation using message = 'inactive room type cannot be assigned';
  end if;
  if selected_scope = 'HOTEL' and selected_branch_id is distinct from new.branch_id then
    raise foreign_key_violation using message = 'hotel room type scope mismatch';
  end if;
  return new;
end
$$;
revoke all on function public.enforce_hotel_room_type_scope() from public;

create trigger hotel_rooms_room_type_scope_guard
before insert or update of company_id, branch_id, room_type_id on hotel_rooms
for each row execute function public.enforce_hotel_room_type_scope();

create function public.reject_hotel_room_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'hotel room records cannot be physically deleted' using errcode = '55000';
end
$$;
revoke all on function public.reject_hotel_room_delete() from public;

create trigger hotel_room_types_no_delete
before delete on hotel_room_types
for each row execute function public.reject_hotel_room_delete();
create trigger hotel_rooms_no_delete
before delete on hotel_rooms
for each row execute function public.reject_hotel_room_delete();

create function public.reject_hotel_room_history_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'hotel room status history is immutable' using errcode = '55000';
end
$$;
revoke all on function public.reject_hotel_room_history_change() from public;

create trigger hotel_room_status_history_no_update
before update on hotel_room_status_history
for each row execute function public.reject_hotel_room_history_change();
create trigger hotel_room_status_history_no_delete
before delete on hotel_room_status_history
for each row execute function public.reject_hotel_room_history_change();

alter table hotel_room_types enable row level security;
alter table hotel_room_types force row level security;
alter table hotel_rooms enable row level security;
alter table hotel_rooms force row level security;
alter table hotel_room_status_history enable row level security;
alter table hotel_room_status_history force row level security;

do $tenant_policies$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    'hotel_room_types',
    'hotel_rooms',
    'hotel_room_status_history'
  ]
  loop
    execute format(
      'create policy %I_company_isolation on %I using (
        case
          when public.runtime_is_schema_owner() then true
          when current_user = ''werehere_auth_session_definer'' then true
          when current_user = ''werehere_tenant_authority_definer'' then true
          when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
          when not public.runtime_has_capability(''API_RUNTIME'')
            and not public.runtime_has_capability(''RECONCILER'')
            then company_id = nullif(current_setting(''app.company_id'', true), '''')::uuid
          else false
        end
      ) with check (
        case
          when public.runtime_is_schema_owner() then true
          when current_user = ''werehere_auth_session_definer'' then true
          when current_user = ''werehere_tenant_authority_definer'' then true
          when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
          when not public.runtime_has_capability(''API_RUNTIME'')
            and not public.runtime_has_capability(''RECONCILER'')
            then company_id = nullif(current_setting(''app.company_id'', true), '''')::uuid
          else false
        end
      )',
      tenant_table,
      tenant_table
    );
  end loop;
end
$tenant_policies$;

insert into permissions (code, description) values
  ('HOTEL_ROOM_READ', '호텔 객실 기준정보 조회'),
  ('HOTEL_ROOM_MANAGE', '호텔 객실 정보·운영상태 관리'),
  ('HOTEL_ROOM_TYPE_MANAGE', '회사 공통·호텔 추가 객실유형 관리')
on conflict (code) do update set description = excluded.description;

insert into schema_migrations (version) values ('0019_hotel_room_management');

commit;
