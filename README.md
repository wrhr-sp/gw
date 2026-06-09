# gw

그룹웨어 개발/운영 자동화 저장소입니다.

이 저장소는 Cloudflare-first 기반 그룹웨어 monorepo skeleton을 포함합니다.
지금 단계에서는 실서비스 배포가 아니라, 다음 구현자가 바로 이어서 작업할 수 있는 Web/API/공통계약/DB 골격을 맞추는 데 집중합니다.

## 지금 들어 있는 것

- `apps/web`: Next.js App Router + PWA + OpenNext on Cloudflare 시작점
- `apps/api`: Cloudflare Workers + Hono health API 시작점
- `packages/shared`: 공통 타입 / route / schema 계약
- `db/migrations`: Cloudflare D1 migration skeleton

## Workspace 구조

```text
apps/
  web/        # Next.js App Router + PWA skeleton
  api/        # Cloudflare Workers + Hono health API skeleton
packages/
  shared/     # 공통 타입 / route / schema 계약
db/
  migrations/ # Cloudflare D1 migration skeleton
docs/
  architecture/
  guides/
```

## 빠른 로컬 시작

```bash
pnpm install
pnpm check
pnpm --filter @gw/web build:cf
pnpm --filter @gw/api dev
```

API 개발 서버를 띄운 뒤에는 다른 터미널에서 health endpoint를 확인할 수 있습니다.

```bash
curl http://127.0.0.1:8787/api/health
```

예상 응답:

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

## Web 확인 방법

화면 골격만 빠르게 보려면:

```bash
pnpm --filter @gw/web dev
```

Cloudflare 호환 프리뷰까지 같이 보려면:

```bash
pnpm --filter @gw/web preview:cf
```

Web 앱은 `apps/web/open-next.config.ts` + `apps/web/wrangler.jsonc`를 통해 OpenNext on Cloudflare 기준으로 빌드/프리뷰합니다.

## Placeholder 환경변수

- `apps/web/.env.example`
- `apps/api/.dev.vars.example`
- `apps/api/wrangler.bindings.example.jsonc`

실제 비밀값, 실제 Cloudflare 리소스 ID, 실제 운영 DB 접속값은 저장소에 넣지 않습니다.
현재 예시 파일에는 placeholder 값만 남겨 둡니다.

## 문서 바로가기

- 사용자 안내: `docs/guides/cloudflare-first-user-guide.md`
- 운영 안내: `docs/guides/cloudflare-first-operator-guide.md`
- 개발 안내: `docs/guides/cloudflare-first-developer-guide.md`
- Phase 범위: `docs/architecture/cloudflare-first-phase-scope.md`
- 플랫폼 계획: `docs/architecture/next-cloudflare-platform-plan.md`

## 승인 없이 하지 않는 일

- Cloudflare 계정 로그인/토큰 입력
- 실제 배포
- 실제 D1/R2/KV/Queues/Durable Objects/Cron 생성
- 운영 DB 연결
- 실데이터 입력
- 승인된 오케스트레이션 범위 밖의 GitHub merge/delete
