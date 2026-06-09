# 그룹웨어 봇 루프 운영 문서

## 결론

그룹웨어 봇 루프는 **아리아가 계정사용자 요청을 접수하고, 대장 승인 후 싱드가 개발 작업으로 쪼개며, 역할별 봇이 실행·검토·테스트·문서화를 반복한 뒤 싱드가 최종 보고하는 구조**다.

## 전체 흐름

```text
계정사용자 요청
↓
아리아가 접수/요약
↓
대장 보고 및 승인 확인
↓
싱드가 Kanban 파이프라인 생성
↓
역할별 봇 배정
↓
기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub 점검 → 최종 보고
↓
싱드가 결과 통합
```

## 역할

- 아리아 `gw-dev-bot`: 요청 접수, 요약, 승인 확인, 싱드 전달
- 싱드 `singde`: 개발 메인봇, 작업 분해, 최종 보고
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
gwplanner → gwbuilder → gwreviewer → gwtester → gwdocs → gwops(PR/CI) → singde
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
- GitHub merge/delete branch

## 상태 확인

```bash
cd /home/wrhrgw/gw
./scripts/gw-kanban-status.sh
./scripts/gw-kanban-dispatch-dry-run.sh
./scripts/gw-review-required-gate.sh --dry-run
```
