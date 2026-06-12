# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 15 운영 데이터·정책·감사 로그 연결 1차

현재 체인:

1. 기획: `t_4f7ea1d3` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_0e312fc3` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_47fc60a7` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: `t_89e222da` — 해봄(`gwtester`) — parent gate 대기
5. 문서화: `t_a7b0b31f` — 다온(`gwdocs`) — parent gate 대기
6. GitHub/배포 확인: `t_accc581a` — 지킴(`gwops`) — parent gate 대기

현재 문서 기준 핵심 범위:

- 관리자 `/admin/users`, `/admin/policies`, `/admin/audit-logs` 의 운영 기준이 `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees` 와 관련 API 허용 기준에 왜 그렇게 반영되는지 설명 가능한 연결을 만든다.
- 일반 직원/팀장/인사/감사 역할별로 권한 부족, 회사 scope, 정책 미허용, placeholder 제한을 서로 다른 이유로 설명할 수 있게 정리한다.
- `/admin*` 는 계속 일반 업무 화면에 섞지 않고, 권한 기반 CTA 와 route/API guard 기준을 유지한다.
- `/attendance` 뿐 아니라 `/leave` 도 운영 정책 연결 보강 대상으로 올려 `/admin/policies` 와 같은 방향을 가리키도록 맞춘다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토, `/approvals` 결재 권한과 관리자 운영 권한이 서로 다른 역할임을 분명히 유지한다.
- mock/dev-safe skeleton 범위에서 핵심 흐름(`/`, `/login`, `/dashboard`, `/attendance`, `/approvals`, `/org`, `/employees`, `/admin/*`)과 정책 연결 보강 route(`/leave`) 기준을 함께 handoff 한다.
- restricted 항목(secret, production, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 이번 체인에서도 자동 진행하지 않는다.

우선 참고 문서:

- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`
- `docs/guides/phase-15-operational-policy-audit-bridge-pass-1-handoff.md`
- `docs/architecture/phase-14-real-usable-mvp-pass-1-scope.md`
- `docs/guides/phase-14-real-usable-mvp-pass-1-handoff.md`
- `docs/architecture/phase-12-dashboard-summary-scope.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `docs/architecture/admin-role-permission-model-pass-1-scope.md`
- `docs/architecture/attendance-registration-policy-pass-2-scope.md`
- `docs/guides/phase-13-admin-console-pass-1-handoff.md`
- `docs/guides/attendance-registration-policy-pass-2-handoff.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
