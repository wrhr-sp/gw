# Admin host 운영 설계 + preview 검증 확장 handoff

한 줄 요약:
이번 후속 작업은 admin host 분리 기능을 새로 크게 만드는 작업이 아니라, 이미 들어간 host/manifest 분리 코드를 운영 규칙과 검증 기준까지 같은 뜻으로 맞추는 작업입니다.

## 1. 먼저 이해해야 할 현재 상태

현재 코드 기준으로 이미 들어간 것:

- `apps/web/admin-host.ts`
  - admin host 판별 helper
  - preview/local/allowlist 기반 admin host 분류
  - `Host` 헤더만 신뢰
- `apps/web/admin-preview-guard.ts`
  - admin host root `/` → `/admin`
  - admin host 에서 일반 업무 route 차단
  - 익명 일반 host `/admin*` → `/login`
- `apps/web/app/mobile-pwa-config.ts`
  - 일반 사용자용/관리자용 app shell, nav, manifest identity 분리
- `apps/web/public/manifest.webmanifest`
  - 일반 사용자용 manifest 기준 파일
- `apps/web/app/admin/manifest.webmanifest/route.ts`
  - 관리자용 manifest route
- `apps/web/middleware.ts`
  - broad matcher 로 host/route 경계 적용

즉, 이번 작업은 "아무것도 없는 상태에서 설계"가 아니라, 이미 만들어진 초안을 더 안전하고 검증 가능하게 맞추는 단계입니다.

## 2. 구현자가 가장 먼저 볼 핵심 gap

### gap 1. 일반 host admin fallback 이 아직 문서 기대와 완전히 맞지 않는다

현재 문서 기준 핵심 원칙은:

- 일반 사용자 host 에서는 `/admin*` 가 그대로 렌더링되면 안 된다.
- admin role 이라도 가능하면 admin host 로 옮겨서 열어야 한다.
- paired admin host 를 계산하지 못하면 그대로 allow 하는 것보다 차단이 안전하다.

그런데 현재 `apps/web/admin-preview-guard.ts` 는
"일반 host + admin role + paired admin host 없음" 케이스에서 allow 로 흘러갈 여지가 있습니다.

이 부분이 이번 후속 구현에서 가장 먼저 다시 맞춰야 할 포인트입니다.

권장 기본안:

- redirect host 를 계산할 수 있으면 admin host 로 redirect
- 계산할 수 없으면 `/forbidden` 또는 명시적 차단
- allow 는 하지 않음

### gap 2. preview 검증 절차가 작업자 머릿속에만 있으면 안 된다

이번 체인에서는 아래를 문서/코멘트/summary 에 남겨야 합니다.

- 어떤 host 조합으로 local/preview 를 재현했는지
- 어떤 route 를 확인했는지
- live fetch 가 막히면 무엇을 대체 증거로 썼는지
- `/manifest.webmanifest` 는 일반 manifest 를, `/admin/manifest.webmanifest` 는 관리자 manifest 를 실제로 내려줬는지

### gap 3. 문서가 "현재 구현 사실"과 "목표 동작"을 섞어 쓰면 안 된다

예를 들어 아래는 분리해서 적어야 합니다.

- 현재 사실: 일반 사용자 host 는 `/manifest.webmanifest`, 관리자 host 는 `/admin/manifest.webmanifest` 를 manifest href 로 쓴다.
- 목표 동작: 관리자 host 에서는 관리자 identity manifest 가 나와야 한다.
- 남은 수정 포인트: 일반 host fallback 차단을 더 엄격히 맞춘다.

## 3. 구현 우선순위

### 1순위. route guard fallback 정리

우선 파일:

- `apps/web/admin-preview-guard.ts`
- `apps/web/admin-preview-guard.test.ts`

꼭 맞출 것:

1. 익명 + 일반 host + `/admin*` → `/login`
2. 관리자 role + 일반 host + paired admin host 있음 → admin host redirect
3. 관리자 role + 일반 host + paired admin host 없음 → allow 금지, 차단/forbidden
4. 관리자 host + `/` → `/admin`
5. 관리자 host + 일반 업무 route → `/admin`
6. 감사 role 은 `/admin/audit-logs` 에서만 allow

### 2순위. host helper 기대값 다시 확인

우선 파일:

- `apps/web/admin-host.ts`
- `apps/web/admin-host.test.ts`

꼭 맞출 것:

- `GW_ADMIN_HOSTS` 없으면 `admin.example.com` 같은 모양만으로 admin host 인정 금지
- `gw-admin.*.workers.dev` 는 admin host
- `gw-web.*.workers.dev` 는 일반 host
- `admin.localhost`, `admin.127.0.0.1.nip.io` 는 admin host
- `x-forwarded-host` 는 무시

### 3순위. manifest/app shell 기대값 회귀 보호

우선 파일:

- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/mobile-pwa.test.ts`
- `apps/web/public/manifest.webmanifest`
- 필요 시 `apps/web/app/layout.tsx`
- `apps/web/app/admin/manifest.webmanifest/route.ts`

꼭 맞출 것:

- 일반 사용자 manifest 는 `apps/web/public/manifest.webmanifest` 와 동일한 값을 유지한다.
- 관리자 host: `name: GW Admin`, `start_url: /admin`, `scope: /admin`
- app shell/nav/install guide 가 host 별로 갈린다는 점
- 문서가 `/manifest.webmanifest` 도 관리자용으로 바뀌는 것처럼 오해하게 쓰지 않기

## 4. 테스트/검증 우선순위

최소 검증:

```bash
pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa
pnpm --filter @gw/web typecheck
pnpm --filter @gw/web build
pnpm --filter @gw/web build:cf
pnpm check
```

Cloudflare/preview 보강:

```bash
bash scripts/gw-cloudflare-check.sh
```

가능하면 추가:

- `set -a; . .secrets/cloudflare.env; set +a; pnpm --filter @gw/web preview:cf`
- 별도 터미널에서 `bash scripts/gw-admin-host-preview-smoke.sh`
- `wrangler deployments list` 로 최신 배포 version 확인
- `/`, `/login`, `/manifest.webmanifest`, `/admin/manifest.webmanifest`, `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 결과 기록

live `.workers.dev` fetch 가 막히면 바로 blocked 로 끝내지 말고 아래를 substitute evidence 로 남깁니다.

- build/build:cf 결과
- 로컬 smoke 결과
- deployment metadata
- 상위 live smoke 메모

## 5. 리뷰어가 볼 포인트

리뷰 카드는 아래를 특히 보면 됩니다.

1. 일반 host fallback 에서 admin shell 이 남지 않는가
2. host 분리가 권한 우회 통로가 되지 않는가
3. `Host` 헤더 신뢰 경계가 흐려지지 않았는가
4. `GW_ADMIN_HOSTS` allowlist 규칙이 문서/코드/테스트에서 같은가
5. manifest 설명이 실제 구현 방식과 다르지 않은가

## 6. 테스터가 볼 포인트

테스트 카드는 아래를 특히 보면 됩니다.

- preview/local host 조합별 `/admin*` 처리 결과
- 관리자 host 의 `/` → `/admin`
- 관리자 host 에서 일반 업무 route 차단
- `/manifest.webmanifest` 는 일반 manifest, `/admin/manifest.webmanifest` 는 관리자 manifest 를 주는지
- `pnpm check` 까지 실제 통과하는지
- live fetch 가 막히면 어떤 대체 증거를 썼는지

## 7. 문서화 카드가 반영할 포인트

문서화 카드는 아래를 반영하면 됩니다.

- `SPEC.md`: host 신뢰 경계, 일반 host fallback 차단, manifest 동작
- `TEST_PLAN.md`: preview/local/live smoke 순서와 대체 증거 기준
- `QA_CHECKLIST.md`: 일반 host admin 노출 금지, allowlist, manifest 분기, fallback 차단
- `HANDOFF.md`: 현재 활성 체인, 최신 남은 gap, 검증 결과
- `KNOWN_ISSUES.md`: 실제 남은 제한만 남기고 stale 설명 제거
- `CHANGELOG.md`: 이번 확장 작업 반영 내용 기록

## 8. 이번 범위에서 하지 말 것

- DNS/custom domain 생성·변경
- secret 입력/교체
- production DB 실데이터/운영 사용자/권한 변경
- Cloudflare 유료 리소스 증설
- 외부 HR 연동
- native 앱 트랙 분기

## 9. 완료 판단 기준

다음 조건이 맞으면 이번 체인을 닫아도 됩니다.

- 일반 host 에서 `/admin*` 가 그대로 열리지 않는다.
- 관리자 role 이 일반 host 로 들어왔을 때도 안전한 redirect/차단 규칙이 일관된다.
- 관리자 host route boundary 와 manifest/app shell 분기가 테스트로 보호된다.
- Cloudflare preview/dev 검증 방법과 대체 증거 기준이 문서화돼 있다.
- 리뷰어/테스터/문서화 카드가 같은 말을 한다.
