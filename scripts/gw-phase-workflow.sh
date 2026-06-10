#!/usr/bin/env bash
set -euo pipefail

python3 - "$@" <<'PY'
from __future__ import annotations

import argparse
import json
import os
import subprocess
import shlex
import sys
from pathlib import Path

ROOT = Path('/home/wrhrgw/gw')
AUTO = ROOT / 'scripts' / 'gw-auto-workflow.sh'
PHASES = {
    'phase3-property-list': ('feature', 'Phase 3: 숙소 목록/검색', '숙소 목록과 검색 흐름을 Phase 단위로 진행한다.'),
    'phase4-seed': ('feature', 'Phase 4: seed/availability', 'seed와 예약 가능 여부/가격 확인 흐름을 Phase 단위로 진행한다.'),
    'phase5-reservation-create': ('feature', 'Phase 5: 예약 생성', '예약 생성 API/Web 흐름을 Phase 단위로 진행한다.'),
    'automation-hardening': ('feature', '자동화 보강', 'PR/배포/DB/Phase/복구/보고 루프 자동화를 진행한다.'),
}


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description='Phase 기준 Kanban workflow 래퍼. 기본은 preview/hold 우선이며 release gate를 확인합니다.')
    p.add_argument('--phase', choices=sorted(PHASES), required=True)
    p.add_argument('--title', default='')
    p.add_argument('--body', default='')
    p.add_argument('--board', default='groupware')
    p.add_argument('--idempotency-key')
    p.add_argument('--preview', action='store_true')
    p.add_argument('--hold', action='store_true')
    p.add_argument('--force', action='store_true', help='release backpressure 경고를 무시하고 생성')
    p.add_argument('--json', action='store_true')
    return p


def run(cmd: list[str], check: bool = False) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    current_hosts = Path(env.get('XDG_CONFIG_HOME', '')) / 'gh' / 'hosts.yml' if env.get('XDG_CONFIG_HOME') else None
    if (not current_hosts or not current_hosts.exists()) and Path('/home/werehere/.config/gh/hosts.yml').exists():
        env['XDG_CONFIG_HOME'] = '/home/werehere/.config'
    return subprocess.run(cmd, cwd=ROOT, env=env, text=True, capture_output=True, check=check)


def backpressure(board: str) -> list[str]:
    warnings=[]
    status=run(['git','status','--short']).stdout.strip()
    if status:
        warnings.append('git 작업트리가 깨끗하지 않음')
    prs=run(['gh','pr','list','--repo','wrhr-sp/gw','--state','open','--json','number,title,headRefName'], check=False)
    if prs.returncode == 0:
        data=json.loads(prs.stdout or '[]')
        if data:
            warnings.append(f'열린 PR {len(data)}개 있음')
    else:
        warnings.append('gh PR 상태 확인 실패')
    board_arg=shlex.quote(board)
    kb=run(['bash','-lc',f'source ./scripts/gw-hermes-env.sh && "$HERMES_BIN" -p "${{HERMES_PROFILE:-singde}}" kanban --board {board_arg} list --json'], check=False)
    if kb.returncode == 0:
        try:
            tasks=json.loads(kb.stdout)
            blockers=[t for t in tasks if t.get('status') not in {'done','archived'} and any(x in t.get('title','').lower() for x in ['release gate','최종 보고','smoke check'])]
            if blockers:
                warnings.append('미완료 release/smoke/final 카드 있음: '+', '.join(t['id'] for t in blockers[:5]))
        except Exception:
            warnings.append('Kanban JSON 파싱 실패')
    else:
        warnings.append('Kanban 상태 확인 실패')
    return warnings


def main() -> int:
    args=parser().parse_args()
    kind, default_title, default_body = PHASES[args.phase]
    title=args.title or default_title
    body=(args.body or default_body) + f"\n\nPhase key: {args.phase}\nRelease gate/backpressure: 새 구현 전 PR/CI/merge/branch cleanup과 smoke/final report 완료 여부를 확인한다.\nBenchmark/UX: UI/UX·기능 배치·정보구조 작업은 docs/ux/groupware-benchmark-principles.md 와 docs/product/groupware-vision-roadmap.md 를 먼저 참고하되, 공개 자료의 일반 패턴만 사용하고 특정 서비스 화면/문구/스타일은 복제하지 않는다."
    warnings=backpressure(args.board)
    cmd=[str(AUTO),'--type',kind,'--board',args.board]
    if args.preview:
        cmd.append('--preview')
    if args.hold or not args.force:
        cmd.append('--hold')
    if args.idempotency_key:
        cmd.extend(['--idempotency-key',args.idempotency_key])
    cmd.extend([title, body])
    payload={'phase':args.phase,'board':args.board,'warnings':warnings,'command':cmd,'will_run':not args.preview and (args.force or not warnings)}
    if warnings and not args.force:
        payload['blocked_by_backpressure']=True
        if args.json:
            print(json.dumps(payload,ensure_ascii=False,indent=2))
        else:
            print('release backpressure로 새 Phase 생성 차단/보류:')
            for w in warnings: print('-',w)
            print('실행 예정 명령:', ' '.join(cmd))
            print('--force를 주면 hold 상태로 생성할 수 있습니다.')
        return 2
    if args.json:
        print(json.dumps(payload,ensure_ascii=False,indent=2))
    if args.preview:
        if not args.json:
            print('실행 예정 명령:', ' '.join(cmd))
        return 0
    proc=subprocess.run(cmd,cwd=ROOT,text=True)
    return proc.returncode

if __name__=='__main__':
    sys.exit(main())
PY
