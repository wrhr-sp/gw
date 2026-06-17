# Phase 50 내부 그룹웨어 본격 도입 릴리즈 handoff

## 1. 이번 Phase를 한 줄로 말하면
이번 Phase는
지금까지 만든 그룹웨어를
"외부 연동 없이 우리 회사 내부 그룹웨어로 본격 도입 가능한가"라는 질문에서 한 단계 더 나아가,
"대장이 live URL에서 직접 로그인하고 핵심 업무를 실제로 따라갈 수 있는 릴리즈 패키지인가"를 잠그는 단계다.

쉽게 말하면,
- 어디서 로그인하는지
- 직원이 어떤 순서로 기본업무를 따라가는지
- 운영 관리자가 어디서 민감 업무를 보는지
- 지점관리자와 감사 담당자가 어디까지 봐야 하는지
- 무엇이 아직 승인 게이트인지
- 최종 보고에 무엇을 넣어야 하는지
를 한 번에 넘기는 문서다.

## 2. 이번 Phase에서 꼭 지켜야 할 제품 문장
- 익명 시작점은 `/login` 뿐이다.
- COMPANY_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE 의 공통 landing 은 `/dashboard` 다.
- AUDITOR 의 공통 landing 은 `/admin/audit-logs` 다.
- 대시보드=`/dashboard` 는 PC/모바일 공통 홈이다.
- 고정 바로가기 + 사용자 커스텀 바로가기 방향은 유지하되, 없는 편집/저장 기능을 완성품처럼 적지 않는다.
- `경영업무`(`/management`) 는 일반 직원 홈의 연장이 아니라 민감 운영 허브다.
- 급여/인사/노무/세무/법무/컴플라이언스는 지정 관리자/담당자만 접근한다.
- `/employees`, `/org` 는 읽기 중심 조회 레인이다.
- `/admin/users`, `/admin/policies` 는 운영 변경 preview/검토 레인이다.
- `/admin/audit-logs` 는 현재도 `audit.read` 기반 read-only 감사 레인이다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.
- skeleton/placeholder/dev-safe/read-only 를 최종 릴리즈 산출물처럼 과장하지 않는다.

## 3. 대장이 가장 짧게 따라갈 추천 확인 순서

### A. 시작점
1. `/login`
2. 로그인 후 `/dashboard`

먼저 볼 질문:
- 로그인 전에는 내부 앱이 열리지 않는가
- 로그인 후 대시보드가 홈처럼 읽히는가
- 테스트 계정 안내가 production 계정처럼 보이지 않는가

### B. 직원 기본업무 레인
1. `/dashboard`
2. `/attendance`
3. `/leave`
4. `/approvals`
5. `/boards`
6. `/documents`
7. `/me`

읽는 포인트:
- 오늘 할 일 시작점이 `/dashboard` 에서 자연스럽게 이어지는가
- 근태/휴가/전자결재/협업/문서 흐름이 서로 끊기지 않는가
- happy path 와 forbidden/empty/error/loading 상태가 서로 다른 뜻으로 읽히는가
- 직원 기본업무 안에 `경영업무` 또는 감사 레인이 섞이지 않는가

### C. 운영 관리자 레인
1. `/dashboard`
2. `/management`
3. `/admin/users`
4. `/admin/policies`
5. `/admin/audit-logs`
6. `/api/health`

읽는 포인트:
- `/management` 가 민감 운영 허브로 분리되는가
- `/admin/users` 가 계정 생성/권한 diff/활성·비활성/비밀번호 초기화 dev-safe preview 로 읽히는가
- `/admin/policies` 가 실제 영구 반영 완료가 아니라 운영 검토/candidate 문맥으로 읽히는가
- `/admin/audit-logs` 가 read-only 감사 레인으로 유지되는가
- `/api/health` 가 최소 liveness 기준으로만 읽히는가

### D. 지점관리자 / 인사·조직 확인 레인
1. `/dashboard`
2. `/work-items/branch`
3. `/employees`
4. `/org`
5. `/management`

읽는 포인트:
- `/work-items/branch` 가 branch scope 업무 레인으로 읽히는가
- `/employees`, `/org` 가 읽기 중심 조회로 읽히는가
- branch scope 와 company scope 가 같은 권한처럼 섞이지 않는가

### E. 감사 / 운영 기준선 레인
1. `/admin/audit-logs`
2. `/api/health`
3. `RUNBOOK.md`
4. `DEPLOYMENT.md`

읽는 포인트:
- read-only / masked preview / company boundary 가 유지되는가
- 운영 문서가 자동화 완료처럼 과장되지 않는가
- rollback/smoke/승인 게이트 설명이 남아 있는가

## 4. 이미 재사용 가능한 근거
- live URL: `https://gw-web.wereheresp.workers.dev`
- merge commit: `1f299108b47edc219fa1ac3ea6ce5fd9c8b82114`
- main release gate: success
- parent focused API: `99 passed / 4 skipped`
- parent focused web: `104 passed`
- `pnpm check` 통과
- `pnpm --filter @gw/web build:cf` 통과
- 익명 보호 route redirect smoke, `admin / 1234` 로그인/세션 유지/로그아웃, 역할별 guard matrix 근거 존재

중요:
- 위는 현재 parent 기준 baseline 이다.
- 이번 Phase에서는 대장이 직접 따라갈 확인 흐름과 최종 보고 문장을 여기에 덧씌우는 것이 핵심이다.
- live 직접 확인 근거와 local build/test/release gate 대체 근거는 최종 보고에서 분리해서 적는다.

## 5. builder가 바로 봐야 할 핵심 질문
1. 대장이 직접 눌러볼 직원 기본업무 흐름이 실제로 막힘 없이 이어지는가
2. `/management` 와 급여/인사/노무/세무/법무/컴플라이언스 진입이 직원 홈과 섞이지 않는가
3. skeleton/placeholder/dev-safe/read-only 로 남은 부분이 최종 릴리즈 산출물처럼 보이지 않는가
4. 로그인 우회, route/API guard 누락, company+branch scope 혼동, audit log 경계 누락이 없는가
5. 닫지 못한 영역은 honest 하게 approval-needed 또는 blocker 로 올릴 수 있는가

## 6. reviewer가 봐야 할 핵심 질문
1. 일반 직원 레인과 민감 운영 레인이 문구/화면/CTA 에서 섞이지 않는가
2. `admin / 1234` 가 production 기본 계정처럼 읽히지 않는가
3. `/admin/audit-logs` 가 감사 read-only 를 넘어서 조치 시스템 완성품처럼 과장되지 않는가
4. live 확인, release gate, local 빌드/테스트 근거를 같은 뜻으로 섞지 않았는가
5. restricted 승인 게이트를 release 완료 문장 속에 숨기지 않았는가

## 7. tester가 바로 따라갈 확인 순서
1. 로그인/로그아웃/session 유지/권한별 landing
2. 직원 기본업무 레인
3. 계정/권한/운영 허브 레인
4. 지점/조직/인사 읽기 레인
5. 감사 read-only 와 `/api/health`
6. happy / forbidden / empty / error / loading / mobile/PC 기록
7. build/typecheck/smoke 와 live 직접 확인 근거 구분

## 8. docs/ops가 이어받아야 할 정리 포인트
- 최종 사용자 보고에는 live URL, 로그인 시작점(`/login`), 테스트 계정, 역할별 추천 route, 남은 승인 게이트를 넣는다.
- 사용자 안내는 "직원 기본업무" 와 "경영업무/관리자" 를 같은 사용자 흐름처럼 섞지 않는다.
- 운영 체크리스트는 live 직접 확인 근거, local 대체 근거, release gate, rollback 확인 포인트를 분리한다.
- UAT 절차에는 시작 전 준비 → 레인별 실행 순서 → 기능별 기록 형식 → 이슈 분류 기준이 한 번에 있어야 한다.
- 문서에는 지금 가능한 것과 approval-needed 를 한눈에 구분해 적는다.
- 닫지 못한 placeholder/skeleton 잔여는 숨기지 말고 release blocker 또는 승인 게이트로 올린다.

## 9. 이번 Phase에서 하지 않는 것
- 실제 급여 지급/은행 이체
- 주민번호/계좌번호 확대 입력
- production DB 실데이터 반영/seed/migration
- 외부 IdP/SSO/SAML/SCIM
- 홈택스/4대보험/회계/노무사/세무사/변호사 외부 계정 연동
- 법령 API 인증키 등록
- DNS/custom domain
- 유료 리소스 증설
- secret 입력/교체
- destructive/force 작업

## 10. 관련 근거 문서
- `docs/architecture/phase-50-internal-groupware-full-adoption-release-fit-gap-scope.md`
- `docs/guides/phase-50-internal-groupware-full-adoption-release-guide.md`
- `docs/architecture/phase-49-pilot-feedback-reflection-final-uat-regression-fit-gap-scope.md`
- `docs/guides/phase-49-pilot-feedback-reflection-final-uat-regression-guide.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `HANDOFF.md`
- `TASKS.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `KNOWN_ISSUES.md`

## 11. 현재 체인
1. Phase 50 기획·fit-gap: `t_0cdaa5b7` — 도담(`gwplanner`) — 완료
2. Phase 50 구현: `t_b56865a6` — 이룸(`gwbuilder`) — 완료
3. Phase 50 리뷰: `t_8428a0e3` — 바름(`gwreviewer`) — 완료
4. Phase 50 테스트: `t_e3d48ed0` — 해봄(`gwtester`) — 완료
5. Phase 50 문서화: `t_db79476b` — 다온(`gwdocs`) — 진행 중
6. Phase 50 GitHub/배포 후속: `t_ae1c36b4` — 지킴(`gwops`) — 부모 대기