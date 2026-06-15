# Phase 28 세무 관리 1차 handoff

한 줄 요약:
이번 Phase 28은
Phase 25 공통 업무 엔진 위에,
지점별 세무 증빙 요청·제출·마감·검토·전달 패키지 준비 흐름을
`tax` 모듈 skeleton 으로 올리는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 기반:

- 공통 `work item` 엔진이 이미 있다.
- `tax` 모듈 placeholder 자리도 이미 있다.
- `/work-items/tax`, `/api/work-items?module=tax`, `/api/work-item-deadlines`, `/api/work-items/:id/reviews` 같은 공통 진입점이 있다.
- 모바일 하단 탭 5개 유지와 `홈`/`메뉴`/PC sidebar 확장 원칙도 있다.
- 급여는 이미 독립 `payroll` 모듈로 분리돼 있다.

이번 패스에서 먼저 맞추는 것:

- 지점별 세무 자료 요청을 어떤 category 로 나눌지
- 세무 일정/증빙 제출/검토/반려/전달 패키지 준비를 어떤 metadata 로 설명할지
- 본사 세무 담당 / 지점 관리자 / 감사 visibility 를 어디서 갈라야 하는지
- 실제 신고 자동화 없이 어디까지 preview/dev-safe skeleton 으로 보여 줄지

아직 안 여는 것:

- 실제 홈택스 신고 제출
- 회계프로그램/세무사 외부 계정 연동
- 실세무 원문 대량 업로드
- production 세무 데이터 저장/이관

즉 지금은
"세무 업무를 안전하게 담는 그릇"
을 맞추는 단계지,
실제 신고/제출 시스템을 여는 단계는 아닙니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) 새 세무 신고 앱을 만드는 단계가 아니다.

이번 단계에서 먼저 보는 것은
별도 신고 솔루션이 아니라
기존 `work item` 엔진 위에 올라가는 `tax` skeleton 입니다.

핵심 category 초안:

- `evidence_collection`
- `vat_closing`
- `withholding_tax_filing`
- `local_tax_report`
- `corporate_tax_preparation`
- `missing_receipt_follow_up`
- `tax_adjustment_review`
- `advisor_package_preparation`

쉽게 말하면,
세무 업무를 종류별로 나누되
담는 기본 그릇은 계속 공통 업무 엔진으로 유지하겠다는 뜻입니다.

### 2) 기본 상태는 늘리지 않고 tax 보조 상태를 따로 둔다.

Phase 25 공통 상태는 계속 아래를 씁니다.

- `draft`
- `todo`
- `in_progress`
- `waiting_review`
- `blocked`
- `done`
- `archived`

tax 쪽에서 추가로 필요한 것은
새 주 상태가 아니라 보조 metadata 입니다.

예시:

- `filing_stage`: `collecting | branch_submitted | hq_reviewing | package_ready | handed_off`
- `evidence_status`: `not_started | partial | ready | missing | returned`
- `deadline_kind`: `monthly | quarterly | semiannual | annual`
- `external_filing_status`: `approval_required | not_connected`
- `sensitive_record_status`: `metadata_only | upload_gated`

중요한 이유:

- 세무 업무 진행 단계와 업무 처리 상태를 한 필드에 섞으면 더 복잡해진다.
- 그래서 "업무는 어디까지 갔는가"와 "세무 마감은 어떤 단계인가"를 나눠 읽게 한다.

### 3) tax skeleton 은 일정·자료·검토·전달·기록 5묶음으로 본다.

이번 단계에서 같이 보는 구조는 아래입니다.

1. 일정
   - 어떤 세목/마감인지, 어느 지점 문맥인지, 언제까지인지
2. 자료
   - 매출/비용/인건비/증빙 제출 필요 여부와 누락 상태
3. 검토
   - 본사 세무 담당, 지점 관리자, 필요 시 감사
4. 전달
   - 세무사 전달용 패키지 준비 상태와 포함 예정 목록
5. 기록/audit
   - 상태 변경, 누락/반려 이력, 접근 흔적

즉,
세무 이슈를 단순 메모가 아니라
권한과 후속조치를 가진 업무 단위로 읽는 방향입니다.

### 4) 급여/노무와 연결하되 세무 책임 경계를 분리한다.

이번 Phase 28에서 같이 보는 anchor 흐름은 아래입니다.

- 지점 월말 증빙 요청 생성
- 지점별 자료 제출
- HQ 세무 담당 검토
- 누락/반려/보완 요청
- 부가세/원천세/지방세/법인세 마감 체크
- 세무사 전달용 패키지 준비

중요:

- 급여의 세액 placeholder 와 세무 신고 준비를 같은 기능으로 쓰지 않는다.
- 노무 restricted 기록과 세무 증빙 추적을 같은 민감도/같은 화면 책임으로 다루지 않는다.
- 세무는 지점 제출과 HQ 검토 흐름이 핵심이고, 실제 외부 제출은 계속 승인 게이트다.

### 5) 본사 세무 담당 / 지점 관리자 / 감사 visibility 를 분명히 나눈다.

초기 원칙:

- 본사 세무 담당: 여러 지점 일정, 회수율, 반려, 패키지 준비 상태를 본다.
- 지점 관리자: 자기 지점 자료 제출과 보완 요청만 본다.
- 감사 사용자: read-only 로 상태 변경, 지연, 반려, 접근 흔적을 본다.
- 일반 직원: 이번 단계의 기본 직접 열람 주체가 아니다.

중요:

- 지점 관리자가 자기 지점 제출 상태를 보는 것과 회사 전체 세무 상세를 보는 것을 같은 권한처럼 쓰지 않는다.
- 자료 제출 요청을 받는 사람과 세무 패키지 전체 열람 주체를 같은 뜻으로 적지 않는다.

### 6) 모바일 하단 탭은 그대로 두고 tax entry 를 확장한다.

이번 Phase 28에서도 아래는 그대로 유지합니다.

- 하단 탭: `메뉴`·`홈`·`메신저`·`메일`·`알림`

새 tax 자리는 아래처럼 풉니다.

- 모바일 `홈`: 지점 제출 필요 자료, 마감 임박, 반려/보완 요청 요약
- 모바일 `메뉴`: `세무` 진입점 아래 `증빙 수집`, `월말 마감`, `세목별 일정`, `전달 패키지`
- PC sidebar: 지점 제출용 세무 entry 와 HQ 세무 운영 entry 분리

즉,
새 세무 기능이 생긴다고 하단 탭부터 늘리는 것이 아니라
기존 정보구조 안에서 자리를 먼저 확보합니다.

### 7) 실제 신고/외부 연동/실민감 자료는 계속 승인 게이트다.

이번 단계에서도 아직 열지 않는 것:

- 홈택스 직접 신고/전송
- 회계프로그램 직접 연동
- 세무사 메일/메신저/외부 계정 직접 연동
- 실세무 자료 원문 업로드 확대
- production 세무 데이터 입력

이 문서는
"세무 업무를 안전하게 담는 그릇"
을 정하는 단계지,
실제 신고/제출 시스템을 바로 여는 단계가 아닙니다.

## 3. 대장이 가장 먼저 볼 7가지 질문

1. 세무 업무가 기존 공통 `work item` 엔진 위에서 어떻게 읽히는지 바로 설명할 수 있는가?
2. 공통 상태와 tax filing/evidence 보조 상태가 섞이지 않고 정리돼 있는가?
3. 본사 세무 담당 / 지점 관리자 / 감사 visibility 차이가 같은 권한 언어로 정리돼 있는가?
4. 부가세/원천세/지방세/법인세/증빙 수집/전달 패키지 범주가 하나의 제품 언어로 정리돼 있는가?
5. 세무 자료 metadata 와 실원문/외부 제출이 구분돼 approval gate 원칙이 유지되는가?
6. 모바일 하단 탭을 늘리지 않고 `홈`/`메뉴`/PC sidebar 에 tax entry 를 잡는 기준이 있는가?
7. builder가 바로 구현할 최소 안전 범위가 기존 공통 엔진 확장 중심으로 정리돼 있는가?

이 7개 질문 중 하나라도 애매하면
이번 Phase 28 정리가 덜 된 상태입니다.

## 4. 먼저 볼 파일

### 이번 Phase 28 문서

- `docs/architecture/phase-28-tax-management-pass-1-scope.md`
- `docs/guides/phase-28-tax-management-pass-1-handoff.md`

### 바로 앞 기준 문서

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

1. 기존 `work item` / `tax` 모듈 기초를 다시 확인한다.
2. 세무 이슈 유형을 새 상태군이 아니라 `category` + 보조 metadata 로 정리한다.
3. 일정/evidence/review/package/audit 구조를 metadata 중심 skeleton 으로 설계한다.
4. 본사 세무 담당 / 지점 관리자 / 감사 visibility 차이를 API/UI copy 에 같이 반영한다.
5. `/work-items/tax` 중심으로 tax entry 를 우선 정리한다.
6. 실제 홈택스/회계프로그램/세무사 연동, 실원문 업로드, production data 비사용이 문서와 구현에서 흔들리지 않는지 마지막에 다시 본다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### builder
- `tax` 를 독립 `/tax` 앱으로 새로 만들지 말고, 이번 단계는 `/work-items/tax` 와 공통 API 확장으로 유지한다.
- 가능하면 `taxContext` 같은 보조 schema 를 만들어, 세무 일정/증빙/검토/전달 패키지/approval gate 를 한 묶음으로 설명하게 한다.
- 본사 세무 담당과 지점 관리자 권한 차이를 copy/test/API 에 같이 남긴다.
- 실제 홈택스 제출, 회계프로그램 연동, 세무사 외부 전송은 열지 않는다.

### reviewer
- tax metadata 가 실제 세무 원문 저장/실신고 완료처럼 읽히지 않는지 본다.
- 지점 관리자 visibility 와 HQ 세무 담당 visibility 가 과노출 없이 갈리는지 본다.
- 급여 `payroll` 과 세무 `tax` 책임이 섞이지 않는지 본다.

### tester
- `/work-items/tax`, `/api/work-items?module=tax`, `/api/work-item-deadlines`, review route 의 visibility 차이를 다시 본다.
- 지점 관리자와 감사 read-only 경계, 본사 세무 담당 company scope 경계를 확인한다.
- 승인 게이트 문구가 실제 연동 완료처럼 바뀌지 않았는지 확인한다.

### docs
- 세무 일정 skeleton 과 실제 신고 자동화를 같은 말로 쓰지 않는다.
- 반려/누락/보완 요청과 외부 전송 완료를 같은 단계처럼 쓰지 않는다.
- 지점 제출용 흐름과 HQ 세무 운영 흐름을 쉬운 한국어로 분리한다.

## 7. 빠른 검증 순서
1. `pnpm --filter @gw/shared typecheck`
2. `pnpm --filter @gw/api test -- work-items.spec.ts auth-org.spec.ts`
3. `pnpm --filter @gw/web test -- work-items.test.tsx work-items-boundary.test.tsx`
4. 가능하면 `pnpm check`
5. 가능하면 `/work-items/tax` local preview smoke

## 8. 주의할 점
- 세무 일정은 법정 자동 계산 완료가 아니라 skeleton 마감 안내다.
- 실제 홈택스 제출 여부를 문서/화면/API 어디에서도 성공처럼 쓰면 안 된다.
- 세무 자료 원문 업로드와 metadata-only 제출 현황을 같은 뜻으로 쓰면 안 된다.
- 급여의 세액 placeholder 와 세무 신고 준비 상태를 같은 책임으로 섞지 않는다.
- 주민등록번호, 계좌번호, 실세무 원문, 홈택스 payload, 외부 회계/세무 계정 연동은 계속 별도 승인 게이트다.