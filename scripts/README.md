# scripts

그룹웨어 봇팀과 개발 자동화를 보조하는 스크립트 폴더다.

운영 원칙: 아리아가 받은 요청은 대장 승인 후 싱드에게 전달되고, 싱드는 다시 대장에게 오케스트레이션 실행 승인을 받은 뒤에만 실제 Kanban 카드 생성/dispatch를 진행한다. 대장이 싱드에게 직접 요청한 경우에도 싱드는 요약·범위·위험·예상 파이프라인을 먼저 보고하고 실행 승인을 받은 뒤 진행한다. 승인 전에는 preview/status 계열만 사용한다.

## 자주 쓰는 그룹웨어 스크립트

- `gw-kanban-status.sh`: `groupware` Kanban 보드 상태 확인
- `gw-kanban-dispatch-dry-run.sh`: 자동 실행 후보 미리 보기
- `gw-kanban-dispatch-once.sh`: dispatcher 1회 실행
- `gw-auto-workflow.sh`: 작업 유형별 자동 파이프라인 생성. 싱드 단계 실행 승인 후 사용
- `gw-phase-workflow.sh`: Phase 단위 자동 파이프라인 생성. 싱드 단계 실행 승인 후 사용
- `gw-ci-status.sh`: GitHub Actions 최근 상태 확인
- `gw-pr-flow.sh`: GitHub PR 생성/CI/merge/branch 삭제 보조. 승인된 오케스트레이션 안에서는 `--approved`를 붙여 release gate가 끝까지 처리한다.
- `gw-kanban-tail.sh`: 카드 tail 확인
- `gw-kanban-watch-task.sh`: 단일 카드 상태 감시
- `gw-ready-task-watch.sh`: 오래 대기 중인 ready 카드 감시 후 dispatch
- `gw-review-required-gate.sh`: blocked `review-required` 카드 안전 처리
- `gw-review-required-gate-watch.sh`: review-required gate 반복 감시
- `gw-worker-recovery-watch.sh`: stale running/timeout/crash 징후를 감지해 원본 카드에 comment
- `gw-blocked-report-watch.sh`: blocked/review-required/승인 필요 등 예외 카드만 싱드 자동보고 카드로 정리
- `gw-hermes-env.sh`: 그룹웨어 Hermes 환경 변수 로드

## 제외 범위

- 외부 공개 URL 설정
- 유료 리소스 생성
- 비밀값 입력/교체


## 자동보고 예외범위

그룹웨어 자동보고는 OTA 갱신 기준을 벤치마킹해 일반 진행상황을 보고하지 않는다.
자동보고 대상은 다음 예외로 제한한다.

- Kanban 카드가 `blocked`이고 실제로 멈춘 경우
- `review-required` handoff가 표준 검증/승인 대기 때문에 멈춘 경우
- worker timeout, stale running, crash, protocol violation 등 복구 판단이 필요한 경우
- 비밀값, 권한, 결제/비용, 외부 배포·연결, DB/운영 데이터 변경처럼 대장 승인이 필요한 경우

제외 대상:

- 정상적인 ready/running/done 상태 변화
- 역할봇별 일반 진행 로그
- 이미 `gw-blocked-report-watch`가 만든 자동보고 카드 자체
- 단순 중간 업데이트
