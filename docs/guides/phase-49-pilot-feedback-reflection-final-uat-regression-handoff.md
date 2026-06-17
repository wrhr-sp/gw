# Phase 49 파일럿 피드백 반영·최종 UAT 회귀 handoff

## 1. 이 문서가 필요한 이유
이번 handoff 는 Phase 49를 "새 기능을 더 여는 단계"가 아니라,
이미 있는 일반 업무/운영 업무/지점 업무/감사 레인을
실제 파일럿 참여자 관점의 클릭 순서와 기록 기준으로 다시 잠그는 단계로 이해하게 만들기 위한 문서다.

직전까지는 아래가 각각 따로 읽혔다.

- 직원 기본 업무 레인(`/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents`)
- 운영 관리자 레인(`/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs`)
- 지점 업무 레인(`/work-items/branch`)
- 감사/운영 최소 기준선(`/admin/audit-logs`, `/api/health`, `RUNBOOK.md`, `DEPLOYMENT.md`)

이번 문서의 목적은 이 넷을 "역할별 최종 UAT 회귀"라는 한 문장으로 다시 연결하는 것이다.

## 2. 이번 Phase 49를 쉬운 말로 설명하면
"누가 어디서 시작해서 무엇을 눌러 보고, 어디서 막히면 무엇으로 기록해야 하는지"를
한 번 더 같은 언어로 맞추는 단계다.

즉,

- 직원은 `/dashboard` 중심 일반 업무 레인을 본다.
- 운영 관리자는 `/management` 와 `/admin*` 운영 검토 레인을 본다.
- 지점관리자는 `/work-items/branch` branch scope 레인을 본다.
- 감사 담당자는 `/admin/audit-logs` read-only 레인을 본다.
- 모두 같은 `admin / 1234` 테스트 계정을 쓰더라도, 같은 사용자 시나리오처럼 섞어 읽지 않는다.

## 3. 지금 바로 확인 가능한 것

### A. 직원 레인
지금 바로 읽을 수 있는 것:
- `/login` 이후 `/dashboard` landing
- `/attendance`, `/leave`, `/approvals` 일반 업무 흐름
- `/boards`, `/documents` 협업/문서 흐름
- `/me` 세션/내 정보 확인 흐름

지금 과장하면 안 되는 것:
- 외부 연동 완료
- 실급여/실신고/실정산 완료
- production 실데이터 운영
- skeleton/dev-safe 화면의 실저장 완료

### B. 운영 관리자 레인
지금 바로 읽을 수 있는 것:
- `/management` 운영 허브
- `/admin/users` 계정관리 preview
- `/admin/policies` 정책 preview
- `/admin/audit-logs` read-only 감사 확인
- `/api/health` 최소 liveness 확인

지금 과장하면 안 되는 것:
- 운영 변경 영구 저장 완료
- 외부 초대/실메일 발송 완료
- full monitoring/alerting/on-call 완료
- production backup/restore 실행 완료

### C. 지점관리자 레인
지금 바로 읽을 수 있는 것:
- `/work-items/branch` branch scope 업무 확인
- 필요 시 `/employees`, `/org` 읽기 중심 확인
- 지점 업무와 회사 전체 운영 레인이 다르다는 설명

지금 과장하면 안 되는 것:
- 독립 지점 마스터 완성
- 회사 전체 민감 운영 데이터 열람
- branch scope 와 company scope 동일 권한

### D. 감사/운영 기준선 레인
지금 바로 읽을 수 있는 것:
- `/admin/audit-logs` read-only / masked preview
- `/api/health` 최소 liveness
- `RUNBOOK.md`, `DEPLOYMENT.md` 운영 확인 순서

지금 과장하면 안 되는 것:
- 외부 SIEM / alerting / paging 완료
- 장애 자동복구 완료
- production 복구 drill 완료

## 4. 이번에 기준 근거로 본 파일
문서 기준:
- `docs/architecture/phase-45-final-internal-adoption-validation-release-fit-gap-scope.md`
- `docs/architecture/phase-46-account-permission-organization-onboarding-rehearsal-fit-gap-scope.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/architecture/phase-48-audit-security-backup-restore-incident-ops-fit-gap-scope.md`
- `docs/architecture/phase-49-pilot-feedback-reflection-final-uat-regression-fit-gap-scope.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`

구현/계약 기준:
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/work-items/branch/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/api/src/app.ts`
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/contracts.ts`

테스트 기준:
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `apps/api/test/phase34-degraded-routes.spec.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/work-items.test.tsx`
- `apps/web/phase40-uat-package.test.tsx`

## 5. 다음 작업자가 문장을 쓸 때 반드시 지킬 것
1. 직원 레인과 운영 관리자 레인을 같은 홈 흐름처럼 쓰지 말 것
2. 지점관리자 레인(`/work-items/branch`)과 회사 범위 운영 권한을 같은 뜻으로 쓰지 말 것
3. `/employees`, `/org` 읽기 확인과 `/admin/users`, `/admin/policies` 운영 preview 를 같은 책임처럼 쓰지 말 것
4. `/admin/audit-logs` 는 계속 `audit.read` 기반 read-only 레인으로만 설명할 것
5. happy path, forbidden, empty, error, loading, mobile/PC 기록 포인트를 기능별로 남기되 같은 이슈 분류 언어로 묶을 것
6. live 직접 확인 근거와 local preview/build/test/release gate 대체 근거를 같은 뜻으로 쓰지 말 것
7. production DB, secret, 외부 IdP, 외부 기관 연동, production backup/restore, DNS/custom domain, 유료 리소스는 계속 승인 게이트로 남길 것

## 6. 지금 이미 근거가 있는 것 / 아직 비어 있는 것

### 지금 이미 근거가 있는 것
- `/dashboard` 중심 일반 업무 레인
- `/management` 중심 운영 허브 레인
- `/work-items/branch` branch scope 업무 레인
- `/admin/users`, `/admin/policies` 운영 검토 preview
- `/admin/audit-logs` read-only / masked preview
- `/api/health` 최소 liveness
- route/API/company+branch/self/foreign 차단 테스트 근거

### 아직 비어 있거나 별도 승인인 것
- 실운영 데이터 저장 확대
- 외부 초대/실메일/IdP 연동
- 실급여/실신고/기관 연동
- production backup/restore 실행
- alerting/SIEM/paging/on-call 자동화
- DNS/custom domain
- 유료 리소스

## 7. 이번 체인에서 실제로 확인된 결과
1. builder 단계에서 직원 레인(`/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`), 운영 관리자 레인(`/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health`), 지점관리자 레인(`/work-items/branch` 중심) 분리 copy 를 보강했다.
2. reviewer 단계에서는 처음에 홈 문구와 admin users role card 가 운영 관리자 company-scope 와 지점관리자 branch-scope 를 섞는 blocker 를 잡았고, 후속 builder 카드 `t_28b29919` 에서 해당 문구를 분리했다.
3. tester 단계에서는 focused web 24 files / 103 tests, web typecheck, web build, web build:cf 를 다시 통과시켰다.
4. tester handoff 기준으로 익명 `/admin*` 접근 차단, `/admin/audit-logs` read-only/masked/company-boundary, `/employees`·`/org` 읽기 확인 vs `/admin/users`·`/admin/policies` preview 구분, `/work-items/branch` branch scope 유지가 최종 회귀 기준선으로 이어진다.
5. live 직접 재확인 메모는 별도 singde/t_c353cc96 근거를 따로 보고, 이번 문서 카드의 local 검증 기록과 한 줄로 합치지 않는다.

## 8. docs / ops 가 최종 보고에 바로 써야 할 포인트

### docs
- 테스트 계정은 계속 `admin / 1234` 로 적되 dev/test/UAT 전용 계정이라고 함께 적는다.
- live URL 은 `https://gw-web.wereheresp.workers.dev` 단일 host 기준으로 적고, 별도 admin host 안내처럼 쓰지 않는다.
- 직원/운영 관리자/지점관리자/감사 담당자 route 순서를 한 줄씩 짧게 고정한다.
- happy/forbidden/empty/error/loading/mobile/PC 기록 포인트와 blocker/major/minor/copy-doc/approval-needed 분류를 같이 적는다.

### ops
- live 직접 확인 근거와 local preview/build/test/release gate 근거를 분리해서 결과 보고에 넣는다.
- smoke 대상은 `/login`, `/dashboard`, `/work-items/branch`, `/management`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/api/health` 순서로 짧게 적는다.
- rollback/runbook 확인 문서는 `RUNBOOK.md`, `DEPLOYMENT.md`, `docs/guides/phase-44-operator-runbook.md` 순서로 다시 묶는다.
- production secret/DB/DNS/유료 리소스는 자동 처리 완료처럼 쓰지 않는다.

## 9. 최종 한 줄 메모
Phase 49는 "이미 있는 일반업무·운영업무·지점업무·감사 기준선을 실제 파일럿 참가자 관점의 최종 UAT 회귀 순서로 다시 잠그는 문서 단계"다.
