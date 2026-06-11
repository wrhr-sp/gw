# 그룹웨어 Phase 9 관리자/운영 설정·감사 로그 1차 범위

## 1. 문제 정의

Phase 8 R2 에서 문서/첨부파일 저장소 연결 1차 기준은 잡았지만, 누가 어떤 운영 설정을 바꿀 수 있는지와 그 변경 이력을 어디에 남길지는 아직 분명하게 고정되지 않았습니다.
이번 Phase 9 의 목표는 "실운영 권한 변경이나 production 데이터 변경 없이도, 다음 구현자가 `/admin/users`, `/admin/policies`, `/admin/audit-logs` 와 문서/게시판 운영 설정 skeleton 을 dev/preview-safe 범위에서 바로 만들 수 있게" 관리자 범위, 일반 업무 화면과의 경계, 감사 로그 후보를 먼저 확정하는 것입니다.

## 2. 현재 확인한 사실

확인 기준 문서/파일:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
- `README.md`
- `apps/web/admin-preview-guard.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/documents/page.tsx`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `db/migrations/0002_auth_org_phase2.sql`
- `db/migrations/0005_boards_documents_phase5.sql`

현재 사실은 아래와 같습니다.

- 제품 로드맵은 `조직/직원`을 `/org`, `/employees` 의 독립 업무 화면으로 두고, 사용자 생성/권한 변경/정책 변경/감사 로그 같은 운영 통제 액션만 `/admin/*` 로 분리하라고 요구합니다.
- UX 원칙 문서는 관리자 기능을 일반 사용자 하단 탭과 업무 묶음에 섞지 말고, `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 별도 관리자 묶음으로 유지하라고 정리합니다.
- 현재 Web preview guard 는 `/admin*` 요청을 익명 공개 preview 에서 `/login` 으로 돌려 admin skeleton 공개 노출을 막습니다.
- 현재 관리자 Web 화면은 `apps/web/app/admin/page.tsx` 한 장짜리 placeholder 수준이며, 초대 API와 역할/권한 조회 링크만 보여 줍니다.
- 현재 shared/API 계층에는 `invite.manage`, `audit.read`, `document.space.manage`, `document.file.write`, `board.manage` 같은 시작 권한이 이미 있습니다.
- 현재 D1 에는 기본 `audit_logs` 테이블 skeleton 이 있고, 문서 쪽에는 `document_files.storage_key` 와 `document_spaces`/`document_files` metadata skeleton 이 있습니다.
- Phase 8 R2 는 object key 를 `companies/{companyId}/spaces/{spaceId}/files/{fileId}/versions/{versionId}/{safeFileName}` 규칙으로 두고, raw `storageKey`, bucket 이름, public URL 을 응답에 노출하지 않는 방향을 확정했습니다.

즉, 이번 1차는 "관리 기능을 일반 사용자 업무 화면과 분리하고, 운영 설정/감사 로그 skeleton 과 이벤트 기준을 먼저 잠그는 단계"로 보는 것이 맞습니다.

## 3. 이번 Phase에서 고정하는 권고안

### 권고안 A. 관리자 화면은 운영 통제만 맡고, 일반 업무 화면은 조회/업무 흐름을 유지한다.

이번 1차는 아래 원칙을 기본안으로 고정합니다.

1. `/org`, `/employees`, `/boards`, `/documents`, `/approvals`, `/attendance`, `/leave` 는 일반 사용자/팀장/인사/감사 역할이 함께 쓰는 업무 화면으로 유지합니다.
2. `/admin/*` 는 운영 설정, 사용자/권한 관리, 정책 관리, 감사 로그 확인, 공간 운영 설정 같은 "관리자 통제"만 맡깁니다.
3. 같은 데이터를 보더라도 "일상 조회"와 "운영 변경"을 같은 route 안에 섞지 않습니다.
4. 권한이 없는 사용자는 `/admin*` 에 진입해도 익명 preview 에서는 `/login`, 로그인 후 일반 사용자 기준에서는 403 또는 관리자 전용 안내로 막습니다.
5. 실제 운영 사용자 생성/권한 변경/정책 반영은 이번 범위에 넣지 않고, mock/local-safe skeleton 과 감사 로그 후보만 먼저 둡니다.

이 방향을 고정하는 이유는 아래와 같습니다.

- 일반 사용자 경험을 해치지 않고도 운영 통제를 강화할 수 있습니다.
- Phase 2 인증/조직, Phase 5 게시판/문서, Phase 8 R2 storage 기준과 자연스럽게 이어집니다.
- 나중에 정책 변경, 문서 보관 정책, 게시판 운영 설정, 첨부 보안 규칙이 늘어나도 `/admin/*` 아래에서 일관되게 확장할 수 있습니다.

### 이번 1차에서 채택하지 않는 방향

- `/employees` 나 `/org` 안에서 사용자 권한 변경, 정책 저장, 감사 로그 열람까지 같이 처리하는 방식
- 일반 사용자 하단 탭이나 기본 대시보드 메뉴에 관리자 메뉴를 노출하는 방식
- 실운영 권한 변경, production 정책 저장, production DB migration, 운영 파일 업로드를 포함하는 방식
- 외부 SIEM, 메일 알림, Slack/Telegram 운영 알림, 장기 보관 정책까지 한 번에 묶는 큰 범위

## 4. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 9 관리자/운영 설정·감사 로그 1차 기준 문서 작성
- 관리자 capability 와 일반 업무 화면 경계 정리
- 감사 로그 후보 이벤트와 payload 최소 구조 정리
- Phase 8 object key/metadata 와 연결되는 관리자 정책 후보 명시
- 다음 구현 카드가 바로 따라갈 파일/API/test/docs 대상과 완료 기준 정리

### 구현 범위

이번 1차 구현 카드에서 허용하는 범위는 아래입니다.

- `/admin/users`, `/admin/policies`, `/admin/audit-logs` route/page skeleton 추가 또는 보강
- 관리자 전용 capability/role guard 와 일반 사용자 노출 차단 유지
- 운영 설정/감사 로그 API contract 또는 handler skeleton 추가
- 문서 공간/게시판 운영 설정 placeholder 연결
- mock/local-safe 감사 로그 event model, fixture, test 추가
- 필요 시 D1 migration skeleton 초안 작성

### 이번 1차의 최소 성공 범위

이번 1차가 끝났다고 보기 위한 최소 성공 범위는 아래입니다.

- `/admin/users`, `/admin/policies`, `/admin/audit-logs` 가 익명 preview 에서 계속 차단됩니다.
- 로그인 후에도 관리자 capability 가 없는 사용자는 운영 변경 화면이나 운영 API 를 사용할 수 없습니다.
- 일반 업무 route 는 그대로 유지되고, 운영 변경 CTA 는 `/admin/*` 로만 이어집니다.
- 감사 로그 응답/테스트에서 raw `storageKey`, bucket 이름, public URL, secret 이 노출되지 않습니다.
- 문서 공간/게시판 운영 설정과 감사 이벤트 후보가 Phase 8 storage metadata 구조와 모순되지 않습니다.

## 5. route / capability 경계

### A. 일반 업무 화면에 남길 것

아래 route 는 "업무 수행"과 "조회" 중심으로 유지합니다.

- `/org`
  - 조직도, 부서/역할/권한 카탈로그 조회
  - 누가 어떤 조직에 속해 있는지 읽는 흐름
  - 운영 변경 CTA 는 링크로 `/admin/users` 또는 `/admin/policies` 로 넘김
- `/employees`
  - 직원 목록, 상태, 소속, 직책, 기본 프로필 조회
  - 일상 인사 확인과 업무 문맥 파악
  - 직원 생성/권한 변경/비활성화는 이 화면에서 직접 저장하지 않음
- `/boards`, `/posts/*`
  - 게시글 조회/작성/댓글/읽음 확인
  - 게시판 개설/게시판 visibility 정책/보관 정책은 `/admin/policies` 또는 문서화된 운영 설정 후보로 분리
- `/documents`
  - 접근 가능한 문서 공간/파일 목록, 첨부 metadata 흐름, 읽음 확인
  - storage policy, visibility policy, retention, file allowlist 변경은 `/admin/policies` 로 분리
- `/approvals`, `/attendance`, `/leave`
  - 일반 사용자 업무와 승인/기록 흐름 유지
  - 운영 규칙 자체를 바꾸는 액션은 `/admin/policies` 로 분리

### B. `/admin/users` 에 둘 것

`/admin/users` 는 아래 운영 통제를 맡깁니다.

- 사용자 초대/비활성화 placeholder
- 사용자-직원 연결 상태 확인
- 역할 부여/회수 후보
- 고위험 권한(`invite.manage`, `audit.read`, `document.space.manage`, `board.manage`) 노출 정책
- 변경 전/후 diff 요약과 감사 이벤트 생성 후보

권장 capability 기준:

- 기본 읽기: `permission.read` + 관리자 role gate
- 초대/역할 변경: `invite.manage`
- 감사 로그 링크 노출: `audit.read`

### C. `/admin/policies` 에 둘 것

`/admin/policies` 는 아래 운영 설정을 맡깁니다.

- 근태/휴가/결재 기본 정책 placeholder
- 문서 공간 visibility, file allowlist, file size limit, retention 후보
- 게시판 생성/사용 가능 visibility, 작성/댓글/읽음 확인 운영 기준 후보
- 운영 변경 사유 입력 placeholder 와 변경 전/후 비교

권장 capability 기준:

- 기본 읽기: 관리자 role gate
- 정책 저장 후보: `permission.read` + 도메인별 관리 capability 조합
- 문서/게시판 운영 설정 변경 후보:
  - 문서: `document.space.manage`, `document.file.write`
  - 게시판: `board.manage`

### D. `/admin/audit-logs` 에 둘 것

`/admin/audit-logs` 는 아래 역할만 맡깁니다.

- 운영 변경 이력 조회
- actor/action/target/time/filter 조회
- 이벤트 상세에서 민감값 마스킹 확인
- 문서/게시판/첨부 metadata 운영 변경과 사용자/권한 변경을 한곳에서 추적

권장 capability 기준:

- 읽기: `audit.read`
- 다운로드/외부 전송/장기 보관 설정은 이번 1차 제외

## 6. 감사 로그 후보 이벤트

감사 로그는 "운영 설정 또는 민감한 권한 변화"를 중심으로 시작합니다.
이번 1차 후보 이벤트는 아래처럼 분류합니다.

### A. 사용자/권한

- `admin.user.invite.created`
- `admin.user.invite.revoked`
- `admin.user.role.assigned`
- `admin.user.role.removed`
- `admin.user.status.changed`
- `admin.user.employee_link.changed`

### B. 정책/운영 설정

- `admin.policy.attendance.updated`
- `admin.policy.leave.updated`
- `admin.policy.approval.updated`
- `admin.policy.document.updated`
- `admin.policy.board.updated`

### C. 문서/공간/첨부 metadata

- `admin.document.space.visibility.changed`
- `admin.document.space.manager.changed`
- `admin.document.file.policy.updated`
- `admin.document.file.metadata.corrected`
- `admin.document.file.storage_status.changed`

### D. 게시판/공지 운영 설정

- `admin.board.created`
- `admin.board.visibility.changed`
- `admin.board.moderation_policy.changed`
- `admin.board.notice_policy.changed`

### E. 감사 시스템 자체

- `admin.audit_log.viewed`
- `admin.audit_log.filter_export_requested`

주의:

- `admin.audit_log.viewed` 같은 조회 이벤트는 실제 구현 때 과도한 noise 가 되지 않도록 sampling/조건부 기록을 검토합니다.
- 파일 본문 다운로드 자체는 이번 1차 핵심이 아니며, 우선은 운영 설정/metadata 변경부터 감사 후보로 둡니다.

## 7. 감사 로그 payload 최소 구조

현재 `audit_logs` skeleton 과 충돌 없이, 이번 1차는 아래 형태를 기본안으로 둡니다.

- `id`
- `company_id`
- `actor_user_id`
- `actor_employee_id`
- `action`
- `target_type`
- `target_id`
- `metadata_json`
- `created_at`

`metadata_json` 에 권장하는 최소 하위 필드는 아래와 같습니다.

- `category`
  - `user`, `permission`, `policy`, `document_space`, `document_file`, `board`, `audit`
- `reason`
  - 변경 사유 placeholder
- `before`
  - 변경 전 요약. 민감값 전문 대신 요약만 저장
- `after`
  - 변경 후 요약
- `companyBoundary`
  - `enforced: true`
- `source`
  - `web-admin`, `api-admin`, `system-placeholder`
- `storageRef`
  - 문서 파일 관련일 때 `fileId`, `spaceId`, `versionId`, `storageStatus` 정도만 포함
- `sensitiveMasked`
  - `true`

명시적 금지:

- raw `storageKey`
- bucket 이름
- signed URL 전문
- secret/token/password 전문
- 운영 파일 경로 전문
- 개인정보 원문 덤프

## 8. Phase 8 R2 object key / metadata 와의 연결 원칙

Phase 8 과 연결되는 관리자 정책/감사 기준은 아래처럼 고정합니다.

1. 문서 운영 변경은 파일 본문보다 D1 metadata 를 기준으로 추적합니다.
   - 감사 로그 target 은 `document_space`, `document_file`, `document_policy` 를 우선 사용합니다.
2. object key 자체는 운영 내부값으로 남기고, 감사 로그에는 `fileId`, `spaceId`, `versionId`, `storageStatus` 정도만 남깁니다.
3. `companies/{companyId}/...` 경계를 깨는 cross-company 관리 액션은 금지하고, 차단 시도도 감사 후보로 볼 수 있게 타입을 남깁니다.
4. 파일 allowlist, size limit, retention, visibility 같은 정책 변경은 `/admin/policies` 아래에서만 다룹니다.
5. 게시판과 문서는 같은 운영 IA 묶음으로 보되, storage prefix 나 raw storage metadata 를 공용 route 로 섞지 않습니다.

## 9. 구현자가 바로 따라갈 대상 파일

### Web

- `apps/web/app/admin/page.tsx`
  - 관리자 홈을 "사용자 / 정책 / 감사 로그" 허브로 확장
- `apps/web/app/admin/users/page.tsx`
  - 사용자/역할/상태 변경 placeholder
- `apps/web/app/admin/policies/page.tsx`
  - 운영 정책 placeholder
- `apps/web/app/admin/audit-logs/page.tsx`
  - 감사 로그 목록/필터 placeholder
- `apps/web/admin-preview-guard.ts`
  - `/admin*` 공개 preview 차단 유지
- `apps/web/admin-preview-guard.test.ts`
  - `/admin* -> /login` 회귀 유지

### Shared

- `packages/shared/src/contracts.ts`
  - admin route, admin policy/audit schema, 감사 이벤트 타입 추가
- `packages/shared/test/contracts.spec.ts`
  - schema/route 계약 회귀 추가

### API

- `apps/api/src/app.ts`
  - `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` skeleton
  - capability guard 와 company boundary 검증
- 필요 시 `apps/api/src/lib/` 아래 admin policy/audit helper 분리

### Test

- `apps/api/test/auth-org.spec.ts`
  - 관리자/일반 사용자 권한 분리 회귀
- 필요 시 `apps/api/test/admin-audit.spec.ts`
  - admin API 와 감사 payload 마스킹 검증
- `apps/web/admin-preview-guard.test.ts`
  - admin 노출 차단 회귀

### DB

- `db/migrations/0002_auth_org_phase2.sql`
  - 기존 `audit_logs` 골격 확인
- 필요 시 `db/migrations/0007_admin_audit_phase9.sql`
  - admin policy/audit 에 필요한 최소 확장 skeleton

### Docs

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- 필요 시 `docs/guides/cloudflare-first-operator-guide.md`

## 10. API / 테스트 권장 시작점

### API 후보

- `GET /api/admin/users`
  - 관리자용 사용자/직원/역할 요약 조회 placeholder
- `POST /api/admin/users/invites`
  - 기존 invite 흐름 재사용 또는 연결
- `POST /api/admin/users/:userId/roles`
  - 실제 저장 전 candidate 응답 중심
- `GET /api/admin/policies`
  - 운영 정책 placeholder 조회
- `POST /api/admin/policies/documents`
  - 문서 정책 변경 candidate 응답
- `POST /api/admin/policies/boards`
  - 게시판 정책 변경 candidate 응답
- `GET /api/admin/audit-logs`
  - 감사 로그 목록/필터 placeholder

### 테스트 후보

- 익명 또는 일반 사용자로 `/api/admin/*` 접근 시 401/403
- `audit.read` 없는 관리자 role 에서 감사 로그 조회 차단
- 문서 정책 변경 candidate 응답에 raw `storageKey`/bucket/signed URL 미노출
- 게시판/문서 운영 변경 candidate 응답에 `audit.candidate: true` 유지
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 가 preview guard 에서 계속 `/login` 으로 redirect

## 11. 완료 기준

이번 Phase 9 1차 구현/리뷰는 아래를 만족해야 완료로 봅니다.

1. 관리자 범위 문서가 저장소 안에 있고 구현자가 바로 참조할 수 있습니다.
2. `/admin/users`, `/admin/policies`, `/admin/audit-logs` 의 역할이 서로 겹치지 않게 정리되어 있습니다.
3. `/org`, `/employees`, `/boards`, `/documents`, `/approvals`, `/attendance`, `/leave` 와 `/admin/*` 의 경계가 문서에 분명하게 적혀 있습니다.
4. 감사 로그 후보 이벤트가 사용자/권한/정책/문서공간/게시판/첨부 metadata 변경까지 포함합니다.
5. Phase 8 object key/metadata 와 연결되는 관리자 정책·감사 원칙이 적혀 있습니다.
6. 다음 구현자가 봐야 할 Web/API/shared/test/docs 파일 대상이 구체적으로 적혀 있습니다.
7. 비밀값, raw storage key, bucket 이름, public URL, production 데이터 변경 금지 범위가 문서에 남아 있습니다.

## 12. 이번 Phase에서 하지 않는 일

- 실제 운영 사용자 생성/권한 변경/비활성화 실행
- production DB migration 실행
- production 정책 반영
- 실제 R2 운영 파일 업로드/이동/삭제
- 외부 감사 시스템, 외부 로그 적재, 알림 연동
- secret 입력/교체, DNS/custom domain, 유료 리소스 변경
- 대량 삭제, hard delete, cross-company 실데이터 수정

## 13. 다음 작업자 handoff

다음 구현자는 아래 순서로 보면 됩니다.

1. 이 문서와 `docs/architecture/phase-8-r2-storage-scope.md` 를 먼저 읽고 관리자 경계와 storage 마스킹 원칙을 같이 맞춥니다.
2. `packages/shared/src/contracts.ts` 에 admin route/schema/event type 을 먼저 추가합니다.
3. `apps/api/src/app.ts` 에 `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` skeleton 과 capability guard 를 넣습니다.
4. `apps/web/app/admin/*` skeleton 을 만들고 `/admin` 허브에서 세 화면으로 연결합니다.
5. `apps/web/admin-preview-guard.test.ts`, `packages/shared/test/contracts.spec.ts`, `apps/api/test/auth-org.spec.ts` 또는 동급 테스트로 admin 노출/권한/마스킹 회귀를 확인합니다.
6. 필요하면 `db/migrations/0007_admin_audit_phase9.sql` skeleton 을 추가하되, production DB 실행은 하지 않습니다.
7. README/개발 가이드/운영 가이드에 현재 범위와 검증 기준을 맞춥니다.

주의 사항:

- 실제 운영 권한 변경과 production 데이터 변경은 하지 않습니다.
- 감사 로그는 먼저 candidate/placeholder 구조를 검증하고, 실제 장기 보관/외부 적재는 다음 승인 단계로 넘깁니다.
- admin 기능을 일반 사용자 하단 탭이나 업무 메인 흐름에 섞지 않습니다.
- 문서/첨부 관련 감사 로그에서도 raw `storageKey` 와 public URL 은 노출하지 않습니다.
