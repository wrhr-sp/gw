# Cloudflare-first 스켈레톤 운영 안내

이 문서는 현재 스켈레톤을 로컬에서 점검하거나 다음 운영 단계로 넘기기 전에 확인할 항목을 정리한 문서입니다.

## 운영 관점에서 지금 상태

현재 저장소는 여전히 "실리소스 연결 전 단계"입니다. 지금은 Phase 5 게시판/문서 guardrail, Phase 6 모바일/PWA skeleton, Phase 7 same-origin API 브리지 1차, Phase 8 R2 문서/첨부파일 저장소 연결 1차 기준, Phase 9 관리자/운영 설정·감사 로그 1차 범위, Phase 10 관리자/감사 로그 2차 기준, 그리고 Phase 11 조직/직원 일반 화면 1차 경계까지 맞춘 상태를 점검하는 단계입니다.

들어 있는 것:

- OpenNext on Cloudflare 기준 Web 설정
- Workers + Hono API 시작점
- placeholder 로그인/로그아웃/내 정보/조직 조회/관리자 초대 API
- 권한별 조직 조회 차단을 포함한 기본 RBAC read gate
- 근태 조회 범위 제한, 휴가 신청/승인 placeholder, self-approval 차단 guardrail
- 전자결재 양식/결재선/기안/문서함/승인함 placeholder API와 `/approvals` 진입점
- D1 migration 골격 (`0001`, `0002`, `0003`, `0004`)
- Phase 5 게시판/문서 1차 범위 문서
- Phase 6 모바일/PWA 1차 홈(`/`), 오프라인 안내(`/offline`), 설치 안내, 모바일 quick action
- Phase 6 모바일/PWA 1차 기준 문서
- same-origin `/api/health`, `/api/me` 브리지 코드와 검증 테스트
- 게시판/문서 API/shared skeleton 과 guardrail 재현 항목
- Phase 8 R2 storage 범위 문서와 private-by-default 기준
- Phase 9 관리자/운영 설정·감사 로그 범위 문서와 `/admin*` 운영 경계 기준
- Phase 10 관리자/감사 로그 2차 문서와 candidate 운영 경계 기준
- Phase 11 조직/직원 일반 화면 문서와 `/employees`·`/org`·`/admin/users` 경계 설명
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
- `db/migrations/0003_attendance_leave_phase3.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/guides/phase-8-r2-storage-handoff.md`
- `docs/guides/phase-9-admin-audit-handoff.md`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/app/layout.tsx`
- `docs/architecture/phase-6-mobile-pwa-scope.md`

핵심 원칙은 간단합니다.
실제 비밀값과 실제 리소스 ID는 아직 저장소에 들어가면 안 됩니다.

## 로컬 점검 순서

루트 디렉터리에서 아래 순서로 확인하면 됩니다.

현재 확인된 상태:

- `pnpm check` 통과
- `pnpm build` 통과
- `pnpm --filter @gw/api test -- --runInBand apps/api/test/auth-org.spec.ts` 에서 2개 파일, 40개 테스트 통과
- `POST /api/boards/board_notice/posts` 는 일반 구성원 요청에서 403
- `POST /api/documents/files/metadata` 는 `spaceId=document_space_missing` 에서 403
- `GET /api/posts/board_post_board_general_forged` 는 403
- `POST /api/read-receipts` 는 forged `targetId=board_post_board_general_forged` 에서 403
- `db/migrations/0005_boards_documents_phase5.sql`, `apps/web/app/boards`, `apps/web/app/boards/[boardId]`, `apps/web/app/posts/[postId]`, `apps/web/app/documents`, `docs/workflow/groupware-kanban-automation.md` 까지 저장소에 반영됨
- `pnpm --filter @gw/web build` 통과
- same-origin `/api/health`, `/api/me` 로컬 테스트 통과
- `apps/web/app/page.tsx`, `apps/web/app/offline/page.tsx`, `apps/web/app/mobile-pwa-config.ts` 에 Phase 6 모바일/PWA skeleton 반영
- 다만 `apps/web/app/attendance/page.tsx`, `leave/page.tsx`, `approvals/page.tsx` 의 주요 CTA 는 아직 `<span aria-disabled>` placeholder 라서 접근성 gate 미통과 상태

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
curl -i 'http://127.0.0.1:8787/api/attendance/records?employeeId=employee_other_company' \
  -H 'cookie: gw_session=dev-placeholder-session_HR_ADMIN'
curl -i -X POST http://127.0.0.1:8787/api/leave/requests/foreign_request_id/approve \
  -H 'content-type: application/json' \
  -H 'cookie: gw_session=dev-placeholder-session_HR_ADMIN' \
  --data '{"reason":"foreign request repro"}'
curl -i -X POST http://127.0.0.1:8787/api/leave/requests/leave_request_demo/approve \
  -H 'content-type: application/json' \
  -H 'cookie: gw_session=dev-placeholder-session_HR_ADMIN' \
  --data '{"reason":"self approval repro"}'
curl -i -X POST http://127.0.0.1:8787/api/leave/requests/leave_request_team_pending/approve \
  -H 'content-type: application/json' \
  -H 'cookie: gw_session=dev-placeholder-session_HR_ADMIN' \
  --data '{"reason":"team pending approval repro"}'
```

운영 주의:

- 위 cookie 값은 로컬 placeholder 계약 예시일 뿐이며 실운영 secret 이 아닙니다.
- `EMPLOYEE` 조직 조회, 다른 회사 `employeeId` 조회, 자기 own 휴가 승인, 임의 request id 승인은 모두 403 이어야 정상입니다.
- `leave_request_team_pending` 승인만 200 이어야 하며, 이 응답도 placeholder audit candidate 검증용입니다.
- 응답/로그에 실제 비밀번호, 실제 세션 토큰, 실제 초대 코드, 실제 사유 전문을 남기면 안 됩니다.

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

## Cloudflare preview URL 준비 기준

현재 저장소 기준 preview URL 기본 후보는 `workers.dev` 입니다.

- `apps/web/wrangler.jsonc` 가 `.open-next/worker.js` 를 메인으로 쓰는 Workers 배포 형태
- `apps/web/package.json` 도 `opennextjs-cloudflare deploy` 흐름 기준
- `apps/web/open-next.config.ts` 는 incremental cache 를 별도로 켜지 않아 preview 준비 단계에서 R2 선행 생성이 필수는 아님

반대로 `pages.dev` 는 이번 저장소의 기본 경로가 아닙니다.
Pages 중심 preview 로 바꾸려면 별도 아키텍처 재검토가 먼저 필요합니다.

운영 원칙:

- preview 준비 문서화와 로컬 build 검증까지만 현재 승인 범위
- 실제 URL 생성, Cloudflare token 사용, public exposure, DNS/도메인 연결은 별도 승인 전까지 금지
- 실제 D1/R2/KV/Queue/Durable Object/Cron 생성도 별도 승인 전까지 금지

상세 기준은 `docs/architecture/cloudflare-preview-url-preparation.md` 를 봅니다.

### 배포 전 승인 체크리스트

preview 배포 버튼을 누르기 전에 운영자가 대장 승인 여부를 다시 확인해야 할 항목은 아래입니다.

- Cloudflare token/계정 사용 승인
- 실제 preview URL 생성 승인
- 외부 공개(public exposure) 허용 승인
- DNS/도메인 연결 필요 시 그 작업 승인
- 실제 D1/R2/KV/Queue/Durable Object/Cron 생성 필요 시 그 작업 승인
- 비용 발생 가능성이 있으면 비용 승인
- production DB migration / production R2 업로드 / 실데이터 반입이 이번 승인 범위가 아니라는 점 확인

### preview 배포 후 1차 smoke 체크리스트

현재 운영 handoff 에 남겨야 하는 기준은 "바로 확인된 결과"와 "아직 남은 한계"를 분리해서 적는 것입니다.

현재 공개 Web preview URL:

- `https://gw-web.werehere31.workers.dev`

이번에 확인된 공개 smoke 결과:

- `/`, `/login`, `/boards`, `/documents` → 200
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` → 모두 `/login` 으로 307 redirect

- 이번에 확인된 저장소 로컬 결과:

- `pnpm --filter @gw/web test api-same-origin-bridge.test.ts` → `/api/health` 200 JSON, `/api/me` 401 JSON, forged placeholder cookie 차단
- `pnpm check` → 통과
- `pnpm --filter @gw/web build` → 통과
- `pnpm --filter @gw/web build:cf` → 통과

운영 메모:

- admin 차단 근거 코드는 `apps/web/middleware.ts`, `apps/web/admin-preview-guard.ts`, `apps/web/admin-preview-guard.test.ts` 입니다.
- 현재 공개 preview URL 에 새 same-origin 브리지와 Phase 9 최신 코드를 다시 배포해 확인했는지는 별도 운영 실행 결과로 남겨야 합니다.
- 다만 저장소 로컬 기준으로는 same-origin `/api/health`, `/api/me`, `/admin*` guard, admin API 계약, `build:cf` blocker 가 모두 다시 정리된 상태입니다.
- Phase 10 기준으로 `/api/admin/audit-logs` 는 `createdFrom`, `createdTo` 시간 필터를 실제로 지원하므로, 운영 handoff 에서 시간 범위 조회 기준과 미확인 브라우저 smoke 여부를 분리해 적는 편이 맞습니다.
- placeholder 로그인 우회용 `x-dev-role` 흐름이 외부 공개 preview 기본 경로에 남아 있지 않은지 계속 확인합니다.
- manifest 와 앱 경로는 preview 전용 절대 도메인이 아니라 same-origin 상대 경로 기준을 유지합니다.
- `/offline` 이 "오프라인에서도 저장됨" 같은 가짜 성공 메시지를 만들지 않는지 확인합니다.
- `attendance`/`leave`/`approvals` 의 큰 CTA 가 실제 버튼인지, 아니면 아직 placeholder 인지 같이 기록합니다. 현재 코드는 placeholder 입니다.

필요하면 아래 경로를 추가 확인합니다.

화면 경로:

- `/dashboard`
- `/offline`
- `/boards/board_general`

API 경로:

- `/api/companies`
- `/api/roles`
- `/api/attendance/records`
- `/api/leave/requests`
- `/api/notices`
- `/api/boards`
- `/api/documents/spaces`

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
- `gw-hourly-status-report.py` 중심의 정각 보고 스크립트 수정은 GitHub release gate 에 포함하고, blocked/review-required/승인 필요 카드 누락이나 중복 보고가 없는지 함께 확인합니다.
- blocked/review-required/승인 필요 상태는 정각 현황 보고와 handoff 기록에서 놓치지 않도록 정보를 남겨야 합니다.

## 재배포/롤백 메모

재배포 전 기본 순서:

1. `set -a; . .secrets/cloudflare.env; set +a; bash scripts/gw-cloudflare-check.sh`
2. `pnpm --filter @gw/web build:cf`
3. `pnpm check`
4. `pnpm --filter @gw/web deploy:cf`
5. `pnpm exec wrangler deployments list --json --name gw-web`

롤백이 필요할 때:

1. `pnpm exec wrangler deployments list --json --name gw-web` 로 되돌릴 version id 확인
2. `pnpm exec wrangler rollback <version-id> --name gw-web -y`
3. 다시 smoke 를 돌려 `/`, `/login`, `/boards`, `/documents`, `/admin*`, `/manifest.webmanifest` 결과를 handoff 에 남김

주의:

- secret 값 자체는 출력하거나 문서에 붙이지 않습니다.
- 현재 URL handoff 문서에는 "로컬 `build:cf` blocker 는 해소됐지만, 공개 preview 재배포/재검증 여부는 실제 운영 실행 결과로 별도 남겨야 한다"는 메모를 같이 남겨야 합니다.

## 운영 handoff 체크리스트

다음 카드나 다음 담당자에게 넘기기 전에 아래를 확인합니다.

- `pnpm check` 통과
- `pnpm build` 통과
- `pnpm typecheck` 통과
- `pnpm test` 통과
- `pnpm --filter @gw/web build:cf` blocker 원인 확인 또는 해소
- `/api/health`, `/api/auth/login`, `/api/me` 기본 확인
- `COMPANY_ADMIN` 또는 `HR_ADMIN` 으로 조직 조회가 되는지 확인
- `EMPLOYEE` 로 직원/부서/역할/권한 조회 시 403 이 나오는지 확인
- `HR_ADMIN` 으로 다른 회사 `employeeId` 조회 시 403 이 나오는지 확인
- `HR_ADMIN`/`MANAGER` own 요청(`leave_request_demo`) self-approval 이 403 인지 확인
- `HR_ADMIN` 이 팀 대기 요청(`leave_request_team_pending`) 승인 시 200 인지 확인
- `GET /api/employees?roleCode=COMPANY_ADMIN` 를 `MANAGER` 로 확인했을 때 200 이더라도 관리자 role filter 는 무시되고, 응답 목록/summary/filterOptions 에 `COMPANY_ADMIN`·`HR_ADMIN` 이 섞이지 않는지 확인
- `GET /api/employees?employmentStatus=inactive`, `GET /api/employees?roleCode=NOT_A_ROLE` 가 각각 400 `VALIDATION_ERROR` 와 올바른 `error.details.field` 로 내려오는지 확인
- `POST /api/boards/board_notice/posts` 가 403 인지 확인
- `POST /api/documents/files/metadata` 에 `spaceId=document_space_missing` 를 넣었을 때 403 인지 확인
- `GET /api/posts/board_post_board_general_forged` 가 403 인지 확인
- `POST /api/read-receipts` 에 `targetType=post,targetId=board_post_board_general_forged` 를 넣었을 때 403 인지 확인
- `git diff --name-only -- db apps/web docs/workflow` 로 Phase 5 DB/Web/workflow 변경 유무 확인
- `foreign_request_id` 같은 임의 휴가 요청 id 승인 시 403 이 나오는지 확인
- placeholder 파일에 실제 비밀값이 없는지 확인
- 문서에 승인 필요 범위가 남아 있는지 확인

## 다음 Phase 운영 관점 메모

게시판/문서 1차를 이어서 볼 때 운영자는 아래를 특히 봅니다.

- 기존 테스트가 통과해도 notice-only 게시판 쓰기, 존재하지 않는 문서함 metadata 생성, forged 게시글 상세 조회, forged read receipt 생성이 실제로 막히는지
- `packages/shared` 와 `apps/api` 변경만 있는 상태인지, 아니면 `db/` 와 `apps/web/` 도 같이 갱신됐는지
- 게시판/문서 endpoint 가 실제 운영 게시글/파일 없이도 placeholder 검증 가능한지
- 게시판/댓글/문서함이 회사 scope 와 접근 경계를 유지하는지
- 첨부 metadata 응답에 storage key 같은 내부 값이 과도하게 노출되지 않는지
- 타 회사 게시글/문서 접근 금지 같은 guardrail 이 테스트와 문서에 남아 있는지
- 실데이터 반입, production migration, 실제 R2 업로드, 외부 문서보관/SaaS 연동이 승인 필요 항목으로 분리되어 있는지
- object key prefix 가 회사 경계를 먼저 두는지, raw storage key/bucket/public URL 이 응답에 노출되지 않는지
- mock/local-safe 검증과 binding-aware dry-run 검증이 분리되어 있는지
- `gw-hourly-status-report.py` 등 남은 감시/보고 스크립트 변경이 release gate 검토와 같이 묶여 있는지

Phase 6 모바일/PWA 를 이어서 볼 때는 아래도 같이 봅니다.

- `docs/architecture/phase-6-mobile-pwa-scope.md` 의 포함/제외/승인 필요 범위가 현재 승인 상태와 맞는지
- `docs/architecture/phase-7-api-same-origin-scope.md` 의 공개 origin / API 기본 경로 / override 원칙이 현재 handoff 와 맞는지
- `apps/web/public/manifest.webmanifest` 와 `apps/web/app/layout.tsx` 가 여전히 상대 경로 manifest 기준을 유지하는지
- `apps/web/app/page.tsx`, `apps/web/app/offline/page.tsx`, `apps/web/app/mobile-pwa-config.ts` 의 설치/오프라인 문구가 같은 기준을 쓰는지
- 모바일 화면 정리 작업이 실제 외부 배포, App Store/Play Store, Expo/React Native, production secret/DNS/유료 리소스 작업으로 번지지 않았는지
- offline 안내가 성공처럼 보이는 가짜 상태를 만들지 않는지
- mobile UX 변경 뒤에도 게시판/문서/전자결재 접근 경계와 기존 guardrail 이 그대로 유지되는지
- 현재 접근성 blocker 인 `<span aria-disabled>` CTA 가 release gate 에 남아 있는지, 해소 전에는 통과로 오해하지 않도록 기록했는지
- Phase 10 관리자 감사 로그 handoff 에 적힌 미확인 항목(공개 preview 재배포 여부, 브라우저 smoke 여부, 운영 승인 필요 항목)을 따로 분리해 적었는지

## 같이 보면 좋은 문서

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
- `docs/guides/phase-10-admin-audit-pass-2-handoff.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- `docs/architecture/cloudflare-preview-url-preparation.md`
