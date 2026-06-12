#!/usr/bin/env bash
set -euo pipefail

# review-required 게이트 검증 실패 시, 승인된 개발 범위 안의 자동 재루프를 생성한다.
# 원본 blocked 카드는 그대로 두고, 마지막 성공 upstream parent에
# 자동 재수정 → 자동 재리뷰 → 자동 재검증 → 싱드 복구 정리 카드를 붙인다.

BOARD="groupware"
WORKDIR="/home/wrhrgw/gw"
TASK_ID=""
FAILURE_LOG=""
MAX_DISPATCH="1"
DRY_RUN="0"
KANBAN_LOCK="${KANBAN_LOCK:-/home/wrhrgw/gw/.hermes/locks/gw-kanban.lock}"

export HERMES_HOME="${HERMES_HOME:-/home/wrhrgw/gw-dev-bot/.hermes}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task)
      TASK_ID="${2:?--task requires task id}"
      shift 2
      ;;
    --board)
      BOARD="${2:?--board requires board slug}"
      shift 2
      ;;
    --failure-log)
      FAILURE_LOG="${2:?--failure-log requires file path}"
      shift 2
      ;;
    --max-dispatch)
      MAX_DISPATCH="${2:?--max-dispatch requires number}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="1"
      shift
      ;;
    -h|--help)
      sed -n '1,80p' "$0"
      exit 0
      ;;
    *)
      echo "알 수 없는 옵션: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$TASK_ID" ]]; then
  echo "--task 가 필요합니다." >&2
  exit 2
fi

cd "$WORKDIR"
source ./scripts/gw-hermes-env.sh
mkdir -p "$(dirname "$KANBAN_LOCK")"

python3 - "$TASK_ID" "$BOARD" "$FAILURE_LOG" "$MAX_DISPATCH" "$DRY_RUN" <<'PY'
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

TASK_ID, BOARD, FAILURE_LOG, MAX_DISPATCH, DRY_RUN = sys.argv[1:6]
WORKDIR = Path('/home/wrhrgw/gw')
HERMES_BIN = os.environ.get('HERMES_BIN') or '/home/wrhrgw/gw-dev-bot/.hermes/hermes-agent/venv/bin/hermes'
WORKSPACE = 'dir:/home/wrhrgw/gw'
DRY = DRY_RUN == '1'


def run(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault('HERMES_HOME', '/home/wrhrgw/gw-dev-bot/.hermes')
    proc = subprocess.run(args, cwd=WORKDIR, env=env, text=True, capture_output=True)
    if check and proc.returncode != 0:
        raise SystemExit(f"command failed rc={proc.returncode}: {' '.join(args)}\n{proc.stdout}\n{proc.stderr}")
    return proc


def compact(text: str, limit: int = 3500) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[-limit:]

show = run([HERMES_BIN, 'kanban', '--board', BOARD, 'show', TASK_ID]).stdout
title_match = re.search(r'^Task\s+\S+:\s+(?P<title>.+)$', show, flags=re.M)
orig_title = title_match.group('title').strip() if title_match else TASK_ID
parents_match = re.search(r'^\s*parents:\s+(?P<parents>.+)$', show, flags=re.M)
parents = []
if parents_match:
    raw = parents_match.group('parents').strip()
    if raw and raw != '-':
        parents = [p.strip() for p in raw.split(',') if p.strip()]
upstream_parent = parents[0] if parents else ''

failure_text = ''
if FAILURE_LOG and Path(FAILURE_LOG).exists():
    failure_text = compact(Path(FAILURE_LOG).read_text(encoding='utf-8', errors='ignore'))
else:
    failure_text = '실패 로그 파일이 없어서 원본 카드 로그와 게이트 출력을 재확인해야 합니다.'


def failure_class(text: str) -> str:
    low = text.lower()
    if any(token in low for token in ['pages-manifest.json', 'build-manifest.json', '.nft.json', '.next/types', 'enotempty', '.next/export']):
        return 'web-build-artifact-race'
    if 'admin-skeleton-config' in low or 'adminpolicypreview' in low or 'effectiveattendanceregistrationmethods' in low or 'policysummary' in low:
        return 'admin-skeleton-config-shape'
    if 'createattendancepolicyassignment' in low or 'demoattendancepolicysubjects' in low or 'demoattendancepolicyassignments' in low or 'resolveeffectiveattendancepolicy' in low:
        return 'attendance-policy-helper-fixture'
    if 'build-cache-targets' in low:
        return 'web-build-cache-targets'
    compacted = re.sub(r'[^a-z0-9가-힣]+', '-', low).strip('-')[:80]
    return compacted or 'unknown-failure'


FAILURE_CLASS = failure_class(failure_text)


def has_active_duplicate_failure_chain(fail_class: str) -> tuple[str, str] | None:
    markers = {
        'web-build-artifact-race': ['web build', 'production build', 'enoent', '.next', 'nft trace', '플래키'],
        'admin-skeleton-config-shape': ['admin-skeleton-config', 'adminpolicypreview', 'preview/type shape'],
        'attendance-policy-helper-fixture': ['attendance policy pass2 shared helper', 'helper/fixture', 'createattendancepolicyassignment'],
        'web-build-cache-targets': ['build-cache-targets', 'ts2307'],
    }.get(fail_class, [fail_class])
    active_statuses = {'todo', 'ready', 'running', 'blocked', 'scheduled'}
    try:
        data = json.loads(run([HERMES_BIN, 'kanban', '--board', BOARD, 'list', '--json']).stdout or '[]')
    except Exception:
        return None
    for task in data:
        tid = str(task.get('id') or '')
        if tid == TASK_ID:
            continue
        status = str(task.get('status') or '')
        if status not in active_statuses:
            continue
        title = str(task.get('title') or '')
        body = str(task.get('body') or '')
        haystack = (title + '\n' + body).lower()
        if title.startswith(('자동 재수정', '자동 수정', '자동 재리뷰', '자동 재검증', '복구 정리', '수정:')) and any(m.lower() in haystack for m in markers):
            return tid, title
    return None


duplicate = has_active_duplicate_failure_chain(FAILURE_CLASS)
if duplicate:
    existing_id, existing_title = duplicate
    msg = (
        f"[singde-overgrowth-guard] 같은 실패 분류({FAILURE_CLASS})의 자동 복구 체인 "
        f"{existing_id}({existing_title})이 이미 활성/보류 상태라 새 체인을 만들지 않습니다. "
        "원본 카드는 blocked로 두고 기존 체인/주 작업 검증 결과를 기준으로 정리합니다."
    )
    if DRY:
        print('DRY duplicate guard:', msg)
    else:
        run([HERMES_BIN, 'kanban', '--board', BOARD, 'comment', TASK_ID, msg], check=False)
    print(msg)
    raise SystemExit(0)

common = f"""
원본 blocked 카드: {TASK_ID}
원본 제목: {orig_title}
실패 분류: {FAILURE_CLASS}

자동 재루프 원칙:
- 이 루프는 승인된 Phase/개발 범위 안의 테스트·타입체크·빌드 실패만 다룬다.
- secret, production DB/운영 실데이터, DNS/custom domain, 유료 리소스, 외부 공개, migration, 파괴적 삭제는 별도 승인 없이는 하지 않는다.
- 원본 blocked 카드는 억지로 unblock하지 않는다. 재검증 근거가 나오면 싱드 복구 정리 카드가 원본 완료/후속 진행 여부를 판단한다.
- 변경/검증 근거를 카드 result/comment에 남긴다.

게이트 실패 로그 tail:
```text
{failure_text}
```
"""

steps = [
    ('fix', '자동 재수정', 'gwbuilder', ['code-wiki', 'systematic-debugging', 'test-driven-development', 'groupware-kanban-pipeline'],
     '표준 검증 실패 원인을 확인하고 최소 범위로 수정한다. 기존 구현 의도는 유지하고, 실패한 명령을 다시 통과시킨다.'),
    ('review', '자동 재리뷰', 'gwreviewer', ['requesting-code-review', 'code-wiki', 'systematic-debugging', 'groupware-kanban-pipeline'],
     '자동 재수정 결과를 검토한다. 요구 누락, 개인정보/secret 노출, 관리자/일반 화면 경계, 테스트 근거를 확인한다.'),
    ('verify', '자동 재검증', 'gwtester', ['test-driven-development', 'systematic-debugging', 'groupware-kanban-pipeline'],
     '자동 재리뷰 결과를 바탕으로 shared/api/web test/typecheck와 web build 등 표준 검증을 재실행하고 근거를 남긴다.'),
    ('reconcile', '복구 정리', 'singde', ['one-three-one-rule', 'groupware-kanban-pipeline'],
     '자동 재검증 근거를 확인한다. 통과 시 원본 blocked 카드 완료 처리 및 원래 후속 카드 진행 여부를 정리하고, 실패/승인 필요 항목은 분리 보고한다.'),
]

parent = upstream_parent
created = []
for key, label, assignee, skills, detail in steps:
    title = f'{label}: {orig_title}'
    body = detail + '\n\n' + common
    cmd = [HERMES_BIN, 'kanban', '--board', BOARD, 'create', title,
           '--assignee', assignee, '--workspace', WORKSPACE, '--body', body,
           '--json', '--idempotency-key', f'review-gate-recovery:{FAILURE_CLASS}:v3:{key}']
    if parent:
        cmd += ['--parent', parent]
    for skill in skills:
        cmd += ['--skill', skill]
    if DRY:
        print('DRY create:', ' '.join(cmd))
        tid = f'DRY-{key}'
    else:
        data = json.loads(run(cmd).stdout)
        tid = data.get('id') or data.get('task_id')
    created.append((key, tid, assignee, parent or '-'))
    parent = tid

print('자동 재루프 카드:')
for row in created:
    print(f'- {row[0]}: {row[1]} -> {row[2]} / parent={row[3]}')

if not DRY:
    out = run([HERMES_BIN, 'kanban', '--board', BOARD, 'dispatch', '--max', str(MAX_DISPATCH)], check=False)
    print(out.stdout)
    if out.returncode != 0:
        print(out.stderr, file=sys.stderr)
        raise SystemExit(out.returncode)
PY
