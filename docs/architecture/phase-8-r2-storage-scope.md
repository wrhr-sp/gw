# 그룹웨어 Phase 8 R2 문서/첨부파일 저장소 연결 1차 범위

## 1. 문제 정의

Phase 5 에서 문서함/첨부 metadata skeleton 과 접근 경계는 먼저 잡았지만, 실제 파일 본문을 어디에 어떻게 보관하고 어떤 승인 게이트 아래에서 연결할지는 아직 고정되지 않았습니다.
이번 Phase 8 의 목표는 "운영 파일 업로드나 공개 URL 오픈 없이도, 다음 구현자가 dev/preview-safe 범위에서 R2 연결 skeleton 을 바로 만들 수 있게" 최소 범위와 보안 원칙을 먼저 고정하는 것입니다.

## 2. 현재 확인한 사실

확인 기준 문서/파일:

- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/product/groupware-vision-roadmap.md`
- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/wrangler.bindings.example.jsonc`

현재 사실은 아래와 같습니다.

- Phase 5 에서 문서함/첨부 metadata skeleton, 문서 공간 권한, read receipt, storage key 비노출 guardrail 이 이미 문서와 테스트에 들어가 있습니다.
- 현재 shared 계약의 `documentFileSchema` 는 `storageKey` 를 응답에 노출하지 않으며, 첨부는 아직 metadata placeholder 중심입니다.
- 상위 handoff 기준으로 대장 승인 범위 안에서 Cloudflare R2 bucket `gw-files` 생성과 preview/dev binding `FILES_BUCKET` 반영, `wrangler deploy --dry-run` binding 확인, API typecheck 통과가 선행 완료되었습니다.
- 다만 이 공유 로컬 worktree 는 `origin/main` 보다 뒤처진 흔적과 dirty 문서 변경이 남아 있을 수 있으므로, 다음 구현자는 코딩 전에 최신 main 기준 재동기화 여부를 먼저 확인해야 합니다.
- 제품 로드맵은 문서/파일 저장보다 접근 제어, 회사 경계, 운영 통제를 먼저 맞추라고 요구합니다.

즉, 이번 1차는 "R2 를 쓸 수 있는 준비는 일부 되었지만, 실운영 업로드를 여는 단계는 아니고, mock/local-safe + binding-aware skeleton 을 먼저 맞추는 게이트" 입니다.

## 3. 이번 Phase에서 고정하는 권고안

### 권고안 A. private-by-default + D1 metadata 우선 + mock/local 기본 검증

이번 1차는 아래 원칙을 기본안으로 고정합니다.

1. 파일 본문 저장소는 R2 를 전제로 설계하되, 기본 검증은 mock/local-safe adapter 로 먼저 통과시킵니다.
2. 파일 메타데이터의 기준 저장소는 계속 D1 `document_files` 계열 레코드입니다.
3. 클라이언트는 R2 bucket 경로, public URL, raw storage key 를 직접 알지 못합니다.
4. 다운로드/업로드 접근은 문서 공간 권한과 회사 경계 검사를 API 가 먼저 통과시킨 뒤에만 열립니다.
5. 1차는 public URL 이 아니라 짧은 TTL 의 signed/private access 전제를 유지합니다.

이 방향을 고정하는 이유는 아래와 같습니다.

- Phase 5 에서 이미 만든 document space/file metadata skeleton 과 자연스럽게 이어집니다.
- 제품 로드맵의 "문서/R2 확장 시 접근 제어 우선" 원칙과 맞습니다.
- 운영 리소스 사용을 최소화하면서도 다음 구현 카드가 실제 adapter 경계를 먼저 만들 수 있습니다.
- 나중에 바이러스 검사, OCR, 미리보기 변환, 문서 버전 관리, 감사 로그를 붙일 때도 D1 metadata 가 기준점 역할을 할 수 있습니다.

### 이번 1차에서 채택하지 않는 방향

- 문서 파일을 public bucket URL 로 바로 여는 방식
- 문서 metadata 없이 파일 경로만 클라이언트가 들고 다니는 방식
- board/post 첨부, 외부 공유 링크, OCR, 전자서명, 검색 색인까지 한 번에 묶는 큰 범위
- 실제 운영 파일을 bucket 에 업로드해 가며 smoke 하는 검증 방식

## 4. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 8 R2 저장소 연결 1차 기준 문서 작성
- object key 규칙, tenant/company boundary, MIME/size 정책, metadata 저장 위치, signed/private access 원칙 확정
- dev/preview-safe mock/local 검증 기준과 production gate 명시
- 다음 구현 카드가 바로 따라갈 파일/테스트/문서 대상과 완료 기준 정리

### 구현 범위

이번 1차 구현 카드에서 허용하는 범위는 아래입니다.

- R2 storage adapter interface
- mock/in-memory 또는 local-safe adapter 구현
- `FILES_BUCKET` binding 을 optional 하게 읽는 R2-aware adapter skeleton
- 문서/첨부 metadata API 계약 보강
- upload/download/delete 후보 endpoint skeleton 또는 handler 추가
- object key 생성 규칙과 회사 경계 guardrail 추가
- 회귀 테스트 추가

### 이번 1차의 최소 성공 범위

이번 1차가 끝났다고 보기 위한 최소 성공 범위는 아래입니다.

- 문서 공간 권한을 통과한 사용자만 업로드 준비/다운로드 준비 요청을 만들 수 있음
- 응답에 raw `storageKey`, bucket 이름, public URL 이 노출되지 않음
- mock/local adapter 기준으로 upload/download/delete 흐름이 테스트 가능함
- `FILES_BUCKET` binding 이 없더라도 로컬 테스트가 깨지지 않음
- binding 이 있을 때도 운영 업로드 없이 dry-run 또는 mock 경계에서 동작 방향을 검증할 수 있음

## 5. object key 규칙

이번 1차 object key 기본 규칙은 아래처럼 둡니다.

```text
companies/{companyId}/spaces/{spaceId}/files/{fileId}/versions/{versionId}/{safeFileName}
```

세부 원칙:

1. key 첫 구간에 반드시 `companyId` 를 둡니다.
   - 타 회사 데이터 혼입을 방지하기 위한 가장 바깥 경계입니다.
2. 문서 공간(`spaceId`)과 파일(`fileId`)을 분리해 둡니다.
   - 같은 공간 안 여러 파일, 같은 파일의 버전 확장을 쉽게 하기 위함입니다.
3. 원본 파일명은 그대로 경로 전체를 대표하지 않고 마지막 `safeFileName` 에만 제한적으로 둡니다.
   - 공백/한글/특수문자 문제를 줄이기 위해 slug 또는 sanitize 처리합니다.
4. `versionId` 는 실제 구현에서 UUID 또는 증가 라벨 어느 쪽이든 가능하지만, key 에는 별도 구간으로 남깁니다.
5. 사용자가 입력한 회사명/부서명/개인정보를 key 경로에 직접 넣지 않습니다.
6. board/post 첨부는 이번 1차 범위에서 같은 prefix 를 재사용하지 않습니다.
   - 이번 문서는 document space/file 흐름만 먼저 고정합니다.

권장 보조 규칙:

- key 생성은 클라이언트가 아니라 API/server adapter 가 전담합니다.
- 동일 파일명 재업로드 시 key 충돌 회피를 위해 `fileId` 또는 `versionId` 기반으로 결정합니다.
- 로그에는 전체 key 전문 대신 fileId/companyId 정도만 남기고 raw key 전문은 숨깁니다.

## 6. tenant/company boundary 와 권한 기준

### 경계 기준

- 회사 경계는 항상 최우선입니다.
- `companyId` 가 다른 문서 공간, 파일, read receipt, signed URL 요청은 모두 차단합니다.
- tenant 가 별도 도입되는 경우에도 1차 구현은 최소한 `companyId` 경계를 깨지 않는 구조여야 합니다.
- 문서 공간 visibility(`company`, `department`, `private`) 판정이 끝나기 전에는 어떤 storage 작업도 시작하지 않습니다.

### 권한 기준

1. 업로드 준비
   - 최소 `document.file.write`
   - 대상 `spaceId` 접근 가능
2. 다운로드 준비
   - 최소 `document.file.read`
   - 대상 파일이 속한 `spaceId` 접근 가능
3. 삭제 후보
   - 최소 `document.file.write` 또는 `document.space.manage`
   - soft-delete metadata 정책과 충돌하지 않아야 함
4. 관리자 예외
   - `COMPANY_ADMIN` 이라도 다른 회사 파일에는 접근하지 않음

### 응답 보안 기준

아래 값은 API 응답 기본 payload 에 넣지 않습니다.

- raw `storageKey`
- bucket 이름
- Cloudflare account 식별값
- 장기 유효 public URL
- 내부 운영 prefix 전문

클라이언트가 받아도 되는 값은 아래 정도로 제한합니다.

- `fileId`
- 표시용 파일명
- MIME type
- 크기
- 버전 라벨
- placeholder 또는 signed action 정보
- 만료 시각

## 7. MIME / size 제한

이번 1차는 deny-by-default allowlist 로 시작합니다.

### 허용 MIME 후보

- `application/pdf`
- `image/png`
- `image/jpeg`
- `image/webp`
- `text/plain`
- `text/csv`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- `application/vnd.hancom.hwp`
- `application/x-hwp`
- `application/vnd.hancom.hwpx`

운영 메모:

- HWP/HWPX 는 브라우저/OS 별 MIME 흔들림이 있으므로, 1차 구현에서는 허용 목록과 정규화 함수를 같이 둡니다.
- `application/octet-stream` 은 1차 기본 허용 목록에 넣지 않습니다.
- zip, exe, script, macro 중심 파일은 1차에서 제외합니다.

### 크기 제한 기본값

- 파일 1개 최대 25MB
- 요청 본문에서 metadata 등록 payload 는 일반 JSON 기준 수 KB 수준 유지
- 동시 대용량 다중 업로드, chunk upload, resumable upload 는 1차 범위에서 제외

이 제한을 먼저 두는 이유는 아래와 같습니다.

- preview/local 검증 부담을 줄일 수 있습니다.
- 모바일/PWA 와 브라우저 기본 흐름에서 처리하기 쉬운 선입니다.
- 바이러스 검사/미리보기/OCR 없는 상태에서 과도한 범위를 열지 않기 위함입니다.

## 8. metadata 저장 위치와 D1 연계 원칙

이번 1차에서 metadata 의 기준 저장소는 D1 쪽 `document_files` 라고 고정합니다.

기본 원칙:

- R2 는 파일 본문 저장소
- D1 `document_files` 는 검색/목록/권한판정/감사 기준 metadata 저장소
- 실제 다운로드/삭제 가능 여부는 먼저 D1 metadata + 회사/권한 검사를 통과한 뒤 결정

다음 구현 카드에서 검토할 D1 확장 후보:

- `storage_provider` (`r2`, `mock`)
- `storage_object_key` 또는 내부 전용 key 컬럼
- `storage_status` (`pending`, `ready`, `deleted`, `failed`)
- `uploaded_at`
- `deleted_at`
- `checksum_sha256` 또는 동급 checksum 후보

주의:

- `storage_object_key` 는 서버 내부용 컬럼이며 shared response schema 기본 공개 필드로 올리지 않습니다.
- migration 이 필요하더라도 로컬/preview-safe skeleton 범위에서만 다루고, production DB 실행은 별도 승인입니다.

## 9. signed/private access 원칙

이번 1차는 private-by-default 를 기본으로 합니다.

기본 원칙:

1. public bucket URL 을 기능 기본값으로 두지 않습니다.
2. 파일 읽기는 API 의 권한 확인 뒤 짧은 TTL signed action 으로만 엽니다.
3. 업로드도 클라이언트가 임의 key 를 정하지 않고, 서버가 만든 업로드 준비 응답을 통해서만 진행합니다.
4. signed URL 또는 signed action 응답에는 만료 시각을 반드시 포함합니다.
5. 미리보기/다운로드/삭제 각각 별도 action 으로 분리할 수 있게 타입을 잡습니다.

권장 TTL 기본값:

- upload: 5분
- download/preview: 1분~5분
- delete: 서버 내부 action 위주, 클라이언트 직접 호출은 1차에서 열지 않음

local/mock 기준:

- 실제 signed URL 대신 `mockUploadToken`, `mockDownloadToken` 같은 placeholder 응답도 허용
- 다만 응답 형태는 나중에 실제 signed action 으로 바꾸기 쉬운 구조로 둠

## 10. dev / preview-safe 검증 기준

이번 1차 기본 검증은 실제 운영 파일 업로드가 아니라 아래 순서로 둡니다.

### 1) mock/local 기본 검증

- object key 생성 규칙 테스트
- 허용 MIME / 크기 제한 테스트
- 타 회사/비권한 사용자 차단 테스트
- storage key 비노출 테스트
- upload/download/delete 준비 endpoint 계약 테스트
- binding 없음 상태에서도 테스트 통과

### 2) binding-aware 검증

- `FILES_BUCKET` binding 이 있을 때 adapter 선택이 정상인지 확인
- `wrangler deploy --dry-run` 또는 동급 명령 기준으로 binding 이 선언되는지만 확인
- 실제 운영 파일 업로드/다운로드는 하지 않음

### 3) preview-safe smoke

- preview 환경에서 실제 업로드 대신 placeholder upload-init/download-init 응답이 계약대로 오는지 확인
- 응답이 공개 URL 을 강제로 노출하지 않는지 확인
- 실패 시도에서 401/403/404/413 같은 기본 에러 계약이 유지되는지 확인

## 11. 이번 Phase에서 하지 않는 일

이번 1차에서 제외하는 일은 아래와 같습니다.

- production R2 bucket 추가 생성
- 운영 파일 실제 업로드
- public file URL 확정
- custom domain / DNS 연결
- production DB migration 실행
- production 문서/첨부 실데이터 반입
- 외부 공유 링크
- OCR, 바이러스 검사, 미리보기 변환 파이프라인
- 대용량 multipart/chunk/resumable upload
- board/post 첨부까지 범위 확장
- 유료 리소스 확대

## 12. 별도 승인 필요 사항

1. production bucket 추가 생성 또는 구조 변경
2. 운영 파일 실제 업로드/보관 시작
3. 공개 URL, CDN, custom domain, DNS 연결
4. production DB migration 실행
5. 실데이터 반입 또는 기존 문서 데이터 수정
6. 외부 공유 링크 오픈
7. 바이러스 검사/OCR/전자서명/외부 문서보관 SaaS 연동
8. 비용 발생 가능성이 있는 리소스 확대

## 13. 다음 구현자가 바로 따라갈 파일/테스트/문서 대상

### 우선 확인 파일

- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- `apps/api/src/app.ts`
- `apps/api/src/index.ts`
- `apps/api/wrangler.jsonc`
- `apps/api/wrangler.bindings.example.jsonc`
- `apps/api/test/auth-org.spec.ts`
- `db/migrations/0005_boards_documents_phase5.sql`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `README.md`

### 구현 권장 파일

- Create: `apps/api/src/lib/document-storage.ts`
- Create: `apps/api/src/lib/document-storage.mock.ts`
- Create: `apps/api/src/lib/document-storage.r2.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `packages/shared/src/contracts.ts`
- Modify: `packages/shared/src/index.ts`
- Create or Modify: `apps/api/test/document-storage.spec.ts`
- Modify: `apps/api/test/auth-org.spec.ts`
- Create: `db/migrations/0006_document_storage_phase8.sql`
- Optional Modify: `apps/web/app/documents/page.tsx`
- Modify: `README.md`
- Modify: `docs/guides/cloudflare-first-developer-guide.md`
- Modify: `docs/guides/cloudflare-first-user-guide.md`
- Modify: `docs/guides/cloudflare-first-operator-guide.md`

### 계약 후보 endpoint

이번 1차에서 권장하는 후보 endpoint 는 아래입니다.

- `POST /api/documents/files/upload-init`
- `POST /api/documents/files/:fileId/upload-complete`
- `POST /api/documents/files/:fileId/download-init`
- `DELETE /api/documents/files/:fileId`

주의:

- 기존 `POST /api/documents/files/metadata` 를 완전히 버리기보다, metadata-first 흐름과 upload-init 흐름 중 하나로 정리해 계약 중복을 피합니다.
- 만약 구현자가 endpoint 수를 줄이고 싶다면 `metadata` 와 `upload-init` 을 합쳐도 되지만, 권한/검증/상태 전이를 명확히 문서화해야 합니다.

## 14. 테스트 기준

다음 구현 카드는 최소한 아래 테스트를 포함해야 합니다.

### shared/API 계약 테스트

- 허용 MIME 는 통과, 비허용 MIME 는 400 또는 415
- 25MB 초과 파일은 413 또는 명확한 validation error
- 타 회사 `spaceId` upload-init 요청은 403
- private 문서 공간에 일반 사용자가 download-init 요청 시 403
- 응답 payload 에 `storageKey`, bucket 이름, public URL 이 없음
- `FILES_BUCKET` binding 없음 상태에서도 mock adapter 기준 테스트 통과

### adapter 단위 테스트

- object key 생성 결과가 `companyId/spaceId/fileId/versionId` 경계를 포함
- sanitize 되지 않은 파일명이 key 전체를 오염시키지 않음
- mock adapter upload/download/delete 동작이 deterministic 함
- R2 adapter 는 binding 이 없을 때 명확한 fallback 또는 안전한 오류를 반환

### 문서/운영 검증

- `pnpm check`
- `pnpm typecheck`
- `pnpm test`
- 필요 시 `pnpm --filter @gw/api test -- --runInBand`
- binding-aware 검증 근거는 dry-run 또는 typecheck 수준으로 남김

## 15. Definition of Done

다음 구현 카드(`Phase 8 R2 문서/첨부파일 저장소 연결 1차: adapter/API skeleton 구현`)는 아래를 만족하면 완료로 봅니다.

1. 문서 공간 권한과 회사 경계를 먼저 검사하는 storage adapter/API skeleton 이 들어 있다.
2. object key 규칙이 문서와 테스트에 고정되어 있다.
3. 허용 MIME / 크기 제한이 shared 또는 API validation 으로 반영돼 있다.
4. 응답에 raw storage key, bucket 이름, public URL 이 노출되지 않는다.
5. mock/local-safe 검증이 가능하고, binding 없음 상태에서도 로컬 테스트가 통과한다.
6. `FILES_BUCKET` binding 이 있을 때 future R2 adapter 로 이어질 구조가 코드에 드러난다.
7. production bucket 추가 생성, 운영 파일 업로드, public URL 확정, production DB 실행이 이번 범위 밖이라는 점이 문서에 다시 남아 있다.
8. README 와 개발자/사용자/운영자 가이드가 새 기준을 함께 가리킨다.

## 16. 구현 전 체크리스트

다음 구현자는 시작 전에 아래를 먼저 확인합니다.

1. 공유 worktree 가 최신 `origin/main` 기준인지 확인
2. `packages/shared` 와 `apps/api` 의 현재 document contract 중복 여부 확인
3. `metadata-first` 와 `upload-init-first` 중 어떤 흐름으로 갈지 작은 범위에서 결정
4. `db/migrations/0005_boards_documents_phase5.sql` 뒤에 필요한 storage 내부 컬럼만 최소 추가
5. mock adapter 를 먼저 통과시킨 뒤 binding-aware 경로를 붙임
6. 실제 운영 업로드, public URL, DNS, 실데이터 작업이 카드 범위가 아님을 다시 확인

즉, 이번 문서는 "문서/첨부파일을 실제 운영으로 여는 카드"가 아니라, "보안 경계와 승인 게이트를 먼저 잠그고 나서 다음 구현자가 안전하게 storage skeleton 을 붙이는 기준 문서" 입니다.
