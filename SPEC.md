# SPEC

## 문서 목적

이 문서는 루트 수준에서 꼭 지켜야 하는 공통 행동 규칙을 모아 둔 문서다.

쉽게 말해:
- `DATA_MODEL.md` 는 무엇이 있는지 보여 주고
- `API.md` 는 어떤 route 와 payload 가 있는지 보여 주며
- 이 문서는 "그래서 구현할 때 무엇을 절대 깨뜨리면 안 되는지"를 정리한다.

## 1. 최상위 제품 규칙

### 1-1. 기능보다 업무 흐름을 우선한다.

상위 업무 묶음은 아래 순서를 유지한다.
- 홈/대시보드
- 근태/휴가
- 전자결재
- 게시판/공지
- 문서/파일
- 조직/직원
- 관리자

근거:
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`

### 1-2. 일반 업무와 관리자 운영은 섞지 않는다.

- 일반 업무 화면은 오늘 해야 할 일을 빠르게 처리하는 흐름에 집중한다.
- 운영 정책/권한/감사 로그는 `/admin/*` 계열로 분리한다.
- 같은 데이터를 보더라도 목적이 다르면 화면 책임도 다르게 나눈다.

예시:
- `/employees`: 일반 조회와 상태 이해 중심
- `/org`: 조직 구조와 역할 카탈로그 이해 중심
- `/admin/users`: 사용자-직원 연결, 역할 diff, 상태 변경 preview 검토 중심

근거:
- `docs/architecture/phase-11-org-employees-scope.md`
- `docs/product/groupware-vision-roadmap.md`

### 1-3. skeleton/placeholder 는 완성품처럼 보이면 안 된다.

- 실제 운영 저장/승인/배포가 아닌 것은 placeholder 라고 분명히 남긴다.
- 빈 상태와 제한은 숨기지 않고 설명한다.
- 오프라인/preview/skeleton 단계 문구가 성공 오해를 만들면 안 된다.

근거:
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`

## 2. 공통 권한/경계 규칙

### 2-1. same-origin 기본값을 유지한다.

- Web/PWA 기본 API 경로는 `/api/*` same-origin 상대 경로다.
- manifest 는 `/manifest.webmanifest`, `start_url` 은 `/` 기본값을 유지한다.
- preview 전용 절대 API 도메인을 제품 기본값으로 문서/코드에 박아 넣지 않는다.
- host 기준 관리자 앱을 분리하더라도 일반 사용자용 same-origin 기본값은 유지한다.
- 관리자용 manifest 를 따로 두더라도 `start_url: /admin`, `scope: /admin` 같은 상대 경로 원칙을 유지한다.
- 네이티브 모바일앱은 브라우저 same-origin 을 흉내 내는 대신 `apps/mobile/src/base-url.ts` 같은 runtime base URL resolver 층에서만 승인된 origin 을 주입한다.
- 모바일 preview/dev-safe 연결은 명시적 `devOrigin` 또는 mock adapter 로만 열고, preview 절대 URL 을 코드 기본값으로 퍼뜨리지 않는다.
- 운영 모바일앱 기본값은 approved origin only 이며, localhost/dev-safe fallback 을 production 기본값처럼 설명하지 않는다.

이 규칙을 깨면 안 되는 이유:
- 세션/cookie/CORS 문맥이 복잡해진다.
- preview 와 production 설명이 어긋난다.
- 모바일/PWA 문서와 운영 문서가 충돌한다.

근거:
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `ARCHITECTURE.md`

### 2-2. 권한 체크는 UI 숨김으로 끝내지 않는다.

- 화면에서 버튼을 숨겨도 서버 검증은 반드시 유지한다.
- 권한 없는 접근은 403 계열로 분리한다.
- 관리자 영역은 `roleCode`/permission 기준을 함께 확인한다.
- 특히 `/admin/audit-logs` 같은 감사 조회는 "관리자처럼 보이는 role" 이 아니라 `audit.read` capability 를 실제 기준으로 맞춘다.

실무 기준:
- UI 는 혼란을 줄이기 위한 1차 필터다.
- 실제 보안 경계는 API 에 있어야 한다.

근거:
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

### 2-3. 회사 scope 는 공통 guardrail 이다.

- 다른 회사의 직원/문서/정책/감사 데이터는 조회·변경하지 못해야 한다.
- 운영 변경 endpoint 는 `ensureCompanyBoundary(...)` 기준을 유지한다.
- candidate/preview 응답도 다른 회사 범위는 섞지 않는다.

근거:
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-9-admin-audit-scope.md`

### 2-4. 자기행동 금지 규칙은 명시적으로 유지한다.

적어도 아래는 금지 대상이다.
- 자기 휴가/결재를 자기 자신이 승인하는 흐름
- 관리자 화면에서 자기 검토/자기 승인처럼 오해될 수 있는 preview 흐름
- 자신이 만든 제한 없는 권한 상승 흐름

특히 전자결재는 self-approval guardrail 이 핵심이다.

근거:
- `apps/api/test/auth-org.spec.ts`
- `docs/architecture/phase-4-approvals-scope.md`

### 2-5. 민감정보는 마스킹/비노출 기본값을 유지한다.

- secret, token, raw storage key, password hash, 실제 개인정보 원문은 응답/로그/문서에 노출하지 않는다.
- 감사 로그와 정책 candidate 는 masked preview 우선으로 표현한다.
- 문서 저장소 metadata 와 실제 storage 내부 정보는 분리해 설명한다.

근거:
- `DATA_MODEL.md`
- `API.md`
- `apps/api/test/document-storage.spec.ts`
- `docs/architecture/phase-8-r2-storage-scope.md`

### 2-6. 운영 자동화는 역할봇 권한 확대보다 판단루프 보강을 우선한다.

- 역할봇 전체 권한을 무작정 넓히지 않는다.
- 카드 범위에 명시된 `PR merge`, `release gate`, `branch cleanup`, `review-required 정리`, `stale blocker 정리`, `검증 재실행` 같은 예외만 card-scoped 승인 범위로 다룬다.
- blocked 재판단은 release cleanup → stale/superseded → review-required 재검증 → recovery loop → 승인 필요 순으로 본다.
- `already-handled` 로그는 해결 완료 확정이 아니라 원본 카드와 후속 체인 상태 재확인 신호로 본다.
- scheduled/stale/superseded 카드 정리는 "예전 카드가 있었다"는 사실보다 "최신 main 기준에서 지금도 재현되는가"를 우선 본다.
- 더 최신 완료 카드와 현재 저장소 검증(`pnpm check`, 관련 test/typecheck/build, 가능하면 `build:cf` 와 local `preview:cf` smoke)이 이미 같은 목적을 흡수하면, 예전 scheduled 후속 카드는 기준 카드 1장만 남기고 정리 후보로 본다.
- Telegram 보고는 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 분리한다.
- blocked 설명은 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요로 구분한다.
- 카드 댓글만으로 사용자 보고 완료라고 보지 않고, raw 이벤트 dump를 그대로 보내지 않는다.
- 카드 댓글 작성 완료와 사용자 직접 보고 완료는 분리 기록한다.
- 같은 카드·같은 이유·같은 근거의 즉시 보고는 반복하지 않고, 상태가 바뀌었을 때만 다시 보낸다.
- secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업은 자동화가 끝까지 실행하지 않는다.

역할별 기본 책임 매트릭스:
- `gwplanner`: 범위 정의, 승인 게이트 정리, 후속 카드 분리
- `gwbuilder`: 코드/스크립트 수정과 최소 검증 근거 정리
- `gwreviewer`: 경계/보안/문서 일치 여부 리뷰
- `gwtester`: fixture, dry-run, service/journal, board state, dispatch dry-run 검증
- `gwdocs`: 쉬운 한국어 문서, blocked 분류 설명, 보고 양식, handoff 정리
- `gwops`: PR/CI/merge/branch cleanup/release gate 같은 운영 후속 검증

예외 권한 해석 원칙:
- `PR merge`, `release gate`, `branch cleanup`, `review-required 정리`, `stale blocker 정리`, `검증 재실행`은 상시 권한이 아니라 card-scoped 예외다.
- card-scoped 예외가 있어도 restricted 항목(secret, `.env`, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 자동화 범위에 넣지 않는다.
- 역할봇이 직접 처리할 수 없는 판단은 싱드가 원본 카드, run, comment, 검증 근거를 다시 보고 분류한다.

근거:
- `AGENTS.md`
- `docs/architecture/rolebot-authority-decision-loop-hardening-scope.md`
- `docs/guides/rolebot-authority-decision-loop-hardening-handoff.md`
- `docs/guides/automation-hardening-review-gate-handoff.md`

## 3. 역할별 행동 규칙

### 3-1. 일반 직원

할 수 있는 일:
- 출퇴근, 휴가 신청, 결재 기안/확인, 공지 확인, 문서 조회 같은 일반 업무
- 접근 가능한 게시판 글/댓글 작성
- 접근 가능한 문서공간 파일 조회

하면 안 되는 일:
- 관리자 정책/권한/감사 로그 관리
- private 문서공간 무단 접근
- notice-only 게시판에 일반 글쓰기

### 3-2. 팀장/승인자

할 수 있는 일:
- 팀/하위 범위의 승인 대기 확인
- 휴가/결재 승인·반려 placeholder 처리
- 예외 상황 검토

하면 안 되는 일:
- 자기 문서 자기승인
- 회사 범위를 넘는 승인
- 관리자 정책 화면 책임과 일반 승인 화면 책임 혼합

### 3-3. 인사/총무/관리자

할 수 있는 일:
- `SUPER_ADMIN`, `COMPANY_ADMIN`: `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 접근
- `HR_ADMIN`: `/admin`, `/admin/users`, `/admin/policies` 접근
- `AUDITOR`: `/admin/audit-logs` 조회 전용 접근
- 운영 기준 preview 와 review requirement 확인

주의할 일:
- 운영 변경 후보를 실제 저장 완료처럼 표현하지 않기
- 다른 회사 범위 변경 차단
- 민감정보 raw 값 비노출

## 4. 모듈별 필수 guardrail

### 4-1. 인증/조직

반드시 지킬 것:
- 무인증 보호 route 는 401 `AUTH_REQUIRED`
- 직원 일반 조회와 관리자 운영 화면을 분리
- invalid filter 는 500 이 아니라 400 `VALIDATION_ERROR`
- 일반 조회에서 admin-only 역할/권한 요약을 과도하게 노출하지 않기

관련 문서:
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-11-org-employees-scope.md`

### 4-2. 근태/휴가

반드시 지킬 것:
- 출퇴근/정정/휴가 신청은 placeholder 단계라도 상태와 제한을 분명히 표시
- 본인 범위와 관리자 범위를 구분
- 회사 정책에서 허용한 출퇴근 등록 방식만 직원 화면 CTA 와 API 성공 경로에 올린다.
- `/attendance` 와 `/leave` 는 둘 다 현재 허용 결과만이 아니라 마지막으로 적용된 정책 source 또는 미허용 이유를 최소 한 줄 이상 설명 가능해야 한다.
- 휴가 화면은 승인 권한 부족, 회사 scope, 정책상 미허용, placeholder 제한을 출퇴근 화면과 같은 4축으로 설명하고 `/admin/policies` 와 다른 말을 하지 않는다.
- 정책 적용대상 우선순위는 `company_default < workplace < department < job_type` 로 고정한다.
- 각 단계는 allowed methods 를 부분 병합하지 않고 `effective policy` 전체 override 로 계산한다.
- 관리자 화면의 적용 인원/샘플 직원 preview 는 설명용 기준이며, 실제 조직 master 데이터 대량 반영이나 개인별 예외 저장 UI 처럼 보이면 안 된다.
- 개인(employee)별 override 는 이번 정책 범위에 넣지 않는다.
- `tag` 는 실장비 연결이 아니라 안내형 skeleton 으로 먼저 다룬다.
- 실제 조직 데이터 적용, GPS/위치정보 수집·저장, NFC/RFID/QR 장비 연동, 외부 HR/출입 API 연동은 계속 별도 승인 항목으로 남긴다.
- 승인 권한 없는 사용자의 approve/reject 차단
- unknown employee/request id 를 성공처럼 처리하지 않기

관련 문서:
- `docs/architecture/phase-3-attendance-leave-scope.md`

### 4-3. 전자결재

반드시 지킬 것:
- self-approval 금지
- 내 기안함과 내 승인함 scope 분리
- reference/agreement 후보는 같은 회사 범위로 제한
- unknown document id 차단

관련 문서:
- `docs/architecture/phase-4-approvals-scope.md`

### 4-4. 게시판/문서

반드시 지킬 것:
- notice-only 게시판과 일반 게시판 책임 분리
- forged post id/read receipt target id 차단
- private 문서공간 접근 차단
- raw storage internals 비노출
- allowlist 와 max-size 제한 유지
- `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 는 같은 협업 묶음으로 보이더라도 게시판 전달 책임과 문서 보관 경계를 섞지 않기
- `/boards` 는 notice-only 공지와 일반 게시판을 같은 카드 목록 안에서 보여 주더라도, 일반 구성원 글쓰기 가능 여부와 운영 공지 작성 권한이 다르다는 점을 먼저 읽히게 유지하기
- `/boards/[boardId]` 는 `board_notice`, `board_general` 같은 대표 경로를 예시로 삼아 boardId 기반 정보구조와 권한 문구를 먼저 고정하고, 없는 boardId 도 실제 운영 게시판 생성처럼 보이게 설명하지 않기
- `/posts/[postId]` 는 bodyPreview 중심 상세, 댓글 영역, 읽음 확인 영역을 분리해 보여 주고 접근 불가 postId 는 UI/API 모두 403 경계 설명과 같은 뜻을 유지하기
- `/documents` 와 첨부 metadata 는 실제 운영 업로드/다운로드 완료처럼 보이지 않게 placeholder/dev-safe 제한을 분명히 남기기
- R2 연계는 private-by-default, D1 metadata 우선, binding-aware skeleton 기준까지만 다루고 raw `storageKey`, bucket 이름, public URL 을 응답/문서/UI 기본값으로 노출하지 않기
- `/documents` 는 전사 문서함과 인사 전용 문서함의 권한 차이를 먼저 보여 주고, fileName/contentType/fileSize/versionLabel 같은 metadata 설명이 raw storage 내부정보 노출 없이 이어지게 유지하기
- Phase 16 파일럿 확인 예시는 `/boards/board_notice`, `/boards/board_general`, `/posts/board_post_board_notice_employee_employee`, `/documents` 처럼 현재 저장소에 있는 대표 placeholder 경로 기준으로 적고, 없는 게시판/게시글이 실제 운영 생성된 것처럼 설명하지 않기
- live URL 파일럿 검토 기준에서는 협업 route 를 핵심 업무 흐름과 자연스럽게 이어 보이게 하되, production data/secret/DNS/유료 리소스/외부 연동이 아직 별도 승인 범위라는 점을 숨기지 않기
- live `.workers.dev` 직접 fetch 가 막히면 이를 확인 완료처럼 쓰지 말고, `pnpm check`, `pnpm --filter @gw/web build:cf`, targeted API/web test, local preview smoke 를 대체 근거로 분리해 적기

관련 문서:
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
- `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md`

### 4-5. 관리자 정책/감사

반드시 지킬 것:
- `/admin/*` 는 관리자 역할/권한 없으면 차단
- `/admin/users` 는 저장 화면이 아니라 역할 diff, 상태 변경 preview, 감사 candidate 를 먼저 검토하는 운영 화면으로 두고 `/employees` 일반 조회와 책임을 섞지 않는다.
- `/admin/policies` 의 current/candidate/capability/audit preview 는 `/attendance`, `/leave`, `/approvals`, `/employees` 에서 보이는 허용/차단/예외 설명과 같은 뜻을 가리켜야 한다.
- `/admin/audit-logs` 는 `audit.read` 기준 read-only 화면으로 유지하고 raw 감사 원문이나 운영 내부 candidate 를 일반 업무 화면에 퍼뜨리지 않는다.
- 일반 사용자 host 에서는 `/admin*` 를 그대로 렌더링하지 않고 숨김/redirect/차단 중 하나로 처리
- 관리자 role 이 일반 사용자 host 에서 `/admin*` 로 들어왔을 때 paired admin host 를 계산할 수 있으면 같은 경로의 admin host 로 redirect 하고, 계산할 수 없으면 allow 대신 `/forbidden` 또는 동급 차단으로 처리하기
- 관리자 host 분리를 하더라도 권한 체크를 host 판별로 대체하지 않기
- host 판별은 신뢰 가능한 `Host` 헤더와 승인된 admin host 후보만 기준으로 삼고, spoof 가능한 `x-forwarded-host` 값은 권한/host 경계 근거로 쓰지 않기
- production admin host 는 `GW_ADMIN_HOSTS` allowlist 에 들어간 host 만 인정하고, `admin.<domain>` 모양만으로 자동 승인하지 않기
- 관리자 host 에서는 `/` 를 `/admin` 으로 보내고, 일반 업무 route 는 그대로 렌더링하지 않고 `/admin` 으로 되돌리는 경계를 유지하기
- 관리자용 PWA manifest/start_url/scope 는 일반 사용자 앱과 정체성이 분리돼야 함
- 일반 사용자 host 는 `/manifest.webmanifest`, 관리자 host 는 `/admin/manifest.webmanifest` 를 same-origin 상대 경로 manifest 로 광고해야 하며 관리자 route 는 `name: GW Admin`, `start_url: /admin`, `scope: /admin` 을 유지해야 함
- 관리자 manifest 최소 필수값은 `name`, `short_name`, `description`, `id`, `start_url`, `scope`, `display`, `display_override`, `orientation`, `background_color`, `theme_color`, `lang`, `categories`, `shortcuts`, `icons(any/maskable)` 로 본다.
- 관리자 host 설치 안내는 `/admin` 시작점과 운영용 앱 맥락을 먼저 설명해야 하며, 일반 사용자용 근태/휴가 앱과 다른 앱이라는 점을 숨기지 않는다.
- 오프라인 안내는 관리자 상태 변경이 성공처럼 보이지 않게 하고, 가능한 일/막히는 일/재시도 절차를 분리해 설명해야 한다.
- 관리자 아이콘은 일반 사용자용과 파일명이 분리돼야 하며, 현재 placeholder 자산 상태를 문서와 UI 문구가 과장하지 않아야 한다.
- 관리자 install/status banner 는 설치 가능 여부를 과장하지 말고, 온라인일 때는 `/admin` 시작점과 same-origin 유지 원칙을 먼저 보여 주며 오프라인일 때는 `/offline` 안내로 바로 이어져야 한다.
- 모바일/관리자 PWA CTA 는 최소 48px 터치 높이 기준을 유지하고, 좁은 화면에서도 하단 탐색과 설치/오프라인 안내가 서로 의미를 흐리지 않게 둔다.
- 관리자 host 에서는 `/manifest.webmanifest`, `/offline`, `/login`, `/forbidden`, `/admin*` 만 우선 허용하고 그 밖의 일반 업무 route 는 관리자 앱 범위 밖으로 돌려보내기
- dashboard shortcut, admin hub 카드 노출, 직접 route 접근, API guard 가 서로 다른 접근 행렬을 갖지 않게 맞추기
- 접근 행렬의 단일 기준은 `packages/shared/src/admin-access.ts` shared helper 로 두고, Web/API/dashboard/admin hub 가 이 기준을 재사용하기
- 다른 회사 범위 운영 변경 candidate 차단
- 감사 로그는 masked preview 유지
- createdFrom/createdTo 같은 filter 는 validation/test 와 함께 유지

관련 문서:
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- `docs/architecture/admin-host-pwa-pass-1-scope.md`

## 5. UI/UX 행동 규칙

### 5-1. 홈/대시보드는 오늘 할 일을 먼저 보여 준다.

우선순위:
1. 지금 바로 해야 하는 액션
2. 승인/대기/예외 상태
3. 최근 기록 요약
4. 자주 가는 업무 진입점
5. 정책/안내/참고 링크

Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안에서 특히 유지/보강할 흐름:
- 홈(`/`)은 일반 업무 흐름과 관리자 검토 흐름을 "두 갈래"로 먼저 설명한다.
- 로그인(`/login`)은 실제 인증 성공을 약속하지 말고, 역할별 첫 이동 경로(`/dashboard`, `/approvals`, `/admin`, `/admin/audit-logs`)를 안내판처럼 보여 준다.
- 대시보드(`/dashboard`)는 `출퇴근 먼저 → 승인 대기 확인 → 공지/게시판 읽기 → 문서 공간 확인 → 조직/직원 확인` 순서의 상단 액션을 유지한다.
- 일반 업무 핵심 route 묶음은 `/dashboard` 다음에 `/attendance`, `/leave`, `/approvals`, `/employees`, `/org` 로 읽히게 유지한다.
- `/attendance` 와 `/leave` 는 현재 허용 결과만이 아니라 policy source 또는 미허용 이유를 최소 한 줄 이상 설명 가능해야 한다.
- 운영 연결형 blocked/empty/error 상태는 권한 부족, 회사 scope, 정책 미허용, placeholder 제한 중 무엇인지 구분해 적는다.
- `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 는 협업 보강 route 로 유지하되 실제 완성형 협업툴처럼 과장하지 않는다.
- `/documents` 와 첨부 metadata 흐름은 R2/파일 저장이 이미 완전 개방된 것처럼 보이면 안 되며, 업로드/다운로드 제한과 비노출 원칙을 같은 뜻으로 설명해야 한다.
- `/offline` 은 연결 문맥은 남기되 이번 Phase의 핵심 smoke 흐름보다 앞에 나오지 않게 둔다.

근거:
- `apps/web/app/page.tsx`
- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`

### 5-2. CTA 는 결정 직전에 둔다.

- 출퇴근 버튼은 마지막 기록 근처에 둔다.
- 승인/반려 버튼은 상태/영향 정보 뒤에 둔다.
- 글쓰기/업로드 버튼은 권한 있을 때만 분명하게 보인다.
- 관리자 CTA 는 일반 사용자 기본 흐름에 섞지 않고, 권한 있는 경우에만 `/admin` 또는 `/admin/audit-logs` 바로가기로 노출한다.

### 5-3. 모바일은 축소판이 아니라 우선순위 재정렬 버전이다.

- 넓은 화면은 왼쪽 사이드바
- 좁은 화면은 하단 탭
- 같은 route/IA 를 유지하고 탐색 껍데기만 바꾼다.
- 모바일 하단 탭 기본은 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개로 고정하고, `메뉴`에서 기본 업무/내 정보·조회/협업 placeholder 전체 메뉴 화면을 연다.
- 모바일 `홈` 은 회사가 고정하는 필수 핵심 메뉴와 사용자가 선택/정렬하는 개인 바로가기를 함께 다루는 구조로 적는다.
- `홈` 바로가기와 `메뉴` 전체 기능 선택 화면은 같은 기능 id/라벨/권한 registry 를 공유해야 한다.
- 필수 고정 메뉴는 사용자가 임의로 숨기지 못하거나, 최소한 회사 정책/관리자 설정으로 고정 여부를 통제할 수 있어야 한다.
- 사용자별 `홈` 커스터마이징 저장은 이번 Phase 24에서는 production DB 영구 저장이 아니라 dev-safe/local/profile skeleton 전제로 적는다.
- 넓은 화면 사이드바는 접기/펼치기가 가능해야 하며 모바일 전체 메뉴와 같은 메뉴군을 가리킨다.
- 관리자 기능은 모바일 하단 탭 기본 메뉴에 섞지 않는다.
- 호텔 위탁경영사 도메인 기준으로 `지점/호텔 코드` 단위를 독립 업무 범위로 보고, 일반 근무자 `지점 업무` 와 관리자 `지점 관리` 를 같은 메뉴군 안에서도 권한 기준으로 분리해 적는다.
- 지점 미배정 사용자는 `지점 배정 필요` 안내를 먼저 보고, 다른 지점 데이터는 UI/API 모두 차단한다고 적는다.
- Phase 22 실제 업무 흐름 통합 1차에서는 로그인, 대시보드, 출퇴근, 휴가, 결재함, 공지/문서, 내 정보, 조직도, 직원 목록과 관련 Web/API 흐름을 우선하되, 각 항목이 실제 하루 업무 순서 안에서 어떻게 이어지는지와 아직 skeleton/승인 필요 범위를 같이 적는다.
- `/dashboard` 상단 액션은 현재 구현 기준으로 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서를 먼저 설명하고, 그 뒤 `/org`·`/employees` 를 읽기 중심 마무리 조회 흐름으로 이어서 적는다.
- 실제 업무 흐름 설명은 "직원이 로그인 후 무엇을 먼저 하는가 / 대시보드 상단 액션과 실제 업무 화면 설명이 같은 순서인가 / 출퇴근·휴가·결재·공지/문서·내 정보·조직 확인 흐름이 끊기지 않는가 / mobile/PWA/Web 이 같은 contract 와 guardrail 을 가리키는가 / `/admin/*` 운영 화면이 일반 직원 흐름에 섞이지 않는가 / production data·secret·실연동이 승인 게이트로 남아 있는가" 6가지 질문으로 먼저 정리한다.
- 현재 활성 Phase 24에서는 위 직원 하루 흐름과 Phase 23 관리자 흐름을 실제 회사 파일럿 준비 시나리오로 다시 묶어 읽혀야 한다.
- 기준은 사용자 안내 → `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → 필요 시 `/org`·`/employees` → 운영자 동행 `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → 피드백 수집 순서다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토, `/boards`·`/documents` 협업/보관 흐름과 `/admin/policies` 권한·정책 검토, `/admin/audit-logs` read-only 감사 흐름을 서로 다른 책임으로 적는다.
- parent Phase 23의 live URL/release-gate success 는 baseline 근거로만 적고, 이번 Phase 24에서는 실제 재검증 완료처럼 과장하지 않는다.
- live route, same-origin `/api/health`·`/api/me`, PWA/mobile 확인은 파일럿 선행 체크리스트로 따로 적는다.
- Phase 24 파일럿 UX에서는 모바일 하단 탭 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개와 PC collapsible sidebar 가 같은 메뉴군을 가리키고, 관리자 메뉴는 일반 사용자 기본 탐색에 섞지 않는다.
- Phase 24 파일럿 UX에서는 모바일 `홈` 커스터마이징과 `지점/호텔 코드` 권한 구조를 문서 초안으로 먼저 고정하되, 실데이터/PMS 연동/영구 저장은 승인 게이트로 남긴다.
- 모바일 1차 상태 안내는 offline, error, empty, forbidden 4축을 먼저 통일하고, 정상 빈 상태와 실패 상태를 섞어 설명하지 않는다.
- `/boards` 와 `/documents` 는 모바일에서 협업 묶음 한 화면으로 시작할 수 있지만, 게시판 책임과 문서 보관 책임을 합쳐서 설명하지 않는다.
- `/me` 성격의 내 정보 화면은 세션/역할 요약과 로그아웃 안내 중심으로 두고, 관리자 운영 변경 화면으로 키우지 않는다.
- 모바일 세션 저장은 Web cookie 복제가 아니라 secure storage bridge 전제를 유지한다.

근거:
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

## 6. 문서/검증 행동 규칙

### 6-1. 루트 문서와 phase 문서가 서로 다른 말을 하면 안 된다.

수정할 때 같이 확인할 것:
- `DATA_MODEL.md`
- `API.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- 관련 `docs/architecture/phase-*.md`
- Phase 22 문서라면 `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md` 와 `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md` 의 기준 업무 순서, 상태 안내 4축, mobile/Web 계약 비교, `/admin/*` 분리, 승인 게이트 설명과 같은 뜻을 유지한다.
- Phase 23 문서라면 `docs/architecture/phase-23-admin-operations-console-real-usage-pass-1-scope.md` 와 `docs/guides/phase-23-admin-operations-console-real-usage-pass-1-handoff.md` 의 운영 콘솔 기준 순서, 일반 조회 대 운영 검토 경계, high-risk permission, 파일/문서/공지 권한 경계, 승인 게이트 설명과 같은 뜻을 유지한다.
- Phase 24 문서라면 `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md` 와 `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md` 의 파일럿 대상 범위, 직원 체험 레인 + 운영자 동행 레인, live/PWA/API/mobile 선행 체크리스트, 사용자 안내/운영자 매뉴얼/장애 대응, 승인 게이트 설명과 같은 뜻을 유지한다.

### 6-2. 코드 없이 문서만 바뀌어도 근거를 남긴다.

문서 작업에서도 아래는 같이 확인한다.
- 어떤 code/test/doc 를 근거로 문장을 썼는지
- 어떤 제한이 아직 남아 있는지
- 어떤 항목이 placeholder 인지
- 어떤 항목이 별도 승인 대상인지

### 6-3. 문서가 기능을 앞질러 약속하면 안 된다.

금지 예시:
- 아직 없는 endpoint 를 확정 문장으로 쓰기
- 운영 미연결 기능을 production-ready 처럼 쓰기
- 실제 개인정보 처리/외부 연동을 이미 된 것처럼 쓰기

### 6-4. Phase 22 문구는 "지금 따라가 볼 수 있는 업무 흐름 / 아직 skeleton / 승인 필요" 셋 중 하나로 읽혀야 한다.

특히 운영 전 정리 문서에서는 아래를 함께 맞춘다.
- `/login`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me`, `/org`, `/employees`, `/admin/users`, `/admin/policies` 는 지금 어떤 업무 흐름을 바로 따라가 볼 수 있는지 먼저 적는다.
- 실제 저장 완료, 승인 완료, 외부 배포, 실데이터 반영처럼 아직 안 된 일은 "아직 skeleton/preview" 로 분리한다.
- production DB, secret, DNS/custom domain, 유료 리소스, 외부 초대/실연동, GPS/실태그 단말, App Store/Play Console/TestFlight/EAS, push, 실기기 권한은 기능 TODO 가 아니라 "승인 필요" 목록으로 따로 남긴다.
- `/admin/*` 운영 화면은 일반 사용자 핵심 업무 흐름 설명 안에 섞지 않고, 관리자 확인 포인트로 따로 적는다.
- 대장이 실제 업무 흐름을 빠르게 볼 때는 `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees` 순서를 기본 확인 포인트로 삼고, `/admin/*` 는 마지막에 별도 운영 확인 포인트로 본다.
- live/PWA/API/mobile 확인 포인트를 따로 설명하더라도 최종 결론은 같은 회사 설정/readiness 언어로 모은다.

### 6-5. Phase 23 문구는 "일반 조회 / 운영 검토 / 승인 필요" 경계를 먼저 보여 줘야 한다.

- `/dashboard` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서가 실제 운영 준비 흐름처럼 읽혀야 한다.
- 빠른 확인 포인트도 같은 순서를 따라야 한다. 예: `/dashboard` 에서는 관리자 CTA 위치, `/admin` 에서는 오늘 먼저 볼 검토판, `/admin/users` 에서는 직원 조회 대 운영 변경 후보 경계, `/admin/policies` 에서는 current/candidate 비교, `/admin/audit-logs` 에서는 read-only 감사 의미를 먼저 확인한다.
- `/employees` 와 `/admin/users`, `/boards`·`/documents` 와 `/admin/policies` 의 책임을 섞지 않는다.
- `/employees`, `/boards`, `/documents` 는 계속 일반 조회/협업/보관 화면으로 설명하고, 실제 저장 전 운영 판단은 `/admin/*` 에서 따로 검토한다고 적는다.
- `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 는 실제 guard/test 가 있는 high-risk permission 이라는 점을 문서에서도 숨기지 않는다.
- `HR_ADMIN` 과 `AUDITOR` 가 같은 관리자처럼 뭉뚱그려 읽히지 않게, 감사 전용 사용자는 `/admin/audit-logs` 중심 흐름이라는 점을 함께 적는다.
- raw storage key, bucket 이름, public/signed URL 전문은 정책/감사 설명에서도 비노출 원칙을 유지한다.

### 6-6. Phase 24 문구는 "작게 시작할 파일럿 / 아직 안 되는 것 / 별도 승인" 경계를 먼저 보여 줘야 한다.

- 전사 오픈, 실데이터 투입, 실제 계정 대량 발급처럼 읽히는 문구를 피하고, 제한된 부서/사용자 대표 묶음부터 시작한다고 적는다.
- 직원 체험 레인과 운영자 동행 레인을 같은 시나리오로 보여 주되, 서로의 책임을 섞지 않는다.
- live URL, `/api/health`, `/api/me`, PWA/mobile 확인은 이번 Phase에서 다시 볼 항목으로 적고, parent Phase 23 baseline 근거를 이번 재검증 완료처럼 쓰지 않는다.
- 사용자 안내/운영자 매뉴얼/장애 대응/피드백 수집은 긴 설명보다 "오늘 해 볼 일 / 아직 안 되는 것 / 승인 필요 / 보고 방법"이 먼저 보이게 적는다.
- 모바일 `홈` 은 고정 필수 메뉴와 사용자 커스터마이징 가능한 메뉴를 함께 다루되, 실제 영구 저장은 dev-safe/local/profile skeleton 전제임을 분명히 적는다.
- `홈` 바로가기와 `메뉴` 전체 기능 선택 화면은 같은 기능 registry 를 공유하고, 필수 메뉴가 임의로 사라지지 않는 기준을 함께 적는다.
- `지점/호텔 코드` 구조는 호텔 위탁경영사 도메인 초안으로 적고, 본사 관리자 / 지점 관리자 / 일반 근무자 / 미배정 사용자의 가시 범위를 분리한다.
- `지점 배정 필요` 안내, 다른 지점 데이터 UI/API 차단, 지점 업무 대 지점 관리 분리를 파일럿 문서에서 같은 용어로 반복한다.
- production DB, secret, 실제 권한 저장, custom domain, 유료 리소스, 외부 연동은 파일럿 준비 문서 안에서도 계속 별도 승인 목록으로 남긴다.

## 7. 승인 없이 하면 안 되는 것

아래는 여전히 별도 승인 대상이다.
- secret 입력/교체
- production DB 실데이터 변경
- DNS/custom domain 변경
- 유료 리소스 생성·증액
- 실제 개인정보 원문 처리 확대
- 외부 HR/급여/노무 연동 확정
- production rollback/운영 데이터 삭제 같은 파괴적 작업

## 8. 제한적 재귀적 자기개선 기준

개발 중 반복 가능한 개선점이 발견되면 현재 카드 범위 안에서만 문서·테스트·QA·핸드오프를 보강한다.

허용:
- 기능 동작 기준이나 예외 처리 기준 보강
- 새 테스트 케이스 또는 검증 시나리오 기록
- 완료 전 체크리스트 보강
- 실패 원인과 다음 작업자 주의사항 기록

금지:
- 카드 범위 밖 코드 리팩토링
- 운영 DB/실데이터/secret/DNS/유료 리소스 변경
- 재귀적 자기개선을 이유로 한 배포/릴리즈/PR merge
- 다른 보드/repo/domain/mainbot 작업

필요한 경우 사용자 승인 필요 항목으로 분리한다.

## 9. 구현 전 확인 순서

1. 관련 phase 범위 문서 읽기
2. `packages/shared/src/contracts.ts` 의 schema 와 route 확인
3. 모바일 범위라면 `packages/shared/src/mobile-contracts.ts`, `apps/mobile/src/base-url.ts`, `apps/mobile/src/session-bridge.ts` 로 route/auth/session 경계 확인
4. `apps/api/src/app.ts` 또는 web page 구현 확인
5. `apps/api/test/*.spec.ts` 등 회귀 테스트 확인
6. 이 문서에서 guardrail 재확인
7. `TEST_PLAN.md` 와 `QA_CHECKLIST.md` 로 검증 기준 맞추기

## 10. 같이 봐야 하는 문서

- `DATA_MODEL.md`
- `API.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `ARCHITECTURE.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/workflow/groupware-kanban-automation.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-3-attendance-leave-scope.md`
- `docs/architecture/phase-4-approvals-scope.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/guides/phase-17-native-mobile-transition-prep-handoff.md`
- `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md`
- `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md`
- `docs/architecture/phase-19-native-mobile-internal-pilot-draft-scope.md`
- `docs/guides/phase-19-native-mobile-internal-pilot-draft-handoff.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- `docs/architecture/phase-11-org-employees-scope.md`
