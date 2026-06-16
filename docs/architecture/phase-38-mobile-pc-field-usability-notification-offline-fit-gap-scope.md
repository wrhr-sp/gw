# Phase 38 모바일·PC 현장 업무 사용성·알림·오프라인 fit-gap 범위

## 1. 한 줄 결론

이번 Phase 38의 목적은 `/dashboard`·`/menu`·`/notifications`·`/offline` 와 공통 app shell 을 다시 한 묶음으로 보면서,
"직원이 모바일/PC에서 하루 업무를 끊기지 않게 따라갈 수 있는가"와
"어디까지는 지금 실제로 읽고 누를 수 있고 어디부터는 아직 placeholder·승인 게이트인가"를 쉬운 언어로 다시 고정하는 것이다.

핵심은 새 외부 연동을 여는 것이 아니라,
홈/메뉴/알림/오프라인 안내/권한 분리/같은 정보구조가 이미 있는 구현과 같은 뜻으로 읽히게 만드는 것이다.

## 2. 왜 지금 이 Phase가 필요한가

직전 Phase 36에서는 `/dashboard`·`/menu` shortcut, `/org`·`/employees`, `/admin/users`·`/admin/policies` 운영 검토 언어를 다시 맞췄다.
직전 Phase 37에서는 `/documents` 파일 lifecycle, `/admin/audit-logs` storage preview, `work-items`·`/payroll` 민감자료 approval gate 를 내부 운영 저장흐름 언어로 다시 묶었다.

그 다음 단계에서는 일반 직원과 운영자가 실제로 가장 자주 마주치는 입구를 다시 정리해야 한다.
특히 아래 다섯 축이 이미 코드와 화면에 함께 있다.

1. `/dashboard` 를 홈처럼 읽는 일반 업무 시작점
2. `/menu` 와 PC sidebar 가 같은 정보구조를 공유하는 탐색 구조
3. `/notifications` 의 same-origin inbox 와 외부 발송 미연결 honesty
4. `/offline` 및 status banner 의 오프라인/재시도 안내
5. 일반 사용자 흐름과 `/management`·`/admin*` 운영 흐름 분리

이 다섯 축을 같은 제품 언어로 다시 묶는 것이 이번 fit-gap의 핵심이다.

## 3. 이번 Phase에서 직접 다루는 범위

### 3-1. 홈(`/dashboard`)과 메뉴(`/menu`)를 같은 사용성 문장으로 다시 고정한다

이번 Phase에서는 `/dashboard` 와 `/menu` 를 따로 존재하는 화면이 아니라 같은 홈 체계의 두 입구로 정리한다.

문서화 기준은 아래와 같다.

- 대시보드 = 홈으로 읽고, 오늘 해야 할 일의 첫 행동을 먼저 보여 주는 입구로 적는다.
- `/menu` 는 다른 앱의 별도 사이트맵이 아니라, 모바일 하단 탭과 PC sidebar 가 공유하는 전체 기능 선택 화면으로 적는다.
- 회사 공통 고정 shortcut 과 권한 기반 사용자 전용 shortcut 을 함께 보여 주되, 아직 없는 사용자별 편집/정렬/영구 저장 UI를 완성 기능처럼 적지 않는다.
- 일반 직원 메뉴와 `경영업무`·`/admin*` 운영 메뉴는 같은 책임처럼 섞지 않는다.
- 모바일 5개 하단 탭(`메뉴`·`홈`·`메신저`·`메일`·`알림`)은 고정 탐색이고, 실제 업무 확장은 `홈`/`메뉴`의 같은 registry 에서 이어진다고 적는다.

### 3-2. 알림(`/notifications`)은 inbox 와 외부 발송을 같은 말로 섞지 않게 고정한다

`/notifications` 는 이미 same-origin inbox 응답과 unread count 를 보여 줄 수 있다.
하지만 이번 Phase에서도 외부 푸시/메일/SMS 발송 완료처럼 쓰면 안 된다.

문서화 기준은 아래와 같다.

- 현재 알림은 "same-origin inbox / 미읽음 수 / 운영 가드레일 확인" 범위로 적는다.
- 외부 발송 provider, push token, background sync, 읽음 처리 영구 저장 확대는 별도 후속 과제 또는 승인 게이트로 남긴다.
- 오프라인, 권한 부족, 승인 대기, placeholder 제한을 실제 성공 알림처럼 포장하지 않는다.
- 알림 탭 자체가 업무 종착점이 아니라 `/dashboard` 와 `/menu` 로 다시 이어지는 보조 허브라고 적는다.

### 3-3. 오프라인 안내(`/offline`)와 status banner 는 "가짜 성공 UX 금지"를 먼저 보여 줘야 한다

이번 Phase에서는 오프라인 지원을 "상태 변경이 가능한 offline app" 으로 과장하지 않는다.
대신 현재 가능한 일과 지금 막아야 하는 일을 분리하는 안내 구조를 기준으로 삼는다.

- 일반 사용자 오프라인 안내는 읽기 중심 탐색, 안내 문구 재확인, 재시도 절차 확인까지만 허용한다고 적는다.
- 출퇴근 등록, 휴가 신청/승인, 결재 승인/반려, 게시글/댓글/문서 metadata 생성은 online-only 상태 변경이라고 적는다.
- 관리자 오프라인 안내는 사용자/권한/정책/감사 로그 변경과 최신성 판단이 online-only 라는 점을 먼저 적는다.
- status banner 는 online 에서는 설치/preview 원칙, offline 에서는 가능한 일/막히는 일/재시도 절차로 자연스럽게 이어져야 한다.
- 오프라인 안내를 PWA 완전 동기화, background sync, 실제 현장 저장 보장처럼 쓰지 않는다.

### 3-4. 일반 업무 흐름과 운영 흐름 분리를 다시 맞춘다

이번 Phase 38은 단순 탐색 개선이 아니라 역할별 업무 경계가 흐려지지 않는지를 함께 본다.

- 일반 직원/팀장은 `/dashboard` 에서 시작해 `/attendance`·`/leave`·`/approvals`·`/boards`·`/documents`·`/me` 로 이어지는 흐름으로 적는다.
- 인사/운영 관리자와 감사 사용자는 `/management`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 로 이어지는 별도 운영 흐름을 같이 적는다.
- `경영업무` 는 일반 홈 바로가기와 다른 레인이라는 점을 유지한다.
- 메뉴 숨김만이 아니라 route guard, API guard, company/branch scope, `audit.read` 같은 권한 경계를 함께 검토 대상으로 남긴다.

### 3-5. 문서·공유 계약·화면·API·테스트 증거를 한 문장으로 연결한다

이번 Phase 문서는 새로운 아이디어 제안서가 아니라 이미 있는 구현 흔적을 묶는 기준 문서여야 한다.
그래서 아래 계층을 같이 근거로 삼는다.

- 문서 기준: Phase 24, Phase 31, Phase 34, Phase 36, Phase 37 관련 scope/handoff
- 공유 계약 기준: `packages/shared/src/contracts.ts`, `packages/shared/src/mobile-contracts.ts`
- Web 기준: `apps/web/app/page.tsx`, `apps/web/dashboard-page-content.tsx`, `apps/web/app/menu/page.tsx`, `apps/web/menu-page-content.tsx`, `apps/web/app/notifications/page.tsx`, `apps/web/app/offline/page.tsx`, `apps/web/app/_components/mobile-app-shell.tsx`, `apps/web/app/mobile-pwa-config.ts`
- API 기준: `apps/api/src/app.ts`
- 테스트 기준: `apps/web/dashboard-boundary.test.tsx`, `apps/web/menu-page-content.test.tsx`, `apps/web/phase34-real-usage.test.tsx`, `apps/api/test/auth-org.spec.ts`

## 4. 이번 Phase에서 일부러 하지 않는 것

이번 Phase는 아래를 구현 완료처럼 약속하지 않는다.

- 외부 push/SMS/메일 발송 연동
- background sync
- 사용자별 홈 바로가기 drag-and-drop 편집/영구 저장 UX 완성
- 실기기 native 패키징/스토어 배포
- production custom domain/app link 확정
- 실운영 계정 대량 발급/외부 SSO 연동
- production DB 실데이터 반영
- migration, destructive 작업, secret 주입

즉 이번 Phase는 "기능 확장"보다 "현장 사용성 언어 고정"이 우선이다.

## 5. 현재 확인된 대표 근거

### 홈/메뉴/탐색 구조
- `apps/web/app/page.tsx`
  - 일반 업무 흐름과 관리자 검토 흐름을 두 갈래로 보여 주고, 모바일 하단 탭 5개와 핵심 route 바로가기를 같은 홈 맥락으로 정리한다.
- `apps/web/app/menu/page.tsx`, `apps/web/menu-page-content.tsx`
  - 세션 역할에 따라 home shortcut API를 읽고, 같은 메뉴 섹션/하단 탭/경영업무 분리 기준을 렌더링한다.
- `apps/web/home-shortcuts.ts`
  - 로그인 전 notice, API load error, shortcut/notices 응답을 분리해 홈 바로가기 로딩 경계를 유지한다.

### 알림/오프라인 안내
- `apps/web/app/notifications/page.tsx`
  - same-origin inbox 와 외부 발송 없음, placeholder honesty, `/dashboard`·`/menu` 재진입을 함께 설명한다.
- `apps/web/app/offline/page.tsx`
  - 가능한 일/막히는 일/재시도 절차와 관리자 offline 레인을 분리해 보여 준다.
- `apps/web/app/_components/mobile-app-shell.tsx`
  - online/offline status banner, 모바일 하단 탭, PC sidebar, `/offline` 진입 링크를 같은 shell 안에서 유지한다.
- `apps/web/app/mobile-pwa-config.ts`
  - install guide, offline guidance, 모바일/관리자 nav, 관리 레인 분리, touch target 기준을 정의한다.

### API/contract/테스트
- `packages/shared/src/contracts.ts`
  - notifications unread count/notices 구조가 contract 로 있다.
- `packages/shared/src/mobile-contracts.ts`
  - push, store build, secure storage, custom domain/app link 가 별도 승인 게이트임을 계속 분리한다.
- `apps/api/src/app.ts`
  - 홈 shortcut API 와 notifications same-origin inbox 응답, unread count, notices 근거가 있다.
- `apps/api/test/auth-org.spec.ts`
  - 역할별 route/API 경계와 same-origin 흐름의 회귀 근거가 있다.

## 6. 이번 fit-gap의 핵심 판정 질문

문서/코드 대조 후 아래 질문에 같은 답이 나와야 한다.

1. `/dashboard` 와 `/menu` 가 같은 홈 shortcut 기준과 정보구조를 가리키는가
2. 모바일 하단 탭 5개와 PC sidebar 가 같은 업무 그룹을 설명하고, 운영 메뉴를 일반 사용자 메뉴와 섞지 않는가
3. `/notifications` 는 same-origin inbox 로 읽히되 외부 발송/푸시 완료처럼 과장되지 않는가
4. `/offline` 안내는 가능한 일/막히는 일/재시도 절차를 나누고 상태 변경을 성공처럼 보이게 하지 않는가
5. 일반 업무 흐름과 `경영업무`·`/admin*` 운영 흐름이 같은 책임처럼 섞이지 않는가
6. push/background sync/native 배포/production secret/custom domain 같은 항목이 계속 승인 게이트로 남는가

## 7. 이번 Phase에서 권장하는 쉬운 확인 순서

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

이 순서는 "일반 직원 홈 → 탐색 구조 → 알림/오프라인 예외 → 운영 검토 레인" 순서를 유지하기 위한 것이다.

## 8. 다음 작업자에게 넘길 핵심 문장

- 이번 Phase 38은 모바일/PC 현장 업무 사용성을 실제 외부 연동 완성처럼 보이지 않게 정리하는 fit-gap 단계다.
- 핵심은 홈/메뉴/알림/오프라인 안내/운영 경계를 같은 제품 언어로 다시 맞추는 것이다.
- same-origin inbox, offline 안내, 홈 shortcut API, 운영 분리 메뉴는 이미 근거가 있지만 외부 발송·push·background sync·스토어 배포는 아직 범위 밖이다.
- 후속 구현이 생겨도 먼저 "같은 정보구조 유지, 가짜 성공 UX 금지, 운영 메뉴 분리, 승인 게이트 명시" 원칙을 깨지 않는지부터 확인해야 한다.
