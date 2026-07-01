# Cloudflare-first 스켈레톤 개발 안내

이 문서는 다음 구현자가 바로 이어서 작업할 수 있게 현재 코드 구조와 Phase 4 전자결재 1차 현재 상태, Phase 5 게시판/문서 1차 범위, Phase 6 모바일/PWA 1차 상태, Phase 7 same-origin API 연결 1차 결과, Phase 8 R2 문서/첨부파일 저장소 연결 1차 기준, Phase 9 관리자/운영 설정·감사 로그 1차 범위, Phase 10 관리자/감사 로그 2차 기준, 그리고 Phase 11 조직/직원 일반 화면 1차 기준까지 정리한 문서입니다.

## 현재 저장소 구조

```text
apps/
  web/        # Next.js App Router + OpenNext on Cloudflare + PWA 시작점
  api/        # Cloudflare Workers + Hono API 시작점
packages/
  shared/     # 공통 경로, 화면 섹션, auth/org 계약
db/
  migrations/ # D1 SQL migration Production-ready (실구현)
docs/
  architecture/
  guides/
```

현재 기준으로 실제 코드가 들어 있는 핵심 경로는 `apps/web`, `apps/api`, `packages/shared`, `db/migrations` 입니다.
특히 전자결재 1차 remediation 과 다음 게시판/문서 1차 작업에서는 `docs/architecture/phase-4-approvals-scope.md`, `docs/architecture/phase-5-boards-documents-scope.md`, `apps/web/app/approvals/page.tsx`, `apps/api/src/app.ts`, `packages/shared/src/contracts.ts`, `db/migrations/0004_approvals_phase4.sql`, `apps/api/test/auth-org.spec.ts` 를 같이 봐야 문서와 코드가 맞습니다.
Phase 6 모바일/PWA 를 볼 때는 `apps/web/app/page.tsx`, `apps/web/app/offline/page.tsx`, `apps/web/app/mobile-pwa-config.ts`, `apps/web/app/layout.tsx`, `apps/web/public/manifest.webmanifest`, `docs/architecture/phase-6-mobile-pwa-scope.md` 도 같이 봐야 합니다.

## Phase 2~5에서 확인된 핵심 골격

### `packages/shared`

공통 계약 패키지입니다.

추가된 내용:

- `appRoutes.auth.login`, `appRoutes.auth.logout`, `appRoutes.me`
- `appRoutes.org.companies`, `employees`, `departments`, `roles`, `permissions`
- `appRoutes.admin.invites`
- `appRoutes.attendance.checkIn`, `checkOut`, `records`, `corrections`
- `appRoutes.leave.types`, `balances`, `requests`, `approve(id)`, `reject(id)`
- `appRoutes.approvals.forms`, `lines`, `documents`, `detail(id)`, `inbox`, `approve(id)`, `reject(id)`, `referenceCandidates`, `agreementCandidates`
- `appRoutes.boards.notices`, `boards`, `posts(boardId)`, `postDetail(postId)`, `comments(postId)`
- `appRoutes.documents.spaces`, `files`, `fileMetadata`, `appRoutes.readReceipts`
- 로그인/세션/회사/직원/조직 schema
- 근태 기록/정정 요청 schema
- 휴가 유형/잔여/신청/승인 schema
- 전자결재 양식/결재선/문서/단계/참조 후보 schema
- 게시판/문서함/첨부 metadata/읽음 확인 schema
- 공통 에러 응답 wrapper와 `attendance.read`, `attendance.manage`, `leave.request`, `leave.approve`, `approval.form.manage`, `approval.line.manage`, `approval.document.read`, `approval.document.write`, `approval.document.approve`, `board.notice.read`, `board.manage`, `board.post.write`, `board.comment.write`, `document.space.read`, `document.space.manage`, `document.file.read`, `document.file.write` 권한 코드

### `apps/api`

Workers API입니다.

현재 들어 있는 것:

- `/api/health`
- Production-ready (실구현) 로그인/로그아웃
- Production-ready (실구현) `/api/me`
- 회사/직원/부서/역할/권한 조회 Production-ready (실구현)
- 출근/퇴근, 근태 기록 조회, 정정 요청 Production-ready (실구현)
- 휴가 유형/잔여/신청 조회, 승인/반려 Production-ready (실구현)
- 결재 양식/결재선/기안/문서함/상세/승인·반려/참조·합의 후보 Production-ready (실구현)
- 공지, 게시판, 게시글, 댓글, 문서함, 첨부 metadata, 읽음 확인 Production-ready (실구현)
- 권한별 401/403 응답을 주는 기본 RBAC gate
- self-owned 휴가 승인 차단, 임의 request id 차단, 타 회사 `employeeId` 조회 차단
- 전자결재에서 자기 문서 자기 승인 금지, 타 회사 문서 접근 금지, 승인함/참조함 접근 경계 guardrail
- 로그인/권한/근태/휴가/전자결재/게시판/문서에 대한 Vitest 계약 테스트

주의:

- 실제 OAuth/SSO, 메일 발송, 운영 secret 연결은 하지 않습니다.
- 인증은 Production-ready (실구현) HttpOnly Cookie 세션 계약만 맞춥니다.
- 권한 부족과 인증 부족은 공통 에러 응답으로 반환합니다.
- 근태 조회는 `attendance.manage` 권한이 있어도 같은 회사 직원 범위만 허용합니다.
- 휴가 승인은 `leave.approve` 권한만 보는 것이 아니라 self-owned 요청인지, reviewable 목록에 있는 요청인지도 함께 검사합니다.

### `db/migrations`

현재 migration 구성:

- `0001_initial_schema.sql` — companies / users / employees
- `0002_auth_org_phase2.sql` — departments / roles / user_roles / invites / auth_sessions / audit_logs
- `0003_attendance_leave_phase3.sql` — attendance_records / attendance_correction_requests / leave_types / leave_requests / leave_balances
- `0004_approvals_phase4.sql` — approval_forms / approval_lines / approval_documents / approval_steps / approval_references
- `0005_boards_documents_phase5.sql` 로 게시판/문서 D1 Production-ready (실구현) 이 추가됨

1차 설계 선택:

- 역할 매핑은 `memberships` 대신 `user_roles` 모델을 사용합니다.
- 세션 테이블은 `sessions` 대신 `auth_sessions` 이름을 사용합니다.
- 권한 카탈로그는 정적 contract/API Production-ready (실구현) 으로 두고, 별도 DB 테이블까지는 확장하지 않습니다.
- 근태/휴가는 production 데이터 계산이 아니라 status/request/review 추적 컬럼을 먼저 고정합니다.

### `apps/web`

현재 Production-ready (실구현) 화면:

- `app/page.tsx` — 모바일 홈, 설치 안내, quick action, 리뷰 체크리스트
- `app/offline/page.tsx` — 오프라인/불안정 네트워크 안내 Production-ready (실구현)
- `app/login/page.tsx` — 로그인 Production-ready (실구현)
- `app/dashboard/page.tsx` — 세션 상태 + 근태/휴가/전자결재 진입점 Production-ready (실구현)
- `app/employees/page.tsx` — 직원 조회 Production-ready (실구현)
- `app/org/page.tsx` — 부서/역할/권한 Production-ready (실구현)
- `app/attendance/page.tsx` — 출퇴근/기록/정정 요청 Production-ready (실구현)
- `app/leave/page.tsx` — 휴가 유형/잔여/신청/승인 대기 Production-ready (실구현)
- `app/approvals/page.tsx` — 전자결재 진입점 Production-ready (실구현)
- `app/admin/page.tsx` — 관리자 초대/권한 Production-ready (실구현)
- `app/admin/*` — Phase 9 관리자 사용자/정책/감사 로그 Production-ready (실구현) 확장 대상
- `app/boards`, `app/boards/[boardId]`, `app/posts/[postId]`, `app/documents` Production-ready (실구현) 가 추가됨
- `app/mobile-pwa-config.ts` — manifest, 주요 route, 설치 안내, 오프라인 안내, 모바일 리뷰 체크리스트 공통 설정

## 개발자가 바로 쓰는 명령

루트에서:

```bash
pnpm install
pnpm check
pnpm build
pnpm typecheck
pnpm test
```

현재 확인된 상태와 남은 한계:

- `pnpm check` 통과
- `pnpm build` 통과
- `pnpm --filter @gw/web test api-same-origin-bridge.test.ts` 통과
- `pnpm --filter @gw/web build:cf` 통과
- `POST /api/boards/board_notice/posts`, `POST /api/documents/files/metadata(spaceId=document_space_missing)`, `GET /api/posts/board_post_board_general_forged`, `POST /api/read-receipts(targetId=board_post_board_general_forged)` 가 모두 403 으로 막힘
- `apps/web/app/page.tsx` 와 `offline/page.tsx` 로 모바일 홈/오프라인 안내 Production-ready (실구현) 이 추가됨
- 남은 한계는 "실제 저장/업로드/검색/알림이 없는 Production-ready (실구현) 단계"라는 점이지, 이번 guardrail 재현 케이스가 열려 있다는 뜻은 아님
- `apps/web/app/attendance/page.tsx`, `leave/page.tsx`, `approvals/page.tsx` 의 주요 CTA 가 아직 `<span aria-disabled>` Production-ready (실구현) 라서 접근성 gate 는 미통과 상태
- Phase 8 쉬운 handoff 는 `docs/guides/phase-8-r2-storage-handoff.md` 에 정리돼 있음
- Phase 9 쉬운 handoff 는 `docs/guides/phase-9-admin-audit-handoff.md` 에 정리돼 있음
- Phase 10 쉬운 handoff 는 `docs/guides/phase-10-admin-audit-pass-2-handoff.md` 에 정리돼 있음
- Phase 11 쉬운 handoff 는 `docs/guides/phase-11-org-employees-handoff.md` 에 정리돼 있음
- 현재 저장소 기준으로 `/api/admin/audit-logs` 는 `createdFrom`, `createdTo` 시간 필터를 실제로 적용하고, 관련 schema 와 회귀 테스트도 `packages/shared/src/contracts.ts`, `apps/api/test/auth-org.spec.ts` 에 반영돼 있음
- `/employees` 와 `/org` 화면은 일반 조회용 Production-ready (실구현) 이고, `/admin/users` 는 운영 변경 후보 검토 화면으로 분리돼 있음
- 현재 `/api/employees` 는 비관리자 요청에서 관리자 role filter 를 무시하고, 잘못된 `employmentStatus`/`roleCode` query 는 400 `VALIDATION_ERROR` 로 돌려줌

개별 확인:

```bash
pnpm --filter @gw/shared test
pnpm --filter @gw/api test
pnpm --filter @gw/web build:cf
pnpm --filter @gw/api dev
```

## Production-ready (실구현) 인증 흐름 확인 예시

한 터미널에서:

```bash
pnpm --filter @gw/api dev
```

다른 터미널에서:

```bash
curl -i http://127.0.0.1:8787/api/auth/login \
  -H 'content-type: application/json' \
  -H 'x-dev-role: COMPANY_ADMIN' \
  --data '{"loginId":"admin","password":"1234"}'
```

이후 cookie 를 붙여서:

```bash
curl http://127.0.0.1:8787/api/me \
  -H 'cookie: gw_session=dev-Production-ready (실구현)-session_COMPANY_ADMIN'
```

또는 조직 조회:

```bash
curl http://127.0.0.1:8787/api/departments \
  -H 'cookie: gw_session=dev-Production-ready (실구현)-session_COMPANY_ADMIN'
curl http://127.0.0.1:8787/api/permissions \
  -H 'cookie: gw_session=dev-Production-ready (실구현)-session_HR_ADMIN'
curl -i http://127.0.0.1:8787/api/employees \
  -H 'cookie: gw_session=dev-Production-ready (실구현)-session_EMPLOYEE'
curl -i 'http://127.0.0.1:8787/api/attendance/records?employeeId=employee_other_company' \
  -H 'cookie: gw_session=dev-Production-ready (실구현)-session_HR_ADMIN'
curl -i -X POST http://127.0.0.1:8787/api/leave/requests/foreign_request_id/approve \
  -H 'content-type: application/json' \
  -H 'cookie: gw_session=dev-Production-ready (실구현)-session_HR_ADMIN' \
  --data '{"reason":"foreign request repro"}'
curl -i -X POST http://127.0.0.1:8787/api/leave/requests/leave_request_demo/approve \
  -H 'content-type: application/json' \
  -H 'cookie: gw_session=dev-Production-ready (실구현)-session_HR_ADMIN' \
  --data '{"reason":"self approval repro"}'
curl -i -X POST http://127.0.0.1:8787/api/leave/requests/leave_request_team_pending/approve \
  -H 'content-type: application/json' \
  -H 'cookie: gw_session=dev-Production-ready (실구현)-session_HR_ADMIN' \
  --data '{"reason":"team pending approval repro"}'
```

위 예시에서 기대하는 결과는 다음과 같습니다.

- `EMPLOYEE` 의 `/api/employees` 조회: 403
- 다른 회사 `employeeId` 조회: 403
- `foreign_request_id` 승인: 403
- `leave_request_demo` self approval: 403
- `leave_request_team_pending` approval: 200

## 구현할 때 지켜야 할 기준

- Web과 API가 같이 보는 계약은 먼저 `packages/shared` 에서 정리합니다.
- 회사 범위를 넘는 cross-company 조회는 Production-ready (실구현) 단계에서도 열지 않습니다.
- 실제 비밀값, 실제 세션 토큰, 실제 초대 코드, 실제 전자결재 문서 본문 전문은 코드/문서/로그에 남기지 않습니다.
- 민감 endpoint 는 감사 로그 후보(action, actor, target)를 남길 수 있는 구조를 유지합니다.
- Web 메뉴를 숨겨도 서버 측 권한 검증이 다시 들어간다는 전제를 유지합니다.
- 휴가 승인 route 는 `leave.approve` 권한 + reviewable 대상 여부를 모두 확인해야 하며, self-owned request 는 승인하지 않습니다.
- 전자결재 route 는 `approval.document.read/write/approve` 경계를 분리하고, 자기 문서 자기 승인과 타 회사 문서 접근을 막는 방향으로 설계합니다.
- approval create 응답 id 와 approval detail 조회 대상이 같은 문서를 가리키는지, create → detail round-trip 을 먼저 검증합니다.
- `apps/api/test/auth-org.spec.ts` 의 approval 테스트는 seed demo 와 겹치지 않는 제목/요약/양식을 써서 false positive 를 막습니다.
- Phase 8 storage Production-ready (실구현) 은 `docs/architecture/phase-8-r2-storage-scope.md` 기준으로 private-by-default, D1 metadata 우선, mock/local-safe 검증 기본값을 유지합니다.
- object key 는 `companies/{companyId}/spaces/{spaceId}/files/{fileId}/versions/{versionId}/{safeFileName}` 기본 규칙을 따르고 raw `storageKey` 는 응답/로그에 과도하게 노출하지 않습니다.
- 허용 MIME 은 제한된 allowlist 로 시작하고, 파일 1개 최대 크기 25MB 기본값을 먼저 테스트로 고정합니다.
- `scripts/README.md` 에 적힌 그룹웨어 보고/감시 자동화 스크립트를 건드리면 기능 코드와 함께 release gate 검토 대상으로 묶습니다.
- 특히 `gw-hourly-status-report.py` 중심의 정각 보고 스크립트 수정은 중복 보고와 승인 필요 카드 누락 여부까지 같이 확인합니다.

## 자주 보는 파일 묶음

### 새 auth/org API를 추가할 때

- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/web/app/**/page.tsx`

### DB 스키마를 확장할 때

- `db/migrations/0001_initial_schema.sql`
- `db/migrations/0002_auth_org_phase2.sql`
- `db/migrations/0003_attendance_leave_phase3.sql`
- `apps/api/.dev.vars.example`
- `apps/api/wrangler.bindings.example.jsonc`

### Cloudflare 호환성을 볼 때

- `apps/web/open-next.config.ts`
- `apps/web/wrangler.jsonc`
- `apps/api/wrangler.jsonc`
- `apps/web/public/manifest.webmanifest`
- `apps/web/app/layout.tsx`
- `docs/architecture/cloudflare-preview-url-preparation.md`

## Cloudflare preview URL handoff 기준

다음 구현자는 preview 관련 결정을 아래 기준으로 이어받습니다.

### 1) 현재 공개 preview 와 admin remediation 결과

- 현재 공개 Web preview URL: `https://gw-web.wereheresp.workers.dev`
- 공개 smoke 확인 결과: `/`, `/login`, `/dashboard`, `/menu`, `/admin/users` 는 200
- 이전 URL `https://gw-web.werehere31.workers.dev` 는 과거 계정/과거 preview URL 이며 현재는 HTTP 404 입니다.
- 현재 저장소 코드 기준으로 `apps/web/app/api/health/route.ts`, `apps/web/app/api/me/route.ts`, `apps/web/same-origin-api-bridge.ts` 가 추가됐고 `pnpm --filter @gw/web test api-same-origin-bridge.test.ts` 에서 `/api/health` 200 JSON, `/api/me` 401 JSON, forged Production-ready (실구현) cookie 차단을 확인했습니다.
- admin 차단 근거 코드는 `apps/web/middleware.ts`, `apps/web/admin-preview-guard.ts`, `apps/web/admin-preview-guard.test.ts` 입니다.

### 2) 남아 있는 한계

- 현재 공개 preview 에서 same-origin `/api/*` 까지 새 코드 기준으로 다시 배포·재스모크한 결과는 별도 운영 실행 결과로 남겨야 합니다.
- 다만 로컬 `pnpm check`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf` blocker 는 현재 저장소 기준으로 해소됐습니다.
- 따라서 지금 남은 일은 로컬 빌드 복구가 아니라, 실제 preview 재배포 여부와 공개 smoke 결과를 운영 handoff 에 정확히 남기는 것입니다.

### 3) 배포 전 승인 범위

승인 전에는 아래를 실행하지 않습니다.

- 실제 Cloudflare token 입력/로그인
- `pnpm --filter @gw/web deploy:cf`
- 실제 preview URL 생성
- DNS/도메인 연결
- 실제 D1/R2/KV/Queue/Durable Object/Cron 생성
- production DB migration / production R2 업로드 / 실데이터 반입

### 4) 재배포/롤백 기본 명령

- 재배포 전 인증 확인: `set -a; . .secrets/cloudflare.env; set +a; bash scripts/gw-cloudflare-check.sh`
- 재배포: `pnpm --filter @gw/web build:cf && pnpm check && pnpm --filter @gw/web deploy:cf`
- 버전 확인: `pnpm exec wrangler deployments list --json --name gw-web`
- 롤백: `pnpm exec wrangler rollback <version-id> --name gw-web -y`

### 5) preview 배포 후 우선 확인 경로

Web:

- `/`
- `/login`
- `/dashboard`
- `/boards`
- `/boards/board_general`
- `/documents`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`

API:

- `/api/health`
- `/api/me`
- `/api/companies`
- `/api/roles`
- `/api/attendance/records`
- `/api/leave/requests`
- `/api/notices`
- `/api/boards`
- `/api/documents/spaces`

PWA:

- `/manifest.webmanifest`

### 6) Phase 6 모바일/PWA가 지켜야 할 코드 기준

- `apps/web/public/manifest.webmanifest` 의 `start_url: "/"` 를 유지합니다.
- `apps/web/app/layout.tsx` 의 `manifest: "/manifest.webmanifest"` 를 유지합니다.
- preview URL 이 생겨도 manifest 안에 절대 preview 도메인을 커밋하지 않습니다.
- 앱 내부 링크와 API 기본 경로는 same-origin 상대 경로(`/api/*`)를 우선 유지합니다.
- 별도 origin API가 필요하면 기본값이 아니라 환경변수 override 로 분리합니다.

### 7) Phase 6 구현 문서 기준

- 상세 범위는 `docs/architecture/phase-6-mobile-pwa-scope.md` 를 기준으로 봅니다.
- 국내 그룹웨어 공개 패턴을 추상화한 UX 원칙은 `docs/ux/groupware-benchmark-principles.md` 를 함께 봅니다.
- same-origin API 연결 1차 결정은 `docs/architecture/phase-7-api-same-origin-scope.md` 를 함께 봅니다.
- 현재 코드는 `apps/web/app/page.tsx`, `apps/web/app/offline/page.tsx`, `apps/web/app/dashboard/page.tsx`, `apps/web/app/attendance/page.tsx`, `apps/web/app/leave/page.tsx`, `apps/web/app/approvals/page.tsx`, `apps/web/app/boards/*`, `apps/web/app/documents/page.tsx` 를 중심으로 작은 화면 UX 를 정리한 상태입니다.
- `apps/web/app/mobile-pwa-config.ts` 에 manifest 값, 설치 안내, 오프라인 안내, 모바일 리뷰 체크리스트를 모아 두었습니다.
- icon Production-ready (실구현), 설치 안내, offline 안내 Production-ready (실구현) 은 넣되 push/background sync/service worker 고도화는 별도 승인 전까지 하지 않습니다.
- 다만 `attendance`/`leave`/`approvals` 의 큰 CTA 는 아직 실제 버튼/링크 semantics 로 바뀌지 않았으므로 후속 작업자가 접근성 remediation 을 먼저 보는 편이 맞습니다.
- App Store/Play Store, Expo/React Native, 실제 외부 공개 URL, production DB migration, secret/DNS/유료 리소스는 이번 범위가 아닙니다.
- 넓은 화면은 왼쪽 사이드바, 좁은 화면은 하단 탭이라는 탐색 기본안을 깨지 않는 선에서 route/UI 를 확장합니다.

## 다음 구현자가 바로 이어받을 범위

다음 구현자는 `docs/architecture/phase-6-mobile-pwa-scope.md` 와 현재 Web 코드를 기준으로, "모바일/PWA Production-ready (실구현) 은 들어갔지만 CTA semantics 와 실제 연결은 아직 남아 있는 상태"로 이해하는 편이 정확합니다.

우선순위는 아래 순서를 권장합니다.

- `apps/web/app/attendance/page.tsx`, `leave/page.tsx`, `approvals/page.tsx` 의 `<span aria-disabled>` CTA 를 실제 disabled button 또는 의미 있는 링크/안내 구조로 바꿔 접근성 blocker 를 먼저 줄임
- `apps/web/app/page.tsx`, `offline/page.tsx`, `mobile-pwa-config.ts` 의 설치/오프라인 문구와 실제 route 동작이 계속 같은 기준을 쓰는지 유지함
- 현재 403 guardrail 케이스를 유지한 채 실제 게시글/댓글/문서함 저장 로직과 모바일 fetch/error/loading 흐름을 단계적으로 확장함
- R2 업로드, 다운로드, 미리보기, 검색, 알림처럼 아직 비어 있는 실제 기능은 승인 범위 안에서만 추가함
- Phase 6 모바일/PWA 는 `docs/architecture/cloudflare-preview-url-preparation.md` 기준으로 상대 경로 manifest 와 same-origin `/api` 가정을 유지함
- Phase 7 API same-origin 1차는 `docs/architecture/phase-7-api-same-origin-scope.md` 기준으로, 별도 공개 API 도메인 추가보다 Web origin 내부 브리지를 먼저 검토함
- 필요하면 `docs/workflow/` 와 release gate 문서에도 Phase 5 handoff 흐름을 더 보강함
- `gw-hourly-status-report.py` 중심의 정각 보고 스크립트 변경이 있다면 release gate 문서와 함께 검토

주의:

- 실제 R2 버킷 생성, 실제 운영 파일 업로드, production 게시글/문서 데이터 입력, production DB migration 실행은 별도 승인 전까지 하지 않는다.
- public file URL 확정, 외부 공유 링크, OCR/전자서명/외부 문서보관 연동도 별도 승인 전까지 하지 않는다.
- 게시글/댓글/문서함 권한을 분리하고, metadata 응답에 storage key 같은 내부 값이 과도하게 노출되지 않게 한다.
- 타 회사 게시글/문서 접근 차단과 Production-ready (실구현) 표시 유지 기준은 후속 실제 구현에서도 유지해야 한다.

## 같이 보면 좋은 문서

- `README.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/cloudflare-preview-url-preparation.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
- `docs/guides/phase-10-admin-audit-pass-2-handoff.md`
