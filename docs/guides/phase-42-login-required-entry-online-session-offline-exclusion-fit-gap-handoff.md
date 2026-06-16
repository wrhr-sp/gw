# Phase 42 로그인 필수 진입 정책 handoff

## 한 줄 요약
이번 단계는
로그인 화면을 첫 진입점으로 고정하고,
로그인 전 내부 업무 진입을 전면 차단하며,
`/offline` 을 업무 복구 route 가 아니라 로그인 재시도 안내 수준으로 낮추는 기준을
구현/리뷰/테스트/문서화 체인이 같은 말로 이어받게 만드는 handoff 입니다.

## 지금 바로 이해해야 할 결론
- 새 정책의 핵심은 "온라인 + 로그인 세션 없이는 내부 그룹웨어 기능 진입 불가" 입니다.
- `/login` 만 익명 입구로 두고, `/`, `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/messenger`, `/mail`, `/notifications`, `/uat`, `/management`, `/admin*` 는 익명 접근 차단 대상입니다.
- `/offline` 은 남아도 로그인 재시도 안내 수준이어야 하고, 내부 업무 링크는 제거해야 합니다.
- 자동 로그인은 비밀번호 저장이 아니라 세션 유지 선택입니다.
- 로그인 후에도 `/management`, `/admin*`, 민감 업무 API 는 role/capability/company boundary guard 를 그대로 유지합니다.

## 현재 상태를 쉬운 말로 보면
### 이미 있는 것
- 로그인 화면과 login/logout API 는 이미 있다.
- `gw_session` 쿠키 발급/삭제 골격도 있다.
- `/admin*` 공개 노출 차단 같은 민감 route guard 도 일부 이미 있다.

### 아직 고쳐야 할 것
- 익명 사용자를 `/login` 으로 전면 정리하는 기준이 아직 완전히 닫히지 않았다.
- `/offline` 이 아직도 업무 복구·읽기 route 를 보여 주는 안내 페이지 성격이 강하다.
- login form 에 `자동 로그인` 선택 UI 가 없다.
- 현재 login page 문구는 dev-safe UAT 입구 성격이 강해서, "첫 진입은 로그인만" 정책과 조금 어긋난다.

## 역할별로 바로 할 일

### builder
1. middleware 와 guard 기준을 로그인 필수 진입 정책으로 재정렬한다.
2. `/` 포함 내부 route 익명 접근을 `/login` 또는 401/403 정책으로 차단한다.
3. `/login` 에 자동 로그인 선택 UI 를 추가한다.
4. login/logout/session API 를 자동 로그인 on/off 정책과 맞춘다.
5. `/offline` 을 로그인 안내 수준으로 축소하고 내부 링크를 제거한다.
6. 로그인 후 `/management`, `/admin*`, 민감 API guard 가 깨지지 않게 유지한다.

중요 체크:
- `/admin*` 익명 공개 금지
- 일반 직원의 `/management`, `/admin*` 차단 유지
- 비밀번호 저장 금지

### reviewer
아래를 blocking/non-blocking 으로 나눈다.
- 익명 사용자가 내부 route 또는 내부 API 를 우회 진입할 수 있는지
- `/admin*` 공개 노출이 재발하지 않았는지
- 자동 로그인 구현이 비밀번호 저장처럼 읽히거나 실제로 그렇게 동작하지 않는지
- logout 후 세션이 즉시 지워지는지
- `/offline` 에 내부 업무 링크가 다시 남지 않았는지

### tester
반드시 다시 볼 시나리오:
1. 익명 `/login` 정상
2. 익명 `/` → `/login`
3. 익명 내부 route 차단
4. 익명 내부 API 401/403
5. 로그인 후 역할별 landing
6. 자동 로그인 on/off 차이
7. logout 후 세션/자동 로그인 해제
8. PC/모바일에서 같은 정책 유지
9. `/offline` 이 로그인 안내만 보여 주는지
10. `/management`, `/admin*`, 민감 API guard 회귀

### docs
- PRD: 로그인 필수 진입 원칙 추가
- SPEC: 로그인 전 허용/차단, 자동 로그인, 오프라인 제외 원칙 추가
- TEST_PLAN: 익명 차단/자동 로그인/오프라인 안내 축소 검증 추가
- QA_CHECKLIST: 로그인 전면 차단과 `/offline` 링크 제거 점검 추가
- HANDOFF/TASKS/KNOWN_ISSUES: 현재 체인과 Phase 42 리스크 반영

### ops
- review/test 완료 후 PR/CI/merge/release gate 정리
- 배포 전 smoke 에서 `/login`, 익명 `/`, 익명 `/admin`, login 후 `/dashboard`, login 후 `/management` 를 우선 확인

## 추천 확인 순서
1. `docs/architecture/phase-42-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
2. `apps/web/middleware.ts`
3. `apps/web/admin-preview-guard.ts`
4. `apps/web/app/login/page.tsx`
5. `apps/web/app/login/login-form.tsx`
6. `apps/web/app/offline/page.tsx`
7. `apps/api/src/app.ts`
8. `apps/web/admin-preview-guard.test.ts`
9. `apps/web/phase38-offline-admin.test.tsx`
10. `apps/web/api-same-origin-bridge.test.ts`

## 이번 체인에서 꼭 같은 말로 유지할 문장
- 첫 진입은 아이디/비밀번호 로그인 화면이다.
- 로그인 전에는 내부 그룹웨어 기능에 진입할 수 없다.
- 자동 로그인은 세션 유지 선택이지 비밀번호 저장이 아니다.
- `/offline` 은 업무 복구 route 가 아니라 로그인 재시도 안내다.
- 로그인 후에도 관리자/경영업무/민감 업무는 별도 guard 를 유지한다.

## 남은 승인 게이트
- production DB 실데이터
- secret 입력/교체/출력
- DNS/custom domain
- 유료 리소스
- 외부 SSO/OAuth/SMS/OTP
- migration
- destructive/force 작업

## 대장이 나중에 최종 보고에서 보면 좋은 확인 포인트
- `/login`
- 익명 `/` 진입 결과
- 익명 `/dashboard` 와 `/admin` 진입 결과
- 로그인 후 `/dashboard`
- 역할별 `/management` / `/admin*` 허용·차단 결과
- `/offline` 페이지가 업무 링크 없이 로그인 안내만 주는지
