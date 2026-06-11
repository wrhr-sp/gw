# API

## 문서 목적

이 문서는 현재 저장소 기준 same-origin `/api/*` 계약을 빠르게 이해하기 위한 루트 문서다.

중요:
- 기본 경로는 same-origin `/api/*` 다.
- 공통 route/schema 의 1차 기준은 `packages/shared/src/contracts.ts` 다.
- placeholder 구현과 guardrail 의 1차 기준은 `apps/api/src/app.ts`, `apps/api/test/auth-org.spec.ts` 다.
- preview 전용 절대 API hostname 을 제품 기본값으로 문서에 고정하지 않는다.

## 공통 규칙

### 응답 envelope

성공 응답:
- `ok: true`
- `data: ...`
- `error: null`

오류 응답:
- `ok: false`
- `data: null`
- `error.code`
- `error.message`
- 필요 시 `error.details`

근거:
- `successResponseSchema(...)`
- `errorResponseSchema`
- `apps/api/src/app.ts` 의 `jsonError(...)`

### 공통 오류 코드

현재 shared contract 에 정의된 대표 오류 코드는 아래 4개다.

- `AUTH_REQUIRED`: 로그인 필요
- `FORBIDDEN`: 권한 부족 또는 회사 경계 위반
- `VALIDATION_ERROR`: query/path/body 형식 오류
- `NOT_IMPLEMENTED`: skeleton 단계라 실제 운영 동작을 아직 열지 않은 경우

실무 메모:
- 현재 API 구현의 `jsonError(...)` 는 주로 400/401/403/501 을 사용한다.
- 루트 문서에서는 404 성격의 조건도 함께 다루지만, 실제 placeholder 응답은 일부 케이스를 403/validation 성격으로 우선 설명할 수 있다. 따라서 각 endpoint 작업 전에는 테스트 파일을 다시 보는 편이 안전하다.

### 공통 guardrail

- 로그인 없는 접근은 보호 endpoint 에서 `AUTH_REQUIRED` 를 반환한다.
- 권한이 없으면 `FORBIDDEN` 을 반환한다.
- 관리자 영역 `/api/admin/*` 는 일반 업무 API 와 분리한다.
- 다른 회사 범위의 운영 변경은 `ensureCompanyBoundary(...)` 로 막는다.
- skeleton/placeholder 단계에서도 실제 저장 완료처럼 과장하지 않는다.
- secret, raw storage key, 실제 개인정보 원문은 응답/로그/문서에 노출하지 않는다.

## 모듈별 API 빠른 지도

| 모듈 | 대표 endpoint | 대표 contract/테스트 | 핵심 guardrail |
| --- | --- | --- | --- |
| Health/Auth | `/api/health`, `/api/auth/*`, `/api/me` | `healthResponseSchema`, `authLoginResponseSchema`, `apps/api/test/health.spec.ts`, `apps/api/test/auth-org.spec.ts` | 무인증 차단, placeholder 세션 명시 |
| 조직/직원 | `/api/companies`, `/api/employees`, `/api/departments`, `/api/roles`, `/api/permissions` | `listEmployeesResponseSchema` 등 | 일반 조회와 관리자 화면 분리, invalid filter 400 |
| 관리자 | `/api/admin/invites`, `/api/admin/users`, `/api/admin/policies*`, `/api/admin/audit-logs` | admin schema 들, `apps/api/test/auth-org.spec.ts` | admin role 필요, cross-company 차단, masked preview 유지 |
| 근태/휴가 | `/api/attendance/*`, `/api/leave/*` | attendance/leave schema 들 | 본인·하위 직원 범위, 비승인자 차단, unknown id 차단 |
| 전자결재 | `/api/approvals/*` | approval schema 들 | self-approval 금지, 같은 회사 후보만 허용 |
| 게시판/문서 | `/api/notices`, `/api/boards/*`, `/api/documents/*`, `/api/read-receipts` | board/document schema 들 | notice-only 쓰기 차단, private 문서공간 차단, raw storage 정보 비노출 |

## 1. Health/Auth

### `GET /api/health`

목적:
- API 살아 있음 확인

대표 응답:
- `service: "gw-api"`
- `status: "ok"`
- `version: "0.1.0"`

오류 규칙:
- 정상 상태 점검용이므로 인증 없이 확인 가능

근거:
- `packages/shared/src/contracts.ts` 의 `healthPayloadSchema`, `healthResponseSchema`
- `apps/api/test/health.spec.ts`

### `POST /api/auth/login`

목적:
- placeholder 로그인 세션 생성

대표 요청 body:
- `email`
- `password` (최소 8자)

대표 성공 응답:
- `session`: `id`, `status`, `expiresAt`, `placeholder: true`
- `user`: `companyId`, `employeeId`, `roleCodes`, `permissions`
- `nextStep`

오류 규칙:
- 형식이 맞지 않으면 validation 계열 처리
- 실제 외부 인증 제공자 연결은 아직 범위 밖

근거:
- `authLoginRequestSchema`
- `authLoginResponseSchema`
- `apps/api/test/auth-org.spec.ts`

### `POST /api/auth/logout`

목적:
- placeholder 세션 종료

대표 성공 응답:
- `session.status: "signed_out"`
- `session.placeholder: true`

근거:
- `authLogoutResponseSchema`
- `apps/api/test/auth-org.spec.ts`

### `GET /api/me`

목적:
- 현재 세션 사용자와 권한 확인

대표 성공 응답:
- `session`
- `user`

대표 오류:
- 401 `AUTH_REQUIRED`: 인증 쿠키 없음

guardrail:
- same-origin bridge 문맥에서는 forged dev placeholder cookie 를 그대로 믿지 않는 기준을 유지한다.

함께 볼 문서:
- `docs/architecture/phase-7-api-same-origin-scope.md`

## 2. 조직/직원 API

### `GET /api/companies`

목적:
- 현재 회사 목록 skeleton 조회

대표 성공 응답:
- `items[]`: `id`, `code`, `name`, `status`

관련 contract:
- `listCompaniesResponseSchema`

### `GET /api/employees`

목적:
- 일반 업무용 직원 목록/상태/필터 조회

대표 query:
- `departmentId?`
- `employmentStatus?` (`active | on_leave | offboarded`)
- `roleCode?`

대표 성공 응답:
- `items[]`: 직원 기본 정보
- `summaries[]`: 부서명, 역할 요약, 상태 라벨
- `filters`: 현재 적용 필터
- `filterOptions`: 선택 가능한 부서/상태/역할
- `notices[]`
- `placeholder: true`

대표 오류:
- 400 `VALIDATION_ERROR`: 잘못된 `employmentStatus`, 잘못된 `roleCode`

guardrail:
- 비관리자 일반 조회에서는 admin-only 역할 요약을 숨긴다.
- `/employees` 는 운영 사용자-직원 연결 편집 화면이 아니다.

관련 테스트:
- `apps/api/test/auth-org.spec.ts`
  - 직원 목록/필터/notice 검증
  - 일반 조회에서 관리자 role 비노출
  - invalid filter 400 검증

함께 볼 문서:
- `docs/architecture/phase-11-org-employees-scope.md`

### `GET /api/departments`

목적:
- 부서 구조 요약 조회

대표 성공 응답:
- `items[]`: `id`, `companyId`, `parentDepartmentId`, `code`, `name`, `status`
- `summary`: 구조 설명과 개수
- `notices[]`
- `placeholder: true`

guardrail:
- 조직 개편 저장 같은 운영 변경은 이 범위가 아니다.

### `GET /api/roles`

목적:
- 역할 카탈로그 조회

대표 성공 응답:
- `items[]`: `code`, `name`, `scope`, `permissions`
- `summary`
- `notices[]`
- `placeholder: true`

guardrail:
- 역할 저장/변경 자체는 관리자 운영 범위다.

### `GET /api/permissions`

목적:
- 권한 코드 카탈로그 조회

대표 성공 응답:
- `items[]`: `code`, `description`

실무 메모:
- `permissionCodeSchema` 에 정의된 코드 집합이 shared 단일 계약이다.

## 3. 관리자 API

### `POST /api/admin/invites`

목적:
- 관리자 초대 placeholder 생성

대표 요청 body:
- `companyId`
- `email`
- `roleCode`
- `departmentId?`

대표 성공 응답:
- 초대 id
- 대상 이메일/역할/부서
- `status: pending_delivery`
- `expiresAt`
- `audit` candidate 정보

대표 오류:
- 403 `FORBIDDEN`: admin 권한 없음
- 403 `FORBIDDEN`: 다른 회사 범위 초대 시도

guardrail:
- 관리자 권한이 없으면 차단
- 회사 경계 위반 차단

관련 테스트:
- 초대 생성 권한 차단/허용 시나리오

### `GET /api/admin/users`

목적:
- 운영 사용자-직원 연결과 역할 후보 검토용 관리자 목록

대표 성공 응답:
- `items[]`: `userId`, `employeeId`, `fullName`, `email`, `roleCodes`, 상태 변화 preview 등
- `notices[]`
- `placeholder: true`

guardrail:
- `/employees` 일반 조회와 책임을 섞지 않는다.
- 비관리자 접근은 차단한다.

관련 테스트:
- 관리자만 허용
- employee.read 만 있는 비관리자는 차단

### `GET /api/admin/policies`

목적:
- 근태/휴가/결재/문서/게시판 정책 candidate 조회

대표 성공 응답:
- `items[]`: `category`, `summary`, `lastReviewedAt`, `reasonRequired`, `diffPreview`

guardrail:
- 운영 정책 preview 는 마스킹/후보 수준으로만 노출한다.

### `GET /api/admin/policies/documents`

목적:
- 문서 정책 candidate 조회

대표 성공 응답:
- visibility, retention, allowlist, max-size 관련 masked summary

대표 오류:
- 403 `FORBIDDEN`: 다른 회사 범위 candidate 조회/변경

guardrail:
- raw storage detail 비노출
- cross-company 차단

### `GET /api/admin/policies/boards`

목적:
- 게시판 정책 candidate 조회

대표 성공 응답:
- visibility, notice-only, moderation placeholder summary

guardrail:
- review requirement 를 함께 노출해 운영 변경처럼 보이지 않게 한다.

### `GET /api/admin/audit-logs`

목적:
- masked 감사 로그 조회

대표 query:
- `actorUserId?`
- `category?`
- `targetType?`
- `createdFrom?`
- `createdTo?`

대표 성공 응답:
- `items[]`: masked metadata 포함 감사 로그
- `filters`
- `filterOptions`
- `detailPreview`

대표 오류:
- 403 `FORBIDDEN`: 감사 권한 없음

guardrail:
- raw 민감 payload 대신 masked preview 유지
- createdFrom/createdTo query 를 테스트로 확인

함께 볼 문서:
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`

## 4. 근태/휴가 API

### `POST /api/attendance/check-in`
### `POST /api/attendance/check-out`

목적:
- placeholder 출근/퇴근 상태 변경

대표 성공 응답:
- `record`: 근태 기록
- `notice`
- `placeholder: true`

guardrail:
- 상태 변경이라도 placeholder 임을 숨기지 않는다.

### `GET /api/attendance/records`

목적:
- 본인 또는 권한 있는 관리자의 근태 기록 조회

대표 query:
- `employeeId?`
- `workDate?` 또는 기간 관련 필터는 후속 확장 여지

대표 성공 응답:
- `items[]`: 근태 기록
- `filters`
- `placeholder: true`

대표 오류:
- 권한 없이 다른 직원 조회 시 차단
- 알 수 없는 직원 id 조회 시 차단

관련 테스트:
- 근태 기록 조회
- 알 수 없는 employee id 금지

### `POST /api/attendance/corrections`

목적:
- 근태 정정 요청 생성

대표 요청 body:
- `attendanceRecordId`
- `reason`
- `requestedCheckInAt?`
- `requestedCheckOutAt?`
- `note?`

대표 성공 응답:
- 생성된 정정 요청 정보
- `placeholder: true`

guardrail:
- 실제 승인 완료처럼 보이지 않게 유지

### `GET /api/leave/types`
### `GET /api/leave/balances`
### `GET /api/leave/requests`

목적:
- 휴가 유형/잔여/신청 목록 조회

대표 성공 응답:
- `items[]` 중심 응답
- notice 또는 placeholder 필드 포함

### `POST /api/leave/requests`

목적:
- placeholder 휴가 신청 생성

대표 요청 body:
- `leaveTypeId`
- `startDate`
- `endDate`
- `reason`
- `unit`
- `days`

guardrail:
- 실제 운영 승인 완료처럼 보이지 않게 한다.

### `POST /api/leave/requests/:id/approve`
### `POST /api/leave/requests/:id/reject`

목적:
- 휴가 승인/반려 placeholder 처리

대표 요청 body:
- action 사유/메모 성격 payload

대표 오류:
- 403 `FORBIDDEN`: 승인 권한 없음
- unknown request id 차단

guardrail:
- 비승인자 차단
- 하위 직원 요청 승인 시나리오만 허용

함께 볼 문서:
- `docs/architecture/phase-3-attendance-leave-scope.md`

## 5. 전자결재 API

### `GET /api/approvals/forms`
### `GET /api/approvals/lines`

목적:
- 기안 가능한 양식/결재선 skeleton 조회

대표 성공 응답:
- `items[]`
- `placeholder: true`
- recommended use case, required permission 성격 안내

guardrail:
- 비관리자/비매니저가 운영용 생성까지 하는 범위는 아님

### `GET/POST /api/approvals/documents`

목적:
- 결재 문서 목록 조회 / 기안 생성

대표 요청 body:
- `formId`
- `lineId`
- `title`
- `summary?`
- `referenceEmployeeIds?`
- `agreementEmployeeIds?`

대표 성공 응답:
- `items[]` 또는 생성된 `document`
- `placeholder: true`

guardrail:
- 작성 가능한 권한 필요
- 같은 회사 문맥 유지

### `GET /api/approvals/documents/:id`

목적:
- 참여자 범위 내 문서 상세 조회

guardrail:
- 참여자/허용 역할 외 접근 차단
- 알 수 없는 문서 id 차단

### `GET /api/approvals/inbox`

목적:
- 내 승인함 조회

guardrail:
- 내 기안함과 승인함 스코프를 섞지 않는다.

### `POST /api/approvals/documents/:id/approve`
### `POST /api/approvals/documents/:id/reject`

목적:
- 결재 승인/반려 placeholder 처리

대표 요청 body:
- action comment 성격 payload

대표 오류:
- self-approval 차단
- unknown id 차단

guardrail:
- 자기 문서 자기승인 금지
- step/approver 스코프 확인

### `GET /api/approvals/references/candidates`
### `GET /api/approvals/agreements/candidates`

목적:
- 참조/합의 후보 조회

guardrail:
- 같은 회사 후보만 노출
- 권한 없는 외부 범위 후보 금지

함께 볼 문서:
- `docs/architecture/phase-4-approvals-scope.md`

## 6. 게시판/문서 API

### `GET /api/notices`
### `GET /api/boards`

목적:
- 공지/게시판 목록 조회

대표 성공 응답:
- `items[]`
- board type, visibility, notice-only 여부

### `GET /api/boards/:boardId/posts`

목적:
- 특정 게시판 게시글 목록 조회

guardrail:
- 접근 가능한 게시판 범위만 허용

### `GET /api/posts/:postId`
### `GET /api/posts/:postId/comments`

목적:
- 게시글 상세/댓글 조회

guardrail:
- forged id 접근 차단

### `POST /api/read-receipts`

목적:
- 읽음 확인 생성

대표 요청 body:
- `targetType`
- `targetId`

guardrail:
- forged target id 차단
- 접근 가능한 대상인지 먼저 확인

### `GET /api/documents/spaces`

목적:
- 접근 가능한 문서공간 목록 조회

guardrail:
- private 문서공간은 권한 없는 사용자에게 노출하지 않는다.

### `GET /api/documents/files`

목적:
- 문서 파일 metadata 목록 조회

대표 성공 응답:
- `items[]`: `fileName`, `contentType`, `fileSize`, `versionLabel`, storage 상태 등

### `POST /api/documents/files/metadata`

목적:
- 문서 파일 metadata placeholder 생성

대표 요청 body:
- `spaceId`
- `fileName`
- `contentType`
- `fileSize`
- `versionLabel`
- `isPublicWithinCompany`

대표 성공 응답:
- `file`
- `audit` candidate 정보
- `placeholder: true`

실무 메모:
- 조회 endpoint 가 아니라 업로드/저장 전 단계에서 metadata 레코드를 먼저 만드는 요청이다.
- 실제 저장소 내부 키를 드러내는 문서가 아니다.

### `POST /api/documents/files/upload-init`

목적:
- 업로드 시작 전 metadata 와 업로드 정책 검증

대표 요청 body:
- `spaceId`
- `fileName`
- `contentType`
- `fileSize`

대표 성공 응답:
- `file`
- `upload`: token/provider/url 성격 정보
- `placeholder: true`

대표 오류:
- 허용되지 않은 mime type
- 최대 파일 크기 초과
- private space 접근 불가
- 존재하지 않는 space id

guardrail:
- allowlist/size 제한 유지
- raw storage internals 비노출

### `POST /api/documents/files/:fileId/upload-complete`

목적:
- 업로드 완료 확인

대표 요청 body:
- `uploadToken`
- `checksumSha256?`

대표 성공 응답:
- 갱신된 `file`
- storage status / notice

### `POST /api/documents/files/:fileId/download-init`

목적:
- 다운로드 시작 전 접근 가능한 signed action 후보 반환

대표 성공 응답:
- `file`
- download action 후보

guardrail:
- 접근 가능한 파일만 허용
- raw storage key, secret binding 값 비노출

### `DELETE /api/documents/files/:fileId`

목적:
- 파일 삭제 placeholder 처리

대표 성공 응답:
- 삭제 상태의 `file`

guardrail:
- 권한/회사/문서공간 경계 유지

함께 볼 문서:
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`

## 7. shared contract 와 테스트를 같이 보는 순서

문서를 보고 바로 구현/검증할 때는 아래 순서가 가장 안전하다.

1. route 경로 확인
   - `packages/shared/src/contracts.ts` 의 `appRoutes`
2. 요청/응답 schema 확인
   - 같은 파일의 해당 schema
3. placeholder 구현 확인
   - `apps/api/src/app.ts`
4. 권한/회사 경계/예외 검증 확인
   - `apps/api/test/auth-org.spec.ts`
   - 필요 시 `apps/api/test/document-storage.spec.ts`
5. phase 범위 문서로 guardrail 재확인
   - `docs/architecture/phase-*.md`

## 8. 같이 봐야 하는 문서

- `DATA_MODEL.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `ARCHITECTURE.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- `docs/architecture/phase-11-org-employees-scope.md`
