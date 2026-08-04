begin;

create table public.inspection_checklist_v2_revisions (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  version integer not null check (version >= 1),
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (company_id, id),
  unique (company_id, branch_id, id),
  unique (company_id, branch_id, version),
  foreign key (company_id, branch_id)
    references public.hotel_profiles(company_id, branch_id),
  foreign key (company_id, created_by)
    references public.users(company_id, id)
);

create table public.inspection_checklist_v2_items (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  revision_id uuid not null,
  source_item_id uuid not null,
  target_type text not null check (target_type in ('ROOM', 'FACILITY')),
  source text not null check (source in ('HOTEL_COMMON', 'TARGET_TYPE_ADDED')),
  room_type_id uuid,
  facility_type_id uuid,
  name text not null check (btrim(name) <> '' and char_length(name) <= 150),
  description text check (description is null or char_length(btrim(description)) between 1 and 1000),
  is_required boolean not null,
  display_order integer not null check (display_order between 0 and 100000),
  default_severity text not null check (default_severity in ('OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL')),
  created_at timestamptz not null default statement_timestamp(),
  unique (company_id, id),
  unique (company_id, branch_id, revision_id, id, target_type),
  unique (company_id, branch_id, revision_id, source_item_id),
  foreign key (company_id, branch_id, revision_id)
    references public.inspection_checklist_v2_revisions(company_id, branch_id, id),
  constraint inspection_checklist_v2_items_room_type_fkey
    foreign key (company_id, room_type_id)
    references public.hotel_room_types(company_id, id),
  constraint inspection_checklist_v2_items_facility_type_fkey
    foreign key (company_id, branch_id, facility_type_id)
    references public.hotel_facility_types(company_id, branch_id, id),
  constraint inspection_checklist_v2_items_target_check check (
    (target_type = 'ROOM' and facility_type_id is null and
      ((source = 'HOTEL_COMMON' and room_type_id is null)
       or (source = 'TARGET_TYPE_ADDED' and room_type_id is not null)))
    or
    (target_type = 'FACILITY' and room_type_id is null and
      ((source = 'HOTEL_COMMON' and facility_type_id is null)
       or (source = 'TARGET_TYPE_ADDED' and facility_type_id is not null)))
  )
);

create table public.inspection_checklist_v2_item_exclusions (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  revision_id uuid not null,
  checklist_item_id uuid not null,
  target_type text not null check (target_type in ('ROOM', 'FACILITY')),
  room_type_id uuid,
  facility_type_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  unique (company_id, id),
  unique nulls not distinct (
    company_id, branch_id, revision_id, checklist_item_id,
    target_type, room_type_id, facility_type_id
  ),
  foreign key (company_id, branch_id, revision_id, checklist_item_id, target_type)
    references public.inspection_checklist_v2_items(
      company_id, branch_id, revision_id, id, target_type
    ),
  constraint inspection_checklist_v2_exclusions_room_type_fkey
    foreign key (company_id, room_type_id)
    references public.hotel_room_types(company_id, id),
  constraint inspection_checklist_v2_exclusions_facility_type_fkey
    foreign key (company_id, branch_id, facility_type_id)
    references public.hotel_facility_types(company_id, branch_id, id),
  constraint inspection_checklist_v2_exclusions_target_check check (
    (target_type = 'ROOM' and room_type_id is not null and facility_type_id is null)
    or
    (target_type = 'FACILITY' and room_type_id is null and facility_type_id is not null)
  )
);

alter table public.inspection_checklist_v2_revisions enable row level security;
alter table public.inspection_checklist_v2_revisions force row level security;
alter table public.inspection_checklist_v2_items enable row level security;
alter table public.inspection_checklist_v2_items force row level security;
alter table public.inspection_checklist_v2_item_exclusions enable row level security;
alter table public.inspection_checklist_v2_item_exclusions force row level security;

create policy inspection_checklist_v2_revisions_company_isolation
on public.inspection_checklist_v2_revisions
using (
  case
    when public.runtime_is_schema_owner() then true
    when current_user = 'werehere_auth_session_definer' then true
    when current_user = 'werehere_tenant_authority_definer' then true
    when public.runtime_has_capability('API_RUNTIME') then company_id = public.api_current_company_id()
    when public.runtime_has_capability('RECONCILER') then company_id = public.reconciler_current_company_id()
    when not public.runtime_has_capability('API_RUNTIME') and not public.runtime_has_capability('RECONCILER')
      then company_id = nullif(current_setting('app.company_id', true), '')::uuid
    else false
  end
)
with check (
  case
    when public.runtime_is_schema_owner() then true
    when current_user = 'werehere_auth_session_definer' then true
    when current_user = 'werehere_tenant_authority_definer' then true
    when public.runtime_has_capability('API_RUNTIME') then company_id = public.api_current_company_id()
    when public.runtime_has_capability('RECONCILER') then company_id = public.reconciler_current_company_id()
    when not public.runtime_has_capability('API_RUNTIME') and not public.runtime_has_capability('RECONCILER')
      then company_id = nullif(current_setting('app.company_id', true), '')::uuid
    else false
  end
);

create policy inspection_checklist_v2_items_company_isolation
on public.inspection_checklist_v2_items
using (
  case
    when public.runtime_is_schema_owner() then true
    when current_user = 'werehere_auth_session_definer' then true
    when current_user = 'werehere_tenant_authority_definer' then true
    when public.runtime_has_capability('API_RUNTIME') then company_id = public.api_current_company_id()
    when public.runtime_has_capability('RECONCILER') then company_id = public.reconciler_current_company_id()
    when not public.runtime_has_capability('API_RUNTIME') and not public.runtime_has_capability('RECONCILER')
      then company_id = nullif(current_setting('app.company_id', true), '')::uuid
    else false
  end
)
with check (
  case
    when public.runtime_is_schema_owner() then true
    when current_user = 'werehere_auth_session_definer' then true
    when current_user = 'werehere_tenant_authority_definer' then true
    when public.runtime_has_capability('API_RUNTIME') then company_id = public.api_current_company_id()
    when public.runtime_has_capability('RECONCILER') then company_id = public.reconciler_current_company_id()
    when not public.runtime_has_capability('API_RUNTIME') and not public.runtime_has_capability('RECONCILER')
      then company_id = nullif(current_setting('app.company_id', true), '')::uuid
    else false
  end
);

create policy inspection_checklist_v2_item_exclusions_company_isolation
on public.inspection_checklist_v2_item_exclusions
using (
  case
    when public.runtime_is_schema_owner() then true
    when current_user = 'werehere_auth_session_definer' then true
    when current_user = 'werehere_tenant_authority_definer' then true
    when public.runtime_has_capability('API_RUNTIME') then company_id = public.api_current_company_id()
    when public.runtime_has_capability('RECONCILER') then company_id = public.reconciler_current_company_id()
    when not public.runtime_has_capability('API_RUNTIME') and not public.runtime_has_capability('RECONCILER')
      then company_id = nullif(current_setting('app.company_id', true), '')::uuid
    else false
  end
)
with check (
  case
    when public.runtime_is_schema_owner() then true
    when current_user = 'werehere_auth_session_definer' then true
    when current_user = 'werehere_tenant_authority_definer' then true
    when public.runtime_has_capability('API_RUNTIME') then company_id = public.api_current_company_id()
    when public.runtime_has_capability('RECONCILER') then company_id = public.reconciler_current_company_id()
    when not public.runtime_has_capability('API_RUNTIME') and not public.runtime_has_capability('RECONCILER')
      then company_id = nullif(current_setting('app.company_id', true), '')::uuid
    else false
  end
);

revoke all on table public.inspection_checklist_v2_revisions from public;
revoke all on table public.inspection_checklist_v2_items from public;
revoke all on table public.inspection_checklist_v2_item_exclusions from public;

create trigger inspection_checklist_v2_revisions_append_only
before update or delete on public.inspection_checklist_v2_revisions
for each row execute function public.reject_hotel_immutable_change();
create trigger inspection_checklist_v2_items_append_only
before update or delete on public.inspection_checklist_v2_items
for each row execute function public.reject_hotel_immutable_change();
create trigger inspection_checklist_v2_item_exclusions_append_only
before update or delete on public.inspection_checklist_v2_item_exclusions
for each row execute function public.reject_hotel_immutable_change();

create function public.inspection_checklist_v2_snapshot_v1(
  p_company_id uuid,
  p_branch_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select pg_catalog.jsonb_build_object(
    'id', revision.id,
    'hotelId', revision.branch_id,
    'version', revision.version,
    'reason', revision.reason,
    'items', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'itemId', item.source_item_id,
          'targetType', item.target_type,
          'source', item.source,
          'name', item.name,
          'description', item.description,
          'isRequired', item.is_required,
          'displayOrder', item.display_order,
          'defaultSeverity', item.default_severity
        ) || case item.target_type
          when 'ROOM' then pg_catalog.jsonb_build_object(
            'roomTypeId', item.room_type_id,
            'excludedRoomTypeIds', coalesce((
              select pg_catalog.jsonb_agg(exclusion.room_type_id order by exclusion.room_type_id)
                from public.inspection_checklist_v2_item_exclusions exclusion
               where exclusion.company_id = item.company_id
                 and exclusion.branch_id = item.branch_id
                 and exclusion.checklist_item_id = item.id
                 and exclusion.target_type = 'ROOM'
            ), '[]'::jsonb)
          )
          else pg_catalog.jsonb_build_object(
            'facilityTypeId', item.facility_type_id,
            'excludedFacilityTypeIds', coalesce((
              select pg_catalog.jsonb_agg(exclusion.facility_type_id order by exclusion.facility_type_id)
                from public.inspection_checklist_v2_item_exclusions exclusion
               where exclusion.company_id = item.company_id
                 and exclusion.branch_id = item.branch_id
                 and exclusion.checklist_item_id = item.id
                 and exclusion.target_type = 'FACILITY'
            ), '[]'::jsonb)
          ) end
        order by item.target_type, item.display_order, item.source_item_id
      )
        from public.inspection_checklist_v2_items item
       where item.company_id = revision.company_id
         and item.branch_id = revision.branch_id
         and item.revision_id = revision.id
    ), '[]'::jsonb),
    'createdBy', revision.created_by,
    'createdAt', pg_catalog.to_char(revision.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
    from public.inspection_checklist_v2_revisions revision
   where revision.company_id = p_company_id
     and revision.branch_id = p_branch_id
   order by revision.version desc
   limit 1
$function$;
revoke all on function public.inspection_checklist_v2_snapshot_v1(uuid, uuid) from public;

-- Mirror legacy ROOM-only revisions after all legacy item rows are visible at commit.
create function public.inspection_checklist_v1_sync_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_revision_id uuid;
  v_item record;
begin
  if current_setting('app.checklist_v2_dual_write', true) = '1' then
    return new;
  end if;
  if exists (
    select 1 from public.inspection_checklist_v2_revisions revision
     where revision.company_id = new.company_id
       and revision.branch_id = new.branch_id
       and revision.version = new.version
  ) then
    return new;
  end if;
  v_revision_id := pg_catalog.gen_random_uuid();
  insert into public.inspection_checklist_v2_revisions (
    id, company_id, branch_id, version, reason, created_by, created_at
  ) values (
    v_revision_id, new.company_id, new.branch_id, new.version,
    new.reason, new.created_by, new.created_at
  );
  for v_item in
    select item.* from public.inspection_checklist_items item
     where item.company_id = new.company_id and item.revision_id = new.id
     order by item.display_order, item.id
  loop
    insert into public.inspection_checklist_v2_items (
      id, company_id, branch_id, revision_id, source_item_id,
      target_type, source, room_type_id, name, description,
      is_required, display_order, default_severity, created_at
    ) values (
      pg_catalog.gen_random_uuid(), new.company_id, new.branch_id, v_revision_id,
      v_item.source_item_id, 'ROOM',
      case v_item.source when 'ROOM_TYPE_ADDED' then 'TARGET_TYPE_ADDED' else 'HOTEL_COMMON' end,
      v_item.room_type_id, v_item.name, v_item.description,
      v_item.is_required, v_item.display_order, v_item.default_severity, v_item.created_at
    );
  end loop;
  insert into public.inspection_checklist_v2_item_exclusions (
    id, company_id, branch_id, revision_id, checklist_item_id,
    target_type, room_type_id, created_at
  )
  select pg_catalog.gen_random_uuid(), new.company_id, new.branch_id, v_revision_id,
         v2_item.id, 'ROOM', exclusion.room_type_id, exclusion.created_at
    from public.inspection_checklist_item_exclusions exclusion
    join public.inspection_checklist_items legacy_item
      on legacy_item.company_id = exclusion.company_id
     and legacy_item.id = exclusion.checklist_item_id
    join public.inspection_checklist_v2_items v2_item
      on v2_item.company_id = legacy_item.company_id
     and v2_item.branch_id = new.branch_id
     and v2_item.revision_id = v_revision_id
     and v2_item.source_item_id = legacy_item.source_item_id
   where exclusion.company_id = new.company_id
     and exclusion.revision_id = new.id;
  return new;
end
$function$;
revoke all on function public.inspection_checklist_v1_sync_v2() from public;

create constraint trigger inspection_checklist_v1_sync_v2
  after insert on public.inspection_checklist_revisions
  deferrable initially deferred
  for each row execute function public.inspection_checklist_v1_sync_v2();

-- Backfill every legacy revision so version identity remains deterministic.
insert into public.inspection_checklist_v2_revisions (
  id, company_id, branch_id, version, reason, created_by, created_at
)
select pg_catalog.gen_random_uuid(), revision.company_id, revision.branch_id,
       revision.version, revision.reason, revision.created_by, revision.created_at
  from public.inspection_checklist_revisions revision
 on conflict (company_id, branch_id, version) do nothing;

insert into public.inspection_checklist_v2_items (
  id, company_id, branch_id, revision_id, source_item_id,
  target_type, source, room_type_id, name, description,
  is_required, display_order, default_severity, created_at
)
select pg_catalog.gen_random_uuid(), item.company_id, revision.branch_id,
       v2_revision.id, item.source_item_id, 'ROOM',
       case item.source when 'ROOM_TYPE_ADDED' then 'TARGET_TYPE_ADDED' else 'HOTEL_COMMON' end,
       item.room_type_id, item.name, item.description,
       item.is_required, item.display_order, item.default_severity, item.created_at
  from public.inspection_checklist_items item
  join public.inspection_checklist_revisions revision
    on revision.company_id = item.company_id and revision.id = item.revision_id
  join public.inspection_checklist_v2_revisions v2_revision
    on v2_revision.company_id = revision.company_id
   and v2_revision.branch_id = revision.branch_id
   and v2_revision.version = revision.version;

insert into public.inspection_checklist_v2_item_exclusions (
  id, company_id, branch_id, revision_id, checklist_item_id,
  target_type, room_type_id, created_at
)
select pg_catalog.gen_random_uuid(), exclusion.company_id, revision.branch_id,
       v2_revision.id, v2_item.id, 'ROOM', exclusion.room_type_id, exclusion.created_at
  from public.inspection_checklist_item_exclusions exclusion
  join public.inspection_checklist_revisions revision
    on revision.company_id = exclusion.company_id and revision.id = exclusion.revision_id
  join public.inspection_checklist_items legacy_item
    on legacy_item.company_id = exclusion.company_id and legacy_item.id = exclusion.checklist_item_id
  join public.inspection_checklist_v2_revisions v2_revision
    on v2_revision.company_id = revision.company_id
   and v2_revision.branch_id = revision.branch_id
   and v2_revision.version = revision.version
  join public.inspection_checklist_v2_items v2_item
    on v2_item.company_id = legacy_item.company_id
   and v2_item.branch_id = revision.branch_id
   and v2_item.revision_id = v2_revision.id
   and v2_item.source_item_id = legacy_item.source_item_id;

create function public.hotel_inspection_checklist_v2_command(
  p_company_id uuid, p_branch_id uuid, p_resource_id uuid, p_action text,
  p_expected_version integer, p_value jsonb, p_session_token text,
  p_idempotency_record_id uuid, p_idempotency_key text, p_http_method text,
  p_operation_path text, p_request_hash text, p_audit_event_id uuid, p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_actor record;
  v_existing record;
  v_current_version integer;
  v_legacy_version integer;
  v_next_version integer;
  v_revision_id uuid;
  v_legacy_revision_id uuid;
  v_snapshot jsonb;
  v_item jsonb;
  v_exclusion jsonb;
  v_snapshot_id uuid;
  v_legacy_snapshot_id uuid;
  v_target_type text;
  v_source text;
  v_type_id uuid;
  v_room_count integer := 0;
  v_facility_count integer := 0;
begin
  if p_action not in ('READ_CHECKLIST_V2', 'SAVE_CHECKLIST_V2') then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id, p_branch_id, p_session_token,
      case when p_action = 'SAVE_CHECKLIST_V2' then 'HOTEL_INSPECTION_CONFIG' else 'HOTEL_INSPECTION_RUN' end,
      true
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;
  if p_action = 'READ_CHECKLIST_V2' then
    return query select 'OK'::text,
      public.inspection_checklist_v2_snapshot_v1(p_company_id, p_branch_id);
    return;
  end if;
  if pg_catalog.btrim(coalesce(p_idempotency_key, '')) = ''
     or p_http_method <> 'PUT'
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
   where company_id = p_company_id and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key and http_method = p_http_method
     and operation_path = p_operation_path and expires_at <= v_now;
  select idempotency.request_hash, idempotency.result_snapshot into v_existing
    from public.idempotency_records idempotency
   where idempotency.company_id = p_company_id
     and idempotency.actor_user_id = v_actor.user_id
     and idempotency.idempotency_key = p_idempotency_key
     and idempotency.http_method = p_http_method
     and idempotency.operation_path = p_operation_path
     and idempotency.status = 'COMPLETED';
  if found then
    return query select
      case when v_existing.request_hash = p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end,
      case when v_existing.request_hash = p_request_hash then v_existing.result_snapshot else null::jsonb end;
    return;
  end if;
  select version into v_current_version
    from public.inspection_checklist_v2_revisions
   where company_id = p_company_id and branch_id = p_branch_id
   order by version desc limit 1 for update;
  if (not found and p_expected_version <> 0)
     or (found and v_current_version <> p_expected_version) then
    return query select 'VERSION_CONFLICT'::text, null::jsonb;
    return;
  end if;
  select version into v_legacy_version
    from public.inspection_checklist_revisions
   where company_id = p_company_id and branch_id = p_branch_id
   order by version desc limit 1 for update;
  if coalesce(v_legacy_version, 0) <> p_expected_version then
    return query select 'VERSION_CONFLICT'::text, null::jsonb;
    return;
  end if;
  if pg_catalog.jsonb_typeof(p_value -> 'items') <> 'array'
     or pg_catalog.jsonb_array_length(p_value -> 'items') < 2
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_value ->> 'reason', ''))) not between 2 and 500 then
    return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb;
    return;
  end if;
  v_revision_id := (p_value ->> 'revisionId')::uuid;
  v_legacy_revision_id := (p_value ->> 'legacyRevisionId')::uuid;
  v_next_version := p_expected_version + 1;
  insert into public.inspection_checklist_v2_revisions (
    id, company_id, branch_id, version, reason, created_by
  ) values (
    v_revision_id, p_company_id, p_branch_id, v_next_version,
    p_value ->> 'reason', v_actor.user_id
  );
  for v_item in select * from pg_catalog.jsonb_array_elements(p_value -> 'items') loop
    v_target_type := v_item ->> 'targetType';
    v_source := v_item ->> 'source';
    if v_target_type = 'ROOM' then
      v_room_count := v_room_count + 1;
      v_type_id := nullif(v_item ->> 'roomTypeId', '')::uuid;
      if (v_source = 'HOTEL_COMMON' and v_type_id is not null)
         or (v_source = 'TARGET_TYPE_ADDED' and not exists (
           select 1 from public.hotel_room_types room_type
            where room_type.company_id = p_company_id
              and room_type.id = v_type_id and room_type.is_active
              and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
         )) then
        return query select 'INVALID_TARGET'::text, null::jsonb; return;
      end if;
    elsif v_target_type = 'FACILITY' then
      v_facility_count := v_facility_count + 1;
      v_type_id := nullif(v_item ->> 'facilityTypeId', '')::uuid;
      if (v_source = 'HOTEL_COMMON' and v_type_id is not null)
         or (v_source = 'TARGET_TYPE_ADDED' and not exists (
           select 1 from public.hotel_facility_types facility_type
            where facility_type.company_id = p_company_id and facility_type.branch_id = p_branch_id
              and facility_type.id = v_type_id and facility_type.status = 'ACTIVE'
         )) then
        return query select 'INVALID_TARGET'::text, null::jsonb; return;
      end if;
    else
      return query select 'INVALID_TARGET'::text, null::jsonb; return;
    end if;
    v_snapshot_id := (v_item ->> 'snapshotId')::uuid;
    insert into public.inspection_checklist_v2_items (
      id, company_id, branch_id, revision_id, source_item_id,
      target_type, source, room_type_id, facility_type_id,
      name, description, is_required, display_order, default_severity
    ) values (
      v_snapshot_id, p_company_id, p_branch_id, v_revision_id,
      (v_item ->> 'itemId')::uuid, v_target_type, v_source,
      case when v_target_type = 'ROOM' then v_type_id else null end,
      case when v_target_type = 'FACILITY' then v_type_id else null end,
      v_item ->> 'name', v_item ->> 'description',
      (v_item ->> 'isRequired')::boolean,
      (v_item ->> 'displayOrder')::integer,
      v_item ->> 'defaultSeverity'
    );
    for v_exclusion in select * from pg_catalog.jsonb_array_elements(
      case when v_target_type = 'ROOM'
        then v_item -> 'excludedRoomTypeIds'
        else v_item -> 'excludedFacilityTypeIds' end
    ) loop
      v_type_id := (v_exclusion #>> '{}')::uuid;
      if (v_target_type = 'ROOM' and not exists (
          select 1 from public.hotel_room_types room_type
           where room_type.company_id = p_company_id
             and room_type.id = v_type_id and room_type.is_active
             and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
        )) or (v_target_type = 'FACILITY' and not exists (
          select 1 from public.hotel_facility_types facility_type
           where facility_type.company_id = p_company_id and facility_type.branch_id = p_branch_id
             and facility_type.id = v_type_id and facility_type.status = 'ACTIVE'
        )) then
        return query select 'INVALID_TARGET'::text, null::jsonb; return;
      end if;
      insert into public.inspection_checklist_v2_item_exclusions (
        id, company_id, branch_id, revision_id, checklist_item_id,
        target_type, room_type_id, facility_type_id
      ) values (
        pg_catalog.gen_random_uuid(), p_company_id, p_branch_id, v_revision_id,
        v_snapshot_id, v_target_type,
        case when v_target_type = 'ROOM' then v_type_id else null end,
        case when v_target_type = 'FACILITY' then v_type_id else null end
      );
    end loop;
  end loop;
  if v_room_count = 0 or v_facility_count = 0 then
    return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb;
    return;
  end if;
  perform pg_catalog.set_config('app.checklist_v2_dual_write', '1', true);
  insert into public.inspection_checklist_revisions (
    id, company_id, branch_id, version, reason, created_by
  ) values (
    v_legacy_revision_id, p_company_id, p_branch_id, v_next_version,
    p_value ->> 'reason', v_actor.user_id
  );
  for v_item in
    select * from pg_catalog.jsonb_array_elements(p_value -> 'items')
     where value ->> 'targetType' = 'ROOM'
  loop
    v_legacy_snapshot_id := (v_item ->> 'legacySnapshotId')::uuid;
    insert into public.inspection_checklist_items (
      id, company_id, revision_id, source_item_id, source, room_type_id,
      name, description, is_required, display_order, default_severity
    ) values (
      v_legacy_snapshot_id, p_company_id, v_legacy_revision_id,
      (v_item ->> 'itemId')::uuid,
      case v_item ->> 'source' when 'TARGET_TYPE_ADDED' then 'ROOM_TYPE_ADDED' else 'HOTEL_COMMON' end,
      nullif(v_item ->> 'roomTypeId', '')::uuid,
      v_item ->> 'name', v_item ->> 'description',
      (v_item ->> 'isRequired')::boolean,
      (v_item ->> 'displayOrder')::integer,
      v_item ->> 'defaultSeverity'
    );
    for v_exclusion in select * from pg_catalog.jsonb_array_elements(v_item -> 'excludedRoomTypeIds') loop
      insert into public.inspection_checklist_item_exclusions (
        id, company_id, revision_id, checklist_item_id, room_type_id
      ) values (
        pg_catalog.gen_random_uuid(), p_company_id, v_legacy_revision_id,
        v_legacy_snapshot_id, (v_exclusion #>> '{}')::uuid
      );
    end loop;
  end loop;
  v_snapshot := public.inspection_checklist_v2_snapshot_v1(p_company_id, p_branch_id);
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id, 'HOTEL_INSPECTION_SAVE_CHECKLIST_V2', v_actor.user_id,
    v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
    'INSPECTION_CHECKLIST', v_revision_id,
    pg_catalog.jsonb_build_object('resourceId', v_revision_id, 'version', v_next_version),
    p_value ->> 'reason', 'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id, p_idempotency_key,
    p_http_method, p_operation_path, p_request_hash, 'COMPLETED',
    'INSPECTION_CHECKLIST', v_revision_id, p_audit_event_id, v_snapshot,
    v_now, v_now + interval '24 hours'
  );
  return query select case when p_expected_version = 0 then 'CREATED' else 'UPDATED' end, v_snapshot;
exception
  when invalid_text_representation or foreign_key_violation or check_violation then
    return query select 'INVALID_TARGET'::text, null::jsonb;
  when unique_violation then
    return query select 'DUPLICATE'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_inspection_checklist_v2_command(
  uuid, uuid, uuid, text, integer, jsonb, text, uuid, text, text, text, text, uuid, uuid
) from public;

-- Remove any default or explicit non-owner access. Runtime uses only the command function.
do $acl$
declare
  v_acl record;
begin
  for v_acl in
    select distinct grantee.rolname
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
      join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
     where namespace.nspname = 'public'
       and relation.relname in (
         'inspection_checklist_v2_revisions',
         'inspection_checklist_v2_items',
         'inspection_checklist_v2_item_exclusions'
       )
       and acl.grantee <> relation.relowner
  loop
    execute pg_catalog.format(
      'revoke all privileges on table public.inspection_checklist_v2_revisions, public.inspection_checklist_v2_items, public.inspection_checklist_v2_item_exclusions from %I',
      v_acl.rolname
    );
  end loop;
  for v_acl in
    select distinct grantee.rolname
      from pg_catalog.pg_proc procedure_record
      join pg_catalog.pg_namespace namespace on namespace.oid = procedure_record.pronamespace
      cross join lateral pg_catalog.aclexplode(coalesce(procedure_record.proacl, acldefault('f', procedure_record.proowner))) acl
      join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
     where namespace.nspname = 'public'
       and procedure_record.proname in (
         'inspection_checklist_v2_snapshot_v1',
         'inspection_checklist_v1_sync_v2',
         'hotel_inspection_checklist_v2_command'
       )
       and acl.grantee <> procedure_record.proowner
  loop
    execute pg_catalog.format(
      'revoke all privileges on function public.inspection_checklist_v2_snapshot_v1(uuid,uuid), public.inspection_checklist_v1_sync_v2(), public.hotel_inspection_checklist_v2_command(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid) from %I',
      v_acl.rolname
    );
  end loop;
end
$acl$;

insert into public.schema_migrations(version)
values ('0038_hotel_inspection_checklist_targets')
on conflict (version) do nothing;

commit;
