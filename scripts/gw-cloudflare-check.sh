#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRET_FILE="${1:-$ROOT/.secrets/cloudflare.env}"

if [[ ! -f "$SECRET_FILE" ]]; then
  echo "Cloudflare 시크릿 파일이 없습니다: $SECRET_FILE" >&2
  exit 2
fi

perm="$(stat -c '%a' "$SECRET_FILE" 2>/dev/null || echo unknown)"
if [[ "$perm" != "600" ]]; then
  echo "권한 경고: $SECRET_FILE 권한이 $perm 입니다. chmod 600 권장." >&2
fi

set -a
# shellcheck disable=SC1090
source "$SECRET_FILE"
set +a

missing=0
for key in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
  value="${!key:-}"
  if [[ -z "$value" || "$value" == "***" || "$value" == "placeholder" ]]; then
    echo "누락: $key"
    missing=1
  else
    echo "확인: $key 입력됨(length=${#value})"
  fi
done

if [[ "$missing" == "1" ]]; then
  echo "토큰/계정 ID 입력 후 다시 실행하세요. 값은 출력하지 않습니다."
  exit 3
fi

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler 명령을 찾을 수 없습니다." >&2
  exit 4
fi

echo "wrangler 버전: $(wrangler --version)"
echo "Cloudflare 인증 확인 중..."
wrangler whoami

echo "Cloudflare 기본 인증 확인 완료"
