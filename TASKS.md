# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 57 기획·fit-gap — 홈·대시보드 분리, 고정/커스텀 바로가기, 모바일/PC IA 정리

### 메인 체인 (Phase 57 홈·대시보드 분리, 고정/커스텀 바로가기, 모바일/PC IA 정리 묶음)
1. Phase 57 기획·fit-gap: `t_e662066c` — 도담(`gwplanner`) — 진행 중
2. Phase 57 구현: `t_4c83b740` — 이룸(`gwbuilder`) — 부모 대기

직전 메인 체인 참고:
- Phase 55 기획 `t_14966b8c` / 구현 `t_0c6e5a3d` / 리뷰 `t_0ff86f94` / 테스트 `t_c1cd2dec` / 문서화 `t_6a0f7311` / GitHub·배포 후속 `t_34df084c`

## Phase 57 현재 메모

1. 이번 Phase의 목적은 홈/메뉴 route와 shortcut/navigation 기준선을 실제 탐색 흐름으로 정리해, 대장이 live URL에서 `/dashboard` 와 `/menu` 를 직접 눌러 홈과 메뉴의 역할 차이, 회사 공통 고정 바로가기, 권한 기반 사용자 전용 바로가기, 모바일 하단 탭 5개, PC sidebar, 운영/감사/경영업무 분리 노출을 이어 볼 수 있게 만드는 것이다.
2. 현재 근거는 `apps/web/app/dashboard/page.tsx`, `apps/web/app/dashboard/dashboard-config.ts`, `apps/web/app/menu/page.tsx`, `apps/web/menu-page-content.tsx`, `apps/web/app/_components/home-shortcuts-panel.tsx`, `apps/web/home-shortcuts.ts`, `apps/web/app/mobile-pwa-config.ts`, `packages/shared/src/contracts.ts`, `packages/shared/src/admin-access.ts`, `packages/shared/src/mobile-contracts.ts` 에 걸쳐 있다.
3. 핵심은 `/dashboard` 홈 lane, `/menu` 전체 탐색 lane, 회사 공통 고정 shortcut lane, 권한 기반 사용자 전용 shortcut lane, 모바일 하단 탭과 PC sidebar IA 책임을 분리하고, `/management`·`/admin/users`·`/admin/audit-logs` 운영 레인이 일반 직원 홈과 섞이지 않게 같은 언어로 잠그는 것이다.
4. empty/loading/error/forbidden/offline/dev-safe 상태를 컴포넌트 단위 표시에서 끝내지 않고 route/UAT 기준으로 다시 잠가야 한다.
5. production DB 기반 영구 개인 커스터마이징 저장, secret, DNS/custom domain, 유료 리소스, 외부 메신저/메일/푸시 연동, native 배포, migration, destructive 작업은 계속 별도 승인 게이트다.

## Phase 57 핵심 범위

- `/dashboard` 홈과 `/menu` 전체 메뉴 책임 분리 정리
- 회사 공통 고정 바로가기와 권한 기반 사용자 전용 바로가기 정책 정리
- 모바일 하단 탭 5개와 PC sidebar 의 같은 IA 기준 정리
- 관리자/일반 직원/감사 담당자별 UI/route/API/shortcut 노출 기준 정리
- 홈 CTA 와 `/management`·`/admin/users`·`/admin/audit-logs` 운영 레인 분리 설명 정리
- empty/loading/error/forbidden/offline/dev-safe 상태 문장과 UAT 확인 순서 정리
- live URL / 홈·메뉴 확인 route / 승인 게이트를 같은 패키지로 정리

현재 기준 문서 세트:
- `docs/architecture/phase-57-home-dashboard-shortcuts-mobile-pc-ia-fit-gap-scope.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-handoff.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md`
- `docs/architecture/phase-56-management-admin-live-operations-pass1-fit-gap-scope.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-handoff.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`

## Phase 57 현재 검증 메모

1. 현재 API/contract/access 기준선은 `packages/shared/src/contracts.ts`, `packages/shared/src/admin-access.ts`, `packages/shared/src/mobile-contracts.ts` 에서 shortcut schema, 권한 기반 노출, 모바일 route mapping 을 이미 확인 가능하다.
2. 현재 웹 기준선은 `apps/web/app/dashboard/dashboard-config.ts`, `apps/web/menu-page-content.tsx`, `apps/web/app/_components/home-shortcuts-panel.tsx`, `apps/web/home-shortcuts.ts`, `apps/web/app/mobile-pwa-config.ts` 에 있다.
3. current route 는 내부 검증용 `Phase 31`, `placeholder honesty`, `same 정보구조`, `권한 기반 사용자 전용` 문구 비중이 있어 실사용 운영 문장 정리가 추가로 필요하다.
4. 이번 Phase에서는 existing route/config 근거를 유지하면서 live URL에서 따라갈 홈/메뉴 실사용 탐색 순서를 더 짧고 명확하게 잠그는 것이 핵심이다.

## Phase 57 다음 우선순위

1. 구현 카드 `t_4c83b740` 에서 `/dashboard`, `/menu`, 홈 바로가기, 하단 탭, PC/sidebar, 운영 CTA 의 역할별 happy path 와 lane 분리 문장 정리
2. 후속 리뷰/테스트 카드가 생기면 홈/메뉴 같은 registry 사용, 권한 없는 운영 shortcut 비노출, 모바일/PC 같은 IA, empty/loading/error/forbidden/offline/dev-safe 누락을 점검
3. 후속 문서/ops 카드가 생기면 live 확인 순서, 사용자/UAT 가이드, release gate, live smoke 근거를 홈·메뉴 IA 전용 결과 형식으로 정리

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
- 회사 공통 고정 바로가기 영역
- 권한 기반 사용자 전용 바로가기 영역
- `/menu`
- 하단 탭 5개 설명
- 필요 시 `/management`
- 필요 시 `/admin/users`
- 필요 시 `/admin/audit-logs`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-handoff.md`

## Phase 57 승인 게이트

- production DB 실데이터 기반 개인 홈 커스터마이징 영구 저장
- 회사 정책 편집 UI로 고정 메뉴 즉시 변경
- 외부 메신저/메일/푸시/SMS 연동
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