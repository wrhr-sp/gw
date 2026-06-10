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
- `gw-report-delivery-watch.sh` 를 포함한 감시/보고 스크립트 변경을 GitHub release gate 검토 범위에 포함

현재 저장소 기준으로 기본 테스트와 타입체크는 통과합니다.

- `pnpm check` 통과
- 전자결재는 여전히 placeholder 단계이며, 실제 법적 효력/외부 전자서명/실운영 데이터 저장은 이번 범위가 아닙니다.
- 이번 문서화 카드에서는 Phase 5 게시판/문서 guardrail 검증 결과를 우선 반영합니다.

이번 Phase 에서 하지 않는 일 예시는 아래와 같습니다.

- 법적 효력이 필요한 전자서명/본인인증 연동
- production 결재 데이터 입력 및 production DB migration 실행
- 외부 문서보관 SaaS, 공개 배포, 유료 리소스, 실제 비밀값 입력

## Phase 5 게시판/문서 1차 현재 상태

기준 문서는 `docs/architecture/phase-5-boards-documents-scope.md` 이며, 현재 작업물은 "일부 구현 + 미검증 guardrail 정리" 상태입니다.

현재 저장소에 실제로 들어 있는 항목은 아래와 같습니다.

- `packages/shared/src/contracts.ts` 에 board/document route, schema, 타입, 권한 코드 추가
- `apps/api/src/app.ts` 에 공지, 게시판, 게시글, 댓글, 문서함, 첨부 metadata, 읽음 확인 placeholder endpoint 추가
- `apps/api/test/auth-org.spec.ts` 와 `packages/shared/test/contracts.spec.ts` 에 기본 계약 테스트 추가
- Phase 5 범위/운영 문서 초안 추가

아직 빠진 항목도 분명합니다.

- `db/migrations` 에는 아직 Phase 5 전용 migration (`0005_*`) 이 없습니다.
- `apps/web/app/boards`, `apps/web/app/posts`, `apps/web/app/documents` 화면은 아직 없습니다.
- `docs/workflow/` 아래에는 Phase 5 전용 workflow 변경이 아직 없습니다.

추가로, 기존 테스트 스위트는 통과하지만 임시 repro 검증에서는 아래 guardrail 누락이 다시 확인됐습니다.

- 공지형 게시판 `board_notice` 에도 `EMPLOYEE` 가 게시글을 작성할 수 있어서 `POST /api/boards/board_notice/posts` 가 403 대신 201 을 반환함
- 존재하지 않는 문서함 `document_space_missing` 으로도 `POST /api/documents/files/metadata` 가 403 대신 201 을 반환함
- 접근 불가/존재하지 않는 게시글 id(`foreign_post_123`)로도 `POST /api/read-receipts` 가 403 대신 201 을 반환함

즉, 현재 Phase 5 는 "API/shared 계약은 생겼지만, DB/Web skeleton 과 접근 경계 보강은 아직 남아 있는 상태"로 보는 것이 맞습니다.

이번 Phase 문서에서 특히 고정한 제외/승인 필요 범위는 아래와 같습니다.

- 실제 R2 버킷 생성, 실제 운영 파일 업로드, production 게시글/문서 데이터 입력은 하지 않음
- production DB migration, 외부 공개 배포, DNS/R2/도메인 작업, 실제 비밀값 입력은 별도 승인 필요
- `gw-report-delivery-watch.sh` 를 포함한 감시/보고 스크립트 수정은 계속 GitHub release gate 검토 범위에 포함

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
- 게시판/문서 1차는 기존 테스트 외에 notice-only 게시판 쓰기, 존재하지 않는 문서함 metadata 생성, 임의 read receipt 생성이 막히는지도 별도로 확인해야 합니다.

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
- Phase 1 범위: `docs/architecture/cloudflare-first-phase-scope.md`
- Phase 2 범위: `docs/architecture/phase-2-auth-org-scope.md`
- Phase 3 범위: `docs/architecture/phase-3-attendance-leave-scope.md`
- Phase 4 범위: `docs/architecture/phase-4-approvals-scope.md`
- Phase 5 범위: `docs/architecture/phase-5-boards-documents-scope.md`
- 플랫폼 계획: `docs/architecture/next-cloudflare-platform-plan.md`
