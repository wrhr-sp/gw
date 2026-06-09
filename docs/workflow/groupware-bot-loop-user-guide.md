# 그룹웨어 봇 루프 사용 안내

## 한 줄 요약

계정사용자 요청은 아리아가 받고, 개발 작업은 싱드와 역할별 봇팀이 처리한다. 대장은 승인과 최종 판단만 하면 되도록 만든 구조다.

## 사용자가 기억할 것

1. 계정사용자 요청 접수는 아리아가 맡는다.
2. 개발 총괄은 싱드가 맡는다.
3. 위험 작업은 대장 승인 전에는 진행하지 않는다.

## 자주 쓰는 명령

```bash
cd /home/wrhrgw/gw
./scripts/gw-kanban-status.sh
./scripts/gw-auto-workflow.sh --preview --type feature "작업 제목" "설명"
./scripts/gw-phase-workflow.sh --preview "Phase 제목" "설명"
```

## GitHub 관련

Git 저장소와 `gh` 인증이 준비되면 아래로 PR/CI 상태를 확인할 수 있다.

```bash
./scripts/gw-ci-status.sh
./scripts/gw-pr-flow.sh --show-status
```

실제 PR 생성, merge, branch 삭제는 `--approved`를 명시해야 한다.
