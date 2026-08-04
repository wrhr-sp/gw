#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  printf 'TEST_DATABASE_URL is required for Worker runtime smoke.\n' >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PORT="${WORKER_SMOKE_PORT:-8791}"
TMP_DIR="$(mktemp -d /tmp/werehere-worker-smoke.XXXXXX)"
LOG_FILE="$TMP_DIR/wrangler.log"
WORKER_PID=""
SESSION_TOKEN="${WORKER_SMOKE_SESSION_TOKEN:-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB}"
RUNTIME_ROLE="werehere_worker_runtime_test"
RUNTIME_PASSWORD="worker-runtime-test-only"
RECONCILER_ROLE="werehere_worker_reconciler_test"
RECONCILER_PASSWORD="worker-reconciler-test-only"
RUNTIME_DATABASE_URL=""
WORKER_CONFIG="$TMP_DIR/wrangler.worker-smoke.json"

DATABASE_NAME="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" -c "select current_database()")"
if [[ ! "$DATABASE_NAME" =~ (_test|_ci)($|_) ]]; then
  printf 'Refusing Worker mutation smoke: database name is not test/CI scoped.\n' >&2
  exit 1
fi

cleanup() {
  local status="$?"
  if [[ "$status" -ne 0 ]]; then
    sleep 0.25
  fi
  if [[ -n "$WORKER_PID" ]]; then
    kill "$WORKER_PID" >/dev/null 2>&1 || true
    wait "$WORKER_PID" >/dev/null 2>&1 || true
  fi
  psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" >/dev/null 2>&1 \
    -c "delete from hotel_file_finalizer_capabilities where role_name in ('$RUNTIME_ROLE', '$RECONCILER_ROLE'); delete from runtime_database_capabilities where role_name in ('$RUNTIME_ROLE', '$RECONCILER_ROLE'); drop owned by $RUNTIME_ROLE, $RECONCILER_ROLE; drop role $RUNTIME_ROLE, $RECONCILER_ROLE" || true
  if [[ "$status" -ne 0 && -f "$LOG_FILE" ]]; then
    python - "$LOG_FILE" "$TEST_DATABASE_URL" "$RUNTIME_DATABASE_URL" <<'PY'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
for secret in sys.argv[2:]:
    if secret:
        text = text.replace(secret, "[REDACTED]")
print("\n".join(text.splitlines()[-120:]), file=sys.stderr)
PY
  fi
  rm -rf "$TMP_DIR"
  return "$status"
}
trap cleanup EXIT

cd "$ROOT_DIR"
psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" >/dev/null <<SQL
DO \$\$
BEGIN
  DELETE FROM hotel_file_finalizer_capabilities
   WHERE role_name IN ('$RUNTIME_ROLE', '$RECONCILER_ROLE');
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$RUNTIME_ROLE') THEN
    DELETE FROM runtime_database_capabilities WHERE role_name = '$RUNTIME_ROLE';
    EXECUTE 'DROP OWNED BY $RUNTIME_ROLE';
    EXECUTE 'DROP ROLE $RUNTIME_ROLE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$RECONCILER_ROLE') THEN
    DELETE FROM runtime_database_capabilities WHERE role_name = '$RECONCILER_ROLE';
    EXECUTE 'DROP OWNED BY $RECONCILER_ROLE';
    EXECUTE 'DROP ROLE $RECONCILER_ROLE';
  END IF;
END
\$\$;
CREATE ROLE $RUNTIME_ROLE LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$RUNTIME_PASSWORD';
CREATE ROLE $RECONCILER_ROLE LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$RECONCILER_PASSWORD';
GRANT USAGE ON SCHEMA public TO $RUNTIME_ROLE;
GRANT SELECT ON
  companies, users, auth_identities, auth_sessions, runtime_database_capabilities,
  auth_login_transactions, auth_credential_rate_limits,
  schema_migrations, roles, permissions, user_role_memberships,
  user_groups, user_group_memberships, permission_grants,
  branches, hotel_profiles, idempotency_records, outbox_jobs,
  account_provisioning_attempts, initial_password_change_attempts, login_id_registry,
  hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments,
  hotel_room_types, hotel_rooms, hotel_room_status_history,
  hotel_common_areas, hotel_facility_types, hotel_facilities,
  hotel_common_area_history, hotel_facility_type_history, hotel_facility_history,
  process_definitions, process_definition_revisions,
  process_stage_snapshots, process_transition_snapshots, hotel_process_defaults,
  process_executions, process_execution_history,
  inspection_checklist_revisions, inspection_checklist_items,
  inspection_checklist_item_exclusions, inspection_routines,
  inspection_routine_revisions, inspection_routine_rounds,
  hotel_inspections, inspection_item_snapshots, inspection_item_results,
  inspection_item_result_history, hotel_file_uploads, hotel_file_versions,
  hotel_file_links, hotel_file_finalizer_capabilities
TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE, DELETE ON auth_login_transactions TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE, DELETE ON auth_credential_rate_limits TO $RUNTIME_ROLE;
GRANT INSERT ON audit_events, branches, hotel_profiles, auth_identities,
  hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments,
  hotel_room_types
TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE ON users, account_provisioning_attempts,
  initial_password_change_attempts TO $RUNTIME_ROLE;
GRANT INSERT ON login_id_registry TO $RUNTIME_ROLE;
GRANT UPDATE (updated_at) ON auth_identities, branches, hotel_profiles TO $RUNTIME_ROLE;
GRANT UPDATE (version) ON hotel_profiles TO $RUNTIME_ROLE;
GRANT UPDATE (
  end_date, terminated_at, termination_reason, terminated_by, version, updated_at
) ON hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
TO $RUNTIME_ROLE;
GRANT UPDATE (name, display_order, is_active, version, updated_by, updated_at)
  ON hotel_room_types TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE, DELETE ON idempotency_records TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE ON outbox_jobs TO $RUNTIME_ROLE;
GRANT EXECUTE ON FUNCTION public.jsonb_reject_plaintext_password_keys(jsonb),
  public.runtime_is_schema_owner(), public.runtime_has_capability(text),
  public.api_current_company_id(), public.reconciler_current_company_id(),
  public.auth_create_session_v2(
  uuid, bytea, text, integer, integer, timestamptz, uuid
), public.auth_resolve_login_identity_v1(text),
  public.auth_resolve_principal_v2(bytea, integer),
  public.auth_revoke_session_v2(bytea, text, uuid),
  public.auth_revoke_user_sessions_v1(uuid, uuid, text),
  public.auth_revoke_hotel_owner_sessions_v1(uuid, uuid)
TO $RUNTIME_ROLE;
GRANT EXECUTE ON FUNCTION
  public.hotel_room_write_command_v1(
    uuid, uuid, uuid, text, integer, jsonb, uuid, uuid,
    text, text, text, text, text, uuid
  ),
  public.hotel_room_lifecycle_command_v1(
    uuid, uuid, uuid, integer, text, text, uuid, uuid, uuid,
    text, text, text, text, text, uuid
  ),
  public.hotel_facility_reference_command_v1(
    uuid, uuid, text, text, uuid, integer, jsonb, text,
    uuid, uuid, uuid, text, text, text, text, text, uuid
  ),
  public.hotel_process_command_v1(
    uuid, uuid, uuid, text, integer, jsonb, text, uuid,
    text, text, text, text, uuid, uuid
  ),
  public.hotel_process_default_read_v1(uuid, uuid, text),
  public.hotel_process_reviewer_candidates_v1(uuid, uuid, text),
  public.hotel_inspection_routines_read_v1(uuid, uuid, uuid, text),
  public.hotel_inspection_routine_command_v1(
    uuid, uuid, uuid, integer, jsonb, text, text, text,
    text, text, uuid, uuid, uuid
  ),
  public.hotel_inspection_executions_read_v1(
    uuid, uuid, uuid, jsonb, text
  ),
  public.hotel_inspection_command_v2(
    uuid, uuid, uuid, text, integer, jsonb, text, uuid,
    text, text, text, text, uuid, uuid
  ),
  public.hotel_inspection_checklist_v2_command(
    uuid, uuid, uuid, text, integer, jsonb, text, uuid,
    text, text, text, text, uuid, uuid
  ),
  public.hotel_file_command_v1(
    uuid, uuid, uuid, text, integer, jsonb, text, uuid,
    text, text, text, text, uuid, uuid
  ),
  public.hotel_file_upload_scope_v1(uuid, uuid, text),
  public.hotel_inspection_reviews_read_v1(uuid, uuid, uuid, jsonb, text),
  public.hotel_inspection_transition_v1(
    uuid, uuid, uuid, integer, jsonb, text, uuid, text, text, text, uuid, uuid
  ),
  public.hotel_file_view_command_v1(
    uuid, uuid, uuid, uuid, text, text, uuid, text, uuid, uuid, uuid
  )
TO $RUNTIME_ROLE;
INSERT INTO runtime_database_capabilities (role_name, capability)
VALUES ('$RUNTIME_ROLE', 'API_RUNTIME')
ON CONFLICT (role_name) DO UPDATE SET capability = excluded.capability;
GRANT USAGE ON SCHEMA public TO $RECONCILER_ROLE;
GRANT SELECT ON
  schema_migrations, companies, permissions, users, auth_identities, branches,
  hotel_profiles, runtime_database_capabilities, outbox_jobs,
  account_provisioning_attempts, hotel_staff_assignments,
  housekeeping_hotel_links, hotel_owner_assignments,
  hotel_file_finalizer_capabilities
TO $RECONCILER_ROLE;
GRANT INSERT ON users, auth_identities, audit_events, outbox_jobs,
  hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
TO $RECONCILER_ROLE;
GRANT UPDATE ON account_provisioning_attempts, outbox_jobs TO $RECONCILER_ROLE;
GRANT EXECUTE ON FUNCTION public.jsonb_reject_plaintext_password_keys(jsonb),
  public.runtime_is_schema_owner(), public.runtime_has_capability(text),
  public.api_current_company_id(), public.reconciler_current_company_id(),
  public.reconciliation_company_ids(),
  public.hotel_file_scan_command_v1(uuid, text, text, bigint, jsonb, uuid),
  public.hotel_file_scan_candidates_v1(integer),
  public.hotel_file_access_recover_expired_v1(integer),
  public.hotel_inspection_claim_materialization_v1(uuid, bytea, integer),
  public.hotel_inspection_complete_materialization_v1(uuid, bigint, bytea, uuid)
TO $RECONCILER_ROLE;
INSERT INTO runtime_database_capabilities (role_name, capability)
VALUES ('$RECONCILER_ROLE', 'RECONCILER')
ON CONFLICT (role_name) DO UPDATE SET capability = excluded.capability;
INSERT INTO hotel_file_finalizer_capabilities (role_name)
VALUES ('$RECONCILER_ROLE')
ON CONFLICT (role_name) DO NOTHING;
SQL

ROOM_ACL_MISMATCHES="$(psql -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" \
  -v runtime_role="$RUNTIME_ROLE" -v reconciler_role="$RECONCILER_ROLE" \
  -X -A -t <<'SQL'
WITH protected_roles(role_name) AS (
  VALUES (:'runtime_role'::text), (:'reconciler_role'::text)
), room_tables(table_name) AS (
  VALUES ('hotel_room_types'::text), ('hotel_rooms'::text),
    ('hotel_room_status_history'::text), ('hotel_common_areas'::text),
    ('hotel_facility_types'::text), ('hotel_facilities'::text),
    ('hotel_common_area_history'::text),
    ('hotel_facility_type_history'::text), ('hotel_facility_history'::text)
), table_privileges(privilege_name) AS (
  VALUES ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text),
    ('DELETE'::text), ('TRUNCATE'::text), ('REFERENCES'::text),
    ('TRIGGER'::text), ('MAINTAIN'::text)
), table_mismatches AS (
  SELECT 1
  FROM protected_roles role
  CROSS JOIN room_tables room
  CROSS JOIN table_privileges privilege
  WHERE has_table_privilege(
    role.role_name,
    format('public.%I', room.table_name),
    privilege.privilege_name
  ) IS DISTINCT FROM (
    role.role_name = :'runtime_role'
    AND (
      privilege.privilege_name = 'SELECT'
      OR (
        room.table_name = 'hotel_room_types'
        AND privilege.privilege_name = 'INSERT'
      )
    )
  )
), column_privileges(privilege_name) AS (
  VALUES ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text),
    ('REFERENCES'::text)
), column_mismatches AS (
  SELECT 1
  FROM protected_roles role
  CROSS JOIN room_tables room
  JOIN information_schema.columns column_info
    ON column_info.table_schema = 'public'
   AND column_info.table_name = room.table_name
  CROSS JOIN column_privileges privilege
  WHERE has_column_privilege(
    role.role_name,
    format('public.%I', room.table_name),
    column_info.column_name,
    privilege.privilege_name
  ) IS DISTINCT FROM (
    role.role_name = :'runtime_role'
    AND (
      privilege.privilege_name = 'SELECT'
      OR (
        room.table_name = 'hotel_room_types'
        AND privilege.privilege_name = 'INSERT'
      )
      OR (
        privilege.privilege_name = 'UPDATE'
        AND room.table_name = 'hotel_room_types'
        AND column_info.column_name = ANY (ARRAY[
          'name', 'display_order', 'is_active', 'version',
          'updated_by', 'updated_at'
        ]::text[])
      )
    )
  )
), command_mismatches AS (
  SELECT 1
  FROM protected_roles role
  CROSS JOIN (VALUES
    ('public.hotel_room_write_command_v1(uuid,uuid,uuid,text,integer,jsonb,uuid,uuid,text,text,text,text,text,uuid)'::text),
    ('public.hotel_room_lifecycle_command_v1(uuid,uuid,uuid,integer,text,text,uuid,uuid,uuid,text,text,text,text,text,uuid)'::text),
    ('public.hotel_facility_reference_command_v1(uuid,uuid,text,text,uuid,integer,jsonb,text,uuid,uuid,uuid,text,text,text,text,text,uuid)'::text)
  ) command(signature)
  WHERE has_function_privilege(role.role_name, command.signature, 'EXECUTE')
    IS DISTINCT FROM (role.role_name = :'runtime_role')
), schema_mismatches AS (
  SELECT 1
  FROM protected_roles role
  CROSS JOIN (VALUES ('USAGE'::text, true), ('CREATE'::text, false)) expected(privilege_name, allowed)
  WHERE has_schema_privilege(role.role_name, 'public', expected.privilege_name)
    IS DISTINCT FROM expected.allowed
), membership_mismatches AS (
  SELECT 1
  FROM pg_auth_members membership
  JOIN pg_roles protected ON protected.oid = membership.member
  WHERE protected.rolname IN (:'runtime_role', :'reconciler_role')
), attribute_mismatches AS (
  SELECT 1
  FROM pg_roles role
  WHERE role.rolname IN (:'runtime_role', :'reconciler_role')
    AND (role.rolsuper OR role.rolinherit OR role.rolbypassrls)
)
SELECT count(*)
FROM (
  SELECT 1 FROM table_mismatches
  UNION ALL SELECT 1 FROM column_mismatches
  UNION ALL SELECT 1 FROM command_mismatches
  UNION ALL SELECT 1 FROM schema_mismatches
  UNION ALL SELECT 1 FROM membership_mismatches
  UNION ALL SELECT 1 FROM attribute_mismatches
) mismatch;
SQL
)"
if [[ "$ROOM_ACL_MISMATCHES" != "0" ]]; then
  printf 'WORKER_ROOM_RUNTIME_ACL_MISMATCH\n' >&2
  exit 1
fi
printf 'WORKER_ROOM_RUNTIME_ACL_OK\n'

RUNTIME_DATABASE_URL="$(python - "$TEST_DATABASE_URL" "$RUNTIME_ROLE" "$RUNTIME_PASSWORD" <<'PY'
from urllib.parse import quote, urlsplit, urlunsplit
import sys

source = urlsplit(sys.argv[1])
host = source.hostname or ""
if source.port:
    host = f"{host}:{source.port}"
credentials = f"{quote(sys.argv[2])}:{quote(sys.argv[3])}@"
print(urlunsplit((source.scheme, credentials + host, source.path, source.query, source.fragment)))
PY
)"

python - "$WORKER_CONFIG" "$ROOT_DIR/apps/api/src/index.ts" "$RUNTIME_DATABASE_URL" "$PORT" <<'PY'
import json
import os
from pathlib import Path
import sys

path = Path(sys.argv[1])
config = {
    "name": "werehere-worker-runtime-smoke",
    "main": sys.argv[2],
    "compatibility_date": "2026-05-01",
    "compatibility_flags": ["nodejs_compat"],
    "hyperdrive": [{
        "binding": "API_HYPERDRIVE",
        "id": "00000000000000000000000000000000",
        "localConnectionString": sys.argv[3],
    }],
    "vars": {
        "ZITADEL_ISSUER": "https://127.0.0.1:1",
        "ZITADEL_CLIENT_ID": "worker-smoke-client",
        "ZITADEL_ORGANIZATION_ID": "worker-smoke-organization",
        "ZITADEL_USER_PROVISIONER_TOKEN": "worker-smoke-provisioner-token",
        "ZITADEL_REDIRECT_URI": f"http://127.0.0.1:{sys.argv[4]}/api/auth/callback",
        "ZITADEL_SERVICE_USER_TOKEN": "worker-smoke-service-token",
        "AUTH_TRANSACTION_ENCRYPTION_KEY": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
}
path.write_text(json.dumps(config), encoding="utf-8")
os.chmod(path, 0o600)
PY

TOKEN_HASH="$(printf '%s' "$SESSION_TOKEN" | sha256sum | cut -d ' ' -f 1)"
psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -v token_hash="$TOKEN_HASH" >/dev/null <<'SQL'
insert into companies (id, legal_name)
values ('11000000-0000-4000-8000-000000000001', 'Worker Smoke 법인');
insert into users (id, company_id, user_type, display_name)
values (
  '21000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  'INTERNAL_STAFF', 'Worker Smoke 관리자'
);
insert into auth_identities (id, company_id, user_id, provider, provider_subject)
values (
  '31000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  'ZITADEL', 'worker-smoke-subject'
);
insert into auth_sessions (
  id, company_id, user_id, identity_id, token_hash,
  idle_expires_at, absolute_expires_at, auth_time, authentication_method
) values (
  '41000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  decode(:'token_hash', 'hex'), now() + interval '8 hours', now() + interval '24 hours',
  now(), 'worker-smoke'
);
insert into permission_grants (
  id, company_id, subject_type, subject_id, permission_code,
  effect, valid_from, granted_by, reason
) values
  ('91000000-0000-4000-8000-000000000011',
   '11000000-0000-4000-8000-000000000001', 'USER',
   '21000000-0000-4000-8000-000000000001',
   'HOTEL_MANAGE', 'ALLOW', now(),
   '21000000-0000-4000-8000-000000000001', 'Worker 호텔 API smoke'),
  ('91000000-0000-4000-8000-000000000012',
   '11000000-0000-4000-8000-000000000001', 'USER',
   '21000000-0000-4000-8000-000000000001',
   'HOTEL_ROOM_MANAGE', 'ALLOW', now(),
   '21000000-0000-4000-8000-000000000001', 'Worker 객실 API smoke'),
  ('91000000-0000-4000-8000-000000000013',
   '11000000-0000-4000-8000-000000000001', 'USER',
   '21000000-0000-4000-8000-000000000001',
   'HOTEL_ROOM_TYPE_MANAGE', 'ALLOW', now(),
   '21000000-0000-4000-8000-000000000001', 'Worker 객실유형 API smoke'),
  ('91000000-0000-4000-8000-000000000014',
   '11000000-0000-4000-8000-000000000001', 'USER',
   '21000000-0000-4000-8000-000000000001',
   'HOTEL_ROOM_READ', 'ALLOW', now(),
   '21000000-0000-4000-8000-000000000001', 'Worker 객실 조회 smoke'),
  ('91000000-0000-4000-8000-000000000015',
   '11000000-0000-4000-8000-000000000001', 'USER',
   '21000000-0000-4000-8000-000000000001',
   'HOTEL_FACILITY_READ', 'ALLOW', now(),
   '21000000-0000-4000-8000-000000000001', 'Worker 시설물 조회 smoke'),
  ('91000000-0000-4000-8000-000000000016',
   '11000000-0000-4000-8000-000000000001', 'USER',
   '21000000-0000-4000-8000-000000000001',
   'HOTEL_FACILITY_MANAGE', 'ALLOW', now(),
   '21000000-0000-4000-8000-000000000001', 'Worker 시설물 관리 smoke');
SQL

pnpm --filter @werehere/api exec wrangler dev --config "$WORKER_CONFIG" --port "$PORT" \
  >"$LOG_FILE" 2>&1 &
WORKER_PID="$!"

READY=0
for _ in $(seq 1 40); do
  if ! kill -0 "$WORKER_PID" >/dev/null 2>&1; then
    printf 'Worker runtime smoke server exited before readiness.\n' >&2
    exit 1
  fi
  if curl --fail --silent --show-error "http://127.0.0.1:$PORT/api/health/live" \
    >"$TMP_DIR/live.json" 2>/dev/null; then
    READY=1
    break
  fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then
  printf 'Worker runtime smoke server did not become ready.\n' >&2
  exit 1
fi

READINESS_STATUS="$(curl --silent --show-error -o "$TMP_DIR/ready.json" -w '%{http_code}' "http://127.0.0.1:$PORT/api/health/ready")"
if [[ "$READINESS_STATUS" != "200" ]]; then
  python - "$TMP_DIR/ready.json" "$READINESS_STATUS" <<'PY'
import json
import sys

try:
    body = json.load(open(sys.argv[1], encoding="utf-8"))
    code = body.get("error", {}).get("code", "UNKNOWN") if isinstance(body, dict) else "UNKNOWN"
except Exception:
    code = "INVALID_RESPONSE"
print(f"Worker readiness failed: status={sys.argv[2]} code={code}", file=sys.stderr)
PY
  exit 1
fi
LOGIN_STATUS="$(curl --silent --show-error -o "$TMP_DIR/login.json" -w '%{http_code}' "http://127.0.0.1:$PORT/api/auth/login")"
CALLBACK_STATUS="$(curl --silent --show-error -D "$TMP_DIR/callback.headers" -o "$TMP_DIR/callback.json" -w '%{http_code}' "http://127.0.0.1:$PORT/api/auth/callback")"
SESSION_STATUS="$(curl --silent --show-error -o "$TMP_DIR/session.json" -w '%{http_code}' "http://127.0.0.1:$PORT/api/auth/session")"
LOGOUT_STATUS="$(curl --silent --show-error -D "$TMP_DIR/logout.headers" -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/api/auth/logout")"

HOTEL_LIST_EMPTY_STATUS="$(curl --silent --show-error -o "$TMP_DIR/hotels-empty.json" -w '%{http_code}' \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" "http://127.0.0.1:$PORT/api/hotels")"
HOTEL_CREATE_STATUS="$(curl --silent --show-error -o "$TMP_DIR/hotel-create.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-hotel-create-1' \
  --data '{"branchCode":"worker-hotel-1","name":"Worker Smoke 호텔","roadAddress":"서울특별시 중구 세종대로 1","detailAddress":"","representativePhone":"02-1234-5678","contractStartDate":"2026-07-01","contractEndDate":"2027-06-30"}' \
  "http://127.0.0.1:$PORT/api/hotels")"
python - "$TMP_DIR" "$HOTEL_CREATE_STATUS" <<'PY'
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
body = json.loads((root / "hotel-create.json").read_text(encoding="utf-8"))
if sys.argv[2] != "201":
    code = body.get("error", {}).get("code", "UNKNOWN")
    raise SystemExit(f"Worker hotel create status mismatch: {sys.argv[2]} ({code})")
hotel = body.get("data", {}).get("hotel", {})
if hotel.get("status") != "PREPARING" or hotel.get("branchCode") != "WORKER-HOTEL-1":
    raise SystemExit("Worker hotel create response mismatch")
(root / "hotel-id.txt").write_text(hotel["id"], encoding="utf-8")
PY
HOTEL_ID="$(<"$TMP_DIR/hotel-id.txt")"
psql -X -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL" -v hotel_id="$HOTEL_ID" >/dev/null <<'SQL'
insert into hotel_staff_assignments (
  id, company_id, branch_id, user_id, assignment_type,
  start_date, reason, created_by
) values (
  '92000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001', :'hotel_id'::uuid,
  '21000000-0000-4000-8000-000000000001', 'PRIMARY', current_date,
  'Worker 객실 API smoke', '21000000-0000-4000-8000-000000000001'
);
SQL
psql -X -v ON_ERROR_STOP=1 -d "$RUNTIME_DATABASE_URL" \
  -v session_id="41000000-0000-4000-8000-000000000001" \
  -v hotel_id="$HOTEL_ID" >/dev/null <<'SQL'
begin;
select set_config('app.session_id', :'session_id', true);
select branch.id
from branches branch
join hotel_profiles profile
  on profile.company_id = branch.company_id and profile.branch_id = branch.id
where branch.company_id = '11000000-0000-4000-8000-000000000001'
  and branch.id = :'hotel_id'::uuid
for update of branch, profile;
rollback;
SQL
if psql -X -v ON_ERROR_STOP=1 -d "$RUNTIME_DATABASE_URL" \
  -v session_id="41000000-0000-4000-8000-000000000001" \
  -v hotel_id="$HOTEL_ID" >/dev/null 2>&1 <<'SQL'
begin;
select set_config('app.session_id', :'session_id', true);
update branches set status = 'INACTIVE' where id = :'hotel_id'::uuid;
rollback;
SQL
then
  printf 'API runtime unexpectedly received branch status UPDATE privilege.\n' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$RUNTIME_DATABASE_URL" \
  -v session_id="41000000-0000-4000-8000-000000000001" >/dev/null <<'SQL'
begin;
select set_config('app.session_id', :'session_id', true);
select user_record.id
from users user_record
join auth_identities identity_record
  on identity_record.company_id = user_record.company_id
 and identity_record.user_id = user_record.id
where user_record.company_id = '11000000-0000-4000-8000-000000000001'
  and user_record.id = '21000000-0000-4000-8000-000000000001'
for update of user_record, identity_record;
rollback;
SQL
if psql -X -v ON_ERROR_STOP=1 -d "$RUNTIME_DATABASE_URL" \
  -v session_id="41000000-0000-4000-8000-000000000001" >/dev/null 2>&1 <<'SQL'
begin;
select set_config('app.session_id', :'session_id', true);
update auth_identities
set provider_subject = 'worker-smoke-forbidden-subject'
where id = '31000000-0000-4000-8000-000000000001';
rollback;
SQL
then
  printf 'API runtime unexpectedly received provider identity UPDATE privilege.\n' >&2
  exit 1
fi

ROOM_TYPE_CREATE_STATUS="$(curl --silent --show-error -o "$TMP_DIR/room-type-create.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-room-type-create-1' \
  --data '{"scope":"HOTEL","name":"Worker 스탠다드","displayOrder":10,"isActive":true}' \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/room-types")"
python - "$TMP_DIR" "$ROOM_TYPE_CREATE_STATUS" <<'PY'
import json
from pathlib import Path
import sys
root = Path(sys.argv[1])
body = json.loads((root / "room-type-create.json").read_text(encoding="utf-8"))
room_type = body.get("data", {}).get("roomType", {})
if sys.argv[2] != "201" or room_type.get("scope") != "HOTEL":
    raise SystemExit(f"Worker room type create mismatch: {sys.argv[2]}")
(root / "room-type-id.txt").write_text(room_type["id"], encoding="utf-8")
PY
ROOM_TYPE_ID="$(<"$TMP_DIR/room-type-id.txt")"
ROOM_CREATE_PAYLOAD="$(printf '{\"roomNumber\":\"worker-b01\",\"floorLabel\":\"1층\",\"floorSortKey\":1,\"roomTypeId\":\"%s\",\"internalNote\":\"Worker 내부\",\"ownerVisibleNote\":\"Worker 공개\"}' "$ROOM_TYPE_ID")"
ROOM_CREATE_STATUS="$(curl --silent --show-error -o "$TMP_DIR/room-create.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-room-create-1' \
  --data "$ROOM_CREATE_PAYLOAD" \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/rooms")"
python - "$TMP_DIR" "$ROOM_CREATE_STATUS" <<'PY'
import json
from pathlib import Path
import sys
root = Path(sys.argv[1])
body = json.loads((root / "room-create.json").read_text(encoding="utf-8"))
room = body.get("data", {}).get("room", {})
if sys.argv[2] != "201" or room.get("roomNumber") != "WORKER-B01" or room.get("version") != 1:
    raise SystemExit(f"Worker room create mismatch: {sys.argv[2]}")
(root / "room-id.txt").write_text(room["id"], encoding="utf-8")
PY
ROOM_ID="$(<"$TMP_DIR/room-id.txt")"

FACILITY_AREA_STATUS="$(curl --silent --show-error -o "$TMP_DIR/facility-area.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-facility-area-create-1' \
  --data '{"name":"Worker 로비"}' \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/common-areas")"
python - "$TMP_DIR" "$FACILITY_AREA_STATUS" <<'PY'
import json
from pathlib import Path
import sys
root = Path(sys.argv[1])
body = json.loads((root / "facility-area.json").read_text(encoding="utf-8"))
resource = body.get("data", {}).get("resource", {})
if sys.argv[2] != "201" or resource.get("name") != "Worker 로비" or resource.get("version") != 1:
    raise SystemExit(f"Worker common area create mismatch: {sys.argv[2]}")
(root / "facility-area-id.txt").write_text(resource["id"], encoding="utf-8")
PY
FACILITY_AREA_ID="$(<"$TMP_DIR/facility-area-id.txt")"

FACILITY_TYPE_STATUS="$(curl --silent --show-error -o "$TMP_DIR/facility-type.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-facility-type-create-1' \
  --data '{"name":"Worker 소방설비"}' \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/facility-types")"
python - "$TMP_DIR" "$FACILITY_TYPE_STATUS" <<'PY'
import json
from pathlib import Path
import sys
root = Path(sys.argv[1])
body = json.loads((root / "facility-type.json").read_text(encoding="utf-8"))
resource = body.get("data", {}).get("resource", {})
if sys.argv[2] != "201" or resource.get("name") != "Worker 소방설비":
    raise SystemExit(f"Worker facility type create mismatch: {sys.argv[2]}")
(root / "facility-type-id.txt").write_text(resource["id"], encoding="utf-8")
PY
FACILITY_TYPE_ID="$(<"$TMP_DIR/facility-type-id.txt")"
FACILITY_CREATE_PAYLOAD="$(printf '{\"name\":\"Worker 객실 감지기\",\"facilityTypeId\":\"%s\",\"location\":{\"type\":\"ROOM\",\"roomId\":\"%s\"}}' "$FACILITY_TYPE_ID" "$ROOM_ID")"
FACILITY_CREATE_STATUS="$(curl --silent --show-error -o "$TMP_DIR/facility-create.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-facility-create-1' \
  --data "$FACILITY_CREATE_PAYLOAD" \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/facilities")"
python - "$TMP_DIR" "$FACILITY_CREATE_STATUS" "$ROOM_ID" <<'PY'
import json
from pathlib import Path
import sys
root = Path(sys.argv[1])
body = json.loads((root / "facility-create.json").read_text(encoding="utf-8"))
resource = body.get("data", {}).get("resource", {})
location = resource.get("location", {})
if sys.argv[2] != "201" or resource.get("name") != "Worker 객실 감지기" or location.get("type") != "ROOM" or location.get("roomId") != sys.argv[3]:
    raise SystemExit(f"Worker facility create mismatch: {sys.argv[2]}")
(root / "facility-id.txt").write_text(resource["id"], encoding="utf-8")
PY
FACILITY_ID="$(<"$TMP_DIR/facility-id.txt")"

FACILITY_WORKSPACE_STATUS="$(curl --silent --show-error -o "$TMP_DIR/facility-workspace.json" -w '%{http_code}' \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/facility-master-data?page=1&pageSize=20")"
python - "$TMP_DIR" "$FACILITY_WORKSPACE_STATUS" "$FACILITY_AREA_ID" "$FACILITY_TYPE_ID" "$FACILITY_ID" <<'PY'
import json
from pathlib import Path
import sys
root = Path(sys.argv[1])
body = json.loads((root / "facility-workspace.json").read_text(encoding="utf-8"))
data = body.get("data", {})
if sys.argv[2] != "200" or not data.get("capabilities", {}).get("canManage"):
    raise SystemExit(f"Worker facility workspace mismatch: {sys.argv[2]}")
if sys.argv[3] not in {item.get("id") for item in data.get("commonAreas", [])}:
    raise SystemExit("Worker common area missing from workspace")
if sys.argv[4] not in {item.get("id") for item in data.get("facilityTypes", [])}:
    raise SystemExit("Worker facility type missing from workspace")
if sys.argv[5] not in {item.get("id") for item in data.get("facilities", [])}:
    raise SystemExit("Worker facility missing from workspace")
PY

FACILITY_MIXED_LOCATION_PAYLOAD="$(printf '{\"name\":\"Worker 혼합 위치\",\"facilityTypeId\":\"%s\",\"location\":{\"type\":\"ROOM\",\"roomId\":\"%s\",\"commonAreaId\":\"%s\"}}' "$FACILITY_TYPE_ID" "$ROOM_ID" "$FACILITY_AREA_ID")"
FACILITY_MIXED_STATUS="$(curl --silent --show-error -o "$TMP_DIR/facility-mixed.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-facility-mixed-location-1' \
  --data "$FACILITY_MIXED_LOCATION_PAYLOAD" \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/facilities")"
if [[ "$FACILITY_MIXED_STATUS" != "400" ]]; then
  printf 'Worker mixed facility location was accepted: %s\n' "$FACILITY_MIXED_STATUS" >&2
  exit 1
fi
FACILITY_STORED="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" \
  -v facility_id="$FACILITY_ID" <<'SQL'
select count(*)
  from hotel_facilities
 where id = :'facility_id'::uuid
   and status = 'ACTIVE';
SQL
)"
if [[ "$FACILITY_STORED" != "1" ]]; then
  printf 'Worker facility was not persisted in PostgreSQL.\n' >&2
  exit 1
fi
printf 'HOTEL_FACILITY_WORKER_API_INTEGRATION_OK\n'

ROOM_LINKED_FACILITY_STATUS="$(curl --silent --show-error -o "$TMP_DIR/room-linked-facility.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-room-linked-facility-1' \
  --data '{"status":"INACTIVE","reason":"활성 시설물 연결 차단 확인","version":1}' \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/rooms/$ROOM_ID/status")"
python - "$TMP_DIR" "$ROOM_LINKED_FACILITY_STATUS" <<'PY'
import json
from pathlib import Path
import sys
root = Path(sys.argv[1])
body = json.loads((root / "room-linked-facility.json").read_text(encoding="utf-8"))
if sys.argv[2] != "409" or body.get("error", {}).get("code") != "INVALID_STATE_TRANSITION":
    raise SystemExit(f"Worker linked facility room guard mismatch: {sys.argv[2]}")
PY

FACILITY_STATUS_STATUS="$(curl --silent --show-error -o "$TMP_DIR/facility-status.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-facility-status-1' \
  --data '{"status":"INACTIVE","reason":"객실 사용중지 전 시설물 사용중지","version":1}' \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/facilities/$FACILITY_ID/status")"
python - "$TMP_DIR" "$FACILITY_STATUS_STATUS" <<'PY'
import json
from pathlib import Path
import sys
root = Path(sys.argv[1])
body = json.loads((root / "facility-status.json").read_text(encoding="utf-8"))
resource = body.get("data", {}).get("resource", {})
if sys.argv[2] != "200" or resource.get("status") != "INACTIVE" or resource.get("version") != 2:
    raise SystemExit(f"Worker facility status mismatch: {sys.argv[2]}")
PY

ROOM_REPLAY_STATUS="$(curl --silent --show-error -o "$TMP_DIR/room-replay.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-room-create-1' \
  --data "$ROOM_CREATE_PAYLOAD" \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/rooms")"
ROOM_UPDATE_STATUS="$(curl --silent --show-error -o "$TMP_DIR/room-update.json" -w '%{http_code}' -X PATCH \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-room-update-1' \
  --data '{"floorLabel":"Worker 2층","version":1}' \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/rooms/$ROOM_ID")"
ROOM_STATUS_STATUS="$(curl --silent --show-error -o "$TMP_DIR/room-status.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-room-status-1' \
  --data '{"status":"INACTIVE","reason":"Worker 시설 점검","version":2}' \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/rooms/$ROOM_ID/status")"
ROOM_DELETE_STATUS="$(curl --silent --show-error -o "$TMP_DIR/room-delete.json" -w '%{http_code}' -X POST \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: worker-room-delete-1' \
  --data '{"reason":"Worker 객실 삭제","version":3}' \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/rooms/$ROOM_ID/delete")"
ROOM_LIST_STATUS="$(curl --silent --show-error -o "$TMP_DIR/room-list.json" -w '%{http_code}' \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/rooms?page=1&pageSize=20")"
ROOM_DETAIL_STATUS="$(curl --silent --show-error -o "$TMP_DIR/room-detail.json" -w '%{http_code}' \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/rooms/$ROOM_ID")"
WRONG_BEARER_STATUS="$(curl --silent --show-error -o "$TMP_DIR/room-wrong-bearer.json" -w '%{http_code}' \
  -H 'Cookie: __Host-hotel_session=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC' \
  "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID/rooms/$ROOM_ID")"
python - "$TMP_DIR" "$ROOM_REPLAY_STATUS" "$ROOM_UPDATE_STATUS" "$ROOM_STATUS_STATUS" \
  "$ROOM_DELETE_STATUS" "$ROOM_LIST_STATUS" "$ROOM_DETAIL_STATUS" "$WRONG_BEARER_STATUS" <<'PY'
import json
from pathlib import Path
import sys
root = Path(sys.argv[1])
replay, update, status, delete, listing, detail, wrong = sys.argv[2:]
def load(name):
    return json.loads((root / name).read_text(encoding="utf-8"))
room_id = (root / "room-id.txt").read_text(encoding="utf-8")
if replay != "200" or load("room-replay.json").get("data", {}).get("room", {}).get("id") != room_id:
    raise SystemExit("Worker room replay mismatch")
if update != "200" or load("room-update.json").get("data", {}).get("room", {}).get("version") != 2:
    raise SystemExit("Worker room update mismatch")
if status != "200" or load("room-status.json").get("data", {}).get("room", {}).get("status") != "INACTIVE":
    raise SystemExit("Worker room status mismatch")
if delete != "200" or load("room-delete.json").get("data", {}).get("room", {}).get("status") != "DELETED":
    raise SystemExit("Worker room delete mismatch")
pagination = load("room-list.json").get("data", {}).get("pagination", {})
if listing != "200" or pagination.get("total") != 0 or pagination.get("totalPages") != 0:
    raise SystemExit("Worker deleted room pagination mismatch")
room = load("room-detail.json").get("data", {}).get("room", {})
if detail != "200" or room.get("id") != room_id or room.get("status") != "DELETED" or room.get("version") != 4:
    raise SystemExit("Worker deleted room detail mismatch")
if wrong != "401" or load("room-wrong-bearer.json").get("error", {}).get("code") != "AUTHENTICATION_REQUIRED":
    raise SystemExit("Worker wrong bearer rejection mismatch")
PY
if psql -X -v ON_ERROR_STOP=1 -d "$RUNTIME_DATABASE_URL" >/dev/null 2>&1 \
  -c "insert into hotel_rooms default values"; then
  printf 'API runtime unexpectedly received direct hotel_rooms INSERT privilege.\n' >&2
  exit 1
fi
ROOM_ATOMIC_READBACK="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" \
  -v room_id="$ROOM_ID" -v session_token="$SESSION_TOKEN" <<'SQL'
select
  (select count(*) from audit_events
    where resource_type = 'HOTEL_ROOM' and resource_id = :'room_id'::uuid
      and result = 'SUCCEEDED')::text || '|' ||
  (select count(*) from hotel_room_status_history
    where room_id = :'room_id'::uuid)::text || '|' ||
  (select count(*) from idempotency_records
    where resource_type = 'HOTEL_ROOM' and resource_id = :'room_id'::uuid
      and status = 'COMPLETED')::text || '|' ||
  (select count(*) from idempotency_records
    where resource_id = :'room_id'::uuid
      and pg_catalog.strpos(
        coalesce(result_snapshot::text, ''), :'session_token'
      ) > 0)::text;
SQL
)"
if [[ "$ROOM_ATOMIC_READBACK" != "4|2|4|0" ]]; then
  printf 'WORKER_ROOM_ATOMIC_READBACK_MISMATCH\n' >&2
  exit 1
fi

HOTEL_DETAIL_STATUS="$(curl --silent --show-error -o "$TMP_DIR/hotel-detail.json" -w '%{http_code}' \
  -H "Cookie: __Host-hotel_session=$SESSION_TOKEN" "http://127.0.0.1:$PORT/api/hotels/$HOTEL_ID")"

python - "$TMP_DIR" "$LOGIN_STATUS" "$CALLBACK_STATUS" "$SESSION_STATUS" "$LOGOUT_STATUS" \
  "$HOTEL_LIST_EMPTY_STATUS" "$HOTEL_DETAIL_STATUS" <<'PY'
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
login_status, callback_status, session_status, logout_status, hotel_list_status, hotel_detail_status = sys.argv[2:]

def load(name):
    return json.loads((root / name).read_text(encoding="utf-8"))

if load("live.json").get("data", {}).get("status") != "UP":
    raise SystemExit("Worker liveness response mismatch")
ready_database = load("ready.json").get("data", {}).get("status")
if ready_database != "READY":
    raise SystemExit(f"Worker PostgreSQL readiness mismatch: {ready_database}")
if login_status != "503" or load("login.json").get("error", {}).get("code") != "AUTH_PROVIDER_UNAVAILABLE":
    raise SystemExit("Worker login provider failure mismatch")
if callback_status != "303":
    raise SystemExit("Worker callback validation mismatch")
if session_status != "401" or load("session.json").get("error", {}).get("code") != "AUTHENTICATION_REQUIRED":
    raise SystemExit("Worker session rejection mismatch")
if logout_status != "204":
    raise SystemExit("Worker logout status mismatch")
if hotel_list_status != "200" or load("hotels-empty.json").get("data", {}).get("pagination", {}).get("total") != 0:
    raise SystemExit("Worker empty hotel list mismatch")
detail = load("hotel-detail.json").get("data", {}).get("hotel", {})
if hotel_detail_status != "200" or detail.get("branchCode") != "WORKER-HOTEL-1":
    raise SystemExit("Worker hotel PostgreSQL read-back mismatch")
PY

grep -qi '^set-cookie: __Host-hotel_oauth_browser=.*Max-Age=0' "$TMP_DIR/callback.headers"
grep -qi '^location: /login?error=invalid-flow' "$TMP_DIR/callback.headers"
grep -qi '^set-cookie: __Host-hotel_session=.*Max-Age=0' "$TMP_DIR/logout.headers"

TARGET_FOUNDATION_STATE="$(psql -X -v ON_ERROR_STOP=1 -At -d "$TEST_DATABASE_URL" <<'SQL'
select
  (select count(*) from public.schema_migrations
    where version = '0037_hotel_inspection_execution_targets')::text || '|' ||
  (select count(*) from pg_catalog.pg_class table_record
    join pg_catalog.pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
    where table_namespace.nspname = 'public'
      and table_record.relname = 'inspection_execution_targets'
      and table_record.relrowsecurity and table_record.relforcerowsecurity)::text || '|' ||
  (select count(*) from public.inspection_item_snapshots
    where execution_target_id is null)::text;
SQL
)"
if [[ "$TARGET_FOUNDATION_STATE" != "1|1|0" ]]; then
  printf 'HOTEL_INSPECTION_TARGET_FOUNDATION_MISMATCH\n' >&2
  exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -d "$RUNTIME_DATABASE_URL" \
  -c 'select count(*) from public.inspection_execution_targets' >/dev/null 2>&1; then
  printf 'API runtime unexpectedly received direct inspection target SELECT privilege.\n' >&2
  exit 1
fi
printf 'HOTEL_INSPECTION_TARGET_FOUNDATION_OK\n'

for checklist_table in \
  inspection_checklist_v2_revisions \
  inspection_checklist_v2_items \
  inspection_checklist_v2_item_exclusions; do
  if psql -X -v ON_ERROR_STOP=1 -d "$RUNTIME_DATABASE_URL" \
    -c "select count(*) from public.${checklist_table}" >/dev/null 2>&1; then
    printf 'API runtime unexpectedly received direct checklist v2 SELECT privilege.\n' >&2
    exit 1
  fi
done
printf 'HOTEL_INSPECTION_CHECKLIST_TARGETS_WORKER_OK\n'

printf 'WORKER_AUTH_RUNTIME_SMOKE_OK\n'
printf 'WORKER_HOTEL_RUNTIME_SMOKE_OK\n'
printf 'WORKER_ROOM_RUNTIME_SMOKE_OK\n'
