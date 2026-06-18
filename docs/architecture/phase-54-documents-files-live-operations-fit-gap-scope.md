# Phase 54 문서함·파일 실사용화 fit-gap scope

## 왜 이 Phase를 하나

이번 Phase의 목적은 문서 API가 있다는 사실을 넘어서, 대장이 live URL에서 `/documents` 를 직접 눌러
문서 공간 확인 → 파일 metadata 확인 → 업로드 준비 흐름 확인 → 다운로드 준비/읽음 확인 → 권한 차단 확인
순서를 실제 업무 언어로 따라갈 수 있게 만드는 것이다.

쉽게 말해:
- 문서함을 "파일 보관 자리" 정도로만 보여 주는 단계에서 멈추지 않는다.
- 전사 문서함과 인사 전용 문서함의 차이를 한눈에 읽히게 만든다.
- `storageStatus`, 문서 `status`, 읽음 확인, private/missing space 차단을 같은 언어로 다시 잠근다.
- 외부 공유/실운영 bucket 전환과 아직 안 되는 일은 숨기지 않고 분리한다.

## 이번 Phase에서 바로 맞출 범위

1. `/documents` 를 문서 실사용 시작점으로 다시 정리한다.
2. 전사 문서함과 인사 전용 문서함의 책임 차이를 먼저 읽히게 만든다.
3. 파일 lifecycle 을 `upload-init` → `upload-complete` → `download-init` → delete/archive 순서로 설명하되,
   외부 공유 완료처럼 과장하지 않는다.
4. `storageStatus(pending/ready/deleted)` 와 문서 `status(active/archived)` 의미를 섞지 않는다.
5. `readReceipts` 기반 문서 읽음 확인이 파일 공개 기능이 아니라 내부 열람 이력 확인임을 분명히 적는다.
6. 권한 부족, private/missing space, foreign company 접근 차단, empty/loading/error/forbidden/dev-safe 상태를
   route/UI/API/test 같은 뜻으로 정리한다.

## 현재 확인된 구현 근거

### Web
- `apps/web/app/documents/page.tsx`
  - `/documents` 를 문서 실사용 entry 로 노출한다.
  - 전사 문서함 / 인사 전용 문서함 카드, metadata 비노출 원칙, lifecycle 안내, same-origin API 연결 링크를 함께 보여 준다.
- `apps/web/app/_components/real-usage-panels.tsx`
  - `DocumentsLiveSection` 에서 문서 공간 목록, 파일 목록, `storageStatus`, 읽음 확인 액션을 실제 API 응답 기준으로 보여 준다.

### Shared contract
- `packages/shared/src/contracts.ts`
  - `appRoutes.documents.spaces`
  - `appRoutes.documents.files`
  - `appRoutes.documents.fileMetadata`
  - `appRoutes.documents.uploadInit`
  - `appRoutes.documents.uploadComplete(fileId)`
  - `appRoutes.documents.downloadInit(fileId)`
  - `appRoutes.documents.deleteFile(fileId)`
  - `appRoutes.readReceipts`

### API
- `apps/api/src/app.ts`
  - `document.space.read`, `document.space.manage`, `document.file.read`, `document.file.write` 권한이 분리돼 있다.
  - `/api/documents/spaces`, `/api/documents/files`, `/api/documents/files/metadata`,
    `/api/documents/files/upload-init`, `/api/documents/files/:fileId/upload-complete`,
    `/api/documents/files/:fileId/download-init`, `/api/documents/files/:fileId` 경로가 존재한다.
  - raw storage key / bucket / signed URL 직접 노출 금지와 권한 부족 응답 기준이 이미 있다.

### 테스트
- `apps/api/test/auth-org.spec.ts`
  - 문서 파일 업로드 준비/완료/다운로드 준비 흐름,
  - private/missing space 차단,
  - auth/org/company boundary 와 권한 차단,
  - 문서 관련 same-origin guardrail 검증 근거가 이미 있다.

## 이번 Phase에서 맞출 핵심 문장

### 1) 사용자 happy path
- `/login` → `/dashboard` → `/documents`
- 접근 가능한 문서 공간 확인
- 파일 metadata 목록 확인
- 업로드 준비 액션과 상태(`pending`) 확인
- 완료 후 상태(`ready`) 확인
- 다운로드 준비 액션과 읽음 확인 확인

### 2) 관리자/담당자 happy path
- 문서 공간 정책/권한 설명은 `/documents` 에서 먼저 읽되,
  운영 정책성 설명은 `/admin/policies` 또는 운영 문맥으로 분리한다.
- 직원 CTA 와 운영 설명이 한 화면에서 섞여도 책임은 분리해 적는다.

### 3) 차단/예외 path
- 권한 없음: 필요한 capability/permission 부족
- 접근 불가 문서 공간: private/missing/foreign company
- empty: 접근 가능한 문서는 없지만 정상 응답
- loading: same-origin fetch 진행 중
- error: fetch 실패 또는 예기치 않은 서버 오류
- dev-safe/placeholder: 실제 외부 공유/실운영 저장 전환 전 단계

## 이번 Phase에서 숨기지 말아야 할 gap

- 공개 다운로드 링크/외부 공유 완료 단계는 아직 아니다.
- production bucket, secret, 외부 저장소 운영 전환, 백업/export/migration 실행은 별도 승인 게이트다.
- OCR, 전자서명, 외부 문서보관, 대외 반출 자동화는 이번 성공 기준이 아니다.
- metadata 확인과 실원문 장기보관/실배포 완료를 같은 말처럼 적지 않는다.

## 이번 Phase 산출물

이번 Phase에서 planner 기준으로 먼저 잠그는 산출물은 아래다.

1. 이 scope 문서
2. 쉬운 handoff 문서
3. 루트 문서(`ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md`)의 현재 Phase 기준 갱신

## 다음 역할봇에 넘길 포인트

### builder
- `/documents` 와 연결된 실사용 문장, 권한 분리, 상태 문장을 더 짧고 명확하게 맞춘다.
- `DocumentsLiveSection` 기준으로 사용자 happy path 와 차단 path 를 같은 톤으로 정리한다.

### reviewer
- 문서 공간 권한, private/missing space 차단, raw storage 비노출, `storageStatus` 와 문서 `status` 분리 문장이 코드와 맞는지 본다.

### tester
- focused web/API 테스트, build, smoke 기준으로 `/documents` happy path 와 차단 path 가 실제로 유지되는지 다시 확인한다.

### docs
- live URL 기준 사용자/UAT/운영 체크리스트를 쉬운 한국어로 정리한다.

### ops
- PR/CI/merge/배포 확인, live smoke, route 확인, 남은 승인 게이트를 최종 결과 형식으로 묶는다.
