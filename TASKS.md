# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 42 문서화·release gate 준비 — 근태·휴가·인사·지점 운영 도입완성

현재 체인:

1. Phase 42 기획·fit-gap: `t_55849392` — 도담(`gwplanner`) — 완료
2. Phase 42 구현: `t_d23392aa` — 이룸(`gwbuilder`) — 완료
3. Phase 42 리뷰: `t_0533c055` — 바름(`gwreviewer`) — 완료
4. Phase 42 테스트: `t_7d7881aa` — 해봄(`gwtester`) — 완료
5. Phase 42 문서화: `t_7d36b077` — 다온(`gwdocs`) — 진행 중
6. Phase 42 GitHub PR/CI/merge/branch cleanup: `t_bb3f666a` — 지킴(`gwops`) — 부모 대기

현재 메모:

1. 이번 카드의 목적은 `/attendance`·`/leave` 직원 기본 업무와 `/employees`·`/org` 읽기 중심 조회, `/management` 아래 `/work-items/branch` 운영 레인을 한 세트의 내부 도입 언어로 다시 정리하는 것이다.
2. 현재 구현 근거는 `apps/web/app/attendance/page.tsx`, `apps/web/app/leave/page.tsx`, `apps/web/app/employees/page.tsx`, `apps/web/app/org/page.tsx`, `apps/web/app/management/page.tsx`, `apps/web/app/work-items/branch/page.tsx`, `apps/web/app/_components/phase34-live-sections.tsx`, `apps/api/test/auth-org.spec.ts`, `apps/web/admin-preview-guard.test.ts` 에 걸쳐 있다.
3. 최신 parent 테스트 기준으로 focused shared/API/Web 회귀, `pnpm check`, Next/OpenNext build, local admin-host preview smoke, 익명·직원·매니저·회사관리자 route/API curl smoke 가 모두 다시 통과했다.
4. reviewer 단계에서는 shared contracts 구문 오류와 홈 관리자 검토 흐름의 `/work-items/branch` 누락이 한 번 발견됐고, 자동 재수정·재리뷰·재검증 체인으로 해소된 뒤 최종 테스트가 완료됐다.
5. 구현 카드 본문과 현재 화면 copy 는 대시보드 기본 순서를 `/attendance -> /leave -> /approvals -> /boards -> /documents -> /me` 로 다시 고정하고, 운영 레인은 `/management -> /work-items/branch -> /admin/users -> /admin/policies -> /admin/audit-logs` 로 분리한다.
6. 테스트 계정 `admin / 1234` 는 계속 dev/test/UAT 전용이며 production 기본 계정이 아니다.

현재 문서 기준 핵심 범위:

- `/dashboard` 는 직원 홈이고 기본 순서는 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 다.
- `/attendance` 는 오늘 출퇴근·퇴근·정정 요청 시작점으로, 정책 미허용 방식이 성공처럼 보이지 않게 유지한다.
- `/leave` 는 잔여 확인 → 신청 → 상태 확인 흐름을 먼저 읽히게 하고, 승인자 lane 은 일반 직원 lane 과 분리한다.
- `/employees` 와 `/org` 는 읽기 중심 조회 화면이며 운영 변경 저장/편집 화면으로 과장하지 않는다.
- `/management` 아래 `/work-items/branch` 는 branch scope 운영 레인이며, 본사 운영과 지점 관리자 가시 범위를 같은 full access 로 뭉개지 않는다.
- production 데이터, secret, DNS/custom domain, 유료 리소스, 외부 SSO/OAuth/SMS/OTP, migration, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 확인 가능한 영역
- `/dashboard` 기준 기본 업무 순서와 `/management` 분리
- `/attendance` today flow, 정책 미허용 방식 차단, 정정 요청 preview
- `/leave` 잔여/신청/상태 조회와 승인자 lane 분리
- `/employees`·`/org` 읽기 중심 조회와 admin-only role 비노출 경계
- `/work-items/branch` branch scope 업무 목록/상세/문서/마감 흐름

### 현재 문서화·release gate에서 마지막으로 볼 영역
- 최신 tester 근거가 루트 문서, handoff, QA 문서에 같은 말로 반영됐는지
- 대시보드 기본 레인과 경영업무 운영 레인이 사용자/운영/QA 문서에서 서로 다르게 풀리지 않는지
- reviewer가 잡았던 `/work-items/branch` 누락과 shared contracts 구문 오류 해소 이력이 release gate 메모에 반영됐는지

## 다음 우선순위

Phase 42의 다음 우선순위는
이미 통과한 구현·리뷰·테스트 근거를 사용자/운영/QA 문서에 같은 언어로 닫고,
근태·휴가·읽기 중심 조회·branch scope 운영 레인 분리와 승인 게이트를 다시 교차확인한 뒤
PR/CI/main 자동배포 확인으로 넘기는 것이다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/dashboard`
- `/attendance`
- `/leave`
- `/employees`
- `/org`
- `/management`
- `/work-items/branch`
- `apps/web/app/_components/phase34-live-sections.tsx`
- `apps/api/test/auth-org.spec.ts`
- `apps/web/admin-preview-guard.test.ts`

다음 패스에서 바로 줄여야 할 잔여:
- 루트 문서와 Phase 42 handoff 에 최신 tester 근거를 같은 표현으로 맞추기
- `/attendance`·`/leave` 직원 기본 레인과 `/management`·`/work-items/branch` 운영 레인이 문서마다 같은 뜻인지 다시 맞추기
- `/employees`·`/org` 읽기 중심 조회와 `/admin/users` 운영 검토 책임 분리가 흐려지지 않게 유지하기
- 태그 단말, GPS, 외부 HR/급여/세무/노무 연동, production 실데이터 확대가 여전히 승인 게이트인지 release gate에서 다시 붙잡기

우선 참고 문서:
- `docs/architecture/phase-42-attendance-leave-hr-branch-operations-adoption-fit-gap-scope.md`
- `docs/guides/phase-42-attendance-leave-hr-branch-operations-adoption-fit-gap-handoff.md`
- `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
- `docs/architecture/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-scope.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- Phase 42 구현: `t_d23392aa` — 이룸(`gwbuilder`) — done
- Phase 42 리뷰: `t_0533c055` — 바름(`gwreviewer`) — done
- Phase 42 테스트: `t_7d7881aa` — 해봄(`gwtester`) — done
- Phase 42 문서화: `t_7d36b077` — 다온(`gwdocs`) — running
- Phase 42 GitHub PR/CI/merge/branch cleanup: `t_bb3f666a` — 지킴(`gwops`) — parent-gated

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
