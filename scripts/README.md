# scripts

반복 작업을 자동화하는 스크립트를 두는 폴더다.

## 자주 쓰는 그룹웨어 스크립트

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
- `gw-worker-recovery-watch.sh`: timeout/crash/stale worker 감지와 복구 코멘트 보조 (`--help`, `--interval`, `--max-age` 지원)
- `gw-blocked-report-watch.sh`: **기본 비활성**. 과거 방식처럼 blocked/review-required 때 싱드 보고 카드를 자동 생성한다. 현재 기본 보고 경로는 `gw-telegram-kanban-report-watch.py`이므로, 이 스크립트는 대장 명시 승인과 `GW_ENABLE_REPORT_CARD_WATCH=1` 없이는 실행하지 않는다.
- `gw-telegram-kanban-report-watch.py`: Kanban DB를 read-only로 감시해 막힘/조치완료/최종보고 결과를 사용자 Telegram 채팅으로 직접 전송
- `gw-singde-second-pass-report-watch.py`: 1차 Telegram 카드보고 이후 같은 Kanban 이벤트를 read-only로 다시 확인해 싱드 2차 해석 보고를 전송

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
```

막힘/승인대기 자동 보고 감시:

```bash
# 첫 실행은 기존에 이미 막힌 카드는 중복 보고하지 않고 기준선만 잡는다.
./scripts/gw-blocked-report-watch.sh --once

# 이후 반복 실행하면 새 blocked/review-required 카드가 생길 때 싱드 보고 카드를 만든다.
./scripts/gw-blocked-report-watch.sh --interval 60
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
