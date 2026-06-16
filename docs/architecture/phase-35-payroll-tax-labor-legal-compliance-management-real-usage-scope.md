# Phase 35 급여·세무·노무·법무·컴플라이언스 관리자흐름 UAT 범위

## 한 줄 요약
Phase 35의 목표는
대장이 배포 URL에서 `admin / 1234` 로 로그인한 뒤
`/management` → `/payroll` → `/payroll/me` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → `/admin/audit-logs` 흐름을
같은 관리자 UAT 언어로 직접 눌러보게 만드는 것이다.

쉽게 말하면 이번 단계는
이미 route 가 있는 급여·세무·노무·법무·감사 흐름을
"있긴 한 관리자 메뉴" 에서
"무엇이 지금 읽기/검토/preview 수준으로 직접 확인 가능하고,
무엇이 아직 placeholder 이며,
무엇이 외부 연동·실운영·승인 게이트로 남아 있는지"
한 번에 설명 가능하게 만드는 단계다.

## 왜 지금 Phase 35가 필요한가
Phase 31에서 로그인/홈/경영업무/계정관리 입구를 정리했고,
Phase 32에서 게시판·공지·댓글·문서함 협업 묶음을 정리했고,
Phase 33에서 근태·휴가·전자결재 일반 업무 흐름을,
Phase 34에서 인사·지점·알림·감사 운영흐름을 다시 묶었다.

그 다음으로 대장이 실제 운영 관점에서 바로 눌러보게 되는 묶음은
급여정산, 세무 업무, 노무 업무, 법무 업무, 컴플라이언스/감사다.

현재 코드 스냅샷 기준으로는 아래 간격이 남아 있다.

1. `/management` 아래에 급여·세무·노무·법무·감사 진입점은 이미 있지만,
   각각의 완성도와 실제 연결 수준이 다르다.
2. `/payroll` 과 `/payroll/me` 는 same-origin API와 권한 테스트가 이미 있지만,
   여전히 preview/placeholder/payroll foundation 톤이 강하다.
3. `tax`·`labor`·`legal` 은 공통 `work item` 엔진 위에 올라간 모듈이므로,
   개별 운영 시스템처럼 과장하면 안 된다.
4. `컴플라이언스` 는 현재 별도 전용 route/searchable queue 가 확인되지 않고,
   경영업무 허브의 "컴플라이언스 / 감사" 카드와 `/admin/audit-logs` read-only 흐름으로 먼저 읽힌다.
5. 실제 급여 지급, 홈택스/4대보험/회계/노무사/변호사/법령 API 같은 외부 연동은
   여전히 승인 게이트이므로 현재 관리자 UAT 범위와 분리해서 적어야 한다.

즉 이번 단계는
새 운영 시스템을 크게 추가하는 것이 아니라,
이미 있는 관리자 흐름을
"지금 실제로 어디까지 되는지 / 아직 무엇이 dev-safe 인지 / 무엇이 승인 게이트인지"
정직하게 다시 적는 단계다.

## 현재 구현 기준 스냅샷

### 지금 코드에서 바로 확인되는 것
- `apps/web/app/management/page.tsx`
  - `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 진입 카드가 이미 있다.
  - 경영업무 허브가 일반 직원 홈과 분리된 민감 모듈 허브라는 점을 직접 적고 있다.
- `apps/web/app/payroll/page.tsx`
  - 급여 프로필 skeleton, 급여 기간 상태, 직원용 명세서 초안, 연결 API 목록을 route 에서 바로 보여 준다.
  - preview only / role-split visibility / attendance/leave input linked 라는 현재 단계 문구가 있다.
- `apps/web/app/payroll/me/page.tsx`
  - 직원용 "내 급여명세서 초안" 화면이 self-only / preview amount / correction guidance 중심이라는 점이 보인다.
- `apps/web/app/work-items/work-items-config.ts`
  - `tax`/`labor`/`legal` 모듈의 summary, roleScope, accessNote, apiRoutes, milestones, detailSections 가 한 파일에 정리돼 있다.
- `apps/web/app/work-items/_components/work-items-pages.tsx`
  - 각 모듈 page 는 공통 shell 위에 권한/범위 메모, 체크포인트, 연결 API, detailSections 를 렌더링한다.
- `apps/api/src/app.ts`
  - `GET /api/payroll`, `GET /api/payroll/periods/:id`, `GET /api/payroll/me` 가 실제 same-origin route 로 열려 있다.
  - `GET /api/work-items`, `GET /api/work-items/:id`, `GET /api/work-item-deadlines` 가 공통 업무 API 골격으로 열려 있다.
- `apps/api/test/auth-org.spec.ts`
  - 급여 개요/기간 상세/self payslip 권한 분기 테스트가 있다.
- `apps/api/test/work-items.spec.ts`
  - tax/labor/legal visibility, restricted 경계, documents/attachments, audit 비노출/허용, deadline 범위 테스트가 있다.

### API 테스트로 이미 확인된 것
`apps/api/test/auth-org.spec.ts` 기준:
- COMPANY_ADMIN 은 `/api/payroll` overview 200, 다수 profile, 기간 상태 `reviewing`, 본사 급여 담당 guidance 를 본다.
- MANAGER 는 `/api/payroll` overview 200 이지만 employee scope collection step 을 보지 않고,
  `/api/payroll/periods/payroll_period_2026_05` 상세는 403 이다.
- EMPLOYEE 는 `/api/payroll` overview 200 이지만 자기 profile 1건만 보고,
  `/api/payroll/me` 는 200 이며 employeeMessage 에 `preview 상태` 가 포함된다.
- `payroll.payslip.read_self` 가 없는 역할은 `/api/payroll/me` 에서 403 이다.

`apps/api/test/work-items.spec.ts` 기준:
- tax 는 branch scope `work_item_tax_month_end_evidence` 와 company scope `work_item_tax_vat_package_preparation` 가 다르게 보인다.
- labor 는 self-scope, branch-visible, restricted labor 경계가 분리돼 있다.
- legal 은 계약 검토/갱신/분쟁 intake 가 visibility 경계와 함께 placeholder 로 존재한다.
- `work_item.audit.read` 가 없으면 item 상세를 봐도 audit logs 는 비어 있고,
  AUDITOR 는 같은 item 에서 감사 흔적을 본다.
- visible deadline 만 역할별로 다르게 내려온다.

### 지금 바로 체험 가능에 가까운 영역
- `/management`
  - 민감 모듈 허브와 roleScope 안내
- `/payroll`
  - 급여 프로필/기간/직원 명세서 초안이라는 세 갈래 구조
- `/payroll/me`
  - self-only 명세서 preview 와 정정 안내
- `/work-items/tax`
  - 세무 category, 제출 상태, HQ review/deadline skeleton
- `/work-items/labor`
  - 계약/수당/고충/징계 등 labor metadata skeleton
- `/work-items/legal`
  - 계약 검토/갱신/분쟁 후속 skeleton
- `/admin/audit-logs`
  - 컴플라이언스/감사 read-only 추적 흐름

### 아직 placeholder/dev-safe 비중이 큰 영역
- 급여 실세액 계산, 4대보험 확정, 외부 신고/이체 연동
- 세무 직접 신고/외부 세무사 계정 연동/실원문 대량 업로드
- 실제 계약서/징계/사고 원문 저장과 외부 노무·법무·보험 연동
- 별도 전용 컴플라이언스 queue 또는 법령 리스크 조치 route
- 실운영 상태 변경을 production 사실처럼 기록하는 자동화

## Phase 35에서 고정할 핵심 결정

### 결정 A. 관리자 UAT 입구는 `/management` 를 기준으로 쓴다.
- 일반 직원 홈에서 모든 민감 모듈을 직접 노출하는 방식으로 적지 않는다.
- 대장이 가장 짧게 확인할 관리자 흐름은 `/dashboard` 이후 `/management` 진입으로 적는다.

### 결정 B. 급여는 독립 `payroll` 모듈로 읽고 세무와 섞지 않는다.
- `/payroll` 은 급여 프로필/기간/명세서 preview 구조다.
- `/work-items/tax` 는 세무 마감/증빙/패키지 준비 구조다.
- 원천세 placeholder 와 세무 마감 준비를 같은 모듈 책임처럼 적지 않는다.

### 결정 C. tax/labor/legal 은 공통 `work item` skeleton 위에 올라간 관리자 업무로 적는다.
- 개별 모듈이 별도 완성 운영 시스템처럼 보이게 적지 않는다.
- 공통 목록/상세/문서/첨부/검토/마감 구조 위에 모듈별 category 와 권한 차이를 얹는다고 적는다.

### 결정 D. 컴플라이언스는 현재 전용 관리자 queue 보다 감사 read-only 경계로 먼저 적는다.
- 이번 조사에서는 dedicated `/compliance` 또는 `module=compliance` 구현 근거를 찾지 못했다.
- 현재 컴플라이언스/법령 리스크 경고는 `/management` 의 "컴플라이언스 / 감사" 카드와 `/admin/audit-logs` 경로에서 먼저 읽힌다고 적는다.
- 따라서 "위험 경고 확인/보류/조치" 전체가 완성됐다고 쓰지 않는다.

### 결정 E. 승인 게이트를 관리자 UAT 완료와 섞지 않는다.
- 실제 급여 지급, 은행 이체, 주민번호/계좌번호 입력 확대,
  홈택스/4대보험/회계/노무사/세무사/변호사/법령 API 연동,
  production DB 실데이터, migration, destructive 작업은 계속 별도 승인으로 적는다.

## fit-gap 표

| 구분 | 지금 대장이 직접 눌러볼 수 있는 것 | 아직 남은 gap | 다음 구현 우선순위 |
| --- | --- | --- | --- |
| 경영업무 허브 | `/management` 에서 급여/세무/노무/법무/감사 진입 카드와 roleScope 확인 | 각 카드가 실제 액션/상태변경 화면으로 더 이어지지는 않음 | 관리자 UAT 추천 순서와 권한 설명 통일 |
| 급여 | `/payroll`, `/payroll/me`, `/api/payroll`, `/api/payroll/periods/:id`, `/api/payroll/me` preview 흐름 | 실세액 계산, 실지급, 외부 신고/이체, production payroll data 없음 | preview/self-only/role-split 경계 유지하며 happy path 설명 보강 |
| 세무 | `/work-items/tax`, `/api/work-items?module=tax`, `/api/work-item-deadlines`, review skeleton | 홈택스 직접 신고, 외부 세무사 계정, 실원문 전송 없음 | branch scope vs company scope 세무 경계 문서화와 UAT 순서 고정 |
| 노무 | `/work-items/labor`, restricted labor 경계, self-scope 일부 확인 | 실제 계약서/징계/사고 원문, 외부 노무 연동 없음 | restricted/confidential/self-scope 설명을 route/API/test와 통일 |
| 법무 | `/work-items/legal`, 계약 검토/갱신/분쟁 intake placeholder, review skeleton | 실계약 원문 저장, 외부 변호사/보험 연동, 실제 분쟁 제출 없음 | 현재 placeholder 3건과 visibility 경계를 과장 없이 고정 |
| 컴플라이언스/감사 | `/management` 의 컴플라이언스 카드, `/admin/audit-logs` read-only 흐름 | 전용 compliance queue, 법령 리스크 조치 route, 상태변경 자동화 근거 부재 | 현재는 audit/read-only 중심으로 적고 후속 전용 모듈 필요 여부 판단 |
| 권한/범위 | payroll role split, tax company/branch split, labor restricted, legal visibility, audit read 경계 | 왜 막히는지 더 즉시 읽히는 UX 보강 필요 | forbidden/company scope/branch scope/self-only/placeholder 제한 문구 통일 |

## 대장이 실제로 눌러볼 추천 순서
1. `/login`
   - `admin / 1234` 로 로그인한다.
2. `/dashboard`
   - 홈과 관리자 CTA, 경영업무 진입선을 본다.
3. `/management`
   - 급여·세무·노무·법무·컴플라이언스/감사 카드가 roleScope 와 함께 보이는지 본다.
4. `/payroll`
   - 급여 프로필 skeleton, 기간 상태, 직원 명세서 초안 분리가 읽히는지 본다.
5. `/payroll/me`
   - self-only 명세서 preview, correction guidance, placeholder 공제 문구를 본다.
6. `/work-items/tax`
   - 지점 제출/세무 마감/HQ review 설명을 본다.
7. `/work-items/labor`
   - labor category 와 restricted 경계 문구를 본다.
8. `/work-items/legal`
   - 계약 검토/갱신/분쟁 후속 placeholder 와 승인 게이트 문구를 본다.
9. `/admin/audit-logs`
   - 컴플라이언스/감사 read-only 추적과 masking 경계를 본다.

## 기능별 UAT 액션 표

| 기능 | route | 권한 | 직접 해볼 액션 | happy path 확인 포인트 | forbidden/empty/error 포인트 | 현재 dev-safe/mock 잔여 |
| --- | --- | --- | --- | --- | --- | --- |
| 관리자 허브 | `/management` | 관리자/허용 역할 | 급여·세무·노무·법무·감사 카드 순서 확인 | 일반 홈과 분리된 민감 모듈 허브로 읽힘 | 일반 직원은 직접 허용되지 않음 | 각 카드에서 실저장 액션은 없음 |
| 급여 개요 | `/payroll` | `payroll.read` 계열 | 급여 프로필/기간/직원 명세서 초안 카드를 본다 | overview/period/myPayslip API 링크와 role split 설명이 같이 보임 | 상세 기간/직원별 접근은 역할 차단 | preview only, 실세액·실지급 없음 |
| 직원용 급여명세서 | `/payroll/me` | `payroll.payslip.read_self` | self-only 명세서 초안과 정정 안내를 본다 | preview 상태, self-only, correction guidance 가 읽힘 | 자기 권한이 아니면 403 | 원천세/4대보험 placeholder, 실엔진 미연동 |
| 세무 업무 | `/work-items/tax` | `work_item.read` + scope | tax milestone, API route, roleScope 를 본다 | branch 제출 상태와 HQ review skeleton 이 읽힘 | branch/company scope 가 다르면 차단 | 직접 신고/외부 전송 없음 |
| 노무 업무 | `/work-items/labor` | `work_item.read` + capability | labor category 와 confidentiality 문맥을 본다 | self/branch/restricted 차이가 문구로 읽힘 | restricted 는 일부 역할 403 | 실제 원문 저장/외부 연동 없음 |
| 법무 업무 | `/work-items/legal` | `work_item.read` + scope | 계약 검토/갱신/분쟁 후속 문구를 본다 | legal category 와 approval gate 문구가 읽힘 | company scope 민감 계약은 차단 | placeholder 3건 중심, 실계약 원문 없음 |
| 컴플라이언스/감사 | `/admin/audit-logs` | `audit.read` | 필터, 타임라인, masked detail 을 본다 | read-only 추적과 company boundary 가 읽힘 | `audit.read` 없으면 403 | 전용 compliance queue 없음, richer drill-down 후속 |

## 구현 우선순위

### P0. Phase 35 fit-gap/handoff 를 현재 관리자 UAT 언어로 고정
- `/management` 기준 추천 클릭 순서
- `/payroll` 과 `/work-items/tax` 책임 분리
- labor/legal restricted 경계와 감사 read-only 경계 정리
- dedicated compliance route 부재를 gap 으로 명시

### P1. 운영 DB 전환 7차와 연결할 데이터 기준선 정리
- payroll/work-items/audit 중 fixture/placeholder 와 운영 read fallback 경계 구분
- phase 문서와 DB 전환 카드 완료 기준 분리

### P2. 관리자 UAT happy path 와 권한/상태 UX 보강
- `/management` 카드 copy
- `/payroll`/`/payroll/me` preview 안내
- tax/labor/legal forbidden/empty/loading/error 상태 설명 정리
- `/admin/audit-logs` 컴플라이언스 문맥 강화

### P3. 전용 컴플라이언스 큐 필요 여부 판단
- `/admin/audit-logs` 만으로 충분한지
- `/compliance` 또는 `work-items/compliance` 같은 전용 모듈이 필요한지
- 법령 리스크 경고 확인/보류/조치 흐름을 어디에 둘지 후속 결정

## 이번 단계에서 일부러 안 하는 것
- 실제 급여 지급/은행 이체/확정 세액 계산
- 주민번호/계좌번호 입력 확대
- 홈택스/4대보험/회계/세무사/노무사/변호사/법령 API 외부 계정 연동
- production DB 실데이터 변경, migration, destructive 작업
- 실계약/징계/사고/분쟁 원문 저장 확대
- 전용 compliance 자동 조치 엔진을 완료품처럼 문서화하는 것

## 구현자가 먼저 볼 파일
1. `apps/web/app/management/page.tsx`
2. `apps/web/app/payroll/page.tsx`
3. `apps/web/app/payroll/me/page.tsx`
4. `apps/web/app/work-items/work-items-config.ts`
5. `apps/web/app/work-items/_components/work-items-pages.tsx`
6. `apps/api/src/app.ts`
7. `apps/api/test/auth-org.spec.ts`
8. `apps/api/test/work-items.spec.ts`
9. `docs/guides/phase-34-hr-branch-notifications-audit-real-usage-handoff.md`
10. `docs/architecture/phase-34-hr-branch-notifications-audit-real-usage-scope.md`
