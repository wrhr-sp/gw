#!/usr/bin/env bash
set -euo pipefail

# 그룹웨어 Kanban 직렬 그래프 감시/dispatch 가드
#
# 목적:
# - groupware board에서 한 번에 worker 1개만 실행되게 한다.
# - running/ready가 있으면 새 dispatch를 하지 않는다.
# - ready가 2개 이상이면 첫 번째만 남기고 나머지는 scheduled로 되돌려 병렬 실행을 막는다.
# - running/ready가 모두 0이면 parent가 모두 done인 scheduled/todo 후보 1개만 ready/promote 후 dispatch --max 1 한다.
# - 상태 변경은 Kanban CLI만 사용하고 DB는 read-only로 조회한다.

ROOT="/home/wrhrgw/gw"
BOARD="${GW_KANBAN_BOARD:-groupware}"
INTERVAL="60"
ONCE=0
DRY_RUN=0
STATE_FILE="$ROOT/.hermes/gw-serial-graph-watch.state.json"
KANBAN_LOCK="${KANBAN_LOCK:-$ROOT/.hermes/locks/gw-kanban.lock}"
CORRUPT_BACKOFF_SECONDS="${CORRUPT_BACKOFF_SECONDS:-1800}"

usage() {
  cat <<'EOF'
사용법:
  ./scripts/gw-serial-graph-watch.sh [--once] [--dry-run] [--interval 초] [--board groupware]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --interval) INTERVAL="${2:?--interval requires seconds}"; shift 2 ;;
    --board) BOARD="${2:?--board requires board}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; usage >&2; exit 2 ;;
  esac
done

cd "$ROOT"
source "$ROOT/scripts/gw-hermes-env.sh"
mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$KANBAN_LOCK")"

is_positive_int() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }
is_positive_int "$INTERVAL" || { echo "interval은 양의 정수여야 합니다: $INTERVAL" >&2; exit 2; }

run_once() {
  flock -n "$STATE_FILE.lock" python3 - "$BOARD" "$STATE_FILE" "$KANBAN_LOCK" "$DRY_RUN" <<'PY'
from __future__ import annotations
import json
import os
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

board, state_arg, lock, dry_run_arg = sys.argv[1:5]
root = Path('/home/wrhrgw/gw')
state_path = Path(state_arg)
dry_run = dry_run_arg == '1'
hermes = os.environ['HERMES_BIN']
profile = os.environ.get('HERMES_PROFILE', 'singde')
env = os.environ.copy()
env.setdefault('HERMES_HOME', '/home/wrhrgw/gw-dev-bot/.hermes')
kanban_db = Path(env['HERMES_HOME']) / 'kanban' / 'boards' / board / 'kanban.db'
if not kanban_db.exists():
    kanban_db = Path(env['HERMES_HOME']) / 'kanban.db'

HOLD_MARKERS = (
    '외부연동', '승인 게이트', '승인게이트', 'approval gate', 'external integration',
    'manual hold', '수동 대기', '수동 promote', '수동 재개', 'keep scheduled',
    'scheduled 유지', 'superseded', 'archive 전 승인', 'DNS', 'custom domain',
    'production DB', 'prod DB', '운영 DB', '실데이터', '유료', 'secret', '.env',
    'destructive', 'force', '강제 삭제', '마이그레이션', 'migration',
)
PIPELINE_MARKERS = (
    '기획', 'fit-gap', '구현', '수정', '리뷰', '검토', '테스트', '검증', '문서화',
    'GitHub', 'PR', 'CI', 'merge', 'release gate', '배포 확인', '최종 통합 보고',
    '최종보고', '작업 최종 결과', '복구 정리', '자동 재수정', '자동 재리뷰', '자동 재검증',
)


def run(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    p = subprocess.run(args, cwd=root, env=env, text=True, capture_output=True)
    if check and p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout).strip())
    return p


def kanban(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(['flock', lock, hermes, '-p', profile, 'kanban', '--board', board, *args], check=check)


def connect_ro() -> sqlite3.Connection:
    con = sqlite3.connect(f'file:{kanban_db}?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    return con


def load_tasks() -> list[dict]:
    con = connect_ro()
    rows = con.execute(
        """
        select id,title,body,assignee,status,priority,created_at,started_at,completed_at,result
        from tasks
        where status in ('todo','scheduled','ready','running','blocked')
        order by priority desc, created_at asc
        """
    ).fetchall()
    tasks = [dict(r) for r in rows]
    for t in tasks:
        t['parents'] = [r['parent_id'] for r in con.execute('select parent_id from task_links where child_id=? order by parent_id', (t['id'],)).fetchall()]
    con.close()
    return tasks


def all_parents_done(task: dict) -> bool:
    parents = task.get('parents') or []
    if not parents:
        return True
    con = connect_ro()
    q = ','.join('?' for _ in parents)
    rows = con.execute(f'select id,status from tasks where id in ({q})', parents).fetchall()
    con.close()
    statuses = {r['id']: r['status'] for r in rows}
    return bool(rows) and all(statuses.get(pid) == 'done' for pid in parents)


def is_hold(task: dict) -> bool:
    text = f"{task.get('title') or ''}\n{task.get('body') or ''}".lower()
    return any(m.lower() in text for m in HOLD_MARKERS)


def is_pipeline_candidate(task: dict) -> bool:
    text = f"{task.get('title') or ''}\n{task.get('body') or ''}"
    return any(m in text for m in PIPELINE_MARKERS)


def save_state(event: dict) -> None:
    current = {'events': []}
    if state_path.exists():
        try:
            current = json.loads(state_path.read_text())
        except Exception:
            current = {'events': []}
    events = current.get('events') or []
    events.append(event)
    current['events'] = events[-100:]
    current['last_checked_at'] = int(time.time())
    tmp = state_path.with_suffix('.tmp')
    tmp.write_text(json.dumps(current, ensure_ascii=False, indent=2))
    tmp.replace(state_path)


def comment(tid: str, body: str) -> None:
    if dry_run:
        print(f'dry-run comment {tid}: {body.splitlines()[0]}')
        return
    kanban('comment', tid, body, check=False)


def schedule(tid: str, reason: str) -> None:
    if dry_run:
        print(f'dry-run schedule {tid}: {reason}')
        return
    # `schedule` takes the reason as a positional tail, not --reason.
    kanban('schedule', tid, reason, check=False)


def unblock(tid: str, reason: str) -> None:
    if dry_run:
        print(f'dry-run unblock {tid}: {reason}')
        return
    kanban('unblock', tid, '--reason', reason, check=False)


def promote(tid: str, reason: str) -> None:
    if dry_run:
        print(f'dry-run promote {tid}: {reason}')
        return
    # `promote` takes the reason as a positional tail, not --reason.
    kanban('promote', tid, reason, check=False)


def dispatch_one() -> str:
    if dry_run:
        return kanban('dispatch', '--dry-run', '--max', '1', check=False).stdout
    return kanban('dispatch', '--max', '1', check=False).stdout


tasks = load_tasks()
running = [t for t in tasks if t['status'] == 'running']
ready = [t for t in tasks if t['status'] == 'ready']
if running:
    event = {'action': 'hold-running', 'running': [t['id'] for t in running], 'ready': [t['id'] for t in ready]}
    print(f"serial graph guard: running={len(running)} ready={len(ready)} -> 새 dispatch 보류")
    save_state(event)
    sys.exit(0)

if len(ready) > 1:
    keep = ready[0]
    for t in ready[1:]:
        reason = f"serial graph guard: {keep['id']} ready를 먼저 실행하기 위해 병렬 ready 카드 대기 전환"
        comment(t['id'], f"[serial-graph-guard]\n{reason}\n한 번에 하나의 groupware 그래프/worker만 실행합니다.")
        schedule(t['id'], reason)
    event = {'action': 'schedule-extra-ready', 'kept': keep['id'], 'scheduled': [t['id'] for t in ready[1:]]}
    print(f"serial graph guard: ready {len(ready)}개 중 {keep['id']}만 유지, 나머지 scheduled")
    save_state(event)
    out = dispatch_one()
    print(out.strip())
    sys.exit(0)

if len(ready) == 1:
    event = {'action': 'dispatch-existing-ready', 'ready': ready[0]['id']}
    print(f"serial graph guard: ready={ready[0]['id']} 1개만 dispatch")
    save_state(event)
    out = dispatch_one()
    print(out.strip())
    sys.exit(0)

# running=0, ready=0: one next candidate only.
candidates = []
for t in tasks:
    if t['status'] not in {'scheduled', 'todo'}:
        continue
    if is_hold(t):
        continue
    if not all_parents_done(t):
        continue
    if not is_pipeline_candidate(t):
        continue
    candidates.append(t)

if not candidates:
    print('serial graph guard: running=0 ready=0, 자동 재개 후보 없음')
    save_state({'action': 'idle-no-candidate'})
    sys.exit(0)

chosen = candidates[0]
reason = 'serial graph guard: 이전 카드 완료 후 다음 groupware 카드 1개만 자동 재개'
comment(chosen['id'], f"[serial-graph-guard]\n{reason}\n규칙: 한 번에 하나의 그래프/worker만 실행하고, 이 카드가 최종 완료된 뒤 다음 후보를 재개합니다.")
if chosen['status'] == 'scheduled':
    unblock(chosen['id'], reason)
elif chosen['status'] == 'todo':
    promote(chosen['id'], reason)
print(f"serial graph guard: next={chosen['id']} {chosen['title']}")
save_state({'action': 'promote-next', 'task': chosen['id'], 'status': chosen['status']})
out = dispatch_one()
print(out.strip())
PY
}

if [[ "$ONCE" == "1" ]]; then
  run_once
else
  while true; do
    if ! run_once; then
      rc=$?
      echo "[$(date '+%F %T')] serial graph guard failed rc=$rc"
      if [[ "$rc" -eq 75 ]]; then
        sleep "$CORRUPT_BACKOFF_SECONDS"
      fi
    fi
    sleep "$INTERVAL"
  done
fi
