# 그룹웨어 자동화 보강 범위: review-required gate / safe triage / recovery loop

## 1. 한 줄 정의

이번 묶음의 목표는 "자동으로 이어가도 되는 막힘"과 "정말 사람 승인이 필요한 막힘"을 구분해서, review-required handoff·안전 triage·자동 복구 루프를 같은 기준으로 움직이게 만드는 것입니다.

즉, 성공한 구현/리뷰/테스트 결과가 `review-required` 문구 하나 때문에 오래 blocked 상태로 남지 않게 하고, 반대로 secret·production DB·DNS·유료 리소스·외부 공개 같은 위험 작업은 자동으로 건드리지 않도록 경계를 더 분명하게 잠그는 작업입니다.

## 2. 왜 이번 보강이 필요한가

현재 그룹웨어 자동화는 Kanban 카드 생성, 역할별 worker 실행, Telegram 직접 보고, release gate/backpressure 흐름까지 이미 갖추고 있습니다.

하지만 로컬 변경 범위를 보면 아직 아래 빈틈이 있습니다.

- worker가 실제로는 handoff를 마쳤는데 `review-required`로 blocked 처리해 다음 단계가 서지 못하는 경우
- review-required gate가 한 번 검증 실패하면 그대로 막힌 카드로 남아, 수정→재리뷰→재검증의 자동 복구 루프가 이어지지 않는 경우
- blocked 카드를 안전하게 분류하고, Telegram은 Kanban 이벤트 raw 중계가 아니라 싱드 판단 보고로만 보내는 기준이 흩어져 있는 경우
- systemd user 서비스 환경에서 `pnpm`/`node` PATH가 부족해 gate 스크립트가 "코드 실패"가 아니라 "실행 환경 부족" 때문에 오작동하는 경우
- watcher가 카드 Body 전체를 읽다가 "review-required로 막지 말라" 같은 문서 문구까지 오탐하는 경우

이번 범위는 이 빈틈을 메우는 운영 보강입니다. 제품 기능을 여는 작업이 아니라, 자동화가 헛멈춤·오탐·중복 보고 없이 더 안전하게 흐르도록 기준을 고정하는 단계입니다.

## 3. 이번에 정리하는 변경 대상 파일

핵심 범위는 아래 5개입니다.

- `scripts/gw-auto-workflow.sh`
- `scripts/gw-hermes-env.sh`
- `scripts/gw-review-required-gate.sh`
- `scripts/gw-hourly-status-report.py`
- `scripts/gw-review-required-recovery-loop.sh` (신규)

각 파일의 기대 역할은 아래와 같습니다.

### A. `scripts/gw-auto-workflow.sh`

이 스크립트는 새 Kanban 카드 묶음을 만들 때 worker들에게 미리 같은 운영 원칙을 심는 역할을 합니다.

이번 보강에서 기대하는 점:
- 카드 본문에 "성공했고 검증이 끝났으면 blocked/review-required로 남기지 말고 complete 하라"는 기본 규칙을 명시한다.
- `merge`, `release gate`, `branch cleanup`, `deploy` 같은 카드 범위 승인 규칙을 공통으로 주입한다.
- Telegram 사용자 보고는 `자동 조치`, `사용자 승인 필요`, `정각 보고`, `작업 최종 결과` 4가지로 제한하고, Kanban 이벤트 raw 중계나 `notify-subscribe`는 명시 승인 없을 때 기본 비활성으로 둔다.

쉽게 말하면, 자동화가 뒤에서 복구하기 전에 카드 생성 단계부터 "어떤 막힘이 진짜 막힘인지"를 worker들에게 먼저 알려 주는 역할입니다.

### B. `scripts/gw-hermes-env.sh`

이 파일은 systemd user 서비스나 다른 셸 환경에서도 그룹웨어 bot home, Hermes profile, board, PATH를 일관되게 맞춥니다.

이번 보강에서 기대하는 점:
- `gw-dev-bot` 홈과 `singde` 기본 profile을 안정적으로 고정한다.
- 작은 PATH 환경에서도 `pnpm`, `node`, `hermes` 계열 명령을 찾을 수 있게 보강한다.
- review-required gate 실패를 실제 코드 문제와 환경 문제로 구분할 수 있게 만든다.

핵심은 "검증 스크립트가 안 돌아간 이유가 코드인지, PATH인지"를 섞지 않는 것입니다.

### C. `scripts/gw-review-required-gate.sh`

이 스크립트는 blocked 카드 중 `review-required` 신호가 있는 카드를 찾아 표준 검증을 다시 실행하고, 통과하면 complete + dispatch로 넘깁니다.

이번 보강에서 기대하는 점:
- 카드 Body 전체를 grep하지 않고 Latest summary/Runs 같은 현재 신호만 봐서 오탐을 줄인다.
- 통과 시 `shared/api/web test/typecheck`, `web build`, `pnpm check` 근거를 남기고 다음 카드를 dispatch 한다.
- 실패 시 원본 blocked 카드를 무리하게 unblock하지 않고, 자동 재수정→재리뷰→재검증→복구 정리 루프를 생성한다.
- Kanban DB 손상 신호는 반복 재시도하지 않고 circuit-breaker 코드로 빠진다.
- 중복 실패 댓글 폭주를 state 파일로 막는다.

즉, `review-required`를 "항상 사람 검토 필요"로 보지 않고, "표준 검증으로 닫을 수 있는 내부 handoff인지" 먼저 확인하는 게 핵심입니다.

### D. `scripts/gw-hourly-status-report.py`

이 흐름은 blocked 카드를 read-only DB 조회로 읽고, 위험도에 따라 안전 자동 조치 또는 싱드 직접 보고로 분류합니다. Telegram은 watcher가 이벤트를 그대로 중계하지 않고, 싱드가 카드/runs/log를 확인한 뒤 허용 보고 유형으로만 보냅니다.

이번 보강에서 기대하는 점:
- Kanban DB는 SQLite read-only URI로만 열고, task/comment/event/notify 테이블에 쓰지 않는다.
- `review-required`는 자동 조치 후보로 분류해 gate 스크립트를 호출한다.
- timeout/crash/stale 같은 worker recovery 계열은 안전 복구 후보로 분류한다.
- secret, production DB, DNS, 유료, 외부 공개, migration, destructive 삭제는 `사용자 승인 필요`로만 보고한다.
- 같은 blocked 이유로 자동 조치/승인 필요 보고가 매 주기 폭주하지 않게 state+signature+retry backoff를 둔다.
- circuit-breaker 성격의 DB 오류는 긴 backoff로 빠진다.

이 흐름의 역할은 "막힘을 카드 생성으로 또 늘리는 것"이 아니라, blocked 이유를 짧게 분류하고 안전 범위만 제한적으로 자동 조치하는 것입니다.

### E. `scripts/gw-review-required-recovery-loop.sh`

이 신규 스크립트는 review-required gate 검증 실패를 그냥 blocked로 방치하지 않고, 승인된 개발 범위 안에서 복구 mini-chain을 생성합니다.

이번 보강에서 기대하는 점:
- 원본 blocked 카드는 그대로 두고, 마지막 성공 upstream parent에서 새 체인을 건다.
- 순서는 `자동 재수정(gwbuilder) → 자동 재리뷰(gwreviewer) → 자동 재검증(gwtester) → 복구 정리(singde)` 로 고정한다.
- 실패 로그 tail을 새 카드 본문에 넣어 다음 worker가 바로 원인을 알 수 있게 한다.
- secret/production DB/DNS/유료/외부 공개/migration/파괴적 삭제는 여전히 범위 밖으로 명시한다.
- idempotency key로 같은 blocked 카드에 대해 복구 카드가 무한 증식하지 않게 한다.
- 같은 카드/같은 실패군에서 `반려`, `검증 실패`, `자동 재수정`이 3회 이상 반복되면 더 이상 단순 복구 체인을 늘리지 않고 싱드가 직접 원본 카드/runs/log/실패 명령/변경 파일/중복 worker 여부를 확인한다.

쉽게 말하면, "자동으로 고칠 수 있는 실패"는 다시 작업 루프로 보내고, "사람이 결정해야 하는 실패"만 blocked로 남기는 장치입니다.

## 4. 이번 보강에서 고정할 운영 원칙

### 원칙 1. blocked는 진짜 멈춤에만 쓴다

아래는 blocked를 유지해도 됩니다.
- secret 입력/교체
- production DB 실데이터
- DNS/custom domain
- 유료 리소스
- 외부 공개/실배포
- migration
- destructive 삭제
- 권한/인증 문제
- 설계 결정 대기
- 반복 동일 실패로 자동 복구 상한 도달

반대로 아래는 가능하면 자동 루프로 돌립니다.
- 테스트 실패
- 타입체크 실패
- build 실패
- review 보완 요청
- review-required handoff 검증 실패
- stale worker 정리

### 원칙 2. 원본 blocked 카드를 성급히 unblock하지 않는다

자동 복구 루프가 생겨도 원본 blocked 카드는 그대로 둡니다.
복구 검증 근거가 나온 뒤 마지막 `singde` 정리 카드가 원본 완료 처리나 후속 연결 여부를 판단해야 합니다.

이 원칙이 필요한 이유는, failed path와 recovered path가 섞이면 후속 카드가 잘못된 근거로 시작될 수 있기 때문입니다.

### 원칙 3. Telegram 보고는 싱드 판단 요약만 보낸다

Telegram 보고 유형은 `자동 조치`, `사용자 승인 필요`, `정각 보고`, `작업 최종 결과` 4가지로 제한합니다.
`자동 조치`, `사용자 승인 필요`, `작업 최종 결과`는 Kanban 이벤트 watcher가 raw 이벤트를 보내는 방식이 아니라, 싱드가 이벤트/카드/runs/log를 읽고 판단한 뒤 사용자에게 직접 보내는 보고입니다.
원본 worker body 전체를 중계하거나, 또 다른 보고 카드를 만들지 않습니다.

### 원칙 4. DB와 watcher는 보수적으로 다룬다

- DB 직접 쓰기 금지
- read-only 조회 우선
- 단일 인스턴스 lock 유지
- malformed/disk I/O는 반복 재시도 금지
- 자동 dispatch는 필요한 최소 범위만

## 5. 이번 범위에 포함되는 것

- review-required 신호 오탐 감소
- 표준 검증 통과 시 자동 complete/dispatch
- 표준 검증 실패 시 recovery mini-chain 생성
- blocked 카드의 안전 triage + 싱드 판단 Telegram 보고
- systemd PATH 보강
- idempotency/state/backoff/circuit-breaker 같은 운영 guardrail 보강

## 6. 이번 범위에서 제외하는 것

- secret 입력/교체
- production DB 실데이터 변경
- DNS/custom domain 작업
- 유료 리소스 생성/증액
- 실제 개인정보 처리/외부 HR 연동
- Kanban DB 직접 쓰기/수정
- watcher가 임의로 production deploy나 destructive cleanup 실행
- blocked 카드 자동 완료를 위한 근거 없는 상태 변경

## 7. 구현/리뷰/테스트가 기억해야 할 핵심 질문

### 구현자가 확인할 질문
- review-required를 어디서 어떻게 감지하는가? Body 전체 오탐은 없는가?
- 검증 실패가 코드 문제인지 PATH/환경 문제인지 구분되는가?
- recovery loop가 같은 blocked 카드에 대해 중복 생성되지 않는가?
- dispatch와 DB 조회가 lock 없이 경쟁하지 않는가?
- restricted 항목은 정말 자동 실행에서 빠져 있는가?

### 리뷰어가 확인할 질문
- 자동 완료 조건과 승인 필요 조건이 섞이지 않았는가?
- 원본 blocked 카드와 복구 체인의 관계가 문서와 코드에서 일치하는가?
- Telegram 보고가 Kanban 이벤트 raw 중계, DB 쓰기, 추가 카드 생성으로 흐르지 않는가?
- 실패/backoff/state 처리 때문에 보고 누락이나 폭주가 생기지 않는가?

### 테스터가 확인할 질문
- dry-run/--help/단일 task 모드가 모두 의도대로 동작하는가?
- 표준 검증 성공 시 complete + dispatch가 실제로 이어지는가?
- 검증 실패 시 recovery loop 카드 4종이 기대 parent 체인으로 생성되는가?
- DB 오류와 일반 검증 실패가 다른 종료 코드/메시지로 구분되는가?

## 8. 완료 기준

이번 보강 묶음은 아래가 모두 맞아야 "정리 완료"로 봅니다.

1. worker가 성공한 handoff를 남겼을 때 `review-required` 문구만으로 장기 blocked가 되지 않는다.
2. gate 표준 검증이 통과하면 card complete + 다음 dispatch가 된다.
3. gate 표준 검증이 실패하면 blocked 방치 대신 복구 mini-chain이 만들어진다.
4. blocked 이유를 승인 필요/자동 조치 후보/자동 복구 후보/수동 확인 필요로 나누고, Telegram에는 싱드 판단 보고양식으로만 짧게 보고한다.
5. systemd PATH 환경에서도 `pnpm`/`node`/`hermes`를 찾을 수 있다.
6. DB read-only, 단일 인스턴스, backoff, idempotency 같은 안전장치가 유지된다.
7. restricted 범위는 자동화 대상에서 빠져 있다.
