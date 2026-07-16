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

cleanup() {
  if [[ -n "$WORKER_PID" ]]; then
    kill "$WORKER_PID" >/dev/null 2>&1 || true
    wait "$WORKER_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cd "$ROOT_DIR"
pnpm --filter @werehere/api exec wrangler dev --port "$PORT" \
  --var "DATABASE_URL:$TEST_DATABASE_URL" \
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

curl --fail --silent --show-error "http://127.0.0.1:$PORT/api/health/ready" \
  >"$TMP_DIR/ready.json"

LOGIN_STATUS="$(curl --silent --show-error -o "$TMP_DIR/login.json" \
  -w '%{http_code}' "http://127.0.0.1:$PORT/api/auth/login")"
CALLBACK_STATUS="$(curl --silent --show-error -D "$TMP_DIR/callback.headers" \
  -o "$TMP_DIR/callback.json" -w '%{http_code}' \
  "http://127.0.0.1:$PORT/api/auth/callback")"
SESSION_STATUS="$(curl --silent --show-error -o "$TMP_DIR/session.json" \
  -w '%{http_code}' "http://127.0.0.1:$PORT/api/auth/session")"
LOGOUT_STATUS="$(curl --silent --show-error -D "$TMP_DIR/logout.headers" \
  -o /dev/null -w '%{http_code}' -X POST \
  "http://127.0.0.1:$PORT/api/auth/logout")"

python - "$TMP_DIR" "$LOGIN_STATUS" "$CALLBACK_STATUS" "$SESSION_STATUS" "$LOGOUT_STATUS" <<'PY'
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
login_status, callback_status, session_status, logout_status = sys.argv[2:]

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
PY

grep -qi '^set-cookie: __Host-hotel_oauth_browser=.*Max-Age=0' "$TMP_DIR/callback.headers"
grep -qi '^set-cookie: __Host-hotel_session=.*Max-Age=0' "$TMP_DIR/logout.headers"

printf 'WORKER_AUTH_RUNTIME_SMOKE_OK\n'
