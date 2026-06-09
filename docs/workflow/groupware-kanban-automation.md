# 그룹웨어 Kanban 자동화 운영 가이드

## 결론

그룹웨어 개발 자동화는 **아리아 접수/1차 보고 + 싱드 오케스트레이션 승인 요청 + `groupware` Kanban 보드**로 운영한다.
아리아의 승인은 싱드 전달 승인이고, 실제 Kanban 파이프라인 생성/dispatch는 싱드가 대장에게 다시 실행 승인을 받은 뒤 진행한다.
대장이 싱드에게 직접 요청한 경우도 동일하게, 싱드는 먼저 요청 요약·범위·위험·예상 파이프라인을 보고하고 실행 승인을 받은 뒤에만 실제 Kanban 작업을 만든다.

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

`gw-auto-workflow.sh`와 `gw-phase-workflow.sh`의 실제 카드 생성 명령은 싱드 단계 실행 승인 후에만 사용한다. 승인 전에는 `--preview`와 상태 조회 명령만 사용한다.

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

- Phase 파이프라인: `기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub PR/CI/merge/branch 정리 → 싱드 최종 보고`
- GitHub 자동화는 승인된 오케스트레이션 범위 안에서 PR 생성, CI 확인, PR merge, 원격/로컬 branch 삭제까지 포함한다. 스크립트 실행 시에는 안전 플래그 `--approved`를 붙여 실행한다.


## 자동보고 예외범위 / 감시 루프

OTA의 갱신된 자동보고 범위를 그룹웨어에 맞게 적용한다.

- `gw-blocked-report-watch.sh`: `blocked`/`review-required` 등 실제 멈춤 카드만 싱드 보고 카드로 생성한다.
- `gw-worker-recovery-watch.sh`: stale running, timeout/crash/protocol violation 징후를 원본 카드 comment로 남긴다.
- 정상 진행, 단순 완료, 역할봇 중간 로그는 자동보고하지 않는다.
- 비밀값·권한·비용·외부 배포/연결·DB/운영 데이터 변경은 승인 전 자동 실행하지 않는다.
