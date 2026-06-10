# Cloudflare-first 스켈레톤 개발 안내

이 문서는 다음 구현자가 바로 이어서 작업할 수 있게 현재 코드 구조와 Phase 3 근태/휴가 1차 remediation 이후 기준을 정리한 문서입니다.

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
특히 Phase 3 에서는 `db/migrations/0003_attendance_leave_phase3.sql`, `apps/web/app/attendance/page.tsx`, `apps/web/app/leave/page.tsx`, `apps/web/app/dashboard/page.tsx` 를 함께 봐야 문서와 코드가 맞습니다.

## Phase 2~3에서 확인된 핵심 골격

### `packages/shared`

공통 계약 패키지입니다.

추가된 내용:

- `appRoutes.auth.login`, `appRoutes.auth.logout`, `appRoutes.me`
- `appRoutes.org.companies`, `employees`, `departments`, `roles`, `permissions`
- `appRoutes.admin.invites`
- `appRoutes.attendance.checkIn`, `checkOut`, `records`, `corrections`
- `appRoutes.leave.types`, `balances`, `requests`, `approve(id)`, `reject(id)`
- 로그인/세션/회사/직원/조직 schema
- 근태 기록/정정 요청 schema
- 휴가 유형/잔여/신청/승인 schema
- 공통 에러 응답 wrapper와 `attendance.read`, `attendance.manage`, `leave.request`, `leave.approve` 권한 코드

### `apps/api`

Workers API입니다.

현재 들어 있는 것:

- `/api/health`
- placeholder 로그인/로그아웃
- placeholder `/api/me`
- 회사/직원/부서/역할/권한 조회 skeleton
- 출근/퇴근, 근태 기록 조회, 정정 요청 skeleton
- 휴가 유형/잔여/신청 조회, 승인/반려 skeleton
- 권한별 401/403 응답을 주는 기본 RBAC gate
- self-owned 휴가 승인 차단, 임의 request id 차단, 타 회사 `employeeId` 조회 차단
- 로그인/권한/근태/휴가에 대한 Vitest 계약 테스트

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

1차 설계 선택:

- 역할 매핑은 `memberships` 대신 `user_roles` 모델을 사용합니다.
- 세션 테이블은 `sessions` 대신 `auth_sessions` 이름을 사용합니다.
- 권한 카탈로그는 정적 contract/API skeleton 으로 두고, 별도 DB 테이블까지는 확장하지 않습니다.
- 근태/휴가는 production 데이터 계산이 아니라 status/request/review 추적 컬럼을 먼저 고정합니다.

### `apps/web`

현재 placeholder 화면:

- `app/login/page.tsx` — 로그인 skeleton
- `app/dashboard/page.tsx` — 내 정보/세션 상태 + 근태/휴가 진입점 placeholder
- `app/employees/page.tsx` — 직원 조회 placeholder
- `app/org/page.tsx` — 부서/역할/권한 placeholder
- `app/attendance/page.tsx` — 출퇴근/기록/정정 요청 placeholder
- `app/leave/page.tsx` — 휴가 유형/잔여/신청/승인 대기 placeholder
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
- 실제 비밀값, 실제 세션 토큰, 실제 초대 코드는 코드/문서/로그에 남기지 않습니다.
- 민감 endpoint 는 감사 로그 후보(action, actor, target)를 남길 수 있는 구조를 유지합니다.
- Web 메뉴를 숨겨도 서버 측 권한 검증이 다시 들어간다는 전제를 유지합니다.
- 휴가 승인 route 는 `leave.approve` 권한 + reviewable 대상 여부를 모두 확인해야 하며, self-owned request 는 승인하지 않습니다.
- `scripts/README.md` 에 적힌 그룹웨어 보고/감시 자동화 스크립트를 건드리면 기능 코드와 함께 release gate 검토 대상으로 묶습니다.

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

Phase 3 1차 remediation 이후 다음 구현자는 보통 아래 순서로 이어가면 됩니다.

- placeholder 응답을 실제 저장소 읽기/쓰기와 연결하되, `company_id` 범위를 깨지 않도록 유지
- 근태 정정 검토 흐름에 reviewer queue, 상태 전이, 감사 로그 저장을 실제화
- 휴가 승인 대상 목록을 self-owned 요청과 분리한 채로 실제 DB 조회에 연결
- leave balance snapshot 을 정책 엔진/차감 계산으로 확장하되 이번 placeholder 계약을 깨지 않게 유지
- Web 의 attendance/leave 화면을 실제 fetch/에러 처리/UI 상태로 치환

주의:

- 실제 근태/휴가 데이터 입력, 급여 계산 연동, production DB migration 실행은 별도 승인 전까지 하지 않는다.
- 본인 요청 권한과 승인자 권한을 분리하고, 상태 변경 endpoint 는 감사 로그 후보를 남길 수 있어야 한다.
- self-owned request 승인 차단과 임의 id 차단은 후속 실제 구현에서도 유지해야 한다.

## 같이 보면 좋은 문서

- `README.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
