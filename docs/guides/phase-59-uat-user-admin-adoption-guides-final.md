# Phase 59 UAT·사용자/관리자 가이드·도입 체크리스트 최종 정리

## 한 줄 요약
이번 Phase 59는 새 기능을 여는 단계가 아니라,
이미 정리된 직원용 가이드, 관리자/담당자 가이드, 도입 체크리스트를
Phase 57~58의 최신 홈·메뉴·상태 문장·권한 레인 기준에 맞춰
한 번에 따라가기 쉽게 최종 묶음으로 정리하는 단계다.

## 이 문서가 하는 일
- 어떤 문서를 누가 먼저 읽어야 하는지 정리한다.
- live URL에서 대장이 직접 눌러볼 최소 UAT 순서를 다시 잠근다.
- 직원 레인과 관리자 레인을 섞지 않는 기준을 다시 확인한다.
- `empty / loading / error / forbidden / offline / dev-safe` 를 어떤 문서에서 어떻게 읽어야 하는지 연결한다.
- 아직 승인 게이트로 남겨야 하는 범위를 분명히 적는다.

## 현재 기준 URL과 계정
- live URL: `https://gw-web.wereheresp.workers.dev`
- 익명 시작점: `/login`
- 테스트 계정: `admin / 1234`
- 주의: 이 계정은 dev/test/UAT 전용이다. production 기본 계정처럼 적지 않는다.

## 이번 최종 묶음의 핵심 원칙 8가지
1. 로그인 전에는 `/login` 외 내부 업무 route가 먼저 보이면 안 된다.
2. 직원 기본 레인과 관리자/감사 레인은 같은 홈 흐름처럼 적지 않는다.
3. `COMPANY_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE` 기본 landing 은 `/dashboard`, `AUDITOR` 기본 landing 은 `/admin/audit-logs` 다.
4. HR_ADMIN 의 첫 관리자 레인은 `/management` 가 아니라 `/admin/users` 로 읽는다.
5. `/menu` 는 홈 복사본이 아니라 전체 기능 탐색 허브다.
6. `empty` 는 정상 빈 상태일 수 있고, `forbidden` 은 로그인 실패가 아니라 권한/범위 차단이다.
7. `error` 와 `offline`, `preview/dev-safe` 와 실제 저장 완료를 같은 뜻으로 적지 않는다.
8. live 직접 확인 근거와 local preview/build/test 근거를 같은 확인 수준처럼 섞지 않는다.

## 어떤 문서를 누구에게 보여 주면 되는가

### 1) 일반 직원/일반 사용자
먼저 볼 문서:
- `docs/guides/phase-44-employee-user-guide.md`

이 문서에서 먼저 따라갈 route:
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/me`
- 필요 시 `/menu`, `/org`, `/employees`

### 2) 관리자/담당자
먼저 볼 문서:
- `docs/guides/phase-44-admin-manager-guide.md`

이 문서에서 먼저 따라갈 route:
- `/login`
- `/dashboard`
- HR_ADMIN: `/admin/users`
- COMPANY_ADMIN/MANAGER: `/management`
- 필요 시 `/work-items/branch`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`
- AUDITOR: `/admin/audit-logs`

### 3) 도입 진행자 / 운영자 / 체크리스트 담당자
먼저 볼 문서:
- `docs/guides/phase-44-adoption-checklist.md`
- 필요 시 `docs/guides/phase-44-operator-runbook.md`

이 문서에서 먼저 확인할 것:
- 로그인 전 노출 금지 기준
- 직원 레인 / 관리자 레인 분리
- Windows Chrome/Edge PWA 설치 후에도 세션 없으면 `/login` 부터 시작하는지
- 승인 게이트가 빠지지 않았는지

## 문서별 이번 최종 정리 포인트

### 직원용 가이드에서 꼭 보이게 할 것
- `/dashboard` 는 오늘 업무 시작 홈이라는 점
- `/menu` 는 전체 탐색 허브라는 점
- `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 흐름
- `/management`, `/admin*`, 회사 전체 `/payroll`, 민감 `work-items/*` 는 직원 기본 레인이 아니라는 점
- `/payroll/me` 는 self-only preview 라는 점

### 관리자/담당자 가이드에서 꼭 보이게 할 것
- `/dashboard` 와 `/management` 는 같은 책임이 아니라는 점
- HR_ADMIN 다음 레인은 `/admin/users`, AUDITOR 시작점은 `/admin/audit-logs` 라는 점
- `/payroll` 과 `/payroll/me` 책임 차이
- `branch / company / self-only / restricted / read-only` 경계
- 감사 로그는 read-only/masked 기준이라는 점

### 도입 체크리스트에서 꼭 보이게 할 것
- 로그인 전 비노출 route 목록
- 직원 레인과 관리자 레인을 섞지 않는 확인 질문
- Windows Chrome/Edge PWA 설치 확인 순서
- 이번 단계가 PWA 설치형 앱이지 `.exe`/네이티브 배포가 아니라는 점
- 외부 연동·실데이터·secret·DNS·유료 리소스·migration·destructive 작업은 계속 승인 게이트라는 점

## 대장이 실제로 가장 짧게 눌러볼 추천 순서

### 직원 흐름
1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/leave`
5. `/approvals`
6. `/boards`
7. `/documents`
8. `/me`
9. 필요 시 `/menu`

### 관리자/담당자 흐름
1. `/login`
2. `/dashboard`
3. HR_ADMIN 이면 `/admin/users`
4. COMPANY_ADMIN/MANAGER 이면 `/management`
5. 필요 시 `/work-items/branch`
6. `/payroll`
7. `/payroll/me`
8. `/work-items/tax` / `/work-items/labor` / `/work-items/legal`
9. `/admin/audit-logs`

### 상태 문장 확인 흐름
1. `/dashboard`
2. `/menu`
3. `/management`
4. `/admin/users`
5. `/admin/audit-logs`
6. `/me`

## 이번 문서 묶음과 바로 연결되는 최신 기준 문서
- `docs/guides/phase-58-state-copy-recovery-role-lane-guide.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md`
- `docs/guides/phase-50-internal-groupware-full-adoption-release-guide.md`

쉽게 말하면,
Phase 44 문서 세트가 사용자-facing 기본 묶음이라면,
Phase 56~58 문서는 최신 운영 레인·홈/메뉴·상태 문장 해설을 보강해 주는 현재 기준선이다.

## 현재 확인 근거
- parent tester 재검증 요약:
  - focused web tests 28 files / 122 tests passed
  - `pnpm --filter @gw/web typecheck` 통과
  - `pnpm --filter @gw/web build` 통과
  - `pnpm --filter @gw/web build:cf` 통과
  - local Cloudflare preview 기준 `/uat`, `/menu`, `/me`, `/management`, `/admin/users`, `/admin/audit-logs`, `/api/health` 확인
- role-cookie 기준으로 UAT 가이드 링크 노출과 EMPLOYEE/MANAGER/HR_ADMIN/AUDITOR forbidden, COMPANY_ADMIN 허용이 다시 확인됐다.

중요:
- 이번 문서 카드에서는 live URL을 다시 직접 fetch 하거나 테스트를 새로 실행하지 않았다.
- 따라서 최종 보고에는 "문서 최종 정리"와 "parent tester 실검증 근거"를 구분해서 적는 편이 정확하다.

## 아직 승인 게이트로 남기는 것
- production DB 실데이터 변경
- 실제 사용자 초대 메일 발송
- 실제 비밀번호 운영 전환
- 외부 IdP/SSO/SAML/SCIM
- 실제 급여 지급/은행 이체
- 외부 세무/노무/법무/회계/기관 계정 연동
- secret 입력/교체
- DNS/custom domain
- 유료 리소스
- migration
- destructive 작업