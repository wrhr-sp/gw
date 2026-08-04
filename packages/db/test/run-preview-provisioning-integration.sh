#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/werehere-preview-provision.XXXXXX)"
DATA_DIR="$TMP_DIR/data"
SOCKET_DIR="$TMP_DIR/socket"
LOG_FILE="$TMP_DIR/postgres.log"
API_RUNTIME_URL_FILE="$TMP_DIR/api-runtime-url"
RECONCILER_URL_FILE="$TMP_DIR/reconciler-url"
SUBJECT="preview-subject-integration"
COMPANY_ID="70000000-0000-4000-8000-000000000001"
MIGRATION_OWNER="werehere_preview_migration_owner"
MIGRATION_PASSWORD="preview-migration-integration-password"
BOOTSTRAP_LOGIN_ID="previewadmin"

cleanup() {
  if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
    psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" >/dev/null <<'SQL' || true
drop database if exists werehere_preview_ci with (force);
drop database if exists werehere_production_ci with (force);
drop role if exists werehere_preview_runtime;
drop role if exists werehere_preview_api_runtime;
drop role if exists werehere_preview_reconciler;
drop role if exists preview_stale_definer_member;
drop role if exists preview_stale_runtime_capability;
drop role if exists preview_foreign_definer_grantor;
drop role if exists werehere_preview_migration_owner;
drop role if exists cloud_admin;
drop role if exists preview_wrong_database_owner;
drop role if exists preview_stale_function_grantee;
drop role if exists preview_stale_acl_grantee;
drop role if exists preview_stale_table_acl_grantee;
SQL
  elif [[ -d "$DATA_DIR" ]]; then
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m immediate -w stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  PREVIEW_URL="$(MIGRATION_OWNER="$MIGRATION_OWNER" MIGRATION_PASSWORD="$MIGRATION_PASSWORD" node -e 'const u = new URL(process.env.TEST_DATABASE_URL); u.pathname = "/werehere_preview_ci"; u.username = process.env.MIGRATION_OWNER; u.password = process.env.MIGRATION_PASSWORD; console.log(u.toString())')"
  ADMIN_PREVIEW_URL="$(node -e 'const u = new URL(process.env.TEST_DATABASE_URL); u.pathname = "/werehere_preview_ci"; console.log(u.toString())')"
  PRODUCTION_URL="$(node -e 'const u = new URL(process.env.TEST_DATABASE_URL); u.pathname = "/werehere_production_ci"; console.log(u.toString())')"
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" >/dev/null <<'SQL'
drop database if exists werehere_preview_ci with (force);
drop database if exists werehere_production_ci with (force);
drop role if exists werehere_preview_runtime;
drop role if exists werehere_preview_api_runtime;
drop role if exists werehere_preview_reconciler;
drop role if exists preview_stale_definer_member;
drop role if exists preview_stale_runtime_capability;
drop role if exists preview_foreign_definer_grantor;
drop role if exists werehere_preview_migration_owner;
drop role if exists cloud_admin;
drop role if exists preview_wrong_database_owner;
drop role if exists preview_stale_function_grantee;
drop role if exists preview_stale_acl_grantee;
drop role if exists preview_stale_table_acl_grantee;
create role werehere_preview_migration_owner login createrole password 'preview-migration-integration-password';
create database werehere_preview_ci owner werehere_preview_migration_owner;
create database werehere_production_ci;
SQL
else
  PG_BIN="${PG_BIN:-/usr/lib/postgresql/18/bin}"
  PORT="$((50000 + ($$ % 4000)))"
  PREVIEW_URL="postgresql://$MIGRATION_OWNER:$MIGRATION_PASSWORD@127.0.0.1:$PORT/werehere_preview_ci"
  ADMIN_PREVIEW_URL="postgresql://postgres@127.0.0.1:$PORT/werehere_preview_ci"
  PRODUCTION_URL="postgresql://postgres@127.0.0.1:$PORT/werehere_production_ci"
  mkdir -p "$SOCKET_DIR"
  "$PG_BIN/initdb" -D "$DATA_DIR" -A trust -U postgres --no-locale >/dev/null
  "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$LOG_FILE" \
    -o "-F -k '$SOCKET_DIR' -p $PORT -c listen_addresses='127.0.0.1'" -w start >/dev/null
  psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres \
    -d postgres -c "create role $MIGRATION_OWNER login createrole password '$MIGRATION_PASSWORD'" >/dev/null
  createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres -O "$MIGRATION_OWNER" werehere_preview_ci
  createdb -h "$SOCKET_DIR" -p "$PORT" -U postgres werehere_production_ci
fi

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
do $role$
begin
  if not exists (select 1 from pg_roles where rolname = 'werehere_preview_runtime') then
    create role werehere_preview_runtime login noinherit password 'legacy-preview-integration-password';
  end if;
end
$role$;
SQL

run_provision() {
  local phase="${1:?provision phase is required}"
  local bootstrap_login_id="${2:-$BOOTSTRAP_LOGIN_ID}"
  (
    cd "$ROOT_DIR"
    CI=true \
      PREVIEW_PROVISION_LOCAL_CI_TEST=1 \
      PREVIEW_PROVISION_PHASE="$phase" \
      PREVIEW_BOOTSTRAP_LOGIN_ID="$bootstrap_login_id" \
      PREVIEW_PROVISION_ADMIN_DATABASE_URL="$ADMIN_PREVIEW_URL" \
      DATABASE_URL_PREVIEW="$PREVIEW_URL" \
      DATABASE_URL="$PRODUCTION_URL" \
      DATABASE_API_RUNTIME_PASSWORD_PREVIEW='preview-api-runtime-integration-password' \
      DATABASE_RECONCILER_PASSWORD_PREVIEW='preview-reconciler-integration-password' \
      API_RUNTIME_DATABASE_URL_FILE="$API_RUNTIME_URL_FILE" \
      RECONCILER_DATABASE_URL_FILE="$RECONCILER_URL_FILE" \
      ZITADEL_PREVIEW_SUBJECT="$SUBJECT" \
      ZITADEL_PREVIEW_SUBJECT_SHA256='4a5a9f382288501ac29a0a9ff003f6f5dca58d0dff0c3134a0480fb6a6c18bf6' \
      ZITADEL_PREVIEW_ORGANIZATION_ID='preview-organization-integration' \
      PREVIEW_BOOTSTRAP_APPROVAL_REF='ci-approved-bootstrap' \
      pnpm exec tsx packages/db/scripts/provision-preview.ts
  )
}

run_provision EXPAND >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create table public.hotel_file_access_grants (company_id uuid not null);
alter table public.hotel_file_access_grants enable row level security;
alter table public.hotel_file_access_grants force row level security;
create policy hotel_file_access_grants_company_isolation
  on public.hotel_file_access_grants using (true) with check (true);
SQL
if run_provision EXPAND >/dev/null 2>&1; then
  printf '%s\n' 'Expand provisioning accepted a premature 0035 RLS policy.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" -c \
  'drop table public.hotel_file_access_grants' >/dev/null
printf 'PREVIEW_EXPAND_PREMATURE_REVIEW_POLICY_REJECTED\n'
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
grant usage on schema public to werehere_preview_runtime;
grant select on public.branches to werehere_preview_runtime;
grant execute on function public.runtime_is_schema_owner(),
  public.runtime_has_capability(text),
  public.api_current_company_id(),
  public.reconciler_current_company_id()
  to werehere_preview_runtime;
insert into public.runtime_database_capabilities (role_name, capability)
values ('werehere_preview_runtime', 'API_RUNTIME')
on conflict (role_name) do update set capability = excluded.capability;
create role preview_stale_acl_grantee nologin noinherit;
grant usage, create on schema public to preview_stale_acl_grantee;
grant select, update on table public.users to preview_stale_acl_grantee;
grant create on schema public to public;
create sequence public.preview_stale_acl_sequence;
alter sequence public.preview_stale_acl_sequence
  owner to werehere_preview_migration_owner;
grant usage, update on sequence public.preview_stale_acl_sequence
  to preview_stale_acl_grantee;
SQL
run_provision EXPAND >/dev/null
EXPAND_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select count(*) from schema_migrations where version = '0008_remove_legacy_company_id_fallback';
select count(*) from schema_migrations where version = '0019_hotel_room_management';
select count(*) from schema_migrations where version = '0022_hotel_room_contract_hardening';
select count(*) from schema_migrations where version = '0025_hotel_room_reference_lifecycle';
select (
  has_schema_privilege('werehere_preview_runtime', 'public', 'USAGE')
  and has_table_privilege('werehere_preview_runtime', 'public.branches', 'SELECT')
  and has_function_privilege('werehere_preview_runtime', 'public.runtime_has_capability(text)', 'EXECUTE')
  and has_column_privilege(
    'werehere_preview_runtime', 'public.hotel_room_types', 'name', 'UPDATE'
  )
  and has_column_privilege(
    'werehere_preview_runtime', 'public.hotel_rooms', 'status', 'UPDATE'
  )
  and not has_table_privilege(
    'werehere_preview_runtime', 'public.hotel_room_types', 'UPDATE'
  )
  and not has_column_privilege(
    'werehere_preview_runtime', 'public.hotel_room_types', 'company_id', 'UPDATE'
  )
  and not has_column_privilege(
    'werehere_preview_runtime', 'public.hotel_room_types', 'scope', 'UPDATE'
  )
  and not has_column_privilege(
    'werehere_preview_runtime', 'public.hotel_room_types', 'branch_id', 'UPDATE'
  )
  and not has_schema_privilege('preview_stale_acl_grantee', 'public', 'CREATE')
  and not has_table_privilege('preview_stale_acl_grantee', 'public.users', 'SELECT')
  and not has_table_privilege('preview_stale_acl_grantee', 'public.users', 'UPDATE')
  and not exists (
    select 1
    from pg_namespace namespace_record
    cross join lateral aclexplode(coalesce(
      namespace_record.nspacl,
      acldefault('n'::"char", namespace_record.nspowner)
    )) acl
    where namespace_record.nspname = 'public'
      and acl.grantee = 0
      and acl.privilege_type = 'CREATE'
  )
  and not has_sequence_privilege(
    'preview_stale_acl_grantee',
    'public.preview_stale_acl_sequence',
    'USAGE'
  )
  and not has_sequence_privilege(
    'preview_stale_acl_grantee',
    'public.preview_stale_acl_sequence',
    'UPDATE'
  )
  and exists (
    select 1 from runtime_database_capabilities
    where role_name = 'werehere_preview_runtime' and capability = 'API_RUNTIME'
  )
)::int;
SQL
)"
if [[ "$EXPAND_RESULT" != $'0\n1\n0\n0\n1' ]]; then
  printf '%s\n' 'Expand provisioning did not preserve compatibility or revoke stale ACLs.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
drop sequence public.preview_stale_acl_sequence;
drop role preview_stale_acl_grantee;
create sequence public.preview_precontract_owner_damage_sequence;
alter sequence public.preview_precontract_owner_damage_sequence
  owner to werehere_preview_api_runtime;
SQL
PRECONTRACT_STATE="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select count(*) from schema_migrations where version = '0008_remove_legacy_company_id_fallback';
select count(*) from runtime_database_capabilities where role_name = 'werehere_preview_runtime';
select status || ':' || version::text from users where id = '71000000-0000-4000-8000-000000000001';
SQL
)"
if run_provision CONTRACT >/dev/null 2>&1; then
  printf '%s\n' 'Contract provisioning accepted noncanonical sequence ownership.' >&2
  exit 1
fi
POST_PREFLIGHT_FAILURE_STATE="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select count(*) from schema_migrations where version = '0008_remove_legacy_company_id_fallback';
select count(*) from runtime_database_capabilities where role_name = 'werehere_preview_runtime';
select status || ':' || version::text from users where id = '71000000-0000-4000-8000-000000000001';
SQL
)"
if [[ "$POST_PREFLIGHT_FAILURE_STATE" != "$PRECONTRACT_STATE" ]]; then
  printf '%s\n' 'Ownership preflight failure mutated CONTRACT state.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter sequence public.preview_precontract_owner_damage_sequence
  owner to werehere_preview_migration_owner;
drop sequence public.preview_precontract_owner_damage_sequence;
SQL

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
update public.users
set login_name = 'preview-admin'
where id = '71000000-0000-4000-8000-000000000001'
  and company_id = '$COMPANY_ID'
  and login_name = 'previewadmin';
insert into public.auth_sessions (
  id, company_id, user_id, identity_id, token_hash,
  idle_expires_at, absolute_expires_at, auth_time, authentication_method
)
select
  '71900000-0000-4000-8000-000000000001', '$COMPANY_ID', app_user.id,
  identity.id, decode(repeat('ab', 32), 'hex'),
  now() + interval '1 hour', now() + interval '2 hours', now(), 'OIDC_PKCE'
from public.users app_user
join public.auth_identities identity
  on identity.company_id = app_user.company_id and identity.user_id = app_user.id
where app_user.id = '71000000-0000-4000-8000-000000000001'
  and identity.provider = 'ZITADEL';
SQL

run_provision EXPAND >/dev/null
ALIGNED_BOOTSTRAP_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select login_name || ':' || version::text
from users where id = '71000000-0000-4000-8000-000000000001';
select count(*) from auth_identities
where company_id = '$COMPANY_ID'
  and user_id = '71000000-0000-4000-8000-000000000001'
  and provider = 'ZITADEL' and provider_subject = '$SUBJECT';
select count(*) from permission_grants
where company_id = '$COMPANY_ID'
  and subject_id = '71000000-0000-4000-8000-000000000001'
  and permission_code in (
    'HOTEL_MANAGE', 'USER_READ', 'USER_CREATE', 'USER_SUSPEND',
    'HOTEL_ROOM_READ', 'HOTEL_ROOM_MANAGE', 'HOTEL_ROOM_TYPE_MANAGE'
  )
  and effect = 'ALLOW' and branch_id is null and valid_until is null;
select count(*) from auth_sessions
where id = '71900000-0000-4000-8000-000000000001'
  and revoked_at is not null
  and revoke_reason = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED';
select count(*) from audit_events
where event_code = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED'
  and company_id = '$COMPANY_ID'
  and actor_user_id = '71000000-0000-4000-8000-000000000001'
  and before_summary->>'state' = 'LEGACY_NON_CANONICAL'
  and after_summary->>'state' = 'MVP_CANONICAL';
select count(*) from auth_resolve_login_identity_v1('previewadmin')
where provider_subject = '$SUBJECT';
select count(*) from auth_resolve_login_identity_v1('preview-admin');
SQL
)"
if [[ "$ALIGNED_BOOTSTRAP_RESULT" != $'previewadmin:2\n1\n7\n1\n1\n1\n0' ]]; then
  printf '%s\n' 'Preview bootstrap login ID alignment contract failed.' >&2
  exit 1
fi
run_provision EXPAND >/dev/null
ALIGNED_BOOTSTRAP_REPLAY="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select login_name || ':' || version::text
from users where id = '71000000-0000-4000-8000-000000000001';
select count(*) from audit_events
where event_code = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED'
  and company_id = '$COMPANY_ID';
SQL
)"
if [[ "$ALIGNED_BOOTSTRAP_REPLAY" != $'previewadmin:2\n1' ]]; then
  printf '%s\n' 'Preview bootstrap alignment was not idempotent.' >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
update public.users
set login_name = null
where id = '71000000-0000-4000-8000-000000000001'
  and company_id = '$COMPANY_ID'
  and login_name = 'previewadmin';
insert into public.auth_sessions (
  id, company_id, user_id, identity_id, token_hash,
  idle_expires_at, absolute_expires_at, auth_time, authentication_method
)
select
  '71900000-0000-4000-8000-000000000002', '$COMPANY_ID', app_user.id,
  identity.id, decode(repeat('ac', 32), 'hex'),
  now() + interval '1 hour', now() + interval '2 hours', now(), 'OIDC_PKCE'
from public.users app_user
join public.auth_identities identity
  on identity.company_id = app_user.company_id and identity.user_id = app_user.id
where app_user.id = '71000000-0000-4000-8000-000000000001'
  and identity.provider = 'ZITADEL';
SQL

run_provision EXPAND >/dev/null
NULL_LOGIN_ALIGNMENT_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select login_name || ':' || version::text
from users where id = '71000000-0000-4000-8000-000000000001';
select count(*) from auth_sessions
where id = '71900000-0000-4000-8000-000000000002'
  and revoked_at is not null
  and revoke_reason = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED';
select count(*) from audit_events
where event_code = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED'
  and company_id = '$COMPANY_ID'
  and actor_user_id = '71000000-0000-4000-8000-000000000001'
  and before_summary->>'state' = 'LEGACY_UNSET'
  and after_summary->>'state' = 'MVP_CANONICAL';
select count(*) from auth_resolve_login_identity_v1('previewadmin')
where provider_subject = '$SUBJECT';
SQL
)"
if [[ "$NULL_LOGIN_ALIGNMENT_RESULT" != $'previewadmin:3\n1\n1\n1' ]]; then
  printf '%s\n' 'Preview bootstrap NULL login alignment contract failed.' >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
create role preview_stale_definer_member nologin noinherit;
grant werehere_auth_session_definer,
      werehere_tenant_authority_definer
  to $MIGRATION_OWNER with admin true, inherit false, set true;
SQL
psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" >/dev/null <<'SQL'
grant werehere_auth_session_definer to preview_stale_definer_member
  with admin true, inherit false, set false;
grant werehere_tenant_authority_definer to preview_stale_definer_member
  with admin false, inherit true, set true;
SQL
run_provision EXPAND >/dev/null
STALE_DEFINER_MEMBERSHIPS="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select count(*)
from pg_auth_members membership
join pg_roles definer_role on definer_role.oid = membership.roleid
where definer_role.rolname in (
  'werehere_auth_session_definer',
  'werehere_tenant_authority_definer'
);
SQL
)"
if [[ "$STALE_DEFINER_MEMBERSHIPS" != "0" ]]; then
  printf '%s\n' 'Preview provisioning retained stale definer memberships.' >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create role preview_foreign_definer_grantor nologin noinherit;
grant werehere_auth_session_definer to preview_foreign_definer_grantor
  with admin true, inherit false, set true;
set role preview_foreign_definer_grantor;
grant werehere_auth_session_definer to preview_stale_definer_member
  with admin false, inherit false, set false;
reset role;
SQL
if run_provision EXPAND >/dev/null 2>&1; then
  printf '%s\n' 'Preview provisioning removed a foreign-grantor definer membership.' >&2
  exit 1
fi
FOREIGN_INERT_DEFINER_MEMBERSHIP="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select count(*)
from pg_auth_members membership
join pg_roles definer_role on definer_role.oid = membership.roleid
join pg_roles member_role on member_role.oid = membership.member
join pg_roles grantor_role on grantor_role.oid = membership.grantor
where definer_role.rolname = 'werehere_auth_session_definer'
  and member_role.rolname = 'preview_stale_definer_member'
  and grantor_role.rolname = 'preview_foreign_definer_grantor'
  and not membership.admin_option
  and not membership.inherit_option
  and not membership.set_option;
SQL
)"
if [[ "$FOREIGN_INERT_DEFINER_MEMBERSHIP" != "1" ]]; then
  printf '%s\n' 'Preview provisioning did not fail closed on an inert foreign definer membership.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
set role preview_foreign_definer_grantor;
revoke werehere_auth_session_definer from preview_stale_definer_member
  granted by preview_foreign_definer_grantor;
reset role;
revoke werehere_auth_session_definer from preview_foreign_definer_grantor
  granted by current_user;
drop role preview_foreign_definer_grantor;
SQL

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
create role cloud_admin superuser nologin noinherit;
grant werehere_auth_session_definer to $MIGRATION_OWNER
  with admin true, inherit false, set true;
grant werehere_tenant_authority_definer to $MIGRATION_OWNER
  with admin true, inherit false, set false;
update pg_auth_members membership
set grantor = (select oid from pg_roles where rolname = 'cloud_admin')
from pg_roles definer_role, pg_roles member_role
where definer_role.oid = membership.roleid
  and member_role.oid = membership.member
  and definer_role.rolname in (
    'werehere_auth_session_definer',
    'werehere_tenant_authority_definer'
  )
  and member_role.rolname = '$MIGRATION_OWNER';
SQL
if run_provision EXPAND >/dev/null 2>&1; then
  printf '%s\n' 'Preview provisioning accepted a malformed Neon creator membership pair.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
update pg_auth_members membership
set set_option = false
from pg_roles definer_role, pg_roles member_role, pg_roles grantor_role
where definer_role.oid = membership.roleid
  and member_role.oid = membership.member
  and grantor_role.oid = membership.grantor
  and definer_role.rolname = 'werehere_auth_session_definer'
  and member_role.rolname = '$MIGRATION_OWNER'
  and grantor_role.rolname = 'cloud_admin';
SQL
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create role preview_wrong_database_owner nologin noinherit;
alter database werehere_preview_ci owner to preview_wrong_database_owner;
SQL
set +e
DATABASE_OWNER_MISMATCH_OUTPUT="$(run_provision EXPAND 2>&1)"
DATABASE_OWNER_MISMATCH_STATUS=$?
set -e
if [[ "$DATABASE_OWNER_MISMATCH_STATUS" -eq 0 ]] ||
  [[ "$DATABASE_OWNER_MISMATCH_OUTPUT" != *'Preview migration credential must own the Preview database'* ]]; then
  printf '%s\n' 'Preview provisioning did not fail at the database-owner preflight.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
alter database werehere_preview_ci owner to $MIGRATION_OWNER;
drop role preview_wrong_database_owner;
SQL
run_provision EXPAND >/dev/null
EXPAND_RUNTIME_OWNER_HASH="$(
  psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" \
    -c "select prosrc from pg_proc procedure_record join pg_namespace procedure_namespace on procedure_namespace.oid = procedure_record.pronamespace where procedure_namespace.nspname = 'public' and procedure_record.proname = 'runtime_is_schema_owner'" |
    python3 -c 'import hashlib,sys; data=sys.stdin.buffer.read(); assert data.endswith(b"\n"); print(hashlib.sha256(data[:-1]).hexdigest())'
)"
if [[ "$EXPAND_RUNTIME_OWNER_HASH" != "1b51d38556502816e9d57b8f254a7b9c892dc873ea0ac4cbbc946ad1d2add221" ]]; then
  printf '%s\n' 'EXPAND did not preserve the previous Worker runtime owner contract.' >&2
  exit 1
fi
NEON_CREATOR_MEMBERSHIP_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select count(*)
from pg_auth_members membership
join pg_roles definer_role on definer_role.oid = membership.roleid
join pg_roles member_role on member_role.oid = membership.member
join pg_roles grantor_role on grantor_role.oid = membership.grantor
where definer_role.rolname in (
  'werehere_auth_session_definer',
  'werehere_tenant_authority_definer'
)
  and member_role.rolname = '$MIGRATION_OWNER'
  and grantor_role.rolname = 'cloud_admin'
  and membership.admin_option
  and not membership.inherit_option
  and not membership.set_option;
SQL
)"
if [[ "$NEON_CREATOR_MEMBERSHIP_RESULT" != "2" ]]; then
  printf '%s\n' 'Preview provisioning did not preserve the exact Neon creator membership pair.' >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -f "$ROOT_DIR/packages/db/migrations/0008_remove_legacy_company_id_fallback.sql" \
  -f "$ROOT_DIR/packages/db/migrations/0010_global_login_id_contract.sql" \
  -f "$ROOT_DIR/packages/db/migrations/0012_account_provider_exact_dispatch_contract.sql" \
  -f "$ROOT_DIR/packages/db/migrations/0015_neon_definer_contract_hardening.sql" \
  -f "$ROOT_DIR/packages/db/migrations/0022_hotel_room_contract_hardening.sql" \
  -f "$ROOT_DIR/packages/db/migrations/0023_login_id_registry_history_contract.sql" \
  -f "$ROOT_DIR/packages/db/migrations/0024_preview_bootstrap_session_revocations.sql" \
  >/dev/null
run_provision EXPAND >/dev/null
LEGACY_ROOM_CONTRACT_EXPAND="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select count(*) from schema_migrations
where version = '0022_hotel_room_contract_hardening';
select count(*) from schema_migrations
where version = '0025_hotel_room_reference_lifecycle';
SQL
)"
if [[ "$LEGACY_ROOM_CONTRACT_EXPAND" != $'1\n0' ]]; then
  printf '%s\n' 'Existing room CONTRACT was not accepted as lifecycle EXPAND.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" >/dev/null <<'SQL'
insert into users (id, company_id, user_type, display_name)
values (
  '76000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'INTERNAL_STAFF', 'Pre-contract Worker'
);
insert into login_id_registry (login_id, company_id, target_user_id)
values (
  'precontractworker',
  '70000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001'
);
update users set login_name = 'precontractworker'
where id = '76000000-0000-4000-8000-000000000001';
insert into auth_identities (id, company_id, user_id, provider, provider_subject)
values (
  '7e000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001',
  'ZITADEL', 'pre-contract-compatibility'
);
with actor_identity as (
  select id, user_id from auth_identities
   where id = '7e000000-0000-4000-8000-000000000001'
)
insert into auth_sessions (
  id, company_id, user_id, identity_id, token_hash,
  idle_expires_at, absolute_expires_at, auth_time, authentication_method
)
select '7c000000-0000-4000-8000-000000000001',
       '70000000-0000-4000-8000-000000000001', user_id, id,
       decode(repeat('7c', 32), 'hex'), now() + interval '1 hour',
       now() + interval '8 hours', now(), 'pre-contract-integration'
  from actor_identity;

insert into branches (id, company_id, branch_type, branch_code, name)
values (
  '7d000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'HOTEL', 'PRECONTRACT-01', 'Pre-contract Hotel'
);
insert into hotel_profiles (
  company_id, branch_id, road_address, detail_address, representative_phone,
  contract_start_date, contract_end_date
) values (
  '70000000-0000-4000-8000-000000000001',
  '7d000000-0000-4000-8000-000000000001',
  'Pre-contract Road 1', '', '02-0000-0000', current_date, current_date + 30
);

insert into permission_grants (
  id, company_id, subject_type, subject_id, permission_code,
  effect, valid_from, granted_by, reason
)
select '77000000-0000-4000-8000-000000000001',
       '70000000-0000-4000-8000-000000000001', 'USER', user_id,
       'HOTEL_ROOM_MANAGE', 'ALLOW', now(), user_id,
       'pre-contract compatibility'
  from auth_sessions where id = '7c000000-0000-4000-8000-000000000001';
insert into permission_grants (
  id, company_id, subject_type, subject_id, permission_code,
  effect, valid_from, granted_by, reason
)
select '77000000-0000-4000-8000-000000000002',
       '70000000-0000-4000-8000-000000000001', 'USER', user_id,
       'HOTEL_ROOM_READ', 'ALLOW', now(), user_id,
       'pre-contract compatibility'
  from auth_sessions where id = '7c000000-0000-4000-8000-000000000001';

insert into hotel_staff_assignments (
  id, company_id, branch_id, user_id, assignment_type,
  start_date, reason, created_by
)
select '77100000-0000-4000-8000-000000000001',
       '70000000-0000-4000-8000-000000000001',
       '7d000000-0000-4000-8000-000000000001', user_id,
       'PRIMARY', current_date, 'pre-contract compatibility', user_id
  from auth_sessions where id = '7c000000-0000-4000-8000-000000000001';

insert into hotel_room_types (
  id, company_id, scope, branch_id, name, display_order,
  is_active, created_by, updated_by
)
select '7e100000-0000-4000-8000-000000000001',
       '70000000-0000-4000-8000-000000000001', 'HOTEL',
       '7d000000-0000-4000-8000-000000000001', 'Legacy Type', 10,
       true, user_id, user_id
  from auth_sessions where id = '7c000000-0000-4000-8000-000000000001';
insert into hotel_rooms (
  id, company_id, branch_id, room_number, floor_label, floor_sort_key,
  room_type_id, status, created_by, updated_by
)
select room_id, '70000000-0000-4000-8000-000000000001',
       '7d000000-0000-4000-8000-000000000001', room_number,
       '1F', floor_sort_key, '7e100000-0000-4000-8000-000000000001',
       room_status, user_id, user_id
  from auth_sessions
  cross join (values
    ('7f000000-0000-4000-8000-000000000001'::uuid, '101', 1, 'TEMP_SUSPENDED'),
    ('7f000000-0000-4000-8000-000000000002'::uuid, '102', 2, 'OUT_OF_SERVICE')
  ) fixture(room_id, room_number, floor_sort_key, room_status)
 where auth_sessions.id = '7c000000-0000-4000-8000-000000000001';
SQL
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PREVIEW_URL" \
    pnpm exec tsx packages/db/test/hotel-room-precontract-compatibility.ts
) >/dev/null

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
insert into hotel_rooms (
  id, company_id, branch_id, room_number, floor_label, floor_sort_key,
  room_type_id, status, created_by, updated_by
)
select fixture.room_id, '70000000-0000-4000-8000-000000000001',
       '7d000000-0000-4000-8000-000000000001', fixture.room_number,
       'B1', -1, '7e100000-0000-4000-8000-000000000001',
       'ACTIVE', session_record.user_id, session_record.user_id
  from auth_sessions session_record
  cross join (values
    ('7f000000-0000-4000-8000-000000000091'::uuid, 'b01'),
    ('7f000000-0000-4000-8000-000000000092'::uuid, 'B01')
  ) fixture(room_id, room_number)
 where session_record.id = '7c000000-0000-4000-8000-000000000001';
SQL
COLLISION_LOG="$(mktemp /tmp/werehere-room-collision.XXXXXX)"
if run_provision CONTRACT >"$COLLISION_LOG" 2>&1; then
  printf '%s\n' 'Room canonical collision unexpectedly passed CONTRACT preflight.' >&2
  rm -f "$COLLISION_LOG"
  exit 1
fi
if ! grep -q 'HOTEL_ROOM_CANONICAL_COLLISION' "$COLLISION_LOG"; then
  printf '%s\n' 'Room canonical collision did not return the stable preflight diagnostic.' >&2
  rm -f "$COLLISION_LOG"
  exit 1
fi
rm -f "$COLLISION_LOG"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
update hotel_rooms
   set room_number = case id
     when '7f000000-0000-4000-8000-000000000091'::uuid
       then pg_catalog.convert_from(
         pg_catalog.decode('c2a0', 'hex'), 'UTF8'
       ) || 'B01'
     else 'PREFLIGHT-92'
   end
 where id in (
   '7f000000-0000-4000-8000-000000000091',
   '7f000000-0000-4000-8000-000000000092'
 );
SQL
UNSUPPORTED_BEFORE="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select pg_catalog.encode(room_number::bytea, 'hex')
       || '|' || version::text || '|' || status || '|'
       || (select count(*)::text from schema_migrations
            where version = '0025_hotel_room_reference_lifecycle')
  from hotel_rooms
 where id = '7f000000-0000-4000-8000-000000000091';
SQL
)"
UNSUPPORTED_LOG="$(mktemp /tmp/werehere-room-unsupported.XXXXXX)"
if run_provision CONTRACT >"$UNSUPPORTED_LOG" 2>&1; then
  printf '%s\n' 'Unsupported legacy room number unexpectedly passed CONTRACT preflight.' >&2
  rm -f "$UNSUPPORTED_LOG"
  exit 1
fi
if ! grep -q 'HOTEL_ROOM_NUMBER_UNSUPPORTED' "$UNSUPPORTED_LOG"; then
  printf '%s\n' 'Unsupported room number did not return the stable preflight diagnostic.' >&2
  rm -f "$UNSUPPORTED_LOG"
  exit 1
fi
rm -f "$UNSUPPORTED_LOG"
UNSUPPORTED_AFTER="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select pg_catalog.encode(room_number::bytea, 'hex')
       || '|' || version::text || '|' || status || '|'
       || (select count(*)::text from schema_migrations
            where version = '0025_hotel_room_reference_lifecycle')
  from hotel_rooms
 where id = '7f000000-0000-4000-8000-000000000091';
SQL
)"
if [[ "$UNSUPPORTED_BEFORE" != "$UNSUPPORTED_AFTER" ||
      "$UNSUPPORTED_AFTER" != "c2a0423031|1|ACTIVE|0" ]]; then
  printf '%s\n' 'Unsupported room preflight mutated legacy data or migration marker.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
update hotel_rooms set room_number = 'PREFLIGHT-91'
 where id = '7f000000-0000-4000-8000-000000000091';
create role preview_stale_runtime_capability nologin noinherit;
insert into runtime_database_capabilities (role_name, capability)
values ('preview_stale_runtime_capability', 'API_RUNTIME');
SQL
run_provision CONTRACT >/dev/null
STALE_CAPABILITY_COUNT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select count(*) from runtime_database_capabilities
where role_name = 'preview_stale_runtime_capability';
SQL
)"
if [[ "$STALE_CAPABILITY_COUNT" != "0" ]]; then
  printf '%s\n' 'Contract provisioning retained a stale runtime capability.' >&2
  exit 1
fi
INSPECTION_PROCESS_CONTRACT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select (
  (select count(*) = 1 from schema_migrations
    where version = '0026_hotel_inspection_process_and_files')
  and has_function_privilege(
    'werehere_preview_api_runtime',
    'public.hotel_process_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'werehere_preview_api_runtime',
    'public.hotel_inspection_command_v2(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'werehere_preview_api_runtime',
    'public.hotel_inspection_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'werehere_preview_api_runtime',
    'public.hotel_file_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'werehere_preview_api_runtime',
    'public.hotel_file_scan_command_v1(uuid,text,text,bigint,jsonb,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'werehere_preview_reconciler',
    'public.hotel_file_scan_command_v1(uuid,text,text,bigint,jsonb,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'werehere_preview_reconciler',
    'public.hotel_inspection_claim_materialization_v1(uuid,bytea,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'werehere_preview_reconciler',
    'public.hotel_inspection_complete_materialization_v1(uuid,bigint,bytea,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'werehere_preview_reconciler',
    'public.hotel_process_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)',
    'EXECUTE'
  )
  and has_table_privilege(
    'werehere_preview_api_runtime', 'public.process_definitions', 'SELECT'
  )
  and not has_table_privilege(
    'werehere_preview_api_runtime', 'public.process_definitions', 'INSERT'
  )
  and not has_table_privilege(
    'werehere_preview_api_runtime', 'public.hotel_file_scan_jobs', 'SELECT'
  )
  and exists (
    select 1 from hotel_file_finalizer_capabilities
    where role_name = 'werehere_preview_reconciler'
  )
  and not exists (
    select 1 from hotel_file_finalizer_capabilities
    where role_name <> 'werehere_preview_reconciler'
  )
)::text;
SQL
)"
if [[ "$INSPECTION_PROCESS_CONTRACT" != "true" ]]; then
  printf '%s\n' 'Inspection process CONTRACT marker or exact runtime ACL is invalid.' >&2
  exit 1
fi
ROOM_CONTRACT_MARKER="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" \
  -c "select count(*) from schema_migrations where version = '0022_hotel_room_contract_hardening'")"
if [[ "$ROOM_CONTRACT_MARKER" != "1" ]]; then
  printf '%s\n' 'Room CONTRACT policy hardening marker is missing.' >&2
  exit 1
fi
ROOM_LIFECYCLE_CONTRACT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select count(*) from schema_migrations
where version = '0025_hotel_room_reference_lifecycle';
select not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'hotel_rooms'
    and column_name = 'planned_resume_date'
);
select to_regclass('public.hotel_rooms_live_room_number_key') is not null;
select count(*) from pg_trigger
where not tgisinternal and tgname in (
  'hotel_rooms_deleted_immutable',
  'hotel_room_status_history_insert_guard'
);
select not has_table_privilege(
         'werehere_preview_api_runtime', 'public.hotel_rooms', 'INSERT'
       )
  and not has_any_column_privilege(
         'werehere_preview_api_runtime', 'public.hotel_rooms', 'UPDATE'
       )
  and not has_table_privilege(
         'werehere_preview_api_runtime', 'public.hotel_room_status_history', 'INSERT'
       )
  and has_function_privilege(
         'werehere_preview_api_runtime',
         'public.hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid)',
         'EXECUTE'
       )
  and has_function_privilege(
         'werehere_preview_api_runtime',
         'public.hotel_room_write_command_v1(uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid)',
         'EXECUTE'
       )
  and not has_function_privilege(
         'werehere_preview_reconciler',
         'public.hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid)',
         'EXECUTE'
       )
  and not has_function_privilege(
         'werehere_preview_reconciler',
         'public.hotel_room_write_command_v1(uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid)',
         'EXECUTE'
       )
  and not has_function_privilege(
         'public',
         'public.hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid)',
         'EXECUTE'
       )
  and not has_function_privilege(
         'public',
         'public.hotel_room_write_command_v1(uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid)',
         'EXECUTE'
       );
SQL
)"
if [[ "$ROOM_LIFECYCLE_CONTRACT" != $'1\nt\nt\n2\nt' ]]; then
  printf '%s\n' 'Room lifecycle CONTRACT schema is incomplete.' >&2
  exit 1
fi
CONTRACT_RUNTIME_OWNER_HASH="$(
  psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" \
    -c "select prosrc from pg_proc procedure_record join pg_namespace procedure_namespace on procedure_namespace.oid = procedure_record.pronamespace where procedure_namespace.nspname = 'public' and procedure_record.proname = 'runtime_is_schema_owner'" |
    python3 -c 'import hashlib,sys; data=sys.stdin.buffer.read(); assert data.endswith(b"\n"); print(hashlib.sha256(data[:-1]).hexdigest())'
)"
if [[ "$CONTRACT_RUNTIME_OWNER_HASH" != "48d938d880cd3ae967ca52e9896797d6ef5526ad2e8cf22801d9159b982f1d2f" ]]; then
  printf '%s\n' 'CONTRACT did not install the hardened runtime owner contract.' >&2
  exit 1
fi
TEMPORARY_DEFINER_PRIVILEGES="$(psql -X -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select
  (select count(*)
   from pg_auth_members membership
   join pg_roles granted_role on granted_role.oid = membership.roleid
   join pg_roles member_role on member_role.oid = membership.member
   join pg_roles grantor_role on grantor_role.oid = membership.grantor
   where granted_role.rolname in (
     'werehere_auth_session_definer',
     'werehere_tenant_authority_definer'
   )
     and not (
       member_role.rolname = 'werehere_preview_migration_owner'
       and grantor_role.rolname = 'cloud_admin'
       and grantor_role.rolsuper
       and membership.admin_option
       and not membership.inherit_option
       and not membership.set_option
     ))
  +
  (select count(*)
   from pg_roles role
   where role.rolname in (
     'werehere_auth_session_definer',
     'werehere_tenant_authority_definer'
   )
     and has_schema_privilege(role.oid, 'public', 'CREATE'));
SQL
)"
if [[ "$TEMPORARY_DEFINER_PRIVILEGES" != "0" ]]; then
  printf '%s\n' 'Contract retained temporary definer membership or schema CREATE privilege.' >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -c "update users set status = 'INACTIVE' where id = '71000000-0000-4000-8000-000000000001'" >/dev/null
if run_provision CONTRACT >/dev/null 2>&1; then
  printf '%s\n' 'Provisioning accepted a drifted Preview user.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -c "update users set status = 'ACTIVE' where id = '71000000-0000-4000-8000-000000000001'" >/dev/null

psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -c "update permission_grants set valid_until = '2026-06-01T00:00:00Z' where id = '73000000-0000-4000-8000-000000000001'" >/dev/null
if run_provision CONTRACT >/dev/null 2>&1; then
  printf '%s\n' 'Provisioning accepted a drifted Preview permission grant.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -c "update permission_grants set valid_until = null where id = '73000000-0000-4000-8000-000000000001'" >/dev/null

psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -c "update permission_grants set valid_from = '2030-01-01T00:00:00Z' where id = '73000000-0000-4000-8000-000000000002'" >/dev/null
if run_provision CONTRACT >/dev/null 2>&1; then
  printf '%s\n' 'Provisioning accepted a drifted USER_READ grant.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -c "update permission_grants set valid_from = '2026-01-01T00:00:00Z' where id = '73000000-0000-4000-8000-000000000002'" >/dev/null

psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -c "update permission_grants set reason = 'drifted' where id = '73000000-0000-4000-8000-000000000003'" >/dev/null
if run_provision CONTRACT >/dev/null 2>&1; then
  printf '%s\n' 'Provisioning accepted a drifted USER_CREATE grant.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -c "update permission_grants set reason = 'Preview 초기 관리자 사용자생성 권한' where id = '73000000-0000-4000-8000-000000000003'" >/dev/null

psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -c "update permission_grants set version = 2 where id = '73000000-0000-4000-8000-000000000004'" >/dev/null
if run_provision CONTRACT >/dev/null 2>&1; then
  printf '%s\n' 'Provisioning accepted a drifted USER_SUSPEND grant.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$PREVIEW_URL" \
  -c "update permission_grants set version = 1 where id = '73000000-0000-4000-8000-000000000004'" >/dev/null

for url_file in "$API_RUNTIME_URL_FILE" "$RECONCILER_URL_FILE"; do
  if [[ "$(stat -c '%a' "$url_file")" != "600" ]]; then
    printf '%s\n' 'runtime URL file permissions are not 600' >&2
    exit 1
  fi
done

RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$PREVIEW_URL" <<SQL
select count(*) from schema_migrations
where version in (
  '0001_platform_foundation', '0002_auth_session_runtime',
  '0003_hotel_basic_information', '0004_custom_login_security',
  '0005_auth_session_definer', '0006_account_administration',
  '0007_api_tenant_authority_expand', '0008_remove_legacy_company_id_fallback',
  '0009_global_login_id_expand', '0010_global_login_id_contract',
  '0011_account_provider_exact_dispatch',
  '0012_account_provider_exact_dispatch_contract'
);
select count(*) from auth_identities
where provider = 'ZITADEL' and provider_subject = '$SUBJECT';
select count(*) from users
where id = '71000000-0000-4000-8000-000000000001'
  and company_id = '$COMPANY_ID' and login_name = 'previewadmin';
select count(*) from login_id_registry
where login_id = 'previewadmin' and company_id = '$COMPANY_ID'
  and target_user_id = '71000000-0000-4000-8000-000000000001';
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
select count(*) from permission_grants
where company_id = '$COMPANY_ID'
  and subject_id = '71000000-0000-4000-8000-000000000001'
  and permission_code in ('USER_READ', 'USER_CREATE', 'USER_SUSPEND')
  and effect = 'ALLOW' and valid_until is null;
select count(*) from company_bootstrap_states
where company_id = '$COMPANY_ID'
  and subject_fingerprint = '4a5a9f382288501ac29a0a9ff003f6f5dca58d0dff0c3134a0480fb6a6c18bf6'
  and zitadel_organization_id = 'preview-organization-integration'
  and approval_reference = 'ci-approved-bootstrap';
select count(*) from audit_events
where id = '74000000-0000-4000-8000-000000000001'
  and event_code = 'ACCOUNT_BOOTSTRAPPED';
select count(*) from pg_roles
where rolname in ('werehere_preview_api_runtime', 'werehere_preview_reconciler')
  and rolcanlogin
  and not rolsuper
  and not rolinherit
  and not rolcreaterole
  and not rolcreatedb
  and not rolreplication
  and not rolbypassrls;
select count(*) from pg_auth_members membership
join pg_roles runtime_role on runtime_role.oid = membership.member
where runtime_role.rolname in ('werehere_preview_api_runtime', 'werehere_preview_reconciler');
select count(*) from pg_roles
where rolname = 'werehere_auth_session_definer'
  and not rolcanlogin
  and not rolinherit
  and not rolsuper
  and not rolcreaterole
  and not rolcreatedb
  and not rolreplication
  and not rolbypassrls;
select count(*)
from pg_auth_members membership
join pg_roles definer_role
  on definer_role.oid = membership.member or definer_role.oid = membership.roleid
where definer_role.rolname = 'werehere_auth_session_definer'
  and (
    membership.member = definer_role.oid
    or membership.inherit_option
    or membership.set_option
  );
select count(*) from runtime_database_capabilities
where role_name = 'werehere_preview_runtime';
select (
  has_schema_privilege('werehere_preview_runtime', 'public', 'USAGE')
  or has_schema_privilege('werehere_preview_runtime', 'public', 'CREATE')
  or has_table_privilege('werehere_preview_runtime', 'public.branches', 'SELECT')
  or has_function_privilege('werehere_preview_runtime', 'public.runtime_is_schema_owner()', 'EXECUTE')
  or has_function_privilege('werehere_preview_runtime', 'public.runtime_has_capability(text)', 'EXECUTE')
  or has_function_privilege('werehere_preview_runtime', 'public.api_current_company_id()', 'EXECUTE')
  or has_function_privilege('werehere_preview_runtime', 'public.reconciler_current_company_id()', 'EXECUTE')
)::int;
SQL
)"
EXPECTED=$'12\n1\n1\n1\n1\n3\n1\n1\n2\n0\n1\n0\n0\n0'
if [[ "$RESULT" != "$EXPECTED" ]]; then
  printf '%s\n' 'Preview provisioning database assertions failed.' >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
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

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.audit_events disable trigger audit_events_no_update;
update public.audit_events
set company_id = '7f000000-0000-4000-8000-000000000001',
    resource_type = 'HOTEL',
    resource_id = '7f100000-0000-4000-8000-000000000001',
    reason = 'drifted approval',
    after_summary = '{"subjectFingerprint":"drifted","zitadelOrganizationId":"drifted"}'::jsonb,
    trace_id = '74000000-0000-4000-8000-000000000099'
where id = '74000000-0000-4000-8000-000000000001';
alter table public.audit_events enable trigger audit_events_no_update;
SQL
if run_provision CONTRACT >/dev/null 2>&1; then
  printf '%s\n' 'Provisioning accepted a drifted bootstrap audit.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.audit_events disable trigger audit_events_no_update;
update public.audit_events
set company_id = '70000000-0000-4000-8000-000000000001',
    resource_type = 'USER',
    resource_id = '71000000-0000-4000-8000-000000000001',
    reason = 'ci-approved-bootstrap',
    after_summary = '{"subjectFingerprint":"4a5a9f382288501ac29a0a9ff003f6f5dca58d0dff0c3134a0480fb6a6c18bf6","zitadelOrganizationId":"preview-organization-integration"}'::jsonb,
    trace_id = '74000000-0000-4000-8000-000000000001'
where id = '74000000-0000-4000-8000-000000000001';
alter table public.audit_events enable trigger audit_events_no_update;
SQL
run_provision CONTRACT >/dev/null

contract_acl_snapshot() {
  psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select concat(
  has_schema_privilege('public', 'public', 'usage'),
  '|',
  coalesce(string_agg(
    coalesce(grantee_role.rolname, 'PUBLIC') || ':' || table_record.relname || ':' ||
      column_record.attname || ':' || upper(acl.privilege_type),
    ',' order by grantee_role.rolname, table_record.relname, column_record.attname,
      acl.privilege_type
  ), '')
)
from pg_class table_record
join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
join pg_attribute column_record on column_record.attrelid = table_record.oid
cross join lateral aclexplode(column_record.attacl) acl
left join pg_roles grantee_role on grantee_role.oid = acl.grantee
where table_namespace.nspname = 'public'
  and table_record.relname in (
    'auth_identities', 'branches', 'hotel_profiles',
    'hotel_staff_assignments', 'housekeeping_hotel_links',
    'hotel_owner_assignments'
  )
  and acl.grantee <> table_record.relowner;
SQL
}

CONTRACT_ACL_BEFORE_DAMAGE="$(contract_acl_snapshot)"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
delete from public.schema_migrations
where version = '0015_neon_definer_contract_hardening';
SQL
if run_provision EXPAND >/dev/null 2>&1; then
  printf '%s\n' 'EXPAND accepted partial contract markers.' >&2
  exit 1
fi
if [[ "$(contract_acl_snapshot)" != "$CONTRACT_ACL_BEFORE_DAMAGE" ]]; then
  printf '%s\n' 'Partial-marker EXPAND changed the contract ACL.' >&2
  exit 1
fi
run_provision CONTRACT >/dev/null

CONTRACT_ACL_BEFORE_DAMAGE="$(contract_acl_snapshot)"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'alter table public.login_id_registry rename to login_id_registry_damaged' >/dev/null
if run_provision EXPAND >/dev/null 2>&1; then
  printf '%s\n' 'EXPAND accepted a damaged bootstrap schema.' >&2
  exit 1
fi
if [[ "$(contract_acl_snapshot)" != "$CONTRACT_ACL_BEFORE_DAMAGE" ]]; then
  printf '%s\n' 'Bootstrap-damaged EXPAND changed the contract ACL.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'alter table public.login_id_registry_damaged rename to login_id_registry' >/dev/null

# A later release must be able to apply new EXPAND migrations on an already
# contracted base while retaining the previous Worker's exact CONTRACT ACL,
# then converge idempotently through CONTRACT provisioning.
run_provision EXPAND >/dev/null
COMPAT_EXPAND_API_RUNTIME_URL="$(<"$API_RUNTIME_URL_FILE")"
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$COMPAT_EXPAND_API_RUNTIME_URL" pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";
const result = await probeDatabaseReadiness(process.env.TEST_READY_URL, {
  capability: "API_RUNTIME",
});
if (result.status !== "READY") {
  throw new Error(`contracted-base EXPAND was not previous-Worker compatible: ${result.status}`);
}
NODE
)
COMPAT_EXPAND_SCHEMA_ACL="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select has_schema_privilege('public', 'public', 'usage');
SQL
)"
if [[ "$COMPAT_EXPAND_SCHEMA_ACL" != "f" ]]; then
  printf '%s\n' 'Contracted-base EXPAND reopened PUBLIC schema usage.' >&2
  exit 1
fi
run_provision CONTRACT >/dev/null

API_RUNTIME_URL="$(<"$API_RUNTIME_URL_FILE")"
RECONCILER_URL="$(<"$RECONCILER_URL_FILE")"

readiness_status() {
  local database_url="${1:?database URL is required}"
  local capability="${2:?runtime capability is required}"
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$database_url" TEST_READY_CAPABILITY="$capability" \
      pnpm exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./packages/db/src/client.ts";
const databaseUrl = process.env.TEST_READY_URL;
const capability = process.env.TEST_READY_CAPABILITY;
if (!databaseUrl || (capability !== "API_RUNTIME" && capability !== "RECONCILER")) {
  throw new Error("Readiness damage probe configuration is invalid");
}
const result = await probeDatabaseReadiness(databaseUrl, { capability });
console.log(result.status);
NODE
  )
}

assert_readiness() {
  local expected="${1:?expected readiness is required}"
  local actual
  actual="$(readiness_status "$API_RUNTIME_URL" API_RUNTIME)"
  if [[ "$actual" != "$expected" ]]; then
    printf 'API readiness was %s, expected %s.\n' "$actual" "$expected" >&2
    exit 1
  fi
}

assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'grant update on public.hotel_facilities to werehere_preview_api_runtime' >/dev/null
assert_readiness SCHEMA_NOT_READY
run_provision CONTRACT >/dev/null
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'grant select on public.hotel_facilities to werehere_preview_reconciler' >/dev/null
RECONCILER_FACILITY_DAMAGE="$(readiness_status "$RECONCILER_URL" RECONCILER)"
if [[ "$RECONCILER_FACILITY_DAMAGE" != "SCHEMA_NOT_READY" ]]; then
  printf 'Reconciler facility table ACL damage was %s, expected SCHEMA_NOT_READY.\n' \
    "$RECONCILER_FACILITY_DAMAGE" >&2
  exit 1
fi
run_provision CONTRACT >/dev/null
RECONCILER_FACILITY_RESTORED="$(readiness_status "$RECONCILER_URL" RECONCILER)"
if [[ "$RECONCILER_FACILITY_RESTORED" != "READY" ]]; then
  printf 'Reconciler facility table ACL restore was %s, expected READY.\n' \
    "$RECONCILER_FACILITY_RESTORED" >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create role preview_stale_function_grantee nologin noinherit;
grant execute on function public.hotel_facility_reference_command_v1(
  uuid, uuid, text, text, uuid, integer, jsonb, text,
  uuid, uuid, uuid, text, text, text, text, text, uuid
) to preview_stale_function_grantee with grant option;
SQL
assert_readiness SCHEMA_NOT_READY
run_provision CONTRACT >/dev/null
assert_readiness READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'drop role preview_stale_function_grantee' >/dev/null

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.hotel_facilities
  drop constraint hotel_facilities_location_exactly_one_check;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.hotel_facilities
  add constraint hotel_facilities_location_exactly_one_check check (
    (location_type = 'ROOM' and room_id is not null and common_area_id is null)
    or (location_type = 'COMMON_AREA' and room_id is null and common_area_id is not null)
  );
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.hotel_facilities
  add constraint hotel_facilities_unexpected_ready_damage check (version > 0);
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'alter table public.hotel_facilities drop constraint hotel_facilities_unexpected_ready_damage' >/dev/null
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'alter table public.hotel_facilities add column unexpected_ready_damage text' >/dev/null
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'alter table public.hotel_facilities drop column unexpected_ready_damage' >/dev/null
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'drop index public.hotel_facilities_room_name_key' >/dev/null
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create unique index hotel_facilities_room_name_key
  on public.hotel_facilities(
    company_id, branch_id, facility_type_id, room_id, normalized_name
  ) where location_type = 'ROOM';
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'create index hotel_facilities_unexpected_ready_damage on public.hotel_facilities(updated_at)' >/dev/null
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'drop index public.hotel_facilities_unexpected_ready_damage' >/dev/null
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'drop trigger hotel_facilities_lifecycle on public.hotel_facilities' >/dev/null
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create trigger hotel_facilities_lifecycle
  before update on public.hotel_facilities
  for each row execute function public.enforce_hotel_facility_reference_lifecycle();
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create trigger hotel_facilities_unexpected_ready_damage
  before insert on public.hotel_facilities
  for each row execute function public.reject_hotel_facility_reference_delete();
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'drop trigger hotel_facilities_unexpected_ready_damage on public.hotel_facilities' >/dev/null
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'drop trigger hotel_rooms_facility_location_guard on public.hotel_rooms' >/dev/null
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create trigger hotel_rooms_facility_location_guard
  before update of status on public.hotel_rooms
  for each row execute function public.enforce_hotel_room_facility_location_lifecycle();
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'drop policy hotel_facilities_company_isolation on public.hotel_facilities' >/dev/null
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create policy hotel_facilities_company_isolation on public.hotel_facilities
using (
  case
    when public.runtime_is_schema_owner() then true
    when current_user = 'werehere_auth_session_definer' then true
    when current_user = 'werehere_tenant_authority_definer' then true
    when public.runtime_has_capability('API_RUNTIME')
      then company_id = public.api_current_company_id()
    when public.runtime_has_capability('RECONCILER')
      then company_id = public.reconciler_current_company_id()
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
    else false
  end
);
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c "delete from public.schema_migrations where version='0036_hotel_facility_master_data'" >/dev/null
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c "insert into public.schema_migrations(version) values('0036_hotel_facility_master_data')" >/dev/null
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'grant usage on schema public to public' >/dev/null
# Contract-compatible identity-lock staging intentionally uses the exact
# EXPAND schema ACL with the identity-lock column ACL.
assert_readiness READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'revoke usage on schema public from public' >/dev/null
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
do $damage_expand_columns$
declare
  role_record record;
begin
  for role_record in
    select role_name from public.runtime_database_capabilities
    where capability = 'API_RUNTIME'
  loop
    execute format(
      'revoke update (updated_at) on public.auth_identities from %I',
      role_record.role_name
    );
    execute format(
      'revoke update (version) on public.hotel_profiles from %I',
      role_record.role_name
    );
    execute format(
      'revoke update (end_date, terminated_at, termination_reason, terminated_by, version, updated_at) on public.hotel_staff_assignments, public.housekeeping_hotel_links, public.hotel_owner_assignments from %I',
      role_record.role_name
    );
  end loop;
end
$damage_expand_columns$;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
do $restore_contract_columns$
declare
  role_record record;
begin
  for role_record in
    select role_name from public.runtime_database_capabilities
    where capability = 'API_RUNTIME'
  loop
    execute format(
      'grant update (updated_at) on public.auth_identities to %I',
      role_record.role_name
    );
    execute format(
      'grant update (version) on public.hotel_profiles to %I',
      role_record.role_name
    );
    execute format(
      'grant update (end_date, terminated_at, termination_reason, terminated_by, version, updated_at) on public.hotel_staff_assignments, public.housekeeping_hotel_links, public.hotel_owner_assignments to %I',
      role_record.role_name
    );
  end loop;
end
$restore_contract_columns$;
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
delete from public.schema_migrations
where version in (
  '0010_global_login_id_contract',
  '0012_account_provider_exact_dispatch_contract',
  '0015_neon_definer_contract_hardening'
);
SQL
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -f "$ROOT_DIR/packages/db/migrations/0014_neon_definer_expand_compatibility.sql" >/dev/null
# Contract-only physical changes remain, so marker rollback alone must fail closed.
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
insert into public.schema_migrations(version)
values ('0012_account_provider_exact_dispatch_contract');
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -f "$ROOT_DIR/packages/db/migrations/0015_neon_definer_contract_hardening.sql" >/dev/null
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
insert into public.schema_migrations(version)
values ('0010_global_login_id_contract');
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
delete from pg_auth_members membership
using pg_roles definer_role, pg_roles member_role, pg_roles grantor_role
where definer_role.oid = membership.roleid
  and member_role.oid = membership.member
  and grantor_role.oid = membership.grantor
  and definer_role.rolname = 'werehere_tenant_authority_definer'
  and member_role.rolname = '$MIGRATION_OWNER'
  and grantor_role.rolname = 'cloud_admin';
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
grant werehere_tenant_authority_definer to $MIGRATION_OWNER
  with admin true, inherit false, set false;
update pg_auth_members membership
set grantor = (select oid from pg_roles where rolname = 'cloud_admin')
from pg_roles definer_role, pg_roles member_role
where definer_role.oid = membership.roleid
  and member_role.oid = membership.member
  and definer_role.rolname = 'werehere_tenant_authority_definer'
  and member_role.rolname = '$MIGRATION_OWNER';
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create sequence public.preview_runtime_owned_damage_sequence;
alter sequence public.preview_runtime_owned_damage_sequence
  owner to werehere_preview_api_runtime;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter sequence public.preview_runtime_owned_damage_sequence
  owner to werehere_preview_migration_owner;
drop sequence public.preview_runtime_owned_damage_sequence;
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
revoke execute on function public.auth_create_session_v2(uuid, bytea, text, integer, integer, timestamptz, uuid)
  from werehere_preview_api_runtime;
grant execute on function public.auth_create_session_v2(uuid, bytea, text, integer, integer, timestamptz, uuid)
  to public;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
revoke execute on function public.auth_create_session_v2(uuid, bytea, text, integer, integer, timestamptz, uuid)
  from public;
grant execute on function public.auth_create_session_v2(uuid, bytea, text, integer, integer, timestamptz, uuid)
  to werehere_preview_api_runtime;
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create role preview_stale_acl_grantee nologin noinherit;
grant usage, create on schema public to preview_stale_acl_grantee;
create sequence public.preview_stale_acl_sequence;
grant usage, update on sequence public.preview_stale_acl_sequence
  to preview_stale_acl_grantee;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
revoke all on sequence public.preview_stale_acl_sequence
  from preview_stale_acl_grantee;
drop sequence public.preview_stale_acl_sequence;
revoke all on schema public from preview_stale_acl_grantee;
drop role preview_stale_acl_grantee;
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create role preview_stale_table_acl_grantee nologin noinherit;
grant update on table public.users to preview_stale_table_acl_grantee;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
revoke all privileges on table public.users from preview_stale_table_acl_grantee;
drop role preview_stale_table_acl_grantee;
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'grant create on schema public to werehere_preview_api_runtime' >/dev/null
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'revoke create on schema public from werehere_preview_api_runtime' >/dev/null
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create sequence public.preview_runtime_acl_damage_seq;
grant usage on sequence public.preview_runtime_acl_damage_seq
  to werehere_preview_api_runtime;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
revoke all on sequence public.preview_runtime_acl_damage_seq
  from werehere_preview_api_runtime;
drop sequence public.preview_runtime_acl_damage_seq;
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
grant execute on function public.reconciliation_company_ids()
  to werehere_preview_reconciler with grant option;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
revoke grant option for execute on function public.reconciliation_company_ids()
  from werehere_preview_reconciler cascade;
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create role preview_stale_function_grantee nologin noinherit;
grant execute on function public.reconciliation_company_ids()
  to preview_stale_function_grantee;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
revoke execute on function public.reconciliation_company_ids()
  from preview_stale_function_grantee;
drop role preview_stale_function_grantee;
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
insert into public.runtime_database_capabilities (role_name, capability)
values ('preview_stale_capability', 'API_RUNTIME');
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
delete from public.runtime_database_capabilities
where role_name = 'preview_stale_capability';
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
drop index public.users_login_name_unique_idx;
create unique index users_login_name_unique_idx
  on public.users (company_id, lower(btrim(login_name)))
  where false;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
drop index public.users_login_name_unique_idx;
create unique index users_login_name_unique_idx
  on public.users (company_id, lower(btrim(login_name)))
  where login_name is not null;
SQL
assert_readiness READY

LEGACY_AUTH_FUNCTION="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select to_regprocedure(
  'public.auth_create_session(uuid,bytea,text,integer,integer,timestamptz,uuid)'
) is null;
SQL
)"
if [[ "$LEGACY_AUTH_FUNCTION" != 't' ]]; then
  printf '%s\n' 'Contract retained the legacy auth_create_session function.' >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'grant delete on public.users to werehere_preview_api_runtime' >/dev/null
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c 'revoke delete on public.users from werehere_preview_api_runtime' >/dev/null
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
grant execute on function public.auth_create_session_v2(
  uuid, bytea, text, integer, integer, timestamptz, uuid
) to werehere_preview_api_runtime with grant option;
SQL
assert_readiness SCHEMA_NOT_READY
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
revoke grant option for execute on function public.auth_create_session_v2(
  uuid, bytea, text, integer, integer, timestamptz, uuid
) from werehere_preview_api_runtime cascade;
SQL
assert_readiness READY

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
alter table public.auth_identities
  drop constraint auth_identities_provider_provider_subject_key;
insert into public.auth_identities (
  id, company_id, user_id, provider, provider_subject
) values (
  '72000000-0000-4000-8000-000000000099',
  '$COMPANY_ID',
  '71000000-0000-4000-8000-000000000001',
  'ZITADEL',
  '$SUBJECT'
);
SQL
assert_readiness SCHEMA_NOT_READY
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$API_RUNTIME_URL" TEST_PROVIDER_SUBJECT="$SUBJECT" \
    pnpm --filter @werehere/db exec tsx <<'NODE'
import postgres from "postgres";
import { createPostgresAuthRepository } from "./src/auth.ts";
const databaseUrl = process.env.TEST_READY_URL;
const providerSubject = process.env.TEST_PROVIDER_SUBJECT;
if (!databaseUrl || !providerSubject) throw new Error("Cardinality probe configuration is missing");
const repository = createPostgresAuthRepository(databaseUrl);
try {
  await repository.createSession({
    absoluteLifetimeSeconds: 86400,
    authTime: new Date(),
    idleLifetimeSeconds: 28800,
    providerSubject,
    sessionId: crypto.randomUUID(),
    tokenHash: crypto.getRandomValues(new Uint8Array(32)),
    traceId: crypto.randomUUID(),
  });
  throw new Error("Duplicate provider subjects unexpectedly created a session");
} catch (error) {
  if (!(error instanceof postgres.PostgresError) || error.code !== "21000") throw error;
} finally {
  await repository.close?.();
}
NODE
)
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
delete from public.auth_identities
where id = '72000000-0000-4000-8000-000000000099';
alter table public.auth_identities
  add constraint auth_identities_provider_provider_subject_key
  unique (provider, provider_subject);
SQL
assert_readiness READY

PRIVILEGES="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$API_RUNTIME_URL" <<'SQL'
select has_function_privilege(
  current_user,
  'public.auth_create_session_v2(uuid,bytea,text,integer,integer,timestamptz,uuid)',
  'EXECUTE'
);
select has_function_privilege(
  current_user,
  'public.auth_revoke_user_sessions_v1(uuid,uuid,text)',
  'EXECUTE'
);
select has_table_privilege(current_user, 'public.auth_sessions', 'SELECT');
select has_table_privilege(current_user, 'public.auth_sessions', 'INSERT');
select has_table_privilege(current_user, 'public.auth_sessions', 'UPDATE');
select has_table_privilege(current_user, 'public.auth_identities', 'UPDATE');
select has_table_privilege(current_user, 'public.users', 'UPDATE');
select has_table_privilege(current_user, 'public.companies', 'UPDATE');
SQL
)"
if [[ "$PRIVILEGES" != $'t\nt\nt\nf\nf\nf\nt\nf' ]]; then
  printf '%s\n' 'Runtime auth function privilege boundary is unsafe.' >&2
  exit 1
fi
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$API_RUNTIME_URL" pnpm --filter @werehere/db exec tsx <<'NODE'
import postgres from "postgres";
const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("Preview runtime test configuration is missing");
const sql = postgres(databaseUrl, { max: 1 });
try {
  await sql`insert into auth_sessions default values`;
  throw new Error("Runtime role unexpectedly inserted an auth session directly");
} catch (error) {
  if (!(error instanceof postgres.PostgresError) || error.code !== "42501") throw error;
} finally {
  await sql.end();
}
NODE
)
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$API_RUNTIME_URL" TEST_PROVIDER_SUBJECT="$SUBJECT" pnpm exec tsx <<'NODE'
import { createPostgresAuthRepository } from "./packages/db/src/auth.ts";
const databaseUrl = process.env.TEST_READY_URL;
const providerSubject = process.env.TEST_PROVIDER_SUBJECT;
if (!databaseUrl || !providerSubject) throw new Error("Preview runtime test configuration is missing");
const repository = createPostgresAuthRepository(databaseUrl);
const sessionId = crypto.randomUUID();
const traceId = crypto.randomUUID();
try {
  const result = await repository.createSession({
    absoluteLifetimeSeconds: 86400,
    authTime: new Date(),
    idleLifetimeSeconds: 28800,
    providerSubject,
    sessionId,
    tokenHash: crypto.getRandomValues(new Uint8Array(32)),
    traceId,
  });
  if (result.status !== "CREATED" || result.principal.sessionId !== sessionId) {
    const sessionMatches = result.status === "CREATED"
      ? result.principal.sessionId === sessionId
      : false;
    throw new Error(
      `Runtime auth session function returned status=${result.status} sessionMatches=${sessionMatches}`,
    );
  }
} finally {
  await repository.close?.();
}
console.log(`${sessionId} ${traceId}`);
NODE
) >"$TMP_DIR/session-id"
read -r SESSION_ID TRACE_ID <"$TMP_DIR/session-id"
if [[ ! "$SESSION_ID" =~ ^[0-9a-f-]{36}$ || ! "$TRACE_ID" =~ ^[0-9a-f-]{36}$ ]]; then
  printf '%s\n' 'Runtime auth session integration did not return a session identifier.' >&2
  exit 1
fi
SESSION_AUDIT="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select count(*) from auth_sessions where id = '$SESSION_ID'::uuid;
select count(*) from audit_events
where event_code = 'AUTH_LOGIN_SUCCEEDED'
  and session_id = '$SESSION_ID'::uuid
  and trace_id = '$TRACE_ID'::uuid
  and result = 'SUCCEEDED';
SQL
)"
if [[ "$SESSION_AUDIT" != $'1\n1' ]]; then
  printf '%s\n' 'Runtime auth session and audit read-back was not atomic.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
create function public.preview_reject_auth_login_audit()
returns trigger
language plpgsql
as $function$
begin
  if new.event_code = 'AUTH_LOGIN_SUCCEEDED' then
    raise exception 'preview audit failure probe' using errcode = 'P0001';
  end if;
  return new;
end
$function$;
create trigger preview_reject_auth_login_audit
before insert on audit_events
for each row execute function public.preview_reject_auth_login_audit();
SQL
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$API_RUNTIME_URL" TEST_PROVIDER_SUBJECT="$SUBJECT" pnpm --filter @werehere/db exec tsx <<'NODE'
import postgres from "postgres";
import { createPostgresAuthRepository } from "./src/auth.ts";
const databaseUrl = process.env.TEST_READY_URL;
const providerSubject = process.env.TEST_PROVIDER_SUBJECT;
if (!databaseUrl || !providerSubject) throw new Error("Preview runtime test configuration is missing");
const repository = createPostgresAuthRepository(databaseUrl);
const sessionId = crypto.randomUUID();
const traceId = crypto.randomUUID();
try {
  await repository.createSession({
    absoluteLifetimeSeconds: 86400,
    authTime: new Date(),
    idleLifetimeSeconds: 28800,
    providerSubject,
    sessionId,
    tokenHash: crypto.getRandomValues(new Uint8Array(32)),
    traceId,
  });
  throw new Error("Audit failure unexpectedly created an auth session");
} catch (error) {
  if (!(error instanceof postgres.PostgresError) || error.code !== "P0001") throw error;
} finally {
  await repository.close?.();
}
console.log(`${sessionId} ${traceId}`);
NODE
) >"$TMP_DIR/failed-session-id"
read -r FAILED_SESSION_ID FAILED_TRACE_ID <"$TMP_DIR/failed-session-id"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
drop trigger preview_reject_auth_login_audit on audit_events;
drop function public.preview_reject_auth_login_audit();
SQL
FAILED_SESSION_AUDIT="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select count(*) from auth_sessions where id = '$FAILED_SESSION_ID'::uuid;
select count(*) from audit_events
where session_id = '$FAILED_SESSION_ID'::uuid
   or trace_id = '$FAILED_TRACE_ID'::uuid;
SQL
)"
if [[ "$FAILED_SESSION_AUDIT" != $'0\n0' ]]; then
  printf '%s\n' 'Audit failure did not roll back the auth session transaction.' >&2
  exit 1
fi
VISIBLE="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$API_RUNTIME_URL" <<SQL
begin;
select set_config('app.session_id', '$SESSION_ID', true);
select count(*) from companies where id = '$COMPANY_ID';
select count(*) from branches where company_id = '7f000000-0000-4000-8000-000000000001';
rollback;
SQL
)"
EXPECTED_VISIBLE="${SESSION_ID}"$'\n1\n0'
if [[ "$VISIBLE" != "$EXPECTED_VISIBLE" ]]; then
  printf '%s\n' 'API runtime role crossed or lost the session-derived tenant RLS boundary.' >&2
  exit 1
fi

if psql -X -q -v ON_ERROR_STOP=1 -d "$API_RUNTIME_URL" >/dev/null 2>&1 <<SQL
begin;
select set_config('app.session_id', '$SESSION_ID', true);
select public.auth_revoke_user_sessions_v1(
  '7f000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  'ACCOUNT_DEACTIVATED'
);
commit;
SQL
then
  printf '%s\n' 'API runtime user-session revocation crossed the tenant boundary.' >&2
  exit 1
fi

REVOKED="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$API_RUNTIME_URL" <<SQL
begin;
select set_config('app.session_id', '$SESSION_ID', true);
select public.auth_revoke_user_sessions_v1(
  '$COMPANY_ID',
  '71000000-0000-4000-8000-000000000001',
  'INITIAL_PASSWORD_CHANGED'
);
commit;
SQL
)"
if [[ "$REVOKED" != "${SESSION_ID}"$'\n1' ]]; then
  printf '%s\n' 'API runtime user-session revocation did not revoke the expected session.' >&2
  exit 1
fi
REVOKE_READ_BACK="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select count(*) from auth_sessions
where id = '$SESSION_ID'::uuid
  and revoked_at is not null
  and revoke_reason = 'INITIAL_PASSWORD_CHANGED';
SQL
)"
if [[ "$REVOKE_READ_BACK" != '1' ]]; then
  printf '%s\n' 'API runtime user-session revocation read-back failed.' >&2
  exit 1
fi

API_CAPABILITIES="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$API_RUNTIME_URL" <<'SQL'
select has_function_privilege(current_user, 'public.reconciliation_company_ids()', 'EXECUTE');
select has_table_privilege(current_user, 'public.reconciliation_company_registry', 'SELECT');
SQL
)"
if [[ "$API_CAPABILITIES" != $'f\nf' ]]; then
  printf '%s\n' 'API runtime role can discover reconciliation tenants.' >&2
  exit 1
fi

RECONCILER_CAPABILITIES="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$RECONCILER_URL" <<'SQL'
select has_function_privilege(current_user, 'public.reconciliation_company_ids()', 'EXECUTE');
select has_function_privilege(current_user, 'public.auth_revoke_user_sessions_v1(uuid,uuid,text)', 'EXECUTE');
select has_table_privilege(current_user, 'public.reconciliation_company_registry', 'SELECT');
select has_table_privilege(current_user, 'public.idempotency_records', 'INSERT');
select count(*) from public.reconciliation_company_ids();
SQL
)"
if [[ "$RECONCILER_CAPABILITIES" != $'t\nf\nf\nf\n2' ]]; then
  printf '%s\n' 'Reconciler capability boundary is incorrect.' >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
update runtime_database_capabilities
set capability = 'RECONCILER'
where role_name = 'werehere_preview_api_runtime';
SQL
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$API_RUNTIME_URL" pnpm --filter @werehere/db exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./src/client.ts";
const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("Preview runtime test configuration is missing");
const result = await probeDatabaseReadiness(databaseUrl, { capability: "API_RUNTIME" });
if (result.status !== "SCHEMA_NOT_READY") {
  throw new Error(`Capability registry drift was accepted: ${result.status}`);
}
NODE
)
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
update runtime_database_capabilities
set capability = 'API_RUNTIME'
where role_name = 'werehere_preview_api_runtime';
SQL

ROTATED_BOOTSTRAP_LOGIN_ID="previewadmin2"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
drop table public.preview_bootstrap_session_revocations;
drop table public.preview_bootstrap_operations;
drop index public.login_id_registry_company_target_history_idx;
alter table public.login_id_registry
  add constraint login_id_registry_company_id_target_user_id_key
  unique (company_id, target_user_id);
delete from public.schema_migrations
where version in (
  '0023_login_id_registry_history_contract',
  '0024_preview_bootstrap_session_revocations'
);
SQL
BOOTSTRAP_AUDIT_BEFORE="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select count(*) from audit_events
where event_code = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED'
  and company_id = '$COMPANY_ID';
SQL
)"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
insert into public.auth_sessions (
  id, company_id, user_id, identity_id, token_hash,
  idle_expires_at, absolute_expires_at, auth_time, authentication_method
)
select
  '71900000-0000-4000-8000-000000000003', '$COMPANY_ID', app_user.id,
  identity.id, decode(repeat('ad', 32), 'hex'),
  now() + interval '1 hour', now() + interval '2 hours', now(), 'OIDC_PKCE'
from public.users app_user
join public.auth_identities identity
  on identity.company_id = app_user.company_id and identity.user_id = app_user.id
where app_user.id = '71000000-0000-4000-8000-000000000001'
  and identity.provider = 'ZITADEL';
SQL
run_provision EXPAND "$ROTATED_BOOTSTRAP_LOGIN_ID" >/dev/null
BOOTSTRAP_PRE_ROTATION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select count(*) from users
where id = '71000000-0000-4000-8000-000000000001'
  and company_id = '$COMPANY_ID'
  and login_name = 'previewadmin';
select count(*) from login_id_registry
where login_id = '$ROTATED_BOOTSTRAP_LOGIN_ID';
select count(*) from auth_sessions
where id = '71900000-0000-4000-8000-000000000003'
  and revoked_at is null;
select count(*) from schema_migrations
where version = '0023_login_id_registry_history_contract';
SQL
)"
if [[ "$BOOTSTRAP_PRE_ROTATION_RESULT" != $'1\n0\n1\n0' ]]; then
  printf '%s\n' 'Initial EXPAND mutated the protected bootstrap login ID.' >&2
  exit 1
fi
run_provision EXPAND_IDENTITY_LOCK "$ROTATED_BOOTSTRAP_LOGIN_ID" >/dev/null
BOOTSTRAP_ROTATION_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select count(*) from users
where id = '71000000-0000-4000-8000-000000000001'
  and company_id = '$COMPANY_ID'
  and login_name = '$ROTATED_BOOTSTRAP_LOGIN_ID';
select count(*) from login_id_registry
where login_id = '$ROTATED_BOOTSTRAP_LOGIN_ID'
  and company_id = '$COMPANY_ID'
  and target_user_id = '71000000-0000-4000-8000-000000000001';
select count(*) from login_id_registry
where login_id = 'previewadmin'
  and company_id = '$COMPANY_ID'
  and target_user_id = '71000000-0000-4000-8000-000000000001';
select count(*) from auth_resolve_login_identity_v1('$ROTATED_BOOTSTRAP_LOGIN_ID')
where provider_subject = '$SUBJECT';
select count(*) from auth_resolve_login_identity_v1('previewadmin');
select count(*) from auth_sessions
where id = '71900000-0000-4000-8000-000000000003'
  and revoked_at is not null
  and revoke_reason = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED';
SQL
)"
if [[ "$BOOTSTRAP_ROTATION_RESULT" != $'1\n1\n1\n1\n0\n1' ]]; then
  printf '%s\n' 'Protected bootstrap login ID rotation contract failed.' >&2
  exit 1
fi
PASSWORD_RESET_OPERATION_RESULT="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
insert into public.preview_bootstrap_operations (
  operation_key, operation_type, subject_fingerprint,
  request_fingerprint, status
) values (
  'ci-password-reset-approval', 'PASSWORD_RESET_EMAIL', repeat('a', 64),
  repeat('b', 64), 'REQUESTING'
);
update public.preview_bootstrap_operations
set status = 'REQUESTED', updated_at = pg_catalog.statement_timestamp()
where operation_key = 'ci-password-reset-approval'
  and status = 'REQUESTING';
insert into public.preview_bootstrap_operations (
  operation_key, operation_type, subject_fingerprint,
  request_fingerprint, status
) values (
  'ci-password-reset-approval', 'PASSWORD_RESET_EMAIL', repeat('a', 64),
  repeat('b', 64), 'REQUESTING'
)
on conflict (operation_key) do nothing;
select count(*) || ':' || min(status)
from public.preview_bootstrap_operations
where operation_key = 'ci-password-reset-approval';
SQL
)"
if [[ "$PASSWORD_RESET_OPERATION_RESULT" != '1:REQUESTED' ]]; then
  printf '%s\n' 'Durable password reset replay contract failed.' >&2
  exit 1
fi
assert_password_reset_schema_not_ready() {
  (
    cd "$ROOT_DIR"
    TEST_READY_URL="$API_RUNTIME_URL" pnpm --filter @werehere/db exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./src/client.ts";
const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("Preview runtime test configuration is missing");
const result = await probeDatabaseReadiness(databaseUrl, {
  capability: "API_RUNTIME",
  requiredLoginIdHistoryPhase: "CONTRACT",
  requiredRoomSchemaPhase: "CONTRACT",
  requiredSchemaPhase: "CONTRACT",
});
if (result.status !== "SCHEMA_NOT_READY") {
  throw new Error(`Damaged password reset schema was accepted: ${result.status}`);
}
NODE
  ) >/dev/null
}

for constraint in \
  preview_bootstrap_operations_pkey \
  preview_bootstrap_operations_operation_key_check \
  preview_bootstrap_operations_operation_type_check \
  preview_bootstrap_operations_subject_fingerprint_check \
  preview_bootstrap_operations_request_fingerprint_check \
  preview_bootstrap_operations_status_check
do
  psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
alter table public.preview_bootstrap_operations drop constraint $constraint;
SQL
  assert_password_reset_schema_not_ready
  case "$constraint" in
    preview_bootstrap_operations_pkey)
      definition='primary key (operation_key)'
      ;;
    preview_bootstrap_operations_operation_key_check)
      definition="check (pg_catalog.btrim(operation_key) <> '')"
      ;;
    preview_bootstrap_operations_operation_type_check)
      definition="check (operation_type = 'PASSWORD_RESET_EMAIL')"
      ;;
    preview_bootstrap_operations_subject_fingerprint_check)
      definition="check (subject_fingerprint ~ '^[0-9a-f]{64}$')"
      ;;
    preview_bootstrap_operations_request_fingerprint_check)
      definition="check (request_fingerprint ~ '^[0-9a-f]{64}$')"
      ;;
    preview_bootstrap_operations_status_check)
      definition="check (status in ('REQUESTING', 'REQUESTED', 'INDETERMINATE'))"
      ;;
    *)
      exit 1
      ;;
  esac
  psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<SQL
alter table public.preview_bootstrap_operations
  add constraint $constraint $definition;
SQL
done

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.preview_bootstrap_operations
  rename column updated_at to damaged_updated_at;
SQL
assert_password_reset_schema_not_ready
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.preview_bootstrap_operations
  rename column damaged_updated_at to updated_at;
SQL

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.preview_bootstrap_operations
  alter column updated_at type timestamp without time zone
  using updated_at at time zone 'UTC';
SQL
assert_password_reset_schema_not_ready
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.preview_bootstrap_operations
  alter column updated_at type timestamptz
  using updated_at at time zone 'UTC';
SQL

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.preview_bootstrap_operations
  alter column updated_at drop not null;
SQL
assert_password_reset_schema_not_ready
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.preview_bootstrap_operations
  alter column updated_at set not null;
SQL

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.preview_bootstrap_operations
  alter column updated_at drop default;
SQL
assert_password_reset_schema_not_ready
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.preview_bootstrap_operations
  alter column updated_at set default pg_catalog.statement_timestamp();
SQL

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.preview_bootstrap_operations
  add column unexpected_column text;
SQL
assert_password_reset_schema_not_ready
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
alter table public.preview_bootstrap_operations drop column unexpected_column;
SQL

BOOTSTRAP_AUDIT_AFTER="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select count(*) from audit_events
where event_code = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED'
  and company_id = '$COMPANY_ID';
SQL
)"
if (( BOOTSTRAP_AUDIT_AFTER != BOOTSTRAP_AUDIT_BEFORE + 1 )); then
  printf '%s\n' 'Protected bootstrap login ID rotation audit failed.' >&2
  exit 1
fi
BOOTSTRAP_VERSION_AFTER="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select version from users
where id = '71000000-0000-4000-8000-000000000001'
  and login_name = '$ROTATED_BOOTSTRAP_LOGIN_ID';
SQL
)"
run_provision CONTRACT "$ROTATED_BOOTSTRAP_LOGIN_ID" >/dev/null
REVOCATION_LEDGER_SCHEMA_RESULT="$(psql -X -q -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select
  (select count(*) from information_schema.columns
   where table_schema = 'public'
     and table_name = 'preview_bootstrap_session_revocations') || ':' ||
  (select count(*) from pg_constraint
   where conrelid = 'public.preview_bootstrap_session_revocations'::regclass
     and contype <> 'n') || ':' ||
  (select count(*) from pg_class table_record
   cross join lateral aclexplode(
     coalesce(table_record.relacl, acldefault('r', table_record.relowner))
   ) acl
   where table_record.oid = 'public.preview_bootstrap_session_revocations'::regclass
     and acl.grantee = 0) || ':' ||
  (select count(*) from schema_migrations
   where version = '0024_preview_bootstrap_session_revocations');
SQL
)"
if [[ "$REVOCATION_LEDGER_SCHEMA_RESULT" != '13:14:0:1' ]]; then
  printf 'Preview bootstrap session revocation ledger schema contract failed: %s\n' \
    "$REVOCATION_LEDGER_SCHEMA_RESULT" >&2
  exit 1
fi
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$PREVIEW_URL" pnpm --filter @werehere/db exec tsx <<'NODE'
import postgres from "postgres";
import {
  assertPreviewBootstrapSessionRevocationLedgerReady,
} from "./scripts/revoke-preview-bootstrap-sessions.ts";
const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("Preview revocation ledger test URL is missing");
const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  await sql.begin(async (transaction) => {
    await assertPreviewBootstrapSessionRevocationLedgerReady(transaction);
  });
  const contender = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await contender.unsafe("set lock_timeout = '250ms'");
    for (const concurrentGrant of [
      "grant select, update, delete on public.preview_bootstrap_session_revocations to werehere_preview_runtime",
      "grant select (operation_key), update (status) on public.preview_bootstrap_session_revocations to werehere_preview_runtime with grant option",
    ]) {
      await sql.begin(async (transaction) => {
        await assertPreviewBootstrapSessionRevocationLedgerReady(transaction);
        let blocked = false;
        try {
          await contender.unsafe(concurrentGrant);
        } catch (error) {
          blocked =
            error !== null &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "55P03";
        }
        if (!blocked) throw new Error("Concurrent ledger grant was not blocked");
      });
    }
  } finally {
    await contender.end({ timeout: 2 });
  }
  const damageStatements = [
    "alter table public.preview_bootstrap_session_revocations drop constraint preview_bootstrap_session_revocations_pkey",
    "alter table public.preview_bootstrap_session_revocations drop constraint preview_bootstrap_session_revocations_source_reset_key",
    "alter table public.preview_bootstrap_session_revocations drop constraint preview_bootstrap_session_revocations_identity_fkey",
    "alter table public.preview_bootstrap_session_revocations drop constraint preview_bootstrap_session_revocations_completion_check",
    "alter table public.preview_bootstrap_session_revocations alter column updated_at drop default",
    "alter table public.preview_bootstrap_session_revocations alter column updated_at set default statement_timestamp() + interval '100 years'",
    "grant select on public.preview_bootstrap_session_revocations to public",
    "alter table public.preview_bootstrap_session_revocations drop constraint preview_bootstrap_session_revocations_completion_check, add constraint preview_bootstrap_session_revocations_completion_check check (((status = 'COMPLETED') = (completed_at is not null and provider_revoked_count is not null and application_revoked_count is not null)) or true)",
    "alter table public.preview_bootstrap_session_revocations drop constraint preview_bootstrap_session_revocations_source_reset_fkey, add constraint preview_bootstrap_session_revocations_source_reset_fkey foreign key (source_reset_operation_key) references public.preview_bootstrap_operations(operation_key) on delete cascade",
    "alter table public.preview_bootstrap_session_revocations drop constraint preview_bootstrap_session_revocations_status_check, add constraint preview_bootstrap_session_revocations_status_check check (status in ('requesting', 'completed', 'indeterminate'))",
    "alter table public.preview_bootstrap_session_revocations drop constraint preview_bootstrap_session_revocations_user_fkey, add constraint preview_bootstrap_session_revocations_user_fkey foreign key (company_id, user_id) references public.users(company_id, id) not valid",
    "grant select, update on public.preview_bootstrap_session_revocations to werehere_preview_runtime with grant option",
    "grant select (operation_key), update (status) on public.preview_bootstrap_session_revocations to werehere_preview_runtime with grant option",
    "alter table public.preview_bootstrap_session_revocations enable row level security",
  ];
  for (const damageStatement of damageStatements) {
    let rejected = false;
    try {
      await sql.begin(async (transaction) => {
        await transaction.unsafe(damageStatement);
        await assertPreviewBootstrapSessionRevocationLedgerReady(transaction);
      });
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("Damaged revocation ledger was accepted");
  }
  await sql.begin(async (transaction) => {
    await assertPreviewBootstrapSessionRevocationLedgerReady(transaction);
  });
} finally {
  await sql.end({ timeout: 2 });
}
NODE
) >/dev/null
BOOTSTRAP_REPLAY_RESULT="$(psql -X -v ON_ERROR_STOP=1 -At -d "$ADMIN_PREVIEW_URL" <<SQL
select version from users
where id = '71000000-0000-4000-8000-000000000001'
  and login_name = '$ROTATED_BOOTSTRAP_LOGIN_ID';
select count(*) from audit_events
where event_code = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED'
  and company_id = '$COMPANY_ID';
SQL
)"
if [[ "$BOOTSTRAP_REPLAY_RESULT" != "$BOOTSTRAP_VERSION_AFTER"$'\n'"$BOOTSTRAP_AUDIT_AFTER" ]]; then
  printf '%s\n' 'Protected bootstrap login ID rotation was not idempotent.' >&2
  exit 1
fi
BOOTSTRAP_LOGIN_ID="$ROTATED_BOOTSTRAP_LOGIN_ID"

psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c "delete from schema_migrations where version = '0022_hotel_room_contract_hardening'" \
  >/dev/null
set +e
PARTIAL_ROOM_EXPAND_LOG="$(run_provision EXPAND 2>&1)"
PARTIAL_ROOM_EXPAND_STATUS=$?
set -e
if [[ "$PARTIAL_ROOM_EXPAND_STATUS" -eq 0 ]] ||
  ! grep -Fq 'Preview API runtime readiness failed in EXPAND: SCHEMA_NOT_READY' \
    <<<"$PARTIAL_ROOM_EXPAND_LOG"; then
  printf '%s\n' 'Irreversible room CONTRACT marker loss did not fail safely.' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" \
  -c "insert into schema_migrations (version) values ('0022_hotel_room_contract_hardening')" \
  >/dev/null
run_provision CONTRACT >/dev/null
API_RUNTIME_URL="$(<"$API_RUNTIME_URL_FILE")"
RECONCILER_URL="$(<"$RECONCILER_URL_FILE")"
psql -X -v ON_ERROR_STOP=1 -d "$ADMIN_PREVIEW_URL" >/dev/null <<'SQL'
delete from schema_migrations where version in (
  '0008_remove_legacy_company_id_fallback',
  '0010_global_login_id_contract',
  '0012_account_provider_exact_dispatch_contract',
  '0015_neon_definer_contract_hardening'
);
SQL
(
  cd "$ROOT_DIR"
  TEST_READY_URL="$API_RUNTIME_URL" pnpm --filter @werehere/db exec tsx <<'NODE'
import { probeDatabaseReadiness } from "./src/client.ts";
const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("Preview runtime test configuration is missing");
const result = await probeDatabaseReadiness(databaseUrl, { capability: "API_RUNTIME" });
if (result.status !== "SCHEMA_NOT_READY") {
  throw new Error(`Base EXPAND with room CONTRACT was accepted: ${result.status}`);
}
NODE
)

for runtime_url in "$API_RUNTIME_URL" "$RECONCILER_URL"; do
  if psql -X -v ON_ERROR_STOP=1 -d "$runtime_url" -c 'set role postgres' >/dev/null 2>&1; then
    printf '%s\n' 'Runtime role unexpectedly assumed the owner role.' >&2
    exit 1
  fi
done

printf '%s\n' 'PREVIEW_PROVISIONING_INTEGRATION_OK'
