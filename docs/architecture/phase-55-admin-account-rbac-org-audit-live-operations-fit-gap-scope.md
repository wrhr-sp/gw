# Phase 55 관리자 계정·권한·조직 실사용화 fit-gap scope

## 왜 이 Phase를 하나

이번 Phase의 목적은 관리자/운영 화면이 있다는 사실을 넘어서, 대장이 live URL에서 `/admin/users`, `/employees`, `/org`, `/management`, `/admin/audit-logs` 를 직접 눌러
계정 preview 확인 → 조직/부서/지점 read model 확인 → 역할/권한 경계 확인 → 운영 허브 분리 확인 → 감사 로그 read-only 추적
순서를 실제 운영 언어로 따라갈 수 있게 만드는 것이다.

쉽게 말해:
- 관리자 계정 화면을 단순한 preview 모음으로 두지 않는다.
- 일반 직원 조회(`/employees`), 조직 구조 확인(`/org`), 운영 허브(`/management`), 감사 추적(`/admin/audit-logs`) 책임을 먼저 분리한다.
- admin role, permission.read, audit.read, company/branch scope 차이를 같은 언어로 다시 잠근다.
- 실제 초대 발송, 실비밀번호 변경, 외부 IdP/SSO, production 데이터 변경처럼 아직 안 되는 일은 숨기지 않고 분리한다.

## 이번 Phase에서 바로 맞출 범위

1. `/admin/users` 를 관리자 계정·권한 실사용 시작점으로 다시 정리한다.
2. `/employees` 일반 조회, `/org` 구조 확인, `/management` 운영 허브, `/admin/audit-logs` 감사 추적 책임을 먼저 읽히게 만든다.
3. 사용자 생성 preview, 역할/권한 diff, 활성/비활성, 비밀번호 reset preview 를 실제 저장 완료처럼 과장하지 않는다.
4. 역할별 landing 과 다음 레인을 고정한다.
   - `EMPLOYEE`: `/dashboard`
   - `HR_ADMIN`: `/dashboard` 뒤 `/admin/users`
   - `MANAGER`: `/dashboard` 뒤 `/work-items/branch`/`/employees`/`/org`
   - `COMPANY_ADMIN`: `/dashboard` 뒤 `/management`/`/admin/users`/`/admin/audit-logs`
   - `AUDITOR`: `/admin/audit-logs`
5. `permission.read`, `audit.read`, admin role guard, company scope, branch scope, empty/loading/error/forbidden/dev-safe 상태를 route/UI/API/test 같은 뜻으로 정리한다.
6. 감사 로그의 masked preview, `createdFrom`/`createdTo` 필터, company boundary, raw storage/raw secret 비노출 원칙을 운영 문장으로 잠근다.

## 현재 확인된 구현 근거

### Web
- `apps/web/app/admin/users/admin-users-page-content.tsx`
  - 사용자 생성/역할 diff/상태 변경/비밀번호 reset preview 흐름이 있다.
  - `/employees`, `/org`, `/management`, `/admin/audit-logs` 로 이어지는 온보딩/운영 레인 문장이 이미 있다.
  - 역할별 시작 레인과 차단 기준, `companySettingsModel`, `policyAxes`, `employeeVisibilityRules` 를 함께 보여 준다.
- `apps/web/app/employees/page.tsx`
  - 직원 일반 조회를 `/admin/users` 와 분리된 read-only 레인으로 설명한다.
- `apps/web/app/org/page.tsx`
  - 부서/역할/권한/지점 scope 를 read-only 구조 확인 레인으로 설명한다.
- `apps/web/app/management/page.tsx`
  - `/admin/users`, `/work-items/branch`, `/admin/audit-logs` 를 일반 홈과 분리한 운영 허브로 정리한다.
- `apps/web/app/admin/audit-logs/page.tsx`
  - 감사 로그 read-only, masked metadata, `storageRef` 요약, company boundary 설명이 이미 있다.

### Shared contract
- `packages/shared/src/contracts.ts`
  - `appRoutes.org.companies`
  - `appRoutes.org.employees`
  - `appRoutes.org.departments`
  - `appRoutes.org.roles`
  - `appRoutes.org.permissions`
  - `appRoutes.org.branches`
  - `appRoutes.admin.users`
  - `appRoutes.admin.auditLogs`
  - 역할/권한/지점 scope 관련 schema 가 이미 있다.

### API
- `apps/api/src/app.ts`
  - `employee.read`, `department.read`, `role.read`, `permission.read`, `audit.read` 권한 기준이 있다.
  - `/api/employees`, `/api/departments`, `/api/roles`, `/api/permissions`, `/api/branches` 경로가 있다.
  - `/api/admin/users` 는 admin role + `permission.read` 확인 뒤 관리자 사용자 목록과 audit candidate 를 반환한다.
  - `/api/admin/audit-logs` 는 `audit.read` 확인 뒤 필터, detail preview, operational trail 을 반환한다.
  - 감사 응답은 raw storage key/bucket/signed URL 전문 대신 masked preview/요약 중심으로 유지한다.

### 테스트
- `apps/api/test/auth-org.spec.ts`
  - branch scope 요약(`hq_admin`, `branch_manager`) 검증 근거가 있다.
  - 직원 조회 filter(`departmentId`, `employmentStatus`, `roleCode`) 검증 근거가 있다.
  - `/api/admin/users` admin-only 허용과 non-admin 차단 근거가 있다.
  - `/api/admin/audit-logs` `audit.read` 허용/차단, `createdFrom`/`createdTo` 필터 검증 근거가 있다.

### 과거 기준 문서
- `docs/architecture/phase-46-account-permission-organization-onboarding-rehearsal-fit-gap-scope.md`
- `docs/guides/phase-46-account-permission-organization-onboarding-rehearsal-handoff.md`
- `docs/architecture/phase-54-documents-files-live-operations-fit-gap-scope.md`
- `docs/guides/phase-54-documents-files-live-operations-handoff.md`

## 이번 Phase에서 맞출 핵심 문장

### 1) 관리자 계정 happy path
- `/login` → `/dashboard` → `/admin/users`
- 사용자 생성 preview 확인
- 역할/권한 diff 확인
- 활성/비활성 또는 비밀번호 reset preview 확인
- `/employees`, `/org` 로 이어서 조직 read model 과 권한 노출 경계 확인

### 2) 운영/조직 happy path
- `/dashboard` → `/management`
- 운영 허브에서 `/admin/users`, `/work-items/branch`, `/admin/audit-logs` 책임 분리 확인
- `/org` 에서 부서/역할/권한/지점 구조를 read-only 로 확인
- `/employees` 에서 일반 직원 조회와 관리자 운영 검토가 다른 책임임을 확인

### 3) 감사/차단 path
- `AUDITOR` 는 `/admin/audit-logs` read-only 레인만 기본 허용
- `MANAGER` 는 `/employees` 를 볼 수 있어도 `/admin/users` 는 차단
- `HR_ADMIN` 는 `/admin/users` 는 볼 수 있어도 `audit.read` 없으면 `/admin/audit-logs` 차단
- branch scope 와 company scope 를 같은 full access 처럼 설명하지 않음
- empty/loading/error/forbidden/dev-safe 는 실제 운영자가 이해할 수 있는 상태로 분리

## 이번 Phase에서 숨기지 말아야 할 gap

- 실제 초대 발송, 실메일/실메신저, 외부 IdP/SSO/SAML/SCIM 연동은 아직 아니다.
- 실제 비밀번호 변경 완료나 영구 권한 저장 완료를 이번 성공 기준처럼 적지 않는다.
- production DB 실데이터 변경, secret, DNS/custom domain, 유료 리소스, migration, destructive 작업은 별도 승인 게이트다.
- 감사 로그 read-only/masked preview 와 실제 보안관제/SIEM 연동 완료를 같은 말처럼 적지 않는다.

## 이번 Phase 산출물

이번 Phase에서 planner 기준으로 먼저 잠그는 산출물은 아래다.

1. 이 scope 문서
2. 쉬운 handoff 문서
3. 루트 문서(`ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`)의 현재 Phase 기준 갱신

## 다음 역할봇에 넘길 포인트

### builder
- `/admin/users`, `/employees`, `/org`, `/management`, `/admin/audit-logs` 문장을 실사용 운영 언어 기준으로 더 짧고 명확하게 맞춘다.
- 관리자 preview 와 일반 조회 lane, 감사 read-only lane, branch/company scope 차이를 UI copy 에서 더 분명히 만든다.

### reviewer
- admin role guard, `permission.read`, `audit.read`, branch/company scope, masked preview, 비노출 원칙 문장이 코드와 맞는지 본다.

### tester
- focused web/API 테스트, build, smoke 기준으로 관리자 계정 happy path 와 차단 path 가 실제로 유지되는지 다시 확인한다.

### docs
- live URL 기준 사용자/UAT/운영 체크리스트를 쉬운 한국어로 정리한다.

### ops
- PR/CI/merge/배포 확인, live smoke, route 확인, 남은 승인 게이트를 관리자 계정·권한·조직 전용 결과 형식으로 묶는다.
