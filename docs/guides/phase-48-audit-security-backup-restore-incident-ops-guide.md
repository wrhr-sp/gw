# Phase 48 감사·보안·백업/복구·장애대응·운영관제 가이드

## 한 줄 요약
이번 Phase 48에서는 새 보안 제품이나 자동 복구 시스템을 여는 것이 아니라,
`/admin/audit-logs`, `/management`, `/admin/users`, `/admin/policies`, `/api/health`, `RUNBOOK.md`, `DEPLOYMENT.md` 를 기준으로
"지금 바로 운영자가 확인할 수 있는 안전장치"와
"아직 수동 절차·승인 게이트로 남아 있는 일"을 헷갈리지 않게 정리하면 된다.

## 이 문서가 다루는 범위
- 감사 담당자 확인 순서
- 운영 관리자/담당자 확인 순서
- UAT 진행 절차
- 장애·복구·운영 체크리스트
- 아직 남아 있는 승인 게이트

이 문서는 production backup 실행 문서도 아니고,
외부 SIEM/alerting 구축 완료 보고서도 아니다.
현재 코드/문서에 이미 있는 최소 운영 기준선을
쉬운 한국어로 다시 묶는 문서다.

## 먼저 기억할 8가지
1. 익명 시작점은 계속 `/login` 이다.
2. COMPANY_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE 의 로그인 직후 공통 landing 은 `/dashboard` 다.
3. AUDITOR 의 로그인 직후 landing 은 `/admin/audit-logs` 다.
4. `/management` 는 일반 직원 홈의 연장이 아니라 운영 관리자 허브다.
5. `/admin/audit-logs` 는 read-only 감사 레인이며, raw 원문이 아니라 masked preview 로 읽는다.
6. `/api/health` 는 최소 liveness 확인용이지 full monitoring dashboard 가 아니다.
7. backup/restore/disaster/incident 대응은 아직 자동화 완료가 아니라 수동 runbook + 승인 게이트 중심이다.
8. `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.

## 접속 정보와 현재 근거
- `DEPLOYMENT.md` 현재 live URL 기록: `https://gw-web.wereheresp.workers.dev`
- `HANDOFF.md` 에는 이전 Phase 최종 통합 보고 흔적으로 `https://gw-web.werehere31.workers.dev` 가 함께 남아 있다.
- 테스트 계정: `admin / 1234`
- 현재 문서 근거: `docs/architecture/phase-48-audit-security-backup-restore-incident-ops-fit-gap-scope.md`, `docs/guides/phase-48-audit-security-backup-restore-incident-ops-handoff.md`
- 현재 구현 근거: `apps/api/src/lib/operational-admin.ts`, `apps/api/src/app.ts`, `packages/shared/src/admin-access.ts`, `packages/shared/src/contracts.ts`, `apps/web/admin-preview-guard.ts`, `apps/web/middleware.ts`
- 현재 검증 출발점: focused API 15 files / 98 passed / 4 skipped, focused web 24 files / 102 passed, `pnpm --filter @gw/mobile typecheck`, `pnpm --filter @gw/web build`, login-only redirect smoke baseline

중요:
- 이번 문서 작업에서는 live URL 자체를 다시 fetch 하거나 새 배포를 실행하지 않았다.
- 따라서 사용자-facing 최종 보고 전에는 운영자가 최신 실제 접속 URL 과 smoke 대상 URL 을 다시 확인해야 한다.
- 이 문서에서는 live 직접 재확인 근거와 local preview/build/test 대체 근거를 같은 뜻으로 섞지 않는다.

## 1. 감사 담당자 가이드

### 추천 순서
1. `/login`
2. `/admin/audit-logs`
3. 필요 시 `/employees`, `/org` 읽기 확인
4. `/api/health`
5. `RUNBOOK.md`

### 각 확인 포인트를 어떻게 읽으면 되는가

#### `/admin/audit-logs`
- 감사 read-only 진입점이다.
- `audit.read` 가 없는 사용자는 여기까지 오면 안 된다.
- before/after 는 raw 원문이 아니라 masked preview 로 읽는다.
- `maskedFields`, `storageRef(fileId/spaceId/versionId/storageStatus)`, `companyBoundary` 수준 설명이 핵심이다.
- signed URL, raw storage key, bucket, secret, production identifier 전문을 보는 화면처럼 설명하면 안 된다.

#### `/employees`, `/org`
- 감사 사용자가 참고용 읽기 범위를 확인하는 화면이다.
- 운영 변경 화면처럼 읽으면 안 된다.
- 감사 사용자를 회사 전체 운영 관리자처럼 설명하면 안 된다.

#### `/api/health`
- 서비스가 살아 있는지 보는 최소 liveness 기준이다.
- 감사 추적 시스템, 알림 시스템, 자동 복구 상태까지 모두 본다고 과장하면 안 된다.

## 2. 운영 관리자 / 담당자 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/management`
4. `/admin/users`
5. `/admin/policies`
6. `/admin/audit-logs`
7. `/api/health`
8. `RUNBOOK.md`
9. `DEPLOYMENT.md`

### 각 확인 포인트를 어떻게 읽으면 되는가

#### `/dashboard`
- 홈이다.
- 운영 CTA 가 보여도 곧바로 모든 운영 변경이 저장된다는 뜻은 아니다.
- 일반 직원 홈과 운영 레인이 섞이지 않는지 먼저 본다.

#### `/management`
- 일반 홈이 아니라 운영 관리자 허브다.
- 급여/세무/노무/법무/컴플라이언스 진입이 있다고 해도 실지급·실신고·외부 기관 연동 완료를 뜻하지 않는다.

#### `/admin/users`
- 계정 생성, 권한 diff, 상태 변경, 비밀번호 초기화 preview 를 읽는 운영 검토 화면이다.
- 실제 저장 완료나 외부 초대 발송 완료 화면처럼 읽으면 안 된다.

#### `/admin/policies`
- 정책 source, candidate, capability, audit preview 를 읽는 운영 검토 화면이다.
- 실제 조직 전체 정책 반영 완료나 개인별 override 저장 완료처럼 과장하면 안 된다.

#### `/admin/audit-logs`
- 운영자가 보는 감사 레인도 계속 read-only 다.
- 관리자라고 해서 raw 민감 원문까지 전부 본다고 설명하면 안 된다.
- `HR_ADMIN` 이 운영 검토를 할 수 있어도 `audit.read` 가 없으면 감사 로그는 별도 경계라는 점을 유지한다.

#### `RUNBOOK.md`, `DEPLOYMENT.md`
- 장애대응과 배포 확인의 현재 기준 문서다.
- 자동 복구, 외부 paging, 정기 복구 drill, production backup 실행 절차 완료 문서처럼 읽으면 안 된다.

## 3. 지금 바로 확인 가능한 것 / 아직 과장하면 안 되는 것

### A. 지금 바로 확인 가능한 것
- `/admin/audit-logs` read-only / masked preview / company boundary
- `audit.read` capability 경계
- general host / admin host 분리와 route guard
- role + permission + company/branch + self/foreign 차단 근거
- `GET /api/health` 최소 liveness 응답
- preview smoke, build/release gate, runbook 기반 운영 최소 기준
- rollback 확인 순서와 운영 문서 기준

### B. 아직 과장하면 안 되는 것
- production backup 자동화 완료
- restore drill 자동화 완료
- disaster recovery 완료
- incident 분류/에스컬레이션 자동화 완료
- 외부 SIEM / alerting / paging / on-call 완료
- 전용 운영 관제 dashboard 완료
- production DB 실복원 검증 완료

## 4. UAT 절차

### 4-1. 시작 전 준비
- 접속 URL, 테스트 계정, 운영 레인과 감사 레인을 먼저 분리해 적는다.
- `RUNBOOK.md`, `DEPLOYMENT.md`, `docs/guides/phase-44-operator-runbook.md` 를 먼저 읽는다.
- 이번 UAT 가 "외부 연동 없는 내부 운영 기준선 확인" 이라는 점을 먼저 공유한다.

### 4-2. 공통 시작 시나리오
1. `/login` 이 익명 유일 입구인지 확인
2. 로그인 뒤 landing 이 역할별 기준과 맞는지 확인
3. `/dashboard` 와 `/management` 가 같은 책임처럼 섞이지 않는지 확인
4. `/admin/audit-logs` 가 read-only / masked preview 기준을 유지하는지 확인
5. `/api/health` 가 최소 확인 route 로만 쓰이고 있는지 확인

### 4-3. 감사 레인 UAT
추천 순서:
- `/admin/audit-logs` → 필요 시 `/employees`, `/org` → `/api/health`

기록할 질문:
- 감사 사용자를 전체 운영 관리자처럼 오해하게 만들지 않는가
- masked preview 와 company boundary 설명이 흐려지지 않는가
- raw storage 정보 비노출 원칙이 유지되는가

### 4-4. 운영 관리자 레인 UAT
추천 순서:
- `/dashboard` → `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health`

기록할 질문:
- 운영 허브가 일반 홈과 분리되는가
- `/admin/users` 와 `/admin/policies` 가 운영 검토 화면으로 읽히는가
- `/admin/audit-logs` 가 관리자 일반 권한과 별도 capability 경계로 읽히는가
- `/api/health` 를 관제 전체 완료처럼 오해하게 만들지 않는가

### 4-5. runbook / 배포 기준 UAT
추천 순서:
- `RUNBOOK.md` → `DEPLOYMENT.md` → `docs/guides/phase-44-operator-runbook.md`

기록할 질문:
- 장애 시 무엇을 먼저 보고 무엇을 나중에 승인 받아야 하는지 분명한가
- rollback 과 smoke 재확인 순서가 있는가
- backup/restore/incident 대응이 아직 수동 절차라는 점이 숨겨지지 않는가
- live URL 과 smoke 기준이 문서마다 다를 경우 리스크로 기록되는가

### 4-6. 이슈 분류 기준
- blocker: 지금 운영 기준선 확인을 더 진행할 수 없게 막는 문제
- major: 진행은 되지만 감사/보안/복구 기대치를 크게 흔드는 문제
- minor: 흐름은 되지만 문장/순서/가이드 보강이 필요한 문제
- copy-doc: 문서/화면 정합성 문제
- approval-needed: 기능 문제가 아니라 별도 승인 없이는 진행하면 안 되는 항목

## 5. 운영 체크리스트

### 운영 전
- [ ] `/login` 이 익명 유일 입구로 유지된다.
- [ ] 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰인다.
- [ ] 감사 레인과 운영 관리자 레인을 다른 시나리오로 확인한다.
- [ ] live 직접 확인 근거와 local preview/build/test 대체 근거를 분리해 적는다.

### 운영 중
- [ ] `/management` 가 일반 직원 홈과 섞이지 않는다.
- [ ] `/admin/users` 와 `/admin/policies` 가 운영 검토 화면으로 읽힌다.
- [ ] `/admin/audit-logs` 가 계속 `audit.read` 기반 read-only / masked preview / company boundary 기준으로 설명된다.
- [ ] 관리자 일반 권한과 감사 권한이 같은 뜻처럼 섞이지 않는다.
- [ ] `/api/health` 가 최소 liveness 확인이라는 점이 유지된다.
- [ ] build/release gate, preview smoke, runbook 을 full monitoring 완료처럼 과장하지 않는다.
- [ ] backup/restore/disaster/incident 대응이 아직 수동 절차/승인 게이트 중심이라는 설명이 빠지지 않는다.
- [ ] live URL, 배포 기준, smoke 대상 route 차이가 있으면 억지 확정하지 않고 리스크로 남긴다.

### 운영 후
- [ ] 감사 레인 / 운영 관리자 레인 / runbook 레인을 따로 기록했다.
- [ ] blocker 와 approval-needed 를 분리했다.
- [ ] 지금 가능한 범위와 승인 게이트 범위를 분리했다.
- [ ] 다음 보고에 live URL, 테스트 계정, 추천 route, 남은 승인 게이트를 넣을 수 있게 정리했다.

## 6. 남아 있는 승인 게이트
- production backup/restore 실행
- production DB 실데이터 전환/seed/migration
- 정기 restore drill 자동화
- 외부 alerting / SIEM / paging / on-call 연동
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 생성·증액
- destructive 작업
- 실제 급여 지급, 은행 이체, 기관 신고
- 주민번호/계좌번호 등 민감정보 입력 확대

## 7. 최종 보고에 꼭 넣을 항목
- 현재 확인에 사용한 live URL 또는 재확인 필요 메모
- 테스트 계정 `admin / 1234`
- 추천 확인 route: `/login` → `/dashboard` → `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health`
- 운영 문서 확인 순서: `RUNBOOK.md` → `DEPLOYMENT.md` → `docs/guides/phase-44-operator-runbook.md`
- 남아 있는 승인 게이트 목록
- live 직접 확인 근거인지, local preview/build/test 대체 근거인지 구분한 메모