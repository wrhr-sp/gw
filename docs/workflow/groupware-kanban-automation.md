# 그룹웨어 봇 자동화 운영 가이드

## 결론

그룹웨어 봇 팀은 **싱드 단일 창구 + Kanban 보드 기반 자동 파이프라인**으로 운영한다.

사용자는 싱드에게만 자연어로 요청한다. 싱드는 요청을 작업 유형으로 분류하고, 필요한 내부 봇에게 Kanban 카드를 배정한다. 각 봇은 자기 역할을 수행하고 결과를 남기며, 마지막에 싱드가 결과를 취합해 사용자에게 완료 보고한다.

## 자동화 보드

- 보드 이름: `groupware`
- 표시 이름: 그룹웨어 개발 자동화
- 기본 작업 폴더: `/home/wrhrgw/gw`

상태 확인:

```bash
cd /home/wrhrgw/gw
./scripts/gw-kanban-status.sh
```

작업 목록 보기:

```bash
cd /home/wrhrgw/gw
hermes kanban --board groupware list
```

## 역할별 자동 배정 기준

- `gwplanner`: 기획, 요구 정리, 우선순위
- `gwbuilder`: 구현, 파일 수정, 코드 작성
- `gwreviewer`: 리뷰, 누락 점검, 품질 확인
- `gwtester`: 테스트, 검증, 실패 재현
- `gwops`: 배포·운영 위험 점검
- `gwdocs`: 문서화, 쉬운 설명 정리
- `singde`: 최종 통합, 사용자 보고, 전체 조율

## 사용자 관점 흐름

1. 사용자가 싱드에게 요청한다.
2. 싱드가 작업 유형을 판단한다.
3. 싱드가 Kanban 파이프라인을 만든다.
4. Gateway dispatcher가 준비된 카드를 자동 실행한다.
5. 각 내부 봇은 맡은 작업을 처리하고 결과를 남긴다.
6. 싱드가 결과를 모아 사용자에게 완료 보고한다.

즉, 사용자는 내부 봇을 직접 부르지 않는다.

## 지원 작업 유형

자동 작업 생성 스크립트는 `--type`으로 작업 유형을 받는다.

```bash
cd /home/wrhrgw/gw
./scripts/gw-auto-workflow.sh --type <유형> "작업 제목" "작업 설명"
```

지원 유형:

- `feature`: 일반 기능 개발. 기본값.
- `bugfix`: 버그 수정. 재현/원인/최소 수정 중심.
- `docs`: 문서 작업. 문서봇 중심으로 짧은 파이프라인 생성.
- `deploy`: 배포/웹앱 호스팅. 운영봇와 `web-app-hosting` 포함. 카드 작업범위에 배포/릴리즈가 명시됐는지 확인한 뒤 진행한다.
- `review`: 검토/검증 중심. 리뷰봇과 테스트봇 중심.

## 기본 feature/bugfix 파이프라인

```text
기획 → 구현 → 리뷰 → 테스트 → 문서화 → 최종 보고
기획봇 → 구현봇 → 리뷰봇 → 테스트봇 → 문서봇 → 싱드
```

각 카드에는 담당 역할에 맞는 스킬을 자동 지정한다.

- 기획: `writing-plans`, `one-three-one-rule`, `code-wiki`
- 구현: `code-wiki`, `systematic-debugging`, `test-driven-development`
- 리뷰: `requesting-code-review`, `code-wiki`, `systematic-debugging`
- 테스트: `test-driven-development`, `systematic-debugging`
- 문서화: `code-wiki`, `humanizer`
- 최종 보고: `one-three-one-rule`

## deploy 파이프라인

배포/웹앱 호스팅은 위험도가 있으므로 범위 확인 단계를 둔다. 단, 카드 작업범위에 deploy/배포/release/릴리즈가 명시되어 있으면 해당 실행은 대장 명시승인으로 간주한다.

```text
배포 기획 → 배포 준비 → 배포 위험 리뷰 → 배포 범위 확인/승인 게이트 → 배포 실행/운영 점검 → 배포 검증 → 배포 문서화 → 최종 보고
기획봇 → 구현봇 → 리뷰봇 → 싱드(scheduled 대기) → 운영봇 → 테스트봇 → 문서봇 → 싱드
```

중요:

- `배포 범위 확인/승인 게이트` 카드는 별도 대기 카드가 아니라, 카드 작업범위에 실제 배포/릴리즈가 포함됐는지 확인하는 게이트다.
- 실제 외부 배포/릴리즈가 카드 작업범위에 명시되어 있으면 승인된 것으로 진행한다. 단, 카드에 명시되지 않은 도메인/DNS, 유료 리소스, 비밀값 입력/교체, production DB 실데이터 변경은 별도 승인 전에는 진행하지 않는다.
- 범위 확인 후 해당 카드가 완료되면 후속 배포 단계가 이어진다. 범위가 불명확하면 block하고 대장에게 확인한다.

## 자동 작업 생성 스크립트

일반 기능 개발:

```bash
cd /home/wrhrgw/gw
./scripts/gw-auto-workflow.sh \
  --type feature \
  "작업 요청 접수 기능 v1" \
  "사용자가 싱드에게 개발 요청을 말하면 목표, 필요한 것, 미정 사항, 다음 액션으로 정리하는 기능을 설계하고 구현한다."
```

버그 수정:

```bash
./scripts/gw-auto-workflow.sh \
  --type bugfix \
  "로그인 실패 원인 수정" \
  "정상 계정인데 로그인 실패가 나는 문제를 재현하고 최소 범위로 수정한다."
```

문서 작업:

```bash
./scripts/gw-auto-workflow.sh \
  --type docs \
  "그룹웨어 봇 사용법 문서" \
  "비개발자도 이해할 수 있게 싱드 중심 작업 요청 방법을 정리한다."
```

배포 작업:

```bash
./scripts/gw-auto-workflow.sh \
  --type deploy \
  "그룹웨어 데모 웹앱 배포" \
  "현재 웹앱을 외부 URL로 확인 가능하게 준비한다. 카드 작업범위에 실제 배포가 명시되면 승인된 것으로 진행하고, DNS/유료/비밀값/production DB 작업은 별도 승인으로 분리한다."
```

검토 작업:

```bash
./scripts/gw-auto-workflow.sh \
  --type review \
  "최근 변경 검토" \
  "변경 범위가 요구사항을 만족하는지 리뷰하고 검증한다."
```

## 안전/검증 옵션

실제 카드를 만들지 않고 파이프라인만 미리 보기:

```bash
./scripts/gw-auto-workflow.sh \
  --preview \
  --type deploy \
  "샘플 배포" \
  "배포 승인 흐름을 미리 확인한다."
```

첫 카드를 `scheduled` 대기 상태로 만들어 자동 실행을 멈춘 채 카드 생성만 확인:

```bash
./scripts/gw-auto-workflow.sh \
  --hold \
  --type feature \
  "샘플 기능" \
  "카드 생성과 의존성 연결만 확인한다."
```

중복 생성을 막고 싶을 때:

```bash
./scripts/gw-auto-workflow.sh \
  --idempotency-key "groupware-request-v1" \
  --type feature \
  "작업 요청 접수 기능 v1" \
  "사용자 요청을 구조화한다."
```

## 상태 확인/추적

전체 상태:

```bash
./scripts/gw-kanban-status.sh
```

GitHub Actions 최근 상태와 최신 실행 상세:

```bash
./scripts/gw-ci-status.sh
```

실패한 최신 실행이면 실패 로그도 함께 출력한다.

dispatcher dry-run:

```bash
./scripts/gw-kanban-dispatch-dry-run.sh
```

실제로 한 번 즉시 dispatch:

```bash
./scripts/gw-kanban-dispatch-once.sh
```

특정 카드 로그 보기:

```bash
./scripts/gw-kanban-tail.sh <task_id>
```

## 운영할 때 자주 쓰는 순서

처음부터 모든 자동화를 한 번에 돌리기보다, 아래 순서로 작게 확인하는 편이 안전하다.

1. 보드 상태 확인
   - `./scripts/gw-kanban-status.sh`
   - 막힌 카드, 오래된 running 카드, review-required 카드부터 본다.
2. 새 작업 생성 전 backpressure 확인
   - `./scripts/gw-phase-workflow.sh --phase <phase-key> --preview --json`
   - 열린 PR, 지저분한 git 작업트리, 미완료 smoke/final 카드가 있으면 먼저 정리한다.
3. 카드 생성은 preview → hold → 실제 생성 순서로 진행
   - preview로 어떤 카드가 생길지 먼저 본다.
   - 확신이 없으면 `--hold`로 자동 실행 없이 카드만 만든다.
4. 구현/리뷰/테스트가 끝나면 PR 상태 확인
   - `./scripts/gw-pr-flow.sh --head <branch> --show-status --wait-ci`
5. 배포 직전에는 DB/배포 확인을 분리해서 본다.
   - DB 예정 명령 확인: `./scripts/gw-db-safe.sh --env <env> --mode migrate-preview`
   - 배포 후 생존 확인: `./scripts/gw-deploy-smoke-check.sh --json`
6. 마지막에는 문서화/최종 보고 카드까지 끝났는지 다시 확인한다.

## 스크립트별 운영 메모

### 1) `gw-pr-flow.sh`

언제 쓰나:
- 구현, 리뷰, 테스트가 끝난 뒤 PR 상태/CI/merge 가능 여부를 확인할 때

핵심:
- `--show-status`, `--wait-ci` 는 읽기 중심이다.
- `--create` 는 `--approved` 가 없으면 실제 생성 대신 "생성 예정"만 보여준다.
- `--merge`, `--delete-branch` 는 안전 플래그 `--approved`가 필요하다. 카드 작업범위에 merge/release gate/branch cleanup이 명시되어 있으면 해당 플래그 사용은 승인된 것으로 본다.
- merge는 PR 상태와 CI green 조건을 다시 확인한 뒤에만 진행된다.

예시:

```bash
./scripts/gw-pr-flow.sh --head feat/example --show-status --wait-ci --json
```

주의:
- 이 스크립트는 `gh` CLI가 있어야 한다.
- 현재 환경에 `gh`가 없으면 실제 PR 생성/merge 검증은 제한된다.

### 2) `gw-deploy-smoke-check.sh`

언제 쓰나:
- 배포 직후 웹/API가 최소한 살아 있는지 확인할 때

핵심:
- 읽기 요청만 한다.
- 기본 체크는 web 루트, web 목록, web 내부 health, api health다.
- `--property-id`가 있으면 상세 페이지까지 보고,
  `--check-availability`를 추가하면 availability API도 본다.
- `--preview`는 요청 예정 목록만 보여준다.

예시:

```bash
./scripts/gw-deploy-smoke-check.sh \
  --property-id property-seoul \
  --check-availability \
  --json
```

판독 기준:
- `PASS`: 요청 성공
- `FAIL`: HTTP 오류/timeout/예외
- `SKIP`: 샘플 조직/업무 ID 같은 추가 정보가 없어 일부 확인을 건너뜀

### 3) `gw-db-safe.sh`

언제 쓰나:
- migration/seed 명령을 무심코 실행하지 않도록, 먼저 예정 명령과 차단 여부를 확인할 때

핵심:
- `status`, `migrate-preview`, `migrate-apply`, `seed-preview`, `seed-apply`를 지원한다.
- `migrate-apply`는 `--approved`가 없으면 실행되지 않는다.
- `seed-apply`는 dev/staging에서만, `--allow-seed --approved` 조합일 때만 허용된다.
- prod `seed-apply`는 기본 차단이다.
- `DATABASE_URL` 원문은 출력하지 않고 일부만 마스킹해서 보여준다.

예시:

```bash
./scripts/gw-db-safe.sh --env prod --mode migrate-preview --json
```

### 4) `gw-phase-workflow.sh`

언제 쓰나:
- 새 Phase 작업 묶음을 만들기 전에 release gate/backpressure를 먼저 확인하고 싶을 때

핵심:
- 내부적으로 `gw-auto-workflow.sh`를 감싸는 얇은 래퍼다.
- 기본적으로 preview/hold 쪽이 더 안전한 흐름이다.
- 열린 PR, git dirty 상태, 미완료 release/smoke/final 카드가 있으면 기본 차단될 수 있다.
- 차단 상태에서 억지로 만들려면 `--force`를 써야 하지만, 이때도 먼저 이유를 확인하는 편이 좋다.

예시:

```bash
./scripts/gw-phase-workflow.sh --phase automation-hardening --preview --json
```

### 5) `gw-worker-recovery-watch.sh`

언제 쓰나:
- 오래 멈춘 running 카드나 timeout/crash처럼 보이는 blocked 카드를 찾아 코멘트를 남기고 싶을 때

핵심:
- 기본은 반복 감시다.
- `--once`를 쓰면 1회만 점검한다.
- 오래된 running 카드가 보이면 자동 완료가 아니라 "확인 필요" 코멘트만 남긴다.

예시:

```bash
./scripts/gw-worker-recovery-watch.sh --once
```

추가 메모:
- 반복 감시 모드에서는 첫 번째 숫자를 간격 초, 두 번째 숫자를 stale 기준 초로 받는다.
- 예: `./scripts/gw-worker-recovery-watch.sh 120 3600`

### 6) `gw-review-required-gate.sh` / `gw-review-required-recovery-loop.sh` / `gw-safe-triage-watch.py`

언제 쓰나:
- blocked 카드가 `review-required` handoff인지, 실제 승인 필요 막힘인지, 복구 가능한 실패인지 분류해야 할 때
- review-required 검증 실패를 blocked로 방치하지 않고 자동 재수정→재리뷰→재검증→복구 정리 체인으로 보내고 싶을 때
- systemd watcher가 blocked 카드를 Telegram으로 짧게 보고하면서 승인된 안전 자동 조치만 붙이게 하고 싶을 때

핵심:
- `gw-review-required-gate.sh` 는 blocked 카드 전체가 아니라 Latest summary/Runs의 현재 신호를 보고 `review-required`를 감지한다.
- 표준 검증(`shared/api/web test/typecheck`, `web build`, `pnpm check`)이 통과하면 complete + dispatch로 넘긴다.
- 표준 검증이 실패하면 원본 blocked 카드를 억지로 unblock하지 않고 `gw-review-required-recovery-loop.sh` 로 복구 mini-chain을 만든다.
- `gw-safe-triage-watch.py` 는 Kanban DB를 SQLite read-only로만 열고, `review-required`/worker-recovery/restricted/수동분류를 나눠 Telegram 보고 + 승인된 안전 스크립트 호출만 한다.
- `scripts/gw-hermes-env.sh` 는 이 흐름이 systemd user PATH에서도 `pnpm`/`node`/`hermes`를 찾을 수 있게 보강한다.

빠른 확인 예시:

```bash
bash -lc 'source ./scripts/gw-hermes-env.sh && command -v pnpm && command -v "$HERMES_BIN"'
bash ./scripts/gw-review-required-gate.sh --dry-run
bash ./scripts/gw-review-required-recovery-loop.sh --help
python3 ./scripts/gw-safe-triage-watch.py --once --dry-run
```

주의:
- secret, production DB, DNS, 유료, 외부 공개, migration, destructive 삭제는 끝까지 자동 처리하지 않는다.
- triage watcher는 보고 카드나 `notify-subscribe`를 새로 만들지 않는다.
- recovery loop가 만들어져도 원본 blocked 카드는 복구 근거가 나오기 전까지 그대로 둔다.

## 검증으로 확인된 현재 제한

- `gw-pr-flow.sh`의 실제 PR 생성/merge 검증은 `gh` CLI가 있는 환경에서 다시 확인하는 것이 좋다.
- `gw-phase-workflow.sh`는 새 Phase 생성 전에 backpressure를 강하게 거는 쪽으로 설계되어 있어, 미완료 release/smoke/final 카드가 있으면 exit code 2로 멈출 수 있다.
- `gw-worker-recovery-watch.sh`는 현재 `--help` 중심 안내보다 `--once`와 위치 인자 사용이 핵심이므로, 운영 시 예시 명령을 그대로 복사해서 쓰는 편이 안전하다.
- 부모 테스트에서는 `gw-review-required-recovery-loop.sh`의 실제 카드 생성 경로와 `gw-hermes-env.sh`의 `command -v pnpm`/`command -v "$HERMES_BIN"` 출력 자체는 CLI 승인 차단 때문에 별도 캡처하지 못했다. 현재 문서는 active watcher 로그와 gate/script 실행 성공을 간접 근거로 삼고 있으며, 운영자가 테스트용 blocked 카드 1건과 systemd user 셸에서 마지막 확인을 해 두는 편이 안전하다.

## 자동화 스크립트 안전 규칙

자동화, watcher, Kanban, systemd, dispatcher, 보고 스크립트를 생성하거나 수정할 때는 아래를 먼저 확인한다.

1. `kanban.db`, `kanban.db-wal`, `kanban.db-shm`을 직접 쓰거나 편집하지 않는다.
2. 상태 변경은 `hermes kanban ...` CLI를 사용하고, 감시는 SQLite read-only URI 또는 CLI 조회만 사용한다.
3. 변경 전 `hermes kanban --board groupware list --json`, DB integrity, watcher/service 상태, 중복 프로세스 여부를 확인한다.
4. watcher는 단일 인스턴스만 허용하고, 여러 watcher가 동시에 `dispatch`하지 않게 한다.
5. DB malformed/disk I/O 오류는 반복 재시도하지 말고 circuit-breaker/long-backoff로 멈춘 뒤 보고한다.
6. 수정 후 `bash -n`, `python3 -m py_compile`, 관련 테스트, systemd status/journal/failed, `dispatch --dry-run`을 가능한 범위에서 검증한다.
7. 보고 경로 기본값은 `gw-telegram-kanban-report-watch.py`의 read-only 직접 Telegram 전송이다. 별도 사용자 결과보고/막힘 보고 카드를 생성하거나 `notify-subscribe`를 붙이는 방식은 대장 명시 승인 없이는 켜지 않는다.
8. 카드 생성/완료/보류/dispatch 자동화에는 idempotency key, state 파일, 중복 방지, 실패 시 safe stop 조건을 둔다.

## 자동 실행 조건

자동 실행이 되려면 Gateway가 실행 중이어야 한다.

현재 기준에서는 `singde` Gateway만 `groupware` board dispatcher를 단일 소유로 실행한다. `singde`의 Kanban 설정은 `dispatch_in_gateway: true`이며, 보드에 `ready` 작업이 생기면 `singde` Gateway dispatcher가 주기적으로 확인해서 작업을 실행한다.

역할봇 gateway는 active 상태로 유지하되 dispatcher는 실행하지 않는다. 대상 역할봇은 `gwplanner`, `gwbuilder`, `gwreviewer`, `gwtester`, `gwdocs`, `gwops` 이며, 이 프로필들의 `dispatch_in_gateway`는 항상 `false`로 유지한다. `gw-dev-bot`/아리아도 접수·보고·보조 역할이며 `groupware` board dispatcher를 직접 돌리지 않는다.

역할봇 또는 `gw-dev-bot`에서 `dispatch_in_gateway`를 다시 켜는 변경은 기본 금지다. 예외가 필요하면 다음 순서를 거친다.

1. 현재 각 프로필 `config.yaml`의 `dispatch_in_gateway` 값 확인
2. `groupware` Kanban DB integrity 확인
3. 다중 dispatcher가 DB 안정성에 줄 수 있는 위험 설명
4. 대장 명시 승인
5. 변경 후 `singde` 단일 dispatcher 구조 또는 승인된 구조 재검증

수동으로 한 번 확인하려면:

```bash
hermes kanban --board groupware dispatch --dry-run
```

실제로 한 번 즉시 dispatch 하려면:

```bash
hermes kanban --board groupware dispatch --max 1
```

## 주의사항

- 자동화는 강력하므로 처음에는 작은 작업으로 테스트한다.
- 카드 작업범위에 배포/릴리즈/merge/branch cleanup/release gate가 명시되어 있으면 해당 항목은 승인된 것으로 진행하되, 카드에 명시되지 않은 삭제, 외부 전송, 도메인/DNS, 유료 리소스, 비밀값 입력, production DB 실데이터 변경은 별도 승인 전에는 실행하지 않는다.
- 자동 작업 결과는 반드시 싱드가 다시 확인하고 사용자에게 쉽게 설명한다.
- 막힌 작업은 `blocked` 또는 `scheduled` 상태로 남기고, 사용자의 결정을 기다린다.
- 스킬은 절차 지식일 뿐이며 각 봇의 권한을 우회하지 않는다.

## 현재 자동화 수준

- 준비됨: Kanban 보드, 역할별 프로필, 작업 생성 스크립트, 상태 확인 스크립트
- 준비됨: 작업 유형별 파이프라인 생성
- 준비됨: 카드별 강제 스킬 지정
- 준비됨: 배포 작업의 카드 작업범위 확인 게이트
- 준비됨: preview/hold/idempotency 안전 옵션
- 준비됨: Gateway 내 dispatcher 설정
- 준비됨: review-required 자동 게이트 watcher(systemd user service)
- 준비됨: review-required gate 실패 시 자동 재수정→재리뷰→재검증→복구 정리 미니 체인 생성
- 준비됨: blocked 카드 safe triage watcher가 read-only DB 조회 + Telegram 직접 보고 + 승인된 안전 자동 조치를 수행
- 준비됨: systemd user PATH에서도 `pnpm`/`node`/`hermes`를 찾도록 `gw-hermes-env.sh` 공통 환경 보강
- 준비됨: ready 카드 장기 대기 watcher(systemd user service)
- 준비됨: 최종 보고 카드의 사용자 보고 완료/필요 표기 강화
- 준비됨: `gw-telegram-kanban-report-watch.py` systemd watcher가 Kanban DB를 read-only로 감시해 막힘/조치완료/최종보고 결과를 Telegram 채팅으로 직접 전송
- 참고: 예전 보고 카드 생성형 shell watcher와 `notify-subscribe` 방식은 현재 기본 운영 경로가 아니며, direct Telegram watcher를 기본값으로 사용한다.
- 준비됨: PR/CI/merge/branch cleanup 보조 스크립트 `scripts/gw-pr-flow.sh`
- 준비됨: 배포 smoke check 스크립트 `scripts/gw-deploy-smoke-check.sh`
- 준비됨: DB migration·seed 안전 래퍼 `scripts/gw-db-safe.sh`
- 준비됨: Phase 생성 전 release backpressure를 확인하는 `scripts/gw-phase-workflow.sh`
- 준비됨: timeout/crash/stale worker 감지 보조 `scripts/gw-worker-recovery-watch.sh`
- 주의: Git/GitHub 저장소 연결, 외부 배포, 도메인/유료 리소스는 사용자 승인 후 진행
- 다음 확인 필요: 실제 작은 그룹웨어 작업을 넣어서 end-to-end 완료 보고까지 한 번 돌려보기

## Release gate / backpressure 원칙

새 Phase 구현을 시작하기 전에는 아래가 끝났는지 확인한다.

- 작업트리가 깨끗한지
- 열린 PR이 없는지
- 이전 Phase의 PR/CI/merge/branch cleanup이 끝났는지
- 배포 smoke check와 싱드 최종 보고가 끝났는지

`gw-phase-workflow.sh`는 이 조건을 확인하고, 위험하면 기본적으로 새 Phase 생성을 막거나 `--hold` 상태로만 만들도록 안내한다.

## 위험 작업 승인 규칙

- `gw-pr-flow.sh`의 merge/delete는 안전 플래그 `--approved`가 필요하다. 카드 작업범위에 merge/release gate/branch cleanup이 있으면 플래그 사용은 승인된 것으로 본다.
- `gw-db-safe.sh`의 migrate-apply/seed-apply도 승인 플래그 없이는 실행하지 않는다.
- `gw-deploy-smoke-check.sh`는 읽기 요청만 하며 자동 재배포/롤백을 하지 않는다.
- worker recovery는 timeout/crash를 감지하고 코멘트를 남기되, 검증 없이 임의 완료 처리하지 않는다.
