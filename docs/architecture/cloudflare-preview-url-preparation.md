# Cloudflare preview URL 준비 범위와 승인 게이트

## 1. 목적

이 문서는 Phase 5 최종 보고 이후, 실제 production 배포 전에 Cloudflare preview URL 준비 범위와 승인 게이트를 정리한 문서입니다.
지금 단계는 "외부 공개 URL을 실제로 만드는 작업"이 아니라, 현재 저장소 기준으로 무엇이 이미 준비되어 있고 무엇이 아직 승인 대상인지 구분하는 데 목적이 있습니다.

## 2. 현재 저장소에서 확인한 사실

확인 기준 파일:

- `apps/web/open-next.config.ts`
- `apps/web/wrangler.jsonc`
- `apps/web/package.json`
- `apps/api/wrangler.jsonc`
- `apps/api/wrangler.bindings.example.jsonc`
- `apps/web/public/manifest.webmanifest`
- `apps/web/app/layout.tsx`

현재 확인 결과:

- Web은 `@opennextjs/cloudflare` 기반이며 `pnpm --filter @gw/web build:cf` 로 OpenNext Cloudflare 빌드가 실제 통과한다.
- Web wrangler 설정은 `.open-next/worker.js` 를 메인으로 쓰는 Workers 배포 형태다.
- Web 설정에는 `ASSETS`, `WORKER_SELF_REFERENCE`, `IMAGES` 바인딩만 있고, preview 준비 단계에서 필수 D1/R2/KV 바인딩은 없다.
- `apps/web/open-next.config.ts` 는 incremental cache 를 별도로 켜지 않으므로, 현재 preview 준비 범위에서 R2 선행 생성 전제가 없다.
- API wrangler 활성 설정은 `APP_ENV`, `API_VERSION` 정도만 두고 있으며 D1/KV/R2/Queues/Durable Objects/Cron 은 활성 설정에 넣지 않았다.
- `apps/api/wrangler.bindings.example.jsonc` 는 D1/KV/R2/Queue/Durable Object/Cron 예시 구조만 제공하며 값은 모두 `replace-after-approval` 상태다.
- PWA manifest 는 이미 `apps/web/public/manifest.webmanifest` 에 있고 `start_url` 이 `/`, layout metadata 도 `manifest: "/manifest.webmanifest"` 로 상대 경로 기준이다.

## 3. 이번 단계에서 확인한 로컬 검증 결과

실행한 명령:

- `pnpm --filter @gw/web build:cf`
- `pnpm check`

실제 확인 결과 요약:

- `pnpm --filter @gw/web build:cf` 통과
  - OpenNext Cloudflare build 성공
  - `.open-next/worker.js` 생성
  - `/boards`, `/boards/[boardId]`, `/documents`, `/posts/[postId]` 포함 Next.js build 성공
- `pnpm check` 통과
  - workspace test + typecheck 성공
  - `apps/api/test/auth-org.spec.ts` 포함 총 40개 API 테스트 통과

즉, 현재 저장소는 "Cloudflare용 로컬 빌드 확인까지 끝난 preview 준비 상태"로 볼 수 있습니다.
다만 이것은 public exposure 승인이나 실제 Cloudflare 계정 작업이 끝났다는 뜻이 아닙니다.

## 4. preview URL 후보 정리

### 기본 후보: `workers.dev`

현재 저장소 기준 1순위 후보는 `workers.dev` 입니다.

이유:

- `apps/web/wrangler.jsonc` 가 Workers 엔트리(`.open-next/worker.js`) 기준이다.
- `apps/web/package.json` 의 배포 스크립트도 `opennextjs-cloudflare deploy` 로 Workers 흐름에 맞춰져 있다.
- 현재 구조는 Pages 정적 배포보다 "OpenNext가 생성한 Worker" 를 올리는 모델에 가깝다.

정리:

- preview URL 준비 문서 기준 기본 방향은 `https://<name>.workers.dev` 계열을 상정한다.
- 실제 `<name>` 생성, 배포 실행, public exposure 는 별도 승인 전까지 하지 않는다.

### 보조 후보: `pages.dev`

`pages.dev` 는 이번 저장소 기준 기본 후보가 아닙니다.

이유:

- 현재 저장소는 Pages 전용 설정 파일이나 Pages 중심 배포 절차를 주 설정으로 두고 있지 않다.
- OpenNext + Worker 기준 구성을 Pages 중심 preview 로 바꾸려면 배포 방식, 함수 연결 방식, 운영 문서를 다시 맞춰야 한다.

정리:

- `pages.dev` 는 "대체 가능성 검토 후보" 정도로만 남긴다.
- 실제로 `pages.dev` 를 쓰려면 별도 아키텍처 승인과 설정 재검토가 먼저 필요하다.

## 5. 지금 단계에서 승인 없이 가능한 범위

아래는 현재 승인 없이 가능한 범위입니다.

- 로컬 `pnpm check`, `pnpm build`, `pnpm --filter @gw/web build:cf` 실행
- `wrangler.jsonc`, OpenNext 설정, manifest, placeholder env 예시 점검
- preview 준비 문서 작성
- workers.dev/pages.dev 후보 비교와 승인 게이트 정리
- Phase 6 모바일/PWA handoff 기준 정리

## 6. 별도 승인 전 하면 안 되는 일

아래는 이번 카드 범위에서 실행하면 안 되는 일입니다.

- 실제 Cloudflare token 입력 또는 계정 로그인
- 실제 preview URL 생성
- 실제 `wrangler deploy` 또는 동급 외부 공개 배포 실행
- public exposure 가 생기는 Workers/Pages 배포
- DNS/도메인 연결
- 유료 리소스 생성
- 실제 D1/KV/R2/Queue/Durable Object/Cron 리소스 생성 또는 운영 연결
- production DB migration
- 실제 운영 파일 업로드 또는 실데이터 반입

## 7. 승인 게이트 정리

### 게이트 A. 내부 준비 확인

아래가 모두 만족되면 "배포 준비 문서화 완료"로 본다.

- `pnpm check` 통과
- `pnpm --filter @gw/web build:cf` 통과
- 현재 활성 wrangler 설정에 실운영 secret/리소스 ID 가 없음
- preview URL 기본 후보가 `workers.dev` 로 문서화됨
- `pages.dev` 는 대체 후보이지만 기본 경로가 아니라는 점이 문서화됨

### 게이트 B. 외부 공개 전 승인

아래 항목은 실제 preview URL 을 만들기 전에 별도 승인 받아야 한다.

1. Cloudflare 계정/토큰 사용 승인
2. 실제 외부 URL 생성 승인
3. public exposure 허용 여부 승인
4. DNS/도메인 작업 필요 시 그 작업 승인
5. D1/R2/KV 등 실제 리소스 생성 필요 시 그 작업 승인
6. 비용 발생 가능성이 있으면 비용 승인

### 게이트 C. production 전환 전 승인

preview 와 production 은 별도다.
다음은 production 전환 전에 다시 승인 받아야 한다.

- production 도메인 연결
- production DB migration
- production R2 운영 업로드
- 실제 secret 반영
- 실사용 데이터 반입
- 외부 사용자 대상 공개 시작

## 8. 승인 후 즉시 사용할 preflight 입력값 / 명령 준비

실제 배포 실행은 하지 않지만, 승인 뒤 어떤 값과 명령이 필요한지는 지금 단계에서 고정해 둘 수 있습니다.

### 8-1. 로컬 비커밋 secret 파일 후보

`scripts/gw-cloudflare-check.sh` 는 기본적으로 아래 파일을 읽습니다.

- 기본 경로: `.secrets/cloudflare.env`
- 대체 경로: `bash scripts/gw-cloudflare-check.sh /absolute/or/relative/path/to/cloudflare.env`

파일 예시 형식:

```dotenv
CLOUDFLARE_API_TOKEN=<fill-after-approval>
CLOUDFLARE_ACCOUNT_ID=<fill-after-approval>
```

원칙:

- `.secrets/` 는 gitignore 대상이라 저장소에 커밋하지 않는다.
- 권한은 `chmod 600 .secrets/cloudflare.env` 를 권장한다.
- 값은 출력하지 않고 길이만 검사한다.
- 이 카드 범위에서는 실제 값을 넣거나 로그인하지 않는다.

### 8-2. 승인 후 사용할 인증/사전점검 명령

실제 토큰이 승인되면 아래 순서로 preflight 를 수행하면 된다.

1. `mkdir -p .secrets && chmod 700 .secrets`
2. `.secrets/cloudflare.env` 작성 후 `chmod 600 .secrets/cloudflare.env`
3. `bash scripts/gw-cloudflare-check.sh`

현재 스크립트가 실제로 확인하는 것:

- `CLOUDFLARE_API_TOKEN` 입력 여부
- `CLOUDFLARE_ACCOUNT_ID` 입력 여부
- `wrangler` 설치 여부
- `wrangler --version`
- `wrangler whoami`

즉, 승인만 나면 "Cloudflare 인증이 실제로 되는지" 를 배포 전 별도 preflight 단계로 분리해 확인할 수 있다.

### 8-3. 승인 후 사용할 web 배포 명령 후보

현재 저장소의 실제 배포 명령 후보는 아래 하나로 정리한다.

- `pnpm --filter @gw/web deploy:cf`

이 명령이 참조하는 현재 스크립트:

- `apps/web/package.json`: `opennextjs-cloudflare build && opennextjs-cloudflare deploy`
- `apps/web/wrangler.jsonc`: Worker 엔트리 `.open-next/worker.js`
- `apps/web/open-next.config.ts`: incremental cache 추가 리소스 비활성 상태

정리:

- 승인 전에는 위 명령을 실행하지 않는다.
- 승인 후에는 먼저 `bash scripts/gw-cloudflare-check.sh` 를 통과시킨 뒤, 로컬 build 재확인 후 배포 명령으로 넘어간다.

### 8-4. preview smoke path 후보

실제 preview URL 이 발급되면 1차 smoke 는 아래 경로를 우선 후보로 둔다.

- `/`
- `/login`
- `/dashboard`
- `/boards`
- `/boards/board_general`
- `/documents`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/manifest.webmanifest`
- `/api/health`
- `/api/me`
- `/api/companies`
- `/api/roles`
- `/api/attendance/records`
- `/api/leave/requests`
- `/api/notices`
- `/api/boards`
- `/api/documents/spaces`

선정 근거:

- `/`, `/login`, `/dashboard` 는 기본 shell / 진입 UX 확인용
- `/boards`, `/boards/board_general`, `/documents` 는 Phase 5 범위 placeholder 화면 확인용
- `/admin` 계열은 현재 build 결과에 포함되므로 외부 preview 에서 접근 경계가 유지되는지 우선 확인해야 함
- `/manifest.webmanifest` 는 Phase 6 PWA handoff 와 직접 연결됨
- `/api/health` 는 same-origin API 연결 최소 확인점이다
- `/api/me` 는 무인증 상태에서 401 이 나와야 정상인 경계 확인점이다
- 조직/근태/휴가/게시판/문서 API 는 same-origin `/api/*` 가 preview 에서도 유지되는지 확인하는 샘플 경로다

### 8-5. preview manifest / API handoff 기준

preview URL 이 정해져도 아래 값은 고정 문자열 도메인으로 바꾸지 않는다.

- `apps/web/public/manifest.webmanifest` 의 `start_url: "/"`
- `apps/web/app/layout.tsx` 의 `manifest: "/manifest.webmanifest"`
- 앱 내부 링크의 상대 경로 정책
- API 기본 경로의 same-origin `/api/*` 우선 정책

필요 시 `NEXT_PUBLIC_API_BASE_URL` 로 override 할 수는 있지만, preview 전용 절대 도메인을 기본값으로 커밋하지 않는다.

## 9. D1 / R2 / KV 필요 여부 정리

현재 preview 준비 기준에서는 아래처럼 구분한다.

### D1

- 코드베이스 전체 관점에서는 장기적으로 필요할 가능성이 높다.
- 하지만 현재 "preview URL 준비 문서화" 자체를 위해 즉시 생성할 필요는 없다.
- API 활성 wrangler 에도 아직 D1 바인딩을 넣지 않았으므로, 실제 preview 환경에서 API를 Cloudflare 상에 같이 올릴지 여부는 별도 승인 후 결정한다.

### R2

- 현재 Web OpenNext 설정은 incremental cache 를 별도로 켜지 않기 때문에 preview 준비 단계에서 R2 선행 생성이 필수는 아니다.
- 문서/첨부 실제 업로드 기능을 붙이는 순간부터는 별도 승인 후 R2 검토가 필요하다.

### KV

- 현재 활성 앱 설정에서 KV 의 즉시 필수 사용처는 없다.
- 세션 캐시/edge cache 같은 확장이 필요할 수는 있지만, preview 준비 단계 필수 조건은 아니다.

결론:

- 지금 단계의 preview 준비는 "D1/R2/KV 실제 생성 없이도 문서화와 로컬 빌드 검증까지 가능"하다.
- 실제 Cloudflare preview 배포를 하려면 어떤 리소스가 필요한지 다시 한 번 승인 게이트에서 분리 판단해야 한다.

## 10. Phase 6 모바일/PWA handoff 기준

Phase 6 구현자는 아래 기준으로 이어받는 것을 권장합니다.

### URL 기준

- canonical preview origin 은 우선 `workers.dev` 후보를 기준으로 본다.
- 다만 코드/manifest/API 경로는 특정 호스트명을 하드코딩하지 않는다.
- `start_url`, `manifest` 경로, 앱 내부 링크는 상대 경로 유지가 기본이다.

### manifest 기준

현재 manifest 상태:

- `start_url: "/"`
- `display: "standalone"`
- layout metadata 에 `manifest: "/manifest.webmanifest"`

Phase 6 에서 이어갈 기준:

- `start_url`, `scope`, icon 경로는 상대 경로 기준 유지
- preview URL 이 정해져도 manifest 안에 절대 preview 도메인을 박아 넣지 않음
- 아이콘/오프라인 페이지 추가 시에도 preview/production 공통으로 재사용 가능한 상대 경로 정책 유지

### API 기준

- 모바일/PWA 구현은 가능하면 same-origin `/api/*` 기준을 우선 가정한다.
- `NEXT_PUBLIC_API_BASE_URL` 같은 값이 필요하더라도 preview 도메인 고정 문자열보다 "상대 경로 우선, 필요 시 환경변수로 override" 정책을 유지한다.
- 별도 API Worker 를 외부 도메인으로 분리 공개하는 선택은 추가 승인 없이는 기본값으로 잡지 않는다.

### release gate 기준

- 모바일/PWA Phase 는 manifest/icon/offline/service-worker 성격 변경이 실제 외부 동작에 영향을 주므로, preview URL 이 생기기 전에는 로컬/문서 검증과 외부 공개 작업을 분리한다.
- 실제 디바이스 설치 테스트, push, background sync, 외부 알림 연동은 preview URL 승인 뒤 별도 카드로 나누는 것이 맞다.

## 11. 다음 담당자 handoff 요약

다음 담당자는 아래 순서로 보면 됩니다.

1. `docs/architecture/cloudflare-preview-url-preparation.md` 를 먼저 읽는다.
2. 현재 기본 preview 후보를 `workers.dev` 로 이해한다.
3. `pages.dev` 는 기본 경로가 아니라 별도 승인/설정 변경 후보로 이해한다.
4. 실제 Cloudflare 로그인/배포/URL 생성은 아직 하면 안 된다는 점을 유지한다.
5. Phase 6 모바일/PWA 는 상대 경로 manifest 와 same-origin `/api` 가정을 유지한 채 이어간다.

## 12. 같이 봐야 할 문서

- `README.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
