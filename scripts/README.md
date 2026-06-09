# scripts

그룹웨어 봇팀과 개발 자동화를 보조하는 스크립트 폴더다.

## 자주 쓰는 그룹웨어 스크립트

- `gw-kanban-status.sh`: `groupware` Kanban 보드 상태 확인
- `gw-kanban-dispatch-dry-run.sh`: 자동 실행 후보 미리 보기
- `gw-kanban-dispatch-once.sh`: dispatcher 1회 실행
- `gw-auto-workflow.sh`: 작업 유형별 자동 파이프라인 생성
- `gw-phase-workflow.sh`: Phase 단위 자동 파이프라인 생성
- `gw-ci-status.sh`: GitHub Actions 최근 상태 확인
- `gw-pr-flow.sh`: GitHub PR 생성/CI/merge 보조. 기본은 미리보기이며 실제 실행은 `--approved` 필요
- `gw-kanban-tail.sh`: 카드 tail 확인
- `gw-kanban-watch-task.sh`: 단일 카드 상태 감시
- `gw-ready-task-watch.sh`: 오래 대기 중인 ready 카드 감시 후 dispatch
- `gw-review-required-gate.sh`: blocked `review-required` 카드 안전 처리
- `gw-review-required-gate-watch.sh`: review-required gate 반복 감시
- `gw-hermes-env.sh`: 그룹웨어 Hermes 환경 변수 로드

## 제외 범위

- 외부 공개 URL 설정
- 유료 리소스 생성
- 비밀값 입력/교체
