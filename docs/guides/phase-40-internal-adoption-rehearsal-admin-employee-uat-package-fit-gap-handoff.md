# Phase 40 내부 도입 리허설·관리자/직원 UAT 패키지 handoff

## 1. 이번 Phase를 한 줄로 말하면

이번 Phase 40은
"지금 있는 제품을 가지고 내부 도입 리허설을 어떻게 돌릴지"
를 직원/승인자/관리자/감사 담당자 관점으로 다시 묶는 단계다.

즉 새 외부 연동을 여는 단계가 아니라,
어떤 계정으로 어디부터 눌러보고,
어떤 이슈를 blocker/major/minor/approval-needed 로 적고,
최종 보고에 무엇을 남겨야 하는지
같은 언어로 이어받게 만드는 단계다.

## 2. 이번 Phase에서 꼭 지켜야 할 제품 문장

- `admin / 1234` 는 dev/test/UAT 전용 계정이지 production 기본 계정이 아니다.
- `/uat` 는 리허설 참가자가 가장 먼저 보는 실행 패키지 route 이며, 익명 general host 접근은 `/login` 으로 redirect 된다.
- 일반 직원 흐름은 `/dashboard` 중심이고, 민감 운영 흐름은 `/management`·`/admin*` 로 분리한다.
- 관리자 UAT 라고 해도 경영업무 담당자 레인과 감사/운영 레인을 같은 뜻으로 쓰지 않는다.
- forbidden, error, empty, offline 은 각각 다른 상태이며 UAT 기록표에서도 분리해 적는다.
- 권한 누출, company+branch scope 누출, foreign/self 차단 실패는 단순 불편이 아니라 blocker 급 질문으로 본다.
- raw 민감정보, 실데이터, 외부 연동, 실지급, production 변경은 계속 승인 게이트다.

## 3. 역할별 추천 UAT 레인

### A. 일반 직원 레인
- `/login`
- `/uat`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/me`

핵심 질문:
- 오늘 할 일과 상태를 바로 이해할 수 있는가
- 권한 없는 운영 화면으로 새지 않는가
- empty/error/offline 이 같은 뜻처럼 보이지 않는가

### B. 승인자/팀장 레인
- `/dashboard`
- `/approvals`
- 필요 시 `/attendance`, `/leave` 상태 확인

핵심 질문:
- 승인 대기와 자기 scope 가 자연스럽게 읽히는가
- self-approval 금지와 forged 접근 차단이 유지되는가

### C. 경영업무 담당자 레인
- `/dashboard`
- `/management`
- `/payroll`
- `/payroll/me`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- 필요 시 `/work-items/branch`

핵심 질문:
- 급여/세무/노무/법무/지점 업무 책임이 서로 섞이지 않는가
- preview/skeleton 과 실운영을 같은 말로 쓰지 않는가
- branch/company scope 와 restricted 경계가 유지되는가

### D. 운영자/감사 레인
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/offline`

핵심 질문:
- 일반 host 와 admin host 경계가 섞이지 않는가
- `AUDITOR`, `HR_ADMIN`, `COMPANY_ADMIN` 차이가 흐려지지 않는가
- audit 이 read-only/masked preview 로 유지되는가

## 4. UAT 패키지에 꼭 들어가야 할 4개 묶음

1. 접속 정보
- live URL: `https://gw-web.wereheresp.workers.dev`
- 시작 route: `/uat`
- 테스트 계정: `admin / 1234`
- dev/test/UAT 전용 안내

2. 시나리오 카드
- 역할
- 시작 route
- 직접 해볼 액션
- happy path 포인트
- forbidden/empty/error/offline 포인트

3. 이슈 기록 규칙
- blocker
- major
- minor
- copy-doc
- approval-needed

4. 교육/진행 자료 초안
- 진행자용 설명 순서
- 참가자용 빠른 시작 순서
- 종료 후 수정 우선순위 기준

## 5. 이번 Phase에서 바로 이어받아야 할 구현/검토 포인트

### A. 시나리오는 route 나열이 아니라 역할별 행동 순서여야 한다
- 직원 시나리오는 `/dashboard` 중심 일반 업무 흐름으로 적는다.
- 운영 시나리오는 `/management` 또는 `/admin*` 로 따로 시작한다.
- 같은 계정을 써도 역할 문맥은 섞지 않는다.

### B. blocker 와 approval-needed 를 같은 버그 목록으로 넣지 않는다
- blocker 는 현재 범위 안에서 고쳐야 할 제품/권한/상태/guard 문제다.
- approval-needed 는 실데이터, 외부 연동, production 변경처럼 별도 승인 없이는 진행하면 안 되는 항목이다.

### C. 상태 문구는 UAT 성공 판정의 일부다
- forbidden 은 로그인 실패가 아니라 권한/범위 부족이다.
- empty 는 정상인데 비어 있는 상태다.
- error 는 실패다.
- offline 은 읽기/복구 안내 상태다.
- 이 네 가지를 섞으면 major 이상으로 본다.

### D. 민감 모듈 설명은 항상 "지금 되는 것/아직 안 되는 것"을 같이 적는다
- `/payroll` 은 관리자 preview 흐름이다.
- `/payroll/me` 는 self-only payslip preview 흐름이다.
- `tax`·`labor`·`legal` 은 공통 work item 기반 skeleton/metadata 흐름이 남아 있다.
- `/admin/audit-logs` 는 현재 컴플라이언스/감사 read-only 진입점이다.

## 6. 현재 근거 파일

### 문서 기준
- `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`
- `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`
- `docs/architecture/phase-33-attendance-leave-approvals-real-usage-scope.md`
- `docs/guides/phase-33-attendance-leave-approvals-real-usage-handoff.md`
- `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`
- `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`
- `docs/architecture/phase-36-admin-settings-company-policy-permission-fit-gap-scope.md`
- `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md`
- `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`
- `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md`
- `docs/architecture/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-scope.md`
- `docs/guides/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-handoff.md`
- `docs/architecture/phase-39-operational-qa-security-audit-permission-regression-fit-gap-scope.md`
- `docs/guides/phase-39-operational-qa-security-audit-permission-regression-fit-gap-handoff.md`
- `docs/architecture/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-scope.md`

### web 근거
- `apps/web/app/uat/page.tsx`
- `apps/web/app/uat/uat-package-config.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/middleware.ts`
- `apps/web/app/offline/page.tsx`
- `apps/web/app/me/page.tsx`

### test 근거
- `apps/web/phase40-uat-package.test.tsx`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/phase38-offline-admin.test.tsx`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`

## 7. 현재 Kanban 체인

- 재검증: `t_cc4b8957` Phase 40 재검증 — 완료
- 문서화: `t_a627fd5c` Phase 40 문서화 — 현재 카드
- release gate: `t_de5fe53c` Phase 40 GitHub PR/CI/merge/branch cleanup — 다음 단계
- 최종 보고: `t_12730723` Phase 40 최종 통합 보고 — release gate 이후

parent 재검증 메모:
- 익명 general host `/uat` 접근은 `/login` 으로 redirect 된다.
- 로그인 세션에서는 `/uat` 접근이 허용된다.
- focused Phase 40 guard/middleware 테스트 22개 파일·94개 테스트가 통과했다.

## 8. 다음 작업자가 빠르게 판단해야 할 질문

- 직원/승인자/경영업무 담당자/운영자 레인이 서로 섞이지 않는가
- `/uat` 에 있는 역할별 시나리오 카드, 이슈 기록 템플릿, 진행자용 설명 순서가 루트 문서와 같은 뜻인가
- UAT 시나리오가 단순 route 나열이 아니라 실제 행동 순서로 읽히는가
- blocker / major / minor / copy-doc / approval-needed 분류가 명확한가
- happy path 와 forbidden/empty/error/offline 확인 포인트를 각 역할별로 적을 수 있는가
- 권한 누출, foreign/self 차단 실패, raw 민감정보 노출을 blocker 로 다루는가
- final report 에 live URL, 계정, 시나리오, 남은 승인 게이트를 분리해 적을 수 있는가

## 9. 이번 Phase의 완료 판단 기준

다음 조건이 동시에 맞아야 "이번 Phase가 정리됐다"고 볼 수 있다.

1. scope 문서와 handoff 문서가 정리되어 있다.
2. 역할별 UAT 레인과 추천 순서가 루트 문서에도 반영되어 있다.
3. blocker/major/minor/approval-needed 구분이 문서상 고정돼 있다.
4. 최종 보고에 들어갈 live URL, `/uat`, 계정, 시나리오, 승인 게이트 기준이 미리 정리돼 있다.
5. 후속 구현/리뷰/테스트 작업자가 같은 언어를 그대로 이어받을 수 있다.

## 10. 아직 남겨 두는 승인 게이트

- production secret/실계정/실데이터
- 실제 급여 지급, 은행 이체, 주민번호/계좌번호 확대
- 홈택스/4대보험/회계/세무사/노무사/변호사/기관 외부 연동
- raw 민감 원문 저장 확대
- custom domain/DNS
- native app release/store 배포
- migration/destructive 작업

이번 handoff 이후 구현/리뷰/테스트는 이 게이트를 넘지 않는 범위에서만 움직여야 한다.
