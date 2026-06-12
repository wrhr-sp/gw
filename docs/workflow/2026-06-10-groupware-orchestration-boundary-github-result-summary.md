# 그룹웨어 오케스트레이션 경계 분리 GitHub 작업 결과 정리

작성 목적
- gwops, gwreviewer, gwtester 결과를 한 번에 읽을 수 있게 쉬운 한국어로 정리한다.
- 사용자 보고 초안과 운영자 확인 포인트를 짧게 남긴다.
- 이 문서는 그룹웨어 repo/board/bot home 기준으로만 판단한다. OTA 쪽 조치 여부는 그룹웨어 결과에 섞지 않고 별도 확인 대상으로 둔다.

기준 근거
- Kanban task `t_4d5944d7` (gwops)
- Kanban task `t_732b160a` (gwreviewer)
- Kanban task `t_7085abd4` (gwtester)
- `docs/workflow/groupware-kanban-automation.md`
- `docs/workflow/groupware-bot-loop.md`
- `docs/workflow/bot-team-roles.md`
- `scripts/README.md`

## 1. 한 줄 결론

그룹웨어 GitHub 작업 자체는 PR #12까지 만들어졌고 로컬 대체 검증도 여러 건 통과했지만, 문서가 실제 스크립트 이름과 운영 규칙을 아직 완전히 따라가지 못해서 이번 묶음은 그대로 승인 완료로 보기 어렵다.

## 2. 실제 반영된 범위

이번 변경 묶음에는 아래 성격의 작업이 들어갔다.

- release-gate GitHub Actions workflow 추가
- direct Telegram read-only watcher 추가
- safe triage / second-pass / hourly status watcher 추가
- 예전 blocked/report-delivery shell watcher 일부 삭제
- `gw_pr_flow.py`, `gw-phase-workflow.sh`의 저장소 대상 보정
- 관련 운영 문서 다수 갱신

gwops 기준 패키징 결과
- branch: `chore/ota-gw-orchestration-sync`
- commit: `7166fe9`
- PR: `#12`

## 3. 확인된 좋은 점

리뷰와 테스트에서 아래는 공통으로 확인됐다.

- 기본 Telegram 자동 보고 경로는 `gw-hourly-status-report.py`의 정각 현황 보고다.
- `groupware` board dispatcher는 `singde` 단일 소유 원칙으로 정리돼 있다.
- 역할봇(`gwplanner`, `gwbuilder`, `gwreviewer`, `gwtester`, `gwdocs`, `gwops`)과 `gw-dev-bot`/아리아는 dispatcher를 직접 돌리지 않는 방향이 코드와 문서에 들어가 있다.
- watcher 쪽 핵심 Python 스크립트는 SQLite `mode=ro`를 사용한다.
- lock/flock, state 파일, backoff, safe stop 성격이 주요 watcher들에 들어가 있다.
- `notify-subscribe`나 별도 보고 카드 생성 방식은 기본 금지로 문서화돼 있다.

## 4. 지금 막힌 이유

승인이 막힌 핵심 이유는 문서 정합성이다.

1) 없는 스크립트 이름이 문서에 많이 남아 있다.
- 실제 파일은 `scripts/gw-*.sh` 중심인데, 문서 여러 곳이 아직 `scripts/groupware-*.sh`를 안내한다.
- 이 상태로 문서만 보고 따라 하면 운영자가 바로 실패할 수 있다.

2) 삭제했거나 기본 비활성인 watcher 설명이 문서에 남아 있다.
- 예: `gw-blocked-report-watch.sh`, `gw-report-action-watch.sh`, `gw-report-delivery-watch.sh`
- 특히 `scripts/README.md`는 아직 예전 실행 예시까지 포함한다.

3) GitHub/CI 최종 녹색 상태는 이 환경에서 끝까지 확인되지 않았다.
- reviewer 쪽 `gh` 인증 제약이 있었고,
- tester 쪽에서도 실제 PR/CI 진행성은 로컬에서 완전 확인되지 않았다.

## 5. 문서에서 특히 강조해야 할 운영 원칙

아래 원칙은 이번 결과 정리에서 계속 유지돼야 한다.

- 사용자 최종 보고는 싱드가 통합한다.
- 기본 Telegram 자동 보고 경로는 정각 현황 보고다.
- `singde`만 `groupware` board dispatcher를 단일 소유한다.
- 역할봇과 `gw-dev-bot`/아리아의 `dispatch_in_gateway`는 기본적으로 꺼둔다.
- 결과보고 카드/막힘보고 카드/`notify-subscribe` 방식은 기본 금지다.
- secret, `.env`, DNS, 운영 DB, 실제 배포, 유료/외부 공개 작업은 별도 승인 게이트 없이는 진행하지 않는다.

## 6. 검증 근거 요약

통과 근거
- `python3 -m py_compile ...` 통과
- `python3 -m unittest scripts.tests.test_gw_pr_flow` 통과
- `bash scripts/gw-auto-workflow.sh --preview --type review '샘플' '샘플 본문'` 통과
- `bash scripts/gw-kanban-status.sh` 통과
- `bash scripts/gw-kanban-dispatch-dry-run.sh` 통과
- `npx pnpm check` 통과
- `npx pnpm --filter @gw/web build:cf` 통과
- `bash scripts/gw-phase-workflow.sh --phase automation-hardening --preview --json` 는 backpressure 경고와 함께 의도된 차단(exit 2)

미확인/제약
- `gh` 미인증 환경이라 PR checks 최종 상태 확인 불가
- 변경 shell 전체에 대한 추가 일괄 검증 근거는 tester 카드 기준 일부 미실행 처리

## 7. 사용자 보고 초안

결론
- 오케스트레이션 동기화 변경은 PR #12까지 묶였고 로컬 검증도 여러 건 통과했지만, 문서가 실제 스크립트와 아직 완전히 맞지 않아 이번 건은 바로 승인 완료로 보기 어렵습니다.

근거
- direct Telegram 보고, `singde` 단일 dispatcher, 역할봇 dispatcher off, read-only watcher 원칙은 코드와 문서에서 확인됐습니다.
- 다만 일부 문서가 실제 없는 `groupware-*.sh` 경로와 이미 삭제된 watcher를 계속 안내하고 있습니다.
- PR/CI 최종 녹색 여부도 현재 환경에서는 끝까지 확인되지 않았습니다.

남은 리스크
- 운영자가 문서대로 실행하면 잘못된 스크립트 이름 때문에 실패할 수 있습니다.
- 삭제된 watcher 설명이 남아 있어 보고 경로를 혼동할 수 있습니다.
- GitHub checks 최종 상태는 별도 인증 가능한 환경에서 다시 확인해야 합니다.

다음 액션
- 문서에서 `groupware-*.sh` 경로와 삭제된 watcher 안내를 실제 `gw-*` 기준으로 정리합니다.
- `scripts/README.md`와 workflow 문서를 먼저 맞춘 뒤 reviewer/tester 재검증을 다시 받습니다.
- 필요하면 인증 가능한 환경에서 PR #12의 GitHub checks를 최종 확인합니다.

범위 분리
- 위 판단은 그룹웨어 repo(`/home/wrhrgw/gw`), `groupware` board, 싱드(`singde`) 운영 범위에 한정합니다.
- OTA repo/board/bot home의 조치 여부는 이 보고에서 판단하지 않습니다.

## 8. 문서 수정 여부

이번 카드에서는 운영 규칙 본문을 추가로 덮어쓰지 않고, 현재 상태를 설명하는 요약 문서만 새로 만들었다.

- 새 문서: `docs/workflow/2026-06-10-groupware-orchestration-boundary-github-result-summary.md`

## 9. 후속 권장 파일

우선순위가 높은 정리 대상은 아래다.

- `docs/workflow/groupware-kanban-automation.md`
- `docs/workflow/groupware-bot-loop.md`
- `docs/workflow/wsl-restart-handoff.md`
- `docs/workflow/bot-team-final-checklist.md`
- `scripts/README.md`
- 필요 시 `docs/plans/2026-06-10-release-gate-hardening-plan.md`
