# Phase 46 계정·권한·조직 온보딩 리허설 handoff

## 1. 이번 Phase를 한 줄로 말하면
이번 Phase는 `/admin/users`·`/employees`·`/org`·`/management`·`/work-items/branch` 를
"사람을 회사 안에 태우고, 역할을 주고, 조직에 배정하고, 필요한 운영 레인으로 보내는 흐름" 기준으로 다시 묶는 단계다.

쉽게 말하면,

- 운영자는 누구를 어디서 만들고 어떤 권한을 주는지,
- 로그인 직후 공통 홈과 역할별 다음 레인이 어떻게 갈라지는지,
- 무엇이 아직 dev-safe preview 이고 무엇이 내부 도입 직전 기준인지,

이 세 가지를 한 번에 헷갈리지 않게 만드는 문서다.

## 2. 이번 Phase에서 꼭 지켜야 할 제품 문장
- 익명 시작점은 계속 `/login` 뿐이다.
- 일반 직원의 기본 홈은 계속 `/dashboard` 다.
- COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 로그인 직후 공통 landing 은 `/dashboard` 다.
- 인사/계정관리 운영은 공통 홈(`/dashboard`) 뒤 admin host 에서 `/admin/users` 로 이어지는 다음 레인이다.
- 운영 관리자/지점 관리자 레인은 공통 홈(`/dashboard`) 뒤 general host 에서 `/management` 로 이어지는 다음 레인이다.
- 감사 전용 시작점은 `/admin/audit-logs` read-only 흐름이다.
- `/employees` 와 `/org` 는 읽기 중심 일반 조회다.
- `/admin/users` 는 실제 저장 완료 화면이 아니라 dev-safe preview 중심 운영 검토 화면이다.
- 계정 생성/권한 변경/상태 변경/비밀번호 초기화는 route/API guard, company+branch scope, high-risk permission, audit candidate 와 같이 읽어야 한다.

## 3. 역할별 추천 도입 레인

### A. 일반 직원 기본 레인
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/me`

읽는 포인트:
- 계정이 열리면 먼저 어디서 하루 업무를 시작하는지
- 관리자 레인(`/management`, `/admin*`)이 기본 흐름에 섞이지 않는지
- 조직/직원 조회는 마무리 확인 레인으로 읽히는지

### B. HR / 계정관리 운영 레인
- `/login`
- `/dashboard`
- admin host `/admin/users`
- `/employees`
- `/org`
- 필요 시 admin host `/admin/audit-logs`

읽는 포인트:
- 사용자 생성 preview 뒤 일반 업무 route 후보를 어디서 확인하는지
- 역할/권한 diff 와 고위험 권한 후보를 어디서 같이 보는지
- `/employees` 일반 조회와 `/admin/users` 운영 검토가 다른 책임으로 읽히는지

### C. 운영 관리자 / 지점 관리자 레인
- `/login`
- `/dashboard`
- general host `/management`
- `/work-items/branch`
- `/payroll`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`

읽는 포인트:
- 계정이 열려도 운영 레인은 계속 `/management` 아래에서만 읽히는지
- branch scope 와 company scope 가 계정관리 문맥과 섞이지 않는지
- 일반 직원 홈과 민감 운영 허브가 분리되는지

### D. 감사 / 컴플라이언스 레인
- `/login`
- admin host `/admin/audit-logs`
- 필요 시 `/dashboard` 읽기 참고
- 필요 시 `/employees`, `/org` 읽기 확인

읽는 포인트:
- read-only 감사 흐름이 운영 변경 레인과 섞이지 않는지
- AUDITOR 를 전체 관리자처럼 설명하지 않는지
- audit candidate 와 실제 변경 완료를 같은 뜻으로 쓰지 않는지

## 4. 이번 Phase에서 바로 이어받아야 할 구현 포인트

### A. 계정 생성 preview
- `/admin/users` 의 생성 preview 는 실저장 없이 이름/이메일/부서/초기 역할 후보를 보여 주는 흐름으로 유지한다.
- 생성 뒤 바로 확인할 일반 업무 route 후보를 `/boards`·`/documents`·`/attendance` 같은 실제 업무 화면으로 연결한다.
- 실제 초대 메일 발송이나 production 계정 배포처럼 보이게 쓰지 않는다.

### B. 역할 / 업무권한 diff
- 역할 변경 preview 는 어떤 route 가 열리거나 막히는지 바로 이어 읽게 한다.
- HR_ADMIN 은 로그인 직후 `/dashboard` 를 거친 뒤 admin host `/admin/users` 계열에서 다음 레인을 시작한다는 기준을 계속 유지한다.
- `audit.read`, `attendance.manage`, `leave.approve`, `board.manage`, `document.space.manage` 같은 고위험/운영 권한은 일반 직원 홈과 섞지 않는다.

### C. 활성 / 비활성 / 오프보딩
- 상태 변경은 실제 저장보다 영향 범위 preview 가 먼저 읽혀야 한다.
- 비활성 뒤 어떤 업무가 막히는지, 일반 업무/운영 업무/감사 흐름이 각각 어떻게 달라지는지 설명한다.
- offboarded 상태를 실제 인사 종료 확정이나 production 반영처럼 적지 않는다.

### D. 비밀번호 초기화
- 비밀번호 reset preview 는 dev/test/UAT 용 안내로만 읽힌다.
- 실제 프로덕션 기준 비밀번호 값이 URL, 배너, 문서 예시에 오래 남지 않게 해야 한다.
- production 비밀번호 정책, 외부 IdP, 실제 비밀번호 배포는 이 범위에 넣지 않는다.

### E. 조직 / 지점 / 부서 연결
- `/employees` 는 읽기 중심 직원 조회다.
- `/org` 는 부서/역할/지점 구조를 읽는 화면이다.
- `/work-items/branch` 는 `경영업무` 아래 지점 운영 레인으로 유지한다.
- 조직/지점 배정을 실제 저장 완료처럼 설명하지 않고, 현재 read model + 운영 리허설 기준으로 설명한다.

## 5. 현재 구현 근거 파일

### web 근거
- `apps/web/app/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/users/admin-users-page-content.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/org/page.tsx`

### API / shared / test 근거
- `apps/api/src/app.ts`
- `apps/api/src/lib/operational-org.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/web/work-items.test.tsx`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`

### 루트 문서 근거
- `ROADMAP.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `KNOWN_ISSUES.md`
- `HANDOFF.md`

## 6. 이번 Phase 구현/리뷰/테스트가 꼭 물어야 할 질문
1. `/admin/users` 가 실제 저장 완료 화면이 아니라 dev-safe 운영 검토 화면으로 읽히는가
2. COMPANY_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE 는 `/dashboard`, AUDITOR 는 `/admin/audit-logs` 라는 로그인 직후 landing 기준이 문서/화면/테스트에서 같은 뜻인가
3. HR_ADMIN 은 admin host `/admin/users`, MANAGER/COMPANY_ADMIN 은 general host `/management`, AUDITOR 는 admin host `/admin/audit-logs` 로 다음 레인이 분리되는가
4. `/employees` 일반 조회와 `/admin/users` 운영 검토가 서로 다른 책임으로 읽히는가
5. 사용자 생성 뒤 일반 업무 첫 화면, 역할 변경 뒤 운영 레인, 감사 사용자 read-only 레인이 각각 분리되는가
6. 비활성/비밀번호 초기화 preview 가 실제 production 조치처럼 오해되지 않는가
7. route guard, API guard, company+branch scope, high-risk permission, audit candidate 설명이 서로 다른 말을 하지 않는가
8. 외부 IdP/초대 발송/production 비밀번호/실데이터 저장이 아직 승인 게이트라는 점이 숨겨지지 않는가

## 7. 현재 Kanban 체인
1. Phase 45 최종 통합 보고 완료: `t_ee8380f5` — 싱드(`singde`) — 완료
2. Phase 46 기획·fit-gap: `t_9bb90fee` — 도담(`gwplanner`) — 현재 카드
3. Phase 46 구현: `t_c59b2bbb` — 이룸(`gwbuilder`) — 부모 대기
4. Phase 46 리뷰: `t_436b2418` — 바름(`gwreviewer`) — 부모 대기
5. Phase 46 테스트: `t_c98a8706` — 해봄(`gwtester`) — 부모 대기
6. Phase 46 문서화: `t_897780bf` — 다온(`gwdocs`) — 부모 대기
7. Phase 46 GitHub PR/CI/merge/branch cleanup: `t_502529de` — 지킴(`gwops`) — 부모 대기

상위 parent 메모:
- live URL 은 `https://gw-web.wereheresp.workers.dev` 이다.
- dev/test/UAT 전용 테스트 계정은 `admin / 1234` 다.
- main release-gate 성공과 merge commit `fd5239e2e36848e711d918d45994382bf4616b39` 이 Phase 45 기준선이다.
- blocked remediation fix/review/verify/recovery 이후 확인된 focused web 재검증 기준은 24 files / 102 tests passed 다.

## 8. 완료 판단 기준
- 운영자가 계정 생성/권한 변경/상태 변경/비밀번호 초기화 흐름을 어느 화면에서 어떤 순서로 확인할지 바로 따라갈 수 있다.
- 일반 직원 홈, HR 계정관리, 운영 관리자, 감사 read-only 흐름이 서로 섞이지 않는다.
- `/employees`·`/org`·`/work-items/branch` 와 `/admin/users` 의 책임 차이가 문서와 코드에서 같은 뜻이다.
- 다음 구현/리뷰/테스트/문서화 작업자가 어떤 route 와 검증을 먼저 봐야 하는지 바로 알 수 있다.

## 9. 아직 남겨 두는 승인 게이트
- 실제 사용자 초대 발송
- 외부 IdP/SSO/SAML/SCIM 연동
- production 기본 계정/실사용 비밀번호 배포
- 주민번호/계좌번호 등 민감 원문 확대
- production DB 실데이터 전환/seed/migration
- 실제 급여 지급, 은행 이체, 기관 신고
- DNS/custom domain, 유료 리소스, secret 교체, destructive 작업
