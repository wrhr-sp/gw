# TEST_PLAN

## 문서 목적

이 문서는 "무슨 명령을 돌릴지" 뿐 아니라 "왜 그 검증을 다시 해야 하는지"를 함께 정리한 루트 테스트 기준 문서다.

핵심 원칙:
- 명령만 통과했다고 끝내지 않는다.
- 권한/회사 경계/placeholder 오해 방지까지 같이 본다.
- PR 전, merge 후, live smoke, 문서 일관성 확인을 서로 분리해 기록한다.

## Phase 44 추가 검증 초점

- 직원용 가이드가 `/login` 과 `/dashboard` 중심 기본 업무 흐름을 쉬운 말로 설명하는지 본다.
- 직원용/도입 체크리스트 문서가 로그인 전에는 로그인 화면만 보여야 한다는 기준과 비노출 route 목록을 분명히 적는지 본다.
- 관리자/담당자 가이드가 `/management` 와 `/payroll`·`/work-items/*`·`/admin/audit-logs` 책임 차이를 흐리지 않는지 본다.
- 운영자 runbook 이 사전 준비 / 도입 중 점검 / 도입 후 정리 3단계로 실제 따라가기 쉽게 정리되는지 확인한다.
- 권한표가 route guard, API guard, company+branch/self/restricted/read-only scope 와 충돌하지 않는지 본다.
- 도입 체크리스트가 Windows Chrome/Edge PWA 설치 확인 순서와 승인 게이트를 함께 적는지 본다.
- 도입 체크리스트가 승인 게이트를 빠뜨리지 않고, 실제로 지금 가능한 범위와 별도 승인 범위를 분리해 적는지 확인한다.

## Phase 44 현재 검증 근거

- 현재 기획 근거는 `apps/web/app/dashboard/page.tsx`, `apps/web/app/management/page.tsx`, `apps/web/app/payroll/page.tsx`, `apps/web/app/payroll/me/page.tsx`, `apps/web/app/work-items/work-items-config.ts`, `apps/web/app/admin/audit-logs/page.tsx`, `apps/web/middleware.ts`, `apps/web/admin-preview-guard.ts`, `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` 에 있다.
- 현재 구현 문서 세트는 `docs/guides/phase-44-employee-user-guide.md`, `docs/guides/phase-44-admin-manager-guide.md`, `docs/guides/phase-44-operator-runbook.md`, `docs/guides/phase-44-role-access-matrix.md`, `docs/guides/phase-44-adoption-checklist.md`, `docs/guides/phase-44-pc-mobile-login-only-entry-pwa-desktop-app-handoff.md` 다.
- 이번 Phase는 새 기능을 만드는 단계보다, 이미 있는 route/API/test 근거를 실제 도입 문서 묶음으로 다시 정렬하는 문서 단계다.
- 따라서 우선 검증 포인트는 새 happy path 추가보다도 직원 레인/민감 운영 레인 분리, 권한표 일치, approval gate 정합성이 문서와 같은 뜻인지 확인하는 데 둔다.
- 최신 tester 재검증 기준으로 `pnpm --filter @gw/api test -- auth-org.spec.ts work-items.spec.ts` 15 files / 98 passed / 4 skipped, `pnpm --filter @gw/web test -- admin-preview-guard.test.ts work-items.test.tsx dashboard-boundary.test.tsx payroll.test.tsx` 24 files / 100 passed, `pnpm --filter @gw/mobile typecheck`, `pnpm --filter @gw/web build` 가 모두 통과했다.
- local preview smoke 기준으로 익명 `/`, `/dashboard`, `/management`, `/payroll`, `/payroll/me`, `/work-items/labor`, `/admin/audit-logs` 는 `/login` 으로 redirect 되고, `/login` 200, `/api/health` 200, `/manifest.webmanifest` 200 이 확인된 상태다.

## 1. 기본 검증 명령

### 1-1. 저장소 공통 확인

```bash
pnpm check
```

왜 돌리나:
- workspace 전체 lint/type/test 흐름이 현재 기준에 맞는지 먼저 확인한다.
- 문서 작업 카드라도 현재 저장소가 이미 깨져 있지는 않은지 빠르게 본다.

### 1-2. shared contract 검증

```bash
pnpm --filter @gw/shared test
pnpm --filter @gw/shared typecheck
```

왜 돌리나:
- `packages/shared/src/contracts.ts` 의 route/schema 가 깨지지 않았는지 확인한다.
- 루트 문서가 설명한 응답 shape 와 실제 contract 가 어긋나지 않는지 보는 가장 빠른 기준이다.

### 1-3. API 검증

```bash
pnpm --filter @gw/api test
pnpm --filter @gw/api typecheck
```

왜 돌리나:
- placeholder route, 권한/회사 scope, validation error, self-approval guardrail, private 문서공간 차단 같은 회귀가 유지되는지 확인한다.

### 1-4. Web 검증

```bash
pnpm --filter @gw/web test
pnpm --filter @gw/web typecheck
pnpm --filter @gw/web build
```

왜 돌리나:
- PWA/route/UI skeleton 과 same-origin web 쪽이 최소한 현재 빌드 가능한지 확인한다.
- 문서에서 `/dashboard`, `/employees`, `/org`, `/admin/*` 같은 route 설명을 바꿨다면 실제 web 구조와 충돌하지 않는지 함께 본다.

Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안에서 특히 다시 볼 것:
- 홈(`/`)이 일반 업무 흐름과 관리자 검토 흐름을 둘 다 소개하는지
- 로그인(`/login`)이 역할별 첫 이동(`/dashboard`, `/approvals`, `/admin`, `/admin/audit-logs`)을 과장 없이 설명하는지
- 대시보드(`/dashboard`) 상단 액션 순서가 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 우선순위를 유지하고, 이후 `/org`·`/employees` 조회 마무리 흐름으로 자연스럽게 이어지는지
- 협업 검토는 `/boards/board_notice`, `/boards/board_general`, `/posts/board_post_board_general_employee_employee`, `/documents` 같은 현재 예시 경로로 다시 눌러 보며 문서 설명과 실제 route 톤이 같은지 확인하는지
- 일반 업무 route(`/attendance`, `/leave`, `/approvals`, `/org`, `/employees`) 설명이 dashboard 와 같은 언어를 쓰는지
- 협업 route(`/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents`)가 핵심 업무 흐름과 끊기지 않으면서도 실제 완성형 협업툴처럼 과장되지 않는지
- `/boards` 가 전사 공지(`board_notice`)와 자유 게시판(`board_general`)을 같은 화면에서 보여 주더라도 notice-only와 일반 작성 책임 차이를 먼저 설명하는지
- `/posts/[postId]` 가 bodyPreview 중심 상세, 댓글, 읽음 확인 CTA 를 분리해 보여 주고 댓글 preview 생성·읽음 확인 등록·forged 차단 확인이 같은 뜻으로 이어지는지
- `/documents` 가 전사 문서함 대 인사 전용 문서함, metadata 중심 설명, metadata preview 생성·문서 읽음 확인·private/missing space 차단 확인, raw storage key/bucket/public URL 비노출 원칙을 한 화면에서 숨기지 않는지
- live `.workers.dev` 직접 fetch 가 막히면 이를 미확인으로 남기고 `pnpm check`, `pnpm --filter @gw/web build:cf`, local preview smoke 같은 대체 근거를 별도로 기록하는지
- 관리자 CTA 가 일반 사용자 preview 기준 숨겨져 있고, 권한 기반 shortcut 으로만 열리는지
- 홈 shortcut 설명이 회사 공통 고정 항목과 권한 기반 사용자 전용 항목을 같은 뜻으로 가리키고, 아직 없는 편집/저장 UI를 완료품처럼 적지 않는지

### 1-5. Mobile skeleton 검증

```bash
pnpm --filter @gw/mobile typecheck
```

왜 돌리나:
- `apps/mobile` shell 이 Web/PWA와 공유하는 route/auth/session 계약을 깨지 않았는지 가장 빠르게 확인한다.
- `apps/mobile/src/base-url.ts`, `apps/mobile/src/session-bridge.ts`, `packages/shared/src/mobile-contracts.ts` 설명이 실제 타입과 어긋나지 않는지 본다.
- store build 없이도 Phase 22 성공 기준인 실제 하루 업무 흐름 연결, 상태 안내 4축, route/auth/session contract 경계와 승인 게이트 분리 기준을 재검증할 수 있다.

### 1-6. Phase 22 쉬운 실제 업무 흐름 판정 질문

문서/코드 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 직원이 로그인한 뒤 무엇을 먼저 하고 어디로 이어지는지 문서와 화면에서 바로 보이는가
2. `/dashboard` 상단 액션과 실제 각 업무 화면 설명이 같은 순서를 가리키는가
3. 출퇴근, 휴가, 결재, 공지/문서, 내 정보, 조직 확인 흐름이 서로 끊기지 않는가
4. mobile/PWA/Web 설명이 같은 route/auth/session contract 와 guardrail 을 가리키는가
5. empty/error/forbidden/offline 상태가 쉬운 사용자 언어로 정리돼도 의미가 섞이지 않는가
6. `/admin/*` 운영 화면과 production data·secret·실연동이 일반 직원 흐름 밖의 승인 게이트로 남아 있는가

이 6개 질문 중 하나라도 흐리면 Phase 22 문서 작업은 완료로 보지 않는다.

### 1-7. 대장이 실제로 눌러 볼 쉬운 확인 순서

문서 정합성을 볼 때는 아래 순서로 보면 가장 빠르다.

1. `/login`
   - placeholder 세션 기준 역할별 첫 이동 설명이 있는지 본다.
   - 실제 운영 로그인 완료처럼 과장하지 않았는지 같이 본다.
2. `/dashboard`
   - 상단 액션 순서가 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 우선순위를 유지하는지 본다.
   - 그 뒤 `/org`·`/employees` 조회 마무리 흐름이 끊기지 않는지, 일반 사용자 흐름과 관리자 운영 흐름이 섞이지 않는지 본다.
3. `/attendance` 와 `/leave`
   - 정책 안내, placeholder 제한, 권한/회사 scope/미허용 이유 설명이 있는지 본다.
   - 실제 운영 저장 성공처럼 읽히는 문구가 없는지 본다.
4. `/approvals`
   - 승인 lane 이 모든 사용자 기본 흐름처럼 쓰이지 않는지 본다.
   - self-approval 금지, 권한 경계 설명과 충돌하지 않는지 본다.
5. `/boards` 와 `/documents`
   - 협업 묶음으로는 설명하되 게시판 책임과 문서 보관 책임을 섞지 않는지 본다.
   - metadata/placeholder 단계가 실제 파일 운영 완료처럼 보이지 않는지 본다.
6. `/me`
   - `me` 조회 중심 설명과 `auth.logout`/session clear 안내가 과장 없이 적혀 있는지 본다.
7. `/org` 와 `/employees`
   - 회사 구조, 부서/직원 상태, 일반 조회 역할이 흐름의 마지막 확인 포인트로 읽히는지 본다.
   - 운영 변경 화면처럼 과장하지 않는지 본다.
8. `/admin/users`, `/admin/policies`, `/admin/audit-logs`
   - 직원 연결/역할 diff, 정책 source/candidate, 감사 read-only 경계가 분리돼 있는지 본다.
9. `/admin`
   - 관리자 확인 포인트가 일반 사용자 핵심 흐름과 분리돼 있는지 본다.
   - `audit.read` 같은 별도 capability 경계가 살아 있는지 본다.
10. 마지막으로 live/PWA/API/mobile 근거를 다시 모은다.
   - 각 축 설명이 달라도 최종 결론은 "지금 확인 가능 / 아직 skeleton / 승인 필요" 셋으로 모여야 한다.

### 1-8. Phase 23 쉬운 관리자 운영 콘솔 판정 질문

문서/코드 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 관리자가 `/dashboard` 에서 운영 콘솔로 어디서 들어가는지 바로 보이는가
2. `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서가 실제 운영 검토 흐름처럼 읽히는가
3. `/employees` 일반 조회와 `/admin/users` 운영 검토가 서로 다른 책임으로 보이는가
4. `/boards`·`/documents` 협업/보관 흐름과 `/admin/policies` 운영 정책 검토가 섞이지 않는가
5. `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 권한 경계가 문서와 코드에서 같은 뜻인가
6. production data·secret·실권한 저장·외부 연동·유료 리소스가 여전히 승인 게이트로 남아 있는가

이 6개 질문 중 하나라도 흐리면 Phase 23 문서 작업은 완료로 보지 않는다.

빠르게 눌러 볼 때는 아래처럼 본다.

1. `/dashboard` — 관리자 CTA 또는 감사 CTA 가 어디에 보이는지 확인한다.
2. `/admin` — 오늘 먼저 볼 운영 체크포인트와 승인 게이트가 먼저 읽히는지 본다.
3. `/admin/users` — `/employees` 와 다른 운영 변경 후보 검토 화면으로 읽히는지 본다.
4. `/admin/policies` — current/candidate/capability/audit preview 구조가 유지되는지 본다.
5. `/admin/audit-logs` — read-only 감사 추적, masked/company boundary/source 의미가 흔들리지 않는지 본다.

최근 Phase 23 재검증 기준 명령:

- `pnpm --filter @gw/web test -- --runInBand apps/web/dashboard-boundary.test.tsx apps/web/admin-console-pass1.test.tsx apps/web/admin-preview-guard.test.ts apps/web/org-employees-boundary.test.tsx`
- `pnpm --filter @gw/shared test -- contracts.spec.ts`
- `pnpm --filter @gw/api test -- --runInBand apps/api/test/auth-org.spec.ts`
- `pnpm --filter @gw/web typecheck`
- `pnpm check`
- `pnpm --filter @gw/web build:cf`

### 1-11. Phase 36 쉬운 운영자 설정·회사정책·권한관리 판정 질문

문서/코드 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 운영자 설정이 지금 shortcut 노출, `/management`, `/admin/users`, `/admin/audit-logs` 진입 경계로 바로 읽히는가
2. `/dashboard` 와 `/menu` 가 같은 shortcut 기준을 쓰고, 아직 없는 편집/저장 UI를 과장하지 않는가
3. `/employees` 일반 조회와 `/admin/users` 운영 검토가 같은 책임처럼 섞이지 않는가
4. `/admin/policies` 의 current/candidate 설명과 `/attendance`·`/leave` 의 결과 안내가 같은 뜻인가
5. role/permission 카탈로그 조회, 일반 조회 guard, 운영 diff preview 가 서로 다른 층으로 읽히는가
6. 실제 권한 저장, 외부 IdP/실메일, production 정책 저장이 계속 승인 게이트로 남아 있는가

이 6개 질문 중 하나라도 흐리면 Phase 36 문서 작업은 완료로 보지 않는다.

최근 Phase 36 parent 재검증 기준 명령:

- `pnpm --filter @gw/web test -- admin-console-pass1.test.tsx dashboard-boundary.test.tsx menu-page-content.test.tsx admin-users-dev-safe-action.test.ts org-employees-boundary.test.tsx admin-preview-guard.test.ts`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/shared typecheck`
- `pnpm --filter @gw/web build`
- `pnpm check`
- `pnpm --filter @gw/web build:cf`
- `BASE_URL=http://127.0.0.1:8790 bash scripts/gw-admin-host-preview-smoke.sh`

이 재검증으로 다시 확인할 경계:
- anonymous/general host 는 `/management`, `/admin*`, `/api/admin/users` 를 직접 열지 못한다.
- `COMPANY_ADMIN` 은 `/management`, `/admin/users`, `/admin/policies`, admin users API 를 읽을 수 있다.
- `HR_ADMIN` 은 users/policies 까지만 열고 audit route/API 는 열지 못한다.
- `AUDITOR` 는 `/admin/audit-logs` read-only 만 허용된다.
- `MANAGER`, `EMPLOYEE` 는 privileged shortcut 과 admin API 접근이 차단된다.

### 1-12. Phase 37 쉬운 내부 운영 저장흐름·감사 연결 판정 질문

최근 Phase 37 parent 재검증 기준 명령:

- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/web test -- admin-console-pass1.test.tsx phase34-real-usage.test.tsx work-items.test.tsx phase37-storage-boundaries.test.tsx`
- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/shared typecheck`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- `pnpm --filter @gw/web build:cf`
- `pnpm check`
- `BASE_URL=http://127.0.0.1:8791 bash scripts/gw-admin-host-preview-smoke.sh`

이번 재검증에서 문서에 다시 고정할 것:
- 8790 포트에 기존 workerd listener 가 떠 있으면 같은 build 산출물 기준 8791 같은 빈 포트로 옮겨 smoke 해도 된다. 다만 live 확인과 혼동하지 않게 포트 변경 이유를 같이 남긴다.
- `/documents`, `/management`, `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 는 local preview smoke 기준 다시 200 이어야 한다.
- raw `storageKey`, bucket, signed URL/public URL 비노출과 masked audit preview 경계는 `apps/api/test/auth-org.spec.ts` 근거와 같은 뜻으로 유지돼야 한다.

문서/코드 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. `/documents` 는 지금 외부 파일 공유 서비스가 아니라 upload/download 준비와 `storageStatus` 를 읽는 내부 문서 흐름으로 보이는가
2. `pending`·`ready`·`deleted` 같은 `storageStatus` 설명이 public download 완료 뜻처럼 과장되지 않는가
3. `/admin/audit-logs` 의 storage 흔적이 masked preview 와 `storageRef` 수준으로만 읽히고 raw `storageKey`·bucket·signed URL 이 새지 않는가
4. `/management`, `/payroll`, `work-items/*` 의 민감자료 설명이 metadata preview/review/approval gate 와 실원문 저장/실지급/실신고를 같은 말로 섞지 않는가
5. backup/export/migration/production bucket/secret/외부 반출이 아직 별도 승인 범위라는 점이 숨겨지지 않는가
6. production 데이터, secret, 실민감 원문 저장 확대, 외부 기관 제출이 계속 승인 게이트로 남아 있는가

이 6개 질문 중 하나라도 흐리면 Phase 37 문서 작업은 완료로 보지 않는다.

빠른 확인 순서:

1. `/documents`
2. `/admin/audit-logs`
3. `/management`
4. `/payroll`
5. `/work-items/tax`
6. `/work-items/labor`
7. `/work-items/legal`
8. `apps/api/test/auth-org.spec.ts`

### 1-13. Phase 38 쉬운 모바일·PC 현장 업무 사용성·알림·오프라인 판정 질문

최근 Phase 38 parent 재검증 기준 명령:

- `pnpm --filter @gw/web test -- admin-preview-guard.test.ts dashboard-boundary.test.tsx phase38-offline-admin.test.tsx`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- `pnpm check`
- `pnpm --filter @gw/web build:cf`
- `PREVIEW_PORT=8787 BASE_URL=http://127.0.0.1:8787 bash scripts/gw-admin-host-preview-smoke.sh`

이번 재검증에서 문서에 다시 고정할 것:
- 일반 host `/offline` 는 공용 복구 범위(`/dashboard`, `/menu`, `/notifications`, `/offline`)를 유지하고 `/admin/users` 를 섞지 않는다.
- admin host `/offline` 는 관리자 복구 범위(`/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/offline`)를 유지하고 일반 업무 route 를 섞지 않는다.
- 일반 host `/admin` 은 `/login`, admin host `/` 는 `/admin` 으로 redirect boundary 가 유지된다.
- 현재 범위에서는 web focused/full 테스트, root check, Next build, Cloudflare build, local preview admin-host smoke 기준 재현 blocker 가 없었다.

문서/코드 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. `/dashboard` 와 `/menu` 가 같은 홈 shortcut 기준과 정보구조를 가리키는가
2. 모바일 하단 탭 5개와 PC sidebar 가 같은 업무 그룹을 설명하고, `경영업무`·`/admin*` 운영 메뉴를 일반 홈과 섞지 않는가
3. `/notifications` 는 same-origin inbox/unread count 로 읽히되 외부 push/메일/SMS 발송 완료처럼 과장되지 않는가
4. `/offline` 안내와 status banner 가 가능한 일/막히는 일/재시도 절차를 나누고, 상태 변경을 가짜 성공처럼 보이게 하지 않는가
5. 일반 직원 홈 흐름과 운영자 검토 흐름(`/management`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`)이 같은 책임처럼 섞이지 않는가
6. 홈 편집 영구 저장, background sync, native 배포, production custom domain/app link, secret/실데이터가 계속 승인 게이트로 남아 있는가

이 6개 질문 중 하나라도 흐리면 Phase 38 문서 작업은 완료로 보지 않는다.

빠른 확인 순서:

1. `/dashboard`
2. `/menu`
3. `/notifications`
4. `/offline`
5. `/attendance`
6. `/leave`
7. `/approvals`
8. `/management`
9. `/admin/users`
10. `/admin/policies`
11. `/admin/audit-logs`

### 1-14. Phase 39 쉬운 운영 QA·보안·감사·권한 회귀 판정 질문

최근 Phase 39 parent 재검증 기준 명령:

- `pnpm --filter @gw/web test -- admin-preview-guard.test.ts phase38-offline-admin.test.tsx dashboard-boundary.test.tsx menu-page-content.test.tsx`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/shared typecheck`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- `pnpm check`
- `pnpm --filter @gw/web build:cf`
- `pnpm exec wrangler dev --ip 127.0.0.1 --port 8792 && PREVIEW_PORT=8792 BASE_URL=http://127.0.0.1:8792 bash scripts/gw-admin-host-preview-smoke.sh`

이번 재검증에서 문서에 다시 고정할 것:

- 일반 host `/admin` 은 `/login`, admin host `/` 는 `/admin` 으로 redirect boundary 가 유지된다.
- 일반 host `/offline` 와 admin host `/offline` 는 서로 다른 복구 범위를 유지하고, 운영 레인과 일반 레인을 섞지 않는다.
- `AUDITOR`/`HR_ADMIN`/`COMPANY_ADMIN`/`MANAGER`/`EMPLOYEE` 차이, foreign/self/company+branch scope 차단, raw storage internals 비노출은 `auth-org.spec.ts` 기준으로 다시 검증됐다.
- 현재 범위에서는 focused web/API 회귀, shared/api/web typecheck, Next build, Cloudflare build, root `pnpm check`, local admin-host preview smoke 기준 재현 blocker 가 없었다.

현재 Phase 39 기획에서 직접 다시 묶는 핵심 근거:

- `apps/web/admin-preview-guard.ts`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/phase38-offline-admin.test.tsx`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

문서/코드 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 일반 host 와 admin host 가 같은 복구/탐색 레인처럼 섞이지 않는가
2. `/management`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, 민감 work item 이 role/permission/company+branch scope 없이 열리지 않는가
3. `AUDITOR`, `HR_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `EMPLOYEE` 차이가 같은 관리자 묶음처럼 뭉개지지 않는가
4. forbidden/error/empty/offline 이 같은 실패 상태처럼 섞이지 않는가
5. audit detail 과 문서/첨부/민감자료 설명이 masked preview·metadata-only·read-only 경계를 유지하는가
6. 타 회사 employee id, foreign request id, self-approval, disallowed attendance method 가 403 또는 validation 으로 막히는가
7. external security 연동, production secret·실데이터, custom domain, native release, migration/destructive 작업이 계속 승인 게이트로 남는가

이 7개 질문 중 하나라도 흐리면 Phase 39 문서 작업은 완료로 보지 않는다.

빠른 확인 순서:

1. `/dashboard`
2. `/management`
3. `/admin`
4. `/admin/users`
5. `/admin/policies`
6. `/admin/audit-logs`
7. `/offline`
8. `/me`
9. `apps/web/admin-preview-guard.test.ts`
10. `apps/web/phase38-offline-admin.test.tsx`
11. `apps/api/test/auth-org.spec.ts`

### 1-15. Phase 40 내부 도입 리허설·관리자/직원 UAT 패키지 판정 질문

이번 Phase는 새 빌드 산출물보다 기존 route/test 근거를 내부 도입 리허설 패키지 언어로 다시 묶는 문서 단계다.

문서/코드 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 직원 레인(`/login` → `/uat` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`)과 경영업무/운영 레인(`/management`, `/admin*`)이 같은 시나리오처럼 섞이지 않는가
2. 승인자/팀장 레인, 경영업무 담당자 레인, 운영자/감사 레인이 각각 무엇을 확인하는지 따로 읽히는가
3. happy path, forbidden, empty, error, offline 을 UAT 기록표에 따로 적을 수 있는가
4. 권한 누출, foreign/self/company+branch scope 누출, raw 민감정보 노출을 blocker 또는 major 급 이슈로 분류하는 기준이 분명한가
5. `/payroll`, `/payroll/me`, `tax`, `labor`, `legal`, `/admin/audit-logs` 가 각각 preview/skeleton/read-only/승인 게이트 경계를 숨기지 않는가
6. final report 에 live URL(`https://gw-web.wereheresp.workers.dev`), 시작 route(`/uat`), 테스트 계정(`admin / 1234`), 역할별 시나리오, 남은 승인 게이트를 분리해 적을 수 있는가

이 6개 질문 중 하나라도 흐리면 Phase 40 문서 작업은 완료로 보지 않는다.

빠른 확인 순서:

1. `/login`
2. `/uat`
3. `/dashboard`
4. `/attendance`
5. `/leave`
6. `/approvals`
7. `/boards`
8. `/documents`
9. `/management`
10. `/payroll`
11. `/work-items/tax`
12. `/work-items/labor`
13. `/work-items/legal`
14. `/admin`
15. `/admin/users`
16. `/admin/policies`
17. `/admin/audit-logs`
18. `/offline`
19. `apps/web/phase40-uat-package.test.tsx`
20. `apps/web/admin-preview-guard.test.ts`
21. `apps/web/phase38-offline-admin.test.tsx`
22. `apps/api/test/auth-org.spec.ts`

### 1-16. Phase 41 게시판·공지·문서·결재 일상업무 도입완성 판정 질문

이번 Phase는 `/uat` 리허설 패키지 다음 단계로,
이미 있는 게시판/문서/결재 route 와 guard/test 근거를
직원이 매일 쓰는 협업 기본 업무 언어로 다시 묶는 문서 단계다.

문서/코드 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. `/dashboard` 가 `/approvals` → `/boards` → `/documents` 협업 흐름의 시작점처럼 읽히는가
2. 공지 게시판과 일반 게시판 책임 차이가 화면/문서/API/test 에서 같은 뜻으로 유지되는가
3. 게시글 상세에서 댓글 생성, 읽음 확인, forged post/read receipt 차단을 실제 도입 질문으로 적을 수 있는가
4. 문서함에서 public/private/missing space 차단, metadata-only, read receipt 경계가 분명한가
5. 전자결재에서 기안자 lane, 승인자 lane, 운영 정책 lane 이 서로 섞이지 않는가
6. self-approval 금지, replay 차단, unknown id 차단, 권한 부족 차단이 핵심 guardrail 로 분명한가
7. `/boards`·`/documents` 일반 협업 흐름과 `/admin/policies`·`/admin/audit-logs` 운영 검토 흐름이 같은 책임처럼 섞이지 않는가
8. rich editor 완성형, 외부 공유, 법적 효력 있는 전자서명, 실제 운영 발송, production 실데이터가 아직 승인 게이트라는 점이 숨겨지지 않는가

이 8개 질문 중 하나라도 흐리면 Phase 41 문서 작업은 완료로 보지 않는다.

빠른 확인 순서:

1. `/dashboard`
2. `/approvals`
3. `/boards`
4. `/boards/board_notice`
5. `/boards/board_general`
6. `/posts/board_post_board_general_employee_employee`
7. `/documents`
8. `/admin/policies`
9. `/admin/audit-logs`
10. `apps/web/app/_components/real-usage-panels.tsx`
11. `apps/api/test/auth-org.spec.ts`
12. `apps/api/test/phase32-regression-repro.spec.ts`
13. `apps/web/admin-preview-guard.test.ts`

### 1-17. Phase 42 근태·휴가·인사·지점 운영 도입완성 판정 질문

이번 Phase는 이미 있는 근태/휴가/직원/조직/지점 운영 route 와 guard/test 근거를
외부 연동 없는 내부 도입 가능한 운영 흐름 언어로 다시 묶는 문서 단계다.

문서/코드 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. `/dashboard` 가 `/attendance` → `/leave` 기본 흐름의 시작점처럼 읽히는가
2. 회사 정책에서 미허용한 출퇴근 등록 방식이 성공 UX 처럼 보이지 않는가
3. `/leave` 가 잔여 확인, 신청, 상태 조회 흐름을 자연스럽게 보여 주는가
4. `/employees` 일반 조회와 `/admin/users` 운영 검토 책임이 같은 화면처럼 섞이지 않는가
5. `/org` 가 부서/역할/권한/지점 scope 를 읽는 화면으로 설명되는가
6. `/work-items/branch` 가 `/management` 아래 branch scope 운영 레인으로 유지되는가
7. admin-only role 비노출, role-aware scope, validation error, 정책 우선순위가 화면/문서/API/test 에서 같은 뜻으로 유지되는가
8. 태그 단말, GPS, 외부 HR 연동, production 실데이터가 아직 승인 게이트라는 점이 숨겨지지 않는가

이 8개 질문 중 하나라도 흐리면 Phase 42 문서 작업은 완료로 보지 않는다.

빠른 확인 순서:

1. `/dashboard`
2. `/attendance`
3. `/leave`
4. `/employees`
5. `/org`
6. `/management`
7. `/work-items/branch`
8. `/admin/policies`
9. `/admin/audit-logs`
10. `apps/web/app/_components/phase34-live-sections.tsx`
11. `apps/api/test/auth-org.spec.ts`
12. `apps/web/admin-preview-guard.test.ts`

### 1-9. Phase 24 쉬운 회사 파일럿 운영 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 이번 파일럿은 전사 오픈이 아니라 어떤 작은 대표 부서/역할 묶음으로 시작하는가
2. 사용자 안내 → `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → 필요 시 `/org`·`/employees` → 운영자 동행 `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서가 실제 파일럿 준비 흐름처럼 읽히는가
3. live URL, `/api/health`, `/api/me`, PWA/mobile 확인 중 무엇이 baseline 근거이고 무엇이 이번 Phase 재검증 항목인지 구분되는가
4. 사용자 안내, 운영자 매뉴얼, 장애 대응, 피드백 수집 기준이 같은 언어로 묶여 있는가
5. 모바일 하단 탭 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개와 PC collapsible sidebar 가 같은 정보구조를 가리키고, 관리자 메뉴가 일반 사용자 메뉴와 섞이지 않는가
6. 모바일 `홈` 고정 필수 메뉴와 사용자 선택/정렬 가능한 메뉴가 구분돼 적히고, `메뉴`와 같은 기능 registry 를 공유한다는 점이 분명한가
7. `지점/호텔 코드` 구조에서 본사 관리자 / 지점 관리자 / 일반 근무자 / 미배정 사용자의 가시 범위와 `지점 배정 필요` 안내 기준이 분리되는가
8. 막힘이 권한 문제/placeholder 제한/운영 승인 대기/실제 버그 중 무엇인지 나눠 기록할 수 있는가
9. production data·secret·실권한 저장·실계정 대량 발급·외부 연동·유료 리소스가 여전히 승인 게이트로 남아 있는가

이 9개 질문 중 하나라도 흐리면 Phase 24 문서 작업은 완료로 보지 않는다.

빠르게 눌러 볼 때는 아래처럼 본다.

1. 사용자 안내 문서 — 오늘 해 볼 일, 아직 안 되는 것, 보고 방법이 먼저 보이는지 확인한다.
2. `/menu` 와 모바일 하단 탭 — `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개가 같은 파일럿 정보구조를 가리키고, `메뉴`에서 전체 기능 선택 화면이 열리는지 본다.
3. 모바일 `홈` — 고정 필수 메뉴와 사용자 선택/정렬 가능한 메뉴가 구분돼 보이고, `메뉴`와 같은 기능 registry 를 가리키는지 본다.
4. `/login` 과 `/dashboard` — 역할별 첫 행동과 다음 업무가 자연스럽게 이어지는지 본다.
5. `/attendance`, `/leave`, `/approvals` — 업무 처리와 정책/placeholder 제한 설명이 구분되는지 본다.
6. `/boards`, `/documents`, `/me`, 필요 시 `/org`, `/employees` — 협업/조회 흐름이 실제 운영 완료처럼 과장되지 않는지 본다.
7. `/messenger`, `/mail`, `/notifications` — placeholder honesty 와 외부 연동 승인 게이트가 분리돼 보이는지 본다.
8. `지점` 관련 안내 또는 문서 초안 — `지점 배정 필요`, 지점 업무 대 지점 관리, 본사/지점 관리자/일반 근무자 경계가 같은 언어로 적혀 있는지 본다.
9. `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 와 PC sidebar — 운영자 동행 레인과 read-only/권한 경계가 유지되는지 본다.
10. 마지막으로 live/API/PWA/mobile 체크리스트와 승인 필요 목록을 다시 모은다.

### 1-10. Phase 25 쉬운 공통 업무 엔진 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. HR·세무·노무·법무·지점 운영 업무를 어떤 공통 work item 구조로 담는지 바로 설명할 수 있는가
2. `module`, `status`, `assignee`, `dueAt`, `company/branch scope`, `reviewRequired`, `containsSensitiveData` 같은 공통 필드가 같은 언어로 정리돼 있는가
3. 상태값이 모듈마다 따로 늘어나지 않고 공통 흐름(`draft`/`todo`/`in_progress`/`waiting_review`/`blocked`/`done`/`archived`)으로 먼저 정리돼 있는가
4. 공통 문서, 첨부, 검토, 마감, 감사 로그 구조가 work item 과 어떤 관계인지 분명한가
5. 일반 근무자 / 지점 관리자 / 본사 관리자 / 감사 사용자의 가시 범위가 회사 + 지점 + 역할 + capability 기준으로 분리되는가
6. 모바일 하단 탭을 늘리지 않고 `홈`/`메뉴`와 PC sidebar 에 새 업무 그룹 자리를 확보하는 기준이 있는가
7. 민감 문서 원문, production DB 실데이터, 실제 세무/노무/법무 실처리, 외부 전문가 연동이 여전히 승인 게이트로 남아 있는가

이 7개 질문 중 하나라도 흐리면 Phase 25 문서 작업은 완료로 보지 않는다.

### 1-10-a. Phase 25 현재 구현 근거로 바로 대조할 테스트 파일

문서가 실제 구현보다 앞서 쓰이지 않았는지 빠르게 다시 볼 때는 아래 테스트를 먼저 본다.

- `apps/api/test/work-items.spec.ts`
  - 역할별 work item 목록 가시 범위
  - HR 민감 문서/첨부 접근 제한
  - `work_item.audit.read` 없는 상세 응답에서 audit log 비노출
  - visibility boundary 밖 상세 요청 403
  - deadline 목록의 역할별 가시 범위
- `apps/api/test/auth-org.spec.ts`
  - 로그인 세션 기준 `GET /api/work-items` 및 `?module=` 필터 동작
  - 지점 관리자 상세/첨부/마감 경계
  - review/documents/deadlines 응답 schema 연결
- `apps/web/work-items.test.tsx`
  - `/work-items` 허브, `/work-items/hr` 모듈 페이지, `/menu` 진입점이 같은 공통 엔진을 가리키는지 확인
- `apps/web/work-items-boundary.test.tsx`
  - 허브 copy 가 "공통 skeleton + guardrail" 경계를 유지하는지 확인
  - metadata-only, 외부 전송 비과장, 모듈 카드/API route 노출 기준 확인

빠른 판정 기준:
- 위 테스트가 지키는 경계와 문서 문장이 다르면 문서를 고친다.
- 반대로 문서가 더 넓게 약속하면 구현 완료처럼 쓰지 말고 skeleton/placeholder 로 낮춰 적는다.

### 1-10-b. Phase 26 쉬운 HR·미팅 관리 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. HR 미팅/면담/교육/온보딩이 기존 공통 `work item` 엔진 위에서 어떻게 읽히는지 바로 설명할 수 있는가
2. 공통 상태와 meeting 보조 상태(`schedule_status`)가 섞이지 않고 정리돼 있는가
3. 본사 HR / 지점 관리자 / 일반 직원 visibility 차이가 같은 권한 언어로 정리돼 있는가
4. 참석자/안건/메모/후속조치 구조가 metadata 중심으로 먼저 정리돼 있는가
5. 외부 캘린더/메일/메신저 연동과 실민감 원문 저장이 여전히 승인 게이트로 남아 있는가

이 5개 질문 중 하나라도 흐리면 Phase 26 문서 작업은 완료로 보지 않는다.

빠른 확인 순서:
1. `/work-items` 에서 공통 업무 허브와 API 골격(`/api/work-items`, `/api/work-item-deadlines`)이 같은 말로 적혀 있는지 본다.
2. `/work-items/hr` 에서 직원 lifecycle, meeting 유형, visibility 분리, 승인 게이트 문구가 바로 보이는지 본다.
3. `GET /api/work-items?module=hr` placeholder 응답에서 `category`, `scheduleStatus`, `confidentialityLevel`, `viewerScope` 설명이 읽히는지 본다.
4. `apps/api/test/work-items.spec.ts` 에서 grievance restricted 상세가 MANAGER 403 / HR_ADMIN 200 경계로 붙들려 있는지 본다.
5. `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx` 에서 허브/HR route copy 가 회귀 테스트로 고정돼 있는지 본다.

### 1-10-c. Phase 27 쉬운 노무 관리 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 노무 이슈가 기존 공통 `work item` 엔진 위에서 어떻게 읽히는지 바로 설명할 수 있는가
2. 공통 상태와 labor intake/review 보조 상태(`intake_status`)가 섞이지 않고 정리돼 있는가
3. 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 차이가 같은 권한 언어로 정리돼 있는가
4. 계약/연차/수당/고충/징계/사고/퇴사 범주와 evidence/review/follow-up 구조가 metadata 중심으로 먼저 정리돼 있는가
5. 실제 계약서/징계/사고 원문 저장과 외부 노무/급여 연동이 여전히 승인 게이트로 남아 있는가

이 5개 질문 중 하나라도 흐리면 Phase 27 문서 작업은 완료로 보지 않는다.

빠른 확인 순서:
1. `/work-items` 에서 공통 업무 허브와 API 골격(`/api/work-items`, `/api/work-item-deadlines`)이 같은 말로 적혀 있는지 본다.
2. `/work-items/labor` 에서 labor category, visibility 분리, 승인 게이트 문구가 바로 보이는지 본다.
3. `GET /api/work-items?module=labor` placeholder 응답에서 `category`, `intakeStatus`, `confidentialityLevel`, `viewerScope` 설명이 읽히는지 본다.
4. `apps/api/test/work-items.spec.ts` 에서 restricted labor 상세/목록 경계가 역할별로 붙들려 있는지 본다.
5. `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx` 에서 허브/labor route copy 가 회귀 테스트로 고정돼 있는지 본다.

### 1-10-d. Phase 28A 급여 foundation 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 급여가 `/work-items/labor` 안이 아니라 독립 `/payroll` 모듈로 읽히는가
2. 본사 급여 담당 / 지점 관리자 / 일반 직원 visibility 차이가 같은 권한 언어로 설명되는가
3. 급여 프로필, 급여 기간, 근태/휴가 input snapshot, 수당/공제 line item, payslip draft 구조가 같은 contract 언어로 묶였는가
4. `/payroll/me` 가 self-only 명세서 preview 로 읽히고 회사 전체 급여 조회처럼 과장되지 않는가
5. 실제 세액/4대보험 계산, 외부 급여/세무 연동, 지급 확정이 여전히 승인 게이트로 남는가
6. 월급제/시급제/일급제/연봉제/포괄임금제 지원 방향과 현재 placeholder 예시 범위가 구분돼 적혀 있는가
7. 포괄임금제에서 초과 검토 필요 경고와 부족분 자동 차감 비활성 원칙이 빠지지 않았는가

빠른 확인 순서:
1. `/payroll` 에서 독립 급여 허브와 role-split 안내가 보이는지 본다.
2. `/payroll/me` 에서 self-only 명세서 초안과 정정 안내가 보이는지 본다.
3. `GET /api/payroll` placeholder 응답에서 profile/period/review step 설명이 읽히는지 본다.
4. `GET /api/payroll/periods/payroll_period_2026_05` 에서 draft, input snapshot, line item, review step 이 함께 오는지 본다.
5. line item 에 `source`, `quantity`, `unitAmount`, `premiumRate`, `amount`, `note` 가 같이 남는지 본다.
6. `apps/api/test/auth-org.spec.ts` 에서 HQ overview 200, manager detail 403, employee self payslip 200 경계가 붙들려 있는지 본다.
7. `apps/web/payroll.test.tsx` 에서 독립 payroll 모듈, self-only 명세서, 승인 게이트 문구가 회귀 테스트로 붙들려 있는지 본다.

### 1-10-e. Phase 28 세무 관리 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 세무가 독립 신고 앱이 아니라 기존 공통 `work item` 기반 `tax` 모듈로 읽히는가
2. 공통 상태와 tax filing/evidence 보조 상태가 섞이지 않고 설명되는가
3. 본사 세무 담당 / 지점 관리자 / 감사 visibility 차이가 같은 권한 언어로 설명되는가
4. 부가세/원천세/지방세/법인세/증빙 수집/전달 패키지 범주가 하나의 제품 언어로 정리돼 있는가
5. 세무 자료 metadata 와 실원문/외부 제출이 구분돼 approval gate 원칙이 유지되는가
6. 급여 `payroll` 의 세액 placeholder 와 세무 `tax` 마감 준비가 같은 책임처럼 섞이지 않는가
7. `/work-items/tax` 와 공통 work item API 경로가 같은 확인 포인트를 가리키는가

빠른 확인 순서:
1. `/work-items` 에서 공통 업무 허브와 tax entry 가 같은 말로 적혀 있는지 본다.
2. `/work-items/tax` 에서 세무 category, role split, 승인 게이트 문구가 바로 보이는지 본다.
3. `GET /api/work-items?module=tax` placeholder 응답에서 `category`, `status`, `viewerScope`, `taxContext.branchRequests`, `taxContext.packagePreparation` 설명이 읽히는지 본다.
4. `GET /api/work-item-deadlines` 에서 세무 일정이 `monthly`/`quarterly`/`annual` 같은 주기로 읽히는지 본다.
5. `GET /api/work-items/:id/reviews` 에서 HQ 검토/반려/보완 요청이 내부 review 단계로 설명되는지 본다.
6. `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts` 에서 branch scope `work_item_tax_month_end_evidence`, company scope `work_item_tax_vat_package_preparation`, 감사 audit log 경계가 역할별로 붙들려 있는지 본다.
7. 가능하면 `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx` 에서 tax copy 와 공통 work item 허브가 회귀 테스트로 고정돼 있는지 본다.

### 1-10-f. Phase 29 법무 관리 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 법무가 독립 포털이 아니라 기존 공통 `work item` 기반 `legal` 모듈로 읽히는가
2. 공통 상태와 legal intake/renewal/dispute 보조 상태가 섞이지 않고 설명되는가
3. 본사 법무/운영 담당 / 지점 관리자 / 감사 visibility 차이가 같은 권한 언어로 설명되는가
4. 위탁운영/임대차/용역/협력사/개인정보처리위탁/분쟁/클레임/보험 범주가 하나의 제품 언어로 정리돼 있는가
5. 계약 metadata 와 실원문/외부 자문 연동이 구분돼 approval gate 원칙이 유지되는가
6. 노무/세무/급여 문맥과 법무 검토 책임이 같은 모듈처럼 섞이지 않는가
7. `/management` 와 `/work-items/legal` 가 민감 법무 진입점으로 같은 확인 포인트를 가리키는가

빠른 확인 순서:
1. `/work-items` 에서 공통 업무 허브에 법무가 빠지고, `/management` 분리 진입이 따로 안내되는지 본다.
2. `/management` 와 `/work-items/legal` 에서 법무 category, role split, 승인 게이트 문구가 바로 보이는지 본다.
3. `GET /api/work-items?module=legal` placeholder 응답에서 `category`, `status`, `viewerScope`, 계약 검토/갱신/분쟁 설명이 읽히는지 본다.
4. `GET /api/work-items/:id/reviews` 에서 내부 검토/보완 요청/승인 대기가 공통 review 단계로 설명되는지 본다.
5. `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts` 에서 company scope `work_item_legal_contract_review`, branch scope `work_item_legal_contract_renewal`, company scope `work_item_legal_dispute_intake`, legal audit/attachment 경계가 역할별로 붙들려 있는지 본다.
6. 가능하면 `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx`, `apps/web/dashboard-boundary.test.tsx`, `apps/web/admin-preview-guard.test.ts`, `apps/web/middleware.test.ts` 에서 legal 분리 copy, 경영업무 진입, route guard 가 회귀 테스트로 고정돼 있는지 본다.

### 1-10-g. 실사용 전환 1차 / Phase 31 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. `admin / 1234` 로 로그인해 `/dashboard` 와 `/management` 를 바로 따라가 볼 수 있는가
2. 익명 / 관리자 / 일반 직원 기준의 landing 과 forbidden 경계가 문서와 같은 뜻인가
3. `/admin/users` 와 `/api/admin/users` 를 기준으로 dev-safe 계정관리 흐름을 설명할 수 있는가
4. `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` 중 무엇이 지금 happy path 후보이고 무엇이 아직 skeleton 인지 분리돼 있는가
5. `경영업무` 허브와 민감 모듈 route 가 일반 직원 홈과 섞이지 않는가
6. production 기본 계정, 외부 인증, 실데이터 운영, 실지급/실신고 같은 금지 범위가 다시 분명히 남아 있는가

빠른 확인 순서:
1. `/login` — dev-safe UAT 계정 설명, production 금지 문구, 익명 진입 기준을 본다.
2. `/dashboard` — 일반 업무 홈과 관리자 CTA 분리를 본다.
3. `/management` — 경영업무 허브가 민감 모듈 진입점으로 읽히는지 본다.
4. `/admin/users` 와 `GET /api/admin/users` — 계정관리 진입과 권한 경계를 본다.
5. `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` — route 진입 가능 여부와 happy path 후보/placeholder 비중 설명을 본다.
6. `/work-items/legal` 또는 다른 민감 모듈 route — 일반 직원 차단과 관리자 허용이 같은 권한 언어인지 본다.
7. `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` 와 parent smoke 근거 — 익명 `/api/me` 401, 관리자 `/management` 200, 일반 직원 `/management` 307 `/forbidden`, 관리자 `/api/admin/users` 200, 일반 직원 `/api/admin/users` 403 이 실제로 붙들려 있는지 대조한다.

### 1-10-h. Phase 33 근태·휴가·전자결재 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. `/attendance`, `/leave`, `/approvals` 가 모두 "지금 눌러볼 수 있는 일반 업무" 로 먼저 읽히는가
2. 정책 미허용, 권한 부족, 회사 scope 차단, placeholder 제한이 같은 말로 뭉개지지 않는가
3. self-approval 금지와 unknown/forged id 차단이 휴가/전자결재 문맥에서 같은 guardrail 로 읽히는가
4. 출퇴근/GPS/실단말, 실급여/실정산, 실전자서명/법적 효력/원문 장기보관이 아직 승인 게이트라는 점이 분명한가
5. PostgreSQL 전환 전 상태와 이후 구현 목표를 한 문장으로 섞지 않았는가
6. `/admin/policies` 설명과 일반 업무 화면 설명이 같은 정책 언어를 가리키는가

빠른 확인 순서:
1. `/login` — dev/test/UAT 계정 설명과 production 금지 문구를 본다.
2. `/dashboard` — `/attendance` → `/leave` → `/approvals` 진입 순서가 앞쪽에 있는지 본다.
3. `/attendance` — 출퇴근 기록/허용 방식/정정 요청/정책 source 문맥을 본다.
4. `/leave` — 휴가 유형/잔여/신청 상태와 승인자 차단 문맥을 본다.
5. `/approvals` — 기안함/결재함, 승인/반려/보완 요청, self-approval 금지 문맥을 본다.
6. `/admin/policies` — 정책 source 와 일반 화면 설명이 같은 뜻인지 본다.
7. `apps/api/test/auth-org.spec.ts` — 권한, 회사 scope, self-approval, unknown/forged id 차단 근거가 실제로 붙들려 있는지 대조한다.

### 1-10-i. Phase 34 인사·지점·알림·감사 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. `/employees`, `/org` 가 모두 "지금 눌러볼 수 있는 일반 조회" 로 먼저 읽히고 `/admin/users` 같은 운영 화면과 섞이지 않는가
2. `/work-items/branch` 가 현재 지점 업무 진입점이라는 사실과 독립 `/branches` 미구현 상태가 같은 문서에서 정직하게 읽히는가
3. `/notifications` 가 same-origin inbox 실응답과 외부 발송 없음 경계를 함께 보여 주는가
4. `/admin/audit-logs` 가 `audit.read` 기준 read-only 감사 조회로 읽히고 관리자 전체 허용과 같은 뜻으로 보이지 않는가
5. employee/branch/company/audit 권한 경계와 placeholder 제한이 같은 말로 뭉개지지 않는가
6. employees/departments/roles/permissions read fallback, branch read/scope 근거, notifications same-origin inbox, audit read route 의 PostgreSQL 전환 상태를 한 문장으로 섞지 않았는가

빠른 확인 순서:
1. `/login` — dev/test/UAT 계정 설명과 production 금지 문구를 본다.
2. `/dashboard` — `/employees`·`/org`·`/work-items/branch`·`/admin/audit-logs` 흐름이 어디서 갈리는지 본다.
3. `/employees` — 일반 조회 카드, 관리자 경계 문구, employee directory 요약을 본다.
4. `/org` — 부서/역할/권한 읽기 전용 구조를 본다.
5. `/work-items/branch` — branch scope 업무 자리와 지점 일일 보고/마감 후속 문맥을 본다.
6. `/notifications` — unread count, inbox 카드, 외부 발송 없음 안내와 복귀 흐름을 본다.
7. `/admin/audit-logs` — 필터, masked detail, read-only company boundary 를 본다.
8. `apps/api/test/auth-org.spec.ts`, `apps/api/test/phase34-degraded-routes.spec.ts` — employee directory validation, branch manager/company scope 차단, notification/audit degraded fallback, `audit.read` 허용/차단 근거가 실제로 붙들려 있는지 대조한다.

### 1-10-j. Phase 35 급여·세무·노무·법무·컴플라이언스 판정 질문

문서/코드/운영 근거 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. `/management` 가 민감 관리자 허브로 먼저 읽히고, 일반 직원 홈과 같은 책임처럼 섞이지 않는가
2. `/payroll` 과 `/payroll/me` 가 preview/self-only 급여 흐름으로 읽히고, 실급여 운영 완료처럼 과장되지 않는가
3. `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 이 공통 `work item` skeleton 위의 관리자 모듈로 읽히고, 개별 완성 운영 시스템처럼 보이지 않는가
4. tax branch/company scope, labor restricted, legal visibility, `audit.read`/`work_item.audit.read` 경계가 같은 권한 언어로 읽히는가
5. dedicated compliance route 부재가 숨겨지지 않고, 현재 컴플라이언스 진입이 `/management` → `/admin/audit-logs` 라는 점이 분명한가
6. 실세액/실지급/외부 신고/외부 법무·노무 연동과 현재 관리자 UAT 범위를 한 문장으로 섞지 않았는가

빠른 확인 순서:
1. `/login` — dev/test/UAT 계정 설명과 production 금지 문구를 본다.
2. `/dashboard` — `/management` 진입선이 자연스러운지 본다.
3. `/management` — 급여·세무·노무·법무·감사 카드와 roleScope 를 본다.
4. `/payroll` — 급여 프로필/기간/명세서 초안 분리가 읽히는지 본다.
5. `/payroll/me` — self-only preview 와 placeholder 공제 문구를 본다.
6. `/work-items/tax` — 지점 제출/마감/HQ review skeleton 을 본다.
7. `/work-items/labor` — category/restricted/confidentiality 문맥을 본다.
8. `/work-items/legal` — 계약 검토/갱신/분쟁 placeholder 와 approval gate 문구를 본다.
9. `/admin/audit-logs` — 컴플라이언스/감사 read-only 경계를 본다.
10. `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` — payroll role split, self payslip, tax branch/company scope, labor restricted, legal visibility, audit 비노출/허용 근거가 실제로 붙들려 있는지 대조한다.

최근 Phase 35 재검증 기준 명령:
- `pnpm --filter @gw/api test -- --runInBand test/auth-org.spec.ts test/work-items.spec.ts test/operational-management-fallback.spec.ts test/phase35-operational-management-db.spec.ts test/zzz-phase35-review-check.spec.ts`
- `pnpm --filter @gw/web test -- payroll.test.tsx work-items.test.tsx zzz-phase35-review-guard.test.ts dashboard-boundary.test.tsx admin-preview-guard.test.ts`
- `pnpm --filter @gw/shared test && pnpm --filter @gw/shared typecheck && pnpm --filter @gw/api typecheck && pnpm --filter @gw/web typecheck && pnpm --filter @gw/web build && pnpm --filter @gw/web build:cf && pnpm check`
- local preview smoke: general host 기준 `COMPANY_ADMIN` 200 on `/dashboard`, `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs`; `MANAGER`/`EMPLOYEE` 는 민감 경로에서 forbidden 또는 차단 유지
- 해석 메모: Phase 35 수동 UAT 는 admin host root 가 아니라 일반 host `/dashboard` → `/management` 기준으로 시작하는 편이 정확하다.

## 2. Cloudflare/Web 배포 후보 검증

```bash
pnpm --filter @gw/web build:cf
```

왜 돌리나:
- Cloudflare 대상 빌드가 깨지지 않는지 본다.
- same-origin bridge, PWA, manifest, preview 배포 전 단계의 가장 중요한 정적 게이트다.

함께 볼 문서:
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `DEPLOYMENT.md`

### 2-1. Phase 16 local preview 대체 근거 메모

`pnpm --filter @gw/web preview:cf` 기본 경로가 세션 환경에서 불안정하면,
같은 build 산출물을 기준으로 아래처럼 대체 smoke 근거를 남길 수 있다.

```bash
cd apps/web
pnpm exec wrangler dev --port 8790 --ip 127.0.0.1
BASE_URL=http://127.0.0.1:8790 bash ../../scripts/gw-admin-host-preview-smoke.sh
```

왜 남기나:
- live `.workers.dev` 직접 fetch 가 막힌 세션에서도 build 결과와 route 경계를 완전히 공백으로 두지 않기 위해서다.
- 단, 이 결과는 live 확인 대체 근거일 뿐이고 live 직접 확인 완료로 쓰면 안 된다.

## 3. 자동화/운영 스크립트 검증

```bash
bash -n scripts/gw-hermes-env.sh
bash -n scripts/gw-review-required-gate.sh
bash -n scripts/gw-review-required-recovery-loop.sh
python3 -m py_compile scripts/gw-hourly-status-report.py
python3 -m unittest discover -s scripts/tests -p "test_*.py"
```

왜 돌리나:
- release/review-required/recovery watcher 관련 운영 안전장치가 문서와 다르게 망가지지 않았는지 본다.
- 문서에서 운영 흐름을 설명할 때, 실제 스크립트가 최소한 문법상/테스트상 살아 있는지 확인한다.

역할봇 판단루프 고도화 작업에서 추가로 볼 것:
- blocked 재판단 순서가 release cleanup → stale/superseded → review-required 재검증 → recovery loop → 승인 필요 순으로 유지되는지 확인한다.
- `already-handled` 로그가 나왔을 때 원본 카드와 생성 체인의 최신 상태를 다시 보는 기준이 있는지 확인한다.
- fixture/dry-run뿐 아니라 service active/status, journal sweep, board stats, blocked list, dispatch dry-run까지 운영 근거가 남는지 확인한다.
- 역할별 책임 경계가 결과에 같이 드러나는지 확인한다. 예: `gwdocs`는 보고양식/blocked 설명, `gwtester`는 실행 명령/보드 근거, `gwops`는 merge/release cleanup 근거를 남긴다.
- Telegram 보고정책 문서가 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 분리하는지 확인한다.
- blocked 분류가 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요로 설명돼 있는지 확인한다.
- 카드 댓글 완료와 사용자 직접 보고 완료를 다른 상태로 구분하는지 확인한다.
- singde 최종보고 카드라면 direct delivery 전 `사용자 보고 필요`, direct delivery 후 `사용자 보고 완료`와 `[singde-direct-delivery]` 코멘트가 남지 않으면 watcher가 재확인 코멘트를 남기는지 확인한다.
- singde 최종보고 parent 가 done 이고 다음 Phase 기획/DB 전환 child 가 scheduled 인 fixture 를 넣었을 때, worker recovery dry-run 이 `final-report-next-phase-auto-resume` 감지를 출력하고 수동 hold 표식이 있는 fixture 는 건너뛰는지 확인한다.
- 같은 카드·같은 이유·같은 근거에서 중복/스팸 보고를 막는 기준이 있는지 확인한다.
- scheduled 복구 카드 정리라면 예전 오류 재현 로그만 보지 말고, 최신 저장소에서 `pnpm check`, 관련 test/typecheck/build, 가능하면 `pnpm --filter @gw/web build:cf`, local `preview:cf` smoke 까지 다시 대조해 "지금도 살아 있는 일인지"를 확인한다.

검증자동화 표준 체크 묶음:
1. fixture 또는 카드 샘플로 release cleanup / stale / review-required / already-handled 분기를 재현한다.
2. dry-run 으로 실제 상태 변경 없이 어떤 분류가 나오는지 확인한다.
3. service active/status 또는 대체 가능한 process/journal 근거를 남긴다.
4. board stats, blocked list, dispatch dry-run 으로 현재 보드 상태를 함께 남긴다.
5. GitHub/merge/release cleanup 범위가 섞이면 PR head, merge 상태, main release-gate, remote branch 부재, diff/patch-id 동등성을 분리 확인한다.
6. 최종 결과에는 `자동화가 한 일 / 싱드가 직접 개입한 일 / 자동화가 못 끝낸 이유 / 보완한 자동화` 4축이 실제로 채워졌는지 본다.

## 4. 시나리오 기반 검증 축

아래 시나리오는 기능 변경 카드뿐 아니라 루트 문서 보강 카드에서도 "현재 설명이 코드와 맞는지" 확인할 때 같이 참고한다.

### 4-1. contract/type 축

확인할 것:
- `appRoutes` 가 문서의 endpoint 목록과 맞는가
- shared schema 이름과 설명이 실제 payload 와 맞는가
- placeholder 필드 존재 여부를 문서가 숨기지 않았는가
- `packages/shared/src/mobile-contracts.ts` 의 7개 모바일 1차 화면 mapping 이 `/login`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`·`/documents`, `/me` 설명과 같은가
- `/boards` 와 `/documents` alias 가 같은 협업 묶음 진입으로 설명되되 게시판 책임과 문서 보관 책임을 섞지 않는가

주요 근거:
- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`

### 4-2. 인증/권한 축

확인할 것:
- 무인증 접근은 401 `AUTH_REQUIRED`
- 권한 없는 접근은 403 `FORBIDDEN`
- `/admin/*` 는 일반 업무와 분리돼 있는가
- 관리자 접근 판단이 `roleCode` 이름만이 아니라 실제 permission/capability 기준과 같은 뜻으로 맞는가
- 일반 조회에서 관리자 전용 역할/기능이 과노출되지 않는가

대표 테스트:
- `apps/api/test/auth-org.spec.ts`

### 4-3. 회사 scope 축

확인할 것:
- 다른 회사 데이터/정책/운영 candidate 를 조회·변경하지 못하는가
- 같은 회사 후보만 참조/합의/정책 preview 에 포함되는가

대표 테스트:
- `apps/api/test/auth-org.spec.ts` 의 cross-company 차단 시나리오

### 4-4. placeholder guardrail 축

확인할 것:
- 출퇴근/휴가/결재/업로드가 실제 운영 완료처럼 보이지 않는가
- 게시판/문서/첨부 metadata 흐름이 실제 운영 협업 저장 완료처럼 보이지 않는가
- notices/placeholder 필드가 문서와 코드에서 일관되게 남아 있는가
- "아직 안 되는 것" 을 문서가 숨기지 않는가

근거 문서:
- `SPEC.md`
- `KNOWN_ISSUES.md`
- 각 `docs/architecture/phase-*.md`

### 4-5. self-approval / forged id / private resource 축

확인할 것:
- 자기 결재 자기승인 차단
- forged post/read-receipt/document id 차단
- private 문서공간 비권한 접근 차단
- unknown employee/request/document id 가 성공처럼 보이지 않는가

대표 테스트:
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/document-storage.spec.ts`

### 4-6. same-origin / PWA / build 축

확인할 것:
- API 기본 경로가 same-origin `/api/*` 설명과 맞는가
- manifest 경로와 `start_url` 설명이 맞는가
- 일반 사용자 앱이 로그인 단독 진입 정책을 따르면 `start_url: /login` 같은 시작점 설명과 테스트 근거가 맞는가
- 일반 사용자 host 와 관리자 host 의 manifest/start_url/scope 분리가 문서 기준과 맞는가
- 일반 사용자 host 에서 `/admin*` 가 그대로 렌더링되지 않는가
- `build:cf` 가 통과하는가
- `apps/mobile/src/base-url.ts` 가 production 에서는 approved origin 없이는 실패하고, preview/development 는 명시적 origin 또는 mock adapter 로만 풀리는가
- preview 절대 URL 이 모바일 기본값처럼 하드코딩되지 않았는가

대표 근거:
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md`
- `docs/architecture/phase-19-native-mobile-internal-pilot-draft-scope.md`
- web build/test 결과

### 4-7. 문서 일관성 축

확인할 것:
- `DATA_MODEL.md`, `API.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 가 서로 다른 말을 하지 않는가
- phase 문서 링크가 실제 범위를 잘 가리키는가
- skeleton/placeholder 제한이 루트 문서에서 빠지지 않았는가
- Phase 16 문서라면 `/` → `/login` → `/dashboard` → `/attendance`/`/leave`/`/approvals`/`/boards`/`/documents`/`/org`/`/employees` 와 권한 기반 `/admin/*` 흐름이 루트 문서와 handoff 문서에서 같은 순서로 읽히는가
- `/employees` 대 일반 조회와 `/admin/users` 운영 검토, `/attendance`/`/leave` 정책 안내와 `/admin/policies` 운영 정책 설명, `/boards`/`/documents` 협업 흐름과 운영 문서 보관 경계가 문서마다 같은 뜻인가
- Phase 22 문서라면 로그인 → 대시보드 → 출퇴근 → 휴가 → 결재 → 공지/문서 → 내 정보 → 조직/직원 확인 순서, offline/error/empty/forbidden 상태 분류, mobile/Web 계약 비교, `/admin/*` 분리, 승인 게이트 설명이 루트 문서와 handoff 문서에서 같은 뜻인가
- Phase 23 문서라면 `/dashboard` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서, 일반 조회 대 운영 검토 경계, high-risk permission(`invite.manage`, `audit.read`, `board.manage`, `document.space.manage`), 파일/문서 권한 비노출 원칙, 승인 게이트 설명이 루트 문서와 handoff 문서에서 같은 뜻인가
- Phase 24 문서라면 파일럿 대상 범위, 직원 체험 레인 + 운영자 동행 레인, live/API/PWA/mobile 선행 체크리스트, 사용자 안내/운영자 매뉴얼/장애 대응/피드백 수집, 승인 게이트 설명이 루트 문서와 handoff 문서에서 같은 뜻인가
- Phase 25 문서라면 공통 work item 모델, 문서/첨부/검토/마감 skeleton, 회사+지점+역할+capability 접근 기준, 모바일/PC 메뉴 자리, 승인 게이트 설명이 루트 문서와 handoff 문서에서 같은 뜻인가
- Phase 26 문서라면 직원 lifecycle, HR meeting category, 공통 상태 대 meeting 보조 상태 분리, 본사 HR/지점 관리자/일반 직원 visibility, metadata-only 메모, 승인 게이트 설명이 루트 문서와 handoff 문서에서 같은 뜻인가
- Phase 27 문서라면 labor category, 공통 상태 대 labor intake 보조 상태 분리, 본사 노무 담당/HR/지점 관리자/일반 직원 visibility, metadata-only evidence, 승인 게이트 설명이 루트 문서와 handoff 문서에서 같은 뜻인가

### 4-8. 역할봇 판단루프 / 운영 자동화 축

확인할 것:
- blocked 카드가 release cleanup → stale/superseded → review-required 재검증 → recovery loop → 승인 필요 순으로 재분류되는가
- `already-handled` 로그가 나와도 원본 카드와 생성 체인의 최신 상태를 다시 확인하는가
- fixture/dry-run 결과만이 아니라 service active/status, journal sweep, board stats, blocked list, dispatch dry-run 근거가 함께 남는가
- Telegram 보고 문서/결과가 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 분리하는가
- blocked 분류 문서/결과가 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요를 같은 뜻으로 쓰는가
- 카드 댓글 작성 완료와 사용자 직접 보고 완료를 분리 기록하는가
- 같은 카드·같은 이유·같은 근거의 반복 알림을 막는 기준이 있는가
- card-scoped `PR merge`/`release gate`/`branch cleanup` 정리가 검증 근거 없이 자동 실행되지 않는가
- restricted 항목이 운영 자동화 범위에 섞여 들어오지 않는가

대표 근거:
- `docs/architecture/rolebot-authority-decision-loop-hardening-scope.md`
- `docs/guides/rolebot-authority-decision-loop-hardening-handoff.md`
- `docs/guides/automation-hardening-review-gate-handoff.md`
- `docs/guides/scheduled-recovery-card-cleanup-report-2026-06-12.md`
- `RUNBOOK.md`
- 관련 Kanban 카드 comment/summary/metadata

scheduled 복구 카드 정리에서 우선 확인할 최신 근거 메모:
- 부모 카드 재검증 기준으로 `pnpm check`, `pnpm --filter @gw/web build:cf`, local `preview:cf` smoke 가 모두 통과했는지 본다.
- local `preview:cf` smoke 는 `/`, `/login`, `/boards`, `/documents`, `/manifest.webmanifest` 200 과 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 의 로그인 유도(307), `/api/health` 200 JSON, `/api/me` 401 JSON 같은 경계가 유지되는지 함께 기록한다.
- 위 최신 근거가 있으면 예전 scheduled reviewer/tester/singde 후속 카드는 단독 유지 이유가 약한지 다시 판단한다.

## 5. 모듈별 대표 회귀 포인트

### 인증/조직

다시 볼 포인트:
- 로그인 placeholder contract
- `/api/me` 무인증 차단
- 직원 목록 필터 validation
- 비관리자 일반 조회에서 admin-only 역할 비노출
- `/api/admin/users` 비관리자 차단

주요 테스트:
- `apps/api/test/auth-org.spec.ts`
- `packages/shared/test/contracts.spec.ts`

### 근태/휴가

다시 볼 포인트:
- check-in / check-out placeholder 응답
- 회사 정책에서 허용한 출퇴근 등록 방식(`mobile`, `pc`, `tag`)만 check-in / check-out 에서 통과하는지
- `company_default -> workplace -> department -> job_type` 우선순위 계산이 같은 순서로 동작하는지
- 각 단계가 union 병합이 아니라 전체 override 로 덮이는지
- 미허용 방식은 403, 잘못된 방식 값은 400 validation 으로 구분되는지
- `/admin/policies` preview 의 적용 인원/샘플 직원 정보가 설명용 preview 로만 보이고 실제 조직 데이터 저장/반영 UI 처럼 읽히지 않는지
- 실제 GPS/위치정보, 단말 연동, 외부 HR 연동 없이도 현재 테스트 범위가 유지되는지
- 근태 기록 조회와 정정 요청
- 휴가 유형/잔여/요청 조회
- 비승인자의 approve/reject 차단
- unknown employee/request id 차단

주요 테스트:
- `apps/api/test/auth-org.spec.ts`

### 전자결재

다시 볼 포인트:
- 양식/결재선 조회
- 문서 생성과 상세 조회
- 내 기안함/승인함 scope 분리
- reference/agreement 후보의 회사 범위
- self-approval 금지

주요 테스트:
- `apps/api/test/auth-org.spec.ts`

### 게시판/문서

다시 볼 포인트:
- 공지/게시판 목록과 접근 가능한 게시판 범위
- notice-only 게시판 쓰기 차단
- forged post id, forged read receipt target id 차단
- private 문서공간 접근 차단
- upload-init allowlist / max-size 제한
- download/delete placeholder action 의 raw storage 정보 비노출

주요 테스트:
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/document-storage.spec.ts`

### 네이티브 모바일 skeleton

다시 볼 포인트:
- `apps/mobile` 이 monorepo 안에서 `packages/shared` 계약만 재사용하고 Web 전용 렌더/PWA 책임을 억지로 끌어오지 않는지
- `apps/mobile/src/base-url.ts` 가 approved origin only / devOrigin / mock adapter 정책과 같은 뜻으로 동작하는지
- `apps/mobile/src/session-bridge.ts` 가 plain async storage, web-cookie-copy, query-string-token 금지 기준을 유지하는지
- 로그인/대시보드/출퇴근/휴가/결재함/공지·문서/내 정보 7개 화면이 placeholder 범위를 넘어서 완성 배포처럼 보이지 않는지
- offline/error/empty/forbidden 상태가 화면 설명과 code path 에서 같은 뜻으로 읽히는지
- `apps/mobile/src/workflow.ts` 가 일반 사용자 첫 액션을 `attendance`, 승인 lane 권한 사용자의 첫 액션을 `approvals` 로 나누는 현재 helper 기준과 같은 뜻인지
- 내 정보 화면 설명이 `me` 조회 중심 흐름과 온라인 `auth.logout`/로컬 `session clear` 안내 경계를 함께 숨기지 않는지
- `/admin/*` 운영 화면이 모바일 기본 탭으로 승격되지 않고 Web fallback 또는 후속 범위로 남는지

주요 테스트:
- `pnpm --filter @gw/mobile typecheck`
- `packages/shared/test/contracts.spec.ts`

### 관리자 정책/감사

다시 볼 포인트:
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 접근 행렬이 문서와 같은지
- `HR_ADMIN` 이 `/admin/audit-logs` 를 자동 허용받지 않고 `audit.read` 기준과 같은 뜻으로 정리됐는지
- `AUDITOR` 가 감사 로그 전용 흐름만 가지는지
- dashboard/admin hub 노출 조건과 직접 route 접근 기준이 같은지
- `adminScope`, `highRiskPermissions`, `capability` 설명이 contract/UI/API 에서 같은지
- `/admin/policies` 에 적용대상 level, 우선순위 안내, before/after diff, 적용 인원 preview 가 함께 보이는지
- 같은 target 중복 정책이 있으면 경고가 읽히는지
- candidate preview 의 masked/summary 정보가 과도 노출 없이 읽히는가
- 감사 로그 timeline/filter 가 validation 과 함께 유지되는가
- 운영 정책과 일반 업무 화면 책임이 섞이지 않는가
- document/board policy candidate 의 masked preview 유지
- cross-company policy candidate 차단
- audit log filter 와 masked metadata 유지

주요 테스트:
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/admin-console-pass1.test.tsx`
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/org-employees-boundary.test.tsx`
- `apps/api/test/auth-org.spec.ts`

### 관리자 host / PWA

다시 볼 포인트:
- host helper 가 preview/local/admin host 후보를 같은 기준으로 판별하는지
- production 모양의 host 라도 `GW_ADMIN_HOSTS` allowlist 에 없으면 admin host 로 오인하지 않는지
- host 판별이 `Host` 헤더만 신뢰하고 `x-forwarded-host` 로 spoof 되지 않는지
- 일반 사용자 host + `/admin*` 요청이 login/forbidden/admin-host redirect 중 문서 기준대로 처리되는지
- 관리자 role 이 일반 host 의 `/admin*` 로 들어왔는데 paired admin host 를 계산할 수 없을 때 allow 되지 않고 차단/forbidden 으로 남는지
- 관리자 host + `/` 요청이 `/admin` 으로 이어지는지
- 관리자 host + 일반 업무 route(`/dashboard`, `/employees` 등) 요청이 `/admin` 으로 되돌아가는지
- 관리자 host 에서 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 권한 경계가 유지되는지
- 일반 사용자 host 는 `/manifest.webmanifest`, 관리자 host 는 `/admin/manifest.webmanifest` 를 광고하고 각 route 가 올바른 manifest identity 를 주는지
- 관리자 host 로 `/manifest.webmanifest` 를 직접 열어도 일반 manifest 가 유지되고, 실제 설치 href 는 `/admin/manifest.webmanifest` 인지
- 관리자 install 안내 copy 가 `/admin` 시작점, 운영용 앱 맥락, same-origin 유지, native/push/background sync 미포함 상태를 숨기지 않는지
- 관리자 offline 안내가 사용자/권한 변경, 정책 적용, 감사 로그 최신성 제약을 성공처럼 포장하지 않는지
- 관리자 manifest 가 `name`, `short_name`, `description`, `id`, `start_url`, `scope`, `display`, `display_override`, `orientation`, `theme_color/background_color`, `lang`, `categories`, `shortcuts`, `icons(any/maskable)` 최소값을 유지하는지
- 관리자 아이콘이 일반 사용자용과 파일명으로 분리되고, placeholder 자산 상태를 문서/문구가 과장하지 않는지
- 온라인 상태 banner 가 install 안내 1~2단계를 보여 주고, 오프라인 전환 시 관리자용 banner title/body 와 `/offline` 링크로 바뀌는지
- 관리자 오프라인 페이지가 `availableNow`/`blockedNow`/`retrySteps` 와 설치 후 바로 확인할 관리자 화면(nav items)을 같은 기준으로 노출하는지
- 터치 CTA 최소 높이 48px, 가로 패딩 18px 기준이 config/test/document 에서 같은 뜻인지
- host 분리가 있어도 API 권한/회사 scope 검증이 약해지지 않는지

주요 테스트:
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/admin-host.test.ts`
- `apps/web/mobile-pwa.test.ts`

### 로그인 단독 진입 / 일반 사용자 PWA

다시 볼 포인트:
- PC와 모바일 첫 진입이 `/login` 단독 화면으로 유지되는지
- 로그인 전 `/`, `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/notifications`, `/management`, `/admin*` 가 내부 기능처럼 보이지 않는지
- `apps/web/app/login/login-form.tsx` 에 role preview selector, landing 미리 설명, 과한 dev-safe CTA 가 기본 UI처럼 남지 않았는지
- 자동 로그인 설명이 비밀번호 저장이 아니라 세션 유지 선택이라는 뜻을 유지하는지
- 일반 사용자 manifest 의 `start_url`, install copy, desktop launch 경로가 로그인 단독 진입 정책과 같은 뜻인지
- Windows Chrome/Edge 기준 설치 메뉴 노출 또는 installability 확인 가능 여부를 실제 근거로 남겼는지
- 설치 후 실행 시 세션이 없으면 `/login` 부터 시작하는지

주요 테스트:
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/mobile-pwa.test.ts`
- `apps/web/middleware.test.ts`
- local `preview:cf` 또는 동등 smoke 에서 `/login`, `/`, `/dashboard`, `/admin`, `/manifest.webmanifest` 확인 기록

현재 재검증 메모(부모 카드 기준):
- 부모 카드 검증 기준으로 `pnpm --filter @gw/shared test -- contracts.spec.ts`, `pnpm --filter @gw/api test -- auth-org.spec.ts`, `pnpm --filter @gw/web test -- admin-console-pass1 admin-preview-guard dashboard-boundary middleware`, `pnpm check`, `pnpm --filter @gw/web build:cf`, `bash scripts/gw-cloudflare-check.sh`, local `preview:cf` smoke 까지 통과했고, PR #39 merge commit `c14bb65` 와 main push `release-gate` run `27398275720` 의 `cloudflare-build`/`cloudflare-deploy` 성공까지 확인됐다.
- `bash scripts/gw-cloudflare-check.sh`, `pnpm --filter @gw/web typecheck`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf` 는 통과 근거가 있다.
- 이번 후속 체인에서는 `pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa`, `pnpm check` 까지 다시 통과시키는 것을 우선 목표로 둔다.
- 일반 host fallback 은 우선 `apps/web/admin-preview-guard.test.ts` 로 잠갔다. paired admin host 를 계산하지 못한 admin role 요청과 spoofed admin-looking host 요청이 모두 `/forbidden` 으로 차단되는지 계속 회귀 확인한다.
- 2026-06-12 재검증 1차: `pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa` 실행 결과 8개 파일, 43개 테스트 통과.
- `apps/web/mobile-pwa.test.ts` 는 일반 manifest 검증 시 실제 브라우저가 받는 구현 경로인 `apps/web/app/manifest.ts` 를 기준으로 본다. 단순히 별도 `route.ts` 의 `GET()` 만 import 해서 같다고 보는 테스트는 false positive 를 만들 수 있으므로 금지한다.
- `apps/web/mobile-pwa.test.ts` 는 관리자 manifest 의 `id`, `display_override`, `shortcuts`, admin icon 경로, install/offline guide, `touchTargetStyle`(48px/18px)까지 같이 회귀 보호한다.
- local `preview:cf` smoke 는 `set -a; . .secrets/cloudflare.env; set +a; pnpm --filter @gw/web preview:cf` 실행 후 별도 터미널에서 `bash scripts/gw-admin-host-preview-smoke.sh` 로 `/manifest.webmanifest`, `/admin/manifest.webmanifest`, general/admin host HTML manifest href, `/admin`, `/`(manual/follow redirect) 를 확인하는 절차로 고정한다.
- 설치 품질 후속에서는 위 preview smoke 에 더해 브라우저 수동 확인으로 설치 메뉴 노출 여부, manifest 패널 핵심값, 관리자 install/offline copy 를 함께 기록하는 것을 권장한다.
- Lighthouse 는 필수 자동화 게이트가 아니라 수동 보조 근거로 우선 사용하고, 확인했다면 어떤 PWA 관련 항목을 봤는지 메모를 남긴다.
- live `.workers.dev` fetch 가 막히면 local `preview:cf` smoke, deployment metadata, 상위 live smoke 메모를 substitute evidence 로 남긴다.

## 2026-06-12 Phase 15 운영 데이터·정책·감사 로그 연결 1차 검증 계획

목표:
- 관리자 정책/권한/감사 preview 가 일반 업무 화면과 API 허용 결과에 왜 그렇게 이어지는지 같은 뜻으로 검증한다.
- blocked/empty/error 상태를 권한 부족, 회사 scope, 정책 미허용, placeholder 제한 4축으로 구분해 확인한다.
- `/attendance` 뿐 아니라 `/leave` 도 운영 정책 연결 보강 대상으로 포함한다.

우선 검증 route:
- `/`
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/employees`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`

우선 검증 API:
- `GET /api/admin/policies/attendance`
- `GET /api/admin/policies/leave`
- `GET /api/admin/users`
- `GET /api/admin/audit-logs`
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/leave/types`
- `GET /api/leave/requests`
- `POST /api/leave/requests`
- `GET/POST /api/approvals/documents`

역할별 핵심 체크:
- 일반 직원: `/attendance` 와 관련 API가 같은 허용/차단 이유를 설명하는지, `/leave` 가 정책 연결 없는 독립 placeholder 처럼 보이지 않는지 확인
- 팀장/결재자: `/approvals` 에서 승인 권한 부족과 정책상 미허용이 다른 이유로 읽히는지 확인
- 인사/운영 관리자: `/admin/users` preview 와 `/dashboard`/`/employees`/`/approvals` 노출이 같은 뜻인지, `/admin/policies` 와 `/attendance`/`/leave` 정책 안내가 같은 방향인지 확인
- 감사 전용 사용자: `/admin/audit-logs` 가 `audit.read` 기준과 masked/company boundary 원칙을 유지하는지 확인

문서 근거 파일:
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-skeleton-config.ts`
- `packages/shared/src/admin-access.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

명령 기준:
- `pnpm check`
- 필요 범위별 `pnpm --filter @gw/shared test typecheck`
- 필요 범위별 `pnpm --filter @gw/api test typecheck`
- 필요 범위별 `pnpm --filter @gw/web test typecheck build`
- Cloudflare 관련 변경이 있으면 `pnpm --filter @gw/web build:cf`

수동 확인 포인트:
- 일반 사용자에게 관리자 CTA, raw 감사 정보, 운영 내부 candidate 가 새지 않는지
- 화면 안내 문구와 API 에러/forbidden 이유가 서로 다른 말을 하지 않는지
- skeleton/dev-safe/placeholder 문구가 빠지지 않는지

대장이 preview/live URL 에서 빠르게 볼 순서:
1. `/dashboard` 에서 일반 업무 요약과 관리자 경계 안내가 같이 읽히는지 본다.
2. `/attendance` 에서 허용 방식, `effective policy`, offline 재시도 안내가 같이 보이는지 본다.
3. `/leave` 에서 권한 부족/회사 scope/정책상 미허용/placeholder 제한 4축 메모가 살아 있는지 본다.
4. `/employees` 와 `/admin/users` 를 비교해 일반 조회와 운영 검토가 서로 다른 책임으로 읽히는지 본다.
5. `/admin/policies` 와 `/admin/audit-logs` 에서 candidate/reason/audit preview 가 read-only 운영 검토 톤으로 유지되는지 본다.

## 6. PR 전 확인

최소 기준:
- `pnpm check`
- 필요한 범위의 package test/typecheck/build
- 문서 링크/설명과 코드/테스트가 모순되지 않는지 확인

문서 카드에서도 남길 것:
- 어떤 파일을 근거로 문장을 수정했는지
- 직접 실행한 명령
- 아직 실행 못 한 검증이 있다면 왜 못 했는지

## 7. main merge 후 release gate 확인

확인할 것:
- GitHub PR 최신 head 기준 check 통과
- main push 후 `release-gate` 실행 결과
- Cloudflare build/deploy 단계 성공 여부

대표 확인 예시:
- PR checks 결과
- `release-gate` run id
- `cloudflare-build`, `cloudflare-deploy` 상태

실무 메모:
- CI 가 없거나 일부 확인이 로컬 대체 증거여야 하면 그 사실을 같이 남긴다.

## 8. live smoke 또는 대체 근거 남기기

기본 smoke route:
- `/`
- `/login`
- `/dashboard`
- `/attendance`
- `/approvals`
- `/employees`
- `/org`
- `/admin` 또는 `/admin/audit-logs` 권한 경계 확인
- `/manifest.webmanifest`

live 확인이 가능할 때:
- status code 또는 기본 응답 확인
- latest deployment/run 과 함께 기록

live fetch 가 환경상 막힐 때 대체 근거:
- `pnpm --filter @gw/web build:cf`
- 관련 로컬 test/build 결과
- `release-gate` 또는 Cloudflare deploy metadata
- same-origin/PWA 관련 문서와 code path 재확인 결과

중요:
- live 확인을 못 했는데 했다고 쓰면 안 된다.
- 대신 무엇으로 대체 확인했는지 분명히 적는다.

## 9. 문서 작업 카드에서 추가로 확인할 것

문서 변경이어도 아래를 같이 본다.
- 링크가 실제 파일을 가리키는가
- 루트 문서 5종이 서로 모순되지 않는가
- placeholder / skeleton / 승인 필요 항목이 빠지지 않는가
- `RUNBOOK.md`, `DEPLOYMENT.md`, `KNOWN_ISSUES.md`, `ARCHITECTURE.md` 와 충돌이 생기지 않는가
- 대장이 preview/live URL 에서 어떤 순서로 눌러 봐야 하는지 쉬운 한국어 체크포인트가 남아 있는가

## 10. 검증 결과를 남기는 형식

가능하면 아래 순서로 남긴다.
- 실행한 명령
- 통과/실패 결과
- 확인한 guardrail
- 못 한 검증과 이유
- live 대체 근거가 있으면 그 근거

예시:
- `pnpm check` 통과
- `pnpm --filter @gw/web build:cf` 통과
- 문서 링크 수동 확인: 루트 문서가 실제 phase 문서를 가리킴
- 미실행: live fetch 직접 확인은 이번 실행 환경에서 생략, release-gate metadata 로 대체

## 11. 재귀적 자기개선 검증 기록

작업 중 반복 가능한 개선점이 발견되면 테스트 결과와 함께 아래를 남긴다.

- 실패/실수 원인: 어떤 테스트, 문서 누락, handoff 누락 때문에 문제가 생겼는가
- 반영 문서: `AGENTS.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md` 중 어디에 반영했는가
- 다음 카드에서 방지되는 문제: 같은 실수나 검증 누락을 어떻게 줄이는가
- 미반영 사유: 카드 범위 밖이거나 승인 필요 항목이면 왜 반영하지 않았는가

금지: 이 기록을 이유로 배포, PR merge, 운영 DB, secret, DNS, 유료 리소스, 다른 보드 작업을 자동 수행하지 않는다.

## 12. 같이 봐야 하는 문서

- `DATA_MODEL.md`
- `API.md`
- `SPEC.md`
- `QA_CHECKLIST.md`
- `DEPLOYMENT.md`
- `RUNBOOK.md`
- `KNOWN_ISSUES.md`
- `docs/workflow/groupware-kanban-automation.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
