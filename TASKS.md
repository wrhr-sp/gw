# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 58 기획·fit-gap — 상태 문장, 복구 안내, 역할별 차단 레인 정리

### 메인 체인 (Phase 58 상태 문장, 복구 안내, 역할별 차단 레인 정리 묶음)
1. Phase 58 기획·fit-gap: `t_be97eac9` — 도담(`gwplanner`) — 진행 중
2. Phase 58 구현: `t_c85c5588` — 이룸(`gwbuilder`) — 부모 대기

직전 메인 체인 참고:
- Phase 57 기획 `t_e662066c` / 구현 `t_4c83b740`

## Phase 58 현재 메모

1. 이번 Phase의 목적은 홈/운영/감사 route에 흩어진 상태 문장을 실제 탐색 흐름으로 정리해, 대장이 live URL에서 `/dashboard`, `/menu`, `/management`, `/admin/users`, `/admin/audit-logs`, `/me` 를 직접 눌러 `loading`·`empty`·`error`·`forbidden`·`offline`·`dev-safe` 뜻과 복구 순서를 이어 볼 수 있게 만드는 것이다.
2. 현재 근거는 `apps/web/dashboard-page-content.tsx`, `apps/web/menu-page-content.tsx`, `apps/web/app/management/page.tsx`, `apps/web/app/admin/users/admin-users-page-content.tsx`, `apps/web/app/me/page.tsx`, `apps/web/app/_components/real-usage-panels.tsx`, `apps/web/app/_components/phase35-live-sections.tsx`, `packages/shared/src/contracts.ts`, `packages/shared/src/admin-access.ts`, `apps/web/app/mobile-pwa-config.ts` 에 걸쳐 있다.
3. 핵심은 `empty` 대 `forbidden`, `error` 대 `offline`, `preview/dev-safe` 대 `실저장 완료`를 분리하고, EMPLOYEE/MANAGER/HR_ADMIN/COMPANY_ADMIN/AUDITOR 의 첫 진입점과 차단 레인을 홈·운영·감사 화면에서 같은 언어로 잠그는 것이다.
4. 상태 문구를 컴포넌트 단위 표시에서 끝내지 않고 route/UAT/운영 가이드 기준으로 다시 잠가야 한다.
5. production DB 변경, 실제 사용자 초대 메일 발송, 실제 비밀번호 운영 전환, 외부 IdP/SSO/SAML/SCIM, secret, DNS/custom domain, 유료 리소스, native 배포, migration, destructive 작업은 계속 별도 승인 게이트다.

## Phase 58 핵심 범위

- `/dashboard`·`/menu`·`/management`·`/admin/users`·`/admin/audit-logs`·`/me` 상태 문장 정리
- `loading`·`empty`·`error`·`forbidden`·`offline`·`dev-safe` 의미와 복구 순서 정리
- 역할별 첫 진입점과 차단 레인 정리
- HR_ADMIN/COMPANY_ADMIN/MANAGER/AUDITOR/EMPLOYEE 설명 문장 정리
- 운영 허브/계정관리/감사 레인이 일반 직원 홈과 섞이지 않게 하는 설명 정리
- live URL 확인 route / UAT 질문 / 승인 게이트를 같은 패키지로 정리

현재 기준 문서 세트:
- `docs/architecture/phase-58-state-copy-recovery-role-lane-fit-gap-scope.md`
- `docs/guides/phase-58-state-copy-recovery-role-lane-handoff.md`
- `docs/guides/phase-58-state-copy-recovery-role-lane-guide.md`
- `docs/architecture/phase-57-home-dashboard-shortcuts-mobile-pc-ia-fit-gap-scope.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-handoff.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md`
- `docs/architecture/phase-56-management-admin-live-operations-pass1-fit-gap-scope.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-handoff.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`

## Phase 58 현재 검증 메모

1. 현재 query state 기준선은 `apps/web/app/_components/real-usage-panels.tsx`, `apps/web/app/_components/phase35-live-sections.tsx` 에서 이미 확인 가능하다.
2. 현재 웹 상태 문장 기준선은 `apps/web/dashboard-page-content.tsx`, `apps/web/menu-page-content.tsx`, `apps/web/app/management/page.tsx`, `apps/web/app/admin/users/admin-users-page-content.tsx`, `apps/web/app/me/page.tsx` 에 있다.
3. current route 는 `forbidden / empty / error / dev-safe`, `참고용 요약 데이터`, `내부 확인용 데이터`, `read-only personal context` 같은 문구 비중이 있어 역할별 복구 문장 정리가 추가로 필요하다.
4. 이번 Phase에서는 existing route/config 근거를 유지하면서 live URL에서 따라갈 상태 해석과 복구 순서를 더 짧고 명확하게 잠그는 것이 핵심이다.

## Phase 58 다음 우선순위

1. 구현 카드 `t_c85c5588` 에서 `/dashboard`, `/menu`, `/management`, `/admin/users`, `/me` 의 상태 카드와 복구 문장을 같은 체계로 정리
2. 후속 리뷰/테스트 카드가 생기면 `empty` 대 `forbidden`, `error` 대 `offline`, `preview/dev-safe` 대 실저장 완료 혼선 제거 여부와 역할별 첫 진입점 설명을 점검
3. 후속 문서/ops 카드가 생기면 live 확인 순서, UAT 가이드, release gate, live smoke 근거를 상태 문장/복구/차단 레인 전용 결과 형식으로 정리

### Phase 50 세부 UX 포커스 체인: 모바일 플로팅 하단바
1. 기획: `t_c2551b81` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_b05b8631` — 이룸(`gwbuilder`) — 부모 대기
3. 리뷰: `t_72fc15aa` — 바름(`gwreviewer`) — 부모 대기

세부 목표:
- 모바일 하단바를 safe-area 위 floating capsule 로 정리
- 탭 순서 `메뉴` → `홈` → `메신저` → `메일` → `알림` 유지
- active pill 강조, 알림 배지 `0 숨김 / 1~99 / 99+`, 본문 하단 padding 회귀 기준 잠그기

- 세부 기준 문서:
- `docs/architecture/phase-50-mobile-floating-bottom-bar-ux-fit-gap-scope.md`
- `docs/guides/phase-50-mobile-floating-bottom-bar-ux-handoff.md`
- `docs/guides/phase-50-mobile-floating-bottom-bar-ux-guide.md`

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/menu`
- 필요 시 `/management`
- 필요 시 `/admin/users`
- 필요 시 `/admin/audit-logs`
- `/me`
- `/offline`
- `docs/guides/phase-58-state-copy-recovery-role-lane-guide.md`
- `docs/guides/phase-58-state-copy-recovery-role-lane-handoff.md`

## Phase 58 승인 게이트

- production DB 실데이터 변경
- 실제 사용자 초대 메일 발송
- 실제 비밀번호 운영 전환
- 외부 IdP/SSO/SAML/SCIM
- native 앱 배포
- production backup/restore 실행
- 실제 incident paging / 외부 alerting / SIEM 연동
- DNS/custom domain
- 유료 리소스
- secret 입력/교체
- migration
- destructive 작업

우선 참고 문서:
- `docs/architecture/phase-48-audit-security-backup-restore-incident-ops-fit-gap-scope.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-handoff.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-guide.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/guides/phase-47-operational-stability-performance-mobile-pwa-usability-handoff.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
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