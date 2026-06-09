# Cloudflare-first 스켈레톤 운영 안내

이 문서는 현재 스켈레톤을 로컬에서 점검하거나 다음 운영 단계로 넘기기 전에 확인할 항목을 정리한 문서입니다.

## 운영 관점에서 지금 상태

현재 저장소는 여전히 "실리소스 연결 전 단계"이지만, Phase 2 기준으로 인증/조직 1차 skeleton 이 추가되었습니다.

들어 있는 것:

- OpenNext on Cloudflare 기준 Web 설정
- Workers + Hono API 시작점
- placeholder 로그인/로그아웃/내 정보/조직 조회/관리자 초대 API
- 권한별 조직 조회 차단을 포함한 기본 RBAC read gate
- D1 migration 골격 (`0001`, `0002`)
- 로컬 검증 명령과 테스트

아직 하지 않은 것:

- Cloudflare 로그인
- 실제 배포
- 실제 D1/R2/KV/Queues/Durable Objects/Cron 생성
- 운영 DB 연결
- 비밀값 입력/교체
- 외부 공개 URL 연결
- 실제 OAuth/SSO/메일 초대 발송

## 먼저 확인할 파일

운영자가 가장 먼저 볼 파일은 아래입니다.

- `apps/web/wrangler.jsonc`
- `apps/web/open-next.config.ts`
- `apps/api/src/app.ts`
- `apps/api/wrangler.jsonc`
- `apps/api/.dev.vars.example`
- `apps/api/wrangler.bindings.example.jsonc`
- `db/migrations/0001_initial_schema.sql`
- `db/migrations/0002_auth_org_phase2.sql`

핵심 원칙은 간단합니다.
실제 비밀값과 실제 리소스 ID는 아직 저장소에 들어가면 안 됩니다.

## 로컬 점검 순서

루트 디렉터리에서 아래 순서로 확인하면 됩니다.

### 1) 기본 검사

```bash
pnpm install
pnpm check
pnpm build
pnpm typecheck
pnpm test
```

### 2) Web Cloudflare 빌드 검사

```bash
pnpm --filter @gw/web build:cf
```

### 3) API skeleton 검사

한 터미널에서:

```bash
pnpm --filter @gw/api dev
```

다른 터미널에서:

```bash
curl http://127.0.0.1:8787/api/health
curl -i http://127.0.0.1:8787/api/auth/login \
  -H 'content-type: application/json' \
  -H 'x-dev-role: COMPANY_ADMIN' \
  --data '{"email":"admin@example.com","password":"placeholder-password"}'
curl http://127.0.0.1:8787/api/me \
  -H 'cookie: gw_session=dev-placeholder-session_COMPANY_ADMIN'
curl http://127.0.0.1:8787/api/permissions \
  -H 'cookie: gw_session=dev-placeholder-session_HR_ADMIN'
curl -i http://127.0.0.1:8787/api/employees \
  -H 'cookie: gw_session=dev-placeholder-session_EMPLOYEE'
```

운영 주의:

- 위 cookie 값은 로컬 placeholder 계약 예시일 뿐이며 실운영 secret 이 아닙니다.
- 마지막 요청은 권한 부족 확인용 예시이며 403 이 나와야 정상입니다.
- 응답/로그에 실제 비밀번호, 실제 세션 토큰, 실제 초대 코드를 남기면 안 됩니다.

## placeholder 파일 사용 원칙

현재 예시 파일은 모두 placeholder 전용입니다.

### Web

`apps/web/.env.example`

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787
```

### API

`apps/api/.dev.vars.example`

- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_D1_DATABASE_NAME`

### Cloudflare 바인딩 예시

`apps/api/wrangler.bindings.example.jsonc`

이 파일에는 아래 항목의 예시 구조만 있습니다.

- D1 database
- KV namespace
- R2 bucket
- Queue producer
- Durable Object
- Cron trigger

값이 `replace-after-approval` 인 상태가 정상입니다.
실제 값으로 바꾸는 시점은 별도 승인 뒤입니다.

## 승인 없이 하면 안 되는 일

아래 작업은 이 단계에서 하면 안 됩니다.

- Cloudflare 계정 로그인 정보 입력
- 실제 `wrangler deploy` 실행
- 실제 DB 접속값 반영
- 실제 리소스 ID 입력
- 외부 도메인 연결
- 실데이터 반입
- 비용이 발생하는 리소스 생성
- 실제 OAuth/SSO/메일/SMS 초대 발송 연동

## release gate / 리뷰 메모

- 승인된 오케스트레이션 안에서는 GitHub PR 생성, CI 확인, merge, branch cleanup 까지 release gate 범위에 포함됩니다.
- `scripts/README.md` 에 있는 그룹웨어 보고/감시 자동화 스크립트를 수정했다면 기능 변경과 함께 검토해야 합니다.
- blocked/review-required/승인 필요 상태는 `gw-blocked-report-watch` 같은 자동보고 흐름을 막지 않도록 handoff 정보를 남겨야 합니다.

## 운영 handoff 체크리스트

다음 카드나 다음 담당자에게 넘기기 전에 아래를 확인합니다.

- `pnpm check` 통과
- `pnpm build` 통과
- `pnpm typecheck` 통과
- `pnpm test` 통과
- `pnpm --filter @gw/web build:cf` 통과
- `/api/health`, `/api/auth/login`, `/api/me` 기본 확인
- `COMPANY_ADMIN` 또는 `HR_ADMIN` 으로 조직 조회가 되는지 확인
- `EMPLOYEE` 로 직원/부서/역할/권한 조회 시 403 이 나오는지 확인
- placeholder 파일에 실제 비밀값이 없는지 확인
- 문서에 승인 필요 범위가 남아 있는지 확인

## 같이 보면 좋은 문서

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
- `docs/architecture/phase-2-auth-org-scope.md`
