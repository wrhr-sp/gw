# Phase 35 급여·세무·노무·법무·컴플라이언스 관리자흐름 UAT handoff

## 한 줄 요약
지금 기준으로 `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 는
모두 route 는 있지만
완성도와 연결 수준이 서로 다르다.

이번 Phase 35 문서는
무엇이 이미 same-origin API/권한 테스트까지 붙어 있는지,
무엇이 아직 공통 work item Production-ready (실구현) 또는 payroll preview 인지,
무엇이 아직 dedicated compliance queue 없이 감사 read-only 흐름으로 남아 있는지,
무엇이 외부 연동/실운영/승인 게이트인지
한 번에 구분해 주는 기준이다.

## 이번 Phase에서 대장이 기대해도 되는 것
이번 문서는 다음 여섯 가지를 같은 말로 묶는 기준이다.

1. 경영업무 허브 아래에서 민감 관리자 모듈이 어떻게 갈라지는지
2. 급여가 독립 `payroll` 모듈로 어디까지 직접 눌러볼 수 있는지
3. 세무가 공통 `work item` 기반 Production-ready (실구현) 으로 어디까지 보이는지
4. 노무/법무가 restricted 경계와 함께 어디까지 Production-ready (실구현) 로 열려 있는지
5. 컴플라이언스가 현재 어떤 dedicated route 없이 `/admin/audit-logs` 중심으로 읽히는지
6. 실제 외부 연동/실운영/승인 게이트가 어디부터 남는지

즉
"급여가 된다"
"세무가 된다"
"노무가 된다"
"법무가 된다"
"컴플라이언스가 된다"
를 막연하게 말하지 않고,
지금 무엇이 되고
무엇은 아직 preview/dev-safe/Production-ready (실구현) 이며
무엇은 외부 연동·실운영·승인 게이트인지
분리해서 적는 문서다.

## 먼저 붙잡힌 현재 재검증 근거
- parent 검증 카드 기준으로 Phase 35 핵심 route/API/test/build 가 현재 워크스페이스에서 다시 확인되었다.
- API focused 재검증:
  - `pnpm --filter @gw/api test -- --runInBand test/auth-org.spec.ts test/work-items.spec.ts test/operational-management-fallback.spec.ts test/phase35-operational-management-db.spec.ts test/zzz-phase35-review-check.spec.ts`
  - 결과: `14 files passed, 1 skipped; 97 passed, 4 skipped`
- Web focused 재검증:
  - `pnpm --filter @gw/web test -- payroll.test.tsx work-items.test.tsx zzz-phase35-review-guard.test.ts dashboard-boundary.test.tsx admin-preview-guard.test.ts`
  - 결과: `18 files passed; 85 passed`
- 공통 빌드/타입 재검증:
  - `pnpm --filter @gw/shared test && pnpm --filter @gw/shared typecheck && pnpm --filter @gw/api typecheck && pnpm --filter @gw/web typecheck && pnpm --filter @gw/web build && pnpm --filter @gw/web build:cf && pnpm check`
  - 결과: 전체 통과
- local preview smoke 기준으로 `COMPANY_ADMIN` 은 `/dashboard`, `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 에 200 으로 진입 가능했고, `MANAGER`/`EMPLOYEE` 는 역할에 맞지 않는 민감 경로에서 forbidden 또는 차단이 유지되었다.
- 중요한 해석:
  - 관리자 수동 UAT 시작점은 admin host root 가 아니라 일반 host 기준 `/dashboard` → `/management` 흐름으로 설명하는 편이 정확하다.
  - admin host root 는 `/admin` 중심 redirect 문맥이라, 이번 Phase 35 관리자 업무 설명과는 시작점이 다르다.

## 이번 단계 완료 기준
각 기능은 문서와 최종 보고에 아래를 남겨야 한다.
- 확인 route
- 추천 테스트 계정/권한
- 직접 해볼 action
- happy path 확인 포인트
- forbidden/empty/error 확인 포인트
- 아직 dev-safe/mock 인 부분
- 별도 승인 필요 항목

## 지금 바로 눌러볼 추천 순서
1. `/login`
   - `admin / 1234` 로 로그인한다.
   - 이 계정은 dev/test/UAT 전용이다.
2. `/dashboard`
   - 홈과 관리자 CTA 가 어디서 갈리는지 본다.
3. `/management`
   - 급여정산, 세무, 노무, 법무, 컴플라이언스/감사 카드가 roleScope 와 함께 보이는지 본다.
4. `/payroll`
   - 급여 프로필 Production-ready (실구현), 기간 상태, 명세서 초안 분리가 보이는지 본다.
5. `/payroll/me`
   - self-only 명세서 preview, correction guidance, Production-ready (실구현) 공제 문구를 본다.
6. `/work-items/tax`
   - 지점 제출/마감/HQ review Production-ready (실구현) 을 본다.
7. `/work-items/labor`
   - labor category 와 restricted 경계 문구를 본다.
8. `/work-items/legal`
   - 계약 검토/갱신/분쟁 후속 Production-ready (실구현) 와 승인 게이트 문구를 본다.
9. `/admin/audit-logs`
   - 컴플라이언스/감사 read-only 경계를 본다.

중요:
- 이번 Phase 35 수동 UAT 는 일반 host 기준 `/dashboard` 에서 시작한다.
- admin host root 나 `/admin` 에서 시작하면 감사/운영 콘솔 문맥으로 먼저 들어가므로, 급여·세무·노무·법무 관리자 흐름 출발점과 다르다.

## 지금 기준으로 분명히 말할 수 있는 것

### 1) `/management`
지금 볼 수 있는 것:
- 민감 관리자 모듈 허브
- `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 직접 진입 카드
- 각 카드의 roleScope 와 summary
- 일반 직원 홈과 분리된 sensitive access 문맥

이미 있는 근거:
- `apps/web/app/management/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/login/page.tsx`

아직 남은 것:
- 각 카드에서 실제 저장/조치/승인 액션으로 더 깊게 이어지는 운영 UX
- 컴플라이언스 전용 queue 나 상태변경 route

쉽게 말하면:
"관리자 허브 입구는 이미 있지만,
각 모듈이 완성 운영 콘솔까지 닫힌 것은 아니다"
이다.

### 2) `/payroll`
지금 볼 수 있는 것:
- 급여 프로필 Production-ready (실구현)
- 급여 기간 / 마감 상태
- 직원용 명세서 초안 진입
- `/api/payroll`, `/api/payroll/periods/:id`, `/api/payroll/me` 연결 포인트
- 본사 급여 담당 / 지점 관리자 / 일반 직원 역할 분리 설명

이미 있는 근거:
- `apps/web/app/payroll/page.tsx`
- `apps/api/src/app.ts` 의 `GET /api/payroll`, `GET /api/payroll/periods/:id`
- `apps/api/test/auth-org.spec.ts` 의 payroll overview/period detail 권한 테스트

아직 남은 것:
- 실세액 계산
- 4대보험 확정
- 실제 급여 확정/이체
- 외부 신고 연동

쉽게 말하면:
"급여를 읽는 관리자 preview 흐름은 이미 있지만,
실급여 운영 시스템이 닫힌 상태는 아니다"
이다.

### 3) `/payroll/me`
지금 볼 수 있는 것:
- 본인 명세서 초안
- self-only 경계
- correction guidance
- 원천세/4대보험 Production-ready (실구현) 문구
- 기간 상세 preview 로 이어지는 링크

이미 있는 근거:
- `apps/web/app/payroll/me/page.tsx`
- `apps/api/src/app.ts` 의 `GET /api/payroll/me`
- `apps/api/test/auth-org.spec.ts` 의 self payslip 허용/차단 테스트

아직 남은 것:
- 실지급 확정값
- 실제 원천세/보험 계산 엔진
- 실제 정정 요청 저장/처리 workflow

쉽게 말하면:
"구성원용 명세서 초안은 직접 볼 수 있지만,
실제 급여 확정/정산 결과 화면은 아니다"
이다.

### 4) `/work-items/tax`
지금 볼 수 있는 것:
- 세무 업무 category
- 증빙 수집, 부가세/원천세/지방세/법인세 마감 Production-ready (실구현)
- 본사 세무 담당 / 지점 관리자 / 감사 visibility 설명
- `/api/work-items?module=tax`, `/api/work-item-deadlines`, `/api/work-items/:id/reviews` 연결 포인트

이미 있는 근거:
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/work-items/_components/work-items-pages.tsx`
- `apps/api/test/work-items.spec.ts` 의 tax visibility/scope 테스트

아직 남은 것:
- 홈택스 직접 신고/전송
- 회계프로그램/세무사 외부 계정 연동
- 실세무 원문 대량 업로드
- 제출 완료를 운영 사실처럼 기록하는 자동화

쉽게 말하면:
"세무 마감 Production-ready (실구현) 과 제출 상태는 읽을 수 있지만,
실신고 시스템은 아니다"
이다.

### 5) `/work-items/labor`
지금 볼 수 있는 것:
- 근로계약, 근무조건 변경, 연차/수당, 고충, 징계, 사고, 퇴사 category
- restricted labor capability 설명
- self/branch/restricted 경계 문구
- `/api/work-items?module=labor`, `/api/work-item-deadlines` 연결 포인트

이미 있는 근거:
- `apps/web/app/work-items/work-items-config.ts`
- `apps/api/test/work-items.spec.ts` 의 labor restricted/self-scope 테스트

아직 남은 것:
- 실제 계약서/변경합의서 원문 저장
- 실제 징계 확정/통지
- 실제 사고 신고 제출
- 외부 노무/급여/법무 연동

쉽게 말하면:
"노무 metadata Production-ready (실구현) 과 restricted 경계는 이미 읽히지만,
실민감 노무 원문 시스템은 아니다"
이다.

### 6) `/work-items/legal`
지금 볼 수 있는 것:
- 계약 검토 요청, 계약 갱신 예정, 분쟁/클레임/보험 후속 Production-ready (실구현)
- 본사 법무/운영 담당 / 지점 관리자 / 감사 visibility 설명
- `/api/work-items?module=legal`, `/api/work-items/:id/reviews`, `/api/work-item-deadlines` 연결 포인트

이미 있는 근거:
- `apps/web/app/work-items/work-items-config.ts`
- `apps/api/test/work-items.spec.ts` 의 legal visibility/documents/attachments 테스트

아직 남은 것:
- 실계약서 원문 저장/비교/버전관리 확대
- 외부 변호사·보험사 계정 연동
- 실분쟁 자료 업로드 확대와 실제 제출 자동화

쉽게 말하면:
"법무 요청과 후속 상태는 읽을 수 있지만,
실계약/실분쟁 처리 시스템은 아니다"
이다.

### 7) `/admin/audit-logs` = 현재 컴플라이언스/감사 진입점
지금 볼 수 있는 것:
- 감사 전용 진입 의미
- actor/action/category/date 필터
- masked detail
- read-only/company boundary 설명
- 경영업무 허브의 "컴플라이언스 / 감사" 카드와 이어지는 흐름

이미 있는 근거:
- `apps/web/app/management/page.tsx` 의 컴플라이언스/감사 카드
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/api/src/app.ts` 의 `GET /api/admin/audit-logs`
- `apps/api/test/auth-org.spec.ts` 의 `audit.read` 허용/차단 테스트
- `apps/api/test/work-items.spec.ts` 의 `work_item.audit.read` 비노출/허용 테스트

아직 남은 것:
- dedicated `/compliance` route 또는 `module=compliance`
- 법령 리스크 경고 확인/보류/조치의 별도 queue
- richer compliance drill-down

쉽게 말하면:
"현재 컴플라이언스는 감사 read-only 흐름으로 먼저 읽히고,
전용 조치 시스템이 닫힌 것은 아니다"
이다.

## 기능별 UAT 액션 표

| 기능 | route | 추천 테스트 계정/권한 | 직접 해볼 액션 | happy path 확인 포인트 | forbidden/empty/error 포인트 | 현재 dev-safe/mock 잔여 | 별도 승인 게이트 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 관리자 허브 | `/management` | `admin / 1234`, 관리자/허용 역할 | 급여·세무·노무·법무·감사 카드 순서와 roleScope 를 확인한다 | 일반 홈과 분리된 민감 모듈 허브로 읽히고 각 카드가 다음 route 로 이어진다 | 일반 직원은 직접 허용되지 않고 `/forbidden` 또는 차단으로 남는다 | 각 카드에서 실저장 액션은 없다 | 민감 모듈에서 production 변경을 바로 수행하는 액션은 열지 않는다 |
| 급여 개요 | `/payroll` | `admin / 1234`, `payroll.read` 계열 | 급여 프로필/기간/직원 명세서 초안 카드와 live API 패널을 본다 | overview/period/myPayslip API 링크와 role split 설명이 같이 보이고 기간 상태가 preview 로 읽힌다 | 상세 기간/직원별 접근은 역할 차단으로 남는다 | preview only, 실세액·실지급 없음 | 실제 급여 확정/이체/주민번호·계좌정보 확장은 승인 필요 |
| 직원용 급여명세서 | `/payroll/me` | self-only 권한 사용자, `payroll.payslip.read_self` | self-only 명세서 초안, 정정 안내, 항목 preview 를 본다 | preview 상태, self-only, correction guidance 가 함께 읽힌다 | 자기 권한이 아니면 403 이고 동료 명세서는 열리지 않는다 | 원천세/4대보험 Production-ready (실구현), 실엔진 미연동 | 실세액 계산·실지급 반영·외부 신고 결과 노출은 승인 필요 |
| 세무 업무 | `/work-items/tax` | `admin / 1234`, `work_item.read` + scope | tax milestone, API route, roleScope, branch 제출/HQ review 문구를 본다 | branch 제출 상태와 HQ review Production-ready (실구현) 이 읽히고 공통 work item 흐름과 이어진다 | branch/company scope 가 다르면 차단되고, 권한이 없으면 목록/상세 일부가 보이지 않는다 | 직접 신고/외부 전송 없음 | 홈택스/회계프로그램/세무사 외부 연동은 승인 필요 |
| 노무 업무 | `/work-items/labor` | `admin / 1234`, `work_item.read` + restricted capability | labor category, confidentiality, restricted 경계 문구를 본다 | self/branch/restricted 차이가 문구와 상세 패널에서 읽힌다 | restricted 는 일부 역할 403 이고 원문 대신 metadata 만 남는다 | 실제 원문 저장/외부 연동 없음 | 실제 징계/사고 신고 제출·외부 노무 연동은 승인 필요 |
| 법무 업무 | `/work-items/legal` | `admin / 1234`, `work_item.read` + scope | 계약 검토/갱신/분쟁 후속 문구와 review Production-ready (실구현) 을 본다 | legal category 와 approval gate 문구가 읽히고 계약 metadata 중심 흐름이 보인다 | company scope 민감 계약은 차단되고, 원문/실분쟁 제출은 열리지 않는다 | Production-ready (실구현) 3건 중심, 실계약 원문 없음 | 외부 변호사/보험사/기관 연동과 실원문 확대는 승인 필요 |
| 컴플라이언스/감사 | `/admin/audit-logs` | `admin / 1234` 또는 `audit.read` 보유 역할 | 필터, 타임라인, masked detail, company boundary 를 본다 | read-only 추적과 현재 컴플라이언스 진입점이라는 문맥이 읽힌다 | `audit.read` 없으면 403 이고 관리자 전체 허용과 같은 뜻이 아니다 | 전용 compliance queue 없음, richer drill-down 후속 | 법령 리스크 조치 queue·상태변경 자동화·raw 감사 원문 노출은 승인 필요 |

## 다음 구현자가 바로 기억할 경계

### 급여와 세무를 같은 책임으로 적지 말 것
- `/payroll` 은 급여 profile/period/payslip preview 흐름이다.
- `/work-items/tax` 는 세무 마감/증빙/패키지 준비 흐름이다.
- 원천세 Production-ready (실구현) 와 세무 신고 준비를 한 문장으로 섞지 않는다.

### 노무와 법무를 같은 민감 모듈이라고 해서 같은 권한으로 적지 말 것
- labor 는 계약/수당/고충/징계/사고 metadata 와 restricted capability 문맥이 강하다.
- legal 은 계약 검토/갱신/분쟁 후속과 감사 추적 문맥이 강하다.

### 컴플라이언스는 전용 route 부재를 숨기지 말 것
- 현재 관리자 UAT 기준 컴플라이언스 진입은 `/management` → `/admin/audit-logs` 다.
- dedicated compliance queue 를 이미 가진 것처럼 적으면 안 된다.

### 관리자 UAT 완료와 외부 연동 완료를 섞지 말 것
- 현재 단계는 직접 눌러보고 읽는 관리자 UAT 기준이다.
- 실제 급여 지급, 외부 세무/노무/법무 기관 연동, production DB 변경은 여전히 승인 게이트다.

## 다음 작업자가 가장 먼저 볼 파일
### Web
- `apps/web/app/management/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/work-items/_components/work-items-pages.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`

### API / Test
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`

### 문서
- `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`
- `docs/architecture/phase-34-hr-branch-notifications-audit-real-usage-scope.md`
- `docs/guides/phase-34-hr-branch-notifications-audit-real-usage-handoff.md`
- `ROADMAP.md`
- `TASKS.md`
- `HANDOFF.md`

## 다음 구현 우선순위
1. `t_ce50b30c`
   - payroll/work-items/audit 중심 운영 DB 전환 7차 기준선 정리
2. `t_9a260e35`
   - `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` happy path/권한/state UX 보강

## 이번 단계에서 일부러 안 하는 것
- 실제 급여 지급, 은행 이체, 실세액/실보험 계산 확정
- production DB 실데이터 변경
- 홈택스/4대보험/회계/노무사/세무사/변호사/법령 API 외부 연동
- 주민번호/계좌번호 입력 확대
- 실제 계약/징계/사고/분쟁 원문 저장 확대
- dedicated compliance 자동 조치 시스템 완료 보고
