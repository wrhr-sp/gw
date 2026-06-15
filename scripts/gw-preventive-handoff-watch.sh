#!/usr/bin/env bash
set -euo pipefail
ROOT=/home/wrhrgw/gw
source "$ROOT/scripts/gw-hermes-env.sh"
INTERVAL="60"
BOARD="groupware"
STATE_FILE="$ROOT/.hermes/gw-preventive-handoff-watch.state"
ONCE=0
usage(){ cat <<'EOF'
사용법:
  ./scripts/gw-preventive-handoff-watch.sh [--once] [--interval 초] [--board 보드]

역할:
  카드가 막힌 뒤에야 복구하지 않도록, known blocker 패턴이 있는 ready/todo/running 카드에
  사전 handoff 코멘트를 붙입니다.
  - Cloudflare/wrangler/deploy/smoke 카드: .secrets/cloudflare.env 로드, wrangler check, .dev smoke gate 대체 증거 지침
  - GitHub PR/merge/release gate 카드: squash merge 후 branch cleanup 절차와 승인 게이트 회피 지침
  - admin exposure 카드: /admin* redirect/guard + 회귀 테스트 + 재배포 지침

금지:
  이 스크립트는 코멘트만 추가합니다. 배포/삭제/merge/secret 출력은 하지 않습니다.
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

def run(args, check=True):
    p=subprocess.run(args,cwd=root,env=env,text=True,capture_output=True)
    if check and p.returncode!=0:
        raise RuntimeError((p.stderr or p.stdout).strip())
    return p

def load_state():
    if not state_path.exists(): return {'commented': []}
    try: return json.loads(state_path.read_text())
    except Exception: return {'commented': []}

def save_state(st):
    tmp=state_path.with_suffix('.tmp')
    tmp.write_text(json.dumps(st,ensure_ascii=False,indent=2))
    tmp.replace(state_path)

def add_comment(tid,msg):
    return run([hermes,'-p',profile,'kanban','--board',board,'comment',tid,msg],check=False)

items=json.loads(run([hermes,'-p',profile,'kanban','--board',board,'list','--json']).stdout)
st=load_state(); commented=set(st.get('commented') or [])
added=[]
for t in items:
    tid=t.get('id'); status=t.get('status'); title=str(t.get('title') or ''); body=str(t.get('body') or '')
    assignee=str(t.get('assignee') or '')
    if not tid or status not in {'ready','todo','running'}: continue
    text=(title+'\n'+body).lower()
    messages=[]
    if any(k in text for k in ['cloudflare','workers.dev','wrangler','deploy:cf','preview url','web-app-hosting']):
        messages.append('''[preventive-handoff:cloudflare]
이 카드는 막히기 전에 아래를 먼저 적용하세요.
- Cloudflare 명령은 반드시 `set -a; . .secrets/cloudflare.env; set +a; <command>` 형태로 실행하고 secret 값은 출력하지 않습니다.
- 먼저 `bash scripts/gw-cloudflare-check.sh`, `pnpm --filter @gw/web build:cf`, `pnpm check`를 실행합니다.
- `.workers.dev` live fetch가 터미널 `.dev` lookalike gate에 막히면 즉시 blocked로 끝내지 말고, 가능한 범위에서 로컬 `preview:cf` smoke + `wrangler deployments list`/version id + 상위 Singde smoke metadata를 대체 증거로 남깁니다. 그래도 live HTTP가 필수이면 정확히 어떤 경로가 gate에 막혔는지만 보고합니다.
- custom domain/DNS/유료/production DB/R2 운영 작업은 별도 승인 전 하지 않습니다.''')
    if any(k in text for k in ['github pr','merge gate','release gate','branch cleanup','pr/ci/merge','github release']):
        messages.append('''[preventive-handoff:github-release]
이 카드는 막히기 전에 아래를 먼저 적용하세요.
- Squash merge 뒤 `git branch -d`가 실패할 수 있으므로, 먼저 PR merge 상태와 `git diff <branch>..main` 또는 patch-id 동등성을 확인합니다.
- 원격 branch 삭제 여부를 `git ls-remote --heads origin <branch>`로 확인합니다.
- 내용이 main과 동일하고 원격도 정리된 경우, 승인된 release cleanup 범위 안에서 로컬 branch를 안전 정리하고 근거를 코멘트/summary에 남깁니다.
- CI가 없으면 `gh pr checks` 결과와 로컬 검증 명령을 substitute evidence로 기록합니다.''')
    if any(k in text for k in ['admin exposure','/admin','admin route']):
        messages.append('''[preventive-handoff:admin-exposure]
이 카드는 막히기 전에 아래를 먼저 적용하세요.
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`가 익명 공개 preview에서 일반 admin skeleton으로 렌더링되지 않게 middleware/route guard/redirect/403/404 중 하나로 막습니다.
- `apps/web/admin-preview-guard.test.ts` 같은 회귀 테스트로 `/admin* -> /login` 또는 차단 상태를 확인합니다.
- 로컬 `preview:cf` smoke에서 `/admin*` 차단과 `/login` 정상 동작을 함께 기록한 뒤 재배포합니다.''')
    if assignee == 'singde' and any(k in title for k in ['최종 통합 보고', '최종보고', '작업 최종 결과']):
        messages.append('''[preventive-handoff:final-report-direct-delivery]
이 카드는 내부 Kanban 기록만으로 끝나면 안 됩니다.
- 카드 summary/result/comment는 내부 근거이고, 실제 최종보고는 싱드가 같은 대화/Telegram에 직접 전송해야 완료입니다.
- 보고 전에는 summary/result 어디엔가 `사용자 보고 필요`를 적고, 직접 전송을 끝낸 뒤에는 `사용자 보고 완료`와 함께 같은 카드 코멘트에 `[singde-direct-delivery]` 표식을 남겨 재확인 가능하게 합니다.
- live URL, 직접 눌러볼 route, 직접 해볼 액션, 테스트 권한 기준, 남은 승인 게이트를 빠뜨리지 않습니다.
- watcher/notify가 대신 보냈을 것이라고 추정하지 말고, 누락 발견 시 즉시 retroactive 보고 후 재발방지 기준을 남깁니다.''')
    for msg in messages:
        key=tid+':'+re.search(r'\[preventive-handoff:[^\]]+\]',msg).group(0)
        if key in commented: continue
        add_comment(tid,msg)
        commented.add(key); added.append(key)
st['commented']=sorted(commented); st['last_checked_at']=int(time.time()); save_state(st)
print('preventive handoff comments:', ', '.join(added) if added else '-')
PY
}
if [[ "$ONCE" == "1" ]]; then run_once; else while true; do run_once || true; sleep "$INTERVAL"; done; fi
