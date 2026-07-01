# Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안 handoff

한 줄 요약:
이번 Phase 16은 파일/R2/문서/공지 흐름을 새로 크게 여는 단계가 아니라,
이미 있는 게시판·문서함·첨부 metadata Production-ready (실구현)과 전체 smoke 기준을 안정화해
대장이 사내 검토용 초안을 preview/live URL에서 직접 확인할 수 있게 만드는 단계입니다.

## 0. 2026-06-13 기준 빠른 판정표

### 지금 되는 것

- `/dashboard` 상단 액션이 `/attendance` → `/approvals` → `/boards` → `/documents` → `/employees` 순서로 맞춰져 있고, 대시보드 eyebrow 도 Phase 16 문구로 정리돼 있습니다.
- `/boards`, `/boards/board_notice`, `/boards/board_general`, 예시 게시글 상세(`/posts/board_post_board_notice_employee_employee`), `/documents` 를 따라가며 게시판/문서 Production-ready (실구현) 흐름을 읽을 수 있습니다.
- 관리자 경계는 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/admin/manifest.webmanifest` 와 일반 host 분리 기준으로 다시 검증됐습니다.
- API/guardrail 기준으로 notice-only 글쓰기 차단, private 문서공간 차단, forged post/read receipt 차단, raw storage/internal bucket 정보 비노출이 다시 확인됐습니다.

### 아직 안 되는 것

- production 실데이터 반영
- 실제 운영 파일 업로드 확대
- public URL 다운로드 오픈
- 외부 문서보관/OCR/전자서명/HR 연동
- live `.workers.dev` 직접 fetch smoke 최종 확인

### 승인 없이는 하면 안 되는 것

- production data 반영
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 생성·증액
- public URL/외부 공유 링크 정책 확정
- 실제 운영 파일 업로드 범위 확대

### 이번 문서에서 꼭 분리해 적는 검증 메모

- 확인됨: `pnpm check`, `pnpm --filter @gw/web build:cf`, targeted web/api test, local preview smoke
- 미확인: live `.workers.dev` 직접 fetch smoke
- 대체 근거: `pnpm --filter @gw/web preview:cf` 기본 경로가 불안정할 때 `apps/web` 에서 `wrangler dev --port 8790 --ip 127.0.0.1` 로 같은 산출물을 띄워 smoke 한 결과

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 것:

- 일반 업무 흐름: `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees`, `/org`
- 협업 흐름: `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents`
- 관리자 흐름: `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`
- board/document API Production-ready (실구현), private space 차단, notice-only guardrail, metadata 비노출 기준
- R2 private-by-default, D1 metadata 우선, binding-aware Production-ready (실구현) 방향
- preview deploy 와 build:cf/local preview/deployment metadata 대체 근거 운용

아직 부족한 것:

- 게시판/문서/첨부 흐름을 전체 제품 검토 기준 안에서 한 번에 설명하는 문서가 약합니다.
- live URL에서 어디를 어떤 순서로 눌러 봐야 하는지 정리된 파일럿 checklist가 더 필요합니다.
- 파일/R2 경계가 실제 운영 업로드 가능 상태처럼 읽히지 않도록 문구/검증/승인 게이트를 더 분명히 해야 합니다.
- production data, DNS, secret, 유료 리소스, 외부 연동 같은 항목을 파일럿 초안과 분리해 적어야 합니다.

즉 이번 단계는 기능 추가보다
"파일럿 검토용 초안으로 설명 가능한 상태"를 만드는 데 집중합니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 일반 직원 관점

기본 흐름:

- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`

기대하는 경험:

- 오늘 할 일과 협업 자료 진입점이 한 제품 안에서 자연스럽게 이어집니다.
- 공지/게시판과 문서함이 같은 협업 문맥에 있되, 각각의 제한이 분명합니다.
- 문서/첨부는 조회와 metadata 중심이며, 아직 실운영 업로드 완성품이 아니라는 점을 이해할 수 있습니다.

### 팀장/승인자 관점

기본 흐름:

- `/dashboard`
- `/approvals`
- `/leave`
- 필요 시 `/boards`, `/documents`

기대하는 경험:

- 결재/휴가 승인 역할과 협업 자료 열람 역할이 섞이지 않습니다.
- 공지 전달, 문서 확인, 팀 예외 확인이 가능하지만 운영 관리자 권한처럼 보이지 않습니다.

### 인사/운영 관리자 관점

기본 흐름:

- `/dashboard` 권한 기반 CTA
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- 필요 시 `/boards`, `/documents` 와 결과 대조

기대하는 경험:

- 게시판/문서 운영 정책과 일반 협업 흐름의 연결을 설명할 수 있습니다.
- 문서/첨부 metadata와 R2 경계가 실제 운영 저장 범위와 어떻게 분리되는지 설명할 수 있습니다.
- 파일럿 검토 후 어떤 항목이 별도 승인 게이트인지 바로 구분할 수 있습니다.

### 감사/운영 검토자 관점

기본 흐름:

- `/admin/audit-logs`
- 필요 시 `/admin/policies`
- 필요 시 일반 업무/협업 route 대조

기대하는 경험:

- raw 민감정보 노출 없이도 운영 변경과 예외 기준을 추적할 수 있습니다.
- 게시판/문서/첨부 흐름이 정책·권한·Production-ready (실구현) 제한과 같은 방향으로 설명되는지 확인할 수 있습니다.

## 3. 이번 Phase에서 고정할 핵심 결정

### 1) 파일럿 초안은 "보여 줄 수 있는 것"과 "승인 없이는 안 하는 것"을 같이 적는다.

보여 줄 수 있는 것:

- 홈/로그인/대시보드 흐름
- 근태/휴가/결재 기본 흐름
- 게시판/게시글/댓글 Production-ready (실구현)
- 문서함/첨부 metadata Production-ready (실구현)
- 관리자 정책/권한/감사 preview

승인 없이는 안 하는 것:

- production data 반영
- 실제 운영 파일 업로드 확대
- public URL 오픈
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 생성·증액
- 외부 연동

### 2) 협업 묶음은 게시판/공지와 문서/파일을 함께 보되, 위험도와 경계 설명은 분리한다.

- 게시판/공지: 읽음, 전달, notice-only, 댓글, 공지 우선 흐름
- 문서/파일: 문서 공간, 첨부 metadata, private space, R2 경계, 비노출 원칙

### 3) R2는 binding-aware + dev-safe 설명까지만 다룬다.

- raw storage key/bucket/public URL 비노출 유지
- `FILES_BUCKET` binding 방향은 문서/검증에서 설명 가능해야 함
- 실제 운영 업로드/공개 다운로드는 이번 단계 성공 기준이 아님

### 4) Phase 16 smoke 기준은 핵심 업무 + 협업 route + 관리자 route를 같이 본다.

핵심 업무:

- `/`
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/employees`
- `/org`

협업/문서:

- `/boards`
- `/boards/[boardId]`
- `/posts/[postId]`
- `/documents`

관리자/운영:

- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/api/health`
- `/admin/manifest.webmanifest`

### 5) blocked/empty/error 설명은 게시판/문서에도 같은 축을 쓴다.

- 권한 부족
- 회사 scope 불일치
- 정책상 미허용
- Production-ready (실구현)/dev-safe 제한

추가 메모:

- notice-only 글쓰기 차단은 권한/운영 정책 축
- private 문서공간 차단은 권한/회사 scope 축
- 첨부 업로드 미연결은 Production-ready (실구현)/dev-safe 축
- live fetch 불가 시 대체 근거 사용은 검증 환경 메모로 분리

## 3-1. 대장이 preview/live URL에서 바로 볼 쉬운 순서

1. `/dashboard`
   - 상단 액션 순서가 `/attendance` → `/approvals` → `/boards` → `/documents` → `/employees` 로 읽히는지 봅니다.
2. `/boards`
   - 전사 공지(`board_notice`)와 자유 게시판(`board_general`)이 같이 보이더라도 notice-only 책임 차이가 먼저 읽히는지 봅니다.
3. `/boards/board_notice` → `/posts/board_post_board_notice_employee_employee`
   - 공지 상세, 댓글/읽음 확인 CTA, 읽기 중심 흐름이 과장 없이 이어지는지 봅니다.
4. `/documents`
   - 전사 문서함 대 인사 전용 문서함, 첨부 metadata, 업로드/다운로드 제한, raw storage 비노출 설명이 같이 보이는지 봅니다.
5. `/admin/policies` 와 `/admin/audit-logs`
   - 일반 협업 흐름과 운영 설명이 섞이지 않고, read-only 운영 추적 톤을 유지하는지 봅니다.

이 순서를 보면 "되는 것 / 아직 안 되는 것 / 승인 필요" 를 한 번에 나눠서 읽을 수 있습니다.

## 4. 실제로 먼저 볼 파일

### Web

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/boards/[boardId]/page.tsx`
- `apps/web/app/posts/[postId]/page.tsx`
- `apps/web/app/documents/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`

### Shared / API / Test

- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

### 문서

- `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md`
- `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md`
- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

## 5. 권장 구현 순서

1. `/boards`, `/posts/[postId]`, `/documents` 의 화면 설명과 shared/API 계약을 먼저 맞춥니다.
2. notice-only, private space, metadata 비노출, forged 접근 차단 guardrail을 테스트/문구/route에서 다시 맞춥니다.
3. `/dashboard` 에서 협업 진입점이 다른 핵심 업무 흐름과 자연스럽게 이어지게 보강합니다.
4. `/admin/policies` 와 문서/게시판 운영 설명이 일반 협업 흐름과 충돌하지 않게 정리합니다.
5. build/check/build:cf/preview smoke/live URL 확인 포인트를 묶어 파일럿 checklist를 남깁니다.
6. 마지막에 남은 승인 게이트를 production data, DNS, secret, 유료 리소스, 외부 연동 축으로 정리합니다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- `/boards`, `/posts/[postId]`, `/documents` 와 `/dashboard` 협업 진입점 정렬
- notice-only/private space/metadata 비노출/R2 경계 문구와 데이터 구조 정리
- live URL 파일럿 기준으로 route 설명이 과장되지 않게 보강
- Web/API/shared/test/docs 동기화

하면 안 되는 것:

- production 저장/업로드 열기
- actual public URL 배포
- secret/DNS/유료 리소스 변경
- 외부 연동 시작

### 리뷰어(gwreviewer)

집중할 것:

- 공지/게시판/문서/첨부 흐름이 일반 협업과 운영 관리자 경계를 흐리지 않는지
- raw storage 정보, 내부 운영 후보, 관리자 정보가 일반 화면에 새지 않는지
- notice-only/private space/forged 접근 차단이 문서와 구현에서 같은 뜻인지
- Production-ready (실구현)를 완료 기능처럼 보이게 하는 문구가 없는지

### 테스터(gwtester)

집중할 것:

- 핵심 업무 route + 협업 route + 관리자 route 전체 smoke
- build/check/build:cf/local preview smoke 근거
- live fetch 불가 시 대체 근거 기록
- documents/boards 관련 API 권한/비노출/차단 회귀
- 파일럿 체크리스트가 실제 route/응답과 맞는지 확인

### 문서화(gwdocs)

집중할 것:

- SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF/CHANGELOG 최신화
- 대장이 live URL에서 볼 순서와 제한 설명 정리
- 남은 승인 게이트를 쉬운 한국어로 분리
- "되는 것 / 아직 안 되는 것 / 승인 필요" 구분 강화

### 운영(gwops)

집중할 것:

- branch/PR/CI/release gate/cloudflare deploy 확인
- live URL 확인 포인트와 대체 증거 정리
- build:cf, preview smoke, deployment metadata를 파일럿 근거로 묶기
- live fetch gate가 있을 때 정확히 어디까지 확인됐는지 남기기

## 7. 최소 smoke 기준

이번 단계에서 꼭 다시 볼 것:

1. `/dashboard` 가 공지/문서 진입점을 다른 업무 흐름과 함께 보여 준다.
2. `/boards` 와 `/boards/[boardId]` 가 게시판/공지 구조를 설명 가능하게 보여 준다.
3. `/posts/[postId]` 댓글/상세가 notice-only 책임 분리와 충돌하지 않는다.
4. `/documents` 가 문서 공간/첨부 metadata 흐름을 보여 주되 실운영 업로드 완료처럼 보이지 않는다.
5. private 문서공간, forged 접근, raw storage 정보 비노출 guardrail이 유지된다.
6. `/admin/policies` 의 문서/게시판 운영 설명과 일반 협업 route가 같은 방향을 가리킨다.
7. `/admin/audit-logs` 는 계속 read-only 운영 추적 톤을 유지한다.
8. live fetch가 막히면 build:cf/local preview/deployment metadata 대체 근거를 남긴다.

## 8. 꼭 지켜야 할 guardrail

- production data 반영 금지
- actual public file URL 오픈 금지
- production DB migration 실행 금지
- secret 입력/교체 금지
- DNS/custom domain 변경 금지
- 유료 리소스 생성·증설 금지
- 외부 HR/OCR/전자서명/문서보관 연동 금지
- raw storage key/bucket/internal prefix 노출 금지

## 9. 완료로 볼 최소 기준

- 대장이 preview/live URL에서 핵심 업무, 협업 route, 관리자 route를 따라가며 초안 상태를 검토할 수 있다.
- 게시판/문서/첨부 metadata/R2 경계가 설명 가능해진다.
- smoke 기준과 대체 검증 근거가 정리된다.
- production data, DNS, secret, 유료 리소스, 외부 연동 같은 남은 승인 게이트가 분리된다.
- 다음 구현/리뷰/테스트/문서화/운영 카드가 같은 기준으로 바로 이어질 수 있다.
