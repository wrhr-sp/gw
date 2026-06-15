# Phase 29 법무 관리 1차 범위

## 한 줄 요약
Phase 29의 목표는
Phase 25 공통 `work item` 엔진 위에,
계약 검토 요청·계약 갱신일·분쟁/클레임·보험/사고 문서 보관 흐름을
`legal` 모듈 skeleton 으로 올리는 것입니다.

쉽게 말하면 이번 단계는
"실제 계약서 원문 저장 시스템"이나
"외부 변호사 협업 포털"을 여는 것이 아니라,
"본사 법무/운영/지점이 어떤 법무 이슈를 어떤 순서로 검토하고 무엇은 계속 승인 게이트로 남기는지"
를 공통 제품 언어로 먼저 고정하는 단계입니다.

## 왜 이번 단계가 필요한가

호텔 위탁경영사 실사용 관점에서는
HR·세무·노무 skeleton 까지만 있어서는
실제 계약 관리와 분쟁 대응까지 업무 흐름을 끝까지 설명하기 어렵습니다.

현장에서는 아래 흐름이 계속 붙습니다.

- 신규 지점 위탁운영 계약 검토 요청
- 임대차/용역/협력사/개인정보처리위탁 계약의 갱신일 점검
- 계약서 검토 중 보완 요청과 승인 게이트 관리
- 사고/보험/클레임 자료의 보관 범위와 열람권한 정리
- 외부 변호사 전달 전 내부 검토 완료 여부 확인

이 흐름이 정리되지 않으면 아래 문제가 생깁니다.

- 계약 검토 요청이 메신저/메일/파일함에 흩어진다.
- 지점은 어떤 계약이 언제 만료되고 누가 검토 중인지 한 번에 보기 어렵다.
- 본사 운영/법무는 계약 검토와 분쟁 자료 보관 기준을 같은 제품 언어로 설명하기 어렵다.
- 아직 외부 자문 연동이 없는데도 실제 법무 처리 시스템이 열린 것처럼 오해될 수 있다.
- 계약서 원문, 분쟁 자료, 개인정보처리위탁 문서 같은 민감 자료 경계가 흐려질 수 있다.

그래서 Phase 29에서는
기존 공통 업무 엔진을 유지한 채,
그 위에 "법무 검토 요청 + 계약 분류 + 갱신 일정 + 분쟁/클레임 보관 기준"
을 먼저 올립니다.

## 이번에 다시 확인한 현재 기준

확인한 문서/근거:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-25-common-work-doc-access-engine-pass-1-scope.md`
- `docs/guides/phase-25-common-work-doc-access-engine-pass-1-handoff.md`
- `docs/architecture/phase-27-labor-management-pass-1-scope.md`
- `docs/guides/phase-27-labor-management-pass-1-handoff.md`
- `docs/architecture/phase-28a-payroll-foundation-payslip-pass-1-scope.md`
- `docs/guides/phase-28a-payroll-foundation-payslip-pass-1-handoff.md`
- `docs/architecture/phase-28-tax-management-pass-1-scope.md`
- `docs/guides/phase-28-tax-management-pass-1-handoff.md`
- `ROADMAP.md`, `TASKS.md`, `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`

현재 기준으로 확인되는 사실:

- 공통 `work item` 엔진과 `legal` 모듈 placeholder 자리는 이미 있다.
- 현재 `legal` placeholder 는 `work_item_legal_contract_review`(company scope 계약 검토), `work_item_legal_contract_renewal`(branch scope 갱신 검토), `work_item_legal_dispute_intake`(company scope 분쟁/클레임 사실확인) 3건이라, 계약·갱신·분쟁 흐름이 최소 예시까지는 연결돼 있다.
- 다만 아직도 fixture 3건 수준의 skeleton 이라서, 이를 전체 법무 처리 구현 완료처럼 읽어서는 안 된다.
- `/management`, `/work-items/legal`, `/api/work-items?module=legal`, `/api/work-items/:id/reviews` 같은 공통 진입점은 이미 있다.
- 모바일 하단 탭 5개 유지, `홈`/`메뉴`/PC sidebar 확장 원칙은 그대로 유지해야 한다.
- 아직 실제 계약서 원문 저장 확대, 외부 변호사 계정 연동, 실제 분쟁 자료 업로드 확대, production DB 실데이터 반영은 모두 승인 게이트다.

따라서 이번 Phase의 핵심은
법무 기능을 많이 완성하는 것이 아니라,
기존 공통 업무 엔진이 계약 검토와 갱신/분쟁 skeleton 을
어떻게 안전하게 담는지 설명 가능한 상태로 만드는 것입니다.

## Phase 29에서 고정하는 핵심 결정

### 결정 A. 법무 관리도 공통 `work item` 위에 올린다.

이번 단계에서도 기준 엔티티는
별도 "법무 포털"이 아니라
기존 `work item` 입니다.

대신 `legal` 모듈 안에서
아래 category 확장 초안을 둡니다.

- `contract_review`
- `contract_renewal`
- `hotel_management_agreement`
- `lease_agreement`
- `service_agreement`
- `partner_agreement`
- `personal_data_processing_agreement`
- `dispute_intake`
- `claim_response`
- `insurance_case`
- `incident_legal_follow_up`

핵심 원칙:

- 1차는 `module = legal` 을 유지하고, 법무 업무 종류 차이는 `category` 와 보조 metadata 로 푼다.
- 계약 종류와 분쟁/보험 종류를 새 앱으로 쪼개지 않는다.
- 실제 외부 자문 전달도 연동이 아니라, 어떤 검토 상태와 어떤 승인 게이트가 필요한지 정리하는 단계로만 본다.

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

- 계약서마다 별도 주 상태군을 새로 만들지 않는다.
- "접수/배정/검토중/보완요청/승인대기/완료" 같은 의미는 공통 상태 + 보조 필드 조합으로 푼다.

legal 보조 필드 초안:

- `intake_status`: `received | assigned | reviewing | revision_requested | approved | completed`
- `contract_type`: `hotel_management | lease | service | partner | personal_data_processing`
- `renewal_status`: `not_applicable | upcoming | under_review | renewal_decided | expired_attention`
- `dispute_status`: `none | intake | fact_check | response_preparing | counsel_gate`
- `external_counsel_status`: `approval_required | not_connected`
- `sensitive_document_status`: `metadata_only | upload_gated`

즉,
공통 업무 상태와
법무 intake/갱신/분쟁 의미를 한 필드에 억지로 섞지 않습니다.

### 결정 C. 법무 skeleton 은 검토·계약·갱신·분쟁·기록 5묶음으로 본다.

초기 설명 기준:

1. 검토 요청
   - 누가 어떤 계약/사안 검토를 요청했는지
   - 현재 누가 맡고 있는지
   - 보완 요청이 있는지

2. 계약 분류
   - 위탁운영/임대차/용역/협력사/개인정보처리위탁 중 무엇인지
   - 회사 범위인지 지점 문맥인지
   - 원문 없이 metadata 로 무엇을 설명할지

3. 갱신/만료
   - 언제 종료되거나 갱신 판단이 필요한지
   - 알림 skeleton 을 어디까지 둘지
   - 실제 자동 발송 없이 어떤 상태를 보여 줄지

4. 분쟁/클레임/보험/사고 후속
   - 어떤 사건 유형인지
   - 사실확인/답변준비/자문게이트 중 어디인지
   - 원문 대신 어떤 요약과 권한 기준을 둘지

5. 기록/audit
   - 누가 접수/배정/검토/보완요청을 남겼는지
   - 누가 민감 자료 접근 권한을 가졌는지
   - 누가 외부 자문 gate 후보로 표시됐는지

핵심은
법무 업무를 곧바로 외부 자문/계약 저장소 시스템으로 만들기보다,
기존 공통 업무 엔진이 법무 검토와 계약 lifecycle 도 담을 수 있게 설명하는 것입니다.

### 결정 D. 노무/세무/지점 운영과 연결하되 법무 책임 경계를 분리한다.

이번 단계의 anchor 흐름 초안:

- 지점/본사에서 계약 검토 요청 생성
- 본사 운영 또는 법무 담당 배정
- 검토 중 보완 요청
- 계약 만료/갱신 예정 확인
- 분쟁/클레임/보험/사고 관련 후속 카드 정리
- 외부 자문 필요 여부를 승인 게이트로 유지

중요:

- 노무 계약 변경 이슈와 법무 계약 검토를 같은 책임으로 취급하지 않는다.
- 세무/급여/노무 문맥에서 생긴 이슈라도 법무 검토는 별도 visibility 와 gate 를 가진다.
- 법무는 지점 현장 이슈를 받더라도 회사 범위 검토/보관 기준을 분리해서 설명해야 한다.

### 결정 E. 권한은 본사 법무/운영 담당 / 지점 관리자 / 감사 / 일반 직원으로 더 분명히 나눈다.

초기 접근 제어 원칙:

- 본사 법무/운영 담당
  - 여러 지점 계약 검토 요청과 갱신 예정 목록을 본다.
  - 분쟁/클레임/보험 후속 상태를 본다.
  - 실제 외부 변호사 연동 실행자로 자동 확정하지 않는다.

- 지점 관리자
  - 자기 지점 관련 계약 요청/보완 요청/만료 임박 안내만 본다.
  - 회사 전체 계약 원문이나 분쟁 상세 전체를 보는 주체가 아니다.

- 감사 사용자
  - read-only 감사 흐름을 우선한다.
  - 원문보다 상태 변경, 지연, 보완 요청, 접근 흔적 중심으로 본다.

- 일반 직원
  - 이번 단계의 기본 주 사용자가 아니다.
  - 필요해도 법무 work item 전체를 보는 기본 주체로 두지 않고, 별도 요청/안내 수신 범위로만 이어지게 본다.

중요:

- 지점 관리자가 자기 지점 계약 상태를 보는 것과 회사 전체 법무 문서를 보는 것을 같은 권한처럼 쓰지 않는다.
- 검토 요청을 올릴 수 있다는 사실과 분쟁 자료 전체 열람권한을 같은 뜻으로 취급하지 않는다.

### 결정 F. 메뉴는 새 하단 탭 없이 공통 업무/법무 묶음 안에서 푼다.

UX 기준:

- 모바일 하단 탭은 계속 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개를 유지한다.
- 법무 관련 자리는 `홈` 요약 카드와 `메뉴`/PC sidebar 의 `공통 업무 > 법무` 안에서 푼다.

초기 배치 방향:

- 모바일 `홈`: 만료 임박 계약, 보완 요청, blocked 된 법무 검토 요약
- 모바일 `메뉴`: `법무` 진입점 아래 `계약 검토`, `갱신 예정`, `분쟁/클레임`, `보험/사고 후속`
- PC sidebar: 지점 요청용 법무 entry 와 HQ 법무 운영 entry 분리

중요:

- 법무 기능을 일반 협업 메뉴처럼 가볍게 섞지 않는다.
- `/admin/*` 정책 관리와 일반 법무 work item 화면을 같은 메뉴층 책임으로 설명하지 않는다.

### 결정 G. 실제 계약 원문/외부 자문/실민감 분쟁 자료는 계속 승인 게이트로 남긴다.

이번 단계에서 아직 안 여는 것:

- 실제 계약서 원문 저장/비교/버전관리 확대
- 외부 변호사 메일/메신저/계정 직접 연동
- 실제 소송/분쟁 문서 제출 자동화
- 보험사/외부 기관 실제 접수 연동
- production 법무 데이터 저장/이관

특히 아래는 계속 분리해야 합니다.

- 서명본 계약서 원문
- 분쟁 당사자 민감 진술/증빙 원문
- 개인정보처리위탁 계약 원문 전문
- 외부 자문 계정 정보, 발송 이력, 실전송 결과

## 빠른 확인 순서
1. `/work-items` — 공통 업무 허브가 먼저 보이는지 본다.
2. `/work-items/legal` — 법무 category, role split, 승인 게이트 문구를 본다.
3. `/api/work-items?module=legal` — 법무 목록이 category/갱신/분쟁/검토 상태를 읽히게 하는지 본다.
4. `/api/work-items/:id/reviews` — 내부 검토/보완 요청/승인 대기 메모를 같은 review skeleton 으로 읽게 하는지 본다.
5. `apps/api/test/work-items.spec.ts` / `apps/api/test/auth-org.spec.ts` — legal module visibility 경계가 역할별로 붙들려 있는지 본다.

## builder 최소 구현 방향
- 기존 `legal` placeholder 를 단일 계약 검토 카드 수준에서, 계약 분류/갱신일/분쟁 후속 설명이 있는 방향으로 확장한다.
- 가능하면 `legalContext` 같은 보조 metadata 묶음을 shared contract 와 placeholder API 에 추가해 contract/renewal/dispute/access/approval gate 를 한 묶음으로 설명하게 한다.
- branch scope 계약 요청 카드와 company scope 분쟁/갱신 카드가 다른 visibility 를 가진다는 점을 fixture/test/API copy 에 같이 남긴다.
- 실제 계약 원문 저장, 외부 변호사 연동, 실분쟁 문서 업로드 확대는 열지 않는다.

## 제외 범위
- production DB 실데이터 입력/수정
- 실제 계약 원문 저장소 구현
- 실제 외부 변호사/보험사/기관 연동
- 실제 메일/메신저 발송 자동화
- secret/.env, DNS/custom domain, 유료 리소스, migration, destructive 작업

## 승인 게이트
- 실계약서/분쟁자료/사고자료 원문 저장 확대
- 외부 변호사/보험사 계정 연동
- production 법무 데이터 이관
- 실제 알림 발송, 실제 외부 제출, 실제 기관 신고
- 민감 개인정보/사건 원문 열람 범위 확대
