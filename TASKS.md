# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: 관리자 PWA 설치 UX / 오프라인 / manifest 품질 개선

현재 체인:

1. 기획: `t_2597f1b6` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_64745472` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_089618bb` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: `t_f809ac5a` — 해봄(`gwtester`) — parent gate 대기
5. 문서화: 후속 parent gate 기준 진행
6. GitHub/배포 확인/최종 통합 보고: 후속 parent gate 기준 진행

현재 문서 기준 핵심 범위:

- 관리자 PWA는 일반 사용자 앱과 다른 설치 정체성을 유지한다.
- 관리자 manifest 기준은 `/admin/manifest.webmanifest`, `start_url: /admin`, `scope: /admin`, `name: GW Admin` 계열을 유지한다.
- 설치 안내는 관리자 host 에서 `/admin` 시작점과 운영용 앱 맥락을 먼저 설명해야 한다.
- 오프라인 안내는 관리자 상태 변경이 성공처럼 보이지 않도록, 가능한 일/막히는 일/재시도 절차를 분리해 설명한다.
- 아이콘 기준은 일반/관리자 파일 분리, 192/512, any/maskable purpose, 테스트 회귀 보호까지를 최소 필수로 본다.
- placeholder SVG 자산 상태를 숨기지 않으며, 최종 브랜딩/앱스토어 자산은 별도 범위로 남긴다.
- local preview/manual smoke/Lighthouse 점검 기준을 문서와 handoff 에 같이 남긴다.
- 앱스토어/Expo/native 전환, push/background sync, production DB/secret/DNS/유료 리소스 작업은 이번 범위에 넣지 않는다.

우선 참고 문서:

- `docs/architecture/admin-pwa-install-offline-quality-scope.md`
- `docs/guides/admin-pwa-install-offline-quality-handoff.md`
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
