# Cloudflare Preview 배포

## 목적

호텔관리 Preview는 Production과 인프라를 공유하지 않는다. 코드 정본만 동일하며 Web Worker, API Worker, PostgreSQL target, runtime role, Hyperdrive, OIDC 설정과 secret은 Preview 전용이다.

## 요청 경로

```text
Browser
  -> werehere-hotel-web-preview (OpenNext Worker, public workers.dev)
  -> API_SERVICE Service Binding
  -> werehere-hotel-api-preview (private Worker, workers.dev disabled)
  -> API_HYPERDRIVE
  -> Neon Preview PostgreSQL API runtime role

Scheduled reconciler
  -> RECONCILER_HYPERDRIVE
  -> Neon Preview PostgreSQL reconciler role
```

Web Worker에는 DB URL이나 Hyperdrive를 바인딩하지 않는다. API Worker에는 migration owner URL을 등록하지 않는다. HTTP 요청은 `API_HYPERDRIVE`/`API_RUNTIME_DATABASE_URL`만, scheduled handler는 `RECONCILER_HYPERDRIVE`/`RECONCILER_DATABASE_URL`만 사용하며 서로 fallback하지 않는다.

## GitHub Preview environment

Environment 이름은 `preview`이고 허용 branch는 `main`이다. 배포는 `.github/workflows/preview-release.yml`의 `workflow_dispatch`로만 시작한다.

Repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `DATABASE_URL`: Production target과 동일 DB인지 비교할 때만 사용
- `DATABASE_URL_PREVIEW`: Neon Preview migration owner URL

Preview environment secrets:

- `DATABASE_API_RUNTIME_PASSWORD_PREVIEW`
- `DATABASE_RECONCILER_PASSWORD_PREVIEW`: API password와 반드시 다른 값
- `AUTH_TRANSACTION_ENCRYPTION_KEY`
- `ZITADEL_SERVICE_USER_TOKEN`: `IAM_LOGIN_CLIENT` 전용 Preview service user PAT
- `ZITADEL_USER_PROVISIONER_TOKEN`: Preview organization 사람 사용자 수명주기 전용 최소권한 PAT
- `ZITADEL_PREVIEW_SUBJECT`
- `ZITADEL_PREVIEW_SUBJECT_SHA256`: 승인된 최초 관리자 subject fingerprint

Preview environment variables:

- `ZITADEL_ISSUER`
- `ZITADEL_CLIENT_ID`
- `ZITADEL_REDIRECT_URI`
- `ZITADEL_ORGANIZATION_ID`
- `PREVIEW_BOOTSTRAP_APPROVAL_REF`: 최초 관리자 승인의 안정적인 티켓·결정 ID. `github.run_id`처럼 배포마다 바뀌는 값 금지

secret 값은 로그, 문서, artifact 또는 repository에 저장하지 않는다. 승인 참조는 비밀값이 아니지만 protected `preview` environment에서만 변경하고, 최초 bootstrap 이후 identity·organization·fingerprint와 함께 불변성을 검사한다.

Preview ZITADEL 애플리케이션은 기존 Authorization Code + PKCE 설정을 유지하고 앱별 custom Login V2 base URL을 Preview Web의 `/api/auth/custom-login/start`로 설정한다. 이 endpoint가 auth request를 기존 browser-bound OIDC transaction과 결합하고 single-use CSRF를 발급한 뒤 `/login`으로 이동시킨다. 인스턴스 전체 전환은 하지 않는다. 문제가 생기면 앱별 custom login 설정만 해제해 기존 hosted login으로 rollback한다.

두 ZITADEL PAT는 서로 다른 service user와 최소역할을 사용한다. 둘 다 비공개 API Worker에만 주입하며 브라우저·Web Worker·빌드 artifact에 전달하지 않는다. 일반 관리자 또는 Instance Owner PAT를 대체 사용하지 않는다.

비밀번호 재설정 메일은 ZITADEL 기본 링크를 사용하지 않고 다음 Preview custom URL template으로 발송한다.

```text
https://werehere-hotel-web-preview.wereheresp.workers.dev/password/set#userID={{.UserID}}&code={{.Code}}&orgID={{.OrgID}}
```

URL fragment는 브라우저가 Worker로 전송하지 않으므로 Cloudflare request URL과 observability metadata에 사용자 ID·일회성 code가 들어가지 않는다. Web client는 기존 reset cookie가 있어도 새 fragment를 먼저 검사하고, 확인 전에는 입력폼을 표시하지 않는다. fragment 처리 시작 전에 비민감 10분 pending marker를 설정하고, 성공한 교환에서만 제거하므로 malformed fragment·API 503·browser network failure 뒤에는 stale reset cookie가 있어도 폼을 다시 활성화하지 않는다. Web proxy도 exchange upstream 실패 응답에서 reset cookie를 즉시 만료한다. fragment를 즉시 `history.replaceState`로 제거한 뒤 same-origin POST body로 `/api/auth/password/exchange`에 한 번만 전달한다. API는 이를 10분 만료 AES-GCM opaque token으로 교환해 `HttpOnly; Secure; SameSite=Strict` host cookie에만 저장한다. Web DOM, hidden input, query string, 애플리케이션 로그, DB, artifact에는 사용자 ID·code·비밀번호를 남기지 않는다. ZITADEL 400은 공식 ErrorDetail ID allowlist로 code 만료·무효와 비밀번호 정책 위반을 분리하며 unknown 400은 terminal invalid로 안전 실패한다. 비밀번호 변경 성공 시 cookie를 만료하고 성공 query 없이 `/login`으로 직접 이동한다. terminal invalid-link에서도 cookie를 즉시 만료하고 입력폼을 숨긴다. Preview 완료 판정은 새 메일의 실제 링크가 JSON API 오류 없이 설정 화면을 열고, 변경 후 새 비밀번호 로그인이 성공할 때만 한다.

## DB provisioning

`packages/db/scripts/provision-preview.ts`는 `PREVIEW_PROVISION_PHASE=EXPAND|CONTRACT`를 받아 다음을 안전 실패 방식으로 수행한다.

1. Preview URL이 Neon HTTPS/TLS target인지 검사한다.
2. host, port, database fingerprint가 Production과 같으면 중단한다.
3. advisory lock을 획득한다.
4. `EXPAND`에서는 additive·기존 Worker 호환 migration만 적용하고 destructive contract migration `0008`은 제외한다.
5. 기존 Worker의 공개·인증 compatibility smoke가 성공한 뒤 신규 Worker를 배포한다.
   - API·reconciler·Web Worker가 모두 존재하면 smoke를 실행한다.
   - 세 Worker가 모두 없으면 최초 배포로 진행한다.
   - 일부만 존재하면 부분 복구 상태로 판단해 `EXPAND` 전에 fail-closed한다.
6. 신규 Worker의 public smoke가 성공한 뒤에만 `CONTRACT`에서 `0008`을 적용해 legacy tenant authority와 broad ACL을 제거한다.
7. 승인된 subject fingerprint·organization·고정 approval 참조를 확인하고 Preview 관리자와 회사 범위 `HOTEL_MANAGE`, `USER_READ`, `USER_CREATE`, `USER_SUSPEND`를 canonical row 전체 값으로 멱등 연결한다.
8. bootstrap audit의 tenant·actor·resource·fingerprint·approval·trace 전체 값이 정본과 다르면 성공으로 처리하지 않는다.
9. `werehere_preview_api_runtime`과 `werehere_preview_reconciler`를 서로 다른 password의 `NOINHERIT NOBYPASSRLS` non-owner role로 구성한다.
10. API role에서 tenant discovery 함수 실행권한을 회수하고 reconciler role에만 부여한다. registry table 직접 권한은 두 role 모두 거부한다.
11. 각 runtime role의 table·schema·sequence ACL을 capability별 exact allowlist와 비교하고 예상 밖 권한, `PUBLIC`, `WITH GRANT OPTION`을 거부한다.
12. SECURITY DEFINER의 owner·`search_path=pg_catalog`·source fingerprint·direct execute allowlist를 검증하고 grantable execute와 stale named grantee를 거부한다.
13. 두 role을 각각 `API_RUNTIME`, `RECONCILER` semantic readiness로 확인한다.

- `EXPAND`는 신규 API 1개·reconciler 1개와 정확한 `werehere_preview_runtime:API_RUNTIME` 1개만 선택적으로 허용한다.
- `CONTRACT`는 신규 API 1개·reconciler 1개만 허용하고 legacy capability와 legacy `auth_create_session()` 함수가 0건이어야 한다.

14. 두 runtime URL은 권한 `0600` 임시 파일로만 각 Hyperdrive 단계에 전달한다.

DB rollback은 down SQL을 추측해 실행하지 않는다. Preview Neon branch/snapshot 복원 또는 Preview DB 재생성을 사용한다.

## Cloudflare resources

- API Worker: `werehere-hotel-api-preview`
  - `workers_dev: false`
  - `preview_urls: false`
  - `API_HYPERDRIVE`, `RECONCILER_HYPERDRIVE` binding
- Web Worker: `werehere-hotel-web-preview`
  - `workers_dev: true`
  - `preview_urls: false`
  - `API_SERVICE` binding
- API Hyperdrive: `werehere-hotel-preview`
  - origin은 API runtime role URL만 사용
- Reconciler Hyperdrive: `werehere-hotel-reconciler-preview`
  - origin은 reconciler role URL만 사용
  - API와 reconciler Hyperdrive ID는 달라야 함
  - 두 Hyperdrive 모두 SQL cache는 초기에는 비활성화

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

`CONTRACT`와 post-contract public smoke 뒤에는 `scripts/smoke-account-preview.mjs`가 다음 hosted 계정관리 여정을 필수 gate로 실행한다.

```text
승인된 Preview bootstrap subject로 DB-backed 관리자 session 생성
-> USER_CREATE-scoped eligible hotel 조회
-> 실제 API로 하우스키핑 계정과 서로 다른 호텔 2개 배정 생성
-> PostgreSQL detail에서 이름·로그인·이메일·사용자유형·canonical 호텔 목록 재조회
-> 새 사용자 DB session에서 최초 비밀번호 변경
-> ZITADEL credential session 생성·주체·organization 재조회
-> 관리자 API로 사용자 비활성화
-> PostgreSQL INACTIVE, ZITADEL INACTIVE, 활성 DB session 0 재조회
```

검증용 비밀번호와 session/provider token은 메모리에서만 사용하며 로그·artifact·DB·audit에 남기지 않는다. 실패 중 생성된 계정은 reconciler DB에서 최신 version을 재조회해 비활성화하고 PostgreSQL·ZITADEL의 `INACTIVE` 상태를 다시 확인한다. cleanup 실패는 `PREVIEW_ACCOUNT_CLEANUP_FAILED`로 release를 실패시키며 숨기거나 가짜 성공으로 기록하지 않는다. Preview 계정·감사기록은 검증 이력으로 남을 수 있으며 Production 사용자나 Production credential을 사용하지 않는다.

## Rollback

1. smoke 실패 시 Preview 성공으로 보고하지 않는다.
2. workflow는 DB 변경 전에 API/Web 활성 version을 기록한다.
3. `EXPAND`와 기존 Worker compatibility smoke 전후에는 legacy compatibility가 유지된다.
4. 신규 Worker deploy 또는 pre-contract smoke 실패처럼 `CONTRACT` 시작 전 실패만 이전 Worker version 복구 대상으로 판단할 수 있다.
5. `CONTRACT` 시작 후에는 legacy authority가 제거됐으므로 이전 Worker로 자동 rollback하지 않는다. `CONTRACT_STARTED=true`로 operator recovery를 요구하고 안전 실패한다.
6. 이전 version이 없는 최초 배포의 pre-contract 실패라면 이번 실행에서 만든 Preview Worker를 삭제할 수 있다.
7. Hyperdrive runtime password 회전은 일반 배포와 분리해 별도 승인·전환 절차로 수행한다.
8. DB 변경 복원이 필요하면 임의 down SQL 대신 승인된 Neon Preview branch/snapshot 복원 또는 Preview DB 재생성을 사용한다.
9. Production, DNS, custom domain은 변경하지 않는다.
10. contract 적용 후 API runtime은 `auth_sessions` 직접 `INSERT`·`UPDATE`를 할 수 없다. session 생성과 회수는 tenant-bound SECURITY DEFINER 함수만 사용한다.
11. integration은 직접 mutation의 `42501`, 함수 성공, session·audit read-back, 임시 definer membership과 schema `CREATE` 권한의 종료 후 0건을 함께 검증한다.
12. legacy tenant GUC나 broad ACL을 전제로 하는 contract 이전 Worker는 contract 이후 rollback 대상으로 사용하지 않는다.
