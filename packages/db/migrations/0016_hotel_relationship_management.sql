begin;

do $$
begin
  if not exists (
    select 1 from schema_migrations where version = '0014_neon_definer_expand_compatibility'
  ) then
    raise exception 'migration 0014 must be applied first' using errcode = '55000';
  end if;
end
$$;

do $auth_definer_grant$
begin
  execute pg_catalog.format(
    'grant werehere_auth_session_definer to %I with inherit false, set true',
    current_user
  );
end
$auth_definer_grant$;

grant create on schema public to werehere_auth_session_definer;

set local role werehere_auth_session_definer;

create function public.auth_revoke_hotel_owner_sessions_v1(
  p_company_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
volatile
parallel unsafe
not leakproof
security definer
set search_path = pg_catalog
as $function$
declare
  v_revoked_count integer;
begin
  if p_company_id is null
     or p_user_id is null
     or p_company_id is distinct from public.api_current_company_id() then
    raise insufficient_privilege using message = 'active API tenant authority is required';
  end if;

  update public.auth_sessions
  set revoked_at = pg_catalog.statement_timestamp(),
      revoke_reason = 'HOTEL_OWNER_TRANSFERRED'
  where company_id = p_company_id
    and user_id = p_user_id
    and revoked_at is null;
  get diagnostics v_revoked_count = row_count;
  return v_revoked_count;
end
$function$;

revoke all privileges on function public.auth_revoke_hotel_owner_sessions_v1(uuid, uuid)
  from public;

reset role;

revoke create on schema public from werehere_auth_session_definer;

do $auth_definer_revoke$
begin
  execute pg_catalog.format(
    'revoke werehere_auth_session_definer from %I granted by %I',
    current_user,
    current_user
  );
end
$auth_definer_revoke$;

alter table hotel_staff_assignments
  add column version integer not null default 1 check (version > 0),
  add column terminated_at timestamptz,
  add column termination_reason text,
  add column terminated_by uuid,
  add constraint hotel_staff_assignments_terminated_by_fkey
    foreign key (company_id, terminated_by) references users(company_id, id),
  add constraint hotel_staff_assignments_termination_shape check (
    (terminated_at is null and termination_reason is null and terminated_by is null)
    or (terminated_at is not null and btrim(termination_reason) <> '' and terminated_by is not null and end_date is not null)
  );

alter table housekeeping_hotel_links
  add column version integer not null default 1 check (version > 0),
  add column terminated_at timestamptz,
  add column termination_reason text,
  add column terminated_by uuid,
  add constraint housekeeping_hotel_links_terminated_by_fkey
    foreign key (company_id, terminated_by) references users(company_id, id),
  add constraint housekeeping_hotel_links_termination_shape check (
    (terminated_at is null and termination_reason is null and terminated_by is null)
    or (terminated_at is not null and btrim(termination_reason) <> '' and terminated_by is not null and end_date is not null)
  );

alter table hotel_owner_assignments
  add column version integer not null default 1 check (version > 0),
  add column terminated_at timestamptz,
  add column termination_reason text,
  add column terminated_by uuid,
  add constraint hotel_owner_assignments_terminated_by_fkey
    foreign key (company_id, terminated_by) references users(company_id, id),
  add constraint hotel_owner_assignments_termination_shape check (
    (terminated_at is null and termination_reason is null and terminated_by is null)
    or (terminated_at is not null and btrim(termination_reason) <> '' and terminated_by is not null and end_date is not null)
  );

-- A terminated relationship is historical even when its inclusive end_date is today.
-- Excluding it from overlap checks permits emergency end and owner transfer to take
-- effect immediately without deleting or rewriting history.
alter table hotel_staff_assignments drop constraint hotel_staff_assignments_primary_period_excl;
alter table hotel_staff_assignments
  add constraint hotel_staff_assignments_primary_period_excl
  exclude using gist (
    company_id with =,
    user_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  ) where (assignment_type = 'PRIMARY' and terminated_at is null);

alter table housekeeping_hotel_links drop constraint housekeeping_hotel_links_period_excl;
alter table housekeeping_hotel_links
  add constraint housekeeping_hotel_links_period_excl
  exclude using gist (
    company_id with =,
    branch_id with =,
    user_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  ) where (terminated_at is null);

alter table hotel_owner_assignments drop constraint hotel_owner_assignments_user_period_excl;
alter table hotel_owner_assignments
  add constraint hotel_owner_assignments_user_period_excl
  exclude using gist (
    company_id with =,
    user_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  ) where (terminated_at is null);

alter table hotel_owner_assignments drop constraint hotel_owner_assignments_hotel_period_excl;
alter table hotel_owner_assignments
  add constraint hotel_owner_assignments_hotel_period_excl
  exclude using gist (
    company_id with =,
    branch_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  ) where (terminated_at is null);

create function public.reject_hotel_relationship_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'hotel relationship history cannot be physically deleted' using errcode = '55000';
end
$$;
revoke all on function public.reject_hotel_relationship_delete() from public;

create trigger hotel_staff_assignments_no_delete
before delete on hotel_staff_assignments
for each row execute function public.reject_hotel_relationship_delete();
create trigger housekeeping_hotel_links_no_delete
before delete on housekeeping_hotel_links
for each row execute function public.reject_hotel_relationship_delete();
create trigger hotel_owner_assignments_no_delete
before delete on hotel_owner_assignments
for each row execute function public.reject_hotel_relationship_delete();

insert into permissions (code, description) values
  ('HOTEL_ASSIGNMENT_MANAGE', '호텔 사내·하우스키핑 배정 관리'),
  ('HOTEL_OWNER_MANAGE', '호텔 소유주 연결·즉시 교체 관리'),
  ('HOTEL_STATUS_MANAGE', '호텔 운영상태 관리'),
  ('HOTEL_PERMISSION_MANAGE', '호텔 추가기능 권한 관리')
on conflict (code) do update set description = excluded.description;

insert into schema_migrations (version) values ('0016_hotel_relationship_management');

commit;
