# HANDOFF

## 다음 세션/다음 봇이 먼저 볼 것

1. `AGENTS.md` — 실행 규칙과 금지사항
2. `VISION.md` — 제품 방향
3. `ROADMAP.md` — Phase 순서
4. `TASKS.md` — 현재 Kanban 체인
5. `KNOWN_ISSUES.md` — 남은 리스크
6. `RUNBOOK.md` — 운영/장애 대응
7. `DEPLOYMENT.md` — 배포 확인 기준

## 현재 오케스트레이션 상태

- Board: `groupware`
- Repo: `/home/wrhrgw/gw`
- Bot home: `/home/wrhrgw/gw-dev-bot`
- Orchestrator: 싱드(`singde`)
- 역할봇: 도담(`gwplanner`), 이룸(`gwbuilder`), 바름(`gwreviewer`), 해봄(`gwtester`), 다온(`gwdocs`), 지킴(`gwops`)

현재 활성 흐름은 Phase 15 운영 데이터·정책·감사 로그 연결 1차다. 관리자 정책/권한/감사 skeleton 이 직원·팀장·인사 화면과 API 허용 기준에 왜 그렇게 반영되는지 설명 가능한 연결을 고정하는 것이 이번 체인의 핵심이다.

현재 기획 상태 요약:

- 이번 Phase의 목적은 관리자 화면 안의 정책/권한/감사 기준이 일반 업무 화면과 API 허용 결과에 왜 그렇게 보이는지 연결하는 것이다.
- 일반 직원/팀장/인사/감사 역할별로 권한 부족, 회사 scope, 정책 미허용, placeholder 제한을 다른 이유로 설명할 수 있어야 한다.
- `/admin*` 는 계속 일반 업무 화면에 섞지 않고, 권한 기반 CTA 와 route/API guard 를 계속 같이 본다.
- `/attendance` 뿐 아니라 `/leave` 도 `/admin/policies` 와 같은 정책 방향을 가리켜야 한다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토, `/approvals` 결재 권한과 관리자 운영 권한은 서로 다른 역할이라는 점을 유지해야 한다.
- restricted 항목(secret, production, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 이번 체인에서도 자동 진행하지 않는다.
- 우선 참고 문서: `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`, `docs/guides/phase-15-operational-policy-audit-bridge-pass-1-handoff.md`, `docs/architecture/phase-14-real-usable-mvp-pass-1-scope.md`, `docs/architecture/phase-13-admin-console-pass-1-scope.md`, `docs/architecture/admin-role-permission-model-pass-1-scope.md`, `docs/architecture/attendance-registration-policy-pass-2-scope.md`.

2026-06-12 Phase 15 운영 데이터·정책·감사 로그 연결 1차 메모:

- 기준 흐름은 `/` → `/login` → `/dashboard` → `/attendance`/`/approvals`/`/org`/`/employees` 와 권한 기반 `/admin/*` 진입을 유지하되, 이번에는 `/leave` 를 정책 연결 보강 route로 함께 본다.
- 홈과 로그인은 제품 입구 설명을 유지하고, 실제 연결 강화 포인트는 `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees`, `/admin/*` 사이의 운영 설명 정렬에 둔다.
- `/attendance` 와 `/leave` 는 현재 허용 결과뿐 아니라 정책 source, 미허용 이유, placeholder 제한을 같은 축으로 설명해야 한다.
- `/employees` 와 `/approvals` 는 `/admin/users` 의 역할/권한/상태 preview와 충돌하지 않게 읽혀야 한다.
- `/admin/audit-logs` 는 raw 로그 노출 확대가 아니라 candidate/reason/source 추적의 기준 화면으로 유지한다.
- 현재 화면 근거는 `apps/web/app/dashboard/page.tsx`, `apps/web/app/attendance/page.tsx`, `apps/web/app/leave/page.tsx`, `apps/web/app/approvals/page.tsx`, `apps/web/app/employees/page.tsx`, `apps/web/app/admin/users/page.tsx`, `apps/web/app/admin/policies/page.tsx`, `apps/web/app/admin/audit-logs/page.tsx`, `apps/web/admin-skeleton-config.ts` 에 둔다.
- 접근/권한 기준 근거는 `packages/shared/src/admin-access.ts`, API 허용/차단 근거는 `apps/api/src/app.ts`, 회귀 확인 기준은 `apps/api/test/auth-org.spec.ts` 로 따라간다.
- 이번 Phase의 필수 smoke 기준은 기존 핵심 route(`/`, `/login`, `/dashboard`, `/attendance`, `/approvals`, `/org`, `/employees`, `/admin/*`)를 유지하면서 `/leave` 정책 연결 설명을 추가 보강하는 것이다.
- blocked/empty/error 상태는 권한 부족, 회사 scope, 정책 미허용, placeholder 제한 4축으로 분리해 설명한다.

대장이 preview/live URL 에서 바로 눌러 볼 쉬운 확인 순서:
1. `/` 와 `/login` 에서 일반 업무 흐름과 관리자 검토 흐름의 입구 설명이 유지되는지 본다.
2. `/dashboard` 에서 오늘 할 일과 운영 연결 안내가 충돌하지 않는지 본다.
3. `/attendance` 에서 허용 방식, `effective policy`, offline 재시도 안내가 함께 보이고 `/admin/policies` 와 설명 방향이 같은지 본다.
4. `/leave` 가 정책 연결 없는 독립 placeholder처럼 남지 않고, 권한 부족/회사 scope/정책 미허용/placeholder 제한 4축 메모를 유지하는지 본다.
5. `/employees` 와 `/admin/users`, `/approvals` 와 관리자 권한 설명을 비교해 일반 조회/결재/운영 검토 책임이 섞이지 않는지 본다.
6. `/admin/audit-logs` 가 read-only 감사 조회 톤을 유지하고, 일반 사용자 기준 `/admin*`·raw 감사 정보·운영 내부 candidate 가 기본 화면에 새지 않는지 본다.

제한적 재귀적 자기개선 루프가 적용된다.

- 현재 카드 범위 안에서만 반복 실수 방지, 테스트 실패 원인 기록, 체크리스트 보강, handoff 품질 개선을 한다.
- 자기개선 문서 갱신은 `AGENTS.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`로 제한한다.
- 다른 보드/repo/domain/mainbot, 운영 DB, 실데이터, secret, DNS, 유료 리소스, 배포/릴리즈/PR merge, 서비스 재시작, 카드 범위 밖 리팩토링은 자기개선 명목으로 자동 수행하지 않는다.
- 필요하면 “사용자 승인 필요”로 분리해 보고한다.

## 인수인계 원칙

- Kanban DB는 직접 쓰지 않는다.
- active/running/blocked를 먼저 확인한다.
- 승인된 범위 안의 검증 실패는 자동 재수정 루프로 처리하되, 같은 카드/같은 실패군에서 반려·검증 실패·자동 재수정이 3회 이상 반복되면 싱드가 직접 개입해 원인과 중복 worker 여부를 확인한 뒤 기준 복구 카드 1개로 다시 넘긴다.
- restricted 항목은 반드시 사용자 승인으로 분리한다.
- 역할별 기본 책임은 고정한다. `gwplanner`는 범위/승인 게이트, `gwbuilder`는 구현, `gwreviewer`는 리뷰, `gwtester`는 검증, `gwdocs`는 문서·보고 양식, `gwops`는 PR/CI/release cleanup 이다.
- `PR merge`, `release gate`, `branch cleanup`, `review-required 정리`, `stale blocker 정리`, `검증 재실행`은 상시 권한이 아니라 카드 범위에 적힌 경우만 예외로 본다.
- 최종 사용자 보고는 싱드가 쉬운 한국어로 통합한다. 배포가 포함된 작업은 live URL과 사용자가 직접 보면 되는 화면/경로/확인 포인트를 함께 남긴다.
- 사용자-facing 보고는 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 분리해 적는다.
- blocked는 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요로 분류해 남긴다.
- 카드 댓글 작성만으로 사용자 보고 완료라고 보지 않는다. 실제 Telegram/대화 직접 보고 여부를 따로 확인한다.
- 같은 카드·같은 이유·같은 근거의 중복 보고는 금지하고, 상태 변화가 있을 때만 다시 보고한다.

## 다음 작업자가 바로 쓰는 빠른 판단표

### 역할별 기본 판단표
- `gwplanner`: 새 범위 정의, 후속 카드 분리, 승인 게이트 명시
- `gwbuilder`: 코드/스크립트 수정, 테스트 가능한 최소 증거 남김
- `gwreviewer`: 경계/보안/문서 일치 여부 검토, review-required 판단
- `gwtester`: fixture, dry-run, service/journal, board stats, blocked list, dispatch dry-run 확인
- `gwdocs`: 쉬운 한국어 문서, blocked 분류 문구, 보고 템플릿, handoff 정리
- `gwops`: PR/CI/merge/release gate/branch cleanup 안전성 검토

### blocked 분류와 다음 액션
- 방치: 허용 상태가 아니다. 다음 처리 주체가 비어 있으면 싱드가 재분류한다.
- 자동복구중: 표준 검증 재실행, recovery loop, release cleanup 재확인이 실제로 돌고 있는 상태다.
- 승인필요: restricted 항목, 외부 권한, 비용, 비밀값, 제품/운영 결정이 필요한 상태다.
- 싱드 직접정리: 같은 실패 3회 이상 반복, 중복 worker, `already-handled` 반복처럼 오케스트레이터가 직접 원인 분류해야 하는 상태다.
- 자동화 보완필요: 이번 건은 정리했지만 watcher/템플릿/검증 규칙 보강이 필요한 상태다.

### 검증자동화 최소 체크
1. fixture 또는 실제 카드 샘플로 분기(release cleanup / stale / review-required / already-handled)를 확인한다.
2. dry-run 결과만 보지 말고 service/process/journal 근거를 함께 남긴다.
3. board stats, blocked list, dispatch dry-run 으로 현재 보드 상태를 같이 적는다.
4. merge/release cleanup 범위가 섞이면 PR head, merge 상태, main release-gate, remote branch 부재, diff/patch-id 동등성까지 따로 확인한다.
5. 결과 문구는 `자동화가 한 일 / 싱드가 직접 개입한 일 / 자동화가 못 끝낸 이유 / 보완한 자동화` 4축으로 남긴다.
