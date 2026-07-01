# Phase 33 근태·휴가·전자결재 실사용화 범위

## 한 줄 요약
Phase 33의 목표는
대장이 배포 URL에서 `admin / 1234` 로 로그인한 뒤
`/attendance` → `/leave` → `/approvals` 흐름을
실제 same-origin API 응답, 권한 차단, 승인자/일반직원 경계까지 포함해 직접 눌러볼 수 있게 만드는 것입니다.

쉽게 말하면 이번 단계는
예전 Phase 3/4/15/22에서 잡아 둔 근태·휴가·전자결재 Production-ready (실구현) 과 정책 설명을
"설명용 Production-ready (실구현)" 에서
"지금 어디까지 직접 체험 가능한지 분명한 업무 흐름" 으로 끌어올리는 단계입니다.

## 왜 지금 Phase 33이 필요한가
Phase 31에서 로그인/홈/경영업무/계정관리 입구를 정리했고,
Phase 32에서 협업 묶음(`/boards`, `/documents`)을 실사용 언어로 다시 묶었습니다.
이제 대장이 가장 자주 눌러볼 핵심 일반 업무 묶음은 다시
근태, 휴가, 전자결재입니다.

현재 코드 스냅샷 기준으로는 아래 간격이 남아 있습니다.

1. `/attendance`, `/leave`, `/approvals` 는 모두 실제 route 와 API 설명, live section, 권한 차단 문구가 있지만,
   화면 언어는 아직 "정책 안내 + preview 액션" 비중이 높습니다.
2. 근태는 출퇴근 기록/정정 요청/허용 방식 안내를 읽을 수 있지만,
   실제 하루 업무 stepper 로 바로 따라가기에는 "정책상 왜 허용/차단되는가" 정리가 더 필요합니다.
3. 휴가는 유형/잔여/요청 상태와 승인 액션을 볼 수 있지만,
   신청자/승인자 각각이 지금 뭘 직접 해볼 수 있는지 문서와 화면에서 더 또렷하게 묶여야 합니다.
4. 전자결재는 기안함/결재함/양식/결재선/후보자 경계와 self-approval 금지 근거가 있으나,
   실제 기안 → 승인/반려/보완 요청 happy path 를 바로 따라가기 쉽게 정리할 여지가 있습니다.
5. 근태·휴가·전자결재는 실제 급여 지급, 은행 이체, 외부 세무/노무/법령 기관 연동, production 인사데이터 반영과 연결되기 쉬운 영역이라,
   "지금 바로 눌러볼 수 있는 것" 과 "계속 승인 게이트로 남는 것" 을 더 정직하게 분리해야 합니다.

즉 이번 단계는
새 모듈을 늘리는 것이 아니라,
이미 있는 `/attendance`, `/leave`, `/approvals` 를
"지금 실제로 어디까지 되는지 / 아직 무엇이 dev-safe 인지 / 무엇이 승인 게이트인지"
한 번에 이해되게 만드는 단계입니다.

## 현재 구현 기준 스냅샷

### 2026-06-16 재검증으로 다시 확인된 것
- parent 재검증 기준으로 shared/api/web 테스트, typecheck, `pnpm --filter @gw/web build:cf` 가 다시 통과했습니다.
- 로컬 preview smoke 기준 비로그인 접근은 `/login` 200, `/attendance`·`/leave`·`/approvals`·`/dashboard`·`/admin/policies` 307 redirect 로 다시 확인됐습니다.
- `admin / 1234` 로그인 뒤에는 `/dashboard`·`/attendance`·`/leave`·`/approvals` 페이지가 200 으로 열리고, `/api/me`, `/api/admin/policies`, `/api/attendance/records`, `/api/leave/requests`, `/api/approvals/documents`, `/api/approvals/inbox` 가 모두 200 으로 응답했습니다.
- 따라서 이번 문서의 기준은 "route 는 실제로 열리고, same-origin API 도 실제로 붙어 있지만, richer 실운영 UX 와 운영 연동은 아직 남아 있다" 로 보는 것이 맞습니다.

### 지금 코드에서 바로 확인되는 것
- `apps/web/app/attendance/page.tsx`
  - 출퇴근 기록, 체크인/체크아웃 허용 방식, 정책 source, 정정 요청 흐름을 설명합니다.
  - live section 으로 실제 attendance API 응답을 읽고 loading/error/empty 상태를 분리합니다.
- `apps/web/app/leave/page.tsx`
  - 휴가 유형, 잔여, 신청 상태, 승인자 차단 여부, 정책 미허용 이유를 설명합니다.
  - leave live section 에서 실제 요청/잔여 응답과 preview 액션 문맥을 함께 보여 줍니다.
- `apps/web/app/approvals/page.tsx`
  - 기안함/결재함, 양식/결재선, 참조·합의 후보, self-approval 금지와 같은 guardrail 을 설명합니다.
  - approvals live section 으로 실제 결재 문서/승인함 응답을 읽고 상태별 카드를 분리합니다.
- `apps/web/app/_components/real-usage-panels.tsx`
  - 근태/휴가/전자결재 live section 들이 same-origin fetch 로 실제 응답을 읽고
    loading/error/empty/forbidden 상태를 기본 카드로 나눕니다.
- `/dashboard`
  - 일반 직원 핵심 업무 진입에서 `/attendance`, `/leave`, `/approvals` 바로가기가 계속 앞쪽에 배치됩니다.

### API 테스트로 이미 확인된 것
`apps/api/test/auth-org.spec.ts` 기준:

- 근태
  - EMPLOYEE 로그인으로 출퇴근 기록 조회와 체크인/체크아웃 후보 확인이 가능합니다.
  - 정책상 미허용 방식은 성공처럼 처리하지 않고 차단 또는 미허용 이유로 분리됩니다.
  - 정정 요청은 본인 범위 기준으로만 허용되고, 권한 없는 승인/처리는 차단됩니다.
- 휴가
  - EMPLOYEE 는 휴가 유형/잔여/요청 목록을 보고 휴가 신청을 올릴 수 있습니다.
  - 승인 권한 없는 사용자의 approve/reject 는 차단됩니다.
  - unknown request id, 회사 scope 밖 요청, self-approval 류 경계는 성공처럼 처리하지 않습니다.
- 전자결재
  - 기안 문서 목록/상세, 내 승인함, 양식/결재선 후보, 참조·합의 후보가 같은 회사 범위에서만 열립니다.
  - self-approval 금지가 유지됩니다.
  - 승인 권한 없는 사용자의 approve/reject/request-changes, forged/unknown document id, 회사 scope 밖 후보자 조합은 차단됩니다.
  - 결재 양식/결재선 관리성 액션은 관리자/운영 권한과 일반 직원 액션이 분리됩니다.

### 지금 바로 체험 가능에 가까운 영역
- `/attendance`
  - 오늘 출퇴근과 최근 기록, 허용된 체크인 방식, 정책 source 확인
- `/leave`
  - 휴가 유형/잔여/신청 상태와 기본 요청 흐름 확인
- `/approvals`
  - 기안함/결재함 분리, 문서 상태, 승인 대기/보완 요청 흐름 확인
- `/admin/policies`
  - 출퇴근/휴가 정책 설명과 일반 업무 화면 문구 비교
- `apps/api/test/auth-org.spec.ts`
  - 권한/회사 scope/self-approval/unknown id 차단 근거 재확인

### 아직 Production-ready (실구현)/dev-safe 비중이 큰 영역
- 근태에서 실제 위치/GPS/NFC/RFID/QR 장비 연동, 현장 단말 연동
- 휴가에서 production 조직 master 기준 자동 차감/정산/급여 연동
- 전자결재에서 실서명, 외부 메일/메신저 알림, 실원문 장기보관/법적 효력 연결
- 세 모듈 모두에서 production 인사데이터 대량 반영, 은행/급여/세무/노무 기관 연동
- richer stepper, 실제 업무 히스토리 요약, 첨부/사유/합의/참조 UX 완성도

## Phase 33에서 고정할 핵심 결정

### 결정 A. 근태·휴가·전자결재는 "직원이 매일 쓰는 업무" 묶음으로 보되 책임은 섞지 않는다.
- `/attendance` 는 출퇴근 기록/정정/허용 방식 확인을 맡습니다.
- `/leave` 는 휴가 유형/잔여/신청/승인 상태를 맡습니다.
- `/approvals` 는 기안/승인/반려/보완 요청과 결재선 책임을 맡습니다.
- 같은 추천 클릭 순서 안에 둘 수는 있지만,
  근태 정책, 휴가 정책, 전자결재 권한을 한 문장으로 섞어 쓰지 않습니다.

### 결정 B. "직원 happy path" 와 "승인자/관리자 gate" 를 먼저 분리해서 읽히게 한다.
- 일반 직원은 출퇴근 기록, 휴가 신청, 결재 기안/내 문서 확인 중심으로 읽습니다.
- 승인자/관리자는 휴가 승인/반려, 결재 승인/반려/보완 요청, 정책 검토 중심으로 읽습니다.
- `/admin/policies` 같은 운영 검토 화면은 일반 업무와 섞지 않습니다.

### 결정 C. 정책 미허용 이유와 권한 부족 이유를 같은 축으로 설명하지 않는다.
- 정책상 미허용은 "회사 정책 기준 현재 허용되지 않음" 으로 적습니다.
- 권한 부족은 "승인 권한 없음/회사 scope 아님" 으로 적습니다.
- Production-ready (실구현) 제한은 "아직 dev-safe 단계" 로 따로 적습니다.
- 즉 blocked/empty/error/forbidden 을 최소
  권한 부족 / 회사 scope / 정책 미허용 / Production-ready (실구현) 제한
  4축으로 유지합니다.

### 결정 D. self-approval 금지와 forged/unknown id 차단은 전자결재만의 세부 규칙이 아니라 공통 guardrail 로 본다.
- 자기 휴가 자기승인
- 자기 결재 자기승인
- 권한 없는 approve/reject
- unknown employee/request/document id 성공 처리
를 모두 같은 품질 게이트로 유지합니다.

### 결정 E. Phase 33 문서화는 구현 카드와 DB 전환 카드 사이의 완료 기준을 분리해서 적는다.
- `t_a498e76b`: 현재 fit-gap / handoff / 루트 문서 기준 고정
- `t_32c88243`: attendance_records, leave_requests/balances, approval_documents/lines/forms PostgreSQL 전환
- `t_268c7c7e`: 실제 UI/API happy path 강화와 실사용화 구현

즉 지금 문서화는
"이제 실제로 눌러볼 수 있는 것" 과
"아직 richer UX·운영 승인 게이트·DB 전환 과제로 남은 것" 을 분리해서 적어야 합니다.

## fit-gap 표

| 구분 | 지금 대장이 직접 눌러볼 수 있는 것 | 아직 남은 gap | 다음 구현 우선순위 |
| --- | --- | --- | --- |
| 근태 | `/attendance`, 출퇴근 기록/허용 방식/정정 요청 문맥, live section 상태 분기 | 실제 현장 장비/GPS/위치정보/단말 연동 없음, richer stepper 약함 | 직원 기준 체크인/체크아웃/정정 요청을 한 흐름으로 더 또렷하게 |
| 휴가 | `/leave`, 휴가 유형/잔여/요청 상태, 신청과 승인 차단 문맥 | 자동 차감/급여 반영/조직 master 연동 없음, 승인자 lane 설명 보강 필요 | 신청자 lane 과 승인자 lane 을 분리한 UAT 정리 |
| 전자결재 | `/approvals`, 기안함/결재함 분리, self-approval 금지, 결재 후보 경계 | 실서명/외부 알림/실원문 보관 없음, richer 문서 상세 UX 약함 | 기안 → 승인/반려/보완 요청 stepper 강화 |
| 정책/운영 경계 | `/admin/policies` 와 일반 화면 비교 | 정책 미허용 vs 권한 부족 vs Production-ready (실구현) 제한 문구가 더 정리돼야 함 | 4축 상태 문구를 route/API/문서에서 같은 언어로 고정 |
| 권한/forbidden | 승인 권한 없음, self-approval 금지, 회사 scope 차단, unknown id 차단 테스트 근거 | 화면에서 왜 막히는지 즉시 읽히는 UX는 더 보강 가능 | forbidden 이유를 API와 route 에서 같은 문장으로 맞추기 |
| 운영 데이터/실연동 | dev-safe 계정으로 흐름 확인 가능 | production DB, 실급여, 은행, 외부 기관/장비 연동은 여전히 별도 승인 | 승인 게이트를 문서와 최종 보고에서 계속 분리 유지 |

## 대장이 실제로 눌러볼 추천 순서
1. `/login`
   - `admin / 1234` 로 로그인합니다.
   - production 기본 계정이 아니라 dev/test/UAT 전용 계정인지 같이 확인합니다.
2. `/dashboard`
   - 고정 바로가기에서 `/attendance`, `/leave`, `/approvals` 로 이어질 준비가 되는지 봅니다.
3. `/attendance`
   - 오늘 출퇴근/정책 source/허용 방식/정정 요청 문맥을 봅니다.
4. `/leave`
   - 휴가 유형/잔여/요청 상태와 정책 미허용 문맥을 봅니다.
5. `/approvals`
   - 기안함/결재함, 승인 대기/보완 요청 문맥을 봅니다.
6. `/admin/policies`
   - 일반 업무 화면 설명과 운영 정책 설명이 같은 뜻인지 비교합니다.

## 사용자/승인자/관리자 테스트 가이드

### A. 공통 진입
- 시작 URL: `https://gw-web.wereheresp.workers.dev`
- 로그인: `admin / 1234`
- 비로그인 guard 확인: `/attendance`, `/leave`, `/approvals`, `/dashboard`, `/admin/policies` 직접 접근 시 로그인으로 보호되는지 먼저 봅니다.

### B. 일반 업무 사용자 관점에서 먼저 볼 것
1. `/dashboard`
   - 홈 바로가기에서 `/attendance` → `/leave` → `/approvals` 순서가 자연스러운지 봅니다.
2. `/attendance`
   - 오늘 기록, 최근 기록, 허용 방식, 정책 source, 정정 요청 문맥이 한 화면에서 읽히는지 봅니다.
3. `/leave`
   - 휴가 유형, 잔여, 신청 상태가 먼저 보이고, 정책 미허용/잔여 부족/권한 부족 설명이 섞이지 않는지 봅니다.
4. `/approvals`
   - 기안함 중심 문맥, 문서 상태, 결재선/후보자 설명이 일반 직원도 이해 가능한 말로 보이는지 봅니다.

### C. 승인자 관점에서 추가로 볼 것
1. `/leave`
   - 승인자 lane 이 신청자 lane 과 섞이지 않고 따로 읽히는지 봅니다.
   - 일반 직원이 approve/reject 를 바로 할 수 있는 것처럼 과장되지 않는지 봅니다.
2. `/approvals`
   - 결재함, 승인 대기, 반려, 보완 요청 문맥이 기안함과 구분되는지 봅니다.
   - self-approval 금지와 권한 없는 approve/reject 차단 설명이 빠지지 않는지 봅니다.

### D. 관리자 관점에서 마지막으로 볼 것
1. `/admin/policies`
   - 일반 업무 화면에서 본 정책 안내와 운영 정책 source 가 같은 뜻인지 비교합니다.
2. 관련 API/guard 근거
   - `/api/admin/policies`, `apps/api/test/auth-org.spec.ts` 기준으로 운영 정책과 일반 업무 화면 설명이 서로 어긋나지 않는지 확인합니다.
3. 주의
   - 관리자 화면은 일반 직원 화면과 별도 허브로 유지하고, 민감 리스크 상세를 일반 업무 기본 흐름에 섞지 않습니다.

## 기능별 UAT 액션 표

| 기능 | route | 권한 | 직접 해볼 액션 | happy path 확인 포인트 | forbidden/empty/error 포인트 | 현재 dev-safe/mock 잔여 |
| --- | --- | --- | --- | --- | --- | --- |
| 출퇴근 확인 | `/attendance` | EMPLOYEE 이상 | 오늘 기록, 최근 기록, 허용 방식 확인 | 실제 attendance 응답과 정책 source 가 카드에 보임 | fetch 실패, 기록 없음, 정책 미허용 방식 안내 분리 | GPS/실태그/실단말 연동 없음 |
| 근태 정정 | `/attendance` | 본인 또는 승인 권한자 | 정정 요청 문맥 확인 | 본인 범위 정정 요청/상태 문구 설명 가능 | 권한 없는 처리 차단, unknown employee/id 성공 처리 금지 | 실제 운영 승인/정산 연결 없음 |
| 휴가 조회/신청 | `/leave` | EMPLOYEE 이상 | 유형/잔여/요청 상태 확인, 신청 흐름 문맥 확인 | 휴가 신청 후보와 상태가 same-origin 응답 기준으로 읽힘 | 정책 미허용/잔여 부족/회사 scope 차단 문맥 | 자동 차감/급여 연동 없음 |
| 휴가 승인/반려 | `/leave` | 승인 권한자 | 승인 lane 과 차단 이유 확인 | 승인자만 approve/reject 문맥이 열림 | 일반 직원 approve/reject 차단, self-approval 금지 | 실제 인사 운영 반영 없음 |
| 결재 기안 | `/approvals` | EMPLOYEE 이상 | 기안함/문서 상태/양식 후보 확인 | 기안 문서와 결재선 후보가 같은 회사 범위에서 읽힘 | 양식/결재선 관리성 액션 차단 | 실서명/외부 알림 없음 |
| 결재 승인/반려/보완 | `/approvals` | 승인 권한자 | 승인함과 문서 상태, 보완 요청 문맥 확인 | 승인자 lane 이 기안자 lane 과 분리돼 읽힘 | self-approval 금지, unknown document 403, 권한 없음 403 | 실제 법적 효력/원문 보관 없음 |
| 운영 정책 비교 | `/admin/policies` | 관리자 | 일반 업무 문구와 정책 문구 비교 | 정책 source 와 일반 화면 안내가 같은 뜻 | 일반 직원 직접 접근 차단 유지 | 실제 운영 저장/배포 아님 |

## 구현 우선순위

### P0. 현재 직접 눌러보는 액션을 문서/테스트 근거와 같은 언어로 고정
우선 카드:
- `t_a498e76b`
- `t_32c88243`
- `t_268c7c7e`

핵심 범위:
- `/attendance`, `/leave`, `/approvals` 현재 route/UAT/guardrail/승인 게이트 문구 고정
- DB 전환 카드와 UI 실사용화 카드의 완료 기준 분리
- 대장이 직접 인용할 route, action, 권한, 남은 승인 게이트를 같은 말로 정리

### P1. `/attendance` 직원 기준 하루 흐름 강화
- 체크인/체크아웃
- 허용 방식/정책 source
- 정정 요청
- 미허용 이유/Production-ready (실구현) 제한 구분

### P2. `/leave` 신청자 lane / 승인자 lane 분리 강화
- 유형/잔여/요청 상태
- 신청 → 승인/반려
- self-approval 금지
- 회사 scope / 권한 차단 이유 정리

### P3. `/approvals` 기안 → 승인/반려/보완 요청 stepper 강화
- 기안함 / 결재함
- 양식 / 결재선 / 후보
- self-approval 금지
- unknown / forged 차단 설명

### P4. 일반 업무 화면과 운영 정책 화면 언어 정렬
- `/dashboard` 와 `/admin/policies` 설명 맞추기
- 정책 미허용 / 권한 부족 / Production-ready (실구현) 제한 4축 유지
- 급여/세무/노무/외부기관 연동이 아직 별도 승인이라는 점 고정

## 이번 단계에서 일부러 안 하는 것
- 실제 급여 지급, 은행 이체, 실정산 반영
- 주민번호/계좌번호 입력 확대
- production DB 실데이터 반영
- GPS/위치정보 저장, NFC/RFID/QR 장비 연동
- 외부 HR/급여/세무/노무/법령 기관 API 실제 연동
- 전자서명/법적 효력/실원문 장기보관 확정
- DNS/custom domain, 유료 리소스 증설, migration, destructive 작업
- secret 입력/교체

## 구현자가 먼저 볼 파일
1. `apps/web/app/attendance/page.tsx`
2. `apps/web/app/leave/page.tsx`
3. `apps/web/app/approvals/page.tsx`
4. `apps/web/app/_components/real-usage-panels.tsx`
5. `apps/api/test/auth-org.spec.ts`
6. `apps/api/src/app.ts`
7. `packages/shared/src/contracts.ts`
8. `docs/ux/groupware-benchmark-principles.md`
9. `docs/product/groupware-vision-roadmap.md`

## reviewer/tester가 특히 볼 쟁점
- `/attendance`, `/leave`, `/approvals` 가 same-origin API 응답을 실제로 읽으면서도 Production-ready (실구현) honesty 를 잃지 않는지
- 정책 미허용, 권한 부족, 회사 scope 차단, Production-ready (실구현) 제한 4축이 route/API/test/문서에서 같은 뜻인지
- self-approval 금지와 unknown/forged id 차단이 계속 유지되는지
- 운영 정책 화면과 일반 업무 화면 설명이 다시 섞이지 않는지
- production DB, 실급여, 은행, 외부 기관/장비 연동이 후속 happy path 처럼 과장되지 않는지

## 다음 패스에서 바로 다듬을 항목
1. `/attendance` 체크인/정정 요청 stepper 보강
2. `/leave` 신청자 vs 승인자 lane 문구/CTA 보강
3. `/approvals` 기안 상세/승인 상세 stepper 보강
4. `/dashboard` 핵심 업무 진입 문구와 세 모듈 설명 밀도 맞추기
5. PostgreSQL 전환 후 route/API/test 근거를 다시 묶어 실제 저장 기반 문장으로 업데이트
