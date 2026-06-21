# 초기 운영 DB 세팅 가이드

## 결론

현재 단계는 비용절감을 위해 **Neon PostgreSQL 1개 + Cloudflare R2 + PostgreSQL Full Text Search**로 시작한다.

초기에는 Redis, Meilisearch, ClickHouse를 붙이지 않는다. 필요해지는 시점에 중기 단계로 추가한다.

## 초기 구성

- 메인 운영 DB: Neon PostgreSQL 1개
- 파일 저장: Cloudflare R2 `gw-files`
- 검색: PostgreSQL Full Text Search
- 세션: 초기에는 secure cookie 또는 PostgreSQL session table
- Redis: 보류
- Meilisearch: 보류

## 지금 저장소에 적용한 것

- `.secrets/neon.env`
  - 대장이 local/manual 확인용 `DATABASE_URL`, preview 전용 `DATABASE_URL_PREVIEW`, production 전용 `DATABASE_URL_PRODUCTION` 을 나눠 넣을 수 있는 비밀 파일
- `db/postgres/migrations/0001_initial_operational_schema.sql`
  - 초기 운영 PostgreSQL schema SQL
- `db/postgres/README.md`
  - 적용 순서와 비용절감 원칙
- `scripts/validate-operational-postgres-schema.mjs`
  - 운영 schema 정적 검증 스크립트
- `package.json`
  - `pnpm db:pg:check` 추가

## 기능별 DB 최소화 원칙

초기에는 아래 기능을 모두 PostgreSQL DB 1개 안에서 table boundary로 관리한다.

- 계정/로그인/세션
- 회사/지점/부서/직급/직원
- 역할/권한/업무별 관리자
- 홈 바로가기
- 게시판/공지/댓글/읽음
- 문서함 metadata
- 파일 metadata
- 근태/정정요청
- 휴가/잔여휴가
- 전자결재
- 경영업무 work item
- 급여정산 초안/검토 metadata
- 컴플라이언스 경고
- 알림
- 감사 로그

파일 원본은 DB가 아니라 R2에 둔다.

## 대장이 해줄 것

Neon에서 PostgreSQL 프로젝트를 만든 뒤, 연결 문자열을 채팅에 붙이지 말고 아래 파일에 넣는다.

```bash
nano /home/wrhrgw/gw/.secrets/neon.env
```

채울 값 예시:

```env
DATABASE_URL=postgresql://...              # 로컬 수동 점검 / 단일 환경 강제 확인용
DATABASE_URL_PREVIEW=postgresql://...      # preview migration/seed, preview worker 용
DATABASE_URL_PRODUCTION=postgresql://...   # production migration/seed, production worker 용
```

저장 후 저에게 `저장했어`라고만 말하면 된다.

추가 메모:
- 이 파일의 `DATABASE_URL` 은 로컬 수동 점검이나 단일 환경 강제 확인용으로 먼저 쓴다.
- preview migration/seed 나 preview worker 연결부터는 `DATABASE_URL_PREVIEW` 를 같이 채운다.
- production migration/seed 나 production worker 연결은 `DATABASE_URL_PRODUCTION` 이 필수다. `DATABASE_URL` fallback 은 허용하지 않는다.
- preview / production 분리, Cloudflare Worker secret 주입, rollback/runbook 기준은 `docs/guides/phase-61-operational-db-secret-cloudflare-rollback-runbook.md` 를 함께 본다.

## 아직 적용하지 않은 것

- 실제 Neon DB 생성
- 실제 DB migration 적용
- production 실데이터 입력
- API repository의 DB 저장 흐름 전환
- Redis/Meilisearch 연결
- 외부연동

위 항목은 local/manual `DATABASE_URL` 과 환경별 `DATABASE_URL_PREVIEW` / `DATABASE_URL_PRODUCTION` 준비 후 단계별로 검증하면서 진행한다.
