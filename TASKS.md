# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 40 문서화 — 내부 도입 리허설·관리자/직원 UAT 패키지

현재 체인:

1. Phase 40 재검증 완료: `t_cc4b8957` — 해봄(`gwtester`) — 완료
2. Phase 40 문서화: `t_a627fd5c` — 다온(`gwdocs`) — 진행 중
3. Phase 40 GitHub PR/CI/merge/branch cleanup: `t_de5fe53c` — 지킴(`gwops`) — 부모 대기
4. Phase 40 최종 통합 보고: `t_12730723` — 싱드(`singde`) — 부모 대기

현재 메모:

4. 직전 Phase 36에서는 `/dashboard`·`/menu` shortcut, `/org`·`/employees`, `/admin/users`·`/admin/policies` 운영 검토를 같은 회사 설정 모델 언어로 다시 맞췄고, 직전 Phase 37에서는 `/documents`·`/admin/audit-logs`·`work-items`·`/payroll` 저장흐름/approval gate 경계를 다시 묶었으며, 직전 Phase 38에서는 `/dashboard`·`/menu`·`/notifications`·`/offline` 와 공통 app shell, 일반 업무 흐름 대 `경영업무`·`/admin*` 운영 레인을 현장 사용성 언어로 다시 맞췄다.
5. 직전 Phase 39에서는 일반 host 대 admin host 경계, `/management`·`/admin*`·민감 work item 권한, company+branch scope, foreign/self 차단, forbidden/error/empty/offline 분리, masked audit preview 와 raw 민감정보 비노출을 코드/테스트/문서 기준으로 다시 고정했다.
6. 직전 parent 재검증에서는 익명 general host `/uat` 접근이 `/login` 으로 redirect 되고, 로그인 세션에서는 `/uat` 접근이 허용되며, focused Phase 40 guard/middleware 테스트 22개 파일·94개 테스트가 통과했다.
7. 이번 카드의 목적은 그 위에서 직원/승인자/경영업무 담당자/운영자 레인별 UAT 시나리오, blocker/major/minor/copy-doc/approval-needed 분류 기준, 교육자료 초안, 최종 보고 형식을 한 번에 묶는 것이다.
8. 현재 문서화 근거는 `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`, `docs/guides/phase-33-attendance-leave-approvals-real-usage-handoff.md`, `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`, `docs/guides/phase-39-operational-qa-security-audit-permission-regression-fit-gap-handoff.md`, `apps/web/app/uat/page.tsx`, `apps/web/app/uat/uat-package-config.ts`, `apps/web/phase40-uat-package.test.tsx`, `apps/web/admin-preview-guard.test.ts`, `apps/web/phase38-offline-admin.test.tsx`, `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` 에 걸쳐 있다.
9. 이번 문서의 목적은 "내부 도입 리허설 패키지" 와 실제 `/uat` 실행 화면을 release gate·최종 보고 체인이 같은 언어로 이어받게 만드는 것이다.
10. parent 최종 통합 보고 기준 live URL 은 `https://gw-web.wereheresp.workers.dev` 이고, 테스트 계정 `admin / 1234` 는 dev/test/UAT 전용 계정이다.

현재 문서 기준 핵심 범위:

- 일반 직원 레인(`/login` → `/uat` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`)을 UAT 시작점으로 다시 고정한다.
- 승인자/팀장 레인, 경영업무 담당자 레인(`/management` → `/payroll`/`work-items/*`), 운영자/감사 레인(`/admin*` → `/offline`)을 서로 다른 역할 문맥으로 다시 고정한다.
- happy path, forbidden, empty, error, offline 을 UAT 기록표에서 다른 상태로 적는 기준을 다시 고정한다.
- 권한 누출, foreign/self/company+branch scope 누출, raw 민감정보 노출을 blocker 또는 major 급 이슈로 분류하는 기준을 다시 고정한다.
- live URL, 테스트 계정, 역할별 추천 시나리오, 이슈 기록 규칙, 교육자료 초안, 별도 승인 게이트를 한 세트의 UAT 패키지로 다시 고정한다.
- production 데이터, secret, DNS/custom domain, 유료 리소스, 외부 연동, 실제 급여 지급, migration, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 확인 가능한 영역
- `/uat`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` 기준 일반 직원 UAT 흐름
- `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 기준 경영업무 담당자 UAT 흐름
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/offline` 기준 운영자/감사 검토 흐름
- `apps/web/admin-preview-guard.test.ts`, `apps/web/phase38-offline-admin.test.tsx`, `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` 기준 권한/scope/offline/민감정보 guardrail 근거

### gap 이 큰 영역
- `/uat` 실행 패키지 화면과 루트 문서의 설명 순서가 어긋나면 참가자가 어느 입구를 먼저 볼지 혼동할 수 있음
- blocker / major / minor / approval-needed 분류가 제품/교육/최종 보고 언어로 아직 충분히 고정되지 않음
- 일반 직원 레인, 경영업무 레인, 운영/감사 레인을 한 계정 기준으로 설명하다 보니 문맥이 섞일 위험이 있음
- 상태 문구(forbidden/error/empty/offline)와 권한 누출 질문을 UAT 기록표 문장으로 다시 고정할 필요가 있음

## 다음 우선순위

Phase 39 운영 QA·보안·감사·권한 회귀 안정화 fit-gap 다음 우선순위는
외부 연동이나 실데이터 확대보다
Phase 40 내부 도입 리허설·관리자/직원 UAT 패키지 read model 정리다.

핵심 이유:
- 현재 제품은 일반 업무, 경영업무, 운영/감사 레인을 실제 route 로 보여 줄 수 있지만, 내부 도입 리허설을 어떤 순서와 판정 기준으로 돌릴지 한 번에 읽는 문장이 아직 약하다.
- 이 영역은 제품 문구, 권한 경계, 교육자료, 이슈 분류, 최종 보고 형식을 동시에 묶어야 하므로 read model 을 먼저 정리해야 이후 구현/리뷰/테스트도 덜 흔들린다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/uat`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/management`
- `/payroll`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/offline`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/phase38-offline-admin.test.tsx`
- `apps/api/test/auth-org.spec.ts`

다음 패스에서 바로 줄여야 할 잔여:
- `/uat` 실행 패키지와 루트 문서가 같은 추천 순서/분류 기준을 쓰도록 맞추기
- 역할별 UAT 시작점과 직접 액션/happy path/상태 예외를 표로 정리
- blocker / major / minor / copy-doc / approval-needed 분류 기준 정리
- 진행자용 설명 순서와 참가자용 빠른 시작 순서 정리
- 최종 보고에 들어갈 live URL/계정/시나리오/남은 승인 게이트 형식 고정

우선 참고 문서:
- `docs/architecture/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-scope.md`
- `docs/guides/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-handoff.md`
- `docs/architecture/phase-39-operational-qa-security-audit-permission-regression-fit-gap-scope.md`
- `docs/guides/phase-39-operational-qa-security-audit-permission-regression-fit-gap-handoff.md`
- `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`
- `docs/guides/phase-33-attendance-leave-approvals-real-usage-handoff.md`
- `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- Phase 40 GitHub PR/CI/merge/branch cleanup: `t_de5fe53c` — 지킴(`gwops`) — parent-gated
- Phase 40 최종 통합 보고: `t_12730723` — 싱드(`singde`) — parent-gated

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
