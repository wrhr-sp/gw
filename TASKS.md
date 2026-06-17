# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 44 기획·fit-gap — 운영문서·사용자가이드·관리자가이드·도입 체크리스트

### 메인 체인 (Phase 44 운영문서 묶음)
1. Phase 43 최종 통합 보고 — 완료
2. Phase 44 기획·fit-gap: `t_b4d63b74` — 도담(`gwplanner`) — 진행 중
3. Phase 44 구현: `t_5142bc72` — 이룸(`gwbuilder`) — 부모 대기
4. Phase 44 리뷰: `t_6123cd3a` — 바름(`gwreviewer`) — 부모 대기
5. Phase 44 테스트: `t_f1c5e044` — 해봄(`gwtester`) — 부모 대기

### 병행 문서화 체인 (PC/모바일 로그인 단독 진입 + PWA 데스크톱 앱)
1. 범위/재검증 부모: `t_af13ba8e` — 완료
2. 문서화: `t_adc1b214` — 다온(`gwdocs`) — 진행 중
3. release gate 후속: `t_906e37d3` — 부모 대기

## Phase 44 현재 메모

1. 이번 Phase의 목적은 새 기능 추가보다, 이미 정리된 로그인/직원 기본업무/경영업무 권한 경계를 직원용 가이드·관리자용 가이드·운영자 runbook·권한표·도입 체크리스트로 다시 묶는 것이다.
2. 현재 근거는 Phase 42A~43 문서와 `apps/web/app/dashboard/page.tsx`, `apps/web/app/management/page.tsx`, `apps/web/app/payroll/page.tsx`, `apps/web/app/payroll/me/page.tsx`, `apps/web/app/work-items/work-items-config.ts`, `apps/web/app/admin/audit-logs/page.tsx`, `apps/web/middleware.ts`, `apps/web/admin-preview-guard.ts`, `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` 에 걸쳐 있다.
3. 핵심은 일반 직원 레인(`/dashboard` 중심)과 민감 운영 레인(`/management` 중심)을 문서에서도 절대 섞지 않는 것이다.
4. 단순 화면 소개가 아니라 route guard, API guard, company+branch scope, read-only 감사 경계, approval gate 를 함께 읽히게 해야 한다.
5. 실지급, 은행이체, 주민번호/계좌번호 확대, production 실데이터, 외부 기관/전문가 연동, DNS/custom domain, 유료 리소스, migration, destructive 작업은 계속 별도 승인 게이트다.

## Phase 44 핵심 범위

- 직원용 사용자 가이드 정리
- 관리자/담당자용 운영 가이드 정리
- 운영자 runbook 정리
- 역할별 권한표 정리
- 도입 전 체크리스트 정리
- live URL, route, 테스트 계정, 역할별 시나리오, 승인 게이트를 최종 보고 형식으로 연결

현재 구현된 Phase 44 문서 세트:
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-operator-runbook.md`
- `docs/guides/phase-44-role-access-matrix.md`
- `docs/guides/phase-44-adoption-checklist.md`

## Phase 44 다음 우선순위

1. 직원 기본 흐름(`/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents`)을 쉬운 문장으로 고정
2. 관리자 흐름(`/management` → `/work-items/branch` → `/payroll` → `/work-items/tax|labor|legal` → `/admin/audit-logs`)을 역할별 책임 기준으로 정리
3. 운영자 runbook 을 사전 준비 / 도입 중 점검 / 도입 후 정리 3단계로 정리
4. approval gate 를 문서마다 흩어 적지 않고 한 체크리스트로 다시 묶기

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

## Phase 44 승인 게이트

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