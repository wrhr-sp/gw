# Phase 43 급여·세무·노무·법무 내부관리 도입완성 fit-gap 범위

## 1. 한 줄 결론

이번 Phase 43의 목표는 `/management` 아래의 급여·세무·노무·법무·감사 흐름을
"관리자 메뉴 몇 개가 있다" 수준이 아니라
외부 연동 없이도 회사 내부 운영팀이 실제로 검토·상태확인·보완요청·승인대기까지 따라갈 수 있는
내부관리 도입 흐름으로 다시 묶는 것이다.

핵심은 네 가지다.

1. 일반 직원 홈과 `경영업무` 허브를 계속 분리한다.
2. `/payroll` 과 `/payroll/me` 는 self-only/role-split/preview 경계를 숨기지 않은 채 내부 급여 운영 읽기 흐름으로 닫는다.
3. `/work-items/tax`·`/work-items/labor`·`/work-items/legal` 은 공통 work item 위의 관리자 업무로 유지하되, branch/company/self/restricted 경계를 실제 운영 언어로 다시 고정한다.
4. `/admin/audit-logs` 는 현재 컴플라이언스/감사 read-only 진입점이라는 사실을 분명히 적고, 실지급·실신고·외부 전문가 연동·민감 원문 저장 확대는 계속 승인 게이트로 남긴다.

## 2. 왜 지금 이 Phase가 필요한가

- Phase 42A에서 로그인 필수 진입, 자동 로그인 세션 선택, 익명 내부 route/API 차단을 먼저 고정했다.
- Phase 42에서 `/attendance`·`/leave`·`/employees`·`/org`·`/work-items/branch` 를 직원 기본 운영과 지점 운영 언어로 다시 묶었다.
- 다음 단계인 Phase 43에서는 그 위에 관리자 내부관리 레인인 급여·세무·노무·법무·감사를 같은 수준으로 닫아야 한다.
- 현재 구현 흔적은 이미 충분히 있지만, 문서와 제품 언어는 아직 Phase 35의 "관리자 UAT 시작점" 문맥에 더 가깝다.
- 이제는 "preview/Production-ready (실구현) 이 남아 있어도 회사 내부 운영팀이 어디까지 바로 도입 가능한가"를 더 분명하게 적어, 이후 Phase 44~45 검증 체인과 외부 연동 분리 기준을 흔들리지 않게 만드는 것이 필요하다.

이번 Phase의 목적은 새 외부 시스템을 여는 것이 아니라,
이미 있는 route/API/test 근거를 기준으로
"내부 운영팀이 지금 실제로 어떤 레인으로 검토하고 무엇을 아직 승인 게이트로 남겨야 하는가"를 명확히 고정하는 것이다.

## 3. 현재 확인된 구현 근거

### 3-1. 경영업무 허브와 분리 원칙 근거

- `apps/web/app/management/page.tsx`
  - 급여정산, 세무 업무, 노무 업무, 법무 업무, 지점 운영, 컴플라이언스/감사 카드가 이미 있다.
  - `경영업무` 허브를 일반 직원 홈과 분리하고, roleScope 를 카드마다 따로 적고 있다.
  - 추천 UAT 순서가 `/management` → `/work-items/branch` → `/documents` → `/payroll` → `tax/labor/legal` → `/admin/audit-logs` 로 묶여 있다.
- `apps/web/admin-preview-guard.ts`, `apps/web/middleware.ts`, `apps/web/admin-preview-guard.test.ts`
  - 일반 host 와 admin host, 관리자 허브와 일반 홈, 민감 route/API guard 경계 근거가 이미 있다.

### 3-2. 급여 운영 읽기 흐름 근거

- `apps/web/app/payroll/page.tsx`
  - 급여 프로필 Production-ready (실구현), 급여 기간/마감 상태, 직원용 명세서 초안 진입을 같은 화면에서 보여 준다.
  - `preview only`, `role-split visibility`, `attendance/leave input linked` 문구가 현재 단계 경계를 분명히 적고 있다.
- `apps/web/app/payroll/me/page.tsx`
  - self-only 명세서 초안, correction guidance, Production-ready (실구현) 공제 문구를 같은 화면에서 읽게 한다.
- `apps/api/test/auth-org.spec.ts`
  - `/api/payroll`, `/api/payroll/periods/:id`, `/api/payroll/me/payslip` 권한 분기 테스트가 있다.
  - COMPANY_ADMIN / MANAGER / EMPLOYEE 별 visibility 차이와 self-only 차단 근거가 남아 있다.

### 3-3. 세무 운영 흐름 근거

- `apps/web/app/work-items/work-items-config.ts`
  - `tax` 모듈 summary, roleScope, accessNote, apiRoutes, milestones, detailSections 가 정리돼 있다.
  - branch 제출 상태와 HQ review/package preparation 을 분리해 적고 있다.
- `apps/api/test/work-items.spec.ts`
  - branch scope `work_item_tax_month_end_evidence` 와 company scope `work_item_tax_vat_package_preparation` 를 다르게 검증한다.
  - `deadline`, `review`, `audit` visibility 차이를 테스트로 붙잡고 있다.

### 3-4. 노무 운영 흐름 근거

- `apps/web/app/work-items/work-items-config.ts`
  - `labor` 모듈이 category, confidentiality, restricted capability, self/branch/restricted visibility 차이를 직접 적고 있다.
- `apps/api/test/work-items.spec.ts`
  - self-scope `work_item_labor_leave_balance_adjustment`, branch-visible `work_item_labor_overtime_review`, restricted `work_item_labor_discipline_review` 경계를 분리해 검증한다.
  - restricted 건은 MANAGER / COMPANY_ADMIN 이 바로 보지 못하고 HR_ADMIN 만 보는 현재 정책 근거가 있다.

### 3-5. 법무 운영 흐름 근거

- `apps/web/app/work-items/work-items-config.ts`
  - 계약 검토, 계약 갱신 예정, 분쟁/클레임/보험 후속을 metadata 중심 Production-ready (실구현) 으로 적고 있다.
- `apps/api/test/work-items.spec.ts`
  - branch-visible 계약 갱신, company-only 계약 검토, 분쟁 intake approval gate 를 분리해 검증한다.
  - `approvalGate.stage`, audit log 노출 여부, company scope 차단 근거가 남아 있다.

### 3-6. 컴플라이언스/감사 read-only 흐름 근거

- `apps/web/app/admin/audit-logs/page.tsx`
  - `audit.read` 전용 진입 의미, actor/action/category/date 필터, masked detail, storage preview 경계, company boundary 설명이 있다.
- `apps/web/app/management/page.tsx`
  - 현재 컴플라이언스 진입이 `/admin/audit-logs` 로 이어진다는 사실을 직접 적고 있다.
- `apps/api/test/auth-org.spec.ts`
  - `audit.read` 권한 허용/차단 테스트가 있다.
- `apps/api/test/work-items.spec.ts`
  - `work_item.audit.read` 가 없는 상세 응답은 auditLogs 가 비고, AUDITOR 는 같은 item 에서 audit 흔적을 보는 테스트가 있다.

## 4. 이번 Phase에서 직접 닫아야 할 범위

### 4-1. `/management` 를 내부관리 허브로 다시 고정한다

- 일반 직원 홈의 연장선이 아니라 민감 관리자 모듈 허브로 읽혀야 한다.
- 급여·세무·노무·법무·감사를 "한 회사의 내부 운영팀이 매일 확인하는 검토 레인"으로 다시 정리한다.
- `/work-items/branch` 지점 운영과 `/payroll`·`tax/labor/legal` 관리자 업무는 모두 `경영업무` 아래에 있지만 서로 다른 책임 문맥이라는 점을 유지한다.

### 4-2. 급여를 "실지급 전 내부 검토 운영" 흐름으로 다시 고정한다

- `/payroll` 은 급여 프로필/기간/명세서 초안/연결 API 를 읽는 내부 급여 운영 화면으로 적는다.
- `/payroll/me` 는 구성원의 self-only preview 와 정정 안내 화면으로 적는다.
- preview 금액, reviewing 상태, Production-ready (실구현) 공제가 실지급/실세액 확정처럼 보이지 않게 적는다.
- 근태·휴가 입력과 연결된다는 점은 유지하되, 급여와 세무의 책임을 같은 말로 섞지 않는다.

### 4-3. 세무를 "지점 제출 대 HQ 검토" 흐름으로 다시 고정한다

- `/work-items/tax` 는 세무 신고 자동화가 아니라, 지점 증빙 제출과 HQ 검토/패키지 준비를 읽는 내부 운영 화면으로 적는다.
- branch scope 와 company scope work item 을 같은 전체 접근처럼 쓰지 않는다.
- 홈택스 직접 신고, 외부 세무사 계정, 실세무 원문 대량 업로드는 현재 범위 밖이라는 점을 숨기지 않는다.

### 4-4. 노무를 "restricted 경계가 강한 내부 이슈 관리" 흐름으로 다시 고정한다

- `/work-items/labor` 는 계약/연차/수당/고충/징계/사고/퇴사 metadata 를 읽는 내부 운영 레인으로 적는다.
- self-scope, branch-visible, restricted labor 차이를 같은 권한처럼 뭉개지 않는다.
- 실제 계약서/징계/사고 원문, 외부 노무/급여 연동, 법적 확정 절차는 아직 승인 게이트로 남긴다.

### 4-5. 법무를 "계약/갱신/분쟁 승인대기 관리" 흐름으로 다시 고정한다

- `/work-items/legal` 은 계약 검토 요청, 갱신 예정, 분쟁/클레임 후속을 metadata 중심으로 읽는 내부 운영 레인이다.
- 지점 관리자가 자기 지점 관련 갱신/보완 요청을 보는 것과 회사 전체 민감 계약/분쟁 자료를 보는 것을 같은 권한처럼 적지 않는다.
- 실계약 원문 저장 확대, 외부 변호사/보험사/기관 연동, 실제 제출 자동화는 현재 범위 밖으로 남긴다.

### 4-6. 컴플라이언스를 "현재는 감사 read-only 중심"으로 정직하게 고정한다

- dedicated `/compliance` route 또는 `module=compliance` 근거가 아직 없다는 점을 숨기지 않는다.
- 현재 컴플라이언스는 `/management` 카드와 `/admin/audit-logs` read-only 흐름에서 먼저 읽힌다고 적는다.
- 감사 추적, masked detail, company boundary 와 실제 조치/해결 queue 를 같은 말처럼 섞지 않는다.

## 5. 이번 Phase에서 일부러 하지 않는 것

아래는 이번 Phase에서 문서상으로도 완료처럼 적지 않는다.

- 실제 급여 지급, 은행 이체, 확정 세액/4대보험 계산
- 주민번호/계좌번호 입력 확대
- 홈택스/4대보험/회계/세무사/노무사/변호사/보험사/기관 외부 계정 연동
- production payroll/work item/audit 실데이터 변경
- migration, destructive 작업, DNS/custom domain, 유료 리소스
- 실계약/징계/사고/분쟁 원문 저장 확대
- dedicated compliance 조치 queue 를 이미 닫힌 기능처럼 문서화하는 것

## 6. 핵심 fit-gap 질문

1. `/management` 가 일반 직원 홈이 아니라 내부관리 허브로 읽히는가
2. `/payroll` 과 `/payroll/me` 가 preview/self-only/role-split 경계를 숨기지 않는가
3. `/work-items/tax` 가 branch 제출과 HQ 검토를 같은 권한처럼 섞지 않는가
4. `/work-items/labor` 가 self/branch/restricted 경계를 같은 권한처럼 뭉개지 않는가
5. `/work-items/legal` 이 계약/갱신/분쟁 metadata 흐름과 실계약/실분쟁 처리를 같은 말처럼 적지 않는가
6. `/admin/audit-logs` 가 현재 컴플라이언스 read-only 진입점이라는 사실과 전용 조치 queue 부재를 함께 드러내는가
7. 실지급·실신고·외부 전문가 연동·민감 원문 저장 확대·production 실데이터가 아직 승인 게이트라는 점이 숨겨지지 않는가

## 7. 권장 확인 순서

1. `/dashboard`
2. `/management`
3. `/payroll`
4. `/payroll/me`
5. `/work-items/tax`
6. `/work-items/labor`
7. `/work-items/legal`
8. `/admin/audit-logs`
9. `apps/web/app/management/page.tsx`
10. `apps/web/app/payroll/page.tsx`
11. `apps/web/app/payroll/me/page.tsx`
12. `apps/web/app/work-items/work-items-config.ts`
13. `apps/api/test/auth-org.spec.ts`
14. `apps/api/test/work-items.spec.ts`

## 8. 다음 작업자에게 넘길 핵심 문장

- Phase 43의 목표는 급여·세무·노무·법무·감사 흐름을 외부 연동 없는 내부관리 도입 언어로 다시 묶는 것이다.
- 일반 직원 홈과 `경영업무` 허브를 계속 분리하는 것이 이번 문서의 첫 번째 guardrail 이다.
- `/payroll` 과 `tax/labor/legal` 은 모두 route 가 있어도 서로 다른 역할, 다른 scope, 다른 승인 게이트를 가진다.
- `/admin/audit-logs` 는 현재 컴플라이언스/감사 read-only 진입점이지, 전용 조치 시스템 완성판이 아니다.
- 실지급·실신고·외부 전문가 연동·민감 원문 저장 확대·production 실데이터는 모두 숨기면 안 되는 승인 게이트다.
