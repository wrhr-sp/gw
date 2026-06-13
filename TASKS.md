# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 18 네이티브 모바일앱 핵심 업무 연결 1차

현재 체인:

1. 기획: `t_12e8c740` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_ab72e505` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_6bf3ed03` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: `t_d3c80f21` — 해봄(`gwtester`) — parent gate 대기
5. 문서화: `t_a857f10b` — 다온(`gwdocs`) — parent gate 대기
6. GitHub/배포 확인: `t_545761da` — 지킴(`gwops`) — parent gate 대기

현재 문서 기준 핵심 범위:

- Phase 17에서 만든 `apps/mobile` skeleton과 `packages/shared/src/mobile-contracts.ts` 계약을 바탕으로 모바일 핵심 업무 흐름을 1차로 연결한다.
- 로그인 → 대시보드 → 출퇴근/휴가/결재함 → 공지·문서 → 내 정보 순서가 한 흐름으로 읽히게 한다.
- 각 핵심 화면의 API contract 연결과 offline/error/empty/forbidden 상태 안내 기준을 정리한다.
- PWA와 네이티브 앱의 차이는 실행 환경과 연결 방식 차이로 문서화하되, role/scope/auth 경계는 공통 계약으로 유지한다.
- `/admin/*` 운영 화면, App Store/Play Console/TestFlight/EAS, push, 실기기 권한, secret, custom domain, production data 는 계속 별도 승인 게이트로 분리한다.
- 성공 기준은 store 배포가 아니라 다음 구현자가 모바일 초안에서 핵심 업무 route 를 한 번 따라가고 검증 근거를 남길 수 있게 만드는 것이다.

현재 구현/기획 메모:

- `apps/mobile/src/screens.ts`, `src/shell.ts`, `src/session-bridge.ts`, `src/base-url.ts` 와 `packages/shared/src/mobile-contracts.ts` 가 이미 7개 핵심 화면, session guardrail, base URL policy, route mapping 기준을 담고 있다.
- 이번 Phase 18에서는 여기에 화면별 상태 분류(offline/error/empty/forbidden), API contract 연결, 일반 사용자/승인자 첫 액션 차이, PWA 대 네이티브 차이를 더 분명히 맞춘다.
- 리뷰/테스트/문서화는 `pnpm --filter @gw/mobile typecheck`, `pnpm check`, shared contract 검증, 필요 시 `pnpm --filter @gw/web build:cf` 근거까지 같이 남기는 방향으로 이어간다.

우선 참고 문서:

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
