# Phase 28 세무 관리 1차 범위

## 한 줄 요약
Phase 28의 목표는
Phase 25 공통 `work item` 엔진 위에,
지점별 세무 증빙 요청·제출·마감·검토 흐름을
`tax` 모듈 Production-ready (실구현) 으로 올리는 것입니다.

쉽게 말하면 이번 단계는
"실제 홈택스 신고 시스템"을 여는 것이 아니라,
"본사 세무 담당과 지점 관리자가 어떤 자료를 언제까지 어떻게 주고받는지"
를 공통 제품 언어와 최소 안전 Production-ready (실구현) 기준으로 먼저 고정하는 단계입니다.

이번 단계도
실제 신고 제출,
홈택스/회계프로그램 연동,
실세무 원문 업로드,
production DB 실데이터 반영
단계는 아닙니다.

## 왜 이번 단계가 필요한가

호텔 위탁경영사 실사용 관점에서는
근태·휴가·급여 초안·노무 Production-ready (실구현) 까지만 있어서는
월말 운영을 끝까지 설명하기 어렵습니다.

실제 현장에서는 아래 흐름이 계속 붙습니다.

- 지점별 매출/비용/인건비/카드전표/세금계산서 증빙 회수
- 부가세, 원천세, 지방세, 법인세 관련 마감 일정 점검
- 누락 자료 보완 요청과 반려 사유 정리
- 본사 세무 담당 검토와 세무사 전달용 패키지 준비
- 급여/노무 이슈와 맞닿는 세무 자료를 역할별로 분리 조회

이 흐름이 정리되지 않으면 아래 문제가 생깁니다.

- 세무 요청이 메신저/메일/메모/엑셀 요청으로 흩어진다.
- 지점 관리자는 "무엇을 언제까지 제출해야 하는지"를 한 곳에서 못 본다.
- 본사 세무 담당은 지점별 누락/반려/검토 상태를 같은 언어로 설명하기 어렵다.
- 실제 신고 자동화나 홈택스 연동이 아직 없는 단계인데도 이미 운영 완료처럼 오해될 수 있다.
- 세무 자료와 급여/노무 민감 자료의 경계가 흐려질 수 있다.

그래서 Phase 28에서는
기존 공통 업무 엔진을 유지한 채,
그 위에 "세무 일정 + 증빙 제출 + 검토/반려 + 전달 패키지"
기준을 먼저 올립니다.

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
- `ROADMAP.md`, `TASKS.md`, `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`

현재 기준으로 확인되는 사실:

- 공통 `work item` 엔진과 `tax` 모듈 Production-ready (실구현) 자리는 이미 있다.
- 현재 `tax` 예시는 `월말 세무 증빙 수집 현황 점검` 1건 수준이라, 세무 일정/패키지/반려 기준 설명은 더 좁게만 잡혀 있다.
- 모바일 하단 탭 5개 유지, `홈`/`메뉴`/PC sidebar 확장 원칙은 그대로 유지해야 한다.
- 급여는 이미 독립 `payroll` 모듈로 분리됐고, 세무는 이번 단계에서 다시 `work item` 기반 `tax` 모듈로 정리한다.
- 아직 실제 홈택스/회계프로그램/세무사 계정 연동, 실민감 세무 원문 저장, 실제 신고 제출은 모두 승인 게이트다.

따라서 이번 Phase의 핵심은
세무 기능을 많이 완성하는 것이 아니라,
기존 공통 업무 엔진이 세무 요청과 마감 흐름을
어떻게 안전하게 담는지 설명 가능한 상태로 만드는 것입니다.

## Phase 28에서 고정하는 핵심 결정

### 결정 A. 세무 관리도 공통 `work item` 위에 올린다.

이번 단계에서도 기준 엔티티는
별도 "세무 신고 앱"이 아니라
기존 `work item` 입니다.

대신 `tax` 모듈 안에서
아래 category 확장 초안을 둡니다.

- `evidence_collection`
- `vat_closing`
- `withholding_tax_filing`
- `local_tax_report`
- `corporate_tax_preparation`
- `missing_receipt_follow_up`
- `tax_adjustment_review`
- `advisor_package_preparation`

핵심 원칙:

- 1차는 `module = tax` 를 유지하고, 세무 업무 종류 차이는 `category` 와 보조 metadata 로 푼다.
- 부가세/원천세/지방세/법인세는 "법정 계산기"가 아니라 마감/자료요청/검토 Production-ready (실구현) 으로 먼저 설명한다.
- 세무사 전달도 실제 외부 전송이 아니라, 어떤 패키지를 준비하는지 정리하는 단계로만 본다.

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

- 부가세/원천세/법인세마다 별도 주 상태군을 새로 만들지 않는다.
- "자료요청중/제출완료/반려/세무사전달준비" 같은 의미는 공통 상태 + 보조 필드 조합으로 푼다.

tax 보조 필드 초안:

- `filing_stage`: `collecting | branch_submitted | hq_reviewing | package_ready | handed_off`
- `evidence_status`: `not_started | partial | ready | missing | returned`
- `deadline_kind`: `monthly | quarterly | semiannual | annual`
- `external_filing_status`: `approval_required | not_connected`
- `sensitive_record_status`: `metadata_only | upload_gated`

즉,
공통 업무 상태와
세무 마감 진행 의미를 한 필드에 억지로 섞지 않습니다.

### 결정 C. 세무 Production-ready (실구현) 은 일정·자료·검토·전달·기록 5묶음으로 본다.

초기 설명 기준:

1. 일정
   - 어떤 세목/마감인지
   - 월별/분기별/연간 중 무엇인지
   - 어느 회사/지점 문맥인지

2. 자료
   - 매출/비용/인건비/증빙 제출 필요 항목
   - 누락 여부와 보완 요청 상태
   - 원문 대신 metadata 중심 제출 현황

3. 검토
   - 본사 세무 담당
   - 지점 관리자
   - 필요 시 감사 사용자

4. 전달 패키지
   - 세무사 전달용 묶음 준비 상태
   - 어떤 파일/요약이 필요한지
   - 실제 외부 전송은 열지 않음

5. 기록/audit
   - 누가 상태를 바꿨는지
   - 누가 누락/반려를 남겼는지
   - 누가 세무 민감 자료 메타데이터를 열람했는지

핵심은
세무 업무를 곧바로 신고 자동화로 만들기보다,
기존 공통 업무 엔진이 세무 마감과 증빙 추적도 담을 수 있게 설명하는 것입니다.

### 결정 D. 급여/노무와 연결하되 세무 책임 경계를 분리한다.

이번 단계의 anchor 흐름 초안:

- 지점 월말 증빙 요청 생성
- 지점별 매출/비용/인건비 자료 제출
- HQ 세무 담당 1차 검토
- 누락/반려/보완 요청
- 부가세/원천세/지방세/법인세 마감 체크
- 세무사 전달용 패키지 준비
- 승인 게이트 확인 후 외부 전달 후보 대기

중요:

- 급여의 세액 Production-ready (실구현) 와 세무 신고 준비를 같은 기능으로 취급하지 않는다.
- 노무 restricted 기록과 세무 증빙 추적을 같은 민감도/같은 화면 책임으로 섞지 않는다.
- 세무는 급여/노무와 연결되더라도, 지점 자료 회수와 HQ 검토라는 별도 운영 문맥을 가진다.

### 결정 E. 권한은 본사 세무 담당 / 지점 관리자 / 감사 / 일반 직원으로 더 분명히 나눈다.

초기 접근 제어 원칙:

- 본사 세무 담당
  - 여러 지점 세무 일정과 회수율을 본다.
  - 누락/반려/패키지 준비 상태를 본다.
  - 실제 홈택스 제출자나 외부 연동 실행자로 자동 확정하지 않는다.

- 지점 관리자
  - 자기 지점 자료 제출 상태와 보완 요청만 본다.
  - 회사 전체 세무 상세, 다른 지점 자료, 세무사 전달 완료 이력 전체를 보는 주체가 아니다.

- 감사 사용자
  - read-only 감사 흐름을 우선한다.
  - 세무 원문보다 상태 변경, 지연, 반려 이력, 접근 흔적 중심으로 본다.

- 일반 직원
  - 이번 단계의 주 사용자가 아니다.
  - 필요해도 직접 세무 work item 전체를 보는 기본 주체로 두지 않고, 급여/근태/증빙 제출 관련 개별 요청으로만 이어지게 본다.

중요:

- 지점 관리자는 운영 동행 주체이지, 회사 전체 세무 마감 대시보드를 전부 여는 주체가 아니다.
- "자료 제출 요청을 받는다"와 "세무 패키지 전체를 본다"를 같은 뜻으로 취급하지 않는다.

### 결정 F. 메뉴는 새 하단 탭 없이 공통 업무/세무 묶음 안에서 푼다.

UX 기준:

- 모바일 하단 탭은 계속 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개를 유지한다.
- 세무 관련 자리는 `홈` 요약 카드와 `메뉴`/PC sidebar 의 `공통 업무 > 세무` 안에서 푼다.

초기 배치 방향:

- 모바일 `홈`: 내 지점 제출 필요 자료, 마감 임박, HQ 반려/보완 요청 요약
- 모바일 `메뉴`: `세무` 진입점 아래 `증빙 수집`, `월말 마감`, `세목별 일정`, `전달 패키지`
- PC sidebar: 지점 제출용 세무 entry 와 HQ 세무 운영 entry 분리

중요:

- 세무 기능을 일반 협업 메뉴처럼 가볍게 섞지 않는다.
- `/admin/*` 정책 관리와 일반 세무 work item 화면을 같은 메뉴층 책임으로 설명하지 않는다.

### 결정 G. 실제 신고/외부 연동/실민감 자료는 계속 승인 게이트로 남긴다.

이번 단계에서 아직 안 여는 것:

- 홈택스 직접 신고/전송
- 회계프로그램 직접 연동
- 세무사 메일/메신저/외부 계정 직접 연동
- 실세무 자료 원문 업로드 확대
- production 세무 데이터 저장/이관
- 실계산 완료처럼 보이는 법정 세액 계산기

특히 아래는 계속 분리해야 합니다.

- 주민등록번호, 계좌번호, 실지급 파일
- 실매출 증빙 원문, 카드전표 원본, 세금계산서 원문 대량 저장
- 외부 신고 payload 생성/전송
- 실제 제출 완료 timestamp 를 운영 사실처럼 기록하는 기능

## 빠른 확인 순서
1. `/work-items` — 공통 업무 허브가 먼저 보이는지 본다.
2. `/work-items/tax` — 세무 category, role split, 승인 게이트 문구를 본다.
3. `/api/work-items?module=tax` — 세무 목록이 category/마감/지점 제출 상태를 읽히게 하는지 본다.
4. `/api/work-item-deadlines` — 세무 일정이 work item deadline 구조 안에서 읽히는지 본다.
5. `/api/work-items/:id/reviews` — HQ 검토/반려/보완 요청 메모를 같은 review Production-ready (실구현) 으로 읽게 하는지 본다.
6. `apps/api/test/work-items.spec.ts` / `apps/api/test/auth-org.spec.ts` — tax module visibility 경계가 역할별로 붙들려 있는지 본다.

## builder 최소 구현 방향
- 기존 `tax` Production-ready (실구현) 를 단일 월말 카드 수준에서, 세무 일정/증빙 패키지/보완 요청 설명이 있는 방향으로 확장한다.
- 가능하면 `taxContext` 같은 보조 metadata 묶음을 shared contract 와 Production-ready (실구현) API 에 추가해 Phase 27 `laborContext`, Phase 28A `payroll` 처럼 읽히게 한다.
- 세무 상세를 새 독립 `/tax` 앱으로 만들기보다, 이번 단계에서는 `/work-items/tax` 와 공통 work item API 확장에 머문다.
- 지점 관리자와 HQ 세무 담당 visibility 차이를 테스트와 copy 에 같이 남긴다.

## guardrail
- 실제 세무 신고 완료처럼 보이는 날짜/문구를 쓰지 않는다.
- 세무 일정은 법정 자동 계산 완료가 아니라 Production-ready (실구현) 마감 안내로 적는다.
- 세무 자료 원문과 metadata-only 제출 상태를 같은 뜻으로 쓰지 않는다.
- 급여의 세액 Production-ready (실구현) 와 세무 신고 준비 상태를 같은 엔드포인트/같은 책임처럼 섞지 않는다.
- 홈택스/회계프로그램/세무사 연동과 production data 는 계속 승인 게이트다.