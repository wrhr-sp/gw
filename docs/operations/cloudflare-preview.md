# Cloudflare Preview 배포

## 목적

호텔관리 Preview는 Production과 인프라를 공유하지 않는다. 코드 정본만 동일하며 Web Worker, API Worker, PostgreSQL target, runtime role, Hyperdrive, OIDC 설정과 secret은 Preview 전용이다.

## 요청 경로

```text
Browser
  -> werehere-hotel-web-preview (OpenNext Worker, public workers.dev)
  -> API_SERVICE Service Binding
  -> werehere-hotel-api-preview (private Worker, workers.dev disabled)
  -> HYPERDRIVE
  -> Neon Preview PostgreSQL runtime role
```

Web Worker에는 DB URL이나 Hyperdrive를 바인딩하지 않는다. API Worker에는 migration owner URL을 등록하지 않는다. `DATABASE_URL`은 로컬·CI fallback이고 Cloudflare runtime은 `HYPERDRIVE.connectionString`을 우선한다.

## GitHub Preview environment

Environment 이름은 `preview`이고 허용 branch는 `main`이다. 배포는 `.github/workflows/preview-release.yml`의 `workflow_dispatch`로만 시작한다.

Repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `DATABASE_URL`: Production target과 동일 DB인지 비교할 때만 사용
- `DATABASE_URL_PREVIEW`: Neon Preview migration owner URL

Preview environment secrets:

- `DATABASE_RUNTIME_PASSWORD_PREVIEW`
- `AUTH_TRANSACTION_ENCRYPTION_KEY`
- `ZITADEL_PREVIEW_SUBJECT`

Preview environment variables:

- `ZITADEL_ISSUER`
- `ZITADEL_CLIENT_ID`
- `ZITADEL_REDIRECT_URI`

값은 로그, 문서, artifact 또는 repository에 저장하지 않는다.

## DB provisioning

`packages/db/scripts/provision-preview.ts`는 다음을 안전 실패 방식으로 수행한다.

1. Preview URL이 Neon HTTPS/TLS target인지 검사한다.
2. host, port, database fingerprint가 Production과 같으면 중단한다.
3. advisory lock을 획득한다.
4. `schema_migrations`에 없는 migration만 순서대로 적용한다.
5. ZITADEL subject를 Preview 관리자와 회사 범위 `HOTEL_MANAGE`에 멱등 연결한다.
6. `werehere_preview_runtime` role을 `NOINHERIT NOBYPASSRLS` non-owner로 구성한다.
7. 기존 table privilege를 모두 회수하고 필요한 최소 privilege만 부여한다.
8. runtime role로 semantic readiness를 확인한다.
9. runtime URL은 권한 `0600` 임시 파일로만 Hyperdrive 단계에 전달한다.

DB rollback은 down SQL을 추측해 실행하지 않는다. Preview Neon branch/snapshot 복원 또는 Preview DB 재생성을 사용한다.

## Cloudflare resources

- API Worker: `werehere-hotel-api-preview`
  - `workers_dev: false`
  - `preview_urls: false`
  - `HYPERDRIVE` binding
- Web Worker: `werehere-hotel-web-preview`
  - `workers_dev: true`
  - `preview_urls: false`
  - `API_SERVICE` binding
- Hyperdrive: `werehere-hotel-preview`
  - origin은 runtime role URL만 사용
  - SQL cache는 초기에는 비활성화
  - runtime role password는 최초 생성 때만 설정하며 일반 배포에서는 회전하지 않음

Custom domain, DNS, Production Worker와 Production DB는 이 workflow 범위 밖이다.

## 검증

PR과 main CI:

```bash
pnpm run lint
pnpm run check
pnpm run build
pnpm run test:integration
pnpm run test:visual
```

CI는 API generated config와 OpenNext Worker를 Wrangler `--dry-run`으로 검증한다.

배포 workflow의 공개 smoke:

```text
Web 200
-> /api/health/live 200 UP
-> /api/health/ready 200 READY
-> anonymous session 401 AUTHENTICATION_REQUIRED
-> login 302 + browser-binding cookie + no-store
-> invalid callback 400 AUTH_FLOW_INVALID
```

최종 승인 전 수동 smoke에는 실제 ZITADEL 사용자로 로그인한 뒤 호텔 목록, 등록, 상세 PostgreSQL read-back과 권한·tenant 차단 확인이 포함된다.

## Rollback

1. smoke 실패 시 Preview 성공으로 보고하지 않는다.
2. workflow가 배포 전 API/Web 활성 version을 기록한다.
3. Web 배포 또는 공개 smoke 실패 시 이전 Worker version으로 자동 rollback한다.
4. 이전 version이 없는 최초 배포였다면 이번 실행에서 만든 Preview Worker를 삭제한다.
5. Hyperdrive의 runtime password 회전은 일반 배포와 분리해 별도 승인·전환 절차로 수행한다.
6. DB 변경 복원이 필요하면 Neon Preview branch/snapshot을 복원하거나 Preview DB를 재생성한다.
7. Production, DNS, custom domain은 변경하지 않는다.
