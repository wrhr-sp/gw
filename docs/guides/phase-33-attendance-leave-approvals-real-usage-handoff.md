# Phase 33 근태·휴가·전자결재 실사용화 handoff

## 한 줄 요약
지금 기준으로 `/attendance`, `/leave`, `/approvals` 는
이미 route 와 same-origin API, 권한 차단, live section 이 연결돼 있어서
"아예 없는 화면" 은 아닙니다.

하지만 아직은
실제 운영 완료품처럼 보기보다
"대장이 지금 어디까지 직접 눌러볼 수 있고, 어디부터는 승인 게이트인지"
정직하게 나눠서 봐야 하는 단계입니다.

## 이번 Phase에서 대장이 기대해도 되는 것
이번 Phase 33 문서는
다음 세 가지를 같은 말로 묶는 기준입니다.

1. 지금 바로 눌러볼 수 있는 route
2. 일반 직원과 승인자/관리자가 어디서 갈리는지
3. 아직 production 실연동이나 운영 반영으로 보면 안 되는 부분

즉
"근태가 된다"
"휴가가 된다"
"전자결재가 된다"
를 막연하게 말하지 않고,
무엇이 되고
무엇은 아직 preview/dev-safe 이며
무엇은 계속 승인 게이트인지
분리해서 적는 문서입니다.

## 이번 문서가 기대는 최신 재검증 근거
- shared/api/web 테스트와 typecheck, `pnpm --filter @gw/web build:cf` 가 parent 재검증에서 다시 통과했습니다.
- 로컬 preview smoke 기준 비로그인 접근은 `/login` 200, `/attendance`·`/leave`·`/approvals`·`/dashboard`·`/admin/policies` 307 redirect 로 확인됐습니다.
- `admin / 1234` 로그인 뒤에는 `/dashboard`·`/attendance`·`/leave`·`/approvals` 페이지와 `/api/me`, `/api/admin/policies`, `/api/attendance/records`, `/api/leave/requests`, `/api/approvals/documents`, `/api/approvals/inbox` 가 모두 200 으로 확인됐습니다.
- 따라서 이번 handoff 는 "아직 Production-ready (실구현) honesty 를 유지해야 하지만, route/API 가 실제로 안 붙어 있는 단계는 이미 지났다" 는 전제를 깔고 읽으면 됩니다.

## 지금 바로 눌러볼 추천 순서
1. `/login`
   - `admin / 1234` 로 로그인합니다.
   - 이 계정은 dev/test/UAT 전용입니다.
2. `/dashboard`
   - `/attendance`, `/leave`, `/approvals` 바로가기가 일반 업무 흐름 앞쪽에 있는지 봅니다.
3. `/attendance`
   - 오늘 출퇴근/허용 방식/정책 source/정정 요청 문맥을 봅니다.
4. `/leave`
   - 휴가 유형/잔여/신청 상태/승인자 차단 문맥을 봅니다.
5. `/approvals`
   - 기안함/결재함, 문서 상태, 승인 대기/보완 요청 문맥을 봅니다.
6. `/admin/policies`
   - 일반 업무 화면 문구와 운영 정책 문구가 같은 뜻인지 비교합니다.

## 쉬운 사용자/관리자 테스트 가이드

### 1) 일반 업무 흐름 먼저 보기
- `/dashboard`
  - 홈 바로가기에서 `/attendance` → `/leave` → `/approvals` 흐름이 자연스러운지 봅니다.
- `/attendance`
  - 오늘 기록, 최근 기록, 허용 방식, 정정 요청 문맥을 읽습니다.
- `/leave`
  - 휴가 유형, 잔여, 신청 상태를 읽고, 정책 미허용/잔여 부족/권한 부족 설명이 서로 다른 뜻으로 보이는지 봅니다.
- `/approvals`
  - 기안함, 문서 상태, 결재선/후보자 설명이 직원 관점에서도 따라가기 쉬운지 봅니다.

### 2) 승인자 흐름 따로 보기
- `/leave`
  - 승인자 lane 과 신청자 lane 이 따로 읽히는지 봅니다.
  - 일반 직원이 바로 approve/reject 할 수 있는 것처럼 보이지 않는지 확인합니다.
- `/approvals`
  - 결재함, 승인 대기, 반려, 보완 요청 문맥이 기안함과 섞이지 않는지 봅니다.
  - self-approval 금지와 권한 없는 approve/reject 차단 설명이 빠지지 않는지 확인합니다.

### 3) 관리자/정책 확인은 마지막에 보기
- `/admin/policies`
  - 일반 업무 화면에서 본 정책 안내와 운영 정책 source 가 같은 뜻인지 비교합니다.
- `apps/api/test/auth-org.spec.ts`
  - 권한, 회사 scope, self-approval, unknown/forged id 차단 근거가 문서와 같은 뜻인지 다시 대조합니다.
- 주의
  - 관리자용 리스크 상세는 일반 직원 기본 업무 흐름 안에 섞지 않습니다.

## 화면별 쉬운 판정표

### 1) `/attendance`
지금 볼 수 있는 것:
- 오늘 출퇴근/최근 기록
- 현재 허용된 체크인 방식
- 정책 source 또는 왜 제한되는지 설명
- 정정 요청 문맥
- loading/error/empty 상태 분리

아직 남은 것:
- GPS/위치정보 저장
- NFC/RFID/QR 같은 실제 단말 연동
- production 근태 데이터 대량 반영
- richer stepper 와 실제 운영 히스토리 UX

쉽게 말하면:
"출퇴근 업무의 입구와 규칙은 직접 볼 수 있지만,
실장비·실위치·실운영 연동까지 닫힌 상태는 아니다"
로 보면 됩니다.

### 2) `/leave`
지금 볼 수 있는 것:
- 휴가 유형
- 잔여 휴가
- 신청 상태
- 신청자와 승인자 차이
- 정책 미허용/권한 부족/회사 scope 차단 문맥

아직 남은 것:
- 실제 급여/정산 반영
- 조직 master 기준 자동 차감 확대
- richer 승인 히스토리 UX
- production 인사 운영 데이터 반영

쉽게 말하면:
"휴가 신청과 승인 경계는 읽히지만,
실제 인사 운영 반영까지 끝난 완제품처럼 보면 안 된다"
입니다.

### 3) `/approvals`
지금 볼 수 있는 것:
- 기안함 / 결재함 분리
- 문서 상태
- 양식/결재선/후보자 문맥
- 승인/반려/보완 요청 설명
- self-approval 금지와 권한 차단

아직 남은 것:
- 실서명/법적 효력
- 외부 메일/메신저 알림
- 실원문 장기보관
- richer 문서 상세/이력 UX

쉽게 말하면:
"결재 흐름의 틀과 guardrail 은 볼 수 있지만,
법적 효력이 있는 실전자결재 시스템으로 보면 안 된다"
입니다.

## 지금 기준으로 분명히 말할 수 있는 guardrail
- 일반 직원 화면과 운영 정책 화면은 섞지 않습니다.
- 정책 미허용과 권한 부족은 같은 이유로 설명하지 않습니다.
- self-approval 금지는 계속 핵심 규칙입니다.
- unknown id, forged 접근, 회사 scope 밖 접근은 성공처럼 처리하지 않습니다.
- production DB 실데이터, 실제 급여 지급, 은행 이체, 외부 세무/노무/법령 기관 연동은 계속 승인 게이트입니다.
- secret, DNS/custom domain, 유료 리소스, migration, destructive 작업도 계속 별도 승인 범위입니다.

## fit-gap 핵심 요약

### 지금 되는 것
- `/attendance` 에서 출퇴근/정책/정정 요청 문맥 확인
- `/leave` 에서 유형/잔여/신청 상태 확인
- `/approvals` 에서 기안함/결재함/승인 흐름 문맥 확인
- `apps/api/test/auth-org.spec.ts` 기준 권한/회사 scope/self-approval 차단 근거 확인
- `/admin/policies` 에서 운영 정책 설명과 일반 화면 설명 비교

### 아직 과장하면 안 되는 것
- 실급여/실정산 자동 반영
- 은행 이체/주민번호/계좌번호 확대
- GPS/실단말 출퇴근
- 외부 기관 API/장비 연동
- 법적 효력 있는 전자서명/실원문 장기보관
- production 인사 실데이터 대량 투입

## 다음 작업자가 바로 이어야 할 우선순위
1. `t_32c88243`
   - attendance_records, leave_requests/balances, approval_documents/lines/forms PostgreSQL 전환
2. `t_268c7c7e`
   - `/attendance`, `/leave`, `/approvals` 의 실제 happy path, 권한 guard, 상태 UX 보강
3. 이후 reviewer/tester/docs/ops
   - route/API/test/문서 언어를 다시 맞추고,
     대장이 실제로 눌러볼 route 와 승인 게이트를 최종 보고로 정리

## 루트 문서에서 같이 봐야 할 파일
- `ROADMAP.md`
- `TASKS.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `docs/architecture/phase-33-attendance-leave-approvals-real-usage-scope.md`

## 마지막 한 줄 정리
Phase 33은
근태·휴가·전자결재를
"있는 척하는 화면" 에서
"지금 직접 눌러보고, 어디까지가 실제고 어디부터가 승인 게이트인지 설명 가능한 화면"
으로 끌어올리는 기준 단계입니다.
