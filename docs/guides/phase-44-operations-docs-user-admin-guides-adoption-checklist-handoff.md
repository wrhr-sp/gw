# Phase 44 운영문서·사용자가이드·관리자가이드·도입 체크리스트 handoff

## 1. 이번 Phase를 한 줄로 말하면
이번 Phase는
이미 있는 그룹웨어 화면과 권한 경계를
직원용 안내, 관리자용 안내, 운영자 runbook, 권한표, 도입 체크리스트로 묶어
회사 내부 도입 기준선으로 정리하는 단계다.

쉽게 말하면,

- 직원은 어디부터 써야 하는지,
- 관리자는 어디까지 볼 수 있는지,
- 운영자는 무엇을 먼저 점검해야 하는지,
- 아직 승인 없이는 하면 안 되는 것이 무엇인지,

이 네 가지를 한 번에 헷갈리지 않게 만드는 문서다.

## 2. 이번 Phase에서 꼭 지켜야 할 제품 문장
- 대시보드 = 홈이다.
- 직원 기본 업무는 `/dashboard` 중심으로 읽고, `/attendance`·`/leave`·`/approvals`·`/boards`·`/documents` 가 그 다음 레인이다.
- `경영업무`(`/management`) 는 일반 직원 홈과 다른 민감 운영 허브다.
- 급여·세무·노무·법무·감사 흐름은 지정된 관리자/담당자만 읽는 내부관리 레인이다.
- 단순 메뉴 숨김이 아니라 route guard, API guard, company+branch scope, audit log 근거를 함께 설명해야 한다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정처럼 적지 않는다.
- 실지급, 은행이체, 주민번호/계좌번호 확대, production DB 실데이터, 외부 기관/전문가 연동, DNS/custom domain, 유료 리소스, migration, destructive 작업은 모두 승인 게이트다.

## 3. 역할별 추천 도입 레인

### A. 일반 직원 레인
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/notifications`
- `/me`

읽는 포인트:
- 어디서 하루 업무를 시작하는지
- 관리자/경영업무 화면이 직원 기본 레인과 섞이지 않는지
- 안 되는 일과 승인 필요한 일이 숨겨지지 않는지

### B. 관리자 / 담당자 레인
- `/dashboard`
- `/management`
- `/work-items/branch`
- `/payroll`
- `/payroll/me`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin/audit-logs`

읽는 포인트:
- 일반 홈과 민감 운영 허브가 분리되는지
- preview/self-only/branch/company/restricted/read-only 경계가 흐리지 않은지
- 담당 모듈별 책임이 같은 말처럼 뭉개지지 않는지

### C. 감사 / 점검 레인
- `/dashboard`
- `/management` 설명 확인
- `/admin/audit-logs`
- 관련 approval gate 확인

읽는 포인트:
- 현재 감사/컴플라이언스 진입이 read-only 인지
- dedicated 조치 시스템이 이미 닫힌 것처럼 과장되지 않는지
- 승인 게이트와 실제 운영 가능 범위가 분리돼 있는지

## 4. builder에게 바로 넘길 구현 포인트

2026-06-17 builder 구현 결과 문서:
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-operator-runbook.md`
- `docs/guides/phase-44-role-access-matrix.md`
- `docs/guides/phase-44-adoption-checklist.md`

### A. 직원용 가이드
- 로그인부터 시작하는 기본 흐름을 쉬운 말로 정리한다.
- `/dashboard` 다음에 무엇을 보는지 순서를 고정한다.
- `경영업무`/`/admin*` 는 일반 직원 기본 안내에서 분리한다.

### B. 관리자용 가이드
- `/management` 를 운영 허브로 설명한다.
- `/payroll`, `/payroll/me`, `/work-items/tax|labor|legal`, `/admin/audit-logs` 를 역할별 책임 기준으로 나눈다.
- read-only/preview/self-only/restricted 경계를 눈에 띄게 적는다.

### C. 운영자 runbook
- 도입 전 준비
- 도입 중 점검
- 도입 후 정리
- blocker/approval-needed 기록 방식
이 네 묶음으로 정리한다.

### D. 권한표
최소 포함 축:
- 역할
- 허용 route
- 차단 route
- scope 기준
- 승인 게이트/placeholder 비고

### E. 도입 체크리스트
최소 3단계:
1. 사전 준비
2. 역할별 시나리오 점검
3. 승인 게이트 확인

## 5. reviewer가 봐야 할 핵심 질문
1. 직원용 문서에 관리자/민감 운영 레인이 섞여 있지 않은가
2. 관리자용 문서가 실제 route guard/API guard/scope 와 충돌하지 않는가
3. `admin / 1234` 가 production 기본 계정처럼 보이지 않는가
4. 실지급·실신고·실계약·외부 연동·production 실데이터가 이미 가능한 것처럼 과장되지 않는가
5. approval-needed / placeholder / blocked 분류가 문서마다 같은 뜻인가

## 6. tester가 바로 따라갈 확인 순서
1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/leave`
5. `/approvals`
6. `/boards`
7. `/documents`
8. `/management`
9. `/work-items/branch`
10. `/payroll`
11. `/payroll/me`
12. `/work-items/tax`
13. `/work-items/labor`
14. `/work-items/legal`
15. `/admin/audit-logs`

같이 볼 질문:
- 문서 설명과 실제 route 책임이 같은가
- 직원 레인과 민감 운영 레인이 섞이지 않는가
- approval gate 가 빠지지 않았는가

## 7. docs/ops가 이어받아야 할 정리 포인트
- 최종 사용자 보고에는 live URL, 추천 route 순서, 테스트 계정, 역할별 시나리오, 남은 승인 게이트를 넣는다.
- 문서화 단계에서는 쉬운 한국어 우선, 과장 금지, 승인 게이트 분리를 유지한다.
- ops 단계에서는 Phase 45 최종검증 카드에서 실제 검증 기준으로 바로 재사용할 수 있게 checklist wording 을 유지한다.

## 8. 이번 Phase에서 하지 않는 것
- 실제 급여 지급/은행 이체
- 주민번호/계좌번호 확대 입력
- production DB 실데이터 반영
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- 법령 API 인증키 등록
- DNS/custom domain
- 유료 리소스 증설
- migration
- destructive/force 작업

## 9. 관련 근거 문서
- `docs/architecture/phase-44-operations-docs-user-admin-guides-adoption-checklist-fit-gap-scope.md`
- `docs/architecture/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-scope.md`
- `docs/architecture/phase-42-attendance-leave-hr-branch-operations-adoption-fit-gap-scope.md`
- `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
- `HANDOFF.md`
- `TASKS.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `KNOWN_ISSUES.md`

## 10. 현재 체인
1. Phase 44 기획·fit-gap: `t_b4d63b74` — 도담(`gwplanner`) — 현재 카드
2. Phase 44 구현: `t_5142bc72` — 이룸(`gwbuilder`) — 부모 대기
3. Phase 44 리뷰: `t_6123cd3a` — 바름(`gwreviewer`) — 부모 대기
4. Phase 44 테스트: `t_f1c5e044` — 해봄(`gwtester`) — 부모 대기
5. Phase 44 문서화: 후속 카드 연결 예정/또는 기존 체인에 따라 진행
6. Phase 45 최종검증: Phase 44 마감 후 별도 체인에서 시작
