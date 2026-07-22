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

### 로그인 ID 정책

#### 초기 MVP 적용

- 관리자가 계정 생성 화면에서 짧은 로그인 ID를 직접 입력한다. 사원번호나 이메일 앞부분으로 자동 확정하지 않는다.
- canonical 로그인 ID는 위아히어 전체에서 회사와 관계없이 유일하며, ASCII 영문 소문자 `a-z`와 숫자 `0-9`만 허용하고 길이는 3~30자다.
- 영문 대문자 입력은 소문자로 정규화한다. 공백, 한글, `@`, 점, 밑줄, 하이픈은 허용하지 않는다.
- 계정 생성과 로그인 UI는 짧은 로그인 ID만 입력받는다. ZITADEL의 `ID@조직주소` 전체 로그인명은 사용자에게 입력받거나 화면·오류·감사에 노출하지 않는다.
- 백엔드는 승인된 환경별 ZITADEL organization과 PostgreSQL identity mapping으로 짧은 ID에 대응하는 검증된 provider subject를 해석한다. Session API에는 검증된 `userId`를 전달하며 요청에서 organization suffix나 전체 provider 로그인명을 받거나 신뢰하지 않는다.
- 일반 로그인에서 전체 ZITADEL 로그인명을 호환 입력으로 허용하지 않는다.
- provider identity 연결 정본은 검증된 ZITADEL subject와 호텔관리 내부 사용자 ID다. ZITADEL Cloud에서 자체 호스팅 인스턴스로 이전하더라도 사용자-facing 짧은 로그인 ID는 유지한다.
- 한 번 발급한 canonical 로그인 ID는 계정이 비활성·중지돼도 다른 사용자에게 영구 재사용하지 않는다.
- 필수 예약 ID `admin`, `administrator`, `root`, `system`, `security`, `api`, `service`, `support`, `test`, `preview`, `werehere`는 일반 사람 계정 생성에 사용할 수 없고 관리자가 삭제·해제할 수 없다.
- 초기 MVP 완료 전 DB는 immutable 전역 ID registry와 global unique/FK로 canonical 로그인 ID를 선점·보존하고, 로그인 BFF는 짧은 ID를 검증·정규화한 뒤 DB가 확인한 ZITADEL subject와 organization으로 인증해야 한다.

#### 후속 확장 정책 — 초기 MVP 구현 제외

- 동일인이 복귀하면 이름·이메일만으로 판정하지 않고 본인·인사 식별자·기존 provider identity를 검증한 뒤 기존 계정을 재활성화한다.
- 동일인 재활성화 때 과거 회사·사용자유형·호텔배정·역할·권한을 자동 복원하지 않고 현재 승인범위에서 다시 검증·부여한다. 재활성화 API·승인권자·감사사건은 후속 구현 범위에서 별도 명세한다.
- 로그인 ID는 일반 사용자가 직접 변경할 수 없다. 별도 권한이 확인된 관리자만 오타 교정이나 승인된 계정체계 변경 사유로 예외적으로 변경한다.
- 새 로그인 ID는 동일한 전체 유일성·형식·예약 ID 검사를 통과해야 한다. ZITADEL provider 로그인명과 호텔관리 canonical 로그인 ID는 복구 가능한 saga로 함께 변경하며 한쪽만 변경된 상태를 성공으로 반환하지 않는다.
- 변경해도 검증된 ZITADEL subject와 호텔관리 내부 사용자 ID는 유지한다. 성공과 동시에 해당 사용자의 모든 호텔관리 session을 회수하고 이전 로그인 ID는 영구 예약한다.
- 변경 요청·행위자·대상·이전 ID·새 ID·결과·시각을 감사하되 credential과 provider 오류 원문은 저장하지 않는다. 변경 시 DB 정본의 회사범위 `USER_LOGIN_ID_CHANGE` capability를 요구하며 `USER_CREATE`, `USER_SUSPEND`, 사용자유형, 직책, 표시이름, 정적 역할 기본권한으로 암묵 부여하지 않는다.
- 로그인 ID 변경은 행위자의 TOTP 재인증을 요구한다. TOTP 성공 뒤에도 활성 session, 회사범위 `USER_LOGIN_ID_CHANGE`, 대상 사용자, 새 ID 유일성·형식, 데이터 version을 서버에서 다시 검증하고 다른 관리자의 이중승인은 요구하지 않는다.
- TOTP 미등록·실패·만료·복구중 상태에서는 변경하지 않는다. TOTP code 원문은 DB·로그·감사·오류에 저장하지 않고 재인증 방법·결과·시각만 감사한다. 일반 로그인은 아이디·비밀번호 흐름을 유지한다.
- 회사는 업무상 보호할 추가 로그인 ID를 별도 목록에 등록할 수 있다. 계정 생성·로그인 ID 변경은 canonicalize 뒤 필수 목록과 회사 추가 목록을 모두 검사한다.
- 이미 발급됐거나 과거 ID로 영구 예약된 값을 추가 목록에 소급 등록하려 하면 충돌로 차단하고 기존 계정을 자동 변경하지 않는다.
- 회사 추가 예약 ID 등록·해제는 DB 정본의 회사범위 `USER_LOGIN_ID_RESERVATION_MANAGE` capability와 행위자 TOTP 재인증을 요구한다. `USER_LOGIN_ID_CHANGE`, `USER_CREATE`, `USER_SUSPEND`, 사용자유형, 직책, 표시이름, 정적 역할 기본권한으로 암묵 부여하지 않는다.
- TOTP 성공 뒤에도 활성 session, 회사범위 권한, 목록 version, 대상 ID 충돌을 서버에서 다시 검증한다. 필수 고정 목록은 이 권한으로도 변경·해제할 수 없으며, 변경 전후와 결과를 감사하고 TOTP code 원문은 저장하지 않는다.
- 회사 추가 예약 ID는 최종 등록 전에 canonicalization·형식·필수예약·현재 및 과거 사용자 ID·기존 예약 충돌과 적용 영향을 미리 보여주고 TOTP 재인증 뒤 확정한다. 최종 확정 전 초안은 효력이 없고 즉시 취소할 수 있다.
- 활성 추가 예약 ID 해제는 즉시 적용하지 않고 `RELEASE_PENDING`으로 전환해 7일 동안 계속 사용을 차단한다. 대기 중 `USER_LOGIN_ID_RESERVATION_MANAGE` 권한과 TOTP 재인증으로 취소해 `ACTIVE`로 되돌릴 수 있다.
- 7일 종료 시 필수예약, 현재·비활성·과거 사용자 ID, 이전 로그인 ID tombstone, 다른 활성 예약, 취소 여부, 목록 version을 transaction 안에서 다시 검사한다. 통과하면 `RELEASED`, 충돌하면 `RELEASE_BLOCKED`로 전환하며 물리삭제하지 않는다.
- 현재 또는 과거 사용자에게 한 번이라도 발급됐거나 provider identity·과거 로그인 ID로 연결된 값은 `TOMBSTONED`로 영구 보호한다. 등록·해제요청·취소·최종해제·차단은 전후상태와 결과를 감사한다.
- 예약 검사와 계정 ID 발급은 canonical ID 기준 DB unique constraint와 같은 transaction 잠금·최종 재검사로 경쟁조건을 차단한다. 7일 만료 작업은 멱등·재시도 가능해야 하고 최종검사 실패를 성공으로 기록하지 않는다.
- 전역 ID 공간에서 회사 추가 예약이 다른 회사에 미치는 범위는 후속 정책으로 확정한다.

후속 확장 정책은 사용자 확정 결정을 보존하지만 초기 MVP API·DB·UI·release gate에는 포함하지 않는다.

#### 구현 및 release gate

- provider 호출 전에 immutable `login_id_registry`에서 전역 ID를 선점하고, 충돌 시 provider 호출 없이 일반 중복 오류로 종료한다.
- `users.login_name`은 global unique와 registry 복합 FK를 함께 사용하며 계정 중지·보상 뒤에도 registry tombstone을 삭제하지 않는다.
- 로그인은 짧은 ID→검증된 ZITADEL subject 해석→Session API `userId` 검사→subject·organization 재검증 순서로 처리한다.
- Preview bootstrap은 기존 provider subject를 유지하고 호텔관리 alias만 `previewadmin`으로 정렬하며 활성 호텔 session을 회수·감사한다.
- 실제 ZITADEL Preview smoke로 신규 ID 로그인 성공, 이전 alias 거부, subject·내부 user ID·권한 불변을 확인하기 전에는 완료로 보지 않는다.

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
- API는 commit된 exact outbox를 즉시 claim하고 ZITADEL 비활성화를 시도한다. provider 결과와 claim-token fenced outbox `SUCCEEDED`가 확인된 뒤에만 2xx를 반환한다.
- provider 실패는 안전 오류코드와 함께 `FAILED`로 기록하고 재시도한다. 로컬 접근 차단은 되돌리지 않으며, 같은 멱등키 재시도는 저장된 outbox ID에서 수렴한다.

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
- provider용 전체 로그인명은 canonical 짧은 로그인 ID와 승인된 환경별 organization 설정에서만 서버가 구성한다. 사용자 요청의 suffix나 전체 provider 로그인명을 authority로 사용하지 않는다.

## 13. 생성 saga와 보상

1. 권한·입력·호텔범위·멱등키 검증
2. PostgreSQL에 `PROVISIONING` 예약·idempotency 원장·2분 lease·재시도 횟수 저장
3. ZITADEL human user를 예약된 deterministic ID로 생성
4. 성공 응답 유실·409이면 `GET /v2/users/{deterministic-id}`가 정확히 같은 ID·organization의 `ACTIVE` human을 반환한 경우에만 provider 성공으로 확정
5. PostgreSQL transaction으로 `users`, `auth_identities`, 호텔관계, 감사, idempotency 결과 저장
6. 생성 ID로 상세 재조회 후 응답

활성 lease 동안 동일 요청의 중복 provider 호출을 차단하고, lease 만료 후 동일 payload·멱등키만 재획득한다. 재획득마다 단조 증가 fencing generation을 발급하며 provider 후 DB 상태 갱신은 현재 generation과 일치할 때만 허용한다. stale 요청은 deterministic identity를 비활성화하거나 보상하지 않고 retryable 멱등 충돌로 종료한다. `PROVIDER_CREATED` attempt 재시도는 provider create를 반복하지 않고 DB 확정부터 재개한다. 완료된 동일 payload·멱등키 replay는 제출된 임시 비밀번호가 deterministic provider subject에 실제로 일치하는지 5분 수명의 단기 Session API로 증명한 뒤에만 기존 계정 결과를 반환한다. 공식 password-invalid ErrorDetail `COMMAND-3M0fs`만 credential 불일치로 분류해 `IDEMPOTENCY_CONFLICT`로 종료하며, unknown `400`·`404`·`429`는 retryable provider 오류로 안전 실패한다. 생성한 verification session 삭제가 실패하면 민감값 없는 `account_verification_session_cleanup_failed` 사건을 남기고 replay 2xx를 반환하지 않는다.

ZITADEL 생성 후 DB 완료가 `DUPLICATE`·`FORBIDDEN`으로 명시적으로 종료되거나, DB 완료 응답 실패 뒤 tenant-authorized read-back이 완료 aggregate 없이 attempt `PROVIDER_CONFIRMED`를 확인하면 원래 비즈니스 오류 또는 retryable `INTERNAL_ERROR`, exact provisioning attempt ID, provider subject를 `COMPENSATION_REQUIRED` 상태와 `ACCOUNT_PROVIDER_COMPENSATE` outbox에 같은 transaction으로 먼저 저장한다. read-back이 불가능하거나 완료 여부가 불명확하면 보상하지 않고 provider-confirmed recovery 상태를 유지한다. API는 commit된 exact outbox ID를 scheduled reconciler와 동일한 `PENDING`/due `FAILED`/stale `PROCESSING` claim 규칙으로 즉시 획득해 ZITADEL 사용자를 비활성화한다. claim 승자만 provider를 호출하며 성공 marker는 company·job ID·job type·claim token과 exact provisioning attempt ID가 모두 일치해야 outbox `SUCCEEDED`와 attempt `COMPENSATED`를 같은 transaction으로 확정한다. 즉시 보상이 완료되면 저장된 원래 `ACCOUNT_DUPLICATE`, `FORBIDDEN` 또는 retryable `INTERNAL_ERROR`를 반환하고, provider `NOT_FOUND`는 생성 결과의 late visibility 가능성 때문에 보상 성공으로 간주하지 않는다. 즉시 claim·provider·marker가 실패하거나 불명확하면 2xx나 원래 오류를 반환하지 않고 `COMPENSATION_REQUIRED`를 유지한다. exact attempt ID 또는 원래 오류가 없는 legacy active 보상 job은 값을 추측해 backfill하지 않는다. EXPAND migration은 배포 전에 이미 존재한 legacy job과 attempt를 `DEAD_LETTER`/`LEGACY_COMPENSATION_LINKAGE_UNAVAILABLE`로 격리하되 이전 Worker writer와 호환되도록 신규 payload CHECK를 아직 적용하지 않는다. exact-linkage-aware Worker 배포와 호환 smoke 뒤 CONTRACT migration이 배포 창 동안 이전 Worker가 기록한 legacy row를 다시 격리하고 신규 active payload DB CHECK를 적용한다. CONTRACT 이후 active 보상 payload는 DB CHECK와 claim-time attempt ID·user·provider subject 대조를 모두 통과해야 provider를 호출할 수 있다. Preview scheduled reconciler는 tenant RLS 안에서 `FOR UPDATE SKIP LOCKED`, claim-token fencing, stale processing lock 회수, 지수 backoff로 동일 outbox를 수렴시킨다. provider deactivate는 멱등 at-least-once이며 lease takeover 때문에 외부 호출 exactly-once를 주장하지 않는다. 같은 멱등키 재시도는 저장된 outbox ID·상태·원래 오류를 재사용하고 고아 identity를 중복 생성하지 않는다.

## 14. 계정 중지

- version·사유·권한·자기중지·마지막관리자 규칙을 검증한다.
- ZITADEL 비활성화와 DB 상태변경을 saga로 처리한다.
- DB `users.status=INACTIVE` 저장, 모든 활성 `auth_sessions` 회수, 감사, `ACCOUNT_PROVIDER_DEACTIVATE` outbox를 같은 transaction에서 처리한다.
- DB 중지·session 회수를 먼저 원자적으로 완료해 호텔 접근을 즉시 차단한다.
- API는 commit된 exact outbox ID를 동일 tenant session으로 claim한 경우에만 provider를 호출한다. scheduled reconciler와 API는 동일한 `claim_token` fence를 사용하므로 정상 경쟁에서는 한 claim 승자만 호출한다.
- provider `DEACTIVATED` 또는 `NOT_FOUND`와 claim-token fenced `SUCCEEDED` DB marker가 모두 확인된 뒤에만 2xx를 반환한다. provider `NOT_FOUND`는 일반 중지에서는 이미 목적 상태인 멱등 성공이다.
- provider 호출·marker·claim이 실패하거나 다른 worker가 처리 중이면 호텔 접근은 차단된 상태를 유지하고 retryable non-2xx를 반환한다. 같은 멱등키 replay는 저장된 exact outbox 상태를 사용하며 `SUCCEEDED`면 provider를 재호출하지 않고, due `FAILED`면 claim 승자만 재시도하며, `PROCESSING`·not-due `FAILED`·`DEAD_LETTER`는 2xx를 반환하지 않는다.
- provider 성공 뒤 marker 전 crash는 stale lease 회수 후 멱등 deactivate를 반복할 수 있으므로 외부 exactly-once를 주장하지 않으며, 이전 claim token은 새 owner의 결과를 완료할 수 없다.
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

비밀번호·token·전체 이메일 원문·login ID·provider subject·provider 오류 body·사용자 자유문 사유는 감사에 저장하지 않는다. 대상 사용자 ID, 회사 ID, 사용자유형, 호텔 ID, 행위자, 결과, 안정적인 사유 코드, trace ID, 시각을 저장한다. 단일 호텔 사건만 `branch_id`를 설정하고, 복수 호텔 사건은 `branch_id=null`과 정렬·중복제거한 전체 `hotelIds`를 구조화 summary에 저장한다.

`ACCOUNT_PROVISION_REQUESTED`는 신규 provisioning attempt 최초 reserve와 같은 transaction에서 1회만 저장하고 멱등 replay에는 추가하지 않는다. 이 transaction은 최초 actor type·session·trace를 attempt 내부 metadata에 함께 저장한다. `ACCOUNT_CREATED`도 API 즉시 완료와 scheduled recovery 모두 최초 actor type·session·trace를 기록한다. `ACCOUNT_CREATE_FAILED`는 provider identity 생성 뒤 DB 완료 실패가 증명되어 compensation intent·outbox를 저장하는 transaction에서 1회 기록한다. provider 결과나 DB 완료 여부가 불명확한 recovery 상태에는 terminal 실패 사건을 기록하지 않는다. `ACCOUNT_COMPENSATION_SUCCEEDED`와 `ACCOUNT_COMPENSATION_FAILED`는 claim-token 승자의 outbox marker와 같은 transaction에서 기록한다. stale marker와 멱등 replay는 중복 사건을 만들지 않으며, 실제 provider 재시도 실패는 각 fenced attempt별 실패 사건을 남길 수 있다. `ACCOUNT_SESSION_REVOKED`는 계정 중지의 local INACTIVE·활성 세션 회수·provider outbox transaction에서 회수 건수와 함께 1회 기록하고, 세션이 0건이어도 수행 결과를 기록한다. 생성 request→완료·실패→보상 사건과 scheduled recovery는 attempt에 저장된 최초 actor type·session·trace를 재사용한다. legacy provider-confirmed attempt에 trace가 없으면 compensation 준비 transaction에서 새 trace를 durable backfill하고, 이미 active인 legacy compensation job은 stable outbox job ID를 trace fallback으로 사용한다. legacy recovery completion은 stable attempt ID를 trace fallback으로 사용하며 origin actor/session metadata가 없으면 actor type은 기존 안전 fallback, session은 null로 기록한다. 감사 insert가 실패하면 결합된 attempt·outbox·사용자·session 전이도 모두 rollback한다.

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
