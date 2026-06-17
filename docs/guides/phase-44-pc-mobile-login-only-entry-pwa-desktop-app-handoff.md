# Phase 44 PC/모바일 로그인 단독 진입 + PWA 데스크톱 앱 handoff

한 줄 요약:
이번 작업은 로그인 기능을 새로 만드는 게 아니라,
이미 있는 로그인/guard/PWA 자산을
"비로그인 상태에서는 로그인 화면만"
"설치 후 실행해도 로그인부터"
기준으로 다시 닫는 단계입니다.

## 1. 이번 카드에서 확정한 핵심

### 1) 로그인 전에는 그룹웨어 기능이 보이면 안 됩니다
- PC와 모바일 모두 첫 진입은 `/login` 만 보여야 합니다.
- `/`, `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/notifications`, `/management`, `/admin*` 는 익명 상태에서 내부 기능처럼 열리면 실패입니다.

### 2) 로그인 화면은 최대한 단순해야 합니다
- 허용: ID, 비밀번호, 로그인 버튼, 자동 로그인, 필요 시 아이디 저장
- 정리 대상: 역할 미리보기, landing 미리 설명, 내부 기능으로 이어지는 보조 링크, dev-safe 기본값 중심 문구

즉 로그인 화면은 "업무 소개 화면"이 아니라
"인증을 먼저 받는 입구"여야 합니다.

### 3) 데스크톱 앱 1차는 PWA 설치형입니다
- 이번 범위는 Windows Chrome/Edge 에서 설치 가능한 PWA 입니다.
- 진짜 `.exe`, Electron, Tauri, 코드서명은 이번 단계가 아닙니다.
- 설치 후 실행해도 로그인 세션이 없으면 `/login` 부터 보여야 합니다.

## 2. 구현자가 먼저 이해해야 할 현재 코드 기준

### 로그인 화면 쪽
현재 `apps/web/app/login/login-form.tsx` 에는 이미
- ID/비밀번호 입력
- `rememberSession`
- 로그인 API POST
가 있습니다.

하지만 동시에 아래도 남아 있습니다.
- `미리 볼 역할`
- `선택한 landing`
- `기본값으로 되돌리기`
- `admin / 1234로 로그인`

이 부분은 Phase 42A dev-safe 문맥에는 맞았지만,
이번 "로그인 단독 진입" 기준에는 과합니다.

### route guard 쪽
현재 `apps/web/admin-preview-guard.ts` 는
- `/` -> `/login`
- 익명 내부 route -> `/login`
- 민감 route/company boundary 분기
를 이미 하고 있습니다.

다만 아래 예외가 핵심 리스크입니다.
- general preview host 에서 admin host를 계산하지 못할 때
  `isWorkersPreviewGeneralHost(host)` 이면 `/admin*` 를 allow 하는 분기

이번 카드에서는 이 예외가 남아 있으면 안 됩니다.
익명 공개 preview 에서 admin skeleton 이 보이면 요구사항 위반입니다.

### PWA 쪽
현재 `apps/web/app/mobile-pwa-config.ts` 에는
- 일반 사용자 manifest
- 관리자 manifest
- install/offline 안내
- icons/shortcuts
가 이미 있습니다.

하지만 일반 사용자 manifest 는 아직
- `id: "/"`
- `start_url: "/"`
기준입니다.

이번 카드에서는
"설치 후 앱을 열면 로그인부터"
기준이 더 중요하므로,
일반 사용자 앱의 시작 경로를 `/login` 우선으로 다시 보게 됩니다.

## 3. 권장 구현 순서

### Step 1. 로그인 화면 단독화부터 처리합니다
대상 파일:
- `apps/web/app/login/page.tsx`
- `apps/web/app/login/login-form.tsx`

우선 정리할 것:
1. 역할 selector 제거 또는 dev-safe 보조 문맥으로 강등
2. landing 미리보기/복귀성 CTA 제거
3. 버튼/문구를 "로그인" 중심으로 단순화
4. 자동 로그인은 비밀번호 저장이 아니라 세션 유지 선택이라는 설명 유지

### Step 2. 익명 guard 예외를 막습니다
대상 파일:
- `apps/web/admin-preview-guard.ts`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.test.ts`

우선 정리할 것:
1. 익명 `/admin*` 는 general preview host 에서도 allow 금지
2. paired admin host 를 계산하지 못하면 `/forbidden` 또는 `/login` 으로 정리
3. 익명 `/`, `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/notifications`, `/management` 차단 회귀 유지

### Step 3. 일반 사용자 PWA 시작 경로를 로그인 기준으로 맞춥니다
대상 파일:
- `apps/web/app/mobile-pwa-config.ts`
- 필요 시 `apps/web/app/layout.tsx`
- `apps/web/mobile-pwa.test.ts`

우선 정리할 것:
1. 일반 사용자 manifest `start_url` 을 `/login` 기준으로 검토
2. 앱 이름/설명/install copy 가 "업무 바로 시작"보다 "로그인 후 업무 시작"을 먼저 가리키게 조정
3. 일반 manifest 와 관리자 manifest 분리 원칙은 유지

### Step 4. PC/mobile/preview 검증 기준을 함께 맞춥니다
- anonymous route 차단
- 로그인 후 landing
- mobile viewport 에서 로그인 전 shell 비노출
- PWA manifest/installability
- local preview smoke 와 live 확인 포인트 정리

## 4. 꼭 남겨야 할 테스트 포인트

### route / auth
- 익명 `/login` 200
- 익명 `/` -> `/login`
- 익명 `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/notifications`, `/management`, `/admin*` 차단
- 익명 내부 API 401/403
- 로그인 후 역할별 landing 정상

### UI / viewport
- PC/mobile 모두 로그인 전에는 로그인 form 외 기능성 nav가 먼저 보이지 않음
- role preview selector 같은 dev-safe 문맥이 공개 제품 UI처럼 남지 않음

### PWA / desktop install
- `/manifest.webmanifest` 값이 새 정책과 맞는지
- install 메뉴 노출 또는 installability 확인 가능 여부
- Windows Chrome/Edge 기준 설치 후 실행 시 세션 없으면 `/login` 부터 시작
- 관리자 manifest 분리 원칙이 깨지지 않았는지

### 회귀
- `/admin*` 공개 노출 차단
- `/management` 민감 허브 차단
- rememberSession on/off 와 logout 세션 해제 유지
- same-origin `/api/*` / manifest 상대 경로 원칙 유지

## 5. 문서화할 때 꼭 숨기지 말 것
- 이번 1차는 PWA 설치형 데스크톱 앱이지 네이티브 실행파일이 아님
- Windows Chrome/Edge 기준 설치 가능성 검증이지 모든 데스크톱 환경 완성 보장이 아님
- 로그인 단독 진입은 제품 정책이고, dev-safe 계정은 UAT 편의 수단일 뿐 production 기본 계정이 아님
- 오프라인 업무 가능, background sync, push, 별도 배포 서버, custom domain, secret 교체는 이번 범위가 아님

## 6. 사용자가 바로 따라 할 확인 순서
- live URL: `https://gw-web.wereheresp.workers.dev`
- PC 확인 시작점: `/login`
- 모바일 확인 시작점: `/login`
- 로그인 후 직원 기본 레인: `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents`
- 로그인 후 관리자/담당자 레인: `/management` → `/work-items/branch` → `/payroll` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → `/admin/audit-logs`

### 로그인 전 노출 기준
아래가 로그인 전에 직접 보이면 실패로 기록합니다.
- `/`
- `/dashboard`
- `/menu`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/notifications`
- `/management`
- `/admin*`

### Windows Chrome/Edge 설치 확인 방법
1. `https://gw-web.wereheresp.workers.dev/login` 을 엽니다.
2. Chrome 은 주소창 오른쪽 설치 아이콘 또는 메뉴의 설치 항목을, Edge 는 `앱` 또는 `이 사이트를 앱으로 설치`를 찾습니다.
3. 설치 후 바탕화면/시작 메뉴에서 앱을 다시 엽니다.
4. 세션이 없으면 `/login` 부터 시작하는지 확인합니다.
5. 로그인 후에는 역할별 landing 으로 이동하는지 확인합니다.

## 7. 현재 문서가 의존하는 최신 검증 근거
- parent 재검증 기준으로 `pnpm --filter @gw/web test -- admin-preview-guard.test.ts middleware.test.ts mobile-pwa.test.ts mobile-app-shell-login.test.tsx phase14-flow.test.tsx api-same-origin-bridge.test.ts`, `pnpm check`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf` 가 통과했다.
- local next start smoke 기준 익명 `/ -> /login`, `/dashboard -> /login`, `/admin -> /login`, `/api/me` 401, `/manifest.webmanifest` 200, `/sw.js` 200 이 다시 확인됐다.
- 역할별 smoke 기준 로그인 후 `EMPLOYEE -> /dashboard`, `MANAGER -> /management`, admin host 에서 `HR_ADMIN -> /admin/users`, `COMPANY_ADMIN -> /admin`, `AUDITOR -> /admin/audit-logs` 경계가 다시 확인됐다.
- 다만 visible chrome 은 숨겨져도 로그인 페이지 HTML source 안 직렬화 payload 에 메뉴/대시보드 문자열이 남아 있다는 parent 메모가 있다. 현재 요구사항의 "보이면 실패" 기준에서는 직접 노출이 아니라 blocker 로 보지 않았지만, 다음 구현/리뷰/테스트에서도 계속 같은 기준으로 봐야 한다.

## 8. 바로 참고할 파일
1. `docs/architecture/phase-44-pc-mobile-login-only-entry-pwa-desktop-app-scope.md`
2. `apps/web/app/login/login-form.tsx`
3. `apps/web/admin-preview-guard.ts`
4. `apps/web/middleware.ts`
5. `apps/web/app/mobile-pwa-config.ts`
6. `apps/web/mobile-pwa.test.ts`
7. `apps/api/src/app.ts`
8. `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
9. `docs/guides/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-handoff.md`
10. `docs/guides/admin-host-pwa-pass-1-handoff.md`

## 9. 승인 게이트
- `.exe` / Electron / Tauri 전환
- 코드서명
- 별도 배포 서버
- DNS/custom domain
- 유료 리소스
- production DB 실데이터
- secret 입력/교체
- migration/destructive 작업
