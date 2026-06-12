# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 14 실사용 MVP 통합 1차

현재 체인:

1. 기획: `t_f1c42378` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_e7f6d26d` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_af51a335` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: `t_2b31b169` — 해봄(`gwtester`) — parent gate 대기
5. 문서화: `t_34d40862` — 다온(`gwdocs`) — parent gate 대기
6. GitHub/배포 확인: `t_07109ae5` — 지킴(`gwops`) — parent gate 대기

현재 문서 기준 핵심 범위:

- 홈(`/`) → 로그인(`/login`) → 대시보드(`/dashboard`) → 일반 업무(`/org`, `/employees`, `/attendance`, `/approvals`) → 관리자(`/admin/*`) 흐름을 한 번에 눌러 볼 수 있는 MVP 초안을 만든다.
- 일반 직원/팀장/인사/관리자 역할별 첫 진입 경로와 화면 노출 경계를 문서와 화면에서 같은 뜻으로 정리한다.
- `/admin*` 는 일반 업무 화면에 섞지 않고, 권한 기반 CTA 와 route/API guard 기준을 유지한다.
- `/attendance` 정책 안내와 `/admin/policies` 운영 정책 설명이 같은 방향을 가리키도록 맞춘다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토가 서로 다른 역할임을 분명히 유지한다.
- mock/dev-safe skeleton 범위에서 smoke 기준(`/`, `/login`, `/dashboard`, `/org`, `/employees`, `/attendance`, `/approvals`, `/admin/*`)과 handoff 를 정리한다.
- restricted 항목(secret, production, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 이번 체인에서도 자동 진행하지 않는다.

우선 참고 문서:

- `docs/architecture/phase-14-real-usable-mvp-pass-1-scope.md`
- `docs/guides/phase-14-real-usable-mvp-pass-1-handoff.md`
- `docs/architecture/phase-12-dashboard-summary-scope.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
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
