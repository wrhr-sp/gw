# Phase 14 실사용 MVP 통합 1차 handoff

한 줄 요약:
이번 1차는 새로운 업무 엔진을 여는 단계가 아니라,
이미 있는 홈/로그인/대시보드/일반 업무/관리자 Production-ready (실구현) 을
"사내 검토자가 한 흐름으로 눌러 볼 수 있는 MVP 초안"으로 묶는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 것:

- 홈(`/`)과 로그인(`/login`) 시작점
- `/dashboard` 오늘 할 일 중심 대시보드
- `/org`, `/employees` 일반 조회 흐름
- `/attendance` effective policy 기반 근태 Production-ready (실구현)
- `/approvals` 모바일 전자결재 Production-ready (실구현)
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 관리자 콘솔 Production-ready (실구현)
- dev-safe / Production-ready (실구현) / 권한 경계 원칙

아직 부족한 것:

- 각 화면이 따로는 보여도, 한 명의 사용자가 제품을 연속으로 써 보는 느낌은 아직 약합니다.
- 홈과 로그인 문구가 최신 대시보드/일반 업무/관리자 흐름까지 충분히 소개하지 못합니다.
- 대시보드에서 각 하위 화면으로 이어지는 이유가 더 선명해야 합니다.
- 일반 업무 흐름과 관리자 검토 흐름을 같은 MVP 안에서 어떻게 보여 줄지 handoff 가 더 필요합니다.

즉, 이번 단계의 핵심은 기능 추가보다 "흐름 연결"입니다.

## 2. 이 MVP를 어떻게 이해하면 되는가

### 일반 직원 관점

기본 흐름:

- `/`
- `/login`
- `/dashboard`
- `/attendance`
- `/approvals`
- `/org`
- `/employees`

기대하는 경험:

- 오늘 할 일을 먼저 찾는다.
- 내 상태/내 승인 대기를 먼저 읽는다.
- 조직/직원은 조회용 화면으로 이해한다.
- 관리자 기능은 기본 흐름에 섞여 보이지 않는다.

### 팀장/결재자 관점

기본 흐름:

- `/dashboard`
- 승인/대기 요약
- `/approvals`
- 필요 시 `/employees`

기대하는 경험:

- 내가 처리해야 할 승인 대기가 먼저 보인다.
- 팀 관련 대기 흐름도 approvals 로 이어진다.
- 관리자 기능과 결재 기능이 섞이지 않는다.

### 인사/운영 관리자 관점

기본 흐름:

- `/dashboard` 의 권한 기반 CTA
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`

기대하는 경험:

- 일반 업무 화면과 운영 검토 화면의 목적이 다름을 안다.
- 저장보다 diff/candidate/audit preview 가 먼저 보인다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토가 다르다는 점이 분명하다.

### 감사 전용 사용자 관점

기본 흐름:

- `/admin/audit-logs`

기대하는 경험:

- 전체 관리자 허브보다 감사 조회 화면이 먼저다.
- 마스킹/회사 경계/조회 전용 원칙이 유지된다.

## 3. 이번 Phase에서 고정할 핵심 결정

### 1) MVP 흐름은 일반 업무와 관리자 검토를 나눠 본다.

- 일반 업무: `/`, `/login`, `/dashboard`, `/org`, `/employees`, `/attendance`, `/approvals`
- 관리자 검토: `/dashboard` 권한 기반 CTA, `/admin/*`

즉 "한 앱 안의 두 흐름"으로 이해하면 됩니다.

### 2) 홈과 로그인은 최신 제품 흐름의 안내판 역할을 해야 한다.

홈과 로그인에서 적어도 아래가 자연스럽게 읽혀야 합니다.

- 이 앱이 어떤 핵심 업무를 먼저 다루는지
- 로그인 후 어디로 가는지
- 일반 조회/업무 화면과 관리자 검토 화면이 어떻게 갈리는지
- 지금 단계가 dev-safe Production-ready (실구현) 이라는 사실

### 3) 대시보드는 여전히 "오늘 할 일 먼저"가 중심이다.

대시보드가 해야 할 일:

- 바로 눌러야 할 일 먼저 보여 주기
- 승인/대기/예외 상태 요약
- 근태/휴가/조직/직원/관리자 경계 연결
- 상세 처리는 각 하위 화면으로 넘기기

대시보드가 하면 안 되는 일:

- 모든 업무 상세를 한 화면에서 다 처리하는 것처럼 보이기
- 관리자 메뉴를 일반 직원 기본 흐름에 섞어 보이게 하기
- 실제 저장/실행 완료처럼 보이는 문구 만들기

### 4) 일반 조회와 운영 검토는 계속 분리한다.

- `/org`, `/employees` 는 읽기 중심 일반 조회
- `/admin/users`, `/admin/policies` 는 운영 검토/변경 후보 확인
- 같은 직원/조직 정보가 보이더라도 역할과 목적이 다르다는 문구를 유지

### 5) 근태와 정책은 같은 방향을 가리켜야 한다.

- `/attendance` 에서 보여 주는 허용 방식 안내
- `/admin/policies` 에서 설명하는 정책 변화/후보

이 두 화면이 서로 다른 말을 하면 안 됩니다.
이번 Phase는 "실제 저장"보다 "같은 기준을 설명하는 상태"가 더 중요합니다.

### 6) approvals 는 결재 완료 앱이 아니라 검토 가능한 Production-ready (실구현) 으로 남긴다.

- 승인/반려 Production-ready (실구현) 는 유지
- self-approval/company scope 같은 guardrail 설명 유지
- 실제 저장이 된 것처럼 보이는 CTA/문구는 금지

### 7) admin 경계는 UI와 route/API 에서 같이 지킨다.

- 일반 사용자: 관리자 CTA 미노출
- 익명 preview: `/admin*` 공개 노출 금지
- 관리자 role: `/admin` 진입 허용
- 감사 role: `/admin/audit-logs` 중심 허용

## 4. 실제로 먼저 볼 파일

### Web

- `apps/web/app/page.tsx`
- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/org/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-Production-ready (실구현)-config.ts`

### 문서

- `docs/architecture/phase-14-real-usable-mvp-pass-1-scope.md`
- `docs/architecture/phase-12-dashboard-summary-scope.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `docs/guides/phase-13-admin-console-pass-1-handoff.md`
- `docs/guides/attendance-registration-policy-pass-2-handoff.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`

## 5. 권장 구현 순서

1. 홈(`/`)과 로그인(`/login`)이 최신 제품 흐름 설명과 맞는지 먼저 정리합니다.
2. `/dashboard` 에서 일반 직원/팀장/관리자 각각의 첫 액션이 잘 드러나는지 확인합니다.
3. `/org`, `/employees`, `/attendance`, `/approvals` 의 설명 문구가 대시보드와 같은 언어를 쓰도록 맞춥니다.
4. 관리자 CTA 와 `/admin/*` 흐름을 일반 업무 흐름과 헷갈리지 않게 다듬습니다.
5. 필요 시 `dashboard-config.ts`, `admin-Production-ready (실구현)-config.ts` 의 카드/문구/우선순위를 먼저 고칩니다.
6. 그 다음에 정말 필요한 shared contract/API mock summary 보강만 최소 범위로 붙입니다.
7. 마지막에 route/API guard 와 smoke 기준을 같이 확인합니다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- 화면 연결감
- 역할별 CTA 문구
- 대시보드와 하위 화면의 언어 일치
- 일반 조회/운영 검토 경계 유지

하면 안 되는 것:

- 실제 인증/권한 저장 열기
- 실제 승인/근태 저장 열기
- production 연결로 범위 확장

### 리뷰어(gwreviewer)

집중할 것:

- 관리자 노출 경계
- 일반 사용자 흐름에 admin leak 없는지
- `/employees` 와 `/admin/users` 의 역할 혼동 없는지
- `/attendance` 와 정책 문구 충돌 없는지
- Production-ready (실구현) 가 완료처럼 보이지 않는지

### 테스터(gwtester)

집중할 것:

- 핵심 route smoke
- role 별 CTA/차단 기준
- `/admin*` 익명 공개 차단
- 일반 사용자/감사/관리자 role 분기
- build/typecheck/smoke 와 문서 success 기준 정합성

### 문서화(gwdocs)

집중할 것:

- SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF/CHANGELOG 최신화
- 사용자가 live URL 에서 어디를 보면 되는지 쉬운 한국어 정리
- 일반 업무 흐름과 관리자 흐름을 한 장표처럼 설명

### 운영(gwops)

집중할 것:

- build:cf / check / preview:cf smoke / release gate
- `.workers.dev` live fetch 가 막히면 substitute evidence 정리
- branch/PR/merge/cleanup 근거 정리

## 7. 최소 smoke 기준

이번 1차에서 꼭 다시 볼 기준:

1. `/` 에서 `/dashboard` 또는 핵심 진입점으로 자연스럽게 이어진다.
2. `/login` 이 로그인 후 어디로 이어지는지 과장 없이 설명한다.
3. `/dashboard` 가 오늘 할 일 → 대기/예외 → 하위 업무 화면 연결 순서를 유지한다.
4. `/org`, `/employees` 는 일반 조회 화면으로 읽힌다.
5. `/attendance` 는 허용 방식 안내와 Production-ready (실구현) 경계가 분명하다.
6. `/approvals` 는 승인 처리 앱처럼 보이되 실제 저장 완료를 속이지 않는다.
7. 일반 사용자에게는 관리자 CTA 가 보이지 않는다.
8. 권한 있는 사용자에게만 `/admin` 또는 `/admin/audit-logs` 진입이 보인다.
9. 익명 preview 에서 `/admin*` 공개 노출이 없다.
10. Production-ready (실구현)/dev-safe/Production-ready (실구현) 문구가 빠지지 않는다.

## 8. 꼭 지켜야 할 guardrail

- 실제 인증/SSO/OAuth 연결 금지
- production DB 실데이터 변경 금지
- secret 입력/교체 금지
- 외부 HR/메신저/SIEM 연동 금지
- 실제 승인/근태/권한 저장 실행 금지
- 태그 장비/GPS/위치/실장비 연동 금지
- DNS/custom domain 변경 금지
- 유료 리소스 생성·증설 금지

## 9. 완료로 볼 최소 기준

- 대장이 핵심 route 를 순서대로 눌러 보며 제품 흐름을 이해할 수 있다.
- 직원/팀장/인사/관리자 각 관점의 첫 진입 동선이 설명된다.
- 관리자 기능은 권한 없는 사용자에게 드러나지 않는다.
- mock/dev-safe/Production-ready (실구현) 경계가 흐려지지 않는다.
- 다음 단계에서 실제 연동을 붙일 우선순위가 문서와 화면에 같이 남는다.

정리하면,
이번 handoff 의 핵심은 하나입니다.
Phase 14는 "기능 추가 경쟁"이 아니라
"따로 놀던 Production-ready (실구현)을 실사용 MVP 흐름으로 묶는 정리 단계"입니다.
