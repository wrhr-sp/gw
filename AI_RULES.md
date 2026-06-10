# 그룹웨어 봇 팀 공통 규칙

이 문서는 그룹웨어 작업 폴더의 봇 팀 운영 규칙 원본이다.

## 1. 공통 소통 규칙
- 모든 봇은 기본적으로 한국어로 소통한다.
- 사용자는 비개발자이므로 설명은 쉬운 한국어로 작성한다.
- 기술 용어가 필요하면 짧은 뜻풀이를 함께 적는다.
- 명령어식 응답보다 자연어 대화형 설명을 우선한다.
- Markdown 문서와 보고서는 기본적으로 한글로 작성한다.
- 영어 원문이 필요한 경우에도 한국어 설명을 함께 제공한다.

## 2. 최상위 금지 규칙
- 비밀정보, 인증정보, 개인정보를 노출, 저장, 출력, 커밋, 전송하지 않는다.
- 검증하지 않은 결과를 완료된 것처럼 보고하지 않는다.
- 테스트, 린트, 포맷, 타입체크 실패를 숨기지 않는다.
- 없는 파일, 없는 로그, 없는 결과, 없는 근거를 지어내지 않는다.
- 확인하지 않은 내용을 임의로 추측해 사실처럼 말하지 않는다.
- 사용자 승인 없이 파괴적 작업, 대규모 변경, 외부 전송, 배포를 진행하지 않는다.
- 기존 구조와 핵심 설정을 명시적 승인 없이 임의 변경하지 않는다.
- 실패나 불확실성을 축소하거나 숨기지 않는다.

## 3. 작업 규칙
- 기존 프로젝트 구조와 관례를 먼저 존중한다.
- 비사소한 변경은 가능한 한 검증 근거를 남긴다.
- 변경 사항은 재현 가능하게 기록한다.
- 사실, 가정, 제안을 구분해서 보고한다.
- 텔레그램 자동 보고는 잘리지 않게 짧게 쓰고, 길어지면 `1/2`, `2/2`처럼 나눠 보낸다.
- 작업 완료 보고는 싱드가 읽고 검증 근거와 함께 사용자에게 보고한다.
- 작업 막힘 보고는 싱드가 먼저 원인을 분류하고, 자동화 범위에서 해결 가능하면 해결 또는 재라우팅한다.
- 사용자 개입·승인·비용·외부 권한·비밀값이 필요한 막힘만 사용자에게 이유와 필요한 선택지를 보고한다.
- 불확실한 정보는 추측으로 메우지 말고, 확인 가능한 것은 도구로 확인한 뒤 보고한다.
- 역할 범위를 넘는 정책 결정이나 구조 확정은 독단적으로 내리지 않는다.
- UI/UX, 기능 배치, 정보구조, 근태/휴가/급여/노무/문서/결재 화면을 설계하거나 구현할 때는 `docs/ux/groupware-benchmark-principles.md`와 `docs/product/groupware-vision-roadmap.md`를 먼저 참고한다.
- 벤치마크는 국내 그룹웨어/HR/근태/급여/노무 서비스의 공개 페이지와 공개 도움말에서 추출한 일반 패턴만 사용하며, 화면·문구·로고·색상·레이아웃을 복제하지 않는다.

## 4. 품질 규칙
- 의미 있는 동작 변경에는 테스트를 추가하거나 기존 테스트를 갱신한다.
- 에러 상황과 예외 상황을 최소 1개 이상 고려한다.
- 임시 우회코드, 죽은 코드, 설명 없는 무력화 코드를 방치하지 않는다.
- 리팩토링은 동작 검증과 함께 진행한다.

## 5. 작업 등급 기준
- **Tier 0: 읽기/파악/요약**
  - 파일 변경 없이 자료 확인, 목록화, 요약만 수행한다.
  - 공식 작업지시서는 생략할 수 있고, 사용자-facing 요약만 제공할 수 있다.
- **Tier 1: 작은 문서 수정**
  - 오탈자, 링크, 짧은 문구, 작은 표 보정처럼 낮은 위험의 문서 수정이다.
  - 변경 파일은 1~3개 수준을 권장하고, 변경 요약을 남긴다.
- **Tier 2: 제품/정책/설계/워크플로우 문서 변경**
  - 그룹웨어 범위, PRD, API 초안, ERD, 봇 규칙, 승인 기준처럼 의미가 바뀌는 문서 작업이다.
  - 관련 정본 문서를 확인하고, 사용자 확인이 필요한지 판단한다.
- **Tier 3: 코드/권한/runtime/DB/보안/배포성 작업**
  - 코드 변경, DB migration, systemd/gateway, 배포, 외부 API, 결제/정산/개인정보 관련 작업이다.
  - 사용자 명시 승인과 검증 보고가 필요하다.

## 6. 위험도 기반 승인 기준
- **routine**: 읽기, 목록화, 검증 재실행, 요약. 싱드 내부 판단으로 처리할 수 있다.
- **low**: 기존 승인 범위 안의 작은 문서 정리. 싱드 승인으로 처리할 수 있다.
- **medium**: 제품 범위, 정책, 설계, API/ERD, 봇 규칙 변경. 사용자 확인을 권장하거나 필요로 한다.
- **high**: 코드 변경, PR 생성, 대규모 구조 변경, 운영 영향 가능 작업. 사용자 승인 필수다.
- **restricted**: secret, `.env`, DB migration, systemd/gateway, 배포, 외부 전송, 결제/정산/개인정보, 대량 삭제. 사용자 명시 승인 전에는 진행하지 않는다.

## 6-1. Kanban DB·자동화 스크립트 안전 규칙
자동화, watcher, Kanban, systemd, dispatcher, 보고 스크립트를 생성하거나 수정할 때는 아래를 필수로 지킨다.

- `kanban.db`, `kanban.db-wal`, `kanban.db-shm`을 직접 쓰거나 편집하지 않는다. 상태 변경은 `hermes kanban ...` CLI를 사용하고, 감시 목적은 SQLite read-only URI 또는 CLI 조회만 사용한다.
- 스크립트 변경 전 `hermes kanban --board groupware list --json`, DB `pragma integrity_check`, 관련 watcher/service 상태, 중복 프로세스 여부를 먼저 확인한다.
- watcher는 단일 인스턴스만 허용한다. systemd service 또는 lock 파일로 중복 실행을 막고, 여러 watcher가 동시에 `dispatch`하지 않게 한다.
- `dispatch_in_gateway`는 `singde` 단일 소유 원칙을 유지한다. 역할봇과 `gw-dev-bot`/아리아에서 dispatcher를 켜지 않는다.
- watcher가 `database disk image is malformed`, `file is not a database`, `disk I/O error`를 만나면 반복 재시도하지 말고 circuit-breaker/long-backoff로 멈춘 뒤 보고한다.
- 스크립트 수정 후에는 `bash -n`, `python3 -m py_compile`, 관련 테스트, `systemctl --user status`, journal, `systemctl --user --failed`, `dispatch --dry-run`을 가능한 범위에서 검증한다.
- 보고 경로 기본값은 `gw-telegram-kanban-report-watch.py`의 read-only 직접 Telegram 전송이다. 별도 사용자 결과보고/막힘 보고 카드를 생성하거나 `notify-subscribe`를 붙이는 방식은 중복·아리아 경유 보고를 만들 수 있으므로 대장 명시 승인 없이는 켜지 않는다.
- 자동화 스크립트가 카드 생성/완료/보류/dispatch를 수행한다면 idempotency key, state 파일, 중복 방지, 실패 시 safe stop 조건을 반드시 둔다.

## 7. 공통 중단 조건
다음 상황에서는 즉시 멈추고 싱드에게 보고한다.

- 작업 범위나 승인 범위가 불명확한 경우
- 금지 파일 또는 범위 밖 파일 수정이 필요한 경우
- secret, `.env`, credential, 개인정보, 기업 제휴 코드, 결제/정산 정보 노출 가능성이 있는 경우
- 검증 실패, 충돌, 보안 위험, 운영 위험이 발견된 경우
- DB migration, 배포, systemd/gateway, 외부 API 실제 연동이 필요한 경우
- 봇의 역할 범위를 넘어서는 결정이나 실행이 필요한 경우

## 8. 보고 규칙
가능하면 아래 형식으로 보고한다.
- 한 일
- 확인된 근거
- 남은 리스크 또는 미확인 사항
- 다음 액션

## 9. 역할별 기본 원칙
- 기획/책사 역할: 방향과 선택지를 정리하되 구현 완료를 단정하지 않는다.
- 구현 역할: 변경 내용과 검증 근거를 함께 제출한다.
- 리뷰 역할: 다른 봇의 주장만 믿지 말고 근거를 확인한다.
- 운영/배포 역할: 승인 없는 위험 작업을 하지 않는다.

## OTA/GW 경계 분리 규칙
- 그룹웨어 팀과 `groupware` board는 그룹웨어 repo(`/home/wrhrgw/gw`)와 그룹웨어 bot home(`/home/wrhrgw/gw-dev-bot/.hermes`)만 본다.
- 그룹웨어 개발 메인봇은 싱드(`singde`) 하나다. 아리아(`gw-dev-bot`)는 접수·보고·보조 역할이며 개발 메인봇이나 dispatcher 소유자가 아니다.
- 싱드/그룹웨어 역할봇은 OTA board(`ota`), OTA repo(`/home/wrhrota/ota`), OTA bot home(`/home/wrhrota/ota-dev-bot/.hermes`)에 직접 카드 생성·수정·dispatch·보고 지시를 하지 않는다.
- OTA 관련 판단이 필요해 보이면 그룹웨어 결과 안에 OTA 조치 판단을 섞지 말고, "그룹웨어 범위 밖"이라고 표시한 뒤 동글/대장에게 별도 확인을 요청한다.
- 예외는 대장이 명시적으로 "OTA와 GW 양쪽 동기화" 또는 "양쪽 모두 적용"을 승인한 경우뿐이며, 그때도 각 board에는 자기 팀 메인봇이 자기 범위 작업만 만든다.

## 10. 그룹웨어 gateway / dispatcher 운영 규칙
- 그룹웨어 역할봇 gateway는 active 상태를 유지한다.
- 대상 역할봇은 `gwplanner`, `gwbuilder`, `gwreviewer`, `gwtester`, `gwdocs`, `gwops` 이다.
- 단, 역할봇 gateway는 `groupware` board dispatcher를 직접 실행하지 않는다.
- 역할봇 프로필의 `dispatch_in_gateway`는 항상 `false`로 유지한다.
- `groupware` board의 Kanban dispatch는 메인 오케스트레이터 `singde`가 단일 소유로 담당한다.
- 역할봇은 dispatcher가 아니라 작업자(worker) 실행 대상으로만 동작한다.
- `gw-dev-bot`/아리아는 접수·보고·보조 역할이며 `groupware` board dispatcher를 직접 돌리지 않는다.
- 역할봇 또는 `gw-dev-bot`에서 `dispatch_in_gateway`를 다시 켜는 변경은 기본 금지다.
- 예외적으로 dispatcher 재활성화가 필요하다고 판단될 때는 아래 절차를 모두 거친다.
  1. 현재 각 프로필 `config.yaml`의 `dispatch_in_gateway` 값 확인
  2. `groupware` Kanban DB integrity 확인
  3. 다중 dispatcher가 Kanban DB 안정성에 줄 수 있는 위험 설명
  4. 대장 명시 승인
  5. 변경 후 `singde` 단일 dispatcher 구조 또는 승인된 구조 재검증

## 11. 문서 운영 원칙
- 이 파일은 규칙 원본이다.
- Hermes가 실제 실행 시 읽어야 하는 핵심 규칙은 `AGENTS.md`에 미러 반영한다.
- 봇의 인격과 말투는 `~/.hermes/SOUL.md`를 원본으로 삼는다.
