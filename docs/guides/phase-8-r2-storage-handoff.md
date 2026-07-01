# Phase 8 R2 문서/첨부파일 저장소 연결 1차 handoff

한 줄 요약:
이번 1차는 "실제 운영 파일 업로드를 여는 작업"이 아니라, 문서/첨부파일을 나중에 안전하게 붙일 수 있도록 사용자 흐름, 운영 승인 게이트, object key/권한/삭제 원칙을 먼저 고정한 단계입니다.

## 1. 지금 무엇까지 된 상태인가

현재 저장소에는 아래 기준이 이미 코드와 문서에 반영돼 있습니다.

- 기준 문서: `docs/architecture/phase-8-r2-storage-scope.md`
- 공통 계약: `packages/shared/src/contracts.ts`
- API Production-ready (실구현): `apps/api/src/app.ts`
- storage adapter Production-ready (실구현): `apps/api/src/lib/document-storage.ts`, `apps/api/src/lib/document-storage.mock.ts`, `apps/api/src/lib/document-storage.r2.ts`
- 테스트: `apps/api/test/auth-org.spec.ts`, `apps/api/test/document-storage.spec.ts`

즉, 지금은 아래가 된 상태입니다.

- 문서 파일 metadata 와 upload/download/delete 준비 흐름이 계약에 들어가 있음
- `FILES_BUCKET` binding 이 없어도 mock adapter 로 로컬 테스트 가능함
- binding 이 있으면 provider 를 `r2` 로 잡는 Production-ready (실구현) 응답까지는 확인 가능함
- raw `storageKey`, bucket 이름, public URL 을 응답에 직접 노출하지 않도록 guardrail 이 들어가 있음

반대로 아직 하지 않은 일은 아래입니다.

- production R2 bucket 추가 생성
- 운영 파일 실제 업로드
- public file URL 확정
- custom domain / DNS 연결
- production DB migration 실행
- 외부 공유 링크, OCR, 전자서명, 외부 문서보관 연동

## 2. 사용자 관점 흐름

사용자는 지금 단계에서 "파일이 이미 운영 저장소에 올라간다"고 이해하면 안 됩니다.
지금은 안전한 흐름을 먼저 고정한 상태입니다.

### 업로드 준비 흐름

1. 사용자가 문서함에 들어감
2. API 가 먼저 문서 공간 접근 권한과 회사 경계를 확인함
3. 허용 MIME 인지, 25MB 이하인지 검사함
4. 통과하면 `upload-init` 응답으로 Production-ready (실구현) action 을 돌려줌
5. 이 응답에는 업로드 토큰, 만료 시각, object key preview 같은 최소 정보만 들어감
6. raw `storageKey`, bucket 이름, public URL 은 내려주지 않음

현재 코드 기준 관련 endpoint 는 아래입니다.

- `POST /api/documents/files/upload-init`
- `POST /api/documents/files/:fileId/upload-complete`

상태 전이는 아래처럼 이해하면 됩니다.

- 업로드 준비 직후: `storageStatus = pending`
- 업로드 완료 Production-ready (실구현) 처리 후: `storageStatus = ready`

### 다운로드 준비 흐름

1. 사용자가 문서 파일 다운로드를 시도함
2. API 가 `document.file.read` 권한과 같은 회사/같은 문서 공간 접근 여부를 먼저 확인함
3. 통과하면 짧은 만료 시각이 붙은 download Production-ready (실구현) action 을 돌려줌
4. 공개 URL 을 바로 주는 방식은 기본값이 아님

관련 endpoint:

- `POST /api/documents/files/:fileId/download-init`

### 삭제 흐름

1. 사용자가 삭제를 시도함
2. API 가 `document.file.write` 권한과 접근 가능 파일인지 먼저 확인함
3. storage adapter delete Production-ready (실구현) 를 호출함
4. 응답에서는 파일을 바로 완전 삭제했다고 과장하지 않고, 상태를 archive/deleted 쪽으로 바꿈

현재 코드 기준 상태 전이:

- `storageStatus = deleted`
- `status = archived`

관련 endpoint:

- `DELETE /api/documents/files/:fileId`

## 3. 운영자 관점의 R2 승인 게이트

운영자는 이번 1차를 "R2 연결 준비"로 보면 되고, "운영 오픈 승인"으로 보면 안 됩니다.

### 지금 운영자가 확인할 것

- 문서/첨부 흐름이 private-by-default 로 설명돼 있는지
- object key prefix 가 회사 경계를 먼저 두는지
- 응답에 raw `storageKey`, bucket 이름, public URL 이 없는지
- mock/local-safe 검증과 binding-aware 검증이 분리돼 있는지
- production 작업이 별도 승인 필요 항목으로 분리돼 있는지

### 이번 단계에서 승인 없이 하면 안 되는 일

- production R2 bucket 생성/변경
- 운영 파일 실제 업로드
- public URL 또는 외부 공유 링크 오픈
- DNS/custom domain 연결
- production DB migration 실행
- production 문서/첨부 실데이터 반입
- 비용이 늘 수 있는 유료 리소스 확대

즉, 운영자는 "지금 당장 파일 기능을 외부에 열어도 되나?"를 묻기보다,
"보안 경계와 승인 문구가 먼저 잠겨 있나?"를 확인하는 역할에 가깝습니다.

## 4. dev/preview 와 production 차이

### dev/preview 에서 허용하는 것

- mock/local-safe adapter 검증
- `FILES_BUCKET` binding 유무에 따른 provider 선택 확인
- upload-init / download-init / delete Production-ready (실구현) 응답 계약 확인
- `pnpm check`, `pnpm test`, `pnpm typecheck` 같은 로컬 검증
- 필요 시 dry-run 수준의 binding-aware 확인

### production 에서 별도 승인 없이는 금지인 것

- 실제 운영 파일 저장 시작
- production bucket 추가 생성
- 운영 DB migration 실행
- public file URL 확정
- DNS/custom domain 연결
- 실데이터 반입/수정

간단히 말하면:

- dev/preview = 안전한 계약과 경계 검증 단계
- production = 실제 파일 보관을 여는 단계이며 별도 승인 필요

## 5. object key / 권한 / 보존 / 삭제 기본 원칙

### object key 원칙

기본 규칙은 아래입니다.

```text
companies/{companyId}/spaces/{spaceId}/files/{fileId}/versions/{versionId}/{safeFileName}
```

왜 이렇게 두는지:

- 가장 앞에서 회사 경계를 자르기 쉬움
- 문서 공간, 파일, 버전을 분리해 이후 확장에 유리함
- 원본 파일명은 sanitize 해서 마지막 segment 에만 제한적으로 둠

현재 테스트에서는 파일명 `phase8-plan v1.pdf` 가 `phase8-plan-v1.pdf` 로 sanitize 되는 것도 확인합니다.

### 권한 원칙

- 업로드 준비: `document.file.write`
- 다운로드 준비: `document.file.read`
- 삭제: `document.file.write` 중심
- 관리자라도 다른 회사 파일에는 접근하지 않음
- 문서 공간 접근이 확인되기 전에는 storage 작업을 시작하지 않음

### 보존/상태 원칙

현재 1차는 "정교한 보존 기간 정책"보다 "상태를 안전하게 나누는 것"이 먼저입니다.

- metadata 기준 저장소는 계속 D1 `document_files` 계열
- 업로드 준비 중: `pending`
- 업로드 완료 후: `ready`
- 삭제 처리 후: `deleted`
- 문서 레코드 상태는 삭제 시 `archived` 로 이동
- checksum 은 업로드 완료 시 선택적으로 기록 가능

즉, 지금은 완전 영구삭제 정책을 열기보다, metadata 기준으로 상태 전이를 남기는 구조를 먼저 고정한 것입니다.

### 응답 비노출 원칙

아래 값은 기본 응답에 넣지 않습니다.

- raw `storageKey`
- bucket 이름
- Cloudflare account 식별값
- 장기 public URL

대신 아래 정도만 내려줍니다.

- `fileId`
- 표시용 파일명
- MIME type
- 크기
- 버전 라벨
- 만료 시각
- Production-ready (실구현) token/action 정보

## 6. 현재 코드/테스트에서 바로 확인되는 근거

- `apps/api/src/lib/document-storage.ts`
  - 허용 MIME allowlist 와 25MB 제한 상수
  - object key 생성 규칙
  - `FILES_BUCKET` 유무에 따라 mock/R2 adapter 선택
- `apps/api/src/app.ts`
  - `upload-init`, `upload-complete`, `download-init`, `delete` endpoint Production-ready (실구현)
  - 권한/회사 경계 확인 뒤 action 생성
  - 삭제 시 `storageStatus=deleted`, `status=archived` 처리
- `apps/api/test/document-storage.spec.ts`
  - 회사 prefix object key
  - HWP MIME alias 정규화
  - binding 없을 때 mock adapter fallback
- `apps/api/test/auth-org.spec.ts`
  - storage key/bucket/public URL 비노출 확인
  - upload/download/delete Production-ready (실구현) 흐름 확인
  - binding 이 있을 때 provider 가 `r2` 로 잡히는지 확인

## 7. 다음 단계

다음 구현자는 보통 아래 순서로 이어가면 됩니다.

1. `packages/shared/src/contracts.ts` 와 `apps/api/src/app.ts` 기준으로 현재 계약 재확인
2. `apps/api/src/lib/document-storage*.ts` 경계를 유지한 채 adapter 보강
3. `db/migrations/0006_document_storage_phase8.sql` 같은 최소 migration Production-ready (실구현) 검토
4. mock adapter 테스트를 먼저 통과시킨 뒤 binding-aware 경로 보강
5. 필요하면 Web 문서함 화면에서 upload-init/download-init Production-ready (실구현) 연결

## 8. 별도 승인 필요 사항

아래는 다음 단계에서도 여전히 별도 승인 없이는 하면 안 됩니다.

1. production bucket 추가 생성 또는 구조 변경
2. 운영 파일 실제 업로드/보관 시작
3. 공개 URL, CDN, custom domain, DNS 연결
4. production DB migration 실행
5. 실데이터 반입 또는 기존 문서 데이터 수정
6. 외부 공유 링크 오픈
7. 바이러스 검사/OCR/전자서명/외부 문서보관 SaaS 연동
8. 비용 증가 가능성이 있는 리소스 확대

정리하면, 이번 문서의 핵심은 하나입니다.
문서/첨부파일 기능의 첫 성공 기준은 "파일을 실제로 올렸다"가 아니라,
"회사 경계, 권한, 비노출 원칙, 승인 게이트를 먼저 잠갔다" 입니다.