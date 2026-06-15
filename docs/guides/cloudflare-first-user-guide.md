# Cloudflare-first 스켈레톤 사용자 안내

이 문서는 지금 저장소에서 무엇을 볼 수 있는지 빠르게 설명합니다.

## 지금 바로 확인할 수 있는 것

이 스켈레톤에는 아래 항목이 들어 있습니다.

- Web/PWA 시작 화면
- 로그인, 대시보드, 직원, 조직도, 근태, 휴가, 전자결재, 관리자 화면의 기본 경로
- 게시판/문서 1차용 API/shared 계약과 범위 문서
- `/api/health`, `/api/auth/login`, `/api/auth/logout`, `/api/me` 기본 API
- 회사/직원/부서/역할/권한 조회 API 골격
- Web/API가 같이 보는 공통 계약(`packages/shared`)
- D1 SQL migration 골격(`db/migrations/0001_initial_schema.sql`, `0002_auth_org_phase2.sql`, `0003_attendance_leave_phase3.sql`, `0004_approvals_phase4.sql`)
- 근태/휴가 placeholder API와 승인 경계 검증 흐름
- 전자결재 양식/결재선/기안/문서함/승인함 placeholder API와 `/approvals` 화면
- 게시판/문서 1차 범위를 정리한 `docs/architecture/phase-5-boards-documents-scope.md`
- 모바일 홈(`/`), 오프라인 안내(`/offline`), 설치 안내와 quick action 을 포함한 Phase 6 모바일/PWA 1차 skeleton
- Phase 6 모바일/PWA 1차 기준 문서 `docs/architecture/phase-6-mobile-pwa-scope.md`
- 같은 origin 안에서 `/api/health`, `/api/me` 를 다시 붙이기 위한 Phase 7 same-origin 브리지 코드와 기준 문서
- 문서/첨부파일 저장소 연결 1차 보안 기준을 정리한 `docs/architecture/phase-8-r2-storage-scope.md`
- 관리자/운영 설정과 감사 로그 1차 기준을 정리한 `docs/architecture/phase-9-admin-audit-scope.md`

지금 단계의 화면은 실제 업무 데이터를 보여주는 완성본이 아닙니다.
먼저 정보구조와 경로를 고정해 두기 위한 골격입니다.

## 아직 없는 것

아래 항목은 아직 구현하지 않았습니다.

- 실제 로그인 연동
- 실제 회사/직원 데이터 연결
- 근태, 휴가, 결재의 실데이터 저장/정책 계산/실승인 처리
- 파일 업로드와 실제 문서/첨부 저장
- 문서 다운로드 공개 링크와 외부 공유
- 근태/휴가/전자결재의 실제 상태 변경 완료 흐름
- 모바일 CTA 접근성 마무리
- Cloudflare 실배포
- 운영용 D1, R2, KV, Queues 같은 실리소스 연결
- 실제 메일 초대 발송

즉, 지금은 "화면과 계약의 시작점"을 보는 단계라고 이해하면 됩니다.

## 로컬에서 확인하는 방법

먼저 루트 디렉터리에서 패키지를 설치합니다.

```bash
pnpm install
```

화면 골격을 빠르게 보려면:

```bash
pnpm --filter @gw/web dev
```

Cloudflare 호환 프리뷰까지 같이 보려면:

```bash
pnpm --filter @gw/web preview:cf
```

API 헬스 체크와 placeholder 인증 흐름을 보려면 다른 터미널에서:

```bash
pnpm --filter @gw/api dev
curl http://127.0.0.1:8787/api/health
curl -i http://127.0.0.1:8787/api/auth/login \
  -H 'content-type: application/json' \
  -H 'x-dev-role: COMPANY_ADMIN' \
  --data '{"loginId":"admin","password":"1234"}'
```

정상 응답 예시는 아래와 같습니다.

```json
{
  "ok": true,
  "data": {
    "service": "gw-api",
    "status": "ok",
    "version": "0.1.0"
  },
  "error": null
}
```

## 화면 경로 한눈에 보기

현재 Web 앱에는 아래 경로가 준비되어 있습니다.

- `/`
- `/offline`
- `/login`
- `/dashboard`
- `/employees`
- `/org`
- `/attendance`
- `/leave`
- `/approvals`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`

## preview URL 이 나오면 먼저 확인할 것

현재 공개 Web preview URL 은 `https://gw-web.werehere31.workers.dev` 입니다.

이번에 사용자 관점에서 바로 확인된 결과는 아래와 같습니다.

1. `/` — 200, 첫 진입 화면이 열림
2. `/login` — 200, 로그인 안내와 placeholder 설명이 열림
3. `/boards` 와 `/boards/board_general` — 게시판 placeholder 화면 확인용 경로
4. `/documents` — 200, 문서함 placeholder 화면이 열림
5. `/offline` — 오프라인/불안정 네트워크 안내를 확인할 수 있음
6. `/manifest.webmanifest` — 200, PWA manifest 가 같은 origin 에서 열림
7. `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` — 화면이 직접 열리지 않고 `/login` 으로 307 redirect

운영/개발 담당자가 같이 확인할 항목도 미리 알아두면 좋습니다.

- 관리자 화면은 외부 preview 에서 무방비로 열리면 안 되며, 이번 확인에서는 `/login` redirect 로 막혔습니다.
- 현재 저장소 로컬 기준으로는 same-origin `/api/health`, `/api/me` 브리지와 `build:cf` 검증까지 다시 통과했습니다.
- 다만 공개 preview URL 에 이 최신 코드를 다시 올려 `/api/*` 와 `/admin*` 를 재확인한 결과는 운영 실행 결과로 따로 남겨야 합니다.
- preview URL 이 생겨도 아직 production 전환이 끝난 것은 아닙니다.

즉, 사용자는 "메인 화면과 문서/게시판 화면이 열리는지, admin 화면이 바로 열리지 않는지, 오프라인 제한 안내가 과장되지 않는지, 같은 origin 의 manifest 가 보이는지" 정도까지만 먼저 확인하면 됩니다.

## 인증/조직 화면에서 보게 되는 것

지금 단계의 인증/조직 화면은 아래 정도까지만 보여 줍니다.

- `/login`: 예시 이메일/비밀번호와 placeholder 로그인 설명
- `/dashboard`: 세션 상태, 현재 회사, 역할/권한 표시 자리
- `/employees`: 직원 기본 컬럼 예시와 조회 API 연결
- `/org`: 부서/역할/권한 조회 API 연결
- `/admin`: 관리자 초대 payload 와 권한 체크 위치 설명

중요한 점:

- 화면이 있다고 해서 실제 기능이 끝난 것은 아닙니다.
- 메뉴가 보여도 실제 접근 권한은 API에서 다시 검사합니다.
- 예를 들어 `EMPLOYEE` 역할은 현재 placeholder 기준으로 회사 정보만 볼 수 있고, 직원/부서/역할/권한 조회는 403 으로 막혀야 정상입니다.

## 다음 단계에서 기대할 것

다음 구현 단계에서는 보통 아래 순서로 확장합니다.

1. 모바일 CTA 를 실제 버튼/링크 semantics 로 바꿔 접근성 이슈를 먼저 줄임
2. 실제 인증 공급자와 회사/직원/조직 저장소 연결 검토
3. 근태/휴가/전자결재 API 안정화와 실제 상태 변경 흐름 연결
4. 게시판/문서 저장·업로드·검색·알림 같은 실제 기능 확장
5. Cloudflare 실리소스 연결과 외부 preview/배포 검토

근태/휴가 1차에서 사용자가 보게 될 기본 흐름은 아래입니다.

- `/attendance`: 오늘 출근/퇴근 상태, 근태 기록 목록, 정정 요청 입력 자리
- `/leave`: 휴가 유형, 잔여, 신청 상태, 승인 대기 목록 자리
- 권한이 없는 사용자는 승인 버튼 대신 안내 문구를 보게 됨
- `EMPLOYEE` 는 자기 근태/휴가 흐름만 보는 것이 기본이며, 다른 직원 `employeeId` 나 임의 휴가 request id 를 넣어도 처리되지 않아야 정상입니다.
- `HR_ADMIN`/`MANAGER` 같은 승인자는 팀 대기 요청(`leave_request_team_pending`)만 승인할 수 있고, 자기 own 요청(`leave_request_demo`)은 승인할 수 없습니다.
- 현재 단계에서는 실제 연차 차감/급여 반영이 아니라 placeholder 상태만 확인함

게시판/문서 1차의 현재 상태는 아래처럼 이해하면 됩니다.

- 이제 `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` placeholder 화면을 바로 열어볼 수 있습니다.
- API 쪽에는 `/api/notices`, `/api/boards`, `/api/boards/:id/posts`, `/api/documents/spaces`, `/api/documents/files`, `/api/read-receipts` endpoint 가 연결 기준점으로 들어와 있습니다.
- 최근 검증에서는 공지형 게시판 쓰기, 존재하지 않는 문서함 metadata 생성, forged 게시글 상세 조회, forged 게시글 read receipt 생성이 모두 403 으로 막히는 것까지 확인했습니다.
- 즉, 지금은 "사용자 기능 오픈 전 단계에서 계약, placeholder 화면, 권한 경계를 먼저 맞춘 상태" 입니다.
- 다만 실제 R2 업로드, production 문서 데이터 반입, 외부 공유 링크, OCR/전자서명 연동은 별도 승인 전까지 하지 않습니다.

## Phase 8 문서/첨부 저장소가 이어받는 기준

- 쉬운 요약 handoff 는 `docs/guides/phase-8-r2-storage-handoff.md` 에 따로 정리돼 있습니다.
- 문서 파일 저장은 private-by-default 기준으로 시작하고, 사용자는 raw storage key 나 bucket 주소를 직접 보지 않습니다.
- 파일 종류는 제한된 allowlist 로 시작하며, 1차 기본 크기 제한은 파일 1개 25MB 입니다.
- 다운로드/업로드는 먼저 문서 공간 권한과 회사 경계를 통과해야 하며, 공개 URL 을 기본값으로 바로 열지 않습니다.
- 초기 검증은 실제 운영 업로드보다 mock/local-safe 흐름을 먼저 맞추는 방식입니다.
- 즉, Phase 8 은 "파일 기능 오픈"보다 "안전한 보관 규칙을 먼저 고정"하는 단계라고 이해하면 됩니다.

## Phase 9 관리자/운영 화면이 이어받는 기준

- 쉬운 요약 handoff 는 `docs/guides/phase-9-admin-audit-handoff.md` 에 따로 정리돼 있습니다.
- `/admin/users`, `/admin/policies`, `/admin/audit-logs` 는 일반 업무 화면이 아니라 운영 통제 화면입니다.
- 일반 사용자는 `/org`, `/employees`, `/boards`, `/documents`, `/approvals`, `/attendance`, `/leave` 같은 업무 화면을 먼저 보게 됩니다.
- 관리자 화면이 있다고 해서 바로 운영 변경이 열린 것은 아니며, 로그인 뒤에도 권한이 없으면 접근이 막혀야 정상입니다.
- 감사 로그는 운영 변경 이력을 남기기 위한 후보 구조이고, raw `storageKey`, bucket 주소, public URL, secret 같은 값은 기본 응답/문서에 직접 보이지 않아야 합니다.
- 즉, Phase 9 는 "관리자 메뉴 추가"보다 "업무 화면과 운영 통제를 분리하고 기록 기준을 먼저 고정"하는 단계라고 이해하면 됩니다.

## Phase 10 관리자/감사 로그 2차가 이어받는 기준

- 쉬운 요약 handoff 는 `docs/guides/phase-10-admin-audit-pass-2-handoff.md` 에 따로 정리돼 있습니다.
- `/admin/users` 는 실제 권한 저장 화면이 아니라, 사용자-직원 연결 상태와 역할 diff 를 먼저 검토하는 candidate 화면으로 이해하면 됩니다.
- `/admin/policies` 는 근태/휴가/결재, 문서/첨부, 게시판/공지 정책을 나눠서 보기 쉽게 정리하는 단계입니다.
- `/admin/audit-logs` 는 감사 로그를 더 많이 여는 단계가 아니라, 시간 범위(`createdFrom`, `createdTo`)와 마스킹 기준을 더 분명히 잠그는 단계입니다.
- 즉, Phase 10 도 여전히 "운영 실행 오픈"이 아니라 "운영 직전 검토 기준을 더 촘촘하게 고정"하는 단계입니다.

## Phase 11 조직/직원 일반 화면 1차가 이어받는 기준

- 쉬운 요약 handoff 는 `docs/guides/phase-11-org-employees-handoff.md` 에 따로 정리돼 있습니다.
- `/employees` 는 사람을 찾고 상태를 읽는 일반 화면입니다. 이름, 소속, 역할/직책 요약, 재직 상태를 먼저 보는 단계라고 이해하면 됩니다.
- `/org` 는 조직 구조를 이해하는 일반 화면입니다. 부서 구조, 역할/직책, 권한 체계 안내를 읽기 전용으로 보는 단계입니다.
- `/admin/users` 는 여전히 운영 사용자 연결, 역할 diff, 상태 변경 preview 를 보는 관리자 후보 화면입니다.
- 중요한 점은, 이번 단계도 실제 직원 개인정보 원문 연결이나 운영 권한 저장이 열린 것이 아니라는 점입니다.
- 그리고 현재 로컬 재검증 기준으로 `/api/employees` 도 기본 경계를 같이 맞췄습니다. 비관리자는 관리자 role filter 를 써도 그 필터가 무시되고, 잘못된 `employmentStatus`/`roleCode` 값은 400 `VALIDATION_ERROR` 로 바로 돌려줍니다.

쉽게 말하면 Phase 11 은 "조직/직원 일반 화면의 자리와 말투를 먼저 정리한 단계"입니다. 실제 운영 변경 기능을 연 단계는 아닙니다.

## Phase 6 모바일/PWA가 이어받는 기준

모바일/PWA 단계는 preview URL 이 생겨도 아래 기준을 그대로 이어받습니다.

- 앱 시작 경로는 `apps/web/public/manifest.webmanifest` 의 `start_url: "/"` 기준을 유지합니다.
- manifest 경로는 `apps/web/app/layout.tsx` 의 `manifest: "/manifest.webmanifest"` 처럼 같은 origin 상대 경로를 유지합니다.
- API도 우선 `/api/*` 같은 same-origin 기준으로 붙는다고 이해하면 됩니다.
- 다만 연결 방식 자체는 `docs/architecture/phase-7-api-same-origin-scope.md` 기준으로, 별도 공개 API 도메인을 기본값으로 두지 않고 현재 Web origin 안에서 먼저 맞추는 쪽을 우선합니다.
- 현재 저장소 코드 기준으로는 `/api/health`, `/api/me` 가 이 same-origin 원칙으로 다시 연결돼 있고 로컬 `build:cf` 도 다시 통과했습니다. 공개 preview 재확인 여부는 별도 운영 실행 결과로 봐야 합니다.
- 즉, preview 전용 절대 도메인을 앱 안에 하드코딩하지 않는 것이 기본 원칙입니다.

사용자 관점에서 이번 Phase 6 에서 기대하는 변화는 아래 정도입니다.

- `/`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents` 가 작은 화면에서도 읽기 쉬운 카드 구조로 정리됩니다.
- 앱 설치에 필요한 manifest/icon placeholder 와 기본 안내 문구가 정리됩니다.
- `/offline` 에서 오프라인 상태에서 가능한 일과 막아야 하는 일을 따로 보게 됩니다.
- 다만 실제 앱스토어 배포, push 알림, background sync, 생체인증, 실데이터 운영 연결은 아직 아닙니다.

현재 바로 알아둘 제한도 있습니다.

- `attendance`, `leave`, `approvals` 화면의 큰 행동 버튼은 아직 실제 동작 버튼이 아니라 placeholder 입니다.
- 특히 이 CTA 들은 현재 `<span aria-disabled>` 형태로 남아 있어, "누를 수 있어 보이지만 실제 버튼은 아님"이라는 접근성 한계가 있습니다.
- 그래서 지금 단계에서는 화면 구조와 안내 문구를 먼저 확인하고, 실제 처리 완료까지 기대하면 안 됩니다.

전자결재 1차에서 사용자가 보게 될 기본 흐름은 다음과 같습니다.

- `/approvals`: 내 기안함/승인함/참조 문서함 구조를 미리 보는 placeholder 화면
- 결재 양식/결재선/참조자 후보를 불러오는 API 골격은 이미 있지만, 실제 운영 문서를 저장하는 완성 흐름은 아직 아님
- 기안자는 문서 제목, 양식, 결재선, 요약 내용을 입력하는 skeleton 폼을 보게 됨
- 승인자는 승인/반려 버튼과 결재선 상태를 보되, 실제 법적 효력이나 외부 서명 연동은 아직 없음
- 권한이 없는 사용자는 문서 접근 자체가 제한되거나 안내 상태만 보게 됨
- 즉, 지금 단계에서는 실문서 저장·전자서명·외부 알림이 아니라 정보구조와 권한 경계만 먼저 확인함

## 같이 보면 좋은 문서

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/guides/phase-8-r2-storage-handoff.md`
- `docs/guides/phase-9-admin-audit-handoff.md`
- `docs/guides/phase-10-admin-audit-pass-2-handoff.md`
- `docs/guides/phase-11-org-employees-handoff.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/cloudflare-first-phase-scope.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
