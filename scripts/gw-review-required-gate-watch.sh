#!/usr/bin/env bash
set -euo pipefail

# 그룹웨어 review-required 자동 게이트 감시 루프
#
# 사용법:
#   ./scripts/gw-review-required-gate-watch.sh [interval_seconds]
#
# 기능:
# - 일정 간격으로 blocked review-required 카드를 찾는다.
# - 발견하면 gw-review-required-gate.sh가 표준 검증 후 complete + dispatch를 수행한다.
# - 일반 blocked, scheduled 승인 대기, 실제 실패 카드는 건드리지 않는다.

INTERVAL_SECONDS="${1:-60}"
WORKDIR="/home/wrhrgw/gw"
export HERMES_HOME="${HERMES_HOME:-/home/wrhrgw/gw-dev-bot/.hermes}"
CORRUPT_BACKOFF_SECONDS="${CORRUPT_BACKOFF_SECONDS:-1800}"

cd "$WORKDIR"
source ./scripts/gw-hermes-env.sh

echo "그룹웨어 review-required 자동 게이트 감시 시작"
echo "interval=${INTERVAL_SECONDS}s"
echo "workdir=${WORKDIR}"
echo

while true; do
  now="$(date '+%F %T')"
  echo "[$now] review-required gate check"
  if ./scripts/gw-review-required-gate.sh; then
    rc=0
  else
    rc=$?
    if [[ "$rc" -eq 75 ]]; then
      echo "[$now] Kanban DB 손상 신호 감지. ${CORRUPT_BACKOFF_SECONDS}s 동안 장기 대기"
      sleep "$CORRUPT_BACKOFF_SECONDS"
      continue
    fi
    echo "[$now] gate check failed(rc=$rc); 다음 주기에 재시도"
  fi
  sleep "$INTERVAL_SECONDS"
done
