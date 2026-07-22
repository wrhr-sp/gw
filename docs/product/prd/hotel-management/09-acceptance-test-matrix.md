# 호텔관리 초기 MVP 수용·테스트 매트릭스

> 상태: `user_approved`

## 권한 매트릭스

| 시나리오 | 기대 결과 |
|---|---|
| 같은 법인·배정 호텔·기능권한 있음 | 허용 |
| 같은 법인·다른 호텔 | 존재·건수·검색결과·파일 모두 비노출 |
| 다른 법인 | 하드 차단 |
| 배정은 있으나 추가권한 없음 | 점검·이슈등록 기본범위만 허용 |
| 추가권한은 있으나 호텔배정 종료 | 즉시 차단 |
| 하우스키핑이 매출·문의·설정 API 호출 | 차단 |
| 호텔 소유주가 내부메모·감사원문 호출 | 필드 자체 비노출 |
| 거래처 임직원이 호텔 route/API 호출 | 초기 MVP에서 미노출·차단 |

## 통합 수용 시나리오

| ID | Given | When | Then |
|---|---|---|---|
| `HOT-E2E-001` | 준비중 호텔에 필수조건이 누락됨 | 활성화 요청 | 항목별 오류, 상태 불변, 감사 실패기록 |
| `HOT-E2E-002` | 필수조건 모두 충족 | 활성화 요청 | `ACTIVE`, DB 재조회 일치 |
| `HOT-E2E-003` | 호텔상태관리 권한 없음 | 운영중지 요청 | 403, 상태·업무자료 불변 |
| `HOT-E2E-004` | 유효한 상태관리자 | 사유·재인증과 함께 중지 | 신규점검·매출·문의 차단, 기존업무 보존 |
| `HOT-E2E-005` | 소유주 교체예약 | 전환시각 도래 | 기존 세션 차단, 신규 identity 연결, 과거 행위자 유지 |
| `HOT-E2E-006` | 운영중 객실 | 반복일정 실행 | 업무일당 점검 1건만 생성 |
| `HOT-E2E-007` | 담당자 배정종료 | 점검 자동생성 | 임의대체 없이 미배정·관리자 알림 |
| `HOT-E2E-008` | 참여자 계정 | 최종 완료 요청 | 403, 결과는 유지되나 완료되지 않음 |
| `HOT-E2E-009` | 완료책임자·중대 이상결과 | 점검 완료 | 점검·이슈·감사 원자 저장 |
| `HOT-E2E-010` | 이상항목 사진 없음 | 촬영불가 사유도 없이 저장 | 400 필드오류 |
| `HOT-E2E-011` | 확정매출 증빙 없음 | 확정 요청 | 차단, 상태 DRAFT 유지 |
| `HOT-E2E-012` | 확정·잠금 매출 | 일반 PATCH | 409, 정정 API 안내 |
| `HOT-E2E-013` | 정정권한·사유·근거 있음 | 정정 요청 | 원본 보존, 새 버전·감사 생성 |
| `HOT-E2E-014` | 문의 라우팅 미설정 | 소유주 문의등록 | 기본 운영문의함 저장, 유실 0건 |
| `HOT-E2E-015` | 답변완료 후 7일 무응답 | 자동종료 작업 | 종료·시스템행위자·감사 기록 |
| `HOT-E2E-016` | 파일 VIEW만 있음 | 다운로드 요청 | 차단·실패 접근로그 |
| `HOT-E2E-017` | 파일 DOWNLOAD와 호텔범위 있음 | 다운로드 요청 | 5분 이하 단기응답·성공로그 |
| `HOT-E2E-018` | 배정종료 뒤 기존 서명 URL 만료 | 새 URL 요청 | 차단 |
| `HOT-E2E-019` | 같은 멱등키·같은 요청 | 재시도 | 최초 결과 재응답, 중복자료 없음 |
| `HOT-E2E-020` | 같은 멱등키·다른 요청 | 재시도 | 409 `IDEMPOTENCY_CONFLICT` |
| `HOT-E2E-021` | 오래된 version | 저장 요청 | 409, 최신 DB 값 유지 |
| `HOT-E2E-022` | DB/R2 schema 미설정 | 저장 요청 | 명확한 503, 가짜 성공·부분자료 없음 |
| `HOT-E2E-023` | 긴급이슈 저장 성공·푸시 실패 | 알림 처리 | 이슈 유지, 인앱 알림·푸시 실패상태 기록 |
| `HOT-E2E-024` | 감염 또는 금지형식 파일 | 업로드 완료 | 부모자료 연결 금지·검역/차단·운영알림 |
| `HOT-E2E-025` | 회사 공통·자기 호텔 게시지식과 타 호텔 전용지식 존재 | 증상·태그 검색 | 허용 지식만 반환, 타 호텔 제목·건수·태그 비노출 |
| `HOT-E2E-026` | 초안 작성권한만 있는 사용자 | 게시 상태전이 직접호출 | 403, 초안·version 유지, 실패감사 |
| `HOT-E2E-027` | 고객 식별정보가 포함된 컴플레인 사례 | 검토·게시 요청 | 게시 차단, 안전한 필드오류, 원문 감사 미저장 |
| `HOT-E2E-028` | 재검토 예정일이 지난 게시지식 | 검색·상세 열람 | `NEEDS_REVIEW` 명시, 최신 권장정보처럼 표시하지 않음 |
| `HOT-E2E-029` | 사용자-facing 기능 page | 제목 옆 `?` 클릭·Enter·Space | 목적·사용법·권한·주의사항 표시, Escape 닫기·포커스 복귀 |
| `HOT-E2E-030` | 390px 모바일·스크린리더 | 기능 가이드 열람 | 44px 터치영역, 접근 가능한 이름, Sheet/Dialog 읽기순서 통과 |
| `HOT-E2E-031` | 기능 권한 없는 사용자 | 직접 route와 화면 접근 | 기능 제목·가이드·관련 링크 비노출, API도 차단 |
| `HOT-E2E-032` | 승인된 Preview 관리자 identity·organization·MFA 준비 | one-shot bootstrap 실행 및 같은 승인으로 재실행 | 최초 관리자 1명 연결, 동일 승인 멱등, 다른 subject 차단 |
| `HOT-E2E-033` | `USER_CREATE` 관리자 | 사내 임직원 계정 생성 | ZITADEL human 생성, DB 사용자·PRIMARY 호텔배정·감사 저장, 재조회 일치 |
| `HOT-E2E-034` | 동일 멱등키·동일 계정 payload·동일 임시 비밀번호 | 생성 요청 재시도 | exact subject·organization credential 검증과 verification session 삭제 뒤 같은 계정 결과, provider·DB 중복 생성 없음; 공식 invalid-password만 409 `IDEMPOTENCY_CONFLICT`, unknown 400·404·429 또는 cleanup 실패는 retryable 503 |
| `HOT-E2E-035` | provider 응답 지연 뒤 create lease takeover | 이전 owner가 늦게 완료 | stale generation 거부, 정상 identity 비활성화·보상 금지 |
| `HOT-E2E-036` | `PENDING_SETUP` 신규 사용자 | 임시 credential 로그인 | 최초 비밀번호 변경 화면만 허용, 일반 업무 API 차단 |
| `HOT-E2E-037` | 최초 비밀번호 변경 provider 성공 | 동일 payload 재시도·로그인 | provider 쓰기 반복 없이 DB `ACTIVE`, 새 session 발급, 임시 credential 거부 |
| `HOT-E2E-038` | `USER_READ`·`USER_CREATE`·`USER_SUSPEND`가 각각 없는 사용자 | 메뉴·버튼·직접 URL·API 접근 | 해당 기능 비노출 및 서버 403/404, 허용 기능은 유지 |
| `HOT-E2E-039` | 다른 회사의 사용자 ID | 상세·중지 직접 호출 | 존재·PII 비노출, 상태·session 불변 |
| `HOT-E2E-040` | 관리자 자기 자신 또는 마지막 활성 관리자 | 중지 요청 | 차단, 계정·session·권한 유지 |
| `HOT-E2E-041` | 일반 사용자 활성 session | 관리자가 계정 중지 | 로컬 상태 즉시 `INACTIVE`, 기존 session 회수, 신규 로그인 차단; exact outbox claim 뒤 provider `DEACTIVATED`/`NOT_FOUND`와 fenced `SUCCEEDED`가 확인된 뒤에만 2xx |
| `HOT-E2E-042` | 계정 중지 또는 생성 보상 immediate provider 시도 실패 | 동일키 재시도 또는 scheduled reconciler 실행 | 로컬 접근차단 유지, 2xx 금지, due `FAILED`/stale `PROCESSING` outbox claim·backoff 후 provider 비활성화와 `SUCCEEDED`/`COMPENSATED`로 수렴 |
| `HOT-E2E-043` | 390px 모바일·키보드 사용자 | 계정 목록·생성·상세·중지·비밀번호 변경 | 모바일 재배치, 오류 focus·label·44px 동작영역·중복 제출 차단 통과 |
| `HOT-E2E-044` | 만료되거나 존재하지 않는 ZITADEL Auth Request | custom login 시작 | `AUTH_FLOW_INVALID`, 재시도 불가, 서비스 장애 문구 대신 새 인증 요청 안내 |
| `HOT-E2E-045` | Preview 필수 configuration 여러 개 누락 | release preflight 실행 | 모든 누락 이름을 한 번에 비민감 출력하고 첫 mutation 전에 중단 |
| `HOT-E2E-046` | 정상 Console tuple과 호텔/Console 요소를 섞은 요청 | custom login 검증 | `${ZITADEL_ISSUER}/ui/console/auth/callback`·`email openid profile` 정상 tuple만 허용하고 client/callback/scope 혼합·중복 scope 거부 |
| `HOT-E2E-047` | instance 또는 organization 정책이 로그인 MFA 강제 | 비밀번호 custom login 시도 | `AUTH_MFA_REQUIRED`, callback 미발급, 생성된 provider session 정리; READY factor 등록만으로 MFA challenge 완료를 주장하지 않음 |
| `HOT-E2E-048` | provider `404`로 종료된 Auth Request | start route와 로그인 화면 처리 | `/login?error=invalid-flow`로 이동, 만료 안내와 새 로그인 시작 제공, 기존 auth request·CSRF 재사용 없음 |
| `HOT-E2E-049` | credential POST 중 만료된 Auth Request | provider `AUTH_FLOW_INVALID` 반환 | 정상 DB에서 exact transaction 삭제, binding cookie 만료, stale request 없는 `/login?error=invalid-flow` 이동; 삭제 오류·응답 유실에서도 다음 CSRF 전 provider 재검증 |
| `HOT-E2E-050` | deterministic provider create의 `409` 또는 응답 유실 | exact ID read-back | 같은 organization의 `ACTIVE` human이면 DB 생성을 계속하고, `404`·foreign organization·malformed 응답이면 성공으로 확정하지 않음 |
| `HOT-E2E-051` | provider create 성공 뒤 DB 완료가 `DUPLICATE`·`FORBIDDEN`이거나 완료 응답 실패 뒤 read-back이 미완료 `PROVIDER_CONFIRMED`를 증명 | API 보상 fast-path | exact attempt·provider subject·원래 비즈니스/retryable 내부 오류와 outbox를 먼저 commit하고 exact job claim 승자만 즉시 deactivate; 성공 marker와 `COMPENSATED`를 원자 저장한 뒤 원래 오류 반환, read-back 불가·provider `NOT_FOUND`·호출/marker 실패는 원래 오류나 2xx 없이 recovery/`COMPENSATION_REQUIRED` |
| `HOT-E2E-052` | API와 scheduled reconciler가 같은 중지/보상 outbox를 동시에 처리하거나 legacy 보상 payload에 exact linkage가 없음 | exact claim 경쟁·stale lease takeover·legacy migration | 정상 claim 승자 1개, stale token marker 거부, provider 성공 전 또는 fenced DB marker 전 2xx 없음; 일반 중지 `NOT_FOUND`는 멱등 성공, 생성 보상 `NOT_FOUND`는 `PROVIDER_NOT_VISIBLE` 실패; legacy active job·attempt는 EXPAND에서 우선 격리하되 이전 Worker writer를 차단하지 않고, 신규 Worker 배포·smoke 뒤 CONTRACT가 배포 창의 legacy row를 재격리하고 신규 active payload CHECK를 적용하며 attempt 대조를 통과해야 함 |
| `HOT-E2E-053` | 동일 생성 멱등키 replay, compensation 실패→재claim→성공, 계정 중지 replay, legacy trace 누락, 감사 INSERT 강제 실패가 발생 | 감사사건·outbox marker·session revoke·전체 audit row 조회 | `ACCOUNT_PROVISION_REQUESTED`, `ACCOUNT_CREATE_FAILED`, `ACCOUNT_COMPENSATION_FAILED`, `ACCOUNT_COMPENSATION_SUCCEEDED`, `ACCOUNT_SESSION_REVOKED`가 각 실제 transition과 같은 transaction에서 저장되고 stale marker·replay는 중복 없음; ambiguous recovery에는 terminal create failure 없음; 신규 요청은 최초 actor type·session·trace 유지, `ACCOUNT_CREATED`도 session 포함, legacy는 durable backfill 또는 stable attempt/outbox ID trace fallback; 복수 호텔은 `branch_id=null`+전체 정렬 `hotelIds`, revoked count 포함, reason은 안정 코드이며 password·token·전체 이메일·login ID·account ID와 구별되는 provider subject·provider body·자유문 사유의 고유 sentinel 값을 실제 입력·durable saga payload에 주입해 전체 감사행 어디에도 값이 없음을 검증; audit insert 실패 시 attempt·outbox·사용자·session 전이 rollback |
| `HOT-E2E-054` | protected Preview의 실제 Console client와 승인된 `previewadmin` credential | `/ui/console` 진입→custom login credential 제출→provider callback→authenticated user API | Console이 만든 exact Auth Request로 성공한 `/ui/console/auth/callback` 응답, 오류가 아닌 Console route, 인증이 필요한 `GetMyUser` 200 응답, Console OIDC token의 issuer·audience·subject·expiry 일치를 모두 확인하고 terminal 호텔 browser-binding cookie가 삭제됨; password·authRequest·CSRF·callback query·user response는 출력하지 않으며 실패 시 CONTRACT 미실행 |

## 비밀번호 정책 수용 시나리오

경계별 실패 원인을 독립적으로 증명하기 위해 다음 fixture를 사용한다. 각 fixture는 신규 설정·재설정·변경 경로에서 각각 별도로 실행하며 한 경로의 결과로 다른 경로를 갈음하지 않는다.

| Fixture | 고정 조건 |
|---|---|
| `PW-7` | 정확히 7 Unicode 코드 포인트, ASCII 소문자·숫자·Unicode 구두점/기호 포함, 대문자 없음 |
| `PW-8` | 정확히 8 Unicode 코드 포인트, ASCII 소문자·숫자·supplementary-plane Unicode 기호 포함, 대문자 없음 |
| `PW-8-PUNCT` | 정확히 8 Unicode 코드 포인트, ASCII 소문자·숫자·Unicode 구두점 포함, Unicode 기호·대문자 없음 |
| `PW-NO-LOWER` | 정확히 8 Unicode 코드 포인트, ASCII 대문자·숫자·Unicode 구두점/기호 포함, 소문자 없음 |
| `PW-NO-NUMBER` | 정확히 8 Unicode 코드 포인트, ASCII 소문자·Unicode 구두점/기호 포함, 숫자·대문자 없음 |
| `PW-NO-PUNCT-OR-SYMBOL` | 정확히 8 Unicode 코드 포인트, ASCII 소문자·숫자만 포함, Unicode 구두점/기호·대문자 없음 |
| `PW-200` | 정확히 200 Unicode 코드 포인트, ASCII 소문자·숫자·supplementary-plane Unicode 기호 포함, 대문자 없음 |
| `PW-201` | 정확히 201 Unicode 코드 포인트, ASCII 소문자·숫자·Unicode 구두점/기호 포함, 대문자 없음 |

| ID | Given | When | Then |
|---|---|---|---|
| `HOT-AUTH-PW-001` | `PW-7` | 신규 설정 요청 | 길이 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-002` | `PW-7` | 재설정 요청 | 길이 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-003` | `PW-7` | 변경 요청 | 길이 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-004` | `PW-8` | 신규 설정 요청 | 대문자 없이 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-005` | `PW-8` | 재설정 요청 | 대문자 없이 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-006` | `PW-8` | 변경 요청 | 대문자 없이 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-007` | `PW-NO-LOWER` | 신규 설정 요청 | 소문자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-008` | `PW-NO-LOWER` | 재설정 요청 | 소문자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-009` | `PW-NO-LOWER` | 변경 요청 | 소문자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-010` | `PW-201` | 신규 설정 요청 | 상한 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-011` | `PW-201` | 재설정 요청 | 상한 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-012` | `PW-201` | 변경 요청 | 상한 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-013` | `PW-200` | 신규 설정 요청 | 상한 경계의 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-014` | `PW-200` | 재설정 요청 | 상한 경계의 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-015` | `PW-200` | 변경 요청 | 상한 경계의 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-016` | `PW-NO-NUMBER` | 신규 설정 요청 | 숫자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-017` | `PW-NO-NUMBER` | 재설정 요청 | 숫자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-018` | `PW-NO-NUMBER` | 변경 요청 | 숫자 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-019` | `PW-NO-PUNCT-OR-SYMBOL` | 신규 설정 요청 | 구두점/기호 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-020` | `PW-NO-PUNCT-OR-SYMBOL` | 재설정 요청 | 구두점/기호 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-021` | `PW-NO-PUNCT-OR-SYMBOL` | 변경 요청 | 구두점/기호 정책으로 거부, provider 호출·변경 및 기존 credential 상태 변경 없음 |
| `HOT-AUTH-PW-022` | 정책 변경 전에 설정된 기존 비밀번호가 있음 | 정책 배포 | 강제 초기화·즉시 만료 없이 유지되고 다음 설정·재설정·변경부터 새 정책 적용 |
| `HOT-AUTH-PW-023` | 유효한 정책 fixture와 provider 성공 | 비밀번호 작업 완료 | DB·감사·로그·오류·복구 payload에 비밀번호 원문·hash·digest 없음 |
| `HOT-AUTH-PW-024` | 정책 위반 fixture | 비밀번호 작업 거절 | DB·감사·로그·오류·복구 payload에 비밀번호 원문·hash·digest 없음 |
| `HOT-AUTH-PW-025` | 유효한 정책 fixture와 provider 안전 실패 | 비밀번호 작업 실패 | DB·감사·로그·오류·복구 payload에 비밀번호 원문·hash·digest 없음 |
| `HOT-AUTH-PW-026` | `PW-8-PUNCT` | 신규 설정 요청 | Unicode 기호 없이 구두점 분기로 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-027` | `PW-8-PUNCT` | 재설정 요청 | Unicode 기호 없이 구두점 분기로 공통 정책 검증 통과, provider 성공 시에만 완료 |
| `HOT-AUTH-PW-028` | `PW-8-PUNCT` | 변경 요청 | Unicode 기호 없이 구두점 분기로 공통 정책 검증 통과, provider 성공 시에만 완료 |

## DB 검증

- 생성 응답 ID로 상세 SELECT/API 재조회.
- 타 `company_id`·`branch_id` FK 삽입 실패.
- 소유주 1:1 partial unique 위반 실패.
- 객실번호·점검 자동생성·일매출 중복 unique 위반 실패.
- transaction 중간실패 시 업무자료·감사·첨부참조 모두 rollback.
- 과거 version·상태이력·원행위자 보존.
- 지식 게시 version과 검토대상 version 불일치 시 전이 실패.
- 회사·호텔 지식 검색의 RLS와 application predicate 이중 격리.

## Preview 완료 게이트

1. 새 호텔 제품 migration `0001` 이상 적용.
2. focused unit/API/permission test 통과.
3. 전체 `pnpm check` 통과.
4. Cloudflare Web build 통과.
5. Preview DB/R2 실제 mutation·재조회·정리.
6. 사용자유형별 로그인 E2E.
7. 타 법인·타 호텔·직접 API 권한우회 회귀.
8. PR/CI/merge/deploy/live smoke는 PRD 승인 후 별도 오케스트레이션 범위로 진행.
9. 모든 사용자-facing route와 typed feature-guide registry의 누락·중복·빈 콘텐츠 검사.
