# Phase 29 법무 관리 1차 handoff

한 줄 요약:
이번 Phase 29는
Phase 25 공통 업무 엔진 위에,
계약 검토 요청·계약 갱신일·분쟁/클레임/보험/사고 후속 흐름을
`legal` 모듈 Production-ready (실구현) 으로 올리는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 기반:

- 공통 `work item` 엔진이 이미 있다.
- `legal` 모듈 Production-ready (실구현) 자리도 이미 있다.
- `/management`, `/work-items/legal`, `/api/work-items?module=legal`, `/api/work-items/:id/reviews` 같은 공통 진입점이 있다.
- 현재 대표 fixture 는 `work_item_legal_contract_review`(company scope 계약 검토), `work_item_legal_contract_renewal`(branch scope 갱신 검토), `work_item_legal_dispute_intake`(company scope 분쟁/클레임 사실확인) 3건이다.
- 모바일 하단 탭 5개 유지와 `홈`/`메뉴`/PC sidebar 확장 원칙도 있다.

이번 패스에서 먼저 맞추는 것:

- 법무 검토 요청을 어떤 category 로 나눌지
- 계약 분류/갱신일/분쟁 후속을 어떤 metadata 로 설명할지
- 본사 법무/운영 담당 / 지점 관리자 / 감사 visibility 를 어디서 갈라야 하는지
- 실제 계약 원문/외부 자문 없이 어디까지 preview/dev-safe Production-ready (실구현) 으로 보여 줄지

아직 안 여는 것:

- 실제 계약서 원문 저장 확대
- 외부 변호사/보험사/기관 계정 연동
- 실분쟁 문서 대량 업로드
- production 법무 데이터 저장/이관

즉 지금은
"법무 업무를 안전하게 담는 그릇"
을 맞추는 단계지,
실제 외부 자문/계약 저장 시스템을 여는 단계는 아닙니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) 새 법무 포털을 만드는 단계가 아니다.

이번 단계에서 먼저 보는 것은
별도 법무 솔루션이 아니라
기존 `work item` 엔진 위에 올라가는 `legal` Production-ready (실구현) 입니다.

핵심 category 초안:

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

쉽게 말하면,
법무 업무를 종류별로 나누되
담는 기본 그릇은 계속 공통 업무 엔진으로 유지하겠다는 뜻입니다.

### 2) 기본 상태는 늘리지 않고 legal 보조 상태를 따로 둔다.

Phase 25 공통 상태는 계속 아래를 씁니다.

- `draft`
- `todo`
- `in_progress`
- `waiting_review`
- `blocked`
- `done`
- `archived`

legal 쪽에서 추가로 필요한 것은
새 주 상태가 아니라 보조 metadata 입니다.

예시:

- `intakeStatus`: `received | assigned | reviewing | revision_requested | approved | completed`
- `contractType`: `hotel_management | lease | service | partner | personal_data_processing`
- `renewalStatus`: `not_applicable | upcoming | under_review | renewal_decided | expired_attention`
- `disputeStatus`: `none | intake | fact_check | response_preparing | counsel_gate`
- `externalCounselStatus`: `approval_required | not_connected`
- `sensitiveDocumentStatus`: `metadata_only | upload_gated`

중요한 이유:

- 법무 업무 진행 단계와 업무 처리 상태를 한 필드에 섞으면 더 복잡해진다.
- 그래서 "업무는 어디까지 갔는가"와 "법무 검토/갱신/분쟁은 어떤 단계인가"를 나눠 읽게 한다.

### 3) legal Production-ready (실구현) 은 검토·계약·갱신·분쟁·기록 5묶음으로 본다.

이번 단계에서 같이 보는 구조는 아래입니다.

1. 검토 요청
   - 누가 어떤 계약/사안을 올렸는지, 누가 맡았는지
2. 계약 분류
   - 위탁운영/임대차/용역/협력사/개인정보처리위탁 중 무엇인지
3. 갱신/만료
   - 언제 갱신 판단이 필요한지, 어떤 알림 Production-ready (실구현) 이 필요한지
4. 분쟁/클레임/보험/사고 후속
   - 어떤 사건 유형인지, 현재 어떤 준비 단계인지
5. 기록/audit
   - 상태 변경, 보완 요청, 접근 흔적, 외부 자문 게이트 후보

즉,
법무 이슈를 단순 메모가 아니라
권한과 후속조치를 가진 업무 단위로 읽는 방향입니다.

### 4) 노무/세무와 연결하되 법무 책임 경계를 분리한다.

이번 Phase 29에서 같이 보는 anchor 흐름은 아래입니다.

- 계약 검토 요청 생성
- 담당자 배정
- 검토 중 보완 요청
- 계약 만료/갱신 예정 확인
- 분쟁/클레임/보험/사고 후속 카드 정리
- 외부 자문 필요 여부를 승인 게이트로 유지

중요:

- 노무 계약 변경 이슈와 법무 계약 검토를 같은 기능으로 쓰지 않는다.
- 세무/급여/노무 문맥에서 나온 이슈라도 법무 검토는 별도 visibility 와 gate 를 가진다.
- 실제 외부 자문 전달은 계속 승인 게이트다.

### 5) 본사 법무/운영 담당 / 지점 관리자 / 감사 visibility 를 분명히 나눈다.

초기 원칙:

- 본사 법무/운영 담당: 여러 지점 계약 요청, 갱신 예정, 분쟁 후속 상태를 본다.
- 지점 관리자: 자기 지점 관련 요청/보완 요청/만료 임박 안내만 본다.
- 감사 사용자: read-only 로 상태 변경, 지연, 접근 흔적을 본다.
- 일반 직원: 이번 단계의 기본 직접 열람 주체가 아니다.

중요:

- 지점 관리자가 자기 지점 계약 상태를 보는 것과 회사 전체 법무 문서를 보는 것을 같은 권한처럼 쓰지 않는다.
- 검토 요청을 올릴 수 있다는 사실과 분쟁 자료 전체 열람권한을 같은 뜻으로 적지 않는다.

### 6) 모바일 하단 탭은 그대로 두고 legal entry 를 확장한다.

이번 Phase 29에서도 아래는 그대로 유지합니다.

- 하단 탭: `메뉴`·`홈`·`메신저`·`메일`·`알림`

새 legal 자리는 아래처럼 풉니다.

- 모바일 `홈`: 만료 임박 계약, blocked 법무 검토, 보완 요청 요약
- 모바일 `메뉴`: `법무` 진입점 아래 `계약 검토`, `갱신 예정`, `분쟁/클레임`, `보험/사고 후속`
- PC sidebar: 지점 요청용 법무 entry 와 HQ 법무 운영 entry 분리

즉,
새 법무 기능이 생긴다고 하단 탭부터 늘리는 것이 아니라
기존 정보구조 안에서 자리를 먼저 확보합니다.

### 7) 실제 계약 원문/외부 자문/실민감 분쟁 자료는 계속 승인 게이트다.

이번 단계에서도 아직 열지 않는 것:

- 실제 계약서 원문 저장/비교/버전관리 확대
- 외부 변호사 메일/메신저/계정 직접 연동
- 실제 소송/분쟁 문서 제출 자동화
- 보험사/외부 기관 실제 접수 연동
- production 법무 데이터 입력

이 문서는
"법무 업무를 안전하게 담는 그릇"
을 정하는 단계지,
실제 외부 자문/계약 저장 시스템을 바로 여는 단계가 아닙니다.

## 3. 대장이 가장 먼저 볼 7가지 질문

1. 법무 업무가 기존 공통 `work item` 엔진 위에서 어떻게 읽히는지 바로 설명할 수 있는가?
2. 공통 상태와 legal intake/renewal/dispute 보조 상태가 섞이지 않고 정리돼 있는가?
3. 본사 법무/운영 담당 / 지점 관리자 / 감사 visibility 차이가 같은 권한 언어로 정리돼 있는가?
4. 위탁운영/임대차/용역/협력사/개인정보처리위탁/분쟁/클레임/보험 범주가 하나의 제품 언어로 정리돼 있는가?
5. 계약 metadata 와 실원문/외부 자문 연동이 구분돼 approval gate 원칙이 유지되는가?
6. 모바일 하단 탭을 늘리지 않고 `홈`/`메뉴`/PC sidebar 에 legal entry 를 잡는 기준이 있는가?
7. builder가 바로 구현할 최소 안전 범위가 기존 공통 엔진 확장 중심으로 정리돼 있는가?

이 7개 질문 중 하나라도 애매하면
이번 Phase 29 정리가 덜 된 상태입니다.

## 4. 먼저 볼 파일

### 이번 Phase 29 문서

- `docs/architecture/phase-29-legal-management-pass-1-scope.md`
- `docs/guides/phase-29-legal-management-pass-1-handoff.md`

### 바로 앞 기준 문서

- `docs/architecture/phase-28-tax-management-pass-1-scope.md`
- `docs/guides/phase-28-tax-management-pass-1-handoff.md`
- `docs/architecture/phase-28a-payroll-foundation-payslip-pass-1-scope.md`
- `docs/guides/phase-28a-payroll-foundation-payslip-pass-1-handoff.md`
- `docs/architecture/phase-27-labor-management-pass-1-scope.md`
- `docs/guides/phase-27-labor-management-pass-1-handoff.md`
- `docs/architecture/phase-25-common-work-doc-access-engine-pass-1-scope.md`
- `docs/guides/phase-25-common-work-doc-access-engine-pass-1-handoff.md`

### 구현 근거로 같이 볼 파일

- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/dashboard/dashboard-config.ts`

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

1. 기존 `work item` / `legal` 모듈 기초를 다시 확인한다.
2. 법무 이슈 유형을 새 상태군이 아니라 `category` + 보조 metadata 로 정리한다.
3. 검토/계약/갱신/분쟁/기록 구조를 metadata 중심 Production-ready (실구현) 으로 설계한다.
4. 본사 법무/운영 담당 / 지점 관리자 / 감사 visibility 차이를 API/UI copy 에 같이 반영한다.
5. `/work-items/legal` 중심으로 legal entry 를 우선 정리한다.
6. 실제 계약 원문 저장, 외부 자문 연동, production data 비사용이 문서와 구현에서 흔들리지 않는지 마지막에 다시 본다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### builder
- `legal` 을 독립 `/legal` 앱으로 새로 만들지 말고, 이번 단계는 `/work-items/legal` 와 공통 API 확장으로 유지한다.
- 가능하면 `legalContext` 같은 보조 schema 를 만들어, 계약 분류/갱신일/분쟁 후속/approval gate 를 한 묶음으로 설명하게 한다.
- 본사 법무/운영 담당과 지점 관리자 권한 차이를 copy/test/API 에 같이 남긴다.
- 실제 계약 원문 저장, 외부 변호사/보험사 연동, 실제 소송/신고 연동은 열지 않는다.

### reviewer
- legal metadata 가 실제 계약 원문 저장/외부 자문 연동 완료처럼 읽히지 않는지 본다.
- 지점 관리자 visibility 와 HQ 법무/운영 visibility 가 과노출 없이 갈리는지 본다.
- 노무/세무/급여와 법무 책임이 섞이지 않는지 본다.

### tester
- `/work-items/legal`, `/api/work-items?module=legal`, `/api/work-items/:id/reviews` visibility 차이를 다시 본다.
- 지점 관리자와 감사 read-only 경계, 본사 법무/운영 담당 company scope 경계를 확인한다.
- 승인 게이트 문구가 실제 외부 자문 완료처럼 바뀌지 않았는지 확인한다.

### docs
- 계약 검토 Production-ready (실구현) 과 실제 법률 자문 시스템을 같은 말로 쓰지 않는다.
- 보완 요청/승인 대기와 실제 대외 발송 완료를 같은 단계처럼 쓰지 않는다.
- 지점 요청용 흐름과 HQ 법무 운영 흐름을 쉬운 한국어로 분리한다.

## 7. 빠른 검증 순서
1. `pnpm --filter @gw/shared typecheck`
2. `pnpm --filter @gw/api test -- work-items.spec.ts auth-org.spec.ts`
3. `pnpm --filter @gw/web test -- work-items.test.tsx work-items-boundary.test.tsx`
4. 가능하면 `pnpm check`
5. 가능하면 `/work-items/legal` local preview smoke

## 8. 주의할 점
- 계약 갱신일은 실제 자동 알림 발송 완료가 아니라 Production-ready (실구현) 마감 안내다.
- 분쟁/클레임/보험 상태는 실제 기관 제출 결과가 아니라 내부 follow-up 단계다.
- 외부 변호사/보험사 전달 후보와 실제 외부 전송 완료를 같은 뜻으로 쓰지 않는다.
- 현재 legal Production-ready (실구현) 3건 존재를 법무 전체 구현 완료처럼 과장하지 않는다.
- 지점 관련 계약 안내와 회사 전체 민감 계약 자료를 같은 열람 범위로 섞지 않는다.
