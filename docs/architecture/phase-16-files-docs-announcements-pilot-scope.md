# 그룹웨어 Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안 범위

## 1. 한 줄 정의

Phase 16의 목표는 이미 있는 게시판/공지/문서함/R2 Production-ready (실구현)과
Phase 14~15에서 정리한 일반 업무·관리자 흐름을 한 번 더 묶어,
"사내 검토용 파일럿 초안"으로 설명 가능한 상태를 만드는 것입니다.

쉽게 말해 이번 단계는
새로운 대형 기능을 여는 단계가 아니라,
공지/게시판/문서/첨부 metadata 흐름과 전체 smoke 기준을 안정화해서
대장이 preview/live URL에서 직접 눌러 보며
무엇이 되는지, 무엇이 아직 안 되는지, 무엇이 별도 승인 대상인지
한 번에 확인할 수 있게 만드는 단계입니다.

이번 단계도 production 데이터 입력, 실제 운영 파일 업로드 확대,
custom domain, secret 교체, 외부 연동, 유료 리소스 증설은 하지 않습니다.
핵심은 "파일럿 검토용 초안"으로서
화면 흐름·권한 경계·검증 기준·승인 게이트를 분명히 고정하는 것입니다.

## 2. 왜 이번 단계가 필요한가

지금까지 아래 기반은 이미 있습니다.

- `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/org`, `/employees`, `/admin/*` 업무/운영 흐름
- `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` Production-ready (실구현) 화면
- board/document shared contract 와 API Production-ready (실구현)
- R2 연계를 위한 private-by-default 원칙, metadata 우선 원칙, binding-aware Production-ready (실구현) 방향
- 관리자 정책/권한/감사 preview 와 일반 업무 흐름 연결 1차
- preview deploy, Cloudflare build, local smoke, live URL 대체 근거 운용 방식

하지만 아직 아래가 약합니다.

- 공지/게시판/문서함이 전체 제품 흐름에서 어디까지 검토 가능한지 한눈에 보이진 않습니다.
- 문서/첨부 metadata와 R2 경계가 "실제 업로드 가능"처럼 읽히지 않도록 더 분명한 기준이 필요합니다.
- 주요 route를 어디까지 smoke 성공으로 볼지, 어디는 보강 route로 볼지 정리할 필요가 있습니다.
- preview/live URL에서 대장이 직접 확인할 순서와 제한 설명이 아직 분산돼 있습니다.
- production data, DNS, secret, 유료 리소스, 외부 연동 같은 승인 게이트를 파일럿 검토용 결과와 분리해 적어야 합니다.

즉 Phase 15가 운영 기준과 업무 화면의 연결을 고정했다면,
이번 Phase 16은 게시판/문서/파일 흐름까지 포함해
"사내 검토용 초안"의 확인 동선과 승인 게이트를 안정화하는 단계입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `ROADMAP.md`
- `TASKS.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `CHANGELOG.md`
- `PRD.md`
- `README.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`
- `docs/guides/phase-15-operational-policy-audit-bridge-pass-1-handoff.md`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/boards/[boardId]/page.tsx`
- `apps/web/app/posts/[postId]/page.tsx`
- `apps/web/app/documents/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/api/test/auth-org.spec.ts`
- `packages/shared/src/contracts.ts`

현재 저장소 기준으로 확인되는 사실:

- 일반 업무 route는 `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/employees`, `/org` 까지 이어집니다.
- 관리자 route는 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 로 분리돼 있습니다.
- 게시판/문서 API Production-ready (실구현), 문서 공간 권한, metadata 비노출, forged/private 접근 차단 테스트는 이미 존재합니다.
- R2 방향은 private-by-default, D1 metadata 우선, raw storage key 비노출 기준으로 이미 문서화돼 있습니다.
- live URL 검증은 환경 gate 때문에 항상 직접 fetch 되지 않을 수 있으므로, build:cf/local preview/deployment metadata 대체 근거 운용이 이미 전제돼 있습니다.

즉 이번 단계는 새 저장소를 여는 것이 아니라,
이미 있는 route·문서·검증 기준을 "파일럿 검토 가능한 초안" 기준으로 한 번 더 정렬하는 작업입니다.

## 4. Phase 16에서 고정하는 핵심 결정

### 2026-06-13 기준 현재 판정 요약

실제 구현/리뷰/테스트 카드 결과를 현재 문서 기준으로 다시 묶으면 아래와 같습니다.

되는 것:

- `/dashboard` 의 상단 액션이 `/attendance` → `/approvals` → `/boards` → `/documents` → `/employees` 순서로 맞춰져 있고, eyebrow 도 Phase 16 문구로 정리돼 있습니다.
- `/boards`, `/boards/board_notice`, `/boards/board_general`, `/posts/board_post_board_notice_employee_employee`, `/documents` 흐름을 preview/local 문맥에서 읽기 중심 Production-ready (실구현) 로 따라갈 수 있습니다.
- notice-only 게시판 글쓰기 차단, private 문서공간 접근 차단, forged 게시글/읽음확인 차단, raw storage key 비노출, `FILES_BUCKET` 미설정 시 dev-safe fallback 같은 guardrail 이 테스트 기준으로 다시 확인됐습니다.
- 핵심 업무 route + 협업 route + 관리자 route + `/api/health`/`/api/me` 경계는 `pnpm check`, `build:cf`, local preview smoke 기준으로 다시 확인됐습니다.

아직 안 되는 것:

- 실제 production 문서/게시글/첨부 데이터 반영
- 실제 운영 파일 업로드 확대 또는 public URL 다운로드 오픈
- 외부 문서보관/OCR/전자서명/HR 연동
- live `.workers.dev` 직접 fetch smoke 의 최종 재확인

승인 필요:

- production data 반영
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 생성·증액
- public URL 오픈 또는 외부 공유 링크 정책 확정
- 실제 운영 파일 업로드 범위 확대

live fetch gate 메모:

- 이번 기준 문서는 live `.workers.dev` 직접 fetch 가 항상 가능한 것으로 쓰지 않습니다.
- 로컬 검증에서는 `pnpm --filter @gw/web preview:cf` 기본 경로가 불안정할 때, 같은 빌드 산출물을 기준으로 `apps/web` 에서 `wrangler dev --port 8790 --ip 127.0.0.1` 로 대체 smoke 한 결과를 근거로 사용합니다.
- 따라서 "live 확인 완료" 와 "build/local preview/deployment metadata 로 대체 확인" 을 반드시 분리해 적어야 합니다.

### 결정 A. 이번 파일럿 초안은 "보여 줄 수 있는 흐름"과 "아직 안 여는 운영 범위"를 분리해서 설명한다.

이번 단계에서 대장이 직접 눌러 볼 수 있는 것은 아래입니다.

- 홈/로그인/대시보드 입구 흐름
- 근태/휴가/결재 기본 업무 흐름
- 게시판/공지 목록, 게시글 상세, 댓글 Production-ready (실구현) 흐름
- 문서함/문서 공간/첨부 metadata Production-ready (실구현) 흐름
- 관리자 정책/권한/감사 preview 흐름

이번 단계에서 여전히 열지 않는 것은 아래입니다.

- production DB 실데이터 반영
- 실제 운영 파일 업로드 확대
- public URL 다운로드
- DNS/custom domain
- secret 입력/교체
- 유료 리소스 생성/증액
- 외부 HR/OCR/전자서명/문서보관 연동

즉 "파일럿 검토 가능"은
실운영 연결 완료가 아니라
화면/흐름/제한/승인 게이트가 설명 가능하다는 뜻입니다.

### 결정 B. 게시판/공지와 문서/파일은 같은 협업 묶음이지만 경계 설명은 따로 유지한다.

이번 단계에서 UI/문서 기준은 아래처럼 고정합니다.

1. 게시판/공지
   - 읽지 않은 공지, 게시판 목록, 게시글 상세, 댓글 흐름 중심
   - notice-only와 일반 게시판 책임 분리 유지
2. 문서/파일
   - 문서 공간 목록, 첨부 metadata, 접근 권한, 보관 경계 중심
   - 업로드/다운로드는 실제 운영 완료처럼 보이면 안 됨

즉 사용자는 둘을 같은 협업 문맥에서 보지만,
운영자는 게시글 공개/공지 전달과
문서 보관/첨부 접근을 다른 위험도로 설명할 수 있어야 합니다.

### 결정 C. R2는 이번에도 "binding-aware + dev-safe" 경계까지만 다룬다.

이번 Phase 16에서 R2 관련 목표는 아래까지입니다.

- `FILES_BUCKET` 같은 binding 존재를 가정한 구조가 문서/검증 기준과 모순되지 않음
- raw storage key, bucket 이름, public URL 이 응답/문서/화면에서 새지 않음
- mock/local-safe adapter 또는 metadata Production-ready (실구현) 기준으로 설명 가능함
- 실제 운영 업로드 없이도 route/검증/handoff가 이어질 수 있음

하지 않는 것:

- production bucket 실사용 확대
- 공개 다운로드 링크 오픈
- 실파일 업로드를 smoke 성공 조건으로 사용
- 외부 스토리지 운영 절차 확정

### 결정 D. Phase 16 smoke 기준은 "핵심 route + 협업 보강 route + 관리자 경계" 3묶음으로 본다.

이번 Phase 16에서는 route를 아래 3묶음으로 봅니다.

1. 핵심 업무 route
   - `/`
   - `/login`
   - `/dashboard`
   - `/attendance`
   - `/leave`
   - `/approvals`
   - `/employees`
   - `/org`
2. 협업/문서 보강 route
   - `/boards`
   - `/boards/[boardId]`
   - `/posts/[postId]`
   - `/documents`
3. 관리자/운영 route
   - `/admin`
   - `/admin/users`
   - `/admin/policies`
   - `/admin/audit-logs`
   - `/api/health`
   - `/admin/manifest.webmanifest`

핵심은 모든 route가 "완전 기능"이어야 한다는 뜻이 아니라,
각 route의 현재 역할, 제한, 권한 경계가 smoke 기준으로 설명 가능해야 한다는 것입니다.

### 결정 E. blocked/empty/error 와 Production-ready (실구현) 설명은 게시판/문서 흐름에도 같은 기준으로 확장한다.

기존 4축은 계속 유지합니다.

- 권한 부족
- 회사 scope 불일치
- 정책상 미허용
- Production-ready (실구현)/dev-safe 제한

Phase 16에서는 여기에 아래를 특히 연결합니다.

- notice-only 게시판 글쓰기 제한은 "권한/운영 정책" 축으로 설명
- private 문서공간 접근 차단은 "권한/회사 scope" 축으로 설명
- 첨부 업로드/다운로드 미연결은 "Production-ready (실구현)/dev-safe 제한" 축으로 설명
- live fetch 불가 시 대체 근거 사용은 "검증 환경 제한"으로 별도 메모

### 결정 F. live URL 확인 포인트는 "사용자가 보는 것"과 "운영자가 봐야 하는 것"을 함께 적는다.

대장이 live URL에서 볼 때는 아래 2가지를 함께 확인할 수 있어야 합니다.

1. 일반 사용자가 보는 흐름
   - 홈, 로그인, 대시보드, 근태, 휴가, 결재, 게시판, 문서함
2. 운영자가 봐야 하는 흐름
   - 관리자 정책/권한/감사 preview
   - 문서/파일/공지 관련 제한 설명
   - 아직 별도 승인 필요한 운영 항목 목록

즉 이번 단계의 결과 문서는
단순 route 나열이 아니라
"어디를 누르면 무엇이 보이고, 왜 아직 여기서 멈추는지"를 같이 적어야 합니다.

## 5. 역할별 기대 흐름

### 일반 직원

주요 기대:

- `/dashboard` 에서 근태/휴가/결재/공지/문서 진입점을 본다.
- `/boards` 와 `/documents` 가 같은 협업 묶음 안에 있다는 감각을 얻는다.
- 문서/첨부가 실제 실운영 저장처럼 과장되지 않음을 이해한다.
- private 문서공간이나 notice-only 게시판 같은 제한이 왜 있는지 이해한다.

### 팀장/승인자

주요 기대:

- `/approvals` 와 `/leave` 흐름이 팀 승인 관점으로 읽힌다.
- 공지 전달/문서 접근은 볼 수 있지만 운영 정책 변경 권한과는 다름을 이해한다.
- 협업 자료 확인과 운영 관리자 역할이 섞이지 않는다.

### 인사/운영 관리자

주요 기대:

- `/admin/policies` 에서 게시판/문서 정책 후보를 운영 관점에서 본다.
- `/admin/users` 에서 권한/상태가 일반 협업 흐름에 미치는 영향을 설명할 수 있다.
- `/documents` 와 첨부 metadata 경계가 R2/실운영 파일 저장과 어떻게 분리되는지 설명할 수 있다.

### 감사/운영 검토자

주요 기대:

- `/admin/audit-logs` 에서 운영 변경과 예외 추적 기준을 본다.
- 공지/문서/첨부 흐름이 raw 내부 정보 노출 없이 설명 가능한지 확인한다.
- 파일럿 검토 후 어떤 승인 게이트가 남는지 바로 판단할 수 있다.

## 6. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 16 범위 문서 작성
- Phase 16 handoff 문서 작성
- 루트 문서의 현재 활성 체인을 Phase 16 기준으로 갱신
- 파일럿 검토용 smoke route, live URL 확인 순서, 승인 게이트를 정리

### 다음 구현 카드에서 허용하는 범위

- `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 의 Production-ready (실구현)/권한/안내 문구 보강
- board/document shared contract 와 API Production-ready (실구현)의 설명 정렬
- 문서/첨부 metadata 와 R2 binding-aware 경계 보강
- smoke checklist에 협업/문서 route와 관리자 검증 포인트 포함
- preview deploy 후 live URL 기준 확인 포인트 정리
- Web/API/shared/test/docs 동기화

### 이번 Phase에서 제외하는 범위

- 실제 production 문서/게시글/첨부 데이터 반영
- production DB migration 실행
- 실제 운영 파일 업로드, 다운로드 공개, public URL 오픈
- bucket 구조 운영 전환, 외부 공유 링크, OCR/전자서명 연동
- custom domain/DNS 변경
- secret 입력/교체
- 유료 리소스 생성·증설
- 외부 HR/문서보관 SaaS 실제 연동

## 7. 권장 구현 순서

1. `/boards`, `/posts/[postId]`, `/documents` 와 현재 shared/API 설명이 같은 뜻인지 먼저 맞춥니다.
2. notice-only/private space/R2 metadata 비노출 같은 guardrail을 화면/API/test에서 같이 확인합니다.
3. `/dashboard` 에서 협업 진입점과 `/boards`/`/documents` 흐름이 과장 없이 이어지게 다듬습니다.
4. `/admin/policies` 와 문서/게시판 운영 메모가 일반 협업 흐름과 충돌하지 않게 맞춥니다.
5. smoke route와 live URL 확인 포인트를 문서/검증 기준으로 정리합니다.
6. 마지막에 build/check/test/build:cf/preview smoke/deployment evidence를 묶어 파일럿 초안 근거를 남깁니다.

## 8. 최소 smoke 기준

이번 1차에서 꼭 다시 볼 기준:

1. `/dashboard` 에서 공지/문서 진입점이 다른 핵심 업무 흐름과 자연스럽게 이어진다.
2. `/boards` 와 `/boards/[boardId]` 가 공지/게시판 묶음 구조를 설명 가능하게 보여 준다.
3. `/posts/[postId]` 댓글/상세 흐름이 notice-only, 일반 게시판 책임 분리와 충돌하지 않는다.
4. `/documents` 가 문서 공간/첨부 metadata 흐름을 보여 주되 실제 운영 업로드 완료처럼 보이지 않는다.
5. private 문서공간, forged 접근, raw storage 정보 노출 차단 같은 guardrail이 유지된다.
6. `/admin/policies` 의 문서/게시판 운영 설명과 일반 협업 화면이 같은 방향을 가리킨다.
7. `/admin/audit-logs` 는 계속 raw 민감정보 없이 read-only 운영 추적 톤을 유지한다.
8. live fetch가 막히면 local preview/build/deployment metadata 같은 대체 근거가 문서에 같이 남는다.

## 9. 남는 승인 게이트

이번 Phase가 끝나도 별도 승인으로 남는 항목:

- production DB 실데이터/실저장 반영
- secret 입력/교체
- custom domain/DNS
- 유료 리소스 생성·증액
- 외부 HR/전자서명/OCR/문서보관 연동
- 실제 운영 파일 업로드 범위 확대
- public URL 또는 외부 공유 링크 정책 확정

## 10. 완료로 볼 최소 기준

- 대장이 preview/live URL 기준으로 핵심 업무, 협업 route, 관리자 route를 한 번에 검토할 수 있다.
- 게시판/문서/첨부 metadata/R2 경계가 "되는 것"과 "아직 안 되는 것"으로 분명히 나뉜다.
- smoke 기준과 대체 검증 근거가 문서에 정리돼 있다.
- 파일럿 전에 필요한 별도 승인/입력 항목이 production data, DNS, secret, 유료 리소스, 외부 연동 축으로 분리돼 있다.
- 다음 구현/리뷰/테스트/문서화/운영 카드가 같은 기준으로 바로 이어질 수 있다.
