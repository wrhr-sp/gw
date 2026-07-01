# Phase 37 내부 운영 저장흐름·감사 연결 fit-gap 범위

## 1. 한 줄 결론

이번 Phase 37의 목적은 `/documents`, `/admin/audit-logs`, `work-items`, `/payroll`, `/management` 주변에 이미 흩어져 있는 저장소·첨부·감사 흔적을 한 문장으로 묶어, "지금 어디까지는 metadata/preview/read-only로 확인 가능하고 어디부터는 아직 승인 게이트인지"를 다시 고정하는 것이다.

핵심은 실제 운영 마이그레이션이나 백업 자동화가 아니라, 내부 운영 저장흐름을 안전한 문서 언어로 먼저 정리하는 것이다.

## 2. 왜 지금 이 Phase가 필요한가

직전 Phase 35에서는 `/management`, `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 같은 관리자 흐름을 먼저 정리했다.
직전 Phase 36에서는 `/dashboard`·`/menu` shortcut, `/org`·`/employees` 일반 조회, `/admin/users`·`/admin/policies`·`/admin/audit-logs` 운영 검토를 같은 회사 설정 모델 언어로 다시 맞췄다.

그 다음 단계에서는 "관리자가 실제로 다루는 민감한 문서/첨부/감사 흔적이 어디까지 연결돼 있는가"를 분리해서 읽을 수 있어야 한다.
특히 아래 세 축이 이미 코드와 테스트에 동시에 존재한다.

1. 문서 파일 업로드/다운로드/삭제의 dev-safe lifecycle
2. 감사 로그의 masked preview 와 storage reference 요약
3. 업무/급여/운영 검토 화면에서 raw 원문 대신 metadata-only 또는 approval gate 로 남겨 둔 경계

이 세 축을 같은 제품 언어로 다시 묶는 것이 이번 fit-gap의 핵심이다.

## 3. 이번 Phase에서 직접 다루는 범위

### 3-1. 문서 파일 lifecycle을 쉬운 말로 다시 고정한다

이번 Phase에서는 `/documents` 와 관련 API를 아래 순서로 읽히게 정리한다.

- upload-init: 파일 메타데이터와 업로드 준비 상태를 먼저 만든다.
- upload-complete: 업로드 완료 후 `storageStatus` 가 `ready` 로 바뀐 상태를 본다.
- download-init: 실제 공개 다운로드가 아니라, 내부 다운로드 준비 액션과 preview 경계를 본다.
- delete/archive: 파일 상태가 보관/삭제 쪽으로 이동할 때 `status` 와 `storageStatus` 의미를 분리해 읽는다.

문서화 기준은 아래와 같다.

- raw `storageKey`, bucket 이름, public URL, signed URL 전문은 기본 설명에 노출하지 않는다.
- `pending` / `ready` / `deleted` 같은 저장 상태는 보여 주되, 실운영 외부 공유가 열린 것처럼 쓰지 않는다.
- `mock` provider 와 `r2` Production-ready (실구현) provider 차이는 "준비 방식" 차이로 설명하고, production 연결 완료처럼 적지 않는다.
- `objectKeyPreview` 같은 preview 문자열은 내부 경로 힌트일 뿐, 외부 반출 기능이나 공개 링크와 같은 말로 쓰지 않는다.

### 3-2. 감사 로그에서 storage 흔적을 어디까지 보여 줄지 고정한다

`/admin/audit-logs` 는 이번 Phase에서도 계속 read-only 흐름으로 본다.
다만 storage 관련 흔적은 아래처럼 설명을 더 분명히 맞춘다.

- before/after 는 raw 원문이 아니라 masked preview 이다.
- `maskedFields` 는 숨긴 민감 정보가 있음을 알려 주는 장치다.
- `storageRef` 는 `fileId`, `spaceId`, `versionId`, `storageStatus` 수준의 참조 요약이다.
- 감사 로그의 목적은 "누가 무엇을 바꿨는지 검토"이지, raw 파일 원문이나 실제 object 저장소를 열람하는 것이 아니다.
- export/download/external sink 는 아직 이번 범위가 아니다.

### 3-3. 업무/급여/운영 화면의 첨부·민감 자료 경계를 다시 맞춘다

`/management`, `/payroll`, `work-items` 계열 화면은 이미 민감한 운영 맥락을 담고 있지만, 그렇다고 raw 원문 저장/외부 제출/실지급/실신고까지 닫힌 것은 아니다.

이번 Phase에서는 아래 원칙을 문서에 다시 고정한다.

- `work-items` 의 첨부/문서/리뷰는 "공통 업무 엔진에 붙는 metadata/preview/read-only Production-ready (실구현)" 으로 읽는다.
- labor/legal/tax/payroll 문맥에서 민감 원문 저장 확대는 아직 승인 게이트다.
- `/payroll` 의 preview 금액, `/work-items/*` 의 review/deadline/attachment, `/admin/audit-logs` 의 감사 preview 를 같은 "운영 검토용 read model" 계층으로 정리한다.
- 파일 접근 흔적과 감사 흔적은 사용자-facing 완성 기능이 아니라 내부 운영 안전장치 언어로 설명한다.

### 3-4. 문서·공유 계약·API·DB·테스트 증거를 한 문장으로 연결한다

이번 Phase 문서는 단순 아이디어 문서가 아니라, 이미 존재하는 구현 흔적을 묶는 기준 문서여야 한다.
그래서 아래 계층을 같이 근거로 삼는다.

- 문서 기준: Phase 8, Phase 15, Phase 35, Phase 36 관련 scope/handoff
- 공유 계약 기준: `packages/shared/src/contracts.ts`
- API 기준: `apps/api/src/app.ts`, `apps/api/src/lib/document-storage.ts`, `apps/api/src/lib/operational-collab.ts`, `apps/api/src/lib/operational-admin.ts`, `apps/api/src/lib/operational-management.ts`
- DB 기준: `db/migrations/0005_boards_documents_phase5.sql`, `db/postgres/migrations/0001_initial_operational_schema.sql`, `db/postgres/migrations/0003_phase35_payroll_workitems_admin.sql`
- 테스트 기준: `apps/api/test/auth-org.spec.ts` 및 관련 web/shared 회귀 테스트

## 4. 이번 Phase에서 일부러 하지 않는 것

이번 Phase는 아래를 구현 완료처럼 약속하지 않는다.

- 실제 backup/restore 자동화
- 실제 export/download 외부 반출 기능
- 운영 DB migration 실행
- production bucket 연결 승인/secret 입력
- public file share 또는 외부 signed URL 배포
- 실민감 원문 대량 업로드 확대
- 실지급/실세무신고/외부 기관 제출
- production DB 실데이터 보정

즉 이번 Phase는 "실행"보다 "경계 언어 고정"이 우선이다.

## 5. 현재 확인된 대표 근거

### 문서 파일/저장소
- `apps/api/src/lib/document-storage.ts`
  - 허용 MIME, 최대 파일 크기, 안전한 object key 생성 규칙이 있다.
- `apps/api/src/lib/operational-collab.ts`
  - 문서 파일을 `storageStatus`, `storageProvider`, `checksumSha256`, `archived` 의미로 읽는 흔적이 있다.
- `apps/api/test/auth-org.spec.ts`
  - `upload-init` → `upload-complete` → `download-init` → `delete` 흐름과 `pending`/`ready`/`deleted` 상태가 테스트로 붙어 있다.

### 감사 로그/운영 검토
- `apps/api/src/lib/operational-admin.ts`
  - `maskedFields`, masked before/after preview, `storageRef(fileId/spaceId/versionId/storageStatus)` 구조가 있다.
- `apps/api/test/auth-org.spec.ts`
  - raw `storageKey`, bucket, signed URL 이 응답에 새지 않아야 한다는 검증 흔적이 있다.

### 업무/급여/운영 DB 연결
- `apps/api/src/lib/operational-management.ts`
  - payroll/work item review, preview, approval gate, attachment metadata 연결 흔적이 있다.
- `db/postgres/migrations/0003_phase35_payroll_workitems_admin.sql`
  - work item audit log 와 관리자용 운영 데이터 구조가 있다.
- `db/migrations/0005_boards_documents_phase5.sql`
  - document spaces / document files 기본 테이블 흔적이 있다.
- `db/postgres/migrations/0001_initial_operational_schema.sql`
  - operational documents / audit logs / checksum 관련 구조가 있다.

## 6. 이번 fit-gap의 핵심 판정 질문

문서/코드 대조 후 아래 질문에 같은 답이 나와야 한다.

1. `/documents` 는 지금 실제 외부 파일 공유가 아니라 내부 metadata + upload/download 준비 흐름으로 읽히는가
2. `storageStatus` 는 파일 존재 여부·보관 상태를 설명할 뿐, public download 완료 뜻으로 오해되지 않는가
3. `/admin/audit-logs` 는 storage 흔적을 보여 주더라도 raw 원문/secret/bucket/public URL 을 드러내지 않는가
4. `work-items`·`/payroll`·`/management` 의 민감 자료 설명이 raw 원문 저장과 metadata preview 를 섞지 않는가
5. backup/export/migration 은 현재 근거가 부족하거나 별도 승인 범위라는 사실이 문서에서 숨겨지지 않는가
6. production DB, secret, 실운영 업로드 확대, 외부 반출, 실지급/실신고/외부기관 제출이 계속 승인 게이트로 남는가

## 7. 이번 Phase에서 권장하는 쉬운 확인 순서

1. `/dashboard`
2. `/documents`
3. `/admin/audit-logs`
4. `/management`
5. `/payroll`
6. `/work-items/tax`
7. `/work-items/labor`
8. `/work-items/legal`

이 순서는 "일반 진입 → 문서 파일 → 감사 preview → 민감 운영 모듈" 순서를 유지하기 위한 것이다.

## 7-1. 2026-06-16 parent 재검증 반영 메모

이번 범위 문서는 아래 parent 재검증 결과와 어긋나지 않아야 한다.

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

이번 재검증으로 다시 고정하는 범위:
- `/documents`, `/management`, `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 는 local preview smoke 기준 다시 200 이었다.
- raw storage 비노출, masked audit preview, metadata-only/approval gate 경계는 여전히 `apps/api/test/auth-org.spec.ts` 와 같은 뜻이어야 한다.
- 8790 포트 충돌이 있으면 8791 같은 빈 포트로 같은 build 산출물을 재확인할 수 있지만, 이 결과를 live 운영 확인처럼 쓰면 안 된다.

## 8. 다음 작업자에게 넘길 핵심 문장

- 이번 Phase 37은 내부 운영 저장흐름을 실제 운영 개방처럼 쓰지 않게 만드는 fit-gap 문서화 단계다.
- 문서 파일 lifecycle, 감사 storage preview, 업무/급여 민감자료 approval gate 를 같은 언어로 다시 맞추는 것이 핵심이다.
- backup/export/migration/secret/production 실데이터는 이번 범위가 아니다.
- 후속 구현이 생겨도 먼저 raw storage 비노출, metadata-only, read-only audit, approval gate 원칙을 깨지 않는지부터 확인해야 한다.
