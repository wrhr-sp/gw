# Phase 60 실사용 1차 내부 사용 릴리즈 노트 + 사용자/관리자 인수인계

## 한 줄 요약
이번 Phase 60은
새 기능을 더 여는 단계가 아니라,
이미 정리된 로그인·홈·메뉴·직원 업무·관리자 업무·감사 레인을
"실사용 1차 내부 사용 릴리즈" 문장으로 다시 묶어
대장이 live URL에서 직접 눌러볼 순서와
사용자/관리자 인수인계 문장을 한 번에 넘기는 단계다.

## 이번 릴리즈에서 바로 달라진 점
- 직원용 레인, 관리자용 레인, 감사용 레인을 같은 홈 흐름처럼 적지 않도록 문장을 다시 잠갔다.
- `/dashboard` 와 `/menu` 책임 차이를 릴리즈 노트와 인수인계 기준에 같이 묶었다.
- HR_ADMIN 첫 관리자 레인은 `/management` 가 아니라 `/admin/users` 라는 기준을 다시 고정했다.
- AUDITOR 시작점은 계속 `/admin/audit-logs` read-only 레인으로 유지한다고 분명히 적었다.
- `empty / loading / error / forbidden / dev-safe` 를 사용자 설명용 문장으로 다시 정리했다.
- live URL, 테스트 계정, 역할별 추천 route, 직접 눌러볼 액션, 승인 게이트를 최종 보고에 바로 옮길 수 있게 정리했다.

## 이 문서가 하는 일
- 실사용 1차 내부 사용 릴리즈 노트를 남긴다.
- 일반 직원에게 어떤 순서로 안내할지 적는다.
- 관리자/담당자에게 어떤 순서로 안내할지 적는다.
- 대장이 live URL에서 직접 눌러볼 최소 UAT 액션을 남긴다.
- 아직 mock/dev-safe/승인 게이트인 부분을 숨기지 않고 적는다.
- 다음 ops/release 카드가 PR/CI/merge/배포 확인 때 그대로 재사용할 근거를 묶는다.

## 접속 정보와 현재 기준 근거
- live URL: `https://gw-web.wereheresp.workers.dev`
- 익명 시작점: `/login`
- 테스트 계정: `admin / 1234`
- 계정 주의: dev/test/UAT 전용이다. production 기본 계정처럼 적지 않는다.
- parent tester 최신 근거:
  - focused web tests: 28 files / 123 tests passed
  - `pnpm --filter @gw/web typecheck` 통과
  - `pnpm --filter @gw/web build` 통과
  - `pnpm --filter @gw/web build:cf` 통과
  - `pnpm --filter @gw/shared test && pnpm --filter @gw/shared typecheck` 통과
  - `pnpm --filter @gw/api test && pnpm --filter @gw/api typecheck` 통과
  - `pnpm check` 통과
- parent tester 역할별 UAT 레인 기준:
  - EMPLOYEE: `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`
  - HR_ADMIN: `/dashboard` → `/admin/users` → `/employees` → `/org` → `/me`
  - COMPANY_ADMIN: `/dashboard` → `/admin/users` → `/employees` → `/org` → `/management`
  - MANAGER: `/dashboard` → `/management` → `/payroll` → `/work-items/tax` → `/work-items/legal` → `/me`
  - AUDITOR: `/admin/audit-logs` → `/documents` → `/me`

중요:
- 이번 문서 카드에서는 live URL 직접 fetch 결과를 새로 만들지 않았다.
- 따라서 아래 내용은 "대장이 live에서 직접 눌러볼 행동 안내"와 "parent tester 재검증 근거"를 같이 담되,
  같은 확인 수준이라고 적지 않는다.

## 먼저 기억할 핵심 문장 12개
1. 로그인 전 시작점은 `/login` 뿐이다.
2. COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 기본 landing 은 `/dashboard` 다.
3. AUDITOR 의 기본 landing 은 `/admin/audit-logs` 다.
4. `/dashboard` 는 오늘 업무 시작 홈이다.
5. `/menu` 는 홈 복사본이 아니라 전체 기능 탐색 허브다.
6. HR_ADMIN 의 첫 관리자 레인은 `/management` 가 아니라 `/admin/users` 다.
7. `/management` 는 일반 직원 홈의 연장이 아니라 민감 운영 허브다.
8. `/admin/audit-logs` 는 read-only 감사 레인이다.
9. `/employees`, `/org` 는 읽기 중심 확인 레인이다.
10. `empty` 는 정상 빈 상태일 수 있고 `forbidden` 은 권한/범위 차단이다.
11. `error` 는 조회 실패고 `loading` 은 기다리는 상태다.
12. `preview` 와 `dev-safe` 는 실제 저장·실발송·실반영 완료와 같은 뜻이 아니다.

## 1. 직원용 실사용 1차 인수인계

### 직원에게 먼저 보여 줄 순서
1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/leave`
5. `/approvals`
6. `/boards`
7. `/documents`
8. `/me`
9. 필요 시 `/menu`

### 직원에게 이렇게 설명하면 된다
- `/dashboard` 는 오늘 할 일을 시작하는 홈이다.
- `/attendance` 는 출퇴근과 정정 요청 흐름을 보는 곳이다.
- `/leave` 는 휴가 신청과 상태 확인 흐름을 보는 곳이다.
- `/approvals` 는 기안, 검토, 승인/반려 흐름을 보는 곳이다.
- `/boards` 와 `/documents` 는 협업과 문서 확인 흐름이다.
- `/me` 는 세션, 내 정보, 로그아웃 확인 흐름이다.
- `/menu` 는 기능을 더 찾을 때 들어가는 탐색 허브다.

### 직원이 직접 눌러볼 최소 액션
- `/login` 에서 로그인한다.
- `/dashboard` 에서 오늘 할 일 시작점이 보이는지 본다.
- `/attendance` 에서 출퇴근/정정 관련 안내가 보이는지 본다.
- `/leave` 에서 신청/상태 확인 문장이 자연스러운지 본다.
- `/approvals` 에서 내 기안/내 승인 흐름이 끊기지 않는지 본다.
- `/boards` 에서 공지형과 일반형이 같은 책임처럼 섞이지 않는지 본다.
- `/documents` 에서 문서 공간과 파일 metadata 설명이 이해되는지 본다.
- `/me` 에서 내 정보/세션/로그아웃 흐름이 분명한지 본다.

### 직원 레인에서 꼭 같이 볼 차단 질문
- `/management` 나 `/admin*` 가 직원 기본 레인처럼 보이지 않는가
- `forbidden` 이 로그인 실패나 네트워크 오류처럼 보이지 않는가
- `empty` 가 오류처럼 과장되지 않는가
- `dev-safe` 문구가 실제 저장 완료처럼 보이지 않는가

## 2. 관리자/담당자용 실사용 1차 인수인계

### 관리자에게 먼저 보여 줄 순서
1. `/login`
2. `/dashboard`
3. HR_ADMIN 이면 `/admin/users`
4. COMPANY_ADMIN 또는 MANAGER 이면 `/management`
5. 필요 시 `/employees`
6. 필요 시 `/org`
7. 필요 시 `/payroll`
8. 필요 시 `/work-items/tax`
9. 필요 시 `/work-items/labor`
10. 필요 시 `/work-items/legal`
11. 필요 시 `/admin/audit-logs`
12. `/me`

### 역할별 핵심 해석
#### HR_ADMIN
- `/admin/users` 가 첫 관리자 레인이다.
- 계정/권한/상태 변경 preview 를 읽는 흐름으로 본다.
- `/management` 를 HR_ADMIN 기본 시작점처럼 적지 않는다.

#### COMPANY_ADMIN
- `/dashboard` 뒤 `/management` 로 넘어가 운영 허브를 본다.
- 필요 시 `/admin/users`, `/employees`, `/org` 를 같이 본다.
- 회사 범위 운영과 읽기 조회를 같은 책임으로 적지 않는다.

#### MANAGER
- `/management` 가 운영 시작점이다.
- `/payroll`, `tax/labor/legal` 는 민감 업무 레인으로 읽는다.
- 직원 홈과 같은 일반 탐색 흐름처럼 적지 않는다.

#### AUDITOR
- `/admin/audit-logs` 가 시작점이다.
- 계속 read-only 감사 레인이다.
- `/management` 를 auditor 기본 허용 레인처럼 적지 않는다.

### 관리자/담당자가 직접 눌러볼 최소 액션
- `/dashboard` 에서 관리자 전용 다음 행동이 자연스럽게 보이는지 확인한다.
- HR_ADMIN 은 `/admin/users` 에서 계정/권한 검토 문장을 확인한다.
- COMPANY_ADMIN/MANAGER 는 `/management` 에서 민감 운영 허브 문장을 확인한다.
- `/employees`, `/org` 에서는 읽기 확인과 운영 변경이 섞이지 않는지 본다.
- `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 에서는 실업무 레인과 승인 게이트 문장이 함께 보이는지 본다.
- `/admin/audit-logs` 에서는 read-only / masked / 감사 레인 문장이 유지되는지 본다.
- `/me` 에서는 관리자도 세션·개인 확인 흐름으로 읽는지 본다.

## 3. 상태 문장을 이렇게 읽으면 된다
- `loading`: 아직 불러오는 중이다. 성공/실패로 적지 않는다.
- `empty`: 지금 보여 줄 데이터가 비어 있을 수 있다. 오류로 단정하지 않는다.
- `error`: 조회 또는 불러오기가 실패했다. 권한 문제와 섞지 않는다.
- `forbidden`: 권한 또는 범위 차단이다. 로그인 실패와 섞지 않는다.
- `offline`: 네트워크 또는 연결 문제 복구 문장이다. 이번 레인의 업무 완료 문장이 아니다.
- `preview` / `dev-safe`: 데모·검토·내부 확인용일 수 있다. 실제 저장/실발송/실반영 완료로 적지 않는다.

## 4. 대장이 live URL에서 직접 눌러볼 추천 순서

### 가장 짧은 공통 확인
1. `/login`
2. `/dashboard`
3. `/menu`
4. `/me`

### 직원 happy path 확인
1. `/dashboard`
2. `/attendance`
3. `/leave`
4. `/approvals`
5. `/boards`
6. `/documents`
7. `/me`

### 관리자 happy path 확인
1. `/dashboard`
2. HR_ADMIN 이면 `/admin/users`
3. COMPANY_ADMIN/MANAGER 이면 `/management`
4. `/employees`
5. `/org`
6. `/payroll`
7. `/work-items/tax`
8. `/work-items/labor`
9. `/work-items/legal`
10. `/admin/audit-logs`

### 감사 happy path 확인
1. `/admin/audit-logs`
2. `/documents`
3. `/me`

## 5. 기능별로 최종 보고에 남길 기록 포인트
각 route 또는 기능마다 아래를 남기면 된다.
- 경로
- 누가 눌렀는지
- happy path 가 이어졌는지
- forbidden 이 맞게 차단되는지
- empty 가 정상 빈 상태로 읽히는지
- loading 이 기다리는 상태로 읽히는지
- error 가 다른 상태와 섞이지 않는지
- mock/dev-safe/read-only 잔여가 있는지
- live 직접 확인인지, parent/local 대체 근거인지

## 6. 이번 실사용 1차 릴리즈에서 바로 말할 수 있는 것
- 로그인 시작점은 `/login` 하나로 잠겨 있다.
- 직원 레인과 관리자 레인을 같은 홈 흐름처럼 적지 않는 기준이 정리돼 있다.
- HR_ADMIN, COMPANY_ADMIN, MANAGER, AUDITOR 의 다음 레인 설명이 다시 정리돼 있다.
- `/dashboard`, `/menu`, `/management`, `/admin/users`, `/admin/audit-logs`, `/me` 상태 문장을 같은 언어로 읽을 기준이 있다.
- 대장이 직접 눌러볼 route 와 질문을 바로 쓸 수 있다.

## 7. 아직 같이 적어야 하는 제한과 승인 게이트
- production DB 실데이터 변경
- 실제 사용자 초대 메일 발송
- 실제 비밀번호 운영 전환
- 외부 IdP/SSO/SAML/SCIM
- 실제 급여 지급/은행 이체
- 외부 세무/노무/법무/회계/기관 계정 연동
- secret 입력/교체
- DNS/custom domain
- 유료 리소스
- migration
- destructive 작업

중요:
- 위 항목은 이번 실사용 1차 내부 사용 릴리즈 완료와 같은 뜻이 아니다.
- 문서와 최종 보고에는 "지금 가능한 것"과 "별도 승인 필요"를 꼭 나눠 적는다.

## 8. 다음 작업자(gwops / 최종 보고)에게 넘길 핵심 문장
- live URL 은 `https://gw-web.wereheresp.workers.dev` 로 적는다.
- 테스트 계정은 `admin / 1234` 이고 dev/test/UAT 전용이라고 같이 적는다.
- 직원 레인은 `/dashboard` 중심으로, 관리자 레인은 `/management` 또는 `/admin/users` 중심으로 적는다.
- AUDITOR 시작점은 `/admin/audit-logs` 로 적는다.
- live 직접 확인 근거와 parent tester/local build/test/release gate 근거를 같은 줄에 섞지 않는다.
- mock/dev-safe/read-only 잔여는 숨기지 않고 같이 적는다.
- 승인 게이트는 기능 문제처럼 적지 말고 별도 승인 항목으로 분리한다.

## 9. 최종 보고 템플릿
- 결론:
- live URL:
- 로그인 시작점:
- 테스트 계정:
- 직원 추천 route:
- 관리자 추천 route:
- 감사 추천 route:
- 직접 눌러본 액션:
- happy path 요약:
- 권한 차단/상태 문장 요약:
- mock/dev-safe/read-only 잔여:
- parent/local 대체 근거:
- 별도 승인 게이트:

## 10. 같이 보면 좋은 문서
- `docs/guides/phase-59-uat-user-admin-adoption-guides-final.md`
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-adoption-checklist.md`
- `docs/guides/phase-58-state-copy-recovery-role-lane-guide.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `TEST_PLAN.md`
- `KNOWN_ISSUES.md`
