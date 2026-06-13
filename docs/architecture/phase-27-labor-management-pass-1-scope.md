# 그룹웨어 Phase 27 노무 관리 1차 범위

## 1. 한 줄 정의

Phase 27의 목표는
Phase 25에서 만든 공통 `work item` 엔진과
Phase 26에서 정리한 HR meeting/lifecycle 뼈대 위에,
근로계약·근무조건·연차/수당·고충/징계/사고·퇴사 관련
노무 이슈 skeleton 을 권한 강하게 분리해 얹는 것입니다.

쉽게 말하면 이번 단계는
"실제 노무 사건 처리 시스템"을 바로 여는 것이 아니라,
"노무 이슈를 어떤 종류로 나누고 누가 어디까지 볼 수 있는지"
를 공통 제품 언어와 최소 안전 placeholder 기준으로 먼저 고정하는 단계입니다.

이번 단계도
실제 계약서 원문 저장,
실제 징계 확정,
실제 산업재해/사고 보고 제출,
실제 급여 반영,
외부 노무사/법무/회계 연동,
production DB 실데이터 반영
단계는 아닙니다.

## 2. 왜 이번 단계가 필요한가

호텔 위탁경영사 실사용 관점에서는
근태/휴가와 HR meeting 만으로는
직원 관련 운영을 끝까지 설명할 수 없습니다.

실제 현장에서는 아래 같은 노무 이슈가 계속 붙습니다.

- 근로계약 체결/갱신/조건 변경
- 연차 잔여/정정 근거 확인
- 연장·야간·휴일근로와 수당 검토
- 고충 접수와 자료 요청
- 징계 검토와 소명 일정 관리
- 사고/산재/안전 이슈 초기 접수
- 퇴사, 계약 종료, 인수인계 follow-up

이 흐름이 정리되지 않으면 아래 문제가 생깁니다.

- 같은 노무 이슈가 근태 메모, HR 메모, 일반 work item 으로 흩어진다.
- 본사 노무 담당, HR, 지점 관리자가 같은 사건을 서로 다른 기준으로 본다.
- 근태 예외 정정과 징계/고충 같은 민감 사건이 같은 공개 수준으로 보일 수 있다.
- 계약서/소명서/사고기록 원문이 아직 없는 단계인데 이미 저장 가능한 것처럼 오해될 수 있다.
- 외부 노무사/법무/회계 연동이나 실제 급여 반영을 너무 일찍 약속하게 된다.

그래서 Phase 27에서는
기존 공통 업무 엔진과 HR lifecycle 흐름을 유지한 채,
그 위에 "노무 이슈 분류 + 접근 경계 + audit 흔적"
기준을 먼저 올립니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/근거:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-25-common-work-doc-access-engine-pass-1-scope.md`
- `docs/guides/phase-25-common-work-doc-access-engine-pass-1-handoff.md`
- `docs/architecture/phase-26-hr-meeting-management-pass-1-scope.md`
- `docs/guides/phase-26-hr-meeting-management-pass-1-handoff.md`
- `ROADMAP.md`, `TASKS.md`, `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`
- parent Phase 26 최종 보고 metadata

현재 기준으로 확인되는 사실:

- 공통 `work item` 엔진과 `labor` 모듈 placeholder 자리는 이미 있다.
- HR meeting/lifecycle 구조는 이미 `hr` 모듈 쪽에서 category + metadata + visibility 방식으로 1차 정리돼 있다.
- 회사 + 지점/호텔 + 역할 + capability 경계는 공통 업무 엔진에서 중요한 기준으로 자리 잡았다.
- 모바일 하단 탭 5개 유지와 `홈`/`메뉴`/PC sidebar 확장 원칙은 그대로 유지해야 한다.
- 아직 실제 계약서/징계서/사고기록 원문 저장, 외부 전문가 연동, 급여 반영은 모두 승인 게이트다.

따라서 이번 Phase의 핵심은
노무 기능을 많이 완성하는 것이 아니라,
기존 공통 업무 엔진이 노무 이슈를
어떻게 안전하게 담는지 설명 가능한 상태로 만드는 것입니다.

## 4. Phase 27에서 고정하는 핵심 결정

### 결정 A. 노무 이슈도 공통 `work item` 위에 올린다.

이번 단계에서도 기준 엔티티는
새 별도 "노무 사건 앱"이 아니라
기존 `work item` 입니다.

대신 `labor` 모듈 안에서
아래 category 확장 초안을 둡니다.

- `employment_contract`
- `work_condition_change`
- `leave_balance_adjustment`
- `allowance_review`
- `overtime_review`
- `grievance`
- `discipline_review`
- `incident_report`
- `offboarding_clearance`

핵심 원칙:

- 1차는 `module = labor` 를 유지하고, 이슈 종류 차이는 `category` 와 보조 metadata 로 푼다.
- 연차/수당/초과근무는 실제 급여 확정이 아니라 "검토/증빙/후속조치" 문맥으로 먼저 본다.
- 고충/징계/사고도 먼저 사건 접수와 검토 skeleton 으로 설명하고, 실제 법적 판단/확정 처리는 열지 않는다.

### 결정 B. 기본 상태는 계속 공통 상태를 쓴다.

Phase 25에서 정리한 공통 상태는 그대로 유지합니다.

- `draft`
- `todo`
- `in_progress`
- `waiting_review`
- `blocked`
- `done`
- `archived`

중요:

- 계약, 수당, 징계, 사고마다 별도 주 상태군을 새로 만들지 않는다.
- "자료요청/검토중/조치완료" 같은 의미는 공통 상태 + 보조 필드 조합으로 푼다.

labor 보조 필드 초안:

- `intake_status`: `received | screening | evidence_requested | under_review | action_planned | closed`
- `confidentiality_level`: `standard | labor_private | grievance_restricted | disciplinary_restricted`
- `requires_acknowledgement`: boolean
- `legal_hold_required`: boolean

즉,
공통 업무 상태와
노무 검토 진행 의미를 한 필드에 억지로 섞지 않습니다.

### 결정 C. 노무 skeleton 은 접수·근거·검토·조치·기록 5묶음으로 본다.

초기 설명 기준:

1. 접수
   - 어떤 이슈가 들어왔는지
   - 어느 회사/지점 문맥인지
   - 누가 접수했는지

2. 근거 자료
   - 근태 기록 요약
   - 계약 조건 요약
   - 연차/수당 계산 근거 요약
   - 사고/고충 관련 제출 자료 존재 여부

3. 검토
   - 본사 노무 담당
   - HR
   - 지점 관리자
   - 필요 시 감사/승인자

4. 조치
   - 추가 자료 요청
   - 설명/소명 요청
   - 후속 meeting 또는 follow-up work item 생성
   - 정책/근태 정정 검토

5. 기록/audit
   - 누가 상태를 바꿨는지
   - 누가 민감 이슈를 열람했는지
   - 어떤 자료가 요청됐는지

핵심은
노무 사건을 곧바로 원문 저장/법률 확정 시스템으로 만들기보다,
기존 공통 업무 엔진이 노무 이슈 흐름도 담을 수 있게 설명하는 것입니다.

### 결정 D. 노무 이슈는 HR lifecycle/근태 흐름과 연결하되 별도 민감도를 둔다.

이번 단계의 lifecycle/labor anchor 초안:

- 입사/계약 체결
- 근무조건 변경
- 연차/근태 정정 근거 확인
- 수당/초과근무 검토
- 고충 접수와 후속조치
- 징계 검토/소명 절차 준비
- 사고/안전 이슈 접수
- 퇴사/계약 종료/인수인계 정리

중요:

- HR meeting 과 노무 이슈를 완전히 같은 민감도로 취급하지 않는다.
- 근태/휴가 데이터와 연결되더라도 바로 급여 확정/법적 확정으로 넘어가는 것처럼 쓰지 않는다.
- 노무 이슈는 HR lifecycle 의 연장선이지만, 더 좁은 열람권한과 audit 강도를 기본값으로 둔다.

### 결정 E. 권한은 본사 노무 담당 / HR / 지점 관리자 / 근무자 / 감사로 더 분명히 나눈다.

초기 접근 제어 원칙:

- 본사 노무 담당
  - 여러 지점 노무 이슈를 본다.
  - `labor_private` 범위 접근 주체다.
  - `disciplinary_restricted`, `grievance_restricted` 는 별도 capability 가 있어야 본다.

- 본사 HR
  - 계약/근무조건/퇴사 follow-up 같이 HR과 맞닿은 범위를 본다.
  - 모든 징계/고충 상세 원문을 자동 열람하는 주체로 쓰지 않는다.

- 지점 관리자
  - 자기 지점 직원의 일정/자료 요청/후속조치 요약만 본다.
  - 민감 소명서, 징계 검토 메모, 제한 고충 상세 전체를 보는 주체가 아니다.

- 일반 근무자
  - 자기 계약 안내, 자기 자료 제출 요청, 자기 이슈 상태 정도만 본다.
  - 타 직원 노무 이슈, 지점 전체 사건, 제한된 조사 메모는 보지 못한다.

- 감사 사용자
  - read-only 감사 흐름을 우선한다.
  - 민감 원문보다 접근 흔적, 상태 변경, 권한 사용 흔적 중심으로 본다.

중요:

- "관련자였다"와 "모든 사건 메모를 본다"를 같은 뜻으로 취급하지 않는다.
- 지점 관리자는 운영 동행 주체이지, 본사 노무/법무 판단 자료 전체 열람 주체가 아니다.

### 결정 F. 메뉴는 새 하단 탭 없이 공통 업무/인사 묶음 안에서 푼다.

UX 기준:

- 모바일 하단 탭은 계속 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개를 유지한다.
- 노무 관련 자리는 `홈` 요약 카드와 `메뉴`/PC sidebar 의 `공통 업무 > 노무` 또는 `인사/노무` 그룹 안에서 푼다.

초기 배치 방향:

- 모바일 `홈`: 내 제출 필요 자료, 내 계약/정정 요청 상태, 지점 관리자용 팀 예외 검토 요약
- 모바일 `메뉴`: `노무` 진입점 아래 `계약/조건`, `연차/수당`, `고충`, `사고/징계`, `퇴사/종료`
- PC sidebar: 일반 직원용 노무 entry 와 본사 운영용 노무 운영 entry 분리

중요:

- 노무 민감 기능을 일반 협업 메뉴처럼 가볍게 섞지 않는다.
- `/admin/*` 정책 관리와 일반 직원 노무 화면을 같은 메뉴층에서 설명하지 않는다.

### 결정 G. 실제 계약서/징계/사고/고충 원문과 외부 연동은 계속 승인 게이트다.

이번 Phase 27에서도 아래는 범위 밖입니다.

- 실제 근로계약서/변경합의서 원문 저장/확정
- 실제 징계 확정/통지 시스템
- 실제 고충 조사 원문 저장/열람 확대
- 실제 산업재해/사고 신고 제출
- production DB 실데이터 입력/수정
- 주민번호/계좌/건강정보/징계사유 원문 저장
- 외부 노무사/법무/회계/홈택스/급여 시스템 연동
- 실제 급여 반영/정산
- custom domain/DNS 변경
- secret 입력/교체
- 유료 리소스 생성·증설
- destructive migration/삭제 작업

### 결정 H. builder는 기존 공통 엔진을 깨지 않는 최소 확장을 우선 구현한다.

이번 기획 기준에서 builder가 먼저 잡아야 할 최소 안전 범위는 아래입니다.

- shared contract 에 `labor` issue metadata 초안 추가
- 기존 `work item` schema 를 유지하면서 `category`, `intake_status`, `confidentiality_level`, `requires_acknowledgement`, `legal_hold_required` 같은 보조 필드 확장 검토
- `/work-items/labor` 또는 그 하위 skeleton copy/API placeholder 에 노무 이슈 유형과 권한 안내 반영
- API placeholder 응답에 근거 자료 요약, 검토 주체, 후속조치 요약, audit 안내 구조 추가
- 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 차이를 test 로 붙들기
- metadata-only 원칙과 외부 전문가/급여 시스템 비연동 원칙을 문서/응답/UI copy 에 유지

즉,
실제 계약서 처리나 급여/법률 연동보다,
기존 공통 업무 엔진 위에 노무 이슈 skeleton 을 올리는 것이 우선입니다.

## 5. 제안 데이터 구조 초안

### 5-1. 공통 work item 확장 방향

기존 공통 `work item` 의 큰 틀은 유지하고,
`laborContext` 같은 보조 구조를 얹는 방향을 권장합니다.

예시 필드:

- `category`
- `employeeId`
- `intakeStatus`
- `confidentialityLevel`
- `requiresAcknowledgement`
- `legalHoldRequired`
- `evidenceSummary[]`
- `reviewActors[]`
- `followUp`
- `visibility`
- `auditHints`

### 5-2. evidence 요약 초안

예시:

- `type`: `attendance_record | leave_balance | contract_snapshot | allowance_basis | grievance_statement | incident_attachment`
- `summary`
- `submittedByScope`
- `submittedAt`
- `containsSensitiveData`

중요:

- evidence 는 "원문 blob 저장"이 아니라 요약 metadata 중심으로 먼저 설명한다.
- raw storage key, 외부 링크, signed URL 전문은 기본 응답에 두지 않는다.

### 5-3. review actor 초안

예시:

- `scope`: `labor_hq | hr_hq | branch_manager | employee | auditor`
- `roleCode`
- `responsibility`: `screening | evidence_check | policy_review | acknowledgement | audit_only`
- `status`

### 5-4. follow-up 초안

예시:

- `required`
- `type`: `document_request | meeting_request | policy_review | schedule_adjustment | closure_check`
- `ownerScope`
- `dueAt`
- `linkedWorkItemId?`

## 6. 대장이 먼저 볼 8가지 질문

1. 노무 이슈가 기존 공통 `work item` 엔진 위에서 어떻게 설명되는가?
2. 공통 상태와 노무 intake/review 의미가 섞이지 않고 정리돼 있는가?
3. 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 차이가 쉬운 말로 설명되는가?
4. 계약/연차/수당/고충/징계/사고/퇴사 범주가 같은 제품 언어로 정리되는가?
5. 근거 자료와 민감 원문이 구분돼 metadata 중심 원칙이 유지되는가?
6. 모바일 하단 탭을 늘리지 않고 `홈`/`메뉴`/PC sidebar 에 노무 entry 를 잡는 기준이 있는가?
7. 실제 계약서/징계/사고/급여 반영/외부 전문가 연동이 계속 승인 게이트로 남아 있는가?
8. builder가 바로 구현할 최소 안전 범위가 기존 공통 엔진 확장 중심으로 정리돼 있는가?

이 8개 질문에 바로 답이 안 보이면
이번 Phase 27 정리가 덜 된 상태입니다.

## 7. 대장이 바로 따라 볼 쉬운 순서

1. `/work-items` — 공통 업무 허브와 API 골격이 먼저 보이는지 확인
2. `/work-items/labor` — 노무 이슈 유형, 권한 분리, 승인 게이트 문구 확인
3. `/api/work-items?module=labor` — labor placeholder 목록과 `viewerScope` / `confidentialityLevel` 확인
4. `apps/api/test/work-items.spec.ts` — restricted labor 경계 테스트 확인
5. `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx` — 허브/노무 route copy 와 route 연결 회귀 확인
6. 마지막으로 실제 계약서/징계/사고/급여 연동/production data 가 여전히 닫혀 있는지 확인

## 8. 먼저 볼 파일

### 이번 Phase 27 문서

- `docs/architecture/phase-27-labor-management-pass-1-scope.md`
- `docs/guides/phase-27-labor-management-pass-1-handoff.md`

### 바로 앞 기준 문서

- `docs/architecture/phase-26-hr-meeting-management-pass-1-scope.md`
- `docs/guides/phase-26-hr-meeting-management-pass-1-handoff.md`
- `docs/architecture/phase-25-common-work-doc-access-engine-pass-1-scope.md`
- `docs/guides/phase-25-common-work-doc-access-engine-pass-1-handoff.md`

### 구현 근거로 같이 볼 파일

- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`

### 루트 문서

- `ROADMAP.md`
- `TASKS.md`
- `SPEC.md`
- `DATA_MODEL.md`
- `API.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`

## 9. 권장 구현 순서

1. 기존 `work item` / `labor` 모듈 기초를 다시 확인한다.
2. labor 이슈 유형을 새 상태군이 아니라 `category` + 보조 metadata 로 정리한다.
3. evidence/review/follow-up/audit 구조를 metadata 중심 skeleton 으로 설계한다.
4. 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 차이를 API/UI copy 에 같이 반영한다.
5. `/work-items/labor` 중심으로 노무 entry 를 우선 정리한다.
6. 실제 계약서 원문 비저장, 외부 전문가/급여 시스템 비연동, production data 비사용이 문서와 구현에서 흔들리지 않는지 마지막에 다시 본다.

## 10. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- 기존 Phase 25 공통 `work item` 엔진 위에 `labor` issue metadata 확장
- `category`, `intake_status`, `confidentiality_level`, `requires_acknowledgement`, `legal_hold_required` 같은 보조 필드 검토
- `/work-items/labor` 또는 그 하위 skeleton copy/API placeholder 에 노무 구조 반영
- 근거 자료/검토 주체/후속조치 요약 응답과 visibility 테스트

피해야 할 것:

- 실제 사건 처리 시스템처럼 과한 기능 확장
- 외부 노무사/법무/회계/급여 시스템 연동
- 실제 민감 계약/징계/사고 원문 저장
- production DB 실데이터 연결

### 리뷰어(gwreviewer)

집중할 것:

- intake/review 의미와 공통 상태가 섞이지 않는지
- 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 차이가 과장 없이 유지되는지
- `disciplinary_restricted`, `grievance_restricted` 같은 민감 경계가 실제로 더 좁게 다뤄지는지
- 외부 연동/실민감 기록이 승인 게이트로 남아 있는지

### 테스터(gwtester)

집중할 것:

- `module=labor` 목록/상세/restricted 경계가 역할별로 다르게 보이는지
- `/work-items/labor` copy 가 "현재 가능한 것 / 아직 안 되는 것 / 승인 필요"를 숨기지 않는지
- 기존 HR/공통 work item 흐름을 깨지 않았는지 회귀 확인

### 문서화(gwdocs)

집중할 것:

- 계약/연차/수당/고충/징계/사고/퇴사 용어가 쉬운 한국어로 같은 뜻을 유지하는지
- 민감 원문 저장과 metadata 요약을 문서/보고에서 구분하는지
- 사용자 보고 시 승인 게이트와 현재 확인 가능 경로를 짧게 정리하는지

## 11. 이번 Phase에서 명시적으로 하지 않는 일

- 실제 근로계약 체결/전자서명
- 실제 급여/수당 정산 반영
- 실제 징계 확정/통지 발송
- 실제 사고 신고 제출/대외 보고
- 외부 노무사/법무사/회계/급여/홈택스 계정 연동
- production DB 실데이터 반영
- 민감 원문 저장 구조 확정

핵심은
"노무 관리 완성"이 아니라
"노무 이슈를 안전하게 담는 기본 skeleton 확정"입니다.
