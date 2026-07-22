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
SESSION_TOKEN="BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
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
    -c "delete from runtime_database_capabilities where role_name in ('$RUNTIME_ROLE', '$RECONCILER_ROLE'); drop owned by $RUNTIME_ROLE, $RECONCILER_ROLE; drop role $RUNTIME_ROLE, $RECONCILER_ROLE" || true
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
  hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE, DELETE ON auth_login_transactions TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE, DELETE ON auth_credential_rate_limits TO $RUNTIME_ROLE;
GRANT INSERT ON audit_events, branches, hotel_profiles, auth_identities,
  hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE ON users, account_provisioning_attempts,
  initial_password_change_attempts TO $RUNTIME_ROLE;
GRANT INSERT ON login_id_registry TO $RUNTIME_ROLE;
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
  public.auth_revoke_user_sessions_v1(uuid, uuid, text)
TO $RUNTIME_ROLE;
INSERT INTO runtime_database_capabilities (role_name, capability)
VALUES ('$RUNTIME_ROLE', 'API_RUNTIME')
ON CONFLICT (role_name) DO UPDATE SET capability = excluded.capability;
GRANT USAGE ON SCHEMA public TO $RECONCILER_ROLE;
GRANT SELECT ON
  schema_migrations, companies, permissions, users, auth_identities, branches,
  hotel_profiles, runtime_database_capabilities, outbox_jobs,
  account_provisioning_attempts, hotel_staff_assignments,
  housekeeping_hotel_links, hotel_owner_assignments
TO $RECONCILER_ROLE;
GRANT INSERT ON users, auth_identities, audit_events, outbox_jobs,
  hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
TO $RECONCILER_ROLE;
GRANT UPDATE ON account_provisioning_attempts, outbox_jobs TO $RECONCILER_ROLE;
GRANT EXECUTE ON FUNCTION public.jsonb_reject_plaintext_password_keys(jsonb),
  public.runtime_is_schema_owner(), public.runtime_has_capability(text),
  public.api_current_company_id(), public.reconciler_current_company_id(),
  public.reconciliation_company_ids()
TO $RECONCILER_ROLE;
INSERT INTO runtime_database_capabilities (role_name, capability)
VALUES ('$RECONCILER_ROLE', 'RECONCILER')
ON CONFLICT (role_name) DO UPDATE SET capability = excluded.capability;
SQL

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
) values (
  '91000000-0000-4000-8000-000000000011',
  '11000000-0000-4000-8000-000000000001',
  'USER', '21000000-0000-4000-8000-000000000001',
  'HOTEL_MANAGE', 'ALLOW', now(),
  '21000000-0000-4000-8000-000000000001', 'Worker 호텔 API smoke'
);
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

printf 'WORKER_AUTH_RUNTIME_SMOKE_OK\n'
printf 'WORKER_HOTEL_RUNTIME_SMOKE_OK\n'
