# Phase 54 문서함·파일 실사용화 handoff

## 한 줄 요약

Phase 54의 목적은 `/documents` 를 실제 문서 실사용 시작점처럼 읽히게 만들고,
문서 공간·파일 metadata·업로드/다운로드 준비·읽음 확인·권한 차단을 live URL 기준으로 한 번에 따라가게 정리하는 것이다.

## 지금 바로 봐야 할 파일

1. `apps/web/app/documents/page.tsx`
2. `apps/web/app/_components/real-usage-panels.tsx`
3. `apps/api/src/app.ts`
4. `apps/api/test/auth-org.spec.ts`
5. `packages/shared/src/contracts.ts`

## 지금 코드에서 이미 있는 것

- `/documents` 화면에 전사 문서함 / 인사 전용 문서함 구분이 있다.
- `DocumentsLiveSection` 으로 문서 공간 목록, 파일 목록, `storageStatus`, 읽음 확인 흐름을 실제 API 응답으로 볼 수 있다.
- shared contract 에 문서 관련 route 묶음과 `readReceipts` 가 정리돼 있다.
- API 에 문서 공간 조회/생성, 파일 목록, metadata 생성, upload-init/upload-complete/download-init/delete 경로가 있다.
- 테스트에 private/missing space 차단, 권한 차단, 업로드/다운로드 준비 흐름 근거가 있다.

## 이번 Phase에서 꼭 같은 뜻으로 맞출 것

### 1. 문서함 entry 문장
- `/documents` 는 직원이 접근 가능한 문서 공간과 파일 metadata 를 먼저 확인하는 시작점이다.
- 운영 설명이 들어가더라도 직원 CTA 를 덮지 않는다.

### 2. 권한/공간 경계 문장
- 전사 문서함 = 일반 협업 문서 entry
- 인사 전용 문서함 = 더 좁은 private HR scope
- private/missing/foreign company 공간은 403 또는 차단 상태로 분리한다.

### 3. lifecycle 문장
- `upload-init` = 업로드 준비 시작, `storageStatus=pending`
- `upload-complete` = 업로드 완료 기록, `storageStatus=ready`
- `download-init` = 외부 공유가 아니라 내부 다운로드 준비
- delete/archive = `storageStatus` 와 문서 `status` 를 나눠서 읽기

### 4. 비노출 원칙
- raw storage key
- bucket 이름
- public URL 전문
- signed URL 전문
- secret/credential

## 구현자에게 넘기는 쉬운 작업 단위

1. `/documents` 화면 copy 를 실사용 문장 기준으로 다듬기
2. 사용자 happy path 와 차단 path 문구 정리
3. `storageStatus` / 문서 `status` 구분이 UI 에서 더 분명히 읽히게 맞추기
4. 운영 설명이 필요한 부분은 `/admin/policies` 문맥과 섞이지 않게 정리

## 리뷰어 체크포인트

- 문서 공간 권한과 파일 권한이 같은 말처럼 풀리지 않는가
- private/missing space 차단과 empty 상태가 섞이지 않는가
- metadata 확인을 외부 공유 완료처럼 과장하지 않는가
- raw storage internals 비노출 원칙이 깨지지 않는가

## 테스터 체크포인트

- `/documents` 가 로그인 뒤 접근 가능한 시작점처럼 읽히는가
- 문서 공간 목록, 파일 목록, 읽음 확인이 same-origin 기준으로 이어지는가
- 권한 없는 사용자 차단, private/missing space 차단, empty/error 상태가 구분되는가
- local build/test 근거와 live 직접 확인 근거가 같은 말처럼 섞이지 않는가

## 문서화 체크포인트

- 대장이 live URL 에서 직접 눌러볼 route 순서를 적는다.
- `admin / 1234` 는 dev/test/UAT 전용 계정으로만 적는다.
- 되는 것 / 아직 placeholder / 승인 필요를 섞지 않는다.

## 운영 체크포인트

- PR/CI/merge/배포 확인
- live `/login`, `/documents`, 관련 `/api/documents/*` smoke 기준 정리
- 남은 승인 게이트(실운영 bucket, secret, 외부 공유, migration, production data) 분리

## 남은 승인 게이트

- production DB 실데이터
- secret 입력/교체
- production bucket / 외부 저장소 운영 전환
- public/external 공유 링크 정책 확정
- DNS/custom domain
- 유료 리소스
- destructive/migration
