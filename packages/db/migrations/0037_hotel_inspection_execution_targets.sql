-- Forward-only common inspection execution target foundation.
-- The public ROOM request/response contract and the existing v1/v2 command/read
-- functions remain unchanged for migration-before-deploy compatibility.

begin;

lock table public.hotel_inspections in share row exclusive mode;
lock table public.inspection_item_snapshots in share row exclusive mode;

-- Historical executions without item snapshots cannot produce an immutable target
-- snapshot. Stop before creating a marker rather than inventing current values.
do $preflight$
begin
  if exists (
    select 1
      from public.hotel_inspections inspection
     where not exists (
       select 1
         from public.inspection_item_snapshots item
        where item.company_id = inspection.company_id
          and item.branch_id = inspection.branch_id
          and item.inspection_id = inspection.id
     )
  ) then
    raise check_violation using
      message = 'inspection target backfill requires at least one item';
  end if;

  if exists (
    select 1
      from public.inspection_item_snapshots item
     where item.room_id is null
        or item.room_number_snapshot is null
        or pg_catalog.btrim(item.room_number_snapshot) = ''
        or item.floor_label_snapshot is null
        or pg_catalog.btrim(item.floor_label_snapshot) = ''
        or item.floor_sort_key_snapshot is null
        or item.room_type_name_snapshot is null
        or pg_catalog.btrim(item.room_type_name_snapshot) = ''
        or not exists (
          select 1
            from public.hotel_inspections inspection
           where inspection.company_id = item.company_id
             and inspection.branch_id = item.branch_id
             and inspection.id = item.inspection_id
        )
        or not exists (
          select 1
            from public.hotel_rooms room
           where room.company_id = item.company_id
             and room.branch_id = item.branch_id
             and room.id = item.room_id
        )
  ) then
    raise check_violation using
      message = 'inspection target backfill source is invalid';
  end if;

  if exists (
    select 1
      from public.inspection_item_snapshots item
     group by item.company_id, item.branch_id, item.inspection_id, item.room_id
    having pg_catalog.count(distinct item.room_number_snapshot) <> 1
        or pg_catalog.count(distinct item.floor_label_snapshot) <> 1
        or pg_catalog.count(distinct item.floor_sort_key_snapshot) <> 1
        or pg_catalog.count(distinct item.room_type_name_snapshot) <> 1
  ) then
    raise check_violation using
      message = 'inspection target backfill snapshot conflict';
  end if;
end
$preflight$;

create table public.inspection_execution_targets (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  execution_id uuid not null,
  target_type text not null,
  room_id uuid,
  facility_id uuid,
  room_number_snapshot text,
  floor_label_snapshot text,
  floor_sort_key_snapshot integer,
  room_type_name_snapshot text,
  facility_name_snapshot text,
  facility_type_id_snapshot uuid,
  facility_type_name_snapshot text,
  facility_location_type_snapshot text,
  facility_location_room_id_snapshot uuid,
  facility_location_common_area_id_snapshot uuid,
  facility_location_name_snapshot text,
  created_at timestamptz not null default pg_catalog.now(),
  constraint inspection_execution_targets_company_id_id_key
    unique (company_id, id),
  constraint inspection_execution_targets_tenant_execution_id_key
    unique (company_id, branch_id, execution_id, id),
  constraint inspection_execution_targets_execution_fkey
    foreign key (company_id, branch_id, execution_id)
    references public.hotel_inspections(company_id, branch_id, id),
  constraint inspection_execution_targets_room_fkey
    foreign key (company_id, branch_id, room_id)
    references public.hotel_rooms(company_id, branch_id, id),
  constraint inspection_execution_targets_facility_fkey
    foreign key (company_id, branch_id, facility_id)
    references public.hotel_facilities(company_id, branch_id, id),
  constraint inspection_execution_targets_type_check
    check (target_type in ('ROOM', 'FACILITY')),
  constraint inspection_execution_targets_exactly_one_check
    check (
      (
        target_type = 'ROOM'
        and room_id is not null
        and facility_id is null
        and room_number_snapshot is not null
        and pg_catalog.btrim(room_number_snapshot) <> ''
        and floor_label_snapshot is not null
        and pg_catalog.btrim(floor_label_snapshot) <> ''
        and floor_sort_key_snapshot is not null
        and room_type_name_snapshot is not null
        and pg_catalog.btrim(room_type_name_snapshot) <> ''
        and facility_name_snapshot is null
        and facility_type_id_snapshot is null
        and facility_type_name_snapshot is null
        and facility_location_type_snapshot is null
        and facility_location_room_id_snapshot is null
        and facility_location_common_area_id_snapshot is null
        and facility_location_name_snapshot is null
      )
      or
      (
        target_type = 'FACILITY'
        and room_id is null
        and facility_id is not null
        and room_number_snapshot is null
        and floor_label_snapshot is null
        and floor_sort_key_snapshot is null
        and room_type_name_snapshot is null
        and facility_name_snapshot is not null
        and pg_catalog.btrim(facility_name_snapshot) <> ''
        and facility_type_id_snapshot is not null
        and facility_type_name_snapshot is not null
        and pg_catalog.btrim(facility_type_name_snapshot) <> ''
        and facility_location_type_snapshot in ('ROOM', 'COMMON_AREA')
        and facility_location_name_snapshot is not null
        and pg_catalog.btrim(facility_location_name_snapshot) <> ''
        and (
          (
            facility_location_type_snapshot = 'ROOM'
            and facility_location_room_id_snapshot is not null
            and facility_location_common_area_id_snapshot is null
          )
          or
          (
            facility_location_type_snapshot = 'COMMON_AREA'
            and facility_location_room_id_snapshot is null
            and facility_location_common_area_id_snapshot is not null
          )
        )
      )
    )
);

create unique index inspection_execution_targets_room_key
  on public.inspection_execution_targets (
    company_id, branch_id, execution_id, room_id
  ) where target_type = 'ROOM';

create unique index inspection_execution_targets_facility_key
  on public.inspection_execution_targets (
    company_id, branch_id, execution_id, facility_id
  ) where target_type = 'FACILITY';

alter table public.inspection_execution_targets enable row level security;
alter table public.inspection_execution_targets force row level security;

create policy inspection_execution_targets_company_isolation
  on public.inspection_execution_targets
  using (
    case
      when public.runtime_is_schema_owner() then true
      when current_user = 'werehere_auth_session_definer' then true
      when current_user = 'werehere_tenant_authority_definer' then true
      when public.runtime_has_capability('API_RUNTIME')
        then company_id = public.api_current_company_id()
      when public.runtime_has_capability('RECONCILER')
        then company_id = public.reconciler_current_company_id()
      when not public.runtime_has_capability('API_RUNTIME')
       and not public.runtime_has_capability('RECONCILER')
        then company_id = nullif(current_setting('app.company_id', true), '')::uuid
      else false
    end
  )
  with check (
    case
      when public.runtime_is_schema_owner() then true
      when current_user = 'werehere_auth_session_definer' then true
      when current_user = 'werehere_tenant_authority_definer' then true
      when public.runtime_has_capability('API_RUNTIME')
        then company_id = public.api_current_company_id()
      when public.runtime_has_capability('RECONCILER')
        then company_id = public.reconciler_current_company_id()
      when not public.runtime_has_capability('API_RUNTIME')
       and not public.runtime_has_capability('RECONCILER')
        then company_id = nullif(current_setting('app.company_id', true), '')::uuid
      else false
    end
  );

revoke all on table public.inspection_execution_targets from public;

create trigger inspection_execution_targets_append_only
before update or delete on public.inspection_execution_targets
for each row execute function public.reject_hotel_immutable_change();

-- Backfill one immutable ROOM target per existing execution/room using only the
-- already-stored item snapshots. Current room values are intentionally not read.
insert into public.inspection_execution_targets (
  id, company_id, branch_id, execution_id, target_type, room_id,
  room_number_snapshot, floor_label_snapshot, floor_sort_key_snapshot,
  room_type_name_snapshot
)
select pg_catalog.gen_random_uuid(), item.company_id, item.branch_id,
       item.inspection_id, 'ROOM', item.room_id,
       pg_catalog.min(item.room_number_snapshot),
       pg_catalog.min(item.floor_label_snapshot),
       pg_catalog.min(item.floor_sort_key_snapshot),
       pg_catalog.min(item.room_type_name_snapshot)
  from public.inspection_item_snapshots item
 group by item.company_id, item.branch_id, item.inspection_id, item.room_id;

do $backfill_count$
declare
  expected_count bigint;
  actual_count bigint;
begin
  select pg_catalog.count(*) into expected_count
    from (
      select 1
        from public.inspection_item_snapshots item
       group by item.company_id, item.branch_id, item.inspection_id, item.room_id
    ) expected;
  select pg_catalog.count(*) into actual_count
    from public.inspection_execution_targets target;
  if actual_count <> expected_count then
    raise check_violation using
      message = 'inspection target backfill count mismatch';
  end if;
end
$backfill_count$;

alter table public.inspection_item_snapshots
  add column execution_target_id uuid;

alter table public.inspection_item_snapshots
  disable trigger inspection_item_snapshots_append_only;

update public.inspection_item_snapshots item
   set execution_target_id = target.id
  from public.inspection_execution_targets target
 where target.company_id = item.company_id
   and target.branch_id = item.branch_id
   and target.execution_id = item.inspection_id
   and target.target_type = 'ROOM'
   and target.room_id = item.room_id;

alter table public.inspection_item_snapshots
  enable trigger inspection_item_snapshots_append_only;

alter table public.inspection_item_snapshots
  add constraint inspection_item_execution_target_fkey
    foreign key (company_id, branch_id, inspection_id, execution_target_id)
    references public.inspection_execution_targets(
      company_id, branch_id, execution_id, id
    ),
  alter column execution_target_id set not null;

-- EXPAND compatibility boundary: legacy Workers still create ROOM-only item
-- snapshots with room_id NOT NULL. FACILITY rows are target-schema foundation
-- only in this migration; no public/runtime command can attach FACILITY items.
-- A later versioned CONTRACT migration must add the FACILITY item/result/file
-- chain and drain old clients before relaxing the legacy room columns.
create function public.inspection_item_execution_target_capture_v1()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  target_record public.inspection_execution_targets%rowtype;
  room_record record;
begin
  perform 1
    from public.hotel_inspections inspection
   where inspection.company_id = new.company_id
     and inspection.branch_id = new.branch_id
     and inspection.id = new.inspection_id
   for key share;
  if not found then
    raise foreign_key_violation using
      message = 'inspection execution target parent is invalid';
  end if;

  select room.id, room.room_number, room.floor_label, room.floor_sort_key,
         room_type.name as room_type_name
    into room_record
    from public.hotel_rooms room
    join public.hotel_room_types room_type
      on room_type.company_id = room.company_id
     and room_type.id = room.room_type_id
   where room.company_id = new.company_id
     and room.branch_id = new.branch_id
     and room.id = new.room_id
   for key share of room, room_type;
  if not found then
    raise foreign_key_violation using
      message = 'inspection execution ROOM target is invalid';
  end if;

  if new.execution_target_id is null then
    select target.* into target_record
      from public.inspection_execution_targets target
     where target.company_id = new.company_id
       and target.branch_id = new.branch_id
       and target.execution_id = new.inspection_id
       and target.target_type = 'ROOM'
       and target.room_id = new.room_id
     for key share;

    if not found then
      insert into public.inspection_execution_targets (
        id, company_id, branch_id, execution_id, target_type, room_id,
        room_number_snapshot, floor_label_snapshot, floor_sort_key_snapshot,
        room_type_name_snapshot
      ) values (
        pg_catalog.gen_random_uuid(), new.company_id, new.branch_id,
        new.inspection_id, 'ROOM', new.room_id,
        room_record.room_number, room_record.floor_label,
        room_record.floor_sort_key, room_record.room_type_name
      )
      on conflict (company_id, branch_id, execution_id, room_id)
        where target_type = 'ROOM'
      do nothing
      returning * into target_record;

      if not found then
        select target.* into strict target_record
          from public.inspection_execution_targets target
         where target.company_id = new.company_id
           and target.branch_id = new.branch_id
           and target.execution_id = new.inspection_id
           and target.target_type = 'ROOM'
           and target.room_id = new.room_id
         for key share;
      end if;
    end if;
  else
    select target.* into target_record
      from public.inspection_execution_targets target
     where target.company_id = new.company_id
       and target.branch_id = new.branch_id
       and target.execution_id = new.inspection_id
       and target.id = new.execution_target_id
       and target.target_type = 'ROOM'
       and target.room_id = new.room_id
     for key share;
    if not found then
      raise foreign_key_violation using
        message = 'inspection item execution target is invalid';
    end if;
  end if;

  if target_record.room_number_snapshot is distinct from room_record.room_number
     or target_record.floor_label_snapshot is distinct from room_record.floor_label
     or target_record.floor_sort_key_snapshot is distinct from room_record.floor_sort_key
     or target_record.room_type_name_snapshot is distinct from room_record.room_type_name then
    raise check_violation using
      message = 'inspection execution ROOM target snapshot conflict';
  end if;

  new.execution_target_id := target_record.id;
  new.room_number_snapshot := target_record.room_number_snapshot;
  new.floor_label_snapshot := target_record.floor_label_snapshot;
  new.floor_sort_key_snapshot := target_record.floor_sort_key_snapshot;
  new.room_type_name_snapshot := target_record.room_type_name_snapshot;
  return new;
end
$function$;

revoke all on function public.inspection_item_execution_target_capture_v1()
  from public;

-- Trigger names execute alphabetically. This target trigger runs before the
-- existing room snapshot capture trigger and holds the room/type key-share locks.
create trigger inspection_item_execution_target_capture
before insert on public.inspection_item_snapshots
for each row execute function public.inspection_item_execution_target_capture_v1();

-- Remove every direct non-owner grant, including grants introduced by default
-- privileges for roles that are not yet registered as runtime capabilities.
do $direct_acl$
declare
  role_record record;
  column_acl_record record;
begin
  for role_record in
    select distinct grantee_role.rolname as role_name
      from pg_class target_table
      cross join lateral aclexplode(coalesce(
        target_table.relacl,
        acldefault('r'::"char",target_table.relowner)
      )) target_acl
      join pg_roles grantee_role on grantee_role.oid=target_acl.grantee
     where target_table.oid='public.inspection_execution_targets'::regclass
       and target_acl.grantee<>target_table.relowner
  loop
    execute pg_catalog.format(
      'revoke all privileges on table public.inspection_execution_targets from %I',
      role_record.role_name
    );
  end loop;

  for role_record in
    select distinct grantee_role.rolname as role_name
      from pg_proc capture_function
      cross join lateral aclexplode(coalesce(
        capture_function.proacl,
        acldefault('f'::"char",capture_function.proowner)
      )) capture_acl
      join pg_roles grantee_role on grantee_role.oid=capture_acl.grantee
     where capture_function.oid=
       'public.inspection_item_execution_target_capture_v1()'::regprocedure
       and capture_acl.grantee<>capture_function.proowner
  loop
    execute pg_catalog.format(
      'revoke all privileges on function public.inspection_item_execution_target_capture_v1() from %I',
      role_record.role_name
    );
  end loop;

  for column_acl_record in
    select distinct column_record.attname as column_name,
           column_acl.privilege_type,
           grantee_role.rolname as role_name
      from pg_attribute column_record
      cross join lateral aclexplode(column_record.attacl) column_acl
      join pg_roles grantee_role on grantee_role.oid=column_acl.grantee
      join pg_class target_table on target_table.oid=column_record.attrelid
     where column_record.attrelid='public.inspection_execution_targets'::regclass
       and column_record.attnum>0
       and not column_record.attisdropped
       and column_acl.grantee<>target_table.relowner
  loop
    if column_acl_record.privilege_type not in (
      'SELECT','INSERT','UPDATE','REFERENCES'
    ) then
      raise exception 'unexpected target column privilege type';
    end if;
    execute pg_catalog.format(
      'revoke %s (%I) on table public.inspection_execution_targets from %I',
      column_acl_record.privilege_type,
      column_acl_record.column_name,
      column_acl_record.role_name
    );
  end loop;
end
$direct_acl$;

insert into public.schema_migrations(version)
values ('0037_hotel_inspection_execution_targets')
on conflict (version) do nothing;

commit;
