# Phase 58 상태 문장, 복구 안내, 역할별 차단 레인 handoff

## 이 문서의 목적

다음 작업자가 Phase 58을 다시 해석하지 않도록,
현재 코드에서 이미 확인 가능한 상태 문장과 역할별 레인 분리 근거,
그리고 이번 Phase에서 반드시 지켜야 할 복구 문장을 쉬운 한국어로 묶어 넘긴다.

## 이번 Phase의 핵심 해석

- `loading`, `empty`, `error`, `forbidden`, `offline`, `dev-safe` 는 서로 다른 뜻이다.
- 홈(`/dashboard`)과 메뉴(`/menu`)의 상태 문장은 운영 허브(`/management`)와 관리자 계정관리(`/admin/users`)에서도 같은 기준을 유지해야 한다.
- `forbidden` 은 로그인 실패가 아니라 현재 업무 권한/범위 차단 상태다.
- `empty` 는 정상 빈 상태일 수 있으며 실패처럼 과장하면 안 된다.
- `error` 는 API/조회 실패이고, `offline` 은 네트워크 불안정 상태다.
- `preview`, `dev-safe`, `참고용 요약 데이터`, `내부 확인용 데이터`는 실저장/실발송/실반영 완료와 같은 뜻이 아니다.
- 역할별 첫 진입점은 계속 분리한다.
  - EMPLOYEE, MANAGER, HR_ADMIN, COMPANY_ADMIN: `/dashboard`
  - AUDITOR: `/admin/audit-logs`
- HR_ADMIN의 첫 관리자 레인은 `/management` 가 아니라 `/admin/users` 다.
- AUDITOR 는 운영 변경 레인이 아니라 read-only 감사 레인부터 시작한다.

## 지금 바로 볼 파일

### 기획 문서
- `docs/architecture/phase-58-state-copy-recovery-role-lane-fit-gap-scope.md`
- `docs/architecture/phase-57-home-dashboard-shortcuts-mobile-pc-ia-fit-gap-scope.md`
- `docs/architecture/phase-56-management-admin-live-operations-pass1-fit-gap-scope.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`

### 웹 구현
- `apps/web/dashboard-page-content.tsx`
- `apps/web/menu-page-content.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/admin/users/admin-users-page-content.tsx`
- `apps/web/app/me/page.tsx`
- `apps/web/app/notifications/page.tsx`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/_components/real-usage-panels.tsx`
- `apps/web/app/_components/phase35-live-sections.tsx`

### shared / access
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/contracts.ts`

## 구현 단계에서 먼저 볼 질문

1. 같은 상태를 화면마다 다른 뜻으로 설명하고 있지 않은가?
2. `empty` 와 `forbidden`, `error` 와 `offline`, `preview/dev-safe` 와 `실저장 완료`가 섞이지 않는가?
3. 홈/메뉴/운영 허브/관리자 계정관리에서 복구 안내 순서가 제각각이지 않은가?
4. EMPLOYEE, MANAGER, HR_ADMIN, COMPANY_ADMIN, AUDITOR 의 첫 진입점과 차단 레인이 같은 문장으로 유지되는가?
5. `HR_ADMIN → /admin/users`, `AUDITOR → /admin/audit-logs`, `MANAGER → /management` 흐름이 `/dashboard` 일반 홈과 섞이지 않는가?
6. `same-origin API 응답을 불러오는 중입니다.` 와 `실제 API 응답을 불러오는 중입니다.` 같은 기존 query state 문장을 임의로 깨지 않고 더 쉬운 복구 문장으로 연결할 수 있는가?
7. `forbidden` 상태에서 숨겨진 운영 route 로 우회하라고 읽히는 문장이 남아 있지 않은가?

## 리뷰 단계에서 꼭 다시 볼 것

- `/dashboard` 상태 카드의 뜻이 `/menu` 와 충돌하지 않는지
- `/management` 상태 가이드가 일반 직원 홈 CTA 와 섞이지 않는지
- `/admin/users` 의 `forbidden / empty / error / dev-safe` 경계가 실제 운영 저장 완료처럼 보이지 않는지
- `/me` 의 상태 안내가 관리자 설정 화면처럼 과장되지 않는지
- `/notifications`, `/boards` 같은 부가 화면의 상태 안내도 같은 언어 체계를 유지하는지
- 역할별 첫 진입 route 와 차단 route 가 문서, UI, 테스트에서 같은 뜻인지

## 테스트 단계에서 꼭 다시 볼 것

- 익명 시작점은 `/login` 단독으로 유지되는지
- 권한 없는 세션이 `/management`, `/admin/users`, `/admin/audit-logs` 를 정상 홈 확장처럼 보지 않는지
- `empty` 를 정상 빈 상태로 읽을 수 있는지
- `forbidden` 을 로그인 실패나 네트워크 오류처럼 읽지 않는지
- `error` 와 `offline` 에서 재시도/복구 경로가 서로 다른지
- `preview/dev-safe` 문구가 실제 저장/발송 성공처럼 보이지 않는지
- live 직접 확인 근거와 local preview/build/test 근거가 섞이지 않는지

## 문서화 단계에서 이어서 볼 것

아래 내용은 `docs/guides/phase-58-state-copy-recovery-role-lane-guide.md` 에 쉬운 한국어 guide 로 묶어 둔다.

- 상태별 뜻과 복구 방법
- 역할별 첫 진입점과 차단 레인
- 홈/메뉴/운영 허브/관리자 계정관리 추천 확인 순서
- UAT 절차
- route별 UAT 체크리스트
- 운영 체크리스트
- 최종 보고에 넣을 문장
- 승인 게이트 목록

## 현재 연결된 Kanban 체인

- 기획: `t_be97eac9`
- 구현: `t_c85c5588`

## 구현 카드에 넘겨야 할 최소 acceptance

- 홈(`/dashboard`)과 메뉴(`/menu`)에서 상태 카드와 복구 문장이 같은 체계로 읽힌다.
- `/management` 는 민감 운영 레인으로 남고, `forbidden / empty / error / loading` 이 홈과 같은 말이되 같은 책임으로 섞이지 않는다.
- `/admin/users` 는 `forbidden / empty / error / dev-safe` 경계를 더 분명히 읽히게 하되 실저장 완료처럼 과장하지 않는다.
- `/me` 는 세션·권한·개인 확인 레인으로 남고, 관리자 설정 화면처럼 보이지 않는다.
- 역할별 첫 진입점과 차단 레인이 화면 copy 와 route 안내에서 다시 확인된다.

## 계속 승인 게이트로 남기는 것

- production DB 실데이터 변경
- 실제 초대 메일 발송
- 외부 IdP/SSO/SAML/SCIM
- 실제 비밀번호 운영 전환
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
8. `/offline`
9. Phase 58 scope 문서
