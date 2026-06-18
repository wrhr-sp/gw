# Phase 56 관리자 지정 경영업무 1차 실사용화 fit-gap scope

## 왜 이 Phase를 여는가

Phase 55에서 `/admin/users`, `/employees`, `/org`, `/management`, `/admin/audit-logs` 를 관리자 계정·권한·조직 실사용 흐름으로 다시 잠갔다면, Phase 56에서는 그 다음 단계로 `/management` 아래 민감 경영업무 묶음을 "아무나 들어가는 관리자 홈"이 아니라 "지정 관리자만 들어가고 일반 직원은 확실히 차단되는 실사용 레인"으로 끌어올려야 한다.

이번 Phase의 핵심은 새 외부 연동을 여는 것이 아니다. 이미 있는 `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 와 관련 API/test 근거를 바탕으로 다음 기준을 같은 언어로 다시 잠그는 것이다.

- 경영업무 허브와 직원 기본업무 홈을 섞지 않는다.
- 급여/세무/노무/법무는 같은 "관리자 기능"처럼 뭉개지지 않게 모듈 책임을 분리한다.
- 지정 관리자 접근 허용, 일반 직원 차단, 감사 read-only, self-only 급여 확인을 route/UI/API/test 에서 같은 뜻으로 유지한다.
- 민감 원문, raw storage, secret, 실지급/실신고 같은 실제 운영 연동은 계속 승인 게이트로 남긴다.

## 이번 Phase의 한 줄 목표

대장이 live URL에서 로그인 후 `/management` → `/payroll` → `/payroll/me` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → `/admin/audit-logs` 를 직접 따라가며, 지정 관리자 접근 경계·일반 직원 차단·감사 read-only·민감정보 비노출 원칙이 실제로 읽히는 상태를 만드는 것.

## 지금 바로 확인 가능한 범위

### 웹 route
- `/management`
- `/payroll`
- `/payroll/me`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin/audit-logs`

### 구현 근거 파일
- `apps/web/app/management/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/work-items/tax/page.tsx`
- `apps/web/app/work-items/labor/page.tsx`
- `apps/web/app/work-items/legal/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`

### API / contract / test 근거
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `packages/shared/src/contracts.ts`

## 사용자 레인 분리 원칙

### 1. 일반 직원 레인
- 일반 직원의 기본 시작점은 계속 `/dashboard` 다.
- 일반 직원은 `/management` 와 지정 관리자용 `work-items` 실사용 레인을 일반 업무 홈처럼 읽으면 안 된다.
- 일반 직원에게 허용되는 경영업무 관련 예시는 self-only 성격의 `/payroll/me` 처럼 범위가 매우 좁은 화면이다.

### 2. 지정 관리자 레인
- `/management` 는 직원 홈의 확장이 아니라 민감 운영 허브다.
- `/payroll` 은 회사/지점 급여 운영 preview 와 검토 흐름이다.
- `/work-items/tax` 는 세무 자료/마감/검토 흐름이다.
- `/work-items/labor` 는 노무 자료/review/document/deadline 흐름이다.
- `/work-items/legal` 는 법무 자료/review/document/deadline 흐름이다.
- 이 세 모듈은 모두 같은 work item 패턴을 일부 공유하더라도 scope 와 허용 사용자군은 같지 않다.

### 3. 감사 레인
- `/admin/audit-logs` 는 계속 `audit.read` 기반 read-only 감사 레인이다.
- 경영업무 접근이 가능하다고 해서 감사까지 자동 허용되는 것이 아니다.
- 반대로 `AUDITOR` 가 감사 레인에 들어간다고 해서 `/management` 나 `/work-items/*` 까지 허용되는 것도 아니다.

## 모듈별 이번 Phase 해석 기준

### `/management`
- 민감 운영 모듈 허브로 읽혀야 한다.
- 일반 직원 홈 CTA 와 같은 책임처럼 보이면 안 된다.
- 현재 dedicated `/compliance` route 가 없다는 점을 숨기지 않는다.
- 현재 컴플라이언스/감사 진입은 `/management` 문맥과 `/admin/audit-logs` read-only 흐름으로 설명한다.

### `/payroll`
- 회사/운영자 관점 급여 preview 및 검토 레인이다.
- 실제 실지급 완료, 은행이체, 외부 급여시스템 연동 완료처럼 과장하지 않는다.
- `/payroll/me` 와 동일 책임으로 설명하지 않는다.

### `/payroll/me`
- self-only 급여 확인 레인이다.
- 직원 본인이 자기 급여명세 preview 를 확인하는 자리로 읽혀야 한다.
- 회사 전체 급여 운영 화면과 같은 권한으로 설명하지 않는다.

### `/work-items/tax`
- 세무 자료 요청/검토/마감 흐름이다.
- branch/company visibility 차이와 운영 검토 책임을 숨기지 않는다.
- 실신고, 외부 세무사/기관 제출, production 실데이터 반영은 승인 게이트다.

### `/work-items/labor`
- 노무 자료 요청/제출/review/document/deadline 흐름이다.
- self/branch/restricted scope 차이가 route/UI/API/test 에서 같은 뜻이어야 한다.
- 실제 노무 사건 처리 완료나 외부 전문가 연동 완료처럼 적지 않는다.

### `/work-items/legal`
- 법무 검토/document/deadline 흐름이다.
- company/branch visibility 와 restricted metadata 경계를 같은 말로 유지해야 한다.
- 계약 원문 저장 확대, 외부 자문 연동, 실법무 집행은 승인 게이트다.

### `/admin/audit-logs`
- masked preview 기반 read-only 감사 추적이다.
- 경영업무 실사용화 문맥에서도 raw before/after, secret, storage internals 를 보여 주는 화면처럼 쓰지 않는다.

## 이번 Phase에서 다시 잠글 권한 경계

- 익명 사용자는 계속 `/login` 만 진입점으로 본다.
- 일반 직원은 `/management`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 를 일반 업무처럼 볼 수 없어야 한다.
- self-only `/payroll/me` 와 운영 `/payroll` 은 명확히 다른 레인으로 읽혀야 한다.
- `audit.read` 는 감사 read-only 기준이며 경영업무 운영권한과 같은 뜻이 아니다.
- company scope, branch scope, self scope, restricted scope 차이를 문서/화면/API/test 에서 같은 말로 유지해야 한다.

## 상태 문장 기준

다음 상태들은 서로 다른 뜻으로 유지해야 한다.

- empty: 정상적으로 접근했지만 아직 표시할 데이터가 없는 상태
- loading: 데이터를 확인 중인 상태
- error: 재시도나 운영 확인이 필요한 실패 상태
- forbidden: 권한/회사/범위 차단 상태
- dev-safe/preview: 실제 저장·실행 대신 내부 확인용으로 남겨 둔 상태

특히 dev-safe/preview 를 실제 업무 완료처럼 적지 않는다.

## 이번 Phase의 산출물

### 필수 문서 산출물
- scope 문서: 이 문서
- handoff 문서: `docs/guides/phase-56-management-admin-live-operations-pass1-handoff.md`
- guide 문서: `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md`

### 후속 구현/검증 체인에서 확인해야 할 것
- `/management` 와 일반 직원 홈 문장 분리
- `/payroll` 대 `/payroll/me` 책임 분리
- `tax`/`labor`/`legal` 모듈별 scope 문장 정리
- 일반 직원 차단, 지정 관리자 허용, 감사 read-only 차단/허용 회귀
- empty/loading/error/forbidden/dev-safe 상태 문장 정리
- live 직접 확인 순서와 대체 검증 근거 분리

## 이번 Phase에서 하지 않는 것

아래 항목은 이번 Phase 완료와 별개 승인 게이트다.

- 실지급, 은행이체, 급여 확정 운영 전환
- 실신고, 외부 세무사/노무사/법무 전문가/보험/기관 연동
- 주민번호/계좌번호 등 민감 원문 확대 저장
- production DB 실데이터 반영
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
10. Phase 56 handoff / 이후 guide 문서

## 근거 문서

- `docs/architecture/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-scope.md`
- `docs/architecture/phase-55-admin-account-rbac-org-audit-live-operations-fit-gap-scope.md`
- `docs/guides/phase-55-admin-account-rbac-org-audit-live-operations-handoff.md`
- `apps/web/app/management/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/work-items/tax/page.tsx`
- `apps/web/app/work-items/labor/page.tsx`
- `apps/web/app/work-items/legal/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `packages/shared/src/contracts.ts`
