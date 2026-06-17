# Phase 49 파일럿 피드백 반영·최종 UAT 회귀 fit-gap 범위

## 1. 한 줄 요약
이번 Phase 49의 목표는
이미 Phase 45~48에서 잠가 둔 내부 도입 기준선을 바탕으로,
관리자·직원·지점관리자 역할별 파일럿 피드백과 최종 UAT 회귀를 한 세트로 다시 묶어
"대장이 live URL에서 직접 눌러 봤을 때 실제 업무 흐름이 끝까지 이어지고, 역할별 막힘 이유도 같은 언어로 설명되는 상태"를 만드는 것이다.

쉽게 말하면 이번 단계는
새 외부 연동을 여는 단계가 아니라,
이미 열어 둔 로그인/홈/일반업무/운영업무/감사/지점 업무 흐름을
실제 파일럿 관점으로 다시 눌러 보면서
1) 어디가 바로 써도 되는지
2) 어디가 아직 preview/dev-safe/read-only/skeleton 인지
3) 어디가 권한/승인 게이트 때문에 막히는지
를 더 또렷하게 고정하는 단계다.

## 2. 왜 지금 이 Phase가 필요한가
Phase 45에서는 외부연동 전 내부 도입 최종검증 기준을 잠갔고,
Phase 46에서는 계정·권한·조직 온보딩 리허설,
Phase 47에서는 운영 안정성·모바일/PWA 사용성,
Phase 48에서는 감사·보안·운영 최소 기준선을 다시 묶었다.

하지만 실제 파일럿 직전 관점에서는 아직 아래 gap 이 남아 있다.

1. 문서상 기준은 많이 정리됐지만, 역할별 UAT 회귀 순서가 직원/관리자/지점관리자 관점으로 한 번에 묶여 있지 않다.
2. `/dashboard` 일반 직원 홈, `/management` 운영 허브, `/work-items/branch` 지점 업무, `/admin/audit-logs` 감사 read-only 레인이 각각 설명돼 있어도 "누가 어느 순서로 어디까지 눌러야 하는지"가 파일럿 언어로 더 짧게 고정돼야 한다.
3. happy path 뿐 아니라 forbidden, empty, error, loading, mobile/PC 차이를 각 핵심 기능에서 공통 기록 포인트로 다시 잠가야 한다.
4. `admin / 1234` 테스트 계정을 쓰더라도 직원 시나리오, 운영 관리자 시나리오, 지점관리자 시나리오를 같은 사용자처럼 섞어 읽으면 실제 UAT 기록이 흐려진다.
5. Phase 48까지 남겨 둔 운영 정합성 메모(live URL, smoke 대상, runbook 근거)는 유지하되, 이번에는 실제 주요 업무 레인 회귀와 어떻게 연결되는지까지 묶어 줘야 한다.

즉 이번 Phase는
"문서 기준선이 있는 상태"에서 한 걸음 더 나아가
"파일럿 참여자가 실제로 어떤 순서로 누르고 무엇을 기록해야 하는지"를 같은 언어로 잠그는 단계다.

## 3. 이번 Phase에서 잠가야 할 제품 문장
- 익명 시작점은 계속 `/login` 뿐이다.
- COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 로그인 직후 공통 landing 은 `/dashboard` 다.
- AUDITOR 의 로그인 직후 landing 은 `/admin/audit-logs` 다.
- 일반 직원 기본 홈은 `/dashboard` 이고, 여기서 근태/휴가/결재/게시판/문서/내정보 흐름이 시작된다.
- `/management` 는 일반 직원 홈의 연장이 아니라 운영 관리자 허브다.
- `/work-items/branch` 는 지점관리자/운영자가 branch scope 업무를 확인하는 레인이지 독립 지점 마스터 완성품이 아니다.
- `/employees`, `/org` 는 읽기 중심 조회 레인이고 `/admin/users`, `/admin/policies` 와 같은 운영 변경 레인이 아니다.
- `/admin/audit-logs` 는 계속 `audit.read` 기반 read-only 감사 레인이다.
- `admin / 1234` 는 dev/test/UAT 전용 테스트 계정이며 production 기본 계정이 아니다.
- happy path, forbidden, empty, error, loading, mobile/PC 확인 포인트는 기능별로 따로 적되 같은 이슈 분류 언어(blocker/major/minor/copy-doc/approval-needed)로 묶는다.

## 4. 현재 바로 재사용할 근거

### 4-1. 주요 route
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
- `/notifications`
- `/offline`

### 4-2. 현재 구현 근거 파일
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

### 4-3. 현재 테스트/검증 근거
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/phase34-degraded-routes.spec.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/work-items.test.tsx`
- `apps/web/phase40-uat-package.test.tsx`
- focused API 15 files / 98 passed / 4 skipped
- focused web 24 files / 103 tests passed
- `pnpm --filter @gw/web typecheck` 통과
- `pnpm --filter @gw/web build` 통과
- `pnpm --filter @gw/web build:cf` 통과
- login-only redirect smoke baseline 존재
- reviewer blocker 였던 홈 운영 관리자/지점관리자 레인 혼동 copy 는 후속 builder 보강으로 분리 완료

### 4-4. 직전 Phase 기준 운영 근거
- 현재 사용자-facing live URL 메모는 `https://gw-web.wereheresp.workers.dev` 단일 host 기준으로 유지
- Phase 48 기준 운영 최소 확인 문서: `RUNBOOK.md`, `DEPLOYMENT.md`, `docs/guides/phase-44-operator-runbook.md`
- `/api/health` 는 최소 liveness 기준으로 유지
- `/admin/audit-logs` 는 read-only / masked preview / company boundary 기준 유지
- live 직접 재확인 근거와 local preview/build/test 대체 근거는 같은 항목으로 합치지 않는다.

## 5. 이번 Phase에서 직접 닫아야 할 범위

### 5-1. 역할별 파일럿 UAT 순서를 다시 잠근다
- 직원 레인은 `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서로 다시 고정한다.
- 운영 관리자 레인은 `/dashboard` → `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health` 순서로 다시 고정한다.
- 지점관리자 레인은 `/dashboard` → `/work-items/branch` → 필요 시 `/employees`·`/org` 읽기 확인 → `/management` 운영 허브 문맥 확인 순서로 정리한다.
- 감사 레인은 `/admin/audit-logs` → 필요 시 `/employees`·`/org` → `/api/health` 순서로 유지한다.

### 5-2. 파일럿 피드백을 화면/문서/테스트 같은 언어로 묶는다
- 홈(`/dashboard`)에서 오늘 할 일과 운영 CTA 가 섞이지 않는지 다시 본다.
- 계정관리 preview, 게시판/문서 협업, 근태/휴가/결재 상태 변경, 지점 업무, 감사 read-only 설명이 각각 무엇을 직접 확인하는 단계인지 다시 맞춘다.
- skeleton/placeholder/dev-safe/read-only 문구를 숨기지 않고, 실제 저장/실지급/실신고/외부연동 완료처럼 보이지 않게 유지한다.

### 5-3. 최종 UAT 회귀 기록 기준을 잠근다
- 각 핵심 기능마다 happy path, forbidden, empty, error, loading, mobile/PC 확인 포인트를 남긴다.
- blocker/major/minor/copy-doc/approval-needed 분류 기준을 다시 적용한다.
- live 직접 재확인 근거와 local preview/build/test/release gate 대체 근거를 구분해 적는다.

### 5-4. branch scope 와 company scope 차이를 파일럿 언어로 다시 잠근다
- `/work-items/branch` 는 branch scope 업무 확인 레인으로 읽고, company-wide 운영 전체 권한처럼 과장하지 않는다.
- branch manager 가 자기 지점 관련 항목만 보는 것과 COMPANY_ADMIN/HR_ADMIN 이 회사 범위 운영 검토를 하는 것을 같은 권한처럼 설명하지 않는다.
- `/employees`, `/org` 읽기 확인과 `/admin/users` 운영 변경 preview 를 한 묶음으로 섞지 않는다.

### 5-5. 최종 보고 패키지에 바로 들어갈 문장을 다시 잠근다
- live URL 또는 live 재확인 필요 메모
- 테스트 계정 `admin / 1234`
- 역할별 추천 route 순서
- 기능별 happy/forbidden/empty/error/loading/mobile/PC 기록 포인트
- 남아 있는 승인 게이트

## 6. 현재 구현 기준 fit-gap

### 지금 이미 되는 것
- 로그인 필수 진입과 post-login landing 기준
- 일반 직원 홈(`/dashboard`)과 운영 허브(`/management`) 분리
- `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` 일반 업무 레인 존재
- `/employees`, `/org` 읽기 중심 조회 레인 존재
- `/work-items/branch` branch scope 업무 레인과 role/permission 경계 근거
- `/admin/users`, `/admin/policies` 운영 검토 preview 레인 존재
- `/admin/audit-logs` read-only / masked preview / company boundary 근거
- route/API guard, company+branch/self/foreign 차단 테스트 근거

### 아직 이번 Phase에서 더 닫아야 할 것
- 역할별 파일럿 시나리오를 실제 눌러 보는 순서로 더 짧게 통일해야 한다.
- 주요 기능별 happy/forbidden/empty/error/loading/mobile/PC 기록 포인트를 최종 UAT 언어로 한 번 더 맞춰야 한다.
- branch manager 와 운영 관리자, 감사 담당자 문맥이 같은 관리자 묶음처럼 읽히지 않게 더 또렷하게 잠가야 한다.
- live URL/운영 근거와 실제 업무 회귀 기록을 final report 형식으로 더 직접 연결해야 한다.

## 7. 이번 Phase에서 일부러 하지 않는 것
- 실제 급여 지급
- 은행 이체
- 주민번호/계좌번호 입력 확대
- production DB 실데이터 전환/seed/migration
- 외부 IdP/SSO/SAML/SCIM 연동
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- production backup/restore 실행
- 외부 SIEM/alerting/paging/on-call 연동
- DNS/custom domain
- 유료 리소스 생성 또는 증설
- secret 입력/교체
- destructive/force 작업

## 8. 테스트 시나리오

### A. 직원 레인 UAT 회귀
- `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`
- 각 화면에서 happy path / forbidden / empty / error / loading / mobile/PC 확인 포인트를 기록
- 운영 관리자 레인이 일반 홈에 섞이지 않는지 확인

### B. 운영 관리자 레인 UAT 회귀
- `/dashboard` → `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health`
- dev-safe preview, read-only, capability 경계, 운영 최소 기준을 각각 분리해 기록

### C. 지점관리자 레인 UAT 회귀
- `/dashboard` → `/work-items/branch` → 필요 시 `/employees` → `/org` → `/management`
- branch scope 와 company scope 차단 이유, 지점 업무 대 회사 운영 레인 차이를 기록

### D. 감사/운영 기준선 회귀
- `/admin/audit-logs` → `/api/health` → `RUNBOOK.md` → `DEPLOYMENT.md`
- 감사 read-only, 최소 liveness, 수동 runbook/승인 게이트 설명이 흔들리지 않는지 확인

## 9. 역할별 후속 작업 기준
- builder: 역할별 파일럿 회귀를 실제 화면 흐름으로 더 또렷하게 만들고, 운영/지점/감사 레인 혼동을 줄이는 UX·copy·guard 보강
- reviewer: 역할 경계, branch/company scope, dev-safe/read-only/skeleton 과장, 승인 게이트 누락을 검토
- tester: 직원/운영 관리자/지점관리자/감사 레인 UAT 회귀와 happy/forbidden/empty/error/loading/mobile/PC 기록 재검증
- docs: 최종 UAT 절차, 파일럿 피드백 기록 형식, 최종 보고 패키지 문장을 쉬운 말로 정리
- ops: live URL, smoke 대상, release gate, rollback/runbook 확인 순서를 최종 결과 보고 형식으로 정리
