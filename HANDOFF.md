# HANDOFF

## 다음 세션/다음 봇이 먼저 볼 것

1. `AGENTS.md` — 실행 규칙과 금지사항
2. `VISION.md` — 제품 방향
3. `ROADMAP.md` — Phase 순서
4. `TASKS.md` — 현재 Kanban 체인
5. `KNOWN_ISSUES.md` — 남은 리스크
6. `RUNBOOK.md` — 운영/장애 대응
7. `DEPLOYMENT.md` — 배포 확인 기준

## 현재 오케스트레이션 상태

- Board: `groupware`
- Repo: `/home/wrhrgw/gw`
- Bot home: `/home/wrhrgw/gw-dev-bot`
- Orchestrator: 싱드(`singde`)
- 역할봇: 도담(`gwplanner`), 이룸(`gwbuilder`), 바름(`gwreviewer`), 해봄(`gwtester`), 다온(`gwdocs`), 지킴(`gwops`)

현재 활성 흐름은 Phase 13 관리자 콘솔 실사용 1차다. 이번 단계에서는 관리자 진입 CTA, `/admin/*` 화면 우선순위, 감사 전용 진입 경계, route/API guard 유지 기준을 먼저 고정한다.

현재 구현 상태 요약:

- `/admin` 은 오늘 먼저 볼 운영 체크포인트, 권한별 진입 경계, 저장 전 승인 게이트, 하위 운영 콘솔 묶음을 먼저 보여 준다.
- `/admin/users` 는 사용자 큐, 역할 후보/권한 diff, 상태 변경 diff, 감사 후보 흐름을 저장 전 검토 화면으로 정리했다.
- `/admin/policies` 는 각 정책 카드를 현재 운영 기준 → candidate 변경안 → 필요 capability → 감사 preview 순서로 통일했다.
- `/admin/audit-logs` 는 조회 필터, 최근 이벤트 타임라인, 상세 패널, 비노출/회사 경계를 분리해 읽히도록 정리했다.
- 검증 근거: `apps/web/admin-console-pass1.test.tsx`, `apps/web/admin-skeleton-config.test.ts`, `apps/web/admin-preview-guard.test.ts`, `apps/web/org-employees-boundary.test.tsx`, `apps/web/dashboard-boundary.test.tsx`, `apps/web/api-same-origin-bridge.test.ts`, `apps/web/mobile-pwa.test.ts`, `apps/web` typecheck, `next build`.

제한적 재귀적 자기개선 루프가 적용된다.

- 현재 카드 범위 안에서만 반복 실수 방지, 테스트 실패 원인 기록, 체크리스트 보강, handoff 품질 개선을 한다.
- 자기개선 문서 갱신은 `AGENTS.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`로 제한한다.
- 다른 보드/repo/domain/mainbot, 운영 DB, 실데이터, secret, DNS, 유료 리소스, 배포/릴리즈/PR merge, 서비스 재시작, 카드 범위 밖 리팩토링은 자기개선 명목으로 자동 수행하지 않는다.
- 필요하면 “사용자 승인 필요”로 분리해 보고한다.

## 인수인계 원칙

- Kanban DB는 직접 쓰지 않는다.
- active/running/blocked를 먼저 확인한다.
- 승인된 범위 안의 검증 실패는 자동 재수정 루프로 처리한다.
- restricted 항목은 반드시 사용자 승인으로 분리한다.
- 최종 사용자 보고는 싱드가 쉬운 한국어로 통합한다.
