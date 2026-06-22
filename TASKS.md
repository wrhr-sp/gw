# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 60 문서화 — 실사용 1차 내부 사용 릴리즈 노트·사용자/관리자 인수인계

### 메인 체인 (Phase 60 실사용 1차 내부 사용 릴리즈 묶음)
1. Phase 60 문서화: `t_b1cf2c7c` — 다온(`gwdocs`) — 진행 중
2. Phase 60 GitHub PR/CI/merge/배포 확인: `t_75b2172c` — 지킴(`gwops`) — 부모 대기

직전 메인 체인 참고:
- Phase 60 통합 UAT 재검증 `t_df86f058`
- Phase 59 문서화 `t_1122b615`

## Phase 60 현재 메모

1. 이번 Phase의 목적은 Phase 59에서 최종 정리한 UAT·사용자/관리자 가이드·도입 체크리스트를 "실사용 1차 내부 사용 릴리즈" 문장으로 다시 묶는 것이다.
2. 현재 근거는 `docs/guides/phase-59-uat-user-admin-adoption-guides-final.md`, `docs/guides/phase-44-employee-user-guide.md`, `docs/guides/phase-44-admin-manager-guide.md`, `docs/guides/phase-44-adoption-checklist.md`, `docs/guides/phase-58-state-copy-recovery-role-lane-guide.md`, `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md`, `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md` 에 걸쳐 있다.
3. 핵심은 live URL에서 대장이 직접 눌러볼 route, 역할별 happy path, 상태 문장 해석, 승인 게이트를 release note + user/admin handoff 형식으로 한 번에 넘기는 것이다.
4. `/dashboard` 대 `/menu` 책임 분리, HR_ADMIN 다음 레인 `/admin/users`, COMPANY_ADMIN/MANAGER 운영 허브 `/management`, AUDITOR 시작점 `/admin/audit-logs`, `/me` 세션·개인 확인 해석을 같은 언어로 유지해야 한다.
5. production DB 변경, 실제 사용자 초대 메일 발송, 실제 비밀번호 운영 전환, 외부 IdP/SSO/SAML/SCIM, 실제 급여 지급, secret, DNS/custom domain, 유료 리소스, migration, destructive 작업은 계속 별도 승인 게이트다.

## Phase 60 핵심 범위

- 실사용 1차 내부 사용 릴리즈 노트 작성
- 사용자/관리자 인수인계 문장 정리
- live URL 직접 확인용 route·액션 정리
- 역할별 happy path / 차단 레인 / 상태 문장 해석 정리
- mock/dev-safe/read-only 잔여와 승인 게이트 정리
- 후속 ops 카드가 PR/CI/merge/배포 확인에 그대로 재사용할 수 있는 evidence 문장 정리

현재 기준 문서 세트:
- `docs/guides/phase-60-first-real-usage-release-notes-user-admin-handoff.md`
- `docs/guides/phase-59-uat-user-admin-adoption-guides-final.md`
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-adoption-checklist.md`
- `docs/guides/phase-58-state-copy-recovery-role-lane-guide.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`

## Phase 60 현재 검증 메모

1. parent tester 재검증 기준으로 focused web 28 files / 123 tests, shared/api/web typecheck, Next build, Cloudflare build, root `pnpm check` 가 통과했다.
2. 역할별 현재 UAT 레인 기준은 아래와 같다.
   - EMPLOYEE: `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`
   - HR_ADMIN: `/dashboard` → `/admin/users` → `/employees` → `/org` → `/me`
   - COMPANY_ADMIN: `/dashboard` → `/admin/users` → `/employees` → `/org` → `/management`
   - MANAGER: `/dashboard` → `/management` → `/payroll` → `/work-items/tax` → `/work-items/legal` → `/me`
   - AUDITOR: `/admin/audit-logs` → `/documents` → `/me`
3. 이번 Phase 문서화에서는 이 검증 명령을 다시 실행하는 것이 아니라, release note·handoff 에서 바로 옮겨 적을 route, 상태 문장, 승인 게이트를 쉽게 다시 묶는 것이 핵심이다.
4. 최종 사용자 보고에서는 live 직접 확인과 parent tester/local build/test 근거를 분리해서 적어야 한다.

## Phase 60 다음 우선순위

1. 새 Phase 60 문서에 대장이 직접 눌러볼 route와 액션, happy path, 차단 질문을 한 번에 정리
2. 후속 ops 카드 `t_75b2172c` 에서 PR/CI/merge/배포 확인 시 이 문서를 release evidence 로 재사용
3. 최종 통합 보고 단계에서 live URL, 테스트 계정 기준, 역할별 추천 route, mock/dev-safe 잔여, 승인 게이트를 문서 단위로 바로 재사용할 수 있게 유지

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
- HR_ADMIN 이면 `/admin/users`
- COMPANY_ADMIN/MANAGER 이면 `/management`
- 필요 시 `/payroll`
- 필요 시 `/work-items/tax`
- 필요 시 `/work-items/legal`
- 필요 시 `/admin/audit-logs`
- `/me`
- `docs/guides/phase-60-first-real-usage-release-notes-user-admin-handoff.md`
- `docs/guides/phase-59-uat-user-admin-adoption-guides-final.md`

## Phase 60 승인 게이트

- production DB 실데이터 변경
- 실제 사용자 초대 메일 발송
- 실제 비밀번호 운영 전환
- 외부 IdP/SSO/SAML/SCIM
- 실제 급여 지급/은행 이체
- production backup/restore 실행
- 실제 incident paging / 외부 alerting / SIEM 연동
- DNS/custom domain
- 유료 리소스
- secret 입력/교체
- migration
- destructive 작업

우선 참고 문서:
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `ROADMAP.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
