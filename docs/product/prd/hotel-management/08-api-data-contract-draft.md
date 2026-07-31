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
| 객실 | `PATCH /api/hotels/:id/rooms/:roomId` | version·기준정보 상태·변경사유 | 객실·영향 시설물 재조회 | DB 동적 객실관리권한 |
| 시설물 | `POST /api/hotels/:id/facilities` | 유형·시설물명·`{ type: "ROOM", roomId } \| { type: "COMMON_AREA", commonAreaId }` 위치 | 시설물 재조회 | DB 동적 시설물관리권한 |
| 점검항목 | `POST /api/hotels/:id/inspection-items` | 대상유형 `ROOM\|FACILITY`·공통항목·객실/시설물유형별 제외/추가·version | 대상유형별 새 revision | DB 동적 항목설정권한 |
| 루틴 | `POST /api/hotels/:id/inspection-routines` | 대상범위·회차·반복·기한 | 루틴 revision 재조회 | DB 동적 루틴관리권한 |
| 점검 | `POST /api/hotels/:id/inspections` | 대상·유효항목·수시점검 | process·대상·항목 snapshot | DB 동적 점검등록권한 |
| 점검 | `PATCH /api/hotels/:id/inspections/:inspectionId/results` | version·정상/주의/이상·설명·첨부 | 결과·실제 수행자 재조회 | DB 동적 점검수행권한 |
| 점검 | `POST /api/hotels/:id/inspections/:inspectionId/transitions` | version·단계처리·사유 | process 실행·다음 단계 | 현재 단계 처리권한 |
| 보수 | `POST /api/hotels/:id/repairs` | 출처·대상 하나·우선순위·하자증빙 | 보수·process snapshot | DB 동적 보수등록권한 |
| 방문일정 | `POST /api/hotels/:id/repair-visits` | 보수 건·일정명·시작/종료·수행자/업체 | 일정·outbox 재조회 | DB 동적 일정생성권한 |
| Calendar | `POST /api/admin/calendar-sync-failures/:id/retry` | version·재시도사유 | 최신 outbox 상태 | DB 동적 Calendar관리권한 |
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
| 객실 | `(company_id, branch_id, room_number)` unique, 삭제 후 재사용은 새 내부 ID |
| 공용공간 | `(company_id, branch_id, id)` unique parent key, `normalized_name=lower(btrim(name))` stored generated column, `(company_id, branch_id, normalized_name)` unique, `ACTIVE/INACTIVE/DELETED`, 물리삭제 금지 |
| 시설물유형 | `(company_id, branch_id, id)` unique parent key, `normalized_name=lower(btrim(name))` stored generated column, `(company_id, branch_id, normalized_name)` unique를 `ACTIVE/INACTIVE/DELETED` 전체 lifecycle에 적용하고 `DELETED` 이름을 불변으로 유지해 삭제 후 이름 재사용 금지, 연결 시설물이 있으면 삭제 command 차단 |
| 시설물 | `(company_id, branch_id, id)` unique parent key, `normalized_name=lower(btrim(name))` stored generated column과 같은 호텔 시설물유형 composite FK; `ROOM`은 `room_id`만, `COMMON_AREA`는 `common_area_id`만 존재하는 명시적 행 CHECK와 각 위치 composite FK; `(company_id, branch_id, facility_type_id, room_id, normalized_name) WHERE location_type='ROOM'`과 `(company_id, branch_id, facility_type_id, common_area_id, normalized_name) WHERE location_type='COMMON_AREA'` partial unique |
| 위치·유형 lifecycle | 모든 command가 후보 참조를 읽은 뒤 `시설물유형 UUID → 기존·새 위치 (location_type, UUID) → 시설물 UUID` 전역순서로 잠그고 참조·version을 재조회하며 변경 시 conflict/retry; 활성 시설물이 연결된 위치의 사용중지·삭제와 시설물이 연결된 유형 삭제 차단, 이동은 같은 호텔 활성 위치만 허용 |
| 배정 | 시작일 < 종료일, 같은 배정의 중복기간 방지 |
| 점검 자동생성 | `execution_source='SCHEDULED'`이면 `routine_revision_id`·`business_date`·`occurrence_key` 모두 non-null인 행 CHECK; `(company_id, branch_id, routine_revision_id, business_date, occurrence_key) WHERE execution_source='SCHEDULED'` partial unique로 같은 회차의 실행 aggregate 중복차단 |
| 점검 실행대상 | `(company_id, branch_id, execution_id)`가 같은 tenant 실행 aggregate를 참조하는 composite FK; `ROOM`은 `room_id`만, `FACILITY`는 `facility_id`만 존재하는 행 CHECK·호텔 포함 대상 composite FK; `(company_id, branch_id, execution_id, room_id)`와 `(company_id, branch_id, execution_id, facility_id)` 유형별 partial unique |
| process 단계 | 현재 단계 주 검토자 1명, 선택 대리인 1명, 선착순 version 처리 |
| 보수대상 | 객실·공용공간·시설물 중 대상유형 하나와 대상개체 하나 |
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
| 객실·시설물 기준정보 | `ACTIVE`, `INACTIVE`, `DELETED`; 신규 업무대상 포함 여부만 의미 |
| 점검결과 | `NORMAL`, `CAUTION`, `ABNORMAL` |
| 점검 실행 | 생성 당시 process revision의 현재 단계·지연·최종완료·미완료종료 |
| 방문일정 | 예정·진행·완료·취소·삭제 감사 snapshot |
| 매출 | `DRAFT`, `CONFIRMED`, `LOCKED`, `CORRECTED` |
| 이슈 | `RECEIVED`, `ASSIGNED`, `IN_PROGRESS`, `ACTION_COMPLETED`, `CLOSED`, `ON_HOLD`, `CANCELLED` |
| 문의 | `RECEIVED`, `ASSIGNED`, `ANSWERING`, `ANSWERED`, `CLOSED` |
| 파일 | `PENDING_UPLOAD`, `QUARANTINED`, `READY`, `REJECTED`, `EXPIRED` |

## transaction 경계

- 점검 단계처리 + process history + 감사로그는 단일 transaction이다.
- 최초 최고관리자 설정은 bootstrap 운영자와 선택한 다른 활성 사내 임직원 한 명을 `0명 → 2명`으로 원자 지정하고 초기화 authority 폐기·감사·멱등결과를 같은 transaction에서 확정한다.
- process 판단으로 보수 건을 만들 때 원본 점검·대상·항목·결과·증빙 snapshot과 보수 process를 단일 transaction으로 연결한다.
- 방문일정 생성·변경·취소·삭제와 provider outbox INSERT는 단일 transaction이고 Google 실패가 정본 일정을 rollback하지 않는다.
- 매출 확정 + 잠금 + 증빙참조 + 감사로그는 단일 transaction.
- 소유주 교체는 기존 연결종료 + 신규연결 + 세션회수 요청상태 + 감사를 원자적으로 기록한다.
- R2·푸시 같은 외부작업은 DB transaction 밖에서 상태·재시도·보상으로 처리한다.
