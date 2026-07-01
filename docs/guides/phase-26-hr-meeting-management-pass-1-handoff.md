# Phase 26 HR·미팅 관리 1차 handoff

한 줄 요약:
이번 Phase 26은
Phase 25 공통 업무 엔진 위에,
직원 lifecycle 과 HR 미팅/면담/교육/온보딩 흐름을
호텔 지점 권한 기준으로 얹는 최소 안전 Production-ready (실구현) 을 고정하는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 기반:

- 공통 `work item` 엔진이 이미 있다.
- `hr` 모듈 Production-ready (실구현) 와 온보딩 예시도 이미 있다.
- 회사 + 지점/호텔 + 역할 + capability 접근 기준도 이미 문서와 구현에 올라와 있다.
- 모바일 하단 탭 5개 유지와 `홈`/`메뉴`/PC sidebar 확장 원칙도 있다.

이번 패스에서 이미 보이는 것:

- `/work-items/hr` 에서 직원 lifecycle, meeting 유형, visibility 분리 문구를 바로 볼 수 있다.
- `/api/work-items?module=hr` 에 onboarding, 1:1, 교육/코칭, grievance restricted Production-ready (실구현) 가 있다.
- `packages/shared/src/contracts.ts` 와 `apps/api/src/app.ts` 에 참석자/안건/후속조치/visibility metadata 구조가 이미 올라와 있다.
- grievance restricted 경계는 `apps/api/test/work-items.spec.ts` 에서 MANAGER 403, HR_ADMIN 200 으로 다시 확인할 수 있다.

아직 안 여는 것:

- 외부 캘린더 연동
- 실제 민감 인사 원문 저장
- 실제 평가/고충 사건 처리 시스템

즉 지금은
"공통 업무 그릇" 위에
"직원 관련 면담과 lifecycle 을 어떻게 안전하게 담는지"
를 실제 Production-ready (실구현) 와 테스트 근거까지 포함해 1차로 맞춘 상태입니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) 새 미팅 앱을 만드는 단계가 아니다.

이번 단계에서 먼저 보는 것은
별도 회의 솔루션이 아니라
기존 `work item` 엔진 위에 올라가는 HR meeting Production-ready (실구현) 입니다.

핵심 category 초안:

- `onboarding`
- `one_on_one`
- `hr_interview`
- `performance_review`
- `grievance`
- `training_coaching`
- `branch_ops_meeting`
- `offboarding`

쉽게 말하면,
직원 관련 대화를 종류별로 나누되
담는 기본 그릇은 계속 공통 업무 엔진으로 유지하겠다는 뜻입니다.

### 2) 기본 상태는 늘리지 않고 meeting 보조 상태를 따로 둔다.

Phase 25 공통 상태는 계속 아래를 씁니다.

- `draft`
- `todo`
- `in_progress`
- `waiting_review`
- `blocked`
- `done`
- `archived`

meeting 쪽에서 추가로 필요한 것은
새 주 상태가 아니라 보조 metadata 입니다.

예시:

- `schedule_status`: `planned | confirmed | completed | cancelled`
- `confidentiality_level`: `standard | hr_private | grievance_restricted`
- `follow_up_required`

중요한 이유:

- meeting 일정 상태와 업무 처리 상태를 한 필드에 섞으면 더 복잡해진다.
- 그래서 "업무는 어디까지 갔는가"와 "meeting 일정은 어떤가"를 나눠 읽게 한다.

### 3) meeting Production-ready (실구현) 은 일정·참석자·안건·메모·후속조치 5묶음으로 본다.

이번 단계에서 같이 보는 구조는 아래입니다.

1. 일정
   - 언제, 어느 지점 문맥에서, 어떤 형태로 열리는가
2. 참석자
   - 직원 본인, 본사 HR, 지점 관리자, 필요 시 참관자
3. 안건
   - 온보딩, 평가 피드백, 고충 청취, 교육/코칭, 지점 운영 follow-up
4. 메모
   - 1차는 원문보다 metadata 중심
5. 후속조치
   - 다시 work item 으로 이어질 수 있는 후속 업무

즉,
meeting 을 단순 일정표가 아니라
직원 lifecycle 중간에 붙는 업무 단위로 읽는 방향입니다.

### 4) 직원 lifecycle 과 HR meeting 을 같이 본다.

이번 Phase 26에서 같이 보는 lifecycle 흐름은 아래입니다.

- 입사 전/직후 온보딩
- 수습/적응 확인
- 정기 1:1
- 평가 피드백
- 교육/코칭
- 고충/예외 대응
- 퇴사/전환/복귀 follow-up

중요:

- 급여 확정, 노무 사건 처리, 법무 처리 자체를 완성하는 단계가 아니다.
- 직원 lifecycle 어느 구간에서 어떤 meeting/work item 이 붙는지를 먼저 설명하는 단계다.

### 5) 본사 HR / 지점 관리자 / 일반 직원 visibility 를 분명히 나눈다.

초기 원칙:

- 본사 HR: 여러 지점 HR meeting/lifecycle 을 더 넓게 본다.
- 지점 관리자: 자기 지점 직원 관련 일정/후속조치와 운영상 필요한 요약만 본다.
- 일반 직원: 자기 meeting 일정과 자기 follow-up 만 본다.
- 감사 사용자: read-only 상태 변경/접근 기록 중심으로 본다.

중요:

- 참석자라고 해서 모든 비공개 메모를 다 보는 것이 아니다.
- 지점 관리자는 운영 동행 범위만 보고, 본사 HR 민감 기록 전체를 열람하는 주체가 아니다.

### 6) 모바일 하단 탭은 그대로 두고 HR entry 를 확장한다.

이번 Phase 26에서도 아래는 그대로 유지합니다.

- 하단 탭: `메뉴`·`홈`·`메신저`·`메일`·`알림`

새 HR 자리는 아래처럼 풉니다.

- 모바일 `홈`: 내 면담 일정, 후속조치, 제출 필요 요약 카드
- 모바일 `메뉴`: `인사` 또는 `공통 업무 > 인사` 진입점
- PC sidebar: 일반 직원 HR entry 와 관리자용 HR 운영 entry 분리

즉,
새 미팅 기능이 생긴다고 하단 탭부터 늘리는 것이 아니라
기존 정보구조 안에서 자리를 먼저 확보합니다.

### 7) 실민감 기록과 외부 연동은 계속 승인 게이트다.

이번 단계에서도 아직 열지 않는 것:

- 실제 평가 원문 저장/확정
- 실제 고충/징계/노무 사건 처리
- production DB 실데이터 입력
- 주민번호/계좌/건강정보/징계사유 원문 저장
- 외부 캘린더/메일/메신저 자동 연동
- 실제 회의 초대 발송/화상회의 연동

이 문서는
"직원 관련 meeting 을 안전하게 담는 그릇"
을 정하는 단계지,
실제 민감 HR 처리 시스템을 바로 여는 단계가 아닙니다.

## 3. 대장이 가장 먼저 볼 8가지 질문

1. HR 미팅/면담/교육/온보딩이 기존 공통 `work item` 엔진 위에서 어떻게 설명되는가?
2. 공통 상태와 meeting 보조 상태가 섞이지 않고 정리돼 있는가?
3. 본사 HR / 지점 관리자 / 일반 직원 visibility 차이가 쉬운 말로 설명되는가?
4. 참석자/안건/메모/후속조치 구조가 metadata 중심으로 먼저 정리되는가?
5. 직원 lifecycle 과 meeting 유형이 어떤 순서로 이어지는지 보이는가?
6. 모바일 하단 탭을 늘리지 않고 `홈`/`메뉴`/PC sidebar 에 HR entry 를 잡는 기준이 있는가?
7. 외부 캘린더/메일/메신저 연동과 실민감 원문 저장이 계속 승인 게이트로 남아 있는가?
8. builder가 바로 구현할 최소 안전 범위가 기존 공통 엔진 확장 중심으로 정리돼 있는가?

이 8개 질문에 바로 답이 안 보이면
이번 Phase 26 정리가 덜 된 상태입니다.

대장이 바로 따라 볼 쉬운 순서:

1. `/work-items` — 공통 업무 허브와 API 골격이 먼저 보이는지 확인
2. `/work-items/hr` — 직원 lifecycle, meeting 유형, visibility 분리, 승인 게이트 문구 확인
3. `/api/work-items?module=hr` — HR Production-ready (실구현) 4종과 `viewerScope` / `confidentialityLevel` 확인
4. `apps/api/test/work-items.spec.ts` — grievance restricted 경계 테스트 확인
5. `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx` — 화면 copy 와 route 연결 회귀 확인
6. 마지막으로 외부 캘린더/실민감 원문 저장/production data 가 여전히 닫혀 있는지 확인

## 4. 먼저 볼 파일

### 이번 Phase 26 문서

- `docs/architecture/phase-26-hr-meeting-management-pass-1-scope.md`
- `docs/guides/phase-26-hr-meeting-management-pass-1-handoff.md`

### 바로 앞 기준 문서

- `docs/architecture/phase-25-common-work-doc-access-engine-pass-1-scope.md`
- `docs/guides/phase-25-common-work-doc-access-engine-pass-1-handoff.md`
- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`
- `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md`

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

1. 기존 `work item` / `hr` 모듈 기초를 다시 확인한다.
2. meeting 유형을 새 상태군이 아니라 `category` + 보조 metadata 로 정리한다.
3. 참석자/안건/메모/후속조치 구조를 metadata 중심 Production-ready (실구현) 으로 설계한다.
4. 본사 HR / 지점 관리자 / 일반 직원 visibility 차이를 API/UI copy 에 같이 반영한다.
5. `/work-items/hr` 중심으로 HR meeting/lifecycle entry 를 우선 정리한다.
6. 외부 캘린더 비연동, 실민감 원문 비저장, production data 비사용이 문서와 구현에서 흔들리지 않는지 마지막에 다시 본다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- 기존 Phase 25 공통 `work item` 엔진 위에 `hr` meeting/lifecycle metadata 확장
- `category`, `schedule_status`, `confidentiality_level`, `follow_up_required` 같은 보조 필드 검토
- `/work-items/hr` 또는 그 하위 Production-ready (실구현) copy/API Production-ready (실구현) 에 meeting 구조 반영
- 참석자/안건/후속조치 요약 응답과 visibility 테스트

피해야 할 것:

- 별도 회의 솔루션처럼 과한 기능 확장
- 외부 캘린더/메일/메신저 자동 연동
- 실제 민감 인사기록 원문 저장
- production DB 실데이터 연결

### 리뷰어(gwreviewer)

집중할 것:

- meeting 상태와 업무 상태가 섞이지 않는지
- 본사 HR / 지점 관리자 / 일반 직원 visibility 차이가 과장 없이 유지되는지
- `grievance_restricted` 같은 민감 경계가 실제로 더 좁게 다뤄지는지
- 외부 연동/실민감 기록이 승인 게이트로 남아 있는지

### 테스터(gwtester)

집중할 것:

- `module=hr` 목록/상세/후속조치 가시 범위 차이
- 자기 meeting 과 타인 meeting 경계
- 지점 관리자 가시 범위와 본사 HR 가시 범위 차이
- metadata-only 설명과 실제 원문 저장 비과장 여부

### 문서화(gwdocs)

집중할 것:

- 직원 lifecycle 과 meeting 유형을 쉬운 한국어로 통일
- 공통 업무 엔진 위에 얹는 구조라는 점을 먼저 설명
- 실민감 원문/외부 연동/승인 게이트 경계를 반복 고정

## 7. builder가 바로 옮겨 적을 최소 구현 메모

- 기존 `workItem*Schema` 를 깨지 않는 확장으로 접근한다.
- `hr` 모듈 category 확장을 먼저 정리한다.
- 주 상태는 공통 상태를 유지하고 meeting 일정 의미는 보조 필드로 둔다.
- 참석자/안건/후속조치/비공개 범위는 metadata-only Production-ready (실구현) 으로 시작한다.
- `/work-items/hr` 에서 lifecycle/meeting 유형과 권한 안내를 먼저 보여 준다.
- 본사 HR 이 더 넓은 범위를 보고, 지점 관리자는 필요한 요약만 보는 경계를 테스트로 붙든다.

## 8. 이번 Phase에서 하지 않는 것

- 실제 평가서 저장/확정
- 실제 고충 처리 사건 시스템 완성
- 외부 캘린더 일정 생성/초대 발송
- 실제 회의록 원문 저장 구조 확정
- production migration
- 실데이터 기반 직원 lifecycle master 확정
