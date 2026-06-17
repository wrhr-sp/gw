# Phase 42 근태·휴가·인사·지점 운영 도입완성 handoff

## 1. 이번 Phase를 한 줄로 말하면

이번 Phase는 `/attendance`·`/leave`·`/employees`·`/org`·`/work-items/branch` 를 회사 내부에서 바로 도입 가능한 운영 흐름 언어로 다시 정리하는 단계다.

쉽게 말하면,

- 직원은 출퇴근과 휴가를 어디서 먼저 처리하는지,
- 관리자는 직원/조직/지점 운영을 어디서 어떻게 확인하는지,
- 아직 안 되는 외부 연동과 실데이터 범위는 무엇인지,

이 세 가지를 한 번에 헷갈리지 않게 만드는 문서다.

## 2. 이번 Phase에서 꼭 지켜야 할 제품 문장

- `/dashboard` 는 직원 기본 업무 시작점이다.
- `/attendance` 는 오늘의 출근/퇴근/정정 요청을 시작하는 화면이다.
- `/leave` 는 잔여 확인, 신청, 상태 조회를 묶는 화면이다.
- `/employees` 와 `/org` 는 읽기 중심 인사/조직 조회 화면이다.
- `/management` 와 `/work-items/branch` 는 운영자/지점 관리자 레인이다.
- 정책 미허용 출퇴근 방식, admin-only role 비노출, branch scope 분리, 외부 연동 미완료 상태는 모두 핵심 guardrail 이다.

## 3. 역할별 추천 도입 레인

### A. 일반 직원 기본 레인
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/me`

읽는 포인트:
- 오늘 출퇴근과 휴가 신청이 어디서 시작되는지
- 정책 때문에 안 되는 방식이 무엇인지
- 협업 기본 흐름(결재/게시판/문서)과 자연스럽게 이어지는지

### B. 팀장/승인자 보조 레인
- `/dashboard`
- `/leave`
- `/approvals`
- 필요 시 `/employees`

읽는 포인트:
- 휴가 신청과 승인 대기 흐름이 섞이지 않는지
- 직원 조회가 운영자 편집 화면처럼 보이지 않는지

### C. HR/운영자 레인
- `/management`
- `/employees`
- `/org`
- `/work-items/branch`
- `/admin/policies`
- `/admin/audit-logs`

읽는 포인트:
- 일반 직원 홈과 운영 허브가 분리되는지
- 조직/직원 조회와 정책/감사 화면이 같은 책임처럼 보이지 않는지
- 지점 운영이 branch scope 언어로 유지되는지

## 4. 이번 Phase에서 바로 이어받아야 할 구현 포인트

### A. 근태
- `/attendance` 첫 화면 copy 는 직원이 오늘 바로 써야 하는 행동 중심으로 유지한다.
- 정책 미허용 방식은 success 처럼 보이지 않게 한다.
- 태그 단말/GPS/외부 단말 연동은 아직 없으므로 예정 기능을 현재 기능처럼 적지 않는다.

### B. 휴가
- `/leave` 는 잔여 확인 → 신청 → 상태 확인 순서가 먼저 읽혀야 한다.
- 휴가 정책 설명은 `/admin/policies` 와 충돌하지 않게 맞춘다.
- 승인자 레인은 `/approvals` 와 이어지되 같은 화면 책임처럼 섞지 않는다.

### C. 직원/조직
- `/employees` 는 읽기 중심 조회 화면이다.
- `/admin/users` 와 같은 운영 편집 책임으로 설명하지 않는다.
- `/org` 는 부서/역할/권한/지점 scope 구조 확인 화면이다.
- admin-only role 이 일반 디렉터리에 섞이지 않는다는 경계를 유지한다.

### D. 지점 운영
- `/work-items/branch` 는 `경영업무` 아래 운영 레인으로 유지한다.
- 본사 운영과 지점 관리자 scope 를 구분한다.
- branch 업무 목록/상세/문서/마감 응답을 company-wide 자유 접근처럼 쓰지 않는다.

## 5. 현재 구현 근거 파일

### web 근거
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/org/page.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/work-items/branch/page.tsx`
- `apps/web/app/_components/phase34-live-sections.tsx`
- `apps/web/app/admin/policies/page.tsx`

### API/test 근거
- `apps/api/test/auth-org.spec.ts`
- `apps/web/admin-preview-guard.test.ts`

### 루트 문서 근거
- `ROADMAP.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `KNOWN_ISSUES.md`

## 6. 이번 Phase 구현/리뷰/테스트가 꼭 물어야 할 질문

1. `/attendance` 가 실제 오늘 업무 시작점처럼 읽히는가
2. 회사 정책에서 미허용한 출퇴근 방식이 성공처럼 보이지 않는가
3. `/leave` 가 잔여/신청/상태 흐름을 자연스럽게 보여 주는가
4. `/employees` 일반 조회와 `/admin/users` 운영 책임이 섞이지 않는가
5. `/org` 의 역할/권한/지점 scope 설명이 읽기 중심 구조로 유지되는가
6. `/work-items/branch` 가 일반 직원 홈이 아니라 운영 허브 아래에서만 읽히는가
7. 태그 단말, GPS, 외부 HR/급여/세무/노무 연동, production 실데이터가 아직 승인 게이트라는 점이 숨겨지지 않는가

## 7. 현재 Kanban 체인

1. Phase 41 최종 통합 보고 완료: `t_43dc2782` — 싱드(`singde`) — 완료
2. Phase 42 기획·fit-gap: `t_55849392` — 도담(`gwplanner`) — 완료
3. Phase 42 구현: `t_d23392aa` — 이룸(`gwbuilder`) — 완료
4. Phase 42 리뷰: `t_0533c055` — 바름(`gwreviewer`) — 완료
5. Phase 42 테스트: `t_7d7881aa` — 해봄(`gwtester`) — 완료
6. Phase 42 문서화: `t_7d36b077` — 다온(`gwdocs`) — 현재 카드
7. Phase 42 GitHub PR/CI/merge/branch cleanup: `t_bb3f666a` — 지킴(`gwops`) — 부모 대기

상위 parent 메모:
- Phase 41 최종 통합 보고 `t_43dc2782` 기준 live URL 은 `https://gw-web.wereheresp.workers.dev` 이다.
- dev/test/UAT 전용 테스트 계정은 `admin / 1234` 다.

2026-06-17 parent 재검증 메모:
- shared vitest 2개 파일 / 25개 테스트 통과
- API 15개 파일 / 98개 테스트 통과, 4개 skip
- web 23개 파일 / 97개 테스트 통과
- `pnpm --filter @gw/web build`, `pnpm check`, `pnpm --filter @gw/web build:cf` 통과
- local admin-host preview smoke(`PREVIEW_PORT=8793 BASE_URL=http://127.0.0.1:8793 bash scripts/gw-admin-host-preview-smoke.sh`) 통과
- route/API curl smoke 기준 익명 401/redirect, 직원·매니저·회사관리자별 `/management`·`/work-items/branch`·관련 API 경계 재확인
- reviewer 단계에서 shared contracts stray brace 와 홈 관리자 검토 흐름의 `/work-items/branch` 누락이 한 번 발견됐고, 자동 재수정·재리뷰·재검증 체인 뒤 해소됨

## 8. 완료 판단 기준

- 루트 문서와 Phase 42 scope/handoff 문서가 같은 뜻을 말한다.
- 근태/휴가/직원/조직/지점 운영을 일반 직원 레인과 운영자 레인으로 나눠 설명한다.
- 정책 미허용 방식, role boundary, branch scope, 승인 게이트를 숨기지 않는다.
- 다음 구현/리뷰/테스트 작업자가 어떤 route 와 테스트를 먼저 봐야 하는지 바로 알 수 있다.

## 9. 아직 남겨 두는 승인 게이트

- 실제 태그 단말 연동
- GPS/위치정보 기반 강제 검증
- 외부 HR/ERP/급여/세무/노무 시스템 연동
- production 직원/근태/휴가 실데이터 확대
- 주민번호/계좌번호 등 민감 원문 처리 확대
- 실제 급여 지급, 은행 이체, 기관 신고
- DNS/custom domain, 유료 리소스, migration, destructive 작업