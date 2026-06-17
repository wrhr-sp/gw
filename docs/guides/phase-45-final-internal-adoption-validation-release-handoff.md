# Phase 45 외부연동 전 내부 도입 최종검증·릴리즈 handoff

## 1. 이번 Phase를 한 줄로 말하면
이번 Phase는
지금까지 만든 그룹웨어를
"외부 연동 없이 우리 회사 내부에서 본격 도입 가능한가"라는 질문으로 마지막 점검하는 단계다.

쉽게 말하면,

- 직원이 어디서 시작하는지,
- 관리자가 어떤 민감 레인을 보는지,
- 감사는 어디까지 읽는지,
- 무엇은 아직 승인 없이는 하면 안 되는지,
- 배포와 롤백 근거를 무엇으로 확인할지,

이 다섯 가지를 최종 보고 형식으로 묶는 문서다.

## 2. 이번 Phase에서 꼭 지켜야 할 제품 문장
- 대시보드=`/dashboard` 는 직원 기본 홈이다.
- 일반 직원 기본업무는 `/dashboard` 중심으로 읽고 `/attendance`·`/leave`·`/approvals`·`/boards`·`/documents` 가 그 다음 레인이다.
- `경영업무`(`/management`) 는 일반 직원 홈과 다른 민감 운영 허브다.
- `/payroll` 은 급여 preview/운영 검토 레인이고 실지급 확정 화면이 아니다.
- `/payroll/me` 는 self-only 명세서 preview 와 정정 안내 레인이다.
- `tax`·`labor`·`legal` 은 공통 work item 기반 내부관리 레인이며 branch/company/self/restricted 경계를 유지한다.
- `/admin/audit-logs` 는 현재 컴플라이언스/감사 read-only 진입점이다.
- 로그인 전에는 `/login` 만 익명 입구다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정처럼 적지 않는다.
- 실제 급여 지급, 은행 이체, 주민번호/계좌번호 확대, production 실데이터, 외부 기관/전문가 연동, DNS/custom domain, 유료 리소스, secret, migration, destructive 작업은 모두 승인 게이트다.

## 3. 대장이 가장 짧게 따라갈 추천 확인 순서

먼저 기억할 점:
- live 첫 입구는 `/login` 이다.
- `/uat` 는 로그인 뒤 내부 도입 리허설 패키지를 다시 모아보는 운영용 route 다.
- 익명 사용자가 `/uat` 를 바로 열어도 `/login` 으로 돌려보내야 한다.

### A. 직원 레인
1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/leave`
5. `/approvals`
6. `/boards`
7. `/documents`
8. `/notifications`
9. `/me`

읽는 포인트:
- 로그인 전 내부 메뉴가 열리지 않는지
- `/dashboard` 가 오늘 할 일 시작점으로 읽히는지
- 기본업무 레인 안에 민감 운영 레인이 섞이지 않는지

### B. 관리자/담당자 레인
1. `/dashboard`
2. `/management`
3. `/work-items/branch`
4. `/payroll`
5. `/payroll/me`
6. `/work-items/tax`
7. `/work-items/labor`
8. `/work-items/legal`
9. `/admin/audit-logs`

읽는 포인트:
- 일반 홈과 민감 운영 허브가 분리되는지
- preview/self-only/branch/company/restricted/read-only 경계가 유지되는지
- 급여·세무·노무·법무·감사가 같은 메뉴처럼 보여도 같은 책임으로 설명되지 않는지

### C. 감사/점검 레인
1. `/management` 설명 확인
2. `/admin/audit-logs`
3. approval gate 목록 확인
4. 필요 시 `/uat`

읽는 포인트:
- 현재 감사는 read-only 인지
- 조치 시스템 완성처럼 과장되지 않는지
- 승인 게이트와 현재 가능 범위가 분리돼 있는지

## 4. 이미 재사용 가능한 최신 근거
- live URL: `https://gw-web.wereheresp.workers.dev`
- merge commit: `8372ae1008c74b1578c17e26763b8462596b65ad`
- main release-gate: success
- focused API: `pnpm --filter @gw/api test -- auth-org.spec.ts work-items.spec.ts` → 15 files passed, 98 tests passed, 4 skipped
- focused web: `pnpm --filter @gw/web test -- admin-preview-guard.test.ts work-items.test.tsx dashboard-boundary.test.tsx payroll.test.tsx` → 24 files passed, 100 tests passed
- `pnpm --filter @gw/mobile typecheck` 통과
- `pnpm --filter @gw/web build` 통과
- local preview smoke: 익명 `/`, `/dashboard`, `/management`, `/payroll`, `/payroll/me`, `/work-items/labor`, `/admin/audit-logs`, `/uat` 는 `/login` redirect, `/login` 200, `/api/health` 200, `/manifest.webmanifest` 200

## 5. 최종 보고에 바로 넣을 요약 틀

### A. 한 줄 결론
- "외부 연동 없이 회사 내부 그룹웨어로 본격 도입 가능한 기준선은 확보됐고, 외부 기관 연동·실데이터·민감정보 확대는 별도 승인 게이트로 남아 있다" 형식으로 쓴다.

### B. live 확인 정보
- live URL: `https://gw-web.wereheresp.workers.dev`
- 테스트 계정: `admin / 1234` (dev/test/UAT 전용)
- 익명 시작점: `/login`
- 운영 패키지 보조 route: `/uat` (로그인 후 확인용)

### C. 역할별 시나리오 요약
- 일반 직원: `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents`
- 관리자/담당자: `/dashboard` → `/management` → `/work-items/branch` → `/payroll` → `/payroll/me` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal`
- 감사 담당: `/management` 설명 확인 → `/admin/audit-logs` read-only 확인
- 운영 진행자: `/login` 뒤 `/uat` 에서 시나리오 카드/이슈 기록 형식/approval gate 묶음 재확인

### D. release/rollback 확인 포인트
- release success 근거와 merge commit 을 먼저 적는다.
- live 직접 확인이 막히면 local preview/build/release gate 근거를 대체 근거로 따로 적는다.
- rollback 이 필요하면 `pnpm exec wrangler deployments list --json --name gw-web` 로 version id 를 확인한 뒤 `pnpm exec wrangler rollback <version-id> --name gw-web -y` 순서로 되돌린다.
- rollback 뒤에는 `/login`, `/dashboard`, `/management`, `/payroll`, `/admin/audit-logs`, `/manifest.webmanifest` 를 다시 확인 포인트로 남긴다.

## 6. builder가 바로 봐야 할 핵심 질문
1. 직원 레인과 민감 운영 레인이 실제 화면/copy/CTA 에서 섞이지 않는가
2. `/payroll` preview 와 실지급, `/admin/audit-logs` read-only 와 실제 조치 시스템, work item metadata 와 실원문 처리가 같은 말처럼 섞이지 않는가
3. 로그인 전 비노출 기준, route guard, API guard, scope 문장이 실제 구현과 맞는가
4. 최종 UAT 시나리오를 막는 잔여 UX/copy/guard 문제가 있으면 Phase 45 안에서 정리할 수 있는가

## 7. reviewer가 봐야 할 핵심 질문
1. 과장 문구 때문에 내부 도입 완료와 외부 연동 준비가 섞이지 않는가
2. 권한 없는 사용자가 민감 route/API 를 열 수 있다고 오해할 문장이 없는가
3. `admin / 1234` 가 production 기본 계정처럼 읽히지 않는가
4. release/rollback/approval-needed 설명이 운영상 위험하게 단정적이지 않은가

## 8. tester가 바로 따라갈 확인 순서
1. focused API/web 회귀
2. mobile typecheck
3. web build
4. 익명 redirect/local preview smoke
5. `/uat` 로그인 후 운영 패키지 확인
6. 직원 레인 수동 점검
7. 관리자/담당자 레인 수동 점검
8. 감사/read-only/approval gate 문장 점검

같이 볼 질문:
- 문서 설명과 실제 route 책임이 같은가
- 로그인 전 비노출 기준과 실제 guard 가 같은가
- 직원 레인/민감 운영 레인/감사 read-only/승인 게이트가 섞이지 않는가

## 9. docs/ops가 이어받아야 할 정리 포인트
- 최종 사용자 보고에는 live URL, 추천 route 순서, 테스트 계정, 역할별 시나리오, 남은 승인 게이트를 넣는다.
- live 직접 재확인이 막히면 local preview/release gate/build 근거를 대체 근거로 분리해 적고, live 직접 확인 완료처럼 쓰지 않는다.
- rollback 관점에서는 무엇을 되돌릴지보다, 어떤 근거로 현재 release 가 성공인지와 어떤 승인 게이트가 아직 남았는지를 먼저 분리한다.
- `/uat` 는 로그인 후 진행자가 보는 내부 리허설 패키지라는 점을 남기고, `/login` 과 같은 익명 첫 입구처럼 쓰지 않는다.
- Phase 45 종료 후 외부 연동/실데이터/기관 계정 연계는 새 카드 체인으로 넘긴다.

## 10. 이번 Phase에서 하지 않는 것
- 실제 급여 지급/은행 이체
- 주민번호/계좌번호 확대 입력
- production DB 실데이터 반영
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- 법령 API 인증키 등록
- DNS/custom domain
- 유료 리소스 증설
- secret 입력/교체
- migration
- destructive/force 작업

## 11. 관련 근거 문서
- `docs/architecture/phase-45-final-internal-adoption-validation-release-fit-gap-scope.md`
- `docs/architecture/phase-44-operations-docs-user-admin-guides-adoption-checklist-fit-gap-scope.md`
- `docs/architecture/phase-44-pc-mobile-login-only-entry-pwa-desktop-app-scope.md`
- `docs/architecture/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-scope.md`
- `docs/architecture/phase-42-attendance-leave-hr-branch-operations-adoption-fit-gap-scope.md`
- `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
- `HANDOFF.md`
- `TASKS.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `KNOWN_ISSUES.md`

## 12. 현재 체인
1. Phase 45 기획·fit-gap: `t_e5f0bbb3` — 도담(`gwplanner`) — 진행 중
2. Phase 45 구현: `t_74123511` — 이룸(`gwbuilder`) — 부모 대기
3. Phase 45 리뷰: `t_74a9023c` — 바름(`gwreviewer`) — 부모 대기
4. Phase 45 테스트: `t_56f81ded` — 해봄(`gwtester`) — 부모 대기
5. Phase 45 문서화: `t_ee495517` — 다온(`gwdocs`) — 진행 중
6. Phase 45 GitHub PR/CI/merge/branch cleanup: `t_6dd6a634` — 지킴(`gwops`) — 부모 대기