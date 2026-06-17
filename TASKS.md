# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 49 기획·fit-gap — 파일럿 피드백 반영·최종 UAT 회귀

### 메인 체인 (Phase 49 파일럿 피드백 반영·최종 UAT 회귀 묶음)
1. Phase 48 최종 통합 보고 — 완료
2. Phase 49 기획·fit-gap: `t_863c42fb` — 도담(`gwplanner`) — 완료
3. Phase 49 구현: `t_d8a06de9` — 이룸(`gwbuilder`) — 완료
4. Phase 49 리뷰: `t_d15439a2` — 바름(`gwreviewer`) — 완료
5. Phase 49 리뷰 후속 수정: `t_28b29919` — 이룸(`gwbuilder`) — 완료
6. Phase 49 테스트: `t_8adfef8d` — 해봄(`gwtester`) — 완료
7. Phase 49 문서 최종 보강: `t_57deb728` — 다온(`gwdocs`) — 진행 중

## Phase 49 현재 메모

1. 이번 Phase의 목적은 Phase 45~48에서 잠근 내부 도입·온보딩·운영 안정성·감사 기준선을 바탕으로 직원/운영 관리자/지점관리자/감사 담당자 역할별 UAT 회귀 순서를 다시 묶는 것이다.
2. 현재 근거는 `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/management`, `/work-items/branch`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/api/health` 와 관련 route/API/test 문서 전반에 걸쳐 있다.
3. 핵심은 일반 업무 레인, 운영 관리자 레인, 지점 업무 레인, 감사 read-only 레인을 같은 관리자 묶음처럼 섞지 않고 각자 파일럿 기록 언어로 다시 잠그는 것이다.
4. happy path, forbidden, empty, error, loading, mobile/PC 기록 포인트를 역할별 UAT에 같은 형식으로 적용해야 한다.
5. production DB, 외부 IdP, 실급여/실신고, production backup/restore, SIEM/alerting, secret/DNS/custom domain/유료 리소스는 계속 별도 승인 게이트다.

## Phase 49 핵심 범위

- 직원 레인 `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 최종 UAT 순서 재정리
- 운영 관리자 레인 `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health` 최종 UAT 순서 재정리
- 지점관리자 레인 `/work-items/branch` 와 `/employees`·`/org` 읽기 확인, `/management` 운영 허브 문맥 차이 재정리
- happy/forbidden/empty/error/loading/mobile/PC 기록 포인트를 역할별 UAT 형식으로 재정리
- live URL / 운영 문서 근거 / 승인 게이트를 최종 보고 패키지 기준으로 재정리

현재 기준 문서 세트:
- `docs/architecture/phase-49-pilot-feedback-reflection-final-uat-regression-fit-gap-scope.md`
- `docs/guides/phase-49-pilot-feedback-reflection-final-uat-regression-handoff.md`
- `docs/guides/phase-49-pilot-feedback-reflection-final-uat-regression-guide.md`
- `docs/architecture/phase-48-audit-security-backup-restore-incident-ops-fit-gap-scope.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-handoff.md`
- `docs/guides/phase-44-operator-runbook.md`

## Phase 49 현재 검증 메모

1. 최신 기준은 focused API 15 files / 98 passed / 4 skipped, focused web 24 files / 103 tests passed, web typecheck, web build, web build:cf, login-only redirect smoke baseline 이다.
2. 현재 구현에는 일반 업무 레인, 운영 허브, branch scope 레인, 감사 read-only 레인, general/admin host guard, operator runbook 이 이미 존재한다.
3. reviewer 가 처음 잡은 홈/company-scope vs branch-scope 혼동 문구는 후속 builder 카드 `t_28b29919` 에서 정리됐고, 문서에는 이 최신 분리 기준만 남긴다.
4. 현재 Phase 49 사용자-facing 기준 live URL 메모는 `wereheresp` 단일 host 다. 다만 예전 Phase 문서에 `werehere31` 과거 흔적이 남아 있어 최종 보고에서는 과거 기록과 현재 기준을 섞지 않는다.

## Phase 49 다음 우선순위

1. 문서 카드 `t_57deb728` 에서 happy/forbidden/empty/error/loading/mobile/PC 기록, live URL, smoke 대상 URL, release gate, rollback 문서를 최종 보고 문장으로 잠그기
2. ops/통합 보고 단계에서는 live 직접 확인 근거와 local preview/build/test 대체 근거를 분리해 적기
3. 예전 Phase 문서의 `werehere31` 흔적은 과거 기록으로만 남기고, 현재 사용자-facing 안내에는 `wereheresp` 단일 host 기준을 유지하기

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/work-items/branch`
- `/management`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/api/health`
- `RUNBOOK.md`
- `DEPLOYMENT.md`

## Phase 49 승인 게이트

- production backup/restore 실행
- production DB 실데이터
- 실제 incident paging / 외부 alerting / SIEM 연동
- 정기 restore drill 자동화
- DNS/custom domain
- 유료 리소스
- secret 입력/교체
- migration
- destructive 작업

우선 참고 문서:
- `docs/architecture/phase-48-audit-security-backup-restore-incident-ops-fit-gap-scope.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-handoff.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-guide.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/guides/phase-47-operational-stability-performance-mobile-pwa-usability-handoff.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `ROADMAP.md`
- `HANDOFF.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```