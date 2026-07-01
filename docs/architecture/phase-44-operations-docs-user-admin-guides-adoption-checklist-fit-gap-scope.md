# Phase 44 운영문서·사용자가이드·관리자가이드·도입 체크리스트 fit-gap 범위

## 한 줄 요약
이번 Phase 44의 목표는
이미 만들어 둔 그룹웨어 화면과 권한 경계를 바탕으로
직원용 가이드, 관리자용 가이드, 운영자 runbook, 권한표, 도입 전 체크리스트를 한 세트로 정리해
"외부 연동 없이 회사 내부에 바로 도입 가능한 기준선"을 닫는 것입니다.

쉽게 말하면 이번 단계는
"기능이 있느냐"보다
"누가 어디서 무엇을 보고, 무엇은 아직 승인 없이는 하면 안 되는지"를
헷갈리지 않게 문서로 고정하는 단계입니다.

## 왜 지금 이 단계가 필요한가
Phase 42A~43까지 오면서 아래 기준은 이미 많이 정리됐습니다.

- 익명 사용자는 `/login` 부터 시작해야 한다.
- 직원 기본 업무는 `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents` 중심으로 읽는다.
- 민감 운영 기능은 `/management`, `/payroll`, `/work-items/*`, `/admin/audit-logs` 같은 별도 레인으로 분리한다.
- route guard, API guard, company+branch scope, audit read-only 경계는 테스트와 문서에 이미 여러 번 남겼다.

하지만 아직 남은 gap 도 분명합니다.

1. 직원/관리자/운영자가 바로 따라갈 쉬운 사용 가이드가 한 문서 세트로 묶여 있지 않습니다.
2. 권한표와 책임 분리가 route 설명, 테스트 근거, 승인 게이트와 한 번에 연결돼 있지 않습니다.
3. 도입 전 체크리스트가 "기술 검증", "운영 준비", "사용자 안내"로 나뉘어 있지 않아 실제 도입 순서를 잡기 어렵습니다.
4. 실지급, 실신고, 실계약, 주민번호/계좌번호 확대, production 실데이터, 외부 기관 연동 같은 승인 게이트가 문서마다 흩어져 있습니다.

즉 이번 Phase는 새 기능을 더 만드는 단계가 아니라,
이미 있는 제품과 guardrail 을
실제 내부 도입 문서 묶음으로 다시 정렬하는 단계입니다.

## 이번 Phase의 도입 기준
- 목표는 Production-ready (실구현) 설명이 아니라 "외부 연동 없이 회사 내부 그룹웨어로 본격 도입 가능한 범위"를 분명히 적는 것이다.
- 대시보드 = 홈이다. PC/모바일 홈은 고정 바로가기 + 사용자 커스텀 바로가기를 제공하는 방향으로 읽는다.
- 일반 직원 화면과 `경영업무` 페이지는 다른 책임 레인으로 분리해 설명한다.
- 경영업무(인사/급여/근태관리/세무/노무/법무/지점/컴플라이언스)는 지정된 관리자/담당자만 접근하는 것으로 설명한다.
- 단순 메뉴 숨김이 아니라 route guard, API guard, company+branch scope, audit log 근거를 함께 적는다.
- 테스트 계정 `admin / 1234` 는 dev/test/UAT 전용이며 production 기본 계정처럼 적지 않는다.
- 최종 보고에는 대장이 직접 눌러볼 live URL, 주요 route, 테스트 시나리오, 남은 승인 게이트를 포함해야 한다.

## 현재 구현 기준에서 바로 쓸 수 있는 근거

### 직원 기본 업무 레인
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

### 내부관리 / 경영업무 레인
- `/management`
- `/work-items/branch`
- `/payroll`
- `/payroll/me`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin/audit-logs`

### 현재 문서 근거가 이미 있는 핵심 파일
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/web/admin-preview-guard.test.ts`

## fit-gap 요약

### 이미 있는 것
1. 로그인 필수 진입과 익명 내부 route 차단 기준
2. 직원 기본 업무 레인과 경영업무 레인 분리
3. 급여·세무·노무·법무·감사 read model 과 role/scope 경계
4. route/API/company/branch/audit 근거를 확인할 수 있는 테스트 흔적
5. live URL, release gate, parent smoke 결과를 기준으로 한 최근 handoff

### 아직 부족한 것
1. 직원용 "어디서 무엇을 먼저 하면 되는지" 가이드가 흩어져 있음
2. 관리자/담당자용 "어떤 route 를 어떤 순서로 점검하는지" 가이드가 한 번에 정리돼 있지 않음
3. 운영자용 runbook 이 도입 준비/운영 중/문제 발생 시 대응 순서로 닫혀 있지 않음
4. 역할별 권한표가 화면·API·scope·승인 게이트까지 한 표로 묶여 있지 않음
5. 도입 체크리스트가 사전 준비, 계정/권한 확인, 시나리오 실행, 승인 게이트 확인 순서로 정리돼 있지 않음

## 이번 Phase에서 꼭 정리해야 할 문서 묶음

### 1. 직원용 사용자 가이드
반드시 들어가야 할 내용:
- 첫 진입은 `/login`
- 로그인 후 기본 시작점은 `/dashboard`
- 하루 기본 흐름 예시: `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents`
- `경영업무` 와 관리자 화면은 일반 직원 기본 레인이 아니라는 설명
- 안 되는 것: 관리자 정책 변경, 다른 회사/지점 데이터 접근, production 완료품처럼 오해할 기능

### 2. 관리자/담당자 가이드
반드시 들어가야 할 내용:
- `경영업무` 허브(`/management`)의 역할
- `/work-items/branch`, `/payroll`, `/work-items/tax|labor|legal`, `/admin/audit-logs` 를 어떤 책임으로 봐야 하는지
- 일반 직원 홈과 민감 운영 레인을 절대 섞지 않는 설명
- read-only / preview / self-only / branch/company/restricted 경계
- 현재 dedicated compliance 전용 조치 시스템이 아니라 `/admin/audit-logs` read-only 진입점이라는 설명

### 3. 운영자 runbook
반드시 들어가야 할 내용:
- 도입 전 준비: 계정, 권한, 회사/지점 scope, 테스트 시나리오, live URL 확인
- 도입 중 점검: 익명 차단, 역할별 landing, `/management` 분리, 민감 route 차단, 로그아웃/세션 확인
- 도입 후 점검: audit 확인 포인트, blocker 기록, 승인 필요 항목 분리, Phase 45 전 최종 점검 준비
- 장애/오해 방지: Production-ready (실구현)/Production-ready (실구현) 과 승인 게이트를 숨기지 않는 원칙

### 4. 권한표
최소한 아래 축을 묶어야 함:
- 역할
- 접근 가능한 대표 route
- 접근 불가 route
- scope 기준(company/branch/self/restricted/read-only)
- 비고(approval gate / Production-ready (실구현) / external integration 미포함)

최소 포함 역할 예시:
- EMPLOYEE
- MANAGER
- HR_ADMIN
- COMPANY_ADMIN
- AUDITOR

### 5. 도입 전 체크리스트
최소 3단계로 나눔:
1. 사전 준비
   - live URL
   - 테스트 계정
   - 주요 route 확인 순서
   - 승인 없이 하면 안 되는 것 확인
2. 역할별 시나리오 점검
   - 직원 기본 업무
   - 관리자/담당자 경영업무
   - 감사 read-only
3. 승인 게이트 점검
   - 실지급/은행이체
   - 주민번호/계좌번호 입력 확대
   - production DB 실데이터
   - 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
   - 법령 API 인증키 등록
   - DNS/custom domain
   - 유료 리소스
   - migration
   - destructive/force 작업

## 구현 범위
- 기존 route/권한/가드 기준을 바탕으로 문서 체계를 Phase 44 기준으로 다시 정리한다.
- scope/handoff, 루트 문서, 테스트 계획, QA 체크리스트, known issues 를 같은 언어로 맞춘다.
- builder/reviewer/tester/docs/ops 가 다음 카드부터 같은 도입 기준을 쓰게 만든다.

## 이번 Phase에서 의도적으로 하지 않는 것
- 실제 급여 지급
- 은행 이체
- 주민번호/계좌번호 입력 확대
- production DB 실데이터 투입
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- 법령 API 인증키 등록
- DNS/custom domain
- 유료 리소스 생성 또는 증설
- migration
- destructive/force 작업

## 테스트 시나리오

### A. 직원 기본 업무 문서 검증
- `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` 흐름이 쉬운 언어로 이어진다.
- `경영업무` 와 `/admin*` 가 직원 기본 레인처럼 섞이지 않는다.

### B. 관리자/담당자 문서 검증
- `/management` 가 민감 운영 허브로 읽힌다.
- `/payroll`, `/payroll/me`, `/work-items/tax|labor|legal`, `/admin/audit-logs` 가 서로 다른 책임으로 설명된다.
- preview/self-only/branch/company/restricted/read-only 경계가 문서마다 같은 뜻이다.

### C. 권한표 검증
- 역할별 허용 route 와 차단 route 가 route guard/API guard 설명과 충돌하지 않는다.
- company/branch/self/restricted/read-only scope 설명이 한 표 안에서 읽힌다.

### D. 운영자 runbook 검증
- 도입 전 준비 / 도입 중 점검 / 도입 후 정리 순서가 실제 운영자가 따라가기 쉬운 형태다.
- blocker, approval-needed, Production-ready (실구현) 항목을 구분해서 기록하게 돼 있다.

### E. 승인 게이트 검증
- 승인 없이 하면 안 되는 항목이 누락되지 않는다.
- Phase 45 전 최종검증에 넘길 목록이 명확하다.

## 역할별 후속 작업 기준
- builder: 필요한 문서/가이드/runbook/권한표/체크리스트 실파일 작성 및 루트 문서 연결
- reviewer: 권한 경계, 민감정보, approval gate, 과장 문구, 제품 문장 일관성 검토
- tester: 문서 시나리오와 실제 route/API/test 근거 일치 여부 재검증
- docs: 최종 사용자 확인 순서, 운영 체크리스트, 승인 게이트, 보고 형식 다듬기
- ops: review/test 후 Phase 45 최종검증 체인 연결 준비
