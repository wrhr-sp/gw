# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: 이전 scheduled 복구 카드 정리

현재 체인:

1. 기획: `t_35d9ec2c` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_b8ae373f` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_a0a1c2d2` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: 후속 parent gate 기준 진행
5. 문서화/최종 통합 보고: 후속 parent gate 기준 진행

현재 문서 기준 핵심 범위:

- 과거 web build flaky / review-required recovery loop 와 연결된 scheduled 카드를 최신 `main` 기준으로 다시 분류한다.
- 이미 merge/main 반영/검증 완료로 목적이 흡수된 카드는 stale 또는 superseded 후보로 정리한다.
- 아직 실제 미완료 목적이 남은 카드는 기준 카드 1장만 남기고 중복 카드는 정리한다.
- restricted 항목(secret, production, DNS/custom domain, 유료 리소스, destructive cleanup)은 자동 정리하지 않는다.
- 카드 정리는 Kanban DB 직접 수정이 아니라 카드 근거 정리와 안전한 상태 재분류 중심으로 수행한다.
- 같은 실패군에서 복구 카드가 계속 늘어나지 않게, 남길 카드와 닫을 카드를 근거 중심으로 나눈다.
- 2026-06-12 구현 보고서 `docs/guides/scheduled-recovery-card-cleanup-report-2026-06-12.md` 기준으로는 유지 대상 scheduled 카드는 없고, 예전 recovery loop 관련 scheduled 카드 14장이 stale/superseded 정리 후보다.

우선 참고 문서:

- `docs/architecture/scheduled-recovery-card-cleanup-scope.md`
- `docs/guides/scheduled-recovery-card-cleanup-handoff.md`
- `docs/guides/automation-hardening-review-gate-handoff.md`
- `docs/workflow/groupware-kanban-automation.md`
- `scripts/README.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
