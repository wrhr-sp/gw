# 그룹웨어 Phase 25 공통 업무·문서·마감·권한 엔진 1차 범위

## 1. 한 줄 정의

Phase 25의 목표는
HR·세무·노무·법무·지점 운영 업무를 각각 따로 붙이기 전에,
모두가 같이 쓰는 공통 업무 카드, 문서, 첨부, 검토, 마감, 권한, 감사 로그 뼈대를 먼저 고정하는 것입니다.

쉽게 말하면 이번 단계는
"인사 업무 화면 하나, 세무 업무 화면 하나"를 바로 완성하는 단계가 아니라,
"나중에 여러 운영 업무가 들어와도 같은 방식으로 담길 공통 엔진"
을 먼저 정의하는 단계입니다.

이번 단계도
실제 개인정보 원문 입력,
민감 문서 원본 저장,
production DB 실데이터 반영,
세무/노무/법무 실처리,
외부 전문가 계정 연동,
실제 신고/제출 자동화
단계는 아닙니다.

## 2. 왜 이번 단계가 필요한가

Phase 24에서는
제한된 실제 회사 파일럿을 어떤 순서로 시작할지,
직원 체험 레인과 운영자 동행 레인을 어떻게 다시 묶을지 정리했습니다.

하지만 호텔 위탁경영사 실사용 관점으로 더 가면,
근태·휴가·결재·공지·문서만으로는 끝나지 않고
아래 같은 운영 업무가 자연스럽게 붙습니다.

- HR: 입퇴사 서류, 인사 점검, 근로계약, 증빙 회수
- 세무: 증빙 수집, 신고 준비, 마감 체크리스트, 검토 요청
- 노무: 근태 예외 후속조치, 계약/동의서 점검, 노무 이슈 기록
- 법무: 계약 검토 요청, 서명 전 점검, 분쟁 관련 문서 추적
- 지점 운영: 지점별 일일 보고, 점검표, 시설/민원 후속 업무

이 업무들을 모듈별로 따로 만들기 시작하면
아래 문제가 바로 생깁니다.

- 상태값 이름이 모듈마다 달라진다.
- 마감과 검토 흐름이 제각각 된다.
- 문서/첨부 권한 규칙이 모듈마다 달라진다.
- 본사/지점/역할 scope 설명이 화면마다 어긋난다.
- 감사 로그와 후속 추적 기준이 모듈마다 다르게 쌓인다.

그래서 Phase 25에서는
개별 도메인 기능보다 먼저
"공통 업무 엔진"
을 문서와 Production-ready (실구현) 기준으로 고정합니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/근거:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md`
- `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md`
- `docs/architecture/phase-23-admin-operations-console-real-usage-pass-1-scope.md`
- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`
- `docs/guides/phase-21-real-company-settings-model-pass-1-handoff.md`
- `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md`
- `docs/guides/phase-23-admin-operations-console-real-usage-pass-1-handoff.md`
- `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md`
- `ROADMAP.md`, `TASKS.md`, `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`
- parent Phase 24 최종 보고 metadata

현재 기준으로 확인되는 사실:

- 일반 업무 흐름, 관리자 운영 흐름, 파일럿 준비 흐름은 이미 분리 설명이 가능하다.
- 모바일 하단 탭 5개와 PC sidebar 는 같은 정보구조를 가리키는 원칙을 유지하고 있다.
- `지점/호텔 코드` 와 직원-지점 배정 초안은 이미 문서 기준으로 올라와 있다.
- `/admin/*` 운영 검토, 일반 조회 화면, same-origin API, preview/dev-safe 원칙도 유지된다.
- 아직 HR·세무·노무·법무를 담는 공통 업무 엔티티와 공통 검토/마감/문서 엔진은 루트 문서 기준으로 고정돼 있지 않다.

따라서 이번 Phase의 핵심은
새 업무 모듈을 많이 늘리는 것이 아니라,
여러 업무가 같은 규칙으로 붙도록 공통 뼈대를 먼저 만드는 것이다.

## 4. Phase 25에서 고정하는 핵심 결정

### 결정 A. 개별 도메인보다 공통 work item을 먼저 둔다.

이번 단계의 기준 엔티티는 개별 HR 카드, 세무 카드가 아니라
`공통 업무 항목(work item)` 입니다.

최소 공통 필드 초안:

- `id`
- `company_id`
- `branch_id?`
- `module`: `hr | tax | labor | legal | branch`
- `category`: 예) `onboarding`, `evidence_collection`, `contract_review`, `daily_branch_report`
- `title`
- `status`
- `priority`
- `assignee_user_id?`
- `assignee_role_code?`
- `requester_user_id?`
- `due_at?`
- `review_required`
- `contains_sensitive_data`
- `created_at`, `updated_at`, `closed_at?`

핵심 원칙:

- 모듈이 달라도 상태/마감/담당자 구조는 최대한 같이 간다.
- 실제 업무 세부 필드는 `payload` 또는 템플릿 확장으로 뒤에 붙인다.
- 지금 단계에서는 실데이터 입력보다 Production-ready (실구현) 구조와 guardrail 기준을 먼저 맞춘다.

### 결정 B. 상태값은 공통 흐름으로 시작한다.

초기 공통 상태 초안:

- `draft`
- `todo`
- `in_progress`
- `waiting_review`
- `blocked`
- `done`
- `archived`

설명 기준:

- `draft`: 아직 제출 전 초안
- `todo`: 착수 가능하지만 아직 시작 안 함
- `in_progress`: 담당자가 진행 중
- `waiting_review`: 검토자 확인 필요
- `blocked`: 권한/자료/승인/외부 응답 때문에 막힘
- `done`: 현재 범위에서 처리 완료
- `archived`: 보존용 종료 상태

중요:

- 세무/노무/법무처럼 실제 법정 처리 책임이 붙는 업무도 처음부터 별도 상태군을 남발하지 않는다.
- 꼭 필요한 차이는 `module`, `category`, `review_required`, `contains_sensitive_data` 로 분리한다.

### 결정 C. 문서/첨부/검토/마감은 work item에 붙는 공통 Production-ready (실구현)으로 본다.

공통 연결 초안:

1. 문서
   - 업무와 연결된 문서 메타데이터
   - 예: 계약서, 증빙, 점검표, 요청서, 보고서

2. 첨부
   - 파일 원문이 아니라 metadata 중심 설명부터 시작
   - 예: 파일명, 분류, 업로더, 업로드 시각, 민감도 라벨

3. 검토
   - 누가 어떤 의견으로 검토했는지 남기는 구조
   - 예: 승인/보완요청/반려/참고확인

4. 마감
   - due date 와 마감 기준 설명
   - 예: 지점 일일 마감, 월말 정산 준비, 계약 검토 기한

5. 감사 로그
   - 누가 상태/담당자/권한/마감/검토 상태를 바꿨는지 기록

핵심은
문서와 첨부를 업무마다 따로 발명하지 않고,
검토와 마감도 같은 흐름으로 설명되게 맞추는 것입니다.

### 결정 D. 권한은 회사 + 지점/호텔 + 역할 + capability 4축으로 본다.

이번 단계의 공통 접근 제어 원칙:

- 회사가 다르면 기본 차단
- 같은 회사 안에서도 지점/호텔 scope를 다시 본다.
- 역할별 기본 가시 범위를 분리한다.
- 상태 변경은 UI 노출과 별개로 API capability로 다시 검증한다.

초기 역할 관점 예시:

- 일반 근무자: 자기에게 배정된 업무 또는 자기 지점 범위 업무만 본다.
- 지점 관리자: 자기 지점 업무와 지점 소속 인력 관련 운영 업무를 본다.
- 본사 관리자: 여러 지점에 걸친 운영 업무를 본다.
- HR/세무/노무/법무 담당자: 해당 모듈과 승인된 scope만 본다.
- 감사 사용자: read-only 추적 중심으로 본다.

중요:

- "메뉴는 보이지만 열면 안 됨"보다 아예 가시 범위와 액션 범위를 함께 설계한다.
- 민감 문서가 연결된 업무는 일반 업무보다 더 좁은 첨부 접근 기준을 따로 둔다.

### 결정 E. 모바일/PC 메뉴에는 새 하단 탭을 늘리지 않는다.

UX 기준:

- 모바일 하단 탭은 계속 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개를 유지한다.
- 새 업무 모듈은 하단 탭 추가가 아니라 `메뉴`와 `홈` 바로가기, PC sidebar 그룹으로 확장한다.

초기 메뉴 배치 방향:

- 모바일 `홈`: 역할별 중요 work item 바로가기, 마감 임박, 검토 대기 카드
- 모바일 `메뉴`: `인사`, `세무`, `노무`, `법무`, `지점 업무` 또는 공통 `업무` 그룹 아래 세부 진입점
- PC sidebar: 일반 사용자용 업무 그룹과 관리자용 운영/정책 그룹을 분리

중요:

- 급여/노무/법무 성격의 민감 업무를 일반 협업 메뉴처럼 가볍게 섞지 않는다.
- 관리자 설정은 계속 `/admin/*` 계열로 두고, 일반 업무 화면과 운영 정책 화면을 나눠 읽히게 한다.

### 결정 F. 실제 민감 자료는 계속 승인 게이트로 남긴다.

이번 Phase 25에서도 아래는 범위 밖입니다.

- production DB 실데이터 입력/수정
- 실제 주민번호/계좌/급여명세/세무신고자료/노무 사건자료 원문 저장
- 실제 계약 원문 대량 업로드
- 외부 세무사/노무사/변호사 계정 연동
- 홈택스/4대보험/전자서명/메일 실연동
- 자동 신고/자동 제출/자동 계산 결과 확정
- custom domain/DNS 변경
- secret 입력/교체
- 유료 리소스 생성·증설
- destructive migration/삭제 작업

### 결정 G. builder는 공통 엔진 Production-ready (실구현)을 우선 구현한다.

이번 기획 기준에서 builder가 먼저 잡아야 할 최소 안전 범위는 아래입니다.

- shared contract 에 공통 work item / document / review / deadline schema 초안 추가
- API Production-ready (실구현) route 또는 응답 Production-ready (실구현) 추가
- 모바일 `홈`/`메뉴`와 PC sidebar 에 새 업무 그룹 자리를 과장 없이 확보
- 지점 scope + 역할 scope 가 섞이지 않도록 Production-ready (실구현) copy 정리
- 테스트/문서에서 "실운영 처리 아님" guardrail 유지

즉,
세무 계산기나 법무 처리 로직보다
공통 카드/문서/검토/마감/권한 구조를 먼저 구현 대상으로 봅니다.

## 5. 제안 데이터 구조 초안

### 5-1. 공통 업무 `work_items`

예시 필드:

- `id`
- `company_id`
- `branch_id?`
- `module`
- `category`
- `title`
- `description_preview`
- `status`
- `priority`
- `assignee_user_id?`
- `assignee_role_code?`
- `requester_user_id?`
- `due_at?`
- `review_required`
- `contains_sensitive_data`
- `created_at`
- `updated_at`
- `closed_at?`

### 5-2. 공통 문서 `work_item_documents`

예시 필드:

- `id`
- `work_item_id`
- `document_type`
- `title`
- `visibility_scope`
- `retention_hint`
- `contains_sensitive_data`
- `created_by`
- `created_at`

### 5-3. 공통 첨부 `work_item_attachments`

예시 필드:

- `id`
- `work_item_id`
- `document_id?`
- `file_name`
- `mime_type`
- `size_bytes`
- `classification`
- `uploaded_by`
- `uploaded_at`

중요:

- 이번 단계에서는 raw storage key, signed/public URL 전문을 기본 문서에 올리지 않는다.

### 5-4. 공통 검토 `work_item_reviews`

예시 필드:

- `id`
- `work_item_id`
- `reviewer_user_id`
- `decision`: `approved | changes_requested | rejected | noted`
- `comment_preview`
- `reviewed_at`

### 5-5. 공통 마감/정책 `work_item_deadlines`

예시 필드:

- `id`
- `module`
- `category`
- `deadline_type`
- `default_due_offset`
- `branch_local_rule?`
- `requires_manager_review`
- `notes`

## 6. 제안 API/화면 방향

제안 API 초안:

- `GET /api/work-items`
- `GET /api/work-items/:workItemId`
- `GET /api/work-items/:workItemId/documents`
- `GET /api/work-items/:workItemId/attachments`
- `GET /api/work-items/:workItemId/reviews`
- `GET /api/work-item-deadlines`
- `GET /api/work-item-templates`

제안 화면 방향:

- `/work-items`
- `/work-items/[workItemId]`
- `/hr`
- `/tax`
- `/labor`
- `/legal`
- `/branch/tasks`
- `/admin/work-items`

중요:

- 지금 단계에서는 모든 route 를 실제 완성형 모듈로 채우라는 뜻이 아니다.
- 공통 엔진과 메뉴 자리를 먼저 확보하고, 개별 모듈은 같은 뼈대 위에서 뒤에 붙인다.

## 7. 성공 기준

이번 Phase 25가 성공으로 읽히려면 아래가 분명해야 합니다.

- HR·세무·노무·법무·지점 업무가 어떤 공통 엔진 위에서 확장되는지 설명할 수 있다.
- 공통 work item, 문서, 첨부, 검토, 마감, 권한, 감사 로그 초안이 같은 언어로 정리돼 있다.
- 회사 + 지점/호텔 + 역할 + capability 접근 기준이 메뉴/API/문서에서 같은 뜻이다.
- 모바일 하단 탭을 늘리지 않고도 새 업무 모듈 자리를 확보하는 기준이 있다.
- 실제 민감 자료/실처리/외부 연동은 계속 승인 게이트로 남아 있다.
- builder/tester/reviewer/docs 후속 카드가 바로 이어갈 handoff 가 있다.

## 8. 다음 역할별 handoff 포인트

### 구현자(gwbuilder)

집중할 것:

- 공통 work item contract 와 Production-ready (실구현) route 최소 뼈대
- 공통 문서/첨부/검토/마감 schema 초안
- 모바일 `홈`/`메뉴`, PC sidebar 의 새 업무 그룹 자리 확보
- 지점 scope 와 역할 scope 를 같이 보는 Production-ready (실구현) copy

피해야 할 것:

- 실제 급여/세무/노무 계산 로직 확정
- 실민감 문서 저장/노출
- production DB 실데이터 연결
- 외부 전문가/메일/신고 시스템 연동

### 리뷰어(gwreviewer)

집중할 것:

- 공통 엔진 문구가 개별 모듈 완성처럼 과장되지 않는지
- 접근 제어가 회사/지점/역할/capability 4축으로 일관되는지
- 민감 문서/실처리/외부 연동이 승인 게이트로 남아 있는지

### 테스터(gwtester)

집중할 것:

- 공통 contract, route, Production-ready (실구현), 메뉴 배치가 문서와 맞는지
- 일반 사용자/지점 관리자/본사 관리자 가시 범위가 섞이지 않는지
- blocked 이유가 권한/자료부족/승인필요/Production-ready (실구현) 제한 중 무엇인지 구분되는지

### 문서화(gwdocs)

집중할 것:

- 모듈별 설명보다 공통 엔진 설명을 쉬운 말로 정리
- 실제 실무자가 보는 "업무 카드 + 문서 + 검토 + 마감" 언어 통일
- 민감 문서/실처리/승인 게이트 경계 반복 고정

## 9. 이번 단계에서 하지 않는 것

- 실제 급여 계산 엔진
- 실제 세무 신고/제출 자동화
- 실제 노무 사건 처리 워크플로 확정
- 실제 법률 자문/계약 검토 시스템 연동
- 외부 전자서명/메일/메신저/정부 시스템 연동
- production 데이터 마이그레이션
- 실데이터 기반 branch master 확정

## 10. 같이 볼 문서

- `docs/guides/phase-25-common-work-doc-access-engine-pass-1-handoff.md`
- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`
- `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `DATA_MODEL.md`
- `API.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `KNOWN_ISSUES.md`
