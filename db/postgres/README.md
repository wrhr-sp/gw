# PostgreSQL 운영 DB 초기 세팅

## 목표

초기/비용절감 단계에서는 **PostgreSQL DB 1개**를 메인 운영 DB로 사용한다.

초기 조합:

- 메인 DB: Neon PostgreSQL 우선
- 파일 원본: Cloudflare R2 `gw-files`
- 검색: PostgreSQL Full Text Search
- Redis: 초기 보류, 필요 시 Upstash Redis 추가
- Meilisearch: 중기 이후 추가

## 파일 구조

- `db/postgres/migrations/0001_initial_operational_schema.sql`
  - 초기 운영 테이블 생성 SQL
- `scripts/validate-operational-postgres-schema.mjs`
  - 필수 테이블/인덱스가 migration에 포함됐는지 정적 검증
- `.secrets/neon.env`
  - 운영 DB 연결 문자열 입력 파일. git에 커밋하지 않는다.
  - 로컬 수동 점검용 `DATABASE_URL`, preview 전용 `DATABASE_URL_PREVIEW`, production 전용 `DATABASE_URL_PRODUCTION` 을 같은 파일에 둘 수 있다.
  - preview / production 분리 전략과 rollback/runbook 기준은 `docs/guides/phase-61-operational-db-secret-cloudflare-rollback-runbook.md` 를 함께 본다.

## 대장이 채울 값

`.secrets/neon.env`에는 아래 3가지 역할만 구분해서 넣으면 된다.

```env
DATABASE_URL=postgresql://...              # 로컬 수동 점검 / 단일 환경 강제 확인용
DATABASE_URL_PREVIEW=postgresql://...      # preview migration/seed, preview worker 용
DATABASE_URL_PRODUCTION=postgresql://...   # production migration/seed, production worker 용
```

최소 운영 규칙:
- local/manual check 만 할 때는 `DATABASE_URL` 하나로 시작할 수 있다.
- `workers.dev` 또는 preview 배포, preview migration/seed 연결부터는 `DATABASE_URL_PREVIEW` 를 같이 채운다.
- 승인된 custom domain 또는 production 배포 후보, production target 작업은 항상 `DATABASE_URL_PRODUCTION` 이 필요하다. `DATABASE_URL` fallback 은 허용하지 않는다.
- production migration/seed 는 공개 주소와 무관하게 `DATABASE_URL_PRODUCTION` 없으면 진행하지 않는다.

채팅에는 connection string을 붙이지 않는다.

## 적용 순서

1. Neon 또는 Supabase에서 PostgreSQL 프로젝트 생성
2. `.secrets/neon.env`에 local/manual check 용 `DATABASE_URL` 저장
3. `pnpm db:pg:check`로 스키마 파일 정적 검증
4. preview 연결 준비를 볼 때는 `DATABASE_URL_PREVIEW` 를 채운 뒤 `./scripts/gw-preview-db-readiness.sh` 또는 `./scripts/gw-db-safe.sh --env staging --mode status` 로 확인
5. local/manual 범위에서만 필요하면 `./scripts/gw-db-safe.sh --env staging --mode status --allow-preview-fallback --json` 으로 `DATABASE_URL` fallback 미리보기를 확인
6. 승인된 범위에서 `./scripts/gw-db-safe.sh --env staging --mode migrate-apply --approved` 로 migration 적용
7. 승인된 범위에서 `./scripts/gw-db-safe.sh --env staging --mode seed-apply --approved --allow-seed` 로 preview seed 적용
8. API repository를 운영 DB 저장 흐름으로 전환
9. Redis/Meilisearch는 중기 이후 필요할 때 추가

## 비용절감 원칙

- 기능별 DB를 여러 개 만들지 않는다.
- 사용자/조직/권한/게시판/결재/근태/휴가/경영업무/감사 로그는 한 PostgreSQL DB 안에 table boundary로 둔다.
- 파일 원본은 DB에 넣지 않고 R2에 저장한다.
- 검색은 PostgreSQL FTS로 시작한다.
- Redis와 Meilisearch는 초기 고정비를 줄이기 위해 지금은 붙이지 않는다.

## 아직 하지 않은 것

- 실제 Neon 프로젝트 생성
- 실제 DB migration 적용
- production 실데이터 입력
- 주민번호/계좌번호 같은 민감정보 원문 저장
- 외부연동
- DNS/custom domain
- 유료 리소스 증설
