# gw

그룹웨어 개발/운영 자동화 저장소입니다.

이 저장소는 Cloudflare-first 기반 그룹웨어 monorepo skeleton을 포함합니다.
지금 단계에서는 실서비스 배포가 아니라, 다음 구현자가 바로 이어서 작업할 수 있는 Web/API/공통계약/DB 골격을 맞추는 데 집중합니다.

## 지금 들어 있는 것

- `apps/web`: Next.js App Router + PWA + OpenNext on Cloudflare 시작점
- `apps/api`: Cloudflare Workers + Hono auth/org skeleton API
- `packages/shared`: 공통 타입 / route / schema 계약
- `db/migrations`: Cloudflare D1 migration skeleton

## Workspace 구조

```text
apps/
  web/        # Next.js App Router + PWA skeleton
  api/        # Cloudflare Workers + Hono auth/org skeleton
packages/
  shared/     # 공통 타입 / route / schema 계약
db/
  migrations/ # Cloudflare D1 migration skeleton
docs/
  architecture/
  guides/
```

## Phase 2 인증/조직 1차 범위 요약

이번 단계에서 맞춘 골격은 아래입니다.

- placeholder 로그인/로그아웃 + `/api/me`
- 회사/직원/부서/역할/권한 조회 contract
- 권한별 403 응답을 포함한 기본 RBAC read gate
- 관리자 초대 skeleton
- `user_roles`, `auth_sessions`, `audit_logs` 를 포함한 D1 migration 추가
- 로그인/내 정보/조직/관리자 placeholder Web 화면
- 로컬 검증 순서와 보안 주의사항 문서화

현재 placeholder 권한 기준은 아래처럼 시작합니다.

- `COMPANY_ADMIN`: 회사/직원/부서/역할/권한 조회 + 초대 관리
- `HR_ADMIN`: 회사/직원/부서/역할/권한 조회
- `MANAGER`: 회사/직원/부서/역할 조회
- `EMPLOYEE`: 회사 조회만 가능
- `AUDITOR`: 회사/직원/부서/역할/권한 조회 + 감사 로그 확장 시작 권한

## 빠른 로컬 시작

```bash
pnpm install
pnpm check
pnpm build
pnpm typecheck
pnpm test
pnpm --filter @gw/web build:cf
pnpm --filter @gw/api dev
```

API 개발 서버를 띄운 뒤에는 다른 터미널에서 health/auth/me endpoint와 권한별 조직 조회를 확인할 수 있습니다.

```bash
curl http://127.0.0.1:8787/api/health
curl -i http://127.0.0.1:8787/api/auth/login \
  -H 'content-type: application/json' \
  -H 'x-dev-role: COMPANY_ADMIN' \
  --data '{"email":"admin@example.com","password":"placeholder-password"}'
curl http://127.0.0.1:8787/api/me \
  -H 'cookie: gw_session=dev-placeholder-session_COMPANY_ADMIN'
curl http://127.0.0.1:8787/api/departments \
  -H 'cookie: gw_session=dev-placeholder-session_COMPANY_ADMIN'
curl -i http://127.0.0.1:8787/api/employees \
  -H 'cookie: gw_session=dev-placeholder-session_EMPLOYEE'
```

마지막 요청은 `EMPLOYEE` 역할 예시이며, 현재 구현 기준으로 403 이 나와야 정상입니다.

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

## release gate / 검토 원칙

- 승인된 오케스트레이션 범위 안에서는 GitHub PR 생성, CI 확인, merge, branch cleanup 까지 release gate 범위에 포함됩니다.
- `scripts/README.md` 에 적힌 그룹웨어 보고/감시 자동화 스크립트를 수정했다면 기능 코드와 함께 검토 대상으로 묶습니다.
- 실제 배포, 실제 외부 인증 연동, 실제 D1 migration 실행, 실제 비밀값 입력은 별도 승인 없이는 하지 않습니다.

## 문서 바로가기

- 사용자 안내: `docs/guides/cloudflare-first-user-guide.md`
- 운영 안내: `docs/guides/cloudflare-first-operator-guide.md`
- 개발 안내: `docs/guides/cloudflare-first-developer-guide.md`
- Phase 1 범위: `docs/architecture/cloudflare-first-phase-scope.md`
- Phase 2 범위: `docs/architecture/phase-2-auth-org-scope.md`
- 플랫폼 계획: `docs/architecture/next-cloudflare-platform-plan.md`
