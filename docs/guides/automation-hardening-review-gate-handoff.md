# 자동화 보강 handoff: review-required gate / recovery loop

한 줄 요약:
현재 운영 기준에서는 safe-triage Telegram watcher와 카드 이벤트 보고 watcher를 제거했고, Telegram 자동 보고는 정각 현황만 유지합니다. 이 문서는 review-required handoff를 자동으로 닫을 수 있는 경우 바로 다음 단계로 넘기고, 실제 코드/검증 실패는 자동 재수정→재리뷰→재검증→복구 정리 루프로 보내는 기준만 다룹니다.

## 1. 다음 작업자가 먼저 이해해야 할 상태

현재 로컬 변경 범위는 아래 4개입니다.

- `scripts/gw-auto-workflow.sh`
- `scripts/gw-hermes-env.sh`
- `scripts/gw-review-required-gate.sh`
- `scripts/gw-review-required-recovery-loop.sh`

이 묶음은 제품 화면 기능 변경이 아니라, Kanban 자동화가 막혔을 때 안전하게 이어가거나 멈추는 기준을 보강하는 작업입니다.

핵심 의도는 아래 4가지입니다.

1. `review-required`를 무조건 사람 승인 대기라고 보지 않는다.
2. 표준 검증으로 닫히는 막힘은 자동 complete + dispatch로 넘긴다.
3. 표준 검증 실패는 blocked 방치 대신 복구 mini-chain으로 보낸다.
4. secret/production DB/DNS/유료/배포/migration/파괴적 삭제는 끝까지 자동 처리하지 않는다.

## 2. 파일별로 무엇을 확인해야 하는가

### `scripts/gw-auto-workflow.sh`

확인 포인트:
- 새 카드 body에 자동화 안전 규칙과 카드 범위 승인 규칙이 주입되는지
- 성공한 worker가 `review-required`로 막지 말라는 공통 완료 규칙이 들어가는지
- 정각 현황 보고만 기본 Telegram 보고로 두고 `notify-subscribe`는 명시 env 없으면 기본 비활성인지

리뷰 질문:
- 카드 생성 단계에서 downstream worker가 막힘 기준을 오해하지 않게 충분히 설명하는가?
- `merge/release/deploy/branch cleanup` 카드 범위 승인 규칙이 기존 운영 규칙과 충돌하지 않는가?

### `scripts/gw-hermes-env.sh`

확인 포인트:
- `GW_BOT_HOME`, `HERMES_HOME`, `HERMES_PROFILE`, `HERMES_KANBAN_BOARD` 고정이 맞는지
- systemd user 환경에서 `pnpm`/`node`/`hermes`를 찾도록 PATH가 보강되는지
- 경로가 중복 추가되거나 잘못된 사용자 홈을 가리키지 않는지

리뷰 질문:
- PATH 보강 때문에 다른 위험 실행 경로가 새로 열리지는 않는가?
- 실행 파일 탐색 순서가 일관되고, 못 찾을 때 메시지가 분명한가?

### `scripts/gw-review-required-gate.sh`

확인 포인트:
- blocked 카드만 보되, review-required 감지는 Body 전체가 아니라 Latest summary/Runs 중심인지
- 표준 검증 명령이 성공하면 `kanban complete` 후 `dispatch --max 1`까지 이어지는지
- 실패하면 원본 카드에 중복 댓글 폭주 없이 recovery loop를 호출하는지
- DB malformed/disk I/O는 circuit-breaker로 빠지는지

리뷰 질문:
- `pnpm check`, `shared/api/web test/typecheck`, `web build`가 현재 저장소의 실제 표준 검증으로 맞는가?
- 실패 로그와 state 파일 처리 때문에 같은 카드에 복구 카드가 계속 늘어나지 않는가?

### `scripts/gw-review-required-recovery-loop.sh`

확인 포인트:
- 원본 blocked 카드를 즉시 unblock하지 않는지
- `gwbuilder → gwreviewer → gwtester → singde` 4단 복구 체인이 맞는지
- 실패 로그 tail이 새 카드 body에 붙는지
- idempotency key로 같은 blocked 카드의 재루프 카드가 중복 생성되지 않는지
- parent를 원본 blocked 카드가 아니라 마지막 성공 upstream에 거는 의도가 코드에 반영되는지

리뷰 질문:
- recovery 체인이 기존 parent/child 그래프를 깨지 않는가?
- 복구 정리 단계가 원본 카드 완료/후속 연결 여부를 판단하도록 충분한 문맥을 받는가?

## 3. 구현자가 직접 확인할 명령

아래 명령은 이번 묶음의 최소 확인용입니다.

### 문법/기본 실행 확인

```bash
bash -n scripts/gw-auto-workflow.sh
bash -n scripts/gw-hermes-env.sh
bash -n scripts/gw-review-required-gate.sh
bash -n scripts/gw-review-required-recovery-loop.sh
python3 -m py_compile scripts/gw-hourly-status-report.py
```

### help/dry-run 확인

```bash
bash scripts/gw-review-required-gate.sh --dry-run
bash scripts/gw-review-required-recovery-loop.sh --help
python3 scripts/gw-hourly-status-report.py --dry-run --force
```

### 환경 확인

```bash
bash -lc 'source ./scripts/gw-hermes-env.sh && command -v pnpm && command -v python3 && command -v "$HERMES_BIN"'
```

주의:
- 위 명령은 systemd PATH 문제를 로컬 셸에서 흉내 내는 1차 확인입니다.
- 실제 서비스 환경 검증은 운영자가 systemd user service 기준으로 한 번 더 봐야 합니다.

## 4. 리뷰어가 봐야 할 실패/성공 시나리오

### 성공 시나리오
- blocked 카드지만 Latest summary/Runs에 `review-required`가 있다.
- 표준 검증이 모두 통과한다.
- 카드가 complete 된다.
- 다음 ready 카드가 `dispatch --max 1`로 이어진다.
- Telegram triage watcher가 같은 이유를 계속 중복 보고하지 않는다.

### 실패 시나리오
- blocked 카드이고 `review-required`가 있다.
- 표준 검증 중 test/typecheck/build/check 중 하나가 실패한다.
- 원본 카드 상태는 blocked로 유지된다.
- 복구 mini-chain 4장이 생성된다.
- 새 카드 본문에 실패 로그 tail과 범위 제외 규칙이 붙는다.
- 같은 blocked 카드에 대해 복구 mini-chain이 무한 생성되지 않는다.

### 승인 필요 시나리오
- blocked 이유에 secret, production DB, DNS, 유료, migration, 외부 공개, 삭제 같은 restricted 마커가 있다.
- triage watcher는 Telegram 보고만 하고 자동 조치를 하지 않는다.
- review-required recovery loop도 이 범위를 넘어서면 안 된다.

## 5. 테스터가 남겨야 할 근거

최소한 아래 근거를 result/comment에 남기는 것이 좋습니다.

- 어떤 명령을 실행했는지
- 성공/실패가 어디서 갈렸는지
- DB 오류와 일반 검증 실패가 구분되는지
- recovery 카드가 실제로 몇 장 생성됐는지와 assignee/parent 연결이 맞는지
- dry-run과 실제 실행 결과 차이가 무엇인지

예시 정리 방식:
- 문법 확인: `bash -n ...`, `python3 -m py_compile ...`
- 동작 확인: `gw-review-required-gate.sh --dry-run`, `gw-hourly-status-report.py --dry-run --force`
- 실카드 검증: 테스트용 blocked/review-required 카드 1개를 대상으로 complete 또는 recovery chain 생성 확인

## 5-1. 이번 검증에서 실제로 확인된 것과 아직 미확인인 것

이번 부모 테스터 결과 기준으로 이미 확인된 것은 아래입니다.

- shell 문법 체크(`bash -n`)와 `python3 -m py_compile`은 모두 통과했습니다.
- `python3 -m unittest scripts.tests.test_gw_pr_flow -v` 7건이 통과했습니다.
- `gw-review-required-gate.sh --dry-run`은 정상 종료했고, 처리 대상 blocked review-required 카드가 없다는 메시지까지 확인했습니다.
- `gw-hourly-status-report.py --help`, `--once --dry-run`은 실행됐고, 실제 서비스가 이미 떠 있을 때는 단일 인스턴스 lock 때문에 추가 실행을 막는 것도 확인했습니다.
- `gw-review-required-gate-watch.service`, `gw-worker-recovery-watch.service`, `gw-hourly-status-report.timer`는 active 상태와 최근 정상 로그를 확인했습니다.

아직 이번 턴에서 직접 끝까지 확인하지 못한 것은 아래입니다.

- `gw-review-required-recovery-loop.sh`의 실제 카드 생성 dry-run/실행 경로는 CLI 승인 차단 때문에 직접 재현하지 못했습니다.
- `gw-hermes-env.sh`의 `command -v pnpm`, `command -v "$HERMES_BIN"` 출력 자체를 따로 캡처하지 못했습니다. 다만 watcher 서비스 active 상태와 gate/script 실행 성공으로 간접 확인한 상태입니다.

운영자가 마지막으로 확인하면 좋은 항목:

1. 테스트용 blocked/review-required 카드 1건으로 recovery loop가 실제로 4단 mini-chain을 만드는지
2. systemd user 환경에서 `source ./scripts/gw-hermes-env.sh` 후 `pnpm`, `python3`, `hermes` 탐색이 그대로 되는지
3. recovery loop가 같은 원본 카드에 대해 idempotency key로 중복 생성되지 않는지

## 6. 이 묶음에서 절대 놓치면 안 되는 경계

- Kanban DB 직접 쓰기 금지
- watcher는 read-only 조회 우선
- blocked는 진짜 승인/위험 멈춤에만 유지
- 복구 가능한 실패는 구현→리뷰→재검증 루프로 보낼 것
- 원본 blocked 카드는 증거 없이 unblock하지 말 것
- Telegram 보고는 해석 요약이지 worker raw dump가 아님
- secret/production DB/DNS/유료/배포/migration/삭제는 자동 처리 금지

## 7. 추천 검증 순서

1. 문법 체크부터 한다.
2. `gw-hermes-env.sh`로 PATH/HERMES_BIN 확인을 한다.
3. gate/triage 스크립트의 `--help`, `--dry-run`, `--once`를 먼저 본다.
4. 가능하면 테스트용 blocked/review-required 카드 1건으로 gate 성공 시나리오를 확인한다.
5. 의도적으로 검증 실패가 나도록 만든 테스트 카드 또는 실패 로그로 recovery loop 생성 경로를 확인한다.
6. 마지막에 운영 문서(`docs/workflow/groupware-kanban-automation.md`, `scripts/README.md`) 설명이 실제 코드와 같은지 맞춘다.

## 8. 함께 읽으면 좋은 문서

- `docs/architecture/automation-hardening-review-gate-scope.md`
- `docs/workflow/groupware-kanban-automation.md`
- `scripts/README.md`
- `AGENTS.md`

## 9. 이번 범위에서 여전히 별도 승인 필요한 것

- secret 입력/교체
- production DB 실데이터 변경
- DNS/custom domain
- 유료 리소스 생성/증액
- 실제 개인정보 처리/외부 HR 연동
- 실제 외부 공개/실배포
- destructive cleanup
