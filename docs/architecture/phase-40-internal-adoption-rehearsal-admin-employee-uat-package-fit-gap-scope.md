# Phase 40 내부 도입 리허설·관리자/직원 UAT 패키지 fit-gap 범위

## 1. 한 줄 결론

이번 Phase 40의 목적은
이미 Phase 31~39에서 정리한 일반 업무 흐름, `경영업무`, `/admin*`, 권한 guard, same-origin API, 상태 분리 기준을
"대장이 실제 내부 도입 리허설을 어떻게 돌릴지" 관점으로 다시 묶는 것이다.

핵심은 새 외부 연동을 여는 것이 아니라,
직원/승인자/관리자/감사 담당자가 dev-safe 계정과 현재 live route 로 어디까지 실제처럼 리허설할 수 있고,
어디부터는 이슈로 적어야 하며,
어디부터는 별도 승인 게이트인지
한 번에 보이는 UAT 패키지 언어를 만드는 것이다.

## 2. 왜 지금 이 Phase가 필요한가

직전 Phase 36에서는 운영자 설정·회사정책·권한관리 문장을 다시 맞췄다.
직전 Phase 37에서는 문서 저장흐름·감사 로그·민감자료 approval gate 를 내부 운영 언어로 다시 맞췄다.
직전 Phase 38에서는 홈/메뉴/알림/오프라인과 모바일·PC 사용성 기준을 다시 맞췄다.
직전 Phase 39에서는 일반 host 대 admin host 경계, role/permission, company+branch scope, forbidden/error/empty/offline 분리, masked audit preview 를 운영 QA 언어로 다시 고정했다.

이제 다음 단계에서는
"기능이 있다"보다
"내부 도입 리허설을 어떤 계정으로 어떤 순서로 돌리고, 무엇을 합격/수정/승인 필요로 판정할지"가 먼저 정리돼야 한다.

특히 이번 Phase에서는 아래 여섯 축이 같은 뜻으로 읽혀야 한다.

1. 일반 직원 lane, 승인자 lane, 관리자 lane, 감사/검토 lane 이 서로 섞이지 않는가
2. `/dashboard` 중심 일반 업무 흐름과 `/management`·`/admin*` 운영 흐름을 역할별 UAT 시나리오로 다시 설명할 수 있는가
3. happy path, forbidden, empty, error, offline 을 UAT 기록표에서 구분해 적을 수 있는가
4. 권한 누출, company+branch scope 누출, self/foreign 접근 차단을 단순 UX 불편이 아니라 blocking 이슈로 분류할 수 있는가
5. 교육자료 초안, 진행자 스크립트, 이슈 기록 기준, 수정 우선순위 기준을 한 세트로 묶을 수 있는가
6. 실데이터/외부 연동/실지급/민감 원문/production 변경은 여전히 승인 게이트라고 분리할 수 있는가

이 여섯 축을 같은 제품 언어로 다시 묶는 것이 이번 fit-gap의 핵심이다.

## 3. 이번 Phase에서 직접 다루는 범위

### 3-1. 역할별 UAT 레인을 다시 고정한다

이번 Phase에서는 "관리자 UAT"를 한 덩어리로 쓰지 않는다.
최소 아래 네 레인을 분리해 적는다.

- 일반 직원 레인
  - `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`
- 승인자/팀장 레인
  - `/dashboard` → `/approvals` → 팀 예외 확인 → 자기 scope 검토
- 경영업무 담당자 레인
  - `/dashboard` → `/management` → `/payroll` → `/work-items/tax|labor|legal|branch`
- 운영자/감사 레인
  - `/dashboard` 또는 admin host 문맥 → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/offline`

같은 `admin / 1234` dev-safe 계정을 쓰더라도,
문서상 시나리오는 "어떤 역할 문맥으로 무엇을 보러 가는가"가 먼저 보여야 한다.

### 3-2. UAT 패키지를 4개 묶음으로 정리한다

이번 Phase에서 UAT 패키지는 아래 4개 묶음으로 본다.

1. 테스트 계정/접속 정보
   - live URL
   - `/uat` 실행 패키지 route
   - dev/test/UAT 전용 계정 안내
   - production 기본 계정 금지 문구
2. 시나리오 카드
   - 역할별 시작 route
   - 직접 해볼 액션
   - happy path 확인 포인트
   - forbidden/empty/error/offline 확인 포인트
3. 이슈 기록 규칙
   - blocker / major / minor / copy-doc / approval-needed 구분
   - 재현 route / 역할 / 기대 결과 / 실제 결과 / 근거 스크린샷 또는 로그 메모 구조
4. 교육/진행 자료 초안
   - 진행자용 10~15분 설명 순서
   - 참가자용 빠른 시작 가이드
   - 종료 후 수정 우선순위 분류 기준

### 3-3. UAT 합격/수정 기준을 쉬운 말로 다시 고정한다

이번 Phase에서는 이슈를 아무거나 "버그"라고 뭉개지 않는다.

- blocker
  - 로그인/진입 자체가 안 됨
  - happy path 핵심 route 가 막힘
  - 권한 없는 사용자가 민감 정보나 운영 route 를 봄
  - company+branch scope 누출
  - self/foreign 차단이 깨짐
- major
  - 업무는 되지만 상태 문구가 틀려 오해를 만듦
  - forbidden/error/empty/offline 이 섞여 사용자가 잘못 판단함
  - 운영/감사 레인 분리가 흐려짐
- minor
  - copy 불명확, 링크 위치 불편, 설명 순서 아쉬움
- copy-doc
  - route 는 맞지만 문서/교육자료/버튼 문구가 실제 동작과 다름
- approval-needed
  - 기능 결함이 아니라 실데이터, 외부 연동, production 변경, 민감 원문 확대처럼 승인 없이는 진행하면 안 되는 항목

### 3-4. 최종 UAT 보고 형식을 미리 고정한다

이번 Phase의 문서 기준에서는 최종 보고에 아래가 반드시 들어가야 한다.

- live URL: `https://gw-web.wereheresp.workers.dev`
- 시작 route: `/uat` (익명 general host 접근은 `/login` redirect, 로그인 세션에서는 접근 허용)
- 테스트 계정: `admin / 1234` (dev/test/UAT 전용)
- 역할별 추천 시나리오
- 확인 route
- 현재 가능한 것 / 막히는 것 / 아직 skeleton 인 것
- 남은 blocker/major/minor 요약
- 별도 승인 게이트 목록

즉 "되나 안 되나"만 적는 것이 아니라,
대장이 직접 다시 눌러볼 경로와 남은 승인 게이트를 한 줄씩 다시 따라갈 수 있어야 한다.

### 3-5. 교육자료 초안도 제품 경계를 지켜야 한다

이번 Phase에서 교육자료 초안은
"사용자에게 자신감을 주는 말"보다
"무엇을 해도 되고, 무엇은 아직 안 되고, 무엇은 승인 필요인지"를 먼저 적는 문서여야 한다.

- 일반 직원 교육자료는 `/dashboard` 중심 일상 업무를 먼저 보여 준다.
- 관리/감사 교육자료는 `/management` 와 `/admin*` 를 일반 직원 흐름과 분리한다.
- 오프라인/오류/권한 부족은 가짜 성공 UX 없이 정직하게 설명한다.
- 민감자료는 masked preview·metadata-only·read-only 원칙을 깨지 않게 적는다.

### 3-6. 문서·화면·테스트 증거를 같은 리허설 언어로 연결한다

이번 Phase 문서는 새 정책 선언문이 아니라
이미 있는 화면/guard/test 근거를 UAT 패키지 언어로 다시 읽는 기준 문서여야 한다.

같이 보는 핵심 근거는 아래와 같다.

- 일반 업무/UAT 입구 기준
  - `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`
  - `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`
  - `docs/architecture/phase-33-attendance-leave-approvals-real-usage-scope.md`
  - `docs/guides/phase-33-attendance-leave-approvals-real-usage-handoff.md`
  - `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`
  - `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`
- 운영/권한/오프라인/UAT 안전장치 기준
  - `docs/architecture/phase-36-admin-settings-company-policy-permission-fit-gap-scope.md`
  - `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md`
  - `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`
  - `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md`
  - `docs/architecture/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-scope.md`
  - `docs/guides/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-handoff.md`
  - `docs/architecture/phase-39-operational-qa-security-audit-permission-regression-fit-gap-scope.md`
  - `docs/guides/phase-39-operational-qa-security-audit-permission-regression-fit-gap-handoff.md`
- Web/API/Test 근거
  - `apps/web/app/uat/page.tsx`
  - `apps/web/app/uat/uat-package-config.ts`
  - `apps/web/phase40-uat-package.test.tsx`
  - `apps/web/admin-preview-guard.ts`
  - `apps/web/middleware.ts`
  - `apps/web/admin-preview-guard.test.ts`
  - `apps/web/phase38-offline-admin.test.tsx`
  - `apps/api/src/app.ts`
  - `apps/api/test/auth-org.spec.ts`
  - `apps/api/test/work-items.spec.ts`

## 4. 이번 Phase에서 일부러 하지 않는 것

이번 Phase는 아래를 구현 완료처럼 약속하지 않는다.

- 실제 급여 지급, 은행 이체, 실세액 확정, 주민번호/계좌번호 확대
- 홈택스/4대보험/회계/세무사/노무사/변호사/기관 외부 계정 연동
- production DB 실데이터 입력/정비
- raw 민감 원문 저장 확대
- production secret 입력/교체
- DNS/custom domain 확정
- 유료 리소스 생성·증액
- migration, destructive 작업, 강제 데이터 정리
- native app 배포 또는 외부 테스터 배포

즉 이번 Phase는
"실운영 개시"가 아니라
"내부 도입 리허설을 어디까지 안전하게 진행할 수 있는지 정리하는 단계"다.

## 5. 현재 확인된 대표 근거

### 일반 업무와 관리자 레인 분리
- `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`
  - `/login`·`/dashboard`·`/management`·`/admin/users` UAT 입구 정리가 있다.
- `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`
  - `/management` 아래 급여/세무/노무/법무/감사 흐름을 관리자 UAT 언어로 정리한 근거가 있다.
- `docs/guides/phase-39-operational-qa-security-audit-permission-regression-fit-gap-handoff.md`
  - 일반 host 대 admin host, 역할/권한, 상태 분리, 민감정보 비노출을 운영 QA 언어로 다시 고정한 근거가 있다.

### 권한/차단/상태 분리
- `apps/web/admin-preview-guard.test.ts`
  - 익명 redirect, `AUDITOR` audit-only 허용, `HR_ADMIN` audit 차단, spoofed host 차단 근거가 있다.
- `apps/web/phase38-offline-admin.test.tsx`
  - 일반 host 와 admin host `/offline` 복구 범위가 서로 다르다는 근거가 있다.
- `apps/api/test/auth-org.spec.ts`
  - foreign/self/company+branch scope 차단, disallowed attendance method 403, raw storage internals 비노출 근거가 있다.

### 민감 운영 모듈 UAT 입구
- `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`
  - `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 확인 순서가 있다.
- `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md`
  - `/admin/users`·`/admin/policies`·`/admin/audit-logs` 운영 검토 문맥이 있다.

## 6. 이번 fit-gap의 핵심 판정 질문

문서/코드 대조 후 아래 질문에 같은 답이 나와야 한다.

1. 직원/승인자/경영업무 담당자/운영자·감사 레인이 서로 섞이지 않는가
2. 각 레인이 `/dashboard` 또는 `/management` 또는 `/admin*` 중 어디서 시작하는지 쉽게 설명할 수 있는가
3. happy path, forbidden, empty, error, offline 을 UAT 기록표에 따로 적을 수 있는가
4. `/uat` 에서 보여 주는 역할별 시나리오·이슈 분류·진행자 스크립트가 루트 문서와 같은 뜻인가
5. 권한 누출, foreign/self/company+branch scope 위반을 blocker 로 분류하는 기준이 분명한가
6. `/payroll`, `tax`, `labor`, `legal`, `audit` 흐름을 한 묶음으로 보되 각 책임을 섞어 적지 않는가
7. 교육자료 초안이 "아직 안 되는 것/승인 필요한 것"을 숨기지 않는가
8. final report 에 live URL, `/uat`, 계정, 시나리오, 남은 승인 게이트를 분리해 적을 수 있는가

## 7. 이번 Phase에서 권장하는 쉬운 확인 순서

1. `/login`
2. `/uat`
3. `/dashboard`
4. `/attendance`
5. `/leave`
6. `/approvals`
7. `/boards`
8. `/documents`
9. `/management`
10. `/payroll`
11. `/work-items/tax`
12. `/work-items/labor`
13. `/work-items/legal`
14. `/admin`
15. `/admin/users`
16. `/admin/policies`
17. `/admin/audit-logs`
18. `/offline`
19. `apps/web/phase40-uat-package.test.tsx`
20. `apps/web/admin-preview-guard.test.ts`
21. `apps/web/phase38-offline-admin.test.tsx`
22. `apps/api/test/auth-org.spec.ts`

이 순서는
"직원 일상 업무 → 관리자 민감 업무 → 운영/감사 경계 → 오프라인/권한 차단 → 테스트 근거"
순서를 유지하기 위한 것이다.

## 8. 다음 작업자에게 넘길 핵심 문장

- 이번 Phase 40은 내부 도입 리허설을 위한 관리자/직원 UAT 패키지 fit-gap 단계다.
- 핵심은 새 기능 확장보다 역할별 시나리오, 이슈 분류 기준, 교육자료 초안, 최종 보고 형식을 같은 말로 맞추는 것이다.
- 이미 근거가 있는 것은 `/uat` 실행 패키지, `/dashboard` 일반 업무 흐름, `/management` 민감 업무 허브, `/admin*` 운영 검토 레인, route/API guard, company+branch scope 차단, masked audit preview, offline 분리다.
- 권한 누출, foreign/self 차단 실패, 상태 혼동, 일반/운영 레인 혼합은 UAT blocker 또는 major 로 분류해야 한다.
- 실데이터, 외부 연동, 실지급, raw 민감 원문, production 변경은 여전히 범위 밖이며 승인 게이트다.
