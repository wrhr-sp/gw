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

cleanup() {
  if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
    psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" >/dev/null <<'SQL' || true
drop database if exists werehere_preview_ci with (force);
drop database if exists werehere_production_ci with (force);
drop role if exists werehere_preview_runtime;
drop role if exists werehere_preview_api_runtime;
drop role if exists werehere_preview_reconciler;
drop role if exists werehere_preview_migration_owner;
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
drop role if exists werehere_preview_migration_owner;
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
  (
    cd "$ROOT_DIR"
    CI=true \
      PREVIEW_PROVISION_LOCAL_CI_TEST=1 \
      PREVIEW_PROVISION_PHASE="$phase" \
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
select (
  has_schema_privilege('werehere_preview_runtime', 'public', 'USAGE')
  and has_table_privilege('werehere_preview_runtime', 'public.branches', 'SELECT')
  and has_function_privilege('werehere_preview_runtime', 'public.runtime_has_capability(text)', 'EXECUTE')
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
if [[ "$EXPAND_RESULT" != $'0\n1' ]]; then
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
  and permission_code in ('HOTEL_MANAGE', 'USER_READ', 'USER_CREATE', 'USER_SUSPEND')
  and effect = 'ALLOW' and valid_until is null;
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
if [[ "$ALIGNED_BOOTSTRAP_RESULT" != $'previewadmin:2\n1\n4\n1\n1\n1\n0' ]]; then
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

run_provision CONTRACT >/dev/null
TEMPORARY_DEFINER_PRIVILEGES="$(psql -X -At -d "$ADMIN_PREVIEW_URL" <<'SQL'
select
  (select count(*)
   from pg_auth_members membership
   join pg_roles granted_role on granted_role.oid = membership.roleid
   where granted_role.rolname in (
     'werehere_auth_session_definer',
     'werehere_tenant_authority_definer'
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

for runtime_url in "$API_RUNTIME_URL" "$RECONCILER_URL"; do
  if psql -X -v ON_ERROR_STOP=1 -d "$runtime_url" -c 'set role postgres' >/dev/null 2>&1; then
    printf '%s\n' 'Runtime role unexpectedly assumed the owner role.' >&2
    exit 1
  fi
done

printf '%s\n' 'PREVIEW_PROVISIONING_INTEGRATION_OK'
