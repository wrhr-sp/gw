# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 59 문서화 — UAT·사용자/관리자 가이드·도입 체크리스트 최종 정리

### 메인 체인 (Phase 59 UAT·사용자/관리자 가이드 최종 정리 묶음)
1. Phase 59 문서화: `t_1122b615` — 다온(`gwdocs`) — 진행 중
2. Phase 59 GitHub PR/CI/merge/배포 확인: `t_20a0bf84` — 지킴(`gwops`) — 부모 대기

직전 메인 체인 참고:
- Phase 58 테스트 재검증 `t_41b3af20`

## Phase 59 현재 메모

1. 이번 Phase의 목적은 Phase 44 문서 세트를 최신 홈/메뉴 IA, 상태 문장, 역할별 차단 레인 기준에 맞춰 최종 사용자 문서 묶음으로 다시 잠그는 것이다.
2. 현재 근거는 `docs/guides/phase-44-employee-user-guide.md`, `docs/guides/phase-44-admin-manager-guide.md`, `docs/guides/phase-44-adoption-checklist.md`, `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md`, `docs/guides/phase-58-state-copy-recovery-role-lane-guide.md`, `packages/shared/src/contracts.ts`, `packages/shared/src/admin-access.ts`, `apps/web/app/mobile-pwa-config.ts` 에 걸쳐 있다.
3. 핵심은 `/dashboard` 대 `/menu` 책임 분리, HR_ADMIN/COMPANY_ADMIN/MANAGER/AUDITOR/EMPLOYEE 역할별 다음 레인, `empty` 대 `forbidden`, `error` 대 `offline`, `preview/dev-safe` 대 `실저장 완료`를 문서 한 세트에서 같은 언어로 유지하는 것이다.
4. 사용자/관리자/도입 체크리스트 문서가 Phase 56~58 최신 기준과 어긋나지 않도록 다시 연결해야 한다.
5. production DB 변경, 실제 사용자 초대 메일 발송, 실제 비밀번호 운영 전환, 외부 IdP/SSO/SAML/SCIM, secret, DNS/custom domain, 유료 리소스, native 배포, migration, destructive 작업은 계속 별도 승인 게이트다.

## Phase 59 핵심 범위

- 직원용 사용자 가이드 최종 정리
- 관리자/담당자 가이드 최종 정리
- 도입 체크리스트 최종 정리
- `/dashboard` 대 `/menu` 책임 분리 반영
- 역할별 landing / 다음 레인 / 차단 레인 정리
- 상태 문장 해석과 승인 게이트를 최종 사용자 문장으로 연결

현재 기준 문서 세트:
- `docs/guides/phase-59-uat-user-admin-adoption-guides-final.md`
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-adoption-checklist.md`
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

## Phase 59 현재 검증 메모

1. parent tester 재검증 기준으로 focused web 28 files / 122 tests, web typecheck, web build, Cloudflare build, local preview role-cookie smoke 가 통과했다.
2. local preview 기준 `/uat`, `/menu`, `/me`, `/management`, `/admin/users`, `/admin/audit-logs`, `/api/health` 와 UAT 가이드 링크 노출/권한 차단이 다시 확인됐다.
3. 이번 Phase에서는 이 검증 근거를 다시 실행하는 것이 아니라, 사용자-facing 문서에 route 순서, 상태 해석, 승인 게이트를 쉽게 다시 묶는 것이 핵심이다.
4. 최종 사용자 보고에서는 live 직접 확인과 parent tester 재검증 근거를 분리해서 적어야 한다.

## Phase 59 다음 우선순위

1. 직원용/관리자용/도입 체크리스트 문서가 최신 홈·메뉴·상태 문장 기준과 같은 언어를 쓰는지 다시 점검
2. 후속 ops 카드 `t_20a0bf84` 에서 PR/CI/merge/배포 확인 시 이 문서 묶음을 release evidence 와 연결
3. 최종 통합 보고 단계에서 대장이 직접 누를 route, 테스트 계정 기준, 아직 mock/dev-safe 인 부분, 승인 게이트를 문서 단위로 바로 재사용할 수 있게 유지

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

## Phase 59 승인 게이트

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