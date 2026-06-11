# gw

그룹웨어 개발/운영 자동화 저장소입니다.

이 저장소는 Cloudflare-first 기반 그룹웨어 monorepo skeleton을 포함합니다.
지금 단계에서는 실서비스 배포가 아니라, 다음 구현자가 바로 이어서 작업할 수 있는 Web/API/공통계약/DB 골격을 맞추는 데 집중합니다.

## 지금 들어 있는 것

- `apps/web`: Next.js App Router + PWA + OpenNext on Cloudflare 시작점
- `apps/api`: Cloudflare Workers + Hono auth/org skeleton API
- `packages/shared`: 공통 타입 / route / schema 계약
- `db/migrations`: Cloudflare D1 migration skeleton
- Phase 4 전자결재 1차 skeleton (`/approvals`, approval API, `0004_approvals_phase4.sql`)
- Phase 5 게시판/문서 1차 API/shared skeleton (`/api/notices`, `/api/boards`, `/api/documents/*`, `/api/read-receipts`)
- Phase 5 범위/운영 문서 (`docs/architecture/phase-5-boards-documents-scope.md`)
- Phase 6 모바일/PWA 1차 skeleton (`/`, `/offline`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `apps/web/app/mobile-pwa-config.ts`)
- Phase 6 모바일/PWA 범위 문서 (`docs/architecture/phase-6-mobile-pwa-scope.md`)
- Phase 7 API same-origin 연결 1차 범위 문서 (`docs/architecture/phase-7-api-same-origin-scope.md`)
- Phase 8 R2 문서/첨부파일 저장소 연결 1차 범위 문서 (`docs/architecture/phase-8-r2-storage-scope.md`)
- Phase 9 관리자/운영 설정·감사 로그 1차 범위 문서 (`docs/architecture/phase-9-admin-audit-scope.md`)
- Phase 10 관리자/감사 로그 2차 고도화 범위 문서 (`docs/architecture/phase-10-admin-audit-pass-2-scope.md`)
- Phase 11 조직/직원 일반 화면 1차 범위 문서 (`docs/architecture/phase-11-org-employees-scope.md`)
- 자동화 보강 범위 문서: review-required gate / safe triage / recovery loop (`docs/architecture/automation-hardening-review-gate-scope.md`)
- 국내 그룹웨어 공개 패턴을 추상화한 UX 벤치마크 원칙 (`docs/ux/groupware-benchmark-principles.md`)
- 한국형 그룹웨어 제품 비전/우선순위/3단계 로드맵 문서 (`docs/product/groupware-vision-roadmap.md`)

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
  product/
  ux/
```

운영/병합 전 release gate 기준은 `docs/plans/release-gate.md`를 먼저 봅니다.

## Phase 2 인증/조직 1차 범위 요약

이번 단계에서 맞춘 골격은 아래입니다.

- placeholder 로그인/로그아웃 + `/api/me`
- 회사/직원/부서/역할/권한 조회 contract
- 권한별 403 응답을 포함한 기본 RBAC read gate
- 관리자 초대 skeleton
- `user_roles`, `auth_sessions`, `audit_logs` 를 포함한 D1 migration 추가
- 로그인/내 정보/조직/관리자 placeholder Web 화면
- 로컬 검증 순서와 보안 주의사항 문서화

## Phase 3 근태/휴가 1차 skeleton

현재 저장소에는 아래 골격이 추가되어 있습니다.

- `attendance_records`, `attendance_correction_requests`, `leave_types`, `leave_requests`, `leave_balances` D1 migration skeleton
- 출근/퇴근, 근태기록 조회, 정정 요청, 휴가 유형/잔여/신청/승인 API skeleton
- `packages/shared` 의 attendance/leave route, schema, 타입, 권한 코드 확장
- `apps/web/app/attendance`, `apps/web/app/leave`, `apps/web/app/dashboard` placeholder 화면 정리
- 승인 권한, 민감정보, placeholder 한계, release gate 기준 문서 연결

현재 placeholder 권한 기준은 아래처럼 시작합니다.

- `COMPANY_ADMIN`: 회사/직원/부서/역할/권한 조회 + 초대 관리 + 근태 관리 + 휴가 승인
- `HR_ADMIN`: 회사/직원/부서/역할/권한 조회 + 근태 관리 + 휴가 승인
- `MANAGER`: 회사/직원/부서/역할 조회 + 근태 관리 + 휴가 승인
- `EMPLOYEE`: 회사 조회 + 본인 출퇴근/근태 조회 + 휴가 신청
- `AUDITOR`: 회사/직원/부서/역할/권한 조회 + 감사 로그 확장 시작 권한 + 근태 조회

Phase 3 1차 remediation 이후 확인된 guardrail 은 아래와 같습니다.

- `GET /api/attendance/records` 는 `attendance.manage` 권한이 있어도 같은 회사에 속한 `employeeId` 만 조회할 수 있습니다. 임의의 다른 회사 직원 id 를 넣으면 403 이 나와야 정상입니다.
- `GET /api/leave/requests` 는 누구나 자기 요청(`leave_request_demo`)을 보되, `leave.approve` 권한이 있는 승인자만 팀 대기 요청(`leave_request_team_pending`)을 추가로 봅니다.
- `POST /api/leave/requests/:id/approve|reject` 는 승인 권한만으로 충분하지 않습니다. 자기 own 요청 승인과 임의 request id 승인은 모두 403 으로 막혀야 정상입니다.
- 근태/휴가 endpoint 는 "실제 저장 완료"가 아니라 placeholder 응답과 audit candidate 구조를 검증하는 단계입니다.

## Phase 4 전자결재 1차 현재 상태

저장소에는 `docs/architecture/phase-4-approvals-scope.md` 를 기준으로 전자결재 1차 skeleton 이 이미 들어 있습니다.

현재 들어 있는 범위는 아래와 같습니다.

- `approval_forms`, `approval_lines`, `approval_documents`, `approval_steps`, `approval_references` D1 migration skeleton
- 결재 양식, 결재선, 기안, 문서함, 승인/반려, 참조/합의 후보 API skeleton
- `packages/shared` 의 approval route, schema, 타입, 공통 응답/권한 코드 확장
- `apps/web/app/approvals` 목록/기안/상세/승인함 placeholder 화면 skeleton
- 회사 scope, 문서 접근 경계, 자기 문서 자기 승인 금지, release gate/보고 자동화 기준 문서화
- `gw-telegram-kanban-report-watch.py` 를 포함한 감시/보고 스크립트 변경을 GitHub release gate 검토 범위에 포함

현재 저장소 기준으로 기본 테스트와 타입체크는 통과합니다.

- `pnpm check` 통과
- 전자결재는 여전히 placeholder 단계이며, 실제 법적 효력/외부 전자서명/실운영 데이터 저장은 이번 범위가 아닙니다.
- 이번 문서화 카드에서는 Phase 5 게시판/문서 guardrail 검증 결과를 우선 반영합니다.

이번 Phase 에서 하지 않는 일 예시는 아래와 같습니다.

- 법적 효력이 필요한 전자서명/본인인증 연동
- production 결재 데이터 입력 및 production DB migration 실행
- 외부 문서보관 SaaS, 공개 배포, 유료 리소스, 실제 비밀값 입력

## Phase 5 게시판/문서 1차 현재 상태

기준 문서는 `docs/architecture/phase-5-boards-documents-scope.md` 이며, 현재 작업물은 "로컬 검증 통과 + guardrail 정리 반영" 상태입니다.

현재 저장소에 실제로 들어 있는 항목은 아래와 같습니다.

- `packages/shared/src/contracts.ts` 에 board/document route, schema, 타입, 권한 코드 추가
- `apps/api/src/app.ts` 에 공지, 게시판, 게시글, 댓글, 문서함, 첨부 metadata, 읽음 확인 endpoint 와 접근 경계 보강 반영
- `apps/api/test/auth-org.spec.ts` 와 `packages/shared/test/contracts.spec.ts` 에 계약/권한 테스트 추가
- `db/migrations/0005_boards_documents_phase5.sql` 에 게시판/문서 D1 skeleton 추가
- `apps/web/app/boards`, `apps/web/app/boards/[boardId]`, `apps/web/app/posts/[postId]`, `apps/web/app/documents` 에 placeholder 화면 추가
- `docs/workflow/groupware-kanban-automation.md` 에 Phase 5 release gate 메모 추가

이번에 다시 확인한 Phase 5 guardrail 결과는 아래와 같습니다.

- `POST /api/boards/board_notice/posts` 는 일반 구성원 요청에서 403 으로 막힙니다.
- `POST /api/documents/files/metadata` 는 존재하지 않는 `spaceId=document_space_missing` 에서 403 으로 막힙니다.
- `GET /api/posts/board_post_board_general_forged` 는 403 으로 막힙니다.
- `POST /api/read-receipts` 는 forged `targetId=board_post_board_general_forged` 에서 403 으로 막힙니다.

검증 명령과 실제 결과는 아래와 같습니다.

- `pnpm --filter @gw/api test -- --runInBand apps/api/test/auth-org.spec.ts` → 2개 파일, 40개 테스트 통과
- `pnpm check` → workspace test + typecheck 통과
- `pnpm build` → web production build 통과 (`/boards`, `/boards/[boardId]`, `/documents`, `/posts/[postId]` 포함)

즉, 현재 Phase 5 는 "API/shared + DB skeleton + Web placeholder + guardrail 테스트가 로컬에서 맞춰진 상태"로 보는 것이 맞습니다.
다만 실제 운영 저장/업로드/검색/알림까지 끝난 상태는 아닙니다.

이번 Phase 문서에서 특히 고정한 제외/승인 필요 범위는 아래와 같습니다.

- 실제 R2 버킷 생성, 실제 운영 파일 업로드, production 게시글/문서 데이터 입력은 하지 않음
- production DB migration, 외부 공개 배포, DNS/R2/도메인 작업, 실제 비밀값 입력은 별도 승인 필요
- `gw-telegram-kanban-report-watch.py` 를 포함한 감시/보고 스크립트 수정은 계속 GitHub release gate 검토 범위에 포함

Cloudflare preview URL 준비 기준은 별도 문서로 정리했습니다.

- `docs/architecture/cloudflare-preview-url-preparation.md`
- 현재 저장소 기준 기본 preview 후보는 `workers.dev` 이며, 실제 URL 생성/Cloudflare token 사용/public exposure 는 별도 승인 전까지 하지 않습니다.

## Cloudflare preview URL handoff 빠른 요약

문서만 먼저 보고 싶은 경우 아래 5가지만 기억하면 됩니다.

1. 현재 공개 preview URL 과 최근 확인 결과
   - 현재 공개 Web preview URL: `https://gw-web.werehere31.workers.dev`
   - 공개 smoke 확인 결과: `/`, `/login`, `/boards`, `/documents` 는 200
   - 공개 admin 경계 확인 결과: `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 는 모두 `/login` 으로 307 redirect
   - 로컬 `pnpm --filter @gw/web preview:cf` smoke 도 같은 패턴을 재현했고 `/manifest.webmanifest` 는 200 이었습니다.
2. 남아 있는 한계
   - 저장소 코드에는 same-origin `/api/health`, `/api/me` 브리지가 이미 들어가 있고 로컬 최종 게이트(`pnpm --filter @gw/web build:cf`)도 다시 통과했습니다.
   - 다만 현재 공개 preview URL 에서 이 최신 코드를 다시 배포해 `/api/*` 와 `/admin*` 를 재스모크한 결과는 별도 운영 실행 결과로 남겨야 합니다.
3. 재배포/롤백 기본 방법
   - 재배포 전: `set -a; . .secrets/cloudflare.env; set +a; bash scripts/gw-cloudflare-check.sh`
   - 재배포: `pnpm --filter @gw/web build:cf && pnpm check && pnpm --filter @gw/web deploy:cf`
   - 배포 확인: `pnpm exec wrangler deployments list --json --name gw-web`
   - 롤백: 위 목록에서 되돌릴 version id 를 확인한 뒤 `pnpm exec wrangler rollback <version-id> --name gw-web -y`
4. Phase 6 모바일/PWA가 이어받을 기준
   - `apps/web/public/manifest.webmanifest` 의 `start_url: "/"` 유지
   - `apps/web/app/layout.tsx` 의 `manifest: "/manifest.webmanifest"` 유지
   - 앱 내부 링크와 API 기본 경로는 same-origin 상대 경로(`/api/*`) 우선 유지
5. preview 가 떠도 production 승인과는 별개
   - 실제 secret 반영, 운영 리소스 연결, 외부 공개 확대는 다시 승인받아야 함

## Phase 6 모바일/PWA 1차 현재 상태

기준 문서는 `docs/architecture/phase-6-mobile-pwa-scope.md` 입니다.

현재 저장소에 실제로 들어 있는 항목은 아래와 같습니다.

- `apps/web/app/page.tsx` 에서 모바일 홈, 설치 안내, quick action, 리뷰 체크리스트를 먼저 보여 줍니다.
- `apps/web/app/offline/page.tsx` 에서 오프라인/불안정 네트워크 안내 skeleton 을 분리해 둡니다.
- `apps/web/app/dashboard/page.tsx`, `attendance/page.tsx`, `leave/page.tsx`, `approvals/page.tsx` 에서 작은 화면 우선 카드 구조를 맞춥니다.
- `apps/web/app/mobile-pwa-config.ts` 에 manifest 값, 주요 route, 설치 안내, 오프라인 안내, 모바일 리뷰 체크리스트를 한곳에서 관리합니다.
- `apps/web/app/layout.tsx` 와 `apps/web/public/manifest.webmanifest` 는 같은 origin 상대 경로 manifest 기준을 유지합니다.

이번에 문서에서 특히 고정한 사용 기준은 아래와 같습니다.

- 사용자는 `/`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/offline` 까지의 작은 화면 흐름을 먼저 확인하면 됩니다.
- 설치 안내가 보여도 실제 앱스토어 배포, push, background sync, 생체인증, 실데이터 운영 연결이 열린 것은 아닙니다.
- 오프라인 화면은 "지금 가능한 일/막아야 하는 일/다시 시도 절차"를 설명하는 안내용 skeleton 이며, 상태 변경 성공을 약속하지 않습니다.
- preview URL 이 생겨도 manifest 와 API 경로는 same-origin 상대 경로를 기본으로 유지합니다.
- UX 정보구조 기준은 `docs/ux/groupware-benchmark-principles.md` 를 먼저 보고, 넓은 화면 왼쪽 사이드바 / 좁은 화면 하단 탭 기본안을 유지합니다.

완료 기준 요약:

- 확인된 결과: `pnpm check`, `pnpm build`, same-origin `/api/health`·`/api/me` 로컬 테스트, `pnpm --filter @gw/web build:cf` 가 모두 통과했습니다.
- 현재 남은 known gap: `apps/web/app/attendance/page.tsx`, `leave/page.tsx`, `approvals/page.tsx` 의 주요 모바일 CTA 는 아직 `<span aria-disabled>` placeholder 라서 접근성 gate 는 통과한 상태가 아닙니다.
- `/manifest.webmanifest` 와 same-origin `/api/*` 정책이 문서와 코드에서 모순되지 않아야 합니다.
- 모바일/PWA UX 보안·접근성 리뷰 메모와 release gate 기준이 문서에 남아 있어야 합니다.

## Phase 7 API same-origin 연결 1차 현재 상태

기준 문서는 `docs/architecture/phase-7-api-same-origin-scope.md` 입니다.

이번에 고정한 결정은 아래와 같습니다.

- 공개 기본 주소는 계속 Web origin 하나를 씁니다. 현재 preview 는 `https://gw-web.werehere31.workers.dev` 입니다.
- Web/PWA 의 API 기본 경로는 계속 same-origin `/api/*` 입니다.
- 현재 저장소에는 `apps/web/app/api/health/route.ts`, `apps/web/app/api/me/route.ts`, `apps/web/same-origin-api-bridge.ts` 가 추가되어 same-origin `/api/health`, `/api/me` 요청을 기존 `apps/api/src/app.ts` 계약으로 넘깁니다.
- 이 브리지는 공개 API 도메인을 새로 두지 않고 Web 안에서 같은 origin 경로를 유지합니다.
- 로컬 개발용 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787` override 는 유지할 수 있지만, preview 전용 절대 API hostname 을 기본값으로 커밋하지 않습니다.
- 현재 로컬 테스트 기준으로 `/api/health` 200 JSON, `/api/me` 401 JSON, forged placeholder cookie 차단은 확인됐습니다.
- Cloudflare용 최종 게이트인 `pnpm --filter @gw/web build:cf` 도 현재 저장소 기준으로 다시 통과했습니다. 공개 preview 재확인은 별도 운영 실행으로 남겨야 합니다.

즉, Phase 7 의 첫 게이트는 급여/노무 UI 확장이 아니라 "Phase 6 PWA/mobile 이 믿는 same-origin API 배관을 preview 에서 먼저 맞추는 것"입니다.

## Phase 8 R2 문서/첨부파일 저장소 연결 1차 범위

기준 문서는 `docs/architecture/phase-8-r2-storage-scope.md` 입니다.
쉬운 handoff 문서는 `docs/guides/phase-8-r2-storage-handoff.md` 입니다.

이번에 고정한 결정은 아래와 같습니다.

- 파일 본문 저장소는 R2 전제로 설계하되, 1차 기본 검증은 mock/local-safe adapter 로 먼저 통과시킵니다.
- 메타데이터 기준 저장소는 계속 D1 `document_files` 계열로 두고, raw `storageKey`, bucket 이름, public URL 은 API 응답에 노출하지 않습니다.
- object key 는 `companies/{companyId}/spaces/{spaceId}/files/{fileId}/versions/{versionId}/{safeFileName}` 규칙을 기본안으로 삼아 회사 경계를 가장 바깥 prefix 에 둡니다.
- 허용 MIME 은 PDF, PNG/JPEG/WEBP, TXT/CSV, DOCX/XLSX/PPTX, HWP/HWPX 의 제한된 allowlist 로 시작하고 파일 1개 최대 크기는 25MB 로 둡니다.
- 접근은 private-by-default 로 유지하고, upload/download 는 문서 공간 권한과 회사 경계를 API 가 먼저 확인한 뒤 짧은 TTL signed action 또는 mock token 형태로만 엽니다.
- 실제 운영 파일 업로드, public URL 확정, production bucket 추가 생성, production DB migration, 외부 공유 링크, OCR/전자서명 연동은 이번 범위에 넣지 않습니다.
- 다음 구현자는 `packages/shared/src/contracts.ts`, `apps/api/src/app.ts`, `apps/api/test/auth-org.spec.ts`, `db/migrations/0005_boards_documents_phase5.sql` 를 먼저 보고, `apps/api/src/lib/document-storage*.ts` 와 `db/migrations/0006_document_storage_phase8.sql` 같은 최소 skeleton 확장부터 시작하면 됩니다.

즉, Phase 8 의 첫 게이트는 "운영 파일 저장 오픈"이 아니라 "보안 경계와 승인 게이트를 먼저 잠그고 dev/preview-safe storage skeleton 을 붙이는 것"입니다.

## Phase 9 관리자/운영 설정·감사 로그 1차 범위

기준 문서는 `docs/architecture/phase-9-admin-audit-scope.md` 입니다.
쉬운 handoff 문서는 `docs/guides/phase-9-admin-audit-handoff.md` 입니다.

이번에 고정한 결정은 아래와 같습니다.

- `/org`, `/employees`, `/boards`, `/documents`, `/approvals`, `/attendance`, `/leave` 는 일반 업무/조회 흐름으로 유지하고, 운영 변경은 `/admin/*` 로만 분리합니다.
- `/admin/users` 는 사용자 초대/역할/상태 변경 후보, `/admin/policies` 는 운영 정책 후보, `/admin/audit-logs` 는 운영 변경 이력 조회 후보를 맡습니다.
- 익명 공개 preview 에서는 계속 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 `/login` 으로 돌려 admin skeleton 공개 노출을 막습니다.
- 감사 로그는 사용자/권한/정책/문서공간/게시판/첨부 metadata 변경 후보를 포함하되, raw `storageKey`, bucket 이름, public URL, secret 은 남기지 않습니다.
- Phase 8 object key/metadata 와 연결되는 운영 변경은 파일 본문이 아니라 D1 metadata 와 `fileId`/`spaceId`/`versionId`/`storageStatus` 중심으로 추적합니다.
- 로컬 최신 검증 기준으로 admin preview guard 회귀, admin/shared 계약, API 권한 경계, `pnpm check`, `pnpm --filter @gw/web build:cf` 가 모두 다시 통과했습니다.
- 실제 운영 사용자/권한 변경, production DB migration, 운영 파일 업로드, 외부 감사 시스템 연동은 이번 범위에 넣지 않습니다.

즉, Phase 9 의 첫 게이트는 "관리자 화면 공개"가 아니라 "운영 통제와 일반 사용자 업무 흐름을 분리하고 감사 후보 구조를 먼저 고정하는 것"입니다.

## Phase 10 관리자/감사 로그 2차 고도화 범위

기준 문서는 `docs/architecture/phase-10-admin-audit-pass-2-scope.md` 입니다.
쉬운 handoff 문서는 `docs/guides/phase-10-admin-audit-pass-2-handoff.md` 입니다.

이번에 고정한 결정은 아래와 같습니다.

- `/admin/users` 는 실제 저장보다 사용자-직원 연결 상태, 역할/고위험 권한, before/after diff, 감사 preview 를 먼저 강화합니다.
- `/admin/policies` 는 근태/휴가/결재, 문서/첨부, 게시판/공지 정책 후보를 나눠 card/diff/reason/audit preview 중심으로 고도화합니다.
- `/admin/audit-logs` 는 actor/action/target/category/time 필터와 민감값 마스킹 회귀를 먼저 고정합니다.
- `/api/admin/*` 의 변경 후보 응답은 가능하면 `audit`, `maskedFields`, `companyBoundary` 근거를 함께 유지합니다.
- 이번 단계도 실제 운영 사용자/권한 변경, production 정책 저장, production DB 실행, 외부 로그 전송은 하지 않습니다.

즉, Phase 10 의 핵심은 "운영 기능 오픈"이 아니라 "운영 직전 수준의 candidate 화면/API/테스트 계약을 더 촘촘하게 잠그는 것"입니다.

## Phase 11 조직/직원 일반 화면 1차 범위

기준 문서는 `docs/architecture/phase-11-org-employees-scope.md` 입니다.
쉬운 handoff 문서는 `docs/guides/phase-11-org-employees-handoff.md` 입니다.

이번에 고정한 결정은 아래와 같습니다.

- `/employees` 는 직원 이름, 소속, 역할/직책 요약, 재직 상태를 보여주는 일반 조회 화면으로 강화합니다.
- `/org` 는 부서 구조, 역할/직책 구조, 권한 체계 안내를 보여주는 조직 탐색 화면으로 강화합니다.
- `/admin/users` 는 계속 사용자-직원 연결, 역할 diff, 상태 변경 preview 를 검토하는 관리자 candidate 화면으로 남깁니다.
- 모바일에서는 하단 탭 확장보다 홈/대시보드 진입점과 읽기 쉬운 카드/목록 구조를 먼저 맞춥니다.
- 이번 단계도 실제 직원 개인정보 반입, 운영 사용자 권한 저장, production DB 실행, 외부 HR 연동은 하지 않습니다.
- 현재 로컬 검증 기준으로 web/shared/api 테스트와 web build 는 통과했고, `/api/employees` 는 비관리자에게 관리자 role filter 를 무시하며 잘못된 role/status query 는 400 `VALIDATION_ERROR` 로 응답합니다.

즉, Phase 11 의 핵심은 "조직/직원 일반 화면을 관리자 운영 화면과 섞지 않고 독립 업무 모듈로 또렷하게 만드는 것"입니다.

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

주의:

- 현재 기준으로 `pnpm check` 는 통과합니다. 다만 이것만으로 Phase 5 접근 경계까지 모두 보장되지는 않습니다.
- 게시판/문서 1차는 기존 테스트 외에 forged 게시글 상세 조회와 forged read receipt 생성까지 403 으로 막히는지 같이 확인해야 합니다.

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
curl -X POST http://127.0.0.1:8787/api/attendance/check-in \
  -H 'cookie: gw_session=dev-placeholder-session_EMPLOYEE'
curl 'http://127.0.0.1:8787/api/attendance/records?workDateFrom=2026-06-01&workDateTo=2026-06-30' \
  -H 'cookie: gw_session=dev-placeholder-session_EMPLOYEE'
curl -X POST http://127.0.0.1:8787/api/leave/requests \
  -H 'content-type: application/json' \
  -H 'cookie: gw_session=dev-placeholder-session_EMPLOYEE' \
  --data '{"leaveTypeId":"leave_type_annual","startDate":"2026-06-20","endDate":"2026-06-20","unit":"day","days":1,"reason":"family event"}'
curl -X POST http://127.0.0.1:8787/api/leave/requests/leave_request_demo/approve \
  -H 'content-type: application/json' \
  -H 'cookie: gw_session=dev-placeholder-session_HR_ADMIN' \
  --data '{"reason":"self approval repro"}'
curl -X POST http://127.0.0.1:8787/api/leave/requests/leave_request_team_pending/approve \
  -H 'content-type: application/json' \
  -H 'cookie: gw_session=dev-placeholder-session_HR_ADMIN' \
  --data '{"reason":"team pending approval repro"}'
```

조직 조회 요청은 `EMPLOYEE` 역할 예시이며 현재 구현 기준으로 403 이 나와야 정상입니다.

근태/휴가 검증에서 기대하는 결과는 아래와 같습니다.

- `employeeId=employee_other_company` 조회: 403
- `leave_request_demo` self approval: 403
- `leave_request_team_pending` approval: 200
- `foreign_request_id` approval: 403

즉, 근태/휴가 endpoint 는 placeholder 성공 응답만 보는 것이 아니라 scope/승인 경계가 지켜지는지도 함께 확인해야 합니다.

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
- Phase 8 쉬운 handoff: `docs/guides/phase-8-r2-storage-handoff.md`
- Phase 9 쉬운 handoff: `docs/guides/phase-9-admin-audit-handoff.md`
- Phase 10 쉬운 handoff: `docs/guides/phase-10-admin-audit-pass-2-handoff.md`
- Phase 11 쉬운 handoff: `docs/guides/phase-11-org-employees-handoff.md`
- 자동화 보강 쉬운 handoff: `docs/guides/automation-hardening-review-gate-handoff.md`
- Phase 1 범위: `docs/architecture/cloudflare-first-phase-scope.md`
- Phase 2 범위: `docs/architecture/phase-2-auth-org-scope.md`
- Phase 3 범위: `docs/architecture/phase-3-attendance-leave-scope.md`
- Phase 4 범위: `docs/architecture/phase-4-approvals-scope.md`
- Phase 5 범위: `docs/architecture/phase-5-boards-documents-scope.md`
- Phase 9 범위: `docs/architecture/phase-9-admin-audit-scope.md`
- Phase 10 범위: `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- Phase 11 범위: `docs/architecture/phase-11-org-employees-scope.md`
- Cloudflare preview 준비: `docs/architecture/cloudflare-preview-url-preparation.md`
- 플랫폼 계획: `docs/architecture/next-cloudflare-platform-plan.md`
