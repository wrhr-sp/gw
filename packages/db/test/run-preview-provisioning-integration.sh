#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/werehere-preview-provision.XXXXXX)"
DATA_DIR="$TMP_DIR/data"
SOCKET_DIR="$TMP_DIR/socket"
LOG_FILE="$TMP_DIR/postgres.log"
RUNTIME_URL_FILE="$TMP_DIR/runtime-url"
SUBJECT="preview-subject-integration"
COMPANY_ID="70000000-0000-4000-8000-000000000001"

cleanup() {
  if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
    psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" >/dev/null <<'SQL' || true
drop database if exists werehere_preview_ci with (force);
drop database if exists werehere_production_ci with (force);
SQL
  elif [[ -d "$DATA_DIR" ]]; then
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m immediate -w stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  PREVIEW_URL="$(node -e 'const u = new URL(process.env.TEST_DATABASE_URL); u.pathname = "/werehere_preview_ci"; console.log(u.toString())')"
  PRODUCTION_URL="$(node -e 'const u = new URL(process.env.TEST_DATABASE_URL); u.pathname = "/werehere_production_ci"; console.log(u.toString())')"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" >/dev/null <<'SQL'
drop database if exists werehere_preview_ci with (force);
drop database if exists werehere_production_ci with (force);
create database werehere_preview_ci;
create database werehere_production_ci;
SQL
else
  PG_BIN="${PG_BIN:-/usr/lib/postgresql/18/bin}"
  PORT="$((50000 + ($$ % 4000)))"
  PREVIEW_URL="postgresql://postgres@127.0.0.1:$PORT/werehere_preview_ci"
  PRODUCTION_URL="postgresql://postgres@127.0.0.1:$PORT/werehere_production_ci"
  mkdir -p "$SOCKET_DIR"
  "$PG_BIN/initdb" -D "$DATA_DIR" -A trust -U postgres --no-locale >/dev/null
  "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$LOG_FILE" \
    -o "-F -k '$SOCKET_DIR' -p $PORT -c listen_addresses='127.0.0.1'" -w start >/dev/null
  createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres werehere_preview_ci
  createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres werehere_production_ci
fi

run_provision() {
  (
    cd "$ROOT_DIR"
    CI=true \
      PREVIEW_PROVISION_LOCAL_CI_TEST=1 \
      DATABASE_URL_PREVIEW="$PREVIEW_URL" \
      DATABASE_URL="$PRODUCTION_URL" \
      DATABASE_RUNTIME_PASSWORD_PREVIEW='preview-runtime-integration-password' \
      RUNTIME_DATABASE_URL_FILE="$RUNTIME_URL_FILE" \
      ZITADEL_PREVIEW_SUBJECT="$SUBJECT" \
      pnpm exec tsx packages/db/scripts/provision-preview.ts
  )
}

run_provision >/dev/null
run_provision >/dev/null

if [[ "$(stat -c '%a' "$RUNTIME_URL_FILE")" != "600" ]]; then
  printf '%s\n' 'runtime URL file permissions are not 600' >&2
  exit 1
fi

RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$PREVIEW_URL" <<SQL
select count(*) from schema_migrations
where version in ('0001_platform_foundation', '0002_auth_session_runtime', '0003_hotel_basic_information');
select count(*) from auth_identities
where provider = 'ZITADEL' and provider_subject = '$SUBJECT';
select count(*) from permission_grants
where id = '73000000-0000-4000-8000-000000000001'
  and company_id = '$COMPANY_ID'
  and branch_id is null
  and subject_type = 'USER'
  and subject_id = '71000000-0000-4000-8000-000000000001'
  and permission_code = 'HOTEL_MANAGE'
  and effect = 'ALLOW'
  and granted_by = '71000000-0000-4000-8000-000000000001'
  and reason = 'Preview 초기 관리자 권한';
select count(*) from pg_roles
where rolname = 'werehere_preview_runtime'
  and not rolsuper
  and not rolinherit
  and not rolcreaterole
  and not rolcreatedb
  and not rolreplication
  and not rolbypassrls;
select count(*) from pg_auth_members membership
join pg_roles runtime_role on runtime_role.oid in (membership.member, membership.roleid)
where runtime_role.rolname = 'werehere_preview_runtime';
SQL
)"
EXPECTED=$'3\n1\n1\n1\n0'
if [[ "$RESULT" != "$EXPECTED" ]]; then
  printf '%s\n' 'Preview provisioning database assertions failed.' >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" >/dev/null <<'SQL'
insert into companies (id, legal_name, status)
values ('7f000000-0000-4000-8000-000000000001', 'Other Tenant', 'ACTIVE');
insert into branches (id, company_id, branch_type, branch_code, name, status)
values (
  '7f100000-0000-4000-8000-000000000001',
  '7f000000-0000-4000-8000-000000000001',
  'HOTEL',
  'OTHER',
  'Other Hotel',
  'ACTIVE'
);
insert into hotel_profiles (
  company_id,
  branch_id,
  road_address,
  detail_address,
  representative_phone,
  contract_start_date,
  contract_end_date
)
values (
  '7f000000-0000-4000-8000-000000000001',
  '7f100000-0000-4000-8000-000000000001',
  'Other Address',
  '',
  '02-0000-0000',
  '2026-01-01',
  '2026-12-31'
);
SQL

RUNTIME_URL="$(<"$RUNTIME_URL_FILE")"
VISIBLE="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$RUNTIME_URL" <<SQL
begin;
select set_config('app.company_id', '$COMPANY_ID', true);
select count(*) from branches where company_id = '7f000000-0000-4000-8000-000000000001';
rollback;
SQL
)"
EXPECTED_VISIBLE="${COMPANY_ID}"$'\n0'
if [[ "$VISIBLE" != "$EXPECTED_VISIBLE" ]]; then
  printf '%s\n' 'Runtime role crossed the tenant RLS boundary.' >&2
  exit 1
fi

if psql -X -v ON_ERROR_STOP=1 -d "$RUNTIME_URL" -c 'set role postgres' >/dev/null 2>&1; then
  printf '%s\n' 'Runtime role unexpectedly assumed the owner role.' >&2
  exit 1
fi

printf '%s\n' 'PREVIEW_PROVISIONING_INTEGRATION_OK'
