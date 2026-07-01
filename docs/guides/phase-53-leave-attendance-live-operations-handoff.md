# Phase 53 휴가·근태 실사용화 handoff

## 한 줄 요약

Phase 53은 `/attendance` 와 `/leave` 를 직원이 실제로 따라갈 수 있는 업무 순서로 다시 잠그고, 승인자/운영 정책 lane 을 섞지 않게 만드는 기획·fit-gap 단계다.

## 이번 문서가 넘겨주는 핵심

- 직원 기본 업무 레인은 `/dashboard` → `/attendance` → `/leave` 순서로 다시 묶는다.
- 근태는 "출근 등록 → 오늘 상태 확인 → 퇴근 등록 → 정정 요청" 흐름을 중심으로 본다.
- 휴가는 "잔여 확인 → 신청 → 내 신청 상태 확인" 흐름을 중심으로 본다.
- 승인자 lane 과 운영 정책 lane 은 직원 CTA 와 섞지 않는다.
- 권한 부족 / 정책 미허용 / 회사 scope / Production-ready (실구현) 제한 4축을 근태·휴가 공통 언어로 유지한다.

## 지금 바로 봐야 할 파일

1. `docs/architecture/phase-53-leave-attendance-live-operations-fit-gap-scope.md`
2. `apps/web/app/attendance/page.tsx`
3. `apps/web/app/leave/page.tsx`
4. `apps/web/app/_components/real-usage-panels.tsx`
5. `apps/api/src/app.ts`
6. `apps/api/test/auth-org.spec.ts`
7. `packages/shared/src/contracts.ts`
8. `ROADMAP.md`
9. `TASKS.md`
10. `TEST_PLAN.md`
11. `QA_CHECKLIST.md`
12. `KNOWN_ISSUES.md`

## 이번 Phase에서 확인한 현재 기준

### 근태

웹 기준:
- `apps/web/app/attendance/page.tsx` 에 직원 happy path, 승인자 확인, 정책 gate, 4축 차단 이유가 이미 있다.
- `AttendanceLiveSection` 에서 실제 API 기반 기록 조회, 출근/퇴근, 정정 요청 preview 확인이 가능하다.

API/테스트 기준:
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/attendance/records`
- `POST /api/attendance/corrections`
- `apps/api/test/auth-org.spec.ts` 에 effective policy 기반 허용 방식/차단 검증이 있다.

### 휴가

웹 기준:
- `apps/web/app/leave/page.tsx` 에 신청자 happy path, 승인자 lane, self-approval 차단, 4축 차단 이유가 이미 있다.
- `LeaveLiveSection` 에서 실제 API 기반 잔여/요청 조회, 신청/승인/반려 preview 확인이 가능하다.

API/테스트 기준:
- `GET /api/leave/types`
- `GET /api/leave/balances`
- `GET/POST /api/leave/requests`
- `POST /api/leave/requests/:requestId/approve`
- `POST /api/leave/requests/:requestId/reject`
- `apps/api/test/auth-org.spec.ts` 에 self-approval 차단, 승인/반려, foreign/unknown request 차단이 있다.

## 다음 작업자가 꼭 유지해야 할 문장 기준

### 1) 직원 lane 먼저

문서/화면/UAT는 먼저 직원이 무엇을 하는지 짧게 보여 줘야 한다.

- 근태: 출근 → 상태 확인 → 퇴근 → 정정 요청
- 휴가: 잔여 확인 → 신청 → 상태 확인

### 2) 승인자 lane 분리

- 승인자는 예외/승인 처리 흐름을 본다.
- 일반 직원은 승인 버튼과 운영자용 검토 문장을 기본 CTA 로 보지 않는다.
- 자기 요청 자기승인 금지, 다른 회사 요청 차단, unknown id 차단을 같은 문장으로 유지한다.

### 3) 운영 정책 lane 분리

- `/admin/policies` 는 정책 source/허용 방식/허용 휴가유형/예외 기준을 보는 운영 레인이다.
- `/attendance`, `/leave` 는 실제 업무 레인이다.
- 둘이 다른 말을 하면 안 된다.

### 4) 차단 사유 4축 유지

- 권한 부족
- 정책 미허용
- 회사 scope 차단
- Production-ready (실구현) 제한

이 4축은 문서/화면/API/test 에서 같은 구조로 반복돼야 한다.

## 다음 역할별 액션

### 구현 카드 `t_b729d0a6`

목표:
- `/attendance`, `/leave` 의 실사용 copy 와 route 흐름을 더 직접적인 업무 언어로 다듬기
- 직원/승인자/운영자 노출 차이를 더 선명하게 만들기
- empty/loading/error/forbidden/dev-safe 문장을 실제 사용자가 이해할 표현으로 맞추기

구현 시 체크:
- `preview` 나 `Production-ready (실구현)` 문구가 실사용 happy path 설명을 덮지 않는가
- 승인 대기/승인 버튼이 권한 없는 사용자에게 과하게 노출되지 않는가
- `/dashboard` 상단 액션과 `/attendance`·`/leave` 설명 순서가 맞는가

### 리뷰 카드 `t_40689590`

집중 포인트:
- self-approval 차단
- foreign scope/unknown id 차단
- 권한 없는 approve/reject 차단
- 정책 설명과 실제 화면 문장 충돌 여부
- 민감정보나 운영 완료처럼 보이는 과장 표현 여부

### 테스트 카드 `t_c157ce5b`

집중 포인트:
- `/attendance` check-in/check-out/correction happy path
- `/leave` request/approve/reject happy path
- 권한 없음/회사 scope/unknown id 차단
- live 확인 순서와 local substitute evidence 분리 기록

### 문서화 카드 `t_e92efde2`

집중 포인트:
- 사용자용 짧은 UAT 순서
- 승인자/관리자 확인 순서 분리
- 지금 눌러볼 수 있는 것 / 아직 Production-ready (실구현) 인 것 / 승인 필요한 것 분리
- `admin / 1234` 를 dev/test/UAT 전용으로만 표기

### ops 카드 `t_42d0a17a`

집중 포인트:
- PR/CI/merge/배포 근거
- live URL smoke 와 local build/test substitute evidence 분리
- 최종 보고에 route, 확인 액션, 남은 승인 게이트 명시

## 추천 UAT 초안

직원:
1. `/login`
2. `/dashboard`
3. `/attendance`
4. 출근/퇴근/정정 요청 preview 확인
5. `/leave`
6. 잔여/신청/상태 확인 preview 확인

승인자:
1. `/attendance` 에서 예외/정정 요청 문장 확인
2. `/leave` 에서 승인 대기, 승인/반려 문장 확인
3. self-approval 금지와 권한 부족 차단 문장 확인

운영 관리자:
1. `/admin/policies`
2. 출퇴근 허용 방식과 휴가 허용 유형 설명 확인
3. 직원 화면과 정책 화면이 같은 뜻인지 교차 확인

## 계속 승인 게이트로 남는 것

- GPS/위치정보 수집 저장
- 태그 단말/NFC/RFID/QR 실장비 연결
- 외부 HR/급여/세무/노무 시스템 연동
- production 실데이터 반영
- 실급여/실정산 자동 차감
- 민감 증빙 원문 저장 확대
- secret, DNS/custom domain, 유료 리소스, migration, destructive 작업

## 문서 갱신 이유

기존 Phase 42는 근태·휴가 도메인 전체를 "직원 기본 운영 업무 / 인사·지점 운영 경계 / 별도 승인" 관점에서 정리했다.
이번 Phase 53은 그 위에서 실제 live URL 확인 순서를 더 짧고 직접적인 업무 액션 중심으로 다시 잠그는 역할을 한다. 즉 도메인을 새로 정의한 것이 아니라, 현재 구현 상태에 맞는 실사용 확인 문장으로 좁혀 준 것이다.
