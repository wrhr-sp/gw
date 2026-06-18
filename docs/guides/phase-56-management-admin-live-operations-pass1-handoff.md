# Phase 56 관리자 지정 경영업무 1차 실사용화 handoff

## 이 문서의 목적

다음 작업자가 Phase 56을 새로 해석하지 않도록, 지금 바로 확인 가능한 route/API/test 근거와 이번 Phase에서 반드시 지켜야 할 문장 기준을 쉬운 한국어로 묶어 넘긴다.

## 이번 Phase의 핵심 해석

- `/management` 는 직원 홈 연장이 아니라 민감 운영 허브다.
- `/payroll` 은 운영/관리자 급여 preview 레인이고, `/payroll/me` 는 self-only 급여 확인 레인이다.
- `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 은 모두 same-origin 실사용 패널이지만 scope 와 허용 사용자군이 같다거나 완전한 외부 연동이 끝났다는 뜻은 아니다.
- `/admin/audit-logs` 는 계속 read-only 감사 레인이며, 경영업무 운영권한과 같은 묶음으로 적지 않는다.
- 이번 Phase의 목표는 실제 외부 연동을 여는 것이 아니라, 지정 관리자 접근 허용·일반 직원 차단·민감정보 비노출 원칙을 live URL 기준으로 다시 잠그는 것이다.

## 지금 바로 볼 파일

### 기획 문서
- `docs/architecture/phase-56-management-admin-live-operations-pass1-fit-gap-scope.md`
- `docs/architecture/phase-55-admin-account-rbac-org-audit-live-operations-fit-gap-scope.md`
- `docs/architecture/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-scope.md`

### 웹 구현
- `apps/web/app/management/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/work-items/tax/page.tsx`
- `apps/web/app/work-items/labor/page.tsx`
- `apps/web/app/work-items/legal/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`

### API / 테스트
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `packages/shared/src/contracts.ts`

## 사용자에게 어떻게 읽혀야 하는가

### 1. 일반 직원
- 익명 시작점은 계속 `/login` 뿐이다.
- 로그인 후 일반 직원의 기본 레인은 `/dashboard` 중심이다.
- 일반 직원은 `/management`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 를 일반 업무 홈처럼 보지 않아야 한다.
- 일반 직원이 경영업무 쪽에서 확인 가능한 대표 예시는 self-only 성격의 `/payroll/me` 다.

### 2. 지정 관리자/담당자
- `/management` 에서 민감 운영 허브로 들어간다.
- `/payroll` 은 회사/운영 관점 급여 preview 및 검토 레인이다.
- `/work-items/tax` 는 세무 레인, `/work-items/labor` 는 노무 레인, `/work-items/legal` 는 법무 레인으로 읽혀야 한다.
- 세 모듈은 공통 work item 패턴을 쓰더라도 visibility, scope, approval gate 가 서로 다를 수 있음을 숨기지 않는다.

### 3. 감사 담당자
- `/admin/audit-logs` 는 `audit.read` 기반 read-only 감사 레인이다.
- 감사 담당자는 경영업무 운영권한 전체를 자동으로 받는 사용자가 아니다.

## 구현/리뷰 단계에서 먼저 볼 질문

1. `/management` 문장이 일반 직원 홈 CTA 와 섞이지 않는가?
2. `/payroll` 과 `/payroll/me` 가 같은 화면 책임처럼 읽히지 않는가?
3. `tax`, `labor`, `legal` 모듈의 branch/company/self/restricted 경계가 같은 언어로 유지되는가?
4. 일반 직원 차단, 지정 관리자 허용, 감사 read-only 허용/차단이 route/UI/API/test 에서 같은 뜻인가?
5. `empty`, `loading`, `error`, `forbidden`, `dev-safe/preview` 가 서로 다른 뜻으로 보이는가?
6. raw storage, secret, 민감 원문, 실지급/실신고, 외부 전문가 연동이 이미 열린 기능처럼 과장되지 않는가?

## 테스트 단계에서 꼭 다시 볼 것

- 익명 접근은 `/login` 단독 시작으로 유지되는지
- `/management` 와 `/work-items/*` 가 일반 직원에게 열리지 않는지
- `/payroll/me` 가 self-only 성격으로 읽히는지
- `/admin/audit-logs` 가 read-only 감사 레인으로 유지되는지
- company scope / branch scope / self scope / restricted scope 경계가 회귀되지 않았는지
- empty/loading/error/forbidden/dev-safe 상태가 서로 다른 사용자 문장으로 보이는지
- live 직접 확인 근거와 local preview/build/test 근거가 섞이지 않는지

## 문서화 단계에서 이어서 볼 것

아래 내용은 `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md` 에 쉬운 한국어 guide 로 묶어 두었다.

- live URL 기준 추천 확인 순서
- 관리자/직원/감사 담당자별 확인 포인트
- `/management` → `/payroll` → `/payroll/me` → `tax/labor/legal` → `/admin/audit-logs` 흐름
- 차단 확인 포인트
- UAT 절차
- 운영 체크리스트
- 최종 보고 템플릿
- 승인 게이트 목록

## 현재 연결된 Kanban 체인

- 기획: `t_0d629234`
- 구현: `t_6090c4b8`
- 리뷰: `t_6f8ecbd2`
- 테스트: `t_9aa0fc51`
- 문서화: `t_1f522af2`
- GitHub/배포 후속: `t_055dbbf6`

## 계속 승인 게이트로 남기는 것

- 실지급, 은행이체, 급여 확정 운영 전환
- 실신고, 외부 세무/노무/법무/보험/기관 연동
- 주민번호/계좌번호 등 민감 원문 확대 저장
- production DB 실데이터
- secret 입력/교체
- DNS/custom domain
- 유료 리소스
- migration
- destructive 작업

## 추천 확인 순서

1. `/login`
2. `/dashboard`
3. `/management`
4. `/payroll`
5. `/payroll/me`
6. `/work-items/tax`
7. `/work-items/labor`
8. `/work-items/legal`
9. `/admin/audit-logs`
10. Phase 56 scope 문서
