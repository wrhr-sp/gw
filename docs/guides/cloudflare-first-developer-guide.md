# Cloudflare-first 스켈레톤 개발 안내

이 문서는 다음 구현자가 바로 이어서 작업할 수 있게 현재 코드 구조와 개발 기준을 정리한 문서입니다.

## 현재 저장소 구조

```text
apps/
  web/        # Next.js App Router + OpenNext on Cloudflare + PWA 시작점
  api/        # Cloudflare Workers + Hono API 시작점
packages/
  shared/     # 공통 경로, 화면 섹션, health 계약
db/
  migrations/ # D1 SQL migration skeleton
docs/
  architecture/
  guides/
```

현재 기준으로 실제 코드가 들어 있는 핵심 경로는 `apps/web`, `apps/api`, `packages/shared`, `db/migrations` 입니다.

## 패키지와 역할

### `apps/web`

Web 앱입니다.

현재 들어 있는 것:

- Next.js App Router 구조
- 홈 화면과 섹션별 경로 페이지
- OpenNext on Cloudflare 빌드 설정
- Wrangler 프리뷰 설정
- PWA manifest

주요 파일:

- `apps/web/package.json`
- `apps/web/app/page.tsx`
- `apps/web/app/section-page.tsx`
- `apps/web/open-next.config.ts`
- `apps/web/wrangler.jsonc`
- `apps/web/.env.example`

주요 스크립트:

```bash
pnpm --filter @gw/web dev
pnpm --filter @gw/web build
pnpm --filter @gw/web build:cf
pnpm --filter @gw/web preview:cf
```

### `apps/api`

Workers API입니다.

현재 들어 있는 것:

- Hono 앱 시작점
- `/api/health` 라우트
- Wrangler 로컬 개발 설정
- Vitest health 계약 테스트
- placeholder 환경변수 예시

주요 파일:

- `apps/api/package.json`
- `apps/api/src/app.ts`
- `apps/api/src/index.ts`
- `apps/api/test/health.spec.ts`
- `apps/api/wrangler.jsonc`
- `apps/api/.dev.vars.example`
- `apps/api/wrangler.bindings.example.jsonc`

주요 스크립트:

```bash
pnpm --filter @gw/api dev
pnpm --filter @gw/api test
pnpm --filter @gw/api typecheck
```

### `packages/shared`

Web과 API가 같이 보는 공통 계약 패키지입니다.

현재 들어 있는 것:

- `appRoutes.health` 경로 상수
- Web 홈에서 쓰는 `appSections`
- API health 응답 Zod schema
- 계약 테스트

주요 파일:

- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- `packages/shared/test/contracts.spec.ts`

핵심 계약은 아래입니다.

```ts
appRoutes.health === "/api/health"
```

health 응답은 아래 모양으로 고정되어 있습니다.

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

### `db/migrations`

D1 SQL migration skeleton 입니다.

현재 `0001_initial_schema.sql` 에는 아래 골격이 들어 있습니다.

- `companies`
- `users`
- `employees`

근태, 휴가, 결재, 파일, 감사로그 테이블은 후속 phase에서 확장합니다.

## 개발자가 바로 쓰는 명령

루트에서:

```bash
pnpm install
pnpm check
```

개별 확인:

```bash
pnpm --filter @gw/shared test
pnpm --filter @gw/api test
pnpm typecheck
pnpm --filter @gw/web build:cf
pnpm --filter @gw/api dev
curl http://127.0.0.1:8787/api/health
```

## 현재 연결 관계

간단히 보면 아래 흐름입니다.

```text
apps/web
  └─ packages/shared 의 경로/섹션 계약 사용

apps/api
  └─ packages/shared 의 health schema와 route 상수 사용

apps/api
  └─ 향후 Cloudflare D1로 db/migrations 기반 스키마와 연결 예정
```

## 구현할 때 지켜야 할 기준

- Web과 API가 같이 보는 계약은 먼저 `packages/shared` 에서 정리합니다.
- 새로운 API를 만들면 route 상수와 응답 schema를 같이 관리합니다.
- 실제 비밀값은 코드, 문서, 로그에 넣지 않습니다.
- Cloudflare 실리소스 연결은 승인 전까지 예시 파일에만 남깁니다.
- 현재 단계에서는 로컬 검증이 깨지지 않는 것이 더 중요합니다.

## 다음 구현 순서 추천

1. 인증/세션 계약 추가
2. 회사/직원/조직 API와 shared schema 확장
3. Web 각 섹션을 mock 데이터에서 실제 API 호출 구조로 전환
4. 근태/휴가/전자결재 도메인 계약 추가
5. R2/KV/Queues/Durable Objects 같은 바인딩을 승인 후 연결

## 자주 보는 파일 묶음

새 기능을 추가할 때는 보통 아래 파일을 같이 봅니다.

### 새 API를 추가할 때

- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/*.spec.ts`
- `apps/web/app/**/page.tsx`

### DB 스키마를 확장할 때

- `db/migrations/0001_initial_schema.sql`
- `apps/api/.dev.vars.example`
- `apps/api/wrangler.bindings.example.jsonc`

### Cloudflare 호환성을 볼 때

- `apps/web/open-next.config.ts`
- `apps/web/wrangler.jsonc`
- `apps/api/wrangler.jsonc`

## 같이 보면 좋은 문서

- `README.md`
- `docs/guides/cloudflare-first-user-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
