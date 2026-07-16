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
RUNTIME_DATABASE_URL=""

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
    -c "drop owned by $RUNTIME_ROLE; drop role $RUNTIME_ROLE" || true
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
    EXECUTE 'DROP OWNED BY $RUNTIME_ROLE';
    EXECUTE 'DROP ROLE $RUNTIME_ROLE';
  END IF;
END
\$\$;
CREATE ROLE $RUNTIME_ROLE LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$RUNTIME_PASSWORD';
GRANT USAGE ON SCHEMA public TO $RUNTIME_ROLE;
GRANT SELECT ON
  companies, users, auth_identities, auth_sessions,
  auth_login_transactions, schema_migrations, roles, permissions, user_role_memberships,
  user_groups, user_group_memberships, permission_grants,
  branches, hotel_profiles, idempotency_records
TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE, DELETE ON auth_login_transactions TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE ON auth_sessions TO $RUNTIME_ROLE;
GRANT INSERT ON audit_events, branches, hotel_profiles TO $RUNTIME_ROLE;
GRANT INSERT, UPDATE, DELETE ON idempotency_records TO $RUNTIME_ROLE;
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

pnpm --filter @werehere/api exec wrangler dev --port "$PORT" \
  --var "DATABASE_URL:$RUNTIME_DATABASE_URL" \
  --var "ZITADEL_ISSUER:https://127.0.0.1:1" \
  --var "ZITADEL_CLIENT_ID:worker-smoke-client" \
  --var "ZITADEL_REDIRECT_URI:http://127.0.0.1:$PORT/api/auth/callback" \
  --var "AUTH_TRANSACTION_ENCRYPTION_KEY:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" \
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
if callback_status != "400" or load("callback.json").get("error", {}).get("code") != "AUTH_FLOW_INVALID":
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
grep -qi '^set-cookie: __Host-hotel_session=.*Max-Age=0' "$TMP_DIR/logout.headers"

printf 'WORKER_AUTH_RUNTIME_SMOKE_OK\n'
printf 'WORKER_HOTEL_RUNTIME_SMOKE_OK\n'
