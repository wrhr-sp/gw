# 그룹웨어 Phase 10 관리자/감사 로그 2차 고도화 범위

## 1. 한 줄 정의

Phase 10 의 목표는 Phase 9 에서 고정한 `/admin/*` 경계와 감사 로그 skeleton 을 바탕으로, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 다음 구현자가 바로 확장할 수 있을 정도로 더 구체적인 dev/preview-safe 화면/API/테스트 계약으로 잠그는 것입니다.

이번 단계도 실제 운영 사용자/권한 변경, production DB 변경, 실제 운영 정책 반영은 하지 않습니다.

## 2. 왜 2차가 필요한가

Phase 9 에서 아래 1차 기준은 이미 잡혔습니다.

- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 일반 업무 화면과 분리함
- 익명 공개 preview 에서 `/admin*` 를 `/login` 으로 돌려 공개 노출을 막음
- `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` skeleton 과 권한 경계를 둠
- 감사 응답에서 raw `storageKey`, bucket 이름, public URL, secret 을 노출하지 않는 원칙을 둠
- Phase 8 문서/첨부 정책과 충돌하지 않게 `fileId`/`spaceId`/`versionId`/`storageStatus` 중심 추적 원칙을 둠

하지만 아직 다음 구현자가 바로 손대기에는 아래가 모자랍니다.

- 각 관리자 화면이 어떤 데이터 블록과 CTA 를 먼저 가져야 하는지 더 세밀한 정의
- `/api/admin/*` 가 어떤 request/response shape 와 후보 액션을 먼저 지원해야 하는지 정리
- 감사 로그에서 어떤 필터/마스킹/비노출 기준을 회귀 테스트로 고정할지 정리
- 실제 운영 변경이 필요한 항목과 dev-safe candidate 로 끝내야 하는 항목의 경계 재정리

즉, Phase 10 은 "운영 기능을 여는 단계"가 아니라 "운영에 가까운 흐름처럼 보이되 실제 반영은 하지 않는 2차 관리자 계약"을 고정하는 단계입니다.

## 3. 확인한 현재 기준

확인한 기준 문서/파일:

- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/guides/phase-9-admin-audit-handoff.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `README.md`
- `apps/web/admin-skeleton-config.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `db/migrations/0002_auth_org_phase2.sql`

현재 저장소에서 확인되는 사실은 아래와 같습니다.

- Web 쪽 관리자 화면은 아직 placeholder 중심이며, 정보 블록과 CTA 는 단순 안내 수준입니다.
- Shared 계약에는 admin users/policies/audit-logs 응답 schema 와 일부 candidate request schema 가 이미 있습니다.
- API 테스트는 admin users list, document policy candidate, audit log read 정도까지는 회귀가 있습니다.
- 감사 이벤트와 정책 후보는 존재하지만, 화면/API/test 에서 동일한 우선순위 세트로 고정된 수준은 아닙니다.
- 제품 비전 문서는 인사/총무/관리자가 정책과 운영 상태를 안전하게 관리하고 감사 로그를 추적하는 흐름을 요구합니다.
- UX 원칙 문서는 관리자 기능을 일반 사용자 하단 탭과 섞지 말고, 상태 변경 CTA 를 관련 상태 요약 바로 옆에 두라고 안내합니다.

## 4. Phase 10 에서 고정하는 핵심 결정

### 결정 A. `/admin/users` 는 "실행"보다 "변경 후보 검토"를 먼저 강화한다.

Phase 10 에서 `/admin/users` 는 실제 저장 버튼보다 아래 4가지를 먼저 분명하게 보여주는 화면/API 로 고도화합니다.

1. 사용자-직원 연결 상태
2. 현재 역할/고위험 권한 요약
3. 변경 후보 before/after diff
4. 감사 이벤트 preview 와 변경 사유 입력

이 화면은 여전히 dev-safe 범위에 머물러야 하므로, 실제 운영 사용자를 생성/비활성화하거나 역할을 저장하지 않습니다.
대신 "어떤 변경이 시도될 예정인지"를 안전하게 보여주고 검토하는 구조를 먼저 고정합니다.

### 결정 B. `/admin/policies` 는 도메인별 운영 정책 후보를 카드형으로 나눈다.

`/admin/policies` 는 한 화면에서 모든 정책을 뒤섞지 않고 아래 묶음으로 나눕니다.

- 근태/휴가/결재 기본 정책
- 문서/첨부 정책
- 게시판/공지 정책

각 카드/섹션은 최소한 아래 정보를 공통으로 가집니다.

- 현재 placeholder 기준 요약
- 바꾸려는 후보값
- before/after diff
- 변경 사유 입력
- 필요한 capability
- 감사 이벤트 preview

실제 정책 저장은 하지 않고, `candidate`, `preview`, `placeholder` 응답으로 끝냅니다.

### 결정 C. `/admin/audit-logs` 는 조회형 필터와 마스킹 회귀를 우선 고정한다.

`/admin/audit-logs` 는 Phase 10 에서 아래를 먼저 강화합니다.

- actor/action/target/time/category 필터를 기준 필터로 고정
- 사용자/권한/정책/문서/게시판 카테고리 표기를 통일
- 민감값 마스킹 여부를 이벤트 상세에 분명히 표시
- export/download/external sink 는 여전히 제외

즉, 이번 단계의 성공 기준은 "감사 로그가 많아 보이게 만드는 것"이 아니라, "조회와 비노출 원칙이 흔들리지 않게 만드는 것"입니다.

### 결정 D. 모든 관리자 변경 후보 응답은 `audit` 블록과 `masked` 근거를 함께 가져간다.

Phase 10 의 admin candidate 응답은 가능하면 공통적으로 아래를 담습니다.

- `audit.action`
- `audit.category`
- `audit.reasonRequired`
- `audit.candidate`
- `maskedFields`
- `companyBoundary`

이렇게 해야 Web/API/shared/test 가 같은 기준으로 묶이고, 다음 구현자가 실제 저장 전 단계에서도 감사·마스킹 회귀를 쉽게 유지할 수 있습니다.

## 5. 이번 Phase 에 포함되는 범위

### 문서 범위

- Phase 10 2차 범위 문서 작성
- `/admin/users`, `/admin/policies`, `/admin/audit-logs` 의 상세 역할 재정리
- 실제 운영 반영 없이 가능한 candidate 흐름 기준 정리
- 구현 대상 파일/API/test/docs 와 완료 기준 정리

### 구현 준비 범위

다음 구현 카드에서 허용하는 범위는 아래입니다.

- 관리자 화면 placeholder 를 더 구체적인 candidate UI 로 보강
- admin shared contract 보강
- `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` 의 candidate/list/filter 응답 보강
- audit metadata mask/company boundary/test fixture 보강
- 회귀 테스트 추가
- 문서/README/가이드 최신화

### 이번 Phase 에서 제외하는 범위

- 실제 운영 사용자 생성/초대 발송/비활성화 실행
- 실제 역할 부여/회수 저장
- production 정책 반영
- production DB migration 실행
- 실제 운영 파일 업로드/삭제/이동
- 외부 감사 시스템, 외부 알림, 외부 로그 적재
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 변경
- 대량 삭제, hard delete, cross-company 실데이터 수정

## 6. 화면별 상세 범위

### A. `/admin/users`

이번 2차에서 먼저 보여줄 요소:

- 사용자 목록 또는 핵심 대상 카드
- 직원 연결 상태(`linked`, `unlinked`, `mismatch` 같은 dev-safe 상태값)
- 역할 목록과 고위험 capability 강조
- 변경 후보 패널
  - 초대 후보
  - 역할 변경 후보
  - 상태 변경 후보
- before/after diff 요약
- 변경 사유 입력 placeholder
- 감사 이벤트 preview

이번 2차에서도 하지 않을 것:

- 실제 저장
- 실제 초대 메일/링크 발급
- 실제 계정 잠금/비활성화

권장 capability 기준:

- 읽기: `permission.read` + 관리자 role gate
- 초대 후보: `invite.manage`
- 역할 변경 후보: `invite.manage`
- 감사 링크/preview: `audit.read` 또는 audit preview visibility 규칙

권장 API 후보:

- `GET /api/admin/users`
- `POST /api/admin/users/invites`
- `POST /api/admin/users/:userId/roles`
- 필요 시 `POST /api/admin/users/:userId/status`

모든 POST 는 실제 저장이 아니라 candidate 응답 우선으로 둡니다.

### B. `/admin/policies`

이번 2차에서 먼저 고정할 요소:

- 정책 카테고리 카드
  - attendance
  - leave
  - approval
  - document
  - board
- 현재 정책 요약 placeholder
- 후보값 입력 또는 선택 UI
- before/after diff
- 변경 사유 입력 placeholder
- capability 안내
- 감사 이벤트 preview
- 문서/게시판 정책에서는 마스킹/비노출 규칙 강조

권장 capability 기준:

- 읽기: 관리자 role gate
- 근태/휴가/결재 정책 후보: 도메인 관리자 capability 조합
- 문서 정책 후보: `document.space.manage`, `document.file.write`
- 게시판 정책 후보: `board.manage`

권장 API 후보:

- `GET /api/admin/policies`
- `POST /api/admin/policies/documents`
- `POST /api/admin/policies/boards`
- 필요 시 `POST /api/admin/policies/attendance`
- 필요 시 `POST /api/admin/policies/leave`
- 필요 시 `POST /api/admin/policies/approval`

### C. `/admin/audit-logs`

이번 2차에서 먼저 고정할 요소:

- 목록 + 상세 패널 구조
- 기본 필터
  - actor
  - action
  - target
  - category
  - time range
- category badge
- 민감값 마스킹 안내
- company boundary 유지 안내
- export/download 미지원 안내

권장 capability 기준:

- 읽기: `audit.read`
- export/download/external share: 이번 범위 제외

권장 API 후보:

- `GET /api/admin/audit-logs`
- 필요 시 query filter contract 추가

## 7. 감사 로그와 마스킹 기준

Phase 10 에서 회귀로 반드시 묶어야 하는 기준은 아래입니다.

### 필수 유지 항목

- raw `storageKey` 비노출
- bucket 이름 비노출
- signed URL 전문 비노출
- secret/token/password 전문 비노출
- 운영 파일 경로 전문 비노출
- 개인정보 원문 덤프 비노출

### 감사 상세에 남겨도 되는 최소 정보

- `fileId`
- `spaceId`
- `versionId`
- `storageStatus`
- `targetType`
- `targetId`
- `before` / `after` 요약
- `reason`
- `sensitiveMasked: true`
- `companyBoundary.enforced: true`

### 이벤트 우선순위

이번 2차에서 먼저 UI/API/test 에 맞출 이벤트 우선순위는 아래입니다.

1. 사용자/권한
   - `admin.user.invite.created`
   - `admin.user.role.assigned`
   - `admin.user.role.removed`
   - `admin.user.status.changed`
2. 정책
   - `admin.policy.document.updated`
   - `admin.policy.board.updated`
   - `admin.policy.attendance.updated`
   - `admin.policy.leave.updated`
   - `admin.policy.approval.updated`
3. 감사 조회
   - `admin.audit_log.viewed`
   - `admin.audit_log.filter_export_requested` 는 이름만 유지하고 실제 export 는 제외

## 8. 구현자가 바로 따라갈 대상 파일

### Web

- `apps/web/app/admin/page.tsx`
  - 관리자 허브에서 세 하위 화면의 역할과 상태를 더 분명히 연결
- `apps/web/app/admin/users/page.tsx`
  - 사용자/직원 연결 상태, 역할 후보, diff, 감사 preview 강화
- `apps/web/app/admin/policies/page.tsx`
  - 도메인별 정책 카드, capability 안내, diff, 감사 preview 강화
- `apps/web/app/admin/audit-logs/page.tsx`
  - 필터/마스킹/카테고리 중심 조회형 skeleton 강화
- `apps/web/admin-skeleton-config.ts`
  - 섹션/카드/필터/가드레일 텍스트 구조 보강
- `apps/web/admin-preview-guard.ts`
  - `/admin*` 공개 preview 차단 유지
- `apps/web/admin-preview-guard.test.ts`
  - `/admin* -> /login` 회귀 유지

### Shared

- `packages/shared/src/contracts.ts`
  - admin candidate request/response schema 보강
  - audit filter/query schema 보강
  - masked fields / audit candidate 공통 블록 정리
- `packages/shared/test/contracts.spec.ts`
  - schema/route 계약 회귀 보강

### API

- `apps/api/src/app.ts`
  - `/api/admin/users` candidate/list 응답 보강
  - `/api/admin/policies` category/candidate 응답 보강
  - `/api/admin/audit-logs` filter/list 응답 보강
  - capability guard 와 company boundary 회귀 유지
- 필요 시 `apps/api/src/lib/admin-audit.ts`
  - 감사 candidate/masking helper 분리
- 필요 시 `apps/api/src/lib/admin-policy.ts`
  - 정책 candidate/diff helper 분리
- 필요 시 `apps/api/src/lib/admin-users.ts`
  - 사용자/역할 candidate helper 분리

### Test

- `apps/api/test/auth-org.spec.ts`
  - admin users/policies/audit 권한 경계 회귀 확장
- 필요 시 `apps/api/test/admin-audit.spec.ts`
  - 감사 필터/마스킹/비노출 회귀 분리
- 필요 시 `apps/api/test/admin-policies.spec.ts`
  - 정책 candidate/diff/masked fields 회귀 분리
- 필요 시 `apps/api/test/admin-users.spec.ts`
  - 사용자/역할/status candidate 회귀 분리
- `apps/web/admin-preview-guard.test.ts`
  - admin 공개 차단 회귀 유지
- 필요 시 `apps/web/admin-skeleton-config.test.ts`
  - 화면 섹션/가드레일/필터 계약 회귀 보강

### DB

- 기본 기준: `db/migrations/0002_auth_org_phase2.sql`
- 필요 시 `db/migrations/0007_admin_audit_phase9.sql` 또는 후속 migration skeleton 검토
- 단, production DB 실행은 이번 범위에서 하지 않음

### Docs

- `README.md`
- `docs/guides/phase-10-admin-audit-pass-2-handoff.md`
- 필요 시 `docs/guides/cloudflare-first-developer-guide.md`
- 필요 시 `docs/guides/cloudflare-first-operator-guide.md`

## 9. 권장 테스트 시작점

다음 구현자는 최소한 아래 회귀를 먼저 맞추는 것을 권장합니다.

1. Web
   - `apps/web/admin-preview-guard.test.ts`
   - 필요 시 `apps/web/admin-skeleton-config.test.ts`
2. Shared
   - `packages/shared/test/contracts.spec.ts`
3. API
   - `apps/api/test/auth-org.spec.ts`
   - 필요 시 admin 전용 spec 분리

우선 확인해야 하는 시나리오는 아래입니다.

- 익명 사용자는 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 에 직접 진입하지 못함
- 관리자 capability 없는 사용자는 `/api/admin/*` 를 쓰지 못함
- audit.read 없는 역할은 `/api/admin/audit-logs` 를 읽지 못함
- document/board policy candidate 응답에 raw `storageKey`, bucket, signed URL 이 없음
- 사용자/정책 candidate 응답에 `audit.candidate: true` 와 `maskedFields` 가 유지됨
- cross-company 요청은 candidate 단계에서도 차단됨

## 10. 완료 기준

Phase 10 2차 구현 준비가 끝났다고 보려면 아래를 만족해야 합니다.

1. `/admin/users`, `/admin/policies`, `/admin/audit-logs` 가 각각 어떤 정보 블록과 candidate 액션을 먼저 맡는지 문서에 분명히 적혀 있습니다.
2. 실제 운영 변경과 dev/preview-safe candidate 범위가 분리되어 있습니다.
3. 감사 로그 필터, 마스킹, 비노출 기준이 테스트 가능한 문장으로 적혀 있습니다.
4. 구현 대상 Web/API/shared/test/docs 파일이 구체적으로 적혀 있습니다.
5. 다음 구현자가 바로 시작할 수 있는 API 후보와 테스트 시작점이 적혀 있습니다.
6. production DB/실운영 사용자 변경/secret/DNS/유료 리소스/외부 공개 같은 승인 필요 항목이 분리되어 있습니다.
7. 관리자 기능을 일반 사용자 업무 화면과 섞지 않는 UX 원칙이 유지됩니다.

## 11. 다음 작업자 handoff

다음 구현자는 아래 순서로 이어가면 됩니다.

1. `docs/architecture/phase-9-admin-audit-scope.md` 와 이 문서를 같이 읽어 1차 경계와 2차 상세 범위를 함께 맞춥니다.
2. `apps/web/admin-skeleton-config.ts` 와 `apps/web/app/admin/*` 화면에서 카드/필터/가드레일 구조부터 보강합니다.
3. `packages/shared/src/contracts.ts` 에 admin candidate 공통 블록, filter schema, masked fields 계약을 먼저 정리합니다.
4. `apps/api/src/app.ts` 에서 `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` 응답 shape 를 문서와 맞춥니다.
5. `apps/api/test/auth-org.spec.ts` 또는 분리된 admin 전용 spec 으로 권한 경계와 마스킹 회귀를 먼저 잡습니다.
6. 필요 시 helper 를 `apps/api/src/lib/` 아래로 분리하되, production 연동 없이 placeholder/candidate 흐름으로 유지합니다.
7. README 와 handoff 문서를 같이 갱신해 다음 리뷰어가 범위를 바로 이해할 수 있게 합니다.

## 12. 이번 단계에서 하지 않는 일 재강조

- 운영 실사용자 생성/비활성화/권한 변경 실행
- production 정책 저장
- production DB migration 실행
- 실제 운영 파일 처리
- 외부 로그 전송/외부 알림/외부 공개
- secret 입력/교체
- DNS/custom domain 변경
- 비용 증가 리소스 변경

정리하면 Phase 10 의 핵심은 하나입니다.

"관리자 기능을 진짜 운영에 붙이는 것"이 아니라,
"운영 직전 수준의 화면/API/테스트 계약을 안전한 candidate 흐름으로 더 촘촘하게 잠그는 것"입니다.
