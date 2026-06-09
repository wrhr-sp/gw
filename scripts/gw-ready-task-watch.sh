#!/usr/bin/env bash
set -euo pipefail

INTERVAL_SECONDS="${1:-60}"
STALE_SECONDS="${2:-180}"
BOARD="groupware"
MAX_DISPATCH="${MAX_DISPATCH:-1}"

cd /home/wrhrgw/gw
source ./scripts/gw-hermes-env.sh

find_stale_ready_tasks() {
  local json_output
  if ! json_output="$($HERMES_BIN kanban --board "$BOARD" list --json)"; then
    echo "kanban-list-error" >&2
    return 2
  fi
  JSON_OUTPUT="$json_output" python3 - "$STALE_SECONDS" <<'PY'
import json, os, sys, time
stale_seconds=int(sys.argv[1]); now=int(time.time())
try:
    tasks=json.loads(os.environ.get('JSON_OUTPUT','[]'))
except Exception as exc:
    print(f'json-parse-error:{exc}', file=sys.stderr); sys.exit(2)
for task in tasks:
    if task.get('status') != 'ready':
        continue
    created_at=int(task.get('created_at') or 0)
    started_at=task.get('started_at')
    age=now-created_at if created_at else 0
    if not started_at and age >= stale_seconds:
        print(f"{task.get('id')}\t{age}\t{task.get('assignee')}\t{task.get('title')}")
PY
}

echo "그룹웨어 ready 카드 대기 감시 시작"
echo "interval=${INTERVAL_SECONDS}s stale=${STALE_SECONDS}s board=${BOARD}"
while true; do
  now="$(date '+%F %T')"
  echo "[$now] ready task check"
  if stale="$(find_stale_ready_tasks)"; then rc=0; else rc=$?; fi
  if [[ "$rc" -ne 0 ]]; then
    echo "[$now] Kanban 보드 확인 실패(rc=$rc). dispatch 생략"
  elif [[ -n "$stale" ]]; then
    echo "[$now] 오래 대기 중인 ready 카드 감지:"
    echo "$stale"
    "$HERMES_BIN" kanban --board "$BOARD" dispatch --max "$MAX_DISPATCH" || true
  else
    echo "[$now] 오래 대기 중인 ready 카드 없음"
  fi
  sleep "$INTERVAL_SECONDS"
done
