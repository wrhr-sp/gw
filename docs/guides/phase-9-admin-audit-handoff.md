# Phase 9 관리자/운영 설정·감사 로그 1차 handoff

한 줄 요약:
이번 1차는 "관리자 기능을 외부에 바로 여는 작업"이 아니라, `/admin/*` 운영 경계와 감사 로그 후보를 먼저 고정해서 다음 구현자가 안전하게 확장할 수 있게 만든 단계입니다.

## 1. 지금 무엇까지 된 상태인가

현재 저장소에는 아래 기준이 이미 코드와 문서에 반영돼 있습니다.

- 기준 문서: `docs/architecture/phase-9-admin-audit-scope.md`
- Web 관리자 경계: `apps/web/middleware.ts`, `apps/web/admin-preview-guard.ts`
- Web 관리자 화면: `apps/web/app/admin/page.tsx`, `apps/web/app/admin/users/page.tsx`, `apps/web/app/admin/policies/page.tsx`, `apps/web/app/admin/audit-logs/page.tsx`
- Web 설정/회귀 테스트: `apps/web/admin-skeleton-config.ts`, `apps/web/admin-preview-guard.test.ts`, `apps/web/admin-skeleton-config.test.ts`
- 공통 계약: `packages/shared/src/contracts.ts`
- API skeleton: `apps/api/src/app.ts`
- 권한 회귀 테스트: `apps/api/test/auth-org.spec.ts`
- 감사 로그 골격: `db/migrations/0002_auth_org_phase2.sql`

즉, 지금은 아래가 된 상태입니다.

- 익명 공개 preview 에서 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 바로 열 수 없게 막아 둠
- 관리자 홈과 사용자/정책/감사 로그 skeleton route 가 분리돼 있음
- API 쪽에도 `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` skeleton 과 권한 경계가 들어가 있음
- 감사 후보 응답과 문서에서 raw `storageKey`, bucket 이름, public URL, secret 을 남기지 않는 기준이 맞춰져 있음
- Phase 8 문서/첨부파일 저장소 정책과 충돌하지 않게 `fileId`, `spaceId`, `versionId`, `storageStatus` 중심으로 추적하는 방향이 정리돼 있음

반대로 아직 하지 않은 일은 아래입니다.

- 실제 운영 사용자 생성/비활성화/권한 변경 실행
- production 정책 저장
- production DB migration 실행
- 실제 운영 파일 업로드/삭제
- 외부 감사 시스템, 장기 보관, 외부 알림 연동
- secret 입력/교체, DNS/custom domain, 유료 리소스 변경

## 2. 사용자와 운영자가 각각 어떻게 이해하면 되는가

### 일반 사용자 관점

일반 사용자는 `/org`, `/employees`, `/boards`, `/documents`, `/approvals`, `/attendance`, `/leave` 같은 업무 화면을 봅니다.
관리자 통제 화면은 기본 업무 흐름과 섞이지 않습니다.
즉, 같은 데이터를 보더라도 "조회/업무"와 "운영 변경"은 다른 화면으로 나뉩니다.

### 운영자 관점

운영자는 `/admin/*` 를 "운영 통제 허브"로 이해하면 됩니다.
이번 1차에서 각 화면 역할은 아래처럼 정리합니다.

- `/admin/users`
  - 사용자 초대/비활성화 placeholder
  - 역할 부여/회수 후보
  - 사용자-직원 연결 상태 확인
- `/admin/policies`
  - 근태/휴가/결재 정책 placeholder
  - 문서/게시판 visibility, file allowlist, retention 후보
  - 변경 사유와 변경 전/후 요약 placeholder
- `/admin/audit-logs`
  - 운영 변경 이력 조회 후보
  - actor/action/target/time/filter 확인
  - 민감값 마스킹 확인

## 3. 감사 로그에서 먼저 남길 이벤트 후보

이번 1차는 "실제 모든 행동 로그"보다 운영 통제 이벤트 후보를 먼저 잠그는 단계입니다.
우선순위는 아래와 같습니다.

### 사용자/권한

- `admin.user.invite.created`
- `admin.user.invite.revoked`
- `admin.user.role.assigned`
- `admin.user.role.removed`
- `admin.user.status.changed`
- `admin.user.employee_link.changed`

### 정책/운영 설정

- `admin.policy.attendance.updated`
- `admin.policy.leave.updated`
- `admin.policy.approval.updated`
- `admin.policy.document.updated`
- `admin.policy.board.updated`

### 문서/공간/첨부 metadata

- `admin.document.space.visibility.changed`
- `admin.document.space.manager.changed`
- `admin.document.file.policy.updated`
- `admin.document.file.metadata.corrected`
- `admin.document.file.storage_status.changed`

### 게시판 운영 설정

- `admin.board.created`
- `admin.board.visibility.changed`
- `admin.board.moderation_policy.changed`
- `admin.board.notice_policy.changed`

### 감사 시스템 자체

- `admin.audit_log.viewed`
- `admin.audit_log.filter_export_requested`

주의:

- 조회 로그는 noise 가 너무 많아지지 않게 실제 구현 때 sampling 또는 조건부 기록을 검토합니다.
- 파일 본문 자체보다 운영 설정과 metadata 변경부터 우선 추적합니다.

## 4. 감사 로그 payload 에서 지켜야 할 기준

기본 필드는 아래처럼 이해하면 됩니다.

- `id`
- `company_id`
- `actor_user_id`
- `actor_employee_id`
- `action`
- `target_type`
- `target_id`
- `metadata_json`
- `created_at`

`metadata_json` 에는 보통 아래 정도만 남깁니다.

- `category`
- `reason`
- `before`
- `after`
- `companyBoundary`
- `source`
- `storageRef`
- `sensitiveMasked`

절대 기본 응답/로그에 남기면 안 되는 값:

- raw `storageKey`
- bucket 이름
- signed URL 전문
- secret/token/password 전문
- 운영 파일 경로 전문
- 개인정보 원문 덤프

## 5. Phase 8 문서/첨부 정책과 어떻게 이어지는가

Phase 8 과의 연결 기준은 간단합니다.

- 문서 운영 변경은 파일 본문보다 D1 metadata 기준으로 추적합니다.
- 감사 로그에는 `fileId`, `spaceId`, `versionId`, `storageStatus` 정도만 남깁니다.
- object key 자체는 운영 내부값으로 보고 응답/문서에 퍼뜨리지 않습니다.
- file allowlist, size limit, retention, visibility 같은 정책 변경은 `/admin/policies` 에서만 다룹니다.
- cross-company 관리 액션은 허용하지 않으며, 차단 시도도 감사 후보로 남길 수 있게 설계합니다.

## 6. 이번에 확인된 로컬 검증 근거

부모 카드 handoff 기준으로 이번 범위에서 다시 맞춰진 검증은 아래입니다.

- `pnpm --filter @gw/web test -- admin-preview-guard admin-skeleton-config`
- `pnpm --filter @gw/shared test -- contracts.spec.ts`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/web typecheck`
- `pnpm check`
- `pnpm --filter @gw/web build:cf`

이번 결과로 확인된 점:

- `/admin*` preview guard 회귀가 유지됩니다.
- 관리자 skeleton/config 와 shared contract 가 서로 어긋나지 않습니다.
- admin API 권한 경계와 감사 응답 마스킹 기준이 로컬 검증을 통과했습니다.
- Cloudflare용 `build:cf` 까지 다시 통과해서, 이전 로컬 blocker 였던 admin prerender 문제는 현재 저장소 기준으로 해소됐습니다.

## 7. 운영자가 지금 확인할 것

운영자는 이번 1차를 "운영 오픈 완료"가 아니라 "운영 경계와 감사 후보가 먼저 잠긴 상태"로 보면 됩니다.

지금 확인할 핵심은 아래입니다.

- `/admin*` 가 익명 공개 preview 에서 계속 차단되는지
- 로그인 후에도 관리자 capability 없는 사용자가 운영 변경 API 를 쓰지 못하는지
- 일반 업무 화면과 관리자 운영 화면이 섞이지 않는지
- 감사 응답과 문서에 raw `storageKey`, bucket 이름, public URL, secret 이 없는지
- production 작업이 별도 승인 항목으로 분리돼 있는지

## 8. 다음 단계 권장 순서

다음 구현자는 보통 아래 순서로 이어가면 됩니다.

1. `docs/architecture/phase-9-admin-audit-scope.md` 와 이 handoff 문서를 먼저 읽음
2. `packages/shared/src/contracts.ts` 에 admin schema/event type 을 먼저 확인하거나 보강함
3. `apps/api/src/app.ts` 의 `/api/admin/*` skeleton 에서 capability guard 와 company boundary 를 먼저 맞춤
4. `apps/web/app/admin/*` 화면을 실제 placeholder 흐름과 연결하되 일반 업무 화면에 섞지 않음
5. `apps/web/admin-preview-guard.test.ts`, `packages/shared/test/contracts.spec.ts`, `apps/api/test/auth-org.spec.ts` 같은 회귀를 유지함
6. 필요하면 admin audit 전용 테스트를 추가하되 민감값 마스킹을 먼저 검증함
7. 공개 preview 재배포/재스모크가 필요하면 별도 운영 handoff 에 실제 실행 결과를 남김

## 9. 별도 승인 필요 사항

아래는 다음 단계에서도 여전히 별도 승인 없이는 하면 안 됩니다.

1. 실제 운영 사용자/권한 변경 실행
2. production 정책 저장
3. production DB migration 실행
4. 운영 파일 실제 업로드/삭제
5. 외부 감사 시스템, 외부 로그 적재, 외부 알림 연동
6. secret 입력/교체
7. DNS/custom domain 변경
8. 비용 증가 가능성이 있는 리소스 확대

정리하면 이번 문서의 핵심은 하나입니다.
관리자 기능의 첫 성공 기준은 "바로 운영에서 변경을 눌렀다"가 아니라,
"일반 업무 화면과 운영 통제를 분리하고, 감사 후보와 비노출 원칙을 먼저 잠갔다" 입니다.
