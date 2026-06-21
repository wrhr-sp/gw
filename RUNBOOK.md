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

## Phase 61 운영 DB 준비 메모

운영 DB 연결 준비는 `docs/guides/phase-61-operational-db-secret-cloudflare-rollback-runbook.md` 를 함께 본다.
운영자 handoff 순서는 `docs/guides/phase-61-operational-db-admin-handoff-checklist.md` 를 함께 본다.
핵심만 짧게 적으면 아래와 같다.

- secret 은 git ignored `.secrets/` 또는 승인된 secret store 로만 다룬다.
- 앱 runtime DB URL 해석 규칙은 `DATABASE_URL` 우선, 없으면 `APP_ENV=preview` 일 때 `DATABASE_URL_PREVIEW`, 그 외에는 `DATABASE_URL_PRODUCTION` 이다.
- migration/seed 스크립트는 runtime 규칙과 별개로 본다. preview target 은 `DATABASE_URL_PREVIEW` 우선이고, 수동 preview/local 범위에서만 `--allow-preview-fallback` 으로 `DATABASE_URL` fallback 을 허용할 수 있다.
- `workers.dev` 또는 preview 배포는 preview DB 기준, 승인된 custom domain 또는 production 배포 후보는 production DB 기준 후보로 읽는다.
- production migration/seed target 은 `DATABASE_URL_PRODUCTION` 필수다. `DATABASE_URL` fallback 은 금지하며, 값이 없으면 hard fail 한다.
- Cloudflare 명령은 `set -a; . .secrets/cloudflare.env; set +a; <command>` 패턴으로 실행한다.
- code rollback 과 DB rollback 을 같은 뜻으로 쓰지 않는다.
- DB rollback 은 destructive down migration 보다 snapshot restore 또는 forward-fix 우선으로 적는다.
- restore drill 은 preview/staging 우선, production 실복원은 별도 승인 후 진행한다.
- restore 뒤 최소 smoke 는 `/api/health`, `/login`, `/dashboard`, `/api/employees`, `/api/attendance/records`, `/api/leave/requests`, `/api/approvals/documents`, `/api/admin/audit-logs`, `/api/notifications` 순서로 본다.
- 운영자에게 먼저 받아야 할 결정은 provider 확정, secret 전달 경로, preview/prod URL 분리 여부, migration 승인 범위다.

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
