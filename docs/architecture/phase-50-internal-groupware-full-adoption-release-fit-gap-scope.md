# Phase 50 내부 그룹웨어 본격 도입 릴리즈 fit-gap 범위

## 1. 한 줄 요약
이번 Phase 50의 목표는
Phase 45~49에서 잠가 둔 내부 도입, 온보딩, 운영 안정성, 감사 기준선과 최종 UAT 회귀 결과를 바탕으로,
대장이 live URL에서 직접 로그인하고 핵심 업무를 끝까지 눌러 볼 수 있는
"내부 그룹웨어 본격 도입 릴리즈 패키지"를 완성하는 것이다.

쉽게 말하면 이번 단계는
새 외부 연동을 여는 단계가 아니라,
이미 존재하는 로그인·일반 업무·운영 업무·지점 업무·감사 흐름을
실도입 직전 언어로 다시 잠그고
1) 지금 바로 내부 도입 가능한 것
2) 아직 preview/read-only/dev-safe 로 honest 하게 남겨야 하는 것
3) 별도 승인 없이는 절대 열면 안 되는 것
을 최종 릴리즈 기준으로 나누는 단계다.

## 2. 왜 지금 이 Phase가 필요한가
Phase 45에서는 외부연동 전 내부 도입 최종검증 기준을 잠갔고,
Phase 46에서는 계정·권한·조직 온보딩 리허설,
Phase 47에서는 운영 안정성·모바일/PWA 사용성,
Phase 48에서는 감사·보안·백업/복구 기준선,
Phase 49에서는 파일럿 피드백 반영·최종 UAT 회귀를 다시 묶었다.

하지만 본격 도입 릴리즈 직전에는 아래 gap 이 아직 남아 있다.

1. "핵심 route 가 있다"와 "대장이 live URL에서 실제 업무를 직접 눌러볼 수 있다"는 같은 뜻이 아니다.
2. 일반 직원 레인, 운영 관리자 레인, 지점관리자 레인, 감사 레인이 존재해도 최종 릴리즈 보고 언어로 한 번에 잠겨 있지 않으면 사용자 직접 확인이 어렵다.
3. Production-ready (실구현)/Production-ready (실구현)/dev-safe/read-only 문구가 남아 있는 영역은 무엇을 이번 릴리즈에서 실제로 닫아야 하고, 무엇을 honest 하게 제한으로 남겨야 하는지 우선순위가 더 또렷해야 한다.
4. `admin / 1234` 테스트 계정, live URL, 추천 route, 승인 게이트, 운영 체크리스트, 사용자 안내 문구가 최종 도입 패키지 형식으로 다시 정리돼야 한다.
5. 외부 기관 연동, production 실데이터, 민감정보 확대 같은 restricted 범위를 내부 도입 완료 문장과 섞지 않도록 마지막 범위 통제가 필요하다.

즉 이번 Phase는
"최종 UAT 기준은 있다"에서 한 걸음 더 나아가
"내부 회사 도입 릴리즈로 직접 안내할 수 있는 상태인가"를 잠그는 단계다.

## 3. 이번 Phase에서 잠가야 할 제품 문장
- 익명 시작점은 계속 `/login` 뿐이다.
- COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 로그인 직후 공통 landing 은 `/dashboard` 다.
- AUDITOR 의 로그인 직후 landing 은 `/admin/audit-logs` 다.
- PC/모바일 홈은 모두 대시보드=`/dashboard` 기준으로 읽고, 고정 바로가기 + 사용자 커스텀 바로가기 방향을 유지한다.
- 일반 직원 기본업무 레인과 `경영업무`(`/management`) 민감 운영 레인은 계속 분리한다.
- 경영업무/급여/인사/노무/세무/법무/컴플라이언스는 지정 관리자/담당자만 접근한다.
- 메뉴 숨김만으로 끝내지 않고 route guard, API guard, company+branch scope, audit log 근거를 같이 유지한다.
- `/employees`, `/org` 는 읽기 중심 조회 레인이고 `/admin/users`, `/admin/policies` 운영 변경 preview 와 같은 층위가 아니다.
- `/admin/audit-logs` 는 계속 `audit.read` 기반 read-only 감사 레인이다.
- `admin / 1234` 는 dev/test/UAT 전용 테스트 계정이며 production 기본 계정이 아니다.
- Production-ready (실구현)/Production-ready (실구현) 를 최종 산출물처럼 포장하지 않는다. 닫지 못한 영역은 honest 하게 제한과 승인 게이트로 남긴다.

## 4. 현재 바로 재사용할 근거

### 4-1. live / release 근거
- parent 최종 통합 보고 기준 live URL: `https://gw-web.wereheresp.workers.dev`
- parent release gate: success
- parent merge commit: `1f299108b47edc219fa1ac3ea6ce5fd9c8b82114`
- 익명 protected route redirect 와 `/login`·`/api/health` smoke 는 parent 완료 기록에 존재한다.

### 4-2. 주요 route
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/me`
- `/employees`
- `/org`
- `/management`
- `/work-items/branch`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/api/health`

### 4-3. 현재 구현 근거 파일
- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/documents/page.tsx`
- `apps/web/app/me/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/org/page.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/work-items/branch/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/api/src/app.ts`
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/contracts.ts`

### 4-4. 현재 테스트/검증 근거
- parent 기준 focused API `99 passed / 4 skipped`
- parent 기준 focused web `104 passed`
- `pnpm check` 통과
- `pnpm --filter @gw/web build:cf` 통과
- 익명 `/dashboard`·`/management`·`/work-items/branch`·`/admin/users`·`/admin/policies`·`/admin/audit-logs` → `/login` 보호 smoke 근거 존재

중요:
- 위 근거는 현재까지 확인된 baseline 이다.
- 이번 Phase 50에서는 "기존 기준 재인용"만으로 끝내지 않고, 대장이 직접 따라갈 기능 흐름과 릴리즈 문장을 더 짧고 명확하게 잠가야 한다.
- live 직접 확인 근거와 local build/test/release gate 대체 근거는 같은 뜻으로 합치지 않는다.

## 5. 이번 Phase에서 직접 닫아야 할 범위

### 5-1. 대장이 직접 따라갈 릴리즈 확인 순서를 잠근다
- 직원 레인: `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`
- 운영 관리자 레인: `/dashboard` → `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health`
- 지점관리자 레인: `/dashboard` → `/work-items/branch` → 필요 시 `/employees`·`/org` → `/management`
- 감사 레인: `/admin/audit-logs` → 필요 시 `/employees`·`/org` → `/api/health`
- 경영업무/민감 모듈 확인 레인: `/management` 안에서 급여·세무·노무·법무·컴플라이언스 카드/진입 설명이 직원 기본 홈과 섞이지 않는지 다시 잠근다.

### 5-2. Production-ready (실구현)/Production-ready (실구현) 잔여를 최종 릴리즈 언어로 분류한다
- 실제 내부 도입 가능한 흐름은 happy path 로 끝까지 이어져야 한다.
- 아직 실처리나 외부 연동이 없는 화면은 preview/dev-safe/read-only/approval-needed 로 honest 하게 적는다.
- 사용자 직접 확인 대상에 남길 수 없는 Production-ready (실구현) 잔여는 builder 단계에서 줄이거나, 줄이지 못하면 release blocker 로 승격한다.

### 5-3. 계정/권한/가드/감사를 최종 릴리즈 기준으로 다시 묶는다
- 로그인/로그아웃/session 유지/권한별 landing 을 직접 따라갈 수 있게 정리한다.
- 계정 생성/권한 지정/활성·비활성/비밀번호 초기화 흐름은 dev-safe preview 와 production 계정 운영을 구분해 적는다.
- menu 숨김뿐 아니라 route guard, API guard, company+branch scope, audit log 근거가 같이 남아야 한다.

### 5-4. 기능별 기록 포인트를 최종 보고 형식으로 잠근다
- happy path
- forbidden
- empty
- error
- loading
- mobile/PC

위 6가지를 기능별로 적되,
최종 분류 언어는 `blocker / major / minor / copy-doc / approval-needed` 로 다시 묶는다.

### 5-5. 도입 체크리스트와 사용자 안내를 같은 패키지로 묶는다
- live URL
- 테스트 계정 `admin / 1234`
- 역할별 추천 route 순서
- 직접 눌러볼 핵심 기능과 확인 포인트
- 운영 문서(`RUNBOOK.md`, `DEPLOYMENT.md`) 확인 순서
- 남은 승인 게이트

## 6. 우선순위

### P0. 이번 Phase에서 반드시 닫아야 하는 것
1. 익명은 `/login` 만 허용하고 내부 route/API 는 계속 보호되는지
2. 대장이 live URL에서 로그인 후 주요 업무 흐름을 직접 따라갈 수 있는지
3. 일반 직원 레인과 `경영업무`/감사/지점 운영 레인이 서로 섞이지 않는지
4. `admin / 1234` 계정이 테스트 전용으로만 읽히는지
5. Production-ready (실구현)/Production-ready (실구현) 잔여가 최종 릴리즈 산출물처럼 포장되지 않는지

### P1. 이번 릴리즈 패키지에서 함께 닫아야 하는 것
1. 기능별 happy/forbidden/empty/error/loading/mobile/PC 기록 포인트
2. live 직접 확인 근거 vs local build/test/release gate 대체 근거 분리
3. 운영 문서, rollback/checklist, 사용자 안내 문장 통일

### P2. 다음 후속 단계로 넘겨도 되는 것
1. 외부 IdP/SSO/SAML/SCIM
2. production DB 실데이터/seed/migration
3. 실제 급여 지급/은행 이체/기관 신고
4. 주민번호/계좌번호 등 민감정보 확대
5. 외부 세무/노무/법무/보험/기관 연동
6. DNS/custom domain, 유료 리소스, secret 교체

## 7. 현재 구현 기준 fit-gap

### 지금 이미 되는 것
- 로그인 필수 진입과 post-login landing 기준
- `/dashboard` 중심 일반 직원 레인
- `/management` 중심 운영 허브 분리
- `/work-items/branch` branch scope 업무 레인
- `/admin/users`, `/admin/policies` 운영 검토 preview 레인
- `/admin/audit-logs` read-only / masked preview / company boundary 기준
- route/API guard 와 company/branch/self/foreign 차단 근거

### 이번 Phase에서 더 닫아야 하는 것
- 대장이 직접 눌러볼 최종 릴리즈 순서를 더 짧게 고정해야 한다.
- 실사용 가능한 흐름과 아직 honest 하게 제한해야 할 흐름을 release 언어로 다시 나눠야 한다.
- 경영업무/급여/인사/노무/세무/법무/컴플라이언스 레인을 직원 기본업무와 절대 섞지 않게 더 또렷하게 적어야 한다.
- 사용자 안내, 운영 체크리스트, 최종 보고 문장을 같은 패키지로 다시 잠가야 한다.

## 8. 이번 Phase에서 일부러 하지 않는 것
- 실제 급여 지급
- 은행 이체
- 주민번호/계좌번호 입력 확대
- production DB 실데이터 전환/seed/migration
- 외부 IdP/SSO/SAML/SCIM 연동
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- 법령 API 인증키/기관 계정 등록과 자동 최신화
- DNS/custom domain
- 유료 리소스 생성 또는 증설
- secret 입력/교체
- destructive/force 작업

## 9. 테스트 시나리오

### A. 직원 기본업무 릴리즈 확인
- `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`
- 로그인/로그아웃/session 유지와 일반 업무 흐름이 실제로 이어지는지 확인

### B. 계정/권한/운영 허브 확인
- `/dashboard` → `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health`
- 계정 운영 preview, 권한, 감사 read-only, 최소 liveness 를 분리해 확인

### C. 지점/조직/인사 확인
- `/dashboard` → `/work-items/branch` → `/employees` → `/org` → `/management`
- branch scope 와 company scope, 읽기 조회와 운영 변경 preview 차이를 확인

### D. 민감 모듈 운영 검토 확인
- `/management` 에서 급여·세무·노무·법무·컴플라이언스 진입 카드/설명 확인
- 지정 관리자/담당자만 접근해야 하고, 실제 외부 처리/실민감 처리 완료처럼 보이지 않는지 확인

## 10. 역할별 후속 작업 기준
- builder: 릴리즈 blocker 급 Production-ready (실구현), 경영업무/일반업무 혼동, 권한·가드·route/API 경계, 핵심 happy path 잔여를 우선 수정
- reviewer: Production-ready (실구현) 잔여, 권한 누출, 로그인 우회, 민감정보 노출, 승인 게이트 위반, 과장 문구를 검토
- tester: 대장이 직접 따라갈 route 와 happy/forbidden/empty/error/loading/mobile/PC, build/typecheck/smoke 를 재검증
- docs: 본격 도입 체크리스트, 사용자 안내, 관리자 안내, 최종 보고 문장을 쉬운 말로 묶기
- ops: live URL, release gate, smoke, rollback, direct verification note 를 최종 결과 보고 형식으로 정리