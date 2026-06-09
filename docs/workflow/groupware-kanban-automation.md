# 그룹웨어 Kanban 자동화 운영 가이드

## 결론

그룹웨어 개발 자동화는 **아리아 접수 + 싱드 총괄 + `groupware` Kanban 보드**로 운영한다.

## 보드

- 보드 이름: `groupware`
- 기본 작업 폴더: `/home/wrhrgw/gw`
- Hermes 봇 홈: `/home/wrhrgw/gw-dev-bot`

## 명령

```bash
cd /home/wrhrgw/gw
./scripts/gw-kanban-status.sh
./scripts/gw-auto-workflow.sh --preview --type feature "샘플" "설명"
./scripts/gw-kanban-dispatch-dry-run.sh
./scripts/gw-kanban-dispatch-once.sh
./scripts/gw-ci-status.sh
```

지원 유형: `feature`, `bugfix`, `docs`, `review`, `ops`.


## 루프 갱신/감시 보강

OTA 쪽 루프 갱신 방식을 벤치마킹해 아래 스크립트를 추가했다.

```bash
./scripts/gw-ready-task-watch.sh 60 180
./scripts/gw-review-required-gate-watch.sh 60
./scripts/gw-kanban-watch-task.sh <task_id> groupware 60
```

- `gw-ready-task-watch.sh`: 오래 대기 중인 ready 카드를 감지해 dispatcher를 다시 실행한다.
- `gw-review-required-gate-watch.sh`: `blocked + review-required` 카드를 안전 게이트로 처리한다.
- `gw-kanban-watch-task.sh`: 단일 카드의 최종 상태와 최근 로그를 확인한다.

## Phase/GitHub 파이프라인 보강

```bash
./scripts/gw-phase-workflow.sh --preview "Phase 제목" "설명"
./scripts/gw-pr-flow.sh --show-status
```

- Phase 파이프라인: `기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub PR/CI 점검 → 싱드 최종 보고`
- GitHub PR/CI 자동화는 준비하되, 실제 PR 생성/merge/branch 삭제는 `--approved` 없이는 실행하지 않는다.
