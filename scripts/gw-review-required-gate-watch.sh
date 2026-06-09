#!/usr/bin/env bash
set -euo pipefail

# 그룹웨어 review-required 자동 게이트 감시 루프
# 기능:
# - 일정 간격으로 blocked review-required 카드를 찾는다.
# - 발견하면 gw-review-required-gate.sh가 표준 검증 후 complete + dispatch를 수행한다.
# - 일반 blocked, scheduled 승인 대기, 실제 실패 카드는 건드리지 않는다.

INTERVAL_SECONDS="${1:-60}"
WORKDIR="/home/wrhrgw/gw"

cd "$WORKDIR"
source ./scripts/gw-hermes-env.sh

echo "그룹웨어 review-required 자동 게이트 감시 시작"
echo "interval=${INTERVAL_SECONDS}s"
echo "workdir=${WORKDIR}"
echo

while true; do
  now="$(date '+%F %T')"
  echo "[$now] review-required gate check"
  if ! ./scripts/gw-review-required-gate.sh; then
    echo "[$now] gate check failed; 다음 주기에 재시도"
  fi
  sleep "$INTERVAL_SECONDS"
done
