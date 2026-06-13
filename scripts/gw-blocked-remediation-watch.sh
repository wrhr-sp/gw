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
    'dns', 'custom domain', '도메인',
    '유료', '비용', '결제', 'migration', '마이그레이션',
    'destructive', 'force', '강제',
)
SAFE_STOP_HINTS = (
    '별도 승인', '승인 필요', 'user approval', 'approval required',
)
LOCAL_EVIDENCE_MARKERS = (
    'pnpm check',
    'build:cf',
    'preview smoke 통과',
    'preview:cf',
    'smoke 통과',
    'cloudflare-build',
    'cloudflare-deploy',
    'deploy success',
    'deployment metadata',
    'release-gate success',
)
GENERATED_PREFIXES = (
    '.next/',
    '.open-next/',
    '.wrangler/',
    '.hermes/',
    '__pycache__/',
    'apps/web/.next/',
    'apps/web/.open-next/',
    'apps/web/.wrangler/',
    'scripts/__pycache__/',
)
ACTIVE_STATUSES = {'todo', 'ready', 'running', 'blocked', 'scheduled'}

def run(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    p = subprocess.run(args, cwd=root, env=env, text=True, capture_output=True)
    if check and p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout).strip())
    return p

def kanban(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(['flock', lock, hermes, '-p', profile, 'kanban', '--board', board, *args], check=check)

def load_state() -> dict:
    if not state_path.exists():
        return {'handled': {}, 'approval_reported': {}, 'reason_counts': {}, 'last_checked_at': 0}
    try:
        d = json.loads(state_path.read_text())
    except Exception:
        return {'handled': {}, 'approval_reported': {}, 'reason_counts': {}, 'last_checked_at': 0}
    d.setdefault('handled', {})
    d.setdefault('approval_reported', {})
    d.setdefault('reason_counts', {})
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
            'select author, body, created_at from task_comments where task_id=? order by id desc limit 8',
            (d['id'],),
        ).fetchall()]
        d['runs'] = [dict(r) for r in con.execute(
            'select status, outcome, summary, error, started_at, ended_at from task_runs where task_id=? order by id desc limit 3',
            (d['id'],),
        ).fetchall()]
        d['auto_intervention_count'] = con.execute(
            "select count(*) from task_comments where task_id=? and body like '%blocked remediation watcher가 승인 범위 내 자동 재수정 후보를 감지해 체인을 생성했습니다%'",
            (d['id'],),
        ).fetchone()[0]
        out.append(d)
    con.close()
    return out


def load_tasks_by_ids(ids: list[str]) -> dict[str, dict]:
    if not ids:
        return {}
    con = ro_connect()
    con.row_factory = sqlite3.Row
    placeholders = ','.join('?' for _ in ids)
    rows = con.execute(
        f"select id, title, assignee, status, result, last_failure_error from tasks where id in ({placeholders})",
        ids,
    ).fetchall()
    out: dict[str, dict] = {}
    for row in rows:
        d = dict(row)
        d['recent_comments'] = [dict(r) for r in con.execute(
            'select author, body, created_at from task_comments where task_id=? order by id desc limit 5',
            (d['id'],),
        ).fetchall()]
        d['runs'] = [dict(r) for r in con.execute(
            'select status, outcome, summary, error, started_at, ended_at from task_runs where task_id=? order by id desc limit 5',
            (d['id'],),
        ).fetchall()]
        out[d['id']] = d
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


def reason_hash(reason: str) -> str:
    return hashlib.sha1(reason.encode()).hexdigest()[:10]


def restricted_hits(signal: str) -> list[str]:
    lower = signal.lower()
    return [marker for marker in RESTRICTED_PATTERNS if marker.lower() in lower]


def local_substitute_evidence_hits(text: str) -> list[str]:
    lower = text.lower()
    return [marker for marker in LOCAL_EVIDENCE_MARKERS if marker.lower() in lower]


def current_reason_group_count(task: dict, st: dict, current_hash: str) -> int:
    tid = task.get('id') or ''
    state_count = int((((st.get('reason_counts') or {}).get(tid) or {}).get(current_hash)) or 0)
    comment_count = 0
    for comment in task.get('recent_comments') or []:
        body = str(comment.get('body') or '')
        if f'reason_hash={current_hash}' in body:
            comment_count += 1
    remembered = (st.get('handled') or {}).get(tid, {})
    if remembered.get('reason_hash') == current_hash:
        state_count = max(state_count, 1)
    return max(state_count, comment_count)


def bump_reason_group_count(task: dict, st: dict, current_hash: str) -> int:
    tid = task.get('id') or ''
    reason_counts = st.setdefault('reason_counts', {})
    task_counts = reason_counts.setdefault(tid, {})
    next_count = current_reason_group_count(task, st, current_hash) + 1
    task_counts[current_hash] = next_count
    return next_count


def extract_parent(task: dict) -> str | None:
    parents = task.get('parents') or []
    return parents[0] if parents else None

def already_intervened(task: dict) -> bool:
    haystack = signal_text(task)
    return 'blocked remediation watcher가 승인 범위 내 자동 재수정 후보를 감지해 체인을 생성했습니다' in haystack or re.search(r'fix=t_[0-9a-f]+\s+review=t_[0-9a-f]+\s+verify=t_[0-9a-f]+\s+recovery=t_[0-9a-f]+', haystack) is not None


def extract_chain_ids(task: dict, st: dict) -> dict[str, str]:
    ids: dict[str, str] = {}
    remembered = (st.get('handled') or {}).get(task.get('id') or '', {})
    for key in ('fix', 'review', 'verify', 'recovery'):
        value = remembered.get(key)
        if isinstance(value, str) and re.fullmatch(r't_[0-9a-f]+', value):
            ids[key] = value
    if len(ids) == 4:
        return ids
    for source in task.get('recent_comments') or []:
        body = str(source.get('body') or '')
        for key, value in re.findall(r'(fix|review|verify|recovery)=(t_[0-9a-f]+)', body):
            ids.setdefault(key, value)
    return ids


def chain_signal_summary(task_map: dict[str, dict]) -> str:
    return '\n'.join(signal_text(task_map[tid]) for tid in sorted(task_map))


def chain_recheck(task: dict, st: dict) -> tuple[str, str, dict[str, str]]:
    ids = extract_chain_ids(task, st)
    if not ids:
        return 'none', '생성된 체인 id를 찾지 못함', {}
    task_map = load_tasks_by_ids(list(ids.values()))
    missing = [tid for tid in ids.values() if tid not in task_map]
    if missing:
        return 'needs-recreate', '기존 자동 재수정 체인 일부를 찾지 못함: ' + ','.join(missing), ids
    active = []
    terminal = []
    for key in ('fix', 'review', 'verify', 'recovery'):
        cid = ids.get(key)
        if not cid:
            continue
        status = str(task_map[cid].get('status') or 'unknown')
        marker = f'{key}:{cid}:{status}'
        if status in ACTIVE_STATUSES:
            active.append(marker)
        else:
            terminal.append(marker)
    if active:
        return 'active', '기존 체인 진행/대기 중: ' + ', '.join(active), ids
    chain_text = chain_signal_summary(task_map).lower()
    resolved_markers = (
        '재검증 통과', '검증 통과', '검증 완료', 'blocking 없음', '승인 가능',
        'pnpm check', 'build:cf', 'preview smoke 통과', 'smoke 통과', '테스트 통과',
        '원본 blocked 카드 완료 처리', 'blocker 해소', '해결됨을 확인',
    )
    recovery_id = ids.get('recovery')
    recovery_done = bool(recovery_id and str(task_map[recovery_id].get('status') or '') == 'done')
    if recovery_done and any(marker.lower() in chain_text for marker in resolved_markers):
        return 'resolved', '기존 체인 완료 및 검증 근거 확인: ' + ', '.join(terminal), ids
    return 'needs-recreate', '기존 체인이 끝났지만 원본 blocker 해소 근거가 부족함: ' + ', '.join(terminal), ids


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
    restricted = bool(restricted_hits(haystack))
    resolved = any(m.lower() in lower for m in resolved_markers)
    evidence = any(m.lower() in lower for m in evidence_markers)
    if resolved and evidence and not restricted:
        return True, '[싱드 자동 정리] 후속 체인에서 blocker 해소와 검증 근거가 확인되어 stale/resolved blocker로 완료 처리합니다. secret/DNS/유료/production DB/destructive 작업 없음.'
    return False, ''


def is_live_fetch_substitute_complete(task: dict) -> tuple[bool, str]:
    """Complete validation blockers when only live workers.dev fetch is denied but substitutes passed."""
    haystack = signal_text(task)
    lower = haystack.lower()
    live_gate = (
        ('live url' in lower or 'workers.dev' in lower or 'live fetch' in lower or '직접 fetch' in lower)
        and ('blocked: user denied' in lower or 'user denied this command' in lower or '세션 정책상 거부' in lower or '환경 gate' in lower)
    )
    if not live_gate:
        return False, ''
    evidence_markers = (
        'pnpm check',
        'build:cf',
        'local preview',
        'preview:cf',
        'preview smoke',
        'route smoke',
        'smoke 통과',
        '통과',
    )
    evidence_count = sum(1 for marker in evidence_markers if marker in lower)
    if evidence_count < 3:
        return False, ''
    restricted_actual = (
        'secret 교체', 'production db 변경', '운영 db 변경', 'dns 변경',
        'custom domain 변경', '유료 리소스 생성', '운영 실데이터 변경',
    )
    if any(marker in lower for marker in restricted_actual):
        return False, ''
    summary = '[싱드 자동 정리] live URL 직접 fetch가 세션/환경 gate에 막혔지만, 카드 예방 handoff 기준에 따라 local preview/build/test 대체 근거가 충분해 검증 blocker를 완료 처리합니다. 확인 근거: pnpm check/build:cf/local preview 또는 route smoke 통과. 실제 live 재확인은 PR merge/main release-gate/deploy 단계에서 gwops가 수행합니다. secret/DNS/유료/production DB/destructive 작업 없음.'
    return True, summary


def extract_release_branch(text: str) -> str | None:
    patterns = (
        r'git branch -d\s+`?([A-Za-z0-9._/-]+)`?',
        r'git branch -D\s+`?([A-Za-z0-9._/-]+)`?',
        r'git ls-remote --heads origin\s+`?([A-Za-z0-9._/-]+)`?',
        r'refs/heads/([A-Za-z0-9._/-]+)',
        r'branch:\s*`([^`]+)`',
        r'branch\s+`([^`]+)`',
        r'브랜치\s+`([^`]+)`',
        r'로컬 브랜치\s+`([^`]+)`',
        r'local branch\s+`([^`]+)`',
        r'remote/local branch deletion[^\n`]*`?([A-Za-z0-9._/-]+)`?',
        r'remote branch[^\n`]*`([A-Za-z0-9._/-]+)`',
    )
    invalid = {'main', 'master', 'cleanup', 'deletion', 'delete', 'blocked', 'branch'}
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            branch = m.group(1).strip().strip('.,;:')
            if branch and branch.lower() not in invalid and '/' in branch:
                return branch
    return None

def extract_pr_number(text: str) -> str | None:
    m = re.search(r'(?:PR|#)\s*#?(\d+)', text, re.IGNORECASE)
    return m.group(1) if m else None

def git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(['git', *args], check=check)


def is_generated_path(path: str) -> bool:
    normalized = path.strip()
    if normalized.startswith('./'):
        normalized = normalized[2:]
    if normalized.endswith('.tsbuildinfo'):
        return True
    if normalized.startswith('.hermes/') and normalized.endswith('.state'):
        return True
    return any(normalized.startswith(prefix) for prefix in GENERATED_PREFIXES)


def relevant_dirty_paths() -> list[str]:
    proc = git('status', '--short', check=False)
    if proc.returncode != 0:
        return ['git-status-failed']
    paths: list[str] = []
    for raw in proc.stdout.splitlines():
        if not raw:
            continue
        path = raw[3:] if len(raw) > 3 else raw
        if ' -> ' in path:
            path = path.split(' -> ', 1)[1]
        path = path.strip()
        if path and not is_generated_path(path):
            paths.append(path)
    return paths


def patch_id_for_commit(commit: str) -> str | None:
    show = git('show', '--format=', '--no-ext-diff', commit, check=False)
    if show.returncode != 0:
        return None
    proc = subprocess.run(['git', 'patch-id', '--stable'], cwd=root, env=env, text=True, input=show.stdout, capture_output=True)
    if proc.returncode != 0 or not proc.stdout.strip():
        return None
    return proc.stdout.split()[0]

def branch_exists(branch: str) -> bool:
    return git('show-ref', '--verify', '--quiet', f'refs/heads/{branch}', check=False).returncode == 0

def remote_branch_absent(branch: str) -> bool:
    return git('ls-remote', '--heads', 'origin', branch, check=False).stdout.strip() == ''

def pr_merge_commit(pr_number: str | None) -> tuple[bool, str | None, str]:
    if not pr_number:
        return False, None, 'PR 번호를 찾지 못함'
    proc = run(['gh', 'pr', 'view', pr_number, '--json', 'state,mergeCommit,url', '--jq', '[.state, (.mergeCommit.oid // ""), .url] | @tsv'], check=False)
    if proc.returncode != 0:
        return False, None, 'gh pr view 실패: ' + (proc.stderr or proc.stdout).strip()[:200]
    parts = proc.stdout.strip().split('\t')
    state = parts[0] if parts else ''
    merge = parts[1] if len(parts) > 1 else ''
    if state != 'MERGED' or not merge:
        return False, None, f'PR #{pr_number} merged 상태가 아님: {state or "unknown"}'
    return True, merge, f'PR #{pr_number} merged, merge={merge}'


def pr_head_checks_ok(pr_number: str | None) -> tuple[bool, bool, str]:
    if not pr_number:
        return False, False, 'PR 번호를 찾지 못해 head checks를 확인할 수 없음'
    proc = run([
        'gh', 'pr', 'view', pr_number, '--json', 'statusCheckRollup',
        '--jq', '(.statusCheckRollup // []) | length'
    ], check=False)
    if proc.returncode != 0:
        return False, False, 'gh pr view(statusCheckRollup) 실패: ' + (proc.stderr or proc.stdout).strip()[:200]
    raw_len = proc.stdout.strip() or '0'
    try:
        check_count = int(raw_len)
    except ValueError:
        check_count = 0
    if check_count == 0:
        return True, True, f'PR #{pr_number} head checks 없음(local substitute evidence 확인 필요)'
    checks = run(['gh', 'pr', 'checks', pr_number], check=False)
    if checks.returncode != 0:
        return False, False, 'gh pr checks 실패: ' + (checks.stderr or checks.stdout).strip().replace('\n', ' | ')[:240]
    return True, False, f'PR #{pr_number} head checks 통과'


def release_gate_ok(merge_commit: str | None) -> tuple[bool, str]:
    if not merge_commit:
        return False, 'merge commit이 없어 main release-gate 확인 불가'
    proc = run([
        'gh', 'run', 'list', '--workflow', 'release-gate.yml', '--branch', 'main',
        '--json', 'databaseId,headSha,status,conclusion,displayTitle,url', '--limit', '20'
    ], check=False)
    if proc.returncode != 0:
        return False, 'gh run list(release-gate) 실패: ' + (proc.stderr or proc.stdout).strip()[:200]
    try:
        runs = json.loads(proc.stdout or '[]')
    except json.JSONDecodeError:
        return False, 'gh run list(release-gate) JSON 파싱 실패'
    target = None
    for item in runs:
        if str(item.get('headSha') or '').startswith(merge_commit):
            target = item
            break
    if not target:
        return False, f'main release-gate run 없음 for {merge_commit[:12]}'
    if target.get('status') != 'completed' or target.get('conclusion') != 'success':
        return False, f"main release-gate 미통과: status={target.get('status')} conclusion={target.get('conclusion')}"
    return True, f"main release-gate success: run={target.get('databaseId')} {target.get('url') or ''}".strip()


def is_release_cleanup_blocker(task: dict) -> tuple[bool, str, str | None, str | None]:
    text = '\n'.join(str(task.get(k) or '') for k in ('title', 'body')) + '\n' + signal_text(task)
    lower = text.lower()
    scoped = any(x in lower for x in ('branch cleanup', 'pr merge', 'release gate', 'release-gate', 'merge/branch cleanup', '원격·로컬 branch cleanup'))
    cleanup_signal = any(x in lower for x in (
        'local branch cleanup', '로컬 branch', '로컬 브랜치', 'git branch -d',
        'branch deletion', '브랜치 삭제', 'remote/local branch deletion',
        'cleanup blocker', 'branch cleanup blocked', 'terminal consent gate',
    ))
    merged_signal = any(x in lower for x in (
        'pr #', 'merged', 'merge commit', 'main release-gate', 'deploy success',
        'remote branch', 'release-gate/deploy succeeded', 'cloudflare-deploy',
    ))
    branch = extract_release_branch(text)
    pr_number = extract_pr_number(text)
    return scoped and cleanup_signal and merged_signal and bool(branch), text, branch, pr_number

def maybe_complete_release_cleanup(task: dict, st: dict) -> tuple[bool, str]:
    ok, text, branch, pr_number = is_release_cleanup_blocker(task)
    tid = task.get('id') or '-'
    if not ok or not branch:
        return False, ''
    pr_ok, merge_commit, pr_msg = pr_merge_commit(pr_number)
    if not pr_ok:
        return True, f'{tid}:release-cleanup-wait:{pr_msg}'
    head_ok, checks_missing, head_msg = pr_head_checks_ok(pr_number)
    if not head_ok:
        return True, f'{tid}:release-cleanup-wait:{head_msg}'
    evidence_hits = local_substitute_evidence_hits(text)
    if checks_missing and not evidence_hits:
        return True, f'{tid}:release-cleanup-wait:local-substitute-evidence-missing'
    gate_ok, gate_msg = release_gate_ok(merge_commit)
    if not gate_ok:
        return True, f'{tid}:release-cleanup-wait:{gate_msg}'
    remote_was_present = not remote_branch_absent(branch)
    details = [pr_msg, head_msg, gate_msg]
    if remote_was_present:
        if dry_run:
            details.append(f'would delete remote branch: {branch}')
        else:
            delete_remote = git('push', 'origin', '--delete', branch, check=False)
            if delete_remote.returncode != 0:
                return True, f'{tid}:release-cleanup-failed:remote-delete:{(delete_remote.stderr or delete_remote.stdout).strip()[:200]}'
            if not remote_branch_absent(branch):
                return True, f'{tid}:release-cleanup-failed:remote-still-exists:{branch}'
            details.append(f'remote branch deleted: {branch}')
    else:
        details.append(f'remote branch already absent: {branch}')
    dirty_paths = relevant_dirty_paths()
    if dirty_paths:
        return True, f'{tid}:release-cleanup-wait:dirty-worktree:{"|".join(dirty_paths[:5])}'
    exists = branch_exists(branch)
    details.append('dirty worktree check: clean-or-generated-only')
    if checks_missing:
        details.append('local substitute evidence: ' + ', '.join(evidence_hits[:5]))
    if exists:
        branch_sha = git('rev-parse', branch, check=False).stdout.strip()
        branch_pid = patch_id_for_commit(branch_sha) if branch_sha else None
        merge_pid = patch_id_for_commit(merge_commit) if merge_commit else None
        if not branch_pid or not merge_pid or branch_pid != merge_pid:
            return True, f'{tid}:release-cleanup-wait:patch-id-mismatch-or-missing'
        current = git('branch', '--show-current', check=False).stdout.strip()
        if current == branch:
            if dry_run:
                details.append(f'would detach from current branch {branch}')
            else:
                # Detach at the same commit first. This does not change the working tree and avoids
                # checkout conflicts with unrelated dirty files in the shared worktree.
                det = git('switch', '--detach', 'HEAD', check=False)
                if det.returncode != 0:
                    return True, f'{tid}:release-cleanup-failed:detach:{(det.stderr or det.stdout).strip()[:200]}'
        if dry_run:
            details.append(f'would delete local branch {branch} after patch-id match {branch_pid}')
        else:
            delete = git('branch', '-D', branch, check=False)
            if delete.returncode != 0:
                return True, f'{tid}:release-cleanup-failed:delete:{(delete.stderr or delete.stdout).strip()[:200]}'
            details.append(f'local branch deleted: {branch}')
    else:
        details.append(f'local branch already absent: {branch}')
    summary = '[싱드 자동 정리] PR merge/main release-gate/remote branch cleanup 근거와 patch-id 동등성 또는 branch 부재를 확인해 local branch cleanup blocker를 완료 처리합니다. ' + ' / '.join(details) + '. secret/DNS/유료/production DB/destructive 운영 데이터 작업 없음.'
    if dry_run:
        return True, f'{tid}:would-complete-release-cleanup:{branch}'
    cp = kanban('complete', tid, '--result', summary, '--summary', summary, check=False)
    if cp.returncode == 0:
        st['handled'][tid] = {'at': int(time.time()), 'cleanup': 'release-branch', 'branch': branch, 'pr': pr_number, 'title': (task.get('title') or tid)[:160]}
        return True, f'{tid}:completed-release-cleanup:{branch}'
    return True, f'{tid}:release-cleanup-complete-failed:{(cp.stderr or cp.stdout).strip()[:200]}'

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
    restricted = restricted_hits(raw_signal)
    if restricted:
        safe_stop = any(h in signal for h in SAFE_STOP_HINTS)
        marker_text = ', '.join(restricted[:4])
        reason = '막힘 사유에 restricted 실제 신호가 있어 자동 재수정하지 않음'
        if safe_stop:
            reason += f' (승인 힌트 동반: {marker_text})'
        else:
            reason += f' (safe-stop: {marker_text})'
        return 'approval-required', reason
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
    current_hash = reason_hash(reason)
    attempt = bump_reason_group_count(task, st, current_hash)
    base_key = f'blocked-remediation:{board}:{tid}:{current_hash}'
    body = f'''blocked 자동 재수정 체인입니다.

원본 blocked 카드: {tid}
원본 제목: {title}
failure group: reason_hash={current_hash}, attempt={attempt}

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
    comment = f'[싱드 자동 개입] blocked remediation watcher가 승인 범위 내 자동 재수정 후보를 감지해 체인을 생성했습니다. reason_hash={current_hash} attempt={attempt} fix={fix} review={review} verify={verify} recovery={recovery}'
    kanban('comment', tid, '--author', 'singde', comment, check=False)
    st['handled'][tid] = {'at': int(time.time()), 'reason_hash': current_hash, 'attempt': attempt, 'fix': fix, 'review': review, 'verify': verify, 'recovery': recovery, 'title': title[:160]}
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
    release_handled, release_action = maybe_complete_release_cleanup(task, st)
    if release_handled:
        actions.append(release_action)
        continue
    live_substitute_done, live_summary = is_live_fetch_substitute_complete(task)
    if live_substitute_done:
        if dry_run:
            actions.append(f'{tid}:would-complete-live-fetch-substitute')
        else:
            cp = kanban('complete', tid, '--result', live_summary, '--summary', live_summary, check=False)
            if cp.returncode == 0:
                st['handled'][tid] = {'at': int(time.time()), 'cleanup': 'live-fetch-substitute-evidence', 'title': (task.get('title') or tid)[:160]}
                actions.append(f'{tid}:completed-live-fetch-substitute')
            else:
                actions.append(f'{tid}:live-fetch-substitute-complete-failed:{(cp.stderr or cp.stdout).strip()[:200]}')
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
        key = reason_hash(reason)
        if st['approval_reported'].get(tid) != key:
            kanban('comment', tid, '--author', 'singde', f'[싱드 자동 개입 보류] blocked remediation watcher가 감지했지만 restricted/별도 승인 신호가 있어 자동 재수정하지 않습니다. reason_hash={key}. 싱드가 별도 승인 필요 보고로 분리해야 합니다.', check=False)
            st['approval_reported'][tid] = key
            actions.append(f'{tid}:approval-required')
        continue
    if already_intervened(task) or tid in st['handled']:
        recheck_state, recheck_reason, chain_ids = chain_recheck(task, st)
        if recheck_state == 'resolved':
            summary = '[싱드 자동 정리] `already-handled` 재확인 결과 기존 자동 재수정 체인에서 blocker 해소와 검증 근거가 확인되어 stale/resolved blocker로 완료 처리합니다. ' + recheck_reason + '. secret/DNS/유료/production DB/destructive 작업 없음.'
            if dry_run:
                actions.append(f'{tid}:would-complete-already-handled-resolved')
            else:
                cp = kanban('complete', tid, '--result', summary, '--summary', summary, check=False)
                if cp.returncode == 0:
                    st['handled'][tid] = {'at': int(time.time()), 'cleanup': 'already-handled-resolved', 'title': (task.get('title') or tid)[:160], **chain_ids}
                    actions.append(f'{tid}:completed-already-handled-resolved')
                else:
                    actions.append(f'{tid}:already-handled-complete-failed:{(cp.stderr or cp.stdout).strip()[:200]}')
            continue
        if recheck_state == 'active':
            actions.append(f'{tid}:already-handled-rechecked-active:{recheck_reason}')
            continue
        current_hash = reason_hash(reason)
        same_group_count = current_reason_group_count(task, st, current_hash)
        if same_group_count >= 3:
            key = reason_hash(recheck_reason or reason)
            approval_key = f'manual-recheck:{key}'
            if st['approval_reported'].get(tid) != approval_key:
                kanban('comment', tid, '--author', 'singde', f'[싱드 자동 개입 보류] `already-handled` 재확인 결과 기존 자동 재수정 체인이 실제 해결로 닫히지 않았습니다. reason_hash={current_hash} repeat_count={same_group_count}. 같은 실패군 자동 체인이 3회 이상 반복돼 새 체인을 더 만들지 않고 싱드 직접 분류/정리가 필요합니다. 근거: {recheck_reason}', check=False)
                st['approval_reported'][tid] = approval_key
            actions.append(f'{tid}:already-handled-needs-manual:{recheck_reason}')
            continue
        st['handled'].pop(tid, None)
        actions.append(f'{tid}:already-handled-recheck-recreate:{recheck_reason}')
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
for bucket in ('handled', 'approval_reported', 'reason_counts'):
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
