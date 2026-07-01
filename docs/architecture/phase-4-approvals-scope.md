# 그룹웨어 Phase 4 전자결재 1차 범위

## 1. Phase 목표

이번 Phase의 목표는 Phase 2의 사용자/조직/권한 골격과 Phase 3의 승인 상태/감사 로그 감각을 바탕으로, 전자결재 1차 업무 흐름의 공통 뼈대를 만들고 다음 Phase의 게시판/문서/급여/노무 확장에 재사용할 수 있는 데이터·API·화면·문서 시작점을 고정하는 것이다.

이번 Phase에서 맞추는 기준은 다음과 같다.

- DB 기준: Cloudflare D1 migration 으로 전자결재 핵심 테이블 Production-ready (실구현) 추가
- API 기준: Cloudflare Workers + Hono 기반 결재 양식/결재선/기안/문서함/승인·반려 REST Production-ready (실구현) 추가
- 공통 계약 기준: `packages/shared` 에 approval 타입, route contract, zod schema, 공통 응답 schema 추가
- Web 기준: 목록/기안/상세/승인함 Production-ready (실구현) 화면과 상태 구분 시작점 정리
- 운영 기준: 회사 scope, 문서 접근 권한, 승인 경계, release gate, 보고 자동화 범위 명확화

## 2. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 4 구현자가 바로 참고할 범위 문서 작성
- 전자결재 1차 데이터 모델, API, 화면, 권한, 검증 기준 정의
- 결재 양식/결재선/기안/문서함/승인·반려/참조·합의 후보 흐름의 역할 기준 정리
- 승인 없이 하지 않을 작업과 별도 승인 필요 작업 분리
- GitHub PR/CI/merge/branch cleanup 과 release gate 안에서 다루는 보고 자동화 스크립트 범위 명시

### DB / migration 범위

아래 항목을 D1 기준 1차 골격으로 확장한다.

- `approval_forms`
- `approval_lines`
- `approval_documents`
- `approval_steps`
- `approval_references`

권장 보조 컬럼/연결 기준:

- 모든 전자결재 테이블은 `company_id`, `created_by`, `created_at`, `updated_at`, `status` 기본 컬럼을 가진다.
- 문서 테이블은 최소한 `form_id`, `drafter_employee_id`, `title`, `document_number`, `submitted_at`, `completed_at` 후보를 가진다.
- 결재선/단계 테이블은 최소한 `document_id`, `step_order`, `approver_employee_id`, `step_type`, `decision_status`, `decided_at`, `decision_comment` 후보를 가진다.
- 참조/합의 후보는 `document_id`, `employee_id`, `reference_type`, `read_at` 또는 동급 추적 컬럼을 가진다.
- 양식 테이블은 실제 rich editor 완성형 대신 제목/분류/필드 정의 Production-ready (실구현) 수준 구조를 우선 둔다.

기준:

- 기존 `db/migrations/0003_attendance_leave_phase3.sql` 이후 후속 migration 파일로 추가한다.
- 실제 운영 migration 실행이 아니라 로컬 검증 가능한 SQL Production-ready (실구현) 까지만 다룬다.
- 법적 효력이 필요한 전자서명/본인인증/공인인증 연동 컬럼은 이번 Phase에 넣지 않는다.
- employee/company/role 구조와 audit 로그 방향은 Phase 2~3 계약을 그대로 재사용한다.

### API 범위

대상 파일 기준 시작점은 아래와 같다.

- `apps/api/src/app.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- `apps/api/test/*.spec.ts`

이번 Phase에 포함되는 1차 endpoint 범위:

- `GET /api/approvals/forms`
- `POST /api/approvals/forms`
- `GET /api/approvals/lines`
- `POST /api/approvals/lines`
- `GET /api/approvals/documents`
- `POST /api/approvals/documents`
- `GET /api/approvals/documents/:id`
- `GET /api/approvals/inbox`
- `POST /api/approvals/documents/:id/approve`
- `POST /api/approvals/documents/:id/reject`
- `GET /api/approvals/references/candidates`
- `GET /api/approvals/agreements/candidates`

API 기준:

- Hono route Production-ready (실구현) + request/response schema 검증까지 맞춘다.
- 실제 운영 결재 엔진 대신 local/mock/dev Production-ready (실구현) 흐름으로 둔다.
- 인증 상태, 권한 부족, 접근 불가 문서, 미구현 상태를 공통 응답 형식으로 돌려준다.
- 승인/반려 같은 상태 변경 endpoint 는 감사 로그 후보로 남길 수 있는 구조를 유지한다.
- 기안자 본인, 승인자, 참조자, 합의 후보, 관리자 권한을 분리할 수 있게 route 계약을 잡는다.
- 자기 문서를 자기 승인하는 흐름, 타 회사 문서 접근, 임의 문서 id 처리 같은 guardrail 을 Production-ready (실구현) 단계부터 정의한다.

### shared 계약 범위

`packages/shared` 에 아래를 추가한다.

- approval route 상수
- 결재 양식/결재선/기안/문서함/승인함 schema
- 승인/반려 요청/응답 schema
- 참조/합의 후보 조회 schema
- approval 권한 코드와 공통 에러 코드 확장
- 공통 응답 wrapper 재사용

기준:

- Web과 API가 같이 보는 계약은 shared 에서 먼저 정의한다.
- `health`, `auth`, `org`, `attendance`, `leave` 와 같은 방식으로 zod schema + type export 를 같이 둔다.
- 이후 게시판/문서/급여/노무 확장에서 문서 승인 흐름을 재사용할 수 있어야 한다.

### Web 범위

대상 시작점은 아래와 같다.

- `apps/web/app/approvals/page.tsx`
- 필요 시 `apps/web/app/dashboard/page.tsx`
- 필요 시 `apps/web/app/approvals/*`
- 필요 시 공통 section component

이번 Phase에 포함되는 화면 범위:

- 전자결재 문서 목록 Production-ready (실구현)
- 기안 작성 폼 Production-ready (실구현)
- 문서 상세/결재선/참조자 표시 Production-ready (실구현)
- 승인함/반려함/내 기안함 구분 Production-ready (실구현)
- 승인/반려 action button 과 상태 안내 Production-ready (실구현)

화면 기준:

- 실제 문서 편집기, 첨부파일 업로드, PDF 변환, 인쇄 완성형은 구현하지 않는다.
- API 계약이 아직 mock 이어도, 이후 실제 API 호출 구조로 바꾸기 쉬운 컴포넌트 경계를 잡는다.
- 승인 권한이 없는 사용자가 보는 안내 상태와 승인자가 보는 처리 상태를 구분할 수 있게 한다.
- 화면 문구가 법적 효력이 있는 전자결재가 이미 완성된 것처럼 오해되지 않게 Production-ready (실구현) 표시를 유지한다.

### 문서/운영/자동화 범위

아래 문서 또는 동급 문서에 Phase 4 기준을 반영한다.

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
- `docs/workflow/groupware-kanban-automation.md`
- 필요 시 `scripts/README.md`

정리할 내용:

- 로컬 검증 명령
- Production-ready (실구현) 전자결재 흐름의 한계
- 회사 scope, 문서 접근 권한, 승인/반려 감사 로그 주의
- `gw-hourly-status-report.py` 중심의 정각 보고 스크립트 수정이 GitHub release gate 검토 범위 안에 있다는 점
- 실제 운영 데이터, 실제 배포, production DB migration, 실제 비밀값 입력은 별도 승인 없이는 하지 않는다는 점

## 3. 이번 Phase에서 하지 않는 일

이번 Phase에서 제외하는 일은 아래와 같다.

- 법적 효력이 필요한 전자서명/본인인증/공인인증 연동
- 실제 production 결재 데이터 입력 또는 문서 반입
- production DB migration 실행
- 외부 공개 배포, DNS/R2/도메인 작업
- secret 입력 또는 외부 결재/문서보관 SaaS 연동
- 실제 첨부파일 저장, 대용량 문서 변환, 장기 보관 정책 완성
- 메일/메신저/푸시 승인 알림 실발송
- 회사별 복잡한 결재 규칙 엔진, 병렬/조건부 승인 완성형

## 4. 별도 승인 필요 사항

아래 항목은 다음 단계 후보로 남기되, 실행 전 별도 승인이 필요하다.

1. 실제 운영/스테이징 DB 대상 migration 실행
2. 실사용 전자결재 문서 데이터 반입 또는 수정
3. 전자서명, 본인인증, 인증서 기반 효력 강화 기능 연결
4. 외부 문서보관/전자결재 SaaS 연동
5. 메일/메신저/푸시 승인 알림 연동
6. 외부 공개 URL 오픈 또는 도메인 연결
7. 유료 플랜/리소스 사용
8. 승인된 오케스트레이션 범위 밖의 GitHub merge 및 branch delete

## 5. 구현자가 바로 따라야 할 기준

### 파일/폴더 기준

```text
apps/
  api/
    src/app.ts
    test/
  web/
    app/approvals/
    app/dashboard/
packages/
  shared/
    src/contracts.ts
    src/index.ts
db/
  migrations/
docs/
  architecture/
  guides/
  workflow/
scripts/
```

### 기술 기준

- 전자결재 1차는 결재 양식 정의 + 결재선 관리 + 문서 기안/상세/승인함 Production-ready (실구현) 을 기준으로 문서화한다.
- 문서 본문은 완성형 editor 보다 제목/요약/필드 Production-ready (실구현) 중심으로 시작한다.
- API 는 Hono REST 형식을 유지하고 공통 응답 wrapper 를 강제한다.
- 민감한 문서 본문, 실제 개인정보, 실제 결재 사유 전문은 로그에 남기지 않는다.
- Web 에서 버튼을 숨겨도 API 에서 서버 측 권한 검증을 한다는 전제를 유지한다.
- 전자결재 승인 흐름은 이후 게시판/문서/급여 승인 재사용이 가능하도록 타입과 상태값을 단순하고 명확하게 둔다.

### 데이터/권한 기준

- 회사 기준 멀티테넌시를 깨지 않도록 `company_id` 범위를 명확히 둔다.
- 문서는 기안자/승인자/참조자/관리자 관점이 구분되어야 한다.
- 최소 권한 후보는 `approval.form.manage`, `approval.line.manage`, `approval.document.read`, `approval.document.write`, `approval.document.approve` 를 시작점으로 둔다.
- 승인/반려/참조 등록은 상태값과 처리 주체를 추적할 수 있어야 한다.
- 감사 로그 후보는 최소한 actor, action, target, created_at 정도의 기본 골격을 가진다.
- 자기 문서 자기 승인 금지, 타 회사 문서 접근 금지, 권한 없는 문서함 접근 금지를 Production-ready (실구현) 단계부터 검증 대상으로 둔다.

## 6. 최소 검증 기준

이번 Phase 구현 카드가 로컬에서 확인해야 하는 최소 기준은 아래와 같다.

- `pnpm install` 가능
- `pnpm check` 통과
- `pnpm build` 또는 저장소 표준 build 명령 통과
- `pnpm typecheck` 통과
- `pnpm test` 통과
- approval shared schema 테스트 추가 및 통과
- API 테스트에 결재 양식/결재선/기안/상세/승인/반려/문서 접근 경계 기본 케이스 포함
- Web Production-ready (실구현) 이 최소한 build 또는 typecheck 를 깨지 않음
- README/가이드/운영 문서에 로컬 검증 순서와 승인 필요 범위가 정리됨
- 감시/보고 스크립트를 건드렸다면 release gate 검토 범위와 중복 보고 방지 기준이 문서에 반영됨

주의:

- 실제 운영 비밀값 없이 가능한 범위 안에서만 검증한다.
- 일부 명령이 패키지 구조상 filter 기반으로 나뉘면 저장소 표준 명령과 함께 결과를 남긴다.

## 7. 완료 기준

이번 Phase는 아래 조건을 모두 만족하면 완료로 본다.

1. Phase 4 범위 문서가 저장소 안에 있고 구현자가 바로 참조할 수 있다.
2. D1 migration 에 전자결재 1차 골격이 추가되어 있다.
3. `packages/shared` 에 approval 계약과 공통 응답 schema 확장이 정리되어 있다.
4. `apps/api` 에 결재 양식/결재선/기안/상세/문서함/승인·반려 기본 endpoint Production-ready (실구현) 이 있다.
5. `apps/web` 에 전자결재 목록/기안/상세/승인함 기본 화면 Production-ready (실구현) 이 있다.
6. 회사 scope, 문서 접근 경계, 자기 문서 자기 승인 금지 같은 guardrail 이 문서와 리뷰 기준에 반영되어 있다.
7. `gw-hourly-status-report.py` 를 포함한 승인된 감시/보고 스크립트 변경이 release gate 검토 범위에 포함된다는 점이 문서화되어 있다.
8. 승인된 release gate 범위 안에서 PR 생성, CI 확인, merge, branch cleanup 처리 조건이 분명하다.
9. 다음 Phase의 게시판/문서/급여 승인 확장을 막지 않는 수준으로 handoff 정보가 정리되어 있다.

## 8. 승인/리뷰 체크포인트

구현 전에 다시 확인할 항목:

- 결재선/합의/참조를 각각 별도 endpoint 로 둘지, 문서 상세 안에 묶어서 둘지
- 문서함을 `내 기안함/내 승인함/참조 문서함` 으로 나눌지, 단일 목록 + 필터로 시작할지
- 승인/반려 endpoint 를 분리할지, 상태 변경 endpoint 하나로 둘지

구현 후 리뷰에서 반드시 볼 항목:

- 문서 본문/사유/참조자 데이터에 민감한 실운영 값이 남지 않았는지
- company scope 누락으로 타 회사 문서가 섞일 여지가 없는지
- 기안자/승인자/참조자 권한이 뒤섞이지 않았는지
- Web Production-ready (실구현) 가 법적 효력이 있는 전자결재 완성본처럼 오해되지 않는지
- 감시/보고 스크립트 수정 시 blocked/review-required/중복 보고 기준이 깨지지 않았는지

## 9. 다음 작업자 handoff

다음 구현 카드는 아래 순서로 진행하면 된다.

1. `packages/shared` 에 approval route, schema, 타입을 먼저 추가한다.
2. API 테스트에서 양식/결재선/기안/상세/승인/반려의 기대 응답과 guardrail 을 먼저 고정한다.
3. `apps/api/src/app.ts` 에 전자결재 route Production-ready (실구현) 을 추가한다.
4. `db/migrations` 에 후속 전자결재 migration 파일을 추가한다.
5. `apps/web/app/approvals` 와 `dashboard` 를 shared 계약 기준 Production-ready (실구현) 로 연결한다.
6. README/개발 가이드/사용자 가이드/운영 가이드/자동화 문서의 검증 명령과 주의사항을 맞춘다.
7. `pnpm install/check/build/typecheck/test` 가능한 범위를 실제로 확인하고 결과를 handoff 에 남긴다.

주의 사항:

- 실제 전자결재 문서 데이터 반입은 하지 않는다.
- production DB, 외부 전자서명/문서보관 SaaS, 유료 알림 리소스, 공개 배포는 별도 승인 전까지 건드리지 않는다.
- approval 상태/권한 설계는 이후 확장을 염두에 두되, 이번 Phase에서는 1차 Production-ready (실구현) 과 guardrail 정리에 집중한다.
