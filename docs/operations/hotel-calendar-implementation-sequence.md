# 호텔 Calendar 구현·Google OAuth 준비 순서

## 1. 문서 정보

| 항목 | 값 |
| --- | --- |
| 상태 | `approved_sequence` |
| 선택자 | 대장 |
| 기록일 | 2026-08-07 |
| 적용 환경 | Local·비운영 Preview |
| Production | 별도 승인 전 제외 |
| 제품 정본 | PostgreSQL |
| 외부 projection | Google Calendar API backend-only 단방향 |
| 사용자 화면 | FullCalendar 표준 MIT runtime + shadcn/Radix/Tailwind |

이 문서는 [공통 점검 프로세스·시설물·하자보수·Calendar PRD](../product/prd/hotel-management/12-inspection-process-facility-repair-calendar-prd.md)의 승인 정책을 바꾸지 않고, 자체 달력 UI와 Google Calendar backend projection을 안전하게 구현하는 실행 순서를 고정한다.

## 2. 먼저 구분할 값

Google Calendar의 Calendar·event 생성, 조회, 변경, 삭제에는 단순 API key를 사용하지 않는다. 승인 방식은 운영자가 전용 Google 연동계정으로 한 번 동의하는 OAuth 2.0 authorization code·offline credential이다.

준비 대상은 다음과 같다.

- Google Cloud 비운영 프로젝트
- Google Calendar API
- OAuth 동의 화면과 테스트 사용자
- OAuth 2.0 Web client ID·client secret
- exact redirect URI
- refresh credential과 provider calendar ID 암호화용 versioned AES-GCM keyring
- credential fingerprint용 별도 versioned HMAC keyring

API key, service account key, Workspace domain-wide delegation, 브라우저 Calendar REST 호출은 만들거나 사용하지 않는다.

## 3. 고정 실행 순서

### 단계 0 — 비운영 provider 준비와 로컬 secret 골격

1. Google Cloud에서 비운영 Preview 전용 프로젝트를 생성한다.
2. Google Calendar API만 활성화한다.
3. Google Auth Platform에서 앱 이름·지원 이메일·개발자 연락처를 설정한다.
4. External Testing 상태를 사용하고 전용 비운영 Google 연동계정만 테스트 사용자로 등록한다.
5. Data Access에는 다음 exact scope 두 개만 등록한다.

```text
https://www.googleapis.com/auth/calendar.app.created
https://www.googleapis.com/auth/calendar.calendarlist.readonly
```

6. `calendar`, `calendar.readonly`, `calendar.calendarlist`, `calendar.events.owned` 또는 다른 scope를 추가하지 않는다.
7. `/home/wrhrgw/gw/.secrets/google-calendar-preview.env`는 빈 값으로 먼저 만들고 mode `0600`을 유지한다.
8. client ID·secret은 채팅·PRD·commit·로그에 붙이지 않고 대장이 ignored env 파일에 직접 입력한다.

Google OAuth 앱 게시·검증, 실호텔 계정, Production credential, 실제 Calendar/event 생성은 이 단계 승인에 포함하지 않는다.

### 단계 1 — latest main exact source 감사

1. 승인 PRD, UI 기준, Contracts, 현재 inspection·repair visit API, PostgreSQL routine/readiness, public Web proxy를 읽는다.
2. 월·주 조회 기간, 호텔 업무시간대, 단일·전체 호텔 권한, pagination, 취소일정 표시, 일정 상세 최소정보를 확정한다.
3. 전체 호텔에서 새 일정을 만들 때 호텔을 먼저 선택하고, 선택 뒤 해당 호텔의 보수 건·수행자만 조회하는 흐름을 기존 repair visit command와 대조한다.
4. callback·return path·cookie 이름, env parser, secret binding, 안정 오류코드를 Contracts에서 확정한다.
5. exact mutation 파일·DB migration 번호·focused 테스트·Preview smoke 범위를 보고하고 별도 구현 승인을 받는다.

### 단계 2 — 자체 월간·주간 달력 세로 기능

1. FullCalendar 표준 MIT React runtime 하나만 설치한다.
2. Contracts에 권한필터된 calendar display model과 기간조회 query를 먼저 정의한다.
3. PostgreSQL read model 또는 승인된 좁은 routine으로 inspection 일정과 repair visit 일정을 결합한다.
4. Repository·Service·API에서 회사·호텔배정·기능권한·개인 DENY·기간범위·pagination을 매 요청 검증한다.
5. public Web proxy는 Calendar 경로별 GET·mutation method allowlist만 추가한다.
6. PC는 월간·주간 달력을 제공하고, 390px 모바일은 선택 날짜의 44px 이상 현장업무 카드로 재배치한다.
7. browser storage에는 보기종류·마지막 사용시각만 최대 2시간 저장하고 호텔·일정·provider 식별자를 저장하지 않는다.
8. Google 연결 전에는 `NOT_CONNECTED`를 표시하며 provider 성공을 가장하지 않는다.
9. focused test·PC/390px visual·keyboard·Axe·build·mutation seal·PR/CI·동일 merged main Preview를 완료한다.

### 단계 3 — Calendar connection·credential·outbox 기반

1. 새 forward-only migration으로 회사 connection, versioned encrypted credential, 호텔 calendar link, event link, projection job·attempt·failure를 만든다.
2. tenant composite FK, scope CHECK, RLS와 `FORCE ROW LEVEL SECURITY`, exact command ACL을 적용한다.
3. refresh credential·provider calendar ID는 AES-GCM ciphertext로만 저장하고 raw token 열을 만들지 않는다.
4. AES keyring과 HMAC keyring은 분리하며 current write·old read-only rotation을 적용한다.
5. repair visit mutation과 desired source version·aggregate-head outbox signal을 같은 transaction으로 저장한다.
6. 연결이 없으면 job 0건·`NOT_CONNECTED`, 대기 중이면 `PENDING`, 적용 version 일치면 `SYNCED`, terminal failure면 `ACTION_REQUIRED`를 반환한다.
7. 실제 PostgreSQL non-owner·non-`BYPASSRLS` runtime, 동시 claim·lease reclaim·stale fence·멱등 replay를 검증한다.

### 단계 4 — OAuth start/callback과 관리자 연결 UI

1. OAuth start는 현재 session·회사 Calendar 설정권한·영향 호텔 전체권한·중요작업 재인증을 검증한다.
2. state hash·PKCE verifier ciphertext·Secure/HttpOnly/SameSite=Lax browser binding·10분 만료·allowlist return path를 저장한다.
3. callback은 exact-one state와 `code xor error`만 허용하고 provider fetch 전에 state를 claim token으로 원자 소비한다.
4. token endpoint 호출 중 DB transaction을 열어두지 않는다.
5. 반환 scope가 승인된 두 scope의 순서무관 exact set이고 신규 refresh token이 있을 때만 encrypted candidate/active credential을 저장한다.
6. 관리자 UI는 연결·재연결 candidate 확인·명시적 promote/confirm·해제·실패조회·수동재시도를 제공한다.
7. credential·provider ID·authorization code·state 원문을 UI·로그·감사·오류에 노출하지 않는다.

### 단계 5 — Scheduled Reconciler·direct REST adapter

1. token refresh는 bound callback/API 또는 승인된 backend credential service에서만 수행한다.
2. Calendar resource/event REST 호출은 scheduled Worker만 수행한다.
3. `googleapis` package 없이 승인된 Google REST endpoint와 strict Zod response allowlist를 사용한다.
4. provider 호출 중 DB transaction을 열지 않고 claim token·source version·connection version으로 결과를 fence한다.
5. timeout·429·5xx만 bounded backoff+jitter로 최대 8회 재시도한다.
6. scope·인증·권한·malformed response·삭제된 Calendar는 자동반복하지 않고 `ACTION_REQUIRED`/dead letter로 중지한다.
7. Google 장애가 PostgreSQL 일정·보수·process transaction을 rollback하지 않게 한다.

### 단계 6 — 별도 승인된 비운영 provider PoC

1. 승인된 Preview OAuth client와 전용 테스트 연동계정만 사용한다.
2. primary·unrelated Calendar가 함께 있는 fixture에서 paginated `calendarList.list`를 검증한다.
3. app-created Calendar 생성, 목록 read-back, `calendars.get`, event create/read/update/delete를 검증한다.
4. timeout 뒤 같은 Calendar/event를 재삽입하지 않고 read-back으로 수렴하는지 확인한다.
5. 불일치 Calendar metadata가 DB·로그·감사·metrics·오류에 보존되지 않는지 확인한다.
6. disconnect 뒤 기존 PostgreSQL 업무자료와 provider 자료를 자동삭제하지 않고 재연결 복구가 가능한지 확인한다.
7. scope 부족이 확인돼도 자동확대하지 않고 제품·보안 gate로 되돌린다.

### 단계 7 — Preview 통합과 보안 read-back

1. GitHub Preview environment secret과 Cloudflare Worker secret의 이름·값 전달경계를 별도로 승인한다.
2. 동일 merged main을 Preview에 배포한다.
3. DB marker·catalog·routine digest·exact grants·runtime capability를 read-back한다.
4. 자체 달력의 단일·전체 호텔 조회, 권한차단, PC·390px·접근성을 smoke한다.
5. OAuth start/callback replay·CSRF·scope mismatch·credential 암호화·연결·해제·수동재시도를 smoke한다.
6. Calendar와 event projection의 create/update/cancel/delete·timeout·rate limit·dead letter를 확인한다.
7. secret·token·provider ID 원문이 Worker logs·GitHub logs·API·HTML에 없는지 확인한다.

### 단계 8 — MVP 전체 완료 이후 검토

Calendar 세로 기능까지 승인된 MVP 잔여 구현을 모두 merge·Preview 검증한 뒤에만 다음 순서로 진행한다.

```text
세로 기능별 통합검토·수정
→ MVP 전체 회귀·보안·릴리스 검증
→ immutable artifact
→ 동일 artifact fresh 사양·보안·품질 3-way review
→ GitHub 최종 확인
→ staging
→ Production 별도 gate
```

## 4. Preview OAuth client 준비값

예정 Preview redirect URI:

```text
https://werehere-hotel-web-preview.wereheresp.workers.dev/api/admin/calendar-connections/oauth/callback
```

OAuth client 유형은 `Web application`이다. 이 URI는 단계 1의 Contracts에서 exact route로 재확인하고, 다른 path·query·wildcard callback을 추가하지 않는다. backend-only 구조이므로 브라우저가 Calendar REST를 호출하는 JavaScript origin 권한은 사용하지 않는다.

## 5. 로컬 env 파일 규칙

로컬 파일:

```text
/home/wrhrgw/gw/.secrets/google-calendar-preview.env
```

규칙:

- repository ignore 대상이며 Git에 추가하지 않는다.
- mode `0600`을 유지한다.
- owner 외 읽기·쓰기를 허용하지 않는다.
- client secret·keyring·token을 채팅·문서·로그·shell history에 출력하지 않는다.
- refresh token은 사람이 env에 입력하지 않는다. OAuth callback이 받아 암호화 DB 저장한다.
- env 파일은 Cloudflare/GitHub secret 정본이 아니다. Preview secret 전달은 단계 7에서 별도 승인한다.
- keyring 직렬화 형식은 단계 1의 Contracts·parser에서 확정하기 전 실제 키를 입력하지 않는다.

예약 변수명:

```text
GOOGLE_CALENDAR_OAUTH_CLIENT_ID
GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET
GOOGLE_CALENDAR_OAUTH_REDIRECT_URI
CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION
CALENDAR_CREDENTIAL_AES_KEYRING_JSON
CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION
CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON
```

## 6. 중단 조건

다음이면 다음 단계로 진행하지 않는다.

- API key만 발급됐고 OAuth Web client가 없다.
- 승인 두 scope 외 scope가 포함됐다.
- callback URI가 Contracts와 다르다.
- client secret·token·keyring이 tracked file·문서·로그에 노출됐다.
- env mode가 `0600`이 아니다.
- Google provider mutation의 별도 승인이 없다.
- Production 프로젝트·실호텔 계정·실데이터가 대상이다.
- DB·API·Web이 Google 성공을 정본으로 사용하거나 provider 실패가 업무 transaction을 rollback한다.
