# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 45 기획·fit-gap — 외부연동 전 내부 도입 최종검증·릴리즈

### 메인 체인 (Phase 45 최종검증·릴리즈 묶음)
1. Phase 44 최종 통합 보고 — 완료
2. Phase 45 기획·fit-gap: `t_e5f0bbb3` — 도담(`gwplanner`) — 진행 중
3. Phase 45 구현: `t_74123511` — 이룸(`gwbuilder`) — 부모 대기
4. Phase 45 리뷰: `t_74a9023c` — 바름(`gwreviewer`) — 부모 대기
5. Phase 45 테스트: `t_56f81ded` — 해봄(`gwtester`) — 부모 대기
6. Phase 45 문서화: `t_ee495517` — 다온(`gwdocs`) — 진행 중
7. Phase 45 GitHub PR/CI/merge/branch cleanup: `t_6dd6a634` — 지킴(`gwops`) — 부모 대기

### 병행 문서화 체인 (PC/모바일 로그인 단독 진입 + PWA 데스크톱 앱)
1. 범위/재검증 부모: `t_af13ba8e` — 완료
2. 문서화: `t_adc1b214` — 다온(`gwdocs`) — 진행 중
3. release gate 후속: `t_906e37d3` — 부모 대기

## Phase 45 현재 메모

1. 이번 Phase의 목적은 새 큰 기능 추가보다, Phase 36~44에서 정리한 로그인·직원 기본업무·경영업무·운영문서·PWA 기준을 최종 UAT/권한/운영/release 관점으로 다시 묶는 것이다.
2. 현재 근거는 Phase 42A~44 문서와 `apps/web/app/login/page.tsx`, `apps/web/app/dashboard/page.tsx`, `apps/web/app/management/page.tsx`, `apps/web/app/payroll/page.tsx`, `apps/web/app/payroll/me/page.tsx`, `apps/web/app/work-items/work-items-config.ts`, `apps/web/app/admin/audit-logs/page.tsx`, `apps/web/middleware.ts`, `apps/web/admin-preview-guard.ts`, `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` 에 걸쳐 있다.
3. 핵심은 일반 직원 레인(`/dashboard` 중심), 민감 운영 레인(`/management` 중심), 감사 read-only 레인(`/admin/audit-logs`)을 최종 보고에서도 절대 섞지 않는 것이다.
4. 단순 화면 소개가 아니라 route guard, API guard, company+branch/self/restricted/read-only scope, release/rollback 근거, approval gate 를 함께 읽히게 해야 한다.
5. 실지급, 은행이체, 주민번호/계좌번호 확대, production 실데이터, 외부 기관/전문가 연동, DNS/custom domain, 유료 리소스, secret, migration, destructive 작업은 계속 별도 승인 게이트다.

## Phase 45 핵심 범위

- 최종 UAT 기준선 정리
- 권한/보안/scope/approval gate 최종 잠금
- live URL, route, 테스트 계정, 역할별 시나리오를 최종 보고 형식으로 연결
- release gate/배포/rollback/blocked 기준 정리
- 내부 도입 완료 범위와 외부 연동 후속 범위 분리

현재 기준 문서 세트:
- `docs/architecture/phase-45-final-internal-adoption-validation-release-fit-gap-scope.md`
- `docs/guides/phase-45-final-internal-adoption-validation-release-handoff.md`
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-operator-runbook.md`
- `docs/guides/phase-44-role-access-matrix.md`
- `docs/guides/phase-44-adoption-checklist.md`

## Phase 45 현재 검증 메모

1. 최신 tester 재검증 기준으로 `pnpm --filter @gw/api test -- auth-org.spec.ts work-items.spec.ts` 15 files / 98 passed / 4 skipped, `pnpm --filter @gw/web test -- admin-preview-guard.test.ts work-items.test.tsx dashboard-boundary.test.tsx payroll.test.tsx` 24 files / 100 passed, `pnpm --filter @gw/mobile typecheck`, `pnpm --filter @gw/web build` 가 모두 통과했다.
2. local preview smoke 기준 익명 `/`, `/dashboard`, `/management`, `/payroll`, `/payroll/me`, `/work-items/labor`, `/admin/audit-logs`, `/uat` 는 모두 307으로 `/login` 으로 redirect 되고, `/login` 200, `/api/health` 200, `/manifest.webmanifest` 200 이 확인됐다.
3. 문서 세트 전반에서 `/login` 단독 진입, `/dashboard`=홈, `/management` 민감 운영 허브 분리, `/uat`=로그인 후 운영 패키지, `/payroll` vs `/payroll/me`, approval gate 분리가 일관된 상태다.
4. 일반 manifest 실측값은 `id=/login`, `start_url=/`, `display=standalone` 이고, 익명 `/` 가 `/login` 으로 redirect 되어 로그인-only 진입 기준과 충돌 없이 동작한다.
5. parent 최종 통합 보고 기준 live URL 은 `https://gw-web.wereheresp.workers.dev`, main release-gate 는 success, merge commit 은 `8372ae1008c74b1578c17e26763b8462596b65ad` 다.
6. rollback 기준은 `pnpm exec wrangler deployments list --json --name gw-web` 로 version id 확인 → `pnpm exec wrangler rollback <version-id> --name gw-web -y` 실행 → `/login`, `/dashboard`, `/management`, `/payroll`, `/admin/audit-logs`, `/manifest.webmanifest` 재확인 순서로 정리한다.

## Phase 45 다음 우선순위

1. 구현 카드에서 최종 UAT/권한/운영 기준과 충돌하는 잔여 UX/copy/guard 문제를 정리
2. 테스트 카드에서 focused 회귀, mobile typecheck, web build, local preview/live 근거를 최종 판정 형식으로 다시 확인
3. 문서화/ops 카드에서 live URL, route, 테스트 계정, release/rollback, 승인 게이트를 최종 보고 형식으로 잠그기

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/notifications`
- `/management`
- `/work-items/branch`
- `/payroll`
- `/payroll/me`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin/audit-logs`

## Phase 45 승인 게이트

- 실제 급여 지급
- 은행 이체
- 주민번호/계좌번호 입력 확대
- production DB 실데이터
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- 법령 API 인증키 등록
- DNS/custom domain
- 유료 리소스
- secret 입력/교체
- migration
- destructive 작업

우선 참고 문서:
- `docs/architecture/phase-45-final-internal-adoption-validation-release-fit-gap-scope.md`
- `docs/guides/phase-45-final-internal-adoption-validation-release-handoff.md`
- `docs/architecture/phase-44-operations-docs-user-admin-guides-adoption-checklist-fit-gap-scope.md`
- `docs/guides/phase-44-operations-docs-user-admin-guides-adoption-checklist-handoff.md`
- `docs/architecture/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-scope.md`
- `docs/architecture/phase-42-attendance-leave-hr-branch-operations-adoption-fit-gap-scope.md`
- `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
- `ROADMAP.md`
- `HANDOFF.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```