# RUNBOOK

## 운영 최소 기준선 (Phase 48)

현재 운영 관제 기준은 full dashboard/alerting 이 아니라 아래 최소 확인 세트다.

- `/api/health` — `service`, `status`, `version` 확인용 최소 liveness
- preview smoke — 로그인/권한/주요 route 경계 회귀 확인
- build/release gate — 배포 전 정적 검증과 Cloudflare build 확인
- `DEPLOYMENT.md` — 현재 live URL, 배포 후 smoke, rollback 원칙 확인

주의:
- backup/restore/incident 대응은 아직 수동 절차와 승인 게이트 중심이다.
- production DB 실복원, secret 입력/교체, DNS/custom domain, 유료 리소스, 외부 alerting/SIEM 은 이 runbook 범위 밖이다.

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
sudo -u werehere XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR systemctl --user is-active   gw-ready-task-watch.service   gw-review-required-gate-watch.service   gw-worker-recovery-watch.service
sudo -u werehere XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR systemctl --user is-enabled gw-hourly-status-report.timer
# Telegram 즉시/이벤트 보고 unit은 삭제된 상태가 정상이다.
for unit in gw-safe-triage-watch.service gw-telegram-kanban-report-watch.service gw-singde-second-pass-report-watch.service; do
  test ! -e /home/werehere/.config/systemd/user/$unit
done
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
