# Phase 61 운영 DB secret·Cloudflare/Workers 연결·rollback/runbook 준비

## 한 줄 요약
운영 DB 연결은 secret 보관, Workers 환경별 DB URL 선택, 코드 rollback 과 DB rollback 분리, 복구 후 smoke 확인을 한 세트로 준비해야 합니다.

이 문서는 아래 4가지를 운영자 기준으로 한 번에 보는 준비 문서입니다.
- secret 을 어디에 두는지
- Cloudflare/Workers 에서는 어떤 변수 이름으로 나눠 쓰는지
- rollback 은 무엇을 되돌리고 무엇은 바로 되돌리지 않는지
- 장애나 복구 후 무엇을 다시 확인하는지

## 1. 지금 기준 결론
- secret 원문은 채팅, 로그, 커밋, 문서에 남기지 않습니다.
- 로컬 보관은 git ignored `.secrets/` 아래만 사용합니다.
- 운영 DB URL 해석 규칙은 앱 runtime 에서는 `DATABASE_URL` 우선, 없으면 `APP_ENV=preview` 일 때 `DATABASE_URL_PREVIEW`, 그 외에는 `DATABASE_URL_PRODUCTION` 순서로 유지합니다.
- migration/seed 스크립트는 runtime 규칙과 분리합니다. preview target 은 `DATABASE_URL_PREVIEW` 우선이고, 수동 preview/local 범위에서만 `--allow-preview-fallback` 으로 `DATABASE_URL` fallback 을 허용합니다.
- production migration/seed target 은 `DATABASE_URL_PRODUCTION` 필수이며 `DATABASE_URL` fallback 은 금지합니다. 값이 없으면 바로 실패해야 합니다.
- Cloudflare 배포 해석은 `workers.dev`/preview 는 preview DB, 승인된 custom domain/production route 는 production DB 후보로 읽습니다. 공개 주소와 migration target 을 같은 말로 적지 않습니다.
- Cloudflare/Workers 첫 연결은 Worker secret 에 DB URL 을 주입하고 현재 Neon serverless driver 경로를 유지하는 쪽을 기본으로 봅니다.
- Hyperdrive/추가 connection pooling 은 지금 당장 필수값이 아니라, 실제 연결 한계나 provider 권고가 확인될 때 다음 단계 후보로 둡니다.
- rollback 은 코드 rollback 과 DB rollback 을 같은 뜻으로 쓰지 않습니다.
- DB rollback 은 destructive down migration 보다 snapshot restore 또는 forward-fix 우선으로 적습니다.

## 2. secret 보관 방식

### 2-1. 허용 경로
허용 경로는 아래 둘뿐입니다.
1. git ignored `.secrets/` 파일
2. 승인된 secret store

현재 저장소 기준으로 바로 연결되는 로컬 파일 예시는 아래입니다.
- `.secrets/neon.env`
- `.secrets/cloudflare.env`

`.gitignore` 에 `.secrets/`, `.env`, `.env.*` 가 이미 포함돼 있으므로 운영 secret 은 이 무시 경로 안에서만 다룹니다.

### 2-2. 금지 경로
아래는 모두 금지입니다.
- 채팅창에 connection string 원문 붙여넣기
- 터미널 출력에 password/token 노출
- 문서에 실제 secret 값 기록
- 커밋에 `.env`, `.secrets`, 실제 secret 원문 포함
- 스크린샷이나 복사 로그로 secret 전달

### 2-3. 권장 파일 역할 분리
쉬운 운영을 위해 파일 역할을 아래처럼 나눕니다.

#### `.secrets/neon.env`
운영 DB 연결 문자열 보관 파일입니다.

권장 변수 예시는 아래처럼 단순하게 유지합니다.
- `DATABASE_URL=postgresql://...`
- `DATABASE_URL_PREVIEW=postgresql://...`
- `DATABASE_URL_PRODUCTION=postgresql://...`

운영 메모:
- `DATABASE_URL` 은 로컬 수동 점검이나 단일 환경 강제 테스트용으로만 씁니다.
- preview/prod 를 실제로 나눌 때는 `DATABASE_URL_PREVIEW`, `DATABASE_URL_PRODUCTION` 을 별도로 관리합니다.
- 세 값을 모두 문서나 채팅에 적지 않고, 파일 경로와 입력 여부만 확인합니다.

#### `.secrets/cloudflare.env`
Cloudflare 인증용 파일입니다.

운영 메모:
- Cloudflare 관련 명령은 이 파일을 source 한 뒤 실행합니다.
- DB connection string 과 Cloudflare token 은 같은 파일에 섞어 두지 않는 편이 운영상 안전합니다.

## 3. Cloudflare/Workers 연결 전략

### 3-1. 코드 기준 환경 해석
현재 코드 기준 핵심은 `apps/api/src/lib/postgres.ts` 와 운영 스크립트(`scripts/apply-operational-postgres-migrations.mjs`, `scripts/seed-operational-db.mjs`, `scripts/gw-db-safe.sh`)를 구분해서 보는 것입니다.

앱 runtime 해석 순서는 아래와 같습니다.
1. `DATABASE_URL` 이 있으면 그것을 최우선 사용
2. 없고 `APP_ENV=preview` 면 `DATABASE_URL_PREVIEW` 사용
3. 그 외에는 `DATABASE_URL_PRODUCTION` 사용

migration/seed 스크립트 해석 순서는 아래와 같습니다.
1. preview target 은 `DATABASE_URL_PREVIEW` 우선
2. 수동 preview/local 범위에서만 `--allow-preview-fallback` 으로 `DATABASE_URL` fallback 허용
3. production target 은 `DATABASE_URL_PRODUCTION` 필수, `DATABASE_URL` fallback 금지, 값이 없으면 즉시 실패

즉, 운영 문서도 runtime 규칙과 DB 변경 스크립트 규칙을 같은 문장으로 섞지 않아야 합니다.

### 3-2. 왜 preview / production 을 나누나
preview 와 production 을 분리하면 아래 장점이 있습니다.
- preview smoke 가 production 데이터에 붙는 실수를 줄일 수 있음
- restore drill 을 preview 쪽에서 먼저 해보기 쉬움
- 문제 발생 시 어느 환경이 깨졌는지 판단이 쉬움
- rollout / rollback 판단을 환경별로 나눠 기록하기 쉬움

### 3-3. 첫 연결 권장안
지금 단계의 첫 연결 권장안은 아래입니다.
- local/manual check: `.secrets/neon.env` 의 `DATABASE_URL`
- `workers.dev` 또는 preview 배포: secret 으로 `DATABASE_URL_PREVIEW` 주입
- 승인된 custom domain 또는 production 배포 후보: secret 으로 `DATABASE_URL_PRODUCTION` 주입
- `APP_ENV` 는 preview / production 구분값으로 사용

중요:
- 실제 Worker secret 주입 자체는 별도 승인 범위에서 진행합니다.
- 지금 문서는 변수 이름과 연결 전략을 먼저 잠그는 단계입니다.

### 3-4. Hyperdrive 는 지금 어떻게 보나
현재 저장소와 코드 기준에서는 Neon serverless driver(`@neondatabase/serverless`) 기반 direct connection 경로를 유지합니다.

Hyperdrive 는 아래 조건에서 검토합니다.
- Workers 연결 수 제한/지연 문제가 실제로 확인됨
- provider 문서상 pooling 또는 proxy 사용이 강하게 권장됨
- preview/production 환경 분리 뒤에도 연결 안정성 병목이 남음

즉, 지금 단계의 결론은 Hyperdrive 미도입 확정이 아니라 초기 필수 구성으로 고정하지 않음입니다.

### 3-5. Cloudflare 명령 실행 원칙
Cloudflare 명령은 항상 아래 패턴을 먼저 붙입니다.
- `set -a; . .secrets/cloudflare.env; set +a; <command>`

예시:
- `set -a; . .secrets/cloudflare.env; set +a; bash scripts/gw-cloudflare-check.sh`
- `set -a; . .secrets/cloudflare.env; set +a; pnpm exec wrangler deployments list --json --name gw-web`

중요:
- secret 값 자체를 echo 하지 않습니다.
- 실행 로그에 token 전체가 보이게 하지 않습니다.
- custom domain, DNS, 유료 리소스, production DB 실작업은 별도 승인 전 진행하지 않습니다.

## 4. 실제 연결 준비 순서
1. provider 를 Neon 우선 / Supabase 대체 후보 기준으로 확정
2. connection string 을 승인된 경로로만 수령
3. `.secrets/neon.env` 또는 승인된 secret store 에 저장
4. `pnpm db:pg:check` 로 schema 정적 검증
5. 로컬에서 `DATABASE_URL` 기준 연결 확인
6. preview 용 `DATABASE_URL_PREVIEW` 와 production 용 `DATABASE_URL_PRODUCTION` 분리 여부 확정
7. `workers.dev`/preview 는 preview DB, custom domain/production 후보는 production DB 라는 연결 원칙을 운영 메모에 고정
8. production migration/seed 는 host 이름과 무관하게 `DATABASE_URL_PRODUCTION` 없으면 실행하지 않는다고 확인
9. Cloudflare Worker secret 주입 범위를 다시 승인 기준으로 확인
10. preview smoke 와 운영 smoke 기준을 분리 문서화

## 5. rollback 원칙

### 5-1. 코드 rollback 과 DB rollback 분리
같은 rollback 이라는 단어를 써도 실제로는 둘이 다릅니다.

#### 코드 rollback
이전 배포 artifact 또는 이전 git 기준으로 web/api 코드를 되돌리는 작업입니다.

Cloudflare 쪽 최소 확인 순서는 아래입니다.
1. `wrangler deployments list` 로 되돌릴 version id 확인
2. 해당 version 으로 rollback
3. 핵심 route smoke 재확인

#### DB rollback
데이터 구조나 데이터 상태를 되돌리는 작업입니다.

여기서는 아래 원칙을 우선합니다.
- destructive down migration 자동 실행을 기본값으로 두지 않음
- 가능하면 additive migration 유지
- 문제 발생 시 snapshot restore 또는 forward-fix 우선
- production 실복원은 별도 승인 후 실행

### 5-2. 왜 DB rollback 을 더 조심하나
코드 rollback 은 비교적 빠르게 되돌릴 수 있지만 DB rollback 은 아래 위험이 큽니다.
- 이미 쓴 데이터를 잃을 수 있음
- schema 만 되돌리고 코드가 안 맞을 수 있음
- preview 와 production 구분이 흐리면 잘못된 대상에 복원할 수 있음

그래서 DB rollback 은 명령 한 줄보다 아래를 먼저 적는 방식이 맞습니다.
- 어떤 snapshot 인지
- 어느 환경인지
- 복원 후 무엇을 확인할지

## 6. backup/restore 준비 기준

### 6-1. 지금 단계 기준
지금은 backup/restore 자동화 완료 단계가 아닙니다.
문서 기준은 계속 수동 runbook + 승인 게이트 입니다.

### 6-2. 최소 준비 항목
복구 준비가 됐다고 말하려면 아래가 필요합니다.
- backup 생성 주체가 무엇인지 적혀 있음
  - provider snapshot
  - 또는 승인된 수동 backup 절차
- restore 대상이 어디인지 적혀 있음
  - preview/staging 우선
  - production 은 별도 승인 후
- restore 후 확인할 smoke 목록이 적혀 있음
- code rollback 과 DB rollback 차이가 문서에 적혀 있음

### 6-3. restore 후 최소 smoke
복구 후에는 아래를 최소 묶음으로 다시 봅니다.
- `/api/health`
- `/login`
- `/dashboard`
- `/api/employees`
- `/api/attendance/records`
- `/api/leave/requests`
- `/api/approvals/documents`
- `/api/admin/audit-logs`
- `/api/notifications`
- boards/documents DB 전환 뒤에는 `/api/boards/*`, `/api/documents/*` 추가

### 6-4. restore 결과에서 같이 볼 것
- schema version 또는 migration 상태
- 핵심 row count 또는 대표 sample read
- 권한 차단이 그대로인지
- 감사 read 가 계속 masked preview 인지
- raw storage key, signed URL, bucket, secret 이 노출되지 않는지

## 7. 운영자용 빠른 체크리스트

### 7-1. secret 준비 전
- [ ] provider 확정이 끝났는가
- [ ] 실제 secret 전달 승인 근거가 있는가
- [ ] `.secrets/` 또는 승인된 secret store 외 경로를 쓰지 않는가

### 7-2. Workers 연결 전
- [ ] `DATABASE_URL`, `DATABASE_URL_PREVIEW`, `DATABASE_URL_PRODUCTION` 역할을 구분했는가
- [ ] preview 와 production 이 같은 DB 를 보지 않는가
- [ ] `APP_ENV` 와 env 해석 규칙을 문서와 코드에서 같은 뜻으로 적었는가
- [ ] Hyperdrive 를 지금 고정 필수처럼 과장하지 않았는가

### 7-3. rollback/runbook 준비 전
- [ ] 코드 rollback 과 DB rollback 을 분리해서 적었는가
- [ ] DB rollback 을 snapshot restore 또는 forward-fix 우선으로 적었는가
- [ ] restore 후 smoke 목록이 있는가
- [ ] production 실복원은 별도 승인 게이트로 남겼는가

## 8. 지금은 아직 하지 않는 것
- production DB 실데이터 migration 실행
- production backup/restore 실복원 실행
- actual secret 교체 작업을 승인 없이 진행
- DNS/custom domain 연결
- 유료 리소스 무승인 생성·증설
- 외부기관 연동
- 주민번호/계좌번호/실급여 원문 저장 확대
- destructive down migration 상시 자동화

## 9. 대장이 바로 결정할 질문
1. DB provider 를 Neon 으로 바로 확정할지
2. preview 와 production DB URL 을 처음부터 분리할지
3. secret 전달은 `.secrets/` 로 받을지, 승인된 secret store 로 받을지
4. Workers 첫 연결은 direct Neon serverless 경로로 시작하고 Hyperdrive 는 후속 판단으로 둘지
5. rollback 문서를 code rollback / DB rollback 분리 기준으로 잠글지
6. restore drill 은 preview 우선으로 적고 production 실복원은 계속 승인 게이트로 둘지

## 10. 같이 보면 좋은 파일
- `apps/api/src/lib/postgres.ts`
- `apps/api/wrangler.jsonc`
- `apps/api/wrangler.bindings.example.jsonc`
- `docs/guides/phase-61-operational-db-admin-handoff-checklist.md`
- `db/postgres/README.md`
- `docs/architecture/operational-db-initial-setup.md`
- `docs/architecture/operational-db-target-architecture.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`

## 마지막 메모
이 문서는 실제 secret 값을 담는 문서가 아닙니다.
또한 이 문서는 production migration 실행 승인 문서도 아닙니다.

목적은 아래 4가지를 먼저 잠그는 것입니다.
- secret 을 어디에 둘지
- Workers 에서는 어떤 변수 이름으로 나눌지
- rollback 은 무엇을 되돌리는지
- 복구 뒤 무엇을 다시 확인할지
