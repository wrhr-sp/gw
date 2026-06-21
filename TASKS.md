# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 61 문서화 — 운영 DB runbook·secret/backup/restore·운영자 인수인계 정리

### 메인 체인 (Phase 61 운영 DB 체크리스트 묶음)
1. Phase 61 상위 기획/범위 정리: `t_f3cf90f4` — 도담(`gwplanner`) — 완료
2. Phase 61 문서화: `t_7c7abb8e` — 다온(`gwdocs`) — 진행 중
3. Phase 61 후속 문서 보강(runbook·secret/backup/restore·운영자 인수인계): `t_bf1c0dcc` — 다온(`gwdocs`) — 진행 중

직전 메인 체인 참고:
- Phase 60 문서화 `t_b1cf2c7c`
- Phase 60 GitHub PR/CI/merge/배포 확인 `t_75b2172c`

## Phase 61 현재 메모

1. 이번 Phase의 목적은 운영 DB 관련 흩어진 문서(`db/postgres/README.md`, `docs/architecture/operational-db-initial-setup.md`, `docs/architecture/operational-db-target-architecture.md`, `docs/guides/phase-61-operational-db-provider-cost-approval-checklist.md`, `docs/guides/phase-61-operational-db-secret-cloudflare-rollback-runbook.md`, `docs/guides/phase-61-operational-db-admin-handoff-checklist.md`, `KNOWN_ISSUES.md`, `HANDOFF.md`, `RUNBOOK.md`)를 대장이 한 번에 읽을 수 있는 사용자/운영 체크리스트로 다시 묶는 것이다.
2. 현재 권장 조합은 `Neon PostgreSQL 1개 + Cloudflare R2 + PostgreSQL Full Text Search` 다.
3. Redis/Meilisearch 는 초기 고정비 절감을 위해 보류하고, 필요 시 중기 카드로 분리한다.
4. provider 비교는 Neon 우선 / Supabase 대체 후보 수준으로만 짧게 유지한다.
5. secret 은 채팅/로그/커밋에 남기지 않고 git ignored `.secrets` 또는 승인된 secret store 로만 전달한다.
6. 앱 runtime DB URL 해석 규칙은 `DATABASE_URL` 우선, 없으면 `APP_ENV=preview` 에서 `DATABASE_URL_PREVIEW`, 그 외에는 `DATABASE_URL_PRODUCTION` 이다.
7. migration/seed 스크립트는 runtime 과 분리한다. preview target 은 `DATABASE_URL_PREVIEW` 우선이고 수동 preview/local 범위에서만 `--allow-preview-fallback` 으로 `DATABASE_URL` fallback 가능하다. production target 은 `DATABASE_URL_PRODUCTION` 필수이며 `DATABASE_URL` fallback 은 금지한다.
8. `workers.dev` 또는 preview 배포는 preview DB 기준으로, 승인된 custom domain 또는 production 배포 후보는 production DB 기준 후보로 읽는다. production migration/seed 는 host 이름과 무관하게 `DATABASE_URL_PRODUCTION` 없으면 실행하지 않는다.
9. Cloudflare/Workers 첫 연결은 Worker secret 주입 + 현재 Neon serverless driver 경로 유지 기준으로 적고, Hyperdrive 는 초기 필수값으로 고정하지 않는다.
10. rollback 문장은 code rollback 과 DB rollback 을 분리해서 적고, DB rollback 은 destructive down migration 보다 snapshot restore 또는 forward-fix 우선으로 적는다.
11. provider 최종 선택, 실제 connection string 제공, 유료 리소스 생성·증설, production migration, 민감정보 원문 저장 확대, 외부기관 연동, DNS/custom domain, destructive 작업은 계속 별도 승인 게이트다.
12. `DB 연결 성공` 과 `권한/API guard·audit·backup/restore·rollback·live smoke 확인 완료` 는 같은 완료 문장으로 적지 않는다.

## Phase 61 핵심 범위

- 운영 DB provider 선택 문구 정리
- 비용 절감 원칙 정리
- secret 입력 규칙 정리
- backup/restore/rollback 운영자 handoff 정리
- 승인 체크리스트 정리
- 다음 단계 체크리스트 정리
- 미정 사항 표 정리
- root 문서(HANDOFF/KNOWN_ISSUES/TEST_PLAN/TASKS) 최소 동기화

현재 기준 문서 세트:
- `docs/guides/phase-61-operational-db-provider-cost-approval-checklist.md`
- `docs/guides/phase-61-operational-db-secret-cloudflare-rollback-runbook.md`
- `docs/guides/phase-61-operational-db-admin-handoff-checklist.md`
- `db/postgres/README.md`
- `docs/architecture/operational-db-initial-setup.md`
- `docs/architecture/operational-db-target-architecture.md`
- `RUNBOOK.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`
- `TEST_PLAN.md`

## Phase 61 다음 우선순위

1. provider 최종 선택과 secret 전달 경로를 사용자 승인 질문으로 바로 재사용할 수 있게 유지
2. connection string 제공 이후에는 `pnpm db:pg:check` → 연결 확인 → migration 승인 여부 분리 순서로 후속 카드 연결
3. restore 후 최소 smoke 와 운영자 handoff 질문을 runbook/HANDOFF/최종 통합 보고에서 같은 언어로 유지
4. Redis/Meilisearch 는 실제 병목이 확인되기 전까지 초기 범위에 다시 끼워 넣지 않기

## 병행 설계 메모: 관리자설정 2차 비밀번호 서버 검증/운영 정책

1. 현재 기준 문서는 `docs/architecture/admin-settings-secondary-password-server-policy.md`, `docs/guides/admin-settings-secondary-password-server-policy-handoff.md`, `docs/guides/unified-settings-secondary-password-preview-flow.md` 다.
2. 현재 웹 구현은 `apps/web/app/_components/mobile-app-shell.tsx` 안의 local state(`secondaryPasswordValue`, `isAdminSettingsUnlocked`)로만 동작하는 preview 단계다.
3. 현재 preview UX 기준은 설정 관련 진입점 공통 게이트 → 4칸 네모형 PIN UI → 통합설정 첫 탭 `기본 설정` 유지 → `내정보 설정` 안 `2차 비밀번호 변경하기` 버튼 배치다.
4. 관리자설정 우상단 `2차 비밀번호 변경` 버튼은 최신 기준에서 폐기했다.
5. 운영 버전 목표는 사용자별 해시 저장 + 짧은 재인증 세션 + 보호 API 재검증 + 실패 횟수 제한 + 감사 로그다.
6. preview 사용자 설명과 운영 보안 완료를 같은 말로 적지 않는다. 현재 범위는 UI/state 기반 흐름 설명까지다.
7. 분실 복구는 외부 본인확인 채널이 아직 정식 범위가 아니므로 자동 self-service 보다 운영자 승인형 초기화 우선이 안전하다.
8. DB migration, hash 알고리즘 확정, pepper secret, production rollout, 실데이터 변경은 별도 승인 게이트다.
9. 권장 후속 체인은 승인 정리 → 서버 구현 → 웹 연동 → 보안 리뷰 → 테스트 → 문서화 순서다.

## 병행 설계 메모: 관리자설정 접근권한/관리자 권한 탭 분리

1. 현재 기준 문서는 `docs/architecture/admin-settings-access-admin-permission-tabs-scope.md`, `docs/guides/admin-settings-access-admin-permission-tabs-handoff.md` 다.
2. 이번 분리는 통합설정 상단 `기본 설정` / `관리자설정` 구조를 바꾸는 작업이 아니라, `관리자설정` 내부에서 `접근권한` / `관리자 권한` 하위 탭을 나누는 작업이다.
3. `접근권한` 은 메뉴/화면/데이터를 조회·열람·진입할 수 있는 권한으로 읽는다.
4. `관리자 권한` 은 사용자/조직/권한/보안/감사 관련 운영 기능을 변경·부여·관리할 수 있는 권한으로 읽는다.
5. 같은 주제라도 read 와 manage 를 나눠 적는다. 예: 감사 로그 열람은 `접근권한`, 감사/보안 운영 관리는 `관리자 권한` 이다.
6. 현재 `mobile-app-shell.tsx` 안 preview 토글 4개는 의미를 재배치해 쓰되 local state 범위를 넘지 않는다.
7. 설정 진입 전 2차 비밀번호 4칸 PIN 게이트, 통합설정 첫 탭 `기본 설정`, `내정보 설정` 안 `2차 비밀번호 변경하기`, 관리자설정 우상단 폐기 버튼 유지 기준은 깨지지 않아야 한다.
8. 실제 권한 저장, 서버 API, DB, migration, 감사 로그 운영 반영, secret, production 변경은 이번 범위 밖이다.

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

### 기능 페이지 제목 클릭 기본 route 복귀 UX 체인
1. 기획: `t_583d4702` — 도담(`gwplanner`) — 완료 예정
2. 구현: `t_973331a0` — 이룸(`gwbuilder`) — 부모 대기
3. 리뷰: `t_a20e8bd3` — 바름(`gwreviewer`) — 부모 대기
4. 테스트: `t_1fe587a8` — 해봄(`gwtester`) — 부모 대기
5. 문서화: `t_200f14cc` — 다온(`gwdocs`) — 부모 대기

세부 기준 문서:
- `docs/guides/page-title-reset-initial-route-ux-handoff.md`

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
