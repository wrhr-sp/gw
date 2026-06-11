# ARCHITECTURE

## 시스템 구조

```text
사용자 브라우저 / PWA
  ↓
Next.js App Router Web (`apps/web`)
  ↓ same-origin `/api/*`
Cloudflare Workers + Hono API (`apps/api`)
  ↓
Shared contract (`packages/shared`)
  ↓
Cloudflare D1 / R2 / KV / Durable Objects / Queues / Cron 후보
```

## 주요 모듈

- `apps/web`: Next.js App Router, PWA shell, OpenNext on Cloudflare 배포 대상
- `apps/api`: Cloudflare Workers + Hono REST API skeleton
- `packages/shared`: route, schema, type, 권한 코드의 단일 계약
- `db/migrations`: Cloudflare D1 SQL migration skeleton
- `docs`: Phase 범위, 운영 가이드, 워크플로우 문서
- `scripts`: Kanban/GitHub/Cloudflare/자동화 보조 스크립트

## 데이터 흐름

1. 사용자는 Web route에 접근한다.
2. Web은 same-origin `/api/*` 경로를 호출한다.
3. API는 placeholder 세션/권한/회사 scope를 확인한다.
4. 응답은 shared schema 기준으로 검증 가능한 형태를 유지한다.
5. 파일/첨부는 metadata와 R2 binding 방향을 분리한다.

## 운영 흐름

- 개발은 Kanban 체인으로 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub PR/CI/merge/branch cleanup → 최종보고 순서로 진행한다.
- main push 후 `release-gate` GitHub Actions가 Cloudflare Workers 배포를 수행한다.

## 상세 문서

- Cloudflare 플랫폼 계획: `docs/architecture/next-cloudflare-platform-plan.md`
- 자동화 구조: `docs/workflow/groupware-kanban-automation.md`
