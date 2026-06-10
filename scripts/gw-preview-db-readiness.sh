#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEON_ENV="$ROOT/.secrets/neon.env"
CF_PREVIEW_ENV="$ROOT/.secrets/cloudflare-preview-db.env"

echo "그룹웨어 preview DB 준비 상태 점검"

if [[ ! -f "$NEON_ENV" ]]; then
  echo "missing: .secrets/neon.env"
  echo "hint: cp .secrets/neon.env.template .secrets/neon.env 후 실제 값은 로컬에서만 채우세요."
else
  # shellcheck disable=SC1090
  set -a; source "$NEON_ENV"; set +a
  echo "ok: .secrets/neon.env exists"
fi

if [[ -f "$CF_PREVIEW_ENV" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$CF_PREVIEW_ENV"; set +a
  echo "ok: .secrets/cloudflare-preview-db.env exists"
fi

required=(
  PREVIEW_DB_TARGET_POLICY
  PREVIEW_DB_READONLY_GUARANTEE
  HYPERDRIVE_PREVIEW_CREATE_APPROVED
  HYPERDRIVE_PREVIEW_COST_SCOPE
)
missing=0
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "missing: $key"
    missing=1
  else
    echo "ok: $key present"
  fi
done

if [[ -n "${PREVIEW_DATABASE_READONLY_URL:-}" || -n "${PREVIEW_DATABASE_URL:-}" ]]; then
  echo "ok: preview read-only DB URL present"
else
  echo "missing: PREVIEW_DATABASE_READONLY_URL or PREVIEW_DATABASE_URL"
  missing=1
fi

if [[ -n "${PREVIEW_DATABASE_ADMIN_URL:-}" ]]; then
  echo "ok: preview admin/migration DB URL present"
else
  echo "missing: PREVIEW_DATABASE_ADMIN_URL"
  echo "note: migration 적용은 admin URL 없이는 진행하지 않습니다."
fi

if [[ "${HYPERDRIVE_PREVIEW_CREATE_APPROVED:-no}" != "yes" ]]; then
  echo "blocked: HYPERDRIVE_PREVIEW_CREATE_APPROVED must be yes"
  missing=1
fi

if [[ "$missing" -ne 0 ]]; then
  echo "result: blocked - preview DB/Hyperdrive 입력이 부족합니다."
  exit 2
fi

echo "result: ready-for-preview-db-ops"
