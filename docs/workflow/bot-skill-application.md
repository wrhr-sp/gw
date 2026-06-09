# 그룹웨어 봇팀 스킬 적용표

## 공통 원칙

- 스킬은 절차 지식이며 toolset 권한을 우회하지 않는다.
- 비밀값, 토큰, 인증 파일은 복사하거나 문서화하지 않는다.
- 외부 배포, 유료 리소스, DB 실데이터 작업은 별도 승인 전에는 진행하지 않는다.

## 공통 운영 스킬

- `hermes-agent`
- `one-three-one-rule`
- `writing-plans`
- `code-wiki`
- `systematic-debugging`
- `test-driven-development`
- `github-pr-workflow`
- `github-code-review`
- `systemd-service-operations`
- `privileged-linux-filesystem-ops`
- `kanban-orchestrator`
- `kanban-worker`

## 전용 로컬 스킬

- `groupware-bot-workflow`: 아리아→싱드→역할별 봇 운영 구조
- `groupware-kanban-pipeline`: 그룹웨어 Kanban/GitHub 자동화 절차

## 봇별 우선 스킬

- 아리아 `gw-dev-bot`: `groupware-bot-workflow`, `one-three-one-rule`, `hermes-agent`
- 싱드 `singde`: `kanban-orchestrator`, `groupware-bot-workflow`, `groupware-kanban-pipeline`, `writing-plans`, `one-three-one-rule`, `code-wiki`
- 기획봇 `gwplanner`: `writing-plans`, `one-three-one-rule`, `code-wiki`
- 구현봇 `gwbuilder`: `code-wiki`, `systematic-debugging`, `test-driven-development`
- 리뷰봇 `gwreviewer`: `github-code-review`, `requesting-code-review`, `systematic-debugging`
- 테스트봇 `gwtester`: `test-driven-development`, `systematic-debugging`
- 문서봇 `gwdocs`: `code-wiki`, `humanizer`, `one-three-one-rule`
- 운영봇 `gwops`: `systemd-service-operations`, `privileged-linux-filesystem-ops`, `github-pr-workflow`, `github-repo-management`
