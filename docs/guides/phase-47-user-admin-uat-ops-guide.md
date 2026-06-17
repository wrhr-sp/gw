# Phase 47 사용자·관리자 가이드 + UAT 절차 + 운영 체크리스트

## 한 줄 요약
이번 Phase 47에서는 `/login` → `/dashboard` → `/menu` → `/notifications` → `/offline` 흐름을 먼저 보고,
일반 직원 홈과 운영 관리자 레인(`/management`, `/admin/users`, `/admin/audit-logs`)이 섞이지 않는지,
모바일/PWA에서도 같은 정보구조와 같은 상태 문장을 쓰는지 확인하면 된다.

## 이 문서가 다루는 범위
- 일반 직원/팀장 사용 가이드
- 관리자/담당자 확인 순서
- UAT 진행 절차
- 운영자 최종 체크리스트
- 아직 남아 있는 승인 게이트

이 문서는 새 외부 연동을 여는 문서가 아니다.
지금 이미 있는 홈/메뉴/알림/오프라인/운영 레인을
"회사 전체 사용 직전에 어디가 안정적이고 어디가 아직 제한인지"
쉽게 다시 읽게 만드는 문서다.

## 먼저 기억할 7가지
1. 익명 시작점은 계속 `/login` 뿐이다.
2. COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 로그인 직후 공통 landing 은 `/dashboard` 다.
3. AUDITOR 의 로그인 직후 landing 은 `/admin/audit-logs` 다.
4. 일반 직원 홈은 `/dashboard` 이고, `경영업무`(`/management`) 와 `/admin*` 는 별도 운영 레인이다.
5. 모바일 하단 탭 5개(`메뉴`·`홈`·`메신저`·`메일`·`알림`)와 PC sidebar 는 같은 정보구조를 가리킨다.
6. `/offline` 은 업무 성공 화면이 아니라 가능한 일 / 막히는 일 / 재시도 절차를 알려 주는 복구 안내다.
7. `admin / 1234` 는 dev/test/UAT 전용 테스트 계정이며 production 기본 계정이 아니다.

## 접속 정보와 현재 근거
- Phase 47 parent 최종 통합 보고 기준 live URL 기록: `https://gw-web.werehere31.workers.dev`
- 별도 운영 문서(`README.md`, `DEPLOYMENT.md`, cloudflare-first 가이드)에는 현재 preview URL 을 `https://gw-web.wereheresp.workers.dev` 로 적고, `werehere31` 주소는 과거 주소/HTTP 404 기록으로 설명한 구간이 있다.
- 테스트 계정: `admin / 1234`
- parent 기준 검증: focused web 24 files / 102 passed, focused API 15 files / 98 passed / 4 skipped, `pnpm --filter @gw/mobile typecheck`, `pnpm --filter @gw/web build`
- local preview smoke 기준 익명 내부 route redirect, `/login` 200, `/api/health` 200, `/manifest.webmanifest` 200 근거가 있다.

중요:
- 이 작업에서는 live URL 자체를 다시 fetch 하거나 재검증하지 않았다.
- 따라서 사용자-facing 최종 보고 전에는 운영자가 최신 실제 접속 URL 을 다시 확인해야 한다.
- 이번 문서에서는 live 직접 재확인 근거와 local preview/build/test 대체 근거를 같은 뜻으로 섞지 않는다.

## 1. 일반 직원 / 팀장이 먼저 따라갈 사용 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/menu`
4. `/notifications`
5. `/attendance`
6. `/leave`
7. `/approvals`
8. `/boards`
9. `/documents`
10. `/me`

### 각 화면을 어떻게 읽으면 되는가

#### `/login`
- 로그인 전용 입구다.
- 로그인 전에는 `/dashboard`, `/menu`, `/notifications`, `/management`, `/admin*` 가 먼저 보이면 안 된다.
- 모바일에서도 하단 탭이나 업무 메뉴가 먼저 보이면 안 된다.

#### `/dashboard`
- 홈이다.
- 오늘 먼저 할 일과 자주 가는 바로가기를 보는 화면이다.
- 권한 있는 사용자만 운영 CTA 를 추가로 본다.
- 일반 직원은 여기서 바로 `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents` 흐름으로 이어진다.

#### `/menu`
- 다른 사이트맵이 아니라 홈과 같은 정보구조를 다시 펼쳐 보는 화면이다.
- 모바일에서도 홈과 메뉴가 같은 바로가기 기준을 써야 한다.
- 회사 공통 고정 항목과 권한 기반 사용자 전용 항목을 섞지 않고 보여 준다.

#### `/notifications`
- same-origin inbox 로 읽는다.
- 외부 push, 외부 메일 발송 완료 화면처럼 이해하면 안 된다.
- 읽지 않은 항목 확인, 공지 확인, 상태 확인용으로 본다.

#### `/attendance`, `/leave`, `/approvals`
- 일반 직원의 실제 업무 흐름이다.
- 다만 정책 미허용, 권한 부족, 회사 scope 차단, placeholder 제한은 각각 다른 이유로 읽어야 한다.
- 오프라인 상태에서 성공처럼 보이는 문구가 나오면 안 된다.

#### `/boards`, `/documents`
- 협업/문서 읽기 흐름이다.
- 공지 책임과 일반 게시판 책임, 문서 metadata 확인과 외부 파일 공유를 같은 뜻처럼 읽지 않는다.

#### `/me`
- 내 세션, 역할, 로그아웃 동작, 상태 안내를 확인하는 화면이다.
- forbidden 은 로그인이 안 된 상태가 아니라 현재 업무 권한이 없는 상태라는 점을 따로 읽는다.

## 2. 관리자 / 담당자가 따라갈 사용 가이드

### 운영 관리자 / 지점 관리자 추천 순서
1. `/login`
2. `/dashboard`
3. `/management`
4. `/admin/users` 또는 `/admin/policies` 필요 확인
5. `/admin/audit-logs`

### 인사 관리자 추천 순서
1. `/login`
2. `/dashboard`
3. admin host `/admin/users`
4. `/admin/policies`
5. 필요 시 `/admin/audit-logs`

### 감사 담당자 추천 순서
1. `/login`
2. `/admin/audit-logs`
3. 필요 시 `/employees`, `/org` 읽기 확인
4. 필요 시 `/offline`

### 관리자 화면을 읽는 기준

#### `/management`
- 일반 직원 홈의 연장이 아니라 별도 운영 허브다.
- 홈에서 보던 문장과 운영 허브 문장이 같은 책임처럼 섞이면 안 된다.
- 운영 카드가 보여도 실급여 지급, 외부 신고, 외부 전송까지 다 열린 것은 아니다.

#### `/admin/users`
- 계정 생성, 권한 diff, 상태 변경, 비밀번호 초기화 dev-safe preview 를 검토하는 화면이다.
- 실제 저장 완료 화면처럼 읽으면 안 된다.

#### `/admin/policies`
- 정책 source, candidate, capability, audit preview 를 읽는 운영 화면이다.
- 직원 화면의 정책 안내와 다른 뜻으로 설명되면 안 된다.

#### `/admin/audit-logs`
- read-only 감사 레인이다.
- masked preview 와 company boundary 확인이 핵심이다.
- 실제 조치 시스템, 외부 감사 export 완료, 원문 전체 열람 화면처럼 과장하면 안 된다.

## 3. 상태 문장은 이렇게 구분한다

### loading
- 아직 불러오는 중이다.
- 성공도 실패도 아니다.

### empty
- 정상적으로 열렸지만 지금 보여 줄 항목이 없는 상태일 수 있다.
- 오류와 같은 뜻이 아니다.

### error
- 조회 실패 또는 응답 실패다.
- 권한 부족이나 오프라인과 다른 이유다.

### forbidden
- 로그인은 되었지만 지금 이 업무 권한이 없는 상태다.
- 로그인 실패와 같은 뜻이 아니다.

### offline
- 네트워크/연결 제약 때문에 온라인 재시도가 필요한 상태다.
- 상태 변경 성공처럼 읽히면 안 된다.

### dev-safe
- 검증용 preview 또는 안전한 데모 상태다.
- 실저장, 실발송, 실지급 완료와 같은 뜻이 아니다.

## 4. 모바일 / PWA 사용 가이드

### 모바일에서 먼저 볼 것
- 로그인 전에는 `/login` 만 먼저 보여야 한다.
- 로그인 후에는 `/dashboard`, `/menu`, `/notifications` 가 한 손 사용 기준의 첫 흐름이다.
- 하단 탭과 PC sidebar 는 같은 정보구조를 설명해야 한다.

### PWA 설치를 읽는 기준
- 설치 가능하다는 뜻과 오프라인 상태 변경 가능하다는 뜻은 다르다.
- manifest 가 있다는 뜻과 background sync 가 된다는 뜻은 다르다.
- 설치 후에도 세션이 없으면 `/login` 부터 시작해야 한다.

### Windows Chrome / Edge 확인 순서
1. `/login` 에 접속한다.
2. 브라우저의 설치 메뉴를 연다.
3. 앱처럼 설치한다.
4. 앱을 다시 열었을 때 세션이 없으면 `/login` 부터 시작하는지 본다.
5. 로그인 후 역할에 맞는 landing 으로 가는지 확인한다.

### 모바일/PWA에서 특히 보면 좋은 4가지
1. 홈(`/dashboard`)과 메뉴(`/menu`)가 같은 정보를 말하는가
2. 알림(`/notifications`)이 발송 성공 화면처럼 과장되지 않는가
3. 오프라인(`/offline`)이 가능한 일 / 막히는 일 / 재시도 절차를 먼저 보여 주는가
4. 운영 레인(`/management`, `/admin*`)이 일반 홈과 섞이지 않는가

## 5. UAT 절차

### 5-1. 시작 전 준비
- 접속 URL, 테스트 계정, 역할별 시나리오를 먼저 정리한다.
- 직원 레인과 운영 레인을 한 번에 섞어 보지 않는다.
- 이 단계가 외부 연동 없는 내부 그룹웨어 기준선 확인이라는 점을 먼저 공유한다.

### 5-2. 공통 시작 시나리오
1. `/login` 이 익명 유일 입구인지 확인
2. 로그인 뒤 landing 이 역할별 기준과 맞는지 확인
3. `/dashboard` 가 홈처럼 읽히는지 확인
4. `/menu`, `/notifications`, `/offline` 상태 문장이 서로 다른 뜻인지 확인

### 5-3. 직원 레인 UAT
추천 순서:
- `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`

기록할 질문:
- 오늘 할 일이 홈에서 바로 보이는가
- 권한 부족 / 정상 빈 상태 / 오프라인 / 오류가 다른 뜻으로 읽히는가
- 운영 메뉴가 일반 홈에 섞이지 않는가

### 5-4. 운영 관리자 레인 UAT
추천 순서:
- `/dashboard` → `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs`

기록할 질문:
- 운영 허브가 홈과 분리되는가
- `/admin/users` 가 읽기 조회 화면이 아니라 운영 검토 레인으로 읽히는가
- `/admin/audit-logs` 가 read-only 인가

### 5-5. 감사 레인 UAT
추천 순서:
- `/admin/audit-logs` → 필요 시 `/employees`, `/org` → `/offline`

기록할 질문:
- 감사 사용자를 전체 운영 관리자처럼 오해하게 만들지 않는가
- 최신성 한계와 read-only 경계가 숨겨지지 않는가

### 5-6. 모바일/PWA UAT
추천 순서:
- 모바일 `/login` → `/dashboard` → `/menu` → `/notifications` → `/offline`
- 필요 시 PWA 설치 → 앱 재실행 → 세션 없는 `/login` 시작 확인

기록할 질문:
- 같은 정보구조가 유지되는가
- 설치와 오프라인 성공을 같은 뜻처럼 쓰지 않는가
- 한 손 사용 중에도 상태 문장을 헷갈리지 않는가

### 5-7. 이슈 분류 기준
- blocker: 지금 시나리오를 더 진행할 수 없게 막는 문제
- major: 진행은 되지만 운영 의미가 크게 흔들리는 문제
- minor: 흐름은 되지만 다듬어야 하는 문제
- copy-doc: 화면 문구/문서 정합성 문제
- approval-needed: 기능 문제가 아니라 별도 승인 없이는 진행하면 안 되는 항목

## 6. 운영 체크리스트

### 운영 전
- [ ] `/login` 이 유일한 익명 시작점으로 유지된다.
- [ ] 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰인다.
- [ ] 직원 레인과 운영 레인을 다른 시나리오로 확인한다.
- [ ] live 직접 확인 근거와 local preview/build/test 대체 근거를 분리해 적는다.

### 운영 중
- [ ] `/dashboard` 가 홈으로 읽힌다.
- [ ] `/menu` 와 모바일 하단 탭, PC sidebar 가 같은 정보구조를 가리킨다.
- [ ] `/notifications` 가 외부 발송 성공 화면처럼 과장되지 않는다.
- [ ] `/offline` 이 가능한 일 / 막히는 일 / 재시도 절차를 먼저 보여 준다.
- [ ] `/management`, `/admin/users`, `/admin/audit-logs` 가 일반 직원 홈에 섞이지 않는다.
- [ ] loading / empty / error / forbidden / offline / dev-safe 문장이 서로 다른 뜻으로 유지된다.

### 운영 후
- [ ] 직원 레인 / 운영 레인 / 감사 레인을 따로 기록했다.
- [ ] blocker 와 approval-needed 를 분리했다.
- [ ] 실제 가능한 범위와 승인 게이트 범위를 분리했다.
- [ ] 다음 보고에 live URL, 테스트 계정, 추천 route, 남은 승인 게이트를 넣을 수 있게 정리했다.

## 7. 아직 남겨 두는 승인 게이트
- 외부 push / SMS / 메일 발송
- background sync
- native 앱스토어 배포
- production custom domain / app link
- 실제 계정 초대 발송 / 외부 IdP 연동
- production DB 실데이터 전환 / seed / migration
- 실제 급여 지급 / 은행 이체 / 기관 신고
- 주민번호 / 계좌번호 같은 민감정보 입력 확대
- 홈택스 / 4대보험 / 회계 / 노무사 / 세무사 / 변호사 외부 계정 연동
- secret 입력 / 교체
- 유료 리소스 생성 / 증설
- destructive / force 작업

## 8. 근거 파일과 검증 근거

### 주요 화면 근거
- `apps/web/app/page.tsx`
- `apps/web/menu-page-content.tsx`
- `apps/web/app/notifications/page.tsx`
- `apps/web/app/offline/page.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/admin/users/admin-users-page-content.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/app/me/page.tsx`
- `apps/web/app/_components/home-shortcuts-panel.tsx`
- `apps/web/app/_components/mobile-app-shell.tsx`
- `apps/web/app/mobile-pwa-config.ts`

### 검증 근거
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/menu-page-content.test.tsx`
- `apps/web/mobile-pwa.test.ts`
- `apps/web/mobile-app-shell-admin-boundary.test.tsx`
- `apps/web/mobile-app-shell-login.test.tsx`
- `apps/web/phase38-offline-admin.test.tsx`
- `apps/web/admin-preview-guard.test.ts`
- `apps/api/test/auth-org.spec.ts`

## 함께 볼 문서
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/guides/phase-47-operational-stability-performance-mobile-pwa-usability-handoff.md`
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-operator-runbook.md`
