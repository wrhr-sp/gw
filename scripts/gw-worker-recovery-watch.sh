#!/usr/bin/env bash
set -euo pipefail
ROOT=/home/wrhrgw/gw
source "$ROOT/scripts/gw-hermes-env.sh"
INTERVAL="60"
MAX_AGE="1800"
BOARD="groupware"
ONCE=0
STATE_FILE="$ROOT/.hermes/gw-worker-recovery-watch.state.json"
KANBAN_LOCK="${KANBAN_LOCK:-$ROOT/.hermes/locks/gw-kanban.lock}"
CORRUPT_BACKOFF_SECONDS="${CORRUPT_BACKOFF_SECONDS:-1800}"
mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$KANBAN_LOCK")"
usage() {
  printf '%s
' '사용법: ./scripts/gw-worker-recovery-watch.sh [--once] [--interval 초] [--max-age 초] [--board 보드]'
}
is_positive_int() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=1; shift ;;
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
  flock -n "$STATE_FILE.lock" python3 - "$MAX_AGE" "$BOARD" "$STATE_FILE" "$KANBAN_LOCK" <<'PYWORKER'
from __future__ import annotations
import json, os, subprocess, sys, time
from pathlib import Path
max_age=int(sys.argv[1]); board=sys.argv[2]; state_path=Path(sys.argv[3]); lock=sys.argv[4]
root='/home/wrhrgw/gw'; bot='/home/wrhrgw/gw-dev-bot'; profile_default='singde'
hermes=os.environ['HERMES_BIN']; profile=os.environ.get('HERMES_PROFILE', profile_default)
env=os.environ.copy(); env['HERMES_HOME']=os.environ.get('HERMES_HOME', bot+'/.hermes')
CORRUPT=('database disk image is malformed','file is not a database','disk i/o error','refusing to open corrupt kanban db')
RESTRICTED=('secret','.env','credential','token','password','production','prod db','운영 db','운영db','dns','domain','유료','비용','결제','migration','마이그레이션','배포','delete','force','삭제','강제')
RECOVER=('timeout','timed out','crash','crashed','stale','protocol violation','protocol-violation','iteration budget','iteration-budget','worker recovery')
def run(args, check=True):
    p=subprocess.run(args,cwd=root,env=env,text=True,capture_output=True)
    if check and p.returncode!=0: raise RuntimeError((p.stderr or p.stdout).strip())
    return p
def kanban(*args, check=True): return run(['flock',lock,hermes,'-p',profile,'kanban','--board',board,*args], check=check)
def load_state():
    if not state_path.exists(): return {'generation':0,'handled':{},'last_checked_at':0}
    try:
        d=json.loads(state_path.read_text()); d.setdefault('generation',0); d.setdefault('handled',{}); return d
    except Exception: return {'generation':0,'handled':{},'last_checked_at':0}
def save_state(st):
    tmp=state_path.with_suffix('.tmp'); tmp.write_text(json.dumps(st,ensure_ascii=False,indent=2)); tmp.replace(state_path)
def classify(t):
    blob='\\n'.join(str(t.get(k) or '') for k in ['title','body','result','status']).lower()
    if any(x in blob for x in RESTRICTED): return 'approval-required','승인/운영/비밀값/배포 가능성이 있어 자동 조치하지 않고 메인봇 확인 대상으로 둡니다.'
    if any(x in blob for x in RECOVER): return 'safe-triage-candidate','로그와 검증 근거 확인 후 메인봇이 안전 범위에서 재시도/재라우팅할 수 있는 후보입니다.'
    return 'manual-review','자동 복구 조건이 부족해 수동 분류가 필요합니다.'
p=kanban('list','--json', check=False)
if p.returncode!=0:
    text=(p.stderr or p.stdout or '').lower()
    if any(x in text for x in CORRUPT):
        print('worker recovery: kanban-corrupt-circuit-breaker', file=sys.stderr); sys.exit(75)
    print('worker recovery: kanban list 실패:', p.stderr.strip() or p.stdout.strip(), file=sys.stderr); sys.exit(1)
items=json.loads(p.stdout or '[]'); now=int(time.time()); st=load_state(); st['generation']=int(st.get('generation') or 0)+1; gen=st['generation']; handled=st.setdefault('handled',{})
actions=[]
for t in items:
    tid=t.get('id'); status=t.get('status'); title=t.get('title',''); reason=str(t.get('result') or title or '')
    if not tid: continue
    detected=None
    if status=='running':
        hb=t.get('last_heartbeat_at') or t.get('started_at')
        try: hb=int(hb) if hb else 0
        except Exception: hb=0
        if hb and now-hb > max_age: detected=f'stale-running>{max_age}s'
    elif status=='blocked' and any(k in reason.lower() for k in RECOVER): detected='blocked-timeout-like'
    if not detected: continue
    category,hint=classify(t); key=f'{tid}:{detected}:{category}'
    if key in handled: continue
    msg='\n'.join([
        f'[worker-recovery:{category}]',
        f'감지: {detected}',
        f'근거: status={status}, assignee={t.get("assignee") or "-"}, title={title}',
        f'복구 힌트: {hint}',
        '원칙: 자동 complete/unblock/restart 전에는 로그와 표준 검증 근거를 확인합니다. 위험 작업은 대장 승인 전 실행 금지.',
    ])
    kanban('comment',tid,msg,check=False)
    handled[key]={'at':now,'generation':gen,'category':category,'title':title[:180]}
    actions.append((tid,detected,category))
if len(handled)>500: st['handled']=dict(sorted(handled.items(), key=lambda kv: kv[1].get('at',0))[-500:])
st['last_checked_at']=now; save_state(st)
print('worker recovery 감지/힌트: '+', '.join(f'{a[0]}({a[1]}/{a[2]})' for a in actions) if actions else 'worker recovery: 감지된 신규 stale/timeout 카드 없음')
PYWORKER
}
if [[ "$ONCE" == "1" ]]; then
  run_once
else
  while true; do
    if ! out="$(run_once 2>&1)"; then
      rc=$?; echo "$out"; if [[ "$rc" -eq 75 ]]; then sleep "$CORRUPT_BACKOFF_SECONDS"; else sleep "$INTERVAL"; fi
    else
      echo "$out"; sleep "$INTERVAL"
    fi
  done
fi
