# Phase 47 운영 안정성·성능·모바일/PWA 사용성 보강 fit-gap 범위

## 1. 한 줄 요약
이번 Phase 47의 목표는
이미 내부 도입 기준선에 올려 둔 `/login`·`/dashboard`·`/management`·`/admin/users`·`/admin/audit-logs`·모바일/PWA shell 을
"회사 전체 사용 직전에 가장 쉽게 흔들릴 운영 안정성·로딩 체감·오류 안내·모바일 한 손 사용성" 기준으로 다시 묶는 것이다.

쉽게 말하면 이번 단계는
새 외부 연동을 여는 것이 아니라,
대장이 PC/모바일/PWA에서 직접 눌러 볼 때
"어디가 홈인지, 어디서 기다리는지, 어디서 막히는지, 오프라인/오류일 때 무엇을 해야 하는지, 관리자 레인과 일반 직원 레인이 왜 다른지"
를 더 덜 헷갈리게 만드는 기준선을 고정하는 단계다.

## 2. 왜 지금 이 Phase가 필요한가
Phase 45에서 내부 도입 최종검증·릴리즈 기준을 잠갔고,
Phase 46에서 계정·권한·조직 온보딩 리허설 기준을 잠갔다.

하지만 회사 전체 사용 직전 관점에서는 아직 아래 gap 이 남아 있다.

1. 로그인 필수 진입과 역할별 landing 기준은 정리됐지만, 첫 로딩/재시도/오프라인/empty/error 상태를 사용자가 실제 체감하는 언어는 화면마다 더 통일돼야 한다.
2. 모바일 하단 탭, 홈 shortcut, 메뉴, 설치 안내, 오프라인 안내가 이미 있지만 "지금 써도 되는 일"과 "아직 online-only 인 상태 변경"이 더 또렷해야 한다.
3. 일반 직원 홈(`/dashboard`)과 운영 허브(`/management`, `/admin/*`)는 분리돼 있지만, 회사 전체 사용 전에는 "왜 분리돼야 하는지"가 성능/안정성/UAT 문장으로 더 연결돼야 한다.
4. route/API guard 는 이미 강하지만, 사용자가 느끼는 것은 로딩·에러·empty·forbidden·offline 배너와 재시도 순서다. 이 체감 언어가 문서·화면·테스트에서 더 같은 뜻이어야 한다.
5. PWA/모바일 사용성은 installability 자체보다도, 설치 후에도 `/login` 부터 시작하고 same-origin/API/권한 경계를 흐리지 않는 운영 기준이 더 중요하다.

즉 이번 Phase는
"내부 도입 가능"에서 한 걸음 더 나아가
"전사 사용 직전에 흔들리기 쉬운 안정성·로딩 체감·모바일/PWA 사용성 문장을 같은 언어로 다시 잠그는 단계"다.

## 3. 이번 Phase에서 잠가야 할 제품 문장
- 익명 시작점은 계속 `/login` 뿐이다.
- COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 로그인 직후 공통 landing 은 `/dashboard` 다.
- AUDITOR 의 로그인 직후 landing 은 `/admin/audit-logs` 다.
- 일반 직원/팀장 기본 홈은 계속 `/dashboard` 다.
- 모바일 하단 탭 5개(`메뉴`·`홈`·`메신저`·`메일`·`알림`)와 PC sidebar 는 같은 정보구조를 가리킨다.
- `경영업무` 와 `/admin*` 는 일반 직원 홈의 연장선이 아니라 별도 운영 레인이다.
- 오프라인/불안정 네트워크 안내는 "가능한 일 / 막히는 일 / 재시도 절차"를 먼저 설명하고 상태 변경 성공처럼 보이게 만들지 않는다.
- empty, error, forbidden, offline 은 서로 다른 상태로 유지한다.
- `/admin/users`·`/admin/policies`·`/admin/audit-logs` 는 민감 운영/감사 레인이고, `/employees`·`/org` 는 읽기 중심 확인 레인이다.
- PWA 설치 가능 여부, manifest 존재, 모바일 shell 존재를 실제 background sync·외부 push·완전 오프라인 처리 가능과 같은 뜻으로 쓰지 않는다.
- dev/test/UAT 기본 계정 `admin / 1234` 는 계속 검증용 문구로만 유지하고 production 기본 계정처럼 설명하지 않는다.

## 4. 현재 바로 재사용할 근거

### 4-1. 주요 route
- `/login`
- `/dashboard`
- `/menu`
- `/notifications`
- `/offline`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/management`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/manifest.webmanifest`
- `/admin/manifest.webmanifest`

### 4-2. 현재 구현 근거 파일
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/app/_components/mobile-app-shell.tsx`
- `apps/web/app/_components/home-shortcuts-panel.tsx`
- `apps/web/menu-page-content.tsx`
- `apps/web/app/offline/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/me/page.tsx`
- `apps/web/app/admin/users/admin-users-page-content.tsx`
- `apps/web/admin-preview-guard.ts`
- `apps/web/middleware.ts`
- `apps/web/app/_components/real-usage-panels.tsx`
- `apps/web/app/_components/phase34-live-sections.tsx`
- `apps/api/src/app.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/mobile-contracts.ts`

### 4-3. 현재 테스트/검증 근거
- `apps/web/mobile-pwa.test.ts`
- `apps/web/mobile-app-shell-admin-boundary.test.tsx`
- `apps/web/mobile-app-shell-login.test.tsx`
- `apps/web/phase38-offline-admin.test.tsx`
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/admin-preview-guard.test.ts`
- `apps/api/test/auth-org.spec.ts`

### 4-4. 직전 parent 기준 최신 운영 근거
- live URL: `https://gw-web.werehere31.workers.dev`
- main merge commit: `8cb631709a27d4cf73bcd198a9c6e3dafc47e1b9`
- PR: `#94`
- release gate: baseline / cloudflare-build / cloudflare-deploy success
- 직전 문서 기준 focused web 재검증: 24 files passed, 102 tests passed
- 직전 문서 기준 focused API 재검증: 15 files passed, 98 tests passed, 4 skipped
- `pnpm --filter @gw/mobile typecheck` 통과
- `pnpm --filter @gw/web build` 통과
- 기존 local preview smoke 기준 익명 내부 route `/login` redirect, `/login` 200, `/api/health` 200, `/manifest.webmanifest` 200 근거 존재

## 5. 이번 Phase에서 직접 닫아야 할 범위

### 5-1. 첫 체감 성능과 상태 안내 문장을 잠근다
- 홈/메뉴/실시간 조회 패널에서 loading, empty, error 문장이 각각 무엇을 뜻하는지 더 쉽게 따라가게 정리한다.
- "로딩 중"과 "응답 없음"과 "권한 부족"과 "오프라인"이 같은 장애처럼 읽히지 않게 한다.
- 재시도 순서는 `/dashboard` 또는 `/menu` 재확인, `/offline` 안내 확인, 필요 시 안정적인 네트워크에서 재시도처럼 실제 행동 순서로 적는다.
- skeleton/placeholder 문구는 숨기지 않되, 회사 전체 사용 전 확인용이라는 뜻으로 묶는다.

### 5-2. 모바일/PWA 한 손 사용성과 설치 후 기대치를 잠근다
- 모바일 하단 탭 5개와 PC sidebar 가 같은 정보구조를 유지한다는 문장을 다시 잠근다.
- 홈 shortcut, 메뉴 전체 탐색, notifications, offline 안내가 모바일에서 먼저 보이는 핵심 행동 순서와 맞는지 정리한다.
- PWA 설치 안내는 "설치 가능"과 "오프라인 상태 변경 가능"을 같은 뜻으로 쓰지 않게 한다.
- manifest/general/admin split 은 유지하되, 설치 후에도 세션 없으면 `/login` 부터 시작한다는 원칙을 계속 앞에 둔다.

### 5-3. 일반 직원 레인과 운영 레인의 안정성 기대치를 분리한다
- 일반 직원 레인은 `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서로 읽힌다.
- 운영 레인은 `/management` 와 `/admin/users`·`/admin/policies`·`/admin/audit-logs` 로 분리한다.
- `/employees`·`/org` 는 운영 저장 화면이 아니라 읽기 확인 레인으로 유지한다.
- 운영 레인 분리는 단순 메뉴 숨김이 아니라 route guard, API guard, host 경계, capability 경계와 같은 뜻이어야 한다.

### 5-4. 오프라인/에러 honesty 를 잠근다
- `/offline` 은 복구 가이드이지 업무 완료 화면이 아니다.
- 출퇴근 등록/정정, 휴가 신청/승인, 결재 승인/반려, 사용자/권한/정책 변경, 감사 최신성 판단은 계속 online-only 로 적는다.
- 관리자 offline 안내는 일반 사용자 offline 안내와 같은 복구 범위를 가지지 않는다는 점을 더 또렷하게 적는다.
- background sync, push 재동기화, 완전 offline cache 를 이미 되는 것처럼 쓰지 않는다.

### 5-5. 전사 사용 직전 UAT 확인 순서를 다시 잠근다
- PC/모바일 공통 추천 확인 순서를 `/login` → `/dashboard` → `/menu` → `/notifications` → `/offline` → 역할별 실제 업무/운영 레인으로 정리한다.
- 성능·안정성 관점의 happy path / empty / error / forbidden / offline 포인트를 Phase 47 언어로 다시 묶는다.
- 실제 live 직접 확인 근거와 기존 local preview/build/test/release gate 대체 근거를 분리해서 적는다.

## 6. 현재 구현 기준 fit-gap

### 지금 이미 되는 것
- 익명 내부 route 차단과 로그인 필수 진입 기준
- 일반 host 와 admin host 의 manifest / app shell / offline 안내 분리
- 모바일 하단 탭 5개, 메뉴 섹션, 홈 shortcut 패널, 운영 메뉴 분리
- same-origin inbox/notifications 와 offline guidance 문구 구조
- `/admin/users`·`/attendance`·`/me` 등에서 empty/error/offline/dev-safe 경계를 화면 문장으로 분리하려는 현재 구조
- route guard / API guard / host 경계 / capability 경계에 대한 테스트 근거

### 아직 이번 Phase에서 더 닫아야 할 것
- 화면마다 흩어진 loading/empty/error/offline 문장을 "전사 사용 직전 안정성" 언어로 더 통일해야 한다.
- 모바일/PWA 설치 안내와 실제 offline 제약 설명이 운영 문서/UAT 문장에서도 같은 뜻이 되도록 더 잠가야 한다.
- 홈(`/dashboard`)에서 시작하는 일반 직원 체감 흐름과 운영 허브 체감 흐름의 분리가 더 짧은 확인 순서로 정리돼야 한다.
- live URL 직접 확인, parent 검증 근거, local preview 대체 근거를 더 덜 헷갈리게 분리해야 한다.
- 성능 자체의 수치 최적화보다도, 사용자가 느끼는 로딩·재시도·상태 전환 설명을 더 먼저 잠가야 한다.

## 7. 이번 Phase에서 일부러 하지 않는 것
- 외부 push/SMS/메일 발송 연동
- background sync
- service worker 기반 실업무 상태 변경 보장
- native app 패키징/앱스토어 배포
- production custom domain/app link
- 실사용 비밀번호 배포 또는 실제 계정 초대 발송
- 외부 IdP/SSO/SAML/SCIM 연동
- production DB 실데이터 전환/seed/migration
- 은행/세무/노무/법무/기관 외부 계정 연동
- Lighthouse 점수 최적화 자체를 자동 배포 게이트로 승격
- secret 입력/교체
- destructive/force 작업

## 8. 테스트 시나리오

### A. 일반 직원 모바일/PC happy path
- `/login` → `/dashboard` → `/menu` → `/notifications` → `/attendance` → `/leave` → `/approvals`
- 홈 shortcut/메뉴/하단 탭이 같은 정보구조를 가리키는지 확인
- loading/empty/error/offline 문장이 서로 다른 의미로 읽히는지 확인

### B. 운영자/감사 안정성 확인
- `/login` → `/dashboard` → `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs`
- 일반 host/admin host 분리, 운영 메뉴 분리, 감사 read-only 경계 확인
- `/offline` 이 관리자 최신성 판단/상태 변경을 online-only 로 남기는지 확인

### C. 오프라인/에러 honesty 확인
- `/offline` 에서 가능한 일/막히는 일/재시도 절차 분리 확인
- `/attendance`, `/me`, `/admin/users` 에서 empty/error/offline/dev-safe 예시 문장 확인
- 상태 변경 성공처럼 보이는 문장, 실제 외부 연동 완료처럼 보이는 문장 차단 확인

### D. PWA/설치 기대치 확인
- `/manifest.webmanifest`, `/admin/manifest.webmanifest` 기준 일반/admin manifest split 확인
- 설치 후에도 로그인 전에는 `/login` 부터 시작한다는 문장 확인
- installability 와 실업무 offline 가능 범위를 같은 말처럼 섞지 않는지 확인

## 9. 역할별 후속 작업 기준
- builder: 홈/메뉴/알림/오프라인/운영 레인의 체감 사용성을 더 또렷하게 만들고, loading/empty/error/offline/dev-safe copy 와 모바일 CTA 흐름을 다듬는다.
- reviewer: 상태 혼동, 권한 누출, 운영 레인/일반 레인 혼동, install/offline 과장, dev-safe 문구 누락을 검토한다.
- tester: 모바일/PWA shell, manifest split, offline 안내, route/API guard, 역할별 landing/허용·차단 흐름을 다시 검증한다.
- docs: 운영자 가이드, 모바일/PWA 사용 가이드, 상태 안내 문구, live 확인 순서, 승인 게이트를 쉬운 말로 정리한다.
- ops: live URL, release gate, smoke 기준, PWA/manifest/health 확인 순서를 최종 보고 형식으로 묶는다.
