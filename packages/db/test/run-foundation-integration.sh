#!/usr/bin/env bash
set -euo pipefail

PG_BIN="${PG_BIN:-/usr/lib/postgresql/18/bin}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

configure_runtime_probe_roles() {
  local admin_url="$1"
  local api_password reconciler_password finalizer_password
  api_password="$(openssl rand -hex 24)"
  reconciler_password="$(openssl rand -hex 24)"
  finalizer_password="$(openssl rand -hex 24)"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
    -v api_password="$api_password" \
    -v reconciler_password="$reconciler_password" \
    -v finalizer_password="$finalizer_password" >/dev/null <<'SQL'
DO $roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'gw_runtime_api_probe',
    'gw_runtime_reconciler_probe',
    'gw_runtime_file_finalizer_probe'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      DELETE FROM hotel_file_finalizer_capabilities WHERE hotel_file_finalizer_capabilities.role_name = role_name;
      DELETE FROM runtime_database_capabilities WHERE runtime_database_capabilities.role_name = role_name;
      EXECUTE format('DROP OWNED BY %I', role_name);
      EXECUTE format('DROP ROLE %I', role_name);
    END IF;
  END LOOP;
END
$roles$;
CREATE ROLE gw_runtime_api_probe LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD :'api_password';
CREATE ROLE gw_runtime_reconciler_probe LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD :'reconciler_password';
CREATE ROLE gw_runtime_file_finalizer_probe LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD :'finalizer_password';

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM gw_runtime_api_probe, gw_runtime_reconciler_probe, gw_runtime_file_finalizer_probe;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM gw_runtime_api_probe, gw_runtime_reconciler_probe, gw_runtime_file_finalizer_probe;
GRANT USAGE ON SCHEMA public
  TO gw_runtime_api_probe, gw_runtime_reconciler_probe, gw_runtime_file_finalizer_probe;

GRANT SELECT ON companies, users, auth_identities, auth_sessions,
  runtime_database_capabilities, auth_login_transactions,
  auth_credential_rate_limits, schema_migrations, roles, permissions,
  user_role_memberships, user_groups, user_group_memberships,
  permission_grants, branches, hotel_profiles, idempotency_records,
  outbox_jobs, account_provisioning_attempts,
  initial_password_change_attempts, login_id_registry,
  hotel_staff_assignments, housekeeping_hotel_links,
  hotel_owner_assignments, hotel_room_types, hotel_rooms,
  hotel_room_status_history, hotel_file_finalizer_capabilities
  TO gw_runtime_api_probe;
GRANT INSERT, UPDATE, DELETE ON auth_login_transactions,
  auth_credential_rate_limits, idempotency_records TO gw_runtime_api_probe;
GRANT INSERT ON audit_events, branches, hotel_profiles, auth_identities,
  hotel_staff_assignments, housekeeping_hotel_links,
  hotel_owner_assignments, hotel_room_types, hotel_rooms,
  hotel_room_status_history, login_id_registry TO gw_runtime_api_probe;
GRANT INSERT, UPDATE ON users, account_provisioning_attempts,
  initial_password_change_attempts, outbox_jobs TO gw_runtime_api_probe;
GRANT UPDATE (updated_at) ON auth_identities, branches, hotel_profiles
  TO gw_runtime_api_probe;
GRANT UPDATE (version) ON hotel_profiles TO gw_runtime_api_probe;
GRANT UPDATE (
  end_date, terminated_at, termination_reason, terminated_by, version, updated_at
) ON hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
  TO gw_runtime_api_probe;
GRANT UPDATE (name, display_order, is_active, version, updated_by, updated_at)
  ON hotel_room_types TO gw_runtime_api_probe;
GRANT UPDATE (
  room_number, floor_label, floor_sort_key, room_type_id, status,
  internal_note, owner_visible_note, planned_resume_date,
  version, updated_by, updated_at
) ON hotel_rooms TO gw_runtime_api_probe;
GRANT EXECUTE ON FUNCTION jsonb_reject_plaintext_password_keys(jsonb),
  runtime_is_schema_owner(), runtime_has_capability(text),
  api_current_company_id(), reconciler_current_company_id(),
  auth_create_session_v2(uuid,bytea,text,integer,integer,timestamptz,uuid),
  auth_resolve_login_identity_v1(text), auth_resolve_principal_v2(bytea,integer),
  auth_revoke_session_v2(bytea,text,uuid),
  auth_revoke_user_sessions_v1(uuid,uuid,text),
  auth_revoke_hotel_owner_sessions_v1(uuid,uuid),
  hotel_file_init_upload(uuid,uuid,text,uuid,text,text,bigint,text,timestamptz,uuid,text,text,uuid),
  hotel_file_complete_upload(uuid,text,text,bigint,text,uuid,uuid),
  hotel_file_link_clean_version(uuid,uuid,uuid,text,text,uuid),
  hotel_file_read_status(uuid)
  TO gw_runtime_api_probe;
INSERT INTO runtime_database_capabilities (role_name, capability)
VALUES ('gw_runtime_api_probe', 'API_RUNTIME');

GRANT SELECT ON schema_migrations, companies, permissions, users,
  auth_identities, branches, hotel_profiles, runtime_database_capabilities,
  outbox_jobs, account_provisioning_attempts, hotel_staff_assignments,
  housekeeping_hotel_links, hotel_owner_assignments,
  hotel_file_finalizer_capabilities TO gw_runtime_reconciler_probe;
GRANT INSERT ON users, auth_identities, audit_events, outbox_jobs,
  hotel_staff_assignments, housekeeping_hotel_links,
  hotel_owner_assignments TO gw_runtime_reconciler_probe;
GRANT UPDATE ON account_provisioning_attempts, outbox_jobs
  TO gw_runtime_reconciler_probe;
GRANT EXECUTE ON FUNCTION jsonb_reject_plaintext_password_keys(jsonb),
  runtime_is_schema_owner(), runtime_has_capability(text),
  api_current_company_id(), reconciler_current_company_id(),
  reconciliation_company_ids(),
  hotel_file_claim_scan_attempt(uuid,uuid,text,integer),
  hotel_file_complete_scan_attempt(uuid,bigint,text,bytea,text,bigint,bytea,text,text,text,text,text,integer)
  TO gw_runtime_reconciler_probe;
INSERT INTO runtime_database_capabilities (role_name, capability)
VALUES ('gw_runtime_reconciler_probe', 'RECONCILER');

GRANT SELECT ON schema_migrations, permissions, runtime_database_capabilities,
  hotel_file_finalizer_capabilities TO gw_runtime_file_finalizer_probe;
GRANT EXECUTE ON FUNCTION
  hotel_file_reserve_clean_promotion(uuid,uuid,uuid,text,text,integer),
  hotel_file_complete_clean_promotion(uuid,bigint,text,uuid,text,text,bytea,bigint,text)
  TO gw_runtime_file_finalizer_probe;
INSERT INTO hotel_file_finalizer_capabilities (role_name)
VALUES ('gw_runtime_file_finalizer_probe');
SQL
  node - "$admin_url" "$api_password" "$reconciler_password" "$finalizer_password" <<'NODE'
const [adminUrl, apiPassword, reconcilerPassword, finalizerPassword] = process.argv.slice(2);
for (const [role, password] of [
  ["gw_runtime_api_probe", apiPassword],
  ["gw_runtime_reconciler_probe", reconcilerPassword],
  ["gw_runtime_file_finalizer_probe", finalizerPassword],
]) {
  const url = new URL(adminUrl);
  url.username = role;
  url.password = password;
  console.log(url.toString());
}
NODE
}

assert_all_runtime_readiness() {
  local expected="$1"
  local api_url="$2"
  local reconciler_url="$3"
  local finalizer_url="$4"
  (
    cd "$ROOT_DIR"
    TEST_EXPECTED_READY="$expected" TEST_API_READY_URL="$api_url" \
      TEST_RECONCILER_READY_URL="$reconciler_url" \
      TEST_FINALIZER_READY_URL="$finalizer_url" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";
const expected = process.env.TEST_EXPECTED_READY;
for (const [label, url, capability] of [
  ["API", process.env.TEST_API_READY_URL, "API_RUNTIME"],
  ["RECONCILER", process.env.TEST_RECONCILER_READY_URL, "RECONCILER"],
  ["FILE_FINALIZER", process.env.TEST_FINALIZER_READY_URL, "FILE_FINALIZER"],
]) {
  const readiness = await probeDatabaseReadiness(url, { capability });
  if (readiness.status !== expected) {
    throw new Error(`${label} readiness mismatch: expected ${expected}, received ${readiness.status}`);
  }
}
NODE
  )
}

register_owner_api_capability() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
do $grant$
begin
  execute format(
    'grant werehere_tenant_authority_definer to %I with inherit false, set true',
    session_user
  );
end
$grant$;
set local role werehere_tenant_authority_definer;
insert into public.runtime_database_capabilities (role_name, capability)
values (session_user, 'API_RUNTIME')
on conflict (role_name) do update set capability = excluded.capability;
reset role;
do $revoke$
begin
  execute format(
    'revoke werehere_tenant_authority_definer from %I granted by %I',
    session_user,
    session_user
  );
end
$revoke$;
commit;
SQL
}

unregister_owner_api_capability() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
begin;
do $grant$
begin
  execute format(
    'grant werehere_tenant_authority_definer to %I with inherit false, set true',
    session_user
  );
end
$grant$;
set local role werehere_tenant_authority_definer;
delete from public.runtime_database_capabilities where role_name = session_user;
reset role;
do $revoke$
begin
  execute format(
    'revoke werehere_tenant_authority_definer from %I granted by %I',
    session_user,
    session_user
  );
end
$revoke$;
commit;
SQL
}

assert_room_constraints_exact() {
  local admin_url="$1"
  local probe_url="$2"
  local specification table_name constraint_name definition
  local dependent_table dependent_constraint dependent_definition
  local constraints=(
    "hotel_room_types:hotel_room_types_pkey"
    "hotel_room_types:hotel_room_types_company_id_fkey"
    "hotel_room_types:hotel_room_types_company_id_branch_id_fkey"
    "hotel_room_types:hotel_room_types_company_id_created_by_fkey"
    "hotel_room_types:hotel_room_types_company_id_updated_by_fkey"
    "hotel_room_types:hotel_room_types_company_id_id_key"
    "hotel_room_types:hotel_room_types_company_id_branch_id_normalized_name_key"
    "hotel_room_types:hotel_room_types_scope_check"
    "hotel_room_types:hotel_room_types_scope_shape"
    "hotel_room_types:hotel_room_types_name_check"
    "hotel_room_types:hotel_room_types_display_order_check"
    "hotel_room_types:hotel_room_types_version_check"
    "hotel_rooms:hotel_rooms_pkey"
    "hotel_rooms:hotel_rooms_company_id_fkey"
    "hotel_rooms:hotel_rooms_company_id_branch_id_fkey"
    "hotel_rooms:hotel_rooms_company_id_room_type_id_fkey"
    "hotel_rooms:hotel_rooms_company_id_created_by_fkey"
    "hotel_rooms:hotel_rooms_company_id_updated_by_fkey"
    "hotel_rooms:hotel_rooms_company_id_id_key"
    "hotel_rooms:hotel_rooms_company_branch_id_key"
    "hotel_rooms:hotel_rooms_company_id_branch_id_room_number_key"
    "hotel_rooms:hotel_rooms_room_number_check"
    "hotel_rooms:hotel_rooms_floor_label_check"
    "hotel_rooms:hotel_rooms_floor_sort_key_check"
    "hotel_rooms:hotel_rooms_status_check"
    "hotel_rooms:hotel_rooms_resume_shape"
    "hotel_rooms:hotel_rooms_internal_note_check"
    "hotel_rooms:hotel_rooms_owner_visible_note_check"
    "hotel_rooms:hotel_rooms_version_check"
    "hotel_room_status_history:hotel_room_status_history_pkey"
    "hotel_room_status_history:hotel_room_status_history_company_id_fkey"
    "hotel_room_status_history:hotel_room_status_history_company_id_branch_id_fkey"
    "hotel_room_status_history:hotel_room_status_history_room_hotel_fkey"
    "hotel_room_status_history:hotel_room_status_history_company_id_changed_by_fkey"
    "hotel_room_status_history:hotel_room_status_history_previous_status_check"
    "hotel_room_status_history:hotel_room_status_history_next_status_check"
    "hotel_room_status_history:hotel_room_status_history_reason_check"
    "hotel_room_status_history:hotel_room_status_history_transition"
    "hotel_room_status_history:hotel_room_status_history_resume_shape"
  )

  for specification in "${constraints[@]}"; do
    table_name="${specification%%:*}"
    constraint_name="${specification#*:}"
    dependent_table=""
    dependent_constraint=""
    if [[ "$constraint_name" == "hotel_room_types_company_id_id_key" ]]; then
      dependent_table="hotel_rooms"
      dependent_constraint="hotel_rooms_company_id_room_type_id_fkey"
    elif [[ "$constraint_name" == "hotel_rooms_company_branch_id_key" ]]; then
      dependent_table="hotel_room_status_history"
      dependent_constraint="hotel_room_status_history_room_hotel_fkey"
    fi
    definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" \
      -v constraint_name="$constraint_name" <<'SQL'
select pg_get_constraintdef(oid, true)
from pg_constraint
where conname = :'constraint_name';
SQL
)"
    if [[ -z "$definition" ]]; then
      printf 'Missing room constraint before damage probe: %s\n' "$constraint_name" >&2
      return 1
    fi
    if [[ -n "$dependent_constraint" ]]; then
      dependent_definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" \
        -v constraint_name="$dependent_constraint" <<'SQL'
select pg_get_constraintdef(oid, true)
from pg_constraint
where conname = :'constraint_name';
SQL
)"
      psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
        -v table_name="$dependent_table" -v constraint_name="$dependent_constraint" >/dev/null <<'SQL'
select format('alter table %I drop constraint %I', :'table_name', :'constraint_name') \gexec
SQL
    fi
    psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
      -v table_name="$table_name" -v constraint_name="$constraint_name" >/dev/null <<'SQL'
select format('alter table %I drop constraint %I', :'table_name', :'constraint_name') \gexec
SQL
    (
      cd "$ROOT_DIR"
      TEST_READY_URL="$probe_url" ROOM_CONSTRAINT="$constraint_name" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after ${process.env.ROOM_CONSTRAINT} damage, received ${damaged.status}`);
}
NODE
    )
    psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
      -v table_name="$table_name" -v constraint_name="$constraint_name" \
      -v definition="$definition" >/dev/null <<'SQL'
select format(
  'alter table %I add constraint %I %s',
  :'table_name', :'constraint_name', :'definition'
) \gexec
SQL
    if [[ -n "$dependent_constraint" ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
        -v table_name="$dependent_table" -v constraint_name="$dependent_constraint" \
        -v definition="$dependent_definition" >/dev/null <<'SQL'
select format(
  'alter table %I add constraint %I %s',
  :'table_name', :'constraint_name', :'definition'
) \gexec
SQL
    fi
  done
}

assert_room_fingerprint_damage() {
  local admin_url="$1"
  local probe_url="$2"
  local definition trigger_definition trigger_name

  probe_room_damage() {
    local damage_label="$1"
    (
      cd "$ROOT_DIR"
      TEST_READY_URL="$probe_url" DAMAGE_LABEL="$damage_label" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after ${process.env.DAMAGE_LABEL}, received ${damaged.status}`);
}
NODE
    )
  }

  definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
select pg_get_constraintdef(oid, true)
from pg_constraint
where conrelid = 'public.hotel_rooms'::regclass
  and conname = 'hotel_rooms_status_check';
SQL
)"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter table hotel_rooms drop constraint hotel_rooms_status_check;
update hotel_rooms set status = lower(status);
alter table hotel_rooms add constraint hotel_rooms_status_check
  check (status in ('active', 'temp_suspended', 'out_of_service'));
SQL
  probe_room_damage "lowercase hotel room status CHECK literal damage"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" -v definition="$definition" >/dev/null <<'SQL'
alter table hotel_rooms drop constraint hotel_rooms_status_check;
update hotel_rooms set status = upper(status);
select format('alter table hotel_rooms add constraint hotel_rooms_status_check %s', :'definition') \gexec
SQL

  for trigger_name in hotel_room_types_scope_immutable hotel_rooms_room_type_scope_guard; do
    trigger_definition="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" \
      -v trigger_name="$trigger_name" <<'SQL'
select pg_get_triggerdef(oid, true)
from pg_trigger
where tgrelid = case :'trigger_name'
  when 'hotel_room_types_scope_immutable' then 'public.hotel_room_types'::regclass
  else 'public.hotel_rooms'::regclass
end
and tgname = :'trigger_name';
SQL
)"
    if [[ "$trigger_name" == "hotel_room_types_scope_immutable" ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
drop trigger hotel_room_types_scope_immutable on hotel_room_types;
create trigger hotel_room_types_scope_immutable
before update of company_id on hotel_room_types
for each row execute function public.reject_hotel_room_type_scope_change();
SQL
    else
      psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
drop trigger hotel_rooms_room_type_scope_guard on hotel_rooms;
create trigger hotel_rooms_room_type_scope_guard
before insert or update of company_id on hotel_rooms
for each row execute function public.enforce_hotel_room_type_scope();
SQL
    fi
    probe_room_damage "partial ${trigger_name} protected-column damage"
    psql -X -v ON_ERROR_STOP=1 -d "$admin_url" \
      -v trigger_name="$trigger_name" -v definition="$trigger_definition" >/dev/null <<'SQL'
select format(
  'drop trigger %I on %s',
  :'trigger_name',
  case :'trigger_name'
    when 'hotel_room_types_scope_immutable' then 'hotel_room_types'
    else 'hotel_rooms'
  end
) \gexec
select :'definition' \gexec
SQL
  done

  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter policy hotel_rooms_company_isolation on hotel_rooms to gw_runtime_api_probe;
SQL
  probe_room_damage "hotel rooms RLS role contraction"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
alter policy hotel_rooms_company_isolation on hotel_rooms to public;
SQL
}

assert_legacy_auth_removed() {
  local admin_url="$1"
  local removed
  removed="$(psql -X -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
select to_regprocedure(
  'public.auth_create_session(uuid,bytea,text,integer,integer,timestamptz,uuid)'
) is null;
SQL
)"
  if [[ "$removed" != "t" ]]; then
    printf '%s\n' 'Contract retained the legacy auth_create_session function.' >&2
    return 1
  fi
}
assert_expand_isolated() {
  local admin_url="$1"
  local result
  result="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
select concat(
  (select status || ':' || failure_code
   from account_provisioning_attempts
   where id = '1a110000-0000-4000-8000-000000000001'),
  '|',
  (select status || ':' || last_error_code
   from outbox_jobs
   where id = '1b110000-0000-4000-8000-000000000001'),
  '|',
  (select status || ':' || coalesce(last_error_code, 'NULL')
   from outbox_jobs
   where id = '1b110000-0000-4000-8000-000000000003')
);
delete from outbox_jobs where id in (
  '1b110000-0000-4000-8000-000000000001',
  '1b110000-0000-4000-8000-000000000003'
);
delete from account_provisioning_attempts where id = '1a110000-0000-4000-8000-000000000001';
alter table users disable trigger users_no_delete;
delete from users where id = '1c110000-0000-4000-8000-000000000001';
alter table users enable trigger users_no_delete;
delete from companies where id = '1d110000-0000-4000-8000-000000000001';
SQL
)"
  if [[ "$result" != "DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE|DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE|DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE" ]]; then
    printf 'EXPAND did not isolate pre-existing legacy compensation: %s\n' "$result" >&2
    return 1
  fi
}

assert_exact_contract_isolated() {
  local admin_url="$1"
  local result
  result="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$admin_url" <<'SQL'
select concat(
  (select status || ':' || failure_code
   from account_provisioning_attempts
   where id = '1a110000-0000-4000-8000-000000000001'),
  '|',
  (select status || ':' || last_error_code
   from outbox_jobs
   where id = '1b110000-0000-4000-8000-000000000001'),
  '|',
  (select status || ':' || coalesce(last_error_code, 'NULL')
   from outbox_jobs
   where id = '1b110000-0000-4000-8000-000000000003'),
  '|',
  exists (
    select 1 from pg_constraint
    where conname = 'outbox_jobs_compensation_linkage_check'
      and conrelid = 'public.outbox_jobs'::regclass
  )
);
do $constraint_probe$
begin
  begin
    insert into outbox_jobs (id, company_id, job_type, payload, status)
    values (
      '1b110000-0000-4000-8000-000000000002',
      '1d110000-0000-4000-8000-000000000001',
      'ACCOUNT_PROVIDER_COMPENSATE',
      '{"userId":"1e110000-0000-4000-8000-000000000001","providerSubject":"legacy-provider-subject","action":"COMPENSATE"}'::jsonb,
      'PENDING'
    );
    raise exception 'unsafe compensation payload passed exact linkage check';
  exception when check_violation then
    null;
  end;
end
$constraint_probe$;
delete from outbox_jobs where id in (
  '1b110000-0000-4000-8000-000000000001',
  '1b110000-0000-4000-8000-000000000003'
);
delete from account_provisioning_attempts where id = '1a110000-0000-4000-8000-000000000001';
alter table users disable trigger users_no_delete;
delete from users where id = '1c110000-0000-4000-8000-000000000001';
alter table users enable trigger users_no_delete;
delete from companies where id = '1d110000-0000-4000-8000-000000000001';
SQL
)"
  if [[ "$result" != "DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE|DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE|DEAD_LETTER:LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE|t" ]]; then
    printf 'Legacy compensation migration did not isolate unsafe provider work: %s\n' "$result" >&2
    return 1
  fi
}

seed_legacy_compensation() {
  local admin_url="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$admin_url" >/dev/null <<'SQL'
insert into companies (id, legal_name)
values ('1d110000-0000-4000-8000-000000000001', 'Legacy Compensation Test');
insert into users (id, company_id, user_type, display_name, status)
values (
  '1c110000-0000-4000-8000-000000000001',
  '1d110000-0000-4000-8000-000000000001',
  'INTERNAL_STAFF', 'Legacy Actor', 'ACTIVE'
);
insert into account_provisioning_attempts (
  id, company_id, actor_user_id, target_user_id, idempotency_key,
  request_hash, completion_payload, status, provider_subject, failure_code,
  dispatched_at, provider_confirmed_at, compensation_required_at,
  lease_expires_at, expires_at
) values (
  '1a110000-0000-4000-8000-000000000001',
  '1d110000-0000-4000-8000-000000000001',
  '1c110000-0000-4000-8000-000000000001',
  '1e110000-0000-4000-8000-000000000001',
  'legacy-compensation', 'legacy-request',
  '{"userId":"1e110000-0000-4000-8000-000000000001","action":"CREATE"}'::jsonb,
  'COMPENSATION_REQUIRED', 'legacy-provider-subject', 'DB_COMPLETION_FAILED',
  now(), now(), now(), now() + interval '2 minutes', now() + interval '24 hours'
);
insert into outbox_jobs (
  id, company_id, job_type, payload, status, locked_at, claim_token
) values
(
  '1b110000-0000-4000-8000-000000000001',
  '1d110000-0000-4000-8000-000000000001',
  'ACCOUNT_PROVIDER_COMPENSATE',
  '{"userId":"1e110000-0000-4000-8000-000000000001","providerSubject":"legacy-provider-subject","action":"COMPENSATE"}'::jsonb,
  'PROCESSING', now(), '1f110000-0000-4000-8000-000000000001'
),
(
  '1b110000-0000-4000-8000-000000000003',
  '1d110000-0000-4000-8000-000000000001',
  'ACCOUNT_PROVIDER_COMPENSATE',
  '{"userId":"1e110000-0000-4000-8000-000000000001","providerSubject":"legacy-provider-subject","action":"COMPENSATE","provisioningAttemptId":"1a110000-0000-4000-8000-000000000099","originalErrorCode":"ACCOUNT_DUPLICATE"}'::jsonb,
  'PENDING', null, null
);
SQL
}

run_hotel_file_repository_journey() {
  local admin_url="$1"
  local api_url="$2"
  local reconciler_url="$3"
  local finalizer_url="$4"
  (
    cd "$ROOT_DIR"
    TEST_ADMIN_URL="$admin_url" TEST_API_URL="$api_url" \
      TEST_RECONCILER_URL="$reconciler_url" TEST_FINALIZER_URL="$finalizer_url" \
      pnpm --filter @werehere/db exec tsx <<'NODE'
import { createHash } from "node:crypto";
import postgres from "postgres";
import {
  createPostgresHotelFileApiRepository,
  createPostgresHotelFileFinalizerRepository,
  createPostgresHotelFileScannerRepository,
} from "./src/hotel-files.ts";

const adminUrl = process.env.TEST_ADMIN_URL;
const apiUrl = process.env.TEST_API_URL;
const reconcilerUrl = process.env.TEST_RECONCILER_URL;
const finalizerUrl = process.env.TEST_FINALIZER_URL;
if (!adminUrl || !apiUrl || !reconcilerUrl || !finalizerUrl) {
  throw new Error("Hotel file repository journey URLs are missing");
}
const ids = {
  company: "f1000000-0000-4000-8000-000000000001",
  user: "f2000000-0000-4000-8000-000000000001",
  identity: "f3000000-0000-4000-8000-000000000001",
  session: "f4000000-0000-4000-8000-000000000001",
  branch: "f5000000-0000-4000-8000-000000000001",
  parent: "f6000000-0000-4000-8000-000000000001",
  upload: "f7000000-0000-4000-8000-000000000001",
  scanJob: "f8000000-0000-4000-8000-000000000001",
  attempt: "f9000000-0000-4000-8000-000000000001",
  reservation: "fa000000-0000-4000-8000-000000000001",
  version: "fb000000-0000-4000-8000-000000000001",
  link: "fc000000-0000-4000-8000-000000000001",
};
const admin = postgres(adminUrl, { max: 1, prepare: false });
const api = createPostgresHotelFileApiRepository(apiUrl);
const scanner = createPostgresHotelFileScannerRepository(reconcilerUrl);
const finalizer = createPostgresHotelFileFinalizerRepository(finalizerUrl);
const finalizerSql = postgres(finalizerUrl, { max: 1, prepare: false });
const sha = createHash("sha256").update("foundation-clean-payload").digest();
const callbackHash = createHash("sha256").update("foundation-scan-callback").digest();
const conflictingCallbackHash = createHash("sha256").update("foundation-conflicting-callback").digest();
const quarantineKey = `quarantine/${createHash("sha256").update("foundation-source").digest("hex")}`;
const cleanKey = `clean/${createHash("sha256").update("foundation-clean").digest("hex")}`;
const expectStatus = (actual, expected, label) => {
  if (actual.status !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual.status}`);
  }
};
try {
  await admin.begin(async (sql) => {
    await sql`insert into companies(id, legal_name) values (${ids.company}, 'Foundation File Repository')`;
    await sql`insert into users(id, company_id, user_type, display_name) values (${ids.user}, ${ids.company}, 'INTERNAL_STAFF', 'Foundation File Actor')`;
    await sql`insert into auth_identities(id, company_id, user_id, provider, provider_subject) values (${ids.identity}, ${ids.company}, ${ids.user}, 'ZITADEL', 'foundation-file-repository-subject')`;
    await sql`insert into auth_sessions(id, company_id, user_id, identity_id, token_hash, idle_expires_at, absolute_expires_at, auth_time, authentication_method) values (${ids.session}, ${ids.company}, ${ids.user}, ${ids.identity}, ${Buffer.alloc(32, 1)}, now() + interval '1 hour', now() + interval '2 hours', now(), 'OIDC_PKCE')`;
    await sql`insert into branches(id, company_id, branch_type, branch_code, name) values (${ids.branch}, ${ids.company}, 'HOTEL', 'FILE-REPO', 'Foundation File Hotel')`;
    await sql`insert into hotel_profiles(company_id, branch_id, hotel_status, road_address, detail_address, representative_phone, contract_start_date, contract_end_date) values (${ids.company}, ${ids.branch}, 'PREPARING', 'Foundation Road', '', '02-0000-0026', '2026-01-01', '2026-12-31')`;
    await sql`insert into file_attachment_parents(company_id, branch_id, parent_type, parent_id, created_by) values (${ids.company}, ${ids.branch}, 'INSPECTION_RESULT', ${ids.parent}, ${ids.user})`;
  });

  const initInput = {
    actor: { sessionId: ids.session }, uploadId: ids.upload, branchId: ids.branch,
    parentType: "INSPECTION_RESULT", parentId: ids.parent,
    fileName: "foundation.jpg", mimeType: "image/jpeg", sizeBytes: 128,
    quarantineObjectKey: quarantineKey, expiresAt: new Date(Date.now() + 300_000),
    idempotencyRecordId: "fd000000-0000-4000-8000-000000000001",
    idempotencyKey: "foundation-file-init", requestHash: "foundation-file-init-hash",
    traceId: "fe000000-0000-4000-8000-000000000001",
  };
  expectStatus(await api.initializeUpload(initInput), "CREATED", "init upload");
  expectStatus(await api.initializeUpload(initInput), "REPLAYED", "init exact replay");

  const completeUploadInput = {
    actor: { sessionId: ids.session }, uploadId: ids.upload,
    sourceEtag: "foundation-source-etag", sourceObjectVersion: "foundation-source-v1",
    sourceSizeBytes: 128, sourceMimeType: "image/jpeg",
    scanJobId: ids.scanJob, traceId: "fe000000-0000-4000-8000-000000000002",
  };
  expectStatus(await api.completeUpload(completeUploadInput), "CREATED", "complete upload");
  expectStatus(await api.completeUpload(completeUploadInput), "REPLAYED", "complete upload exact replay");

  const claim = await scanner.claimScan({ companyId: ids.company, scanJobId: ids.scanJob, attemptId: ids.attempt, leaseSeconds: 60 });
  expectStatus(claim, "CLAIMED", "claim scan");
  if (claim.status !== "CLAIMED") throw new Error("claim result was incomplete");
  expectStatus(await scanner.completeScan({
    companyId: ids.company, attemptId: ids.attempt,
    claimGeneration: claim.claimGeneration + 1, claimToken: claim.claimToken,
    callbackBodyHash: callbackHash, verdict: "CLEAN", actualSizeBytes: 128,
    sha256: sha, detectedMimeType: "image/jpeg", engineName: "Foundation Scanner",
    engineVersion: "1", signatureDatabaseVersion: "1", failureCode: null,
    retryDelaySeconds: 30,
  }), "STALE_FENCE", "stale scan generation denial");
  expectStatus(await scanner.completeScan({
    companyId: ids.company, attemptId: ids.attempt,
    claimGeneration: claim.claimGeneration,
    claimToken: Buffer.alloc(32, 9).toString("base64url"),
    callbackBodyHash: callbackHash, verdict: "CLEAN", actualSizeBytes: 128,
    sha256: sha, detectedMimeType: "image/jpeg", engineName: "Foundation Scanner",
    engineVersion: "1", signatureDatabaseVersion: "1", failureCode: null,
    retryDelaySeconds: 30,
  }), "STALE_FENCE", "stale scan token denial");
  await admin.unsafe("alter table public.file_scan_attempts disable trigger file_scan_attempts_transition");
  await admin`update file_scan_attempts set lease_expires_at = statement_timestamp() - interval '1 second' where id = ${ids.attempt}`;
  await admin.unsafe("alter table public.file_scan_attempts enable trigger file_scan_attempts_transition");
  const validScanCompletion = {
    companyId: ids.company, attemptId: ids.attempt,
    claimGeneration: claim.claimGeneration, claimToken: claim.claimToken,
    callbackBodyHash: callbackHash, verdict: "CLEAN", actualSizeBytes: 128,
    sha256: sha, detectedMimeType: "image/jpeg", engineName: "Foundation Scanner",
    engineVersion: "1", signatureDatabaseVersion: "1", failureCode: null,
    retryDelaySeconds: 30,
  };
  expectStatus(await scanner.completeScan(validScanCompletion), "LEASE_EXPIRED", "expired scan lease denial");
  await admin.unsafe("alter table public.file_scan_attempts disable trigger file_scan_attempts_transition");
  await admin`update file_scan_attempts set lease_expires_at = statement_timestamp() + interval '1 minute' where id = ${ids.attempt}`;
  await admin.unsafe("alter table public.file_scan_attempts enable trigger file_scan_attempts_transition");
  expectStatus(await scanner.completeScan(validScanCompletion), "CREATED", "complete clean scan");
  expectStatus(await scanner.completeScan(validScanCompletion), "REPLAYED", "scan exact receipt replay");
  expectStatus(await scanner.completeScan({ ...validScanCompletion, callbackBodyHash: conflictingCallbackHash }), "COMPLETION_CONFLICT", "scan evidence replay denial");

  const reservation = await finalizer.reserveCleanPromotion({
    companyId: ids.company, uploadId: ids.upload, reservationId: ids.reservation,
    fileVersionId: ids.version, cleanObjectKey: cleanKey, leaseSeconds: 60,
  });
  expectStatus(reservation, "CREATED", "reserve clean promotion");
  if (reservation.status !== "CREATED") throw new Error("reservation result was incomplete");
  const reserveReplay = await finalizerSql.begin(async (sql) => {
    await sql`select set_config('app.reconciler_company_id', ${ids.company}, true)`;
    return sql`select result_status from hotel_file_reserve_clean_promotion(${ids.upload}::uuid, ${ids.reservation}::uuid, ${ids.version}::uuid, ${cleanKey}::text, ${reservation.promotionToken}::text, 60)`;
  });
  if (reserveReplay[0]?.result_status !== "REPLAYED") throw new Error("promotion reservation exact replay failed");

  const validPromotion = {
    companyId: ids.company, reservationId: ids.reservation,
    promotionGeneration: reservation.promotionGeneration,
    promotionToken: reservation.promotionToken, fileVersionId: ids.version,
    destinationEtag: "foundation-clean-etag", destinationObjectVersion: "foundation-clean-v1",
    destinationSha256: sha, destinationSizeBytes: 128, destinationMimeType: "image/jpeg",
  };
  expectStatus(await finalizer.completeCleanPromotion({ ...validPromotion, promotionGeneration: validPromotion.promotionGeneration + 1 }), "VERSION_CONFLICT", "stale promotion fence denial");
  expectStatus(await finalizer.completeCleanPromotion({ ...validPromotion, destinationSha256: Buffer.alloc(32, 7) }), "VERSION_CONFLICT", "promotion evidence denial");
  await admin.unsafe("alter table public.hotel_file_clean_promotion_reservations disable trigger hotel_file_clean_promotion_reservations_transition");
  await admin`update hotel_file_clean_promotion_reservations set lease_expires_at = statement_timestamp() - interval '1 second' where id = ${ids.reservation}`;
  await admin.unsafe("alter table public.hotel_file_clean_promotion_reservations enable trigger hotel_file_clean_promotion_reservations_transition");
  expectStatus(await finalizer.completeCleanPromotion(validPromotion), "VERSION_CONFLICT", "expired promotion lease denial");
  await admin.unsafe("alter table public.hotel_file_clean_promotion_reservations disable trigger hotel_file_clean_promotion_reservations_transition");
  await admin`update hotel_file_clean_promotion_reservations set lease_expires_at = statement_timestamp() + interval '1 minute' where id = ${ids.reservation}`;
  await admin.unsafe("alter table public.hotel_file_clean_promotion_reservations enable trigger hotel_file_clean_promotion_reservations_transition");
  expectStatus(await finalizer.completeCleanPromotion(validPromotion), "READY_UNLINKED", "complete promotion");
  expectStatus(await finalizer.completeCleanPromotion(validPromotion), "REPLAYED", "promotion exact replay");

  const linkInput = {
    actor: { sessionId: ids.session }, fileVersionId: ids.version, linkId: ids.link,
    idempotencyRecordId: "fd000000-0000-4000-8000-000000000002",
    idempotencyKey: "foundation-file-link", requestHash: "foundation-file-link-hash",
    traceId: "fe000000-0000-4000-8000-000000000003",
  };
  expectStatus(await api.linkCleanVersion(linkInput), "LINKED", "link clean version");
  expectStatus(await api.linkCleanVersion(linkInput), "REPLAYED", "link exact replay");
  const status = await api.getStatus({ sessionId: ids.session }, ids.upload);
  if (status.status !== "CREATED" || status.upload.state !== "LINKED" || status.upload.fileVersionId !== ids.version) {
    throw new Error("linked file safe read-back failed");
  }

  const [readBack] = await admin`
    select
      (select count(*)::integer from schema_migrations where version = '0026_hotel_file_repository_commands') marker_count,
      (select count(*)::integer from hotel_file_scan_completion_receipts where attempt_id = ${ids.attempt}) receipt_count,
      (select count(*)::integer from audit_events where company_id = ${ids.company} and event_code in (
        'HOTEL_FILE_UPLOAD_INITIATED', 'HOTEL_FILE_UPLOAD_COMPLETED', 'HOTEL_FILE_SCAN_CLAIMED',
        'HOTEL_FILE_SCAN_COMPLETED', 'HOTEL_FILE_PROMOTION_RESERVED',
        'HOTEL_FILE_PROMOTION_COMPLETED', 'HOTEL_FILE_LINKED'
      )) audit_count,
      (select count(*)::integer from idempotency_records where company_id = ${ids.company} and id in (
        'fd000000-0000-4000-8000-000000000001', 'fd000000-0000-4000-8000-000000000002'
      )) idempotency_count,
      (select count(*)::integer from (values
        ('gw_runtime_api_probe'), ('gw_runtime_reconciler_probe'), ('gw_runtime_file_finalizer_probe')
      ) protected(role_name) cross join (values
        ('file_attachment_parents'), ('hotel_file_uploads'), ('hotel_file_scan_jobs'),
        ('file_scan_attempts'), ('hotel_file_versions'), ('hotel_file_links'),
        ('hotel_file_scan_completion_receipts'), ('hotel_file_clean_promotion_reservations')
      ) file_table(table_name) where has_table_privilege(protected.role_name, 'public.' || file_table.table_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')) acl_damage_count,
      (select count(*)::integer from pg_roles role where role.rolname in (
        'gw_runtime_api_probe', 'gw_runtime_reconciler_probe', 'gw_runtime_file_finalizer_probe'
      ) and (role.rolsuper or role.rolinherit or role.rolcreatedb or role.rolcreaterole or role.rolreplication or role.rolbypassrls
        or exists (select 1 from pg_auth_members membership where membership.member = role.oid))) role_damage_count
  `;
  if (!readBack || readBack.marker_count !== 1 || readBack.receipt_count !== 1 ||
      readBack.audit_count !== 7 || readBack.idempotency_count !== 2 ||
      readBack.acl_damage_count !== 0 || readBack.role_damage_count !== 0) {
    throw new Error(`hotel file repository read-back mismatch: ${JSON.stringify(readBack)}`);
  }
} finally {
  await Promise.allSettled([
    api.close(), scanner.close(), finalizer.close(), finalizerSql.end(), admin.end(),
  ]);
}
console.log("HOTEL_FILE_REPOSITORY_JOURNEY_OK");
NODE
  )
}

MIGRATION="$ROOT_DIR/packages/db/migrations/0001_platform_foundation.sql"
AUTH_MIGRATION="$ROOT_DIR/packages/db/migrations/0002_auth_session_runtime.sql"
HOTEL_MIGRATION="$ROOT_DIR/packages/db/migrations/0003_hotel_basic_information.sql"
CUSTOM_LOGIN_MIGRATION="$ROOT_DIR/packages/db/migrations/0004_custom_login_security.sql"
SESSION_DEFINER_MIGRATION="$ROOT_DIR/packages/db/migrations/0005_auth_session_definer.sql"
ACCOUNT_MIGRATION="$ROOT_DIR/packages/db/migrations/0006_account_administration.sql"
TENANT_AUTHORITY_MIGRATION="$ROOT_DIR/packages/db/migrations/0007_api_tenant_authority_expand.sql"
GLOBAL_LOGIN_EXPAND_MIGRATION="$ROOT_DIR/packages/db/migrations/0009_global_login_id_expand.sql"
ACCOUNT_PROVIDER_EXACT_DISPATCH_MIGRATION="$ROOT_DIR/packages/db/migrations/0011_account_provider_exact_dispatch.sql"
NEON_DEFINER_CREATOR_MEMBERSHIP_MIGRATION="$ROOT_DIR/packages/db/migrations/0013_neon_definer_creator_membership.sql"
NEON_DEFINER_EXPAND_COMPATIBILITY_MIGRATION="$ROOT_DIR/packages/db/migrations/0014_neon_definer_expand_compatibility.sql"
HOTEL_RELATIONSHIP_MIGRATION="$ROOT_DIR/packages/db/migrations/0016_hotel_relationship_management.sql"
HOTEL_RELATIONSHIP_INTEGRITY_MIGRATION="$ROOT_DIR/packages/db/migrations/0017_hotel_relationship_integrity_hardening.sql"
HOTEL_SUPPORT_OVERLAP_MIGRATION="$ROOT_DIR/packages/db/migrations/0018_hotel_support_assignment_overlap.sql"
HOTEL_ROOM_MIGRATION="$ROOT_DIR/packages/db/migrations/0019_hotel_room_management.sql"
HOTEL_ROOM_CONTRACT_MIGRATION="$ROOT_DIR/packages/db/migrations/0022_hotel_room_contract_hardening.sql"
HOTEL_FILE_MIGRATION="$ROOT_DIR/packages/db/migrations/0025_hotel_file_quarantine_foundation.sql"
HOTEL_FILE_REPOSITORY_MIGRATION="$ROOT_DIR/packages/db/migrations/0026_hotel_file_repository_commands.sql"
ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION="$ROOT_DIR/packages/db/migrations/0012_account_provider_exact_dispatch_contract.sql"
NEON_DEFINER_CONTRACT_HARDENING_MIGRATION="$ROOT_DIR/packages/db/migrations/0015_neon_definer_contract_hardening.sql"
FALLBACK_REMOVAL_MIGRATION="$ROOT_DIR/packages/db/migrations/0008_remove_legacy_company_id_fallback.sql"
GLOBAL_LOGIN_CONTRACT_MIGRATION="$ROOT_DIR/packages/db/migrations/0010_global_login_id_contract.sql"
TEST_SQL="$ROOT_DIR/packages/db/test/foundation-integration.sql"

if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  if [[ "${ALLOW_DESTRUCTIVE_TEST_DATABASE:-}" != "1" ]]; then
    printf 'Refusing destructive integration test: explicit test-database opt-in is missing.\n' >&2
    exit 1
  fi
  DATABASE_NAME="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -c "select current_database()")"
  if [[ ! "$DATABASE_NAME" =~ (_test|_ci)($|_) ]]; then
    printf 'Refusing destructive integration test: database name is not test/CI scoped.\n' >&2
    exit 1
  fi
  cleanup_external_database() {
    local original_status="$?"
    local reset_status=0
    trap - EXIT
    set +e
    psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
      -c "drop schema if exists public cascade; create schema public" >/dev/null 2>&1
    reset_status="$?"
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$AUTH_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$CUSTOM_LOGIN_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$SESSION_DEFINER_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$TENANT_AUTHORITY_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$GLOBAL_LOGIN_EXPAND_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_CREATOR_MEMBERSHIP_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_EXPAND_COMPATIBILITY_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_RELATIONSHIP_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_RELATIONSHIP_INTEGRITY_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_SUPPORT_OVERLAP_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_ROOM_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$FALLBACK_REMOVAL_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_CONTRACT_HARDENING_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_ROOM_CONTRACT_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_FILE_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_FILE_REPOSITORY_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$reset_status" -eq 0 ]]; then
      psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$GLOBAL_LOGIN_CONTRACT_MIGRATION" >/dev/null 2>&1
      reset_status="$?"
    fi
    if [[ "$original_status" -ne 0 ]]; then
      exit "$original_status"
    fi
    exit "$reset_status"
  }
  trap cleanup_external_database EXIT
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$AUTH_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$CUSTOM_LOGIN_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$SESSION_DEFINER_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$TENANT_AUTHORITY_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$GLOBAL_LOGIN_EXPAND_MIGRATION" >/dev/null
  seed_legacy_compensation "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_CREATOR_MEMBERSHIP_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_EXPAND_COMPATIBILITY_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_RELATIONSHIP_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_RELATIONSHIP_INTEGRITY_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_SUPPORT_OVERLAP_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_ROOM_MIGRATION" >/dev/null
  assert_expand_isolated "$TEST_DATABASE_URL"
  seed_legacy_compensation "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$FALLBACK_REMOVAL_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_CONTRACT_HARDENING_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_ROOM_CONTRACT_MIGRATION" >/dev/null
  assert_exact_contract_isolated "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$GLOBAL_LOGIN_CONTRACT_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_FILE_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$HOTEL_FILE_REPOSITORY_MIGRATION" >/dev/null
  assert_legacy_auth_removed "$TEST_DATABASE_URL"
  mapfile -t PROBE_URLS < <(configure_runtime_probe_roles "$TEST_DATABASE_URL")
  PROBE_URL="${PROBE_URLS[0]}"
  RECONCILER_PROBE_URL="${PROBE_URLS[1]}"
  FINALIZER_PROBE_URL="${PROBE_URLS[2]}"
  RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$TEST_SQL")"
  if [[ "$RESULT" != *"PLATFORM_FOUNDATION_INTEGRATION_OK"* ]]; then
    printf '%s\n' "$RESULT" >&2
    exit 1
  fi
  assert_all_runtime_readiness READY "$PROBE_URL" "$RECONCILER_PROBE_URL" "$FINALIZER_PROBE_URL"
  register_owner_api_capability "$TEST_DATABASE_URL"
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/auth-repository-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" TEST_PROBE_URL="$RECONCILER_PROBE_URL" \
      pnpm exec tsx packages/db/test/account-repository-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/hotel-repository-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/hotel-room-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx apps/api/test/hotel-room-api-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx apps/api/test/hotel-api-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/hotel-rls-integration.ts
    unregister_owner_api_capability "$TEST_DATABASE_URL"
    TEST_READY_URL="$TEST_DATABASE_URL" TEST_PROBE_URL="$RECONCILER_PROBE_URL" \
      pnpm exec tsx packages/db/test/hotel-readiness-damage-integration.ts
  )
  assert_room_constraints_exact "$TEST_DATABASE_URL" "$RECONCILER_PROBE_URL"
  assert_room_fingerprint_damage "$TEST_DATABASE_URL" "$RECONCILER_PROBE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "alter table schema_migrations rename column version to malformed_version" >/dev/null
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$RECONCILER_PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const malformed = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (malformed.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after marker damage, received ${malformed.status}`);
}
NODE
  )
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "alter table schema_migrations rename column malformed_version to version" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "alter table audit_events disable trigger audit_events_no_update" >/dev/null
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$RECONCILER_PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const disabledTrigger = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (disabledTrigger.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after trigger disable, received ${disabledTrigger.status}`);
}
NODE
  )
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "alter table audit_events enable trigger audit_events_no_update" >/dev/null
  run_hotel_file_repository_journey "$TEST_DATABASE_URL" "$PROBE_URL" "$RECONCILER_PROBE_URL" "$FINALIZER_PROBE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -c "drop table roles cascade" >/dev/null
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$RECONCILER_PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after required table drop, received ${damaged.status}`);
}
NODE
  )
  printf 'PLATFORM_FOUNDATION_INTEGRATION_OK\n'
  exit 0
fi

TMP_DIR="$(mktemp -d /tmp/werehere-hotel-pg.XXXXXX)"
DATA_DIR="$TMP_DIR/data"
SOCKET_DIR="$TMP_DIR/socket"
LOG_FILE="$TMP_DIR/postgres.log"
PORT="$((55000 + ($$ % 5000)))"

mkdir -p "$SOCKET_DIR"

cleanup() {
  if [[ -d "$DATA_DIR" ]]; then
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m immediate -w stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$DATA_DIR" -A trust -U postgres --no-locale >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$LOG_FILE" \
  -o "-F -k '$SOCKET_DIR' -p $PORT -c listen_addresses='127.0.0.1'" -w start >/dev/null

createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres werehere_hotel_test
createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres werehere_hotel_blank
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$AUTH_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$HOTEL_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$CUSTOM_LOGIN_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$SESSION_DEFINER_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$ACCOUNT_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$TENANT_AUTHORITY_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$GLOBAL_LOGIN_EXPAND_MIGRATION" >/dev/null
seed_legacy_compensation "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$NEON_DEFINER_CREATOR_MEMBERSHIP_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$NEON_DEFINER_EXPAND_COMPATIBILITY_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_RELATIONSHIP_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_RELATIONSHIP_INTEGRITY_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_SUPPORT_OVERLAP_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_ROOM_MIGRATION" >/dev/null
assert_expand_isolated "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
seed_legacy_compensation "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$FALLBACK_REMOVAL_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$NEON_DEFINER_CONTRACT_HARDENING_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_ROOM_CONTRACT_MIGRATION" >/dev/null
assert_exact_contract_isolated "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$GLOBAL_LOGIN_CONTRACT_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_FILE_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$HOTEL_FILE_REPOSITORY_MIGRATION" >/dev/null
ADMIN_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
assert_legacy_auth_removed "$ADMIN_URL"
mapfile -t PROBE_URLS < <(configure_runtime_probe_roles "$ADMIN_URL")
PROBE_URL="${PROBE_URLS[0]}"
RECONCILER_PROBE_URL="${PROBE_URLS[1]}"
FINALIZER_PROBE_URL="${PROBE_URLS[2]}"
RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$TEST_SQL")"

if [[ "$RESULT" != *"PLATFORM_FOUNDATION_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$RESULT" >&2
  exit 1
fi

assert_all_runtime_readiness READY "$PROBE_URL" "$RECONCILER_PROBE_URL" "$FINALIZER_PROBE_URL"
register_owner_api_capability "$ADMIN_URL"
(
  cd "$ROOT_DIR"
  TEST_ADMIN_URL="$ADMIN_URL" \
  TEST_BLANK_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_blank" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const unsafeOwner = await probeDatabaseReadiness(process.env.TEST_ADMIN_URL);
const blank = await probeDatabaseReadiness(process.env.TEST_BLANK_URL);
const missing = await probeDatabaseReadiness(undefined);

if (unsafeOwner.status !== "SCHEMA_NOT_READY") throw new Error(`expected privileged owner rejection, received ${unsafeOwner.status}`);
if (blank.status !== "SCHEMA_NOT_READY") throw new Error(`expected SCHEMA_NOT_READY, received ${blank.status}`);
if (missing.status !== "NOT_CONFIGURED") throw new Error(`expected NOT_CONFIGURED, received ${missing.status}`);
NODE
)

(
  cd "$ROOT_DIR"
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/auth-repository-integration.ts
  TEST_READY_URL="$ADMIN_URL" TEST_PROBE_URL="$RECONCILER_PROBE_URL" \
    pnpm exec tsx packages/db/test/account-repository-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/hotel-repository-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/hotel-room-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx apps/api/test/hotel-room-api-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx apps/api/test/hotel-api-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/hotel-rls-integration.ts
  unregister_owner_api_capability "$ADMIN_URL"
  TEST_READY_URL="$ADMIN_URL" TEST_PROBE_URL="$RECONCILER_PROBE_URL" \
    pnpm exec tsx packages/db/test/hotel-readiness-damage-integration.ts
)
assert_room_constraints_exact "$ADMIN_URL" "$RECONCILER_PROBE_URL"
assert_room_fingerprint_damage "$ADMIN_URL" "$RECONCILER_PROBE_URL"

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table schema_migrations rename column version to malformed_version" >/dev/null
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$RECONCILER_PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const malformed = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (malformed.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after marker damage, received ${malformed.status}`);
}
NODE
)
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table schema_migrations rename column malformed_version to version" >/dev/null

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table outbox_jobs drop constraint outbox_jobs_compensation_linkage_check" >/dev/null
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$RECONCILER_PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after exact dispatch constraint drop, received ${damaged.status}`);
}
NODE
)
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test >/dev/null <<'SQL'
alter table outbox_jobs
  add constraint outbox_jobs_compensation_linkage_check check (
    job_type <> 'ACCOUNT_PROVIDER_COMPENSATE'
    or status = 'PENDING'
    or status in ('SUCCEEDED', 'CANCELLED', 'DEAD_LETTER')
    or coalesce((
      pg_catalog.jsonb_typeof(payload->'provisioningAttemptId') = 'string'
      and payload->>'provisioningAttemptId' ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and pg_catalog.jsonb_typeof(payload->'originalErrorCode') = 'string'
      and payload->>'originalErrorCode' in (
        'ACCOUNT_DUPLICATE', 'FORBIDDEN', 'INTERNAL_ERROR'
      )
    ), false)
  );
SQL
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$RECONCILER_PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const weakened = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (weakened.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY for weakened exact dispatch constraint, received ${weakened.status}`);
}
NODE
)
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table outbox_jobs drop constraint outbox_jobs_compensation_linkage_check" >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test >/dev/null <<'SQL'
alter table outbox_jobs
  add constraint outbox_jobs_compensation_linkage_check check (
    job_type <> 'ACCOUNT_PROVIDER_COMPENSATE'
    or status in ('SUCCEEDED', 'CANCELLED', 'DEAD_LETTER')
    or coalesce((
      pg_catalog.jsonb_typeof(payload->'provisioningAttemptId') = 'string'
      and payload->>'provisioningAttemptId' ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and pg_catalog.jsonb_typeof(payload->'originalErrorCode') = 'string'
      and payload->>'originalErrorCode' in (
        'ACCOUNT_DUPLICATE', 'FORBIDDEN', 'INTERNAL_ERROR'
      )
    ), false)
  );
SQL

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test >/dev/null <<'SQL'
begin;
insert into companies(id, legal_name) values
  ('a1000000-0000-4000-8000-000000000001', 'File Journey Company 1'),
  ('a1000000-0000-4000-8000-000000000002', 'File Journey Company 2');
insert into users(id, company_id, user_type, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'INTERNAL_STAFF', 'File Journey User 1'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'INTERNAL_STAFF', 'File Journey User 2');
insert into branches(id, company_id, branch_type, branch_code, name) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'HOTEL', 'FILE-J1', 'File Journey Hotel 1'),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'HOTEL', 'FILE-J2', 'File Journey Hotel 2');
insert into hotel_profiles(company_id, branch_id, hotel_status, road_address, detail_address, representative_phone, contract_start_date, contract_end_date) values
  ('a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'PREPARING', 'File Road 1', '', '02-1000-0001', '2026-01-01', '2026-12-31'),
  ('a1000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000002', 'PREPARING', 'File Road 2', '', '02-1000-0002', '2026-01-01', '2026-12-31');
insert into file_attachment_parents(company_id, branch_id, parent_type, parent_id, created_by) values
  ('a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'INSPECTION_RESULT', 'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'KNOWLEDGE_ARTICLE', 'a4000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001');

do $file_journey$
declare
  i integer;
  current_upload uuid;
  clean_hash bytea := decode(repeat('ab', 32), 'hex');
begin
  begin
    insert into hotel_file_uploads(id, company_id, branch_id, parent_type, parent_id, initiated_by, declared_file_name, declared_mime_type, declared_size_bytes, reserved_size_bytes, quarantine_object_key, expires_at)
    values (gen_random_uuid(), 'a1000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000002', 'INSPECTION_RESULT', 'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'cross.jpg', 'image/jpeg', 1, 1, 'quarantine/' || repeat('f', 64), statement_timestamp() + interval '5 minutes');
    raise exception 'cross-tenant upload unexpectedly succeeded';
  exception when foreign_key_violation then null;
  end;

  for i in 1..20 loop
    current_upload := case when i = 1 then 'a5000000-0000-4000-8000-000000000001'::uuid else gen_random_uuid() end;
    insert into hotel_file_uploads(id, company_id, branch_id, parent_type, parent_id, initiated_by, declared_file_name, declared_mime_type, declared_size_bytes, reserved_size_bytes, quarantine_object_key, expires_at)
    values (current_upload, 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'INSPECTION_RESULT', 'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'inspection-' || i || '.jpg', 'image/jpeg', 10000000, 10000000, 'quarantine/' || encode(sha256(convert_to('inspection-' || i, 'UTF8')), 'hex'), statement_timestamp() + interval '5 minutes');
  end loop;
  begin
    insert into hotel_file_uploads(id, company_id, branch_id, parent_type, parent_id, initiated_by, declared_file_name, declared_mime_type, declared_size_bytes, reserved_size_bytes, quarantine_object_key, expires_at)
    values (gen_random_uuid(), 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'INSPECTION_RESULT', 'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'count-overflow.jpg', 'image/jpeg', 1, 1, 'quarantine/' || repeat('e', 64), statement_timestamp() + interval '5 minutes');
    raise exception 'count quota unexpectedly succeeded';
  exception when check_violation then null;
  end;

  for i in 1..4 loop
    insert into hotel_file_uploads(id, company_id, branch_id, parent_type, parent_id, initiated_by, declared_file_name, declared_mime_type, declared_size_bytes, reserved_size_bytes, quarantine_object_key, expires_at)
    values (gen_random_uuid(), 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'KNOWLEDGE_ARTICLE', 'a4000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'document-' || i || '.pdf', 'application/pdf', 50000000, 50000000, 'quarantine/' || encode(sha256(convert_to('document-' || i, 'UTF8')), 'hex'), statement_timestamp() + interval '5 minutes');
  end loop;
  begin
    insert into hotel_file_uploads(id, company_id, branch_id, parent_type, parent_id, initiated_by, declared_file_name, declared_mime_type, declared_size_bytes, reserved_size_bytes, quarantine_object_key, expires_at)
    values (gen_random_uuid(), 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'KNOWLEDGE_ARTICLE', 'a4000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'byte-overflow.pdf', 'application/pdf', 1, 1, 'quarantine/' || repeat('d', 64), statement_timestamp() + interval '5 minutes');
    raise exception 'byte quota unexpectedly succeeded';
  exception when check_violation then null;
  end;

  update hotel_file_uploads set state = 'QUARANTINED', source_etag = 'etag-1', source_object_version = 'source-version-1', source_size_bytes = 10000000, source_mime_type = 'image/jpeg', upload_completed_at = statement_timestamp(), version = version + 1, updated_at = clock_timestamp() + interval '1 second' where id = 'a5000000-0000-4000-8000-000000000001';
  insert into hotel_file_scan_jobs(id, company_id, branch_id, upload_id) values ('a6000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001');
  begin
    update hotel_file_uploads set state = 'SCANNING', version = version + 1, updated_at = clock_timestamp() + interval '2 seconds' where id = 'a5000000-0000-4000-8000-000000000001';
    raise exception 'scan without dispatch unexpectedly succeeded';
  exception when check_violation then null;
  end;
  update hotel_file_scan_jobs set state = 'DISPATCHED', dispatch_generation = 1, dispatched_at = statement_timestamp(), updated_at = clock_timestamp() + interval '1 second' where id = 'a6000000-0000-4000-8000-000000000001';
  update hotel_file_uploads set state = 'SCANNING', version = version + 1, updated_at = clock_timestamp() + interval '2 seconds' where id = 'a5000000-0000-4000-8000-000000000001';
  insert into file_scan_attempts(id, company_id, branch_id, parent_type, parent_id, upload_id, dispatch_job_id, source_etag, source_object_version, source_size_bytes) values ('a7000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'INSPECTION_RESULT', 'a4000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'etag-1', 'source-version-1', 10000000);
  update file_scan_attempts set state = 'CLAIMED', claim_token_hash = decode(repeat('11', 32), 'hex'), claim_generation = 1, lease_expires_at = statement_timestamp() + interval '5 minutes', attempt_count = 1, claimed_at = statement_timestamp(), updated_at = clock_timestamp() + interval '1 second' where id = 'a7000000-0000-4000-8000-000000000001';
  begin
    update file_scan_attempts set state = 'SUCCEEDED', claim_generation = 2, lease_expires_at = null, scanner_sha256 = clean_hash, detected_mime_type = 'image/jpeg', verdict = 'CLEAN', engine_name = 'ClamAV', engine_version = '1', signature_database_version = '1', callback_body_hash = decode(repeat('22', 32), 'hex'), completed_at = statement_timestamp(), updated_at = clock_timestamp() + interval '2 seconds' where id = 'a7000000-0000-4000-8000-000000000001';
    raise exception 'stale completion unexpectedly succeeded';
  exception when check_violation then null;
  end;
  update file_scan_attempts set state = 'SUCCEEDED', lease_expires_at = null, actual_size_bytes = 10000000, scanner_sha256 = clean_hash, detected_mime_type = 'image/jpeg', verdict = 'CLEAN', engine_name = 'ClamAV', engine_version = '1', signature_database_version = '1', callback_body_hash = decode(repeat('22', 32), 'hex'), completed_at = statement_timestamp(), updated_at = clock_timestamp() + interval '2 seconds' where id = 'a7000000-0000-4000-8000-000000000001';
  update hotel_file_uploads set state = 'CLEAN_PENDING_PROMOTION', version = version + 1, updated_at = clock_timestamp() + interval '3 seconds' where id = 'a5000000-0000-4000-8000-000000000001';
  insert into hotel_file_clean_promotion_reservations(id, company_id, branch_id, upload_id, attempt_id, file_version_id, promotion_generation, promotion_token_hash, lease_expires_at, source_etag, source_object_version, scanner_sha256, actual_size_bytes, detected_mime_type, clean_object_key) values ('aa000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', 1, decode(repeat('33', 32), 'hex'), statement_timestamp() + interval '5 minutes', 'etag-1', 'source-version-1', clean_hash, 10000000, 'image/jpeg', 'clean/' || repeat('c', 64));
  insert into hotel_file_versions(id, company_id, branch_id, parent_type, parent_id, upload_id, clean_object_key, file_name, mime_type, size_bytes, sha256, source_etag, source_object_version, destination_etag, destination_object_version, promotion_generation) values ('a8000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'INSPECTION_RESULT', 'a4000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'clean/' || repeat('c', 64), 'inspection-1.jpg', 'image/jpeg', 10000000, clean_hash, 'etag-1', 'source-version-1', 'destination-etag-1', 'destination-version-1', 1);
  update hotel_file_uploads set state = 'READY_UNLINKED', version = version + 1, updated_at = clock_timestamp() + interval '4 seconds' where id = 'a5000000-0000-4000-8000-000000000001';
  begin
    update hotel_file_uploads set state = 'LINKED', quota_released_at = statement_timestamp(), version = version + 1, updated_at = clock_timestamp() + interval '5 seconds' where id = 'a5000000-0000-4000-8000-000000000001';
    raise exception 'linkless quota release unexpectedly succeeded';
  exception when check_violation then null;
  end;
  insert into hotel_file_links(id, company_id, branch_id, parent_type, parent_id, file_version_id, linked_by) values ('a9000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'INSPECTION_RESULT', 'a4000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001');
  update hotel_file_uploads set state = 'LINKED', quota_released_at = statement_timestamp(), version = version + 1, updated_at = clock_timestamp() + interval '5 seconds' where id = 'a5000000-0000-4000-8000-000000000001';
end
$file_journey$;
rollback;
SQL
printf 'HOTEL_FILE_POSTGRES_JOURNEY_OK\n'

run_hotel_file_repository_journey "$ADMIN_URL" "$PROBE_URL" "$RECONCILER_PROBE_URL" "$FINALIZER_PROBE_URL"

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table audit_events disable trigger audit_events_no_update" >/dev/null
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$RECONCILER_PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const disabledTrigger = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (disabledTrigger.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after trigger disable, received ${disabledTrigger.status}`);
}
NODE
)
psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table audit_events enable trigger audit_events_no_update" >/dev/null

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "drop table roles cascade" >/dev/null
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$RECONCILER_PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after required table drop, received ${damaged.status}`);
}
NODE
)

printf 'PLATFORM_FOUNDATION_INTEGRATION_OK\n'
