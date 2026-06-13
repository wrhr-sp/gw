# Phase 27 노무 관리 1차 handoff

한 줄 요약:
이번 Phase 27은
Phase 25 공통 업무 엔진과 Phase 26 HR lifecycle 기준 위에,
근로계약·연차/수당·고충/징계/사고·퇴사 관련 노무 이슈를
권한 강하게 분리한 최소 안전 skeleton 으로 올리는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 기반:

- 공통 `work item` 엔진이 이미 있다.
- `labor` 모듈 placeholder 자리도 이미 있다.
- 회사 + 지점/호텔 + 역할 + capability 접근 기준도 이미 문서와 구현에 올라와 있다.
- 모바일 하단 탭 5개 유지와 `홈`/`메뉴`/PC sidebar 확장 원칙도 있다.
- HR meeting/lifecycle 구조는 이미 `hr` 모듈에서 category + metadata + visibility 방식으로 1차 정리돼 있다.

이번 패스에서 먼저 맞추는 것:

- 노무 이슈를 공통 `work item` 위에 어떻게 올릴지
- 계약/연차/수당/고충/징계/사고/퇴사 범주를 어떻게 나눌지
- 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 를 어디서 갈라야 하는지
- 실제 원문 저장 없이 metadata 중심으로 어디까지 표현할지

아직 안 여는 것:

- 실제 계약서/징계서/사고기록 원문 저장
- 실제 급여 반영/정산
- 실제 법적 사건 확정 처리
- 외부 노무사/법무/회계/급여/홈택스 연동

즉 지금은
"노무 이슈를 안전하게 담는 그릇"
을 맞추는 단계지,
실제 민감 노무 처리 시스템을 여는 단계는 아닙니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) 새 노무 앱을 만드는 단계가 아니다.

이번 단계에서 먼저 보는 것은
별도 사건 처리 솔루션이 아니라
기존 `work item` 엔진 위에 올라가는 labor skeleton 입니다.

핵심 category 초안:

- `employment_contract`
- `work_condition_change`
- `leave_balance_adjustment`
- `allowance_review`
- `overtime_review`
- `grievance`
- `discipline_review`
- `incident_report`
- `offboarding_clearance`

쉽게 말하면,
노무 이슈를 종류별로 나누되
담는 기본 그릇은 계속 공통 업무 엔진으로 유지하겠다는 뜻입니다.

### 2) 기본 상태는 늘리지 않고 labor 보조 상태를 따로 둔다.

Phase 25 공통 상태는 계속 아래를 씁니다.

- `draft`
- `todo`
- `in_progress`
- `waiting_review`
- `blocked`
- `done`
- `archived`

labor 쪽에서 추가로 필요한 것은
새 주 상태가 아니라 보조 metadata 입니다.

예시:

- `intake_status`: `received | screening | evidence_requested | under_review | action_planned | closed`
- `confidentiality_level`: `standard | labor_private | grievance_restricted | disciplinary_restricted`
- `requires_acknowledgement`
- `legal_hold_required`

중요한 이유:

- 노무 사건의 검토 단계와 업무 처리 상태를 한 필드에 섞으면 더 복잡해진다.
- 그래서 "업무는 어디까지 갔는가"와 "노무 검토는 어떤 단계인가"를 나눠 읽게 한다.

### 3) labor skeleton 은 접수·근거·검토·조치·기록 5묶음으로 본다.

이번 단계에서 같이 보는 구조는 아래입니다.

1. 접수
   - 어떤 이슈인지, 어느 지점 문맥인지, 누가 올렸는지
2. 근거 자료
   - 근태/연차/계약/사고 자료 요약과 제출 필요 여부
3. 검토
   - 본사 노무 담당, HR, 지점 관리자, 필요 시 감사
4. 조치
   - 자료 요청, 설명/소명 요청, 후속 meeting/work item 연결
5. 기록/audit
   - 상태 변경, 열람 흔적, 요청 이력

즉,
노무 이슈를 단순 메모가 아니라
권한과 후속조치를 가진 업무 단위로 읽는 방향입니다.

### 4) HR lifecycle/근태 흐름과 연결하되 더 좁은 민감도를 둔다.

이번 Phase 27에서 같이 보는 anchor 흐름은 아래입니다.

- 입사/계약 체결
- 근무조건 변경
- 연차/근태 정정 근거 확인
- 수당/초과근무 검토
- 고충 접수와 후속조치
- 징계 검토/소명 준비
- 사고/안전 이슈 접수
- 퇴사/계약 종료 정리

중요:

- HR meeting 과 노무 이슈를 같은 공개 수준으로 다루지 않는다.
- 근태/휴가와 연결되더라도 급여 확정이나 법적 확정까지 바로 연상되게 쓰지 않는다.
- 노무 이슈는 더 좁은 열람권한과 audit 강도를 기본값으로 둔다.

### 5) 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 를 분명히 나눈다.

초기 원칙:

- 본사 노무 담당: 여러 지점 labor 이슈를 더 넓게 본다.
- 본사 HR: 계약/조건/퇴사 follow-up 같이 HR와 맞닿은 범위를 본다.
- 지점 관리자: 자기 지점 직원 관련 일정/자료 요청/후속조치 요약만 본다.
- 일반 직원: 자기 계약 안내, 자기 제출 요청, 자기 이슈 상태만 본다.
- 감사 사용자: read-only 접근 흔적과 상태 변경 중심으로 본다.

중요:

- 관련자라고 해서 모든 민감 메모를 다 보는 것이 아니다.
- 지점 관리자는 운영 동행 범위만 보고, 본사 노무 판단 자료 전체를 열람하는 주체가 아니다.

### 6) 모바일 하단 탭은 그대로 두고 labor entry 를 확장한다.

이번 Phase 27에서도 아래는 그대로 유지합니다.

- 하단 탭: `메뉴`·`홈`·`메신저`·`메일`·`알림`

새 labor 자리는 아래처럼 풉니다.

- 모바일 `홈`: 내 제출 필요 자료, 내 계약/정정 요청 상태, 팀 예외 검토 요약
- 모바일 `메뉴`: `노무` 진입점 아래 `계약/조건`, `연차/수당`, `고충`, `사고/징계`, `퇴사/종료`
- PC sidebar: 일반 직원용 노무 entry 와 본사 운영용 노무 운영 entry 분리

즉,
새 노무 기능이 생긴다고 하단 탭부터 늘리는 것이 아니라
기존 정보구조 안에서 자리를 먼저 확보합니다.

### 7) 실제 계약서/징계/사고/급여 반영과 외부 연동은 계속 승인 게이트다.

이번 단계에서도 아직 열지 않는 것:

- 실제 계약서/변경합의서 원문 저장/확정
- 실제 징계 확정/통지
- 실제 고충 조사 원문 저장
- 실제 산업재해/사고 신고 제출
- 실제 급여/수당 정산 반영
- 외부 노무사/법무/회계/급여/홈택스 연동
- production DB 실데이터 입력

이 문서는
"노무 이슈를 안전하게 담는 그릇"
을 정하는 단계지,
실제 민감 노무 처리 시스템을 바로 여는 단계가 아닙니다.

## 3. 대장이 가장 먼저 볼 8가지 질문

1. 노무 이슈가 기존 공통 `work item` 엔진 위에서 어떻게 읽히는지 바로 설명할 수 있는가?
2. 공통 상태와 labor intake/review 보조 상태가 섞이지 않고 정리돼 있는가?
3. 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 차이가 같은 권한 언어로 정리돼 있는가?
4. 계약/연차/수당/고충/징계/사고/퇴사 범주가 하나의 제품 언어로 정리돼 있는가?
5. 근거 자료와 민감 원문이 구분돼 metadata 중심 원칙이 유지되는가?
6. 모바일 하단 탭을 늘리지 않고 `홈`/`메뉴`/PC sidebar 에 labor entry 를 잡는 기준이 있는가?
7. 실제 계약서/징계/사고/급여 반영/외부 전문가 연동이 여전히 승인 게이트로 남아 있는가?
8. builder가 바로 구현할 최소 안전 범위가 기존 공통 엔진 확장 중심으로 정리돼 있는가?

이 8개 질문 중 하나라도 애매하면
이번 Phase 27 정리가 덜 된 상태입니다.

대장이 바로 따라 볼 쉬운 순서:

1. `/work-items` — 공통 업무 허브와 API 골격이 먼저 보이는지 확인
2. `/work-items/labor` — 노무 이슈 유형, 권한 분리, 승인 게이트 문구 확인
3. `/api/work-items?module=labor` — labor placeholder 목록과 `viewerScope` / `confidentialityLevel` 확인
4. `apps/api/test/work-items.spec.ts` — restricted labor 경계 테스트 확인
5. `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx` — 허브/labor route copy 와 route 연결 회귀 확인
6. 마지막으로 실제 계약서/징계/사고/급여 연동/production data 가 여전히 승인 게이트로 남았는지 확인

## 4. 먼저 볼 파일

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

## 5. 권장 구현 순서

1. 기존 `work item` / `labor` 모듈 기초를 다시 확인한다.
2. labor 이슈 유형을 새 상태군이 아니라 `category` + 보조 metadata 로 정리한다.
3. evidence/review/follow-up/audit 구조를 metadata 중심 skeleton 으로 설계한다.
4. 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 차이를 API/UI copy 에 같이 반영한다.
5. `/work-items/labor` 중심으로 labor entry 를 우선 정리한다.
6. 실제 계약서 원문 비저장, 외부 전문가/급여 시스템 비연동, production data 비사용이 문서와 구현에서 흔들리지 않는지 마지막에 다시 본다.

## 6. 각 역할 카드에 넘길 핵심 포인트

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

- labor intake/review 의미와 공통 상태가 섞이지 않는지
- 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 차이가 과장 없이 유지되는지
- `disciplinary_restricted`, `grievance_restricted` 같은 민감 경계가 실제로 더 좁게 다뤄지는지
- 외부 연동/실민감 기록이 승인 게이트로 남아 있는지

### 테스터(gwtester)

집중할 것:

- `module=labor` 목록/상세/restricted 경계가 역할별로 다르게 보이는지
- `/work-items/labor` copy 가 "현재 가능한 것 / 아직 안 되는 것 / 승인 필요"를 숨기지 않는지
- 기존 HR/공통 work item 흐름을 깨지 않았는지 회귀 확인

## 7. builder에게 바로 넘길 구현 체크리스트

1. `packages/shared/src/contracts.ts` 에 labor context 후보를 추가하되 기존 HR/common schema 와 충돌하지 않게 한다.
2. `apps/api/src/app.ts` 의 `module=labor` placeholder 항목에서 category, visibility, confidentiality, evidence/follow-up 요약을 읽히게 한다.
3. `/work-items/labor` 화면 copy 는 계약/연차/수당/고충/징계/사고/퇴사 범주를 쉬운 말로 보여 주되, 실민감 원문 처리/외부 연동을 완료처럼 쓰지 않는다.
4. restricted labor 이슈는 일반 관리자/지점 관리자 범위와 더 좁게 분리한다.
5. 테스트는 공통 엔진 회귀 + labor visibility 경계를 같이 잡는다.

## 8. 이번 Phase에서 명시적으로 하지 않는 일

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
