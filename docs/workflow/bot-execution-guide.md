# 봇 실행 가이드

이 문서는 `/home/wrhrgw/gw` 작업 폴더에서 그룹웨어 봇 팀을 어떻게 실행하고 관리할지 정리한 문서다.

## 핵심 원칙

- 계정사용자 요청은 아리아(`gw-dev-bot`)가 접수한다.
- 아리아는 개발봇이 아니라 접수/요약/보고/싱드 전달 승인 중계 역할이다.
- 개발 총괄은 싱드(`singde`)가 맡되, 전달받은 요청을 바로 실행하지 않고 대장에게 다시 오케스트레이션 승인 요청을 한다.
- 대장이 싱드에게 직접 요청한 경우에도 싱드는 요청 요약·범위·위험·예상 파이프라인을 먼저 보고하고, 대장 실행 승인 후에만 Kanban 작업을 생성한다.
- 역할별 개발봇은 싱드 아래에서 Kanban 카드 단위로 움직인다.
- 모든 봇은 그룹웨어 작업 폴더 `/home/wrhrgw/gw`를 기준으로 작업한다.

## 봇 역할 요약

- 아리아 `gw-dev-bot`: 계정사용자 요청 접수, 대장 보고, 싱드 전달 승인 확인, 싱드 전달
- 싱드 `singde`: 아리아 전달 요청 또는 대장 직접 요청의 실행 승인 요청, 개발 메인봇, 작업 분해, 역할별 봇 조율, 최종 보고
- `gwplanner`: 기획/요구사항/우선순위
- `gwbuilder`: 구현/수정
- `gwreviewer`: 리뷰/누락/품질/보안 확인
- `gwtester`: 테스트/재현/검증
- `gwdocs`: 문서화/쉬운 설명
- `gwops`: 운영/systemd/권한/GitHub 자동화 점검

## Kanban 자동화

상태 확인:

```bash
cd /home/wrhrgw/gw
./scripts/gw-kanban-status.sh
```

작업 그래프 미리보기:

```bash
./scripts/gw-auto-workflow.sh --preview --type feature "작업 제목" "작업 설명"
```

작업 그래프 생성은 싱드 단계 실행 승인 후에만 한다:

```bash
./scripts/gw-auto-workflow.sh --type feature "작업 제목" "작업 설명"
```

지원 유형:

- `feature`
- `bugfix`
- `docs`
- `review`
- `ops`

## GitHub 자동화 범위

허용:

- GitHub 인증 상태 확인
- 브랜치/커밋/PR 생성/CI 확인/merge/branch 삭제 흐름
- GitHub Actions 상태 확인

제외:

- 외부 공개 URL 설정
- 유료 리소스 생성
- 비밀값 입력/교체
