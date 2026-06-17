# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 48 기획·fit-gap — 감사·보안·백업/복구·장애대응·운영관제 기준선

### 메인 체인 (Phase 48 감사·보안·백업/복구·장애대응·운영관제 묶음)
1. Phase 47 최종 통합 보고 — 완료
2. Phase 48 기획·fit-gap: `t_4a465718` — 도담(`gwplanner`) — 진행 중
3. Phase 48 구현: `t_3dbc45ae` — 이룸(`gwbuilder`) — 부모 대기
4. Phase 48 리뷰: `t_af1775c7` — 바름(`gwreviewer`) — 부모 대기

## Phase 48 현재 메모

1. 이번 Phase의 목적은 Phase 37 저장흐름·감사 연결, Phase 39 운영 QA·보안·권한 회귀, Phase 44 운영자 runbook, Phase 47 운영 안정성 기준선을 묶어 `/admin/audit-logs`, `/management`, `/admin/users`, `/admin/policies`, `/api/health`, `RUNBOOK.md`, `DEPLOYMENT.md` 를 내부 운영 기준선 언어로 다시 정리하는 것이다.
2. 현재 근거는 `apps/api/src/lib/operational-admin.ts`, `apps/api/src/app.ts`, `apps/web/admin-preview-guard.ts`, `apps/web/middleware.ts`, `packages/shared/src/admin-access.ts`, `packages/shared/src/contracts.ts`, `apps/api/test/auth-org.spec.ts`, `apps/api/test/phase34-degraded-routes.spec.ts`, `apps/web/admin-preview-guard.test.ts`, `RUNBOOK.md`, `DEPLOYMENT.md`, `docs/guides/phase-44-operator-runbook.md` 에 걸쳐 있다.
3. 핵심은 감사 read-only/masked 기준, role+permission+company/branch 경계, 최소 health/smoke/runbook 기준, backup/restore/incident 승인 게이트를 같은 언어로 잠그는 것이다.
4. 운영 관제를 없는 대시보드처럼 과장하지 않고, 현재는 `/api/health`·preview smoke·build/release gate·runbook 수준이라는 점을 분명히 남겨야 한다.
5. backup/restore 자동화, restore drill, 외부 alerting/SIEM, production DB 실복구, secret/DNS/custom domain/유료 리소스는 계속 별도 승인 게이트다.

## Phase 48 핵심 범위

- `/admin/audit-logs` masked read-only / company boundary 기준 재정리
- role/permission/company+branch/self/foreign 차단 근거 재정리
- `/api/health`, preview smoke, build/release gate, runbook 를 운영 최소 관제 기준으로 재정리
- backup/restore/rollback/incident 대응의 수동 절차와 승인 게이트 분리
- live URL / 배포 문서 정합성 리스크 기록

현재 기준 문서 세트:
- `docs/architecture/phase-48-audit-security-backup-restore-incident-ops-fit-gap-scope.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-handoff.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-guide.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/guides/phase-47-operational-stability-performance-mobile-pwa-usability-handoff.md`
- `docs/guides/phase-44-operator-runbook.md`

## Phase 48 현재 검증 메모

1. 직전 parent 기준 focused API 15 files / 98 passed / 4 skipped, focused web 24 files / 102 passed, mobile typecheck, web build, login-only redirect smoke baseline 을 Phase 48 출발점으로 이어받는다.
2. 현재 구현에는 `/admin/audit-logs` masked preview, `audit.read` capability 경계, `/api/health` 최소 liveness 응답, general/admin host guard, operator runbook 이 이미 존재한다.
3. `apps/api/test/phase34-degraded-routes.spec.ts` 기준 audit log read 는 DB read 실패 시에도 placeholder fallback 으로 500 대신 안전 응답을 유지한다.
4. 현재 루트 문서에는 live URL 이 `werehere31` 과 `wereheresp` 로 나뉘어 적힌 흔적이 있어, Phase 48 후속 체인에서 우선 재확인할 운영 정합성 리스크로 본다.

## Phase 48 다음 우선순위

1. 구현 카드에서 감사/권한/health/runbook 문장을 한 세트의 운영 기준선으로 더 또렷하게 정리
2. 리뷰 카드에서 read-only/masked/company boundary 와 관리자 권한 과장을 재검증
3. 테스트/ops 카드에서 smoke 대상 URL, release gate, rollback 문서, backup/restore 수동 절차 표현을 정합성 있게 잠그기

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/management`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/api/health`
- `RUNBOOK.md`
- `DEPLOYMENT.md`

## Phase 48 승인 게이트

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