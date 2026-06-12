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

현재 활성 흐름은 관리자 권한/역할 데이터 모델 1차의 구현 반영 완료 상태를 문서와 검증 기준에 고정하는 단계다. 이미 들어간 admin host 분리와 admin skeleton 위에, 관리자 접근 기준을 `roleCode + permissionCode + adminScope` 기준으로 같은 뜻이 되게 정리했고 Web route guard / dashboard-admin navigation / API guard / 테스트 기대값이 같은 접근 행렬을 따르도록 맞췄다.

현재 기획 상태 요약:

- 일반 사용자 웹과 관리자 웹은 계속 `host + route` 기준으로 분리한다.
- 이번 단계의 추가 핵심은 접근 판단을 `roleCode + permissionCode + adminScope` 기준으로 정리하는 것이다.
- `/admin`, `/admin/users`, `/admin/policies` 와 `/admin/audit-logs` 는 같은 관리자 영역처럼 보여도 접근 기준을 분리한다.
- 1차 접근 행렬은 `SUPER_ADMIN`/`COMPANY_ADMIN` 전부 허용, `HR_ADMIN` 은 감사 로그 제외, `AUDITOR` 는 감사 로그만 허용, `MANAGER`/`EMPLOYEE` 는 차단으로 맞춘다.
- dashboard shortcut, admin hub 카드 노출, Web route guard, API guard, 테스트 기대값이 같은 행렬을 따라야 한다.
- 감사 로그 접근은 role 이름보다 `audit.read` capability 를 실제 기준으로 본다.
- host 분리는 노출/설치 경험 경계이고, 실제 보안 경계는 계속 session/role/capability/API 검증에 있다.
- 실제 운영 권한 저장, production DB migration/실데이터, secret, DNS/custom domain, 외부 IAM/SSO/감사 시스템 연동, 유료 리소스는 계속 별도 승인 대상이다.
- 우선 참고 문서: `docs/architecture/admin-role-permission-model-pass-1-scope.md`, `docs/guides/admin-role-permission-model-pass-1-handoff.md`, `docs/architecture/phase-13-admin-console-pass-1-scope.md`, `docs/guides/phase-13-admin-console-pass-1-handoff.md`.

2026-06-12 관리자 권한/역할 1차 메모:

- 현재 shared contract 에는 `adminScope`, `adminUserSummary`, `highRiskPermissions`, `adminPolicySummary.capability`, `adminAuditLog.metadata.companyBoundary` 같은 관리자 데이터 skeleton 이 이미 있다.
- 현재 API 는 `/api/admin/users`, `/api/admin/policies` 에 `requireAdminRole`, `/api/admin/audit-logs` 에 `requirePermission("audit.read")` 를 사용한다.
- 이번 구현부터는 `packages/shared/src/admin-access.ts` 가 role → permission → adminScope → route kind 기준을 shared helper 로 제공하고, API/Web/dashboard/admin hub 가 이 행렬을 같이 재사용한다.
- 현재 dashboard 는 admin shortcut 과 audit shortcut 을 따로 두고 있다.
- 현재 Web preview guard 는 익명/일반/관리자/감사 전용 경계를 나누고, `/admin/audit-logs` 도 `audit.read` capability 기준으로 API 와 같은 방향으로 맞춰져 있다.
- 이번 1차 기준에서 `HR_ADMIN` 은 `/admin`, `/admin/users`, `/admin/policies` 허용, `/admin/audit-logs` 차단으로 본다. `AUDITOR` 는 감사 로그 전용이다.
- high-risk 권한 1차 고정 목록은 `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 다.
- `packages/shared/src/admin-access.ts` 가 role → permission → adminScope → route kind 기준의 단일 helper 이고, dashboard shortcut / admin hub 카드 / Web route guard / API guard / 테스트 기대값이 이 행렬을 재사용한다.
- 부모 카드 검증 기준으로 shared 19 / api 61 / web 47 테스트, `pnpm check`, `pnpm --filter @gw/web build:cf`, local `preview:cf` smoke, PR #39 merge commit `c14bb65`, main push `release-gate` run `27398275720` 성공까지 확인됐다.

2026-06-11 pass 2 구현 메모:

- shared 계약에 정책 assignment/rule/preview/effective-policy 구조와 계산 helper 를 추가했다.
- admin 정책 화면은 우선순위 설명, 예상 적용 인원, 샘플 직원 preview, 동일 target 중복 경고를 렌더링한다.
- 직원 `/attendance` 화면은 회사 기본이 아니라 본인 effective policy 요약과 허용 방식만 보여 준다.
- API check-in/check-out 은 employee 기준 effective policy 를 계산해 허용 방식만 201, 나머지는 403 으로 차단한다.
- 최신 재검증에서 `pnpm check`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf` 가 모두 통과했다. 이전 web 빌드 ENOENT 실패 메모는 stale 상태이므로 현재 blocker 로 보지 않는다.
- 부모 검증 기준으로는 shared 18, web 30, api 61 테스트와 package typecheck, web build, Cloudflare build, auth check 가 모두 통과했다. 다음 작업자는 문구를 바꿀 때 이 근거와 모순되지 않는지 먼저 확인한다.

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
- 최종 사용자 보고는 싱드가 쉬운 한국어로 통합한다. 배포가 포함된 작업은 live URL과 사용자가 직접 보면 되는 화면/경로/확인 포인트를 함께 남긴다.
