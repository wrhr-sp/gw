# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 46 기획·fit-gap — 계정·권한·조직 온보딩 리허설

### 메인 체인 (Phase 46 온보딩 리허설 묶음)
1. Phase 45 최종 통합 보고 — 완료
2. Phase 46 기획·fit-gap: `t_9bb90fee` — 도담(`gwplanner`) — 진행 중
3. Phase 46 구현: `t_c59b2bbb` — 이룸(`gwbuilder`) — 부모 대기
4. Phase 46 리뷰: `t_436b2418` — 바름(`gwreviewer`) — 부모 대기
5. Phase 46 테스트: `t_c98a8706` — 해봄(`gwtester`) — 부모 대기
6. Phase 46 문서화: `t_897780bf` — 다온(`gwdocs`) — 부모 대기
7. Phase 46 GitHub PR/CI/merge/branch cleanup: `t_502529de` — 지킴(`gwops`) — 부모 대기

## Phase 46 현재 메모

1. 이번 Phase의 목적은 Phase 45 내부 도입 기준선 위에서 `/admin/users`·`/employees`·`/org`·`/management`·`/work-items/branch` 를 사용자 온보딩/오프보딩 기준으로 다시 묶는 것이다.
2. 현재 근거는 `apps/web/app/page.tsx`, `apps/web/app/admin/users/page.tsx`, `apps/web/app/admin/users/admin-users-page-content.tsx`, `apps/web/app/employees/page.tsx`, `apps/web/app/org/page.tsx`, `apps/web/app/management/page.tsx`, `apps/api/src/app.ts`, `apps/api/src/lib/operational-org.ts`, `apps/api/test/auth-org.spec.ts`, `apps/web/work-items.test.tsx`, `packages/shared/src/contracts.ts`, `packages/shared/src/admin-access.ts` 에 걸쳐 있다.
3. 핵심은 COMPANY_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE 공통 post-login landing(`/dashboard`)과, 그 뒤 HR 계정관리(admin host `/admin/users`), 운영 관리자 허브(general host `/management`), 감사 read-only(admin host `/admin/audit-logs`) 다음 레인을 절대 섞지 않는 것이다.
4. 단순 화면 소개가 아니라 route guard, API guard, company+branch scope, high-risk permission, audit candidate, dev-safe preview 와 approval gate 경계를 함께 읽히게 해야 한다.
5. 실제 초대 발송, 외부 IdP/SSO, production 비밀번호/실데이터, DNS/custom domain, 유료 리소스, secret, migration, destructive 작업은 계속 별도 승인 게이트다.

## Phase 46 핵심 범위

- 계정 온보딩 UAT 순서 정리
- 공통 post-login landing 과 역할별 다음 레인/차단 기준 잠금
- `/employees` 일반 조회와 `/admin/users` 운영 검토 책임 분리
- 조직/지점/부서 배정 확인과 `/work-items/branch` 운영 흐름 연결
- dev-safe preview 와 실제 저장/외부 연동 approval gate 경계 정리

현재 기준 문서 세트:
- `docs/architecture/phase-46-account-permission-organization-onboarding-rehearsal-fit-gap-scope.md`
- `docs/guides/phase-46-account-permission-organization-onboarding-rehearsal-handoff.md`
- `docs/architecture/phase-45-final-internal-adoption-validation-release-fit-gap-scope.md`
- `docs/guides/phase-45-final-internal-adoption-validation-release-handoff.md`
- `docs/guides/phase-44-role-access-matrix.md`

## Phase 46 현재 검증 메모

1. 직전 Phase 45 최종 검증 기준으로 focused API 15 files / 98 passed / 4 skipped, focused web 24 files / 100 passed, mobile typecheck, web build 가 모두 통과한 상태를 온보딩 리허설 baseline 으로 이어받는다.
2. local preview smoke 기준 익명 `/`, `/dashboard`, `/management`, `/payroll`, `/payroll/me`, `/work-items/labor`, `/admin/audit-logs`, `/uat` 가 모두 `/login` 으로 redirect 되는 로그인-only 기준을 유지한다.
3. 현재 구현에는 `/admin/users` dev-safe 생성/권한 diff/상태 변경/비밀번호 초기화 preview 와 `/employees`·`/org` 읽기 흐름, `/management` → `/work-items/branch` 운영 흐름이 이미 존재한다.
4. parent 최종 통합 보고 기준 live URL 은 `https://gw-web.wereheresp.workers.dev`, main release-gate 는 success, merge commit 은 `fd5239e2e36848e711d918d45994382bf4616b39` 다.

## Phase 46 다음 우선순위

1. 구현 카드에서 계정 생성/권한 변경/상태 변경/비밀번호 초기화 happy path 와 공통 landing(`/dashboard`) 뒤 역할별 다음 레인/차단 UX 를 더 또렷하게 정리
2. 리뷰/테스트 카드에서 HR_ADMIN·MANAGER·EMPLOYEE·AUDITOR·COMPANY_ADMIN 별 route/API 경계와 비밀값 노출 금지를 재검증
3. 문서화/ops 카드에서 운영자 UAT 순서, live URL, 테스트 계정, approval gate, release gate 근거를 최종 보고 형식으로 잠그기

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/admin/users`
- `/employees`
- `/org`
- `/management`
- `/work-items/branch`
- `/admin/audit-logs`

## Phase 46 승인 게이트

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
- `docs/architecture/phase-46-account-permission-organization-onboarding-rehearsal-fit-gap-scope.md`
- `docs/guides/phase-46-account-permission-organization-onboarding-rehearsal-handoff.md`
- `docs/architecture/phase-45-final-internal-adoption-validation-release-fit-gap-scope.md`
- `docs/guides/phase-45-final-internal-adoption-validation-release-handoff.md`
- `docs/guides/phase-44-role-access-matrix.md`
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