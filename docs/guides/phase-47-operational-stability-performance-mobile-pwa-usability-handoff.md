# Phase 47 운영 안정성·성능·모바일/PWA 사용성 보강 handoff

## 1. 이번 Phase를 한 줄로 말하면
이번 Phase는 `/dashboard`·`/menu`·`/notifications`·`/offline`·`/management`·`/admin/users` 를
"회사 전체 사용 직전에 사용자가 가장 먼저 체감하는 안정성/로딩/재시도/모바일 사용성" 기준으로 다시 묶는 단계다.

쉽게 말하면,

- 로그인 후 첫 화면이 왜 `/dashboard` 인지,
- 모바일/PWA 에서 무엇을 먼저 눌러야 하는지,
- empty/error/forbidden/offline 이 왜 서로 다른 상태인지,
- 운영자 레인이 왜 일반 직원 홈과 분리돼야 하는지,

이 네 가지를 한 번에 헷갈리지 않게 만드는 handoff 다.

## 2. 이번 Phase에서 꼭 지켜야 할 제품 문장
- 익명 시작점은 계속 `/login` 뿐이다.
- COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 로그인 직후 공통 landing 은 `/dashboard` 다.
- AUDITOR 의 로그인 직후 landing 은 `/admin/audit-logs` 다.
- 일반 직원 홈은 계속 `/dashboard` 다.
- 모바일 하단 탭 5개(`메뉴`·`홈`·`메신저`·`메일`·`알림`)와 PC sidebar 는 같은 정보구조를 가리킨다.
- `/management` 와 `/admin*` 는 일반 직원 홈의 연장선이 아니라 별도 운영 레인이다.
- `/offline` 은 가능한 일 / 막히는 일 / 재시도 절차를 안내하는 복구 화면이지 업무 성공 화면이 아니다.
- empty / error / forbidden / offline 은 서로 다른 뜻으로 유지한다.
- `/employees` 와 `/org` 는 읽기 중심 확인 레인이고, `/admin/users` 는 민감 운영 검토 레인이다.
- PWA 설치 가능, manifest 존재, 모바일 shell 존재를 완전 offline 업무 가능과 같은 뜻으로 적지 않는다.
- `admin / 1234` 는 dev/test/UAT 전용 테스트 계정이며 production 기본 계정이 아니다.

## 3. 역할별 추천 확인 레인

### A. 일반 직원 / 팀장 기본 레인
- `/login`
- `/dashboard`
- `/menu`
- `/notifications`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/me`

읽는 포인트:
- 오늘 먼저 할 일을 홈에서 바로 고를 수 있는지
- 메뉴와 하단 탭이 같은 정보구조를 가리키는지
- 알림과 오프라인 안내가 성공/실패를 과장하지 않는지
- 민감 운영 메뉴가 일반 홈에 섞이지 않는지

### B. 운영 관리자 / 인사 관리자 레인
- `/login`
- `/dashboard`
- `/management`
- `/admin/users`
- `/admin/policies`
- `/employees`
- `/org`
- 필요 시 `/offline`

읽는 포인트:
- 운영 허브가 일반 직원 홈과 분리되는지
- 계정/권한/정책 검토가 읽기 조회와 다른 책임으로 보이는지
- 오프라인 시 최신성 판단과 상태 변경이 계속 막히는지

### C. 감사 / 컴플라이언스 레인
- `/login`
- admin host `/admin/audit-logs`
- 필요 시 `/dashboard` 읽기 참고
- 필요 시 `/employees`, `/org` 읽기 확인
- 필요 시 `/offline`

읽는 포인트:
- 감사는 read-only 흐름인지
- AUDITOR 를 전체 운영 관리자처럼 쓰지 않는지
- offline 안내가 감사 최신성 한계를 숨기지 않는지

## 4. 이번 Phase에서 바로 이어받아야 할 구현 포인트

### A. 홈/메뉴/shortcut 체감 정리
- `/dashboard` 는 오늘 할 일을 고르는 첫 홈으로 읽혀야 한다.
- `/menu` 는 다른 사이트맵이 아니라 같은 정보구조를 다시 펼쳐 보는 화면으로 읽혀야 한다.
- home shortcut panel 의 loading/error/empty 문장은 "지금 왜 비어 있는지 / 무엇을 다시 해 보면 되는지" 기준으로 더 분명해야 한다.

### B. notifications / offline honesty
- `/notifications` 는 same-origin inbox 로 읽히되 외부 push 발송 완료처럼 쓰지 않는다.
- `/offline` 은 읽기 중심 복구 안내이지 상태 변경 성공 화면이 아니다.
- 일반 host offline 범위와 admin host offline 범위를 서로 다른 책임으로 유지한다.

### C. 상태 문장 분리
- empty 는 정상 빈 상태일 수 있다.
- error 는 응답 실패/조회 실패다.
- forbidden 은 권한 부족 또는 접근 불가다.
- offline 은 네트워크/연결 제약으로 재시도가 필요한 상태다.
- dev-safe / skeleton 은 실제 저장 완료가 아니라 검증용 preview 단계다.

### D. 운영 레인 분리
- `/management` 는 일반 직원 홈과 다른 운영 허브다.
- `/admin/users` 는 계정/권한/상태 변경 preview 검토 레인이다.
- `/employees` 와 `/org` 는 읽기 중심 확인 레인이다.
- `/admin/audit-logs` 는 감사 read-only 레인이다.

### E. 모바일/PWA 기대치 분리
- 설치 안내는 설치 후 첫 진입과 기본 route 기대치를 설명하는 데 쓴다.
- installability 와 offline 상태 변경 가능 여부를 같은 뜻으로 적지 않는다.
- manifest/general/admin split, host 분리, same-origin API 원칙을 문서/테스트/UI에서 같은 뜻으로 유지한다.

## 5. 현재 구현 근거 파일

### web 근거
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
- `apps/web/app/_components/real-usage-panels.tsx`
- `apps/web/app/_components/phase34-live-sections.tsx`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.ts`

### API / shared / test 근거
- `apps/api/src/app.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/mobile-contracts.ts`
- `apps/web/mobile-pwa.test.ts`
- `apps/web/mobile-app-shell-admin-boundary.test.tsx`
- `apps/web/mobile-app-shell-login.test.tsx`
- `apps/web/phase38-offline-admin.test.tsx`
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/admin-preview-guard.test.ts`
- `apps/api/test/auth-org.spec.ts`

## 6. 이번 Phase 구현/리뷰/테스트가 꼭 물어야 할 질문
1. `/dashboard` 와 `/menu` 가 같은 정보구조와 shortcut 기준을 가리키는가
2. 모바일 하단 탭 5개와 PC sidebar 가 같은 업무 그룹을 설명하는가
3. `/notifications` 를 외부 push/메일 발송 결과처럼 과장하지 않는가
4. `/offline` 안내가 가능한 일 / 막히는 일 / 재시도 절차를 먼저 보여 주는가
5. empty / error / forbidden / offline / dev-safe 문장이 서로 다른 뜻으로 읽히는가
6. `/management`·`/admin/users`·`/admin/policies`·`/admin/audit-logs` 가 일반 직원 홈과 같은 책임처럼 섞이지 않는가
7. installability 와 실제 offline 상태 변경 가능 여부를 같은 말처럼 쓰지 않는가
8. live 직접 확인 근거와 local preview/build/release gate 대체 근거를 분리해서 적는가
9. 외부 push, background sync, native 배포, production secret/실데이터가 여전히 승인 게이트로 남는가

## 7. 현재 Kanban 체인
1. Phase 46 최종 통합 보고 완료: `t_889a1444` — 싱드(`singde`) — 완료
2. Phase 47 기획·fit-gap: `t_b1e8800c` — 도담(`gwplanner`) — 현재 카드
3. Phase 47 구현: `t_3dfc46d5` — 이룸(`gwbuilder`) — 부모 대기

상위 parent 메모:
- live URL 은 `https://gw-web.werehere31.workers.dev` 이다.
- dev/test/UAT 전용 테스트 계정은 `admin / 1234` 다.
- main merge commit 은 `8cb631709a27d4cf73bcd198a9c6e3dafc47e1b9` 다.
- release gate 기준 baseline / cloudflare-build / cloudflare-deploy 가 성공했다.
- 직전 문서 기준 focused web 재검증은 24 files / 102 tests passed 다.

## 8. 완료 판단 기준
- 대장이 `/login` → `/dashboard` → `/menu` → `/notifications` → `/offline` 순서로 먼저 봤을 때 무엇이 가능한지/막히는지 바로 이해할 수 있다.
- 일반 직원 홈과 운영 허브, 감사 read-only 흐름이 서로 섞이지 않는다.
- mobile/PWA/install/offline 설명이 실제 현재 구현 범위보다 과장되지 않는다.
- 다음 구현/리뷰/테스트/문서화 작업자가 어떤 route 와 상태 문장을 먼저 봐야 하는지 바로 알 수 있다.

## 9. 아직 남겨 두는 승인 게이트
- 외부 push/SMS/메일 발송
- background sync
- native 앱스토어 배포
- production custom domain/app link
- 실제 계정 초대 발송 / 외부 IdP 연동
- production 기본 계정/실사용 비밀번호 배포
- production DB 실데이터 전환/seed/migration
- 실제 급여 지급, 기관 신고, 은행 이체
- secret 교체, 유료 리소스, destructive 작업
