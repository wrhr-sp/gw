#!/usr/bin/env bash
set -euo pipefail
ROOT=/home/wrhrgw/gw
source "$ROOT/scripts/gw-hermes-env.sh"
INTERVAL="60"
STATE_FILE="$ROOT/.hermes/gw-blocked-report-watch.state"
ONCE=0
INCLUDE_EXISTING=0
BOARD="groupware"
usage() {
  cat <<'EOF'
사용법:
  ./scripts/gw-blocked-report-watch.sh [--once] [--interval 초] [--board 보드] [--include-existing]

역할:
  그룹웨어 Kanban 카드가 blocked/review-required 상태가 된 경우만 싱드(singde) 보고 카드로 자동 정리합니다.
  일반 진행/완료 카드는 자동보고하지 않습니다. 즉 자동보고 예외범위는 "멈춤·승인필요·복구필요"로 제한합니다.
  이미 보고한 막힘은 state 파일에 기록해 중복 보고를 막습니다.
EOF
}
is_positive_int() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=1; shift ;;
    --interval) [[ $# -ge 2 ]] || { echo "--interval에는 숫자 값이 필요합니다." >&2; usage >&2; exit 2; }; INTERVAL="$2"; shift 2 ;;
    --board) [[ $# -ge 2 ]] || { echo "--board에는 보드 이름이 필요합니다." >&2; usage >&2; exit 2; }; BOARD="$2"; shift 2 ;;
    --include-existing) INCLUDE_EXISTING=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; usage >&2; exit 2 ;;
  esac
done
if ! is_positive_int "$INTERVAL"; then echo "interval은 양의 정수여야 합니다: $INTERVAL" >&2; exit 2; fi
run_once() {
  mkdir -p "$(dirname "$STATE_FILE")"
  python3 - "$BOARD" "$STATE_FILE" "$INCLUDE_EXISTING" <<'PY'
from __future__ import annotations
import hashlib, json, os, subprocess, sys, time
from pathlib import Path
board=sys.argv[1]; state_path=Path(sys.argv[2]); include_existing=sys.argv[3]=='1'
root='/home/wrhrgw/gw'; hermes=os.environ['HERMES_BIN']; profile=os.environ.get('HERMES_PROFILE','singde')
report_platform=os.environ.get('GW_REPORT_PLATFORM',''); report_chat_id=os.environ.get('GW_REPORT_CHAT_ID',''); report_notifier_profile=os.environ.get('GW_REPORT_NOTIFIER_PROFILE','singde')
env=os.environ.copy(); env['HERMES_HOME']=os.environ.get('HERMES_HOME','/home/wrhrgw/gw-dev-bot/.hermes')
def run(args, check=True):
    proc=subprocess.run(args,cwd=root,env=env,text=True,capture_output=True)
    if check and proc.returncode!=0: raise RuntimeError((proc.stderr or proc.stdout).strip())
    return proc
def load_state():
    if not state_path.exists(): return {'initialized_at':None,'reported':[]}
    try: return json.loads(state_path.read_text())
    except Exception: return {'initialized_at':None,'reported':[]}
def save_state(state):
    tmp=state_path.with_suffix('.tmp'); tmp.write_text(json.dumps(state,ensure_ascii=False,indent=2)); tmp.replace(state_path)
def compact(text,limit=420):
    text=' '.join((text or '').split()); return text[:limit]+('…' if len(text)>limit else '')
def signature(task):
    source='|'.join([str(task.get('id') or ''),str(task.get('status') or ''),compact(str(task.get('result') or task.get('latest_summary') or ''),240)])
    return hashlib.sha256(source.encode()).hexdigest()[:16]
def is_report_card(task):
    return str(task.get('title') or '').startswith('막힘 자동보고:') or str(task.get('created_by') or '')=='gw-blocked-report-watch'
state=load_state(); first_run=state.get('initialized_at') is None; reported=set(state.get('reported') or [])
proc=run([hermes,'-p',profile,'kanban','--board',board,'list','--json']); tasks=json.loads(proc.stdout)
now=int(time.time()); created=[]; seen_existing=[]
for task in tasks:
    tid=task.get('id'); status=task.get('status')
    if not tid or status!='blocked': continue
    if is_report_card(task): continue
    sig=f'{tid}:{signature(task)}'
    if sig in reported: continue
    if first_run and not include_existing: seen_existing.append(sig); continue
    title=task.get('title') or '(제목 없음)'; assignee=task.get('assignee') or '(미지정)'; result=compact(str(task.get('result') or task.get('latest_summary') or 'blocked 상태지만 요약이 비어 있음'))
    report_title=f'막힘 자동보고: {title}'[:120]
    body=('그룹웨어 Kanban 막힘 자동보고입니다.\n\n'
          f'- 원본 카드: {tid}\n- 제목: {title}\n- 담당: {assignee}\n- 상태: {status}\n- 요약/이유: {result}\n\n'
          '싱드는 원본 카드 show/runs/log 및 관련 PR/CI/작업트리 상태를 확인한다. '
          '승인된 범위 안에서 안전하게 자동 조치 가능한 경우에는 조치 후 결과를 쉬운 한국어로 보고한다. '
          '사용자 승인이 필요한 경우에는 실행하지 말고 승인 요청 보고로 정리한다. '
          '위험하거나 범위 밖이면 보류 사유를 보고한다. '
          '분류 기준: 완료/자동 복구 가능/사용자 승인 필요/위험 보류. '
          '비밀값은 출력하지 않는다. production DB, secret, DNS, 유료, 외부 공개, production migration, 파괴적 정리는 승인 전 실행하지 않는다. '
          '일반 진행/완료 카드는 보고하지 않고, blocked/review-required/권한·배포·비밀값·외부연결 실패 같은 예외만 보고한다.')
    create=run([hermes,'-p',profile,'kanban','--board',board,'create',report_title,'--assignee','singde','--workspace',f'dir:{root}','--created-by','gw-blocked-report-watch','--idempotency-key',f'blocked-report:{sig}','--priority','95','--body',body,'--json'])
    data=json.loads(create.stdout); created_id=data.get('id') or data.get('task_id'); created.append(created_id)
    if created_id and report_chat_id and report_platform:
        run([hermes,'-p',profile,'kanban','--board',board,'notify-subscribe',created_id,'--platform',report_platform,'--chat-id',report_chat_id,'--notifier-profile',report_notifier_profile],check=False)
        run([hermes,'-p',profile,'kanban','--board',board,'comment',created_id,
             'Telegram 보고 구독 연결 완료. 싱드는 원본 카드/show/runs/log/PR/CI/작업트리를 확인하고, 안전한 자동 조치 가능 시 조치 후 보고, 승인 필요 시 승인요청 보고, 위험 시 보류 보고로 complete해야 합니다.'],check=False)
    if created_id:
        run([hermes,'-p',profile,'kanban','--board',board,'dispatch','--max','1'],check=False)
    reported.add(sig)
if first_run:
    reported.update(seen_existing); state['initialized_at']=now
state['reported']=sorted(reported); state['last_checked_at']=now; save_state(state)
print('blocked report cards created:', ', '.join([c for c in created if c]) if created else '신규 막힘 보고 없음')
PY
}
if [[ "$ONCE" == "1" ]]; then run_once; else while true; do run_once || true; sleep "$INTERVAL"; done; fi
