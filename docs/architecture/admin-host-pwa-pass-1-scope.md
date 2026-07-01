# Admin host 분리 + PWA 웹앱 1차 범위

## 1. 한 줄 정의

이번 1차의 목표는 `/admin/*` 영역을 일반 사용자 웹과 같은 route 집합 안에 두더라도 host 기준으로 분리해서,
"일반 사용자 host 에서는 관리자 진입을 숨기거나 차단하고, 관리자 host 에서는 관리자 전용 PWA shell/manifest 를 제공할 수 있는 준비 상태"를 dev-safe 범위에서 먼저 고정하는 것입니다.

이번 단계도 실제 DNS/custom domain 생성, production secret 입력, production 운영 데이터 변경은 하지 않습니다.

## 2. 왜 지금 이 작업이 필요한가

현재 저장소에는 이미 아래 기준이 있습니다.

- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` route 와 권한 guard Production-ready (실구현) 이 있음
- 익명 preview 에서는 `/admin*` 를 `/login` 으로 돌리는 middleware 가 있음
- 일반 사용자용 PWA manifest 는 same-origin 상대 경로(`/manifest.webmanifest`)를 유지함
- Cloudflare/OpenNext 기준 web 배포는 `gw-web` 단일 worker 이름을 기준으로 준비돼 있음

하지만 아직 부족한 점은 아래와 같습니다.

1. 관리자 화면이 route 기준으로는 분리돼 있어도 host 기준 분리는 아직 없음
2. 같은 origin/host 에서 일반 사용자 웹과 관리자 웹이 섞여 보여 관리자 전용 설치 경험을 만들기 어려움
3. PWA manifest 가 일반 사용자용 1종만 있어서, 관리자 영역을 별도 웹앱처럼 설치/실행하는 기준이 없음
4. Cloudflare preview/dev/localhost 에서 어떤 host 를 admin host 로 볼지 명시 기준이 아직 없음

즉, 이번 단계는 "관리자 기능을 더 많이 여는 것"이 아니라,
"관리자 웹의 진입 host 와 일반 사용자 웹의 진입 host 를 먼저 분리할 기준을 문서와 Production-ready (실구현) 으로 고정하는 단계"입니다.

## 3. 이번에 다시 확인한 현재 사실

확인한 문서/파일:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `apps/web/admin-preview-guard.ts`
- `apps/web/middleware.ts`
- `apps/web/app/layout.tsx`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/public/manifest.webmanifest`
- `apps/web/open-next.config.ts`
- `apps/web/wrangler.jsonc`

현재 사실은 아래와 같습니다.

- 관리자 경계는 지금 `pathname` 과 dev Production-ready (실구현) session role 기준으로만 판단합니다.
- `middleware.ts` 의 matcher 는 `/admin/:path*` 만 보고 있어, host 기반 분기나 manifest 분기는 아직 없습니다.
- 일반 사용자용 PWA 는 `name: "GW Cloudflare-first Production-ready (실구현)"`, `short_name: "GW Mobile"`, `start_url: "/"`, `scope: "/"` 로 고정돼 있습니다.
- UX/제품 문서는 관리자 기능을 일반 사용자 하단 탭과 분리하라고 요구하지만, 아직 host 레벨 분리 기준까지는 문서화돼 있지 않습니다.
- Cloudflare 배포 설정은 현재 `gw-web` 단일 worker 이름만 보여 줍니다. 즉 preview host 분리는 코드/설계 Production-ready (실구현) 으로 준비할 수 있지만, 실제 별도 host 공개는 배포 이름/route 정책까지 연결해야 합니다.

## 4. 이번 1차에서 고정하는 핵심 결정

### 결정 A. 관리자 분리 기준은 "route 만"이 아니라 "host + route" 조합으로 본다.

이번 단계부터 `/admin/*` 는 아래 두 축을 같이 봅니다.

1. 일반 사용자 host 인가
2. 관리자 host 인가

쉽게 말하면:

- 일반 사용자 host 에서는 `/admin/*` 를 숨기거나 차단합니다.
- 관리자 host 에서는 `/admin/*` 를 정상 진입점으로 봅니다.
- host 가 맞더라도 권한 없는 사용자는 여전히 `/login` 또는 `/forbidden` 으로 막습니다.

즉, host 분리는 "보안 대체재"가 아니라 "제품 경계 + 설치 경험 + 노출 최소화"를 위한 1차 필터입니다.

### 결정 B. 1차 host 후보는 production / preview / localhost-dev 를 분리해서 적는다.

이번 1차 기본안은 아래입니다.

1. production admin host 후보
   - `admin.<승인된-메인도메인>`
   - 예: `admin.example.com`
   - 이 항목은 실제 DNS/custom domain 생성 전까지 문서 기준 후보로만 둡니다.

2. Cloudflare preview admin host 후보
   - 별도 admin worker 이름 기반 `.workers.dev` host 를 우선 후보로 둡니다.
   - 예: `gw-admin.<account-subdomain>.workers.dev`
   - 실제 이름 확정/배포는 구현·운영 검증 단계에서 하되, 이번 기획에서는 "일반 사용자 preview host 와 별도 host 를 쓴다"는 원칙을 먼저 고정합니다.

3. localhost/dev host 후보
   - `admin.localhost`
   - `admin.127.0.0.1.nip.io`
   - 필요 시 `localhost` + host header override

이렇게 나누는 이유는 아래와 같습니다.

- production 과 preview 의 승인 범위가 다릅니다.
- `.workers.dev` 는 DNS 변경 없이도 preview 분리 검증에 유리합니다.
- 로컬은 hosts 파일 수정 없이도 재현 가능한 host 후보가 필요합니다.

### 결정 C. 일반 사용자 host 와 관리자 host 의 동작 차이를 명시적으로 나눈다.

#### 1) 일반 사용자 host

기본 원칙:

- `/`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/org`, `/employees` 중심
- 관리자 CTA 는 권한 있는 사용자에게만 보이더라도, 링크 기본값은 관리자 host 로 연결
- `/admin*` 직접 진입 시 일반 사용자 host 에서는 아래 중 하나로 처리
  - 익명: 관리자 host 의 `/login` 으로 유도하거나 현재 host 기준 `/login` 으로 보내되 관리자 host 전환 안내 표시
  - 로그인 일반 사용자: `/forbidden` 또는 관리자 전용 안내
  - 로그인 관리자: 관리자 host 의 같은 admin route 로 redirect

권장 기본안:

- 일반 사용자 host 에서 `/admin*` 를 그대로 렌더링하지 않는다.
- 관리자 권한이 있어도 일반 사용자 host 에서는 admin shell 을 바로 띄우지 않고 관리자 host 로 넘긴다.

#### 2) 관리자 host

기본 원칙:

- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 관리자 웹의 1차 진입 route 로 본다.
- 일반 사용자 route 는 기본 홈으로 두지 않는다.
- `/` 는 `/admin` 또는 관리자 로그인 후 landing route 로 보낼 수 있다.
- 권한 없는 사용자는 여전히 `/login` 또는 `/forbidden` 으로 막는다.

권장 기본안:

- 관리자 host 의 root start 는 `/admin` 으로 둔다.
- 관리자 host 에서는 일반 사용자용 대시보드 shell 이 아니라 관리자 설치/운영 맥락이 먼저 보이게 한다.

### 결정 D. 관리자 PWA manifest 는 일반 사용자 manifest 와 별도 identity 를 가진다.

이번 1차에서 관리자 PWA 는 아래 기준을 갖습니다.

- `name`: `GW Admin`
- `short_name`: `GW Admin`
- `description`: 관리자 운영/권한/정책/감사 로그용 앱이라는 설명
- `start_url`: `/admin`
- `scope`: `/admin`
- `display`: `standalone`
- `theme_color`: 일반 사용자 앱과 구분 가능한 관리자 톤
- `icons`: 기존 Production-ready (실구현) 아이콘을 재사용하더라도 관리자용 이름/파일 분리 후보를 둠

중요한 점:

- 관리자 manifest 도 같은 origin 상대 경로를 우선합니다.
- 다만 경로 자체는 일반 사용자용 `/manifest.webmanifest` 와 분리해 `/admin/manifest.webmanifest` 또는 동급 route 로 제공하는 것을 기본안으로 둡니다.
- preview 전용 절대 URL 하드코딩은 하지 않습니다.

### 결정 E. 관리자 host 에서는 PWA shell 과 install 맥락도 관리자 기준으로 바꾼다.

이번 단계에서 고정하는 최소 기준:

- 브라우저 metadata title/applicationName 이 관리자 앱 정체성을 드러낸다.
- 설치 안내 문구가 일반 사용자 업무 앱이 아니라 운영/권한/정책/감사 앱이라는 점을 설명한다.
- 모바일 하단 탭 기본 메뉴에 관리자 기능을 섞지 않는 원칙은 유지한다.
- 관리자 host 에서 필요한 경우 admin 전용 shell 또는 navigation variant 를 허용한다.

즉, "같은 코드베이스"를 쓰더라도 설치된 앱의 이름, 시작점, shell 맥락은 다르게 가져갑니다.

### 결정 F. 실제 DNS/custom domain 연결은 별도 승인 게이트로 분리한다.

이번 1차에서 하지 않는 것:

- 실제 `admin.<domain>` DNS 생성
- Cloudflare custom domain 연결
- production certificate / zone 변경
- 외부 공개 범위 확대

이번 단계에서 문서로만 고정하는 것:

- 어떤 host 가 필요하고
- 어떤 동작 차이가 있어야 하며
- 로컬/preview 에서 무엇을 먼저 검증할지

## 5. 이번 Phase에 포함되는 범위

### 문서 범위

- Admin host 분리 + PWA 웹앱 1차 범위 문서 작성
- production/preview/dev host 후보 정의
- 일반 사용자 host 와 관리자 host 의 route/redirect/403 차이 정리
- 관리자 PWA manifest/start_url/scope/theme/icon 기준 정리
- 후속 구현자가 바로 따라갈 파일/테스트/검증 항목 handoff 작성

### 구현 허용 범위

다음 구현 카드에서 허용하는 범위는 아래입니다.

- host header 기반 admin/general host 판별 helper 추가
- Next middleware 또는 layout/route handler 기반 host 분기 추가
- 관리자 host 전용 manifest route / metadata / icon Production-ready (실구현) 추가
- 관리자 host 의 `/` → `/admin` landing 또는 admin login flow 연결
- 일반 사용자 host 에서 `/admin*` 접근 차단 또는 관리자 host 로 redirect
- localhost/dev-safe host 시뮬레이션 helper 및 테스트 추가
- Cloudflare/OpenNext 에서 host 분기를 읽을 수 있는 설정 Production-ready (실구현) 보강

### 이번 1차에서 제외하는 범위

- 실제 DNS/custom domain 생성·변경
- production secret 입력/교체
- production 운영 데이터/사용자/권한 저장
- 별도 native 앱 트랙 생성
- push notification, background sync, offline queue 고도화
- 관리자/일반 사용자 완전 분리 배포를 위한 multi-zone 운영
- 유료 리소스 생성·증설

## 6. host / route / redirect 기준

### A. 일반 사용자 host

허용 route:

- `/`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/org`
- `/employees`
- `/login`
- `/manifest.webmanifest`

관리자 관련 처리:

- `/admin` → 관리자 host 의 `/admin` 으로 redirect 또는 `/login` + 관리자 host 전환 안내
- `/admin/users` → 관리자 host 의 같은 경로로 redirect 또는 차단
- `/admin/policies` → 관리자 host 의 같은 경로로 redirect 또는 차단
- `/admin/audit-logs` → 감사 전용 권한이 있어도 관리자 host 에서만 정상 진입

manifest 기준:

- 일반 사용자 manifest 는 계속 `start_url: "/"`, `scope: "/"`
- 관리자용 manifest 링크/메타데이터는 노출하지 않음

### B. 관리자 host

허용 route:

- `/login`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- 관리자용 manifest route
- 필요 시 `/forbidden`

권장 redirect:

- `/` → `/admin`
- 일반 업무 route 직접 진입 시 `/admin` 으로 보내거나 관리자 앱 범위 밖 안내
- 권한 없는 사용자는 `/login` 또는 `/forbidden`

manifest 기준:

- 관리자 manifest 는 `start_url: "/admin"`, `scope: "/admin"`
- 앱 이름/설명/theme 이 일반 사용자용과 달라야 함

## 7. 구현자가 바로 봐야 할 파일

우선 대상 파일:

- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/app/layout.tsx`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/public/manifest.webmanifest`
- 필요 시 `apps/web/app/admin/...`
- 필요 시 `apps/web/app/manifest.ts` 또는 동급 route handler
- 필요 시 `apps/web/lib/admin-host.ts` 같은 host helper
- `apps/web/admin-preview-guard.test.ts`
- 필요 시 host 분기용 web 테스트
- `apps/web/wrangler.jsonc`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`

## 8. 최소 성공 기준

이번 1차의 최소 성공 기준은 아래입니다.

1. 일반 사용자 host 에서 `/admin*` 가 그대로 렌더링되지 않는다.
2. 관리자 host 에서 `/admin*` 와 관리자 manifest 가 일관된 시작점으로 보인다.
3. 일반 사용자용 manifest 와 관리자용 manifest 의 `name/start_url/scope` 차이가 명확하다.
4. localhost/dev-safe 환경에서 admin host 시뮬레이션이 가능하다.
5. Cloudflare/OpenNext build 와 preview 검증 근거를 남길 수 있다.
6. DNS/custom domain/secret/production data 변경 없이도 위 동작을 설명·검증할 수 있다.

## 9. 검증 기준

다음 구현/리뷰/테스트 카드에서 최소한 아래를 확인합니다.

- `pnpm check`
- `pnpm --filter @gw/web test -- admin-preview-guard`
- host helper/manifest 관련 web 테스트
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- `pnpm --filter @gw/web build:cf`
- 가능하면 local `preview:cf` 에서 host 별 smoke
  - 일반 사용자 host: `/`, `/login`, `/manifest.webmanifest`
  - 관리자 host: `/`, `/admin`, `/admin/users`, 관리자 manifest route

추가로 확인할 것:

- host spoofing 이 바로 권한 우회가 되지 않는지
- host 분리가 있어도 API/server-side 권한 검증은 그대로 유지되는지
- preview/manifest 경로에 절대 preview 도메인이 하드코딩되지 않았는지

## 10. 별도 승인 필요 사항

아래는 다음 단계 후보로 남기되 실행 전 별도 승인이 필요합니다.

1. 실제 `admin.<domain>` DNS/custom domain 연결
2. Cloudflare zone/route/certificate 변경
3. preview/public exposure 확대
4. production secret 입력/교체
5. production 사용자/권한/정책 실데이터 변경
6. 별도 관리자 앱 배포 전략 확정
7. 비용 증가가 있는 리소스 변경

## 11. 요약

이번 1차의 핵심은 하나입니다.

`/admin/*` 를 더 많이 여는 것이 아니라,
"어느 host 에서 어떤 앱 정체성으로 보여 줄지"를 먼저 분리해
관리자 웹을 일반 사용자 웹과 다른 설치/진입 경험으로 안전하게 준비하는 것입니다.
