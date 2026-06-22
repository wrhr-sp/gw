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
  - 실제 `DATABASE_URL` 입력 파일. git에 커밋하지 않는다.

## 대장이 채울 값

`.secrets/neon.env`에서 아래만 채우면 된다.

```env
DATABASE_URL=postgresql://...
```

채팅에는 connection string을 붙이지 않는다.

## 적용 순서

1. Neon 또는 Supabase에서 PostgreSQL 프로젝트 생성
2. `.secrets/neon.env`의 `DATABASE_URL`에 연결 문자열 저장
3. `pnpm db:pg:check`로 스키마 파일 정적 검증
4. 연결 검증 후 migration 적용
5. API repository를 운영 DB 저장 흐름으로 전환
6. Redis/Meilisearch는 중기 이후 필요할 때 추가

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
