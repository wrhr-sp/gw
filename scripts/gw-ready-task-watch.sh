#!/usr/bin/env bash
set -euo pipefail

# 그룹웨어 ready 카드 장기 대기 감시 루프
#
# 사용법:
#   ./scripts/gw-ready-task-watch.sh [interval_seconds] [stale_seconds]
#
# 기능:
# - ready 카드가 stale_seconds 이상 대기하면 dispatcher를 한 번 실행한다.
# - scheduled/blocked 승인 대기 카드는 건드리지 않는다.
# - Gateway dispatcher가 일시적으로 놓친 ready 카드를 다시 밀어준다.

INTERVAL_SECONDS="${1:-60}"
STALE_SECONDS="${2:-180}"
BOARD="groupware"
WORKDIR="/home/wrhrgw/gw"
MAX_DISPATCH="${MAX_DISPATCH:-1}"
KANBAN_LOCK="${KANBAN_LOCK:-/home/wrhrgw/gw/.hermes/locks/gw-kanban.lock}"
CORRUPT_BACKOFF_SECONDS="${CORRUPT_BACKOFF_SECONDS:-1800}"

cd "$WORKDIR"
source ./scripts/gw-hermes-env.sh
mkdir -p "$(dirname "$KANBAN_LOCK")"

is_corrupt_kanban_error() {
  local text="${1,,}"
  [[ "$text" == *"database disk image is malformed"* \
    || "$text" == *"file is not a database"* \
    || "$text" == *"disk i/o error"* \
    || "$text" == *"refusing to open corrupt kanban db"* ]]
}

kanban_call() {
  flock "$KANBAN_LOCK" "$HERMES_BIN" kanban --board "$BOARD" "$@"
}

find_stale_ready_tasks() {
  local json_output json_file
  if ! json_output="$(kanban_call list --json 2>&1)"; then
    echo "$json_output" >&2
    if is_corrupt_kanban_error "$json_output"; then
      echo "kanban-corrupt-circuit-breaker" >&2
      return 75
    fi
    echo "kanban-list-error" >&2
    return 2
  fi
  json_file="$(mktemp)"
  printf '%s' "$json_output" > "$json_file"
  python3 - "$STALE_SECONDS" "$json_file" <<'PY'
import json
import sys
import time
from pathlib import Path

stale_seconds = int(sys.argv[1])
json_file = Path(sys.argv[2])
now = int(time.time())
try:
    tasks = json.loads(json_file.read_text() or "[]")
except Exception as exc:
    print(f"json-parse-error:{exc}", file=sys.stderr)
    sys.exit(2)
finally:
    try:
        json_file.unlink()
    except FileNotFoundError:
        pass
for task in tasks:
    if task.get("status") != "ready":
        continue
    created_at = int(task.get("created_at") or 0)
    started_at = task.get("started_at")
    age = now - created_at if created_at else 0
    if not started_at and age >= stale_seconds:
        print(f"{task.get('id')}\t{age}\t{task.get('assignee')}\t{task.get('title')}")
PY
}

echo "그룹웨어 ready 카드 대기 감시 시작"
echo "interval=${INTERVAL_SECONDS}s"
echo "stale=${STALE_SECONDS}s"
echo "workdir=${WORKDIR}"
echo

while true; do
  now="$(date '+%F %T')"
  echo "[$now] ready task check"
  if stale="$(find_stale_ready_tasks)"; then
    rc=0
  else
    rc=$?
  fi
  if [[ "$rc" -ne 0 ]]; then
    echo "[$now] Kanban 보드 확인 실패(rc=$rc). 새 dispatch를 실행하지 않음"
  elif [[ -n "$stale" ]]; then
    echo "[$now] 오래 대기 중인 ready 카드 감지:"
    echo "$stale"
    echo "[$now] dispatcher 실행(max=${MAX_DISPATCH})"
    if ! dispatch_output="$(kanban_call dispatch --max "$MAX_DISPATCH" 2>&1)"; then
      echo "$dispatch_output"
      if is_corrupt_kanban_error "$dispatch_output"; then
        echo "[$now] Kanban DB 손상 신호 감지. ${CORRUPT_BACKOFF_SECONDS}s 동안 장기 대기"
        sleep "$CORRUPT_BACKOFF_SECONDS"
        continue
      fi
      echo "[$now] dispatcher 실행 실패; 다음 주기에 재시도"
    else
      echo "$dispatch_output"
    fi
  else
    echo "[$now] 오래 대기 중인 ready 카드 없음"
  fi
  if [[ "$rc" -eq 75 ]]; then
    echo "[$now] Kanban DB 손상 신호 감지. ${CORRUPT_BACKOFF_SECONDS}s 동안 장기 대기"
    sleep "$CORRUPT_BACKOFF_SECONDS"
  else
    sleep "$INTERVAL_SECONDS"
  fi
done
