# API

## 문서 목적

이 문서는 현재 저장소 기준 same-origin `/api/*` 계약을 빠르게 이해하기 위한 루트 문서다.

중요:
- 기본 경로는 same-origin `/api/*` 다.
- 공통 route/schema 의 1차 기준은 `packages/shared/src/contracts.ts` 다.
- placeholder 구현과 guardrail 의 1차 기준은 `apps/api/src/app.ts`, `apps/api/test/auth-org.spec.ts` 다.
- preview 전용 절대 API hostname 을 제품 기본값으로 문서에 고정하지 않는다.

## 공통 규칙


### API 운영 완료 기준

- API route가 존재하거나 200을 반환하는 것만으로 완료가 아니다. mutation은 Service/Repository/DB 계층을 통과해야 한다.
- DB/R2/schema가 필요한 기능은 미설정 상태에서 sample, memory, mock, fallback 데이터로 성공처럼 응답하지 않는다. `DB_NOT_CONFIGURED`, schema drift, validation, forbidden, not found를 구분한다.
- 생성/수정/삭제/상태변경은 저장 후 동일 권한·scope로 재조회해 id/status/value가 유지되는지 검증해야 한다.
- 관리자/권한/계정/문서/결재/근태/휴가/급여처럼 운영상 중요한 변경은 audit_logs 또는 동등한 감사 기록을 남겨야 한다.
- preview DB는 UAT용 실제 저장·조회 검증 대상이다. production DB 실데이터, secret, DNS/custom domain, 유료 리소스, 외부 연동, destructive migration은 별도 승인 게이트다.
- 테스트 fixture와 mock은 테스트 내부에서만 허용하며 운영 응답 contract의 성공 source로 남기지 않는다.

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
| Phase 24 제안 | `/api/me/home-layout`, `/api/branches`, `/api/branch-assignments`, `/api/branch-tasks`, `/api/branch-reports` | 문서 초안만 있음, shared contract/API 미구현 | 문서에만 먼저 고정, 실저장/실데이터/PMS 연동 과장 금지 |
| Phase 25 공통 업무 엔진 | `/api/work-items`, `/api/work-items/:id`, `/api/work-items/:id/documents`, `/api/work-items/:id/attachments`, `/api/work-items/:id/reviews`, `/api/work-item-deadlines` | `workItem*Schema`, `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts` | placeholder read-only 유지, 역할/지점 scope 차단, 민감 첨부 metadata-only, `work_item.audit.read` 없는 audit 비노출 |
| Phase 28 세무 관리 | `/api/work-items?module=tax`, `/api/work-item-deadlines`, `/api/work-items/:id/reviews` | `workItem*Schema`, `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts` | tax도 공통 work item 기반 유지, 지점 제출 vs HQ 검토 분리, metadata-only 세무 자료, 실제 홈택스/외부 전송 미포함 |
| Phase 28A 급여 foundation | `/api/payroll`, `/api/payroll/periods/:id`, `/api/payroll/me/payslip` | `payroll*Schema`, `apps/api/test/auth-org.spec.ts` | preview 금액과 확정값 분리, employee self-only payslip, manager/hq visibility 분리, 외부 급여/세무 연동 미포함 |
| Phase 29 법무 관리 | `/api/work-items?module=legal`, `/api/work-items/:id/reviews` | `workItem*Schema`, `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts` | legal도 공통 work item 기반 유지, 지점 요청 vs HQ 법무 검토 분리, metadata-only 계약/분쟁 자료, 실제 외부 자문/기관 제출 미포함 |

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

### Phase 24 제안 API: 모바일 `홈` + `지점/호텔 코드`

중요:
- 아래 항목은 이번 문서 보강에서 먼저 고정한 제안 API 초안이다.
- 현재 저장소에 shared contract, placeholder 응답, 구현 route, guardrail test 가 아직 없다.
- 따라서 "이미 동작하는 API" 처럼 쓰면 안 된다.

#### 제안 1) `GET /api/me/home-layout`

목적:
- 모바일 `홈` 에서 고정 필수 메뉴와 사용자 선택/정렬 가능한 메뉴를 함께 내려 주는 초안 endpoint

의도하는 응답 방향:
- `fixedItems[]`: 회사가 기본 제공하는 고정 메뉴
- `customItems[]`: 사용자가 선택/정렬한 메뉴
- `availableItems[]`: `메뉴` 전체 기능 선택 화면과 같은 registry 기반 항목
- `storageMode`: `dev_safe_local | profile_skeleton | future_persistent`

guardrail 초안:
- 필수 고정 메뉴는 응답에서 빠지지 않는다.
- 사용자가 볼 수 없는 권한 메뉴는 `availableItems[]` 에서도 제거한다.
- 이번 Phase 24 문서에서는 production DB 영구 저장이 아니라 dev-safe/local/profile skeleton 전제를 유지한다.

현재 이후 API 완료 기준:
- 과거 Phase 문서에 남은 `dev-safe`, `placeholder`, `skeleton` 표현은 당시 단계의 이력으로만 본다.
- 현재 개발은 실제 사용할 그룹웨어를 만드는 기준이며, Cloudflare `workers.dev` preview URL은 preview DB 기반 UAT 환경으로 본다.
- mutation API는 route 200 또는 mock 응답만으로 완료하지 않고 preview DB에서 생성 → 저장 → 재조회가 되는지 확인한다.
- preview DB schema/migration/seed/검증용 데이터 준비는 승인된 작업카드 범위 안에서 진행할 수 있다. production DB, production 실데이터, DNS/custom domain, 유료 리소스, secret 입력·교체·출력, destructive 작업은 별도 승인 게이트다.

#### 제안 2) `GET /api/branches`

목적:
- 회사 하위 `지점/호텔 코드` 목록을 역할 범위에 맞게 보여 주는 초안 endpoint

의도하는 응답 방향:
- `items[]`: `branchId`, `branchCode`, `branchName` 또는 `hotelName`, `status`
- `scope`: `hq_admin | branch_manager | employee`
- `placeholder: true` 또는 문서 초안 단계 표시

guardrail 초안:
- 본사 관리자는 전체 지점을 볼 수 있다.
- 지점 관리자는 자기 지점 범위만 본다.
- 일반 근무자는 자기 배정 지점만 본다.

#### 제안 3) `GET /api/branch-assignments`

목적:
- 직원-지점 배정 요약을 운영 검토용으로 보는 초안 endpoint

의도하는 응답 방향:
- `items[]`: `employeeId`, `branchId`, `roleInBranch`, `primary`, `startsAt`, `endsAt`
- 미배정 사용자는 별도 `assignmentStatus: needs_branch_assignment`

guardrail 초안:
- 일반 직원에게 전체 배정 목록을 그대로 열지 않는다.
- 관리자용 검토와 일반 사용자 자기 상태 확인 응답을 같은 endpoint 라도 다른 scope 로 나눠야 한다.

#### 제안 4) `GET /api/branch-tasks`, `GET /api/branch-reports`

목적:
- 지점 업무/보고 템플릿을 지점 범위에 맞게 보여 주는 초안 endpoint

의도하는 응답 방향:
- 업무 예시: 체크리스트, 일일 운영, 시설/고장, 고객 컴플레인, 비품/재고, 인수인계
- 응답에는 `branchVisibility`, `requiresManagerReview`, `placeholder` 같은 설명 필드를 함께 둔다.

guardrail 초안:
- 지점 미배정 사용자는 데이터 대신 `지점 배정 필요` 안내를 먼저 본다.
- 다른 지점 데이터는 UI 뿐 아니라 API 에서도 차단한다.
- 외부 PMS/호텔 운영 시스템 연동 상태를 이미 연결된 것처럼 응답하지 않는다.

### Phase 25 API: 공통 `work item` + 문서/검토/마감 엔진

중요:
- 아래 항목은 문서 제안에만 머문 것이 아니라, 현재 저장소의 shared contract + placeholder read-only route + 권한 경계 테스트까지 같이 들어와 있는 Phase 25 1차 기준이다.
- 다만 이 API는 아직 실민감 원문 저장, 외부 전문가 연동, 실제 신고/제출 자동화가 아니라 dev-safe placeholder 응답 단계다.
- 따라서 "실운영 처리까지 끝난 업무 API" 처럼 쓰면 안 되고, 현재는 공통 엔진 구조와 guardrail 을 검증하는 skeleton 으로 읽어야 한다.

#### 1) `GET /api/work-items`

목적:
- HR·세무·노무·법무·지점 운영 업무를 같은 리스트 구조로 보여 주는 공통 endpoint

대표 응답 방향:
- `items[]`: `id`, `module`, `category`, `title`, `status`, `priority`, `dueAt`, `reviewRequired`, `containsSensitiveData`, `access`, `auditSummary`, `placeholder`
- `availableModules[]`
- `scopeSummary`
- `placeholder: true`

guardrail:
- 회사가 다르면 조회 차단
- 같은 회사 안에서도 역할/지점 scope 에 맞는 업무만 내려간다.
- `module` query filter 는 허용된 enum 안에서만 동작한다.

근거:
- `packages/shared/src/contracts.ts` 의 `appRoutes.workItems.list`, `workItemListResponseSchema`
- `apps/api/src/app.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`

#### 2) `GET /api/work-items/:workItemId`

목적:
- 공통 업무 상세와 상태/담당/마감/검토/감사 요약을 보여 주는 endpoint

대표 응답 방향:
- `item`: 기본 업무 필드
- `documentsSummary[]`
- `reviewsSummary[]`
- `deadlines[]`
- `auditLogs[]`

guardrail:
- UI 에서 버튼이 보여도 실제 변경 가능 여부는 capability 기준으로 다시 판단한다.
- `work_item.audit.read` 가 없으면 상세는 보여도 `auditLogs[]` 는 비운다.
- visibility boundary 밖 업무 요청은 403 으로 차단한다.

근거:
- `packages/shared/src/contracts.ts` 의 `workItemDetailResponseSchema`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`

#### 3) `GET /api/work-items/:workItemId/documents`, `GET /api/work-items/:workItemId/attachments`

목적:
- 업무에 연결된 문서/첨부 메타데이터를 공통 구조로 보여 주는 endpoint

대표 응답 방향:
- 문서: `documentType`, `title`, `status`, `visibility`, `containsSensitiveData`, `accessNote`, `updatedAt`
- 첨부: `fileName`, `category`, `uploadedBy`, `uploadedAt`, `sensitivityLabel`, `storageExposure`, `previewAvailable`

guardrail:
- raw storage key, signed/public URL 전문, 민감 원문 경로는 기본 응답에서 비노출한다.
- 민감 첨부는 허용 role 이 아니면 403 또는 빈 목록으로 차단한다.
- 첨부 응답은 `metadata_only` 와 `previewAvailable: false` 경계를 유지한다.

근거:
- `packages/shared/src/contracts.ts` 의 `workItemDocumentsResponseSchema`, `workItemAttachmentsResponseSchema`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`

#### 4) `GET /api/work-items/:workItemId/reviews`

목적:
- 공통 검토 흐름을 업무 모듈과 분리해 같은 구조로 보여 주는 endpoint

대표 응답 방향:
- `items[]`: `reviewerRoleCode`, `decision`, `summary`, `reviewedAt`
- `reviewRequired`

guardrail:
- review history 는 read-only 감사 성격을 먼저 유지한다.
- 결재/법무/노무처럼 민감도가 높은 검토도 같은 endpoint 골격을 쓰되, 상세 노출 범위는 capability 로 다시 제한한다.

근거:
- `packages/shared/src/contracts.ts` 의 `workItemReviewsResponseSchema`
- `apps/api/test/auth-org.spec.ts`

#### 5) `GET /api/work-item-deadlines`

목적:
- 모듈별 마감 규칙과 임박 상태를 공통 형식으로 보여 주는 endpoint

대표 응답 방향:
- `items[]`: `id`, `workItemId`, `title`, `dueAt`, `status`, `ownerScope`, `escalationNote`

guardrail:
- 실제 세무/노무 법정 기한 계산 완료처럼 보이면 안 된다.
- viewer 가 볼 수 있는 work item 에 연결된 deadline 만 내려간다.

근거:
- `packages/shared/src/contracts.ts` 의 `workItemDeadlinesResponseSchema`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`

### Phase 26 API 계획: HR meeting/lifecycle skeleton

중요:
- 아래 항목은 "실제 있는 read-only placeholder API + 아직 닫아 둔 운영 기능"을 함께 설명하는 문단이다.
- 즉 `apps/api/src/app.ts` 에서 `GET /api/work-items?module=hr`, `GET /api/work-items/:workItemId` 수준의 skeleton 응답은 이미 확인할 수 있지만, 실제 캘린더/메일/민감 원문 처리까지 열린 운영 API 는 아니다.

권장 방향:

#### 1) `GET /api/work-items?module=hr`

목적:
- 기존 HR work item 목록을 온보딩/1:1/인사면담/평가/고충/교육/지점 운영 meeting 문맥까지 읽히게 확장하는 endpoint 방향

대표 응답 방향:
- 기존 공통 item 필드 유지
- 현재 placeholder 에서 바로 보이는 축: `category`, `access.viewerScope`, `access.allowedRoleCodes`, `hrContext.lifecycleStage`, `hrContext.scheduleStatus`, `hrContext.confidentialityLevel`, `hrContext.followUp.required`

guardrail:
- 주 상태는 계속 공통 상태를 유지한다.
- 지점 관리자에게는 자기 지점/필요 범위만 내려가고, 본사 HR 보다 좁은 HR visibility 를 유지한다.
- 일반 직원은 자기 관련 item 만 본다.

#### 2) `GET /api/work-items/:workItemId`

목적:
- 기존 공통 상세에 meeting summary, 참석자 요약, 후속조치 요약을 얹는 endpoint 방향

대표 응답 방향:
- 현재 placeholder 상세는 `hrContext` 아래 `scheduleStatus`, `meetingMode`, `confidentialityLevel`, `notesPreview`, `privateNoteExists`, `participants[]`, `agendaItems[]`, `followUp`, `visibility` 를 직접 내려준다.
- 문서상 `meetingSummary` / `followUpsSummary[]` 같은 분리형 응답은 이후 shape 후보로 볼 수 있지만, 지금 저장소 기준 확인 포인트는 단일 상세의 `hrContext` 다.

guardrail:
- 참석자와 모든 메모 열람권한을 같은 뜻으로 취급하지 않는다.
- `grievance_restricted` 같은 민감 범위는 `work_item.grievance.read_restricted` 같은 더 좁은 capability 로 다시 제한하고, COMPANY_ADMIN 일반 가시범위와 분리한다.

#### 3) `GET /api/work-items/:workItemId/attendees`, `GET /api/work-items/:workItemId/agendas`, `GET /api/work-items/:workItemId/follow-ups`

목적:
- 참석자/안건/후속조치를 metadata 중심으로 보여 주는 candidate endpoint 방향

guardrail:
- 실제 회의록 원문, 외부 초대 링크, 메일/메신저 발송 결과를 기본 응답에 싣지 않는다.
- private note 원문 대신 존재 여부와 visibility 설명만 먼저 다룬다.
- 외부 캘린더 연동은 이번 단계에서 문서상 승인 게이트로 남긴다.

현재 확인 포인트:
- 상세 placeholder 하나만으로도 `participants[]`, `agendaItems[]`, `followUp`, `visibility` 가 이미 내려오므로, 별도 하위 endpoint 는 "추가 분리 가능 후보"로 읽는다.

### Phase 27 API 계획: labor issue/evidence skeleton

중요:
- 아래 항목은 "기존 공통 work-item placeholder 위에 labor 맥락을 추가할 후보"를 설명하는 문단이다.
- 즉 `apps/api/src/app.ts` 에서 `GET /api/work-items?module=labor` 같은 공통 work-item 틀은 이미 확인할 수 있지만, 실제 계약서/징계/사고 원문 처리나 급여/외부 전문가 연동까지 열린 운영 API 는 아니다.

권장 방향:

#### 1) `GET /api/work-items?module=labor`

목적:
- 기존 labor work item 목록을 계약/조건변경/연차정정/수당검토/고충/징계/사고/퇴사 문맥까지 읽히게 확장하는 endpoint 방향

대표 응답 방향:
- 기존 공통 item 필드 유지
- Phase 27에서 추가로 읽히게 할 축: `category`, `access.viewerScope`, `access.allowedRoleCodes`, `laborContext.intakeStatus`, `laborContext.confidentialityLevel`, `laborContext.requiresAcknowledgement`, `laborContext.legalHoldRequired`, `laborContext.evidenceSummary[]`

guardrail:
- 주 상태는 계속 공통 상태를 유지한다.
- 지점 관리자에게는 자기 지점/필요 범위만 내려가고, 본사 노무 담당보다 좁은 labor visibility 를 유지한다.
- 일반 직원은 자기 관련 item 만 본다.

#### 2) `GET /api/work-items/:workItemId`

목적:
- 기존 공통 상세에 labor summary, 근거 자료 요약, 검토 주체, 후속조치 요약을 얹는 endpoint 방향

대표 응답 방향:
- 현재 placeholder API 는 `laborContext` 아래 `intakeStatus`, `confidentialityLevel`, `requiresAcknowledgement`, `legalHoldRequired`, `evidenceSummary[]`, `reviewActors[]`, `followUp`, `visibility`, `auditHints` 를 실제로 내려주는 형태다.

guardrail:
- 관련자와 모든 메모 열람권한을 같은 뜻으로 취급하지 않는다.
- `grievance_restricted`, `disciplinary_restricted` 같은 민감 범위는 일반 COMPANY_ADMIN 가시범위와 분리된 더 좁은 capability 로 다시 제한한다.

#### 3) `GET /api/work-items/:workItemId/evidence`, `GET /api/work-items/:workItemId/review-actors`, `GET /api/work-items/:workItemId/follow-ups`

목적:
- 근거 자료/검토 주체/후속조치를 metadata 중심으로 보여 주는 candidate endpoint 방향

guardrail:
- 실제 계약서 원문, 징계 문서 원문, 사고 신고 원문, 외부 제출 결과를 기본 응답에 싣지 않는다.
- private/restricted note 원문 대신 존재 여부와 visibility 설명만 먼저 다룬다.
- 외부 노무/법무/급여 연동은 이번 단계에서 문서상 승인 게이트로 남긴다.

현재 확인 포인트:
- 현재는 `/api/work-items?module=labor` 와 공통 상세 구조 위에 laborContext 를 얹는 방향으로 맞춰져 있고, 별도 하위 endpoint 는 나중에 분리할 수 있는 후보로만 남겨 둔다.
- EMPLOYEE self-scope 도 이제 문서 문구만이 아니라 `work_item_labor_leave_balance_adjustment` placeholder 로 실제 목록/상세 응답에 연결돼 있다.

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
- 출퇴근 정책 2차에서는 회사 기본, 근무지/지점, 부서/팀, 직무/역할 기준 preview 를 같은 카드에서 비교

대표 성공 응답:
- `items[]`: `category`, `summary`, `lastReviewedAt`, `reasonRequired`, `diffPreview`
출퇴근 정책 카드에는 `priorityOrder`, `scopeSummaries`, `policySubjectSummaries`, `duplicateWarnings` 같은 정책 적용 정보가 함께 포함될 수 있음

guardrail:
- 운영 정책 preview 는 마스킹/후보 수준으로만 노출한다.
- 적용 인원/대상 직원 정보는 정책 검토용이며 실제 조직 데이터 일괄 반영이나 개인별 override 저장처럼 동작하면 안 된다.
- GPS/위치정보, 실제 태그 단말, 외부 HR 연동 상태를 이미 연결된 것처럼 응답하지 않는다.

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

대표 오류:
- 400 `VALIDATION_ERROR`: 등록 방식 값이 `mobile | pc | tag` 가 아님
- 403 `FORBIDDEN`: 요청 방식이 본인 `effective policy` 에 포함되지 않음

정책 기준:
- employee 기준 `effective policy` 를 계산한 뒤 허용된 방식만 성공 처리
- winner source 는 `company_default < workplace < department < job_type` 우선순위 중 마지막 매칭값
- details/summary 는 왜 차단됐는지 설명할 수 있어야 하지만, 실장비 인증 완료나 GPS 검증 완료처럼 과장하지 않는다.

guardrail:
- 상태 변경이라도 placeholder 임을 숨기지 않는다.
- `tag` 허용은 skeleton 안내 범위이며, 실제 NFC/RFID/QR 장비 연동 성공을 의미하지 않는다.

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

## 7. Phase 28A 급여 foundation API 메모

이 단계의 급여 API 는 실제 지급/신고 API 가 아니라, 급여 기초자료 수집과 명세서 초안을 dev-safe skeleton 으로 보여 주는 same-origin placeholder 묶음이다.

### `GET /api/payroll`

목적:
- 급여 프로필 목록, 지급 기간 목록, collection/review step, 역할별 안내를 한 번에 보여 준다.

대표 응답:
- `profiles`
- `periods`
- `collectionSteps`
- `roleGuidance`
- `placeholder: true`

문서상 지원 급여 유형:
- `monthly`
- `hourly`
- `daily`
- `annual`
- `inclusive`

현재 확인 포인트:
- 직원별 프로필은 `basePay`, `hourlyRate`, `dailyRate`, `annualSalary`, `inclusiveAllowance`, `standardWorkHours`, `payDay`, `effectiveFrom/to` 를 같은 contract 언어로 가진다.
- 본사 급여 담당은 여러 프로필과 기간 상태를 넓게 본다.
- 지점 관리자는 자기 지점 수집 단계 안내 위주로 본다.
- 일반 직원은 자기 프로필과 employee scope collection step 만 본다.

guardrail:
- overview 에서 보이는 금액/상태를 실지급 확정이나 외부 신고 완료로 설명하지 않는다.
- 지점 관리자가 company-wide 급여 상세를 보는 API처럼 문서화하지 않는다.

### `GET /api/payroll/periods/:id`

목적:
- 특정 급여 기간의 초안 상세를 보여 준다.

대표 응답:
- `period`
- `draft`
- `inputSnapshot`
- `lineItems`
- `reviewSteps`
- `roleGuidance`
- `placeholder: true`

현재 확인 포인트:
- `inputSnapshot` 은 근무시간, 연장/야간/휴일, 유급/무급 휴가, 결근/지각/조퇴 같은 payroll 입력 근거를 담는다.
- `lineItems` 는 `classification`, `source`, `quantity`, `unitAmount`, `premiumRate`, `amount`, `note` 를 함께 내려 준다.
- 현재 placeholder 예시에는 기본 근무시간, 연장근로, 야간근로, 식대, 원천세 placeholder, 4대보험 placeholder 가 포함된다.
- HQ viewer 는 detail preview 를 보지만, 테스트 기준으로 MANAGER 는 이 상세 endpoint 에서 `FORBIDDEN` 이다.

guardrail:
- tax/insurance line item 은 확정 세액/확정 보험료가 아니라 placeholder 다.
- 포괄임금제 비교/초과 판단이 필요해도 자동 차감 규칙이 이미 확정된 것처럼 쓰지 않는다.

### `GET /api/payroll/me/payslip`

목적:
- 구성원이 자기 급여명세서 초안만 self-only 로 확인하게 한다.

대표 응답:
- `period`
- `payslip`
- `lineItems`
- `employeeMessage`
- `correctionRequestGuide`
- `placeholder: true`

권한 메모:
- `payroll.payslip.read_self` 권한이 있는 employee 만 접근한다.
- 테스트 기준으로 MANAGER 는 403 이고, EMPLOYEE 는 자기 payslip preview 만 본다.
- 직원이 보지 못하는 기간 상세나 다른 직원 명세서를 같은 흐름으로 섞지 않는다.

승인 게이트:
- 실제 급여 지급, 은행 이체, 주민등록번호/계좌번호 입력, 홈택스/4대보험 신고, 외부 회계/세무 프로그램 연동은 이 API 범위가 아니다.

근거:
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

## 8. Phase 28 세무 관리 API 메모

이 단계의 세무 API 는 실제 신고 제출/외부 전송 API 가 아니라, 지점별 세무 증빙 수집·마감 점검·검토·반려·전달 패키지 준비를 공통 `work item` 기반 same-origin placeholder 로 보여 주는 묶음이다.

### `GET /api/work-items?module=tax`

목적:
- 세무 work item 목록, category, 지점 제출 상태, 마감 임박 여부, 역할별 안내를 한 번에 보여 준다.

대표 응답:
- `items`
- `module: "tax"`
- `category`
- `status`
- `dueAt`
- `access`
- `taxContext`
- `placeholder: true`

현재 확인 포인트:
- 세무 종류 차이는 `evidence_collection`, `vat_closing`, `withholding_tax_filing`, `local_tax_report`, `corporate_tax_preparation`, `missing_receipt_follow_up`, `tax_adjustment_review`, `advisor_package_preparation` 같은 category 확장으로 읽힌다.
- `work_item_tax_month_end_evidence` 는 branch scope 예시로 `taxContext.branchRequests`, `evidenceSummary`, `visibility.branchManager` 가 실제로 채워진다.
- `work_item_tax_vat_package_preparation` 는 company scope 예시로 `taxContext.packagePreparation.status = ready_for_review`, `visibility.headquartersTax` 가 실제로 채워진다.
- 본사 세무 담당은 여러 지점 세무 목록과 회수율을 넓게 본다.
- 지점 관리자는 자기 지점 제출/보완 요청 문맥만 본다.
- 감사 사용자는 상태 변경/접근 흔적 중심 read-only 안내를 본다.

guardrail:
- 세무 목록 상태를 실제 신고 완료나 외부 제출 완료로 설명하지 않는다.
- 지점 관리자가 company-wide 세무 패키지 전체를 보는 API처럼 문서화하지 않는다.

### `GET /api/work-item-deadlines`

목적:
- 세무 마감 일정을 공통 deadline 구조 안에서 보여 준다.

대표 응답:
- `deadlines`
- `module`
- `dueAt`
- `priority`
- `reviewRequired`
- 세무 카드의 `taxContext.deadlineKind` 와 함께 읽는 deadline 요약
- `placeholder: true`

현재 확인 포인트:
- 세무 일정은 `monthly`, `quarterly`, `semiannual`, `annual` 같은 주기를 설명할 수 있어야 한다.
- 부가세/원천세/지방세/법인세 마감과 지점별 자료 회수 필요 상태가 같은 목록에서 읽혀야 한다.
- 일정은 skeleton 마감 안내이지, 법정 자동 계산 엔진이나 실제 신고 제출 스케줄 확정값이 아니다.

guardrail:
- 마감일을 실제 홈택스 제출 완료 시각처럼 쓰지 않는다.
- legal calculator 또는 외부 연동 완료처럼 읽히는 문구를 넣지 않는다.

### `GET /api/work-items/:id/reviews`

목적:
- HQ 세무 담당 검토, 지점 보완 요청, 감사용 상태 변경 흔적을 공통 review skeleton 으로 보여 준다.

대표 응답:
- `reviews`
- `status`
- `requestedChanges`
- `roleGuidance`
- `placeholder: true`

현재 확인 포인트:
- 누락/반려/보완 요청이 실제 외부 반송이나 신고 실패가 아니라 내부 검토 단계임을 숨기지 않는다.
- review actor 는 본사 세무 담당 / 지점 관리자 / 감사 역할 차이를 읽히게 해야 한다.
- 세무 자료 원문보다 metadata 중심 변경 이력과 상태 설명을 우선한다.
- branch scope 제출 카드 review 와 HQ package 카드 review 가 같은 route 구조를 쓰더라도, 실제 열람 범위는 role/branch/company 경계로 계속 갈린다.

승인 게이트:
- 실제 홈택스 제출, 세무사 메일 발송, 회계프로그램/외부 세무 계정 연동, 실세무 원문 업로드 확대는 이 API 범위가 아니다.

근거:
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`

## 8-A. Phase 29 법무 관리 API 메모

이 단계의 법무 API 는 실제 계약 원문 저장/외부 자문 전달 API 가 아니라, 계약 검토 요청·계약 갱신일·분쟁/클레임/보험/사고 후속을 공통 `work item` 기반 same-origin placeholder 로 보여 주는 묶음이다.

### `GET /api/work-items?module=legal`

목적:
- 법무 work item 목록, category, 계약 유형, 갱신 예정 여부, 역할별 안내를 한 번에 보여 준다.

대표 응답:
- `items`
- `module: "legal"`
- `category`
- `status`
- `dueAt`
- `access`
- `legalContext`
- `placeholder: true`

현재 확인 포인트:
- 현재 저장소 대표 fixture 는 `work_item_legal_contract_review`(company scope 계약 검토), `work_item_legal_contract_renewal`(branch scope 갱신 검토), `work_item_legal_dispute_intake`(company scope 분쟁/클레임 사실확인) 3건이다.
- 법무 종류 차이는 `contract_review`, `contract_renewal`, `hotel_management_agreement`, `lease_agreement`, `service_agreement`, `partner_agreement`, `personal_data_processing_agreement`, `dispute_intake`, `claim_response`, `insurance_case`, `incident_legal_follow_up` 같은 category 확장 방향으로 읽힌다.
- 본사 법무/운영 담당은 여러 지점 계약 요청과 갱신/분쟁 후속 상태를 넓게 본다.
- 지점 관리자는 자기 지점 관련 요청/보완 요청 문맥만 본다.
- 감사 사용자는 상태 변경/접근 흔적 중심 read-only 안내를 본다.
- 실제 응답의 `legalContext` 는 `intakeStatus`, `contractType`, `renewalStatus`, `renewalDueAt`, `disputeStatus`, `externalCounselStatus`, `sensitiveDocumentStatus`, `relatedBranchRequests`, `documentSummary`, `reviewActors`, `approvalGate`, `visibility`, `auditHints` 를 포함한다.

guardrail:
- 법무 목록 상태를 실제 계약 체결 완료나 외부 자문 완료로 설명하지 않는다.
- 지점 관리자가 company-wide 민감 계약/분쟁 자료 전체를 보는 API처럼 문서화하지 않는다.

### `GET /api/work-items/:id/reviews`

목적:
- 본사 법무/운영 담당 검토, 지점 보완 요청, 감사용 상태 변경 흔적을 공통 review skeleton 으로 보여 준다.

대표 응답:
- `reviews`
- `status`
- `requestedChanges`
- `roleGuidance`
- `placeholder: true`

현재 확인 포인트:
- 보완 요청/승인 대기가 실제 외부 회신이나 기관 제출 결과가 아니라 내부 검토 단계임을 숨기지 않는다.
- review actor 는 본사 법무/운영 담당 / 지점 관리자 / 감사 역할 차이를 읽히게 해야 한다.
- 계약/분쟁 자료 원문보다 metadata 중심 변경 이력과 상태 설명을 우선한다.
- contract review 카드와 추후 dispute/renewal 카드가 같은 route 구조를 쓰더라도, 실제 열람 범위는 role/branch/company 경계로 계속 갈린다.

승인 게이트:
- 실제 계약 원문 저장 확대, 외부 변호사 메일 발송, 보험사/기관 제출 연동, 실분쟁 자료 업로드 확대는 이 API 범위가 아니다.

근거:
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/auth-org.spec.ts`

## 9. shared contract 와 테스트를 같이 보는 순서

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

## 10. 같이 봐야 하는 문서

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
