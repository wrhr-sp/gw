# Phase 50 내부 그룹웨어 본격 도입 릴리즈 가이드

## 한 줄 요약
이번 Phase 50에서는
대장이 live URL에서 로그인한 뒤
직원 기본업무, 운영 관리자 업무, 지점 업무, 감사 확인 흐름을
실제 내부 도입 릴리즈 순서로 따라가고,
무엇이 바로 가능한지와 무엇이 아직 승인 게이트인지까지
한 번에 읽을 수 있게 정리하면 된다.

## 이 문서가 다루는 범위
- 로그인 시작과 테스트 계정
- 직원 기본업무 확인 순서
- 운영 관리자 확인 순서
- 지점관리자/조직 확인 순서
- 감사/운영 기준선 확인 순서
- 기능별 기록 포인트
- UAT 절차
- 운영 체크리스트
- 최종 보고에 넣을 항목

이 문서는 외부 연동 구현 가이드가 아니다.
이번 릴리즈에서 바로 내부 도입 가능한 기준선을 쉽게 따라가게 만드는 문서다.

## 먼저 기억할 10가지
1. 익명 시작점은 `/login` 뿐이다.
2. 테스트 계정은 `admin / 1234` 다.
3. 이 계정은 dev/test/UAT 전용이며 production 기본 계정이 아니다.
4. COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 landing 은 `/dashboard` 다.
5. AUDITOR 의 landing 은 `/admin/audit-logs` 다.
6. 대시보드=`/dashboard` 는 PC/모바일 공통 홈이다.
7. `경영업무`(`/management`) 는 일반 직원 홈과 다른 민감 운영 허브다.
8. `/employees`, `/org` 는 읽기 중심 조회 레인이다.
9. `/admin/audit-logs` 는 read-only 감사 레인이다.
10. 외부 연동, 실데이터, 실지급, 민감정보 확대는 이번 릴리즈 완료와 다른 승인 게이트다.

## 접속 정보와 현재 근거
- live URL: `https://gw-web.wereheresp.workers.dev`
- 로그인 시작점: `/login`
- 테스트 계정: `admin / 1234`
- parent release gate: success
- parent merge commit: `1f299108b47edc219fa1ac3ea6ce5fd9c8b82114`
- parent 기준 검증: focused API `99 passed / 4 skipped`, focused web `104 passed`, `pnpm check`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf`
- parent local smoke: 익명 `/`·`/dashboard`·`/attendance`·`/approvals`·`/employees`·`/org`·`/admin/audit-logs` 보호 redirect, `/login`·`/api/health`·`/manifest.webmanifest` 200, `admin / 1234` 로그인/세션 유지/로그아웃, 역할별 guard matrix 확인

중요:
- 위 근거는 현재까지 남아 있는 baseline 이다.
- 이번 가이드에서는 live 직접 확인과 local 검증 근거를 같은 뜻으로 적지 않는다.
- 최종 사용자 보고 전에는 최신 live 직접 확인 메모를 별도로 다시 남겨야 한다.

## 1. 직원 기본업무 릴리즈 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/leave`
5. `/approvals`
6. `/boards`
7. `/documents`
8. `/me`

### 각 화면을 어떻게 읽으면 되는가
#### `/dashboard`
- 홈이다.
- 오늘 할 일, 빠른 진입점, 역할별 기본 흐름이 여기서 시작돼야 한다.
- 운영 관리자 레인과 섞이지 않는지 먼저 본다.

#### `/attendance`
- 출퇴근 확인과 정정 요청 흐름을 본다.
- 정책 미허용, 권한 부족, 빈 상태, 에러, 로딩을 서로 다른 이유로 기록한다.

#### `/leave`
- 휴가 신청/승인 상태/잔여 확인 흐름을 본다.
- 실제 급여·정산 처리와 같은 뜻으로 읽으면 안 된다.

#### `/approvals`
- 기안/승인/반려/보완 흐름을 본다.
- self-approval 금지와 승인 권한 차단이 유지되는지 같이 본다.

#### `/boards`, `/documents`
- 협업/문서 흐름이다.
- 외부 공유 완성형이나 별도 문서관리 시스템처럼 과장하면 안 된다.

#### `/me`
- 세션, 내 정보, 로그아웃 흐름을 보는 화면이다.
- 로그인 실패와 권한 부족을 같은 뜻으로 적지 않는다.

### 기록할 질문
- 로그인 후 오늘 할 일 시작점이 바로 보이는가
- 근태/휴가/결재/협업 흐름이 서로 끊기지 않는가
- forbidden, empty, error, loading 이 다른 뜻으로 읽히는가
- 모바일/PC 에서 같은 정보구조로 읽히는가

## 2. 운영 관리자 릴리즈 가이드

### 추천 순서
1. `/dashboard`
2. `/management`
3. `/admin/users`
4. `/admin/policies`
5. `/admin/audit-logs`
6. `/api/health`

### 각 화면을 어떻게 읽으면 되는가
#### `/management`
- 일반 직원 홈의 연장이 아니라 운영 허브다.
- 급여/인사/노무/세무/법무/컴플라이언스 진입을 한 번에 보더라도 일반 업무와 같은 책임으로 읽으면 안 된다.

#### `/admin/users`
- 계정 생성, 권한 지정, 활성·비활성, 비밀번호 초기화 dev-safe preview 흐름이다.
- 실제 초대 메일 발송 완료나 production 계정 운영 완료처럼 읽으면 안 된다.

#### `/admin/policies`
- 정책 source/candidate/capability/audit preview 를 읽는 화면이다.
- 실제 영구 반영 완료를 보장하는 화면처럼 과장하면 안 된다.

#### `/admin/audit-logs`
- 계속 read-only 감사 레인이다.
- 조치 시스템 완성품이나 full compliance workflow 로 읽으면 안 된다.

#### `/api/health`
- 최소 liveness 확인이다.
- full monitoring/alerting/on-call 완성처럼 적지 않는다.

### 기록할 질문
- `/management` 가 일반 직원 홈과 섞이지 않는가
- 운영 preview 화면이 실제 운영 확정 화면처럼 읽히지 않는가
- 감사 read-only 와 관리자 일반 권한이 같은 뜻처럼 섞이지 않는가
- 최소 liveness 와 full observability 가 구분되는가

## 3. 지점관리자 / 조직 확인 가이드

### 추천 순서
1. `/dashboard`
2. `/work-items/branch`
3. `/employees`
4. `/org`
5. `/management`

### 각 화면을 어떻게 읽으면 되는가
#### `/work-items/branch`
- branch scope 업무 흐름이다.
- 회사 전체 민감 운영 권한과 같은 뜻으로 적으면 안 된다.

#### `/employees`, `/org`
- 읽기 중심 확인 화면이다.
- 운영 변경 화면이 아니다.

#### `/management`
- 지점관리자도 운영 허브 문맥을 볼 수 있지만,
  branch scope 와 company scope 차이를 숨기면 안 된다.

### 기록할 질문
- branch scope 와 company scope 가 분리되는가
- 읽기 조회와 운영 변경 preview 가 섞이지 않는가
- 지점 업무와 회사 전체 운영 허브가 같은 책임처럼 읽히지 않는가

## 4. 감사 / 운영 기준선 가이드

### 추천 순서
1. `/admin/audit-logs`
2. `/api/health`
3. `RUNBOOK.md`
4. `DEPLOYMENT.md`

### 기록할 질문
- 감사 로그가 read-only / masked preview / company boundary 기준을 유지하는가
- `/api/health` 가 최소 확인 지점으로만 읽히는가
- 운영 문서가 rollback, smoke, 승인 게이트를 숨기지 않는가

## 5. 기능별 기록 기준
각 핵심 기능마다 아래 6가지를 가능한 범위에서 남긴다.
- happy path: 정상 흐름이 실제로 이어지는가
- forbidden: 권한 부족 차단이 맞는가
- empty: 정상 빈 상태가 오류처럼 보이지 않는가
- error: 실패 상태가 다른 상태와 섞이지 않는가
- loading: 기다리는 상태가 성공/실패처럼 과장되지 않는가
- mobile/PC: 같은 정보구조로 읽히는가

추가로 같이 적을 것:
- skeleton/placeholder/dev-safe/read-only 잔여 여부
- release blocker 인지, approval-needed 인지
- live 직접 확인인지, local 대체 근거인지

## 6. UAT 절차

### 6-1. 시작 전 준비
- live URL 이 `https://gw-web.wereheresp.workers.dev` 인지 다시 확인한다.
- 로그인 시작점이 `/login` 인지 확인한다.
- 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰이는지 확인한다.
- 이번 확인이 live 직접 확인인지, local 대체 근거 확인인지 먼저 구분한다.

### 6-2. 실행 순서
1. 로그인/로그아웃/session 유지/권한별 landing 확인
2. 직원 기본업무 레인 확인
3. 운영 관리자 레인 확인
4. 지점관리자/조직 확인 레인 확인
5. 감사/운영 기준선 레인 확인
6. happy/forbidden/empty/error/loading/mobile/PC 기록 정리
7. blocker / major / minor / copy-doc / approval-needed 분류

### 6-3. 기록 형식
각 route 또는 기능마다 아래 형식으로 남기면 된다.
- 경로:
- 누가 확인했는지:
- happy path:
- forbidden:
- empty:
- error:
- loading:
- mobile/PC:
- skeleton/dev-safe/read-only 메모:
- 증거 종류: `live 직접 확인` 또는 `local/build/test/release gate 대체 근거`
- 이슈 분류:

### 6-4. 이슈 분류 기준
- blocker: 지금 릴리즈 시나리오를 더 진행할 수 없게 막는 문제
- major: 진행은 되지만 본격 도입 의미를 크게 흔드는 문제
- minor: 흐름은 되지만 다듬어야 하는 문제
- copy-doc: 화면 문구/문서 정합성 문제
- approval-needed: 기능 문제가 아니라 별도 승인 없이는 진행하면 안 되는 항목

## 7. 운영 체크리스트

### 7-1. 릴리즈 전
- [ ] `/login` 만 익명 시작점으로 유지된다.
- [ ] 내부 업무 route 와 민감 API 가 로그인 없이 열리지 않는다.
- [ ] `admin / 1234` 가 production 기본 계정처럼 보이지 않는다.
- [ ] 직원 기본업무 레인과 `경영업무` 레인이 분리돼 보인다.
- [ ] `/employees`, `/org` 읽기 레인과 `/admin/users`, `/admin/policies` preview 레인이 섞이지 않는다.
- [ ] `/admin/audit-logs` 가 read-only 감사 레인으로 유지된다.
- [ ] `/api/health` 가 최소 liveness 로만 설명된다.

### 7-2. 근거 정리
- [ ] latest live URL 을 적었다.
- [ ] latest release gate 성공 근거를 적었다.
- [ ] latest merge commit 을 적었다.
- [ ] focused test/build/check 결과를 적었다.
- [ ] live 직접 확인 근거와 local 대체 근거를 분리해서 적었다.

### 7-3. 운영 문서 확인
- [ ] `RUNBOOK.md` 의 smoke/rollback/장애 대응 순서를 다시 읽었다.
- [ ] `DEPLOYMENT.md` 의 배포 확인 포인트를 다시 읽었다.
- [ ] `/api/health` 와 운영 문서 설명이 서로 같은 뜻인지 확인했다.

### 7-4. 사용자 안내 확인
- [ ] 직원용 안내에 `/dashboard` 중심 흐름이 먼저 나온다.
- [ ] 관리자용 안내에 `/management` 와 `/admin*` 레인이 따로 나온다.
- [ ] 지점/조직/감사 흐름이 같은 관리자 시나리오처럼 섞이지 않는다.
- [ ] 승인 게이트가 숨겨지지 않는다.

## 8. 최종 보고에 꼭 넣을 항목
- live URL 또는 live 직접 재확인 필요 메모
- 로그인 시작점 `/login`
- 테스트 계정 `admin / 1234`
- 직원/운영 관리자/지점관리자/감사 추천 route 순서
- 주요 기능별 happy/forbidden/empty/error/loading/mobile/PC 기록 포인트
- skeleton/placeholder/dev-safe/read-only 잔여 메모
- 운영 문서 확인 포인트
- 남아 있는 승인 게이트
- live 직접 확인 근거와 local 대체 근거를 나눠 적은 메모

## 9. 최종 보고 템플릿
아래 형식으로 정리하면 싱드가 최종 통합 보고에 바로 쓰기 쉽다.

- 결론:
- live URL:
- 로그인 시작점:
- 테스트 계정:
- 직접 따라간 레인:
  - 직원:
  - 운영 관리자:
  - 지점관리자:
  - 감사:
- 확인한 근거:
  - live 직접 확인:
  - local/build/test/release gate 대체 근거:
- 주요 이슈:
  - blocker:
  - major:
  - minor:
  - copy-doc:
  - approval-needed:
- 남은 승인 게이트:
- 대장이 직접 보면 되는 화면/경로:

## 10. 남아 있는 승인 게이트
- production DB 실데이터 전환/seed/migration
- 외부 IdP/SSO/SAML/SCIM 연동
- 실제 급여 지급, 은행 이체, 기관 신고
- 주민번호/계좌번호 등 민감정보 입력 확대
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- 법령 API 인증키/기관 계정 등록과 자동 최신화
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 생성·증액
- destructive 작업