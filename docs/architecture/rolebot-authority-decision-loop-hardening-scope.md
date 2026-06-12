# 역할봇 권한·판단루프·보고정책·검증자동화 고도화 범위

## 1. 한 줄 정의

이번 범위의 목표는 역할봇 권한 자체를 크게 넓히지 않고,
막힘을 줄여야 하는 지점은 싱드(`singde`)와 watcher 판단루프, 보고정책, 검증자동화 기준으로 보강하는 운영 설계를 고정하는 것입니다.

쉽게 말하면:
- 역할봇이 어디까지 직접 해도 되는지
- 어떤 막힘은 자동 정리 후보인지
- 어떤 막힘은 싱드가 직접 판단해야 하는지
- 어떤 경우는 꼭 사용자 승인으로 남겨야 하는지
를 같은 기준으로 정리하는 단계입니다.

이번 단계는 운영 정책/구현 handoff를 정리하는 기획 단계이며,
secret 입력, production DB 실데이터 변경, DNS/custom domain, 유료 리소스, migration, destructive 작업은 포함하지 않습니다.

## 2. 왜 이번 단계가 필요한가

이미 확인된 현재 상태:
- 관리자 PWA 관련 체인은 PR merge, release-gate, branch cleanup, 최종 통합 보고까지 한 번 돌아갔습니다.
- review-required gate, recovery loop, hourly status report 같은 자동화 골격도 이미 있습니다.
- 역할봇 gateway는 유지하되 dispatcher는 싱드 단일 소유로 운영하는 원칙도 이미 문서화돼 있습니다.

하지만 아직 남은 틈은 아래와 같습니다.

1. 역할봇 권한을 넓히는 방식과 watcher/싱드가 막힘을 정리하는 방식을 문서에서 더 분명히 구분할 필요가 있습니다.
2. `review-required`, `stale/superseded blocker`, `release cleanup blocker`, `already-handled` 같은 blocked 상태를 어떤 순서로 재판단할지 더 고정해야 합니다.
3. Telegram 보고에서 "자동화가 한 일", "싱드가 직접 개입한 일", "자동화가 못 끝낸 이유"가 섞여 보이면 사용자가 오해하기 쉽습니다.
4. 검증자동화가 "감지만 하고 끝"나지 않도록 fixture/dry-run/service journal/board state/PR-CI-main gate를 함께 보는 표준 검증 세트를 더 분명히 남겨야 합니다.
5. 기존 제품 기능 체인과 운영 자동화 체인이 서로 parent gate를 깨지 않도록 다음 작업 단위를 더 명확히 쪼갤 필요가 있습니다.

즉, 이번 단계의 핵심은 권한 확장이 아니라
"누가 판단하고, 무엇을 자동으로 닫고, 무엇에서 멈추는지"를 운영적으로 선명하게 만드는 것입니다.

## 3. 이번에 고정하는 핵심 결정

### 결정 A. 역할봇 전체 권한 확대는 기본 해법이 아니다.

기본 원칙:
- `gwplanner`, `gwbuilder`, `gwreviewer`, `gwtester`, `gwdocs`, `gwops`는 자기 역할 범위를 유지합니다.
- 카드 범위에 명시된 `release`, `PR merge`, `branch cleanup`, `review-required 정리`, `stale blocker 정리`, `검증 재실행` 같은 예외성 후속은 역할봇 공통 상시 권한이 아니라 card-scoped 승인 범위로 봅니다.
- 막힘을 줄이는 주된 수단은 역할봇 개별 권한 확대가 아니라 싱드/Watcher의 판단루프 보강입니다.

쉽게 말하면:
역할봇을 "무엇이든 처리하는 봇"으로 바꾸지 않고,
자동 정리 가능한 막힘만 운영 루프로 닫습니다.

### 결정 B. blocked 재판단 순서를 명시적으로 고정한다.

권장 판단 순서:
1. release cleanup 후보 확인
2. stale/superseded blocker 후보 확인
3. review-required + 표준 검증 재실행 후보 확인
4. 자동 재수정/recovery loop 후보 확인
5. restricted 또는 사람 판단 필요 항목으로 분류

이 순서를 두는 이유:
- 이미 끝난 카드나 중복 blocker를 먼저 닫아야 불필요한 재수정 카드 생성이 줄어듭니다.
- `review-required`를 무조건 사람 승인 대기로 보지 않게 됩니다.
- restricted 항목은 끝까지 자동 처리하지 않는 기준을 지킬 수 있습니다.

### 결정 C. `already-handled`는 "무시"가 아니라 재확인 신호다.

`already-handled` 또는 유사 반복 로그가 보이면 아래를 다시 확인합니다.
- 원본 blocked 카드 상태
- 생성된 체인의 최신 run/show 상태
- 후속 카드가 실제로 complete 되었는지
- 원본 blocker가 stale/superseded 상태인지

즉, `already-handled`는 해결 완료로 단정하는 로그가 아니라,
중복 정리 여부를 재확인해야 한다는 운영 신호로 취급합니다.

### 결정 D. card-scoped release cleanup은 별도 검증 세트를 통과해야만 자동 정리 후보가 된다.

자동 정리 후보가 되기 위한 최소 조건:
- PR merged 확인
- main 기준 CI/release-gate/deploy 확인
- remote branch 부재 확인
- `git diff <branch>..main` 또는 patch-id 동등성 확인
- checkout 위치와 dirty state 확인
- unrelated 변경을 같이 지우지 않는지 확인

즉, branch cleanup은 단순 습관 작업이 아니라
승인된 release cleanup 범위 안에서만 수행하는 검증 기반 후속입니다.

### 결정 E. Telegram 보고는 4개 축으로 나눠 기록한다.

사용자에게 보이는 해석 단위는 아래 4가지입니다.
- 자동화가 한 일
- 싱드가 직접 개입한 일
- 자동화가 못 끝낸 이유
- 보완한 자동화

추가 원칙:
- 카드 raw 이벤트 dump를 그대로 보내지 않습니다.
- blocked는 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요로 구분해 설명합니다.
- 카드 댓글만 달렸다고 사용자 보고 완료로 보지 않습니다.
- 정각 보고 외 즉시 보고는 싱드가 근거를 확인해 짧게 재해석합니다.
- 같은 카드·같은 이유·같은 근거라면 즉시 보고를 반복하지 않고, 상태 변화가 생겼을 때만 다시 보고합니다.
- 반복 에러나 `already-handled` 로그는 raw 로그를 연달아 보내지 말고 최신 상태 재확인 후 1회 요약으로 묶습니다.

### 결정 F. 검증자동화는 fixture + dry-run + service sweep + board state + GitHub gate를 한 세트로 본다.

최소 검증 묶음:
- fixture 시나리오: release cleanup, stale/superseded, review-required, already-handled
- dry-run: watcher/gate/recovery loop가 실제 변경 없이 어떤 판단을 하는지 확인
- service active/status/journal sweep
- board stats, blocked list, dispatch dry-run
- PR head check / main release-gate / deploy 결과 분리 확인

즉, 한 줄 명령 성공만으로 자동화를 완료로 보지 않고,
"판단이 맞았는지"와 "운영 상태가 살아 있는지"를 같이 봅니다.

### 결정 G. parent-gated 작업 그래프를 유지한다.

이번 묶음은 기존 제품 기능 체인과 섞어 한 카드에서 끝내지 않습니다.
권장 분리:
- 운영/구현: watcher 판단루프와 권한 게이트 보강
- 검증: fixture, dry-run, service/journal, board state 검증
- 문서/정책: Telegram 보고정책과 사용자-facing 예시 정리
- 최종 통합: 싱드가 각 결과를 묶어 승인/잔여 이슈 판단

이렇게 해야 기존 PWA/제품 체인의 parent gate를 깨지 않고,
운영 자동화 변경도 따로 검증할 수 있습니다.

## 4. 역할별 기본 권한과 예외 권한 기준

### 기본 역할 구분
- `gwplanner`: 범위 정의, 승인 게이트, 후속 작업 분리, 구현 handoff 작성
- `gwbuilder`: 제품 코드/스크립트 구현
- `gwreviewer`: 코드/정책/보안/경계 리뷰
- `gwtester`: fixture, dry-run, service 상태, 회귀 검증
- `gwdocs`: 사용자-facing/운영-facing 문서와 보고 양식 정리
- `gwops`: GitHub/PR/CI/merge/branch cleanup/release gate/운영 스크립트 조정

### card-scoped 예외 권한 원칙
아래는 카드 범위에 명시됐을 때만 허용 후보입니다.
- `PR merge`
- `release gate`
- `branch cleanup`
- `review-required` 정리
- `stale/superseded blocker` 정리
- 표준 검증 재실행

단, 아래 restricted 항목은 card-scoped라도 별도 승인 없이는 금지입니다.
- secret, `.env`, credential
- production DB 실데이터 변경
- DNS/custom domain
- 유료 리소스 생성/증설
- migration
- 운영 데이터 destructive/force
- 개인정보 원문 처리/외부 전송

## 5. 다음 구현 카드에서 바꿔야 할 후보 파일

### 운영/구현 후보
- `scripts/gw-auto-workflow.sh`
- `scripts/gw-review-required-gate.sh`
- `scripts/gw-review-required-recovery-loop.sh`
- `scripts/gw-hourly-status-report.py`
- 필요 시 `scripts/README.md`
- 필요 시 `docs/workflow/groupware-kanban-automation.md`
- 필요 시 systemd/runbook 문서

### 루트 문서 후보
- `AGENTS.md`
- `TASKS.md`
- `HANDOFF.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `KNOWN_ISSUES.md`
- `CHANGELOG.md`

중요:
이번 기획 단계는 "무조건 전부 수정"이 아니라,
각 후속 카드가 자기 범위에서 필요한 파일만 수정하도록 handoff를 주는 것이 목적입니다.

## 6. 구현자가 따라야 할 판단 기준

### A. blocked 분류 기준
- release cleanup 가능: 완료 증거가 이미 있고 정리만 남음
- stale/superseded: 후속 체인 성공으로 원본 blocker가 사실상 낡음
- review-required 재검증 가능: 표준 검증을 다시 돌리면 닫힘 여부 판단 가능
- 자동 재수정 필요: 실제 코드/설정 실패가 남아 recovery loop가 필요함
- 승인 필요: restricted 또는 제품/운영 판단을 사람이 내려야 함

### B. 싱드 직접 개입 기준
아래는 싱드가 직접 판단해야 합니다.
- 같은 카드/같은 실패군이 3회 이상 반복됨
- 중복 worker 또는 state 꼬임 의심
- `already-handled`가 반복되지만 실제 완료 여부가 불명확함
- Telegram 사용자 보고 여부를 최종 결정해야 함
- 원본 blocker와 후속 blocker 중 무엇을 남길지 정리해야 함

### C. 자동화가 끝까지 하지 말아야 할 것
- restricted 작업 실제 실행
- raw event dump 기반 사용자 자동 통지
- 근거 없이 blocked 자동 complete
- parent/child 그래프를 깨는 임의 unblock/complete
- unrelated branch/worktree/dirty 변경 정리

## 7. 권장 검증 기준

### 문법/기본 검증
- `bash -n scripts/gw-auto-workflow.sh`
- `bash -n scripts/gw-hermes-env.sh`
- `bash -n scripts/gw-review-required-gate.sh`
- `bash -n scripts/gw-review-required-recovery-loop.sh`
- `python3 -m py_compile scripts/gw-hourly-status-report.py`

### 자동화 동작 검증
- `--help`, `--dry-run`, `--once` 경로 확인
- release cleanup fixture 확인
- stale/superseded fixture 확인
- review-required fixture 확인
- `already-handled` 중복 로그 재확인 시나리오 확인

### 운영 상태 검증
- service active/status
- journal 최근 에러 sweep
- board stats
- blocked list
- dispatch dry-run

### GitHub/release 분리 검증
- PR head check
- merge 상태
- main release-gate run
- deploy 성공 여부
- branch/local cleanup 안전성

## 8. 완료로 볼 최소 기준

- 역할봇 권한 확대 대신 싱드/Watcher 판단루프를 강화한다는 방향이 문서에 고정된다.
- blocked 재판단 순서가 구현/검증/문서에서 같은 뜻으로 남는다.
- Telegram 보고가 자동화/싱드 직접 개입/실패 이유/보완 자동화로 분리된다.
- fixture/dry-run/service sweep/board state/GitHub gate 검증 세트가 handoff에 적힌다.
- restricted 항목과 승인 게이트가 분리된다.
- parent-gated 체인을 유지하는 후속 작업 단위가 정리된다.

## 9. 이번 단계에서 제외하는 것

- 제품 기능 자체의 새 화면/새 API 개발
- production DB migration 실행
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 생성/증설
- 외부 IAM/SSO/HR/감사 시스템 실제 연동
- 자동화 명목의 대규모 구조 변경
- 다른 board/repo/domain 작업

정리하면 이번 단계의 한 문장은 이것입니다.
역할봇을 더 세게 만드는 대신,
싱드와 watcher가 "무엇을 닫고 무엇에서 멈출지"를 더 똑똑하게 만드는 설계를 확정합니다.
