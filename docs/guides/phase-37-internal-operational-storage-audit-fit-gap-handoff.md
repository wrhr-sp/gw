# Phase 37 내부 운영 저장흐름·감사 연결 fit-gap handoff

## 1. 이 문서가 필요한 이유

이번 handoff는 Phase 37을 "새 기능을 더 여는 단계"가 아니라 "이미 있는 저장흐름·감사흐름을 과장 없이 같은 언어로 묶는 단계"로 이해하게 만들기 위한 것이다.

직전까지는 아래 흐름이 각각 따로 읽혔다.

- `/documents` 의 파일 lifecycle
- `/admin/audit-logs` 의 masked 감사 preview
- `/management`, `/payroll`, `work-items` 의 민감 운영 검토 흐름

이번 문서의 목적은 이 셋을 하나의 내부 운영 저장흐름으로 다시 연결하는 것이다.

## 2. 이번 Phase 37을 쉬운 말로 설명하면

"파일을 실제로 밖으로 내보내거나 운영 DB를 옮기는 단계가 아니라,
어디까지는 이미 읽어볼 수 있고 어디부터는 아직 승인 게이트인지 다시 선 긋는 단계"다.

즉,

- 문서 파일은 upload/download 준비와 상태 변경을 읽는다.
- 감사 로그는 storage 흔적을 masked preview 로 읽는다.
- 급여/세무/노무/법무는 민감 원문 대신 metadata/preview/approval gate 로 읽는다.
- backup/export/migration 은 아직 이번 단계의 완료 기준이 아니다.

## 3. 지금 바로 확인 가능한 것

### A. `/documents`

지금 바로 읽을 수 있는 것:
- 파일 메타데이터
- 업로드 준비 상태
- 업로드 완료 후 `storageStatus`
- 다운로드 준비 액션
- 삭제/보관 후 상태 변경 의미

지금 과장하면 안 되는 것:
- 외부 공개 다운로드 완료
- public URL 발급 완료
- 운영 파일 공유 정책 완료
- production bucket 운영 완료

### B. `/admin/audit-logs`

지금 바로 읽을 수 있는 것:
- `audit.read` 기준 read-only 감사 흐름
- masked before/after preview
- `maskedFields`
- `storageRef(fileId/spaceId/versionId/storageStatus)` 수준의 storage 참조

지금 과장하면 안 되는 것:
- raw 감사 원문 조회
- 파일 원문 직접 열람
- export/download/외부 감사 시스템 전송
- 관리자 조치 자동화 완료

### C. `/management`, `/payroll`, `work-items/*`

지금 바로 읽을 수 있는 것:
- 민감 운영 모듈의 preview/read-only/review skeleton
- approval gate 와 review step 의미
- 첨부/문서/감사 흔적이 metadata 중심으로 연결되는 구조

지금 과장하면 안 되는 것:
- 실지급
- 실세무 신고
- 실노무/실법무 원문 처리 확대
- 외부 전문가/기관 연동 완료

## 4. 이번에 기준 근거로 본 파일

문서 기준:
- `docs/architecture/phase-8-r2-storage-scope.md`
- `docs/guides/phase-8-r2-storage-handoff.md`
- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`
- `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`
- `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`
- `docs/architecture/phase-36-admin-settings-company-policy-permission-fit-gap-scope.md`
- `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md`

구현/계약 기준:
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/src/lib/document-storage.ts`
- `apps/api/src/lib/operational-collab.ts`
- `apps/api/src/lib/operational-admin.ts`
- `apps/api/src/lib/operational-management.ts`

DB 기준:
- `db/migrations/0005_boards_documents_phase5.sql`
- `db/postgres/migrations/0001_initial_operational_schema.sql`
- `db/postgres/migrations/0003_phase35_payroll_workitems_admin.sql`

테스트 기준:
- `apps/api/test/auth-org.spec.ts`

## 5. 다음 작업자가 문장을 쓸 때 반드시 지킬 것

1. raw `storageKey`, bucket 이름, public URL, signed URL 전문을 기본 설명으로 쓰지 말 것
2. `storageStatus` 를 외부 공유 완료 뜻처럼 쓰지 말 것
3. audit 의 storage 흔적은 read-only preview 언어로만 설명할 것
4. payroll/work-items 민감자료를 실원문 저장 완료처럼 쓰지 말 것
5. backup/export/migration 을 이번 Phase 완료 기준처럼 쓰지 말 것
6. production DB, secret, 실업로드 확대, 외부 반출, 실지급/실신고/외부기관 제출은 계속 승인 게이트로 남길 것

## 6. 대장이 가장 짧게 다시 볼 추천 순서

1. `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`
2. `/documents`
3. `/admin/audit-logs`
4. `/management`
5. `/payroll`
6. `/work-items/tax`
7. `/work-items/labor`
8. `/work-items/legal`
9. `apps/api/test/auth-org.spec.ts`

## 6-1. 2026-06-16 parent 재검증으로 다시 확인된 것

이번 문서는 parent 재검증 결과까지 반영해 다시 읽습니다.

다시 통과한 검증 명령:
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/web test -- admin-console-pass1.test.tsx phase34-real-usage.test.tsx work-items.test.tsx phase37-storage-boundaries.test.tsx`
- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/shared typecheck`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- `pnpm --filter @gw/web build:cf`
- `pnpm check`
- `BASE_URL=http://127.0.0.1:8791 bash scripts/gw-admin-host-preview-smoke.sh`

이번 재검증에서 문서에 바로 반영할 핵심 판정:
- `/documents` 는 여전히 외부 파일 공유가 아니라 upload/download 준비와 `storageStatus` 상태 전이를 읽는 내부 문서 흐름으로 봐야 한다.
- `/admin/audit-logs` 는 storage 흔적을 보여 주더라도 masked preview 와 `storageRef` 수준만 유지하고 raw `storageKey`·bucket·signed URL 은 계속 비노출이다.
- `/management`, `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 는 local preview smoke 기준 다시 열리지만, 실원문 저장/실지급/실신고/외부 제출을 연 것으로 읽으면 안 된다.
- 8790 포트는 기존 workerd listener 충돌이 있어 8791 로 옮겨 smoke 했고, 이는 live URL 대체가 아니라 같은 build 산출물의 local preview 증거다.

즉 Phase 37 문서는 이제 단순 설명 문서가 아니라,
실제 route/API/build/preview 재검증까지 다시 통과한 경계를 바탕으로 읽어야 합니다.

## 7. 이번 Phase에서 남겨야 하는 fit-gap 메모

### 지금 이미 근거가 있는 것
- 문서 파일 lifecycle 자체는 route/API/test 흔적이 있다.
- 감사 로그 masked preview 와 storage reference 흔적도 있다.
- payroll/work-items/management 에는 민감 운영 검토용 metadata/review/approval gate 언어가 이미 있다.

### 아직 비어 있거나 별도 승인인 것
- backup/restore 자동화
- export/download 외부 반출
- migration 실행
- production bucket/secret 연결
- public share
- 실민감 원문 저장 확대
- 실지급/실신고/외부기관 제출

## 8. 후속 구현이 필요하면 먼저 분리할 카드 종류

- 문서 정합성 보강 카드: scope/handoff/루트 문서 업데이트
- 구현 카드: 문서 파일 상태/감사 preview/work-item attachment copy 보강
- 리뷰 카드: raw storage 비노출, metadata-only, approval gate 경계 확인
- 테스트 카드: upload/download/delete 상태, audit masking, role boundary 회귀 확인

한 카드에서 backup/export/migration/secret/production 실데이터까지 같이 밀어 넣지 않는 것이 중요하다.

## 9. 최종 한 줄 메모

Phase 37은 "운영 저장흐름을 실제 운영 개방처럼 보이지 않게 정리하는 문서 단계"이며, 문서 파일 lifecycle · 감사 storage preview · 민감 운영 모듈 approval gate 를 같은 언어로 맞추는 것이 완료 기준이다.
