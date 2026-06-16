# Phase 42A 로그인 필수 진입 정책 handoff

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
### 지금 확인된 것
- 로그인 화면과 login/logout API 는 현재 워크스페이스 기준으로 다시 통과했다.
- `gw_session` 쿠키 발급/삭제와 rememberSession on/off 차이도 local smoke 에서 다시 확인됐다.
- `/admin*` 공개 노출 차단, 익명 `/`·`/dashboard`·`/management` 차단, `/offline` 축소 copy 도 최신 테스트에서 재확인됐다.

### release gate 전에 마지막으로 다시 볼 것
- `admin / 1234` dev-safe fallback 이 운영 경계 밖에서 남지 않는지
- API 요청에서 `rememberSession` 기본값이 명시적 opt-in 원칙을 깨지 않는지
- 문서가 최신 tester 결과와 reviewer 메모를 서로 모순 없이 설명하는지

## 역할별로 바로 할 일

### builder
- 현재 구현/테스트 기준은 이미 닫혔다.
- release gate 에서 reviewer 메모가 다시 열리면 `admin / 1234` fallback 과 API 기본 rememberSession 처리만 우선 교차확인하면 된다.

### reviewer
- 이전 리뷰 이력에는 `admin / 1234` dev-safe fallback 과 API 기본 rememberSession opt-in 보장 여부를 release gate 전 다시 보라는 메모가 남아 있다.
- route 차단, `/admin*` 공개 노출 금지, `/offline` 내부 링크 제거는 최신 tester 재검증에서 다시 통과했다.

### tester
최신 재검증에서 아래가 모두 통과했다.
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
- HANDOFF/TASKS/KNOWN_ISSUES: 현재 체인 상태, latest tester 근거, reviewer 교차확인 메모 반영

### ops
- 문서화 완료 후 PR/CI/merge/release gate 정리
- 배포 전 smoke 에서 `/login`, 익명 `/`, 익명 `/admin`, login 후 `/dashboard`, login 후 `/management` 를 우선 확인
- reviewer 메모(`admin / 1234` fallback, API 기본 rememberSession opt-in)를 최종 merge 전에 다시 교차확인

## 추천 확인 순서
1. `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
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

## 최신 재검증 근거
- focused shared/API/Web 회귀, 전체 `pnpm check`, Next.js build, OpenNext Cloudflare build, local preview smoke 가 모두 통과했다.
- local preview smoke(`127.0.0.1:8793`)에서 익명 `/`, `/dashboard`, `/management` 는 `/login` 으로 redirect 되고 `/login` 은 200 이었다.
- `rememberSession=true` 는 `Max-Age=2592000`, `rememberSession=false` 는 세션 쿠키로 차이가 확인됐다.
- general host `/admin -> /login`, admin host `/ -> /admin`, manifest split 도 다시 확인됐다.
