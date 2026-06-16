# Phase 38 모바일·PC 현장 업무 사용성·알림·오프라인 fit-gap handoff

## 1. 이 문서가 필요한 이유

이번 handoff는 Phase 38을 "새 외부 연동을 붙이는 단계"가 아니라
"이미 있는 홈/메뉴/알림/오프라인 안내/운영 분리 구조를 과장 없이 같은 언어로 묶는 단계"로 이해하게 만들기 위한 것이다.

직전까지는 아래 흐름이 각각 따로 읽혔다.

- `/dashboard` 의 홈 역할
- `/menu` 와 PC sidebar 의 같은 정보구조
- `/notifications` 의 same-origin inbox
- `/offline` 의 제약 안내
- `/management`·`/admin*` 운영 레인 분리

이번 문서의 목적은 이 다섯 축을 하나의 "현장 업무 사용성" 문장으로 다시 연결하는 것이다.

## 2. 이번 Phase 38을 쉬운 말로 설명하면

"직원이 모바일/PC에서 어디부터 눌러야 하는지, 어디서 막히는지,
어디까지는 지금 바로 확인 가능하고 어디부터는 아직 외부 연동/승인 게이트인지
헷갈리지 않게 다시 선 긋는 단계"다.

즉,

- 홈은 `/dashboard` 로 읽는다.
- 메뉴는 모바일/PC가 같은 정보구조를 가리킨다.
- 알림은 same-origin inbox 로 읽되 외부 발송 완료처럼 쓰지 않는다.
- 오프라인은 가능한 일/막히는 일/재시도 절차를 분리해 읽는다.
- 관리자/감사/경영업무는 일반 직원 홈과 별도 운영 레인으로 읽는다.

## 3. 지금 바로 확인 가능한 것

### A. `/dashboard` 와 `/menu`

지금 바로 읽을 수 있는 것:
- 대시보드를 홈처럼 읽는 첫 행동 구조
- 회사 공통 고정 shortcut 과 권한 기반 사용자 전용 shortcut
- 모바일 하단 탭 5개와 전체 메뉴의 같은 탐색 구조
- 운영 메뉴와 일반 메뉴 분리

지금 과장하면 안 되는 것:
- 사용자별 drag-and-drop 편집 UX 완성
- 개인 shortcut 영구 저장 완성
- 외부 앱 런처 수준의 커스터마이징 완성

### B. `/notifications`

지금 바로 읽을 수 있는 것:
- same-origin inbox 항목
- 미읽음 수
- notices 와 운영 가드레일 문구
- `/dashboard` 와 `/menu` 로 이어지는 보조 허브 역할

지금 과장하면 안 되는 것:
- 외부 push 발송 완료
- 메일/SMS/메신저 통합 발송
- 읽음 처리 영구 저장 확대 완료
- background sync 완료

### C. `/offline`

지금 바로 읽을 수 있는 것:
- 읽기 중심으로 가능한 일
- 상태 변경이라서 지금 막아야 하는 일
- 재시도 절차
- 관리자 offline 레인의 별도 제약

지금 과장하면 안 되는 것:
- offline 상태 변경 성공
- 완전한 offline sync
- 현장 데이터 자동 보관 보장
- 관리자 최신성 판단 가능

### D. `/management`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`

지금 바로 읽을 수 있는 것:
- 일반 업무와 다른 운영 전용 레인
- 권한 있는 사용자만 보는 운영 메뉴
- 정책/권한/감사 검토 흐름
- 감사 read-only 와 회사 경계

지금 과장하면 안 되는 것:
- 일반 직원 홈과 같은 제품 책임
- 운영 변경 저장 완료
- 외부 인증/실계정/실데이터 운영 완료

## 4. 사용자/운영자 빠른 사용 가이드

### 일반 직원/팀장 기준으로 가장 짧게 따라가는 순서

권장 순서:
1. `/dashboard` — 오늘 먼저 할 일을 고르는 홈
2. `/menu` — 같은 정보구조로 전체 기능을 다시 확인하는 메뉴
3. `/notifications` — same-origin inbox 와 미읽음 수 확인
4. `/offline` — 연결이 끊겼을 때 가능한 일/막히는 일/재시도 절차 확인
5. `/attendance` → `/leave` → `/approvals` — 실제 업무 화면으로 이동

볼 때 주의할 점:
- 홈 바로가기는 회사 공통 고정 항목 + 권한 기반 사용자 전용 항목으로 읽는다.
- 아직 사용자별 drag-and-drop 편집, 영구 저장, 외부 앱 런처 수준 커스터마이징 완성으로 읽지 않는다.
- 알림 탭은 외부 push 발송 결과판이 아니라 same-origin inbox 보조 허브로 읽는다.
- 오프라인 화면은 "지금 저장됐다"가 아니라 "지금은 읽기 중심이고 상태 변경은 online-only" 안내로 읽는다.

### 운영자/감사 기준으로 가장 짧게 따라가는 순서

권장 순서:
1. `/dashboard` — 일반 홈과 운영 레인이 어디서 갈라지는지 확인
2. `/management` — `경영업무` 가 일반 업무와 분리된 관리자 허브인지 확인
3. `/admin/users`
4. `/admin/policies`
5. `/admin/audit-logs`
6. `/offline` — 관리자 오프라인 안내가 최신성/권한 변경 제약을 숨기지 않는지 확인

볼 때 주의할 점:
- 일반 host 에서는 `/admin` 직접 진입이 일반 업무처럼 열리지 않아야 한다.
- admin host `/offline` 는 관리자 복구 범위 안에서만 보여야 하고 일반 업무 route 를 섞지 않아야 한다.
- `audit.read` 같은 권한 경계, company/branch scope, route/API guard 를 메뉴 노출과 같은 뜻으로 읽지 않는다.

### 테스트 계정과 계정 문구

- 테스트 계정은 dev/test/UAT 전용 `admin / 1234` 다.
- production 기본 계정처럼 적지 않는다.
- 최종 보고나 후속 handoff 에서도 이 계정은 "문서 확인용/검증용" 으로만 적는다.

## 5. 이번에 기준 근거로 본 파일

문서 기준:
- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`
- `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md`
- `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`
- `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`
- `docs/architecture/phase-34-hr-branch-notifications-audit-real-usage-scope.md`
- `docs/guides/phase-34-hr-branch-notifications-audit-real-usage-handoff.md`
- `docs/architecture/phase-36-admin-settings-company-policy-permission-fit-gap-scope.md`
- `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md`
- `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`
- `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md`

구현/계약 기준:
- `packages/shared/src/contracts.ts`
- `packages/shared/src/mobile-contracts.ts`
- `apps/web/app/page.tsx`
- `apps/web/dashboard-page-content.tsx`
- `apps/web/app/menu/page.tsx`
- `apps/web/menu-page-content.tsx`
- `apps/web/app/notifications/page.tsx`
- `apps/web/app/offline/page.tsx`
- `apps/web/app/_components/mobile-app-shell.tsx`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/home-shortcuts.ts`
- `apps/api/src/app.ts`

테스트 기준:
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/menu-page-content.test.tsx`
- `apps/web/phase34-real-usage.test.tsx`
- `apps/api/test/auth-org.spec.ts`

## 6. 이번 문서가 근거로 삼는 실제 재검증

이번 문서는 parent 재검증 완료 결과를 그대로 근거로 삼는다.

실제 실행된 검증 명령:
- `pnpm --filter @gw/web test -- admin-preview-guard.test.ts dashboard-boundary.test.tsx phase38-offline-admin.test.tsx`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- `pnpm check`
- `pnpm --filter @gw/web build:cf`
- `PREVIEW_PORT=8787 BASE_URL=http://127.0.0.1:8787 bash scripts/gw-admin-host-preview-smoke.sh`

문서에 바로 반영해야 하는 판정:
- 일반 host `/offline` 는 공용 복구 범위(`/dashboard`, `/menu`, `/notifications`, `/offline`)를 유지하고 `/admin/users` 를 섞지 않는다.
- admin host `/offline` 는 관리자 복구 범위(`/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/offline`)를 유지하고 일반 업무 route 를 섞지 않는다.
- local preview smoke 기준 일반 host `/admin` 은 `/login` 으로, admin host `/` 는 `/admin` 으로 경계가 다시 확인됐다.
- 현재 범위에서는 재현되는 차단 blocker 가 없었고, 이번 문서 작업은 그 검증 결과와 같은 언어를 유지해야 한다.

## 7. 다음 작업자가 문장을 쓸 때 반드시 지킬 것

1. `/dashboard` 를 홈으로 적되, 실제 업무 화면과 다른 별도 마케팅 랜딩처럼 쓰지 말 것
2. `/menu` 와 PC sidebar 를 다른 정보구조처럼 쓰지 말 것
3. `/notifications` 를 외부 push/메일 발송 완료 뜻처럼 쓰지 말 것
4. `/offline` 안내를 offline 상태 변경 성공처럼 쓰지 말 것
5. 관리자/감사/경영업무 레인을 일반 직원 홈과 같은 책임처럼 섞지 말 것
6. push/background sync/native 배포/custom domain/secret/production 실데이터는 계속 승인 게이트로 남길 것

## 8. 대장이 가장 짧게 다시 볼 추천 순서

1. `docs/architecture/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-scope.md`
2. `/dashboard`
3. `/menu`
4. `/notifications`
5. `/offline`
6. `/attendance`
7. `/leave`
8. `/approvals`
9. `/management`
10. `/admin/users`
11. `/admin/policies`
12. `/admin/audit-logs`

## 9. 이번 Phase에서 남겨야 하는 fit-gap 메모

### 지금 이미 근거가 있는 것
- 홈 shortcut API 와 notices/load error 분리 구조가 있다.
- 모바일 하단 탭, 전체 메뉴, PC sidebar 가 같은 nav 정의를 공유한다.
- notifications same-origin inbox/unread count/notices 구조가 있다.
- offline 안내와 status banner 가 가능한 일/막히는 일/재시도 절차를 분리한다.
- 운영 메뉴와 일반 메뉴 분리, `경영업무` 별도 레인, `audit.read` 경계 근거가 있다.

### 아직 비어 있거나 별도 승인인 것
- 외부 push/SMS/메일 발송
- background sync
- 홈 shortcut 개인 편집/정렬 UX 완성
- native app 패키징/스토어 배포
- production custom domain/app link
- 운영 secret/실데이터/실계정/외부 인증 연동

## 10. 후속 구현이 필요하면 먼저 분리할 카드 종류

- 구현 카드: 홈 shortcut 사용성, 메뉴 정보구조, 알림/오프라인 copy, 접근성 보강
- 리뷰 카드: 일반 업무와 운영 레인 분리, 권한 경계, 가짜 성공 UX 금지 확인
- 테스트 카드: mobile/PC nav, role별 route/API, notifications/offline focused 회귀
- 문서 카드: scope/handoff/루트 문서/운영 체크리스트 업데이트

한 카드에서 외부 발송, push, secret, production 실데이터, native 배포까지 같이 밀어 넣지 않는 것이 중요하다.

## 11. 최종 한 줄 메모

Phase 38은 "모바일·PC 현장 업무 입구와 예외 안내를 실제 외부 연동 완성처럼 보이지 않게 정리하는 문서 단계"이며, 홈·메뉴·알림·오프라인·운영 경계를 같은 언어로 맞추는 것이 완료 기준이다.
