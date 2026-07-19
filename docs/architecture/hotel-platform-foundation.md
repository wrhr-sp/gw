# 호텔관리 플랫폼 기반 아키텍처

- 상태: approved implementation baseline
- 기준일: 2026-07-16
- 제품선: `feat/hotel-first-platform`
- 근거: 사용자 승인 호텔관리 PRD, 사용자 승인 UI 디자인, 독립 아키텍처·보안·UI 검토

## 1. 결론

호텔관리 플랫폼은 Web, API, 계약, UI, DB를 다음 경계로 분리한다.

```text
Browser
  → Next.js Web
  → same-origin /api/*
  → Hono API
     ├─ PostgreSQL
     ├─ ZITADEL
     └─ private R2
```

- PostgreSQL이 업무 데이터와 권한의 정본이다.
- 브라우저는 DB·R2·ZITADEL 관리 API에 직접 접근하지 않는다.
- DB·schema·R2·ZITADEL이 준비되지 않은 업무는 명시적으로 실패한다.
- mock, in-memory 성공, 클라이언트 claim 기반 권한 fallback을 만들지 않는다.

## 2. 저장소 구조

```text
apps/
  api/                 Hono API와 도메인 수직 슬라이스
  web/                 Next.js App Router
packages/
  contracts/           Zod 요청·응답·상태·오류·route 정본
  ui/                  승인 토큰과 shadcn/Radix primitive·공통 패턴
  db/                  PostgreSQL client·migration·실DB 테스트
tests/
  e2e/                 배포된 Web/API 사용자 흐름
docs/
  architecture/
  design/hotel-ui/
  product/prd/hotel-management/
```

`packages/ui`는 일반적인 조기 공용화가 아니라 사용자가 승인한 단일 디자인 시스템을 구현하기 위한 제한된 예외다. 호텔 업무규칙이나 API 호출은 포함하지 않는다.

## 3. 의존성 경계

```text
web → contracts, ui
api → contracts, db
ui → React/Radix/Tailwind primitive
contracts → zod

web -X→ api 내부 코드, db
contracts -X→ React, Hono, db, 환경변수
ui -X→ 호텔 업무규칙, API, db
```

API 업무기능은 다음 수직 슬라이스를 사용한다.

```text
apps/api/src/modules/<domain>/
  routes.ts
  service.ts
  repository.ts
  policy.ts
```

## 4. 사용자유형 정본

초기 MVP 내부코드는 정확히 다음 세 개다.

```text
INTERNAL_STAFF
ROOM_OPERATIONS
BRANCH_OWNER
```

- `ROOM_OPERATIONS`의 사용자 표시명은 하우스키핑이다.
- `BRANCH_OWNER`의 사용자 표시명은 호텔 소유주다.
- `PARTNER_EMPLOYEE`는 초기 schema·route·menu에 넣지 않는다.

## 5. 호텔 정본

- 호텔 지점 정본은 `branches`다.
- `hotel_profiles`는 `branches`의 1:1 확장이다.
- 독립 `hotels` 정본 테이블을 만들지 않는다.
- API의 `hotelId`는 `branches.id`다.
- 모든 호텔 하위 테이블은 `company_id`, `branch_id`를 함께 저장하고 복합 FK로 경계를 강제한다.

## 6. 인증과 세션

```text
Browser
  → 호텔관리 자체 Login UI
  → ZITADEL Session/Settings/Auth Request API(BFF 전용)
  → ZITADEL Authorization Code + PKCE finalize
  → 서버 callback 검증
  → PostgreSQL opaque session 생성
  → __Host-hotel_session 쿠키
```

- 브라우저는 ZITADEL credential API를 직접 호출하지 않고 호텔관리 same-origin Login BFF만 사용한다.
- Login BFF는 `IAM_LOGIN_CLIENT` 전용 service user token으로 auth request의 client ID·redirect URI를 확인한다.
- ZITADEL custom Login V2 base URL은 `/api/auth/custom-login/start`다. ZITADEL이 자동으로 붙이는 `/login` suffix는 exact alias `/api/auth/custom-login/start/login`에서만 수용한다. 이 endpoint가 auth request를 기존 browser-bound OIDC transaction과 묶고 5분 이내 single-use CSRF를 발급한다.
- auth request provider 검증은 PostgreSQL에서 transaction당 최대 5회 예약한 뒤 실행한다. 검증 완료된 동일 auth request 재진입은 provider를 다시 호출하지 않고 CSRF만 교체한다.
- custom login이 지원하는 Auth Request scope는 기존 앱 계약인 `openid profile`로 제한한다. 별도 `prompt`·`maxAge` 요구 또는 Login Settings의 local-auth·MFA 핵심 필드 누락은 provider 계약 오류로 안전 실패한다.
- 아이디·비밀번호는 ZITADEL Session API check에만 전달하며 DB·로그·cookie·artifact에 저장하지 않는다.
- credential POST는 CSRF를 PostgreSQL에서 원자 소비하고 시도 횟수를 예약한 뒤에만 ZITADEL을 호출한다. 같은 CSRF의 병렬·재사용 요청은 provider 호출 전에 거부한다.
- ZITADEL CreateSession의 user+password check를 한 요청에서 수행해 존재/비존재 계정의 provider 왕복 수 차이를 줄인다.
- password factor가 확인돼도 MFA 강제 정책이면 callback을 finalize하지 않는다.
- 최종 인증은 반드시 ZITADEL이 발급한 authorization code를 기존 PKCE callback에서 검증한 뒤 완료한다. Session token을 호텔 session으로 직접 교환하지 않는다.

쿠키 기준:

```text
Secure
HttpOnly
SameSite=Lax
Path=/
Domain 미지정
```

- 쿠키에는 256-bit 이상 난수만 둔다.
- DB에는 `SHA-256(session_token)`만 저장한다.
- JWT, Base64 claim, 역할·회사·호텔목록을 브라우저 세션으로 저장하지 않는다.
- access/refresh token을 localStorage·sessionStorage에 저장하지 않는다.
- 역할·권한·호텔범위는 세션에 복제하지 않고 매 요청 PostgreSQL에서 계산한다.
- 로그아웃, 계정 비활성화, 배정종료, 소유주 교체 시 세션을 revoke한다.

로그인 시도는 `auth_login_transactions`에 10분 동안만 둔다.

- `state`, OIDC `nonce`, 임시 브라우저 바인딩은 각각 독립 난수이며 DB에는 SHA-256 hash만 저장한다.
- `__Host-hotel_oauth_browser` 임시 쿠키와 DB의 browser-binding hash가 모두 일치해야 callback을 처리한다.
- PKCE verifier는 `AUTH_TRANSACTION_ENCRYPTION_KEY`의 AES-256-GCM 암호문·12-byte IV·key version으로만 저장한다.
- ZITADEL discovery와 authorization endpoint 확인이 성공한 뒤에만 로그인 transaction을 생성한다.
- 만료시각은 PostgreSQL `now()` 기준 10분으로 계산하고, 새 transaction 생성 시 만료 row를 최대 256개씩 정리한다.
- PostgreSQL advisory transaction lock 아래 최근 1분 1,000건·활성 10,000건 하드캡을 적용하고 초과 시 `429 AUTH_RATE_LIMITED`로 거부한다. Preview에서는 여기에 edge 사용자별 rate limit을 추가한다.
- custom credential 시도는 auth request당 최대 5회, HMAC 처리한 account identifier당 15분 10회, canonical IP당 15분 30회로 제한한다. HTTP transport는 loginName의 앞뒤 공백만 제거하고 대소문자·Unicode 본문은 provider에 보존한다. account bucket은 별도로 `trim → NFKC → lowercase` 정규화해 변형 우회를 막는다. loginName·IP 원문은 저장하지 않으며 HMAC key는 transaction root secret에서 HKDF domain separation으로 파생한다.
- callback은 외부 token endpoint 호출 전에 state와 browser binding이 일치하는 row를 `DELETE ... RETURNING`으로 원자 소비하며, 성공·실패와 관계없이 임시 쿠키를 삭제한다.
- issuer·authorization/token/JWKS endpoint는 HTTPS만 허용하고 ID token의 RS256 서명, `kid`, `iss`, `aud`, `exp`, `nonce`, `sub`, `auth_time`을 검증한다.
- 검증된 ZITADEL subject가 기존 `auth_identities`에 없으면 자동가입하지 않는다.

세션은 유휴 8시간·절대 24시간이다. 유효 요청은 5분 단위로 `last_seen_at`과 유휴 만료를 갱신하되 절대 만료는 연장하지 않는다. DB check constraint도 8시간·24시간 상한을 강제한다.

Web은 `HOTEL_API_ORIGIN`의 API Worker를 같은 origin의 `/api/auth/*` runtime proxy로 연결한다. 현재 proxy는 계약된 인증 경로와 HTTP method만 허용하며 업무 API는 각 수직 기능 구현 때 명시적으로 추가한다. API runtime 필수 설정 이름은 `DATABASE_URL`, `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_REDIRECT_URI`, `AUTH_TRANSACTION_ENCRYPTION_KEY`, `ZITADEL_SERVICE_USER_TOKEN`다. 값은 저장소·로그·문서에 기록하지 않는다. 필수 설정이 없으면 인증 endpoint는 `AUTH_PROVIDER_NOT_CONFIGURED` 또는 `DB_NOT_CONFIGURED`로 안전 실패한다.

CI는 실제 workerd에서 PostgreSQL readiness, WebCrypto를 거치는 로그인 provider 장애, callback validation, session 거부, logout cookie 삭제를 smoke한다. 실제 ZITADEL credential 기반 end-to-end는 Preview 환경 gate에서 수행한다.

중요 mutation용 재인증은 기존 세션값이나 body PIN으로 대체하지 않는다. 첫 중요 mutation 구현 전에 현재 session·작업·resource에 묶인 짧은 수명의 일회성 재인증 grant를 별도 migration과 transaction으로 완성한다.

## 7. 요청 권한판정

모든 보호 API는 다음 교집합을 서버에서 확인한다.

```text
유효한 서버 세션
∩ 활성 사용자
∩ 활성 회사
∩ 승인된 사용자유형
∩ 유효한 호텔 배정/소유주 연결
∩ 기능권한
∩ 개인 명시적 DENY 우선
∩ 자료 공개범위·소유권
∩ 자료 상태
```

메뉴 숨김은 UX 보조일 뿐 보안통제가 아니다. 조회 SQL은 ID만으로 대상을 먼저 가져오지 않고 `company_id`, `branch_id`, resource ID를 처음부터 조건에 포함한다.

## 8. PostgreSQL 기반

새 제품 migration은 `0001`부터 시작한다.

초기 기반 테이블:

- `schema_migrations`
- `companies`
- `users`
- `auth_identities`
- `auth_sessions`
- `auth_login_transactions`
- `branches`
- `hotel_profiles`
- `roles`
- `user_groups`
- `user_group_memberships`
- `permissions`
- `user_role_memberships`
- `permission_grants`
- `audit_events`
- `idempotency_records`
- `outbox_jobs`

기간 관계는 `[start, end)`를 사용한다. 중복기간은 PostgreSQL range와 exclusion constraint 또는 transaction 잠금·재검사를 함께 사용한다.

사용자·역할·사용자그룹은 권한·감사 참조의 정본이므로 물리 삭제하거나 `id/company_id`를 변경하지 않는다. DB trigger로 `DELETE`와 re-key를 차단하고 상태를 `INACTIVE`로 바꾸는 비활성화만 허용한다.

RLS는 회사 하드경계의 2차 방어선으로 도입한다. 요청 transaction 안에서만 `SET LOCAL app.company_id`를 사용하며 pool 전역 `SET`은 금지한다.

## 9. 변경 API 원자성

```text
세션·사용자·회사 검증
→ 호텔범위·기능권한 검증
→ Idempotency-Key·canonical request hash
→ 실제 PostgreSQL transaction
   ├─ 멱등 재생/충돌 판정
   ├─ version 조건부 변경
   ├─ 업무자료 변경
   ├─ 감사 이벤트
   └─ 멱등 결과 참조 완료
→ commit
→ 반환 ID로 DB 재조회
→ 응답
```

- 동일 키·동일 요청은 최초결과를 재응답한다.
- 동일 키·다른 요청은 `409 IDEMPOTENCY_CONFLICT`다.
- 요청·응답 원문은 멱등기록에 저장하지 않는다.
- 업무 저장·감사·멱등 완료는 같은 실제 transaction에 포함한다.
- 별도 HTTP SQL 호출의 `BEGIN/COMMIT` 문자열을 transaction 증거로 인정하지 않는다.

## 10. 감사

감사 최소필드:

```text
event_code
actor_user_id
actor_type
session_id
company_id
branch_id
resource_type
resource_id
before_summary
after_summary
reason
result
trace_id
occurred_at
```

업무 변경 감사 저장이 실패하면 업무 변경도 rollback한다. 권한 실패·범위 밖 접근·파일 접근 실패도 기록한다. token, OTP, signed URL, 비밀번호, 개인정보 원문은 저장하지 않는다.

## 11. R2

- private bucket만 사용한다.
- object key에 회사명·호텔명·사용자 ID·원래 파일명을 넣지 않는다.
- 파일 metadata 정본은 PostgreSQL이다.
- `PENDING_UPLOAD → QUARANTINED → READY | REJECTED | EXPIRED` 상태를 사용한다.
- 검역통과 전 부모자료 연결·보기·다운로드를 금지한다.
- VIEW와 DOWNLOAD 권한을 분리한다.
- 권한통과 후 5분 이하 URL 또는 인증 streaming만 허용한다.
- R2 미설정은 `503 FILE_STORAGE_NOT_CONFIGURED`다.

## 12. Web UI

```text
AppShell
├─ DesktopShell
│  ├─ TopBar
│  ├─ Sidebar
│  └─ MainContent
└─ MobileShell
   ├─ MobileTopBar
   ├─ MobileContent
   └─ BottomNavigation 또는 MobileTaskActionBar
```

- PC 1280px 이상: 240px sidebar, 표·분할화면 중심.
- 노트북 1024~1279px: 72px 접힌 sidebar, 420px 상세패널.
- 모바일: 표를 축소하지 않고 카드·단일업무 흐름으로 교체.
- 목록 filter·sort·page는 URL search parameter가 정본이다.
- mutation 성공은 응답 Zod parse → ID 상세 재조회 → 목록 invalidate → 재조회 성공 후에만 화면 성공으로 처리한다.

Canonical route:

```text
/hotel-operations
/hotels
/hotels/:hotelId
/hotels/:hotelId/rooms
/hotels/:hotelId/inspections
/hotels/:hotelId/issues
/hotels/:hotelId/daily-sales
/admin/hotel-permissions
/notifications
```

## 13. 구현 순서

1. pnpm workspace·계약·UI token·API/Web 실행골격
2. `/api/health/live`, DB-backed `/api/health/ready`
3. `0001_platform_foundation.sql`과 실제 PostgreSQL 제약 테스트
4. ZITADEL adapter·opaque session·매 요청 principal
5. 준비중 호텔 생성·목록·상세·수정 수직 슬라이스
6. 호텔배정·하우스키핑 연결·소유주 1:1
7. 객실·체크리스트·점검일정·문의처
8. 비공개 R2
9. 활성화·운영중지·재활성화
10. 점검·운영이슈
11. 일매출
12. 소유주 문의·알림
13. 사용자유형별 Preview E2E·권한우회·복구 smoke

## 14. 검증 게이트

- `pnpm install --frozen-lockfile`
- typecheck·unit test·Web/API build
- Playwright Chromium에서 Pretendard를 적용한 AppShell 1440px PC·1024px 노트북·390px 모바일 및 로그인 1440px PC·390px 모바일 screenshot 회귀
- disposable 실제 PostgreSQL migration·constraint·rollback·concurrency test
- readiness는 `0001` marker뿐 아니라 필수 relation·핵심 column·회사경계 constraint·감사/권한 trigger의 이름·대상·함수·활성상태가 모두 일치할 때만 `READY`
- 빈 DB, migration 누락, 필수 테이블 삭제, 핵심 제약 유실은 `SCHEMA_NOT_READY`
- 외부 `TEST_DATABASE_URL` integration은 명시 opt-in과 `_test` 또는 `_ci` DB 이름을 모두 만족하는 전용 DB에서만 실행
- DB 미설정 readiness non-2xx
- Base64/JWT 형태 위조 세션쿠키 거부
- 타 법인·타 호텔·종료배정 직접 API 차단
- 동일 멱등키 동시요청 실제 PostgreSQL 검증
- 파일 VIEW/DOWNLOAD 권한우회 차단
- Preview DB/R2 저장·재조회·정리
- Production DB·R2·secret·DNS는 별도 승인 전 미접근
