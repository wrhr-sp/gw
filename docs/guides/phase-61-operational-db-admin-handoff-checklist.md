# Phase 61 운영 DB 운영자 인수인계 체크리스트

## 이 문서가 하는 일
이 문서는 운영 DB 준비 문서를 실제 운영자 handoff 순서로 다시 묶은 짧은 인수인계 문서입니다.

같이 보는 기준 문서:
- `docs/guides/phase-61-operational-db-provider-cost-approval-checklist.md`
- `docs/guides/phase-61-operational-db-secret-cloudflare-rollback-runbook.md`
- `db/postgres/README.md`
- `docs/architecture/operational-db-initial-setup.md`
- `docs/architecture/operational-db-target-architecture.md`
- `RUNBOOK.md`

핵심은 아래 5가지를 운영자가 바로 판단하게 만드는 것입니다.
1. provider 를 무엇으로 확정할지
2. secret 을 어떤 승인 경로로 받을지
3. preview / production DB URL 을 어떻게 나눌지
4. rollback / restore 를 어떤 순서로 적을지
5. 지금 할 일과 아직 승인 없이는 하지 않을 일을 어떻게 나눌지

## 한 줄 결론
지금 단계의 운영자 권장 시작안은 `Neon PostgreSQL 1개 + Cloudflare R2 + PostgreSQL Full Text Search` 이고, secret 은 git ignored `.secrets/` 또는 승인된 secret store 로만 다루며, production migration/실복원/유료 리소스 증설은 아직 승인 게이트로 남깁니다.

## 1. 운영자가 먼저 읽을 결론
- provider 기본안은 Neon 우선, Supabase 대체 후보입니다.
- 검색은 PostgreSQL FTS 로 먼저 시작합니다.
- Redis, Meilisearch 는 초기 고정비 절감을 위해 지금은 보류합니다.
- secret 원문은 채팅, 로그, 커밋, 문서에 남기지 않습니다.
- 운영 DB URL 해석 규칙은 앱 runtime 에서는 `DATABASE_URL` 우선, 없으면 `APP_ENV=preview` 일 때 `DATABASE_URL_PREVIEW`, 그 외에는 `DATABASE_URL_PRODUCTION` 순서로 유지합니다.
- migration/seed 스크립트는 runtime 규칙과 분리합니다. preview target 은 `DATABASE_URL_PREVIEW` 우선, 수동 preview/local 범위에서만 `--allow-preview-fallback` 으로 `DATABASE_URL` fallback 가능, production target 은 `DATABASE_URL_PRODUCTION` 필수 + `DATABASE_URL` fallback 금지입니다.
- `workers.dev`/preview 배포는 preview DB 기준, 승인된 custom domain/production 배포 후보는 production DB 기준 후보로 읽습니다.
- Hyperdrive 는 초기 필수값이 아니라 후속 검토 후보입니다.
- code rollback 과 DB rollback 은 다른 작업입니다.
- DB rollback 은 destructive down migration 기본값이 아니라 snapshot restore 또는 forward-fix 우선입니다.
- `DB 연결 성공` 과 `운영 준비 완료` 는 같은 완료 문장이 아닙니다.

## 2. 운영자 handoff 시작 순서
### 2-1. 먼저 확인할 파일
1. `docs/guides/phase-61-operational-db-provider-cost-approval-checklist.md`
2. `docs/guides/phase-61-operational-db-secret-cloudflare-rollback-runbook.md`
3. `RUNBOOK.md`
4. `HANDOFF.md`
5. `KNOWN_ISSUES.md`

### 2-2. 먼저 받아야 할 결정
운영자는 아래 질문에 먼저 답을 받아야 합니다.
- PostgreSQL provider 를 Neon 으로 확정할지
- connection string 을 `.secrets/` 로 받을지, 승인된 secret store 로 받을지
- preview / production DB URL 을 처음부터 분리할지
- 이번 범위를 연결 확인까지만 둘지, migration 승인까지 포함할지
- Cloudflare R2 운영 버킷 준비를 지금 승인 범위에 넣을지

### 2-3. 지금 바로 하면 되는 일
- 문서 기준 provider / secret / rollback / restore 규칙을 한 언어로 유지하기
- `.secrets/` 또는 승인된 secret store 만 허용 경로로 다시 확인하기
- `pnpm db:pg:check` 를 후속 연결 카드의 첫 검증 명령으로 유지하기
- preview smoke 와 production smoke 를 분리된 확인 묶음으로 적기
- restore 후 최소 smoke 목록을 운영자 체크리스트에 남기기

### 2-4. 아직 승인 없이는 하면 안 되는 일
- production DB 실데이터 migration 실행
- production backup/restore 실복원 실행
- 실제 connection string 을 채팅/문서/로그에 남기는 행위
- 유료 PostgreSQL 플랜 생성 또는 증설
- DNS/custom domain 연결
- 외부기관/외부 SaaS 연동
- 주민번호, 계좌번호, 급여 원문 같은 민감정보 저장 확대
- destructive down migration 실행

## 3. secret 전달 인수인계 규칙
### 허용
- git ignored `.secrets/` 파일
- 승인된 secret store

### 금지
- 채팅창에 secret 원문 붙여넣기
- 작업 로그나 캡처 이미지에 그대로 남기기
- `.env`, `.secrets` 파일을 커밋에 포함하기
- 문서에 실제 token / password / connection string 원문 기록하기

### 운영자 메모
- `.secrets/neon.env` 와 `.secrets/cloudflare.env` 는 역할을 분리해서 유지합니다.
- PostgreSQL URL 과 Cloudflare token 을 같은 파일에 섞지 않는 편이 안전합니다.
- 실제 값은 적지 않고, "어느 경로에 넣었는지"와 "입력했는지"만 확인합니다.

## 4. Workers / Cloudflare handoff 규칙
### 환경 해석 기준
운영자는 먼저 app runtime 과 migration/seed 스크립트 규칙을 구분해서 봐야 합니다.

앱 runtime 은 `apps/api/src/lib/postgres.ts` 기준 해석 순서를 그대로 따릅니다.
1. `DATABASE_URL`
2. `APP_ENV=preview` 이면 `DATABASE_URL_PREVIEW`
3. 그 외에는 `DATABASE_URL_PRODUCTION`

migration/seed 스크립트는 runtime 과 다릅니다.
1. preview target 은 `DATABASE_URL_PREVIEW` 우선
2. 수동 preview/local 범위에서만 `--allow-preview-fallback` 으로 `DATABASE_URL` fallback 가능
3. production target 은 `DATABASE_URL_PRODUCTION` 필수, `DATABASE_URL` fallback 금지

### 첫 연결 기본안
- Worker secret 주입 + 현재 Neon serverless driver 경로 유지
- `workers.dev` 또는 preview 배포는 `DATABASE_URL_PREVIEW` 기준으로 본다
- 승인된 custom domain 또는 production 배포 후보는 `DATABASE_URL_PRODUCTION` 기준 후보로 본다
- production migration/seed 는 host 이름과 무관하게 `DATABASE_URL_PRODUCTION` 없으면 실행하지 않는다
- Hyperdrive 는 초기 필수로 고정하지 않음
- preview 와 production 을 같은 DB 로 보지 않게 문서에서 먼저 분리

### Cloudflare 명령 원칙
명령은 아래 형태를 기본으로 둡니다.
- `set -a; . .secrets/cloudflare.env; set +a; <command>`

중요:
- token 전체를 echo 하지 않습니다.
- 로그 캡처에 secret 이 남지 않게 합니다.
- custom domain, DNS, 유료 리소스, production DB 실작업은 승인 전 진행하지 않습니다.

## 5. backup / restore / rollback handoff 규칙
### code rollback
- 배포 artifact 또는 이전 git 기준으로 web/api 코드를 되돌립니다.
- 되돌린 뒤에는 핵심 route smoke 를 다시 확인합니다.

### DB rollback
- schema 또는 데이터를 되돌리는 작업입니다.
- destructive down migration 자동 실행을 기본값으로 두지 않습니다.
- snapshot restore 또는 forward-fix 를 먼저 검토합니다.
- production 실복원은 별도 승인 후 진행합니다.

### restore 전 반드시 적을 것
- 어느 환경인지
- 어떤 snapshot 또는 backup 기준인지
- restore 후 어떤 smoke 를 다시 볼지
- code rollback 과 DB rollback 중 무엇을 하는지

### restore 후 최소 smoke
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

### restore 후 추가 확인
- schema version 또는 migration 상태
- 대표 sample read 또는 핵심 row count
- 권한 차단 유지 여부
- 감사 read 의 masked preview 유지 여부
- raw storage key, signed URL, bucket, secret 비노출 여부

## 6. 운영자용 빠른 질문 8개
1. 지금 필요한 것이 연결 확인인지, production 전환인지
2. Neon 으로 바로 확정 가능한지
3. preview / production URL 을 처음부터 분리할지
4. connection string 을 어느 승인 경로로 받을지
5. Cloudflare R2 운영 준비를 이번 승인 범위에 넣을지
6. Hyperdrive 를 지금 미도입으로 두어도 되는지
7. restore drill 을 preview 우선으로 고정할지
8. production migration / 실복원 / 유료 증설 / 외부연동을 이번 범위에서 뺄지

## 7. 운영자 인수인계 완료 기준
### 1단계: handoff 문서 준비 완료
여기까지는 완료라고 말할 수 있습니다.
- provider 권장안이 문서에 고정됨
- secret 허용/금지 경로가 분명함
- DB URL 해석 규칙이 코드와 문서에서 같음
- rollback / restore / smoke 목록이 문서에 있음
- 승인 게이트가 별도 항목으로 남아 있음

### 2단계: 연결 준비 확인 완료
추가로 아래가 있어야 합니다.
- secret 전달 경로 확정
- connection string 저장 확인
- `pnpm db:pg:check` 준비 또는 실행 계획 확인
- preview / production 분리 계획 확인
- Worker secret 주입 범위 확인

### 3단계: 운영 준비 완료
이 단계는 아직 자동 완료로 적지 않습니다.
추가로 아래가 확인돼야 합니다.
- 실제 연결 성공
- 권한/API guard 확인
- audit 기준 확인
- backup/restore 절차 확인
- rollback 절차 확인
- live smoke 확인

## 마지막 메모
이 문서는 실제 secret 값, 실제 token, 실제 connection string 을 담는 문서가 아닙니다.
또한 이 문서는 production migration 승인서를 대신하지도 않습니다.

목적은 다음 작업자와 운영자가
"무엇을 먼저 승인받아야 하는지"
"무엇을 아직 하지 말아야 하는지"
"어떤 순서로 restore/rollback/smoke 를 적어야 하는지"
를 헷갈리지 않게 만드는 것입니다.
