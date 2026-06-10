#!/usr/bin/env bash
set -euo pipefail
ROOT=/home/wrhrgw/gw
source "$ROOT/scripts/gw-hermes-env.sh"
INTERVAL="45"
BOARD="groupware"
STATE_FILE="$ROOT/.hermes/gw-report-delivery-watch.state"
CHAT_ID="${GW_REPORT_CHAT_ID:-8648561062}"
ONCE=0
INCLUDE_EXISTING=0
TASK_ID=""
FORCE=0
usage(){ cat <<'EOF'
사용법:
  ./scripts/gw-report-delivery-watch.sh [--once] [--include-existing] [--task TASK_ID] [--force] [--interval 초]

역할:
  singde 보고 카드(막힘 자동보고/최종 통합 보고)가 done 되면 카드 summary와 runs metadata를 읽어
  대장 DM으로 한 번 더 쉬운 한국어 해설 보고를 보냅니다. 기존 Kanban notify의 원문 알림을
  대장용 후속 보고로 보강하는 훅입니다.
EOF
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=1; shift ;;
    --include-existing) INCLUDE_EXISTING=1; shift ;;
    --task) TASK_ID="${2:?--task requires task id}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --interval) INTERVAL="${2:?--interval requires seconds}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; usage >&2; exit 2 ;;
  esac
done
run_once(){
  mkdir -p "$(dirname "$STATE_FILE")"
  python3 - "$BOARD" "$STATE_FILE" "$CHAT_ID" "$INCLUDE_EXISTING" "$TASK_ID" "$FORCE" <<'PY'
from __future__ import annotations
import json, os, re, subprocess, sys, time, urllib.parse, urllib.request
from pathlib import Path
board, state_s, chat_id, include_s, task_id, force_s = sys.argv[1:7]
state_path=Path(state_s); include_existing=include_s=='1'; force=force_s=='1'
root='/home/wrhrgw/gw'; hermes=os.environ['HERMES_BIN']; profile=os.environ.get('HERMES_PROFILE','singde')
env=os.environ.copy(); env['HERMES_HOME']=os.environ.get('HERMES_HOME','/home/wrhrgw/gw-dev-bot/.hermes')
def token_from_singde_gateway() -> str:
    # The global Hermes .env belongs to the gw-dev-bot/Aria gateway. For Singde
    # follow-up reports, use the token already injected into the running
    # singde-gateway.py process. This keeps the message sender as Singde.
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():
            continue
        try:
            cmdline=(proc/'cmdline').read_bytes().replace(b'\x00', b' ').decode('utf-8','ignore')
            if 'singde-gateway.py' not in cmdline:
                continue
            env_bytes=(proc/'environ').read_bytes().split(b'\x00')
        except Exception:
            continue
        values={}
        for item in env_bytes:
            if b'=' not in item:
                continue
            k,v=item.split(b'=',1)
            if k in {b'SINGDE_TELEGRAM_BOT_TOKEN', b'TELEGRAM_BOT_TOKEN'}:
                values[k.decode()]=v.decode('utf-8','ignore').strip()
        return values.get('SINGDE_TELEGRAM_BOT_TOKEN') or values.get('TELEGRAM_BOT_TOKEN') or ''
    return ''
TOKEN=os.environ.get('SINGDE_TELEGRAM_BOT_TOKEN') or token_from_singde_gateway()
def run(args, check=True):
    p=subprocess.run(args,cwd=root,env=env,text=True,capture_output=True)
    if check and p.returncode!=0: raise RuntimeError((p.stderr or p.stdout).strip())
    return p
def load_state():
    if not state_path.exists(): return {'initialized_at': None, 'sent': []}
    try: return json.loads(state_path.read_text())
    except Exception: return {'initialized_at': None, 'sent': []}
def save_state(st):
    tmp=state_path.with_suffix('.tmp'); tmp.write_text(json.dumps(st,ensure_ascii=False,indent=2)); tmp.replace(state_path)
def is_report(t):
    title=t.get('title') or ''
    return t.get('assignee')=='singde' and (title.startswith('막힘 자동보고:') or title.startswith('최종 통합 보고:'))
def latest_run(tid):
    p=run([hermes,'-p',profile,'kanban','--board',board,'runs',tid,'--json'],check=False)
    if p.returncode!=0: return {}
    try:
        arr=json.loads(p.stdout or '[]')
        return arr[-1] if arr else {}
    except Exception: return {}
def compact(s, n=900):
    s=' '.join((s or '').split())
    return s[:n]+('…' if len(s)>n else '')
def classify(title, run):
    md=run.get('metadata') or {}
    summary=run.get('summary') or ''
    if title.startswith('막힘 자동보고:'):
        if md.get('approval_needed') is True: return '승인 필요'
        if md.get('classification') in {'completed_stale_block_report','auto_recovered','completed'} or '승인' in summary and '필요하지' in summary: return '자동 처리/해소'
        if '보류' in summary: return '위험 보류'
        return '막힘 확인'
    return '완료 보고'
def format_msg(task, run):
    title=task.get('title') or task.get('id')
    tid=task.get('id')
    summary=run.get('summary') or task.get('result') or '(요약 없음)'
    md=run.get('metadata') or {}
    label=classify(title, run)
    lines=[f'대장, 보고카드 확인했어.', '', f'- 카드: {tid}', f'- 구분: {label}', f'- 제목: {title}', f'- 요약: {compact(summary, 750)}']
    src=md.get('source_task_id') or md.get('next_task_id')
    if md.get('source_task_id'): lines.append(f'- 원본 카드: {md.get("source_task_id")} / 상태: {md.get("source_status", "확인됨")}')
    if md.get('next_task_id'): lines.append(f'- 다음 카드: {md.get("next_task_id")} / 상태: {md.get("next_task_status", "확인됨")}')
    if md.get('approval_needed') is True: lines.append('- 조치: 대장 승인 필요. 승인 전 실행 안 함.')
    elif title.startswith('막힘 자동보고:'): lines.append('- 조치: 추가 승인 없이 자동 처리/정상 진행 확인.')
    else: lines.append('- 조치: 최종 결과 확인 보고.')
    return '\n'.join(lines)
def send_telegram(text):
    if not TOKEN: raise RuntimeError('TELEGRAM_BOT_TOKEN not found')
    data=urllib.parse.urlencode({'chat_id':chat_id,'text':text,'disable_web_page_preview':'true'}).encode()
    req=urllib.request.Request(f'https://api.telegram.org/bot{TOKEN}/sendMessage', data=data)
    with urllib.request.urlopen(req, timeout=20) as resp:
        body=resp.read().decode('utf-8','ignore')
        if resp.status >= 300: raise RuntimeError(f'telegram status {resp.status}')
        return body
st=load_state(); sent=set(st.get('sent') or [])
items=json.loads(run([hermes,'-p',profile,'kanban','--board',board,'list','--json']).stdout)
all_done_reports=[t for t in items if t.get('status')=='done' and is_report(t)]
reports=list(all_done_reports)
if task_id:
    reports=[t for t in items if t.get('id')==task_id]
    if not reports: raise RuntimeError(f'task not found: {task_id}')
    if reports[0].get('status')!='done': raise RuntimeError(f'task not done: {task_id}')
first=st.get('initialized_at') is None
if first:
    # 서비스를 켰을 때 예전 완료카드가 줄줄이 재발송되지 않도록 현재 완료 보고카드는 baseline 한다.
    # 단 --task/--force로 명시한 카드는 아래 발송 루프에서 보낼 수 있게 sent에서 제거한다.
    sent.update(t.get('id') for t in all_done_reports if t.get('id'))
    if task_id and force:
        sent.discard(task_id)
    st['initialized_at']=int(time.time())
if first and not include_existing and not task_id:
    st['sent']=sorted(sent); st['last_checked_at']=int(time.time()); save_state(st)
    print('report delivery: 기존 완료 보고카드 baseline 처리, 신규 발송 없음')
    sys.exit(0)
created=[]
for t in reports:
    tid=t.get('id')
    if not tid: continue
    if tid in sent and not force: continue
    runinfo=latest_run(tid)
    msg=format_msg(t, runinfo)
    send_telegram(msg)
    sent.add(tid); created.append(tid)
st['sent']=sorted(sent); st['last_checked_at']=int(time.time()); save_state(st)
print('report delivery sent:', ', '.join(created) if created else '신규 후속 보고 없음')
PY
}
if [[ "$ONCE" == "1" ]]; then run_once; else while true; do run_once || true; sleep "$INTERVAL"; done; fi
