# Phase 28A 급여 foundation / payslip pass 1 handoff

## 구현 포인트
- shared contract 에 `payroll` route + schema 묶음을 추가했다.
- API 에 payroll overview / period detail / my payslip placeholder endpoint 를 추가했다.
- Web 에 `/payroll`, `/payroll/me` route 를 추가했다.
- 모바일/메뉴/내 정보 진입점에 급여 링크를 넣었다.
- contract 는 `monthly`/`hourly`/`daily`/`annual`/`inclusive` pay type 과 `draft`/`collecting`/`reviewing`/`confirmed`/`closed` period status 를 지원한다.
- line item 은 단순 총액이 아니라 `source`·`quantity`·`unitAmount`·`premiumRate`·`amount`·`note` 근거를 함께 남긴다.

## 다음 작업자가 먼저 볼 파일
- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/payroll.test.tsx`
- `SPEC.md`
- `DATA_MODEL.md`
- `API.md`

## 빠른 검증 순서
1. `pnpm --filter @gw/shared typecheck`
2. `pnpm --filter @gw/api test -- auth-org.spec.ts`
3. `pnpm --filter @gw/web test -- payroll.test.tsx work-items.test.tsx`
4. 가능하면 `pnpm check`
5. 가능하면 `/payroll`, `/payroll/me` local preview smoke

## 아직 남은 것
- payroll 계산 엔진/세액 엔진/보험 엔진 연결
- 지급 승인 저장
- 명세서 PDF/다운로드
- HQ/branch 실데이터 입력 플로우
- 외부 급여·세무 연동

## 주의할 점
- employee 는 self-only payslip permission 으로만 `/api/payroll/me/payslip` 을 본다.
- manager 는 overview 는 보되 self payslip endpoint 는 못 본다.
- 테스트 기준으로 manager 는 `/api/payroll/periods/:id` detail 도 403 이다. 지점 관리자는 제출 상태/개요 중심으로 읽는다.
- period detail 은 visible period + visible draft 기준을 같이 확인해야 한다.
- preview 금액은 절대 확정값처럼 문구를 쓰면 안 된다.
- 포괄임금제는 포함 범위 대비 초과 검토 경고를 남기되, 부족분 자동 차감을 이미 확정한 것처럼 쓰지 않는다.
- 주민등록번호, 계좌번호, 실지급 이체, 홈택스/4대보험 신고, 외부 회계/세무 연동은 계속 별도 승인 게이트다.
