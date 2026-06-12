# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Admin host 운영 설계 + preview 검증 확장

현재 체인:

1. 기획: `t_5672d86f` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_b810e841` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_bd48dc40` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: `t_3d345ebd` — 해봄(`gwtester`) — parent gate 대기
5. 문서화: `t_bd0319a1` — 다온(`gwdocs`) — parent gate 대기
6. GitHub/배포 확인/최종 통합 보고: 후속 parent gate 기준 진행

현재 문서 기준 핵심 범위:

- admin host 판별은 `Host` 헤더, `GW_ADMIN_HOSTS` allowlist, `gw-admin.*.workers.dev`, `admin.localhost`, `admin.127.0.0.1.nip.io` 기준으로만 본다.
- `x-forwarded-host` 는 spoof 가능하므로 admin host 판별 근거로 쓰지 않는다.
- 일반 사용자 manifest 진입 경로는 `/manifest.webmanifest`, 관리자 host 가 실제로 광고하는 manifest 진입 경로는 `/admin/manifest.webmanifest` 로 유지하며 둘 다 same-origin 상대 경로를 쓴다.
- 일반 사용자 host 에서는 `/admin*` 가 그대로 렌더링되면 안 되며, paired admin host 를 계산할 수 없을 때도 allow 보다 차단/유도가 우선이다.
- 관리자 host 에서는 `/` 를 `/admin` 으로 보내고, 일반 업무 route 는 `/admin` 으로 되돌리는 경계를 유지한다.
- preview 검증은 live fetch 하나에만 의존하지 않고 `build:cf`, `pnpm check`, local `preview:cf` smoke, deployment metadata 를 함께 근거로 본다.
- secret, production DB 실데이터, DNS/custom domain, 유료 리소스, 실제 운영 사용자/권한 변경은 이번 범위에 넣지 않는다.

우선 참고 문서:

- `docs/architecture/admin-host-preview-verification-extension-scope.md`
- `docs/guides/admin-host-preview-verification-extension-handoff.md`
- `docs/architecture/admin-host-pwa-pass-1-scope.md`
- `docs/guides/admin-host-pwa-pass-1-handoff.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
