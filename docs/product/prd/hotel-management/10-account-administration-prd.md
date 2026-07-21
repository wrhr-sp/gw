# 호텔관리 계정·사용자 관리 PRD

## 1. 문서 정보

| 항목 | 값 |
|---|---|
| PRD ID | `HOTEL-MVP-070` |
| 버전 | `1.0-user-approved` |
| 상태 | `user_approved` |
| 대상 | 위아히어 내부 호텔관리 Preview |
| 승인자 | 대장, 2026-07-19 |
| 근거 | `HOTEL-MVP-000`, `HOTEL-MVP-010`, `HOTEL-MVP-060`, 2026-07-19 계정관리 오케스트레이션 승인 |

## 2. 결론

운영자는 ZITADEL 콘솔에서 사람 계정을 생성하지 않는다. 최초 회사 관리자 1명의 bootstrap을 제외한 모든 사람 계정 생성·조회·중지는 호텔관리 프로그램 안에서 수행한다.

호텔관리 백엔드는 별도 최소권한 service credential로 ZITADEL User API를 호출해 인증 identity를 만들고, 같은 사용자에게 호텔관리 PostgreSQL의 회사·사용자유형·호텔관계·권한을 연결한다. ZITADEL은 credential과 인증 identity의 정본이고, 호텔관리 PostgreSQL은 업무 사용자·회사·호텔범위·권한·상태·감사의 정본이다.

## 3. 목표

1. Preview 최초 회사 관리자 1명을 재실행에 안전하게 bootstrap한다.
2. 회사 관리자가 호텔관리 UI에서 사람 계정을 한 번에 생성한다.
3. 사내 임직원·하우스키핑·호텔 소유주를 독립 사용자유형으로 생성한다.
4. ZITADEL identity와 호텔관리 사용자가 서로 고아 상태로 남지 않도록 보상한다.
5. 계정 중지 즉시 호텔관리 session과 신규 업무 접근을 차단한다.
6. 계정 생애주기 변경을 PostgreSQL에 감사하고 생성 결과를 재조회한다.

## 4. 범위

### 포함

- `/admin/users` 회사 사용자 목록·검색·상태·사용자유형 필터
- `/admin/users/new` 사용자 생성
- `/admin/users/:userId` 사용자 상세·계정 중지
- ZITADEL human identity 생성
- 호텔관리 `users`·`auth_identities` 연결
- 사용자유형별 호텔관계 동시 저장
- 최초 임시 비밀번호와 최초 로그인 비밀번호 변경 의무
- `USER_READ`, `USER_CREATE`, `USER_SUSPEND` 회사범위 권한
- 멱등·동시성·낙관적 version·감사·세션회수
- 외부 identity 생성 뒤 DB 실패 시 ZITADEL 비활성화 보상
- ZITADEL 설정 미존재·schema 미준비 시 명확한 안전 실패
- Preview PostgreSQL·Cloudflare·실제 ZITADEL mutation smoke와 생성자료 정리

### 제외

- Production 사용자·DB·secret·배포
- 이메일·SMS 초대 또는 알림 발송
- 거래처 임직원
- 대량등록·CSV import
- 셀프 회원가입·가입승인
- 봇·서비스 계정 관리 UI
- SSO·LDAP·Active Directory
- 관리자 권한 위임 UI와 임의 권한 편집
- 사용자 삭제

## 5. 최초 관리자 bootstrap

- Preview 배포가 받는 `ZITADEL_PREVIEW_SUBJECT`를 고정 회사 관리자 사용자와 1:1 연결한다.
- DB 변경 전에 approved subject SHA-256을 constant-time 비교하고 ZITADEL에서 같은 ID·organization·`ACTIVE` human·`READY` MFA를 read-back한다.
- read-back 404·redirect·timeout·schema 오류·organization 불일치·MFA 미등록은 모두 bootstrap을 중단한다.
- bootstrap은 동일 subject·회사·사용자에 대해 재실행 가능하고 다른 사용자로의 재매핑은 실패한다.
- 승인 참조는 protected Preview environment의 안정적인 티켓·결정 ID를 사용한다. 실행별 `run_id`는 승인 정본으로 저장하거나 재실행 일치조건에 사용하지 않는다.
- 최초 관리자는 `INTERNAL_STAFF`, `ACTIVE`이며 회사범위 `HOTEL_MANAGE`, `USER_READ`, `USER_CREATE`, `USER_SUSPEND`를 가진다.
- bootstrap은 일반 사용자 생성 API를 우회하는 유일한 예외다.
- bootstrap 완료 뒤 사람 계정 생성은 호텔관리 UI/API에서만 수행한다.
- Production 최초 관리자는 별도 명시승인 전 생성하지 않는다.

## 6. 사용자유형과 호텔관계

| 사용자유형 | 내부 코드 | 생성 시 호텔관계 |
|---|---|---|
| 사내 임직원 | `INTERNAL_STAFF` | 주배정 호텔 1곳 필수, 유효기간·사유 저장 |
| 하우스키핑 | `HOUSEKEEPING` | 호텔 1곳 이상 연결, 개인별 독립계정 |
| 호텔 소유주 | `HOTEL_OWNER` | 호텔 1곳과 활성 1:1 연결 |

기존 내부 코드 `ROOM_OPERATIONS`, `BRANCH_OWNER`는 API·UI 경계에서 각각 `HOUSEKEEPING`, `HOTEL_OWNER`로 정규화한다. 첫 release는 rollback 안전성을 위해 DB가 구·신 코드를 모두 허용하고 신규 쓰기도 구 Worker가 읽을 수 있는 저장코드를 사용한다. 새 Worker가 안정화된 후 별도 contract migration에서 데이터 치환·구 코드 제약 제거를 수행하며, 그 전까지 API·UI에는 새 명칭만 노출한다.

호텔 소유주는 동일 호텔에 활성계정 1명, 동일 소유주 계정도 활성 호텔 1곳만 허용한다. 호텔관계는 사용자 생성 DB transaction 안에서 저장한다.

사내 임직원은 동시에 활성 `PRIMARY` 주배정 호텔을 1곳만 가질 수 있다. 지원배정은 별도 `SUPPORT` 관계로 보존하며 계정 목록·상세의 대표 호텔은 `PRIMARY`를 우선한다.

## 7. 계정 생성 입력

- 표시이름
- 로그인명
- 이메일
- 사용자유형
- 사용자유형에 필요한 호텔 ID
- 임시 비밀번호
- 배정 시작일
- 사유
- `version`은 생성 응답부터 1

임시 비밀번호는 브라우저에서 TLS로 백엔드에 전달하고 ZITADEL User API 호출에만 사용한다. 애플리케이션 DB·로그·감사·오류·응답에 원문 또는 hash를 저장하지 않는다. ZITADEL에는 최초 로그인 후 변경이 필요한 credential로 생성한다.

## 8. 최초 비밀번호 변경

- 신규 사용자는 호텔관리 업무 API를 사용하기 전에 비밀번호를 변경해야 한다.
- 최초 로그인 session은 비밀번호 변경 화면과 로그아웃만 허용한다.
- 새 비밀번호는 ZITADEL에만 전달하고 호텔관리 DB에 원문·hash·digest를 저장하지 않는다.
- provider 호출 전에 현재 session과 DB `PENDING_SETUP + must_change_password=true`를 원자 검증하고 durable attempt를 예약한다.
- 사용자별 활성 비밀번호 변경 attempt는 하나만 허용한다. 비밀번호 쓰기는 외부 provider에서 멱등·fencing할 수 없으므로 lease 만료만으로 다른 요청이 takeover하거나 provider 쓰기를 반복하지 않는다.
- `RESERVED` owner만 provider 비밀번호 쓰기를 한 번 수행한다. 응답·marker 결과가 불명확한 만료 attempt는 `RECOVERY_REQUIRED`로 전환하고 다시 `RESERVED`로 되돌리지 않는다.
- recovery 요청은 사용자가 다시 제출한 후보 비밀번호를 ZITADEL의 단기 Session API로 검증할 뿐 provider 비밀번호를 재작성하지 않는다. 검증된 provider subject·organization·credential만 `PROVIDER_UPDATED`로 단조롭게 확정한 뒤 로컬 완료를 재개한다.
- 동일 payload의 브라우저 재시도는 같은 멱등키를 유지한다. credential payload를 로컬에 저장하거나 비교할 수 없으므로 완료·provider-updated replay도 제출 credential을 provider에서 증명하지 않고 성공으로 반환하지 않는다.
- 성공 후 `must_change_password=false`를 저장하고 현재 setup session을 포함한 모든 활성 session을 회수한다.
- 변경 실패 시 업무 접근은 계속 차단한다.

## 9. 상태

```text
PENDING_SETUP → ACTIVE → INACTIVE
                      ↘ LOCKED
```

- `PENDING_SETUP`: identity·DB 연결은 완료됐으나 최초 비밀번호 변경 전.
- `ACTIVE`: 인증과 업무 권한판정 가능.
- `INACTIVE`: 관리자가 중지. 신규 session·업무 접근 차단.
- `LOCKED`: 인증 위험 또는 provider 잠금. 업무 접근 차단.
- 물리삭제하지 않는다.
- 자기계정 중지와 마지막 활성 `USER_SUSPEND` 관리자 중지는 차단한다.
- 중지 transaction은 로컬 `INACTIVE` 전환·hotel session 회수·감사·`ACCOUNT_PROVIDER_DEACTIVATE` outbox를 함께 확정한다.
- ZITADEL 비활성화 성공은 outbox `SUCCEEDED`, 실패는 안전 오류코드와 함께 `FAILED`로 기록하고 재시도한다.
- provider 실패 시에도 로컬 접근 차단을 되돌리지 않으며, 같은 멱등키 재시도는 provider의 idempotent 비활성화와 outbox 완료로 수렴한다.

## 10. 권한

| 행위 | 요구권한 |
|---|---|
| 사용자 목록·상세 | `USER_READ` |
| 사용자 생성 | `USER_CREATE` |
| 사용자 중지 | `USER_SUSPEND` |
| 최초 비밀번호 변경 | 본인 활성 `PENDING_SETUP` session |

권한은 DB `permission_grants` 정본으로 판정한다. 사용자유형이나 표시이름으로 관리자 권한을 암묵 부여하지 않는다. 모든 조회·변경은 principal의 `company_id`로 제한하고 외부 company ID를 요청에서 받지 않는다.

## 11. API 계약

| 메서드 | 경로 | 목적 |
|---|---|---|
| GET | `/api/admin/users` | 회사 사용자 목록·필터·페이지네이션 |
| POST | `/api/admin/users` | ZITADEL identity + DB 사용자·호텔관계 생성 |
| GET | `/api/admin/users/:userId` | 회사범위 사용자 상세 재조회 |
| POST | `/api/admin/users/:userId/deactivate` | version·사유로 중지, session 회수 |
| POST | `/api/account/initial-password` | 본인 최초 비밀번호 변경 |

모든 변경 요청은 `Idempotency-Key`를 요구한다. 사용자 ID 직접조회는 같은 회사가 아니거나 존재하지 않으면 같은 `404` 계약을 사용한다.

## 12. ZITADEL provider 경계

- 로그인 BFF credential과 사용자 provisioning credential을 분리한다.
- provisioning credential은 Preview ZITADEL organization의 사람 사용자 생성·비활성화·비밀번호 설정에 필요한 최소 역할만 가진다.
- runtime secret 이름은 로그인 PAT와 분리한다.
- endpoint는 issuer와 same-origin HTTPS인지 검증하고 redirect를 따라가지 않는다.
- provider 응답은 Zod schema로 파싱하고 알 수 없는 필드는 허용하되 필수 ID·시각은 검증한다.
- token, 비밀번호, provider subject, 전체 provider 오류 body를 로그에 남기지 않는다.

## 13. 생성 saga와 보상

1. 권한·입력·호텔범위·멱등키 검증
2. PostgreSQL에 `PROVISIONING` 예약·idempotency 원장·2분 lease·재시도 횟수 저장
3. ZITADEL human user를 예약된 deterministic ID로 생성
4. 성공 응답 유실·409이면 `GET /v2/users/{deterministic-id}`가 정확히 같은 ID를 반환한 경우에만 provider 성공으로 확정
5. PostgreSQL transaction으로 `users`, `auth_identities`, 호텔관계, 감사, idempotency 결과 저장
6. 생성 ID로 상세 재조회 후 응답

활성 lease 동안 동일 요청의 중복 provider 호출을 차단하고, lease 만료 후 동일 payload·멱등키만 재획득한다. 재획득마다 단조 증가 fencing generation을 발급하며 provider 후 DB 상태 갱신은 현재 generation과 일치할 때만 허용한다. stale 요청은 deterministic identity를 비활성화하거나 보상하지 않고 retryable 멱등 충돌로 종료한다. `PROVIDER_CREATED` attempt 재시도는 provider create를 반복하지 않고 DB 확정부터 재개한다.

ZITADEL 생성 후 DB transaction이 실패하면 ZITADEL 사용자를 즉시 비활성화한다. 보상 성공·실패를 민감값 없이 감사/운영상태로 남긴다. 보상도 실패하면 `COMPENSATION_REQUIRED` 상태와 `ACCOUNT_PROVIDER_COMPENSATE` outbox를 같은 transaction에 저장하고 2xx를 반환하지 않는다. Preview scheduled reconciler는 tenant RLS 안에서 `FOR UPDATE SKIP LOCKED`로 작업을 claim하고, stale processing lock 회수·지수 backoff를 적용해 provider 비활성화와 `COMPENSATED` 상태로 수렴한다. 재시도는 같은 멱등키로 고아 identity를 중복 생성하지 않는다.

## 14. 계정 중지

- version·사유·권한·자기중지·마지막관리자 규칙을 검증한다.
- ZITADEL 비활성화와 DB 상태변경을 saga로 처리한다.
- DB `users.status=INACTIVE` 저장과 모든 활성 `auth_sessions` 회수를 같은 transaction에서 처리한다.
- DB 중지·session 회수를 먼저 원자적으로 완료해 호텔 접근을 즉시 차단한다.
- provider 비활성화 실패 시 호텔 접근은 차단된 상태를 유지하고 2xx를 반환하지 않으며, 같은 멱등키 재시도로 provider 비활성화를 다시 수행한다.
- 중지 성공 후 provider 인증이 남아 있어도 호텔관리 principal 해석이 실패해야 한다.

## 15. 오류

| 코드 | 의미 |
|---|---|
| `EXTERNAL_AUTH_NOT_CONFIGURED` | provisioning credential 또는 organization 설정 없음 |
| `EXTERNAL_AUTH_UNAVAILABLE` | ZITADEL 통신·응답 계약 실패 |
| `ACCOUNT_DUPLICATE` | 로그인명·이메일·provider identity 중복 |
| `ACCOUNT_NOT_FOUND` | 같은 회사에서 계정을 찾지 못함 |
| `ACCOUNT_VERSION_CONFLICT` | 오래된 version |
| `ACCOUNT_SELF_DEACTIVATION_FORBIDDEN` | 자기계정 중지 시도 |
| `LAST_ADMIN_DEACTIVATION_FORBIDDEN` | 마지막 관리자 중지 시도 |
| `PASSWORD_CHANGE_REQUIRED` | 최초 비밀번호 변경 전 업무 접근 |
| `COMPENSATION_REQUIRED` | 외부 생성 뒤 자동 보상 미완료 |

DB·migration·ZITADEL 설정이 없으면 가짜 성공·DB-only 사용자·in-memory fallback 없이 안전 실패한다.

## 16. 감사 최소사건

- `ACCOUNT_PROVISION_REQUESTED`
- `ACCOUNT_CREATED`
- `ACCOUNT_CREATE_FAILED`
- `ACCOUNT_COMPENSATION_SUCCEEDED`
- `ACCOUNT_COMPENSATION_FAILED`
- `ACCOUNT_INITIAL_PASSWORD_CHANGED`
- `ACCOUNT_DEACTIVATED`
- `ACCOUNT_SESSION_REVOKED`

비밀번호·token·전체 이메일 원문·provider 오류 body는 감사에 저장하지 않는다. 대상 사용자 ID, 회사 ID, 사용자유형, 호텔 ID, 행위자, 결과, 사유, trace ID, 시각을 저장한다.

## 17. 수용 기준

- 관리자 UI 한 번의 저장으로 ZITADEL identity와 PostgreSQL 사용자·호텔관계가 생성된다.
- 생성 응답 ID로 상세 API 재조회가 일치한다.
- 설정이 없으면 `503 EXTERNAL_AUTH_NOT_CONFIGURED`이고 DB 사용자는 생성되지 않는다.
- ZITADEL 성공 후 DB 실패 테스트에서 provider 비활성화 보상이 호출된다.
- 동일 멱등키 동시요청은 외부 identity와 DB 사용자 각각 1건만 만든다.
- 다른 회사 사용자 ID의 목록·상세·중지가 차단된다.
- 권한 없는 사용자와 하우스키핑·소유주의 계정관리 API 직접호출이 차단된다.
- 신규 사용자는 최초 비밀번호 변경 전 호텔 업무 API가 차단된다.
- 중지 직후 기존 opaque session과 신규 로그인이 차단된다.
- 자기계정과 마지막 활성 관리자는 중지할 수 없다.
- 비밀번호·token이 소스·로그·문서·감사·DB에 남지 않는다.
- focused test, real PostgreSQL integration, 전체 `pnpm check`, Cloudflare build, Preview mutation/read-back/cleanup을 통과한다.
