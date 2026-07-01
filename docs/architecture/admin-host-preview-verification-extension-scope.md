# Admin host 운영 설계 + preview 검증 확장 범위

## 1. 한 줄 정의

이번 작업의 목표는 이미 들어가 있는 admin host 분리 코드를 "운영 규칙 + preview 검증 기준 + QA 기준"까지 같은 말로 맞춰서, 다음 구현/리뷰/테스트/문서화 카드가 어디를 고쳐야 하는지 헷갈리지 않게 만드는 것입니다.

쉽게 말하면, 1차에서 만든 host 분리 Production-ready (실구현) 을 실제 운영 규칙에 더 가깝게 다듬고, Cloudflare preview/dev 에서 어떻게 확인할지까지 기준을 잠급니다.

## 2. 왜 이 후속 작업이 필요한가

현재 저장소에는 이미 아래가 들어와 있습니다.

- `apps/web/admin-host.ts`
  - `GW_ADMIN_HOSTS` allowlist
  - `gw-admin.*.workers.dev` preview admin host 판별
  - `admin.localhost`, `admin.127.0.0.1.nip.io` 로컬 후보 판별
  - `Host` 헤더만 신뢰하고 `x-forwarded-host` 는 쓰지 않음
- `apps/web/admin-preview-guard.ts`
  - 관리자 host 의 `/` → `/admin`
  - 관리자 host 에서 일반 업무 route 를 `/admin` 으로 되돌림
  - 일반 사용자 host 의 익명 `/admin*` 를 `/login` 으로 보냄
- `apps/web/app/mobile-pwa-config.ts`
  - 일반 사용자용 / 관리자용 manifest identity 분리
- `apps/web/public/manifest.webmanifest`
  - `/manifest.webmanifest` 는 일반 사용자 manifest 정체성의 기준 파일
- `apps/web/app/admin/manifest.webmanifest/route.ts`
  - 관리자 host 가 광고하는 `/admin/manifest.webmanifest` 에서 admin manifest 반환
- `apps/web/middleware.ts`
  - broad matcher 로 host/route 경계를 적용

하지만 아직 아래 4가지는 더 분명히 맞춰야 합니다.

1. 문서와 코드가 말하는 "일반 host 에서 admin 진입 차단" 기준을 더 분명히 맞춰야 한다.
2. 알려진 edge case 하나가 있다.
   - 현재 `apps/web/admin-preview-guard.ts` 는 "관리자 role + 일반 host + 짝지을 admin host 를 계산하지 못한 경우"에 `/admin` 을 그대로 allow 할 수 있다.
   - 예: 문서상 안전한 기본값은 차단/유도인데, 코드상 일부 host 에서는 admin shell 이 열릴 여지가 남아 있다.
3. Cloudflare preview 검증 기준이 아직 "무엇을 어떤 순서로 확인할지"까지 한 문서로 잠겨 있지 않다.
4. QA/checklist 가 현재 구현 상태와 남은 gap 을 동시에 드러내야 한다.

즉, 이번 후속 작업은 새 기능을 크게 더 여는 게 아니라, 이미 있는 host 분리 기능을 운영 가능한 규칙으로 정리하고 회귀 포인트를 늘리는 작업입니다.

## 3. 이번에 고정할 핵심 결정

### 결정 A. admin host 판별은 계속 `Host` 헤더 + allowlist/패턴만 사용한다.

반드시 유지할 것:

- production admin host 는 `GW_ADMIN_HOSTS` allowlist 에 들어간 host 만 admin host 로 본다.
- `admin.example.com` 처럼 생겼다는 이유만으로 자동 허용하지 않는다.
- preview admin host 는 `gw-admin.*.workers.dev` 패턴을 쓴다.
- local/dev 후보는 `admin.localhost`, `admin.127.0.0.1.nip.io` 를 기본으로 둔다.
- `x-forwarded-host` 는 spoof 가능하므로 권한/host 경계 근거로 쓰지 않는다.

### 결정 B. 일반 사용자 host 에서는 `/admin*` 가 그대로 렌더링되면 안 된다.

이번 확장 작업의 가장 중요한 기준입니다.

권장 기본 동작:

1. 익명 + 일반 사용자 host + `/admin*`
   - `/login` 으로 보낸다.
2. 관리자 role + 일반 사용자 host + paired admin host 를 계산할 수 있음
   - 같은 path 를 admin host 로 redirect 한다.
3. 관리자 role + 일반 사용자 host + paired admin host 를 계산할 수 없음
   - 그대로 allow 하지 말고 `/forbidden` 또는 명시적 차단으로 처리한다.
4. 일반 사용자/감사 role + 일반 사용자 host + `/admin*`
   - `/forbidden` 또는 `/login` 으로 처리한다.

즉, "admin role 이면 아무 일반 host 에서나 `/admin` 을 열 수 있음"은 이번 기준에서 허용하지 않습니다.

### 결정 C. 관리자 host 는 route boundary 를 더 엄격히 유지한다.

관리자 host 에서는 아래만 우선 허용합니다.

- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/login`
- `/forbidden`
- `/manifest.webmanifest`
- `/offline`

그 밖의 일반 업무 route 는 계속 `/admin` 으로 되돌리는 쪽을 기본안으로 둡니다.

### 결정 D. manifest 는 "일반 경로 + 관리자 전용 경로"를 현재 기준으로 본다.

문서/QA 는 아래를 같은 뜻으로 써야 합니다.

- `/manifest.webmanifest` 는 일반 사용자 manifest 로 고정한다.
- 관리자 host 가 실제 페이지에서 광고하는 manifest href 는 `/admin/manifest.webmanifest` 다.
- 반환 내용도 route 역할에 맞게 달라져야 한다.
- 일반 사용자 manifest:
  - `name: GW Cloudflare-first Production-ready (실구현)`
  - `start_url: /`
  - `scope: /`
- 관리자 manifest:
  - `name: GW Admin`
  - `start_url: /admin`
  - `scope: /admin`

즉, 핵심은 "관리자 host 의 실제 설치 기준은 `/admin/manifest.webmanifest`" 라는 점을 문서/검증이 숨기지 않는 것입니다.

### 결정 E. preview 검증은 live fetch 하나에만 의존하지 않는다.

우선 검증 순서:

1. `bash scripts/gw-cloudflare-check.sh`
2. `pnpm --filter @gw/web build:cf`
3. `pnpm check`
4. 필요한 범위의 web 테스트
5. 가능하면 로컬 `preview:cf` smoke
6. 가능하면 `wrangler deployments list` 로 최신 배포 version 확인
7. live `.workers.dev` fetch 가 막히면
   - 로컬 smoke
   - build/build:cf
   - deployments metadata
   - 상위 live smoke 메모
   를 대체 근거로 남긴다.

즉, 네트워크 gate 때문에 live URL fetch 가 막혀도 곧바로 실패로 끝내지 말고, 대체 증거를 남기는 방식으로 검증 기준을 확장합니다.

## 4. 포함 범위

### 문서/기획 범위

- admin host 운영 규칙 재정리
- preview/dev host 시뮬레이션 규칙 정리
- host 별 route/manifest 기대 동작 정리
- 남은 edge case 와 우선 수정 포인트 명시
- QA/test/handoff 문구 강화

### 구현 범위

다음 구현 카드에서 허용하는 최소 범위:

- `apps/web/admin-preview-guard.ts` 의 일반 host admin 진입 fallback 정리
- 관련 테스트 기대값 갱신
- 필요 시 helper 로직의 redirect 가능 여부/차단 기본값 보강
- preview/local smoke 를 위한 route/manifest 검증 포인트 정리
- 문서/QA/HANDOFF/CHANGELOG 최신화

### 검증 범위

- `pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- `pnpm --filter @gw/web build:cf`
- `pnpm check`
- 가능하면 `preview:cf` 기반 smoke
- 가능하면 Cloudflare deployment metadata 확인

## 5. 제외 범위

이번 카드와 다음 구현 체인에서 하지 않는 것:

- 실제 DNS/custom domain 생성·변경
- Cloudflare 유료 리소스 생성·증설
- secret 입력/교체
- production DB 실데이터/운영 사용자/권한 변경
- 실제 외부 HR 연동
- 별도 native 앱 트랙 생성
- multi-zone 운영 구조 확대

## 6. 구현자가 바로 볼 우선 파일

코드:

- `apps/web/admin-host.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/middleware.ts`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/public/manifest.webmanifest`
- `apps/web/app/admin/manifest.webmanifest/route.ts`
- `apps/web/admin-host.test.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/mobile-pwa.test.ts`

문서:

- `docs/architecture/admin-host-pwa-pass-1-scope.md`
- `docs/guides/admin-host-pwa-pass-1-handoff.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `HANDOFF.md`

## 7. 다음 작업자에게 남기는 핵심 질문

다음 구현자는 아래를 먼저 정리하면 됩니다.

1. 일반 host 에서 admin role 이 들어왔는데 paired admin host 를 모를 때 기본값을 무엇으로 둘지
   - 권장: allow 금지, `/forbidden` 또는 차단
2. 현재 broad matcher 가 admin host route boundary 를 과하거나 부족하게 잡는 곳이 없는지
3. `preview:cf` smoke 에서 일반 host 와 admin host 를 어떤 host 조합으로 재현할지
4. 문서가 현재 구현 사실과 목표 동작을 섞어 쓰지 않도록 어떤 문장을 분리해야 하는지

## 8. 완료 기준

이 후속 체인의 완료 기준은 아래입니다.

- 일반 사용자 host 에서 `/admin*` 가 그대로 열리지 않는다.
- 관리자 host 에서 `/` → `/admin`, 일반 route 차단, 관리자 manifest 반환이 일관되다.
- `GW_ADMIN_HOSTS` allowlist / `Host` 헤더 신뢰 경계 / `x-forwarded-host` 비신뢰 원칙이 코드·테스트·문서에서 같은 뜻이다.
- Cloudflare preview/dev 검증 방법이 문서화돼 있고, live fetch 실패 시 대체 증거 기준도 남아 있다.
- 다음 리뷰어와 테스터가 볼 체크포인트가 명확하다.
