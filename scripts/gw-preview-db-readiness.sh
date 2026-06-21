#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEON_ENV="$ROOT/.secrets/neon.env"

mask_url() {
  python3 - "$1" <<'PY'
from urllib.parse import urlparse
import sys
url = sys.argv[1]
if not url:
    print('missing')
    raise SystemExit(0)
parsed = urlparse(url)
host = parsed.hostname or 'unknown'
if len(host) > 12:
    host = host[:4] + '…' + host[-6:]
db = (parsed.path or '/').lstrip('/') or 'unknown'
scheme = parsed.scheme or 'unknown'
print(f"{scheme}://{host}/{db}")
PY
}

echo "그룹웨어 preview DB 준비 상태 점검"

if [[ ! -f "$NEON_ENV" ]]; then
  echo "missing: .secrets/neon.env"
  echo "hint: cp .secrets/neon.env.template .secrets/neon.env 후 실제 값은 로컬에서만 채우세요."
  echo "result: blocked - preview DB secret 파일이 없습니다."
  exit 2
fi

# shellcheck disable=SC1090
set -a; source "$NEON_ENV"; set +a

echo "ok: .secrets/neon.env exists"

PREVIEW_URL="${DATABASE_URL_PREVIEW:-${DATABASE_URL:-}}"
PRODUCTION_URL="${DATABASE_URL_PRODUCTION:-}"

if [[ -n "$PREVIEW_URL" ]]; then
  echo "ok: preview DB URL present ($(mask_url "$PREVIEW_URL"))"
else
  echo "missing: DATABASE_URL_PREVIEW or DATABASE_URL"
  echo "result: blocked - preview DB URL 이 없습니다."
  exit 2
fi

if [[ -n "$PRODUCTION_URL" ]]; then
  echo "ok: production DB URL separated ($(mask_url "$PRODUCTION_URL"))"
else
  echo "note: DATABASE_URL_PRODUCTION not set (현재 카드는 preview/manual check 범위만 허용)"
fi

echo "policy: Hyperdrive 는 현재 필수 입력이 아니라 후속 후보입니다."
echo "policy: production migration / custom domain / paid resource 증설은 이 점검 범위 밖입니다."

echo "preview smoke next: pnpm db:pg:check -> ./scripts/gw-db-safe.sh --env staging --mode status -> 승인된 경우 migrate/apply"
echo "result: ready-for-preview-db-ops"
