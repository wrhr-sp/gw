# Phase 53 휴가·근태 실사용화 fit-gap scope

## 1. 문서 목적

이 문서는 Phase 53에서 `/attendance` 와 `/leave` 를 "근태/휴가 기능이 있다" 수준이 아니라, 대장이 live URL에서 직접 눌러 보며 직원·승인자·운영 관리자 흐름을 구분해 이해할 수 있는 실사용 문장으로 다시 잠그기 위한 기준이다.

이번 Phase의 핵심은 새 외부 연동을 여는 것이 아니다. 이미 존재하는 same-origin API, 웹 route, 테스트 근거를 바탕으로 아래 흐름을 같은 언어로 정리하는 데 목적이 있다.

- 직원 근태 흐름: 출근 등록 → 오늘 상태 확인 → 퇴근 등록 → 정정 요청
- 직원 휴가 흐름: 잔여 확인 → 휴가 신청 → 내 신청 상태 확인
- 승인자 흐름: 예외 기록/휴가 요청 확인 → 승인/반려 → 상태 재확인
- 운영 관리자 흐름: `/admin/policies` 기준 정책 source/허용 방식/허용 휴가유형 설명과 실제 직원 화면 문장이 같은 뜻인지 확인

## 2. 이번 Phase에서 닫으려는 범위

### 2-1. 직원 기본 업무 시작점을 `/dashboard` → `/attendance` → `/leave` 로 다시 고정한다.

- `/attendance` 는 "오늘 근무 시작/종료와 예외 정정" 화면으로 먼저 읽혀야 한다.
- `/leave` 는 "잔여 확인 후 신청하고 결과를 다시 보는" 화면으로 먼저 읽혀야 한다.
- 두 화면 모두 정책 설명만 길게 보여 주지 말고, 직원이 지금 눌러야 할 첫 액션을 먼저 보여 줘야 한다.
- `/approvals`, `/boards`, `/documents` 같은 다른 일반 업무 레인과 이어지더라도, 이번 Phase의 주인공은 근태/휴가 2개 모듈이다.

### 2-2. 근태는 직원 lane, 승인자 lane, 운영 정책 lane 을 분리해 설명한다.

직원 lane:
- 허용된 출퇴근 방식 확인
- 출근 등록
- 오늘 상태/최근 기록 확인
- 퇴근 등록
- 본인 기록 정정 요청

승인자 lane:
- 예외 기록 확인
- 정정 요청 검토
- 다른 직원 처리 권한이 없는 사용자는 여기로 올라오지 못함

운영 정책 lane:
- `/admin/policies` 에서 effective policy source 확인
- 허용 방식(`mobile`, `pc`, `tag`)과 정책 우선순위 설명
- 정책 설명이 직원 화면 안내와 서로 다른 말을 하지 않도록 정렬

### 2-3. 휴가는 신청자 lane, 승인자 lane, 운영 정책 lane 을 분리해 설명한다.

신청자 lane:
- 허용 휴가 유형 확인
- 잔여/예약/사용 snapshot 확인
- 기간/사유 입력 후 신청
- 내 신청 상태 재확인

승인자 lane:
- 승인 대기 요청 확인
- 승인 또는 반려
- 자기 요청 자기승인 금지
- 다른 회사 요청/unknown request id 차단

운영 정책 lane:
- `/admin/policies` 의 허용 휴가유형/승인 노출 규칙/예외 검토 기준 확인
- `/leave` 화면의 잔여/제한/예외 설명이 정책 화면과 같은 방향인지 확인

### 2-4. 상태 안내는 4축으로 고정한다.

근태와 휴가 모두 아래 4축을 같은 구조로 유지한다.

1) 권한 부족
- 승인 권한 없는 사용자는 승인 액션을 열지 않는다.
- 다른 직원 처리나 운영자용 요약을 직원 화면 CTA 로 섞지 않는다.

2) 정책 미허용
- 근태: 허용되지 않은 등록 방식은 성공처럼 처리하지 않는다.
- 휴가: 허용되지 않은 휴가 유형, 잔여 부족, 예외 검토 필요 상태를 승인 lane 과 섞지 않는다.

3) 회사 scope 차단
- forged/unknown employee id, attendance record id, leave request id 는 성공처럼 보이면 안 된다.
- 다른 회사 요청/기록은 조회·승인·변경 모두 차단한다.

4) placeholder 제한
- 실급여/실정산 자동 반영
- GPS/위치정보 수집 저장
- NFC/RFID/QR/실장비 연결
- 외부 HR/급여/세무/노무 시스템 연동
- production 조직 master 자동 반영
- 민감한 실제 사유 전문/증빙 원문 저장 확대
위 항목은 계속 별도 승인 게이트다.

## 3. 현재 구현/계약 기준에서 확인된 근거

### 3-1. 웹 route 기준

- `apps/web/app/attendance/page.tsx`
  - 직원 happy path 를 "출근 → 오늘 상태 확인 → 퇴근 → 정정 요청" 순서로 설명한다.
  - 승인자 확인과 운영 정책 확인을 직원 CTA 와 분리해 적고 있다.
  - 권한 부족/정책 미허용/회사 scope/placeholder 제한 4축 카드가 이미 있다.
- `apps/web/app/leave/page.tsx`
  - 잔여 확인 → 신청 → 상태 확인 순서와 승인자 lane 분리가 이미 들어가 있다.
  - self-approval 차단, 회사 scope 차단, 정책상 미허용, placeholder 제한 문구가 분리돼 있다.
- `apps/web/app/_components/real-usage-panels.tsx`
  - `AttendanceLiveSection` 은 `/api/attendance/records`, 출근/퇴근, 정정 요청 preview 를 같은 섹션에서 다룬다.
  - `LeaveLiveSection` 은 `/api/leave/balances`, `/api/leave/requests`, 신청/승인/반려 preview 를 같은 섹션에서 다룬다.

### 3-2. API/contract 기준

- `packages/shared/src/contracts.ts`
  - attendance: `check-in`, `check-out`, `records`, `corrections`
  - leave: `types`, `balances`, `requests`, `approve(requestId)`, `reject(requestId)`
- `apps/api/src/app.ts`
  - 근태 체크인/체크아웃/기록 조회/정정 요청 route 존재
  - 휴가 유형/잔여/요청 조회/요청 생성 route 존재
- `apps/api/test/auth-org.spec.ts`
  - effective policy 기반 허용 출퇴근 방식 검증
  - 미허용 방식 차단
  - self-approval 차단
  - 승인자 approve/reject 가능
  - foreign/unknown request 차단

## 4. fit-gap 정리

### 4-1. 이미 맞는 점

- same-origin route/API/test 기준선은 이미 있다.
- 직원 lane 과 승인자 lane 을 분리하려는 문장 구조가 웹 화면에 들어가 있다.
- 정책 미허용과 회사 scope 차단을 설명하려는 방향이 `/attendance`, `/leave`, `/admin/policies`, API 테스트에 공통으로 존재한다.
- 실장비/GPS/실급여 반영/외부 연동이 아직 별도 승인 게이트라는 점도 이미 드러나 있다.

### 4-2. 아직 더 잠가야 하는 점

- `/attendance` 와 `/leave` 가 각각 따로는 읽히지만, "직원 기본 업무 레인 안에서 둘이 어떤 순서로 이어지는가"를 루트 문서까지 같은 문장으로 잠가야 한다.
- 승인자 lane 이 있다는 사실과 실제로 누구에게 어떤 버튼이 보이는지를 reviewer/tester/UAT 문장까지 같은 뜻으로 맞춰야 한다.
- `preview`, `placeholder`, `guard 확인` 같은 내부 검증 표현이 최종 실사용 문장을 덮지 않게 정리해야 한다.
- live 직접 확인 근거와 local test/build/release gate 대체 근거를 같은 수준처럼 섞지 말아야 한다.

### 4-3. 이번 Phase에서 일부러 닫지 않는 것

- GPS/위치기반 출퇴근 실연동
- 태그 단말 실연동
- 외부 HRIS/출입/급여/세무/노무 시스템 연결
- production 실데이터 반영
- 실급여 자동 차감/정산/원천계산
- 민감 증빙 원문 저장 확대
- secret, DNS/custom domain, 유료 리소스, migration, destructive 작업

## 5. 이번 Phase 완료 기준

다음 조건이 모두 맞아야 "기획·fit-gap 정리 완료"로 본다.

1. 루트 문서들이 Phase 53을 현재 활성 범위로 가리킨다.
2. Phase 53 기준 scope/handoff 문서가 생성돼 다음 작업자가 바로 참조할 수 있다.
3. `/attendance` 와 `/leave` 의 직원 lane / 승인자 lane / 운영 정책 lane 설명이 한 문장 체계로 정리된다.
4. 권한 부족 / 정책 미허용 / 회사 scope / placeholder 제한 4축이 문서에 명시된다.
5. 후속 구현·리뷰·테스트·문서화·ops 카드가 이미 있으면 그 체인을 루트 문서에 연결하고, 없으면 생성한다.

## 6. 다음 역할봇에게 넘길 구현 포인트

### 구현(`gwbuilder`)
- `/attendance` 와 `/leave` 의 실사용 카피를 더 짧고 직접적인 업무 순서로 다듬기
- 직원/승인자/운영자 노출 분리를 route 단위로 더 선명하게 만들기
- empty/loading/error/forbidden/dev-safe 문장을 실제 사용자 관점으로 다듬기

### 리뷰(`gwreviewer`)
- 승인 권한 노출 범위
- self-approval/foreign scope/unknown id 차단
- 정책 설명과 화면 copy 충돌 여부
- 민감정보/실운영 완료처럼 읽히는 표현 존재 여부

### 테스트(`gwtester`)
- `/attendance` 체크인/체크아웃/정정 요청
- `/leave` 신청/승인/반려
- 권한 없는 사용자 차단
- 회사 scope 차단
- live route 기준 UAT 문장과 API 테스트 근거 정렬

### 문서화(`gwdocs`)
- 사용자용 짧은 확인 순서
- 승인자/운영자용 확인 순서 분리
- 아직 승인 필요한 항목과 지금 눌러볼 수 있는 항목 분리

### 배포/운영(`gwops`)
- PR/CI/merge/Cloudflare deploy 확인
- live URL smoke 와 local substitute evidence 분리 기록
- 최종 보고 시 대장이 직접 눌러볼 route/액션/승인 게이트 명시
