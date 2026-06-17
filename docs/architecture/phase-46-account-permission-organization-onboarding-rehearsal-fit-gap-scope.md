# Phase 46 계정·권한·조직 온보딩 리허설 fit-gap 범위

## 한 줄 요약
이번 Phase 46의 목표는
이미 분리해 둔 로그인, 일반 직원 업무, 경영업무, 인사/조직 조회, 관리자 계정관리를
"회사 내부 사용자를 실제로 어떻게 태우고 내리고 권한을 붙일지" 기준으로 다시 묶어
외부 연동 없이도 내부 도입 직전 온보딩 리허설을 끝낼 수 있는 운영 기준선을 만드는 것이다.

쉽게 말하면 이번 단계는
새 업무 모듈을 더 여는 것이 아니라,
운영자가 `사용자 생성 → 역할/권한 지정 → 조직/지점 배정 확인 → 로그인 후 첫 화면 확인 → 비활성/비밀번호 초기화`를
어디서 어떤 순서로 검토해야 하는지와,
무엇이 아직 dev-safe preview 이고 무엇이 실제 내부 도입 기준인지 같은 말로 잠그는 단계다.

## 왜 지금 이 단계가 필요한가
Phase 45까지 오면서 아래는 이미 많이 닫혔다.

- `/login` 단독 익명 진입과 내부 route 비노출 기준
- `/dashboard` 직원 기본 홈과 `/management` 민감 운영 허브 분리
- `/employees`·`/org` 읽기 중심 조직/직원 조회
- `/admin/users` dev-safe 계정관리 preview 와 `/admin/audit-logs` read-only 감사 진입
- `tax`·`labor`·`legal`·`branch` 의 branch/company/self/restricted 경계
- 운영 문서, 권한표, 도입 체크리스트, release/rollback 기준

하지만 내부 도입 직전 기준으로는 마지막 gap 이 남아 있다.

1. 사용자 온보딩/오프보딩 절차가 여러 화면과 문서에 흩어져 있다.
2. `/employees` 일반 조회와 `/admin/users` 운영 변경 검토가 여전히 섞여 읽힐 여지가 있다.
- 3. 로그인 직후 공통 landing 과 역할별 다음 레인이 어떻게 이어지는지, 어떤 route/API 가 열리거나 막혀야 하는지가 최종 UAT 문장으로 잠기지 않았다.
4. 현재 계정 생성/역할 변경/상태 변경/비밀번호 초기화는 dev-safe preview 중심인데, 이 사실을 숨기면 실제 저장까지 끝난 것처럼 오해될 수 있다.
5. 회사/지점/부서/권한 배정과 감사 후보 기록을 하나의 운영 리허설 흐름으로 묶어야 다음 구현·리뷰·테스트·문서화가 같은 기준을 쓸 수 있다.

즉 이번 Phase는
"내부 사용자를 안전하게 태우고, 역할별 첫 화면과 권한 경계를 검증하고, 아직 승인 필요한 실제 저장/외부 연동은 분리한다"를
운영자 화면과 UAT 절차 기준으로 마무리하는 단계다.

## Phase 46에서 잠가야 할 제품 문장
- 익명 시작점은 계속 `/login` 뿐이다.
- 로그인 뒤 일반 직원 기본 홈은 계속 `/dashboard` 다.
- COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 로그인 직후 공통 landing 은 `/dashboard` 다.
- HR/계정관리는 공통 홈(`/dashboard`) 뒤 admin host 에서 `/admin/users` 로 이어지는 다음 레인이다.
- 운영 관리자/지점 관리는 공통 홈(`/dashboard`) 뒤 general host 에서 `/management` 로 이어지는 다음 레인이다.
- 감사 전용 시작점은 `/admin/audit-logs` read-only 문맥이다.
- `/employees` 와 `/org` 는 읽기 중심 조회이며 계정 저장/권한 저장 화면이 아니다.
- `/admin/users` 는 사용자 생성, 역할/권한 diff, 활성/비활성, 비밀번호 초기화 preview 를 운영 검토용으로 보여 주는 화면이다.
- 메뉴 숨김만이 아니라 route guard, API guard, company+branch scope, high-risk permission, audit candidate 가 함께 맞아야 한다.
- dev/test/UAT 기본 계정은 `admin / 1234` 를 유지하되 production 기본 계정처럼 설명하지 않는다.

## 현재 바로 재사용할 근거

### 1. 운영자/사용자 온보딩 관련 route
- `/login`
- `/dashboard`
- `/employees`
- `/org`
- `/management`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/work-items/branch`

### 2. 현재 구현 근거 파일
- `apps/web/app/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/users/admin-users-page-content.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/org/page.tsx`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/api/src/app.ts`
- `apps/api/src/lib/operational-org.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/web/work-items.test.tsx`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`

### 3. 직전 Phase 45 기준 최신 운영 근거
- live URL: `https://gw-web.wereheresp.workers.dev`
- main release-gate success, merge commit `fd5239e2e36848e711d918d45994382bf4616b39`
- focused API: `pnpm --filter @gw/api test -- auth-org.spec.ts work-items.spec.ts` → 15 files passed, 98 tests passed, 4 skipped
- focused web: `pnpm --filter @gw/web test -- admin-preview-guard.test.ts work-items.test.tsx dashboard-boundary.test.tsx payroll.test.tsx` → 24 files passed, 100 tests passed
- `pnpm --filter @gw/mobile typecheck` 통과
- `pnpm --filter @gw/web build` 통과
- local preview smoke: 익명 `/`, `/dashboard`, `/management`, `/payroll`, `/payroll/me`, `/work-items/labor`, `/admin/audit-logs`, `/uat` 는 `/login` redirect, `/login` 200, `/api/health` 200, `/manifest.webmanifest` 200

## 이번 Phase에서 직접 닫아야 할 범위

### 1. 계정 온보딩 UAT 순서를 잠근다
- 운영자가 따라갈 기본 순서를 `/login` → `/dashboard` → 역할별 다음 레인(`/admin/users` 또는 `/management` 또는 `/admin/audit-logs`) → 관련 읽기/운영 화면 기준으로 다시 잠근다.
- 사용자 생성 preview 뒤 어떤 일반 업무 route 를 바로 눌러 봐야 하는지 고정한다.
- 역할 변경 preview 뒤 어떤 운영 route 가 열리거나 막혀야 하는지 고정한다.
- 상태 변경/비밀번호 초기화 뒤 로그인/로그아웃/landing 재확인 순서를 고정한다.

### 2. 역할별 시작점과 차단 기준을 잠근다
- EMPLOYEE 는 로그인 직후 `/dashboard` 에서 일반 업무 레인만 기본 노출한다.
- HR_ADMIN 은 로그인 직후 `/dashboard` 를 거친 뒤 admin host 에서 `/admin/users` 계열을 먼저 확인한다.
- MANAGER/COMPANY_ADMIN 은 로그인 직후 `/dashboard` 를 거친 뒤 general host 에서 `/management` 와 `/work-items/branch` 중심 운영 레인을 본다.
- AUDITOR 는 `/admin/audit-logs` 중심 read-only 추적 레인만 우선 본다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토를 같은 책임으로 적지 않는다.

### 3. 조직/지점/부서 배정 문장을 잠근다
- `/org` 는 부서/역할/지점 구조를 읽는 화면으로 유지한다.
- `/employees` 는 소속/역할/상태를 조회하는 읽기 흐름으로 유지한다.
- 지점 운영 확인은 `/management` 아래 `/work-items/branch` 로 연결한다.
- 회사/지점/부서 배정이 실제 저장 완료가 아니라 현재 read model + preview 근거라는 점을 숨기지 않는다.

### 4. dev-safe와 approval gate 경계를 잠근다
- `/admin/users` 의 생성/권한 변경/상태 변경/비밀번호 초기화는 현재 실제 쓰기 완료가 아니라 preview 중심이라는 점을 문서/화면/테스트에 같이 남긴다.
- 실제 초대 메일 발송, 실제 임시 비밀번호 전달, 외부 IdP/SSO, production 계정 배포는 이번 완료 범위와 분리한다.
- 감사 후보(`audit candidate`)는 저장된 감사 원문과 같은 뜻이 아니라 검토 포인트라는 점을 분리한다.

## 현재 구현 기준 fit-gap

### 지금 이미 되는 것
- 로그인 전 내부 route 비노출과 로그인 후 role boundary 유지
- `/admin/users` 에서 사용자 생성/역할 diff/상태 변경/비밀번호 초기화 dev-safe preview 흐름 제공
- `/employees`·`/org`·`/branches`·`/roles`·`/permissions` 읽기 경로와 기본 API/contract 존재
- HR_ADMIN 이 `/management` 가 아니라 `/admin/users` 흐름을 먼저 타도록 안내하는 문구와 테스트 근거 존재
- high-risk permission, role diff, 상태 diff, 회사 설정 모델, approval gate 후보를 한 화면에서 묶어 읽는 현재 read model 존재

### 아직 이번 Phase에서 더 닫아야 할 것
- 공통 post-login landing(`/dashboard`) 과 역할별 다음 레인(`/admin/users`, `/management`, `/admin/audit-logs`) 연결이 운영 절차로 더 또렷해야 한다.
- 조직/지점/부서 배정 확인과 `/work-items/branch` 운영 흐름이 하나의 온보딩 리허설 언어로 더 잘 이어져야 한다.
- EMPLOYEE/MANAGER/HR_ADMIN/AUDITOR/COMPANY_ADMIN 별 허용/차단 route 와 API 가 최종 UAT 기준으로 더 직접 따라가기 쉬워야 한다.
- 비활성/오프보딩 이후 차단 범위와 복구/재활성 시나리오가 현재보다 더 분명히 남아야 한다.
- 비밀번호 초기화 preview 에서 실제 비밀값 노출 금지, URL/banner 잔존 금지, production 정책 비혼동 기준을 더 강하게 고정해야 한다.

## 이번 Phase에서 일부러 하지 않는 것
- 실제 사용자 초대 메일/문자 발송
- 외부 IdP/SSO/SAML/SCIM 연동
- production 기본 계정 배포 또는 실사용 비밀번호 배포
- 주민번호/계좌번호 등 민감 원문 계정정보 확대
- production DB 실데이터 변환/seed/migration
- 은행/회계/노무/세무/법무 외부 계정 연동
- DNS/custom domain
- 유료 리소스 생성 또는 증설
- secret 입력/교체
- destructive/force 작업

## 테스트 시나리오

### A. 운영자 온보딩 happy path
- `/login` → `/dashboard` → admin host `/admin/users`
- 사용자 생성 preview → 일반 업무 route(`/boards` 또는 `/documents` 또는 `/attendance`) 확인
- 역할/권한 diff preview → general host `/management`, admin host `/admin/users`, admin host `/admin/audit-logs` 허용/차단 기준 확인
- 상태 변경 preview → 비활성 뒤 차단 범위 확인
- 비밀번호 초기화 preview → 값 노출/잔존 금지 확인

### B. 조직/지점/부서 확인
- `/employees` 에서 읽기 중심 직원 조회 확인
- `/org` 에서 부서/역할/지점 구조 확인
- `/management` → `/work-items/branch` 에서 branch scope 운영 흐름 확인
- 일반 조회와 운영 검토가 서로 다른 책임으로 읽히는지 확인

### C. 권한/보안 경계
- 익명 `/admin/users`, `/management`, `/admin/audit-logs` 는 `/login` redirect 또는 차단
- EMPLOYEE 는 `/management`, `/admin/users`, `/admin/audit-logs` 를 기본 진입처럼 볼 수 없어야 한다.
- HR_ADMIN 은 로그인 직후 `/dashboard` landing 뒤 admin host `/admin/users` 계열 허용, `/management` 기본 진입 아님 기준을 유지한다.
- AUDITOR 는 read-only 감사 흐름만 우선 허용하고 운영 변경 레인과 섞지 않는다.
- route guard, API guard, company+branch scope, high-risk permission 후보가 서로 다른 말을 하지 않는다.

## 역할별 후속 작업 기준
- builder: 계정 온보딩 happy path, 역할별 landing, 상태 변경 뒤 차단 UX, 조직/지점 연결 copy/guard, dev-safe 잔여 문제를 수정
- reviewer: 권한 누출, HR/운영/감사 레인 혼동, 비밀번호/민감정보 노출, approval gate 위반, 과장 문구를 검토
- tester: 계정 생성/권한 변경/상태 변경/비밀번호 초기화 preview, 조직/지점/부서 조회, role별 허용/차단, build/typecheck/smoke 를 재검증
- docs: 운영자 가이드, 사용자/관리자 UAT 순서, approval gate, 남은 실저장/외부연동 제외 범위를 문서화
- ops: PR/CI/main/release gate/live URL 기준에서 새 온보딩 리허설 흐름이 배포 기준과 충돌하지 않는지 정리
