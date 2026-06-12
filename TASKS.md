# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: 관리자 권한/역할 데이터 모델 1차

현재 체인:

1. 기획: `t_df0b3063` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_6095ba1f` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_7c421689` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: 후속 parent gate 기준 진행
5. 문서화: 후속 parent gate 기준 진행
6. GitHub/배포 확인/최종 통합 보고: 후속 parent gate 기준 진행

현재 문서 기준 핵심 범위:

- 관리자 접근 기준은 host 분리만이 아니라 `roleCode + permissionCode + adminScope` 기준으로 정리한다.
- `/admin`, `/admin/users`, `/admin/policies` 와 `/admin/audit-logs` 는 같은 관리자 영역처럼 보여도 접근 기준을 분리해 본다.
- 1차 접근 행렬은 `SUPER_ADMIN`/`COMPANY_ADMIN` 전부 허용, `HR_ADMIN` 은 감사 로그 제외, `AUDITOR` 는 감사 로그만 허용, `MANAGER`/`EMPLOYEE` 는 차단으로 맞춘다.
- Web route guard, dashboard/admin navigation 노출, API guard, 테스트 기대값이 같은 행렬을 따라야 한다.
- 감사 로그 접근은 role 이름보다 `audit.read` capability 를 실제 기준으로 본다.
- 일반 사용자 host 에서 `/admin*` 가 그대로 렌더링되면 안 되며, 일반 사용자와 관리자 흐름은 계속 분리한다.
- 실제 운영 사용자 권한 저장, production DB migration/real data, secret/DNS/유료 리소스, 외부 IAM/SSO/감사 시스템 연동은 이번 범위에 넣지 않는다.

우선 참고 문서:

- `docs/architecture/admin-role-permission-model-pass-1-scope.md`
- `docs/guides/admin-role-permission-model-pass-1-handoff.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `docs/guides/phase-13-admin-console-pass-1-handoff.md`
- `docs/architecture/admin-host-preview-verification-extension-scope.md`
- `docs/guides/admin-host-preview-verification-extension-handoff.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
