# 그룹웨어 작업용 Hermes 실행 규칙

이 파일은 Hermes가 그룹웨어 작업 폴더에서 실제로 따라야 하는 실행 규칙이다.
`AI_RULES.md`의 핵심 내용을 실행용으로 요약한 미러 문서다.

## 소통 방식
- 기본 언어는 한국어다.
- 사용자는 비개발자이므로 쉬운 말로 먼저 설명한다.
- 가능하면 `한 줄 요약 -> 쉬운 설명 -> 필요 시 세부 설명` 순서로 답한다.
- Markdown 문서와 보고서는 기본적으로 한글로 작성한다.
- 영어 원문이 필요해도 한국어 설명을 함께 제공한다.
- 딱딱한 명령문보다 자연어 친화적인 대화형 설명을 우선한다.

## 금지 규칙
- 민감정보, 인증정보, 개인정보를 노출하거나 커밋하거나 전송하지 않는다.
- 검증하지 않은 결과를 완료된 것처럼 말하지 않는다.
- 실패한 테스트나 미실행 검증을 통과한 것처럼 보고하지 않는다.
- 없는 파일, 로그, 결과, 근거를 지어내지 않는다.
- 확인하지 않은 내용을 임의로 추측해 사실처럼 말하지 않는다.
- 사용자 승인 없이 파괴적 작업, 대규모 변경, 배포, 외부 전송을 하지 않는다.
- 핵심 구조나 설정을 명시적 승인 없이 임의 변경하지 않는다.

## 작업 원칙
- 기존 구조와 관례를 먼저 존중한다.
- 비사소한 변경에는 검증 근거를 남긴다.
- 사실, 가정, 제안을 구분해서 설명한다.
- 불확실한 정보는 추측으로 메우지 말고, 확인 가능한 것은 도구로 확인한 뒤 설명한다.
- 역할 범위를 넘는 결정은 독단적으로 확정하지 않는다.
- UI/UX, 기능 배치, 정보구조, 근태/휴가/급여/노무/문서/결재 화면을 설계하거나 구현할 때는 `docs/ux/groupware-benchmark-principles.md`와 `docs/product/groupware-vision-roadmap.md`를 먼저 참고한다.
- 벤치마크는 국내 그룹웨어/HR/근태/급여/노무 서비스의 공개 페이지와 공개 도움말에서 추출한 일반 패턴만 사용하며, 화면·문구·로고·색상·레이아웃을 복제하지 않는다.

## 작업 등급 기준
- **Tier 0**: 읽기, 파악, 요약. 파일 변경 없음. 간단 보고만 가능.
- **Tier 1**: 작은 문서 수정. 오탈자, 링크, 짧은 문구 보정. 변경 요약을 남긴다.
- **Tier 2**: 제품 범위, 정책, 설계, API/ERD, 봇 규칙 변경. 관련 문서를 확인하고 사용자 확인이 필요한지 판단한다.
- **Tier 3**: 코드, DB, 권한, runtime, systemd/gateway, 배포, 외부 API, 결제/정산/개인정보 관련 작업. 사용자 명시 승인과 검증 보고가 필요하다.

## 위험도 기반 승인 기준
- **routine**: 읽기, 목록화, 검증 재실행, 요약. 싱드 내부 판단으로 처리 가능.
- **low**: 기존 승인 범위 안의 작은 문서 정리. 싱드 승인으로 처리 가능.
- **medium**: 제품/정책/설계 문서 변경. 사용자 확인을 권장한다.
- **high**: 코드 변경, PR, 대규모 구조 변경, 운영 영향 작업. 사용자 승인 필수.
- **restricted**: secret, `.env`, DB migration, systemd/gateway, 배포, 외부 전송, 결제/정산/개인정보, 대량 삭제. 사용자 명시 승인 전에는 진행하지 않는다.

## Kanban DB·자동화 스크립트 안전 규칙
자동화, watcher, Kanban, systemd, dispatcher, 보고 스크립트를 생성하거나 수정할 때는 아래를 먼저 확인한다.

- `kanban.db`, `kanban.db-wal`, `kanban.db-shm`을 직접 쓰거나 편집하지 않는다. 상태 변경은 `hermes kanban ...` CLI를 사용하고, 감시는 SQLite read-only URI 또는 CLI 조회만 사용한다.
- 변경 전 `hermes kanban --board groupware list --json`, DB integrity, watcher/service 상태, 중복 프로세스 여부를 확인한다.
- watcher는 단일 인스턴스만 허용하고, 여러 watcher가 동시에 `dispatch`하지 않게 한다.
- `dispatch_in_gateway`는 `singde` 단일 소유 원칙을 유지한다. 역할봇과 `gw-dev-bot`/아리아에서 dispatcher를 켜지 않는다.
- DB malformed/disk I/O 오류는 반복 재시도하지 말고 circuit-breaker/long-backoff로 멈춘 뒤 보고한다.
- 수정 후 `bash -n`, `python3 -m py_compile`, 관련 테스트, systemd status/journal/failed, `dispatch --dry-run`을 가능한 범위에서 검증한다.
- 보고 경로 기본값은 `gw-telegram-kanban-report-watch.py`의 read-only 직접 Telegram 전송이다. 사용자 결과보고/막힘 보고 카드를 새로 만들거나 `notify-subscribe`를 붙이는 방식은 중복·아리아 경유 보고를 만들 수 있으므로 대장 명시 승인 없이는 켜지 않는다.
- 카드 생성/완료/보류/dispatch 자동화에는 idempotency key, state 파일, 중복 방지, 실패 시 safe stop 조건을 둔다.

## 공통 중단 조건
다음 상황에서는 작업을 멈추고 싱드에게 보고한다.

- 작업 범위나 승인 범위가 불명확한 경우
- 금지 파일 또는 범위 밖 파일 수정이 필요한 경우
- secret, `.env`, credential, 개인정보, 기업 제휴 코드, 결제/정산 정보 노출 가능성이 있는 경우
- 검증 실패, 충돌, 보안 위험, 운영 위험이 발견된 경우
- DB migration, 배포, systemd/gateway, 외부 API 실제 연동이 필요한 경우

## 보고 형식
가능하면 아래 순서로 짧게 보고한다.
- 한 일
- 확인된 근거
- 남은 리스크 또는 미확인 사항
- 다음 액션

텔레그램 자동 보고는 잘리지 않게 1회 보고를 짧게 유지한다. 길어질 경우 `1/2`, `2/2`처럼 나눠 보내고, 핵심 결론을 첫 메시지에 먼저 쓴다.

작업 보고가 올라오면 싱드가 먼저 읽고 분류한다. 완료 보고는 검증 근거와 함께 사용자에게 짧게 보고한다. 막힘 보고는 자동화 범위에서 해결 가능하면 싱드가 해결 또는 재라우팅하고, 사용자 개입·승인·비용·외부 권한·비밀값이 필요한 경우에만 왜 막혔는지와 필요한 선택을 사용자에게 보고한다.

## 그룹웨어 gateway / dispatcher 운영 규칙
- 그룹웨어 역할봇 gateway는 active 상태를 유지한다.
- 대상 역할봇은 `gwplanner`, `gwbuilder`, `gwreviewer`, `gwtester`, `gwdocs`, `gwops` 이다.
- 역할봇 gateway와 `gw-dev-bot`/아리아는 `groupware` board dispatcher를 직접 실행하지 않는다.
- 역할봇과 `gw-dev-bot`의 `dispatch_in_gateway`는 `false`로 유지한다.
- `groupware` board의 Kanban dispatch는 메인 오케스트레이터 `singde` 단일 소유로 운영한다.
- 역할봇은 dispatcher가 아니라 작업자(worker) 실행 대상으로만 동작한다.
- 역할봇 또는 `gw-dev-bot`에서 `dispatch_in_gateway`를 다시 켜는 변경은 기본 금지다.
- 예외적으로 dispatcher 재활성화가 필요하면 config 확인, Kanban DB integrity 확인, 다중 dispatcher 위험 설명, 대장 승인, 변경 후 구조 재검증을 모두 거친다.

## GitHub 공개 오케스트레이션 참고 규칙
오케스트레이션, 자동화, 복구, 완료보고, watcher, dispatcher를 만들거나 고칠 때는 다음 공개 구현에서 확인한 패턴을 기준으로 삼는다. 코드를 그대로 내려받거나 복제하지 말고, 검증된 구조 원칙만 적용한다.

- Claw-Kanban: 작업 접수 → agent 배정 → completion hook/wake → 검증/완료 보고 흐름을 따른다. 단, 사용자 보고는 Kanban 보고카드가 아니라 싱드(singde)가 Telegram으로 직접 보고한다.
- Conductor OSS: Ready task queue, global/project concurrency limit, queued/spawning/terminal status, launch attempt metadata처럼 상태를 명확히 나누고, 같은 board의 dispatcher는 singde 단일 소유로 둔다.
- Kanbots: supervisor/autopilot/orphan reap 패턴을 참고해 stale worker, timeout, crash, protocol violation을 감지하고 safe triage/recovery watcher가 처리한다. PID 재사용/위험 프로세스 kill 같은 작업은 검증 없이 하지 않는다.
- Cline Kanban: runtime health probe, recovery probe, restart/shutdown generation guard 패턴을 참고해 watcher가 중복 실행되거나 이전 tick 결과가 늦게 상태를 바꾸지 않게 한다.
- Routa: run summary, evidence, recovery hint, workspace integrity 개념을 참고해 완료/막힘/복구 보고에는 근거, 다음 액션, 복구 힌트를 짧게 남긴다.
- 공통 적용: idempotency key, state 파일, lock/flock, read-only DB 조회, circuit-breaker/long-backoff, dry-run, 검증 후 완료 보고를 기본으로 한다.
- 금지: 완료/막힘/복구/조치 결과를 사용자 보고용 Kanban 카드로 대체하지 않는다. 최종완료 결과보고, 막힘 보고, 조치결과보고, 복구결과보고, 09~20시 정각 현황보고는 Telegram 직접 보고를 기본값으로 한다.

## 문서 관계
- 인격과 말투 원본: `~/.hermes/SOUL.md`
- 규칙 원본: `AI_RULES.md`
- 이 파일: Hermes 실행용 미러
