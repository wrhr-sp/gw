# 호텔관리 API·데이터 계약 승인본

> 상태: `user_approved`<br>
> 성격: 구현 전 shared contract·migration 상세화 기준

## 공통 API 계약

- 모든 경로는 same-origin `/api/*`이고 `packages/contracts`에 Zod 요청·응답 schema와 route 정본을 먼저 정의한다.
- 모든 변경 요청은 `Idempotency-Key`가 필수다.
- 변경 가능한 자료는 요청 body의 `version` 또는 `If-Match`로 현재 버전을 전달한다.
- 목록은 `page`, `pageSize` 기본 20·최대 100, 정렬·필터를 서버에서 처리한다.
- 성공 후 반환 ID로 DB 상세를 재조회한 값을 응답한다.
- 타 법인·타 호텔 자료는 존재 여부가 드러나지 않도록 안전한 403/404 정책을 일관되게 적용한다.

## 공통 오류코드

| 코드 | HTTP | 의미 |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | 필드 검증 실패 |
| `AUTHENTICATION_REQUIRED` | 401 | 인증 없음·만료 |
| `FORBIDDEN` | 403 | 기능권한·범위 없음 |
| `RESOURCE_NOT_FOUND` | 404 | 없거나 비노출 대상 |
| `VERSION_CONFLICT` | 409 | 오래된 version |
| `IDEMPOTENCY_CONFLICT` | 409 | 같은 키에 다른 요청 |
| `INVALID_STATE_TRANSITION` | 409 | 허용되지 않은 상태전이 |
| `DB_NOT_CONFIGURED` | 503 | DB 미설정 |
| `SCHEMA_NOT_READY` | 503 | migration/schema 불일치 |
| `FILE_STORAGE_NOT_CONFIGURED` | 503 | R2 미설정 |
| `INTERNAL_ERROR` | 500 | 안전하게 축약된 서버 오류 |

## 주요 API

| 영역 | 메서드·경로 | 요청 핵심 | 응답 핵심 | 기능권한 |
|---|---|---|---|---|
| 호텔 | `POST /api/hotels` | 기본정보 | 준비중 호텔 재조회 | `HOTEL_MANAGE` |
| 호텔 | `POST /api/hotels/:id/activate` | version | 준비조건·활성상태 | `HOTEL_MANAGE` |
| 호텔 | `POST /api/hotels/:id/suspend` | version·사유·효력일·재인증증명 | 영향건수·중지상태 | `HOTEL_STATUS_MANAGE` |
| 호텔 | `POST /api/hotels/:id/reactivate` | version·사유·재인증증명 | 준비조건·운영상태 | `HOTEL_STATUS_MANAGE` |
| 배정 | `POST /api/hotels/:id/staff-assignments` | userId·종류·기간·사유 | 배정 재조회 | `HOTEL_ASSIGNMENT_MANAGE` |
| 배정 | `POST /api/hotels/:id/housekeeping-links` | userId·기간 | 연결 재조회 | `HOTEL_ASSIGNMENT_MANAGE` |
| 소유주 | `POST /api/hotels/:id/owner-transfer` | 기존/신규 userId·전환시각·사유·재인증 | 활성 연결·종료 연결 | `HOTEL_OWNER_MANAGE` |
| 최고관리자 | `POST /api/admin/super-admins/initialize` | bootstrap 운영자·두 번째 활성 사내 임직원·재인증·승인참조·version | 정확히 두 명·초기화 감사 재조회 | 제한된 one-shot 초기화 authority |
| 객실 | `POST /api/hotels/:id/rooms` | 객실번호·층그룹·호텔별 객실유형 | 객실 재조회 | DB 동적 객실관리권한 |
| 객실 | `PATCH /api/hotels/:id/rooms/:roomId` | version·객실번호·층·객실유형·메모 | 객실 재조회; `DELETED`는 안전 차단 | DB 동적 객실관리권한 |
| 객실 | `POST /api/hotels/:id/rooms/:roomId/status` | `Idempotency-Key`·version·`ACTIVE\|INACTIVE`·변경사유 | 상태·version·append-only history·감사 재조회 | DB 동적 객실관리권한 |
| 객실 | `POST /api/hotels/:id/rooms/:roomId/delete` | `Idempotency-Key`·version·삭제사유 | `DELETED` 객실·append-only history·감사 재조회 | DB 동적 객실관리권한; 현재 `INACTIVE`만 허용 |
| 시설물 | `POST /api/hotels/:id/facilities` | 유형·시설물명·`{ type: "ROOM", roomId } \| { type: "COMMON_AREA", commonAreaId }` 위치 | 시설물 재조회 | DB 동적 시설물관리권한 |
| 점검항목 | `POST /api/hotels/:id/inspection-items` | 대상유형 `ROOM\|FACILITY`·공통항목·객실/시설물유형별 제외/추가·version | 대상유형별 새 revision | DB 동적 항목설정권한 |
| 루틴 | `POST /api/hotels/:id/inspection-routines` | 대상범위·회차·반복·기한 | 루틴 revision 재조회 | DB 동적 루틴관리권한 |
| 점검 | `POST /api/hotels/:id/inspections` | 대상·유효항목·수시점검 | process·대상·항목 snapshot | DB 동적 점검등록권한 |
| 점검 | `PATCH /api/hotels/:id/inspections/:inspectionId/results` | version·정상/주의/이상·설명·첨부 | 결과·실제 수행자 재조회 | DB 동적 점검수행권한 |
| 점검 | `POST /api/hotels/:id/inspections/:inspectionId/transitions` | version·단계처리·사유 | process 실행·다음 단계 | 현재 단계 처리권한 |
| 보수 | `POST /api/hotels/:id/repairs` | 출처·대상 하나·우선순위·하자증빙·선택 `followUpOfRepairCaseId`; 지정 시 `followUpParentVersion` 필수 | 보수·process snapshot과 권한 허용 시 즉시 이전 summary | DB 동적 보수등록권한 + parent 자료권한 |
| 보수 | `GET /api/hotels/:id/repairs/:repairId` | — | 보수 snapshot, 권한 허용 시 즉시 이전 summary와 권한필터된 즉시 후속 건수; 미허용 관계 존재·번호·건수 미포함 | DB 동적 보수자료조회권한 |
| 보수 | `GET /api/hotels/:id/repairs/:repairId/follow-ups` | `page`·`pageSize` | 권한필터된 즉시 후속 summary 페이지·권한필터된 total; 전체 체인 재귀응답과 미허용 건수 없음 | DB 동적 보수자료조회권한 |
| 방문일정 | `POST /api/hotels/:id/repair-visits` | `Idempotency-Key`·보수 건·일정명·시작/종료·수행자/업체 | 일정·Calendar projection 상태 재조회 | DB 동적 일정생성권한 |
| 방문일정 | `PATCH /api/hotels/:id/repair-visits/:visitId` | version·변경필드·사유 | 일정·새 source version·`NOT_CONNECTED\|PENDING\|SYNCED\|ACTION_REQUIRED` projection 상태 | DB 동적 일정변경권한 |
| 방문일정 | `POST /api/hotels/:id/repair-visits/:visitId/cancel` | version·사유 | 취소 일정·append-only history·projection 상태 | DB 동적 일정변경권한 |
| 방문일정 | `POST /api/hotels/:id/repair-visits/:visitId/restore` | version·사유 | 복구 일정·append-only history·projection 상태 | DB 동적 일정변경권한 |
| 방문일정 | `POST /api/hotels/:id/repair-visits/:visitId/delete` | version·사유 | 논리삭제 일정·append-only history·projection 상태 | DB 동적 일정삭제권한 |
| Calendar | `POST /api/admin/calendar-connections/oauth/start` | 중요작업 재인증·안전한 return path·기존 연결이면 expected connection version | 10분 만료 state hash·PKCE·browser binding과 Google authorization URL; 승인된 2개 scope exact set·`include_granted_scopes=false` | DB 동적 Calendar 연동설정권한 + 회사범위, 기존 연결이면 영향호텔 전체권한 |
| Calendar | `GET /api/admin/calendar-connections/oauth/callback` | exact-one non-empty `state` + (`code` xor provider `error`), duplicate·empty·혼합 금지 | 외부 fetch 전 single-use claim, server-side 교환·scope/refresh token 검증, first credential 활성화 또는 candidate 저장 뒤 cookie 삭제·query 없는 안전한 admin 경로로 303; 일반 변경 API 멱등키 예외는 one-time claim이 대체 | 최초 요청 actor·활성 session·재인증·현재 권한·최초 start의 회사/영향호텔 범위 |
| Calendar | `GET /api/admin/calendar-connections` | `page`·`pageSize` | 회사 연결과 권한 있는 호텔 link·안전상태·fingerprint만, token·provider ID 없음 | DB 동적 Calendar 연동설정권한 |
| Calendar | `POST /api/admin/calendar-connections/:connectionId/credential-candidates/:credentialId/promote` | connection/candidate version·사유·중요작업 재인증 | `ACCESS_VERIFIED` candidate 승격·기존 hotel link 유지 재조회 | DB 동적 Calendar 연동설정권한 + 회사범위·영향호텔 전체권한 |
| Calendar | `POST /api/admin/calendar-connections/:connectionId/credential-candidates/:credentialId/confirm-switch` | connection/candidate version·사유·중요작업 재인증 | candidate 승격·기존 link generation 중지·호텔별 calendar resource job 재조회 | DB 동적 Calendar 연동설정권한 + 회사범위·영향호텔 전체권한 |
| Calendar | `POST /api/admin/calendar-connections/:connectionId/hotel-calendars` | branchId·connection version·중요작업 재인증 | 호텔별 `PENDING_CREATE` link와 calendar resource projection job 재조회; 요청 thread provider 호출 없음 | DB 동적 Calendar 연동설정권한 + 현재 호텔범위 |
| Calendar | `POST /api/admin/calendar-connections/:connectionId/hotel-calendars/:branchId/disconnect` | link·connection version·사유·중요작업 재인증 | 호텔 link 중지·신규 projection 차단 재조회; provider calendar 자동삭제 없음 | DB 동적 Calendar 연동설정권한 + 현재 호텔범위 |
| Calendar | `POST /api/admin/calendar-connections/:connectionId/disconnect` | version·사유·중요작업 재인증 | 연결 중지·credential 폐기상태·영향 호텔수 재조회; provider calendar 자동삭제 없음 | DB 동적 Calendar 연동설정권한 + 회사범위·영향호텔 전체권한 |
| Calendar | `GET /api/admin/calendar-sync-failures` | `page`·`pageSize`·허용 호텔 filter | 권한필터된 안전 오류·마지막시도·시도수·조치상태, credential·provider ID 없음 | DB 동적 Calendar 연동설정권한 + 현재 호텔범위 |
| Calendar | `POST /api/admin/calendar-sync-failures/:failureId/retry` | version·사유·중요작업 재인증 | 최신 일정·연결·권한 재검증 후 새 projection job 재조회 | DB 동적 Calendar 연동설정권한 + 현재 호텔범위 |
| 이슈 | `POST /api/hotels/:id/issues` | 객실·등급·내용·첨부 | 접수 이슈 | 유효배정 + 현재 DB 동적 이슈등록권한 |
| 이슈 | `POST /api/hotels/:id/issues/:issueId/transitions` | version·전이·사유 | 상태이력 포함 이슈 | 현재 DB 동적 상태처리권한 + 담당·자료상태 조건 |
| 매출 | `POST /api/hotels/:id/daily-sales` | 업무일·내역·금액·증빙 | 임시저장 재조회 | `HOTEL_SALES_MANAGE` |
| 매출 | `POST /api/hotels/:id/daily-sales/:salesId/confirm` | version | 확정·잠금 | `HOTEL_SALES_CONFIRM` |
| 매출 | `POST /api/hotels/:id/daily-sales/:salesId/corrections` | version·사유·근거·새값 | 정정버전 | `HOTEL_SALES_CORRECT` |
| 문의 | `POST /api/hotels/:id/inquiries` | 유형·제목·내용·첨부 | 라우팅된 문의 | 활성 호텔 소유주 |
| 문의 | `POST /api/hotels/:id/inquiries/:inquiryId/transitions` | version·전이·메시지 | 상태·메시지 재조회 | 상태별 권한 |
| 파일 | `POST /api/hotel-files/upload-init` | 호텔·부모종류·파일명·크기·MIME | 업로드 세션 | 자료 쓰기권한 |
| 파일 | `POST /api/hotel-files/:fileId/upload-complete` | 검증값·부모 version | 검역상태 | 생성자 일치 + 현재 session·회사·호텔배정·기능권한·개인회수·부모상태 재검증 |
| 파일 | `POST /api/hotel-files/:fileId/view` | 부모자료 ID | 단기보기 URL/stream | 설정된 VIEW |
| 파일 | `POST /api/hotel-files/:fileId/download` | 부모자료 ID | 단기 다운로드 | 설정된 DOWNLOAD |

객실 생성·정보수정·상태변경·삭제 route는 요청 cookie의 고엔트로피 opaque session token을 해당 mutation 동안만 PostgreSQL command에 전달한다. command는 원문을 즉시 SHA-256 해시해 활성 session의 저장 hash와 비교하고 최신 유효 호텔배정·개인 DENY 우선 기능권한·version·멱등·감사를 같은 transaction에서 닫는다. 회사 전체 `ALLOW`도 호텔배정을 대체하지 않는다. API runtime에는 `hotel_rooms` 직접 `INSERT/UPDATE` 권한을 주지 않고 생성·정보수정 command와 상태·삭제 command의 exact `EXECUTE`만 허용한다. token 원문은 DB·감사·멱등 snapshot·응답·로그에 저장하거나 반환하지 않으며 session ID나 저장 hash만으로 command authority를 증명하지 않는다.

## 정본 데이터모델

- 호텔 지점 정본: `branches`.
- 호텔 전용정보: `hotel_profiles(branch_id PK/FK)`.
- 모든 호텔 하위 테이블은 `company_id`와 `branch_id`를 함께 가진다.
- 독립 `hotels` 정본 테이블을 추가하지 않는다.

## 핵심 DB 제약

| 대상 | 제약 |
|---|---|
| 호텔 | `(company_id, branch_id)` unique·FK, `branch_type='HOTEL'` |
| 소유주 | 호텔당 활성 연결 1개 partial unique, 계정당 활성 호텔 1개 partial unique |
| 객실 | 앞뒤 ASCII space를 제거한 뒤 `[A-Z0-9][A-Z0-9._/-]{0,39}`로 제한하고 ASCII 대문자로 저장; `(company_id, branch_id, room_number) WHERE status <> 'DELETED'` partial unique; CONTRACT preflight는 비호환 legacy 값과 `upper(btrim(room_number))` 충돌을 안정 진단으로 mutation 전에 차단하고 승인된 별도 정리 후 재실행; `ACTIVE/INACTIVE/DELETED`; 현재 목록은 `DELETED` 제외, 물리삭제 금지, `DELETED` 핵심정보·복구 DB trigger 차단, 삭제 후 같은 번호는 새 내부 ID로만 재사용 |
| 공용공간 | `(company_id, branch_id, id)` unique parent key, `normalized_name=lower(btrim(name))` stored generated column, `(company_id, branch_id, normalized_name)` unique, `ACTIVE/INACTIVE/DELETED`, 물리삭제 금지 |
| 시설물유형 | `(company_id, branch_id, id)` unique parent key, `normalized_name=lower(btrim(name))` stored generated column, `(company_id, branch_id, normalized_name)` unique를 `ACTIVE/INACTIVE/DELETED` 전체 lifecycle에 적용하고 `DELETED` 이름을 불변으로 유지해 삭제 후 이름 재사용 금지, 연결 시설물이 있으면 삭제 command 차단 |
| 시설물 | `(company_id, branch_id, id)` unique parent key, `normalized_name=lower(btrim(name))` stored generated column과 같은 호텔 시설물유형 composite FK; `ROOM`은 `room_id`만, `COMMON_AREA`는 `common_area_id`만 존재하는 명시적 행 CHECK와 각 위치 composite FK; `(company_id, branch_id, facility_type_id, room_id, normalized_name) WHERE location_type='ROOM'`과 `(company_id, branch_id, facility_type_id, common_area_id, normalized_name) WHERE location_type='COMMON_AREA'` partial unique |
| 위치·유형 lifecycle | 시설물 slice 활성화 이후 모든 command가 후보 참조를 읽은 뒤 `시설물유형 UUID → 기존·새 위치 (location_type, UUID) → 시설물 UUID` 전역순서로 잠그고 참조·version을 재조회하며 변경 시 conflict/retry; 활성 시설물이 연결된 위치의 사용중지·삭제와 시설물이 연결된 유형 삭제 차단, 이동은 같은 호텔 활성 위치만 허용. 이 관계 gate는 시설물 후속 release 전까지 구현 완료로 간주하지 않음 |
| 배정 | 시작일 < 종료일, 같은 배정의 중복기간 방지 |
| 점검 자동생성 | `execution_source='SCHEDULED'`이면 `routine_revision_id`·`business_date`·`occurrence_key` 모두 non-null인 행 CHECK; `(company_id, branch_id, routine_revision_id, business_date, occurrence_key) WHERE execution_source='SCHEDULED'` partial unique로 같은 회차의 실행 aggregate 중복차단 |
| 점검 실행대상 | `(company_id, branch_id, execution_id)`가 같은 tenant 실행 aggregate를 참조하는 composite FK; `ROOM`은 `room_id`만, `FACILITY`는 `facility_id`만 존재하는 행 CHECK·호텔 포함 대상 composite FK; `(company_id, branch_id, execution_id, room_id)`와 `(company_id, branch_id, execution_id, facility_id)` 유형별 partial unique |
| process 단계 | 현재 단계 주 검토자 1명, 선택 대리인 1명, 선착순 version 처리 |
| 보수 정본 | `hotel_repair_priorities`, `hotel_repair_cases`, `hotel_repair_visits`는 child composite FK용 `(company_id, branch_id, id)` unique parent key 제공; `hotel_repair_case_history(company_id, branch_id, repair_case_id)`→case, `hotel_repair_visits(company_id, branch_id, repair_case_id)`→case, `hotel_repair_visit_performers(company_id, branch_id, repair_visit_id)`→visit, `hotel_repair_visit_history(company_id, branch_id, repair_visit_id)`→visit composite FK; current row와 append-only history를 command transaction에서 원자 기록, 업무 정본의 JSONB-only 저장 금지 |
| 보수 source | `INSPECTION`은 case typed target과 동일한 inspection 실행대상·항목·결과 composite FK와 생성 당시 설명·사진 snapshot, `DIRECT`는 inspection 참조 없이 설명과 사진 또는 촬영불가 사유; 명시적 행 CHECK로 두 분기 외 조합과 inspection source/repair target 불일치 차단 |
| 보수대상 | `ROOM`은 `room_id`만, `COMMON_AREA`는 `common_area_id`만, `FACILITY`는 `facility_id`만 존재하는 명시적 null-safe 행 CHECK와 각 `(company_id, branch_id, typed_id)` composite FK; 생성 당시 대상 snapshot 보존 |
| 보수 우선순위·process | `hotel_repair_priorities.normalized_name=lower(btrim(name))` stored generated column과 `(company_id, branch_id, normalized_name)` unique를 `ACTIVE/INACTIVE/DELETED` 전체 lifecycle에 적용; 물리삭제와 `DELETED` 이름변경을 금지해 삭제 후 이름 재사용 차단, 다른 호텔 동일 이름 허용; 활성 호텔별 우선순위 composite FK와 ID·version·이름·정렬·색상 snapshot, 생성 당시 process execution composite FK; 설정 변경은 기존 snapshot에 소급하지 않음 |
| 방문일정 | 보수 건 하나에 composite FK로 연결된 독립 `hotel_repair_visits` 여러 행, 각 `version`; `hotel_repair_visit_performers(company_id, branch_id, repair_visit_id)` unique로 최대 한 행을 강제하고 visit·performer 양쪽 INSERT·UPDATE·DELETE를 감시하는 deferred constraint trigger가 commit 시 활성 visit당 정확히 한 행을 강제; `INTERNAL`은 같은 tenant 사내 임직원 사용자 FK만, `EXTERNAL`은 `contractor_name` 필수·`contact_name` 선택·`contact_phone` 필수 snapshot만 갖는 null-safe CHECK; visit·performer 원자생성, 교체는 visit expected version·사유·history, 완료 후 변경 금지; email·주소·사업자번호·계정·계약·견적·청구 필드와 추가 참여자 금지, 내부 활성·호텔배정·보수권한 command 재검증, 일정중복 시스템 미관여 |
| 외부업체 연락처 | `REPAIR_EXTERNAL_CONTACT_VIEW` 동적권한이 있으면 업체명·담당자명·연락처 원문, 없으면 업체명·마스킹 연락처만 반환; 목록·상세·직접 API·history에 동일 적용하고 타 호텔 차단; 원문은 로그·오류·감사요약·검색색인·Calendar payload에 미포함 |
| 보수 완료 | case·process expected version과 권한·필수 결과·검역통과 증빙을 transaction에서 재검증하고 최종완료 뒤 case·visit·수행자·증빙 핵심필드 mutation 차단; 후속 작업은 완료 건 수정이 아닌 새 보수 건 |
| 후속 보수 | 새 case의 nullable `follow_up_of_repair_case_id`가 `(company_id, branch_id, id)`로 직전 case를 composite FK 참조; 승인 command가 parent를 잠그고 최종완료·같은 typed target·version을 재검증하고 relation INSERT·UPDATE를 감시하는 deferred constraint trigger가 commit 시 동일조건·자기참조·순환·관계불변을 강제; source는 `DIRECT` 필수자료를 새로 저장하고 parent 자료를 복제하지 않음; 즉시 이전과 역방향 후속목록은 각 case 자료권한으로 필터해 미허용 존재·번호·건수 비노출 |
| Calendar 연결 | 회사범위 `calendar_connections`와 `(company_id, connection_id)` composite FK의 `calendar_connection_credentials`를 분리하고 발급된 token provenance·credential version은 불변, lifecycle·암호화 envelope는 expected row version·append-only history로 변경하며 active·candidate 각각 최대 하나를 partial unique로 강제; raw access/refresh token 열 금지, account identity 대신 기존 encrypted calendar ID 접근능력으로 candidate 검증, account switch는 명시적 confirm command만 허용 |
| Calendar 호텔 link | `calendar_hotel_links`는 `(company_id, branch_id)`→호텔, `(company_id, connection_id)`→connection composite FK·호텔/용도별 active generation unique·encrypted provider calendar ID·상태/version/catch-up cutoff를 갖고 타 호텔 fallback 금지; generation 생성 transaction에서 CSPRNG 256-bit를 base64url no-padding 43자로 만든 provider lookup key의 AES-GCM ciphertext/IV/key version과 SHA-256 digest를 저장하고 digest global unique·generation/key material/digest 불변을 DB로 강제하며, 승인 key rotation만 plaintext+digest 보존 재암호화 허용; raw key·digest는 일반 API·로그·감사·metrics에 비노출; `calendar_catch_up_items`는 hotel link·visit tenant composite FK와 generation/source version unique로 활성화 snapshot 중복을 차단 |
| Calendar event link | `calendar_event_links(company_id, branch_id, hotel_link_id, visit_id)`는 hotel link와 visit을 각각 tenant 포함 composite FK 참조하고 link generation·stable base32hex provider event ID·desired/applied source version을 구조화 저장; 다른 호텔 parent 연결은 직접 SQL에서도 차단 |
| Calendar projection | `calendar_projection_jobs`는 `HOTEL_CALENDAR\|VISIT_EVENT` typed target 중 정확히 하나를 tenant composite FK 참조하고 aggregate당 claimable head 하나·desired/attempted source/connection version·claim token·lease·replay flag·attempt/backoff·`SUPERSEDED/DEAD_LETTER`를 갖는 transactional outbox; `calendar_projection_attempts`와 `calendar_sync_failures`는 `(company_id, branch_id, job_id)` 및 즉시 link parent를 composite FK 참조; JSONB는 비민감 dispatch metadata만 허용 |
| Calendar credential | OAuth client ID·secret, versioned AES-GCM keyring, 별도 versioned fingerprint HMAC keyring은 Worker secret; credential AAD는 purpose/company/connection/credential version, provider calendar ID AAD는 immutable purpose/company/branch/link generation, provider lookup key AAD는 `calendar_lookup_key\|company_id\|branch_id\|hotel_link_id\|generation`을 포함하고 각 random 96-bit nonce로 암호화; access token은 호출 메모리에서만 사용; 승인 scope는 `https://www.googleapis.com/auth/calendar.app.created`와 `https://www.googleapis.com/auth/calendar.calendarlist.readonly`의 순서무관 exact set이며 누락·추가·다른 scope는 안전 실패 |
| Calendar resource read-back | `calendarList.list`는 `maxResults=250`·`fields=nextPageToken,items(id,description)`로 최대 40 page/10,000 item까지 반복; envelope object의 `items` 부재/빈 array는 정상 0건, item은 strict object·non-empty string `id` 필수·`description`은 optional string이며 부재/빈 값은 non-match, 잘못된 타입·unknown field·empty/repeated page token·상한초과는 provider insert 없이 `ACTION_REQUIRED`; generation row에서 같은 raw lookup key를 복호화해 expected `werehere-link:v1:<43-char-key>`와 description 전체 일치한 item만 메모리에서 사용하고 불일치 item·page token은 DB·로그·오류·감사·metrics·API 응답에 저장하지 않음; 일치 1건이면 URL-encoded list ID로 `calendars.get?fields=id,description`을 호출해 strict non-empty string `id`가 list ID와 같고 string `description`이 expected와 전체 일치할 때만 ID를 암호화 저장, malformed·mismatch·404는 provider ID 미저장·`ACTION_REQUIRED`; 0건은 최초 insert 전만 허용, 2건 이상 또는 비결정 insert 뒤 0건은 자동 insert 없이 관리자조치 |
| 보수 DB 권한 | migration owner만 FK·UNIQUE를 생성하고 runtime·reconciler role에는 table owner·superuser·`BYPASSRLS`·DDL·직접 `REFERENCES` 권한을 주지 않음; 승인 command `EXECUTE`와 허용 read만 부여하고 composite FK 오류로 타 tenant parent 존재여부를 구분할 수 없는 안정 오류 사용 |
| 최고관리자 | 회사별 활성 최고관리자 정확히 2명, 교체 transaction |
| 매출 | `(company_id, branch_id, business_date)` 또는 합의한 집계키 unique |
| 파일 | 부모참조는 같은 `company_id·branch_id`, 검역통과 파일만 연결 |
| version | 변경 가능한 모든 정본자료에 1 이상 정수 |
| 사건시각 | UTC `timestamptz`, 업무일 `DATE` |

PostgreSQL에서 기간중복을 직접 막기 어려운 관계는 transaction 안의 잠금·재검사와 DB index를 함께 사용한다.

## 내부 상태코드

| 도메인 | 코드 |
|---|---|
| 호텔 | `PREPARING`, `ACTIVE`, `SUSPENDED` |
| 객실·시설물 기준정보 | `ACTIVE`, `INACTIVE`, `DELETED`; 신규 업무대상 포함 여부만 의미. 객실 일반 전이는 `ACTIVE↔INACTIVE`, 별도 삭제 command는 `INACTIVE→DELETED`, `DELETED`는 terminal |
| 점검결과 | `NORMAL`, `CAUTION`, `ABNORMAL` |
| 점검 실행 | 생성 당시 process revision의 현재 단계·지연·최종완료·미완료종료 |
| 방문일정 | 예정·진행·완료·취소·삭제 감사 snapshot |
| Calendar projection | `NOT_CONNECTED`, `PENDING`, `SYNCED`, `ACTION_REQUIRED`; job 내부상태 `PENDING`, `PROCESSING`, `SUCCEEDED`, `SUPERSEDED`, `DEAD_LETTER` |
| 매출 | `DRAFT`, `CONFIRMED`, `LOCKED`, `CORRECTED` |
| 이슈 | `RECEIVED`, `ASSIGNED`, `IN_PROGRESS`, `ACTION_COMPLETED`, `CLOSED`, `ON_HOLD`, `CANCELLED` |
| 문의 | `RECEIVED`, `ASSIGNED`, `ANSWERING`, `ANSWERED`, `CLOSED` |
| 파일 | `PENDING_UPLOAD`, `QUARANTINED`, `READY`, `REJECTED`, `EXPIRED` |

## transaction 경계

- 점검 단계처리 + process history + 감사로그는 단일 transaction이다.
- 최초 최고관리자 설정은 bootstrap 운영자와 선택한 다른 활성 사내 임직원 한 명을 `0명 → 2명`으로 원자 지정하고 초기화 authority 폐기·감사·멱등결과를 같은 transaction에서 확정한다.
- process 판단으로 보수 건을 만들 때 원본 점검·대상·항목·결과·증빙 snapshot과 보수 process를 단일 transaction으로 연결한다.
- 방문일정 생성·변경·취소·복구·논리삭제는 current row·append-only history·감사·stable provider event link·단조증가 source version의 aggregate-head Calendar projection signal을 단일 transaction으로 기록한다. 연결이 없으면 provider job을 만들지 않고 명시적 `NOT_CONNECTED` 상태로 재조회하며 provider 장애는 일정 transaction을 실패시키지 않고 `PENDING/ACTION_REQUIRED`로 분리한다. 연결 fallback·가짜 provider 성공·물리삭제는 없다.
- 매출 확정 + 잠금 + 증빙참조 + 감사로그는 단일 transaction.
- 소유주 교체는 기존 연결종료 + 신규연결 + 세션회수 요청상태 + 감사를 원자적으로 기록한다.
- R2·푸시 같은 외부작업은 DB transaction 밖에서 상태·재시도·보상으로 처리한다.
