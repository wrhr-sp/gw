#!/usr/bin/env bash
set -euo pipefail

PREVIEW_PORT="${PREVIEW_PORT:-8787}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PREVIEW_PORT}}"
GENERAL_HOST="${GENERAL_HOST:-gw-web.preview-account.workers.dev}"
ADMIN_HOST="${ADMIN_HOST:-gw-admin.preview-account.workers.dev}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

require_cmd curl
require_cmd python3

fetch_json_field() {
  local host="$1"
  local path="$2"
  local field="$3"

  curl -fsS -H "Host: ${host}" "${BASE_URL}${path}" \
    | python3 -c 'import json, sys; print(json.load(sys.stdin)[sys.argv[1]])' "$field"
}

fetch_html_manifest_href() {
  local host="$1"
  local path="$2"

  curl -fsSL -H "Host: ${host}" "${BASE_URL}${path}" \
    | python3 -c 'from html.parser import HTMLParser
import sys

class ManifestHrefParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.href = None

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "link" or self.href is not None:
            return
        attr_map = {name.lower(): value for name, value in attrs if value is not None}
        if attr_map.get("rel", "").lower() == "manifest" and "href" in attr_map:
            self.href = attr_map["href"]

parser = ManifestHrefParser()
parser.feed(sys.stdin.read())
if parser.href is None:
    raise SystemExit("manifest href not found in html response")
print(parser.href)'
}

expect_equals() {
  local actual="$1"
  local expected="$2"
  local label="$3"

  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL ${label}: expected '${expected}', got '${actual}'" >&2
    exit 1
  fi

  echo "PASS ${label}: ${actual}"
}

fetch_status_and_location() {
  local host="$1"
  local path="$2"
  local follow_mode="$3"

  local extra_args=()
  if [[ "$follow_mode" == "follow" ]]; then
    extra_args=(-L)
  fi

  curl -sS -o /dev/null -D - "${extra_args[@]}" -H "Host: ${host}" "${BASE_URL}${path}" \
    | python3 -c 'import sys
status = ""
location = ""
for raw in sys.stdin:
    line = raw.strip()
    if not line:
        continue
    lower = line.lower()
    if lower.startswith("http/"):
        parts = line.split()
        if len(parts) >= 2:
            status = parts[1]
    elif lower.startswith("location:"):
        location = line.split(":", 1)[1].strip()
print(status)
print(location)
'
}

check_redirect() {
  local host="$1"
  local path="$2"
  local expected_status="$3"
  local expected_location="$4"
  local label="$5"

  mapfile -t result < <(fetch_status_and_location "$host" "$path" manual)
  expect_equals "${result[0]:-}" "$expected_status" "${label} status"
  expect_equals "${result[1]:-}" "$expected_location" "${label} location"
}

check_follow_status() {
  local host="$1"
  local path="$2"
  local expected_status="$3"
  local label="$4"

  mapfile -t result < <(fetch_status_and_location "$host" "$path" follow)
  expect_equals "${result[0]:-}" "$expected_status" "${label} final status"
}

echo "== Manifest identity checks =="
expect_equals "$(fetch_json_field "$GENERAL_HOST" "/manifest.webmanifest" name)" "GW Cloudflare-first Skeleton" "general host /manifest name"
expect_equals "$(fetch_json_field "$GENERAL_HOST" "/manifest.webmanifest" start_url)" "/login" "general host /manifest start_url"
expect_equals "$(fetch_json_field "$ADMIN_HOST" "/manifest.webmanifest" name)" "GW Cloudflare-first Skeleton" "admin host /manifest remains general manifest"
expect_equals "$(fetch_json_field "$ADMIN_HOST" "/admin/manifest.webmanifest" name)" "GW Admin" "admin host /admin/manifest name"
expect_equals "$(fetch_json_field "$ADMIN_HOST" "/admin/manifest.webmanifest" start_url)" "/admin" "admin host /admin/manifest start_url"

echo
echo "== HTML manifest href checks =="
expect_equals "$(fetch_html_manifest_href "$GENERAL_HOST" "/")" "/manifest.webmanifest" "general host root manifest href"
expect_equals "$(fetch_html_manifest_href "$ADMIN_HOST" "/")" "/admin/manifest.webmanifest" "admin host root manifest href"
expect_equals "$(fetch_html_manifest_href "$ADMIN_HOST" "/admin")" "/admin/manifest.webmanifest" "admin host /admin manifest href"

echo
echo "== Redirect boundary checks (manual) =="
check_redirect "$GENERAL_HOST" "/admin" "307" "/login" "general host /admin"
check_redirect "$ADMIN_HOST" "/" "307" "/admin" "admin host root"

echo
echo "== Redirect boundary checks (follow) =="
check_follow_status "$GENERAL_HOST" "/admin" "200" "general host /admin"
check_follow_status "$ADMIN_HOST" "/" "200" "admin host root"

echo
echo "Preview admin-host smoke passed"
echo "- base_url: ${BASE_URL}"
echo "- general host: ${GENERAL_HOST}"
echo "- admin host: ${ADMIN_HOST}"
echo "- verified: /manifest.webmanifest, /admin/manifest.webmanifest, HTML manifest href on / and /admin, /admin, / (manual + follow redirects)"
