# Phase 53 휴가·근태 실사용 가이드 + UAT 절차 + 운영 체크리스트

## 한 줄 요약
이번 Phase 53에서는 `/login` → `/dashboard` → `/attendance` → `/leave` 순서로 들어가,
직원 근태 흐름(출근 → 오늘 상태 확인 → 퇴근 → 정정 요청)과 직원 휴가 흐름(잔여 확인 → 신청 → 상태 확인)이 실제로 이어지는지,
그리고 승인자 lane·운영 정책 lane(`/admin/policies`)·권한 차단 문장이 서로 섞이지 않는지만 먼저 확인하면 된다.

## 이 문서가 다루는 범위
- 일반 직원용 근태/휴가 사용 가이드
- 승인권한자용 확인 가이드
- 운영 관리자용 정책 확인 포인트
- 권한 없음/차단 확인 포인트
- empty/loading/error/forbidden/dev-safe 읽는 법
- UAT 절차
- 운영 체크리스트
- 최종 보고에 넣을 항목

이 문서는 GPS 실연동, 태그 단말 실장비 연결, 실급여/실정산 반영, production 인사 데이터 전환 문서가 아니다.
지금 이미 있는 attendance/leave route/API/test 기준선을
"대장이 live URL에서 직접 어디를 눌러 무엇을 확인하면 되는가" 중심으로 다시 묶은 문서다.

## 먼저 기억할 10가지
1. 익명 시작점은 `/login` 뿐이다.
2. 테스트 계정은 `admin / 1234` 다.
3. 이 계정은 dev/test/UAT 전용이며 production 기본 계정이 아니다.
4. 근태 실사용 시작점은 `/dashboard` 다음 `/attendance` 다.
5. 휴가 실사용 시작점은 `/attendance` 다음 `/leave` 다.
6. `/attendance` 는 직원이 오늘 바로 하는 일부터 읽혀야 한다.
7. `/leave` 는 승인 버튼보다 내 잔여와 내 신청 흐름이 먼저 읽혀야 한다.
8. 승인자 lane 과 운영 정책 lane(`/admin/policies`)은 직원 CTA 와 섞이면 안 된다.
9. self-approval 금지, 미허용 출퇴근 방식/휴가유형 차단, foreign/unknown request 차단은 핵심 guardrail 이다.
10. live 직접 확인 근거와 local build/test 대체 근거는 같은 뜻으로 적지 않는다.

## 접속 정보와 현재 근거
- live URL: `https://gw-web.wereheresp.workers.dev`
- 로그인 시작점: `/login`
- 테스트 계정: `admin / 1234`
- 현재 핵심 route: `/dashboard`, `/attendance`, `/leave`, `/admin/policies`
- parent tester 기준 focused web: 3 passed
- parent tester 기준 `pnpm check` 통과
- parent tester 기준 `pnpm --filter @gw/web build` 통과
- parent tester 기준 `pnpm --filter @gw/web build:cf` 통과
- parent tester 기준 focused API: 8 passed / 61 skipped
- parent tester 기준 localhost smoke:
  - `/login` 200
  - employee 세션 기준 `/dashboard` 200, `/attendance` 200, `/leave` 200
  - employee/manager 세션 기준 `/admin/policies` → 307 `/forbidden`
- parent tester 기준 API 재확인:
  - check-in / check-out / correction 흐름 재검증
  - leave request / approve / reject 흐름 재검증
  - self-approval / foreign scope / unknown id 차단 재검증

중요:
- 위 수치는 현재 문서가 기대는 최신 parent 검증 근거다.
- 이번 문서 작업에서 live URL을 다시 직접 fetch 한 것은 아니다.
- 따라서 최종 사용자 보고 전에는 live 직접 확인 메모를 별도로 다시 붙여야 한다.

## 1. 일반 직원이 따라갈 근태 사용 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/attendance`
4. 오늘 기록 확인
5. 출근 등록
6. 퇴근 등록
7. 정정 요청 preview 확인

### 각 화면을 어떻게 읽으면 되는가

#### `/dashboard`
- 홈이다.
- 근태와 휴가는 여기서 바로 들어가는 일반 업무 레인이다.
- 운영 정책 화면이나 관리자 검토 화면과 섞여 보이면 안 된다.

#### `/attendance`
- 오늘 근무를 시작하고 끝내는 기본 화면이다.
- 먼저 읽어야 할 순서는 "출근 등록 → 오늘 상태 확인 → 퇴근 등록 → 정정 요청" 이다.
- 승인자 검토나 운영 정책 설명은 보조 정보일 수 있어도 직원 첫 행동보다 앞에 나오면 안 된다.

#### 오늘 기록 확인
- 오늘 상태, 최근 기록, 누락 여부를 먼저 읽는다.
- 작은 화면에서도 표보다 카드형 상태가 먼저 읽혀야 한다.
- empty 상태라면 "오늘 근태 기록이 아직 없습니다. 로그인 후 출근 등록부터 시작하세요." 같은 다음 행동 안내가 보여야 한다.

#### 출근 등록 / 퇴근 등록
- 현재 내 정책에서 허용된 방식만 CTA 로 보여야 한다.
- 미허용 방식은 성공처럼 보이면 안 되고, 정책 미허용으로 따로 설명돼야 한다.
- `mobile`, `pc`, `tag` 중 무엇이 허용되는지는 `/admin/policies` 설명과 같은 방향이어야 한다.

#### 정정 요청 preview
- 본인 최근 기록을 기준으로 정정 요청이 이어져야 한다.
- 다른 직원 기록이나 forged id 를 넣었을 때 성공처럼 보이면 안 된다.
- 지금 단계에서는 dev-safe preview 가 남을 수 있으므로, 실급여/실정산 자동 반영 완료처럼 읽히지 않게 주의한다.

### 일반 직원이 바로 확인할 질문
- `/attendance` 가 정말 오늘 업무 시작 화면처럼 읽히는가
- 출근 → 상태 확인 → 퇴근 → 정정 요청 순서가 자연스러운가
- 미허용 출퇴근 방식이 성공처럼 보이지 않는가
- 승인자/운영자 설명이 직원 CTA 를 덮지 않는가

## 2. 일반 직원이 따라갈 휴가 사용 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/leave`
5. 잔여 확인
6. 휴가 신청 preview 확인
7. 내 신청 상태 확인

### 각 화면을 어떻게 읽으면 되는가

#### `/leave`
- 내 잔여와 내 신청 상태를 먼저 보는 화면이다.
- 먼저 읽어야 할 순서는 "잔여 확인 → 신청 → 상태 확인" 이다.
- 승인 버튼이 먼저 보이기보다, 일반 직원 기준 다음 행동이 먼저 보여야 한다.

#### 잔여 확인
- 허용된 휴가 유형과 현재 잔여/예약/사용 snapshot 을 먼저 읽는다.
- 휴가 유형이 여러 개여도 "지금 내가 어떤 유형을 신청할 수 있는가"가 먼저 보여야 한다.
- empty 상태는 조회 실패와 다른 뜻으로 읽혀야 한다.

#### 휴가 신청 preview
- 일반 직원은 신청 버튼으로 흐름을 확인한다.
- leave.request 권한이 없으면 버튼 대신 차단 안내만 보여야 한다.
- 허용되지 않은 휴가유형, 잔여 부족, 예외 검토 필요 상태는 승인 lane 과 섞지 않고 따로 설명해야 한다.

#### 내 신청 상태 확인
- 신청 뒤에는 내 요청 상태를 같은 화면에서 다시 확인할 수 있어야 한다.
- pending / approved / rejected 가 서로 다른 뜻으로 읽혀야 한다.
- 승인 대기열은 일반 직원 기본 시점에서 성공 액션처럼 보이면 안 된다.

### 일반 직원이 바로 확인할 질문
- `/leave` 가 정말 휴가 사용 시작 화면처럼 읽히는가
- 잔여 확인 → 신청 → 상태 확인 순서가 자연스러운가
- 승인 버튼보다 내 신청과 내 잔여가 먼저 보이는가
- 정책 미허용과 권한 부족이 같은 문장으로 섞이지 않는가

## 3. 승인권한자가 따라갈 확인 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/attendance`
4. 예외 기록/정정 요청 관련 문장 확인
5. `/leave`
6. 승인 대기 설명 확인
7. 승인/반려 preview 노출 조건 확인
8. self-approval 금지와 foreign/unknown 차단 확인

### 어떻게 읽으면 되는가

#### 근태 쪽 승인자 확인
- 직원 화면은 오늘 기록과 본인 정정 요청까지가 기본이다.
- 승인자는 예외 기록과 정정 요청 검토 문맥을 별도 책임으로 읽어야 한다.
- 다른 직원 처리 권한이 없는 사용자는 이 레인으로 올라오지 못해야 한다.

#### 휴가 쪽 승인자 확인
- 승인 대기열은 승인 권한이 있는 세션에서만 실제 액션으로 보여야 한다.
- 자기 요청은 승인 대상에서 빠져야 한다.
- pending 이 아닌 요청, 다른 회사 요청, unknown request id 는 승인 성공처럼 보이면 안 된다.

#### 승인/반려 처리
- 승인과 반려는 같은 문단 안에 있어도, 현재 세션이 승인 권한이 있고 자기 요청이 아닌 pending 요청일 때만 열려야 한다.
- 일반 직원 세션에서는 승인 대기 설명만 남기고 버튼은 숨겨야 한다.
- self-approval 금지, forged/unknown 차단, 권한 부족 차단이 같은 원칙으로 읽혀야 한다.

### 승인권한자가 바로 확인할 질문
- 승인자 레인이 일반 직원 레인과 분리돼 보이는가
- 승인 버튼이 정말 승인 권한자에게만 노출되는가
- self-approval 금지와 foreign/unknown 차단이 같은 guardrail 로 읽히는가
- `/admin/policies` 확인이 직원 CTA 와 섞이지 않는가

## 4. 운영 관리자가 확인할 포인트

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/attendance`
4. 현재 허용 출퇴근 방식 설명 확인
5. `/leave`
6. 허용 휴가유형/승인 노출 규칙 설명 확인
7. `/admin/policies`
8. 직원 화면 문장과 정책 화면 문장이 같은 뜻인지 비교

### 어떻게 읽으면 되는가
- `/attendance`, `/leave` 는 실사용 레인이다.
- `/admin/policies` 는 정책 source, 허용 방식, 허용 휴가유형, 운영 기준을 보는 운영 레인이다.
- 운영 정책 설명이 앞에 나오더라도 직원이 당장 해야 할 행동을 덮으면 안 된다.
- 정책 화면과 실사용 화면이 서로 다른 말을 하면 안 된다.

### 운영 관리자가 바로 확인할 질문
- `/attendance` 의 허용 방식 설명과 `/admin/policies` 가 같은 뜻인가
- `/leave` 의 허용 유형/승인 노출 규칙과 `/admin/policies` 가 같은 뜻인가
- 운영 정책 설명이 사용자 실사용 흐름보다 앞서지 않는가

## 5. 권한 없음 / 차단 확인 가이드

### 먼저 확인할 대상
- 미허용 출퇴근 방식
- leave.request 권한 없는 사용자의 신청 시도
- leave.approve 권한 없는 사용자의 승인 액션 노출 여부
- self-approval 시도
- foreign/unknown request id 승인 시도
- `/admin/policies` 무권한 접근

### 읽는 기준
- UI에서 먼저 막히는지 본다.
- route 차단 안내와 API 차단 이유가 같은 뜻인지 본다.
- 차단 상태인데도 성공 버튼이나 완료 문구가 먼저 보이면 안 된다.
- 차단되면 사용자가 다시 어디로 돌아가야 하는지도 보여야 한다.

### 이번 Phase에서 특히 같이 봐야 하는 예시
- 권한 부족: 승인 권한 없는 세션의 승인 버튼 비노출
- 정책 미허용: 허용되지 않은 출퇴근 방식 비노출 또는 차단
- self-approval 금지: 자기 휴가 요청은 승인 대상으로 잡히지 않음
- 회사 scope/unknown 차단: forged/unknown request id 는 승인 성공처럼 처리되지 않음
- 운영 화면 차단: 무권한 `/admin/policies` 접근은 `/forbidden` 으로 분리

## 6. 상태 문장은 이렇게 구분한다

### empty
- 정상적으로 열렸지만 아직 오늘 기록이나 신청 내역이 없는 상태다.
- 다음 행동, 예를 들면 "출근 등록부터 시작" 또는 "첫 휴가 신청 진행"이 보여야 한다.

### loading
- 실제 API 응답을 불러오는 중이다.
- 성공도 실패도 아니다.

### error
- 조회 또는 저장이 실패한 상태다.
- 권한 부족과 같은 뜻으로 쓰면 안 된다.

### forbidden
- 로그인은 되었지만 지금 이 정책 화면/승인 액션/운영 레인 권한이 없는 상태다.
- 로그인 실패나 네트워크 오류와 같은 뜻이 아니다.

### dev-safe
- 내부 검증용 안전장치나 preview/Production-ready (실구현) 가 남아 있는 상태다.
- 실제 급여 반영, 장비 연동, production 인사 반영 완료와 같은 뜻이 아니다.

## 7. 역할별로 어디까지 보면 되는가
- EMPLOYEE: `/dashboard` → `/attendance` → `/leave` 중심으로 오늘 근무와 휴가 신청 흐름 확인
- MANAGER: `/attendance` 에서 예외 검토 문장 확인 + `/leave` 승인 대기 설명과 self-approval 차단 확인
- HR_ADMIN: `/attendance` 정책 문장, `/leave` 승인 대기/차단 문장, `/admin/policies` 정책 비교 확인
- COMPANY_ADMIN: 직원 레인과 운영 정책 레인을 둘 다 보되 같은 책임처럼 섞이지 않는지 확인
- AUDITOR: 이번 Phase의 주 사용자가 아니므로, 필요 시 정책/이력 설명만 read-only 관점에서 확인

## 8. UAT 절차

### 8-1. 시작 전 준비
- live URL 이 `https://gw-web.wereheresp.workers.dev` 인지 다시 확인한다.
- 이번 기록이 live 직접 확인인지, local build/test 대체 근거인지 먼저 구분한다.
- 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰이는지 확인한다.

### 8-2. 공통 시작 시나리오
1. `/login` 이 익명 유일 입구인지 확인
2. 로그인 후 `/dashboard` 로 시작하는지 확인
3. `/attendance` 진입이 자연스러운지 확인
4. `/leave` 진입이 자연스러운지 확인
5. 운영 정책은 필요 시 `/admin/policies` 로 따로 확인하는지 본다.

### 8-3. 일반 직원 happy path UAT
추천 순서:
- `/dashboard` → `/attendance` → 출근 등록 → 오늘 상태 확인 → 퇴근 등록 → 정정 요청 preview → `/leave` → 잔여 확인 → 신청 preview → 상태 확인

기록할 질문:
- 근태와 휴가가 일반 업무 순서로 자연스럽게 이어지는가
- 출근/퇴근/정정 요청이 실제 하루 흐름처럼 읽히는가
- 잔여/신청/상태 확인이 실제 휴가 흐름처럼 읽히는가
- 내부 검증 문구가 실사용 문구를 덮지 않는가

### 8-4. 승인권한자 happy path UAT
추천 순서:
- `/attendance` 예외 검토 문장 확인 → `/leave` 승인 대기 설명 확인 → 승인/반려 버튼 노출 조건 확인

기록할 질문:
- 승인자 레인이 직원 레인과 다른 책임으로 읽히는가
- 자기 요청이 승인 대상으로 잡히지 않는가
- 승인 권한 없는 세션에서 승인 버튼이 보이지 않는가

### 8-5. 차단/guard UAT
추천 순서:
- 미허용 출퇴근 방식 확인
- 승인 권한 없는 세션의 승인 액션 비노출 확인
- self-approval 차단 확인
- foreign/unknown request id 차단 확인
- 무권한 `/admin/policies` 접근 시 `/forbidden` 분리 확인

기록할 질문:
- 차단이 성공 화면보다 먼저 보이는가
- UI/route/API 가 같은 이유를 말하는가
- 사용자가 다시 어디로 가야 하는지 바로 보이는가

### 8-6. 이슈 분류 기준
- blocker: 지금 근태/휴가 시나리오를 더 진행할 수 없게 막는 문제
- major: 진행은 되지만 실사용 의미를 크게 흔드는 문제
- minor: 흐름은 되지만 다듬어야 하는 문제
- copy-doc: 화면 문구/문서 정합성 문제
- approval-needed: 기능 문제가 아니라 별도 승인 없이는 진행하면 안 되는 항목

## 9. 운영 체크리스트

### 운영 전
- [ ] `/login` 이 유일한 익명 시작점으로 유지된다.
- [ ] 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰인다.
- [ ] live 직접 확인 근거와 local build/test 대체 근거를 분리해 적는다.

### 운영 중
- [ ] `/attendance` 가 근태 실사용 시작점처럼 읽힌다.
- [ ] 출근 → 오늘 상태 확인 → 퇴근 → 정정 요청 흐름이 실제로 이어진다.
- [ ] `/leave` 가 휴가 실사용 시작점처럼 읽힌다.
- [ ] 잔여 확인 → 신청 → 상태 확인 흐름이 실제로 이어진다.
- [ ] 승인자 lane 과 운영 정책 lane(`/admin/policies`)이 직원 CTA 와 섞이지 않는다.
- [ ] 승인 권한 없는 세션에 승인 버튼이 보이지 않는다.
- [ ] self-approval 금지, 미허용 방식/유형 차단, foreign/unknown 차단이 유지된다.
- [ ] empty/loading/error/forbidden/dev-safe 가 서로 다른 뜻으로 읽힌다.

### 운영 후
- [ ] 직원 happy path 와 승인자 happy path 결과를 따로 기록했다.
- [ ] blocker 와 approval-needed 를 분리했다.
- [ ] 최종 보고에 live URL, 테스트 계정, 추천 route, 직접 해볼 액션, 남은 승인 게이트를 넣을 수 있게 정리했다.

## 10. 최종 보고에 꼭 넣을 항목
- live URL
- 로그인 시작점 `/login`
- 테스트 계정 `admin / 1234`
- 일반 직원이 따라갈 추천 순서
- 승인권한자가 따라갈 추천 순서
- 운영 관리자가 비교할 정책 route `/admin/policies`
- 직접 해볼 액션:
  - 오늘 기록 확인
  - 출근 등록
  - 퇴근 등록
  - 정정 요청 preview 확인
  - 잔여 확인
  - 휴가 신청 preview 확인
  - 내 신청 상태 확인
  - 승인 버튼 노출 조건 확인
  - self-approval 차단 확인
  - foreign/unknown 차단 확인
- live 직접 확인 근거
- local build/test/release gate 대체 근거
- 아직 mock/dev-safe 이거나 승인 게이트인 부분

## 11. 최종 보고 템플릿
- 결론:
- live URL:
- 로그인 시작점:
- 테스트 계정:
- 직원 확인 순서:
- 승인자 확인 순서:
- 운영 정책 확인 순서:
- 직접 해볼 액션:
- 확인한 근거:
  - live 직접 확인:
  - local/build/test 대체 근거:
- 주요 이슈:
  - blocker:
  - major:
  - minor:
  - copy-doc:
  - approval-needed:
- 남은 승인 게이트:
- 대장이 직접 보면 되는 route:

## 12. 남아 있는 승인 게이트
- production DB 실데이터 반영/seed/migration
- GPS/위치정보 수집 저장
- 태그 단말/NFC/RFID/QR 실장비 연결
- 실급여/실정산 자동 반영
- 외부 HR/급여/세무/노무 시스템 연동
- 민감 증빙 원문 저장 확대
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 증설
- destructive/force 작업

## 13. 관련 근거 파일
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/_components/real-usage-panels.tsx`
- `apps/web/phase53-leave-attendance-live-usage.test.tsx`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `packages/shared/src/contracts.ts`
- `docs/architecture/phase-53-leave-attendance-live-operations-fit-gap-scope.md`
- `docs/guides/phase-53-leave-attendance-live-operations-handoff.md`
