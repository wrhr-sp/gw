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
- `ZITADEL_USER_PROVISIONER_TOKEN`: Preview organization 사람 사용자 수명주기 전용 별도 service account PAT. 운영 승인 prerequisite는 `ORG_USER_MANAGER`만 부여하고 `IAM_*`·`ORG_OWNER`를 부여하지 않는 것임
- `ZITADEL_PREVIEW_SUBJECT`
- `ZITADEL_PREVIEW_SUBJECT_SHA256`: 승인된 최초 관리자 subject fingerprint

Preview environment variables:

- `ZITADEL_ISSUER`
- `ZITADEL_CLIENT_ID`
- `ZITADEL_CONSOLE_CLIENT_ID`: ZITADEL 기본 Console client의 고정 ID. 호텔 Web client ID와 재사용 금지
- `ZITADEL_REDIRECT_URI`
- `ZITADEL_ORGANIZATION_ID`
- `PREVIEW_BOOTSTRAP_APPROVAL_REF`: 최초 관리자 승인의 안정적인 티켓·결정 ID. `github.run_id`처럼 배포마다 바뀌는 값 금지

secret 값은 로그, 문서, artifact 또는 repository에 저장하지 않는다. 승인 참조는 비밀값이 아니지만 protected `preview` environment에서만 변경하고, 최초 bootstrap 이후 identity·organization·fingerprint와 함께 불변성을 검사한다. release preflight는 누락된 required configuration 이름을 모두 모아 한 번에 출력한 뒤 첫 mutation 전에 중단하며 값은 출력하지 않는다.

최초 Preview 관리자 subject는 release 전에 ZITADEL에서 Active Human, 정확한 Preview organization, Ready MFA factor를 모두 충족해야 한다. MFA factor 등록은 bootstrap identity 보호 gate이며 현재 호텔 custom credential 화면의 입력은 짧은 ID·비밀번호까지다. ZITADEL 조직 정책이 로그인 MFA를 강제하면 호텔 custom login은 우회하지 않고 `AUTH_MFA_REQUIRED`로 중단한다.

Preview protected environment에는 최초 관리자의 현재 비밀번호를 `ZITADEL_PREVIEW_PASSWORD` secret으로 저장한다. 값은 repository·문서·로그·artifact에 남기지 않고 release preflight와 `Verify hosted Preview Console credential and callback before contract` 단계에만 step-local로 주입한다. 기존 Console pre-auth smoke는 비밀번호 없이 form·binding만 검증하며, 전용 credential 단계는 `/ui/console`에서 생성된 실제 Auth Request에 `previewadmin`과 secret을 제출해 same-origin provider-owned `/ui/console/auth/callback`의 exact path·2xx/3xx·`error` 부재, 오류가 아닌 Console route, authenticated `GetMyUser` 200 read-back과 Console OIDC token의 issuer·audience·subject·expiry 일치, terminal 호텔 browser-binding 삭제까지 함께 확인해야 한다. callback response URL의 `code`·`state` query 보존 자체는 성공조건으로 삼지 않고, callback path와 이후 authenticated read-back·token identity를 결합해 완료를 증명한다. 이 단계가 실패하면 CONTRACT를 실행하지 않는다. credential 실패는 `ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_FAILED_<STAGE>`만 출력하며 stage는 `SUBMIT`, `CALLBACK_RESPONSE`, `AUTHENTICATED_USER_RESPONSE`, `TERMINAL_LANDING`, `TOKEN_IDENTITY`, `COOKIE_CLEANUP`, `BROWSER_CLOSE`, `UNCLASSIFIED`로 제한한다. URL·callback query·credential·token·subject·cookie·provider body는 출력하지 않는다.

Preview ZITADEL 애플리케이션은 기존 Authorization Code + PKCE 설정을 유지하고 앱별 custom Login V2 base URL을 Preview Web의 `/api/auth/custom-login/start`로 설정한다. 호텔 Web tuple은 `ZITADEL_CLIENT_ID`·`ZITADEL_REDIRECT_URI`·`openid profile`, Console tuple은 `ZITADEL_CONSOLE_CLIENT_ID`·`${ZITADEL_ISSUER}/ui/console/auth/callback`·`email openid profile`로 고정하며 두 tuple의 요소를 섞지 않는다. 이 endpoint가 auth request를 기존 browser-bound OIDC transaction과 결합하고 single-use CSRF를 발급한 뒤 `/login`으로 이동시킨다. custom login 시작 단계에서 만료·존재하지 않는 auth request의 provider `400`·`404`·`410`은 `AUTH_FLOW_INVALID`로 종료하며 기존 URL을 재사용하지 않고 Console 또는 호텔 로그인 시작점에서 새 요청을 만든다. 이를 `AUTH_PROVIDER_UNAVAILABLE`로 표시하지 않는다. 인스턴스 전체 전환은 하지 않는다. 문제가 생기면 앱별 custom login 설정만 해제해 기존 hosted login으로 rollback한다.

credential POST 도중 Auth Request가 만료되면 API는 exact browser binding hash와 Auth Request hash가 일치하는 PostgreSQL login transaction 삭제를 시도하고 `__Host-hotel_oauth_browser` cookie를 만료시킨 뒤 `/login?error=invalid-flow`로 보낸다. 정상 DB에서는 exact row가 삭제된다. 삭제 DB 오류나 응답 유실로 row가 남더라도 credential attempt가 기록된 transaction은 다음 CSRF 발급 전에 provider Auth Request를 다시 검증한다. 이 terminal 경로에는 기존 Auth Request를 query로 다시 싣지 않는다.

두 ZITADEL PAT는 서로 다른 service user와 최소역할을 사용해야 한다. 둘 다 비공개 API Worker에만 주입하며 브라우저·Web Worker·빌드 artifact에 전달하지 않는다. 일반 관리자 또는 Instance Owner PAT를 대체 사용하지 않는다. 현재 workflow는 secret 이름의 존재와 API 사용 가능성만 검증하며 두 token의 subject·상호 동일성·effective role·금지 role 부재까지 증명하지 않는다. 따라서 Preview 운영자는 발급 시 별도 service account 여부와 실제 role을 ZITADEL에서 read-back해 승인 근거에 남겨야 한다.

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
4. `EXPAND`에서는 additive·기존 Worker 호환 migration을 적용한다. 로그인 ID는 `0009`에서 전역 unique와 immutable `login_id_registry`를 추가하되 strict 사용자 FK는 아직 적용하지 않는다.
5. 기존 Worker의 공개·인증 compatibility smoke가 성공한 뒤 신규 Worker를 배포한다.
   - API·reconciler·Web Worker가 모두 존재하면 EXPAND 직후 먼저 smoke를 실행한다.
   - 세 Worker가 모두 없으면 최초 배포로 진행한다.
   - 기존 API·Web은 있고 account reconciler만 없으면 초기 account 전환 topology로 인정한다. 이 경우 typed API DB dependency failure와 명시 승인 아래 기존 API Hyperdrive를 exact-ID retarget하고 reconciler Hyperdrive는 새 canonical config로 생성·read-back한 뒤 reconciler Worker를 처음 배포한다.
   - API 또는 Web이 누락된 그 밖의 부분 topology는 복구 상태로 판단해 `EXPAND` 전에 fail-closed한다.
   - Preview DB branch를 교체해 기존 API Hyperdrive가 아직 canonical Preview target과 다른 일회성 전환에만 `preview_hyperdrive_retarget=true`를 명시할 수 있다. 기본값은 `false`다.
   - 이 입력은 기존 Worker의 liveness가 정상이고 readiness가 정확히 `500 INTERNAL_ERROR`인 typed DB dependency failure와 Cloudflare API에서 확인한 API Hyperdrive origin의 host·port·database·user 불일치가 동시에 있어야만 mutation을 허용한다. transport·parser·429·다른 상태/code 및 broad smoke 실패는 retarget으로 분류하지 않는다. 실제 origin 값은 로그에 출력하지 않는다.
   - 기존 Worker의 Hyperdrive 정본 identity는 config 이름이 아니라 Cloudflare Worker settings의 binding에 연결된 32자 exact ID다. API Worker는 현재 이름 `API_HYPERDRIVE`와 최초 Preview 배포의 역사적 이름 `HYPERDRIVE` 중 전체 합계 정확히 1개만 허용하고, reconciler는 `RECONCILER_HYPERDRIVE` 정확히 1개만 허용한다. 허용 이름이 둘 다 존재하거나 중복·malformed이면 mutation 전에 fail-closed한다. 기존 config를 추정 이름으로 찾거나 같은 이름의 다른 config로 대체하지 않는다.
   - 기존 API가 `werehere-hotel-preview`라는 legacy 이름의 config를 직접 binding 중이면 그 exact ID를 canonical API target으로 승격하고 identity가 유지됐는지 read-back한다. 기존 API binding과 무관한 legacy config는 byte-equivalent snapshot으로 보존한다.
   - 기존 config가 canonical target과 `MATCH`이면 일반 release에서 mutation하지 않고 그대로 재사용한다. `MISMATCH`는 위 승인 상태에서만 허용하며, mutation 직전 동일 ID·origin snapshot을 다시 확인한다.
   - API와 reconciler Hyperdrive 모두 mutation 직후 canonical origin `MATCH`를 authoritative read-back해야 한다. 최초 배포 create는 pinned Wrangler 성공 출력에서 32자 exact ID를 캡처하고 같은 ID로 read-back한다. create 시도와 absent-before 상태도 recovery marker로 보존하며, 생성한 canonical config는 durable Preview 기반으로 유지한다.
   - 일반 경로에서는 Hyperdrive 정렬 직후 기존 Web/API 및 Console smoke를 다시 통과해야 하며, 통과 전에는 reconciler·API·Web Worker를 배포하지 않는다.
   - 단, 최초 Preview API가 역사적 binding/config를 사용하고 durable retarget 뒤 최신 EXPAND schema에 대해 정확히 `503 SCHEMA_NOT_READY`를 반환하는 경우에만 예외 recovery를 허용한다. 명시 승인, `API_WEB_LEGACY` Worker topology, API Hyperdrive canonical `MATCH`가 모두 확인되어야 하며 `MISMATCH`, complete/그 밖의 topology, 다른 HTTP/code는 거부한다. 이 경우에만 기존 legacy Worker post-retarget smoke를 defer하고 새 reconciler/API/Web을 배포한다. CONTRACT 전에 새 Worker의 public API·account·canonical login·Console acceptance를 모두 통과하지 못하면 중단한다.
   - account journey 실패 로그는 고정 allowlist의 비밀 비노출 stage code만 `PREVIEW_ACCOUNT_JOURNEY_FAILED_<STAGE>` 형식으로 출력한다. provider/API 응답 body, field error, email·login ID·subject·session·credential 및 임의 오류문은 출력하지 않으며 allowlist 밖 code는 `UNCLASSIFIED`로 축약한다. create 성공 응답에서는 legacy scalar `hotelId`가 요청한 `hotelIds` 중 하나인지 확인하고 canonical `hotels[]`는 요청 set 전체와 exact 일치시킨다. 초기 비밀번호 변경 후 account API에서는 공개 계약인 `status=ACTIVE`를 확인하고, 비공개 `must_change_password=false`는 reconciler DB read-back으로 별도 확인한다. 실제 custom login 경로가 ZITADEL Session API 생성·검증 후 OIDC auth request에 결속하고 hosted callback code exchange까지 검증하므로 smoke에서 별도 direct provider session을 중복 생성하지 않는다. 실패 session은 즉시 종료하고, 성공 session은 code exchange에 필요하므로 최대 300초 lifetime으로 제한한다. create 성공 응답 검증은 durable attempt 발견(`ACCOUNT_CREATE_ATTEMPT_READBACK`), response/attempt ID 결속(`ACCOUNT_CREATE_IDENTITY_MATCH`), 고정 response field/schema(`ACCOUNT_CREATE_RESPONSE_SCHEMA`)를 별도 marker로 분리한다. account create exact endpoint의 실패에 한해서만 검토된 API `error.code` allowlist를 `ACCOUNT_CREATE_<CODE>`로 결합하고, 다른 endpoint·method·unknown code에는 적용하지 않는다. `ACCOUNT_CREATE_INTERNAL_ERROR`에서는 cleanup이 삭제하기 전에 읽은 durable attempt status가 고정 saga allowlist에 있을 때만 `_SAGA_<STATUS>`를 추가한다.
   - account completion의 eligible-hotel row lock과 account deactivation의 provider-identity row lock에는 PostgreSQL locking-clause 권한 요건을 충족하는 최소 column ACL만 사용한다. API runtime에는 `auth_identities.updated_at`, `branches.updated_at`, `hotel_profiles.updated_at` UPDATE만 허용하고 세 테이블의 업무 column 또는 전체 UPDATE는 금지한다. 초기 EXPAND는 이전 Worker 호환성을 위해 branch/profile 2-column exact ACL을 유지하고, 새 API 배포 후 `EXPAND_IDENTITY_LOCK` 단계에서 identity ACL을 추가한 뒤 새 API·Console smoke를 통과해야 한다. EXPAND readiness는 이 전환의 exact 2-column 또는 exact 3-column 상태만 허용하며 CONTRACT readiness는 exact 3-column만 허용한다. 그 밖의 table/column ACL은 거부한다.
   - 기존 Worker compatibility의 모든 Console pre-auth smoke에는 bootstrap subject를 각 실행 step에만 secret으로 주입한다. job-level 장기 노출이나 로그 출력은 금지하고, 누락 시 provider/Worker mutation 또는 다음 배포 단계 전에 fail-closed한다.
   - Hyperdrive API는 조건부 update/ETag를 제공하지 않으므로 자동 origin rollback으로 다른 관리자 변경을 덮지 않는다. 실패 시 update snapshot 또는 create-attempt/created-ID marker를 기준으로 현재 origin을 다시 읽어 `ABSENT`, `ORIGINAL`, `CANONICAL`, split 또는 indeterminate로 분류하고 안정적인 operator-recovery marker와 함께 중단한다. canonical alignment는 명시적으로 durable하며, split/indeterminate 상태에서는 topology를 확인·복구하기 전 재-dispatch하지 않는다.
   - Worker 배포 또는 CONTRACT가 시작된 뒤에도 자동 topology rollback을 금지하고 operator recovery로 중단한다.
6. 신규 Worker의 public smoke가 성공한 뒤에만 `CONTRACT`에서 `0008`의 legacy tenant authority·broad ACL 제거와 `0010`의 canonical 형식·예약 ID·registry FK를 적용한다.
7. 승인된 subject fingerprint·organization·고정 approval 참조를 확인하고 Preview 관리자와 회사 범위 `HOTEL_MANAGE`, `USER_READ`, `USER_CREATE`, `USER_SUSPEND`를 canonical row 전체 값으로 멱등 연결한다.
8. bootstrap audit의 tenant·actor·resource·fingerprint·approval·trace 전체 값이 정본과 다르면 성공으로 처리하지 않는다.
9. `werehere_preview_api_runtime`과 `werehere_preview_reconciler`를 서로 다른 password의 `NOINHERIT NOBYPASSRLS` non-owner role로 구성한다.
10. API role에서 tenant discovery 함수 실행권한을 회수하고 reconciler role에만 부여한다. `reconciliation_company_registry` 직접 권한은 두 role 모두 거부한다. `login_id_registry`는 API role에 `SELECT, INSERT`만 허용하고 UPDATE·DELETE는 금지하며 reconciler에는 직접 권한을 주지 않는다.
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
  - `API_HYPERDRIVE` binding만 사용
- Reconciler Worker: `werehere-hotel-account-reconciler-preview`
  - HTTP API를 제공하지 않음
  - `RECONCILER_HYPERDRIVE` binding만 사용
- Web Worker: `werehere-hotel-web-preview`
  - `workers_dev: true`
  - `preview_urls: false`
  - `API_SERVICE` binding
- API Hyperdrive: `werehere-hotel-api-preview`
  - origin은 API runtime role URL만 사용
  - legacy `werehere-hotel-preview`는 migration 전환 안전성 확인용 snapshot 대상이며 신규 API binding 정본이 아님
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

신규 Worker 배포 뒤 `CONTRACT` 전에는 `scripts/smoke-account-preview.mjs`가 다음 hosted 계정관리 여정을 먼저 실행한다. 이 여정이 성공한 뒤 Console credential gate가 실제 callback과 authenticated `GetMyUser` 200 read-back을 확인하며, 두 gate가 모두 통과해야 `CONTRACT`를 실행한다. `CONTRACT` 뒤에는 public smoke를 다시 실행한다.

```text
승인된 Preview bootstrap subject로 DB-backed 관리자 session 생성
-> USER_CREATE-scoped eligible hotel 조회
-> 실제 API로 하우스키핑 계정과 서로 다른 호텔 2개 배정 생성
-> PostgreSQL detail에서 이름·로그인·이메일·사용자유형·canonical 호텔 목록 재조회
-> housekeeping assignment row에서 시작일·사유·호텔 2개를 직접 재조회
-> 새 사용자 DB session에서 최초 비밀번호 변경
-> ZITADEL credential session 생성·주체·organization 재조회
-> 관리자 API로 사용자 비활성화
-> PostgreSQL INACTIVE, ZITADEL INACTIVE, 활성 DB session 0 재조회
```

검증용 비밀번호와 session/provider token은 메모리에서만 사용하며 로그·artifact·DB·audit에 남기지 않는다. create 응답이 유실되거나 잘못된 ID를 반환해도 `(company, actor, idempotency key)`로 durable provisioning attempt를 반복 조회하고, completion login·email과 deterministic target/provider subject를 exact 검증한다. canonical user row가 있으면 최신 version으로 비활성화하고 활성 DB session 0과 기존 token 401을 재확인한다. user row가 아직 없어도 deterministic provider subject를 bounded grace 동안 반복 조회하며, 늦게 나타난 provider user는 identity boundary를 확인한 뒤 직접 비활성화한다. 404는 grace의 마지막 조회에서만 absence로 인정하고, 이후 durable attempt를 다시 읽어 `COMPENSATED`가 아닌 미완성 상태가 남으면 operator recovery가 필요한 cleanup 실패로 처리한다. credential 검증용 provider session은 60초 lifetime으로 제한하며, cleanup과 connection close가 모두 성공한 뒤에만 `PREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK`를 출력한다. cleanup 실패는 `PREVIEW_ACCOUNT_CLEANUP_FAILED`로 release를 실패시키며 숨기거나 가짜 성공으로 기록하지 않는다. Preview 계정·감사기록은 검증 이력으로 남을 수 있으며 Production 사용자나 Production credential을 사용하지 않는다.

## Cleanup 실패 operator recovery

`PREVIEW_ACCOUNT_CLEANUP_FAILED [ref=<REF>]`가 발생하면 같은 release를 재실행하지 않는다. `<REF>`는 credential이 아닌 smoke 식별자이며 create idempotency key는 `preview-account-create-<REF>`다. 비밀번호·token·DB URL은 명령행이나 문서에 직접 쓰지 않고 승인된 환경변수로만 전달한다.

### 1. Durable attempt read-only discovery

승인된 reconciler 연결과 Preview company/actor ID를 환경변수로 준비하고 다음 query를 transaction 안에서 실행한다. 출력에는 비밀번호 payload가 포함되지 않는다.

```bash
export IDEMPOTENCY_KEY="preview-account-create-${REF}"
psql "$RECONCILER_DATABASE_URL" \
  --set=company_id="$PREVIEW_COMPANY_ID" \
  --set=actor_user_id="$PREVIEW_ACTOR_USER_ID" \
  --set=idempotency_key="$IDEMPOTENCY_KEY" <<'SQL'
begin read only;
select set_config('app.reconciler_company_id', :'company_id', true);
select attempt.target_user_id,
       attempt.status,
       attempt.provider_subject,
       attempt.completion_payload->>'loginName' as login_name,
       attempt.completion_payload->>'email' as email,
       target.status as user_status,
       target.version as user_version
from public.account_provisioning_attempts attempt
left join public.users target
  on target.company_id = attempt.company_id
 and target.id = attempt.target_user_id
where attempt.company_id = :'company_id'::uuid
  and attempt.actor_user_id = :'actor_user_id'::uuid
  and attempt.idempotency_key = :'idempotency_key';
rollback;
SQL
```

- 0행이면 create 요청의 side effect 부재를 추정하지 않는다. provider verification session의 60초 lifetime과 clock skew를 포함해 최소 90초를 기다리고 provider audit에서 해당 login의 새 user/session이 없음을 확인한 뒤에도 0행일 때만 별도 승인으로 재실행한다.
- 2행 이상이면 idempotency 경계가 손상된 상태이므로 수동 mutation을 금지하고 release를 중단한다.
- 1행이면 `target_user_id`, completion login/email, `provider_subject`가 모두 동일한 smoke 대상인지 먼저 확인한다. 이 값이 다르면 provider나 DB를 변경하지 않는다.

### 2. Attempt 상태별 조치

| 상태                                                                               | 조치                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RESERVED_NOT_DISPATCHED`, `DISPATCHED`, `PROVIDER_CONFIRMED`, `RECOVERY_REQUIRED` | reconciler lease가 끝날 때까지 bounded polling한다. provider user가 나타나면 organization·subject·login/email을 exact 확인한 뒤 비활성화한다. terminal 상태가 되지 않으면 operator failure를 유지한다. |
| `COMPENSATION_REQUIRED`                                                            | 승인된 reconciler recovery를 실행하고 `COMPENSATED`까지 확인한다. provider 404는 즉시 성공으로 보지 않고 bounded grace 마지막 조회에서만 absence로 인정한다.                                           |
| `COMPENSATED`                                                                      | provider가 `INACTIVE` 또는 bounded terminal 404이고 canonical user가 없거나 `INACTIVE`인지 재확인한다.                                                                                                 |
| `COMPLETED`                                                                        | canonical user의 최신 `version`을 다시 읽어 관리자 API로 비활성화한다. stale version을 재사용하지 않는다.                                                                                              |
| `OPERATOR_REQUIRED`, `DEAD_LETTER`                                                 | 자동 재실행·이전 Worker rollback을 금지한다. 아래 DB/provider/session 증거를 수집한 뒤 별도 운영 승인으로 복구한다.                                                                                    |

### 3. Provider와 DB 정리

1. ZITADEL user 조회 결과의 organization ID, subject, login, email이 durable attempt와 모두 일치하는지 확인한다.
2. 일치할 때만 provider deactivate를 호출한다. 응답 성공만 믿지 않고 `INACTIVE`까지 bounded polling한다.
3. canonical user가 있으면 관리자 API에서 최신 version을 읽고 새 cleanup idempotency key `preview-account-cleanup-<REF>`로 deactivate한다.
4. PostgreSQL에서 user가 `INACTIVE`인지 다시 읽는다. DB 직접 `UPDATE`는 사용하지 않는다.
5. provider session POST response-loss가 기록됐다면 최소 90초를 기다리고 provider audit/session 조회에서 smoke principal의 활성 verification session이 없음을 확인한다.

### 4. 최종 증거와 재실행 조건

다음을 모두 충족해야 같은 Preview release를 새 run으로 다시 실행할 수 있다.

- durable attempt가 `COMPLETED` 후 user `INACTIVE`, 또는 `COMPENSATED`
- provider user가 expected organization/subject이며 `INACTIVE`, 또는 bounded grace 뒤 terminal 404
- 해당 Preview user의 활성 PostgreSQL session 수가 정확히 0
- 알려진 pending hotel session token이 있으면 `/api/auth/session`이 401
- provider verification session이 GET 401/404이거나 response-loss 이후 90초 경과와 provider audit상 활성 session 0
- Production DB·Production credential을 사용하지 않았다는 확인

증거가 하나라도 없으면 `PREVIEW_ACCOUNT_CLEANUP_FAILED`를 해제하지 않고 새 deploy·CONTRACT·rollback을 진행하지 않는다.

## Rollback

1. smoke 실패 시 Preview 성공으로 보고하지 않는다.
2. workflow는 DB 변경 전에 API/Web 활성 version을 기록한다.
3. `EXPAND`와 기존 Worker compatibility smoke 전후에는 legacy compatibility가 유지된다.
4. 신규 Worker deploy 또는 pre-contract smoke 실패라도 workflow는 동시 배포를 덮어쓸 수 있는 이전 Worker 자동 복구나 최초 Worker 자동 삭제를 수행하지 않는다. 기록된 version을 근거로 operator recovery를 요구한다.
5. `CONTRACT` 시작 후에는 legacy authority가 제거됐으므로 이전 Worker로 rollback하지 않는다. `CONTRACT_STARTED=true`로 operator recovery를 요구하고 안전 실패한다.
6. 최초 배포의 pre-contract 실패도 자동 삭제하지 않는다. 활성 version과 생성된 Worker를 operator가 read-back한 뒤 명시적으로 복구한다.
7. Hyperdrive runtime password 회전은 일반 배포와 분리해 별도 승인·전환 절차로 수행한다.
8. DB 변경 복원이 필요하면 임의 down SQL 대신 승인된 Neon Preview branch/snapshot 복원 또는 Preview DB 재생성을 사용한다.
9. Production, DNS, custom domain은 변경하지 않는다.
10. contract 적용 후 API runtime은 `auth_sessions` 직접 `INSERT`·`UPDATE`를 할 수 없다. session 생성과 회수는 tenant-bound SECURITY DEFINER 함수만 사용한다.
11. integration은 직접 mutation의 `42501`, 함수 성공, session·audit read-back, 임시 definer membership과 schema `CREATE` 권한의 종료 후 0건을 함께 검증한다.
12. legacy tenant GUC나 broad ACL을 전제로 하는 contract 이전 Worker는 contract 이후 rollback 대상으로 사용하지 않는다.
