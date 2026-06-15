#!/usr/bin/env bash
set -euo pipefail
ROOT=/home/wrhrgw/gw
source "$ROOT/scripts/gw-hermes-env.sh"
INTERVAL="60"
MAX_AGE="1800"
BOARD="groupware"
ONCE=0
DRY_RUN=0
FIXTURE_JSON=""
STATE_FILE="${GW_WORKER_RECOVERY_STATE_FILE:-$ROOT/.hermes/gw-worker-recovery-watch.state.json}"
KANBAN_LOCK="${KANBAN_LOCK:-$ROOT/.hermes/locks/gw-kanban.lock}"
CORRUPT_BACKOFF_SECONDS="${CORRUPT_BACKOFF_SECONDS:-1800}"
mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$KANBAN_LOCK")"
usage() {
  printf '%s
' '사용법: ./scripts/gw-worker-recovery-watch.sh [--once] [--dry-run] [--fixture-json 경로] [--interval 초] [--max-age 초] [--board 보드]'
}
is_positive_int() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --fixture-json) FIXTURE_JSON="${2:?--fixture-json requires path}"; shift 2 ;;
    --interval) INTERVAL="${2:?--interval requires seconds}"; shift 2 ;;
    --max-age) MAX_AGE="${2:?--max-age requires seconds}"; shift 2 ;;
    --board) BOARD="${2:?--board requires board}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --) shift; while [[ $# -gt 0 ]]; do POSITIONAL+=("$1"); shift; done ;;
    -*) echo "알 수 없는 옵션: $1" >&2; usage >&2; exit 2 ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
[[ ${#POSITIONAL[@]} -ge 1 ]] && INTERVAL="${POSITIONAL[0]}"
[[ ${#POSITIONAL[@]} -ge 2 ]] && MAX_AGE="${POSITIONAL[1]}"
if [[ ${#POSITIONAL[@]} -gt 2 ]]; then echo "위치 인자는 interval max-age 두 개까지만 허용됩니다." >&2; exit 2; fi
is_positive_int "$INTERVAL" || { echo "interval은 양의 정수여야 합니다: $INTERVAL" >&2; exit 2; }
is_positive_int "$MAX_AGE" || { echo "max-age는 양의 정수여야 합니다: $MAX_AGE" >&2; exit 2; }
run_once() {
  flock -n "$STATE_FILE.lock" python3 - "$MAX_AGE" "$BOARD" "$STATE_FILE" "$KANBAN_LOCK" "$DRY_RUN" "$FIXTURE_JSON" <<'PYWORKER'
from __future__ import annotations
import json, os, sqlite3, subprocess, sys, time
from pathlib import Path

max_age = int(sys.argv[1])
board = sys.argv[2]
state_path = Path(sys.argv[3])
lock = sys.argv[4]
dry_run = sys.argv[5] == '1'
fixture_arg = sys.argv[6] if len(sys.argv) > 6 else ''
fixture_path = Path(fixture_arg) if fixture_arg else None
root = '/home/wrhrgw/gw'
bot = '/home/wrhrgw/gw-dev-bot'
profile_default = 'singde'
hermes = os.environ['HERMES_BIN']
profile = os.environ.get('HERMES_PROFILE', profile_default)
env = os.environ.copy()
env['HERMES_HOME'] = os.environ.get('HERMES_HOME', bot + '/.hermes')
KANBAN_DB = Path(os.environ.get('HERMES_KANBAN_DB') or str(Path(env['HERMES_HOME']) / 'kanban.db'))
CORRUPT = ('database disk image is malformed', 'file is not a database', 'disk i/o error', 'refusing to open corrupt kanban db')
RESTRICTED = ('secret', '.env', 'credential', 'token', 'password', 'production', 'prod db', '운영 db', '운영db', 'dns', 'domain', '유료', '비용', '결제', 'migration', '마이그레이션', '배포', 'delete', 'force', '삭제', '강제')
RECOVER = ('timeout', 'timed out', 'crash', 'crashed', 'stale', 'protocol violation', 'protocol-violation', 'iteration budget', 'iteration-budget', 'worker recovery')
FINAL_REPORT_WINDOW = int(os.environ.get('FINAL_REPORT_GUARD_WINDOW_SECONDS', '172800'))
NEXT_PHASE_WINDOW = int(os.environ.get('FINAL_REPORT_NEXT_PHASE_WINDOW_SECONDS', '172800'))
NEXT_PHASE_MAX_DISPATCH = str(int(os.environ.get('FINAL_REPORT_NEXT_PHASE_MAX_DISPATCH', '1')))
HOLD_MARKERS = (
    'keep scheduled', 'scheduled 유지', 'scheduled로 parked', 'scheduled parked',
    '자동화 안전 대기', '수동 promote', '수동 재개', '수동 재가동', '충돌 방지',
    '대기 유지', 'manual hold', 'manual promote', 'manual resume',
    'superseded', '보존한다', '재연결',
)


def run(args, check=True):
    p = subprocess.run(args, cwd=root, env=env, text=True, capture_output=True)
    if check and p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout).strip())
    return p


def kanban(*args, check=True):
    return run(['flock', lock, hermes, '-p', profile, 'kanban', '--board', board, *args], check=check)


class DummyProc:
    def __init__(self, returncode=0, stdout='', stderr=''):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def record_action(logs: list[str], text: str) -> None:
    logs.append(text)


fixture_data = {}
fixture_items = []
fixture_details = {}
fixture_task_map = {}
fixture_parent_map: dict[str, list[str]] = {}
fixture_child_map: dict[str, list[str]] = {}
use_fixture = bool(fixture_path)
if use_fixture:
    fixture_data = json.loads(fixture_path.read_text(encoding='utf-8'))
    if isinstance(fixture_data, list):
        fixture_items = fixture_data
        fixture_data = {'items': fixture_items}
    else:
        fixture_items = fixture_data.get('items') or fixture_data.get('tasks') or []
    fixture_details = fixture_data.get('details') or {}
    for item in fixture_items:
        fixture_task_map[str(item.get('id') or '')] = dict(item)
    for raw_link in fixture_data.get('task_links') or fixture_data.get('links') or []:
        if isinstance(raw_link, dict):
            parent_id = raw_link.get('parent_id') or raw_link.get('parent')
            child_id = raw_link.get('child_id') or raw_link.get('child')
        elif isinstance(raw_link, (list, tuple)) and len(raw_link) >= 2:
            parent_id, child_id = raw_link[0], raw_link[1]
        else:
            continue
        if not parent_id or not child_id:
            continue
        fixture_parent_map.setdefault(str(child_id), []).append(str(parent_id))
        fixture_child_map.setdefault(str(parent_id), []).append(str(child_id))


def looks_like_final_report(task):
    title = str(task.get('title') or '')
    body = str(task.get('body') or '')
    return any(key in title for key in ('최종 통합 보고', '작업 최종 결과', '최종보고')) or ('직접 최종 보고한다' in body)


def direct_delivery_marked(task, detail):
    fields = [
        str(task.get('summary') or ''),
        str(task.get('result') or ''),
        str(task.get('body') or ''),
    ]
    for c in detail.get('comments') or []:
        fields.append(str(c.get('body') or ''))
    text = '\n'.join(fields)
    return ('사용자 보고 완료' in text) or ('[singde-direct-delivery]' in text)


def looks_like_next_phase_candidate(task: dict) -> bool:
    title = str(task.get('title') or '').lower()
    body_head = '\n'.join(str(task.get('body') or '').lower().splitlines()[:6])
    planning_like = any(token in title for token in ('기획', 'fit-gap'))
    db_like = any(token in title for token in ('db 전환', 'database transition', 'schema', 'postgresql', 'postgres', 'r2', '저장소'))
    phase_like = 'phase' in title or '페이즈' in title
    return (phase_like and planning_like) or db_like or ('phase' in body_head and '기획' in body_head)


def load_state():
    if not state_path.exists():
        return {'generation': 0, 'handled': {}, 'last_checked_at': 0}
    try:
        d = json.loads(state_path.read_text())
        d.setdefault('generation', 0)
        d.setdefault('handled', {})
        return d
    except Exception:
        return {'generation': 0, 'handled': {}, 'last_checked_at': 0}


def save_state(st):
    tmp = state_path.with_suffix('.tmp')
    tmp.write_text(json.dumps(st, ensure_ascii=False, indent=2))
    tmp.replace(state_path)


def classify(t):
    blob = '\n'.join(str(t.get(k) or '') for k in ['title', 'body', 'result', 'status']).lower()
    if any(x in blob for x in RESTRICTED):
        return 'approval-required', '승인/운영/비밀값/배포 가능성이 있어 자동 조치하지 않고 메인봇 확인 대상으로 둡니다.'
    if any(x in blob for x in RECOVER):
        return 'safe-triage-candidate', '로그와 검증 근거 확인 후 메인봇이 안전 범위에서 재시도/재라우팅할 수 있는 후보입니다.'
    return 'manual-review', '자동 복구 조건이 부족해 수동 분류가 필요합니다.'


def ro_connect() -> sqlite3.Connection:
    con = sqlite3.connect(f'file:{KANBAN_DB}?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    return con


def db_task(con: sqlite3.Connection, task_id: str) -> dict | None:
    row = con.execute(
        'select id, title, body, assignee, status, result, created_at, started_at, completed_at from tasks where id=?',
        (task_id,),
    ).fetchone()
    return dict(row) if row else None


def parent_ids(con: sqlite3.Connection | None, task_id: str) -> list[str]:
    if use_fixture:
        return list(fixture_parent_map.get(task_id, []))
    return [r[0] for r in con.execute('select parent_id from task_links where child_id=? order by parent_id', (task_id,)).fetchall()]


def child_ids(con: sqlite3.Connection | None, task_id: str) -> list[str]:
    if use_fixture:
        return list(fixture_child_map.get(task_id, []))
    return [r[0] for r in con.execute('select child_id from task_links where parent_id=? order by child_id', (task_id,)).fetchall()]


def task_detail(con: sqlite3.Connection | None, task_id: str) -> dict:
    if use_fixture:
        base = dict(fixture_task_map.get(task_id, {}))
        detail = dict(fixture_details.get(task_id, {}))
        detail.setdefault('comments', detail.get('comments') or [])
        for key, value in base.items():
            detail.setdefault(key, value)
        return detail
    task = db_task(con, task_id) or {'id': task_id}
    comments = [
        {'body': str(r[0] or '')}
        for r in con.execute('select body from task_comments where task_id=? order by id desc limit 12', (task_id,)).fetchall()
    ]
    task['comments'] = comments
    return task


def task_lookup(con: sqlite3.Connection | None, task_id: str, list_map: dict[str, dict]) -> dict | None:
    if task_id in list_map:
        return dict(list_map[task_id])
    if use_fixture:
        task = fixture_task_map.get(task_id)
        return dict(task) if task else None
    return db_task(con, task_id)


def explicit_hold_marker(con: sqlite3.Connection | None, task_id: str, task: dict, list_map: dict[str, dict]) -> bool:
    detail = task_detail(con, task_id)
    fields = [
        str(task.get('title') or ''),
        str(task.get('body') or ''),
        str(task.get('result') or ''),
        str(task.get('summary') or ''),
    ]
    for comment in detail.get('comments') or []:
        fields.append(str(comment.get('body') or ''))
    text = '\n'.join(fields).lower()
    return any(marker in text for marker in HOLD_MARKERS)


def all_parents_done(con: sqlite3.Connection | None, task_id: str, list_map: dict[str, dict]) -> bool:
    parents = parent_ids(con, task_id)
    if not parents:
        return False
    for parent_id in parents:
        parent = task_lookup(con, parent_id, list_map)
        if not parent or str(parent.get('status') or '') != 'done':
            return False
    return True


action_logs: list[str] = []
if use_fixture:
    items = [dict(item) for item in fixture_items]
else:
    p = kanban('list', '--json', check=False)
    if p.returncode != 0:
        text = (p.stderr or p.stdout or '').lower()
        if any(x in text for x in CORRUPT):
            print('worker recovery: kanban-corrupt-circuit-breaker', file=sys.stderr)
            sys.exit(75)
        print('worker recovery: kanban list 실패:', p.stderr.strip() or p.stdout.strip(), file=sys.stderr)
        sys.exit(1)
    items = json.loads(p.stdout or '[]')
now = int(time.time())
st = load_state()
st['generation'] = int(st.get('generation') or 0) + 1
gen = st['generation']
handled = st.setdefault('handled', {})
actions = []
list_map = {str(t.get('id') or ''): dict(t) for t in items if t.get('id')}
con = None if use_fixture else ro_connect()
try:
    running_testers = []
    for t in items:
        if t.get('status') != 'running' or t.get('assignee') != 'gwtester':
            continue
        title = str(t.get('title') or '')
        if '테스트' not in title and '검증' not in title:
            continue
        workspace = t.get('workspace_path') or t.get('workspace') or root
        try:
            started = int(t.get('started_at') or 0)
        except Exception:
            started = 0
        running_testers.append((workspace, started, t))
    by_workspace = {}
    for workspace, started, task in running_testers:
        by_workspace.setdefault(workspace, []).append((started, task))
    for workspace, group in by_workspace.items():
        if len(group) <= 1:
            continue
        group.sort(key=lambda item: (item[0] or now, item[1].get('id') or ''))
        keep = group[0][1]
        for _, dup in group[1:]:
            tid = dup.get('id')
            if not tid:
                continue
            key = f'{tid}:duplicate-running-tester:{keep.get("id")}'
            if key in handled:
                continue
            reason = f'싱드 자동 조치: 같은 worktree({workspace})에서 gwtester 검증 카드가 중복 running 되어 {keep.get("id")} 기준 경로만 남기고 경합 방지를 위해 대기 처리'
            if dry_run or use_fixture:
                record_action(action_logs, f'dry-run duplicate-running-tester {tid}: would reclaim+schedule under {keep.get("id")}')
            else:
                kanban('comment', tid, f'[worker-recovery:duplicate-running-tester] {reason}', check=False)
                kanban('reclaim', tid, '--reason', reason, check=False)
                kanban('schedule', tid, reason, check=False)
            handled[key] = {'at': now, 'generation': gen, 'category': 'duplicate-running-tester', 'title': str(dup.get('title') or '')[:180]}
            actions.append((tid, 'duplicate-running-tester', 'scheduled'))

    for t in items:
        tid = t.get('id')
        status = t.get('status')
        title = t.get('title', '')
        reason = str(t.get('result') or title or '')
        if not tid:
            continue
        detected = None
        if status == 'running':
            hb = t.get('last_heartbeat_at') or t.get('started_at')
            try:
                hb = int(hb) if hb else 0
            except Exception:
                hb = 0
            if hb and now - hb > max_age:
                detected = f'stale-running>{max_age}s'
        elif status == 'blocked' and any(k in reason.lower() for k in RECOVER):
            detected = 'blocked-timeout-like'
        if not detected:
            continue
        category, hint = classify(t)
        key = f'{tid}:{detected}:{category}'
        if key in handled:
            continue
        msg = '\n'.join([
            f'[worker-recovery:{category}]',
            f'감지: {detected}',
            f'근거: status={status}, assignee={t.get("assignee") or "-"}, title={title}',
            f'복구 힌트: {hint}',
            '원칙: 자동 complete/unblock/restart 전에는 로그와 표준 검증 근거를 확인합니다. 위험 작업은 대장 승인 전 실행 금지.',
        ])
        if dry_run or use_fixture:
            record_action(action_logs, f'dry-run {tid}: would comment stale/blocked recovery hint ({detected}/{category})')
        else:
            kanban('comment', tid, msg, check=False)
        handled[key] = {'at': now, 'generation': gen, 'category': category, 'title': title[:180]}
        actions.append((tid, detected, category))

    for t in items:
        tid = t.get('id')
        if not tid or t.get('status') != 'done' or str(t.get('assignee') or '') != 'singde':
            continue
        if not looks_like_final_report(t):
            continue
        try:
            completed_at = int(t.get('completed_at') or 0)
        except Exception:
            completed_at = 0
        if completed_at and now - completed_at > FINAL_REPORT_WINDOW:
            continue
        key = f'{tid}:final-report-direct-delivery:{completed_at or 0}'
        if key in handled:
            continue
        detail = task_detail(con, tid)
        if direct_delivery_marked(t, detail):
            continue
        msg = '\n'.join([
            '[worker-recovery:final-report-direct-delivery]',
            '감지: done final-report card without explicit direct user delivery marker',
            f'근거: status=done, assignee=singde, title={str(t.get("title") or "")}',
            '조치 힌트: 카드 댓글/summary만으로는 최종보고 완료로 보지 않습니다. 같은 대화/Telegram 직접 전송 후 `사용자 보고 완료`와 `[singde-direct-delivery]` 코멘트를 남겨 주세요.',
            '원칙: watcher가 raw 이벤트를 대신 전송하지 않고, 싱드 직접 보고 누락만 감지해 재확인을 요구합니다.',
        ])
        if dry_run or use_fixture:
            record_action(action_logs, f'dry-run {tid}: would comment final-report direct-delivery reminder')
        else:
            kanban('comment', tid, msg, check=False)
        handled[key] = {'at': now, 'generation': gen, 'category': 'final-report-direct-delivery', 'title': str(t.get('title') or '')[:180]}
        actions.append((tid, 'done-without-direct-delivery-marker', 'final-report-direct-delivery'))

    for parent in items:
        parent_id = parent.get('id')
        if not parent_id or str(parent.get('status') or '') != 'done' or str(parent.get('assignee') or '') != 'singde':
            continue
        if not looks_like_final_report(parent):
            continue
        try:
            completed_at = int(parent.get('completed_at') or 0)
        except Exception:
            completed_at = 0
        if completed_at and now - completed_at > NEXT_PHASE_WINDOW:
            continue
        for child_id in child_ids(con, parent_id):
            child = task_lookup(con, child_id, list_map)
            if not child or str(child.get('status') or '') != 'scheduled':
                continue
            if not looks_like_next_phase_candidate(child):
                continue
            if not all_parents_done(con, child_id, list_map):
                continue
            if explicit_hold_marker(con, child_id, child, list_map):
                continue
            key = f'{parent_id}:{child_id}:final-report-next-phase-auto-resume:{completed_at or 0}'
            if key in handled:
                continue
            reason = f'싱드 자동 조치: 부모 최종보고 {parent_id} 완료 후 다음 Phase 기획/DB 전환 카드 {child_id}를 scheduled 상태에 남기지 않도록 재개'
            msg = '\n'.join([
                '[worker-recovery:final-report-next-phase-auto-resume]',
                '감지: done final-report parent has scheduled next-phase planning/DB-transition child',
                f'근거: parent={parent_id} ({str(parent.get("title") or "")}), child={child_id} ({str(child.get("title") or "")})',
                '조치: 모든 부모가 done 이고 별도 수동 hold 표식이 없으면 child를 자동 unblock 후 dispatch합니다.',
                '원칙: 최종보고 direct delivery 재확인과 충돌하지 않게, 다음 Phase 기획/DB 전환 카드만 제한적으로 재개합니다.',
            ])
            if dry_run or use_fixture:
                record_action(action_logs, f'dry-run final-report-next-phase-auto-resume {child_id}: would unblock and dispatch after parent {parent_id}')
            else:
                kanban('comment', child_id, msg, check=False)
                kanban('unblock', '--reason', reason, child_id, check=False)
                kanban('dispatch', '--max', NEXT_PHASE_MAX_DISPATCH, check=False)
            handled[key] = {'at': now, 'generation': gen, 'category': 'final-report-next-phase-auto-resume', 'title': str(child.get('title') or '')[:180]}
            actions.append((child_id, 'scheduled-after-final-report', 'final-report-next-phase-auto-resume'))
finally:
    if con is not None:
        con.close()

if len(handled) > 500:
    st['handled'] = dict(sorted(handled.items(), key=lambda kv: kv[1].get('at', 0))[-500:])
st['last_checked_at'] = now
save_state(st)
summary = 'worker recovery 감지/힌트: ' + ', '.join(f'{a[0]}({a[1]}/{a[2]})' for a in actions) if actions else 'worker recovery: 감지된 신규 stale/timeout/final-report 카드 없음'
if action_logs:
    summary += '\n' + '\n'.join(action_logs)
print(summary)
PYWORKER
}
if [[ "$ONCE" == "1" ]]; then
  run_once
else
  while true; do
    if ! out="$(run_once 2>&1)"; then
      rc=$?
      echo "$out"
      if [[ "$rc" -eq 75 ]]; then
        sleep "$CORRUPT_BACKOFF_SECONDS"
      else
        sleep "$INTERVAL"
      fi
    else
      echo "$out"
      sleep "$INTERVAL"
    fi
  done
fi
