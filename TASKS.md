# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 20 운영 전 정리 1차

현재 체인:

1. 기획: `t_21c0a0ef` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_e974df14` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_08b80078` — 바름(`gwreviewer`) — builder 완료 대기
4. 후속 테스트/문서화/운영 카드는 review handoff 확정 뒤 같은 기준으로 이어간다.

현재 문서 기준 핵심 범위:

- 지금까지 쌓인 preview/skeleton 결과물을 실제 운영 전 점검표 관점으로 다시 정리한다.
- 되는 것 / 아직 skeleton 인 것 / 별도 승인 필요 항목을 문서·화면·검증 기준에서 같은 언어로 맞춘다.
- live/PWA/API/mobile 확인 포인트를 각 축으로 보되 최종 결론은 하나의 readiness 표처럼 읽히게 만든다.
- 로그인 이후 핵심 업무 흐름과 `/admin/*` 운영 경계는 유지하되, 운영 완료처럼 읽히는 표현을 줄인다.
- App Store/Play Console/TestFlight/EAS, push, 실기기 권한, secret, custom domain, production data, 외부 초대/실연동은 계속 별도 승인 게이트로 분리한다.
- 성공 기준은 실제 운영 개시가 아니라 대장이 현재 저장소 기준의 운영 준비 상태를 오해 없이 판정할 수 있게 만드는 것이다.

현재 구현/기획 메모:

- `apps/mobile/src/workflow.ts`, `src/session-bridge.ts`, `src/base-url.ts`, `packages/shared/src/mobile-contracts.ts` 는 여전히 mobile guardrail 의 핵심 근거다.
- 이번 Phase 20에서는 mobile readiness 설명을 유지하되, 전체 서비스 운영 전 정리(Web/PWA/API/admin 포함) 안에 다시 배치한다.
- 리뷰/테스트/문서화는 `pnpm check`, `pnpm --filter @gw/mobile typecheck`, 필요 시 `pnpm --filter @gw/web build:cf` 근거와 함께 "되는 것 / 아직 안 되는 것 / 승인 필요" 분류가 문서마다 같은지 확인하는 방향으로 이어간다.

우선 참고 문서:

- `docs/architecture/phase-20-pre-operations-alignment-pass-1-scope.md`
- `docs/guides/phase-20-pre-operations-alignment-pass-1-handoff.md`
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
