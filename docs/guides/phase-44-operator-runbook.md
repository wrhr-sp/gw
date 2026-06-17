# Phase 44 운영자 runbook

## 한 줄 요약
운영자는 도입 전 준비 → 도입 중 점검 → 도입 후 정리 3단계로 진행하고, blocker / approval-needed / placeholder 를 서로 다른 항목으로 기록해야 한다.

## 대상
- 내부 도입 리허설 진행자
- UAT 운영자
- 관리자 동행 점검 담당자
- Phase 45 최종검증 전 사전 준비 담당자

## 운영 원칙
- 일반 직원 레인과 민감 운영 레인을 섞지 않는다.
- 문서 설명과 실제 route/API/test 근거가 같은 뜻이어야 한다.
- 화면이 있다고 해서 외부 연동이나 production 운영이 닫힌 것으로 과장하지 않는다.
- 승인 없이는 실지급, 실데이터 반영, 외부 기관 연동, DNS/custom domain, 유료 리소스, migration, destructive 작업을 하지 않는다.

## 1단계. 도입 전 준비

### 1-1. 접속 정보 준비
- live/UAT URL 확인: `https://gw-web.wereheresp.workers.dev`
- 테스트 계정 확인: `admin / 1234` (dev/test/UAT 전용)
- 추천 시작 route 준비:
  - 직원 레인: `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`
  - 관리자 레인: `/login` → `/dashboard` → general host `/management` → `/work-items/branch` → `/payroll` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → admin host `/admin/audit-logs`

### 1-2. 사전 문서 확인
먼저 읽을 문서:
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-role-access-matrix.md`
- `docs/guides/phase-44-adoption-checklist.md`
- `docs/guides/phase-44-pc-mobile-login-only-entry-pwa-desktop-app-handoff.md`
- `docs/architecture/phase-44-operations-docs-user-admin-guides-adoption-checklist-fit-gap-scope.md`

### 1-3. 사전 검증 근거 확인
현재 Phase 44 문서의 핵심 근거 파일:
- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/management/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `packages/shared/src/admin-access.ts`

### 1-4. 사전 실행 명령
루트에서 아래를 우선 돌린다.

```bash
pnpm check
pnpm --filter @gw/shared test
pnpm --filter @gw/shared typecheck
pnpm --filter @gw/api test
pnpm --filter @gw/api typecheck
pnpm --filter @gw/web test
pnpm --filter @gw/web typecheck
pnpm --filter @gw/web build
```

필요 시 Cloudflare 호환 빌드도 다시 확인한다.

```bash
pnpm --filter @gw/web build:cf
```

### 1-5. 도입 전 질문
- `/login` 이 유일한 익명 입구로 유지되는가
- `/dashboard` 가 홈으로 읽히는가
- `/management` 가 일반 홈과 분리되는가
- `/payroll`, `/work-items/*`, `/admin/audit-logs` 책임 차이가 문서와 실제 화면에서 같은가
- approval gate 항목이 하나의 목록으로 정리돼 있는가

## 2단계. 도입 중 점검

### 2-1. 익명 접근 차단 점검
최소 확인 포인트:
- 익명 `/login` 은 200 또는 정상 진입
- 익명 `/dashboard` 는 직접 업무 화면처럼 열리지 않아야 함
- 익명 `/management`, `/admin*`, 민감 내부 API 는 redirect 또는 auth-required 가 정상
- 모바일 viewport 에서도 로그인 전 하단 탭/업무 메뉴가 먼저 보이지 않아야 함

### 2-2. 역할별 landing 점검
- COMPANY_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE 문맥: 로그인 직후 `/dashboard` 부터 시작하는지
- AUDITOR 문맥: 로그인 직후 `/admin/audit-logs` 로 시작하는지
- 인사 관리자 문맥: admin host `/admin/users` 계열 진입이 자연스러운지
- 운영 관리자/지점 관리자 문맥: general host `/management` 진입이 자연스러운지
- 감사 문맥: admin host `/admin/audit-logs` read-only 진입이 맞는지

### 2-3. 일반 직원 레인 점검
순서:
1. `/dashboard`
2. `/attendance`
3. `/leave`
4. `/approvals`
5. `/boards`
6. `/documents`
7. `/me`
8. 필요 시 `/org`, `/employees`

확인 포인트:
- 하루 기본 흐름이 쉬운 말로 이어지는가
- 관리자 전용 운영 화면이 섞이지 않는가
- placeholder 와 완료 기능을 같은 말로 쓰지 않는가

### 2-4. 민감 운영 레인 점검
순서:
1. `/management`
2. `/work-items/branch`
3. `/payroll`
4. `/payroll/me`
5. `/work-items/tax`
6. `/work-items/labor`
7. `/work-items/legal`
8. `/admin/audit-logs`

확인 포인트:
- 일반 홈과 민감 허브가 분리되는가
- branch/company/self/restricted/read-only 경계가 흐리지 않은가
- 감사 화면이 read-only 로 유지되는가
- dedicated compliance 완성품처럼 과장되지 않는가

### 2-5. 세션/로그아웃 점검
- 로그인 후 보호 route 진입이 역할과 맞는가
- 로그아웃 뒤 보호 route 에 바로 남지 않는가
- 자동 로그인/세션 유지 설명이 production 영구 로그인처럼 적히지 않는가

### 2-6. PWA 설치 확인
Windows Chrome/Edge 기준 최소 확인:
- `/login` 에서 설치 메뉴가 보이는지 또는 브라우저 앱 설치 메뉴가 열리는지
- 설치 후 바탕화면/시작 메뉴에서 앱처럼 실행되는지
- 설치된 앱을 다시 열었을 때 세션이 없으면 `/login` 부터 시작하는지
- 로그인 후에는 COMPANY_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE = `/dashboard`, AUDITOR = `/admin/audit-logs` 기준으로 이동하는지
- 이번 단계가 PWA 설치형 앱이지 `.exe` 배포가 아니라는 점을 기록에 남겼는지

### 2-7. 기록 방식
점검 중 발견사항은 아래로 나눠 적는다.
- blocker: 현재 시나리오를 더 진행할 수 없게 막는 문제
- major: 진행은 가능하지만 운영 의미가 크게 흔들리는 문제
- minor: 흐름은 되지만 표현/정렬/사소한 차이
- copy-doc: 문구 또는 문서 정합성 수정 필요
- approval-needed: 기능 문제는 아니지만 별도 승인 없이는 진행하면 안 되는 항목

중요:
- approval-needed 를 버그처럼 적지 않는다.
- placeholder 를 blocker 로 오해하지 않는다.
- forbidden/error/empty/offline 을 같은 실패로 뭉개지 않는다.

## 3단계. 도입 후 정리

### 3-1. 감사/추적 확인 포인트
- `/admin/audit-logs` 에서 company boundary 와 masked preview 의미를 다시 확인한다.
- raw storageKey, bucket, signed URL, public URL 전문이 노출되지 않는지 확인한다.
- read-only 감사와 실제 조치 시스템을 같은 말로 쓰지 않는다.

### 3-2. 남은 승인 게이트 분리
반드시 별도로 남길 항목:
- 실제 급여 지급
- 은행 이체
- 주민번호/계좌번호 입력 확대
- production DB 실데이터
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- 법령 API 인증키 등록
- DNS/custom domain
- 유료 리소스
- migration
- destructive/force 작업

### 3-3. 결과 정리 형식
최종 결과에는 아래를 넣는다.
- live URL
- 사용한 테스트 계정
- 실제 눌러본 주요 route 순서
- 직원 레인과 관리자 레인의 핵심 차이
- blocker / approval-needed 구분
- 남은 승인 게이트
- Phase 45 로 넘길 재검증 포인트

### 3-4. Phase 45 전에 다시 볼 질문
- 문서와 실제 route 책임이 같은가
- 권한표와 실제 role/capability 가 같은가
- approval gate 가 문서 어디서나 같은 뜻으로 보이는가
- 대장이 직접 눌러볼 최소 시나리오가 충분히 짧고 명확한가

## 운영자가 바로 쓸 수 있는 빠른 메모 템플릿

```text
결론:
- 직원 레인 / 관리자 레인 분리 상태:
- blocker:
- approval-needed:

확인 URL/계정:
- URL:
- 계정:

직원 레인 확인:
- /login:
- /dashboard:
- /attendance:
- /leave:
- /approvals:
- /boards:
- /documents:

관리자 레인 확인:
- /management:
- /work-items/branch:
- /payroll:
- /work-items/tax:
- /work-items/labor:
- /work-items/legal:
- /admin/audit-logs:

남은 승인 게이트:
-
```

## 함께 볼 문서
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-role-access-matrix.md`
- `docs/guides/phase-44-adoption-checklist.md`
