# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 22 실제 업무 흐름 통합 1차

현재 체인:

1. 기획: `t_343f2b2f` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_48cb8d28` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_e66f56b7` — 바름(`gwreviewer`) — builder 완료 대기
4. 테스트: `t_8582cd5f` — 해봄(`gwtester`) — review 완료 대기
5. 후속 문서화/운영/최종 보고 카드는 같은 기준으로 이어진다.

현재 문서 기준 핵심 범위:

- 로그인/session placeholder 와 핵심 업무 route 를 한 흐름으로 다시 묶는다.
- 기준 순서는 `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees` 다.
- `/dashboard` 상단 액션과 실제 업무 화면 설명이 같은 순서와 같은 언어를 가리키게 맞춘다.
- empty/error/forbidden/offline 상태 안내를 실제 사용자 언어로 정리하되 의미를 섞지 않는다.
- mobile/PWA/Web 이 같은 route/auth/session contract 를 가리키는지 비교 검증한다.
- `/admin/*` 운영 화면은 일반 직원 하루 흐름에 섞지 않고 별도 운영 확인 포인트로 유지한다.
- production data, secret, external HR, GPS/실태그, 실권한 변경, 외부 배포는 계속 별도 승인 게이트로 분리한다.

현재 구현/기획 메모:

- `apps/web/app/login/page.tsx`, `apps/web/app/dashboard/page.tsx`, `apps/web/app/attendance/page.tsx`, `apps/web/app/leave/page.tsx`, `apps/web/app/approvals/page.tsx`, `apps/web/app/boards/page.tsx`, `apps/web/app/documents/page.tsx`, `apps/web/app/me/page.tsx`, `apps/web/app/org/page.tsx`, `apps/web/app/employees/page.tsx` 가 현재 Web 흐름의 핵심 근거다.
- `packages/shared/src/mobile-contracts.ts`, `apps/mobile/src/workflow.ts`, `apps/mobile/src/session-bridge.ts`, `apps/mobile/src/base-url.ts` 가 mobile/PWA 비교의 핵심 근거다.
- 리뷰/테스트/문서화는 직원 하루 흐름이 끊기지 않는지, 상태 안내 4축이 같은 뜻인지, `/admin/*` 운영 경계와 승인 게이트가 문서마다 같은지 확인하는 방향으로 이어간다.

우선 참고 문서:

- `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md`
- `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md`
- `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md`
- `docs/guides/phase-21-real-company-settings-model-pass-1-handoff.md`
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
