# Phase 43 급여·세무·노무·법무 내부관리 도입완성 handoff

## 1. 이번 Phase를 한 줄로 말하면

이번 Phase는 `/management` 아래의 급여·세무·노무·법무·감사 흐름을
회사 내부 운영팀이 실제로 따라갈 수 있는 내부관리 도입 레인으로 다시 정리하는 단계다.

쉽게 말하면,

- 일반 직원 홈에서 무엇을 보지 않아야 하는지,
- 관리자/담당자가 어느 route 에서 어떤 검토를 하는지,
- 아직 안 되는 외부 연동과 실데이터 범위가 무엇인지,

이 세 가지를 한 번에 헷갈리지 않게 만드는 문서다.

## 2. 이번 Phase에서 꼭 지켜야 할 제품 문장

- `/dashboard` 는 직원 기본 업무 시작점이고, `/management` 는 별도 내부관리 허브다.
- `/payroll` 은 급여 프로필/기간/명세서 초안을 읽는 관리자 급여 운영 화면이다.
- `/payroll/me` 는 구성원의 self-only 명세서 preview 와 정정 안내 화면이다.
- `/work-items/tax` 는 지점 제출 대 HQ 검토를 읽는 세무 운영 화면이다.
- `/work-items/labor` 는 self/branch/restricted 경계가 강한 노무 운영 화면이다.
- `/work-items/legal` 는 계약/갱신/분쟁 approval gate metadata 를 읽는 법무 운영 화면이다.
- `/admin/audit-logs` 는 현재 컴플라이언스/감사 read-only 진입점이다.
- 실지급, 실신고, 외부 전문가 연동, 민감 원문 저장 확대, production 실데이터는 모두 승인 게이트다.

## 3. 역할별 추천 도입 레인

### A. 본사 관리자 / 운영 총괄 레인
- `/dashboard`
- `/management`
- `/payroll`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin/audit-logs`

읽는 포인트:
- 일반 직원 홈과 민감 운영 허브가 분리되는지
- 급여·세무·노무·법무·감사의 책임이 서로 섞이지 않는지
- 승인 게이트가 route 설명과 문서에서 같은 뜻인지

### B. 급여 담당 / 구성원 급여 확인 레인
- `/management`
- `/payroll`
- `/payroll/me`
- 필요 시 `/attendance`
- 필요 시 `/leave`

읽는 포인트:
- 급여 개요와 self-only 명세서가 분리되는지
- preview 금액과 실지급 확정이 같은 말처럼 보이지 않는지
- 근태/휴가 입력과 급여 확정 책임이 서로 섞이지 않는지

### C. 세무 / 지점 제출 레인
- `/management`
- `/work-items/tax`
- `/admin/audit-logs`

읽는 포인트:
- branch 제출과 HQ 검토가 다른 역할로 읽히는지
- review/deadline skeleton 이 실제 신고 완료처럼 과장되지 않는지
- 감사 역할과 세무 담당 역할이 같은 뜻처럼 보이지 않는지

### D. 노무 / 법무 / 감사 레인
- `/management`
- `/work-items/labor`
- `/work-items/legal`
- `/admin/audit-logs`

읽는 포인트:
- self/branch/restricted/company scope 경계가 흐려지지 않는지
- 실제 원문 저장이나 외부 기관 제출이 이미 열렸다고 오해되지 않는지
- 감사 read-only 와 운영 변경 권한이 섞이지 않는지

## 4. 이번 Phase에서 바로 이어받아야 할 구현 포인트

### A. 경영업무 허브
- `/management` 카드는 민감 모듈 허브라는 의미를 유지한다.
- 지점 운영 카드와 급여·세무·노무·법무·감사 카드를 모두 `경영업무` 아래에 두되, 서로 다른 책임을 같은 말로 묶지 않는다.
- 일반 직원 홈에서 민감 관리자 업무를 직접 여는 UX 로 되돌아가지 않게 한다.

### B. 급여
- `/payroll` 은 급여 프로필 skeleton, 기간 상태, 명세서 초안 진입을 같은 흐름으로 읽게 유지한다.
- `/payroll/me` 는 self-only, preview, correction guidance 를 고정 문장으로 유지한다.
- 원천세/4대보험 placeholder, reviewing 상태, attendance/leave linked 문구가 실지급 확정처럼 보이지 않게 한다.

### C. 세무
- `/work-items/tax` 는 branch 제출과 HQ package preparation 을 같은 권한처럼 적지 않는다.
- `module=tax`, `deadlines`, `reviews` 연결 포인트를 문서에서도 같이 보이게 유지한다.
- 홈택스 직접 신고/외부 세무사 계정/실원문 전송은 계속 닫아 둔다.

### D. 노무
- `/work-items/labor` 는 self-scope, branch-visible, restricted labor 차이를 숨기지 않는다.
- 고충/징계/사고 같은 민감 건은 metadata 중심 설명과 capability 경계를 유지한다.
- 실제 계약서/징계/사고 원문과 외부 노무·급여 연동은 열지 않는다.

### E. 법무
- `/work-items/legal` 는 계약 검토, 갱신, 분쟁/클레임 후속을 metadata 중심 흐름으로 유지한다.
- branch-visible 계약과 company-only 민감 계약을 같은 full access 처럼 설명하지 않는다.
- 실계약 원문, 외부 변호사/보험사/기관 계정, 실제 제출 자동화는 열지 않는다.

### F. 컴플라이언스 / 감사
- 현재 컴플라이언스 진입은 `/admin/audit-logs` read-only 흐름이라는 점을 유지한다.
- `audit.read` 와 운영 변경 권한을 같은 관리자 권한처럼 뭉개지 않는다.
- dedicated `/compliance` route 부재를 숨기지 않고, 후속 판단 과제로 남긴다.

## 5. 현재 구현 근거 파일

### web 근거
- `apps/web/app/management/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/work-items/_components/work-items-pages.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`

### API/test 근거
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/web/admin-preview-guard.test.ts`

### 루트 문서 근거
- `ROADMAP.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `KNOWN_ISSUES.md`

## 6. 이번 Phase 구현/리뷰/테스트가 꼭 물어야 할 질문

1. `/management` 가 일반 직원 홈이 아니라 내부관리 허브로 읽히는가
2. `/payroll` 과 `/payroll/me` 가 preview/self-only/role-split 경계를 숨기지 않는가
3. `/work-items/tax` 에서 branch 제출과 HQ 검토가 같은 권한처럼 섞이지 않는가
4. `/work-items/labor` 에서 self/branch/restricted 경계가 흐려지지 않는가
5. `/work-items/legal` 에서 계약/갱신/분쟁 metadata 와 실계약/실분쟁 처리가 같은 말처럼 쓰이지 않는가
6. `/admin/audit-logs` 가 현재 컴플라이언스 read-only 진입점이라는 사실과 전용 조치 queue 부재를 함께 드러내는가
7. 실지급·실신고·외부 전문가 연동·민감 원문 저장 확대·production 실데이터가 아직 승인 게이트라는 점이 숨겨지지 않는가

## 7. 현재 Kanban 체인

1. Phase 42A 로그인 필수 진입 정책: 완료
2. Phase 42 근태·휴가·인사·지점 운영 도입완성: 완료
3. Phase 43 재검증: `t_3d8b63f1` — 해봄(`gwtester`) — 완료
4. Phase 43 문서화: `t_ba4ee646` — 다온(`gwdocs`) — 현재 카드
5. Phase 43 GitHub PR/CI/merge/branch cleanup: `t_fccdb199` — 지킴(`gwops`) — 부모 대기

상위 parent 메모:
- live URL 기준 시작점은 계속 `https://gw-web.wereheresp.workers.dev` 다.
- dev/test/UAT 전용 테스트 계정은 계속 `admin / 1234` 다.
- 이 계정은 production 기본 계정이 아니다.
- 최신 parent 재검증에서는 shared/api/web 테스트, typecheck, `pnpm check`, web build, `pnpm --filter @gw/web build:cf`, local preview curl smoke 가 모두 통과했다.
- local preview smoke 에서는 익명 `/management`·`/payroll`·`/work-items/tax|labor|legal`·`/admin/audit-logs` 가 `/login` 으로 redirect 되고, `COMPANY_ADMIN`/`AUDITOR`/`MANAGER`/`EMPLOYEE` 역할별 허용/차단 경계도 다시 확인됐다.
- 보조 이슈로 `scripts/gw-admin-host-preview-smoke.sh` 의 general manifest `start_url='/'` 기대값은 현재 로그인 우선 정책(`start_url='/login'`)과 어긋난다. 앱 동작 자체는 현재 middleware/mobile-pwa 테스트와 preview smoke 결과 기준으로 정상이다.

## 8. 완료 판단 기준

- 루트 문서와 Phase 43 scope/handoff 문서가 같은 뜻을 말한다.
- 급여·세무·노무·법무·감사 흐름을 일반 직원 홈과 분리된 내부관리 레인으로 설명한다.
- preview/self-only/branch/company/restricted/audit.read 경계를 숨기지 않는다.
- 전용 컴플라이언스 route 부재와 외부 연동 승인 게이트를 정직하게 남긴다.
- 다음 구현/리뷰 작업자가 어떤 route 와 테스트를 먼저 봐야 하는지 바로 알 수 있다.

## 9. 아직 남겨 두는 승인 게이트

- 실제 급여 지급과 은행 이체
- 확정 세액 계산과 4대보험 실연동
- 홈택스/회계/세무사/노무사/변호사/보험사/기관 외부 계정 연동
- production DB 실데이터 변경
- 주민번호/계좌번호 등 민감 원문 처리 확대
- 실계약/징계/사고/분쟁 원문 저장 확대
- dedicated compliance 조치 queue 또는 자동화
- DNS/custom domain, 유료 리소스, migration, destructive 작업
