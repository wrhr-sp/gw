# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 17 네이티브 모바일앱 전환 준비

현재 체인:

1. 기획: `t_2ab164ce` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_724b339d` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_9782f917` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: `t_e70b9919` — 해봄(`gwtester`) — parent gate 대기
5. 문서화: `t_057b7d67` — 다온(`gwdocs`) — parent gate 대기
6. GitHub/배포 확인: `t_372b75b2` — 지킴(`gwops`) — parent gate 대기

현재 문서 기준 핵심 범위:

- `apps/mobile` 후보 위치를 monorepo 안에서 어떻게 둘지와 `apps/web`/`apps/api`/`packages/shared` 와의 경계를 고정한다.
- Web/PWA와 네이티브 앱이 공통으로 재사용할 API contract, role/scope, route mapping, auth/session 원칙을 정리한다.
- 모바일 1차 핵심 화면을 로그인, 대시보드, 출퇴근, 휴가, 결재함, 공지/문서, 내 정보 7개 묶음으로 우선 고정한다.
- same-origin `/api/*` 철학은 유지하되, 네이티브 앱에서는 base URL resolver / mock / dev-safe bridge 계층으로 번역한다.
- App Store/Play Console/TestFlight/EAS 유료 빌드, 외부 테스터 배포, push/실기기 권한, secret, custom domain, production data 는 별도 승인 게이트로 분리한다.
- 성공 기준은 스토어 배포가 아니라 다음 구현자가 모바일 skeleton 작업을 안전하게 시작할 수 있는 구조·문서·검증 기준을 남기는 것이다.

현재 구현 초안 메모:

- `apps/mobile` 에 `app.config.ts`, `src/shell.ts`, `src/base-url.ts`, `src/session-bridge.ts`, `src/screens.ts`, `README.md` 를 추가해 Expo/React Native 앱 shell 후보 구조와 7개 핵심 화면 placeholder 기준을 코드로 남겼다.
- `packages/shared/src/mobile-contracts.ts` 에 shared route/auth/session/승인 게이트 계약을 모아 Web/PWA와 모바일이 같은 제품 경계를 재사용하도록 맞췄다.
- 루트 `pnpm check` 에서 `apps/mobile` TypeScript 점검이 함께 돌도록 `@gw/mobile` typecheck 스크립트를 추가했다.

우선 참고 문서:

- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/guides/phase-17-native-mobile-transition-prep-handoff.md`
- `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md`
- `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md`
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
