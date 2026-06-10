#!/usr/bin/env bash
set -euo pipefail
ROOT=/home/wrhrgw/gw
source "$ROOT/scripts/gw-hermes-env.sh"
INTERVAL="60"
BOARD="groupware"
STATE_FILE="$ROOT/.hermes/gw-superseded-chain-cleanup-watch.state"
ONCE=0
usage(){ cat <<'EOF'
사용법:
  ./scripts/gw-superseded-chain-cleanup-watch.sh [--once] [--interval 초] [--board 보드]

역할:
  remediation/복구 체인의 최종 보고가 done 된 뒤, 원본 blocked 체인에 남은 blocked/todo/ready 카드를
  "대체 완료" 코멘트와 함께 archive 처리합니다. done/running 카드는 건드리지 않습니다.
  production/secret/DNS/유료/배포/DB 작업은 하지 않습니다.
EOF
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=1; shift ;;
    --interval) INTERVAL="${2:?--interval requires seconds}"; shift 2 ;;
    --board) BOARD="${2:?--board requires board}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; usage >&2; exit 2 ;;
  esac
done
run_once(){
  mkdir -p "$(dirname "$STATE_FILE")"
  python3 - "$BOARD" "$STATE_FILE" <<'PY'
from __future__ import annotations
import json, os, re, subprocess, sys, time
from pathlib import Path
board, state_s=sys.argv[1:3]
state_path=Path(state_s)
root='/home/wrhrgw/gw'
hermes=os.environ['HERMES_BIN']
profile=os.environ.get('HERMES_PROFILE','singde')
env=os.environ.copy(); env['HERMES_HOME']=os.environ.get('HERMES_HOME','/home/wrhrgw/gw-dev-bot/.hermes')
SAFE_ARCHIVE_STATUSES={'blocked','todo','ready','scheduled'}

def run(args, check=True):
    p=subprocess.run(args,cwd=root,env=env,text=True,capture_output=True)
    if check and p.returncode!=0:
        raise RuntimeError((p.stderr or p.stdout).strip())
    return p

def load_state():
    if not state_path.exists(): return {'processed': []}
    try: return json.loads(state_path.read_text())
    except Exception: return {'processed': []}

def save_state(st):
    tmp=state_path.with_suffix('.tmp')
    tmp.write_text(json.dumps(st,ensure_ascii=False,indent=2))
    tmp.replace(state_path)

def task_show(tid):
    p=run([hermes,'-p',profile,'kanban','--board',board,'show',tid,'--json'],check=False)
    if p.returncode!=0: return None
    try: return json.loads(p.stdout)
    except Exception: return None

def latest_metadata(show):
    runs=show.get('runs') or []
    if not runs: return {}
    return runs[-1].get('metadata') or {}

def extract_source_ids(show):
    task=show.get('task') or {}
    md=latest_metadata(show)
    ids=[]
    ev=(md.get('evidence') or {}) if isinstance(md,dict) else {}
    for key in ['original_review_card','source_task_id','original_blocked_card']:
        v=ev.get(key) or md.get(key)
        if isinstance(v,str) and re.fullmatch(r't_[0-9a-f]+',v): ids.append(v)
    text='\n'.join(str(x or '') for x in [task.get('title'), task.get('body'), show.get('latest_summary')])
    if 'remediation' in text or '복구' in text or '대체' in text:
        ids.extend(re.findall(r't_[0-9a-f]+', text))
    # keep order, unique
    seen=set(); out=[]
    for x in ids:
        if x not in seen:
            seen.add(x); out.append(x)
    return out

def should_consider_final(t):
    title=str(t.get('title') or '')
    return t.get('status')=='done' and t.get('assignee')=='singde' and title.startswith('최종 통합 보고:')

def final_proves_replacement(show):
    task=show.get('task') or {}
    md=latest_metadata(show)
    text='\n'.join(str(x or '') for x in [task.get('title'), task.get('body'), show.get('latest_summary'), json.dumps(md,ensure_ascii=False)])
    return (('remediation' in text or '복구' in text or '대체' in text) and
            ('완료' in text or 'merge' in text or 'PR #' in text or 'merged' in text))

def collect_chain(source_id):
    out=[]; stack=[source_id]; seen=set()
    while stack:
        tid=stack.pop(0)
        if tid in seen: continue
        seen.add(tid)
        sh=task_show(tid)
        if not sh: continue
        task=sh.get('task') or {}
        status=task.get('status')
        if status in SAFE_ARCHIVE_STATUSES:
            out.append((tid, task.get('title') or '', status))
            stack.extend(sh.get('children') or [])
        elif status in {'done','archived'}:
            # Done child may still have stale descendants, but avoid traversing completed replacement chains.
            continue
        elif status=='running':
            continue
    return out

st=load_state(); processed=set(st.get('processed') or [])
items=json.loads(run([hermes,'-p',profile,'kanban','--board',board,'list','--json']).stdout)
archived=[]
for t in items:
    tid=t.get('id')
    if not tid or tid in processed or not should_consider_final(t):
        continue
    sh=task_show(tid)
    if not sh or not final_proves_replacement(sh):
        processed.add(tid); continue
    candidates=[]
    for src in extract_source_ids(sh):
        src_show=task_show(src)
        if not src_show: continue
        src_task=src_show.get('task') or {}
        # Only clean chains whose root is still non-terminal. Never archive completed replacement work.
        if src_task.get('status') in SAFE_ARCHIVE_STATUSES:
            candidates.extend(collect_chain(src))
    # de-dupe and archive
    seen=set(); targets=[]
    for tid2,title,status in candidates:
        if tid2 not in seen:
            seen.add(tid2); targets.append((tid2,title,status))
    if targets:
        reason=f'대체 완료 자동정리: 최종 보고 {tid} 완료로 remediation/복구 체인이 끝났습니다. 이 원본 잔여 카드는 중복 실행 방지를 위해 archive 처리합니다.'
        for tid2,_,_ in targets:
            run([hermes,'-p',profile,'kanban','--board',board,'comment',tid2,reason],check=False)
        run([hermes,'-p',profile,'kanban','--board',board,'archive',*[x[0] for x in targets]],check=False)
        archived.extend([x[0] for x in targets])
    processed.add(tid)
st['processed']=sorted(processed); st['last_checked_at']=int(time.time()); save_state(st)
print('superseded cleanup archived:', ', '.join(archived) if archived else '정리 대상 없음')
PY
}
if [[ "$ONCE" == "1" ]]; then run_once; else while true; do run_once || true; sleep "$INTERVAL"; done; fi
