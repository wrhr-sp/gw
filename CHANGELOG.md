# CHANGELOG

## 2026-06-17

### Changed

- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `KNOWN_ISSUES.md`, `docs/architecture/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-scope.md`, `docs/guides/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-handoff.md` 를 추가·갱신해 현재 활성 문서 체인을 Phase 43 기준으로 올렸다. `/management` 내부관리 허브, `/payroll`·`/payroll/me` preview/self-only 경계, `tax`·`labor`·`legal` scope 차이, `/admin/audit-logs` read-only 컴플라이언스 진입, dedicated compliance route 부재, 실지급·실신고·외부 전문가 연동 승인 게이트를 같은 언어로 다시 고정했다.

## 2026-06-16

### Changed

- `PRD.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`, `docs/guides/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-handoff.md` 를 다시 보강해 Phase 42A 문서화를 최신 체인 상태와 parent 재검증 근거에 맞췄다. PC/모바일 `/login` 단일 입구, 익명 `/messenger`·`/mail`·`/uat` 포함 내부 route/API 차단, `rememberSession` 기본값 교차확인, local preview smoke 결과, 문서화 진행 중 → release gate 대기 체인을 같은 언어로 다시 고정했다.
- `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`, `docs/guides/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-handoff.md` 를 추가하고 `PRD.md`, `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `KNOWN_ISSUES.md` 를 Phase 42A 기준으로 갱신했다. `/login` 단일 입구, 익명 내부 route/API 차단, 자동 로그인 세션 선택, `/offline` 업무 복구 제거, 로그인 후 `/management`·`/admin*`·민감 API guard 유지, 승인 게이트를 같은 언어로 다시 고정했다.
- `docs/architecture/phase-42-attendance-leave-hr-branch-operations-adoption-fit-gap-scope.md`, `docs/guides/phase-42-attendance-leave-hr-branch-operations-adoption-fit-gap-handoff.md` 를 추가하고 `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `KNOWN_ISSUES.md` 를 Phase 42 기준으로 갱신했다. `/attendance`·`/leave` 직원 기본 흐름, `/employees`·`/org` 읽기 중심 인사/조직 조회, `/management` 아래 `/work-items/branch` 지점 운영 레인, 정책 미허용 방식·role boundary·branch scope·외부 연동 승인 게이트를 같은 언어로 다시 고정했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`, `docs/guides/phase-41-boards-notices-documents-approvals-daily-operations-adoption-fit-gap-handoff.md` 를 다시 보강해 Phase 41 현재 체인을 테스트 재검증 완료 → 문서화 → release gate → 최종 통합 보고 순서로 맞췄다. 2026-06-16 parent 재검증 결과(focused web/API/shared 회귀, typecheck, `pnpm check`, Next/Cloudflare build, local admin-host preview smoke 통과)와 redirect/manifest split 근거도 같은 언어로 반영했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `KNOWN_ISSUES.md`, `docs/architecture/phase-41-boards-notices-documents-approvals-daily-operations-adoption-fit-gap-scope.md`, `docs/guides/phase-41-boards-notices-documents-approvals-daily-operations-adoption-fit-gap-handoff.md` 를 추가·갱신해 현재 활성 문서 체인을 Phase 41 기준으로 올렸다. `/dashboard` 기준 협업 기본 흐름, 공지 게시판 대 일반 게시판 책임 분리, 게시글 댓글/읽음/forged 차단, 문서 metadata/read receipt/private space 경계, 전자결재 기안자 lane 대 승인자 lane 대 운영 정책 lane, `/admin/policies`·`/admin/audit-logs` 운영 검토와 남은 승인 게이트를 같은 언어로 다시 고정했다.
- `TASKS.md`, `HANDOFF.md`, `TEST_PLAN.md`, `docs/architecture/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-scope.md`, `docs/guides/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-handoff.md` 를 다시 보강해 현재 Phase 40 문서화 체인(`t_cc4b8957` → `t_a627fd5c` → `t_de5fe53c` → `t_12730723`)과 `/uat` 실행 패키지 입구를 문서에 반영했다. 익명 general host `/uat` 의 `/login` redirect, 로그인 세션 허용, focused Phase 40 guard/middleware 테스트 22개 파일·94개 통과 근거를 같은 문장으로 다시 고정했다.
- `apps/web/app/uat/page.tsx`, `apps/web/app/uat/uat-package-config.ts`, `apps/web/phase40-uat-package.test.tsx` 를 추가하고 `apps/web/dashboard-page-content.tsx`, `apps/web/app/management/page.tsx`, 관련 테스트를 갱신해 Phase 40 내부 도입 리허설용 `/uat` 실행 패키지를 열었다. 이제 live URL/테스트 계정, 역할별 시나리오 카드, 이슈 기록 템플릿, 진행자 스크립트, 참가자용 빠른 시작, final report/approval gate 기준을 화면에서 바로 확인할 수 있다.
- `docs/architecture/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-scope.md`, `docs/guides/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-handoff.md` 를 추가해 직원/승인자/경영업무 담당자/운영자 레인별 UAT 시나리오, blocker/major/minor/copy-doc/approval-needed 분류 기준, 교육자료 초안, 최종 보고 형식을 Phase 40 내부 도입 리허설 패키지 기준 문서로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `KNOWN_ISSUES.md` 를 Phase 40 활성 체인 기준으로 갱신해 현재 카드 체인(`t_36a804c9` → `t_552e86ad` → `t_b655e161`), 추천 확인 순서(`/login` → `/dashboard` → 일반 업무 → `/management` → 민감 모듈 → `/admin*` → `/offline` → guard/test 근거), 역할별 UAT 문맥과 승인 게이트를 같은 언어로 맞췄다.
- `docs/architecture/phase-39-operational-qa-security-audit-permission-regression-fit-gap-scope.md`, `docs/guides/phase-39-operational-qa-security-audit-permission-regression-fit-gap-handoff.md` 를 추가해 일반 host 대 admin host 경계, `/management`·`/admin*`·민감 work item 권한, company+branch scope, foreign/self 차단, forbidden/error/empty/offline 분리, masked audit preview 와 raw 민감정보 비노출, 승인 게이트를 Phase 39 fit-gap 기준 문서로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `KNOWN_ISSUES.md` 를 Phase 39 활성 체인 기준으로 갱신해 현재 카드 체인(`t_f7dbddba` → `t_f77b8265` → `t_e91e3b31` → `t_fee8d493` → `t_87da953e` → `t_e0192dc8`), 추천 확인 순서(`/dashboard` → `/management` → `/admin*` → `/offline` → guard/test 근거), 권한/감사/상태 분리 리스크와 승인 게이트를 같은 언어로 맞췄다.
- `docs/guides/phase-39-operational-qa-security-audit-permission-regression-fit-gap-handoff.md`, `TASKS.md`, `HANDOFF.md`, `TEST_PLAN.md` 를 다시 보강해 2026-06-16 parent 재검증 결과를 문서에 반영했다. focused web/API 회귀, shared/api/web typecheck, `pnpm check`, Next/Cloudflare build, local admin-host preview smoke 재통과와 현재 체인 상태(테스트 완료 → 문서화 진행 → release gate 예정)를 같은 언어로 다시 고정했다.
- `docs/guides/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-handoff.md`, `TASKS.md`, `HANDOFF.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `KNOWN_ISSUES.md` 를 다시 보강해 2026-06-16 parent 재검증 결과를 문서에 반영했다. 일반 사용자/운영자 빠른 사용 가이드, dev/test/UAT 계정 문구, 일반 host·admin host `/offline` 복구 범위, local preview redirect boundary, release-gate 다음 체인(`t_1894a9f3` → `t_d127425a`)을 같은 언어로 다시 고정했다.
- `docs/architecture/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-scope.md`, `docs/guides/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-handoff.md` 를 추가해 홈/메뉴 같은 정보구조, notifications same-origin inbox honesty, offline 가능/불가/재시도 절차, 일반 업무 레인 대 `경영업무`·`/admin*` 운영 레인 분리를 Phase 38 fit-gap 기준 문서로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `KNOWN_ISSUES.md` 를 Phase 38 활성 체인 기준으로 갱신해 현재 카드 체인(`t_53c34c58` → `t_d777ff89` → `t_5191cf30` → `t_2f6683c6`), 추천 확인 순서(`/dashboard` → `/menu` → `/notifications` → `/offline` → 운영 레인), 승인 게이트와 현장 사용성 리스크를 같은 언어로 맞췄다.
- `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`, `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md`, `HANDOFF.md`, `TASKS.md`, `TEST_PLAN.md` 를 다시 보강해 2026-06-16 parent 재검증 결과와 현재 체인(`t_e8e6bea1` → `t_ecfe96a8` → `t_b73a7e86`)을 문서에 반영했다. focused API/Web 회귀, shared/api/web typecheck·build·OpenNext build·root `pnpm check`, local preview smoke 재통과와 8790 포트 충돌 시 8791 대체 smoke 근거를 같은 언어로 다시 고정했다.
- `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`, `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md` 를 추가해 내부 운영 저장흐름·감사 연결의 현재 read model 과 fit-gap 을 새 기준 문서로 고정했다. `/documents` 파일 lifecycle, `/admin/audit-logs` storage preview, `work-items`·`/payroll` 민감자료 approval gate, raw storage 비노출, backup/export/migration 제외 범위를 같은 언어로 정리했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 37 활성 체인 기준으로 갱신해 현재 카드(`t_d6096d1c`)와 child(`t_5e2ebf9c`), 추천 확인 순서(`/dashboard` → `/documents` → `/admin/audit-logs` → `/management` → `/payroll` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal`), 현재 확인 가능한 범위와 남은 제품형 리스크를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 함께 갱신해 Phase 37 문서가 문서 파일 lifecycle, masked audit storage preview, metadata-only/approval gate 경계, backup/export/migration 승인 게이트와 같은 뜻으로 읽히게 맞췄다.
- `docs/architecture/phase-36-admin-settings-company-policy-permission-fit-gap-scope.md`, `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md` 를 추가해 운영자 설정·회사정책·권한관리의 현재 read model 과 fit-gap 을 새 기준 문서로 고정했다. `/dashboard`·`/menu` shortcut, `/org`·`/employees` 일반 조회, `/admin/users`·`/admin/policies`·`/admin/audit-logs` 운영 검토, 회사 설정 4묶음과 승인 게이트를 같은 언어로 정리했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 36 활성 체인 기준으로 갱신해 현재 카드 id(`t_7f614bba`), 추천 확인 순서(`/login` → `/dashboard` → `/menu` → `/employees` → `/org` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/management`), 현재 확인 가능한 범위와 남은 제품형 리스크를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 함께 갱신해 홈 shortcut 의 현재 범위를 회사 공통 고정 + 권한 기반 사용자 전용 항목으로 다시 고정하고, role/permission 카탈로그 조회·일반 조회 guard·운영 diff preview 를 서로 다른 권한 관리 층으로 읽게 맞췄다.
- `docs/architecture/phase-36-admin-settings-company-policy-permission-fit-gap-scope.md`, `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md`, `HANDOFF.md`, `TASKS.md`, `TEST_PLAN.md` 를 다시 보강해 2026-06-16 parent 재검증 결과를 문서에 반영했다. focused web/admin 테스트, `apps/api/test/auth-org.spec.ts`, shared/api/web typecheck, `pnpm check`, Next/Cloudflare build, local preview admin host smoke 근거와 현재 체인(`t_db951f9d` → `t_cd38b241` → `t_d45d361c`)을 같은 언어로 다시 고정했다.
- `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`, `HANDOFF.md`, `TEST_PLAN.md` 를 다시 보강해 2026-06-16 parent 재검증 결과를 문서에 반영했다. Phase 35 수동 UAT 시작점을 일반 host `/dashboard` → `/management` 기준으로 다시 고정하고, focused API/Web 테스트·build·local preview smoke 근거, 기능별 추천 테스트 계정/직접 액션/happy path/forbidden·dev-safe·별도 승인 게이트를 같은 표로 정리했다.
- `apps/api/src/lib/operational-management.ts`, `apps/api/src/app.ts`, `db/postgres/migrations/0003_phase35_payroll_workitems_admin.sql` 를 추가/갱신해 Phase 35 급여·세무·노무·법무·컴플라이언스 metadata 를 PostgreSQL operational 패턴으로 읽어오도록 연결했다. `/api/payroll*` 과 `/api/work-items*` 는 운영 DB 테이블이 있으면 DB 값을 우선 merge 하고, 테이블이 아직 없거나 migration 이 덜 적용된 환경에서는 기존 placeholder/degraded 응답으로 안전하게 fallback 한다.
- `apps/api/test/phase35-operational-management-db.spec.ts`, `apps/api/test/operational-management-fallback.spec.ts` 를 추가해 새 payroll/work item DB merge 경로와 schema drift fallback 경로를 회귀 테스트로 고정했다.
- `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`, `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md` 를 추가해 급여·세무·노무·법무·컴플라이언스 관리자흐름의 현재 실제 구현 상태와 Phase 35 fit-gap 을 새 기준 문서로 고정했다. `/management` 허브, `/payroll`·`/payroll/me` preview/self-only 흐름, `tax`·`labor`·`legal` 공통 work item skeleton, dedicated compliance route 부재와 `/admin/audit-logs` read-only 흐름, 남은 외부 연동/실운영 승인 게이트를 같은 언어로 정리했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 35 활성 체인 기준으로 갱신해 현재 카드 ids(`t_2e1397d4`, `t_ce50b30c`, `t_9a260e35`), 추천 UAT 순서(`/login` → `/dashboard` → `/management` → `/payroll` → `/payroll/me` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → `/admin/audit-logs`), 현재 가능 범위와 남은 제품형 리스크를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 함께 갱신해 Phase 35 문서가 payroll role split, self payslip, tax branch/company scope, labor restricted, legal visibility, compliance 전용 route 부재, `audit.read`/`work_item.audit.read` 경계와 같은 뜻으로 읽히게 맞췄다.
- Phase 34 문서를 현재 코드 기준으로 다시 맞춰 `/notifications` 가 더 이상 "안내형 placeholder 만 있는 탭" 이 아니라 `GET /api/notifications` same-origin inbox/unread count 를 보여 주는 화면이며, 대신 외부 발송/읽음 처리 저장은 아직 승인 게이트·후속 과제라는 점을 반영했다. 함께 `/api/branches` 읽기 요약, `operational-notifications.ts`·`operational-admin.ts` read fallback, `apps/api/test/phase34-degraded-routes.spec.ts` degraded fallback 근거를 Phase 34 scope/handoff 와 루트 문서에 연결했다.
- `docs/architecture/phase-34-hr-branch-notifications-audit-real-usage-scope.md`, `docs/guides/phase-34-hr-branch-notifications-audit-real-usage-handoff.md` 를 추가해 인사·지점·알림·감사의 현재 실제 구현 상태와 Phase 34 fit-gap 을 새 기준 문서로 고정했다. `/employees`·`/org` 일반 조회, `/work-items/branch` branch scope 업무 자리, `/notifications` placeholder honesty, `/admin/audit-logs` read-only 감사 흐름, employees/departments/roles/permissions PostgreSQL read fallback 과 남은 notifications/audit DB 전환 gap 을 같은 언어로 정리했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 34 활성 체인 기준으로 갱신해 현재 카드 ids(`t_031a7ba6`, `t_959f0f18`, `t_c06b17a6`), 추천 UAT 순서(`/login` → `/dashboard` → `/employees` → `/org` → `/work-items/branch` → `/notifications` → `/admin/audit-logs`), 현재 가능 범위와 남은 제품형 리스크를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 함께 갱신해 Phase 34 문서가 employee directory validation, branch manager/company scope 차단, `audit.read` 허용/차단, notifications placeholder honesty, PostgreSQL 전환 상태 분리와 같은 뜻으로 읽히게 맞췄다.
- `docs/architecture/phase-33-attendance-leave-approvals-real-usage-scope.md`, `docs/guides/phase-33-attendance-leave-approvals-real-usage-handoff.md`, `HANDOFF.md` 를 다시 보강해 2026-06-16 parent 재검증 결과를 문서에 반영했다. 이제 비로그인 307 보호, `admin / 1234` 로그인 후 핵심 Phase 33 route/API 200 근거, 사용자/승인자/관리자 테스트 가이드, 공개 preview URL 기준 시작점을 같은 언어로 바로 따라갈 수 있다.
- `docs/architecture/phase-33-attendance-leave-approvals-real-usage-scope.md`, `docs/guides/phase-33-attendance-leave-approvals-real-usage-handoff.md` 를 추가해 근태·휴가·전자결재의 현재 실제 구현 상태와 Phase 33 fit-gap 을 새 기준 문서로 고정했다. `/attendance`·`/leave`·`/approvals` 현재 route, `apps/api/test/auth-org.spec.ts` 기준 권한/회사 scope/self-approval 차단, 정책 미허용 대 권한 부족 대 placeholder 제한 4축, PostgreSQL 전환 선행 과제와 운영 승인 게이트를 같은 언어로 정리했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 33 활성 체인 기준으로 갱신해 현재 카드 ids(`t_a498e76b`, `t_32c88243`, `t_268c7c7e`), 추천 UAT 순서(`/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/admin/policies`), 현재 가능 범위와 남은 제품형 리스크를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 함께 갱신해 Phase 33 문서가 근태·휴가·전자결재의 route/API/test 근거와 같은 뜻으로 읽히게 맞췄다. 특히 정책 미허용/권한 부족/회사 scope 차단/placeholder 제한 4축, self-approval 금지, PostgreSQL 전환 전후 완료 기준 분리를 루트 문서에도 반영했다.
- `scripts/gw-worker-recovery-watch.sh`, `scripts/fixtures/gw-worker-recovery-final-report-next-phase.json`, `scripts/README.md`, `TEST_PLAN.md` 를 보강해 singde 최종 통합 보고가 done 된 뒤 다음 Phase 기획/DB 전환 child 카드가 scheduled 로 남아 있으면 read-only 링크 확인 후 자동 unblock+dispatch 하도록 했고, 같은 흐름을 fixture dry-run 으로 재현하는 운영 검증 기준도 추가했다.
- `docs/architecture/phase-32-boards-notices-comments-documents-real-usage-scope.md`, `docs/guides/phase-32-boards-notices-comments-documents-real-usage-handoff.md` 를 현재 구현 기준으로 다시 맞췄다. `/boards/board_general` 게시글 preview 생성·guard 확인, `/posts/board_post_board_general_employee_employee` 댓글 preview 생성·읽음 확인 등록·forged 차단 확인, `/documents` metadata preview 생성·문서 읽음 확인·private/missing space 차단 확인처럼 대장이 지금 직접 눌러볼 수 있는 액션을 문서에 반영했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 최신 Kanban 체인 기준으로 갱신해 stale blocker 정리 카드(`t_c10fc6ce`, `t_ff305819`) 이후 현재 문서 카드 `t_d43e9ca5` → GitHub/CI/merge 카드 `t_854aaa6c` → 최종 통합 보고 `t_4faa7030` 순서와 남은 richer UX/승인 게이트를 같은 언어로 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 함께 갱신해 현재 협업 확인 예시 route 를 `/posts/board_post_board_general_employee_employee` 로 통일하고, preview 생성 결과를 production 운영 데이터처럼 과장하지 말아야 한다는 점과 문서함 차단 probe/읽음 확인 액션을 현재 검증 기준에 맞게 반영했다.

## 2026-06-15

### Changed

- `docs/architecture/phase-32-boards-notices-comments-documents-real-usage-scope.md`, `docs/guides/phase-32-boards-notices-comments-documents-real-usage-handoff.md` 를 추가해 게시판·공지·댓글·문서함의 현재 실제 구현 상태와 Phase 32 fit-gap 을 새 기준 문서로 고정했다. `/boards`·`/boards/[boardId]`·`/posts/[postId]`·`/documents` 현재 route, `apps/api/test/auth-org.spec.ts` 기준 general 게시글 작성/댓글/read receipt 허용, notice-only/private space/forged 접근 차단, raw storage 비노출 원칙, PostgreSQL/R2 metadata 전환 선행 과제를 같은 언어로 정리했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 32 활성 체인 기준으로 갱신해 현재 카드 ids(`t_bf659803`, `t_eb7c7397`, `t_1a0cb6ed`, `t_60824a6c`), 추천 UAT 순서(`/login` → `/dashboard` → `/boards` → `/boards/board_notice` → `/boards/board_general` → `/posts/board_post_board_general_employee_employee` → `/documents` → `/admin/policies`), 협업 묶음의 현재 가능 범위와 남은 제품형 리스크를 한 번에 따라가게 정리했다.

- `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`, `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`, `HANDOFF.md`, `TASKS.md`, `KNOWN_ISSUES.md` 를 다시 보강해 Phase 31 UAT 문서를 더 바로 눌러볼 수 있는 순서로 정리했다. 홈 바로가기의 고정/커스텀 분리와 빈 상태 의미, `/login` → `/dashboard` → `/management` → `/admin/users` → 일반 업무 → `/admin/audit-logs` 추천 클릭 순서, 다음 패스 고도화 항목을 같은 언어로 맞췄다.
- `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`, `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 다시 보강해 Phase 31 문서를 실제 코드 스냅샷 기준으로 맞췄다. `/login`·`/dashboard`·`/management`·`/admin/users` 현재 화면, `/admin/users` preview/action 구조, `/dashboard` skeleton/dev-safe 문구 잔여, 계정관리 실저장 부재를 같은 언어로 정리했다.
- `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`, `docs/guides/phase-31-home-auth-management-real-usage-handoff.md` 를 보강해 실사용 전환 1차 문서를 "지금 바로 눌러볼 수 있는 입구 / 아직 skeleton 잔여 / 별도 승인" 기준으로 다시 정리했다. 특히 `admin / 1234` dev-safe UAT 계정 원칙, `/login`·`/dashboard`·`/management`·`/admin/users` 중심 UAT 순서, fit-gap 표, 일반 직원 대 관리자 forbidden 경계를 같은 말로 고정했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 함께 갱신해 Phase 31 기준 루트 문서가 parent 테스트 근거와 어긋나지 않게 맞췄다. 익명 `/api/me` 401, 관리자 `/management` 200, 일반 직원 `/management` 307 `/forbidden`, 관리자 `/api/admin/users` 200, 일반 직원 `/api/admin/users` 403 같은 현재 검증 결과와 `경영업무` 허브/계정관리/dev-safe 승인 게이트 설명을 같은 뜻으로 반영했다.

- `docs/architecture/phase-29-legal-management-pass-1-scope.md`, `docs/guides/phase-29-legal-management-pass-1-handoff.md` 를 추가해 Phase 25 공통 업무 엔진 위에 계약 검토 요청·계약 갱신일·분쟁/클레임·보험/사고 후속 skeleton 을 어떻게 얹을지, legal category/intake metadata/visibility/승인 게이트를 쉬운 한국어로 고정했다.
- `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md` 를 다시 맞춰 Phase 29 문서가 현재 구현 상태와 어긋나지 않게 정리했다. 특히 `work_item_legal_contract_review`·`work_item_legal_contract_renewal`·`work_item_legal_dispute_intake` placeholder 3건, 실제 `legalContext` 필드, `/management`·`/work-items/legal`·`/api/work-items?module=legal`·`/api/work-items/:id/reviews` 진입점, 본사 법무/운영 담당 대 지점 관리자 visibility, 계약 원문/외부 자문 승인 게이트를 같은 말로 반영했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 29 법무 관리 1차 활성 체인 기준으로 갱신해 현재 카드 ids, 직전 Phase 28 세무와의 경계, 법무 계약/갱신/분쟁 후속 목표, 남은 승인 게이트를 한 번에 따라가게 정리했다.

- `docs/architecture/phase-28-tax-management-pass-1-scope.md`, `docs/guides/phase-28-tax-management-pass-1-handoff.md` 를 추가해 Phase 25 공통 업무 엔진 위에 지점별 세무 자료 요청·증빙 제출·월말 마감·검토·세무사 전달용 패키지 준비 skeleton 을 어떻게 얹을지, tax category/filing metadata/visibility/승인 게이트를 쉬운 한국어로 고정했다.
- `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md` 를 다시 맞춰 Phase 28 문서가 실제 구현 상태와 어긋나지 않게 정리했다. 특히 `work_item_tax_month_end_evidence` branch scope 카드와 `work_item_tax_vat_package_preparation` company scope 카드, 실제 `taxContext`/`packagePreparation`/`visibility` 필드, 감사 audit log 경계를 문서에 같은 말로 반영했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 28 세무 관리 1차 활성 체인 기준으로 갱신해 현재 카드 ids, 직전 Phase 28A 급여와의 경계, 본사 세무 담당/지점 관리자/감사 역할 차이, 남은 승인 게이트를 한 번에 따라가게 정리했다.

- `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 Phase 28A 급여 기준으로 다시 맞춰, 급여가 labor 하위가 아니라 독립 `payroll` 모듈로 읽히게 정리했다.
- 이번 정리에는 지원 급여 유형(`monthly`/`hourly`/`daily`/`annual`/`inclusive`), 급여 기간 상태(`draft`/`collecting`/`reviewing`/`confirmed`/`closed`), line item 산정 근거(`source`/`quantity`/`unitAmount`/`premiumRate`/`amount`/`note`), 지점 관리자 대 직원 self-only 경계, 포괄임금제 검토 경고, 주민등록번호/계좌번호/실지급/외부 신고 승인 게이트를 문서 전체에 같은 말로 반영한 내용이 포함된다.
- `docs/architecture/phase-28a-payroll-foundation-payslip-pass-1-scope.md`, `docs/guides/phase-28a-payroll-foundation-payslip-pass-1-handoff.md` 를 보강해 Phase 28A 에서 여는 것/아직 안 여는 것, 지점 제출 → 본사 검토 → 직원 공개 흐름, self-only payslip 경계, 후속 구현자가 먼저 볼 파일과 검증 순서를 더 분명히 남겼다.

## 2026-06-13

### Changed

- `TASKS.md`, `HANDOFF.md`, `DATA_MODEL.md`, `API.md` 를 다시 맞춰 Phase 27 체인이 아직 초안 단계처럼 읽히는 오래된 문장을 걷어내고, 실제 카드 진행 상태와 labor placeholder 구현 상태가 바로 보이게 정리했다.
- 특히 EMPLOYEE self-scope labor placeholder `work_item_labor_leave_balance_adjustment` 가 이제 fixture/API/test 에 연결돼 있다는 점, `laborContext` 가 shared contract/API 에 실제로 올라와 있다는 점, 다음 운영 카드가 `t_a7119a71` 로 이어진다는 점을 루트 문서에서 바로 확인할 수 있게 했다.
- `apps/api/src/app.ts`, `apps/api/test/work-items.spec.ts` 를 갱신해 labor 모듈에 일반 직원 self-scope placeholder `work_item_labor_leave_balance_adjustment` 를 추가했다. 이제 EMPLOYEE 도 `/api/work-items?module=labor` 와 상세 API에서 자기 연차 정정 요청/자료 제출 상태를 1건 이상 볼 수 있고, MANAGER 는 같은 카드를 계속 403 으로 받도록 목록·상세 권한 테스트를 함께 보강했다.
- `CHANGELOG.md`, `HANDOFF.md` 를 같이 갱신해 이번 선택이 문서 약속(일반 직원 self-scope labor)과 실제 fixture/API/test 를 다시 맞추기 위한 수정임을 남겼다.
- `docs/architecture/phase-27-labor-management-pass-1-scope.md` 와 `docs/guides/phase-27-labor-management-pass-1-handoff.md` 를 추가해 Phase 25 공통 업무 엔진과 Phase 26 HR lifecycle 기준 위에 근로계약·연차/수당·고충/징계/사고·퇴사 관련 노무 이슈 skeleton 을 어떻게 얹을지, 공통 상태 대 labor intake 보조 상태 분리, 본사 노무 담당/HR/지점 관리자/일반 직원 visibility, metadata-only evidence 원칙, 외부 노무/법무/급여 연동 및 실민감 기록 승인 게이트를 쉬운 한국어로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 27 활성 체인 기준으로 갱신해 현재 카드 ids, 노무 관리 목표, 직전 Phase 26 HR 체인과의 연결점, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 다시 맞춰 Phase 26 문서가 이제 "초안만 있음"이 아니라 실제 placeholder contract/API/Web/test 근거 위에서 읽히도록 정리했다. `/work-items` → `/work-items/hr` → `/api/work-items?module=hr` 빠른 확인 순서와 grievance restricted 경계 테스트 근거를 함께 적어, 대장이 문서와 코드 확인 포인트를 바로 이어 볼 수 있게 했다.
- `docs/architecture/phase-26-hr-meeting-management-pass-1-scope.md` 와 `docs/guides/phase-26-hr-meeting-management-pass-1-handoff.md` 를 추가해 Phase 25 공통 업무 엔진 위에 직원 lifecycle 과 HR 미팅/면담/교육/온보딩 skeleton을 어떻게 얹을지, 공통 상태 대 meeting 보조 상태 분리, 본사 HR/지점 관리자/일반 직원 visibility, metadata-only 메모 원칙, 외부 캘린더/실민감 기록 승인 게이트를 쉬운 한국어로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 26 활성 체인 기준으로 갱신해 현재 카드 ids, HR·미팅 관리 목표, 직전 Phase 25 공통 엔진과의 연결점, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `API.md`, `DATA_MODEL.md`, `TEST_PLAN.md`, `HANDOFF.md` 를 다시 맞춰 Phase 25 공통 업무 엔진이 이미 `packages/shared/src/contracts.ts`, `apps/api/src/app.ts`, `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts`, `apps/web/work-items*.test.tsx` 근거를 가진 placeholder 구현/검증 단계라는 점을 분명히 적었다. 문서 초안만 있고 API/테스트가 없다는 오래된 문장을 걷어내고, 실제 guardrail(역할/지점 scope, 민감 첨부 metadata-only, `work_item.audit.read` 없는 audit 비노출) 기준을 쉬운 말로 다시 고정했다.
- `packages/shared/src/contracts.ts`, `packages/shared/src/admin-access.ts`, `apps/api/src/app.ts` 를 갱신해 Phase 25 공통 업무 엔진용 `workItems` route 집합, work item/document/attachment/review/deadline/audit schema, 역할별 권한 매트릭스, 회사/지점/역할 scope 기반 placeholder API 응답을 실제 코드로 추가했다.
- `apps/web/app/work-items/page.tsx`, `apps/web/app/work-items/hr/page.tsx`, `apps/web/app/work-items/tax/page.tsx`, `apps/web/app/work-items/labor/page.tsx`, `apps/web/app/work-items/legal/page.tsx`, `apps/web/app/work-items/branch/page.tsx`, `apps/web/app/work-items/_components/work-items-pages.tsx`, `apps/web/app/work-items/work-items-config.ts`, `apps/web/app/mobile-pwa-config.ts`, `apps/web/dashboard-page-content.tsx`, `apps/web/app/dashboard/dashboard-config.ts`, `apps/web/app/menu/page.tsx` 를 추가/갱신해 모바일/웹에서 공통 업무 허브와 모듈별 UI 자리를 실제 route 로 확인할 수 있게 했다.
- `apps/web/mobile-pwa.test.ts` 기대값을 Phase 25 공통 업무 허브 노출에 맞게 갱신했고, `pnpm typecheck`, `pnpm test`, `pnpm build` 로 shared/api/web/mobile 전체 검증을 다시 통과시켰다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`, `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 Phase 25 공통 업무·문서·마감·권한 엔진 1차 기준으로 갱신해, Phase 24 파일럿 준비 흐름 위에 HR·세무·노무·법무·지점 운영 업무가 함께 타는 공통 work item / 문서 / 첨부 / 검토 / 마감 / 권한 skeleton 을 먼저 고정하는 방향을 같은 언어로 맞췄다.
- `docs/architecture/phase-25-common-work-doc-access-engine-pass-1-scope.md` 와 `docs/guides/phase-25-common-work-doc-access-engine-pass-1-handoff.md` 를 추가해 공통 상태값, 회사+지점+역할+capability 접근 기준, 모바일/PC 메뉴 자리, 민감 문서/실처리 승인 게이트, builder 후속 구현 최소 범위를 쉬운 한국어로 정리했다.
- `SPEC.md`, `DATA_MODEL.md`, `API.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`, `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`, `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md` 를 다시 보강해 Phase 24 파일럿 문서에 모바일 `홈` 고정 메뉴 + 개인 커스터마이징 원칙, `메뉴`/PC sidebar 동일 registry 방향, 호텔 위탁경영사 기준 `지점/호텔 코드` 구조, `지점 배정 필요` 안내, 본사/지점 관리자/일반 근무자 경계를 쉬운 한국어로 추가했다.
- 이번 보강은 아직 구현 완료 보고가 아니라 문서 초안 고정 단계로 남기며, 사용자별 `홈` 영구 저장·실제 지점/호텔 master 데이터·외부 PMS/알림 연동은 계속 승인 게이트/후속 구현 범위로 분리했다.
- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md` 와 `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md` 를 추가해 제한된 부서/사용자 파일럿 대상, 직원 체험 레인 + 운영자 동행 레인, live/API/PWA/mobile 선행 체크리스트, 사용자 안내/운영자 매뉴얼/장애 대응/피드백 수집, 승인 게이트를 쉬운 한국어로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 24 활성 체인 기준으로 갱신해 현재 카드 ids, 파일럿 준비 목표, baseline 근거 대 재검증 예정 항목 구분, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 Phase 24 기준으로 보강해 작은 실제 회사 파일럿을 어떻게 시작할지, 어떤 route 순서와 선행 체크리스트를 따라갈지, 무엇이 아직 승인 필요인지 루트 검증 문서에서 바로 읽히게 맞췄다.
- `apps/web/app/mobile-pwa-config.ts`, `apps/web/app/_components/mobile-app-shell.tsx`, `apps/web/app/page.tsx` 를 갱신해 모바일 하단 탭 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개, 모바일 전체 메뉴 화면, PC collapsible sidebar, 관리자 메뉴 분리를 같은 정보구조로 맞췄다.
- `apps/web/app/menu/page.tsx`, `apps/web/app/messenger/page.tsx`, `apps/web/app/mail/page.tsx`, `apps/web/app/notifications/page.tsx` 를 추가해 메신저/메일/알림 placeholder honesty 와 파일럿 메뉴 구조를 실제 route 로 확인할 수 있게 했다.
- `apps/web/dashboard-page-content.tsx` 를 새로 만들고 `apps/web/app/dashboard/page.tsx` 를 쿠키 기반 wrapper 로 바꿔, 실제 세션 roleCode 에 따라 `/admin` 또는 `/admin/audit-logs` 운영 CTA 가 보이도록 정리했다. 동시에 대시보드에 "관리자 운영 검토 레인" 섹션을 추가해 `/dashboard` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서를 화면에서 바로 읽히게 했다.
- `apps/web/admin-page-content.tsx`, `apps/web/app/admin/users/page.tsx`, `apps/web/app/admin/policies/page.tsx`, `apps/web/app/admin/audit-logs/page.tsx` 의 eyebrow/copy 를 Phase 23 기준으로 올리고, `/employees` 대 `/admin/users`, `/boards`·`/documents` 대 `/admin/policies`, 감사 전용 진입 의미를 분리 설명하는 운영 경계 섹션을 각각 추가했다.
- `apps/web/dashboard-boundary.test.tsx`, `apps/web/admin-console-pass1.test.tsx` 를 함께 갱신해 실제 admin CTA 노출, 운영 검토 레인, 일반 조회 대 운영 검토 경계, 감사 전용 진입 의미가 회귀 테스트로 고정되게 했다.
- `docs/architecture/phase-23-admin-operations-console-real-usage-pass-1-scope.md` 와 `docs/guides/phase-23-admin-operations-console-real-usage-pass-1-handoff.md` 를 추가해 `/dashboard` 이후 관리자 운영 CTA, `/admin` 허브, `/admin/users`·`/admin/policies`·`/admin/audit-logs` 검토 흐름, 파일·문서·공지 권한 경계, high-risk permission, 승인 게이트를 쉬운 한국어로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 23 활성 체인 기준으로 갱신해 현재 카드 ids, 운영 콘솔 기준 순서, 일반 조회 화면 대 운영 검토 화면 경계, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 한 번 더 다듬어 Phase 23 문서에서 대장이 바로 볼 빠른 route 확인 순서(`/dashboard` 관리자 CTA → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs`)와 최근 재검증 명령 묶음이 같은 뜻으로 읽히게 맞췄다.
- Phase 22 문서를 현재 `/dashboard` 구현 기준으로 다시 맞춰 상단 액션 순서를 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 로, 이후 `/org`·`/employees` 를 마무리 조회 흐름으로 읽는 설명을 `SPEC.md`, `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md`, `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 에 반영했다.
- `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md` 와 `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md` 를 추가해 로그인 이후 대시보드·출퇴근·휴가·결재·공지/문서·내 정보·조직 확인 흐름을 실제 하루 업무 순서처럼 다시 읽는 기준, 상태 안내 4축, mobile/Web 계약 비교, `/admin/*` 분리, 승인 게이트를 쉬운 한국어로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 22 활성 체인 기준으로 갱신해 현재 카드 ids, 실제 업무 흐름 목표, 기준 route 순서, mobile 비교 포인트, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 Phase 22 기준으로 보강해 로그인 후 실제 하루 업무 흐름 판정 질문, 상태 안내 4축의 쉬운 사용자 언어, dashboard 와 실제 업무 화면 순서 정렬, `/admin/*` 분리 기준을 루트 검증 문서에 반영했다.
- `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md` 와 `docs/guides/phase-21-real-company-settings-model-pass-1-handoff.md` 를 추가해 회사 기본 설정/조직/직원/권한/근태·휴가 정책을 실제 회사 설정 묶음처럼 다시 읽는 기준, 직원용 화면 대 관리자용 화면 경계, 출퇴근 정책 우선순위 방향, 승인 게이트를 쉬운 한국어로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 21 활성 체인 기준으로 갱신해 현재 카드 ids, 실제 회사 설정 모델 목표, 회사 설정 4묶음, 직원 화면 대 관리자 화면 경계, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 Phase 21 기준으로 보강해 회사 기본 설정/조직/직원/권한/정책 연결 질문, 직원 UI/API 가 현재 허용된 정책만 보이는지 확인하는 기준, GPS·실태그·production data·external HR 승인 게이트 분리를 루트 검증 문서에 반영했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 다시 보강해 Phase 21 문서가 `/login` → `/dashboard` → `/org`·`/employees` → `/attendance`·`/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/admin/users`·`/admin/policies`·`/admin/audit-logs` → `/admin` 순서의 쉬운 확인 포인트와 "지금 확인 가능 / 아직 skeleton / 승인 필요" 3분류를 같은 언어로 보여 주도록 맞췄다.
- `docs/architecture/phase-20-pre-operations-alignment-pass-1-scope.md` 와 `docs/guides/phase-20-pre-operations-alignment-pass-1-handoff.md` 를 추가해 preview/skeleton 결과물을 실제 운영 전 점검표 관점으로 다시 읽는 기준, 되는 것/아직 skeleton/승인 필요 3분류, live/PWA/API/mobile 정렬, 관리자/일반 사용자 경계, 승인 목록을 쉬운 한국어로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 20 활성 체인 기준으로 갱신해 현재 카드 ids, 운영 전 정리 목표, 핵심 질문 5가지, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 Phase 20 기준으로 보강해 mobile 중심 내부 시범 운영 문장을 전체 운영 readiness 문장으로 확장하고, 되는 것/아직 안 되는 것/승인 필요 분류와 live/PWA/API/mobile 결론 정렬 기준을 루트 검증 문서에 반영했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 한 번 더 다듬어 Phase 19 내부 시범 운영 readiness 를 대장이 바로 판정할 4가지 질문(선행 검증 분리, 설치→session clear 흐름, Android/iOS 준비물 분리, 남은 승인 게이트 명시)으로 고정했다.
- Phase 16 회고용 문서도 실제 구현/리뷰/테스트 결과 기준으로 다시 정리해, `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md`, `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 에 "되는 것 / 아직 안 되는 것 / 승인 필요 / live fetch gate 대체 근거" 를 같은 언어로 반영했다.
- `docs/architecture/phase-19-native-mobile-internal-pilot-draft-scope.md` 와 `docs/guides/phase-19-native-mobile-internal-pilot-draft-handoff.md` 를 추가해 내부 시범 운영 전에 필요한 Android/iOS 준비물, live/PWA/API 선행 검증과 mobile 전용 smoke 기준 분리, 비용/계정/권한 승인 checklist, 남은 배포 게이트를 쉬운 한국어로 고정했다.
- `TASKS.md`, `ROADMAP.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 19 활성 체인 기준으로 갱신해 현재 카드 ids, 내부 시범 운영 핵심 범위, 설치→로그인→핵심 업무→세션 정리 순서, App Store/Play Console/TestFlight/EAS 승인 게이트를 한 번에 따라가게 정리했다.
- `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md` 와 `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md` 를 추가해 Phase 17 모바일 skeleton 이후 로그인→대시보드→출퇴근/휴가/결재함→공지·문서→내 정보 흐름, offline/error/empty/forbidden 상태 4축, PWA 대 네이티브 차이, 승인 게이트를 쉬운 한국어로 다시 고정했다.
- `packages/shared/src/mobile-contracts.ts` 에 Phase 18용 workflow/state guidance, PWA 대 네이티브 차이 메모, 화면 lookup helper 를 추가했고 `apps/mobile/src/workflow.ts` 를 새로 만들어 화면별 상태 설명과 일반 사용자/승인자 첫 액션 분기를 실제 코드 helper 로 연결했다.
- `TASKS.md`, `ROADMAP.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 18 활성 체인 기준으로 갱신해 현재 카드 ids, 포함/제외 범위, 구현자 확인 순서, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 에 Phase 18 모바일 핵심 업무 연결 기준을 반영해 7개 우선 화면, 상태 분류 4축, mobile typecheck/contract 검증 포인트, 문서 일관성 점검 기준을 최신 handoff 와 같은 뜻으로 맞췄다.
- Phase 18 문서를 한 번 더 다듬어 `apps/mobile/src/workflow.ts` 의 일반 사용자/승인자 첫 액션 분기와 내 정보 화면의 `me` 중심 + `auth.logout`/session clear 경계를 쉬운 확인 포인트로 다시 고정했다.

- `apps/mobile` skeleton(`app.config.ts`, `src/shell.ts`, `src/base-url.ts`, `src/session-bridge.ts`, `src/screens.ts`, `README.md`)을 추가하고, `packages/shared/src/mobile-contracts.ts` 를 신설해 Web/PWA와 네이티브 앱이 공유할 route mapping, auth/session guardrail, same-origin 번역용 base URL policy, 승인 게이트 기준을 코드로 고정했다.
- `packages/shared/test/contracts.spec.ts` 에 Phase 17 모바일 전환 계약 회귀 테스트를 추가했고, 루트 `pnpm check` 가 `@gw/mobile` typecheck 를 함께 수행하도록 `apps/mobile/package.json` 을 보강했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 에 현재 `apps/mobile` skeleton 위치와 검증 포인트를 추가해 다음 구현자가 base URL resolver / secure storage bridge / 승인 게이트를 바로 확인할 수 있게 정리했다.
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md` 와 `docs/guides/phase-17-native-mobile-transition-prep-handoff.md` 를 추가해 Phase 16 PWA 파일럿 이후 Expo/React Native 네이티브 앱 전환을 어떻게 안전하게 시작할지 문서화했다. 핵심은 `apps/mobile` 기본 배치, `packages/shared` 재사용 경계, 모바일 1차 화면 7개, same-origin 철학의 mobile base URL resolver 번역, secure storage 전제 auth/session 기준, 앱스토어/실기기/유료 빌드 승인 게이트 분리다.
- `TASKS.md`, `ROADMAP.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 17 네이티브 모바일앱 전환 준비 기준으로 갱신해 현재 활성 체인, 모바일 범위/제외 범위, route mapping, dev-safe 검증 기준, 별도 승인 필요 항목을 다시 맞췄다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 추가로 보강해 Phase 17 문서화 카드에서도 `apps/mobile` 7개 핵심 화면, `/boards`·`/documents` 협업 묶음, base URL resolver, secure storage bridge, App Store/Play Console/TestFlight/EAS 승인 게이트, `@gw/mobile` typecheck 근거를 루트 문서와 쉬운 확인 포인트 기준으로 다시 맞췄다.

## 2026-06-12

### Changed

- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 Phase 16 대시보드 현재 UI 기준으로 다시 맞춰 `/dashboard` 상단 액션 순서(`/attendance` → `/approvals` → `/boards` → `/documents` → `/employees`)와 Phase 16 eyebrow 문구를 같은 뜻으로 정리했다.
- 같은 Phase 16 루트 문서에 `/boards/board_notice`, `/boards/board_general`, 예시 게시글 상세, 전사 문서함 대 인사 전용 문서함 같은 실제 placeholder route 예시를 추가해 live URL 파일럿 확인 순서와 notice-only/R2 metadata 경계를 더 쉽게 따라가게 정리했다.
- `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md` 와 `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md` 를 추가해 게시판/공지/문서함/R2 skeleton, 전체 smoke 기준, live URL 파일럿 확인 포인트, 남은 승인 게이트를 한 번에 설명하는 Phase 16 범위와 handoff 를 문서화했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안 기준으로 갱신해 현재 활성 체인, 핵심 업무 route + 협업 route + 관리자 route 묶음, 파일럿 검토 순서, restricted 승인 게이트를 다시 맞췄다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 보강해 `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 협업 흐름, R2 binding-aware/dev-safe 경계, notice-only/private space/raw storage 비노출 guardrail, live smoke 대체 근거 기준을 루트 문서에 반영했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 현재 Phase 15 화면/API 근거에 다시 맞춰 `/leave` 4축 운영 메모, `/admin/users` 와 일반 조회/결재 책임 분리, `/admin/audit-logs` read-only 경계, 대장이 preview/live URL 에서 바로 볼 쉬운 확인 순서를 더 분명히 적었다.
- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md` 와 `docs/guides/phase-15-operational-policy-audit-bridge-pass-1-handoff.md` 를 추가해 관리자 정책/권한/감사 skeleton 이 `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees` 및 관련 API 허용 기준에 왜 그렇게 반영되는지 설명하는 Phase 15 운영 연결 1차 범위와 handoff 를 문서화했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 15 운영 데이터·정책·감사 로그 연결 1차 기준으로 갱신해 현재 활성 체인, 핵심 운영 연결 포인트, `/leave` 정책 보강 대상, blocked/empty/error 4축(권한/회사 scope/정책 미허용/placeholder 제한) 설명 기준을 다시 맞췄다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 보강해 `/attendance` 와 `/leave` 의 정책 source/미허용 이유 설명, 운영 연결형 검증 route/API, blocked/empty/error 분류 체크를 문서 기준으로 추가했다.
- `docs/architecture/phase-14-real-usable-mvp-pass-1-scope.md` 와 `docs/guides/phase-14-real-usable-mvp-pass-1-handoff.md` 를 추가해 홈/로그인/대시보드/일반 업무/관리자 skeleton 을 한 번에 눌러 볼 수 있는 실사용 MVP 통합 1차 범위, 역할별 진입 흐름, smoke 기준, guardrail 을 문서화했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 14 실사용 MVP 통합 1차 기준으로 갱신해 현재 활성 체인, 핵심 route 묶음(`/`, `/login`, `/dashboard`, `/org`, `/employees`, `/attendance`, `/approvals`, `/admin/*`), 일반 업무/관리자 경계, 후속 handoff 참조 문서를 다시 맞췄다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`, `docs/workflow/groupware-kanban-automation.md`, `scripts/README.md` 를 다시 보강해 역할별 기본 책임 매트릭스, card-scoped 예외 권한 원칙, blocked 분류별 다음 액션, fixture/dry-run/service journal/board state/PR gate를 묶어 보는 검증자동화 체크 기준을 더 분명히 적었다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 Phase 14 현재 UI 기준으로 다시 맞춰 홈/로그인/대시보드의 역할별 흐름, 핵심 smoke route(`/`, `/login`, `/dashboard`, `/attendance`, `/approvals`, `/org`, `/employees`, `/admin/*`), `/employees` 대 `/admin/users`, `/attendance` 대 `/admin/policies` 경계, 대장이 preview/live URL 에서 따라 볼 쉬운 확인 순서를 한 번에 정리했다.
- `scripts/gw-preventive-handoff-watch.sh`, `scripts/gw-worker-recovery-watch.sh`, `scripts/README.md`, `HANDOFF.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 보강해 singde 최종보고 카드에 direct delivery 전 `사용자 보고 필요`, direct delivery 후 `사용자 보고 완료` + `[singde-direct-delivery]` 표식을 남기도록 가이드했고, 최근 완료된 최종보고 카드에 이 표식이 없으면 watcher가 재확인 코멘트를 남기도록 했다.
- `docs/architecture/rolebot-authority-decision-loop-hardening-scope.md` 와 `docs/guides/rolebot-authority-decision-loop-hardening-handoff.md` 를 추가해 역할봇 권한 확대 대신 싱드/Watcher 판단루프 보강을 우선하는 운영 설계, blocked 재판단 순서, Telegram 보고 분리 기준, 검증자동화 handoff 를 문서화했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 현재 역할봇 권한·판단루프·보고정책·검증자동화 고도화 체인 기준으로 갱신했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 에 blocked 재판단 순서, `already-handled` 재확인 기준, Telegram 보고 4분류, fixture/dry-run/service sweep/board state/PR-CI-main gate 검증 축을 반영했다.
- 역할봇 판단형 Telegram 보고정책 문서를 더 보강해 blocked 5분류 설명, 쉬운 한국어 최종 보고 예시, 카드 댓글 완료와 사용자 직접 보고 완료 분리, 같은 카드·같은 이유·같은 근거 중복 보고 방지 기준을 `docs/guides/rolebot-authority-decision-loop-hardening-handoff.md`, `docs/architecture/rolebot-authority-decision-loop-hardening-scope.md`, `HANDOFF.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `scripts/README.md`, `KNOWN_ISSUES.md` 에 반영했다.
- `docs/architecture/scheduled-recovery-card-cleanup-scope.md` 와 `docs/guides/scheduled-recovery-card-cleanup-handoff.md` 를 추가해 예전 web build flaky / recovery loop 관련 scheduled 카드들을 최신 `main` 기준으로 재분류하는 범위, 제외 범위, 안전한 정리 순서를 문서화했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 현재 활성 체인이 "이전 scheduled 복구 카드 정리" 단계임이 드러나도록 갱신했다.
- `TEST_PLAN.md`, `QA_CHECKLIST.md` 에 scheduled/stale/superseded 카드 정리 시 확인해야 할 근거와 restricted 분리 체크를 추가했다.
- `docs/guides/scheduled-recovery-card-cleanup-report-2026-06-12.md` 를 추가해 예전 web build/attendance recovery loop 관련 scheduled 카드 14장을 최신 완료 카드와 현재 검증 결과 기준으로 다시 분류했고, 유지 대상 scheduled 카드는 없다는 판단 근거를 표로 정리했다.
- `docs/architecture/admin-pwa-install-offline-quality-scope.md` 와 `docs/guides/admin-pwa-install-offline-quality-handoff.md` 를 추가해 관리자 PWA 설치 UX, 오프라인 안내, manifest 세부값, icons/maskable, manual/Lighthouse smoke 기준을 한 세트로 문서화했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`, `ROADMAP.md` 를 현재 관리자 PWA 품질 개선 체인 기준으로 갱신했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 에 관리자 설치 copy, 오프라인 honesty, manifest 필수값, icons/maskable, local preview/manual install/Lighthouse 체크 기준을 반영했다.
- `docs/architecture/admin-role-permission-model-pass-1-scope.md` 와 `docs/guides/admin-role-permission-model-pass-1-handoff.md` 를 추가해 관리자 권한/역할 데이터 모델 1차 범위, 접근 행렬, 구현 기준, 다음 단계 handoff 를 문서화했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 현재 관리자 권한/역할 데이터 모델 1차 체인 기준으로 갱신했다.
- `SPEC.md`, `DATA_MODEL.md` 에 관리자 접근 skeleton 과 `audit.read` 중심 감사 로그 접근 기준을 반영했다.
- `TEST_PLAN.md`, `QA_CHECKLIST.md` 에 `/admin` 계열 접근 행렬, `HR_ADMIN`/`AUDITOR` 경계, dashboard/admin hub/API guard 정합성 검증 항목을 추가했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 현재 Admin host 운영 설계 + preview 검증 확장 체인 기준으로 다시 맞췄다.
- `apps/web/public/manifest.webmanifest` 를 일반 manifest 기준 파일로 두고, shadow 되던 `apps/web/app/manifest.webmanifest/route.ts` 는 제거했다.
- `scripts/gw-admin-host-preview-smoke.sh` 를 추가해 `preview:cf` 상태에서 Host 헤더 기준 `/manifest.webmanifest`, `/admin/manifest.webmanifest`, general/admin host HTML manifest href, `/admin`, `/` manual/follow redirect smoke 를 재현할 수 있게 했다.
- 새 범위 문서 `docs/architecture/admin-host-preview-verification-extension-scope.md` 와 handoff 문서 `docs/guides/admin-host-preview-verification-extension-handoff.md` 를 추가했다.
- `apps/web/admin-preview-guard.ts` 에서 일반 host admin fallback 을 강화해, paired admin host 를 계산할 수 없으면 allow 대신 `/forbidden` 으로 차단하도록 바꿨다.
- `packages/shared/src/admin-access.ts` 를 추가해 role → permission/adminScope/admin route 접근 행렬을 shared helper 로 모으고, API role scope/고위험 권한 계산·Web preview guard·dashboard shortcut·admin hub 카드 노출이 같은 기준을 재사용하도록 맞췄다.
- `apps/web/app/admin/page.tsx`, `apps/web/admin-page-content.tsx`, `apps/web/admin-page-access.ts` 를 분리해 관리자 허브 카드 노출을 viewer role/permission 기준으로 계산하고, `HR_ADMIN` 은 `/admin/users`·`/admin/policies` 만, `AUDITOR` 는 `/admin/audit-logs` 만 보이도록 정리했다.
- `apps/web/admin-preview-guard.test.ts` 에 paired admin host 미계산 케이스와 spoofed admin-looking host(`admin.attacker.example`) 차단 회귀 테스트를 추가했다.
- 관리자 host 페이지가 `/admin/manifest.webmanifest` 를 광고하도록 `apps/web/app/layout.tsx`, `apps/web/app/mobile-pwa-config.ts` 를 보강했고 local preview smoke 에서 일반/관리자 manifest 경로를 분리 확인했다.
- `pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa` 재검증에서 8개 파일, 43개 테스트가 통과했다.
- live `.workers.dev` fetch 가 막힐 때 `build:cf`, `pnpm check`, local `preview:cf` smoke, deployment metadata 를 substitute evidence 로 남기는 검증 기준을 문서에 추가했다.
- `SPEC.md`, `TEST_PLAN.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 최신 구현 기준으로 다시 맞춰 `packages/shared/src/admin-access.ts` 단일 접근 행렬, `/admin/audit-logs` 의 `audit.read` 기준, 부모 카드 검증 근거(PR #39 merge commit `c14bb65`, `release-gate` run `27398275720`)를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 다시 맞춰 관리자 PWA 문서 기준에 `id`/`display_override`/`shortcuts`, 온라인/오프라인 banner 동작, 관리자 offline 페이지 nav 노출, `touchTargetStyle`(48px/18px) 회귀 보호 기준을 반영했다.
- scheduled 복구 카드 정리 문서를 한 번 더 다듬어, stale/superseded 판단이 예전 실패 로그만이 아니라 최신 `pnpm check`·`build:cf`·local `preview:cf` smoke 같은 현재 검증 근거와 함께 이뤄져야 한다는 기준을 `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 에 반영했다.

## 2026-06-11

### Added

- Admin host 분리 + PWA 웹앱 1차 범위 문서 `docs/architecture/admin-host-pwa-pass-1-scope.md` 추가.
- Admin host 분리 + PWA 웹앱 1차 handoff 문서 `docs/guides/admin-host-pwa-pass-1-handoff.md` 추가.
- Phase 11 조직/직원 일반 화면 1차 완료 및 PR #21 main merge/Cloudflare deploy 확인.
- review-required gate, safe triage, recovery loop 자동화 보강 작업 체인 시작.
- 루트 표준 문서 세트 추가: VISION, ROADMAP, PRD, SPEC, ARCHITECTURE, DATA_MODEL, API, TASKS, TEST_PLAN, QA_CHECKLIST, HANDOFF, DECISIONS, RUNBOOK, DEPLOYMENT, KNOWN_ISSUES.
- Phase 13 관리자 콘솔 실사용 1차 범위 문서 `docs/architecture/phase-13-admin-console-pass-1-scope.md` 추가.
- Phase 13 관리자 콘솔 실사용 1차 handoff 문서 `docs/guides/phase-13-admin-console-pass-1-handoff.md` 추가.
- Phase 13 관리자 콘솔 1차 렌더 회귀 테스트 `apps/web/admin-console-pass1.test.tsx` 추가.
- 출퇴근 등록 방식 정책 선택 1차 범위 문서 `docs/architecture/attendance-registration-policy-pass-1-scope.md` 추가.
- 출퇴근 등록 방식 정책 선택 1차 handoff 문서 `docs/guides/attendance-registration-policy-pass-1-handoff.md` 추가.
- 출퇴근 정책 적용대상/우선순위 2차 범위 문서 `docs/architecture/attendance-registration-policy-pass-2-scope.md` 추가.
- 출퇴근 정책 적용대상/우선순위 2차 handoff 문서 `docs/guides/attendance-registration-policy-pass-2-handoff.md` 추가.

### Changed

- ROADMAP/README/TASKS/HANDOFF/KNOWN_ISSUES/SPEC/TEST_PLAN/QA_CHECKLIST 기준 최신 활성 작업을 Admin host 분리 + PWA 웹앱 1차로 갱신했다.
- 일반 사용자 host 와 관리자 host 를 `host + route` 기준으로 분리하고, 관리자용 manifest(`start_url: /admin`, `scope: /admin`)를 별도 정체성으로 다룬다는 기획 기준을 문서에 추가했다.
- production admin host 후보(`admin.<승인된-domain>`), preview `.workers.dev` admin host 후보, localhost/dev host 시뮬레이션 후보를 문서에 고정했다.
- 현재 진행 작업은 배포까지 자동 승인으로 처리하고, 완료 후 후속 수정/추가 변경은 배포 전 재승인 기준으로 분리.
- role worker 스킬 누락으로 인한 crash는 제품 실패가 아니라 카드/프로필 설정 문제로 분류하고 복구.
- 개발 카드에 제한적 재귀적 자기개선 루프를 적용하기로 했다. 범위는 현재 카드 관련 문서·테스트·QA·핸드오프 개선으로 제한하고, 운영 DB/secret/DNS/유료/배포/PR merge/다른 보드 작업은 자동 수행하지 않는다.
- ROADMAP/README/HANDOFF 기준 최신 활성 Phase를 Phase 13 관리자 콘솔 실사용 1차로 갱신.
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 화면을 운영 체크포인트·권한 경계·current/candidate/capability·감사 타임라인 중심 구조로 재정리했다.
- `apps/web/admin-skeleton-config.ts` 를 operations-first 데이터 구조로 확장해 허브/사용자/정책/감사 로그 화면이 같은 guardrail 문구와 회사 경계 기준을 공유하도록 맞췄다.
- Phase 13 문서 세트(README/TASKS/TEST_PLAN/KNOWN_ISSUES/phase 13 scope+handoff)에 부모 테스트 근거를 반영해 관리자 CTA 경계, 감사 전용 진입 경로, 최신 테스트·typecheck·build 통과 상태를 다시 맞췄다.
- ROADMAP/README/TASKS/HANDOFF/KNOWN_ISSUES 기준 최신 활성 작업을 출퇴근 등록 방식 정책 선택 1차로 갱신했다.
- 출퇴근 등록 방식 정책 1차에서 회사 기본 allowed methods(`mobile`, `pc`, `tag`)를 admin 정책 화면·직원 근태 화면·출근/퇴근 API 검증에 같은 기준으로 연결하는 handoff 를 문서화했다.
- scope/handoff/SPEC/QA/HANDOFF/KNOWN_ISSUES 문구를 현재 구현 예시(`mobile`,`pc` 허용 + `mobile`,`tag` candidate + `tag` skeleton 안내)와 부모 테스트 근거에 맞춰 다시 정리했다.
- ROADMAP/README/TASKS/HANDOFF/KNOWN_ISSUES/SPEC/TEST_PLAN/QA_CHECKLIST 기준 최신 활성 작업을 출퇴근 정책 적용대상/우선순위 2차로 갱신했다.
- 출퇴근 정책 2차에서 적용대상을 `company_default`, `workplace`, `department`, `job_type` 4단계로 고정하고, 우선순위를 `회사 기본 < 근무지/지점 < 부서/팀 < 직무/역할` 로 문서화했다.
- 직원 화면/API 가 같은 `effective policy` 계산 기준을 쓰고, 관리자 화면은 적용 인원 preview 와 winner 설명이 가능해야 한다는 handoff 를 추가했다.
- shared helper(`attendance-policy.ts`)와 admin/api/web 테스트를 추가해 정책 scope/priority/effective policy 계산을 회귀 보호한다.
- admin 정책 화면과 `/attendance` 화면은 pass 2 preview/effective policy 문구를 실제로 렌더링하도록 바꿨다.
- API check-in/check-out 은 employee 기준 effective policy 를 계산해 403 details 에 winner source 를 함께 돌려준다.
- 루트 문서(API/SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF)를 부모 검증 결과에 맞춰 다시 맞추고, 실제 조직 데이터 반영·위치정보·장비·외부 HR 연동이 별도 승인 항목임을 더 분명히 적었다.

### Guardrails

- secret, production DB, DNS/custom domain, 유료 리소스, 실제 개인정보 처리, 외부 HR 연동은 계속 별도 승인 대상.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`, `TEST_PLAN.md`, `docs/guides/phase-42-attendance-leave-hr-branch-operations-adoption-fit-gap-handoff.md` 를 다시 보강해 Phase 42 문서화를 최신 체인 상태와 parent 재검증 근거에 맞췄다. 기획/구현/리뷰/테스트 완료 후 문서화 → release gate 대기 체인, focused shared/API/Web 회귀와 preview smoke 결과, `/attendance`·`/leave` 직원 기본 레인과 `/management`·`/work-items/branch` 운영 레인 분리, reviewer blocker 해소 이력을 같은 언어로 다시 고정했다.
