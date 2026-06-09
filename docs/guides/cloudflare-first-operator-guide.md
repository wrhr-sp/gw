# Cloudflare-first 스켈레톤 운영 안내

이 문서는 현재 스켈레톤을 로컬에서 점검하거나 다음 운영 단계로 넘기기 전에 확인할 항목을 정리한 문서입니다.

## 운영 관점에서 지금 상태

현재 저장소는 "실리소스 연결 전 단계"입니다.

들어 있는 것:

- OpenNext on Cloudflare 기준 Web 설정
- Workers + Hono API 시작점
- placeholder 환경변수 예시
- Cloudflare 바인딩 예시 파일
- D1 SQL migration
- 로컬 검증 명령

아직 하지 않은 것:

- Cloudflare 로그인
- 실제 배포
- 실제 D1/R2/KV/Queues/Durable Objects/Cron 생성
- 운영 DB 연결
- 비밀값 입력
- 외부 공개 URL 연결

## 먼저 확인할 파일

운영자가 가장 먼저 볼 파일은 아래입니다.

- `apps/web/wrangler.jsonc`
- `apps/web/open-next.config.ts`
- `apps/web/.env.example`
- `apps/api/wrangler.jsonc`
- `apps/api/.dev.vars.example`
- `apps/api/wrangler.bindings.example.jsonc`
- `db/migrations/0001_initial_schema.sql`

핵심 원칙은 간단합니다.
실제 비밀값과 실제 리소스 ID는 아직 저장소에 들어가면 안 됩니다.

## 로컬 점검 순서

루트 디렉터리에서 아래 순서로 확인하면 됩니다.

### 1) 기본 검사

```bash
pnpm install
pnpm check
```

`pnpm check`는 test와 typecheck를 함께 돌립니다.

### 2) Web Cloudflare 빌드 검사

```bash
pnpm --filter @gw/web build:cf
```

이 명령은 OpenNext on Cloudflare 기준 빌드가 되는지 확인합니다.

### 3) API 헬스 체크 검사

한 터미널에서:

```bash
pnpm --filter @gw/api dev
```

다른 터미널에서:

```bash
curl http://127.0.0.1:8787/api/health
```

응답은 아래 계약과 같아야 합니다.

```json
{
  "ok": true,
  "data": {
    "service": "gw-api",
    "status": "ok",
    "version": "0.1.0"
  },
  "error": null
}
```

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

## 운영 handoff 체크리스트

다음 카드나 다음 담당자에게 넘기기 전에 아래를 확인합니다.

- `pnpm check` 통과
- `pnpm --filter @gw/web build:cf` 통과
- `/api/health` 응답 확인
- placeholder 파일에 실제 비밀값이 없는지 확인
- 문서에 승인 필요 범위가 남아 있는지 확인

## 문제를 봤을 때 먼저 의심할 것

- Web이 빌드되지 않으면 `apps/web/open-next.config.ts`와 `apps/web/wrangler.jsonc`를 먼저 확인합니다.
- API가 뜨지 않으면 `apps/api/wrangler.jsonc`와 `apps/api/src/app.ts`를 먼저 봅니다.
- health 응답이 다르면 `packages/shared/src/contracts.ts`와 `apps/api/test/health.spec.ts`를 같이 봅니다.
- DB 관련 작업이 필요해 보여도, 현재 단계는 실제 DB 연결 전이라는 점을 먼저 확인합니다.

## 같이 보면 좋은 문서

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
- `docs/architecture/cloudflare-first-phase-scope.md`
