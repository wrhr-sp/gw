# Phase 42 로그인 필수 진입 정책 fit-gap 범위

## 한 줄 요약
Phase 42의 목표는
모든 내부 그룹웨어 기능을 "온라인 + 로그인 세션 이후"에만 열리게 다시 고정하고,
`/login` 을 유일한 첫 진입점으로 정리하며,
`/offline` 을 업무 복구 입구가 아니라 로그인 안내 수준으로 축소하는 것입니다.

쉽게 말하면 이번 단계는
"무슨 기능을 더 만들까"보다
"로그인 전에는 어디까지 막고, 로그인 후에는 어디까지 열고, 민감 업무는 어떻게 한 번 더 막을까"를 정리하는 단계입니다.

## 왜 지금 이 단계가 필요한가
현재 저장소에는 이미
`/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/notifications`, `/management`, `/admin*` 같은 route 와
same-origin 세션/API 골격이 있습니다.

하지만 현재 상태는 아래가 섞여 있습니다.

1. 로그인 화면은 이미 있지만 `admin / 1234` 중심 dev-safe UAT 안내와 역할 미리보기 성격이 강합니다.
2. middleware 는 주로 admin/public host 경계와 일부 redirect 를 관리하고, "비로그인 시 전 내부 route 차단"을 전면 기준으로 설명하지는 않습니다.
3. `/offline` 페이지와 관련 설정은 아직도 사용자에게 읽기/복구 route 를 보여 주는 skeleton 성격이 남아 있습니다.
4. 자동 로그인은 명시적 선택 UI 없이 세션 쿠키 유지 중심으로만 보입니다.
5. 로그인 후 관리자/경영업무/민감 업무 guard 는 이미 일부 있지만, 로그인 전면 차단 정책과 한 세트 언어로 다시 묶여 있지 않습니다.

따라서 이번 Phase의 목적은
새 인증 방식을 늘리는 것이 아니라
이미 있는 세션/가드/route 구조를 "로그인 필수 진입" 기준으로 다시 정렬하는 것입니다.

## 확정 요구사항
- 4~6자리 코드/PIN 첫 진입은 취소한다.
- 첫 진입은 아이디/비밀번호 로그인 화면이다.
- 로그인 전에는 그룹웨어 내부 기능에 절대 진입할 수 없다.
- PC/모바일 모두 로그인 화면에서 `자동 로그인` 선택을 제공한다.
- 오프라인 사용/오프라인 복구/오프라인 기능 진입은 없다.
- `/offline` 은 남기더라도 온라인 연결 후 로그인 안내 수준이어야 하며 내부 업무 링크를 제공하지 않는다.
- 로그인 후에도 관리자/경영업무/민감 업무는 역할 권한, route guard, API guard 를 유지한다.

## 현재 구현 기준 fit-gap 요약

### 이미 있는 근거
- `apps/web/middleware.ts`
  - 모든 비정적 페이지 요청을 미들웨어에 태운다.
  - 다만 실제 차단 규칙은 `getAdminRouteGuardResult(...)` 에 위임한다.
- `apps/web/admin-preview-guard.ts`, `apps/web/admin-preview-guard.test.ts`
  - 공개 general host 에서 `/admin*` 노출을 막는 경계가 이미 있다.
  - 즉 "민감 route 별도 차단"은 이미 일부 성립한다.
- `apps/api/src/app.ts`
  - 로그인/로그아웃 시 `gw_session` 쿠키를 발급·삭제한다.
  - `Max-Age` 기반 세션 유지와 로그아웃 시 `Max-Age=0` 해제가 이미 있다.
- `apps/api/src/lib/operational-auth.ts`
  - `/api/me` 등 인증 전제 API 흐름의 기반이 있다.
- `apps/web/api-same-origin-bridge.test.ts`
  - 로그아웃 시 세션 쿠키 삭제 헤더 근거가 있다.
- `apps/web/app/login/page.tsx`, `apps/web/app/login/login-form.tsx`
  - 아이디/비밀번호 입력, 역할별 landing 안내, 로그인/로그아웃 dev-safe 설명이 이미 있다.
- `apps/web/phase38-offline-admin.test.tsx`, `apps/web/mobile-pwa.test.ts`
  - `/offline` 과 일반/admin host 분리, 복구 route 노출, 오프라인 copy 가 테스트에 이미 묶여 있다.

### 현재 요구를 이미 부분 충족하는 영역
1. 아이디/비밀번호 로그인 입구 존재
   - `/login` 화면과 login API 는 이미 있다.
2. 로그인 후 세션 유지/로그아웃 해제 골격 존재
   - `gw_session` 쿠키 발급과 삭제가 이미 있다.
3. 관리자/민감 업무 별도 guard 존재
   - `/admin*`, `/management`, 일부 API 는 role/capability 차단 근거가 있다.
4. 로그인 후 역할별 첫 이동 설명 존재
   - login page 에 role landing 안내가 이미 있다.

### gap 이 큰 영역
1. 비로그인 전면 차단 불완전
   - 현 middleware 는 존재하지만, `/login` 외의 일반 업무 route 전체를 익명 상태에서 `/login` 으로 몰아넣는 정책이 문서/테스트/구현 한 세트로 아직 고정되지 않았다.
   - 특히 `/` 과 일부 일반 안내 route 는 현재 공개 입구처럼 남아 있을 가능성이 크다.
2. `/offline` 정책 충돌
   - 현재 `/offline` 페이지는 읽기/복구 route, 업무별 오프라인 판정, 설치 후 확인 화면 등을 보여 준다.
   - 새 정책은 "업무 복구 경로 제거"이므로 현재 구조와 직접 충돌한다.
3. 자동 로그인 UI 부재
   - login form 에는 `자동 로그인` on/off 선택 UI 가 아직 없다.
   - API 세션도 현재는 선택형이 아니라 고정 `Max-Age` 세션 유지로 읽힌다.
4. 로그인 화면의 문맥 불일치
   - 현재 login page 는 Phase 31 dev-safe UAT 입구, 홈으로 돌아가기, 역할 미리보기 중심이다.
   - 새 정책은 "첫 진입은 로그인만"이므로 홈 복귀/사전 내부 링크 노출을 줄여야 한다.
5. 테스트/문서 기준 미정렬
   - Phase 38/40/41 문서와 테스트는 `/offline`, `/uat`, 공개 route 일부를 전제로 쓴 부분이 있어 새 정책과 다시 맞춰야 한다.

## route 정책 기준

### 로그인 전 허용
- `/login`
- 로그인 처리 API
- 정적 자산
- 최소 health

### 로그인 전 차단
- `/`
- `/dashboard`
- `/menu`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/messenger`
- `/mail`
- `/notifications`
- `/uat`
- `/management`
- `/admin*`
- 내부 업무 API

### 로그인 후에도 별도 guard 유지
- `/management`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- 민감 work item / payroll / 운영 API

## 구현 범위

### 1. web route 진입 재정렬
- 일반 host 와 admin host 모두에서 로그인 전 허용 route 를 최소화한다.
- `/` 는 공개 홈이 아니라 `/login` redirect 또는 동등한 로그인 입구가 되게 정리한다.
- `/login` 에서 내부 업무 링크를 사전 노출하지 않게 copy 와 CTA 를 줄인다.

### 2. login 화면 정책 정리
- 아이디/비밀번호 입력을 첫 진입 기준으로 고정한다.
- `자동 로그인` 체크 UI 를 추가한다.
- 자동 로그인은 비밀번호 저장이 아니라 세션 유지 정책 선택이라는 문구를 같이 둔다.
- 로그아웃 시 자동 로그인도 해제된다는 설명/동작을 맞춘다.

### 3. session 정책 정리
- 로그인 API 가 자동 로그인 on/off 에 따라 세션 만료 정책을 다르게 줄 수 있게 정리한다.
- 세션 저장은 쿠키/secure session 기준으로 두고, 비밀번호 재사용 저장은 금지한다.
- `/api/me`, 내부 업무 API, logout 흐름이 같은 정책을 쓰게 맞춘다.

### 4. `/offline` 축소 또는 안내화
- `/offline` 은 업무 재개 route 목록을 보여 주지 않는다.
- 남기더라도 "네트워크 연결 후 다시 로그인하세요" 수준으로 축소한다.
- `/dashboard`, `/menu`, `/notifications`, `/admin*` 등 내부 업무 링크를 제거한다.
- Phase 38 오프라인/복구 문구는 이번 정책과 충돌하지 않게 다시 정리한다.

### 5. 로그인 후 민감 경계 유지
- 일반 직원 레인과 경영업무/관리자 레인을 계속 분리한다.
- UI 숨김만이 아니라 middleware, route guard, API guard, capability 검증을 유지한다.
- review/test 문서에는 "로그인 전 차단"과 "로그인 후 추가 차단"을 별도 축으로 적는다.

## 테스트 시나리오

### A. 익명 사용자
- `/login` 은 200 또는 정상 렌더링
- `/` 는 `/login` 으로 redirect 또는 동등한 로그인 진입
- `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/notifications`, `/uat`, `/management`, `/admin*` 는 익명 접근 차단
- `/api/me` 및 내부 업무 API 는 401/403 유지
- `/offline` 이 남아 있으면 내부 링크 없이 로그인 안내만 보임

### B. 로그인 사용자
- 아이디/비밀번호 로그인 성공 후 역할별 landing 정상 이동
- 일반 직원은 일반 업무만 허용, 경영업무/관리자 route 는 계속 차단
- 관리자/감사/HR 역할은 허용된 운영 route 만 접근

### C. 자동 로그인
- 체크 on: 브라우저 재방문 시 세션 유지
- 체크 off: 브라우저 종료/세션 만료 기준이 더 짧거나 재로그인 요구
- 로그아웃: 세션 해제 + 자동 로그인 선택 해제

### D. PC/모바일 공통
- `/login` 에서 같은 정책과 비슷한 정보구조 유지
- mobile shell 이 로그인 전 내부 탭/메뉴를 여는 구조로 남지 않음
- PWA/install 안내가 "오프라인 업무 가능"처럼 읽히지 않음

### E. 회귀
- `/admin*` 공개 노출 차단 유지
- `/management` 민감 허브 차단 유지
- API role/capability/company boundary 회귀 유지

## 승인 게이트
- production DB 실데이터
- secret 입력/교체/출력
- DNS/custom domain
- 유료 리소스
- 외부 SSO/OAuth/SMS/OTP
- migration
- destructive/force 작업

## 역할별 후속 작업 기준
- builder: middleware/login/offline/session/API 정책 구현
- reviewer: 인증 우회, role/capability 우회, 자동 로그인 보안, 공개 admin 노출 재검토
- tester: 익명 차단, 자동 로그인 on/off, logout 해제, PC/모바일 경로, API guard 재검증
- docs: PRD/SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF/KNOWN_ISSUES 를 로그인 필수 진입 정책 기준으로 재정렬
- ops: review/test 완료 후 PR/CI/merge/release gate 정리

## 이번 Phase에서 의도적으로 하지 않는 것
- 실운영 외부 인증 도입
- PIN/OTP/SMS 기반 첫 진입 재설계
- offline sync/background sync
- production 계정 운영정책 확정
- 실민감 원문/실지급/실신고/실외부 연동 확대

## 바로 참고할 파일
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/app/login/page.tsx`
- `apps/web/app/login/login-form.tsx`
- `apps/web/app/offline/page.tsx`
- `apps/web/mobile-pwa.test.ts`
- `apps/web/phase38-offline-admin.test.tsx`
- `apps/web/api-same-origin-bridge.test.ts`
- `apps/api/src/app.ts`
- `apps/api/src/lib/operational-auth.ts`
- `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`
- `docs/architecture/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-scope.md`
- `docs/architecture/phase-41-boards-notices-documents-approvals-daily-operations-adoption-fit-gap-scope.md`
