#!/usr/bin/env bash
set -euo pipefail

PG_BIN="${PG_BIN:-/usr/lib/postgresql/18/bin}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

configure_runtime_probe_role() {
  local admin_url="$1"
  local probe_password
  probe_password="$(openssl rand -hex 24)"
  psql -X -v ON_ERROR_STOP=1 -v probe_password="$probe_password" -d "$admin_url" >/dev/null <<'SQL'
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gw_runtime_probe') THEN
    CREATE ROLE gw_runtime_probe LOGIN;
  END IF;
END
$role$;
ALTER ROLE gw_runtime_probe NOSUPERUSER NOBYPASSRLS NOINHERIT PASSWORD :'probe_password';
GRANT USAGE ON SCHEMA public TO gw_runtime_probe;
GRANT EXECUTE ON FUNCTION reconciliation_company_ids(), runtime_is_schema_owner(),
  runtime_has_capability(text), api_current_company_id(), reconciler_current_company_id(),
  jsonb_reject_plaintext_password_keys(jsonb)
  TO gw_runtime_probe;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM gw_runtime_probe;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM gw_runtime_probe;
GRANT SELECT ON account_provisioning_attempts, auth_identities, branches, companies,
  hotel_owner_assignments, hotel_profiles, hotel_staff_assignments,
  housekeeping_hotel_links, outbox_jobs, permissions,
  runtime_database_capabilities, schema_migrations, users
  TO gw_runtime_probe;
GRANT INSERT ON audit_events, auth_identities, hotel_owner_assignments,
  hotel_staff_assignments, housekeeping_hotel_links, outbox_jobs, users
  TO gw_runtime_probe;
GRANT UPDATE ON account_provisioning_attempts, outbox_jobs TO gw_runtime_probe;
INSERT INTO runtime_database_capabilities (role_name, capability)
VALUES ('gw_runtime_probe', 'RECONCILER')
ON CONFLICT (role_name) DO UPDATE SET capability = excluded.capability;
SQL
  node -e "const u=new URL(process.argv[1]);u.username='gw_runtime_probe';u.password=process.argv[2];console.log(u.toString())" "$admin_url" "$probe_password"
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
  assert_expand_isolated "$TEST_DATABASE_URL"
  seed_legacy_compensation "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$FALLBACK_REMOVAL_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$NEON_DEFINER_CONTRACT_HARDENING_MIGRATION" >/dev/null
  assert_exact_contract_isolated "$TEST_DATABASE_URL"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -f "$GLOBAL_LOGIN_CONTRACT_MIGRATION" >/dev/null
  assert_legacy_auth_removed "$TEST_DATABASE_URL"
  PROBE_URL="$(configure_runtime_probe_role "$TEST_DATABASE_URL")"
  register_owner_api_capability "$TEST_DATABASE_URL"
  RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -f "$TEST_SQL")"
  if [[ "$RESULT" != *"PLATFORM_FOUNDATION_INTEGRATION_OK"* ]]; then
    printf '%s\n' "$RESULT" >&2
    exit 1
  fi
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const ready = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (ready.status !== "READY") throw new Error(`expected READY, received ${ready.status}`);
NODE
  )
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/auth-repository-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" TEST_PROBE_URL="$PROBE_URL" \
      pnpm exec tsx packages/db/test/account-repository-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/hotel-repository-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx apps/api/test/hotel-api-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" \
      pnpm exec tsx packages/db/test/hotel-rls-integration.ts
    TEST_READY_URL="$TEST_DATABASE_URL" TEST_PROBE_URL="$PROBE_URL" \
      pnpm exec tsx packages/db/test/hotel-readiness-damage-integration.ts
  )
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "alter table schema_migrations rename column version to malformed_version" >/dev/null
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$PROBE_URL" pnpm exec tsx <<'NODE'
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
    TEST_READY_URL="$PROBE_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const disabledTrigger = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (disabledTrigger.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after trigger disable, received ${disabledTrigger.status}`);
}
NODE
  )
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
    -c "alter table audit_events enable trigger audit_events_no_update" >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -c "drop table roles cascade" >/dev/null
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$PROBE_URL" pnpm exec tsx <<'NODE'
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
assert_expand_isolated "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
seed_legacy_compensation "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$FALLBACK_REMOVAL_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$ACCOUNT_PROVIDER_EXACT_DISPATCH_CONTRACT_MIGRATION" >/dev/null
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$NEON_DEFINER_CONTRACT_HARDENING_MIGRATION" >/dev/null
assert_exact_contract_isolated "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
psql -X -v ON_ERROR_STOP=1 "postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
  -f "$GLOBAL_LOGIN_CONTRACT_MIGRATION" >/dev/null
ADMIN_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test"
assert_legacy_auth_removed "$ADMIN_URL"
PROBE_URL="$(configure_runtime_probe_role "$ADMIN_URL")"
register_owner_api_capability "$ADMIN_URL"
RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -f "$TEST_SQL")"

if [[ "$RESULT" != *"PLATFORM_FOUNDATION_INTEGRATION_OK"* ]]; then
  printf '%s\n' "$RESULT" >&2
  exit 1
fi

(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PROBE_URL" \
  TEST_ADMIN_URL="$ADMIN_URL" \
  TEST_BLANK_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_blank" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const ready = await probeDatabaseReadiness(process.env.TEST_READY_URL);
const unsafeOwner = await probeDatabaseReadiness(process.env.TEST_ADMIN_URL);
const blank = await probeDatabaseReadiness(process.env.TEST_BLANK_URL);
const missing = await probeDatabaseReadiness(undefined);

if (ready.status !== "READY") throw new Error(`expected READY, received ${ready.status}`);
if (unsafeOwner.status !== "SCHEMA_NOT_READY") throw new Error(`expected privileged owner rejection, received ${unsafeOwner.status}`);
if (blank.status !== "SCHEMA_NOT_READY") throw new Error(`expected SCHEMA_NOT_READY, received ${blank.status}`);
if (missing.status !== "NOT_CONFIGURED") throw new Error(`expected NOT_CONFIGURED, received ${missing.status}`);
NODE
)

(
  cd "$ROOT_DIR"
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/auth-repository-integration.ts
  TEST_READY_URL="$ADMIN_URL" TEST_PROBE_URL="$PROBE_URL" \
    pnpm exec tsx packages/db/test/account-repository-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/hotel-repository-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx apps/api/test/hotel-api-integration.ts
  TEST_READY_URL="postgres://postgres@127.0.0.1:$PORT/werehere_hotel_test" \
    pnpm exec tsx packages/db/test/hotel-rls-integration.ts
  TEST_READY_URL="$ADMIN_URL" TEST_PROBE_URL="$PROBE_URL" \
    pnpm exec tsx packages/db/test/hotel-readiness-damage-integration.ts
)

psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
  -d werehere_hotel_test -c "alter table schema_migrations rename column version to malformed_version" >/dev/null
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PROBE_URL" \
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
  TEST_READY_URL="$PROBE_URL" \
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
  TEST_READY_URL="$PROBE_URL" \
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
  -d werehere_hotel_test -c "alter table audit_events disable trigger audit_events_no_update" >/dev/null
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PROBE_URL" \
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
  TEST_READY_URL="$PROBE_URL" \
  pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";

const damaged = await probeDatabaseReadiness(process.env.TEST_READY_URL);
if (damaged.status !== "SCHEMA_NOT_READY") {
  throw new Error(`expected SCHEMA_NOT_READY after required table drop, received ${damaged.status}`);
}
NODE
)

printf 'PLATFORM_FOUNDATION_INTEGRATION_OK\n'
