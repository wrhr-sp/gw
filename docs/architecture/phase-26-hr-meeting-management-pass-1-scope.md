# 그룹웨어 Phase 26 HR·미팅 관리 1차 범위

## 1. 한 줄 정의

Phase 26의 목표는
Phase 25에서 먼저 만든 공통 `work item` 엔진 위에,
직원 생애주기와 HR 미팅/면담/교육/온보딩 흐름을
호텔 지점 권한 기준으로 안전하게 얹는 것입니다.

쉽게 말하면 이번 단계는
"인사팀 전용 복잡한 ERP"를 한 번에 만드는 것이 아니라,
"직원 관련 미팅과 면담을 같은 제품 언어로 담는 최소 안전 Production-ready (실구현)"
을 먼저 고정하는 단계입니다.

이번 단계도
실제 민감 인사기록 원문,
실제 평가서 원문 저장,
실제 징계/노무 사건 처리,
외부 캘린더/메일/메신저 자동 연동,
production DB 실데이터 반영
단계는 아닙니다.

## 2. 왜 이번 단계가 필요한가

Phase 25에서는
HR·세무·노무·법무·지점 운영 업무가 같이 타는
공통 `work item`, 문서, 첨부, 검토, 마감, 권한 뼈대를 먼저 맞췄습니다.

하지만 호텔 위탁경영사 실사용 관점으로 한 단계 더 가면,
직원 관련 운영은 단순 문서 회수만으로 끝나지 않고
아래 같은 HR 미팅 흐름이 자연스럽게 따라옵니다.

- 신규 입사자 온보딩 미팅
- 수습/정기 1:1
- 인사 면담
- 평가 피드백 미팅
- 고충/이슈 면담
- 교육/코칭 일정
- 지점 운영 이슈와 연결된 직원 미팅
- 퇴사 전환, 복귀, 징후 관리 같은 직원 lifecycle follow-up

이 흐름이 정리되지 않으면 아래 문제가 생깁니다.

- 같은 면담인데 누군가는 HR 업무로, 누군가는 일반 메모로 따로 남긴다.
- 지점 관리자와 본사 HR이 같은 직원을 다른 기준으로 본다.
- 1:1, 평가, 고충 면담의 민감도 차이가 화면에서 드러나지 않는다.
- 참석자/안건/후속조치/비공개 범위가 업무마다 제각각 된다.
- 외부 캘린더 연동이나 실제 민감 메모 저장을 너무 일찍 약속하게 된다.

그래서 Phase 26에서는
Phase 25 공통 업무 엔진을 그대로 두고,
그 위에 "직원 lifecycle + HR meeting Production-ready (실구현)"
을 얹는 규칙을 문서와 최소 구현 범위 기준으로 먼저 고정합니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/근거:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-25-common-work-doc-access-engine-pass-1-scope.md`
- `docs/guides/phase-25-common-work-doc-access-engine-pass-1-handoff.md`
- `ROADMAP.md`, `TASKS.md`, `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`
- parent Phase 25 최종 보고 metadata

현재 기준으로 확인되는 사실:

- 공통 `work item` 엔진과 `hr` 모듈 Production-ready (실구현) 는 이미 있다.
- 현재 `hr` 예시는 이제 온보딩만이 아니라 1:1, 교육/코칭, grievance restricted Production-ready (실구현) 까지 포함한다.
- 회사 + 지점/호텔 + 역할 + capability 경계는 이미 공통 업무 엔진에서 중요 기준으로 올라와 있다.
- 모바일 하단 탭 5개 유지와 `홈`/`메뉴`/PC sidebar 확장 원칙도 그대로 유지해야 한다.
- HR 미팅 유형, 참석자 구조, 후속조치 구조, 비공개 등급, 지점 관리자 대 본사 HR 접근 차이도 이제 `packages/shared/src/contracts.ts`, `apps/api/src/app.ts`, `apps/api/test/work-items.spec.ts`, `apps/web/work-items*.test.tsx` 근거로 1차 Production-ready (실구현) 기준이 잡혀 있다.

따라서 이번 Phase의 핵심은
새 HR 기능을 많이 늘리는 것이 아니라,
기존 공통 업무 엔진이 직원 lifecycle 과 HR meeting 흐름을
어떻게 안전하게 담는지 먼저 설명 가능한 상태로 만드는 것입니다.

## 4. Phase 26에서 고정하는 핵심 결정

### 결정 A. HR 미팅도 공통 `work item` 위에 올린다.

이번 단계에서도 기준 엔티티는
새 별도 "미팅 앱"이 아니라
기존 `work item` 입니다.

대신 `hr` 모듈 안에서
아래 category 확장 초안을 둡니다.

- `onboarding`
- `one_on_one`
- `hr_interview`
- `performance_review`
- `grievance`
- `training_coaching`
- `branch_ops_meeting`
- `offboarding`

핵심 원칙:

- 1차는 `module = hr` 를 유지하고, meeting 종류 차이는 `category` 와 보조 metadata 로 푼다.
- 지점 운영 이슈와 연결된 직원 미팅도 먼저 `hr` 범위 안에서 읽히게 두고, branch 운영 미팅 전체를 따로 완성하려 하지 않는다.
- 세부 회의 기능보다 "누구와 어떤 민감도의 직원 관련 대화를 어떤 권한으로 다룰지"를 먼저 고정한다.

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

- 1:1, 평가, 고충 면담이라고 해서 처음부터 별도 상태군을 새로 만들지 않는다.
- "예정/완료/취소" 같은 일정 의미는 주 상태가 아니라 보조 필드로 푼다.

meeting 보조 필드 초안:

- `schedule_status`: `planned | confirmed | completed | cancelled`
- `confidentiality_level`: `standard | hr_private | grievance_restricted`
- `follow_up_required`: boolean

즉,
업무 상태와 미팅 운영 상태를 한 필드에 억지로 섞지 않습니다.

### 결정 C. HR 미팅 Production-ready (실구현) 은 일정·참석자·안건·회의록·후속조치 5묶음으로 본다.

초기 설명 기준:

1. 일정
   - 언제 열리는지
   - 어느 지점/호텔 문맥인지
   - 대면/비대면/미정 정도만 둔다.

2. 참석자
   - 직원 본인
   - 본사 HR
   - 지점 관리자
   - 필요 시 참관/지원 역할

3. 안건
   - 온보딩 체크
   - 평가 피드백
   - 고충 청취
   - 교육/코칭 주제
   - 지점 운영 이슈와 연결된 follow-up

4. 회의록/메모
   - 1차는 원문 저장이 아니라 `notes_preview`, `sensitivity`, `private_note_exists` 같은 metadata 중심으로 시작한다.

5. 후속조치
   - 후속 업무를 다시 `work item` 으로 연결할 수 있게 본다.
   - 예: 추가 서류 요청, 재면담, 교육 과제, 지점 운영 조치

핵심은
meeting 전용 대형 시스템을 새로 만들기보다,
기존 공통 업무 엔진이 meeting 문맥도 담을 수 있게 설명하는 것입니다.

### 결정 D. 직원 lifecycle 축을 같이 본다.

이번 단계의 lifecycle anchor 초안:

- 입사 전/입사 직후 온보딩
- 수습/적응 확인
- 정기 1:1 및 평가 피드백
- 교육/코칭
- 고충/예외 대응
- 퇴사/전환/복귀 follow-up

중요:

- 급여, 계약, 노무 사건 처리 자체를 완성하는 것이 아니다.
- 직원 lifecycle 에서 어떤 meeting/work item 이 자연스럽게 따라오는지를 먼저 고정한다.

### 결정 E. 권한은 본사 HR / 지점 관리자 / 일반 직원을 더 분명히 나눈다.

초기 접근 제어 원칙:

- 본사 HR
  - 여러 지점에 걸친 직원 lifecycle/HR meeting 을 본다.
  - `hr_private` 범위 접근 주체다.
  - `grievance_restricted` 는 `work_item.grievance.read_restricted` capability 가 붙은 본사 HR/감사만 본다.

- 지점 관리자
  - 자기 지점 직원 관련 일정/후속조치와 운영상 필요한 meeting 요약만 본다.
  - 모든 HR 비공개 메모 원문을 보는 주체가 아니다.

- 일반 직원
  - 자기에게 직접 관련된 meeting 일정, 안내, follow-up 정도만 본다.
  - 타 직원 면담, 지점 전체 HR 기록은 보지 못한다.

- 감사 사용자
  - read-only 감사 흐름을 우선한다.
  - 고충/민감 면담 내용 원문이 아니라 접근 흔적과 상태 변경 중심으로 본다.
  - `grievance_restricted` 는 일반 회사 관리자 범위와 분리된 별도 capability 로만 본다.

중요:

- "참석자였다"와 "모든 메모를 본다"를 같은 뜻으로 취급하지 않는다.
- 지점 관리자는 직원 운영 동행 주체이지, 본사 HR 민감 기록 전체 열람 주체가 아니다.

### 결정 F. 메뉴는 새 하단 탭 없이 HR 그룹 안에서 푼다.

UX 기준:

- 모바일 하단 탭은 계속 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개를 유지한다.
- HR 관련 자리는 `홈` 요약 카드와 `메뉴`/PC sidebar 의 `인사` 또는 `공통 업무 > 인사` 그룹 안에서 푼다.

초기 배치 방향:

- 모바일 `홈`: 내 면담 일정, 제출 필요, 후속조치 대기, 지점 관리자용 팀 follow-up 요약
- 모바일 `메뉴`: `인사` 진입점 아래 `온보딩`, `면담/1:1`, `평가/피드백`, `교육/코칭`
- PC sidebar: 일반 직원용 HR entry 와 관리자용 HR 운영 entry 분리

중요:

- HR 민감 기능을 일반 협업 메뉴처럼 가볍게 섞지 않는다.
- `/admin/*` 정책 관리와 일반 직원 HR 화면을 같은 메뉴층에서 설명하지 않는다.

### 결정 G. 외부 연동과 실민감 기록은 계속 승인 게이트다.

이번 Phase 26에서도 아래는 범위 밖입니다.

- 실제 인사평가 원문 저장/확정
- 실제 고충/징계/노무 사건 처리 시스템
- production DB 실데이터 입력/수정
- 주민번호/계좌/건강정보/징계사유 원문 저장
- 외부 캘린더/메일/메신저 자동 연동
- 실제 화상회의/회의 초대 발송
- 외부 HR/PMS/노무/법무 계정 연동
- custom domain/DNS 변경
- secret 입력/교체
- 유료 리소스 생성·증설
- destructive migration/삭제 작업

### 결정 H. builder는 기존 공통 엔진을 깨지 않는 최소 확장을 우선 구현한다.

이번 기획 기준에서 builder가 먼저 잡아야 할 최소 안전 범위는 아래입니다.

- shared contract 에 `hr` meeting/lifecycle metadata 초안 추가
- 기존 `work item` schema 를 유지하면서 `category`, `schedule_status`, `confidentiality_level`, `follow_up_required` 같은 보조 필드 확장 검토
- `/work-items/hr` 또는 그 하위 Production-ready (실구현) copy/API Production-ready (실구현) 에 meeting 유형과 권한 안내 반영
- API Production-ready (실구현) 응답에 참석자/안건/후속조치 요약 구조 추가
- 본사 HR / 지점 관리자 / 일반 직원 visibility 차이를 test 로 붙들기
- metadata-only 원칙과 외부 캘린더 비연동 원칙을 문서/응답/UI copy 에 유지

즉,
실제 캘린더 연동이나 인사기록 원문 저장보다,
기존 공통 업무 엔진 위에 HR meeting/lifecycle Production-ready (실구현) 을 올리는 것이 우선입니다.

## 5. 제안 데이터 구조 초안

### 5-1. 공통 업무 위에 붙는 HR meeting 확장

기존 `work_items` 공통 필드에 더해,
현재 Production-ready (실구현)/contract 에서 이미 보이는 확장 축:

- `category`
- `hrContext.lifecycleStage`
- `hrContext.scheduleStatus`
- `hrContext.meetingMode`: `in_person | remote | hybrid | tbd`
- `hrContext.confidentialityLevel`
- `hrContext.privateNoteExists`
- `hrContext.externalSyncStatus = approval_required`
- `hrContext.sensitiveRecordStatus = metadata_only`
- `hrContext.participants[]`, `hrContext.agendaItems[]`, `hrContext.followUp`, `hrContext.visibility`

### 5-2. 참석자/안건/후속조치 초안

1. `work_item_meeting_attendees`
   - `work_item_id`
   - `participant_type`: `employee | hr | branch_manager | observer`
   - `employee_id?`
   - `role_code?`
   - `attendance_status`

2. `work_item_meeting_agendas`
   - `work_item_id`
   - `agenda_type`
   - `summary`
   - `requires_follow_up`

3. `work_item_follow_ups`
   - `work_item_id`
   - `linked_follow_up_work_item_id?`
   - `owner_scope`
   - `due_at?`
   - `status`

4. `work_item_private_notes`
   - 이번 단계에서는 실저장 구조 확정이 아니라
   - `private_note_exists`, `note_visibility`, `last_updated_at` 정도 metadata 방향만 둔다.

## 6. 추천 API / 화면 Production-ready (실구현) 방향

문서 기준 + 현재 확인 가능한 방향:

- `GET /api/work-items?module=hr`
  - HR 전체 목록 + category/lifecycle/confidentiality Production-ready (실구현) 확인
- `GET /api/work-items/:id`
  - 기본 상세 + `hrContext` 전체 구조 확인
- `GET /api/work-items/:id/attendees`
  - 필요 시 참석자 metadata 분리 후보
- `GET /api/work-items/:id/agendas`
  - 필요 시 안건 요약 metadata 분리 후보
- `GET /api/work-items/:id/follow-ups`
  - 필요 시 후속조치 요약 분리 후보

화면 방향:

- `/work-items/hr`
  - HR 업무 허브 + lifecycle/meeting 유형 요약
- 필요 시 후속 Production-ready (실구현) route 후보
  - `/work-items/hr/onboarding`
  - `/work-items/hr/meetings`
  - `/work-items/hr/reviews`

중요:

- 이번 단계에서 route 수를 과하게 늘리기보다, 기존 `/work-items/hr` 안에서 copy/section 구조로 먼저 풀어도 된다.
- API/화면 모두 "실제 캘린더 초대/실민감 기록 처리 완료"처럼 보이면 안 된다.

지금 바로 확인할 쉬운 순서:

1. `/work-items` — 공통 업무 허브와 API 골격 문구 확인
2. `/work-items/hr` — lifecycle / meeting 유형 / visibility / 승인 게이트 문구 확인
3. `/api/work-items?module=hr` — onboarding, one_on_one, training_coaching, grievance Production-ready (실구현) 확인
4. `apps/api/test/work-items.spec.ts` — grievance restricted 경계(MANAGER 403, HR_ADMIN 200) 확인
5. `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx` — 허브/HR copy 회귀 확인

## 7. 대장이 가장 먼저 볼 8가지 질문

1. HR 미팅/면담/교육/온보딩이 기존 공통 `work item` 엔진 위에서 어떻게 읽히는가?
2. 공통 상태와 meeting 보조 상태가 섞이지 않고 설명되는가?
3. 본사 HR / 지점 관리자 / 일반 직원의 가시 범위 차이가 쉬운 말로 설명되는가?
4. 참석자/안건/회의록/후속조치 구조가 metadata 중심으로 먼저 정리되는가?
5. 직원 lifecycle 과 meeting 유형이 어떤 순서로 연결되는지 보이는가?
6. 모바일 하단 탭을 늘리지 않고도 `홈`/`메뉴`/PC sidebar 에 HR entry 를 잡는가?
7. 외부 캘린더/메일/메신저 연동과 실민감 원문 저장이 여전히 승인 게이트로 남아 있는가?
8. builder가 바로 구현할 최소 안전 범위가 기존 공통 엔진 확장 중심으로 정리돼 있는가?

## 8. 이번 Phase에서 하지 않는 것

- 실제 성과평가 확정/등급 계산
- 실제 고충 처리 사건 시스템 완성
- 실제 노무/법무 처리 연계
- 외부 캘린더 일정 생성/수정/초대 발송
- 실제 회의록 원문 저장소 확정
- production migration
- 실데이터 기반 직원 lifecycle master 확정

## 9. builder handoff 요약

builder가 바로 옮겨 적을 핵심:

- 기존 Phase 25 공통 `work item` 엔진을 깨지 않는다.
- primary status 는 그대로 두고 meeting 관련 값은 보조 metadata 로 둔다.
- `hr` 모듈 category 확장과 visibility 테스트를 우선한다.
- 참석자/안건/후속조치/비공개 범위는 metadata-only Production-ready (실구현) 으로 시작한다.
- 지점 관리자에게는 필요한 요약만, 본사 HR에게는 더 넓은 HR 범위를 보여 주는 방향을 유지한다.
- 외부 캘린더/메일/메신저, 실제 민감 원문 저장, production data 는 계속 승인 게이트다.
