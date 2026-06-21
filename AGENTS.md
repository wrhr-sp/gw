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

## 작업범위·기능 독립성 강제 규칙
- 사용자가 말한 작업범위 밖의 코드, UI, 문구, 레이아웃, 권한, 데이터 흐름 변경은 절대 금지한다.
- 필요해 보이는 개선이라도 승인 전에는 제안만 하고 실행하지 않는다.
- 공통 컴포넌트, 공통 CSS, 공통 handler, 공통 state를 수정해야 할 때는 먼저 영향받는 기능/화면 목록을 확인한다.
- A 기능을 고치기 위해 공통 코드를 수정했는데 B 기능의 화면·버튼·저장·상태·권한·문구가 같이 바뀌면 작업 실패로 본다.
- 코드 재사용은 허용하되, 기능별 동작 영향은 독립시킨다. 공통 디자인 토큰/기초 부품은 유지할 수 있지만 저장 버튼, 보안 게이트, 설정 동작, 페이지 이동, 권한 판단은 기능별 조건·전용 handler·전용 테스트로 격리한다.
- 구현 카드에는 “바뀌어야 하는 A”와 “바뀌면 안 되는 B”를 함께 적고, 검증 카드에는 A 변경 확인과 B 비변경 회귀 확인을 포함한다.
- 작업범위 밖 영향이 발견되면 즉시 중단하고 원복 또는 범위 축소 후 보고한다.

## 제한적 재귀적 자기개선 루프

그룹웨어 `groupware` board의 개발 카드는 제한적으로 재귀적 자기개선 루프를 적용한다. 목적은 코드나 운영환경을 마음대로 바꾸는 것이 아니라, 현재 카드 품질과 다음 카드 품질을 높이기 위한 문서·테스트·QA·핸드오프 개선이다.

적용 범위:
- 현재 Kanban 카드에 명시된 작업 범위 안에서만 적용한다.
- 그룹웨어 repo(`/home/wrhrgw/gw`), groupware board, singde/profile 및 그룹웨어 역할봇 범위 안에서만 적용한다.
- 반복 실수 방지 규칙, 체크리스트 보강, 테스트 실패 원인 기록, 핸드오프 품질 개선, 다음 작업자가 참고할 개발 규칙 정리에 한정한다.
- 다른 보드, 다른 repo, 다른 product domain, 다른 mainbot 영역에는 적용하지 않는다.

금지:
- 재귀적 자기개선이라는 이유로 다른 보드 카드 생성/수정, 다른 도메인 봇 지시, 운영 DB 변경, 실데이터 삭제/수정, secret/token/credential 변경, 배포, 릴리즈, PR merge, DNS/custom domain 변경, 유료 리소스 생성·증설, 사용자 승인 없는 서비스 재시작, 기존 아키텍처 대규모 변경, 카드 범위 밖 리팩토링을 자동 수행하지 않는다.
- 위 항목이 필요하면 “사용자 승인 필요”로 보고하고 중단한다.

카드 처리 루프:
1. 카드 요구사항 확인
2. 관련 문서 확인: `AGENTS.md`, `PRD.md`, `SPEC.md`, `TASKS.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`
3. 작업 범위 확정
4. 구현 또는 수정
5. 테스트 실행
6. 실패 시 원인 분석
7. 수정 후 재검증
8. 결과 기록
9. 필요한 문서 갱신
10. 핸드오프 작성 또는 업데이트

문서 갱신은 현재 카드와 관련 있는 내용만 아래 문서에 반영한다: `AGENTS.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`.

완료 보고에는 아래 항목을 포함한다: 완료한 작업, 실행한 검증, 발견한 문제, 재귀적 자기개선 반영(갱신 문서/이유/다음 작업에서 방지되는 문제), 남은 이슈, 사용자 승인 필요 항목.

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
- **restricted**: secret, `.env`, DB migration, systemd/gateway, 외부 전송, 결제/정산/개인정보, 대량 삭제. 단, merge/release/deploy/배포가 카드 작업범위에 명시되어 있으면 그 범위 안에서는 승인된 것으로 보고 진행하되 검증 근거를 남긴다.

## 카드 작업범위 승인 규칙
- Kanban 카드의 제목/본문/체크리스트에 `merge`, `release`, `릴리즈`, `deploy`, `디플로이`, `배포`, `PR merge`, `branch cleanup`, `release gate`가 작업범위로 명시되어 있으면, 그 항목은 대장이 카드 작업범위로 명시 승인한 것으로 간주하고 진행한다.
- 단, 작업자는 여전히 최신 head 기준 CI/check, 빌드/테스트, 배포 전 guard, smoke check, 롤백/복구 가능성, 변경 범위를 검증하고 근거를 남겨야 한다.
- 카드에 명시되지 않은 secret 입력/교체, production DB 실데이터 변경, DNS/custom domain, 유료 리소스 생성·증액, 결제/환불/개인정보 처리, destructive 삭제는 별도 승인 없이는 진행하지 않는다.
- 카드 범위가 애매하거나 "배포 준비"처럼 실행 여부가 불명확하면 실행하지 말고 싱드가 범위를 확인한다.

## Kanban DB·자동화 스크립트 안전 규칙
자동화, watcher, Kanban, systemd, dispatcher, 보고 스크립트를 생성하거나 수정할 때는 아래를 먼저 확인한다.

- `kanban.db`, `kanban.db-wal`, `kanban.db-shm`을 직접 쓰거나 편집하지 않는다. 상태 변경은 `hermes kanban ...` CLI를 사용하고, 감시는 SQLite read-only URI 또는 CLI 조회만 사용한다.
- 변경 전 `hermes kanban --board groupware list --json`, DB integrity, watcher/service 상태, 중복 프로세스 여부를 확인한다.
- watcher는 단일 인스턴스만 허용하고, 여러 watcher가 동시에 `dispatch`하지 않게 한다.
- `dispatch_in_gateway`는 `singde` 단일 소유 원칙을 유지한다. 역할봇과 `gw-dev-bot`/아리아에서 dispatcher를 켜지 않는다.
- DB malformed/disk I/O 오류는 반복 재시도하지 말고 circuit-breaker/long-backoff로 멈춘 뒤 보고한다.
- 수정 후 `bash -n`, `python3 -m py_compile`, 관련 테스트, systemd status/journal/failed, `dispatch --dry-run`을 가능한 범위에서 검증한다.
- Telegram 사용자 보고 경로는 Kanban 이벤트 watcher의 자동 중계가 아니라 싱드가 이벤트/카드/runs/log를 읽고 판단해 직접 보내는 방식이다. 허용 보고 유형은 `자동 조치`, `사용자 승인 필요`, `정각 보고`, `작업 최종 결과` 4가지로 제한한다.
- `자동 조치`, `사용자 승인 필요`, `작업 최종 결과`는 카드 생성/상태변경 이벤트를 그대로 쏘지 않는다. 이벤트가 발생하면 싱드가 근거를 확인하고 보고양식에 맞춰 직접 보고한다.
- `정각 보고`는 기존 `gw-hourly-status-report.timer` 기반 09~22시 정각 현황 보고만 유지한다.
- 사용자-facing 보고는 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 분리한다.
- blocked 설명은 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요로 구분한다.
- 카드 댓글 작성 완료와 사용자 직접 보고 완료는 별도 상태로 본다.
- 같은 카드·같은 이유·같은 근거라면 즉시 보고를 반복하지 않고, 상태 변화가 생겼을 때만 다시 보낸다.
- 사용자 결과보고/막힘 보고 카드를 새로 만들거나 `notify-subscribe`를 붙이는 방식은 중복·아리아 경유 보고를 만들 수 있으므로 대장 명시 승인 없이는 켜지 않는다.
- 카드 생성/완료/보류/dispatch 자동화에는 idempotency key, state 파일, 중복 방지, 실패 시 safe stop 조건을 둔다.

## 검증 실패 3회 이상 반복 시 싱드 개입 규칙
- 자동화 스크립트나 역할봇 체인이 같은 카드/같은 실패군에서 `반려`, `검증 실패`, `자동 재수정`을 3회 이상 반복하면 새 재수정 카드를 계속 늘리지 않는다.
- 싱드가 직접 원본 카드, runs/log, 실패 명령, 변경 파일, 중복 worker 여부를 확인해 원인을 분류한다.
- 자동 조치 가능하면 기준 복구 카드 1개만 남기고 수정→리뷰→검증 체인으로 다시 넘긴다.
- secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업이 필요하면 `사용자 승인 필요` 보고로 전환하고 실행하지 않는다.
- 이 개입은 Telegram `[자동 조치]` 유형으로 짧게 보고하되, Kanban 이벤트 raw dump를 보내지 않는다.

## 공통 중단 조건
다음 상황에서는 작업을 멈추고 싱드에게 보고한다.

- 작업 범위나 승인 범위가 불명확한 경우
- 금지 파일 또는 범위 밖 파일 수정이 필요한 경우
- secret, `.env`, credential, 개인정보, 기업 제휴 코드, 결제/정산 정보 노출 가능성이 있는 경우
- 검증 실패, 충돌, 보안 위험, 운영 위험이 발견된 경우
- DB migration, systemd/gateway, 외부 API 실제 연동이 필요하거나, 배포/merge/release가 카드 작업범위에 명시되지 않았는데 필요한 경우

## 보고 형식
가능하면 아래 순서로 짧게 보고한다.
- 결론
- 카드 정보
- 자동화가 한 일 또는 막힌 이유
- 싱드가 직접 개입한 일
- 자동화가 못 끝낸 이유
- 보완한 자동화
- 확인된 근거
- 다음 액션: `대장이 해줘야 할 것`과 `싱드 처리`를 분리
- 승인 게이트

텔레그램 자동 보고는 잘리지 않게 1회 보고를 짧게 유지한다. 길어질 경우 `1/2`, `2/2`처럼 나눠 보내고, 핵심 결론을 첫 메시지에 먼저 쓴다.

같은 카드·같은 이유·같은 근거라면 새 메시지를 반복하지 않는다. `자동복구중 → 작업 최종 결과`처럼 상태 변화가 생겼을 때만 다시 보낸다. 카드 댓글 작성만으로 사용자 보고 완료라고 보지 않고, 실제 직접 보고 여부를 따로 확인한다.

작업 보고가 올라오면 싱드가 먼저 읽고 분류한다. 완료 보고는 검증 근거와 함께 사용자에게 짧게 보고한다. 막힘 보고는 자동화 범위에서 해결 가능하면 싱드가 해결 또는 재라우팅하고, 사용자 개입·승인·비용·외부 권한·비밀값이 필요한 경우에만 왜 막혔는지와 필요한 선택을 사용자에게 보고한다.

작업 최종 결과 보고에는 배포가 포함된 경우 사용자가 URL에서 직접 보면 되는 화면/경로/확인 포인트를 반드시 포함한다. 예: live URL, `/`, `/login`, `/dashboard`, 관련 기능 route, manifest/API/smoke 확인 지점.

## OTA/GW 경계 분리 규칙
- 그룹웨어 팀과 `groupware` board는 그룹웨어 repo(`/home/wrhrgw/gw`)와 그룹웨어 bot home(`/home/wrhrgw/gw-dev-bot/.hermes`)만 본다.
- 그룹웨어 개발 메인봇은 싱드(`singde`) 하나다. 아리아(`gw-dev-bot`)는 접수·보고·보조 역할이며 개발 메인봇이나 dispatcher 소유자가 아니다.
- 싱드/그룹웨어 역할봇은 OTA board(`ota`), OTA repo(`/home/wrhrota/ota`), OTA bot home(`/home/wrhrota/ota-dev-bot/.hermes`)에 직접 카드 생성·수정·dispatch·보고 지시를 하지 않는다.
- OTA 관련 판단이 필요해 보이면 그룹웨어 결과 안에 OTA 조치 판단을 섞지 말고, "그룹웨어 범위 밖"이라고 표시한 뒤 동글/대장에게 별도 확인을 요청한다.
- 예외는 대장이 명시적으로 "OTA와 GW 양쪽 동기화" 또는 "양쪽 모두 적용"을 승인한 경우뿐이며, 그때도 각 board에는 자기 팀 메인봇이 자기 범위 작업만 만든다.

## 그룹웨어 gateway / dispatcher 운영 규칙
- 그룹웨어 역할봇 gateway는 active 상태를 유지한다.
- 대상 역할봇은 도담(`gwplanner`), 이룸(`gwbuilder`), 바름(`gwreviewer`), 해봄(`gwtester`), 다온(`gwdocs`), 지킴(`gwops`) 이다.
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
- 금지: 완료/막힘/복구/조치 결과를 사용자 보고용 Kanban 카드로 대체하지 않는다. `자동 조치`, `사용자 승인 필요`, `작업 최종 결과`는 싱드가 직접 판단해 Telegram에 보고하고, `정각 보고`는 기존 정각 현황 보고만 유지한다.

## 문서 관계
- 인격과 말투 원본: `~/.hermes/SOUL.md`
- 규칙 원본: `AI_RULES.md`
- 이 파일: Hermes 실행용 미러
