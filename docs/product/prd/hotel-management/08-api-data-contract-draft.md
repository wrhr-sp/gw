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
| 객실 | `POST /api/hotels/:id/rooms` | 객실번호·층·유형·상태 | 객실 재조회 | `HOTEL_ROOM_MANAGE` |
| 객실 | `POST /api/hotels/:id/rooms/:roomId/status` | version·상태·사유·예정재개일 | 상태이력 포함 객실 | 유효배정 사내 임직원 |
| 템플릿 | `POST /api/hotels/:id/inspection-templates` | 항목배열·version | 새 템플릿 버전 | `HOTEL_INSPECTION_TEMPLATE_MANAGE` |
| 점검 | `POST /api/hotels/:id/inspections` | 대상·책임자·참여자·기한 | 점검 스냅샷 | `HOTEL_INSPECTION_MANAGE` |
| 점검 | `PATCH /api/hotels/:id/inspections/:inspectionId/results` | version·항목결과·첨부참조 | 결과 재조회 | 담당자/참여자 |
| 점검 | `POST /api/hotels/:id/inspections/:inspectionId/complete` | version | 완료·자동이슈 | 완료책임자 |
| 이슈 | `POST /api/hotels/:id/issues` | 객실·등급·내용·첨부 | 접수 이슈 | 유효배정자 |
| 이슈 | `POST /api/hotels/:id/issues/:issueId/transitions` | version·전이·사유 | 상태이력 포함 이슈 | 상태별 권한 |
| 매출 | `POST /api/hotels/:id/daily-sales` | 업무일·내역·금액·증빙 | 임시저장 재조회 | `HOTEL_SALES_MANAGE` |
| 매출 | `POST /api/hotels/:id/daily-sales/:salesId/confirm` | version | 확정·잠금 | `HOTEL_SALES_CONFIRM` |
| 매출 | `POST /api/hotels/:id/daily-sales/:salesId/corrections` | version·사유·근거·새값 | 정정버전 | `HOTEL_SALES_CORRECT` |
| 문의 | `POST /api/hotels/:id/inquiries` | 유형·제목·내용·첨부 | 라우팅된 문의 | 활성 호텔 소유주 |
| 문의 | `POST /api/hotels/:id/inquiries/:inquiryId/transitions` | version·전이·메시지 | 상태·메시지 재조회 | 상태별 권한 |
| 파일 | `POST /api/hotel-files/upload-init` | 호텔·부모종류·파일명·크기·MIME | 업로드 세션 | 자료 쓰기권한 |
| 파일 | `POST /api/hotel-files/:fileId/upload-complete` | 검증값 | 검역상태 | 업로드 생성자 |
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
| 객실 | `(company_id, branch_id, room_number)` unique |
| 배정 | 시작일 < 종료일, 같은 배정의 중복기간 방지 |
| 점검 자동생성 | `(schedule_id, room_id, business_date)` unique |
| 점검 책임자 | 점검당 활성 완료책임자 정확히 1명 |
| 매출 | `(company_id, branch_id, business_date)` 또는 합의한 집계키 unique |
| 파일 | 부모참조는 같은 `company_id·branch_id`, 검역통과 파일만 연결 |
| version | 변경 가능한 모든 정본자료에 1 이상 정수 |
| 사건시각 | UTC `timestamptz`, 업무일 `DATE` |

PostgreSQL에서 기간중복을 직접 막기 어려운 관계는 transaction 안의 잠금·재검사와 DB index를 함께 사용한다.

## 내부 상태코드

| 도메인 | 코드 |
|---|---|
| 호텔 | `PREPARING`, `ACTIVE`, `SUSPENDED` |
| 객실 | `ACTIVE`, `TEMP_SUSPENDED`, `OUT_OF_SERVICE` |
| 점검 | `SCHEDULED`, `UNASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| 매출 | `DRAFT`, `CONFIRMED`, `LOCKED`, `CORRECTED` |
| 이슈 | `RECEIVED`, `ASSIGNED`, `IN_PROGRESS`, `ACTION_COMPLETED`, `CLOSED`, `ON_HOLD`, `CANCELLED` |
| 문의 | `RECEIVED`, `ASSIGNED`, `ANSWERING`, `ANSWERED`, `CLOSED` |
| 파일 | `PENDING_UPLOAD`, `QUARANTINED`, `READY`, `REJECTED`, `EXPIRED` |

## transaction 경계

- 점검 완료 + 중대·긴급 이슈 자동생성 + 감사로그는 단일 transaction.
- 매출 확정 + 잠금 + 증빙참조 + 감사로그는 단일 transaction.
- 소유주 교체는 기존 연결종료 + 신규연결 + 세션회수 요청상태 + 감사를 원자적으로 기록한다.
- R2·푸시 같은 외부작업은 DB transaction 밖에서 상태·재시도·보상으로 처리한다.
