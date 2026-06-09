#!/usr/bin/env bash
set -euo pipefail

# 그룹웨어 Kanban 단일 작업 감시 스크립트
# 사용법:
#   ./scripts/gw-kanban-watch-task.sh <task_id> [board] [interval_seconds]
# 예:
#   ./scripts/gw-kanban-watch-task.sh t_b1b04835 groupware 60
#
# hermes show 출력의 status 줄을 Bash 정규식으로 직접 읽는다.

TASK_ID="${1:?task id required}"
BOARD="${2:-groupware}"
INTERVAL_SECONDS="${3:-60}"
WORKDIR="/home/wrhrgw/gw"

cd "$WORKDIR"
source ./scripts/gw-hermes-env.sh

extract_status() {
  local output="$1" line status
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*status:[[:space:]]*([a-z_]+)[[:space:]]*$ ]]; then
      status="${BASH_REMATCH[1]}"
      printf '%s
' "$status"
      return 0
    fi
  done <<< "$output"
  while IFS= read -r line; do
    if [[ "$line" =~ (^|[[:space:]])${TASK_ID}[[:space:]]+(triage|todo|scheduled|ready|running|blocked|review|done|archived)([[:space:]]|$) ]]; then
      status="${BASH_REMATCH[2]}"
      printf '%s
' "$status"
      return 0
    fi
  done <<< "$output"
  printf 'unknown
'
}

while true; do
  now="$(date '+%F %T')"
  if ! output="$($HERMES_BIN kanban --board "$BOARD" show "$TASK_ID" 2>&1)"; then
    echo "$now status=error"
    echo "$output" | tail -20
    sleep "$INTERVAL_SECONDS"
    continue
  fi
  status="$(extract_status "$output")"
  echo "$now status=$status"
  case "$status" in
    done|blocked|review|archived)
      echo '--- final status ---'
      printf '%s
' "$output"
      echo '--- recent runs ---'
      "$HERMES_BIN" kanban --board "$BOARD" runs "$TASK_ID" | tail -30 || true
      echo '--- recent log ---'
      "$HERMES_BIN" kanban --board "$BOARD" log "$TASK_ID" | tail -100 || true
      exit 0
      ;;
  esac
  sleep "$INTERVAL_SECONDS"
done
