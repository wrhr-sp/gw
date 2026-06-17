# Phase 49 파일럿 피드백 반영·최종 UAT 회귀 가이드

## 한 줄 요약
이번 Phase 49에서는
직원, 운영 관리자, 지점관리자, 감사 담당자가
각자 어디서 시작해서 무엇을 눌러 봐야 하는지,
그리고 무엇을 happy path / forbidden / empty / error / loading / mobile/PC 로 기록해야 하는지
한 문서로 다시 정리하면 된다.

## 이 문서가 다루는 범위
- 직원 UAT 순서
- 운영 관리자 UAT 순서
- 지점관리자 UAT 순서
- 감사/운영 기준선 확인 순서
- 이슈 분류 기준
- 최종 보고에 넣을 항목

이 문서는 새 외부 연동 구현 문서가 아니다.
이미 있는 흐름을 실제 파일럿 회귀 관점으로 다시 따라가게 만드는 문서다.

## 먼저 기억할 9가지
1. 익명 시작점은 `/login` 뿐이다.
2. COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 로그인 직후 landing 은 `/dashboard` 다.
3. AUDITOR 의 로그인 직후 landing 은 `/admin/audit-logs` 다.
4. 직원 기본 홈은 `/dashboard` 다.
5. `/management` 는 운영 관리자 허브다.
6. `/work-items/branch` 는 지점 업무 레인이다.
7. `/employees`, `/org` 는 읽기 중심 조회 레인이다.
8. `/admin/audit-logs` 는 read-only 감사 레인이다.
9. `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.

## 접속 정보와 현재 근거
- 현재 Phase 49 사용자-facing 기준 live URL 메모: `https://gw-web.wereheresp.workers.dev`
- 현재 live/UAT 진입점은 별도 admin host 가 아니라 위 단일 host 흐름으로 본다.
- 테스트 계정: `admin / 1234`
- 현재 문서 근거: `docs/architecture/phase-49-pilot-feedback-reflection-final-uat-regression-fit-gap-scope.md`, `docs/guides/phase-49-pilot-feedback-reflection-final-uat-regression-handoff.md`
- 현재 운영 근거: `RUNBOOK.md`, `DEPLOYMENT.md`
- 현재 검증 기준: focused API 15 files / 98 passed / 4 skipped, focused web 24 files / 103 tests passed, `pnpm --filter @gw/web typecheck`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf`, login-only redirect smoke baseline

중요:
- 이번 문서 작업에서는 live URL 자체를 새로 fetch 하거나 배포하지 않았다.
- live 직접 확인 근거는 singde unblock 메모와 `t_c353cc96` 완료 기록처럼 별도 근거로 보고, local preview/build/test 통과 기록과 같은 뜻으로 섞지 않는다.
- 따라서 사용자-facing 최종 보고 전에는 최신 live 접속 확인 메모와 local 검증 메모를 분리해서 다시 남겨야 한다.
- 이 문서에서는 live 직접 확인과 local preview/build/test 대체 근거를 같은 뜻으로 섞지 않는다.

## 1. 직원 UAT 가이드

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
- 오늘 할 일과 자주 가는 업무를 먼저 보는 화면이다.
- 운영 관리자 레인과 섞이지 않는지 먼저 본다.

#### `/attendance`, `/leave`, `/approvals`
- 일반 직원의 상태 변경 업무 흐름이다.
- happy path 와 함께 권한 부족, 정책 미허용, 빈 상태, 에러, 로딩을 각각 다른 이유로 기록한다.

#### `/boards`, `/documents`
- 협업/문서 흐름이다.
- 운영 정책 화면이나 외부 공유 완성품처럼 과장해서 읽으면 안 된다.

#### `/me`
- 세션, 내 정보, 로그아웃 흐름을 보는 화면이다.
- 로그인 실패와 권한 부족을 같은 뜻으로 적지 않는다.

### 기록할 질문
- 홈에서 오늘 해야 할 일이 먼저 보이는가
- 근태/휴가/결재 흐름이 서로 다른 상태 문장으로 읽히는가
- 협업/문서 흐름이 운영 관리자 화면과 섞이지 않는가
- 모바일/PC 에서 같은 정보구조로 읽히는가

## 2. 운영 관리자 UAT 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/management`
4. `/admin/users`
5. `/admin/policies`
6. `/admin/audit-logs`
7. `/api/health`

### 각 화면을 어떻게 읽으면 되는가
#### `/management`
- 일반 직원 홈의 연장이 아니라 운영 허브다.
- 실급여/실신고/외부 연동 완료를 뜻하지 않는다.

#### `/admin/users`
- 계정 생성/권한 diff/상태 변경/비밀번호 초기화 preview 를 보는 화면이다.
- 실제 저장 완료나 외부 초대 발송 완료 화면처럼 읽으면 안 된다.

#### `/admin/policies`
- 정책 source/candidate/capability/audit preview 를 보는 화면이다.
- 실제 조직 전체 영구 반영 완료처럼 읽으면 안 된다.

#### `/admin/audit-logs`
- 운영자가 보더라도 계속 read-only 감사 레인이다.
- 관리자 일반 권한과 `audit.read` 를 같은 뜻으로 적지 않는다.

#### `/api/health`
- 최소 liveness 확인이다.
- full monitoring dashboard 처럼 과장하면 안 된다.

### 기록할 질문
- `/management` 가 홈과 분리되는가
- `/admin/users`, `/admin/policies` 가 preview/운영 검토 화면으로 읽히는가
- `/admin/audit-logs` 가 read-only capability 경계를 유지하는가
- `/api/health` 를 과장하지 않고 최소 기준으로 설명하는가

## 3. 지점관리자 UAT 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/work-items/branch`
4. 필요 시 `/employees`
5. 필요 시 `/org`
6. `/management` 문맥 확인

### 각 화면을 어떻게 읽으면 되는가
#### `/work-items/branch`
- branch scope 업무 흐름이다.
- 독립 지점 마스터 완성품처럼 읽으면 안 된다.
- 회사 전체 민감 운영 권한과 같은 뜻으로 적으면 안 된다.

#### `/employees`, `/org`
- 읽기 중심 확인 화면이다.
- 운영 변경 화면이 아니다.

#### `/management`
- 지점관리자도 운영 허브의 전체 문맥을 볼 수 있지만,
  branch scope 와 company scope 를 같은 권한처럼 적으면 안 된다.

### 기록할 질문
- branch scope 와 company scope 가 구분되는가
- 지점 업무와 회사 운영 허브가 같은 책임처럼 읽히지 않는가
- 읽기 조회와 운영 변경 preview 가 섞이지 않는가

## 4. 감사/운영 기준선 가이드

### 추천 순서
1. `/login`
2. `/admin/audit-logs`
3. `/api/health`
4. `RUNBOOK.md`
5. `DEPLOYMENT.md`

### 기록할 질문
- 감사 로그가 read-only / masked preview 기준을 유지하는가
- `/api/health` 가 최소 liveness 기준으로만 읽히는가
- runbook/배포 문서가 수동 절차와 승인 게이트를 숨기지 않는가

## 5. UAT 기록 기준
각 핵심 기능마다 아래 6가지를 가능한 범위에서 남긴다.
- happy path: 정상 흐름이 이어지는가
- forbidden: 권한 부족 차단이 맞는가
- empty: 정상 빈 상태가 오류처럼 보이지 않는가
- error: 실패 상태가 다른 상태와 섞이지 않는가
- loading: 기다리는 상태가 성공/실패처럼 과장되지 않는가
- mobile/PC: 같은 정보구조로 읽히는가

## 6. 이슈 분류 기준
- blocker: 지금 시나리오를 더 진행할 수 없게 막는 문제
- major: 진행은 되지만 운영 의미가 크게 흔들리는 문제
- minor: 흐름은 되지만 다듬어야 하는 문제
- copy-doc: 화면 문구/문서 정합성 문제
- approval-needed: 기능 문제가 아니라 별도 승인 없이는 진행하면 안 되는 항목

## 7. 최종 보고에 꼭 넣을 항목
- live URL 또는 live 재확인 필요 메모
- 테스트 계정 `admin / 1234`
- 직원/운영 관리자/지점관리자/감사 추천 route 순서
- 주요 기능별 happy/forbidden/empty/error/loading/mobile/PC 기록 포인트
- 남아 있는 승인 게이트

## 8. 남아 있는 승인 게이트
- production DB 실데이터 전환/seed/migration
- 외부 IdP/SSO/SAML/SCIM 연동
- 실제 급여 지급, 은행 이체, 기관 신고
- 주민번호/계좌번호 등 민감정보 입력 확대
- production backup/restore 실행
- 외부 SIEM/alerting/paging/on-call 연동
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 생성·증액
- destructive 작업
