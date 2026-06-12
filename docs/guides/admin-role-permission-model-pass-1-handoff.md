# 관리자 권한/역할 데이터 모델 1차 handoff

한 줄 요약:
이번 1차는 새 권한 시스템을 크게 만드는 작업이 아니라, 관리자 접근 기준을 `roleCode + permissionCode + adminScope` 로 같은 뜻이 되게 정리하는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있고 이번 1차에서 연결까지 끝낸 것:

- 일반 사용자 host 와 관리자 host 분리가 들어가 있다.
- 익명/일반 사용자/관리자/감사 전용 사용자의 `/admin*` 접근 경계가 preview guard 에 있고, `/admin/audit-logs` 는 `audit.read` capability 기준으로 분리됐다.
- shared contract 에 `adminScope`, `highRiskPermissions`, policy capability, audit metadata skeleton 이 있다.
- `packages/shared/src/admin-access.ts` 가 role/permission/adminScope/admin route kind 기준의 단일 helper 역할을 한다.
- dashboard 에 관리자 shortcut 과 감사 shortcut 분기 구조가 있고, admin hub 카드 노출도 같은 접근 행렬을 재사용한다.
- API 에 `requireAdminRole`, `requirePermission`, `ensureCompanyBoundary` helper 가 있다.

이번 1차에서 문서로 고정해야 하는 것:

- `/admin/audit-logs` 는 role 이름이 아니라 `audit.read` capability 기준으로 읽는다.
- 관리자 CTA 노출, admin hub 카드 노출, 직접 route 접근 차단, API guard 는 같은 접근 행렬을 따라야 한다.
- `HR_ADMIN` 과 `AUDITOR` 의 경계는 문서/구현/테스트에서 같은 말로 남겨야 한다.

즉, 이번 단계는 관리자 host 를 또 나누는 작업이 아니라,
이미 있는 관리자 skeleton 에 "누가 어디까지 들어가나"를 명확히 연결했고 그 결과를 다음 작업자도 같은 기준으로 읽게 만드는 작업입니다.

## 2. 이번 1차에서 고정한 핵심 해석

### 역할과 권한은 따로 본다.

- 역할(`roleCode`)은 사용자 유형을 설명한다.
- 권한(`permissionCode`)은 실제 capability 판단 기준이다.
- 범위(`adminScope`)는 관리자 UI 에서 어떤 운영 범위를 다루는지 설명한다.

### 관리자 route 는 두 묶음으로 나눠 본다.

1. 관리자 운영 허브/사용자/정책
   - `/admin`
   - `/admin/users`
   - `/admin/policies`
2. 감사 조회
   - `/admin/audit-logs`

### 1차 접근 행렬

- `SUPER_ADMIN`: 전부 허용
- `COMPANY_ADMIN`: 전부 허용
- `HR_ADMIN`: `/admin`, `/admin/users`, `/admin/policies` 허용, `/admin/audit-logs` 차단
- `AUDITOR`: `/admin/audit-logs` 만 허용
- `MANAGER`, `EMPLOYEE`: `/admin*` 차단
- 익명: `/login`

중요 이유:
현재 API 기준으로 audit log 는 `audit.read` permission 이 필요합니다.
`HR_ADMIN` 은 현재 permission map 에 `audit.read` 가 없으므로, Web 도 그 뜻에 맞춰 주는 것이 이번 1차 기준입니다.

## 3. 다음 구현자가 먼저 볼 파일

### 문서

- `docs/architecture/admin-role-permission-model-pass-1-scope.md`
- `docs/guides/admin-role-permission-model-pass-1-handoff.md`
- `SPEC.md`
- `DATA_MODEL.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `HANDOFF.md`

### Shared

- `packages/shared/src/contracts.ts`

### API

- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

### Web

- `apps/web/admin-preview-guard.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/admin-skeleton-config.ts`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`

## 4. 이번 1차 결과를 다음 작업자가 읽는 순서

1. 먼저 scope 문서와 이 handoff 문서를 읽습니다.
2. `packages/shared/src/admin-access.ts` 를 기준 파일로 보고 접근 행렬을 확인합니다.
3. Web preview guard, dashboard shortcut, admin hub 카드, API guard 가 이 helper 를 같은 뜻으로 재사용하는지 봅니다.
4. 관련 테스트 기대값이 role/permission matrix 기준과 같은지 확인합니다.
5. 후속 문서/QA 문구를 바꿀 때도 이 접근 행렬과 부모 검증 근거를 같이 적습니다.

## 5. 구현자가 지켜야 할 핵심 guardrail

### 1) UI 숨김으로 끝내지 않는다.

- dashboard 에서 링크를 숨겨도 route guard 유지
- route guard 가 있어도 API permission guard 유지
- 문서에서 숨김만으로 안전해졌다고 쓰지 않기

### 2) audit log 는 admin role 과 별개 capability 로 본다.

이번 1차에서 audit log 는 아래처럼 해석합니다.

- `audit.read` 있음 → 접근 가능
- `audit.read` 없음 → 차단

즉, `HR_ADMIN` 이라는 이름만으로 자동 허용하지 않습니다.

### 3) 일반 사용자 흐름과 관리자 흐름을 섞지 않는다.

유지할 경계:
- 일반 사용자 업무: `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/org`, `/employees`
- 관리자 운영: `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`

### 4) 실제 운영 권한 저장으로 범위를 넓히지 않는다.

이번 단계는 아래까지 가지 않습니다.

- 실제 role assignment 저장
- production DB migration
- 실사용 audit/invite 운영 연결
- secret 입력/교체

## 6. 구현 시 특히 조심할 포인트

### 포인트 A. Web 과 API 의 의미 차이를 다시 벌리지 않는다.

가장 먼저 계속 볼 경계:
- API audit log: `audit.read`
- Web audit route: `audit.read`

이 기준이 문서/테스트에서 다시 role 이름 중심으로 흐려지지 않게 유지하는 것이 1순위입니다.

### 포인트 B. dashboard 와 admin hub 도 같은 기준을 써야 한다.

원칙:
- `COMPANY_ADMIN` / `SUPER_ADMIN` → 관리자 허브 shortcut
- `AUDITOR` → 감사 로그 shortcut
- `HR_ADMIN` → 관리자 허브 shortcut 가능, audit log 카드/직접 접근은 별도 권한 기준 확인
- 일반 사용자 → 관리자 shortcut 없음

### 포인트 C. high-risk 권한 목록은 1차 고정 목록 유지

이번 단계에서 문서/화면/API 가 같은 뜻으로 봐야 할 high-risk 권한:
- `invite.manage`
- `audit.read`
- `board.manage`
- `document.space.manage`

## 7. 권장 테스트 포인트

반드시 다시 볼 것:

1. 익명 `/admin* -> /login`
2. 일반 로그인 사용자 `/admin* -> /forbidden`
3. `COMPANY_ADMIN` 허용 범위
4. `HR_ADMIN` 이 `/admin/audit-logs` 에서 차단되는지
5. `AUDITOR` 가 `/admin/audit-logs` 만 허용되는지
6. dashboard shortcut 노출 규칙
7. admin hub 카드 노출 규칙
8. `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` 의 401/403/회사 경계
9. `requiredPermission`, `requiredAdminRole`, `roleCodes` 같은 에러 detail 이 설명 가능한지

권장 명령:

- `pnpm --filter @gw/web test -- admin-preview-guard dashboard-boundary admin-console-pass1`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/web build`

## 8. 완료로 볼 최소 기준

- 접근 행렬이 코드/테스트/문서에 같은 말로 남는다.
- `HR_ADMIN` 과 `AUDITOR` 의 차이가 구현에서도 보인다.
- audit log 접근 기준이 `audit.read` 중심으로 읽힌다.
- dashboard/admin hub/직접 route/API 가 같은 방향으로 움직인다.
- 별도 승인 필요 항목과 범위 밖 항목이 계속 분리돼 있다.

## 8-1. 이번 카드 기준 검증 근거

- 부모 카드 검증에서 shared 19 / api 61 / web 47 테스트, `pnpm check`, `pnpm --filter @gw/web build:cf`, local `preview:cf` smoke 가 통과했다.
- GitHub 기준으로 PR #39 는 merge commit `c14bb65` 로 main 에 반영됐다.
- main push `release-gate` run `27398275720` 에서 `cloudflare-build`, `cloudflare-deploy` 가 성공했다.
- live `.workers.dev` 직접 fetch 가 막히면 위 release/build/smoke 근거를 substitute evidence 로 남긴다.

## 9. 별도 승인 필요 항목

여전히 하면 안 되는 것:

- 실제 운영 사용자 권한 변경 실행
- production DB migration 실행
- 실데이터 반영
- secret 입력/교체
- 외부 IAM/SSO/감사 시스템 연동
- DNS/custom domain 변경
- 유료 리소스 생성·증설

정리하면 다음 구현자가 기억할 한 문장은 이것입니다.
관리자 host 를 열 수 있느냐와 실제 관리자 capability 가 있느냐를 같은 것으로 보지 말고,
role/permission/scope 기준으로 접근 문을 다시 맞추면 됩니다.
