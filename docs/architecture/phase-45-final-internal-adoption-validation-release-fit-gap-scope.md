# Phase 45 외부연동 전 내부 도입 최종검증·릴리즈 fit-gap 범위

## 한 줄 요약
이번 Phase 45의 목표는
이미 Phase 36~44에서 닫아 온 직원 기본업무, 경영업무, 권한 경계, 운영문서, 로그인/PWA 기준을
마지막으로 한 번 더 같은 언어로 묶어
"외부 연동 없이 회사 내부 그룹웨어로 본격 도입 가능" 판정을 내릴 최종 기준선을 만드는 것입니다.

쉽게 말하면 이번 단계는
새 큰 기능을 더 여는 것이 아니라,
지금 있는 화면·가드·테스트·문서·배포 근거를 기준으로
"지금 바로 내부 도입 가능한 것 / 아직 승인 필요한 것 / 외부 연동 카드로 넘길 것"을 최종 잠금하는 단계입니다.

## 왜 지금 이 단계가 필요한가
Phase 36~44를 거치면서 아래는 이미 많이 닫혔습니다.

- `/dashboard` 중심 직원 기본업무 레인
- `/management` 중심 내부관리 레인
- `/payroll`·`/payroll/me`·`/work-items/tax|labor|legal`·`/admin/audit-logs` 책임 분리
- `/login` 단독 익명 진입, 로그인 전 내부 route 비노출, PWA 설치 확인 기준
- 운영자 runbook, 직원/관리자 가이드, 권한표, 도입 체크리스트
- focused API/web 재검증, mobile typecheck, web build, local preview smoke, release gate 성공 근거

하지만 아직 마지막 gap 이 남아 있습니다.

1. 내부 도입 완료 판단 문장이 여러 Phase 문서에 흩어져 있다.
2. UAT/권한/보안/배포/롤백/운영 확인 순서가 최종 보고 관점으로 한 번에 모여 있지 않다.
3. live URL, route 순서, 테스트 계정, 승인 게이트를 "대장이 직접 눌러보는 최종 확인 패키지"로 잠그는 문서가 필요하다.
4. Phase 45 이후 외부 연동/실데이터/기관 연계는 별도 체인으로 넘겨야 하는데, 그 경계가 흐려지면 내부 도입 완료와 외부 운영 준비가 섞이게 된다.

즉 이번 Phase는
"이미 있는 것을 정말 내부 도입 완료 수준으로 볼 수 있는가"를 검증하는 마지막 fit-gap 단계입니다.

## Phase 45 내부 도입 완료 판정 기준
- 대시보드=`/dashboard` 는 직원 기본 홈으로 유지한다.
- PC/모바일 홈은 고정 바로가기 + 사용자 커스텀 바로가기 방향을 유지한다.
- 일반 직원 레인과 `경영업무`(`/management`) 민감 운영 레인은 계속 분리한다.
- 경영업무(인사/급여/근태관리/세무/노무/법무/지점/컴플라이언스)는 지정된 관리자/담당자만 접근한다.
- 메뉴 숨김만이 아니라 route guard, API guard, company+branch/self/restricted/read-only scope, audit log 근거까지 같이 확인한다.
- `admin / 1234` 는 dev/test/UAT 전용 계정으로만 적고 production 기본 계정처럼 적지 않는다.
- 최종 보고에는 live URL, 추천 route 순서, 테스트 계정, 역할별 시나리오, release/rollback 확인 포인트, 남은 승인 게이트를 포함해야 한다.

## 지금 바로 재사용할 근거

### 1. 직원 기본업무 레인
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/notifications`
- `/me`
- `/org`
- `/employees`

### 2. 내부관리 / 경영업무 레인
- `/management`
- `/work-items/branch`
- `/payroll`
- `/payroll/me`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin/audit-logs`

### 3. 현재 기준 문서
- `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
- `docs/architecture/phase-42-attendance-leave-hr-branch-operations-adoption-fit-gap-scope.md`
- `docs/architecture/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-scope.md`
- `docs/architecture/phase-44-operations-docs-user-admin-guides-adoption-checklist-fit-gap-scope.md`
- `docs/architecture/phase-44-pc-mobile-login-only-entry-pwa-desktop-app-scope.md`
- `docs/guides/phase-44-operations-docs-user-admin-guides-adoption-checklist-handoff.md`
- `docs/guides/phase-44-pc-mobile-login-only-entry-pwa-desktop-app-handoff.md`

### 4. 현재 구현/검증 근거 파일
- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/payroll.test.tsx`
- `apps/web/work-items.test.tsx`

### 5. 직전 Phase 44 기준 최신 근거
- focused API: `pnpm --filter @gw/api test -- auth-org.spec.ts work-items.spec.ts` → 15 files passed, 98 tests passed, 4 skipped
- focused web: `pnpm --filter @gw/web test -- admin-preview-guard.test.ts work-items.test.tsx dashboard-boundary.test.tsx payroll.test.tsx` → 24 files passed, 100 tests passed
- `pnpm --filter @gw/mobile typecheck` 통과
- `pnpm --filter @gw/web build` 통과
- local preview smoke: 익명 `/`, `/dashboard`, `/management`, `/payroll`, `/payroll/me`, `/work-items/labor`, `/admin/audit-logs`, `/uat` 는 `/login` redirect, `/login` 200, `/api/health` 200, `/manifest.webmanifest` 200
- live/release 근거: `https://gw-web.wereheresp.workers.dev`, main release-gate success, merge commit `fd5239e2e36848e711d918d45994382bf4616b39`

### 6. 운영 패키지와 rollback 기준
- `/uat` 는 로그인 뒤 내부 도입 리허설 패키지를 다시 모아보는 운영용 route 다. 익명 첫 입구가 아니다.
- rollback 이 필요하면 `pnpm exec wrangler deployments list --json --name gw-web` 로 되돌릴 version id 를 먼저 확인한다.
- 실제 rollback 명령은 `pnpm exec wrangler rollback <version-id> --name gw-web -y` 다.
- rollback 뒤 재확인 기본 route 는 `/login`, `/dashboard`, `/management`, `/payroll`, `/admin/audit-logs`, `/manifest.webmanifest` 로 잡는다.

## 최종 fit-gap 질문

### A. 내부 도입 readiness
1. 일반 직원이 `/login` → `/dashboard` → 기본업무 레인을 바로 따라갈 수 있는가
2. 관리자/담당자가 `/management` 아래 민감 운영 레인을 직원 홈과 혼동하지 않는가
3. 감사/컴플라이언스는 현재 `/admin/audit-logs` read-only 흐름으로 정직하게 설명되는가

### B. 권한/보안/경계
1. 로그인 전 비노출 기준이 문서와 실제 route guard 에서 같은 뜻인가
2. `/payroll` preview, `/payroll/me` self-only, `tax` branch/company, `labor` self/branch/restricted, `legal` metadata/approval gate, `audit` read-only 경계가 서로 섞이지 않는가
3. 메뉴 노출 여부와 별개로 API guard/company+branch scope 근거가 같이 남아 있는가

### C. 운영/릴리즈 readiness
1. 현재 build/test/release 근거를 최종 보고에 바로 재사용할 수 있는가
2. live URL과 추천 확인 순서가 흔들리지 않는가
3. `/uat` 가 로그인 후 운영 패키지 route 라는 설명과 익명 첫 입구(`/login`) 설명이 서로 섞이지 않는가
4. rollback/blocked/approval-needed 분류 기준이 운영 문장으로 남아 있는가

### D. 범위 통제
1. 실제 급여 지급/이체, 실신고, 주민번호/계좌번호 확대, production 실데이터, 외부 기관 연동이 아직 승인 게이트라는 점이 숨겨지지 않는가
2. Phase 45 종료 후 외부 연동/실데이터/기관 연계는 새 카드 체인으로 넘긴다는 경계가 분명한가

## 이번 Phase에서 직접 닫아야 할 범위

### 1. 최종 UAT 확인 순서를 잠근다
- 직원, 관리자/담당자, 감사 관점의 추천 클릭 순서를 최종 보고 형식으로 고정한다.
- 대장이 실제로 눌러볼 route 목록을 루트 문서와 handoff 에 같은 말로 남긴다.
- `/uat` 는 로그인 후 운영 진행자가 참고하는 보조 route 로만 남기고, 익명 시작 route 처럼 적지 않는다.

### 2. 권한/보안/승인 게이트 문장을 최종 잠근다
- route guard, API guard, scope, audit, approval gate 문장이 문서마다 다르게 풀리지 않게 다시 맞춘다.
- "지금 가능한 것"과 "별도 승인 필요"를 마지막으로 분리한다.

### 3. release/rollback/운영 확인 관점을 묶는다
- 최신 테스트 근거, live URL, release gate 성공, rollback 시 확인 포인트, blocker 기록 기준을 최종 통합 보고 문맥으로 묶는다.

### 4. 외부 연동 전 내부 도입 완료 선언 범위를 잠근다
- 현재 제품을 "외부 연동 없이 회사 내부 그룹웨어로 본격 도입 가능"이라고 판단할 최소 기준을 정의한다.
- 반대로 외부 기관 계정, 실데이터, 민감정보 확대, 유료 리소스, DNS/custom domain 은 Phase 45 완료와 분리한다.

## 이번 Phase에서 일부러 하지 않는 것
- 실제 급여 지급
- 은행 이체
- 주민번호/계좌번호 입력 확대
- production DB 실데이터 변경
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- 법령 API 인증키 등록
- DNS/custom domain
- 유료 리소스 생성 또는 증설
- secret 입력/교체
- migration
- destructive/force 작업

## 테스트 시나리오

### A. 직원 UAT 확인
- `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents`
- 직원 기본 흐름 안에 `/management`·`/admin*` 가 섞이지 않는다.

### B. 관리자/담당자 UAT 확인
- `/dashboard` → `/management` → `/work-items/branch` → `/payroll` → `/payroll/me` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → `/admin/audit-logs`
- preview/self-only/branch/company/restricted/read-only 경계가 역할별 책임과 충돌하지 않는다.

### C. 로그인/PWA/익명 차단 확인
- 익명은 `/login` 부터만 시작한다.
- 익명 `/uat` 는 내부 리허설 패키지 공개 입구가 아니라 `/login` redirect 대상이다.
- 설치 후 세션이 없으면 `/login` 부터 다시 시작한다.
- local preview smoke 근거와 live 직접 확인 근거는 최종 보고에서 구분해서 기록한다.

### D. release/운영 확인
- focused test, mobile typecheck, web build, local preview smoke, release gate 성공 근거가 최종 보고에 재사용 가능해야 한다.
- rollback 시 version id 확인 → rollback 실행 → 핵심 route 재확인 순서를 운영 문장으로 남겨야 한다.
- blocker / approval-needed / external-follow-up 분류가 운영 문맥으로 정리돼 있어야 한다.

## 역할별 후속 작업 기준
- builder: 최종 UAT/권한/운영 기준과 충돌하는 잔여 UX·copy·guard·route 문제를 수정
- reviewer: 권한 경계, 민감정보, approval gate, 과장 문구, release/rollback 설명 위험 검토
- tester: 직원/관리자/감사 레인과 focused test/local preview smoke/live 확인 근거 재검증
- docs: 최종 사용자 보고 문장, live URL, route 순서, 테스트 계정, 승인 게이트 형식 정리
- ops: PR/CI/main/release gate/live URL/rollback 관점 최종 확인과 보고 근거 정리