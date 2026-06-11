# RUNBOOK

## 기본 상태 확인

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```

DB integrity 확인:

```bash
python3 - <<'PY'
import sqlite3
con = sqlite3.connect('file:/home/wrhrgw/gw-dev-bot/.hermes/kanban/boards/groupware/kanban.db?mode=ro', uri=True)
print(con.execute('pragma integrity_check').fetchone()[0])
PY
```

## watcher 상태 확인

```bash
UID_W=$(id -u werehere)
export XDG_RUNTIME_DIR=/run/user/$UID_W
sudo -u werehere XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR systemctl --user is-active   gw-telegram-kanban-report-watch.service   gw-singde-second-pass-report-watch.service   gw-safe-triage-watch.service   gw-review-required-gate-watch.service   gw-ready-task-watch.service   gw-worker-recovery-watch.service
```

## review-required 게이트 수동 확인

```bash
bash -n scripts/gw-review-required-gate.sh
./scripts/gw-review-required-gate.sh --task <task_id>
```

## 자주 보는 장애

### 역할봇 Unknown skill crash

- 증상: `Error: Unknown skill(s): ...`
- 처리: 해당 역할봇 프로필에 필요한 skill 동기화 후 unblock/dispatch.
- 주의: 제품 코드 실패가 아니라 카드/프로필 설정 문제일 수 있다.

### watcher에서 pnpm을 못 찾음

- 증상: `pnpm: command not found`
- 처리: `scripts/gw-hermes-env.sh`의 PATH에 `/home/werehere/.local/bin`이 들어 있는지 확인하고 서비스 재시작.

### 검증 실패 blocked

- 승인된 코드/test/docs 범위면 원본 blocked 방치가 아니라 수정→리뷰→재검증 루프를 생성한다.
- secret/production DB/DNS/유료/외부 공개/migration/destructive 작업이면 사용자 승인 요청으로 분리한다.
