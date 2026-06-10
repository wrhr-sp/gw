# Cloudflare-first 스켈레톤 개발 안내

이 문서는 다음 구현자가 바로 이어서 작업할 수 있게 현재 코드 구조와 Phase 3 근태/휴가 1차 remediation 이후 기준, 그리고 Phase 4 전자결재 1차 범위를 정리한 문서입니다.

## 현재 저장소 구조

```text
apps/
  web/        # Next.js App Router + OpenNext on Cloudflare + PWA 시작점
  api/        # Cloudflare Workers + Hono API 시작점
packages/
  shared/     # 공통 경로, 화면 섹션, auth/org 계약
db/
  migrations/ # D1 SQL migration skeleton
  docs/
  guides/
```

현재 기준으로 실제 코드가 들어 있는 핵심 경로는 `apps/web`, `apps/api`, `packages/shared`, `db/migrations` 입니다.
특히 전자결재 1차 작업에서는 `docs/architecture/phase-4-approvals-scope.md`, `apps/web/app/approvals/page.tsx`, `apps/api/src/app.ts`, `packages/shared/src/contracts.ts`, `db/migrations/0004_approvals_phase4.sql`, `apps/api/test/auth-org.spec.ts` 를 같이 봐야 문서와 코드가 맞습니다.

## Phase 2~4에서 확인된 핵심 골격

### `packages/shared`

공통 계약 패키지입니다.

추가된 내용:

- `appRoutes.auth.login`, `appRoutes.auth.logout`, `appRoutes.me`
- `appRoutes.org.companies`, `employees`, `departments`, `roles`, `permissions`
- `appRoutes.admin.invites`
- `appRoutes.attendance.checkIn`, `checkOut`, `records`, `corrections`
- `appRoutes.leave.types`, `balances`, `requests`, `approve(id)`, `reject(id)`
- `appRoutes.approvals.forms`, `lines`, `documents`, `detail(id)`, `inbox`, `approve(id)`, `reject(id)`, `referenceCandidates`, `agreementCandidates`
- 로그인/세션/회사/직원/조직 schema
- 근태 기록/정정 요청 schema
- 휴가 유형/잔여/신청/승인 schema
- 전자결재 양식/결재선/문서/단계/참조 후보 schema
- 공통 에러 응답 wrapper와 `attendance.read`, `attendance.manage`, `leave.request`, `leave.approve`, `approval.form.manage`, `approval.line.manage`, `approval.document.read`, `approval.document.write`, `approval.document.approve` 권한 코드

### `apps/api`

Workers API입니다.

현재 들어 있는 것:

- `/api/health`
- placeholder 로그인/로그아웃
- placeholder `/api/me`
- 회사/직원/부서/역할/권한 조회 skeleton
- 출근/퇴근, 근태 기록 조회, 정정 요청 skeleton
- 휴가 유형/잔여/신청 조회, 승인/반려 skeleton
- 결재 양식/결재선/기안/문서함/상세/승인·반려/참조·합의 후보 skeleton
- 권한별 401/403 응답을 주는 기본 RBAC gate
- self-owned 휴가 승인 차단, 임의 request id 차단, 타 회사 `employeeId` 조회 차단
- 전자결재에서 자기 문서 자기 승인 금지, 타 회사 문서 접근 금지, 승인함/참조함 접근 경계 guardrail
- 로그인/권한/근태/휴가/전자결재에 대한 Vitest 계약 테스트

주의:

- 실제 OAuth/SSO, 메일 발송, 운영 secret 연결은 하지 않습니다.
- 인증은 placeholder HttpOnly Cookie 세션 계약만 맞춥니다.
- 권한 부족과 인증 부족은 공통 에러 응답으로 반환합니다.
- 근태 조회는 `attendance.manage` 권한이 있어도 같은 회사 직원 범위만 허용합니다.
- 휴가 승인은 `leave.approve` 권한만 보는 것이 아니라 self-owned 요청인지, reviewable 목록에 있는 요청인지도 함께 검사합니다.

### `db/migrations`

현재 migration 구성:

- `0001_initial_schema.sql` — companies / users / employees
- `0002_auth_org_phase2.sql` — departments / roles / user_roles / invites / auth_sessions / audit_logs
- `0003_attendance_leave_phase3.sql` — attendance_records / attendance_correction_requests / leave_types / leave_requests / leave_balances
- `0004_approvals_phase4.sql` — approval_forms / approval_lines / approval_documents / approval_steps / approval_references

1차 설계 선택:

- 역할 매핑은 `memberships` 대신 `user_roles` 모델을 사용합니다.
- 세션 테이블은 `sessions` 대신 `auth_sessions` 이름을 사용합니다.
- 권한 카탈로그는 정적 contract/API skeleton 으로 두고, 별도 DB 테이블까지는 확장하지 않습니다.
- 근태/휴가는 production 데이터 계산이 아니라 status/request/review 추적 컬럼을 먼저 고정합니다.

### `apps/web`

현재 placeholder 화면:

- `app/login/page.tsx` — 로그인 skeleton
- `app/dashboard/page.tsx` — 세션 상태 + 근태/휴가/전자결재 진입점 placeholder
- `app/employees/page.tsx` — 직원 조회 placeholder
- `app/org/page.tsx` — 부서/역할/권한 placeholder
- `app/attendance/page.tsx` — 출퇴근/기록/정정 요청 placeholder
- `app/leave/page.tsx` — 휴가 유형/잔여/신청/승인 대기 placeholder
- `app/approvals/page.tsx` — 전자결재 진입점 placeholder
- `app/admin/page.tsx` — 관리자 초대/권한 placeholder

## 개발자가 바로 쓰는 명령

루트에서:

```bash
pnpm install
pnpm check
pnpm build
pnpm typecheck
pnpm test
```

현재 known gap:

- `pnpm check` 는 지금 `apps/api/src/app.ts:703` 의 `employee.employmentStatus !== "offboarded"` 비교 때문에 `TS2367` 로 실패합니다.
- `POST /api/approvals/documents` 는 새 기안 payload 를 반영해도 응답 id 를 `approval_document_demo` 로 고정해서, 바로 이어지는 detail 조회가 seed demo 문서를 돌려줍니다.
- `apps/api/test/auth-org.spec.ts` 의 approval create/detail 테스트는 seed demo 와 같은 제목/요약을 사용하고 id/referenceType 위주로만 확인해서 위 불일치를 놓칩니다.

개별 확인:

```bash
pnpm --filter @gw/shared test
pnpm --filter @gw/api test
pnpm --filter @gw/web build:cf
pnpm --filter @gw/api dev
```

## placeholder 인증 흐름 확인 예시

한 터미널에서:

```bash
pnpm --filter @gw/api dev
```

다른 터미널에서:

```bash
curl -i http://127.0.0.1:8787/api/auth/login \
  -H 'content-type: application/json' \
  -H 'x-dev-role: COMPANY_ADMIN' \
  --data '{"email":"admin@example.com","password":"placeholder-password"}'
```

이후 cookie 를 붙여서:

```bash
curl http://127.0.0.1:8787/api/me \
  -H 'cookie: gw_session=dev-placeholder-session_COMPANY_ADMIN'
```

또는 조직 조회:

```bash
curl http://127.0.0.1:8787/api/departments \
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

위 예시에서 기대하는 결과는 다음과 같습니다.

- `EMPLOYEE` 의 `/api/employees` 조회: 403
- 다른 회사 `employeeId` 조회: 403
- `foreign_request_id` 승인: 403
- `leave_request_demo` self approval: 403
- `leave_request_team_pending` approval: 200

## 구현할 때 지켜야 할 기준

- Web과 API가 같이 보는 계약은 먼저 `packages/shared` 에서 정리합니다.
- 회사 범위를 넘는 cross-company 조회는 placeholder 단계에서도 열지 않습니다.
- 실제 비밀값, 실제 세션 토큰, 실제 초대 코드, 실제 전자결재 문서 본문 전문은 코드/문서/로그에 남기지 않습니다.
- 민감 endpoint 는 감사 로그 후보(action, actor, target)를 남길 수 있는 구조를 유지합니다.
- Web 메뉴를 숨겨도 서버 측 권한 검증이 다시 들어간다는 전제를 유지합니다.
- 휴가 승인 route 는 `leave.approve` 권한 + reviewable 대상 여부를 모두 확인해야 하며, self-owned request 는 승인하지 않습니다.
- 전자결재 route 는 `approval.document.read/write/approve` 경계를 분리하고, 자기 문서 자기 승인과 타 회사 문서 접근을 막는 방향으로 설계합니다.
- approval create 응답 id 와 approval detail 조회 대상이 같은 문서를 가리키는지, create → detail round-trip 을 먼저 검증합니다.
- `apps/api/test/auth-org.spec.ts` 의 approval 테스트는 seed demo 와 겹치지 않는 제목/요약/양식을 써서 false positive 를 막습니다.
- `scripts/README.md` 에 적힌 그룹웨어 보고/감시 자동화 스크립트를 건드리면 기능 코드와 함께 release gate 검토 대상으로 묶습니다.
- 특히 `gw-report-delivery-watch.sh` 를 포함한 보고/감시 스크립트 수정은 중복 보고와 승인 필요 카드 누락 여부까지 같이 확인합니다.

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

## 다음 Phase에서 바로 이어질 범위

Phase 4 전자결재 1차는 이제 skeleton 자체보다 remediation 과 검증 보강이 우선입니다.

- `apps/api/src/app.ts` 의 approval create → detail round-trip 불일치를 먼저 수정
- `buildApprovalCandidates` 의 타입 비교 오류를 정리해 `pnpm check` 를 다시 통과시키기
- approval 계약 테스트에서 seed demo 와 겹치지 않는 입력으로 create/detail 불일치 재발을 막기
- `packages/shared` 와 `apps/web/app/approvals` 는 현재 계약을 유지하되, 실제 fetch/에러 처리 확장 전까지 placeholder 한계를 문서와 화면에 분명히 남기기
- `db/migrations/0004_approvals_phase4.sql` 를 기준으로 후속 실제 저장 로직이 필요한 컬럼/인덱스만 추가 검토
- `gw-report-delivery-watch.sh` 를 포함한 보고/감시 스크립트 변경이 있다면 release gate 문서와 함께 검토

주의:

- 실제 전자결재 문서 데이터 입력, 전자서명 연동, production DB migration 실행은 별도 승인 전까지 하지 않는다.
- 기안자/승인자/참조자 권한을 분리하고, 상태 변경 endpoint 는 감사 로그 후보를 남길 수 있어야 한다.
- 자기 문서 자기 승인 차단과 타 회사 문서 접근 차단은 후속 실제 구현에서도 유지해야 한다.

## 같이 보면 좋은 문서

- `README.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
