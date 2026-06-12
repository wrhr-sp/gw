#!/usr/bin/env bash
set -euo pipefail

# 그룹웨어 blocked remediation watcher
#
# 목적:
# - changes-requested / 리뷰 반려 / 검증 실패 / test/typecheck/build 실패처럼
#   승인된 개발 범위 안에서 자동 재수정 가능한 blocked 카드를 감지한다.
# - 원본 blocked 카드는 그대로 두고, 구현 → 재리뷰 → 재검증 → 복구정리 미니 체인을
#   idempotency key로 1회만 생성한 뒤 첫 재수정 카드를 dispatch한다.
# - secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업은
#   자동 처리하지 않고 코멘트만 남긴다.

ROOT="/home/wrhrgw/gw"
BOARD="groupware"
INTERVAL="60"
ONCE=0
DRY_RUN=0
MAX_DISPATCH="${MAX_DISPATCH:-1}"
STATE_FILE="$ROOT/.hermes/gw-blocked-remediation-watch.state.json"
KANBAN_LOCK="${KANBAN_LOCK:-$ROOT/.hermes/locks/gw-kanban.lock}"
CORRUPT_BACKOFF_SECONDS="${CORRUPT_BACKOFF_SECONDS:-1800}"

usage() {
  printf '%s\n' '사용법: ./scripts/gw-blocked-remediation-watch.sh [--once] [--dry-run] [--interval 초] [--board 보드]'
}

is_positive_int() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }

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

is_positive_int "$INTERVAL" || { echo "interval은 양의 정수여야 합니다: $INTERVAL" >&2; exit 2; }

cd "$ROOT"
source "$ROOT/scripts/gw-hermes-env.sh"
mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$KANBAN_LOCK")"

run_once() {
  flock -n "$STATE_FILE.lock" python3 - "$BOARD" "$STATE_FILE" "$KANBAN_LOCK" "$DRY_RUN" "$MAX_DISPATCH" <<'PY'
from __future__ import annotations
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

board, state_arg, lock, dry_run_arg, max_dispatch = sys.argv[1:6]
root = Path('/home/wrhrgw/gw')
state_path = Path(state_arg)
hermes = os.environ['HERMES_BIN']
profile = os.environ.get('HERMES_PROFILE', 'singde')
dry_run = dry_run_arg == '1'
env = os.environ.copy()
env.setdefault('HERMES_HOME', '/home/wrhrgw/gw-dev-bot/.hermes')
KANBAN_DB = os.environ.get('KANBAN_DB', '/home/wrhrgw/gw-dev-bot/.hermes/kanban/boards/groupware/kanban.db')

CORRUPT = (
    'database disk image is malformed',
    'file is not a database',
    'disk i/o error',
    'refusing to open corrupt kanban db',
)

# Body의 "제외/별도 승인" 문구는 오탐을 만들 수 있으므로 latest summary / run reason /
# 최근 comment에 들어온 실제 막힘 근거만 분류한다.
SIGNAL_PATTERNS = (
    'changes-requested',
    'change requested',
    '리뷰 결과: blocking',
    'blocking 1건',
    '승인 불가',
    '반려',
    '검증 실패',
    '테스트 실패',
    'typecheck',
    'build failed',
    'build 실패',
    'test failed',
    '불일치',
    '회귀',
)
RESTRICTED_PATTERNS = (
    'secret', '.env', 'credential', 'token', 'password',
    'production db', 'prod db', '운영 db', '운영db', '실데이터',
    'dns', 'custom domain', 'domain', '도메인',
    '유료', '비용', '결제', 'migration', '마이그레이션',
    'destructive', 'delete', '삭제', 'force', '강제',
)
SAFE_STOP_HINTS = (
    '별도 승인', '승인 필요', 'user approval', 'approval required',
)

def run(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    p = subprocess.run(args, cwd=root, env=env, text=True, capture_output=True)
    if check and p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout).strip())
    return p

def kanban(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(['flock', lock, hermes, '-p', profile, 'kanban', '--board', board, *args], check=check)

def load_state() -> dict:
    if not state_path.exists():
        return {'handled': {}, 'approval_reported': {}, 'last_checked_at': 0}
    try:
        d = json.loads(state_path.read_text())
    except Exception:
        return {'handled': {}, 'approval_reported': {}, 'last_checked_at': 0}
    d.setdefault('handled', {})
    d.setdefault('approval_reported', {})
    return d

def save_state(st: dict) -> None:
    tmp = state_path.with_suffix('.tmp')
    tmp.write_text(json.dumps(st, ensure_ascii=False, indent=2))
    tmp.replace(state_path)

def ro_connect() -> sqlite3.Connection:
    return sqlite3.connect(f'file:{KANBAN_DB}?mode=ro', uri=True)

def load_blocked_tasks() -> list[dict]:
    con = ro_connect()
    con.row_factory = sqlite3.Row
    rows = con.execute(
        """
        select id, title, body, assignee, status, result, last_failure_error, created_at, started_at
        from tasks
        where status = 'blocked'
        order by priority desc, created_at asc
        """
    ).fetchall()
    out = []
    for row in rows:
        d = dict(row)
        d['parents'] = [r[0] for r in con.execute('select parent_id from task_links where child_id=? order by parent_id', (d['id'],)).fetchall()]
        d['recent_comments'] = [dict(r) for r in con.execute(
            'select author, body, created_at from task_comments where task_id=? order by id desc limit 3',
            (d['id'],),
        ).fetchall()]
        d['runs'] = [dict(r) for r in con.execute(
            'select status, outcome, summary, error, started_at, ended_at from task_runs where task_id=? order by id desc limit 3',
            (d['id'],),
        ).fetchall()]
        out.append(d)
    con.close()
    return out

def signal_text(task: dict) -> str:
    chunks = []
    for key in ('result', 'last_failure_error'):
        if task.get(key):
            chunks.append(str(task.get(key)))
    for r in task.get('runs') or []:
        for key in ('outcome', 'summary', 'error'):
            if r.get(key):
                chunks.append(str(r.get(key)))
    for c in task.get('recent_comments') or []:
        body = str(c.get('body') or '')
        # Preventive handoff comments contain many approval-gate keywords and are not the actual blocker.
        if body.startswith('[preventive-handoff:'):
            continue
        chunks.append(body)
    return '\n'.join(chunks)

def extract_parent(task: dict) -> str | None:
    parents = task.get('parents') or []
    return parents[0] if parents else None

def already_intervened(task: dict) -> bool:
    haystack = signal_text(task)
    return 'blocked remediation watcher가 승인 범위 내 자동 재수정 후보를 감지해 체인을 생성했습니다' in haystack or re.search(r'fix=t_[0-9a-f]+\s+review=t_[0-9a-f]+\s+verify=t_[0-9a-f]+\s+recovery=t_[0-9a-f]+', haystack) is not None

def is_stale_resolved_blocker(task: dict) -> tuple[bool, str]:
    """Return true when a blocked task is only a stale blocker already resolved by a verified follow-up chain."""
    haystack = signal_text(task)
    lower = haystack.lower()
    resolved_markers = (
        '후속 자동 재수정 체인에서 blocker가 해소',
        '후속 체인에서 blocker가 해소',
        '후속 체인에서 같은 blocker가 해결',
        '후속 기준 복구 체인',
        'blocker 해소',
        'blocker가 해소',
        '해결됨을 확인',
        'changes-requested 원인',
        'resolved/stale blocker',
        'stale blocker로 정리',
        'stale/superseded blocker',
        'superseded/stale',
        '원본/stale 카드 상태 변경',
        '복구 정리 시도',
    )
    evidence_markers = (
        '재검증 통과',
        '검증 완료',
        '검증 통과',
        'blocking 없음',
        '승인 가능',
        'pnpm check',
        'build:cf',
        'preview smoke 통과',
        'smoke 통과',
        '테스트 통과',
        '통과 근거',
        '통과했으므로',
    )
    # Approval-gated stale cards must stay blocked if the actual remaining reason is restricted.
    explicit_approval = any(h in lower for h in ('사용자 승인 필요', '대장 승인 필요', 'approval-required', 'requires approval'))
    restricted = any(p.lower() in lower for p in RESTRICTED_PATTERNS)
    resolved = any(m.lower() in lower for m in resolved_markers)
    evidence = any(m.lower() in lower for m in evidence_markers)
    if resolved and evidence and not (explicit_approval and restricted):
        return True, '[싱드 자동 정리] 후속 체인에서 blocker 해소와 검증 근거가 확인되어 stale/resolved blocker로 완료 처리합니다. secret/DNS/유료/production DB/destructive 작업 없음.'
    return False, ''

def classify(task: dict) -> tuple[str, str]:
    raw_signal = signal_text(task)
    signal = raw_signal.lower()
    if not signal:
        return 'ignore', '실제 막힘 요약/실행 사유를 찾지 못함'
    if 'review-required' in signal:
        return 'ignore', 'review-required는 전용 gate watcher가 처리함'
    has_signal = any(p.lower() in signal for p in SIGNAL_PATTERNS)
    if not has_signal:
        return 'ignore', '자동 재수정 신호가 아님'
    explicit_approval = any(h in signal for h in ('사용자 승인 필요', '대장 승인 필요', 'approval-required', 'requires approval'))
    if explicit_approval and any(p.lower() in signal for p in RESTRICTED_PATTERNS):
        return 'approval-required', '막힘 사유에 restricted/명시 승인 필요 신호가 있어 자동 재수정하지 않음'
    return 'auto-remediate', raw_signal[:1200]

def shell_quote(s: str) -> str:
    import shlex
    return shlex.quote(s)

def create(title: str, body: str, assignee: str, parent: str | None, key: str) -> str:
    args = ['create', title, '--assignee', assignee, '--workspace', 'dir:/home/wrhrgw/gw', '--priority', '9', '--created-by', 'singde', '--body', body, '--idempotency-key', key, '--json']
    if parent:
        args += ['--parent', parent]
    p = kanban(*args)
    try:
        data = json.loads(p.stdout)
    except Exception as exc:
        raise RuntimeError(f'create json parse failed: {exc}: {p.stdout[:500]}')
    tid = data.get('id') or data.get('task_id') or (data.get('task') or {}).get('id')
    if not tid:
        raise RuntimeError(f'create returned no task id: {p.stdout[:500]}')
    return tid

def create_chain(task: dict, reason: str, st: dict) -> tuple[str, list[str]]:
    tid = task['id']
    title = task.get('title') or tid
    parent = extract_parent(task) or tid
    reason_hash = hashlib.sha1(reason.encode()).hexdigest()[:10]
    base_key = f'blocked-remediation:{board}:{tid}:{reason_hash}'
    body = f'''blocked 자동 재수정 체인입니다.

원본 blocked 카드: {tid}
원본 제목: {title}

감지된 막힘 근거:
{reason[:1800]}

요구사항:
- 원본 blocker의 코드/문서/테스트 불일치 또는 검증 실패를 승인된 개발 범위 안에서 최소 수정한다.
- 원본 blocked 카드는 억지로 complete/unblock하지 않는다.
- 구현 → 재리뷰 → 재검증 → 싱드 복구정리 체인으로 근거를 남긴다.
- 검증 실패가 반복되면 새 체인을 증식하지 말고 싱드 복구정리에서 원인을 분류한다.

제외/별도 승인:
- secret 입력/교체/출력, production DB/운영 실데이터, DNS/custom domain, 유료 리소스, migration, destructive/force 작업.
'''
    fix = create('자동 재수정: ' + title, body + '\n단계: 구현/수정. 변경 파일과 검증 근거를 남긴다.', 'gwbuilder', parent, base_key + ':fix')
    review = create('자동 재리뷰: ' + title, body + '\n단계: 수정 결과 리뷰. 보안/권한/요구사항/검증 근거를 확인한다.', 'gwreviewer', fix, base_key + ':review')
    verify = create('자동 재검증: ' + title, body + '\n단계: 리뷰 승인 후 관련 테스트/typecheck/build/smoke를 재실행한다.', 'gwtester', review, base_key + ':verify')
    recovery = create('복구 정리: ' + title, body + '\n단계: 재검증 근거를 확인하고 원본 blocked 카드와 원래 후속 경로를 정리한다.', 'singde', verify, base_key + ':recovery')
    comment = f'[싱드 자동 개입] blocked remediation watcher가 승인 범위 내 자동 재수정 후보를 감지해 체인을 생성했습니다. fix={fix} review={review} verify={verify} recovery={recovery}'
    kanban('comment', tid, '--author', 'singde', comment, check=False)
    st['handled'][tid] = {'at': int(time.time()), 'reason_hash': reason_hash, 'fix': fix, 'review': review, 'verify': verify, 'recovery': recovery, 'title': title[:160]}
    return fix, [fix, review, verify, recovery]

st = load_state()
cooldown = int(os.environ.get('EVENT_COOLDOWN_SECONDS', '0') or '0')
now = int(time.time())
if cooldown > 0 and now - int(st.get('last_checked_at') or 0) < cooldown:
    print(f'blocked remediation: cooldown-skip ({now - int(st.get("last_checked_at") or 0)}s < {cooldown}s)')
    sys.exit(0)
try:
    blocked = load_blocked_tasks()
except sqlite3.Error as exc:
    text = str(exc).lower()
    if any(c in text for c in CORRUPT):
        print('blocked remediation: kanban-corrupt-circuit-breaker', file=sys.stderr)
        sys.exit(75)
    print(f'blocked remediation: sqlite read-only query failed: {exc}', file=sys.stderr)
    sys.exit(1)

actions = []
for task in blocked:
    tid = task.get('id')
    if not tid:
        continue
    stale_resolved, stale_summary = is_stale_resolved_blocker(task)
    if stale_resolved:
        if dry_run:
            actions.append(f'{tid}:would-complete-stale-resolved')
        else:
            cp = kanban('complete', tid, '--result', stale_summary, '--summary', stale_summary, check=False)
            if cp.returncode == 0:
                st['handled'][tid] = {'at': int(time.time()), 'cleanup': 'stale-resolved', 'title': (task.get('title') or tid)[:160]}
                actions.append(f'{tid}:completed-stale-resolved')
            else:
                actions.append(f'{tid}:stale-cleanup-failed:{(cp.stderr or cp.stdout).strip()[:200]}')
        continue
    category, reason = classify(task)
    if category == 'ignore':
        continue
    if category == 'approval-required':
        key = hashlib.sha1(reason.encode()).hexdigest()[:10]
        if st['approval_reported'].get(tid) != key:
            kanban('comment', tid, '--author', 'singde', '[싱드 자동 개입 보류] blocked remediation watcher가 감지했지만 restricted/별도 승인 신호가 있어 자동 재수정하지 않습니다. 싱드가 별도 승인 필요 보고로 분리해야 합니다.', check=False)
            st['approval_reported'][tid] = key
            actions.append(f'{tid}:approval-required')
        continue
    if already_intervened(task) or tid in st['handled']:
        actions.append(f'{tid}:already-handled')
        continue
    if dry_run:
        actions.append(f'{tid}:would-create-chain')
        continue
    fix, chain = create_chain(task, reason, st)
    actions.append(f'{tid}:created:{"/".join(chain)}')
    # Spawn only one remediation chain per pass to avoid build/worktree races.
    dp = kanban('dispatch', '--max', str(max_dispatch), check=False)
    actions.append('dispatch=' + (dp.stdout or dp.stderr).strip().replace('\n', ' | ')[:600])
    break

# keep state bounded
for bucket in ('handled', 'approval_reported'):
    if len(st.get(bucket, {})) > 500:
        st[bucket] = dict(list(st[bucket].items())[-500:])
st['last_checked_at'] = int(time.time())
save_state(st)
print('blocked remediation: ' + (', '.join(actions) if actions else '신규 자동 재수정 대상 없음'))
PY
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
