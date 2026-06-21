# scripts

반복 작업을 자동화하는 스크립트를 두는 폴더다.

## 자주 쓰는 그룹웨어 스크립트

- release gate 운영 기준은 `docs/plans/release-gate.md`를 먼저 본다.
- `gw-kanban-status.sh`: 그룹웨어 Kanban 보드 상태 확인
- `gw-kanban-dispatch-dry-run.sh`: 자동 실행 후보 미리 보기
- `gw-auto-workflow.sh`: 작업 유형별 자동 파이프라인 생성
- `gw-ci-status.sh`: GitHub Actions 최근 상태와 최신 실행 상세 확인
- `gw-pr-flow.sh`: PR 생성/CI 대기/merge/브랜치 삭제를 preview-first 방식으로 보조
- `gw-deploy-smoke-check.sh`: Cloudflare 전환 이후 Web/API URL을 읽기 요청으로 smoke check (`localhost`/private/metadata 대역은 기본 차단)
- `gw-cloudflare-readiness.sh`: Cloudflare 전환 준비 상태를 secret 값 출력 없이 점검
- `gw-cloudflare-web-preview-check.sh`: OpenNext Cloudflare local preview를 mock upstream과 함께 검증
- `gw-db-safe.sh`: DB migration·seed 명령을 승인 게이트로 감싸는 안전 래퍼

- `gw-phase-workflow.sh`: Phase 기준 Kanban 묶음 생성 전 release backpressure 확인 (`--board`가 backpressure 조회와 파이프라인 생성에 함께 반영됨)
- `gw-hermes-env.sh`: systemd user 서비스/다른 셸에서도 그룹웨어 bot home, singde 기본 profile, PATH를 고정하는 공통 실행 환경
- `gw-review-required-gate.sh`: blocked `review-required` 카드를 표준 검증 후 complete/dispatch 하거나 자동 복구 루프로 넘기는 게이트
- `gw-review-required-recovery-loop.sh`: review-required gate 검증 실패 시 `gwbuilder → gwreviewer → gwtester → singde` 복구 미니 체인을 생성
- `gw-blocked-remediation-watch.sh`: blocked 카드를 release cleanup → stale/superseded → review-required defer → 자동 재수정 후보 → 승인 필요 순으로 재판단하고, `already-handled`도 기존 체인 상태를 다시 확인한다
- `gw-worker-recovery-watch.sh`: timeout/crash/stale worker 감지와 복구 코멘트 보조 (`--help`, `--interval`, `--max-age`, `--dry-run`, `--fixture-json` 지원). 추가로 최근 완료된 singde 최종보고 카드에 `사용자 보고 완료` 또는 `[singde-direct-delivery]` 표식이 없으면 직접 보고 누락 재확인 코멘트를 남기고, 모든 부모가 done 인 다음 Phase 기획/DB 전환 child 카드가 scheduled 로 남아 있으면 별도 수동 hold 표식이 없는 경우 자동 unblock+dispatch 한다.
- Telegram 사용자 보고는 Kanban 이벤트 raw 중계가 아니라 싱드가 이벤트/카드/runs/log를 확인해 직접 판단한 뒤 보내는 방식이다.
- 허용 보고 유형은 `자동 조치`, `사용자 승인 필요`, `정각 보고`, `작업 최종 결과` 4가지다.
- `정각 보고`는 기존 `gw-hourly-status-report.timer` 경로를 유지하고, 나머지 3가지는 싱드 판단 보고양식을 따른다.
- 보고 watcher나 보조 스크립트를 수정할 때도 카드 생성/상태변경/댓글 이벤트 자체를 Telegram으로 그대로 보내지 않는다.
- 사용자-facing 보고는 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 분리한다.
- blocked 설명은 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요 중 하나로 남긴다.
- 카드 댓글만 달렸다고 사용자 보고 완료로 보지 않고, 실제 직접 보고 여부를 따로 확인한다.
- singde 최종보고 카드는 direct delivery 전 `사용자 보고 필요`, direct delivery 후 `사용자 보고 완료`와 `[singde-direct-delivery]` 코멘트를 남겨 watcher가 재확인 가능하게 한다.
- 같은 카드·같은 이유·같은 근거라면 즉시 보고를 반복하지 않고, 상태 변화가 생겼을 때만 다시 보낸다.
- 역할별 기본 책임은 planner=범위, builder=구현, reviewer=리뷰, tester=검증, docs=문서/보고 양식, ops=PR·CI·release cleanup 으로 유지한다.
- `PR merge`, `release gate`, `branch cleanup`, `review-required 정리`, `stale blocker 정리`, `검증 재실행`은 카드 범위에 적힌 경우만 예외 권한으로 쓴다.

## 자동화 보강 스크립트 예시

PR 상태 확인/CI 대기:

```bash
./scripts/gw-pr-flow.sh --head feat/example --show-status --wait-ci
```

merge/브랜치 삭제는 명시 승인 플래그가 있어야 실행된다.

```bash
./scripts/gw-pr-flow.sh --head feat/example --show-status --wait-ci --merge --delete-branch --approved
```

배포 smoke check:

```bash
CLOUDFLARE_WEB_URL="https://<cloudflare-pages-url>" CLOUDFLARE_API_URL="https://<cloudflare-api-url>" ./scripts/gw-deploy-smoke-check.sh
```

또는 URL을 직접 넘긴다.

```bash
./scripts/gw-deploy-smoke-check.sh   --web-url https://<cloudflare-pages-url>   --api-url https://<cloudflare-api-url>
```

private/localhost/metadata 주소는 기본 차단된다. 정말 필요한 점검일 때만 `--allow-private`를 명시한다.

DB 작업 preview:

```bash
./scripts/gw-db-safe.sh --env prod --mode migrate-preview
./scripts/gw-db-safe.sh --env staging --mode status
```

Cloudflare 전환 준비 점검:

```bash
pnpm cloudflare:readiness
```

이 명령은 아래처럼 보는 것이 쉽다.

- 목적: Cloudflare 전환에 필요한 파일/문서/secret key 이름이 있는지 확인
- 특징: secret 값 자체는 출력하지 않음
- 기본 동작: 하나라도 실패하면 exit code 1
- 보고용만 필요할 때: `./scripts/gw-cloudflare-readiness.sh --report-only`

Cloudflare local preview 빠른 확인:

```bash
./scripts/gw-cloudflare-web-preview-check.sh
```

이 스크립트는 내부적으로 아래 순서로 동작한다.

1. mock API를 `127.0.0.1:4100`에 띄운다.
2. `apps/web`에서 `API_BASE_URL`을 넣고 `pnpm cf:build`를 실행한다.
3. 같은 `API_BASE_URL`을 넣고 `pnpm cf:preview`를 실행한다.
4. Preview 기본 포트 `8788`에서 `/`, `/properties`, `/api/health`, `/api/properties`, availability 경로를 확인한다.

직접 env 이름을 기억할 때는 아래만 구분하면 된다.

- local preview build/실행: `API_BASE_URL`
- preview-check 포트 조정: `CLOUDFLARE_WEB_PREVIEW_PORT`, `CLOUDFLARE_WEB_MOCK_API_PORT`
- 실제 배포 URL smoke check: `CLOUDFLARE_WEB_URL`, `CLOUDFLARE_API_URL`

자주 헷갈리는 점:
- `CLOUDFLARE_WEB_URL`, `CLOUDFLARE_API_URL`은 local preview를 띄우는 값이 아니다.
- local preview는 외부 URL 대신 `API_BASE_URL`로 upstream API를 가리킨다.
- `cf:build`와 `cf:preview`에 넣는 `API_BASE_URL`은 같게 맞추는 편이 안전하다.

공개 Preview/production 배포 가드:

```bash
DEPLOY_ENV=preview DEPLOY_VISIBILITY=public pnpm cloudflare:public-guard
DEPLOY_ENV=production CF_PAGES_BRANCH=main pnpm cloudflare:public-guard
```

위 가드는 `ENABLE_TEST_AUTH=true` 와 public 대상이 같이 잡히면 종료 코드 1로 막는다.

`pnpm cloudflare:readiness`는 기본적으로 하나라도 실패하면 exit code 1로 종료한다. CI/CD와 배포 자동화는 이 실패를 전환 금지 신호로 취급해야 한다. 단순 보고용으로만 확인할 때는 아래처럼 실행한다.

```bash
./scripts/gw-cloudflare-readiness.sh --report-only
```

Cloudflare DNS/D1/legacy 전환 체크리스트는 `docs/deployment/cloudflare-cutover-runbook.md`를 기준으로 본다. prod seed는 기본 차단된다. dev/staging seed도 `--allow-seed --approved` 없이는 실행되지 않는다.

실패 시 먼저 볼 곳:

- readiness 실패: `.secrets/cloudflare.env` 파일 존재 여부, key 이름 오타
- preview-check 실패: `8788` 또는 `4100` 포트 충돌, `API_BASE_URL` 누락
- smoke check 입력 차단: `CLOUDFLARE_WEB_URL`, `CLOUDFLARE_API_URL`이 비었거나 private 주소
- availability가 SKIP: `--property-id` 없이 `--check-availability`만 넣은 경우

Phase 생성 전 backpressure 확인:

```bash
./scripts/gw-phase-workflow.sh --phase automation-hardening --board groupware --preview
```

worker timeout/crash 감지 1회 실행:

```bash
./scripts/gw-worker-recovery-watch.sh --help
./scripts/gw-worker-recovery-watch.sh --once --interval 60 --max-age 1800
./scripts/gw-worker-recovery-watch.sh --once --dry-run --fixture-json ./scripts/fixtures/gw-worker-recovery-final-report-next-phase.json
GW_WORKER_RECOVERY_STATE_FILE=/tmp/gw-worker-recovery-fixture.state.json ./scripts/gw-worker-recovery-watch.sh --once --dry-run --fixture-json ./scripts/fixtures/gw-worker-recovery-final-report-next-phase.json
```

review-required gate / 반복 실패 복구 빠른 확인:

```bash
bash -lc 'source ./scripts/gw-hermes-env.sh && command -v pnpm && command -v "$HERMES_BIN"'
bash ./scripts/gw-review-required-gate.sh --dry-run
bash ./scripts/gw-review-required-recovery-loop.sh --help
```

이 묶음의 운영 의도는 아래와 같다.

- `review-required`는 무조건 사람 승인 대기가 아니라, 표준 검증으로 닫히면 complete + dispatch로 넘긴다.
- test/typecheck/build/check 실패처럼 복구 가능한 항목은 원본 blocked 카드 방치 대신 자동 재수정→재리뷰→재검증→복구 정리 체인으로 보낸다.
- blocked remediation watcher는 release cleanup → stale/superseded → review-required defer → 자동 재수정 후보 → 승인 필요 순서를 먼저 보고, `already-handled` 로그가 떠도 기존 체인(run/show/댓글) 상태를 재확인한 뒤에만 넘긴다.
- branch cleanup/release gate 자동 정리는 PR merged, PR head checks, main release-gate success, remote branch absence, patch-id 동등성 또는 branch 부재, dirty worktree 안전성을 같이 확인했을 때만 닫는다.
- 같은 카드/같은 실패군에서 `반려`, `검증 실패`, `자동 재수정`이 3회 이상 반복되면 새 재수정 카드를 계속 늘리지 않고 싱드가 직접 원본 카드, runs/log, 실패 명령, 변경 파일, 중복 worker 여부를 확인한다.
- 자동 조치 가능하면 기준 복구 카드 1개만 남기고 다시 수정→리뷰→검증 체인으로 넘긴다.
- secret, production DB, DNS, 유료, 외부 공개, migration, destructive 삭제는 끝까지 자동 처리하지 않는다.
- Phase 최종 통합 보고가 done 인데 다음 Phase 기획/DB 전환 child 카드가 scheduled 로 남아 있으면, watcher 는 fixture/dry-run 또는 read-only 링크 확인 후 수동 hold 표식이 없는 카드만 자동 재개한다.
- Telegram 보고는 `자동 조치`, `사용자 승인 필요`, `정각 보고`, `작업 최종 결과` 4가지로 제한하고, 별도 보고 카드나 `notify-subscribe`를 만들지 않는다.
- 이번 테스트 기준으로 `gw-review-required-recovery-loop.sh` 실제 카드 생성 경로와 `gw-hermes-env.sh`의 직접 PATH 출력은 아직 별도 캡처가 없다. 운영 전에는 테스트용 blocked 카드 1건과 systemd user 셸에서 마지막 확인을 한 번 더 두는 편이 안전하다.

텔레그램 정각보고 확인:

```bash
# 실제 전송 없이 정각 보고 문구 확인
python3 ./scripts/gw-hourly-status-report.py --dry-run --force
```

카드 이벤트 자동 보고 watcher와 safe-triage 즉시 보고는 제거됐다. `자동 조치`, `사용자 승인 필요`, `작업 최종 결과`가 필요하면 Kanban 이벤트 raw 중계가 아니라 싱드가 이벤트를 읽고 판단해 보고양식으로 직접 보고한다.

간단 보고 템플릿 예시:

```text
[작업 최종 결과]
한 줄 결론: 관리자 PWA 관련 문서 기준을 정리했습니다.
자동화가 한 일: 문서 수정, 체크리스트 반영, 기준 정리
싱드가 직접 개입한 일: 최종 사용자 보고 누락 여부 재확인
자동화가 못 끝낸 이유: 없음
보완한 자동화: 다음부터는 사용자 직접 보고 완료 여부를 따로 기록
사용자가 보면 되는 곳: /, /offline, /manifest.webmanifest
대장이 해줄 일: 없음
```

## 운영 팁

추천 순서:
1. `gw-kanban-status.sh`로 보드 상태 확인
2. `gw-phase-workflow.sh --preview --json`으로 새 작업 생성 전 backpressure 확인
3. `gw-auto-workflow.sh` 또는 `gw-phase-workflow.sh`로 카드 생성
4. 구현/리뷰/테스트 뒤 `gw-pr-flow.sh`로 PR/CI 상태 확인
5. 배포 전 `gw-db-safe.sh`로 예정 명령 확인
6. 배포 후 `gw-deploy-smoke-check.sh`로 최소 생존 확인
7. 필요하면 `gw-worker-recovery-watch.sh --once`로 오래 멈춘 카드 점검

안전 메모:
- `gw-pr-flow.sh`의 merge/delete는 `--approved` 없이는 실행되지 않는다.
- `gw-db-safe.sh`의 apply 계열도 승인 조건이 맞지 않으면 실행되지 않는다.
- `gw-deploy-smoke-check.sh`는 읽기 요청만 한다.
- `gw-phase-workflow.sh`는 backpressure가 있으면 기본적으로 차단/보류 쪽으로 동작한다.
- `gw-worker-recovery-watch.sh` 반복 모드는 `--interval`/`--max-age`를 권장하며, 기존 위치 인자(`<간격초> <stale기준초>`)도 계속 지원한다.
- fixture/dry-run 재현 테스트에서 이전 실행 흔적을 섞고 싶지 않다면 `GW_WORKER_RECOVERY_STATE_FILE` 로 임시 state 파일 경로를 넘긴다.
