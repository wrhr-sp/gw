# 역할봇 권한·판단루프·보고정책·검증자동화 고도화 handoff

한 줄 요약:
이번 묶음은 역할봇 권한을 넓히는 작업이 아니라, 카드 범위 안에서 자동으로 닫아도 되는 막힘과 꼭 사람이 판단해야 하는 막힘을 싱드/Watcher 기준으로 더 정확히 나누는 작업입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 것:
- 역할봇 6종과 싱드 단일 dispatcher 원칙
- review-required gate / recovery loop / hourly report 골격
- release cleanup, branch cleanup, stale blocker 정리의 운영 경험
- Telegram raw 이벤트 중계 금지와 정각 보고 유지 원칙

이번 묶음에서 더 또렷하게 만들 것:
- blocked를 어떤 순서로 다시 판단할지
- `already-handled`를 어떻게 재확인할지
- 자동화가 한 일과 싱드가 직접 한 일을 어떻게 분리 보고할지
- fixture/dry-run/service sweep/board state/GitHub gate를 어떤 세트로 검증할지

즉, "역할봇에게 더 많은 버튼을 준다"가 아니라
"자동화와 오케스트레이터가 같은 기준으로 판단한다"가 핵심입니다.

## 2. 다음 작업자를 위한 권장 읽기 순서

1. `docs/architecture/rolebot-authority-decision-loop-hardening-scope.md`
2. 이 handoff 문서
3. `AGENTS.md`
4. `docs/guides/automation-hardening-review-gate-handoff.md`
5. `RUNBOOK.md`
6. `TEST_PLAN.md`
7. `QA_CHECKLIST.md`
8. `docs/workflow/groupware-kanban-automation.md`
9. 필요 시 `scripts/README.md`

## 3. 후속 카드별 구현 포인트

### A. `gwops` 구현 카드에서 먼저 볼 것
대상 카드:
- `t_f1bb9e46` 구현: 판단루프·역할 권한 게이트 보강

우선 확인 파일:
- `scripts/gw-auto-workflow.sh`
- `scripts/gw-review-required-gate.sh`
- `scripts/gw-review-required-recovery-loop.sh`
- `scripts/gw-hourly-status-report.py`
- 필요 시 `scripts/README.md`
- 필요 시 `docs/workflow/groupware-kanban-automation.md`

구현 핵심:
1. blocked-remediation watcher 판단 순서를 고정합니다.
   - release cleanup
   - stale/superseded cleanup
   - review-required 재검증
   - recovery loop 생성
   - 승인 필요 분류
2. `already-handled`를 만나면 무시하지 말고 원본 카드와 생성 체인의 최신 상태를 다시 확인합니다.
3. card-scoped `PR merge`/`branch cleanup`/`release gate` 자동 정리는 증거가 있을 때만 후보로 다룹니다.
4. 역할봇이 직접 하면 안 되는 영역과 싱드/Watcher가 정리할 원본·중복 blocker 기준을 코드와 주석에 남깁니다.

절대 하면 안 되는 것:
- restricted 작업 실제 실행
- 원본 blocked 카드 근거 없는 자동 complete
- parent/child 그래프를 깨는 임의 unblock
- unrelated local dirty state 정리

### B. `gwtester` 검증 카드에서 먼저 볼 것
대상 카드:
- `t_b29e5fb7` 검증자동화: blocker 판단 fixture·service sweep 검증 고도화

우선 확인 파일:
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `RUNBOOK.md`
- `docs/guides/automation-hardening-review-gate-handoff.md`
- 구현 카드에서 바뀐 스크립트들

검증 핵심:
1. fixture 시나리오를 각각 분리해 확인합니다.
   - release cleanup fixture
   - stale/superseded fixture
   - review-required fixture
   - `already-handled` 재확인 fixture
2. dry-run만 보지 말고 service active/status, journal, board stats, blocked list, dispatch dry-run까지 확인합니다.
3. GitHub 관련 범위가 있으면 PR head check, merge 상태, main release-gate, deploy 흔적을 분리해서 확인합니다.
4. 자동화가 못 처리하는 조건과 별도 승인 필요 조건을 결과에 따로 적습니다.

특히 남겨야 할 근거:
- 실행 명령
- 통과/실패 지점
- service/journal 상태
- board 상태
- 생성된 카드/체인 수와 parent 연결
- dry-run과 실제 실행 차이

### C. `gwdocs` 문서/정책 카드에서 먼저 볼 것
대상 카드:
- `t_3072e2ca` 문서/정책: 판단형 Telegram 보고정책 고도화

우선 확인 파일:
- `AGENTS.md`
- `HANDOFF.md`
- `QA_CHECKLIST.md`
- `TEST_PLAN.md`
- `RUNBOOK.md`
- 필요 시 `README.md`, `scripts/README.md`, `docs/workflow/groupware-kanban-automation.md`

문서 핵심:
1. 사용자-facing 보고 템플릿에 아래 4개 축을 분명히 적습니다.
   - 자동화가 한 일
   - 싱드가 직접 개입한 일
   - 자동화가 못 끝낸 이유
   - 보완한 자동화
2. blocked 분류를 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요로 나눕니다.
3. 정각 보고 외 raw 이벤트 중계 금지 원칙을 유지합니다.
4. 카드 댓글만으로 사용자 보고 완료라고 보지 않는다는 기준을 다시 적습니다.
5. 쉬운 한국어 예시 문구를 함께 남깁니다.

## 4. 이번 범위에서 고정한 핵심 판단 기준

### blocked 판단 순서
1. release cleanup 후보
2. stale/superseded blocker 후보
3. review-required 재검증 후보
4. recovery loop 후보
5. 승인 필요/사람 판단 필요

### `already-handled` 해석
- 해결 완료 확정이 아님
- 원본 카드와 후속 체인의 최신 상태를 재확인하라는 신호
- 중복 체인/중복 댓글 폭주가 없는지 확인 필요

### release cleanup 자동 정리 최소 조건
- PR merged
- main CI/release-gate/deploy 확인
- remote branch 없음
- patch-id 또는 diff 동등성 확인
- checkout/dirty state 안전성 확인
- unrelated 변경 삭제 없음

### 사용자 보고 최소 구조
- 결론
- 자동화가 한 일
- 싱드가 직접 개입한 일
- 자동화가 못 끝낸 이유
- 보완한 자동화
- 다음 액션
- 승인 필요 여부

### blocked 분류 설명
- 방치: 다음 처리 주체나 다음 액션이 비어 있는 상태. 허용 분류가 아니라, 이런 상태가 보이면 싱드가 바로 재분류합니다.
- 자동복구중: 표준 검증 재실행, recovery loop, release cleanup 재확인처럼 승인된 자동 처리 흐름이 실제로 돌고 있는 상태.
- 승인필요: restricted 항목, 제품/운영 판단, 외부 권한, 비용, 비밀값처럼 사람 결정 없이는 진행하면 안 되는 상태.
- 싱드 직접정리: 같은 실패가 3회 이상 반복되거나, `already-handled` 반복·중복 worker·사용자 보고 누락처럼 싱드가 직접 상태를 정리해야 하는 상태.
- 자동화 보완필요: 이번 카드 자체는 정리했더라도, 같은 혼선이 다시 생기지 않게 watcher/템플릿/검증 규칙을 손봐야 하는 상태.

### 사용자-facing 쉬운 한국어 예시

```text
[작업 최종 결과]
한 줄 결론:
- 관리자 PWA 설치 문구와 오프라인 안내를 정리했고, 문서 기준도 같이 맞췄습니다.

자동화가 한 일:
- 문서 카드 실행
- 관련 파일 수정
- 체크리스트와 테스트 기준 반영

싱드가 직접 개입한 일:
- 최종 사용자 보고 누락 여부 확인
- 카드 댓글만으로 끝내지 않고 Telegram 직접 보고 여부 재확인

자동화가 못 끝낸 이유:
- 없음

보완한 자동화:
- 앞으로는 최종 보고 카드에 "사용자 직접 보고 완료/필요"를 따로 적도록 기준을 추가했습니다.

사용자가 지금 보면 되는 곳:
- /, /offline, /manifest.webmanifest

대장이 해줄 일:
- 없음
```

### 중복/스팸 보고 방지 기준
- 같은 카드, 같은 이유, 같은 근거라면 새 Telegram 메시지를 다시 보내지 않습니다.
- 상태가 바뀌었을 때만 다시 보냅니다. 예: `자동복구중 → 작업 최종 결과`, `승인필요 → 자동 조치 완료`.
- raw 이벤트, 카드 댓글, run 로그를 시간순으로 그대로 중계하지 않습니다.
- `already-handled` 또는 반복 에러가 보여도 먼저 최신 카드 상태와 후속 체인을 재확인한 뒤 1회 요약으로 묶어 보냅니다.
- 정각 보고 외 즉시 보고는 카드 수 기준이 아니라 "사용자가 알아야 하는 상태 변화가 생겼는지" 기준으로만 보냅니다.
- 카드 댓글 작성 완료와 사용자 직접 보고 완료는 별도 상태로 기록합니다.

## 5. 권장 검증 명령 묶음

### 문법/기본
```bash
bash -n scripts/gw-auto-workflow.sh
bash -n scripts/gw-hermes-env.sh
bash -n scripts/gw-review-required-gate.sh
bash -n scripts/gw-review-required-recovery-loop.sh
python3 -m py_compile scripts/gw-hourly-status-report.py
```

### dry-run/도움말
```bash
bash scripts/gw-review-required-gate.sh --dry-run
bash scripts/gw-review-required-recovery-loop.sh --help
python3 scripts/gw-hourly-status-report.py --dry-run --force
```

### 환경/운영 상태
```bash
bash -lc 'source ./scripts/gw-hermes-env.sh && command -v pnpm && command -v python3 && command -v "$HERMES_BIN"'
```

추가로 확인할 것:
- service active/status
- journal 최근 로그
- board stats
- blocked list
- dispatch dry-run

## 6. 완료로 볼 최소 기준

아래가 같이 만족돼야 합니다.
- 역할봇 권한 확대가 아니라 싱드/Watcher 판단루프 보강이라는 방향이 구현/문서에 반영된다.
- blocked 재판단 순서가 코드/문서/검증에서 같은 뜻으로 유지된다.
- Telegram 보고정책이 자동화/싱드 직접 개입/실패 이유/보완 자동화로 분리된다.
- fixture/dry-run/service sweep/board state/GitHub gate 검증 근거가 남는다.
- restricted 항목과 승인 필요 항목이 끝까지 분리된다.

## 7. 승인 게이트와 금지 항목

### 승인 게이트
별도 승인 없이 하면 안 되는 것:
- secret, `.env`, credential 입력/교체
- production DB 실데이터 변경
- migration 실행
- DNS/custom domain
- 유료 리소스 생성/증설
- 외부 서비스 실연동
- destructive cleanup/force 동작

카드 범위에 명시돼도 검증 근거가 꼭 필요한 것:
- `PR merge`
- `release gate`
- `branch cleanup`
- blocked 자동 정리
- stale/superseded 정리

### 금지 항목
- raw Kanban 이벤트를 사용자에게 그대로 전송
- 카드 댓글만으로 사용자 최종 보고 대체
- 실제 확인 없는 complete 처리
- parent-gated 그래프를 깨는 상태 변경
- 다른 board/repo/domain으로 범위 확장

## 8. 이 묶음에서 다음 작업자가 기억할 한 문장

역할봇이 더 많은 일을 하도록 넓히는 대신,
싱드와 watcher가 "지금 닫아도 되는 막힘"과 "여기서 멈춰야 하는 막힘"을 더 정확히 구분하도록 만들면 됩니다.
