# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 50 기획·fit-gap — 내부 그룹웨어 본격 도입 릴리즈

### 메인 체인 (Phase 50 내부 그룹웨어 본격 도입 릴리즈 묶음)
1. Phase 49 최종 통합 보고: `t_08696c3d` — 완료
2. Phase 50 기획·fit-gap: `t_0cdaa5b7` — 도담(`gwplanner`) — 완료
3. Phase 50 구현: `t_b56865a6` — 이룸(`gwbuilder`) — 완료
4. Phase 50 리뷰: `t_8428a0e3` — 바름(`gwreviewer`) — 완료
5. Phase 50 테스트: `t_e3d48ed0` — 해봄(`gwtester`) — 완료
6. Phase 50 문서화: `t_db79476b` — 다온(`gwdocs`) — 진행 중
7. Phase 50 GitHub PR/CI/merge/branch cleanup: `t_ae1c36b4` — 지킴(`gwops`) — 부모 대기

## Phase 50 현재 메모

1. 이번 Phase의 목적은 Phase 45~49에서 잠근 내부 도입·온보딩·운영 안정성·감사·최종 UAT 회귀 기준선을 바탕으로, 대장이 live URL에서 직접 로그인하고 핵심 업무를 끝까지 눌러볼 수 있는 본격 도입 릴리즈 패키지를 잠그는 것이다.
2. 현재 근거는 `/login`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me`, `/management`, `/work-items/branch`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/api/health`, `RUNBOOK.md`, `DEPLOYMENT.md` 와 관련 route/API/test 문서 전반에 걸쳐 있다.
3. 핵심은 일반 업무 레인, 운영 관리자 레인, 지점 업무 레인, 감사 read-only 레인, 경영업무 민감 모듈 레인을 같은 관리자 묶음처럼 섞지 않고 최종 릴리즈 언어로 다시 잠그는 것이다.
4. happy path, forbidden, empty, error, loading, mobile/PC 기록 포인트와 skeleton/placeholder/dev-safe 잔여 분류를 기능별로 남겨야 한다.
5. production DB, 외부 IdP, 실급여/실신고, production backup/restore, SIEM/alerting, secret/DNS/custom domain/유료 리소스는 계속 별도 승인 게이트다.

## Phase 50 핵심 범위

- 직원 레인 `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 본격 도입 릴리즈 순서 재정리
- 운영 관리자 레인 `/dashboard` → `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health` 릴리즈 순서 재정리
- 지점관리자 레인 `/work-items/branch` 와 `/employees`·`/org` 읽기 확인, `/management` 운영 허브 문맥 차이 재정리
- 경영업무 민감 모듈(급여·인사·노무·세무·법무·컴플라이언스) 확인 포인트와 직원 기본업무 분리 언어 재정리
- happy/forbidden/empty/error/loading/mobile/PC 기록 포인트와 skeleton/placeholder/dev-safe 분류를 최종 보고 형식으로 재정리
- live URL / 운영 문서 근거 / 승인 게이트 / 사용자 안내를 최종 도입 패키지 기준으로 재정리

현재 기준 문서 세트:
- `docs/architecture/phase-50-internal-groupware-full-adoption-release-fit-gap-scope.md`
- `docs/guides/phase-50-internal-groupware-full-adoption-release-handoff.md`
- `docs/guides/phase-50-internal-groupware-full-adoption-release-guide.md`
- `docs/architecture/phase-49-pilot-feedback-reflection-final-uat-regression-fit-gap-scope.md`
- `docs/guides/phase-49-pilot-feedback-reflection-final-uat-regression-handoff.md`
- `docs/guides/phase-44-operator-runbook.md`

## Phase 50 현재 검증 메모

1. parent 최종 통합 보고 기준 live URL 은 `https://gw-web.wereheresp.workers.dev`, release gate 는 success, merge commit 은 `1f299108b47edc219fa1ac3ea6ce5fd9c8b82114` 다.
2. parent 검증 기준은 focused API `99 passed / 4 skipped`, focused web `104 passed`, `pnpm check`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf`, login-only redirect smoke baseline 이다.
3. 현재 구현에는 일반 업무 레인, 운영 허브, branch scope 레인, 감사 read-only 레인, general/admin host guard, operator runbook 이 이미 존재한다.
4. 이번 Phase에서는 기존 기준을 다시 재인용하는 데서 끝내지 않고, 실제 본격 도입 릴리즈 패키지 문장으로 잠그는 것이 핵심이다.

## Phase 50 다음 우선순위

1. 문서 카드 `t_db79476b` 에서 사용자/관리자 가이드, UAT 절차, 운영 체크리스트, 최종 보고 템플릿을 Phase 50 기준으로 잠그기
2. ops 카드 `t_ae1c36b4` 에서 PR/CI/merge/release gate/cloudflare deploy/live smoke 를 최종 릴리즈 패키지 기준으로 정리하기
3. 최종 결과 보고에서는 live 직접 확인 근거와 local preview/build/test/release gate 대체 근거를 분리해 적기


대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/work-items/branch`
- `/management`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/api/health`
- `RUNBOOK.md`
- `DEPLOYMENT.md`

## Phase 50 승인 게이트

- production backup/restore 실행
- production DB 실데이터
- 실제 incident paging / 외부 alerting / SIEM 연동
- 정기 restore drill 자동화
- DNS/custom domain
- 유료 리소스
- secret 입력/교체
- migration
- destructive 작업

우선 참고 문서:
- `docs/architecture/phase-48-audit-security-backup-restore-incident-ops-fit-gap-scope.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-handoff.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-guide.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/guides/phase-47-operational-stability-performance-mobile-pwa-usability-handoff.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
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