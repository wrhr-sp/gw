# 그룹웨어 Phase 5 게시판/문서 1차 범위

## 1. Phase 목표

이번 Phase의 목표는 Phase 2의 사용자/조직/권한 골격, Phase 3의 근태/휴가 scope 경계, Phase 4의 문서 접근/승인 guardrail 을 바탕으로, 게시판/공지/문서함 1차 업무 흐름의 공통 뼈대를 만들고 이후 파일 저장, 문서 승인, 운영 정책 확장에 재사용할 수 있는 데이터·API·화면·문서 시작점을 고정하는 것이다.

이번 Phase에서 맞추는 기준은 다음과 같다.

- DB 기준: Cloudflare D1 migration 으로 게시판/문서 핵심 테이블 skeleton 추가
- API 기준: Cloudflare Workers + Hono 기반 공지/게시판/게시글/댓글/문서함/읽음 확인 REST skeleton 추가
- 공통 계약 기준: `packages/shared` 에 board/document 타입, route contract, zod schema, 공통 응답 schema 추가
- Web 기준: 공지/게시판/게시글 상세/문서함 placeholder 화면과 상태 구분 시작점 정리
- 운영 기준: 회사 scope, 게시글·문서 접근 경계, 첨부 metadata 보안, release gate, 보고 자동화 범위 명확화

## 2. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 5 구현자가 바로 참고할 범위 문서 작성
- 게시판/공지/게시글/댓글/문서함/첨부 metadata/읽음 확인 1차 데이터 모델, API, 화면, 권한, 검증 기준 정의
- 승인 없이 하지 않을 작업과 별도 승인 필요 작업 분리
- GitHub PR/CI/merge/branch cleanup 과 release gate 안에서 다루는 보고 자동화 스크립트 범위 명시

### DB / migration 범위

아래 항목을 D1 기준 1차 골격으로 확장한다.

- `notice_boards`
- `board_posts`
- `board_comments`
- `document_spaces`
- `document_files`
- `read_receipts`

권장 보조 컬럼/연결 기준:

- 모든 게시판/문서 테이블은 `company_id`, `created_by`, `created_at`, `updated_at`, `status` 기본 컬럼을 가진다.
- 게시판/공지 테이블은 최소한 `board_type`, `name`, `slug`, `visibility`, `is_notice_only` 후보를 가진다.
- 게시글 테이블은 최소한 `board_id`, `author_employee_id`, `title`, `body_preview`, `is_notice`, `published_at`, `pinned_until` 후보를 가진다.
- 댓글 테이블은 최소한 `post_id`, `author_employee_id`, `parent_comment_id`, `body`, `deleted_at` 후보를 가진다.
- 문서함/파일 테이블은 최소한 `space_id`, `owner_employee_id`, `file_name`, `content_type`, `file_size`, `storage_key`, `version_label`, `is_public_within_company` 후보를 가진다.
- 읽음 확인 테이블은 최소한 `target_type`, `target_id`, `employee_id`, `read_at` 또는 동급 추적 컬럼을 가진다.

기준:

- 기존 `db/migrations/0004_approvals_phase4.sql` 이후 후속 migration 파일로 추가한다.
- 실제 운영 migration 실행이 아니라 로컬 검증 가능한 SQL skeleton 까지만 다룬다.
- 실제 R2 버킷 생성, 파일 업로드, 바이너리 저장, 바이러스 검사, OCR/전자서명 연동은 이번 Phase에 넣지 않는다.
- employee/company/role 구조와 approval/document 접근 경계는 Phase 2~4 계약을 그대로 재사용한다.

### API 범위

대상 파일 기준 시작점은 아래와 같다.

- `apps/api/src/app.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- `apps/api/test/*.spec.ts`

이번 Phase에 포함되는 1차 endpoint 범위:

- `GET /api/notices`
- `GET /api/boards`
- `POST /api/boards`
- `GET /api/boards/:boardId/posts`
- `POST /api/boards/:boardId/posts`
- `GET /api/posts/:postId`
- `GET /api/posts/:postId/comments`
- `POST /api/posts/:postId/comments`
- `GET /api/documents/spaces`
- `POST /api/documents/spaces`
- `GET /api/documents/files`
- `POST /api/documents/files/metadata`
- `POST /api/read-receipts`

API 기준:

- Hono route skeleton + request/response schema 검증까지 맞춘다.
- 실제 운영 게시글 저장소, 실제 파일 업로드, 실제 읽음 통계 엔진 대신 local/mock/dev placeholder 흐름으로 둔다.
- 인증 상태, 권한 부족, 접근 불가 게시글/문서, 미구현 상태를 공통 응답 형식으로 돌려준다.
- 게시글/댓글/문서함 route 는 회사 scope 와 역할 scope 를 분리할 수 있게 계약을 잡는다.
- 공지/게시판 읽기 권한, 게시글 작성 권한, 댓글 작성 권한, 문서함 접근 권한, 첨부 metadata 조회 권한을 나눌 수 있게 설계한다.
- 임의 post id 접근, 타 회사 문서함 접근, storage key 노출, 미승인 공개 게시판 오픈 같은 guardrail 을 placeholder 단계부터 정의한다.

### shared 계약 범위

`packages/shared` 에 아래를 추가한다.

- board/document route 상수
- 공지/게시판/게시글/댓글/문서함 schema
- 첨부 metadata 요청/응답 schema
- 읽음 확인 요청/응답 schema
- board/document 권한 코드와 공통 에러 코드 확장
- 공통 응답 wrapper 재사용

기준:

- Web과 API가 같이 보는 계약은 shared 에서 먼저 정의한다.
- `health`, `auth`, `org`, `attendance`, `leave`, `approvals` 와 같은 방식으로 zod schema + type export 를 같이 둔다.
- 이후 실제 파일 업로드, 문서 승인, 알림, 급여/노무 문서 보관 확장에서 재사용할 수 있어야 한다.

### Web 범위

대상 시작점은 아래와 같다.

- `apps/web/app/boards/page.tsx`
- `apps/web/app/boards/[boardId]/page.tsx`
- `apps/web/app/posts/[postId]/page.tsx`
- `apps/web/app/documents/page.tsx`
- 필요 시 `apps/web/app/dashboard/page.tsx`
- 필요 시 공통 section component

이번 Phase에 포함되는 화면 범위:

- 공지/게시판 목록 placeholder
- 게시글 작성 폼 skeleton
- 게시글 상세/댓글 영역 skeleton
- 문서함/첨부 metadata 목록 placeholder
- 읽음 확인 상태 안내 placeholder

화면 기준:

- 실제 rich text editor, 실제 파일 업로드, 미리보기/다운로드, 외부 공유 링크 완성형은 구현하지 않는다.
- API 계약이 아직 mock 이어도, 이후 실제 API 호출 구조로 바꾸기 쉬운 컴포넌트 경계를 잡는다.
- 게시글 작성 권한이 없는 사용자가 보는 안내 상태와 운영자가 보는 관리 상태를 구분할 수 있게 한다.
- 화면 문구가 실제 운영 게시판/문서 저장이 이미 완성된 것처럼 오해되지 않게 placeholder 표시를 유지한다.

### 문서/운영/자동화 범위

아래 문서 또는 동급 문서에 Phase 5 기준을 반영한다.

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
- `docs/workflow/groupware-kanban-automation.md`
- 필요 시 `scripts/README.md`

정리할 내용:

- 로컬 검증 명령
- placeholder 게시판/문서 흐름의 한계
- 회사 scope, 게시글/문서 접근 권한, 첨부 metadata 보안 주의
- `gw-hourly-status-report.py` 중심의 정각 보고 스크립트 수정이 GitHub release gate 검토 범위 안에 있다는 점
- 실제 운영 데이터, 실제 배포, production DB migration, 실제 비밀값 입력은 별도 승인 없이는 하지 않는다는 점

## 3. 이번 Phase에서 하지 않는 일

이번 Phase에서 제외하는 일은 아래와 같다.

- 실제 R2 버킷 생성 또는 운영 파일 업로드
- 실제 production 게시글/문서/첨부 데이터 입력 또는 수정
- production DB migration 실행
- 외부 공개 배포, 유료 리소스, DNS/R2/도메인 작업
- secret 입력 또는 외부 문서보관/전자서명 SaaS 연동
- 실제 바이너리 파일 다운로드, 미리보기 변환, OCR/색인 파이프라인 구축
- 게시글 좋아요/북마크/검색 고도화, 문서 버전 비교 완성형

## 4. 별도 승인 필요 사항

아래 항목은 다음 단계 후보로 남기되, 실행 전 별도 승인이 필요하다.

1. 실제 운영/스테이징 DB 대상 migration 실행
2. 실사용 게시글/공지/문서/첨부 데이터 반입 또는 수정
3. 실제 R2 버킷 생성, 파일 업로드, 공개/서명 URL 연결
4. 외부 문서보관/OCR/전자서명 SaaS 연동
5. 메일/메신저/푸시 읽음 알림 연동
6. 외부 공개 URL 오픈 또는 도메인 연결
7. 유료 플랜/리소스 사용
8. 승인된 오케스트레이션 범위 밖의 GitHub merge 및 branch delete

## 5. 구현자가 바로 따라야 할 기준

### 파일/폴더 기준

```text
apps/
  api/
    src/app.ts
    test/
  web/
    app/boards/
    app/posts/
    app/documents/
    app/dashboard/
packages/
  shared/
    src/contracts.ts
    src/index.ts
db/
  migrations/
docs/
  architecture/
  guides/
  workflow/
scripts/
```

### 기술 기준

- 게시판/문서 1차는 공지 + 게시판 목록 + 게시글 작성/상세 + 댓글 + 문서함/첨부 metadata skeleton 을 기준으로 문서화한다.
- 본문과 파일은 완성형 편집기/업로드보다 제목/요약/metadata placeholder 중심으로 시작한다.
- API 는 Hono REST 형식을 유지하고 공통 응답 wrapper 를 강제한다.
- 민감한 문서 metadata, 실제 storage key, 실제 개인정보, 실제 첨부 경로 전문은 로그에 남기지 않는다.
- Web 에서 버튼을 숨겨도 API 에서 서버 측 권한 검증을 한다는 전제를 유지한다.
- 게시판/문서 접근은 이후 approval, 급여, 노무 문서 보관 확장을 막지 않도록 타입과 상태값을 단순하고 명확하게 둔다.

### 데이터/권한 기준

- 회사 기준 멀티테넌시를 깨지 않도록 `company_id` 범위를 명확히 둔다.
- 게시글/댓글/문서함/첨부 metadata 는 작성자/읽기권한자/관리자 관점이 구분되어야 한다.
- 최소 권한 후보는 `board.notice.read`, `board.post.write`, `board.comment.write`, `document.space.read`, `document.file.read`, `document.file.write` 를 시작점으로 둔다.
- 읽음 확인은 최소한 대상, 사용자, 시점을 추적할 수 있어야 한다.
- 감사 로그 후보는 최소한 actor, action, target, created_at 정도의 기본 골격을 가진다.
- 타 회사 게시글 접근 금지, 비공개 게시판 우회 접근 금지, 임의 storage key 노출 금지를 placeholder 단계부터 검증 대상으로 둔다.

## 6. 최소 검증 기준

이번 Phase 구현 카드가 로컬에서 확인해야 하는 최소 기준은 아래와 같다.

- `pnpm install` 가능
- `pnpm check` 통과
- `pnpm build` 또는 저장소 표준 build 명령 통과
- `pnpm typecheck` 통과
- `pnpm test` 통과
- board/document shared schema 테스트 추가 및 통과
- API 테스트에 공지/게시판/게시글/댓글/문서함/읽음 확인/접근 경계 기본 케이스 포함
- Web skeleton 이 최소한 build 또는 typecheck 를 깨지 않음
- README/가이드/운영 문서에 로컬 검증 순서와 승인 필요 범위가 정리됨
- 감시/보고 스크립트를 건드렸다면 release gate 검토 범위와 중복 보고 방지 기준이 문서에 반영됨

주의:

- 실제 운영 비밀값 없이 가능한 범위 안에서만 검증한다.
- 일부 명령이 패키지 구조상 filter 기반으로 나뉘면 저장소 표준 명령과 함께 결과를 남긴다.

## 7. 완료 기준

이번 Phase는 아래 조건을 모두 만족하면 완료로 본다.

1. Phase 5 범위 문서가 저장소 안에 있고 구현자가 바로 참조할 수 있다.
2. D1 migration 에 게시판/문서 1차 골격이 추가되어 있다.
3. `packages/shared` 에 board/document 계약과 공통 응답 schema 확장이 정리되어 있다.
4. `apps/api` 에 공지/게시판/게시글/상세/댓글/문서함/읽음 확인 기본 endpoint skeleton 이 있다.
5. `apps/web` 에 공지/게시판/게시글 상세/문서함 기본 화면 skeleton 이 있다.
6. 회사 scope, 게시글/문서 접근 경계, 첨부 metadata 보안 같은 guardrail 이 문서와 리뷰 기준에 반영되어 있다.
7. `gw-hourly-status-report.py` 를 포함한 승인된 감시/보고 스크립트 변경이 release gate 검토 범위에 포함된다는 점이 문서화되어 있다.
8. 승인된 release gate 범위 안에서 PR 생성, CI 확인, merge, branch cleanup 처리 조건이 분명하다.
9. 다음 Phase의 실제 파일 저장/문서 승인/급여 문서 보관 확장을 막지 않는 수준으로 handoff 정보가 정리되어 있다.

## 8. 승인/리뷰 체크포인트

구현 전에 다시 확인할 항목:

- 공지와 일반 게시판을 별도 route 로 둘지, `boards` 타입 구분 하나로 시작할지
- 게시글 상세 안에 댓글을 묶을지, 댓글 목록 endpoint 를 별도 유지할지
- 문서함을 부서별/개인별로 나눌지, 단일 space + 필터로 시작할지
- 읽음 확인을 게시글/문서 공통 endpoint 하나로 둘지, 타입별 endpoint 로 나눌지

구현 후 리뷰에서 반드시 볼 항목:

- 게시글 본문/댓글/첨부 metadata 에 민감한 실운영 값이 남지 않았는지
- company scope 누락으로 타 회사 게시글/문서가 섞일 여지가 없는지
- 게시글 작성/댓글 작성/문서함 접근 권한이 뒤섞이지 않았는지
- 첨부 metadata 응답에 storage key 또는 내부 식별자가 과도하게 노출되지 않았는지
- Web placeholder 가 실제 운영 게시판/문서 저장 완성본처럼 오해되지 않는지