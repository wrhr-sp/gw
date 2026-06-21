# 그룹웨어 운영 DB 목표 구조

## 결론

최종 운영형 그룹웨어의 메인 운영 DB는 **PostgreSQL**을 기준으로 한다.

추천 조합:

- 메인 운영 DB: PostgreSQL
- 세션/캐시/실시간 보조: Redis
- 파일 저장: S3 호환 스토리지(Cloudflare R2, AWS S3, MinIO)
- 검색: 초기 PostgreSQL Full Text Search, 중기 이후 Meilisearch, 대규모/로그 분석은 OpenSearch 또는 ClickHouse 별도 검토

Cloudflare-first 배포 방향은 유지한다. Web/API는 Cloudflare Workers/OpenNext 경로를 유지하되, PostgreSQL 연결은 Hyperdrive/connection pooling/managed Postgres connection 전략을 별도로 둔다. Cloudflare D1은 최종 메인 운영 DB가 아니라 edge-local/보조 저장소 후보로 둔다.

## 왜 PostgreSQL인가

그룹웨어 핵심 데이터는 관계와 권한, 이력이다.

주요 데이터:

- 사용자, 직원, 부서, 직급
- 역할, 권한, 업무별 담당자
- 전자결재 문서, 결재선, 결재 액션
- 게시판, 공지, 댓글, 읽음 이력
- 문서함, 파일 metadata, 접근 권한
- 업무관리, 상태 변경, 담당자 이력
- 근태, 휴가, 급여정산, 세무/노무/법무 업무
- 알림, 감사 로그

이 구조는 단순 key-value나 문서 DB보다 관계형 DB가 적합하다. 특히 `누가 무엇을 볼 수 있는지`, `언제 어떤 상태가 바뀌었는지`, `과거 조직/권한 기준으로 문서를 어떻게 해석할지`가 중요하므로 PostgreSQL을 기준으로 잡는다.

## DB를 하나로 둘지 기능별로 나눌지

초기~중기 운영 기준은 **하나의 메인 PostgreSQL DB**를 권장한다.

권장 방식:

- DB는 1개
- 기능별 schema/table/permission/audit boundary로 분리
- 애플리케이션 레벨에서 module과 permission을 명확히 분리
- 파일, 캐시, 검색은 별도 시스템으로 분리

비추천:

- 게시판 DB, 결재 DB, 인사 DB, 급여 DB를 처음부터 모두 물리적으로 분리

이유:

- 권한/조직/직원/알림/감사 로그가 모든 기능에 걸쳐 공통으로 필요하다.
- 기능별 DB 분리는 초기 개발/운영 복잡도를 크게 올린다.
- 트랜잭션과 이력 정합성 관리가 어려워진다.

단, 대규모 이후에는 다음처럼 분리할 수 있다.

- 검색 인덱스: Meilisearch/OpenSearch
- 대용량 감사/행위 로그: ClickHouse 또는 별도 로그 저장소
- 파일: R2/S3/MinIO
- 캐시/세션/실시간: Redis
- 읽기 전용 리포트/BI: replica 또는 warehouse

## 초기 구성

비용 절감과 Cloudflare-first를 고려한 초기 권장:

- PostgreSQL: Neon 또는 Supabase 또는 저비용 managed PostgreSQL
- Redis: Upstash Redis 또는 managed Redis 소형 플랜
- 파일: Cloudflare R2 우선 사용
- 검색: PostgreSQL Full Text Search부터 시작
- 감사 로그: PostgreSQL 테이블 + 보존/파티셔닝 설계

초기에는 Meilisearch/OpenSearch를 바로 붙이지 않고, PostgreSQL FTS로 문서/게시글/결재 제목·본문 검색을 처리한다. 검색량과 문서량이 늘면 Meilisearch를 추가한다.

## 중기 구성

- PostgreSQL managed DB 유지
- Redis를 세션/알림 카운트/중복 클릭 방지/작업 락에 사용
- R2/S3에 첨부 원본 저장, DB에는 metadata만 저장
- Meilisearch 도입
- 감사 로그 파티셔닝/보존 정책 적용
- read replica 또는 백업/복구 자동화 강화

## 대규모/완성형 구성

- AWS RDS PostgreSQL 또는 동급 managed PostgreSQL
- ElastiCache Redis 또는 동급 managed Redis
- S3 또는 R2
- Meilisearch 또는 OpenSearch
- 감사/행위 로그가 매우 커지면 ClickHouse 별도
- 백업/복구/복제/모니터링/권한관리/감사 정책 정식 운영

## 핵심 schema 영역

### 권한

처음부터 단순 `is_admin` 하나로 설계하지 않는다.

필수 구조:

- users
- roles
- permissions
- user_roles
- role_permissions
- management_assignments 또는 admin_scopes

권한은 company + branch/hotel + role + 업무별 permission 조합으로 판단한다.

### 조직 변경 이력

현재 부서만 저장하지 않는다.

필수 구조:

- departments
- positions
- user_department_history
- user_position_history

과거 결재/근태/급여/법무 문서는 당시 조직 기준으로 해석되어야 한다.

### 전자결재

필수 구조:

- approval_documents
- approval_lines
- approval_actions
- approval_attachments

결재 상태 예:

- draft
- submitted
- in_review
- approved
- rejected
- cancelled

결재 액션은 누적 저장한다.

### 게시판/공지/댓글

필수 구조:

- boards
- posts
- comments
- post_read_receipts
- board_permissions

실사용 기준은 목록 보기뿐 아니라 글쓰기, 댓글, 읽음 확인, 권한 차단까지 포함한다.

### 파일/문서

파일 원본은 DB에 직접 넣지 않는다.

- document_spaces
- documents
- document_permissions
- file_objects
- file_access_logs

DB에는 bucket/key/size/content_type/checksum/owner/권한 metadata만 저장한다.

### 감사 로그

필수 구조:

- audit_logs

남길 항목:

- actor user id
- action
- resource type/id
- before/after snapshot 또는 diff
- ip
- user-agent
- company/branch scope
- created_at

권한 변경, 문서 다운로드, 인사/급여/법무/노무/세무 조회는 감사 로그 우선 대상이다.

## 로그인/세션

- `/login` 및 필요한 최소 공개 정적/health 경로 외 주요 앱 페이지는 로그인 후 접근한다.
- dev/test/UAT 계정 `admin / 1234`는 가능하지만 운영 기본계정으로 방치하지 않는다.
- 운영 전에는 초기 비밀번호 변경 또는 안전한 seed 절차가 필요하다.
- 세션은 초기에는 secure cookie + DB/Redis 저장 중 하나로 시작하고, 운영 안정화 단계에서 Redis 기반 세션/캐시를 붙인다.

## 외부연동은 나중에 한 번에 진행

내부 기능 개발 완료 후 별도 승인 게이트로 진행한다.

외부연동 후보:

- 홈택스
- 4대보험
- 은행 이체
- 회계 프로그램
- 노무사/세무사/변호사 외부 계정
- 법령 API 자동 최신화
- DNS/custom domain
- 유료 리소스 확장

## 현재 적용 판단

현재 repo에는 아직 `schema.prisma`가 없고, 활성 API 설정에는 R2 binding만 존재한다. D1 예시는 `apps/api/wrangler.bindings.example.jsonc`에만 있다. 따라서 운영 DB 전환은 다음 순서로 진행한다.

1. PostgreSQL 운영 목표 schema 설계
2. Prisma 또는 SQL migration 전략 확정
3. managed PostgreSQL 선택 및 secret 전달 경로 확정
4. 로컬/스테이징 connection 검증
5. 운영 DB migration/seed 적용
6. API repository를 운영 DB 기반으로 전환
7. 로그인/권한/게시판/결재/근태/휴가/경영업무를 DB 저장 흐름으로 전환
8. Redis/R2/검색을 단계적으로 연결

실제 connection string, DB password, provider token은 절대 문서/채팅/커밋에 남기지 않는다.
## 대장 확정 단계 전략

대장은 DB를 아래 단계로 진행하기로 확정했다.

1. 초기/비용절감
   - Neon 또는 Supabase PostgreSQL
   - Cloudflare R2
   - PostgreSQL Full Text Search
   - Redis는 초기 보류 가능, 필요 시 Upstash Redis 추가

2. 중기
   - managed PostgreSQL
   - Redis
   - R2/S3
   - Meilisearch

3. 대규모
   - AWS RDS PostgreSQL
   - ElastiCache Redis
   - S3
   - Meilisearch 또는 OpenSearch
   - 대용량 감사/행위 로그는 ClickHouse 후보

기능별 물리 DB 분리는 초기에 하지 않는다. 하나의 메인 PostgreSQL DB에 기능별 table/schema/permission/audit boundary를 둔다.

## 초기 운영 DB 세팅 적용

대장 확정에 따라 초기 단계는 아래처럼 적용한다.

- Neon PostgreSQL 1개를 메인 DB로 시작한다.
- Cloudflare R2 `gw-files`는 파일 원본 저장소로 사용한다.
- 검색은 PostgreSQL Full Text Search로 시작한다.
- Redis, Meilisearch, ClickHouse는 초기 고정비를 줄이기 위해 지금은 붙이지 않는다.
- 기능별 물리 DB 분리는 하지 않는다.

저장소 적용 파일:

- `.secrets/neon.env` — local/manual 확인용 `DATABASE_URL`, preview 전용 `DATABASE_URL_PREVIEW`, production 전용 `DATABASE_URL_PRODUCTION` 을 분리해 넣는 비밀 파일
- `db/postgres/migrations/0001_initial_operational_schema.sql` — 초기 PostgreSQL schema
- `db/postgres/README.md` — 적용 순서
- `scripts/validate-operational-postgres-schema.mjs` — 정적 검증
- `docs/architecture/operational-db-initial-setup.md` — 대장용 초기 세팅 가이드

실제 DB migration 적용은 대장이 `.secrets/neon.env`에 preview/prod 전용 URL 을 분리해서 넣은 뒤 진행한다. local/manual 확인은 `DATABASE_URL`, preview target 은 `DATABASE_URL_PREVIEW`, production target 은 `DATABASE_URL_PRODUCTION` 을 쓴다. production target 에서는 `DATABASE_URL` fallback 을 허용하지 않는다. connection string은 채팅/문서/커밋에 남기지 않는다.

