# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 19 네이티브 모바일앱 내부 시범 운영 초안

현재 체인:

1. 기획: `t_79dceb4d` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_8a867fdc` — 이룸(`gwbuilder`) — parent gate 대기
3. 후속 리뷰/테스트/문서화/운영 카드는 구현 handoff 확정 뒤 같은 기준으로 이어간다.

현재 문서 기준 핵심 범위:

- Phase 17~18에서 정리한 `apps/mobile` skeleton과 `packages/shared/src/mobile-contracts.ts` 계약을 바탕으로 내부 시범 운영 준비 기준을 정리한다.
- live/PWA/API 선행 검증 기준과 mobile 전용 설치·로그인·핵심 업무 smoke 기준을 분리해 본다.
- Android internal test 또는 Expo preview/dev build 후보 절차, iOS TestFlight/Apple Developer 준비물, 비용/계정/권한 승인 checklist를 문서화한다.
- 로그인 → 대시보드 → 출퇴근/휴가/결재함 → 공지·문서 → 내 정보 7개 핵심 화면 흐름은 유지하되, 설치/세션 정리/내부 배포 준비 관점을 추가한다.
- `/admin/*` 운영 화면, App Store/Play Console/TestFlight/EAS 실제 사용, push, 실기기 권한, secret, custom domain, production data 는 계속 별도 승인 게이트로 분리한다.
- 성공 기준은 실제 배포가 아니라 대장이 내부 시범 운영 전에 필요한 승인/비용/준비물과 dev-safe 검증 가능 범위를 한눈에 볼 수 있게 만드는 것이다.

현재 구현/기획 메모:

- `apps/mobile/src/screens.ts`, `src/shell.ts`, `src/session-bridge.ts`, `src/base-url.ts`, `src/workflow.ts` 와 `packages/shared/src/mobile-contracts.ts` 가 이미 7개 핵심 화면, session guardrail, base URL policy, 상태 분류, route mapping 기준을 담고 있다.
- 이번 Phase 19에서는 여기에 내부 시범 운영 checklist, Android/iOS 준비물 차이, 설치/로그인/핵심 업무 smoke 순서, 비용/계정/권한 승인 게이트를 더 분명히 맞춘다.
- 리뷰/테스트/문서화는 `pnpm --filter @gw/mobile typecheck`, `pnpm check`, 필요 시 `pnpm --filter @gw/web build:cf` 근거와 함께 mobile 전용 기준과 live/PWA/API 선행 기준을 분리해 기록하는 방향으로 이어간다.

우선 참고 문서:

- `docs/architecture/phase-19-native-mobile-internal-pilot-draft-scope.md`
- `docs/guides/phase-19-native-mobile-internal-pilot-draft-handoff.md`
- `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md`
- `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md`
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/guides/phase-17-native-mobile-transition-prep-handoff.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
