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
- `ZITADEL_SERVICE_USER_TOKEN`: `IAM_LOGIN_CLIENT` 전용 Preview service user PAT
- `ZITADEL_PREVIEW_SUBJECT`

Preview environment variables:

- `ZITADEL_ISSUER`
- `ZITADEL_CLIENT_ID`
- `ZITADEL_REDIRECT_URI`

값은 로그, 문서, artifact 또는 repository에 저장하지 않는다.

Preview ZITADEL 애플리케이션은 기존 Authorization Code + PKCE 설정을 유지하고 앱별 custom Login V2 base URL을 Preview Web의 `/api/auth/custom-login/start`로 설정한다. 이 endpoint가 auth request를 기존 browser-bound OIDC transaction과 결합하고 single-use CSRF를 발급한 뒤 `/login`으로 이동시킨다. 인스턴스 전체 전환은 하지 않는다. 문제가 생기면 앱별 custom login 설정만 해제해 기존 hosted login으로 rollback한다.

`ZITADEL_SERVICE_USER_TOKEN`은 비공개 API Worker에만 주입하며 브라우저·Web Worker·빌드 artifact에 전달하지 않는다. 일반 관리자 또는 Instance Owner PAT를 대체 사용하지 않는다.

비밀번호 재설정 메일은 ZITADEL 기본 링크를 사용하지 않고 다음 Preview custom URL template으로 발송한다.

```text
https://werehere-hotel-web-preview.wereheresp.workers.dev/password/set#userID={{.UserID}}&code={{.Code}}&orgID={{.OrgID}}
```

URL fragment는 브라우저가 Worker로 전송하지 않으므로 Cloudflare request URL과 observability metadata에 사용자 ID·일회성 code가 들어가지 않는다. Web client는 기존 reset cookie가 있어도 새 fragment를 먼저 검사하고, 확인 전에는 입력폼을 표시하지 않는다. fragment 처리 시작 전에 비민감 10분 pending marker를 설정하고, 성공한 교환에서만 제거하므로 malformed fragment·API 503·browser network failure 뒤에는 stale reset cookie가 있어도 폼을 다시 활성화하지 않는다. Web proxy도 exchange upstream 실패 응답에서 reset cookie를 즉시 만료한다. fragment를 즉시 `history.replaceState`로 제거한 뒤 same-origin POST body로 `/api/auth/password/exchange`에 한 번만 전달한다. API는 이를 10분 만료 AES-GCM opaque token으로 교환해 `HttpOnly; Secure; SameSite=Strict` host cookie에만 저장한다. Web DOM, hidden input, query string, 애플리케이션 로그, DB, artifact에는 사용자 ID·code·비밀번호를 남기지 않는다. ZITADEL 400은 공식 ErrorDetail ID allowlist로 code 만료·무효와 비밀번호 정책 위반을 분리하며 unknown 400은 terminal invalid로 안전 실패한다. 비밀번호 변경 성공 시 cookie를 만료하고 성공 query 없이 `/login`으로 직접 이동한다. terminal invalid-link에서도 cookie를 즉시 만료하고 입력폼을 숨긴다. Preview 완료 판정은 새 메일의 실제 링크가 JSON API 오류 없이 설정 화면을 열고, 변경 후 새 비밀번호 로그인이 성공할 때만 한다.

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
-> hotel custom credential form 200 + provider 이름 비노출
-> login start 302 + browser-binding cookie + no-store
-> password reset page 200 + query credential 없음
-> fragment exchange POST 204 + encrypted HttpOnly reset cookie + request URL credential 없음
-> invalid reset은 입력폼 없음 + reset cookie 만료
-> password 변경 성공은 cookie 만료 + /login 직접 이동
-> invalid callback 303 /login?error=invalid-flow + no-store + no-referrer + OAuth cookie 만료
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
8. 인증 세션 definer 전환의 expand 배포에서는 구 Worker rollback 호환을 위해 runtime의 `auth_sessions INSERT`를 임시 유지한다.
9. 새 Worker 배포와 실제 로그인 smoke 성공 직후 별도 contract 변경으로 직접 `INSERT`를 회수하고 함수 경로만 재검증한다.
10. contract 적용 뒤에는 직접 INSERT를 사용하는 구 Worker를 rollback 대상으로 사용하지 않는다.
