# DATA_MODEL

## 문서 목적

이 문서는 현재 저장소 기준으로 어떤 데이터 엔티티가 이미 migration/shared contract/API skeleton 에 반영돼 있는지 빠르게 보여 주는 루트 기준 문서다.

중요:
- 이 문서는 production 실데이터 스키마 확정 문서가 아니다.
- 현재 단계는 Cloudflare D1 우선 skeleton + placeholder 응답 검증 단계다.
- 실제 개인정보 원문, secret, production 데이터, 외부 HR 연동 정보는 저장소 문서에 넣지 않는다.

## 공통 원칙

- DB 구조의 1차 근거는 `db/migrations/*.sql` 이다.
- API payload 와 화면 계약의 1차 근거는 `packages/shared/src/contracts.ts` 이다.
- placeholder 응답 예시와 권한/회사 경계는 `apps/api/src/app.ts` 와 `apps/api/test/auth-org.spec.ts` 로 다시 확인한다.
- Phase 상세 guardrail 은 `docs/architecture/phase-2-auth-org-scope.md` 부터 `docs/architecture/phase-11-org-employees-scope.md` 까지의 범위 문서를 함께 본다.

## 상태 라벨 읽는 법

- skeleton migration 있음: D1 migration 에 기본 테이블이 있다.
- shared contract 있음: `packages/shared` 에 응답/요청 schema 가 있다.
- placeholder 응답 있음: `apps/api/src/app.ts` 에 dev-safe 예시 데이터가 있다.
- guardrail test 있음: `apps/api/test/auth-org.spec.ts` 또는 관련 테스트에서 권한/회사 경계/validation 을 확인한다.
- 운영 연결 미실시: production DB, 실데이터 migration, 외부 연동, 실제 개인정보 처리 같은 운영 연결은 아직 범위 밖이다.

## 엔티티군 한눈에 보기

| 엔티티군 | 대표 엔티티 | 민감도 | 현재 상태 | 주요 근거 |
| --- | --- | --- | --- | --- |
| 인증/조직 | `companies`, `users`, `employees`, `departments`, `roles`, `user_roles`, `invites`, `auth_sessions` | 높음 | skeleton migration + shared contract + placeholder 응답 + guardrail test | `db/migrations/0001_initial_schema.sql`, `db/migrations/0002_auth_org_phase2.sql`, `packages/shared/src/contracts.ts`, `docs/architecture/phase-2-auth-org-scope.md`, `docs/architecture/phase-11-org-employees-scope.md` |
| 관리자 정책/감사 | `audit_logs` + 정책 candidate payload | 높음 | audit log skeleton migration + admin candidate contract + masked placeholder 응답 + guardrail test | `db/migrations/0002_auth_org_phase2.sql`, `packages/shared/src/contracts.ts`, `docs/architecture/phase-9-admin-audit-scope.md`, `docs/architecture/phase-10-admin-audit-pass-2-scope.md` |
| 근태/휴가 | `attendance_records`, `attendance_correction_requests`, `leave_types`, `leave_requests`, `leave_balances` | 높음 | skeleton migration + shared contract + placeholder 응답 + guardrail test | `db/migrations/0003_attendance_leave_phase3.sql`, `packages/shared/src/contracts.ts`, `docs/architecture/phase-3-attendance-leave-scope.md` |
| 전자결재 | `approval_forms`, `approval_lines`, `approval_documents`, `approval_steps`, `approval_references` | 높음 | skeleton migration + shared contract + placeholder 응답 + self-approval/cross-scope guardrail test | `db/migrations/0004_approvals_phase4.sql`, `packages/shared/src/contracts.ts`, `docs/architecture/phase-4-approvals-scope.md` |
| 게시판/문서 | `notice_boards`, `board_posts`, `board_comments`, `document_spaces`, `document_files`, `read_receipts` | 중간~높음 | skeleton migration + shared contract + placeholder 응답 + private/public 경계 test | `db/migrations/0005_boards_documents_phase5.sql`, `packages/shared/src/contracts.ts`, `docs/architecture/phase-5-boards-documents-scope.md`, `docs/architecture/phase-8-r2-storage-scope.md` |
| 플랫폼/공통 계약 | same-origin route, PWA/manifest, 문서 업로드 contract | 중간 | shared contract + web/api bridge + build/test 기준 있음 | `packages/shared/src/contracts.ts`, `docs/architecture/phase-6-mobile-pwa-scope.md`, `docs/architecture/phase-7-api-same-origin-scope.md` |
| Phase 24 제안 모델 | 모바일 `홈` 커스터마이징, `지점/호텔 코드`, 직원-지점 배정, 지점 업무/보고 템플릿 | 중간~높음 | 문서 초안만 있음, migration/shared contract/API 미구현 | `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`, `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md`, `SPEC.md` |

## 1. 인증/조직 엔티티

### 1-1. 회사 `companies` / company

무엇을 나타내나:
- 그룹웨어의 회사 경계다.
- 대부분의 엔티티는 `company_id` 또는 `companyId` 로 회사 scope 를 가진다.

핵심 필드:
- migration: `id`, `name`, `created_at`, `updated_at`
- shared contract: `id`, `code`, `name`, `status`

관계:
- `users`, `employees`, `departments`, `roles`, `invites`, `auth_sessions`, `audit_logs` 와 1:N 관계다.

민감도/주의:
- 다른 회사 범위 데이터를 섞으면 안 된다.
- 운영 변경 API 는 `ensureCompanyBoundary` 로 cross-company 차단 기준을 유지한다.

현재 상태:
- skeleton migration 있음
- shared contract 있음 (`companySchema`, `listCompaniesResponseSchema`)
- placeholder 응답 있음
- guardrail test는 주로 다른 회사 범위 차단 시나리오에서 간접 확인

근거:
- `db/migrations/0001_initial_schema.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `docs/architecture/phase-2-auth-org-scope.md`

### 1-2. 사용자 `users` / 세션 사용자 payload

무엇을 나타내나:
- 로그인 주체 계정이다.
- employee 와 연결돼 권한/역할을 행사한다.

핵심 필드:
- migration: `id`, `company_id`, `email`, `password_hash`, `deleted_at`
- shared contract 세션 사용자: `id`, `companyId`, `employeeId`, `email`, `fullName`, `roleCodes`, `permissions`

관계:
- 회사에 속한다.
- `user_roles`, `auth_sessions`, `audit_logs` 와 연결된다.
- `employees.user_id` 를 통해 직원과 연결될 수 있다.

민감도/주의:
- `email`, `password_hash`, session token 은 민감 정보다.
- 문서에는 실제 계정/비밀번호/토큰 원문을 넣지 않는다.

현재 상태:
- skeleton migration 있음
- shared session contract 있음 (`sessionUserSchema`, `authLoginResponseSchema`, `meResponseSchema`)
- placeholder 로그인/세션 응답 있음
- 실제 인증 제공자 연결은 범위 밖

근거:
- `db/migrations/0001_initial_schema.sql`
- `db/migrations/0002_auth_org_phase2.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`

### 1-3. 직원 `employees`

무엇을 나타내나:
- 일반 업무 화면 `/employees` 와 관리자 후보 화면 `/admin/users` 가 함께 참조하는 사람 기본정보다.

핵심 필드:
- migration: `id`, `company_id`, `user_id`, `employee_number`, `full_name`, `employment_status`
- shared contract: `id`, `companyId`, `departmentId`, `email`, `fullName`, `employmentStatus`
- 일반 조회 요약: `departmentName`, `roleSummary`, `statusLabel`, `statusTone`, `primaryNote`

관계:
- 회사와 부서에 속한다.
- `user_roles`, `attendance_records`, `leave_requests`, `approval_documents`, `board_posts`, `document_files` 등 다수 엔티티와 연결된다.

민감도/주의:
- 이메일/인사상태는 개인정보 성격이 있다.
- `/employees` 는 일반 조회 중심이고, 운영 사용자 연결/권한 diff 편집 책임은 `/admin/users` 로 넘긴다.

현재 상태:
- skeleton migration 있음
- shared contract 있음 (`employeeSchema`, `listEmployeesResponseSchema`)
- placeholder 응답 있음
- guardrail test 있음: 일반 조회에서 admin-only 역할 요약 비노출, invalid filter 는 400 `VALIDATION_ERROR`

근거:
- `db/migrations/0001_initial_schema.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-11-org-employees-scope.md`

### 1-3-b. Phase 24 제안 모델: `지점/호텔` + 직원 지점 배정

무엇을 나타내나:
- 호텔 위탁경영사 도메인 기준으로 회사 하위 운영 단위를 `지점/호텔` 로 다루기 위한 문서 초안이다.
- 일반 근무자에게는 자기 지점 업무만 보이고, 본사/지점 관리자에게는 역할에 맞는 지점 범위를 보여 주기 위한 제안 모델이다.

초안 필드:
- 지점/호텔 master: `branch_id`, `branch_code`, `branch_name` 또는 `hotel_name`, `company_id`, `status`
- 직원-지점 배정: `employee_id`, `branch_id`, `role_in_branch`, `primary`, `starts_at`, `ends_at`
- 지점 업무/보고 템플릿: `task_type`, `report_type`, `branch_visibility`, `requires_manager_review`

관계:
- `companies` 1:N `branches`
- `employees` N:M `branches` 가능성을 열되, 파일럿 1차 문서에서는 `primary` 지점 1개가 먼저 읽히게 둔다.
- 향후 지점 업무/보고 템플릿은 근태/결재/게시판/문서와 연결될 수 있지만, 현재는 문서 초안 단계다.

민감도/주의:
- 현재 migration/shared contract/API 는 아직 없다.
- 이 문단은 실운영 branch master, 실제 직원 배정, PMS 연동이 이미 붙었다는 뜻이 아니다.
- 지점 미배정 사용자는 `지점 배정 필요` 안내를 먼저 보고, 다른 지점 데이터는 UI/API 모두 차단해야 한다는 제품 방향만 고정한다.

현재 상태:
- 문서 초안만 있음
- migration 없음
- shared contract 없음
- placeholder API 없음
- guardrail test 없음

근거:
- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`
- `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md`
- `SPEC.md`

### 1-4. 부서/역할/권한 `departments`, `roles`, `user_roles`, permission catalog

무엇을 나타내나:
- `/org` 와 권한 카탈로그, 관리자 후보 흐름의 기본 구조다.

핵심 필드:
- `departments`: `company_id`, `parent_department_id`, `code`, `name`, `status`
- `roles`: `company_id`, `code`, `name`, `scope`, `status`
- `user_roles`: `user_id`, `employee_id`, `role_id`, `assigned_by`, `status`
- shared contract role payload: `code`, `name`, `scope`, `permissions`
- permission code 예시: `employee.read`, `leave.approve`, `approval.document.approve`, `document.file.write`

관계:
- 부서는 상하위 관계를 가진다.
- 역할은 권한 코드 묶음을 가진다.
- `user_roles` 는 사용자/직원/역할 연결 테이블이다.

민감도/주의:
- 역할/권한 저장은 일반 업무 화면이 아니라 관리자 성격에 가깝다.
- `/employees` 일반 조회에서는 admin-only 역할 노출을 제한한다.

현재 상태:
- skeleton migration 있음
- shared contract 있음 (`departmentSchema`, `roleSchema`, `permissionSchema`)
- placeholder 응답 있음
- guardrail test 있음: 비관리자에게 `/api/admin/users` 차단, 일반 직원 목록에서 관리자 역할 비가시화

근거:
- `db/migrations/0002_auth_org_phase2.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-11-org-employees-scope.md`

### 1-5. 초대/세션 `invites`, `auth_sessions`

무엇을 나타내나:
- 관리자 초대와 로그인 세션 골격이다.

핵심 필드:
- `invites`: `email`, `role_id`, `department_id`, `invite_token_hash`, `status`, `expires_at`, `created_by`
- `auth_sessions`: `user_id`, `session_token_hash`, `status`, `last_seen_at`, `expires_at`, `revoked_at`

관계:
- 회사/사용자/역할/부서와 연결된다.

민감도/주의:
- token hash 와 session token 은 문서에 원문 예시를 두지 않는다.
- 현재 저장소는 placeholder auth 흐름 검증이 목적이다.

현재 상태:
- skeleton migration 있음
- invite/shared contract 있음 (`createInviteRequestSchema`, `createInviteResponseSchema`)
- placeholder 로그인/로그아웃/`/api/me` 흐름 있음
- guardrail test 있음: 권한 부족 초대 차단, 무인증 `AUTH_REQUIRED`

근거:
- `db/migrations/0002_auth_org_phase2.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`

## 2. 관리자 정책/감사 엔티티

### 2-1. 감사 로그 `audit_logs`

무엇을 나타내나:
- 관리자 변경 후보, 정책 검토, 운영 예외 추적의 시작점이다.

핵심 필드:
- migration: `company_id`, `actor_user_id`, `actor_employee_id`, `action`, `target_type`, `target_id`, `metadata_json`, `created_at`
- shared contract: masked metadata, `companyBoundary.enforced`, `storageStatus`, filter options, detail preview

관계:
- 사용자/직원/회사에 연결된다.
- admin 정책 변경 후보와 함께 읽힌다.

민감도/주의:
- 원문 개인정보/민감 payload 대신 masked preview 를 유지한다.
- 감사 열람도 권한 기반으로 차단한다.

현재 상태:
- skeleton migration 있음
- shared contract 있음 (`adminAuditLogListResponseSchema` 등)
- placeholder 응답 있음
- guardrail test 있음: 감사 조회 권한 필요, createdFrom/createdTo filter 검증

근거:
- `db/migrations/0002_auth_org_phase2.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`

### 2-2. 관리자 접근 skeleton payload

무엇을 나타내나:
- 관리자 UI 와 API 가 같은 뜻으로 접근 여부를 설명하기 위한 1차 관리자 접근 모델이다.
- 실제 운영 role assignment 저장 테이블 확정이 아니라, 현재 skeleton/placeholder 단계에서 쓰는 계약 기준이다.

핵심 필드:
- role code: `SUPER_ADMIN`, `COMPANY_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`, `AUDITOR`
- permission code 예시: `invite.manage`, `audit.read`, `board.manage`, `document.space.manage`
- shared contract: `adminScope`, `employeeLinkStatus`, `highRiskPermissions`, `statusChangePreview`, `roleChangePreview`

관계:
- `sessionUser.roleCodes`, `sessionUser.permissions`, `/api/admin/*` guard, `/admin/*` route guard, dashboard/admin shortcut 과 같이 읽힌다.
- 감사 로그 접근은 단순 admin role 이름이 아니라 `audit.read` capability 와 연결된다.

민감도/주의:
- 이번 단계는 production 권한 저장 구조 확정이 아니다.
- 실제 권한 부여/회수 실행, production DB migration, 실데이터 role assignment 변경은 범위 밖이다.
- Web/API/nav 가 서로 다른 접근 행렬을 만들지 않게 같은 기준으로 해석해야 한다.

현재 상태:
- dedicated D1 테이블 추가 없이 shared contract + placeholder 응답 + guardrail test 기준으로 유지
- `adminUserSummarySchema`, `adminScopeSchema`, `adminUsersListResponseSchema` 존재
- API 는 `/api/admin/users`, `/api/admin/policies` 에 admin role 기준, `/api/admin/audit-logs` 에 `audit.read` 기준을 사용 중
- 다음 단계 구현 포인트는 이 차이를 문서화하고 Web/nav/test 와 같은 뜻으로 맞추는 것

근거:
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/app/dashboard/dashboard-config.ts`
- `docs/architecture/admin-role-permission-model-pass-1-scope.md`

### 2-3. 관리자 정책 candidate payload

무엇을 나타내나:
- 문서/게시판/근태/휴가/결재 정책을 운영 전에 검토하는 placeholder payload 다.

핵심 필드:
- `category`, `companyId`, `summary`, `lastReviewedAt`, `reasonRequired`, `diffPreview`
- 문서 정책 수정 요청: `companyId`, `visibility`, `retentionDays`, `maxFileSizeBytes`
- 게시판 정책 수정 요청: `companyId`, `visibility`, `isNoticeOnly`, `moderationMode`

관계:
- 실 테이블보다 운영 정책 review payload 의 성격이 강하다.
- 감사 로그 후보와 함께 관리자 문맥에서 사용된다.

민감도/주의:
- raw storage key, 내부 운영 세부값을 그대로 노출하지 않는다.
- 다른 회사 정책 변경은 금지한다.

현재 상태:
- dedicated D1 테이블은 아직 고정하지 않음
- shared contract 있음
- placeholder candidate 응답 있음
- guardrail test 있음: cross-company 차단, masked summary 유지

근거:
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-9-admin-audit-scope.md`

## 3. 근태/휴가 엔티티

### 3-1. 근태 기록 `attendance_records`

무엇을 나타내나:
- 출근/퇴근과 일자별 근태 상태의 기본 단위다.

핵심 필드:
- migration: `employee_id`, `status`, `work_date`, `check_in_at`, `check_out_at`, `source`, `note`
- shared contract: `companyId`, `employeeId`, `status`, `workDate`, `checkInAt`, `checkOutAt`, `source`, `note`, `placeholder`

관계:
- 직원과 회사에 속한다.
- 정정 요청의 대상이 된다.

민감도/주의:
- 출퇴근 시각은 인사/근태 민감 정보다.
- offline/placeholder 단계에서도 실제 저장 완료처럼 보이면 안 된다.

현재 상태:
- skeleton migration 있음
- shared contract 있음 (`attendanceRecordSchema`, `attendanceActionResponseSchema`, `attendanceListRecordsResponseSchema`)
- placeholder check-in/check-out 응답 있음
- guardrail test 있음: 본인 조회/관리자 조회 구분, 알 수 없는 직원 id 차단

근거:
- `db/migrations/0003_attendance_leave_phase3.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-3-attendance-leave-scope.md`

### 3-2. 근태 정정 요청 `attendance_correction_requests`

무엇을 나타내나:
- 잘못된 출퇴근 기록에 대한 정정 요청 골격이다.

핵심 필드:
- migration: `attendance_record_id`, `status`, `requested_by`, `reviewed_by`, `reviewed_at`, `reason`, `requested_check_in_at`, `requested_check_out_at`
- shared request contract: `attendanceRecordId`, `reason`, `requestedCheckInAt`, `requestedCheckOutAt`, `note`

관계:
- 특정 근태 기록과 직원에 종속된다.

민감도/주의:
- 승인자/검토자는 본인 요청을 임의 승인하는 흐름이 되지 않게 해야 한다.
- 현재는 placeholder 검토 흐름이며 실제 정책 집행 완성 단계는 아니다.

현재 상태:
- skeleton migration 있음
- shared request/response contract 있음
- placeholder 요청 응답 있음
- guardrail test 있음

근거:
- `db/migrations/0003_attendance_leave_phase3.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`

### 3-3. 휴가 유형/요청/잔여 `leave_types`, `leave_requests`, `leave_balances`

무엇을 나타내나:
- 휴가 신청과 승인, 잔여 일수 조회의 기본 단위다.

핵심 필드:
- `leave_types`: `code`, `name`, `unit`, `status`
- `leave_requests`: `employee_id`, `leave_type_id`, `status`, `approval_status`, `start_date`, `end_date`, `days`, `requested_by`, `reviewed_by`, `reason`
- `leave_balances`: `employee_id`, `leave_type_id`, `as_of_date`, `opening_days`, `used_days`, `reserved_days`, `remaining_days`
- shared contract 예시: `placeholder: true`, `approvalStatus`, `remainingDays`

관계:
- 직원, 회사, 휴가유형에 연결된다.
- 향후 결재/승인 흐름과 맞물릴 수 있다.

민감도/주의:
- 휴가 사유와 잔여일수는 인사 민감 데이터다.
- 비승인자가 승인/반려하면 안 되고, 존재하지 않는 요청 id 도 성공처럼 보이면 안 된다.

현재 상태:
- skeleton migration 있음
- shared contract 있음 (`leaveTypeSchema`, `leaveBalanceSchema`, `leaveRequestSchema`)
- placeholder 응답 있음
- guardrail test 있음: 비승인자 차단, unknown id 차단, 하위 직원 요청 승인 시나리오

근거:
- `db/migrations/0003_attendance_leave_phase3.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-3-attendance-leave-scope.md`

## 4. 전자결재 엔티티

### 4-1. 양식/결재선 `approval_forms`, `approval_lines`

무엇을 나타내나:
- 문서를 어떤 양식으로 기안하고 어떤 승인 흐름을 탈지 정의하는 골격이다.

핵심 필드:
- `approval_forms`: `code`, `title`, `category`, `field_summary`, `status`
- `approval_lines`: `title`, `description`, `status`
- shared contract 예시: `placeholder: true`, `requiredPermissions`, `recommendedUseCase`

관계:
- 결재 문서와 결재 단계가 이 두 엔티티를 참조한다.

민감도/주의:
- 일반 직원이 임의로 운영용 양식/결재선을 관리하는 범위는 아니다.
- 현재는 placeholder 정의 검증 단계다.

현재 상태:
- skeleton migration 있음
- shared contract 있음
- placeholder 응답 있음
- guardrail test 있음: 비관리자/비매니저의 생성 차단

근거:
- `db/migrations/0004_approvals_phase4.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-4-approvals-scope.md`

### 4-2. 결재 문서/단계/참조 `approval_documents`, `approval_steps`, `approval_references`

무엇을 나타내나:
- 실제 기안 문서, 승인 단계, 참조/합의 후보를 나타낸다.

핵심 필드:
- `approval_documents`: `form_id`, `line_id`, `drafter_employee_id`, `title`, `summary`, `document_number`, `status`, `submitted_at`, `completed_at`
- `approval_steps`: `document_id`, `step_order`, `approver_employee_id`, `step_type`, `decision_status`, `decision_comment`
- `approval_references`: `document_id`, `employee_id`, `reference_type`, `read_at`, `status`

관계:
- 문서는 양식/결재선/직원과 연결된다.
- 단계와 참조가 문서에 종속된다.

민감도/주의:
- 자기 문서를 자기 자신이 승인하면 안 된다.
- 같은 회사 안의 후보만 참조/합의 대상으로 다뤄야 한다.
- 존재하지 않는 문서 id 는 404/차단 성격으로 다뤄야 하며 성공처럼 보이면 안 된다.

현재 상태:
- skeleton migration 있음
- shared contract 있음 (`approvalDocumentSchema`, `approvalInboxResponseSchema`, action schemas)
- placeholder 문서/승인함/후보 응답 있음
- guardrail test 있음: self-approval 차단, same-company 후보 유지, unknown id 차단

근거:
- `db/migrations/0004_approvals_phase4.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-4-approvals-scope.md`

## 5. 게시판/문서 엔티티

### 5-1. 게시판/게시글/댓글 `notice_boards`, `board_posts`, `board_comments`

무엇을 나타내나:
- 공지형 게시판과 일반 게시판, 게시글, 댓글의 기본 구조다.

핵심 필드:
- `notice_boards`: `board_type`, `name`, `slug`, `visibility`, `is_notice_only`, `status`
- `board_posts`: `board_id`, `author_employee_id`, `title`, `body_preview`, `is_notice`, `published_at`, `pinned_until`, `status`
- `board_comments`: `post_id`, `author_employee_id`, `parent_comment_id`, `body`, `status`

관계:
- 게시판 1:N 게시글
- 게시글 1:N 댓글
- 게시글/댓글은 직원에 연결된다.

민감도/주의:
- notice-only 게시판에 일반 직원이 글쓰기하면 안 된다.
- forged post id/read receipt 대상 id 를 prefix 만 맞는다고 허용하면 안 된다.

현재 상태:
- skeleton migration 있음
- shared contract 있음 (`boardSchema`, `boardPostSchema`, comment/read receipt schemas)
- placeholder 응답 있음
- guardrail test 있음: accessible board 범위, notice-only 쓰기 차단, forged id 차단

근거:
- `db/migrations/0005_boards_documents_phase5.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-5-boards-documents-scope.md`

### 5-2. 문서공간/문서파일 `document_spaces`, `document_files`

무엇을 나타내나:
- 문서 공간 metadata 와 파일 metadata/r2 연동 후보를 분리해 다루는 구조다.

핵심 필드:
- `document_spaces`: `name`, `slug`, `visibility`, `owner_employee_id`, `is_public_within_company`, `status`
- `document_files`: `space_id`, `owner_employee_id`, `file_name`, `content_type`, `file_size`, `storage_key`, `version_label`, `is_public_within_company`, `status`
- shared upload-init request: `spaceId`, `fileName`, `contentType`, `fileSize`
- shared upload-complete request: `uploadToken`, `checksumSha256?`

관계:
- 문서공간 1:N 문서파일
- 회사/직원과 연결된다.
- upload/download/delete 는 metadata 와 storage adapter 를 분리한다.

민감도/주의:
- private 문서공간 접근 차단이 필수다.
- raw storage key, bucket 내부 정보, secret binding 값을 응답/문서에 그대로 노출하지 않는다.
- 허용 mime type 과 최대 파일 크기 제한을 유지한다.

현재 상태:
- skeleton migration 있음
- shared contract 있음 (`documentSpaceSchema`, `documentFileSchema`, upload/download/delete schemas)
- placeholder 응답 있음
- R2 binding 이 없어도 mock adapter fallback 검증 있음
- guardrail test 있음: private space 차단, 존재하지 않는 space 차단, allowlist/size 제한, raw storage internals 비노출

근거:
- `db/migrations/0005_boards_documents_phase5.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/document-storage.spec.ts`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`

### 5-3. 읽음 확인 `read_receipts`

무엇을 나타내나:
- 게시글/공지 등 대상에 대한 읽음 기록이다.

핵심 필드:
- migration: `target_type`, `target_id`, `employee_id`, `read_at`
- shared request: `targetType`, `targetId`

관계:
- 대상 엔티티와 직원에 연결된다.

민감도/주의:
- 접근 가능한 대상인지 먼저 확인해야 한다.
- forged target id 는 허용하면 안 된다.

현재 상태:
- skeleton migration 있음
- shared contract 있음
- placeholder 응답 있음
- guardrail test 있음

근거:
- `db/migrations/0005_boards_documents_phase5.sql`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`

## 6. 아직 확정하지 않은 것

아래는 현재 저장소 기준으로 아직 운영 확정 문장으로 쓰면 안 된다.

- production D1 실데이터 스키마/마이그레이션 절차
- 실제 SSO/OAuth/외부 인증 제공자 연결
- 실제 개인정보 상세 편집/저장 흐름
- 외부 HR/급여/노무 연동 구조
- 유료 리소스 생성·증액, DNS/custom domain, production bucket 운영 규칙

## 7. 같이 봐야 하는 문서

- `API.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `ARCHITECTURE.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- `docs/architecture/phase-11-org-employees-scope.md`
