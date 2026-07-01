# Phase 54 문서함·파일 실사용 가이드 + UAT 절차 + 운영 체크리스트

## 한 줄 요약
이번 Phase 54에서는 `/login` → `/dashboard` → `/documents` 순서로 들어가,
문서 공간 확인 → 파일 metadata 확인 → upload-init → upload-complete → download-init → 읽음 확인 → private/missing space 차단 확인 흐름이 실제로 이어지는지,
그리고 전사 문서함 lane, 인사 전용 문서함 lane, 운영 설명 lane 이 서로 섞이지 않는지만 먼저 확인하면 된다.

## 이 문서가 다루는 범위
- 일반 사용자 문서함 사용 가이드
- 관리자/담당자 문서함 확인 가이드
- 권한 없음/차단 확인 포인트
- empty/loading/error/forbidden/dev-safe 읽는 법
- UAT 절차
- 운영 체크리스트
- 최종 보고에 넣을 항목

이 문서는 production bucket 전환, 외부 공유 링크 운영, OCR/전자서명 연동, 실데이터 마이그레이션 문서가 아니다.
지금 이미 있는 documents route/API/test 기준선을
"대장이 live URL에서 직접 어디를 눌러 무엇을 확인하면 되는가" 중심으로 다시 묶은 문서다.

## 먼저 기억할 10가지
1. 익명 시작점은 `/login` 뿐이다.
2. 테스트 계정은 `admin / 1234` 다.
3. 이 계정은 dev/test/UAT 전용이며 production 기본 계정이 아니다.
4. 문서 실사용 시작점은 `/dashboard` 다음 `/documents` 다.
5. `/documents` 는 먼저 문서 공간과 파일 metadata 를 읽는 화면이다.
6. 전사 문서함과 인사 전용 문서함은 같은 문서함처럼 보이면 안 된다.
7. `upload-init` / `upload-complete` / `download-init` 은 외부 공유 완료가 아니라 내부 저장 준비 흐름이다.
8. `storageStatus(pending/ready/deleted)` 와 문서 `status(active/archived)` 는 같은 뜻이 아니다.
9. raw storage key, bucket, public URL 전문, signed URL 전문, secret 은 사용자 화면/응답/문서에 그대로 적지 않는다.
10. live 직접 확인 근거와 local build/test 대체 근거는 같은 뜻으로 적지 않는다.

## 접속 정보와 현재 근거
- live URL: `https://gw-web.wereheresp.workers.dev`
- 로그인 시작점: `/login`
- 테스트 계정: `admin / 1234`
- 현재 핵심 route: `/dashboard`, `/documents`
- 현재 핵심 API:
  - `/api/documents/spaces`
  - `/api/documents/files`
  - `/api/documents/files/metadata`
  - `/api/documents/files/upload-init`
  - `/api/documents/files/:fileId/upload-complete`
  - `/api/documents/files/:fileId/download-init`
  - `/api/documents/files/:fileId`
  - `/api/read-receipts`
- parent tester 기준 focused web: 1 passed (`phase54-documents-empty-space-guard.test.tsx`)
- parent tester 기준 focused API: `auth-org.spec.ts` 재검증 통과
- parent tester 기준 `pnpm check` 통과
- parent tester 기준 web build 통과
- parent tester 기준 local `next start` smoke 재확인:
  - 익명 `/documents` 307 → 로그인 유도
  - 익명 `/api/documents/spaces` 401
  - COMPANY_ADMIN `/documents` 200
  - COMPANY_ADMIN `/api/documents/spaces` 200
  - COMPANY_ADMIN `/api/documents/files` 200
  - COMPANY_ADMIN private HR space 파일 조회 200
  - EMPLOYEE private HR space 파일 조회 403
  - EMPLOYEE private metadata 생성 403
  - COMPANY_ADMIN missing space metadata 생성 403
  - COMPANY_ADMIN upload-init → upload-complete → download-init → delete lifecycle 201/200/200/200

중요:
- 위 수치는 현재 문서가 기대는 최신 parent 검증 근거다.
- 이번 문서 작업에서 live URL을 다시 직접 fetch 한 것은 아니다.
- 따라서 최종 사용자 보고 전에는 live 직접 확인 메모를 별도로 다시 붙여야 한다.

## 1. 일반 사용자가 따라갈 문서함 사용 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/documents`
4. 문서 공간 카드 확인
5. 파일 목록 확인
6. 파일 상세 확인
7. 문서 읽음 확인

### 각 화면을 어떻게 읽으면 되는가

#### `/dashboard`
- 홈이다.
- 문서함은 게시판과 함께 일반 협업 레인으로 들어가는 기본 화면이다.
- 운영 정책 설명이나 저장소 내부 설명이 직원 첫 행동보다 앞에 나오면 안 된다.

#### `/documents`
- 문서 실사용 시작 화면이다.
- 먼저 읽어야 할 순서는 "문서 공간 확인 → 파일 목록 확인 → 파일 상세 확인 → 필요한 액션 확인" 이다.
- 이 화면은 원문 외부 공유 완료를 보여 주는 화면이 아니라, 접근 가능한 문서와 내부 준비 상태를 읽는 화면이다.

#### 문서 공간 카드 확인
- 전사 문서함은 일반 협업 자료 entry 로 읽힌다.
- 인사 전용 문서함은 private HR scope 로 읽혀야 한다.
- 권한 없는 사용자는 private space 가 목록에 안 보이거나, probe 시 403 으로 끊겨야 한다.
- small screen 에서도 공간 이름과 guardrail 이 먼저 읽혀야 한다.

#### 파일 목록 확인
- 먼저 보이는 것은 fileName, 분류, 공개범위, versionLabel, `storageStatus` 다.
- 분류는 "정책/안내", "인사/계약 초안", "정산/집계", "일반 문서" 같은 업무 언어로 읽혀야 한다.
- empty 상태라면 "이 문서함에서 접근 가능한 파일 metadata 가 없습니다."처럼 다음 판단이 가능한 문장이 보여야 한다.

#### 파일 상세 확인
- 상세에서는 `storageStatus` 와 문서 `status` 가 따로 보여야 한다.
- 예:
  - `storageStatus=pending` = 업로드 준비 단계
  - `storageStatus=ready` + `status=active` = 내부 열람 준비 상태
  - `storageStatus=deleted` 또는 `status=archived` = 삭제/보관 처리 상태
- 상세 패널이 외부 반출 링크나 raw storage internals 를 직접 보여 주면 안 된다.

#### 문서 읽음 확인
- 읽음 확인은 내부 열람 이력 확인이다.
- 공개 공유 기능이 아니다.
- 접근 가능한 파일 하나를 고른 뒤 같은 회사 범위에서 read receipt 가 등록되는지만 본다.

### 일반 사용자가 바로 확인할 질문
- `/documents` 가 정말 문서 확인 시작 화면처럼 읽히는가
- 전사 문서함과 인사 전용 문서함이 바로 구분되는가
- 파일 목록과 상세에서 `storageStatus` 와 문서 `status` 가 섞이지 않는가
- 읽음 확인이 공개 공유처럼 보이지 않는가

## 2. 관리자/담당자가 따라갈 확인 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/documents`
4. 전사 문서함 확인
5. 인사 전용 문서함 확인
6. metadata preview 생성 확인
7. upload-init 확인
8. upload-complete 확인
9. download-init 확인
10. delete / archive 확인
11. private space / missing space 차단 확인

### 어떻게 읽으면 되는가

#### 전사 문서함 확인
- 일반 협업 자료 entry 라는 뜻으로 읽는다.
- 파일 조회와 읽음 확인이 먼저 보이면 된다.
- 운영 설명이 있어도 일반 사용자 CTA 를 덮으면 안 된다.

#### 인사 전용 문서함 확인
- 더 좁은 민감 문서 lane 이다.
- 현재 parent tester 기준 COMPANY_ADMIN 은 private HR space 파일 조회가 200 으로 허용된다.
- 반대로 EMPLOYEE 는 private HR space 파일 조회와 private metadata 생성이 403 이어야 한다.
- 즉, 문서함 이름만 다른 것이 아니라 실제 권한 경계가 달라야 한다.

#### metadata preview 생성
- metadata 생성은 원문 외부 공유가 아니다.
- 지금 단계에서 먼저 고정하는 값은 `fileName`, `contentType`, `fileSize`, `versionLabel`, `storageStatus` 다.
- 없는 spaceId 나 접근 불가 spaceId 는 403 이어야 한다.

#### upload-init / upload-complete
- `upload-init` 은 업로드 준비 생성 단계이며 `storageStatus=pending` 으로 읽는다.
- `upload-complete` 는 checksum 기록과 함께 `storageStatus=ready` 로 바꾸는 단계다.
- 이 두 단계가 끝나도 곧바로 외부 공개 완료처럼 읽으면 안 된다.

#### download-init
- 다운로드 준비 단계다.
- 외부 공개 링크를 보여 주는 단계가 아니다.
- token/message 수준만 확인하고 public URL 전문을 그대로 드러내지 않아야 한다.

#### delete / archive
- 삭제/보관 처리 후에는 `storageStatus` 와 문서 `status` 가 함께 변할 수 있다.
- 이 둘을 하나의 "삭제됨" 같은 말로만 뭉개지 말고 저장 lifecycle 과 문서 상태로 나눠 읽는다.

### 관리자/담당자가 바로 확인할 질문
- private HR space 접근 경계가 일반 사용자와 다르게 동작하는가
- metadata 생성, upload-init, upload-complete, download-init, delete/archive 가 실제로 이어지는가
- objectKeyPreview 가 내부 힌트 수준으로만 보이고 raw storage key/bucket/public URL 전문은 안 보이는가
- 운영 설명과 사용자 실사용 설명이 섞이지 않는가

## 3. 권한 없음 / 차단 확인 가이드

### 먼저 확인할 대상
- 익명 `/documents` 접근
- 익명 `/api/documents/spaces` 접근
- EMPLOYEE private HR space 파일 조회
- EMPLOYEE private metadata 생성
- missing space metadata 생성
- 권한 없는 세션의 write 액션 비활성화 여부

### 읽는 기준
- UI에서 먼저 막히는지 본다.
- route 차단 안내와 API 차단 이유가 같은 뜻인지 본다.
- 차단 상태인데도 성공 버튼이나 완료 문구가 먼저 보이면 안 된다.
- 차단되면 사용자가 다시 어디로 돌아가야 하는지도 보여야 한다.

### 이번 Phase에서 특히 같이 봐야 하는 예시
- 익명 route 차단: `/documents` 는 307 로그인 유도
- 익명 API 차단: `/api/documents/spaces` 401
- private space 차단: EMPLOYEE 기준 403
- missing space 차단: metadata 생성 403
- 버튼 차단: write 권한 없으면 metadata/upload/delete 계열 버튼 비활성화
- 내부정보 비노출: raw storage key/bucket/public URL/signed URL 전문 비노출

## 4. 상태 문장은 이렇게 구분한다

### empty
- 정상적으로 열렸지만 접근 가능한 파일 metadata 가 없는 상태다.
- 권한 부족이나 오류와 같은 뜻이 아니다.

### loading
- 실제 same-origin API 응답을 불러오는 중이다.
- 성공도 실패도 아니다.

### error
- 조회 또는 저장이 실패한 상태다.
- forbidden 과 같은 뜻으로 쓰면 안 된다.

### forbidden
- 로그인은 되었지만 지금 문서 공간이나 액션 권한이 없는 상태다.
- 예: private HR space 403, write 권한 없음

### dev-safe
- 내부 검증용 preview, Production-ready (실구현), mock storage, local-safe 흐름이 남아 있는 상태다.
- production bucket 운영 완료, 외부 공유 완료, 실문서 장기보관 완료와 같은 뜻이 아니다.

## 5. 역할별로 어디까지 보면 되는가
- EMPLOYEE: `/dashboard` → `/documents` 에서 전사 문서함, 접근 가능한 파일 목록, 상세, 읽음 확인 중심으로 확인
- MANAGER: 일반 협업 문서 확인 + 차단/권한 문장 일관성 확인
- HR_ADMIN: private HR scope 의미, 문서 공간 경계, metadata/write 관련 문장 확인
- COMPANY_ADMIN: 전사 문서함과 인사 전용 문서함 둘 다 확인, lifecycle 액션 확인
- AUDITOR: 이번 Phase 주 사용자는 아니므로 필요 시 문서 상태와 이력 설명만 read-only 관점에서 확인

## 6. UAT 절차

### 6-1. 시작 전 준비
- live URL 이 `https://gw-web.wereheresp.workers.dev` 인지 다시 확인한다.
- 이번 기록이 live 직접 확인인지, local build/test 대체 근거인지 먼저 구분한다.
- 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰이는지 확인한다.

### 6-2. 공통 시작 시나리오
1. `/login` 이 익명 유일 입구인지 확인
2. 로그인 후 `/dashboard` 로 시작하는지 확인
3. `/documents` 진입이 자연스러운지 확인
4. 전사 문서함과 인사 전용 문서함 책임이 바로 구분되는지 확인

### 6-3. 일반 사용자 happy path UAT
추천 순서:
- `/dashboard` → `/documents` → 문서 공간 선택 → 파일 목록 → 파일 상세 → 문서 읽음 확인

기록할 질문:
- 문서함이 협업 문서 시작점처럼 읽히는가
- 목록에서 상세로 자연스럽게 이어지는가
- 읽음 확인이 내부 열람 이력으로 읽히는가
- empty/loading/error/forbidden 이 서로 다른 뜻으로 읽히는가

### 6-4. 관리자 lifecycle UAT
추천 순서:
- `/documents` → metadata preview 생성 → upload-init → upload-complete → download-init → delete / archive

기록할 질문:
- 각 단계가 실제로 이어지는가
- `pending` → `ready` → `deleted/archived` 의미가 분명한가
- 외부 공유 완료처럼 과장되는 문장이 없는가
- 최근 액션 상세에서 토큰/preview 만 보이고 raw storage internals 는 계속 숨겨지는가

### 6-5. 차단/guard UAT
추천 순서:
- 익명 `/documents` 접근
- 익명 `/api/documents/spaces` 접근
- EMPLOYEE private HR space probe
- missing space metadata 생성 probe

기록할 질문:
- 차단이 성공 화면보다 먼저 보이는가
- UI/route/API 가 같은 이유를 말하는가
- private/missing/권한부족/오류가 서로 다른 뜻으로 읽히는가

### 6-6. 이슈 분류 기준
- blocker: 지금 문서함 시나리오를 더 진행할 수 없게 막는 문제
- major: 진행은 되지만 실사용 의미를 크게 흔드는 문제
- minor: 흐름은 되지만 다듬어야 하는 문제
- copy-doc: 화면 문구/문서 정합성 문제
- approval-needed: 기능 문제가 아니라 별도 승인 없이는 진행하면 안 되는 항목

## 7. 운영 체크리스트

### 운영 전
- [ ] `/login` 이 유일한 익명 시작점으로 유지된다.
- [ ] 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰인다.
- [ ] live 직접 확인 근거와 local build/test 대체 근거를 분리해 적는다.

### 운영 중
- [ ] `/documents` 가 문서 실사용 시작점처럼 읽힌다.
- [ ] 전사 문서함과 인사 전용 문서함이 다른 책임으로 읽힌다.
- [ ] 파일 metadata 확인 → upload-init → upload-complete → download-init → 읽음 확인 흐름이 실제로 이어진다.
- [ ] private/missing space 차단이 유지된다.
- [ ] raw storage key/bucket/public URL/signed URL 전문 비노출 원칙이 유지된다.
- [ ] `storageStatus` 와 문서 `status` 가 서로 다른 뜻으로 읽힌다.
- [ ] empty/loading/error/forbidden/dev-safe 가 서로 다른 뜻으로 읽힌다.

### 운영 후
- [ ] 일반 사용자 happy path 와 관리자 lifecycle 확인 결과를 따로 기록했다.
- [ ] blocker 와 approval-needed 를 분리했다.
- [ ] 최종 보고에 live URL, 테스트 계정, 추천 route, 직접 해볼 액션, 남은 승인 게이트를 넣을 수 있게 정리했다.

## 8. 최종 보고에 꼭 넣을 항목
- live URL
- 로그인 시작점 `/login`
- 테스트 계정 `admin / 1234`
- 일반 사용자가 따라갈 추천 순서
- 관리자/담당자가 확인할 추천 순서
- 직접 해볼 액션: 파일 목록 확인, 파일 상세 확인, metadata preview 생성, upload-init, upload-complete, download-init, 문서 읽음 확인, private/missing space 차단 확인
- live 직접 확인 근거
- local build/test/release gate 대체 근거
- 아직 mock/dev-safe 이거나 승인 게이트인 부분

## 9. 최종 보고 템플릿
- 결론:
- live URL:
- 로그인 시작점:
- 테스트 계정:
- 일반 사용자 확인 순서:
- 관리자 확인 순서:
- 직접 해볼 액션:
- 확인한 근거:
  - live 직접 확인:
  - local/build/test 대체 근거:
- 주요 이슈:
  - blocker:
  - major:
  - minor:
  - copy-doc:
  - approval-needed:
- 남은 승인 게이트:
- 대장이 직접 보면 되는 route:

## 10. 남아 있는 승인 게이트
- production DB 실데이터
- secret 입력/교체
- production bucket / 외부 저장소 운영 전환
- public/external 공유 링크 정책 확정
- DNS/custom domain
- 유료 리소스
- destructive/migration
- OCR/전자서명/외부 문서보관 연동
