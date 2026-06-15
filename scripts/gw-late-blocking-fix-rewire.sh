#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/wrhrgw/gw
BOARD="groupware"
TASK_ID=""
DRY_RUN=0
STATE_FILE="$ROOT/.hermes/gw-late-blocking-fix-rewire.state"
KANBAN_DB="${KANBAN_DB:-/home/wrhrgw/gw-dev-bot/.hermes/kanban/boards/groupware/kanban.db}"

usage() {
  cat <<'EOF'
사용법:
  ./scripts/gw-late-blocking-fix-rewire.sh --task <task_id> [--board groupware] [--dry-run]

역할:
  late blocking fix(대개 리뷰 중 새로 생긴 fix 카드)가 생겼을 때,
  기존 downstream 검증/문서화/PR 카드가 이미 ready/running 이면
  안전하게 reclaim/schedule 하고 새 fix 리뷰 경로를 추가 parent 로 연결합니다.

원칙:
- Kanban DB 직접 write 금지, 상태 변경은 Hermes CLI 로만 수행
- DB 는 read-only 로만 조회
- ready/running 카드만 건드림
- 이미 같은 parent link 가 있으면 중복 연결하지 않음
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task)
      TASK_ID="${2:?--task requires task id}"
      shift 2
      ;;
    --board)
      BOARD="${2:?--board requires board}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "알 수 없는 옵션: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$TASK_ID" ]]; then
  echo "--task 가 필요합니다." >&2
  exit 2
fi

cd "$ROOT"
source ./scripts/gw-hermes-env.sh
mkdir -p "$(dirname "$STATE_FILE")"

python3 - "$TASK_ID" "$BOARD" "$DRY_RUN" "$STATE_FILE" "$KANBAN_DB" <<'PY'
from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

TASK_ID, BOARD, DRY_RUN, STATE_FILE, KANBAN_DB = sys.argv[1:6]
ROOT = Path('/home/wrhrgw/gw')
HERMES_BIN = os.environ['HERMES_BIN']
PROFILE = os.environ.get('HERMES_PROFILE', 'singde')
DRY = DRY_RUN == '1'
STATE_PATH = Path(STATE_FILE)

ACTIVE_STATUSES = {'ready', 'running'}
STAGE_ORDER = ['gwtester', 'gwdocs', 'gwops', 'singde']
STAGE_LABEL = {
    'gwtester': '검증',
    'gwdocs': '문서화',
    'gwops': 'PR/릴리즈',
    'singde': '최종 정리',
}


def run(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault('HERMES_HOME', '/home/wrhrgw/gw-dev-bot/.hermes')
    proc = subprocess.run(args, cwd=ROOT, env=env, text=True, capture_output=True)
    if check and proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return proc


def kanban(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run([HERMES_BIN, '-p', PROFILE, 'kanban', '--board', BOARD, *args], check=check)


def ro_connect() -> sqlite3.Connection:
    con = sqlite3.connect(f'file:{KANBAN_DB}?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    return con


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {'handled': {}}
    try:
        data = json.loads(STATE_PATH.read_text(encoding='utf-8'))
        if isinstance(data, dict):
            data.setdefault('handled', {})
            return data
    except Exception:
        pass
    return {'handled': {}}


def save_state(state: dict) -> None:
    tmp = STATE_PATH.with_suffix('.tmp')
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(STATE_PATH)


def get_task(con: sqlite3.Connection, task_id: str) -> dict | None:
    row = con.execute(
        'select id, title, body, assignee, status, created_at from tasks where id=?',
        (task_id,),
    ).fetchone()
    return dict(row) if row else None


def parents_of(con: sqlite3.Connection, task_id: str) -> list[str]:
    return [r[0] for r in con.execute('select parent_id from task_links where child_id=? order by parent_id', (task_id,)).fetchall()]


def children_of(con: sqlite3.Connection, task_id: str) -> list[str]:
    return [r[0] for r in con.execute('select child_id from task_links where parent_id=? order by child_id', (task_id,)).fetchall()]


def descendants_of(con: sqlite3.Connection, task_id: str) -> list[dict]:
    rows = con.execute(
        '''
        with recursive d(id, depth) as (
          select child_id, 1 from task_links where parent_id=?
          union all
          select tl.child_id, d.depth + 1
          from task_links tl
          join d on tl.parent_id = d.id
        )
        select t.id, t.title, t.body, t.assignee, t.status, t.created_at, min(d.depth) as depth
        from d
        join tasks t on t.id = d.id
        group by t.id, t.title, t.body, t.assignee, t.status, t.created_at
        order by depth asc, t.created_at asc, t.id asc
        ''',
        (task_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def resolve_context(con: sqlite3.Connection, task_id: str) -> tuple[dict, dict, dict] | None:
    task = get_task(con, task_id)
    if not task:
        return None
    if task.get('assignee') == 'gwbuilder':
        late_fix = task
        reviewer_parent = None
        for pid in parents_of(con, task_id):
            parent = get_task(con, pid)
            if parent and parent.get('assignee') == 'gwreviewer':
                reviewer_parent = parent
                break
        if not reviewer_parent:
            return None
        late_review = None
        for cid in children_of(con, task_id):
            child = get_task(con, cid)
            if child and child.get('assignee') == 'gwreviewer':
                late_review = child
                break
        if not late_review:
            return None
        return late_fix, reviewer_parent, late_review
    if task.get('assignee') == 'gwreviewer':
        late_review = task
        late_fix = None
        for pid in parents_of(con, task_id):
            parent = get_task(con, pid)
            if parent and parent.get('assignee') == 'gwbuilder':
                late_fix = parent
                break
        if not late_fix:
            return None
        reviewer_parent = None
        for pid in parents_of(con, late_fix['id']):
            parent = get_task(con, pid)
            if parent and parent.get('assignee') == 'gwreviewer':
                reviewer_parent = parent
                break
        if not reviewer_parent:
            return None
        return late_fix, reviewer_parent, late_review
    return None


def is_existing_parent(con: sqlite3.Connection, parent_id: str, child_id: str) -> bool:
    row = con.execute(
        'select 1 from task_links where parent_id=? and child_id=? limit 1',
        (parent_id, child_id),
    ).fetchone()
    return row is not None


con = ro_connect()
ctx = resolve_context(con, TASK_ID)
if not ctx:
    print(f'late-fix-rewire: skip {TASK_ID} (late blocking fix 문맥 아님)')
    raise SystemExit(0)

late_fix, upstream_review, late_review = ctx
subtree_exclude = {late_fix['id'], late_review['id']}
for d in descendants_of(con, late_fix['id']):
    subtree_exclude.add(d['id'])

candidates = [
    t for t in descendants_of(con, upstream_review['id'])
    if t['id'] not in subtree_exclude
    and t.get('status') in ACTIVE_STATUSES
    and t.get('assignee') in STAGE_ORDER
]
if not candidates:
    print(f'late-fix-rewire: no active downstream cards under {upstream_review["id"]} for {late_fix["id"]}')
    raise SystemExit(0)

by_stage: dict[str, list[dict]] = {stage: [] for stage in STAGE_ORDER}
for task in candidates:
    by_stage[task['assignee']].append(task)
for stage in STAGE_ORDER:
    by_stage[stage].sort(key=lambda t: (t.get('created_at') or 0, t['id']))

state = load_state()
handled = state.setdefault('handled', {})
now = int(time.time())
plan = []
parent_for_stage = late_review['id']
summary_parts = []

for stage in STAGE_ORDER:
    stage_tasks = by_stage.get(stage) or []
    if not stage_tasks:
        continue
    next_parent_for_stage = stage_tasks[0]['id']
    for task in stage_tasks:
        tid = task['id']
        title = str(task.get('title') or tid)
        status = str(task.get('status') or '')
        key = f'{late_review["id"]}:{parent_for_stage}:{tid}'
        actions = []
        if not is_existing_parent(con, parent_for_stage, tid):
            actions.append(('link', parent_for_stage, tid))
        if status == 'running':
            actions.append(('reclaim', tid, f'late blocking fix 감지: {late_fix["id"]} 후속 리뷰 {late_review["id"]}가 선행되어야 하므로 현재 경로를 일시 중단'))
        if status in ACTIVE_STATUSES:
            actions.append(('schedule', tid, f'late blocking fix 감지: {STAGE_LABEL.get(stage, stage)} 카드가 새 fix 리뷰 경로({late_review["id"]}) 뒤로 재배선될 때까지 안전 대기'))
        if not actions:
            continue
        plan.append((task, key, actions, parent_for_stage))
        summary_parts.append(f'{tid}({status}/{stage})<-{parent_for_stage}')
    parent_for_stage = next_parent_for_stage

if not plan:
    print(f'late-fix-rewire: nothing to do for {late_fix["id"]} -> {late_review["id"]}')
    raise SystemExit(0)

comment = (
    '[singde 자동 재배선] late blocking fix 경로를 감지해 downstream active 카드를 안전 대기시킨 뒤 '
    f'새 리뷰 경로를 추가 parent 로 연결합니다. upstream_review={upstream_review["id"]} '
    f'late_fix={late_fix["id"]} late_review={late_review["id"]} targets=' + ', '.join(summary_parts)
)

if DRY:
    print('late-fix-rewire dry-run plan:')
    print(comment)
    for task, _, actions, parent_id in plan:
        print(f'- target {task["id"]} {task.get("status")} {task.get("assignee")} parent={parent_id}')
        for action in actions:
            print('  -', action)
    raise SystemExit(0)

comment_key = f'{late_review["id"]}:comment'
if comment_key not in handled:
    kanban('comment', late_fix['id'], comment, check=False)
    handled[comment_key] = {'at': now, 'task': late_fix['id']}

for task, key, actions, _ in plan:
    if key in handled:
        continue
    for action in actions:
        kind = action[0]
        if kind == 'link':
            _, parent_id, child_id = action
            kanban('link', parent_id, child_id, check=True)
        elif kind == 'reclaim':
            _, tid, reason = action
            kanban('reclaim', tid, '--reason', reason, check=False)
        elif kind == 'schedule':
            _, tid, reason = action
            kanban('schedule', tid, reason, check=False)
    handled[key] = {
        'at': now,
        'late_fix': late_fix['id'],
        'late_review': late_review['id'],
        'upstream_review': upstream_review['id'],
        'target': task['id'],
    }

if len(handled) > 500:
    trimmed = sorted(handled.items(), key=lambda kv: kv[1].get('at', 0))[-500:]
    state['handled'] = dict(trimmed)
state['last_checked_at'] = now
save_state(state)

print('late-fix-rewire applied: ' + ', '.join(summary_parts))
PY
