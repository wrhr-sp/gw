# 그룹웨어 Phase 7 API same-origin 연결 1차 범위

## 1. 문제 정의

현재 저장소 코드에는 same-origin `/api/health`, `/api/me` 브리지가 이미 들어와 있고 로컬 테스트도 통과합니다. 현재 공개 Web preview URL 은 `https://gw-web.wereheresp.workers.dev` 이며, 이전 URL `https://gw-web.werehere31.workers.dev` 는 과거 계정/과거 preview 주소로 현재 HTTP 404 입니다.

이번 Phase의 목표는 "모바일/PWA와 Web이 계속 같은 origin `/api/*` 를 기본값으로 믿을 수 있게" 최소 연결 방식을 정하고, 다음 구현 카드가 안전하게 따라갈 수 있는 범위를 고정하는 것입니다.

## 2. 현재 확인한 사실

확인 기준 파일/문서:

- `apps/web/wrangler.jsonc`
- `apps/api/wrangler.jsonc`
- `apps/web/open-next.config.ts`
- `apps/web/.env.example`
- `apps/web/app/layout.tsx`
- `apps/web/public/manifest.webmanifest`
- `packages/shared/src/contracts.ts`
- `docs/architecture/cloudflare-preview-url-preparation.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`

현재 사실은 아래와 같습니다.

- `apps/web/app/api/health/route.ts`, `apps/web/app/api/me/route.ts`, `apps/web/same-origin-api-bridge.ts` 가 추가되어 same-origin `/api/health`, `/api/me` 요청을 기존 `apps/api/src/app.ts` 로 넘깁니다.
- `same-origin-api-bridge.ts` 는 `/api/me` 에서 dev placeholder cookie 를 그대로 믿지 않도록 `gw_session=dev-placeholder-session_*` 값을 제거합니다.
- 공통 계약은 이미 `packages/shared/src/contracts.ts` 에 same-origin `/api/*` 경로로 정의돼 있습니다.
- Phase 6 모바일/PWA 문서는 `manifest: "/manifest.webmanifest"`, `start_url: "/"`, API 기본 경로 `/api/*` 를 상대 경로 기준으로 유지하라고 못 박고 있습니다.
- `apps/web/.env.example` 는 로컬 개발용 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787` 예시를 두고 있으나, 이것은 로컬 개발 편의를 위한 override 일 뿐 preview/prod 기본값은 아닙니다.
- 로컬 검증에서는 `pnpm --filter @gw/web test api-same-origin-bridge.test.ts`, `pnpm check`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf` 가 통과했습니다.
- 즉, 저장소 코드에서 same-origin 원칙과 Cloudflare용 최종 게이트는 현재 로컬 기준으로 맞춰졌습니다. 공개 preview 에서 새 `/api/*` 결과를 다시 확인했는지는 별도 운영 실행 결과로 남겨야 합니다.

## 3. 선택지 비교

### 옵션 A. `apps/web` 안에 임시 route handler 를 직접 만들어 `/api/health`, `/api/me` 를 Web Worker 가 바로 응답한다.

장점:

- 가장 빨리 404 를 없앨 수 있습니다.
- 별도 API Worker 연결이 없어도 공개 preview 에서 즉시 smoke 가 가능합니다.
- 범위를 `/api/health`, `/api/me` 두 개로 강하게 제한하기 쉽습니다.

단점:

- 이미 `apps/api` 와 `packages/shared` 에 있는 계약을 Web 쪽에 다시 복제하게 됩니다.
- 다음 단계에서 진짜 `gw-api` 와 연결할 때 다시 갈아엎을 가능성이 큽니다.
- 인증/세션 응답 모양이 Web 쪽 임시 구현과 API 쪽 테스트 계약 사이에서 어긋날 위험이 있습니다.

### 옵션 B. 공개 origin 은 그대로 `gw-web` 가 받고, `/api/*` 는 Web 안의 same-origin route 에서 기존 API 계약을 재사용한다.

장점:

- 사용자/PWA 기준 URL 은 계속 same-origin `/api/*` 로 유지됩니다.
- 현재 저장소의 실제 API 시작점(`apps/api`)과 공통 계약(`packages/shared`)을 그대로 재사용할 수 있습니다.
- 별도 공개 API hostname 을 문서/코드 기본값으로 박지 않아도 됩니다.
- local 은 기존 `NEXT_PUBLIC_API_BASE_URL` override 를 유지하고, preview/prod 는 same-origin 을 기본으로 둘 수 있습니다.

단점:

- Web 쪽 route 파일과 브리지 코드, 회귀 테스트, build:cf 검증을 함께 관리해야 합니다.
- 공개 preview 에 반영하려면 Cloudflare용 build blocker 부터 먼저 풀어야 합니다.

### 옵션 C. `gw-api` 를 별도 공개 URL로 두고, Web/PWA 는 환경변수나 rewrite 로 외부 API origin 을 본다.

장점:

- 구조적으로 Web 과 API 를 가장 느슨하게 분리할 수 있습니다.
- API Worker 를 단독으로 smoke 하기는 쉽습니다.

단점:

- same-origin 기본값이 깨집니다.
- 쿠키/세션/CORS/preview 문서 설명이 더 복잡해집니다.
- preview 전용 절대 도메인을 코드/문서에 새기기 쉬워서 Phase 6 원칙과 충돌합니다.
- 이번 카드 목표인 "workers.dev preview 404 해소를 위한 최소 안전 설계"보다 범위가 커집니다.

## 4. 권고안

이번 1차는 옵션 B를 채택했고, 저장소 코드에도 1차 구현이 들어가 있습니다.

즉, 외부에서 보이는 기본 주소는 계속 Web preview origin 하나만 쓰고, Web/OpenNext 쪽 same-origin `/api/*` route 가 기존 `apps/api/src/app.ts` 계약을 그대로 재사용하는 방식을 기본으로 잡습니다.

이유는 간단합니다.

- 제품 기본 URL 원칙을 유지해야 모바일/PWA 문서와 충돌이 없습니다.
- 이미 있는 `apps/api` 계약/테스트를 재사용하는 편이 임시 응답을 따로 복제하는 것보다 안전합니다.
- 별도 공개 API 도메인을 기본값으로 도입하면 지금 얻는 것보다 운영 설명 부담이 더 커집니다.

## 5. 이번 Phase에 포함되는 범위

### 문서/의사결정 범위

- same-origin 연결 1차 기준 문서 작성
- Phase 6 PWA/mobile 과 충돌 없는 base URL/API URL/manifest 원칙 확정
- preview 에서 무엇을 확인하고 무엇은 아직 하지 않는지 구분
- 다음 구현 카드가 바로 따라갈 파일/검증 기준 정리

### 구현자가 따라야 할 기술 방향

대상 파일/시작점:

- `apps/web/app/api/health/route.ts`
- `apps/web/app/api/me/route.ts`
- `apps/web/same-origin-api-bridge.ts`
- `apps/web/api-same-origin-bridge.test.ts`
- `apps/web/open-next.config.ts`
- `apps/web/.env.example`
- 필요 시 Web 테스트 파일
- 필요 시 `docs/guides/cloudflare-first-developer-guide.md`

이번 1차에서 고정하는 기술 방향은 아래와 같습니다.

1. 외부 기본 URL은 Web origin 하나로 유지합니다.
   - preview: 현재 `https://gw-web.wereheresp.workers.dev`
   - production: 나중에 custom domain 이 붙더라도 원칙은 동일

2. API 기본 경로는 계속 same-origin 상대 경로 `/api/*` 입니다.
   - Web/PWA 코드 기본값에 preview 전용 절대 API 도메인을 넣지 않습니다.
   - 별도 origin 이 정말 필요하면 기본값이 아니라 환경변수 override 로만 둡니다.

3. Web 쪽 same-origin route 는 기존 API 계약을 그대로 재사용합니다.
   - 현재 저장소는 `apps/web/app/api/*` route 에서 `apps/web/same-origin-api-bridge.ts` 를 통해 `apps/api/src/app.ts` 를 호출합니다.
   - 생성 산출물(`.open-next/*`)을 직접 수정하는 방식은 피합니다.

4. 최소 성공 범위는 `/api/health`, `/api/me` 입니다.
   - `/api/health` 는 200 + JSON 계약 응답
   - `/api/me` 는 무인증이면 401 + JSON 에러 응답, placeholder 세션이 있으면 현재 계약에 맞는 JSON 응답

5. `/api/auth/login`, `/api/auth/logout` 및 나머지 placeholder API 는 이번 카드의 필수 완료 조건이 아닙니다.
   - 다만 브리지가 generic 하게 잡혀 추가 endpoint 도 같은 방식으로 안전하게 붙는 구조라면 막을 필요는 없습니다.
   - 반대로 범위가 커지면 `/api/health`, `/api/me` 성공과 회귀 테스트 확보를 우선합니다.

### Phase 6 PWA/mobile 이 이어받을 URL 원칙

- manifest 는 계속 `"/manifest.webmanifest"` 상대 경로 기준을 유지합니다.
- `start_url` 은 계속 `"/"` 를 유지합니다.
- 모바일/PWA 설치 안내 문구에는 preview 전용 절대 API hostname 을 넣지 않습니다.
- Web/PWA 의 base URL 설명은 "현재 열려 있는 origin" 기준으로 적고, API 는 그 아래 `/api/*` 로 설명합니다.
- 로컬 개발에서만 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787` 같은 override 를 허용합니다.

### preview smoke 기준

같은 origin 기준으로 아래가 다시 맞아야 합니다.

- `/` → 200
- `/login` → 200
- `/boards` → 200
- `/documents` → 200
- `/manifest.webmanifest` → 200
- 저장소 로컬 테스트 기준 `/api/health` → 200 JSON
- 저장소 로컬 테스트 기준 `/api/me` → 401 JSON, forged placeholder cookie 도 401 JSON
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` → `/login` 으로 307 redirect 유지
- 공개 preview URL 에서 최신 same-origin/admin 코드를 다시 smoke 했는지는 별도 운영 실행 결과로 남겨야 합니다.

## 6. 이번 Phase에서 하지 않는 일

이번 1차에서 제외하는 일은 아래와 같습니다.

- D1 바인딩 추가
- production/staging DB migration 실행
- 실데이터 반입 또는 수정
- 실제 OAuth/SSO/외부 인증 공급자 연결
- custom domain/DNS 연결
- 별도 공개 API hostname 을 기본값으로 문서/코드에 확정
- R2/KV/Queue/Durable Object/Cron 운영 리소스 생성
- 급여/노무 UI 자체 구현
- preview/prod 에서 secret 값 출력 또는 커밋

## 7. 별도 승인 필요 사항

1. 실제 preview 재배포를 넘어선 production 공개 확대
2. custom domain/DNS 작업
3. production secret 입력/교체
4. production DB migration / 실데이터 연결
5. 별도 공개 API domain 을 사용자 기본 경로로 도입하는 구조 변경
6. 급여/노무 실계산, 세무/노무 데이터 처리 기능 확장

## 8. 구현 카드 Definition of Done

다음 구현 카드(`Phase 구현: Phase 7 API same-origin 연결 1차`)는 아래를 만족하면 됩니다.

1. 저장소 로컬 검증 기준 same-origin `/api/health` 가 명확한 JSON 을 반환한다.
2. 저장소 로컬 검증 기준 same-origin `/api/me` 가 계약에 맞는 401 또는 세션 응답을 반환하고 forged placeholder cookie 를 그대로 믿지 않는다.
3. `manifest` 와 앱 내부 링크는 여전히 상대 경로 정책을 유지한다.
4. preview 전용 절대 API hostname 을 기본값으로 커밋하지 않는다.
5. 최소 회귀 테스트가 추가되어 브리지/가드가 깨졌을 때 바로 잡을 수 있다.
6. `pnpm check` 와 `pnpm --filter @gw/web build:cf` 가 모두 통과하고, 이 결과가 handoff 에 남는다.
7. 공개 preview smoke 결과와 남은 한계, 또는 공개 preview 재배포/재검증 여부가 handoff 에 분리 기록된다.

## 9. 구현자가 바로 따라갈 체크리스트

1. `packages/shared/src/contracts.ts` 의 `/api/health`, `/api/me` 계약을 다시 읽는다.
2. `apps/api/src/app.ts` 의 실제 응답 모양을 확인한다.
3. `apps/web/app/api/health/route.ts`, `apps/web/app/api/me/route.ts`, `apps/web/same-origin-api-bridge.ts` 구현을 먼저 확인한다.
4. Web 쪽 브리지 구현은 생성 결과물이 아니라 저장소 소스 파일 기준으로 유지한다.
5. 로컬에서는 기존 `NEXT_PUBLIC_API_BASE_URL` 개발 편의를 깨지 않게 확인한다.
6. `pnpm check` 와 `pnpm --filter @gw/web build:cf` 를 먼저 통과시킨다.
7. 가능하면 `pnpm --filter @gw/web preview:cf` 로 `/api/health`, `/api/me` smoke 를 다시 남긴다.
8. live `.workers.dev` fetch 가 보안 gate 에 막히면 로컬 preview smoke + deployments metadata + 기존 상위 smoke 기록을 근거로 handoff 한다.

## 10. 다음 문서/Phase 연결

- Phase 6 모바일/PWA 는 계속 이 문서와 `docs/architecture/phase-6-mobile-pwa-scope.md` 를 함께 봅니다.
- Cloudflare preview 운영 기준은 `docs/architecture/cloudflare-preview-url-preparation.md` 를 함께 봅니다.
- 플랫폼 큰 흐름에서는 "same-origin API 연결 1차"가 끝난 뒤에야 급여/노무 같은 Phase 7+ UI 확장을 안전하게 이어갈 수 있습니다.

즉, 이번 문서는 급여/노무 기능 문서보다 앞단에 있는 "Web/PWA 와 API 기본 배관을 같은 origin 으로 먼저 맞추는 게이트"라고 이해하면 됩니다.
