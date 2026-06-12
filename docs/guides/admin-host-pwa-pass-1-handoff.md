# Admin host 분리 + PWA 웹앱 1차 handoff

한 줄 요약:
이번 1차는 관리자 기능을 더 늘리는 작업이 아니라, 일반 사용자 웹과 관리자 웹을 host 기준으로 나누고 관리자 전용 PWA 설치 경험을 만들 수 있게 하는 기준을 먼저 잠근 단계입니다.

## 1. 지금 무엇이 이미 정리됐는가

이번 기획에서 아래 기준을 고정했습니다.

- 관리자 분리 기준은 이제 `route` 만이 아니라 `host + route` 조합으로 본다.
- production admin host 후보는 `admin.<승인된-domain>` 이다. 단, 실제 DNS/custom domain 연결은 이번 범위가 아니다.
- Cloudflare preview admin host 후보는 별도 admin worker 이름 기반 `.workers.dev` host 다. 예: `gw-admin.<account-subdomain>.workers.dev`.
- localhost/dev 후보는 `admin.localhost`, `admin.127.0.0.1.nip.io`, 또는 host header override 다.
- 일반 사용자 host 는 일반 사용자 route 와 일반 PWA manifest 를 유지한다.
- 관리자 host 는 `/admin` 계열 route 와 관리자용 manifest/start_url/scope 를 우선으로 본다.

즉, "같은 코드베이스"를 쓰더라도 사용자 앱과 관리자 앱의 진입 host 와 PWA 정체성을 나누는 방향이 문서상 확정됐습니다.

## 2. 구현자가 가장 먼저 이해해야 할 핵심

### 1) host 분리는 보안 대체재가 아니다

host 분리는 노출 최소화, 설치 경험, 앱 정체성 분리를 위한 1차 필터입니다.
보안 경계는 여전히 아래가 유지돼야 합니다.

- session/role/capability 체크
- API 권한 검증
- 회사 scope 검증
- `/forbidden` / `/login` 흐름

즉, "admin host 로 들어왔다"고 해서 권한이 자동으로 생기면 안 됩니다.

### 2) 일반 사용자 host 에서는 `/admin*` 를 그대로 렌더링하지 않는다

이번 handoff 의 가장 중요한 구현 기준입니다.

권장 기본안:

- 익명 사용자가 일반 사용자 host 에서 `/admin*` 로 들어오면 `/login` 또는 관리자 host 로그인 경로로 유도
- 로그인한 일반 사용자가 들어오면 `/forbidden`
- 로그인한 관리자라도 일반 사용자 host 에서 admin shell 을 그대로 띄우지 말고 관리자 host 같은 경로로 redirect

즉, 관리자는 "권한이 있으니 아무 host 에서나 admin 화면이 열리는 구조"가 아니라,
"관리자용 입구(admin host)로 이동한 뒤 admin 화면이 열리는 구조"가 기본입니다.

### 3) 관리자 host 에서는 `/` 가 `/admin` 으로 이어지는 것이 자연스럽다

관리자 앱의 기본 시작점은 일반 사용자 홈이 아니라 운영 허브입니다.
그래서 관리자 host 에서는 아래 중 하나를 권장합니다.

- `/` → `/admin` redirect
- 또는 `/` 에서 아주 얇은 admin landing 후 `/admin` 진입

이번 1차 기준에서는 단순 redirect 가 더 안전합니다.

## 3. 권장 구현 순서

### Step 1. host 판별 helper 를 먼저 만든다

추천 파일 후보:

- `apps/web/lib/admin-host.ts`
- 또는 `apps/web/admin-host.ts`

이 helper 가 최소한 아래를 반환하면 좋습니다.

- 현재 요청 host
- admin host 인지 여부
- general host 인지 여부
- preview/local/dev 예외 처리 결과

입력 후보:

- `request.headers.get("host")`
- `x-forwarded-host` 가 필요한지 검토
- 로컬 테스트용 explicit override

주의:

- 신뢰할 수 없는 header 를 권한 근거로 쓰면 안 됩니다.
- host helper 는 "UI/route 분기"에만 우선 사용하고, 권한 판단은 기존 session/role 로직을 유지합니다.

### Step 2. 기존 `admin-preview-guard.ts` 를 host-aware 로 확장한다

현재 파일은 `pathname + sessionToken` 중심입니다.
이번에는 최소 아래 입력을 더 보는 구조가 필요합니다.

- `host`
- 필요 시 `isAdminHost`
- 필요 시 `targetHostRedirect`

권장 결과 shape 예시:

- `allow`
- `redirect:/login`
- `redirect:https://admin-host/admin/...`
- `redirect:/forbidden`

지금처럼 path 기반만 보지 말고,
"일반 사용자 host 에서 admin route 요청"과
"관리자 host 에서 admin route 요청"을 다른 케이스로 분리하는 것이 핵심입니다.

### Step 3. middleware matcher 를 `/admin*` + manifest 관련 route 까지 검토한다

현재 `middleware.ts` matcher 는 `/admin/:path*` 만 잡습니다.
이번 1차에서는 아래도 함께 검토해야 합니다.

- admin manifest route
- 관리자 host 에서 `/` 요청

즉, middleware 또는 route handler 중 어디에 둘지 정하되,
관리자 host 의 root/manifest 동작을 제어할 수 있어야 합니다.

### Step 4. manifest 를 2종으로 나눈다

현재는 일반 사용자 manifest 1개뿐입니다.
이번 단계에서는 아래 두 가지가 필요합니다.

1. 일반 사용자 manifest
   - 기존 유지
   - `name`: 현행값 유지 가능
   - `start_url: "/"`
   - `scope: "/"`

2. 관리자용 manifest
   - 새 route 또는 생성형 manifest
   - `name`: `GW Admin`
   - `short_name`: `GW Admin`
   - `start_url: "/admin"`
   - `scope: "/admin"`
   - 관리자용 설명/theme/icon 구분

가능한 구현 방식:

- `public/manifest.webmanifest` + `app/admin/manifest.webmanifest/route.ts`
- 또는 `app/manifest.ts` / `app/admin/manifest.ts` 형태
- 또는 host 에 따라 동적으로 다른 manifest 를 내리는 방식

1차에서는 읽기 쉬운 분리형 route 가 더 안전합니다.

### Step 5. layout/metadata 에서 host 별 앱 identity 분기를 추가한다

대상 파일:

- `apps/web/app/layout.tsx`
- `apps/web/app/mobile-pwa-config.ts`

필요한 것:

- title/applicationName/manifest 링크의 host 분기
- 관리자 host 에서는 관리자용 앱 이름과 manifest 링크 사용
- 일반 사용자 host 에서는 기존 일반 사용자용 링크 유지

주의:

- preview 절대 URL 하드코딩 금지
- same-origin 상대 경로 원칙 유지

### Step 6. 관리자 host 의 shell/설치 안내 문구를 최소 보강한다

이번 단계에서 꼭 큰 UI 개편까지는 필요 없지만,
아래 정도는 구분돼야 합니다.

- 이 앱은 관리자 운영용이라는 문구
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 중심으로 쓰는 앱이라는 문구
- 일반 사용자용 대시보드/근태/휴가 앱과 다른 시작점이라는 점

## 4. route 별 기대 동작

### 일반 사용자 host

- `/` → 일반 사용자 홈
- `/dashboard` → 정상
- `/manifest.webmanifest` → 일반 사용자용 manifest
- `/admin` → 관리자 host redirect 또는 `/login`
- `/admin/users` → 관리자 host redirect 또는 차단
- `/admin/policies` → 관리자 host redirect 또는 차단
- `/admin/audit-logs` → 관리자 host redirect 또는 차단

### 관리자 host

- `/` → `/admin`
- `/admin` → 정상
- `/admin/users` → 정상(권한 있으면)
- `/admin/policies` → 정상(권한 있으면)
- `/admin/audit-logs` → 정상(권한 있으면, 감사 전용 role 포함)
- 관리자 manifest route → 관리자용 manifest 반환
- 일반 업무 route 직접 진입 → `/admin` 으로 돌리거나 범위 밖 안내

## 5. 권장 테스트 포인트

### 단위/로직 테스트

대상 후보:

- `apps/web/admin-preview-guard.test.ts`
- 새 host helper 테스트 파일
- manifest 관련 테스트

꼭 들어가야 할 케이스:

1. 일반 사용자 host + 익명 + `/admin` → `/login`
2. 일반 사용자 host + 관리자 로그인 + `/admin` → 관리자 host redirect
3. 관리자 host + 관리자 로그인 + `/admin` → allow
4. 관리자 host + 일반 로그인 + `/admin` → `/forbidden`
5. 관리자 host + 감사 로그인 + `/admin/audit-logs` → allow
6. 관리자 host + 감사 로그인 + `/admin` → `/forbidden`
7. 일반 사용자 manifest 와 관리자 manifest 의 `start_url/scope/name` 차이 확인
8. preview/local host 후보가 helper 에서 올바르게 판별되는지 확인

### 빌드/정적 검증

- `pnpm check`
- `pnpm --filter @gw/web test -- admin-preview-guard`
- host/manifest 관련 web 테스트
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- `pnpm --filter @gw/web build:cf`

### 로컬 smoke

가능하면 아래를 남겨 주세요.

일반 사용자 host:

- `/`
- `/login`
- `/manifest.webmanifest`
- `/admin` 결과

관리자 host:

- `/`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- 관리자 manifest route

## 6. 리뷰어가 특히 볼 것

리뷰 카드는 아래를 집중 확인하면 됩니다.

1. host 분리가 권한 우회 통로가 되지 않는지
2. 일반 사용자 host 에서 admin shell 이 남지 않는지
3. 관리자 host manifest 가 일반 사용자 앱과 충돌하지 않는지
4. hardcoded preview URL 이 들어가지 않았는지
5. DNS/custom domain/secret/production data 변경이 실제로 포함되지 않았는지

## 7. 테스트 카드가 특히 볼 것

테스트 카드는 아래를 확인하면 됩니다.

- host 케이스별 redirect/403 가 문서 기준과 일치하는지
- 관리자 host 의 `/` → `/admin` 흐름이 동작하는지
- manifest 두 종류가 실제로 다르게 보이는지
- build/build:cf 가 깨지지 않는지
- local preview smoke 에서 일반/관리자 host 동작 차이가 재현되는지

## 8. 문서/운영 후속 반영 포인트

구현 후 아래 문서들도 같이 맞춰야 할 가능성이 큽니다.

- `README.md`
- `ROADMAP.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- 필요 시 `DEPLOYMENT.md`

특히 operator/developer guide 에는 아래가 반영되면 좋습니다.

- admin preview host 후보
- local host 시뮬레이션 방법
- smoke route 목록
- DNS/custom domain 은 별도 승인이라는 점

## 9. 이번 단계에서 하지 말아야 할 것

- 실제 `admin.<domain>` DNS 생성
- production custom domain 연결
- production secret 입력/교체
- production 사용자/권한/정책 실데이터 저장
- 관리자 기능을 일반 사용자 하단 탭에 섞기
- host 분리를 이유로 API 권한 검증을 느슨하게 만들기
- preview 절대 도메인을 코드 기본값으로 박기

## 10. 마지막 요약

다음 구현자가 기억할 것은 3가지입니다.

1. 일반 사용자 host 에서는 `/admin*` 를 그대로 보여 주지 않는다.
2. 관리자 host 에서는 `/admin` 중심 PWA 정체성을 따로 만든다.
3. host 분리는 제품 경계이고, 실제 보안 경계는 기존 권한 검증을 그대로 유지한다.
