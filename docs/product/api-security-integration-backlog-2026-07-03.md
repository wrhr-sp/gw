# API·보안 준비/연동/실행확인 백로그

이 문서는 그룹웨어의 외부 API·보안 작업을 다른 기능 개발과 분리해 보관하기 위한 실행 백로그다. 이 문서의 목적은 “이미 끝난 작업”을 과장해 완료 처리하는 것이 아니라, 지금 준비할 수 있는 내부 기반과 나중에 외부업체 계약·secret·sandbox가 필요해지는 연동 작업을 빠짐없이 구분하는 것이다.

## 1. 상태 정의

- **완료**: repo 코드, DB migration, 테스트, CI, 배포, live smoke까지 검증된 항목이다.
- **부분 완료**: DB/API/helper/test 같은 내부 골격은 있으나 모든 기능 화면·전체 권한·전체 감사로그·외부 연동까지 닫히지는 않은 항목이다.
- **준비 가능**: 외부업체 secret 없이 지금 DB/API/검증 구조를 만들 수 있는 항목이다.
- **연동 대기**: 업체 선정, 계약, sandbox, API key, webhook secret, 발신번호, 본인인증 심사 같은 외부 조건이 필요해 현재는 실제 호출을 하면 안 되는 항목이다.
- **운영 승인 대기**: production DB 실데이터, DNS/custom domain, 유료 리소스, destructive migration, 운영 백업/복구 실행처럼 별도 명시 승인이 필요한 항목이다.

## 2. 현재 구현 상태 요약

### 2-1. 이미 코드·DB 기반이 들어간 항목

- 로그인/세션 API는 `appRoutes.auth`와 API route에서 기본 흐름이 존재한다.
- 2차 비밀번호 API는 `appRoutes.security.secondaryPassword`와 `appRoutes.security.verifySecondaryPassword` 기준으로 계약이 존재한다.
- 감사로그/개인정보 접속기록/파일 접근로그 기반은 `db/postgres/migrations/0009_audit_privacy_file_access_logs.sql`에 `privacy_access_logs`, `file_access_logs`, `permission_change_logs`로 들어가 있다.
- 문서 파일 다운로드 ticket 기반은 `db/postgres/migrations/0010_document_file_download_tickets.sql`에 `document_file_download_tickets`로 들어가 있다.
- 문서 파일 API는 shared route 기준으로 `spaces`, `files`, `fileMetadata`, `uploadInit`, `uploadComplete`, `downloadInit`, `downloadFile`, `deleteFile` 계약이 존재한다.
- 전자계약 DB/API 기반은 `db/postgres/migrations/0011_electronic_contracts.sql`과 `apps/api/src/lib/operational-electronic-contracts.ts`에 들어가 있다.
- 차량운행일지 DB/API/UI 기반은 `db/postgres/migrations/0012_vehicle_operation_logs.sql`, API route, `/vehicle-operation` 화면, live smoke로 검증되었다.
- 조직/권한 조회 API는 `companies`, `employees`, `departments`, `roles`, `permissions`, `branches` route 계약과 운영 DB helper를 통해 회사 scope와 역할 권한을 조회하는 기반을 제공한다.
- 관리자 API는 `admin.users`, `admin.permissions`, `admin.policies`, `admin.policyDocuments`, `admin.policyBoards`, `admin.auditLogs` route 계약과 운영 DB 조회/변경 후보를 가진다.
- 사용자 설정 API는 `user_preferences` DB 기반으로 PC 사이드바·통합설정 같은 사용자별 preference를 저장·재조회하는 기반을 가진다.
- 근태/휴가 API는 출퇴근, 근태 기록, 근태 정정 요청, 휴가 유형, 휴가 잔여, 휴가 신청, 승인/반려 route 계약과 DB helper를 가진다.
- 전자결재 API는 결재 양식, 결재선, 문서, 상세, 댓글, 받은 결재함, 승인, 반려, 참조/합의 후보 route 계약과 DB helper를 가진다.
- 게시판 API는 게시판 목록, 게시글 목록, 게시글 상세, 댓글 route 계약과 DB 기반 게시글/댓글 저장·조회 흐름을 가진다.
- 내부 메일 API는 수신자 검색, 메시지 목록, 발송, 임시저장, 읽음 처리, 첨부 업로드/목록/다운로드 route 계약과 PostgreSQL/R2 기반 테스트 흐름을 가진다.
- 메신저 API는 thread 나가기 route 계약과 PostgreSQL `messenger_thread_members` 기반 상태 변경 helper를 가진다.
- 급여/경영업무 API는 급여 overview, 기간 상세, 내 급여명세서, work-items, work item 문서/첨부/검토/마감, compliance alert 기반 DB schema와 조회 helper를 가진다.
- 알림/홈 shortcut/읽음확인 API는 기본 route 계약과 운영 화면에서 사용할 내부 조회·상태 기반 후보를 가진다.
- 운영 PostgreSQL schema 정적 검증은 migration drift를 조기에 잡기 위한 `scripts/validate-operational-postgres-schema.mjs` 기반 검증 흐름을 가진다.

### 2-2. 부분 완료로 남겨야 하는 항목

- 권한·감사로그·개인정보 접속기록은 일부 기능에 연결되었지만 모든 개인정보 조회·수정·삭제·다운로드·대량조회·엑셀내보내기에 전면 적용된 상태는 아니다.
- 조직/직원/관리자/급여/근태/휴가/전자결재/게시판/메일/문서/차량운행일지 API는 내부 DB 기반이 섞여 있지만, 각 기능의 모든 mutation이 동일 수준의 감사로그·개인정보 접속기록·권한 변경로그를 남기는 상태는 아니다.
- 관리자 권한 변경은 permission log 기반이 있으나 권한 요청, 승인자, 변경 전후 snapshot, 회수 사유, 고위험 권한 재인증까지 전체 운영 절차가 완성된 상태는 아니다.
- 메일 첨부와 문서 파일은 R2/DB 기반 흐름이 있으나 파일 보안 정책이 모든 파일형 기능에 동일하게 적용되는 상태는 아니다.
- 파일 접근권한과 다운로드 로그는 기반이 있으나 보관기간, 파일 해시, 권한 snapshot, 다운로드 사유, 만료 공유 링크, 삭제/복구 정책까지 완성된 상태는 아니다.
- 전자계약은 내부 계약/당사자/상태 기반이 있으나 실제 업체 API 발송, webhook 수신, 서명 완료 PDF 보관, provider별 오류/재시도 처리는 아직 아니다.
- 2차 비밀번호는 내부 PIN 기반 보안장치이며 NICE/PASS 같은 외부 본인인증을 대체하는 최종 본인확인 수단으로 보지 않는다.

## 3. 지금 준비할 수 있는 작업

### 3-1. 외부연동 공통 기반

외부연동 공통 기반은 전자계약, 본인인증, 세금계산서, 카카오/SMS, 메일/캘린더, OCR 같은 provider가 달라져도 내부 구조가 흔들리지 않도록 만드는 공통 레이어다.

준비 항목:

- `external_integrations` 테이블 후보를 만든다.
  - provider key: `electronic_contract`, `identity_verification`, `tax_invoice`, `external_inquiry`, `mail_calendar`, `ocr`, `map_address`, `payment` 등
  - provider name: 실제 업체명 또는 sandbox provider명
  - status: `disabled`, `sandbox_ready`, `active`, `suspended`, `retired`
  - environment: `sandbox`, `production`
  - created_by, updated_by, created_at, updated_at
  - secret 값은 저장하지 않고 secret reference 또는 환경변수 key 이름만 저장한다.
- `external_integration_events` 테이블 후보를 만든다.
  - integration_id, event_type, direction, status, idempotency_key, request_hash, response_hash
  - retry_count, next_retry_at, last_error_code, last_error_message
  - related_resource_type, related_resource_id
  - actor_user_id, company_id, created_at
- `external_webhook_events` 테이블 후보를 만든다.
  - provider, event_id, event_type, received_at, signature_valid, payload_hash
  - processing_status: `received`, `ignored_duplicate`, `processed`, `failed`, `retry_scheduled`, `dead_letter`
  - related_resource_type, related_resource_id
  - raw payload는 민감정보 최소화 원칙에 따라 저장하지 않거나 필요한 경우 redacted JSON만 저장한다.
- 중복 webhook 방지를 위해 provider event id와 payload hash를 함께 unique 후보로 둔다.
- webhook signature 검증은 provider별 구현 전에 공통 인터페이스를 먼저 둔다.
- 외부 API 호출 실패는 사용자에게 성공처럼 보이지 않게 `EXTERNAL_PROVIDER_NOT_CONFIGURED`, `EXTERNAL_PROVIDER_UNAVAILABLE`, `WEBHOOK_SIGNATURE_INVALID`, `EXTERNAL_EVENT_DUPLICATE` 같은 명시 오류로 표면화한다.

완료 기준:

- migration 정적 검증 통과
- DB 미설정 시 `DB_NOT_CONFIGURED` 또는 provider 미설정 시 명시 오류 반환
- event 생성 후 재조회 테스트
- 중복 idempotency key/webhook event 처리 테스트
- 실제 secret 값이 repo, 로그, DB seed, 문서에 남지 않음

### 3-2. 보안 이벤트 표준화

보안 이벤트 표준화는 감사로그, 개인정보 접속기록, 파일 접근로그, 권한 변경로그가 기능별로 제각각 쌓이지 않게 하는 작업이다.

준비 항목:

- `apps/api/src/lib/operational-audit-events.ts`의 event type을 기능별로 정리한다.
- 개인정보 접속기록 표준 필드를 확정한다.
  - actor_user_id
  - subject_user_id
  - resource_type
  - resource_id
  - access_type: `read`, `create`, `update`, `delete`, `download`, `export`, `bulk_read`
  - purpose
  - legal_basis
  - metadata_json
- 파일 접근로그 표준 필드를 확정한다.
  - file_id, version_id, action, outcome, storage_provider, object_key, checksum_sha256
  - 다운로드 ticket id, 만료시간, 사용시간, 실패 사유
- 권한 변경로그 표준 필드를 확정한다.
  - actor_user_id, target_user_id 또는 target_role_code
  - target_feature_key
  - before_permissions, after_permissions
  - reason, approval_id, request_id
- 관리자 설정 변경 이벤트를 일반 감사로그와 별도 category로 구분한다.
- 대량조회/엑셀내보내기/민감자료 다운로드는 일반 조회보다 높은 위험도로 분류한다.

완료 기준:

- 각 보안 이벤트가 helper 한 곳을 통해 생성된다.
- 기능별 API test에서 성공/실패 양쪽 로그 저장을 확인한다.
- 민감정보 원문이 log metadata에 들어가지 않는지 테스트 또는 static scan을 둔다.
- live smoke에서 최소 1개 개인정보 조회와 1개 파일 다운로드 로그가 DB에 기록되는지 확인한다.

### 3-3. R2/S3 파일 보안 고도화

R2/S3 파일 보안 고도화는 파일 본문을 DB에 넣지 않고 Object Storage에 두면서, DB에는 접근권한·hash·보관기간·감사로그만 남기는 작업이다.

준비 항목:

- `file_objects` 또는 파일 metadata table에 다음 필드 후보를 추가한다.
  - storage_provider
  - object_key
  - original_filename
  - sanitized_filename
  - content_type
  - size_bytes
  - checksum_sha256
  - retention_until
  - deleted_at
  - delete_reason
  - owner_user_id 또는 owner_employee_id
  - sensitivity_level
- 업로드 정책을 확정한다.
  - 실행파일 계열 확장자 차단
  - MIME 타입 검증
  - 파일명 랜덤화
  - 원본 파일명 별도 저장
  - 파일 해시 저장
  - 파일 크기 제한
- 다운로드 정책을 확정한다.
  - 다운로드 ticket 만료시간
  - ticket 1회 사용 여부
  - 권한 확인 후 ticket 발급
  - 다운로드 성공/실패 로그 저장
  - 민감 파일 다운로드 사유 입력 후보
- 공유 정책을 확정한다.
  - 파일 소유자
  - 열람 가능 역할
  - 다운로드 가능 역할
  - 공유 대상 사용자/부서/역할
  - 공유 만료시간
  - 공유 회수 로그
- 삭제/복구 정책을 확정한다.
  - soft delete 우선
  - 복구 가능 기간
  - 영구삭제 별도 승인
  - Object Lock 또는 버전관리 후보

완료 기준:

- upload-init → upload-complete → metadata 재조회 → download-init → download → file_access_logs 확인 흐름이 테스트된다.
- R2가 미설정이면 mock 성공이 아니라 명시 오류를 반환한다.
- 파일명, content type, 확장자, 크기 제한 검증이 테스트된다.
- 다운로드 ticket 만료/중복사용/권한없음 테스트가 있다.

### 3-4. 전자계약 연동 준비

전자계약 연동 준비는 실제 전자서명 provider API key가 없어도 내부 계약 상태와 webhook 수신·PDF 보관 후보를 미리 정리하는 작업이다.

준비 항목:

- 기존 `electronic_contracts`에 provider 연동 상태를 분리해 정리한다.
  - `external_provider`
  - `external_contract_id`
  - provider status snapshot
  - last_synced_at
  - signature_requested_at
  - signed_at
  - signed_file_id
- `electronic_contract_parties`에 외부 서명자 상태를 매핑한다.
  - provider_party_id
  - requested_at
  - signed_at
  - rejected_at
  - last_provider_status
- webhook event와 계약 상태 변경을 연결한다.
  - 서명 요청 생성
  - 서명 요청 발송 대기
  - provider 발송 성공
  - provider 발송 실패
  - 서명 완료 webhook 수신
  - 서명 완료 PDF 저장 대기
  - PDF 저장 완료
- 계약서 열람/다운로드는 개인정보 접속기록 또는 파일 접근로그와 연결한다.
- 실제 발송 버튼은 provider 설정 전에는 비활성 또는 명시 오류 상태로 둔다.

완료 기준:

- 내부 계약 생성 → 상태 변경 → provider 미설정 오류 → webhook fixture 수신 → 상태 변경 후보 기록까지 테스트된다.
- webhook 중복 수신이 중복 상태 변경을 만들지 않는다.
- signed PDF file_id가 생기기 전에는 서명완료 파일이 있는 것처럼 UI가 표시하지 않는다.
- 실제 외부 발송은 별도 승인 전까지 실행하지 않는다.

### 3-5. 본인인증/PASS/NICE 준비

본인인증/PASS/NICE 준비는 실제 본인확인 API를 붙이기 전에 요청/만료/실패/재인증 이력을 내부적으로 저장할 수 있게 만드는 작업이다.

준비 항목:

- `identity_verification_requests` 테이블 후보를 만든다.
  - id, company_id, user_id, employee_id
  - provider: `nice`, `pass`, `account_ownership`, `internal_secondary_password`
  - purpose: `account_activation`, `sensitive_access`, `contract_signer`, `admin_permission_change`, `payroll_access`
  - status: `requested`, `redirect_ready`, `verified`, `failed`, `cancelled`, `expired`
  - expires_at, verified_at, failed_at
  - provider_request_id, provider_result_id
  - result_hash 또는 최소화된 검증 결과
- `identity_reauth_sessions` 후보를 만든다.
  - 민감 기능 진입 전 재인증 세션
  - route/resource 기준 만료시간
  - 재인증 방식
  - 실패 횟수와 잠금 후보
- 본인인증 결과와 개인정보 접근기록을 연결한다.
- 인증 실패/취소/만료는 감사로그로 남긴다.
- 주민등록번호 같은 원문 식별값은 저장하지 않고 provider 결과 토큰 또는 검증 결과 최소값만 저장한다.

완료 기준:

- provider 미설정 상태에서 요청 API는 명시 오류 또는 sandbox fixture만 반환한다.
- 인증 요청 생성/만료/실패/성공 fixture 처리 테스트가 있다.
- 민감 API 접근 전 재인증 요구와 재인증 만료 테스트가 있다.
- 개인정보 원문이 로그와 DB에 저장되지 않는지 확인한다.

### 3-6. 외부 문의/연락 수신함 준비

외부 문의/연락 수신함 준비는 카카오 알림톡/SMS를 단순 내부 알림 발송이 아니라 고객사·거래처 문의를 그룹웨어 업무로 끌어오는 구조로 모델링하는 작업이다.

준비 항목:

- `external_inquiries` 테이블 후보를 만든다.
  - channel: `kakao`, `sms`, `email`, `web_form`, `manual`
  - sender_name, sender_contact_hash, sender_company_candidate
  - related_company_id 또는 partner/customer 후보
  - category: `contract`, `settlement`, `evidence`, `facility`, `branch_operation`, `sales`, `other`
  - status: `new`, `triaged`, `assigned`, `in_progress`, `waiting_external`, `resolved`, `closed`, `spam`
  - assigned_department_id, assigned_user_id
  - priority, due_at
- `external_inquiry_messages` 테이블 후보를 만든다.
  - inquiry_id, direction, channel_message_id, body_preview, body_redacted
  - attachment_file_id 후보
  - sent_at, received_at
  - delivery_status, delivery_error
- 담당자 배정/상태 변경/회신 이력은 감사로그와 연결한다.
- 고객사/거래처/계약/매출/지점/시설 업무와 연결할 수 있는 reference 필드를 둔다.
- 실제 카카오/SMS 발송은 발신번호/템플릿/과금/심사 승인이 필요하므로 연동 대기로 둔다.

완료 기준:

- 외부문의 생성 → 담당자 배정 → 상태 변경 → 회신 이력 저장 → 목록/상세 재조회 테스트가 있다.
- provider 미설정 상태에서도 내부 수동 등록/fixture 수신 테스트는 가능하다.
- 실제 SMS/Kakao 발송은 별도 승인 전까지 실행하지 않는다.

### 3-7. 전자세금계산서/홈택스 준비

전자세금계산서/홈택스 준비는 세무 provider 연결 전에 내부 증빙/거래처/세무 상태를 연결하는 작업이다.

준비 항목:

- `tax_invoice_sync_jobs` 테이블 후보를 만든다.
  - provider, business_registration_number_hash, period, status, requested_by
  - provider_job_id, last_error_code, last_error_message
- `tax_invoice_records` 테이블 후보를 만든다.
  - invoice_number_hash 또는 provider record id
  - issue_date, supplier/recipient 후보, amount, tax_amount
  - matched_expense_id, matched_work_item_id
  - source: provider/manual/upload
- 홈택스 또는 대행 API 연결 전에는 provider 미설정 오류와 수동 등록/fixture 테스트만 허용한다.
- 사업자등록번호 원문과 세무 민감 원문은 최소화 또는 암호화 후보로 분류한다.

완료 기준:

- 수동/fixture 세금계산서 기록 생성과 증빙 매칭 테스트가 있다.
- provider 미설정 상태에서 외부 조회가 성공처럼 보이지 않는다.
- 세무자료 조회는 개인정보/민감정보 접속기록 후보와 연결된다.

### 3-8. 메일/캘린더/드라이브 외부 API 준비

메일/캘린더/드라이브 준비는 Google Workspace 또는 Microsoft Graph 연결 전에 내부 업무와 외부 메시지·일정·파일 reference를 연결할 수 있게 만드는 작업이다.

준비 항목:

- 외부 계정 연결 상태 테이블 후보를 만든다.
  - provider, account_email_hash, status, scope_summary, last_sync_at
  - refresh token은 DB나 문서에 저장하지 않고 secret manager 또는 provider credential store로 분리한다.
- 외부 메일 수신 → 업무 생성 후보를 만든다.
- 계약/업무 마감일 → 외부 캘린더 일정 생성 후보를 만든다.
- 외부 drive file id → 내부 document file reference 후보를 만든다.

완료 기준:

- provider 미설정 상태에서 동기화 API는 명시 오류를 반환한다.
- 내부 fixture로 외부 메시지/일정 reference 생성과 재조회 테스트가 가능하다.
- OAuth token 또는 refresh token이 로그와 DB seed에 남지 않는다.

### 3-9. OCR/지도/결제/정산/AI API 준비

OCR, 지도, 결제, AI API는 초기 핵심 연동보다 뒤에 두되, 나중에 붙일 때 공통 event 구조를 재사용하도록 준비한다.

준비 항목:

- OCR: 문서 file_id, extraction_job_id, status, extracted_text_ref, confidence, redaction 상태를 둔다.
- 지도/주소: 사업장 주소 검증, 좌표 후보, 도로명주소 API 결과 최소 저장 정책을 둔다.
- 결제/정산: 결제 provider event, 정산 batch, 취소/환불 상태, 금액 검증 로그를 둔다.
- AI API: 문서 요약/분류 job, 입력 text 최소화, 민감정보 redaction, 결과 검토 상태를 둔다.

완료 기준:

- 실제 유료 provider 호출 없이 job 생성/상태 변경/오류 기록/재시도 테스트가 가능하다.
- provider 미설정 상태는 명시 오류로 노출된다.
- 민감 원문을 AI provider에 보내는 동작은 별도 승인 전까지 막는다.

## 4. ERP/경리 외부 API 연결 확정 범위

ERP/경리 외부 API는 추가 후보까지 연결 확정 범위에 포함한다. 단, 내부 ERP 기능과 권한·감사·파일권한 구조가 안정화된 뒤 마지막 단계에서 연결한다.

확정 묶음:

- 국세청/홈택스
- 은행/오픈뱅킹
- 카드사/법인카드
- PG/결제대행
- 전자계약/전자문서
- 알림/메일/SMS/알림톡
- 기업정보/신용평가
- NICE/KCB 인증
- 전자세금계산서 중계 사업자
- 외부 회계/ERP import/export
- OCR
- 택배/물류/재고 연계

상세 범위와 내부 기능 연결 기준은 `docs/product/erp-external-api-confirmed-scope-2026-07-04.md`를 따른다.

## 5. 실제 연동 시 실행확인 체크리스트

외부업체 API를 실제로 연결할 때는 기능별로 아래 항목을 모두 확인한 뒤 완료로 바꾼다.

### 4-1. 사전 승인

- provider 선정이 문서화되어 있다.
- sandbox 계정 또는 테스트 환경이 준비되어 있다.
- API key, webhook secret, OAuth client secret은 `.secrets` 또는 승인된 secret store에만 들어간다.
- secret 값은 대화, PR body, commit, 로그, Obsidian 노트에 쓰지 않는다.
- paid API, 발신 과금, production 실데이터, DNS/custom domain, destructive migration은 별도 승인으로 처리한다.

### 4-2. sandbox 연결

- sandbox 요청이 실제 provider에 도달한다.
- provider 응답이 내부 contract schema로 검증된다.
- provider 오류 응답이 내부 표준 오류로 매핑된다.
- retry 가능한 오류와 retry 하면 안 되는 오류가 구분된다.
- idempotency key가 중복 요청을 막는다.

### 4-3. webhook 수신

- webhook signature 검증이 통과한다.
- signature 실패 요청은 처리하지 않고 로그만 남긴다.
- 중복 webhook은 `ignored_duplicate`로 남긴다.
- 정상 webhook은 내부 resource 상태를 한 번만 변경한다.
- 실패 webhook은 `retry_scheduled` 또는 `dead_letter`로 추적된다.

### 4-4. 권한/보안 확인

- 권한 없는 사용자는 외부연동 결과를 조회할 수 없다.
- 개인정보 또는 계약서 열람은 개인정보 접속기록 또는 파일 접근로그에 남는다.
- 파일 다운로드는 ticket 발급, 만료, 사용, 실패 로그가 남는다.
- 관리자 설정 변경과 권한 변경은 감사로그에 남는다.
- 대량 조회/엑셀내보내기/민감 파일 다운로드는 고위험 이벤트로 남는다.

### 4-5. live smoke

- 로그인 후 실제 화면에서 버튼을 누른다.
- 실제 API mutation이 실행된다.
- 반환 id로 상세 API 또는 목록 API를 다시 조회한다.
- DB에서 event/log/resource 상태를 확인한다.
- 테스트 데이터는 가능한 범위에서 정리한다.
- 정리할 수 없는 provider sandbox 데이터는 sandbox console에서 상태를 확인하고 문서에 남긴다.

## 6. 운영 승인 게이트

아래 항목은 준비 문서화나 내부 fixture 테스트로 끝내고, 실행 전 별도 명시 승인을 받아야 한다.

- 실제 전자계약 발송
- 실제 본인인증/PASS/NICE 요청
- 실제 카카오/SMS 발송 또는 수신번호 운영 등록
- 홈택스/세금계산서 실계정 연동
- Google/Microsoft OAuth production 연결
- 운영 DB 실데이터 migration 또는 실데이터 조회
- production backup/restore 실행
- DNS/custom domain 변경
- 유료 security product 구매
- 운영 WAF rule 변경으로 실제 사용자 트래픽에 영향을 줄 수 있는 작업
- destructive migration 또는 영구 삭제

## 7. 다른 기능 개발로 넘어가기 전 남겨둘 결정

API·보안 연동은 현재 “완료”가 아니라 “분리 보관된 백로그” 상태다. 다른 기능 개발 중에도 아래 규칙은 계속 적용한다.

- 새 기능이 개인정보, 계약서, 급여, 파일, 권한 변경을 다루면 해당 기능의 API에서 감사로그 또는 개인정보 접속기록 연결 여부를 확인한다.
- 새 기능에 파일 업로드/다운로드가 있으면 R2/S3 파일권한·다운로드 로그 백로그와 연결한다.
- 새 기능이 외부업체 API를 필요로 하면 실제 호출 전에 `external_integrations`, `external_integration_events`, `external_webhook_events` 공통 기반을 먼저 통과시킨다.
- provider secret이 없다는 이유로 mock 성공을 만들지 않는다. 미설정 상태는 명시 오류 또는 비활성 UI로 둔다.
- production 실데이터, 유료 리소스, DNS/custom domain, destructive migration은 계속 별도 승인 게이트다.

## 8. 추천 실행 순서

다른 기능 개발을 시작하기 전에 최소 문서화만 끝낸 상태라면, 나중에 API·보안 작업을 재개할 때 다음 순서로 진행한다.

1. 외부연동 공통 테이블과 event/webhook 표준을 구현한다.
2. 보안 이벤트 helper와 개인정보/파일/권한 로그 표준을 정리한다.
3. R2/S3 파일권한·다운로드 로그를 고도화한다.
4. 전자계약 webhook/PDF 저장 준비를 구현한다.
5. 본인인증/PASS/NICE 요청·재인증 테이블을 구현한다.
6. 외부 문의/연락 수신함을 내부 API로 먼저 구현한다.
7. 전자세금계산서/홈택스, 메일/캘린더/드라이브, OCR, 지도, 결제, AI API는 provider 선정과 secret 준비 후 순차 연결한다.

## 9. 완료/재개 판단표

- 지금 다른 기능 개발로 넘어가도 되는가: 가능하다.
- API·보안 작업이 끝났다고 말해도 되는가: 아니다.
- 외부연동을 당장 실행해도 되는가: 아니다.
- secret 없이 준비 가능한 내부 기반을 구현해도 되는가: 가능하다.
- provider secret이 필요한 항목을 문서/코드에 가짜 값으로 채워도 되는가: 안 된다.
- 나중에 재개할 때 이 문서를 기준으로 큐를 다시 만들 수 있는가: 가능하다.
