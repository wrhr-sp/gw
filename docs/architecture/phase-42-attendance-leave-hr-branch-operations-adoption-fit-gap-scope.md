# Phase 42 근태·휴가·인사·지점 운영 도입완성 fit-gap 범위

## 1. 한 줄 결론

이번 Phase 42는 `/attendance`·`/leave`·`/employees`·`/org`·`/work-items/branch` 를 따로따로 있는 화면이 아니라, 외부 연동 없이도 회사 내부 도입이 가능한 근태·휴가·인사·지점 운영 흐름으로 다시 묶는 단계다.

핵심은 세 가지다.

1. 일반 직원 기본 흐름은 `/dashboard` 에서 시작해 `/attendance` → `/leave` → 필요 시 `/org`·`/employees` 조회로 이어지게 읽힌다.
2. 운영자/관리자 흐름은 `/management` 와 `/work-items/branch`, `/admin/policies`, `/admin/audit-logs` 에서 따로 읽혀야 한다.
3. 태그 단말, GPS, 실제 외부 HR/급여/세무/노무 시스템, production 실데이터는 아직 승인 게이트라는 점을 숨기지 않는다.

## 2. 왜 지금 이 Phase가 필요한가

- Phase 41에서 게시판·공지·문서·결재를 "직원이 매일 쓰는 협업 기본 업무" 언어로 다시 묶었다.
- 다음 단계인 Phase 42에서는 그 앞단의 기본 운영 업무인 출퇴근, 휴가, 직원/조직 조회, 지점 운영 흐름을 같은 수준으로 닫아야 한다.
- 현재 구현 흔적은 이미 넓게 존재하지만, 화면 설명과 루트 문서 언어가 아직 "실사용 가능한 내부 도입 흐름"으로 완전히 정리되지는 않았다.
- 특히 근태/휴가는 일반 직원이 가장 먼저 체감하는 업무이고, 인사/조직/지점 운영은 관리자와 지점 책임자가 가장 자주 확인하는 운영 흐름이므로 두 레인을 섞지 않고 다시 정리할 필요가 있다.

이번 Phase의 목적은 새 외부 연동을 여는 것이 아니라, 이미 있는 route/API/test 근거를 기준으로 "지금 내부에서 어디까지 바로 도입 가능한가"를 명확히 고정하는 것이다.

## 3. 현재 확인된 구현 근거

기획 근거는 문서 검색이 아니라 실제 코드/화면/API 테스트 흔적을 같이 보고 정리했다.

### 3-1. 근태/출퇴근 근거

- `apps/web/app/attendance/page.tsx`
  - 출퇴근 화면이 이미 존재한다.
  - 정책 미허용 방식, 태그 단말 예정, 운영 안내를 같은 화면에서 분리해 보여 주는 구조가 있다.
- `apps/api/test/auth-org.spec.ts`
  - `attendance` 관련 schema 와 check-in/check-out/correction/list records 검증이 있다.
  - 허용되지 않은 출퇴근 등록 방식은 성공처럼 보이지 않고 정책 기준으로 차단되는 테스트 흔적이 있다.
  - employee scope 에 먼저 적용되는 유효 정책을 기준으로 등록 방식이 검증되는 흐름이 있다.
- `apps/web/app/admin/policies/page.tsx`
  - 회사 기본 → 근무지/지점 → 부서/팀 → 직무/역할 우선순위 설명이 있다.

### 3-2. 휴가/승인 대기 근거

- `apps/web/app/leave/page.tsx`
  - 휴가 신청/조회 화면이 이미 존재한다.
  - 잔여 휴가, 신청 상태, 정책 설명을 같이 읽게 하는 구조가 있다.
- `apps/api/test/auth-org.spec.ts`
  - leave policy summary 와 허용 휴가 코드, 휴가 승인 관련 응답 schema 검증이 있다.
  - self/company scope/권한 경계를 approvals 흐름과 이어서 읽을 수 있는 테스트 자산이 남아 있다.

### 3-3. 직원/조직/권한 조회 근거

- `apps/web/app/employees/page.tsx`
  - 직원 목록/요약/필터/notice 를 읽는 화면이 이미 있다.
- `apps/web/app/org/page.tsx`
  - 부서/역할/권한/지점 scope 응답을 same-origin API 와 연결해 읽는 구조가 있다.
- `apps/web/app/_components/phase34-live-sections.tsx`
  - `EmployeeDirectoryLiveSection`, `OrgDirectoryLiveSection` 이 각각 `appRoutes.org.employees`, `departments`, `roles`, `permissions`, `branches` 를 직접 조회한다.
- `apps/api/test/auth-org.spec.ts`
  - employee directory summaries, filters, admin-boundary notices 검증이 있다.
  - 일반 viewer 에게 admin-only role 이 직원 디렉터리에서 섞여 보이지 않게 막는 테스트가 있다.
  - 잘못된 filter 입력이 500 이 아니라 validation error 로 떨어지는 검증이 있다.
  - branch summaries 가 role-aware scope 로 반환되는 테스트가 있다.

### 3-4. 지점 운영/branch scope 근거

- `apps/web/app/management/page.tsx`
  - `지점 운영` 카드를 `/work-items/branch` 로 연결한다.
  - 대상 역할을 `본사 운영 / 지점 관리자` 로 따로 적고 있다.
- `apps/web/app/work-items/branch/page.tsx`
  - branch scope 업무 목록, 상세, 문서, 마감 응답을 먼저 직접 확인하게 하는 패널이 있다.
- `apps/web/app/_components/phase34-live-sections.tsx`
  - `BranchOperationsLiveSection` 이 `module=branch` 목록, 상세, 문서, 마감 응답을 함께 보여 준다.
- `apps/api/test/auth-org.spec.ts`
  - branch summaries 와 조직 scope 응답이 역할별로 다르게 보이는 검증이 있다.

### 3-5. 홈/운영 분리/정책 경계 근거

- `SPEC.md` 현재 흐름 기준으로 `/dashboard` 상단 액션이 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서로 먼저 설명돼 있다.
- `apps/web/app/management/page.tsx`
  - 일반 직원 홈과 `경영업무` 허브를 분리한다.
- `apps/web/admin-preview-guard.ts`, `apps/web/middleware.ts`, `apps/web/admin-preview-guard.test.ts`
  - 관리자 host/일반 host 분리와 운영 화면 경계 근거가 이미 있다.

## 4. 이번 Phase에서 직접 닫아야 할 범위

### 4-1. 근태를 "직원 매일 시작 업무"로 다시 고정한다

- `/attendance` 는 단순 demo 카드가 아니라 오늘 출근/퇴근/정정 요청을 시작하는 첫 업무처럼 읽혀야 한다.
- 정책 미허용 방식은 조용히 실패하거나 성공처럼 보이면 안 된다.
- 태그 단말, GPS, 외부 단말 연동은 아직 없으므로 "예정"과 "현재 가능"을 같은 문장으로 섞지 않는다.
- 출퇴근 등록 방식 설명은 `/admin/policies` 정책 우선순위와 같은 뜻으로 유지한다.

### 4-2. 휴가를 "잔여 확인 + 신청 + 승인 대기 연결" 흐름으로 다시 고정한다

- `/leave` 는 단순 목록이 아니라 내 잔여 확인, 신청, 상태 확인까지 이어지는 직원 기본 업무로 적는다.
- 휴가 정책은 일반 직원 화면 copy 와 운영 정책 화면 copy 가 서로 다른 말을 하지 않게 맞춘다.
- 휴가 승인 흐름은 `/approvals` 와 이어지지만, 이번 Phase 문장에서는 직원 신청 레인과 승인자 레인을 구분해서 적는다.

### 4-3. 직원/조직 조회를 "읽기 중심 내부 인사 운영"으로 다시 고정한다

- `/employees` 는 일반 조회 화면이고 `/admin/users` 운영 검토 화면과 같은 책임이 아니다.
- `/org` 는 조직 구조, 역할, 권한, 지점 scope 를 읽는 화면이지 권한 편집 완료 화면처럼 적지 않는다.
- 직원 디렉터리 filter/notice/role summary 는 실제 테스트 근거와 같은 수준으로 설명해야 한다.
- admin-only role 이 일반 조회에 섞이지 않는다는 점을 핵심 경계로 유지한다.

### 4-4. 지점 운영을 "경영업무 허브 아래 branch scope 운영 흐름"으로 다시 고정한다

- `/work-items/branch` 는 일반 직원 홈이 아니라 `경영업무` 아래의 지점 운영 레인으로 읽혀야 한다.
- 본사 운영과 지점 관리자 가시 범위를 같은 권한처럼 뭉개지 않는다.
- 지점 업무는 company-wide full access 가 아니라 branch scope 업무/마감/문서 흐름으로 설명한다.

### 4-5. 홈과 운영 허브를 섞지 않는다

- 일반 직원 기본 흐름은 `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 다.
- 직원/조직 조회는 기본 업무를 마친 뒤 확인하는 read-only 보조 흐름으로 적는다.
- 운영자/관리자는 `/management` → `/work-items/branch` → `/admin/policies` → `/admin/audit-logs` 레인으로 따로 읽게 한다.

## 5. 이번 Phase에서 일부러 하지 않는 것

아래는 이번 Phase에서 문서상으로도 완료처럼 적지 않는다.

- 실제 태그 단말 연동
- GPS/위치정보 강제 검증
- 외부 HR/ERP/급여/회계/세무/노무 시스템 연동
- production 직원/근태/휴가 실데이터 입력 확대
- 주민번호/계좌번호 같은 민감 원문 처리 확대
- 실제 급여 지급/은행 이체/기관 신고
- DNS/custom domain, 유료 리소스, migration, destructive 작업

## 6. 핵심 fit-gap 질문

1. `/attendance` 가 직원의 오늘 할 일 시작점처럼 읽히는가
2. 정책 미허용 출퇴근 방식이 성공 UX 로 보이지 않는가
3. `/leave` 가 잔여 확인/신청/상태 확인 흐름으로 자연스럽게 이어지는가
4. `/employees` 일반 조회와 `/admin/users` 운영 검토가 섞이지 않는가
5. `/org` 가 읽기 중심 조직/권한 구조 화면으로 설명되는가
6. `/work-items/branch` 가 `경영업무` 아래 branch scope 운영 레인으로 유지되는가
7. 일반 직원 홈과 운영자 허브가 route/copy/test 기준으로 같은 책임처럼 섞이지 않는가
8. 태그 단말, GPS, 외부 연동, production 실데이터가 아직 승인 게이트라는 점이 숨겨지지 않는가

## 7. 권장 확인 순서

1. `/dashboard`
2. `/attendance`
3. `/leave`
4. `/employees`
5. `/org`
6. `/management`
7. `/work-items/branch`
8. `/admin/policies`
9. `/admin/audit-logs`
10. `apps/web/app/_components/phase34-live-sections.tsx`
11. `apps/api/test/auth-org.spec.ts`

## 8. 다음 작업자에게 넘길 핵심 문장

- Phase 42의 목표는 근태·휴가·직원/조직 조회·지점 운영을 외부 연동 없는 내부 도입 가능한 흐름으로 다시 묶는 것이다.
- 일반 직원 레인과 운영자/지점 관리자 레인을 섞지 않는 것이 이번 문서의 핵심 guardrail 이다.
- 정책 미허용 출퇴근 방식, admin-only role 비노출, branch scope 분리, 태그/GPS/외부연동 미완료 상태는 모두 "숨기면 안 되는 현재 경계"다.