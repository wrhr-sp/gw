# 그룹웨어 봇 루프 운영 문서

## 결론

그룹웨어 봇 루프는 **아리아가 계정사용자 요청을 접수해 대장에게 보고하고, 대장이 싱드 전달을 승인하면 싱드가 다시 대장에게 오케스트레이션 승인을 요청한 뒤, 승인된 작업만 역할별 봇이 실행·검토·테스트·문서화하고 싱드가 최종 보고하는 구조**다. 대장이 싱드에게 직접 요청한 경우도 싱드는 바로 실행하지 않고 같은 방식으로 실행 승인을 먼저 요청한다.

## 전체 흐름

```text
계정사용자 요청
↓
아리아가 접수/요약
↓
대장 1차 보고 및 싱드 전달 승인 확인
↓
아리아가 싱드에게 전달
↓
싱드가 대장에게 오케스트레이션 승인 요청
↓
대장 2차 승인 확인
↓
싱드가 Kanban 파이프라인 생성
↓
역할별 봇 배정
↓
기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub 점검 → 최종 보고
↓
싱드가 결과 통합
```

## 대장 → 싱드 직접 요청 흐름

```text
대장이 싱드에게 개발/운영 요청
↓
싱드가 요청 요약, 범위, 위험, 예상 파이프라인 보고
↓
싱드가 오케스트레이션 실행 승인 요청
↓
대장 실행 승인 확인
↓
싱드가 Kanban 파이프라인 생성
↓
역할별 봇 배정 및 최종 보고
```

## 역할

- 아리아 `gw-dev-bot`: 계정사용자 요청 접수, 대장 보고, 싱드 전달 승인 확인, 싱드 전달
- 싱드 `singde`: 전달받은 요청 또는 대장 직접 요청의 실행 승인 요청, 개발 메인봇, 작업 분해, 최종 보고
- `gwplanner`: 기획
- `gwbuilder`: 구현
- `gwreviewer`: 리뷰
- `gwtester`: 테스트
- `gwdocs`: 문서화
- `gwops`: 운영/systemd/GitHub 점검

## 작업 유형별 루프

### 기능 개발

```text
gwplanner → gwbuilder → gwreviewer → gwtester → gwdocs → singde
```

### 버그 수정

```text
gwtester(재현) → gwbuilder(수정) → gwreviewer → gwtester(회귀) → gwdocs → singde
```

### Phase 작업

```text
gwplanner → gwbuilder → gwreviewer → gwtester → gwdocs → gwops(PR/CI/merge/branch 정리) → singde
```

## 루프 갱신/감시 스크립트

- `gw-ready-task-watch.sh`: ready 카드가 오래 대기하면 dispatcher를 다시 밀어준다.
- `gw-review-required-gate-watch.sh`: review-required handoff를 주기적으로 처리한다.
- `gw-kanban-watch-task.sh`: 특정 카드가 끝날 때까지 상태를 감시한다.

## 안전 게이트

아래는 승인 전 자동 실행하지 않는다.

- 외부 배포
- 유료 리소스 생성
- 비밀값 입력/교체
- 운영 DB 변경
- 되돌리기 어려운 삭제/대규모 이동
- 승인된 오케스트레이션 범위 밖의 GitHub merge/delete branch

## 상태 확인

```bash
cd /home/wrhrgw/gw
./scripts/gw-kanban-status.sh
./scripts/gw-kanban-dispatch-dry-run.sh
./scripts/gw-review-required-gate.sh --dry-run
```
