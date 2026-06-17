# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 47 기획·fit-gap — 운영 안정성·성능·모바일/PWA 사용성 보강

### 메인 체인 (Phase 47 운영 안정성·성능·모바일/PWA 사용성 보강 묶음)
1. Phase 46 최종 통합 보고 — 완료
2. Phase 47 기획·fit-gap: `t_b1e8800c` — 도담(`gwplanner`) — 진행 중
3. Phase 47 구현: `t_3dfc46d5` — 이룸(`gwbuilder`) — 부모 대기

## Phase 47 현재 메모

1. 이번 Phase의 목적은 Phase 46 온보딩 기준선 위에서 `/dashboard`·`/menu`·`/notifications`·`/offline`·`/management`·`/admin/users`·`/admin/audit-logs` 를 회사 전체 사용 직전의 안정성/로딩/재시도/모바일 사용성 기준으로 다시 묶는 것이다.
2. 현재 근거는 `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/app/mobile-pwa-config.ts`, `apps/web/app/_components/mobile-app-shell.tsx`, `apps/web/app/_components/home-shortcuts-panel.tsx`, `apps/web/menu-page-content.tsx`, `apps/web/app/offline/page.tsx`, `apps/web/app/attendance/page.tsx`, `apps/web/app/me/page.tsx`, `apps/web/app/admin/users/admin-users-page-content.tsx`, `apps/web/app/_components/real-usage-panels.tsx`, `apps/api/src/app.ts`, `packages/shared/src/contracts.ts`, `packages/shared/src/mobile-contracts.ts` 에 걸쳐 있다.
3. 핵심은 로그인 필수 진입, 공통 landing(`/dashboard`), 모바일 하단 탭/PC sidebar 같은 정보구조, 오프라인 honesty, 운영 레인 분리를 같은 언어로 잠그는 것이다.
4. 단순 화면 소개가 아니라 empty/error/forbidden/offline/dev-safe 문장, route guard, API guard, host 경계, capability 경계, installability 대 offline 제약 분리를 함께 읽히게 해야 한다.
5. 외부 push/SMS/메일, background sync, native 배포, production 비밀번호/실데이터, DNS/custom domain, 유료 리소스, secret, migration, destructive 작업은 계속 별도 승인 게이트다.

## Phase 47 핵심 범위

- 홈/메뉴/알림/오프라인의 체감 안정성 문장 정리
- 모바일 하단 탭/PC sidebar/PWA 설치 기대치 정리
- empty/error/forbidden/offline/dev-safe 상태 문장 분리
- 일반 직원 홈 대 운영 허브/감사 레인 분리 재강조
- live 직접 확인 근거와 local preview/build/release gate 대체 근거 분리

현재 기준 문서 세트:
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/guides/phase-47-operational-stability-performance-mobile-pwa-usability-handoff.md`
- `docs/guides/phase-47-user-admin-uat-ops-guide.md`
- `docs/architecture/phase-46-account-permission-organization-onboarding-rehearsal-fit-gap-scope.md`
- `docs/guides/phase-46-account-permission-organization-onboarding-rehearsal-handoff.md`

## Phase 47 현재 검증 메모

1. 직전 parent 기준으로 focused API 15 files / 98 passed / 4 skipped, focused web 24 files / 102 passed, mobile typecheck, web build 가 모두 통과한 상태를 Phase 47 baseline 으로 이어받는다.
2. 기존 local preview smoke 기준 익명 내부 route `/login` redirect, `/login` 200, `/api/health` 200, `/manifest.webmanifest` 200 기준을 계속 유지한다.
3. 현재 구현에는 general/admin manifest split, mobile app shell, offline guidance, home shortcut panel, admin/offline boundary, `/admin/users` dev-safe 운영 검토 화면이 이미 존재한다.
4. parent 최종 통합 보고 기준 live URL 은 `https://gw-web.werehere31.workers.dev`, main release-gate 는 success, merge commit 은 `8cb631709a27d4cf73bcd198a9c6e3dafc47e1b9` 다.

## Phase 47 다음 우선순위

1. 구현 카드에서 홈/메뉴/알림/오프라인/운영 레인의 상태 문장과 모바일/PWA 체감 사용성을 더 또렷하게 정리
2. 리뷰/테스트 카드에서 empty/error/forbidden/offline/dev-safe 혼동, host/route/API 경계, installability 과장 금지를 재검증
3. 문서화/ops 카드에서 live URL, 테스트 계정, 모바일/PWA 확인 순서, 오프라인 honesty, release gate 근거를 최종 보고 형식으로 잠그기

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/menu`
- `/notifications`
- `/offline`
- `/management`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`

## Phase 47 승인 게이트

- 외부 push/SMS/메일 발송
- background sync
- native 앱스토어 배포
- production custom domain/app link
- 실제 계정 초대 발송 / 외부 IdP 연동
- production DB 실데이터
- DNS/custom domain
- 유료 리소스
- secret 입력/교체
- migration
- destructive 작업

우선 참고 문서:
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/guides/phase-47-operational-stability-performance-mobile-pwa-usability-handoff.md`
- `docs/architecture/phase-46-account-permission-organization-onboarding-rehearsal-fit-gap-scope.md`
- `docs/guides/phase-46-account-permission-organization-onboarding-rehearsal-handoff.md`
- `ROADMAP.md`
- `HANDOFF.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```