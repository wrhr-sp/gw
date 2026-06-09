#!/usr/bin/env bash
set -euo pipefail
ROOT=/home/wrhrgw/gw
source "$ROOT/scripts/gw-hermes-env.sh"
INTERVAL="60"
MAX_AGE="1800"
ONCE=0
BOARD="groupware"
usage(){ cat <<'EOF'
사용법:
  ./scripts/gw-worker-recovery-watch.sh [--once] [--interval 초] [--max-age 초] [--board 보드]

역할:
  stale running, timeout/crash/protocol violation 같은 worker 이상 징후를 감지해 원본 카드에 comment를 남깁니다.
  자동 완료/재시작은 하지 않습니다. 로그 확인과 표준 검증이 먼저입니다.
EOF
}
is_positive_int(){ [[ "$1" =~ ^[1-9][0-9]*$ ]]; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=1; shift ;;
    --interval) INTERVAL="${2:?--interval requires seconds}"; shift 2 ;;
    --max-age) MAX_AGE="${2:?--max-age requires seconds}"; shift 2 ;;
    --board) BOARD="${2:?--board requires board}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; usage >&2; exit 2 ;;
  esac
done
if ! is_positive_int "$INTERVAL"; then echo "interval은 양의 정수여야 합니다: $INTERVAL" >&2; exit 2; fi
if ! is_positive_int "$MAX_AGE"; then echo "max-age는 양의 정수여야 합니다: $MAX_AGE" >&2; exit 2; fi
run_once(){
  python3 - "$BOARD" "$MAX_AGE" <<'PY'
from __future__ import annotations
import json, os, subprocess, sys, time
board=sys.argv[1]; max_age=int(sys.argv[2]); root='/home/wrhrgw/gw'; hermes=os.environ['HERMES_BIN']; profile=os.environ.get('HERMES_PROFILE','singde')
env=os.environ.copy(); env['HERMES_HOME']=os.environ.get('HERMES_HOME','/home/wrhrgw/gw-dev-bot/.hermes')
proc=subprocess.run([hermes,'-p',profile,'kanban','--board',board,'list','--json'],cwd=root,env=env,text=True,capture_output=True)
if proc.returncode!=0:
    print('kanban list 실패:', proc.stderr.strip() or proc.stdout.strip(), file=sys.stderr); sys.exit(1)
now=int(time.time()); items=json.loads(proc.stdout); actions=[]
for t in items:
    status=t.get('status'); title=t.get('title',''); tid=t.get('id')
    text=((t.get('result') or '')+' '+title).lower()
    if status=='blocked' and any(k in text for k in ['iteration budget','timeout','timed out','crash','protocol violation']): actions.append((tid,'blocked-timeout-like'))
    if status=='running':
        hb=t.get('last_heartbeat_at') or t.get('started_at')
        try: hb=int(hb) if hb else 0
        except Exception: hb=0
        if hb and now-hb>max_age: actions.append((tid,f'stale-running>{max_age}s'))
for tid,reason in actions:
    msg=f'worker recovery 감지: {reason}. 자동 완료/재시작 전 로그 확인과 표준 검증 필요. 위험 작업은 승인 전 실행 금지.'
    subprocess.run([hermes,'-p',profile,'kanban','--board',board,'comment',tid,msg],cwd=root,env=env,text=True,capture_output=True)
    print(tid, reason)
if not actions: print('worker recovery: 감지된 stale/timeout 카드 없음')
PY
}
if [[ "$ONCE" == "1" ]]; then run_once; else while true; do run_once || true; sleep "$INTERVAL"; done; fi
