# Phase 58 상태 문장, 복구 안내, 역할별 차단 레인 fit-gap scope

## 왜 이 Phase를 여는가

Phase 57에서 `/dashboard`, `/menu`, 홈 바로가기, 모바일/PC 정보구조, 운영 레인 분리 기준선을 다시 잠갔다면,
그 다음에는 그 화면들 안에서 반복되는 상태 문장 자체를 같은 언어로 다시 잠가야 한다.

현재 저장소에는 이미 아래 축이 함께 존재한다.

- `/dashboard` 의 상태 안내 기준선
- `/menu` 의 모바일 상태 문장 가이드
- `/management` 의 운영 상태 문장 가이드
- `/admin/users` 의 `forbidden / empty / error / dev-safe` 경계 안내
- `real-usage-panels.tsx`, `phase35-live-sections.tsx` 의 실제 query state 패턴
- `/me`, `/notifications`, `/boards` 등 개별 route 의 상태 설명 카드

하지만 아직 Phase 57 다음 단계 기준으로는 아래가 한 문장 세트로 완전히 잠기지 않았다.

- `loading`, `empty`, `error`, `forbidden`, `offline`, `dev-safe` 의 화면별 말투 차이
- 일반 직원 홈, 운영 허브, 관리자 계정관리, 감사/조회 레인에서 같은 상태를 어떻게 다르게 설명할지
- `empty` 와 `forbidden`, `error` 와 `offline`, `preview/dev-safe` 와 `실제 저장 완료`를 헷갈리지 않게 하는 복구 문장
- 권한 없는 사용자를 어디로 되돌리고 무엇을 보게 할지에 대한 route 레벨 복구 순서
- HR_ADMIN, MANAGER, COMPANY_ADMIN, AUDITOR, EMPLOYEE 의 첫 진입점과 차단 레인을 사용자 안내 문장으로 다시 맞추는 일

이번 Phase의 핵심은 새 기능을 더 만드는 것이 아니라,
이미 있는 상태 표현과 역할별 레인 분리 기준을 live URL에서 더 쉽게 읽히도록 문장·가이드·검증 질문으로 다시 정리하는 것이다.

## 이번 Phase의 한 줄 목표

대장이 live URL에서 `/dashboard`, `/menu`, `/management`, `/admin/users`, `/admin/audit-logs`, `/me` 를 직접 눌러 보며,
`loading / empty / error / forbidden / offline / dev-safe` 가 서로 다른 뜻으로 읽히고,
역할별 첫 진입점과 차단 레인이 홈·운영·감사 화면에서 같은 말로 유지된다고 판단할 수 있는 상태를 만드는 것.

## 지금 바로 확인 가능한 범위

### 웹 route
- `/dashboard`
- `/menu`
- `/management`
- `/admin/users`
- `/admin/audit-logs`
- `/me`
- `/notifications`
- `/boards`
- `/offline`

### 구현 근거 파일
- `apps/web/dashboard-page-content.tsx`
- `apps/web/menu-page-content.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/admin/users/admin-users-page-content.tsx`
- `apps/web/app/me/page.tsx`
- `apps/web/app/notifications/page.tsx`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/_components/real-usage-panels.tsx`
- `apps/web/app/_components/phase35-live-sections.tsx`
- `apps/web/app/mobile-pwa-config.ts`
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/contracts.ts`

## 이번 Phase에서 다시 잠글 문장 원칙

### 1. loading 은 성공 직전이 아니라 대기 상태다.
- 아직 불러오는 중이라는 뜻이다.
- 저장 성공, 권한 부족, 빈 상태로 성급히 해석하면 안 된다.
- 가능한 복구 문장은 `잠시 기다린 뒤 홈 또는 메뉴에서 다시 확인합니다.` 수준으로 맞춘다.

### 2. empty 는 실패가 아니라 정상 빈 상태일 수 있다.
- 현재 권한에서 추가 항목이 없을 수 있다.
- 오늘 처리할 일이 없을 수 있다.
- 계정 검토 큐나 개인 전용 바로가기가 비어 있을 수 있다.
- `비어 있음`을 `막힘`처럼 쓰면 안 된다.

### 3. error 는 재시도나 운영 확인이 필요한 실패 상태다.
- API 응답 실패, 연결 오류, 조회 실패를 뜻한다.
- same-origin fetch 실패와 권한 차단을 같은 실패로 뭉개지 않는다.
- 같은 화면에서 무한 저장 시도를 유도하지 말고 복구 경로를 안내한다.

### 4. forbidden 은 로그인 실패가 아니라 권한/범위 차단 상태다.
- 로그인은 되었지만 지금 이 업무 권한이 없는 상태다.
- 역할, capability, company/branch scope, read-only 경계 때문에 막힌다.
- 권한 없는 사용자를 운영 레인으로 밀어 넣지 않고 허용된 레인으로 되돌려야 한다.

### 5. offline 은 네트워크 불안정 상태다.
- 서버 반영형 작업이 막힐 수 있다.
- 로그인 실패, 권한 부족, 정상 빈 상태와 다른 문장이어야 한다.
- 가능한 일 / 막히는 일 / 재시도 절차를 먼저 적는다.

### 6. dev-safe / preview / 내부 확인용 데이터는 실운영 완료가 아니다.
- 내부 확인에 쓰는 요약·preview·안내 상태다.
- 실제 저장 완료, 실제 메일 발송, 실제 정책 반영, production password 운영과 같은 뜻으로 적지 않는다.
- 특히 `/admin/users` 와 운영 요약 카드에서 이 경계를 숨기지 않는다.

## 이번 Phase의 역할별 레인 원칙

### EMPLOYEE
- 기본 시작점은 `/dashboard` 다.
- `/management`, `/admin/users`, `/admin/audit-logs` 는 기본 진입 레인이 아니다.
- 차단 시에는 `권한 없는 운영 메뉴`가 아니라 `현재 업무 권한이 없는 상태`로 읽혀야 한다.

### MANAGER
- 기본 시작점은 `/dashboard` 다.
- 일반 업무 확인 뒤 필요 시 `/management` 로 이동한다.
- `/employees`, `/org` 는 읽기 확인용이고, 회사 전체 관리자 계정관리와 같은 책임으로 쓰지 않는다.

### HR_ADMIN
- 기본 시작점은 `/dashboard` 다.
- 첫 관리자 레인은 `/management` 가 아니라 `/admin/users` 다.
- 인사 운영 검토와 일반 운영 허브를 같은 첫 진입점으로 적지 않는다.

### COMPANY_ADMIN
- 기본 시작점은 `/dashboard` 다.
- `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서의 운영 레인을 확인한다.
- 홈 CTA 와 운영 허브를 같은 묶음으로 적지 않는다.

### AUDITOR
- 기본 시작점은 `/admin/audit-logs` 다.
- 운영 저장/변경 레인이 아니라 read-only 추적 레인부터 시작한다.
- 감사 사용자를 운영 변경 권한 사용자처럼 설명하면 안 된다.

## 이번 Phase의 복구 순서 원칙

### 일반 직원 홈에서 막힐 때
1. `/dashboard` 상태 문장을 먼저 읽는다.
2. 필요 시 `/menu` 로 이동해 허용된 전체 기능을 다시 찾는다.
3. 네트워크 문제면 `/offline` 안내를 본다.
4. 운영/감사 route 를 우회 진입점처럼 안내하지 않는다.

### 운영 허브에서 막힐 때
1. `forbidden` 인지 `error` 인지 먼저 나눈다.
2. `forbidden` 이면 권한 있는 지정 담당자 레인에서만 확인한다.
3. `error` 면 다시 시도 전 `/api/health` 또는 운영 안내 문서를 참고한다.
4. `preview/dev-safe` 는 저장 완료처럼 보고하지 않는다.

### 관리자 계정관리에서 막힐 때
1. `/admin/users` 의 경고 배너와 상태 배너를 먼저 읽는다.
2. `empty` 는 정상 빈 상태일 수 있음을 남긴다.
3. `error` 는 API preview 실패로, `forbidden` 은 권한 차단으로 분리해 적는다.
4. 실제 메일 발송, 외부 IdP, production password policy 는 여전히 승인 게이트로 남긴다.

## 이번 Phase의 구현/문서 산출물

### 필수 문서 산출물
- scope 문서: 이 문서
- handoff 문서: `docs/guides/phase-58-state-copy-recovery-role-lane-handoff.md`
- guide 문서: `docs/guides/phase-58-state-copy-recovery-role-lane-guide.md`

### 후속 구현 카드에서 정리해야 할 것
- 홈/메뉴/운영 허브/관리자 계정관리의 상태 문장 표준화
- `empty` 대 `forbidden`, `error` 대 `offline`, `preview/dev-safe` 대 `실저장 완료` 혼선 제거
- 역할별 첫 진입점과 차단 레인 안내 문장 정리
- route 단위 복구 순서와 UAT 질문 정리
- live 직접 확인 기준과 local preview/test/build 대체 근거 분리

## 이번 Phase에서 하지 않는 것

아래 항목은 이번 Phase 완료와 별개 승인 게이트다.

- production DB 실데이터 변경
- 실제 사용자 초대 메일 발송
- 실제 비밀번호 운영 전환
- 외부 IdP/SSO/SAML/SCIM 연동
- secret 입력/교체
- DNS/custom domain
- 유료 리소스
- native 앱 배포
- migration
- destructive 작업

## 추천 확인 순서

1. `/login`
2. `/dashboard`
3. `/menu`
4. `/management`
5. `/admin/users`
6. `/admin/audit-logs`
7. `/me`
8. 필요 시 `/notifications`
9. 필요 시 `/boards`
10. `/offline`
11. Phase 58 handoff / guide 문서

## 근거 문서

- `docs/architecture/phase-57-home-dashboard-shortcuts-mobile-pc-ia-fit-gap-scope.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-handoff.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md`
- `docs/architecture/phase-56-management-admin-live-operations-pass1-fit-gap-scope.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-handoff.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/guides/phase-47-operational-stability-performance-mobile-pwa-usability-handoff.md`
- `apps/web/dashboard-page-content.tsx`
- `apps/web/menu-page-content.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/admin/users/admin-users-page-content.tsx`
- `apps/web/app/me/page.tsx`
- `apps/web/app/_components/real-usage-panels.tsx`
- `apps/web/app/_components/phase35-live-sections.tsx`
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/contracts.ts`
