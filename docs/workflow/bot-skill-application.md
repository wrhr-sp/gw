# 그룹웨어 봇 팀 스킬 적용표

## 목적

GitHub/스킬 허브에 올라와 있는 스킬 중에서 그룹웨어 봇 팀의 역할과 권한에 맞는 것을 선별해 설치하고, 각 봇이 어떤 상황에서 어떤 스킬을 우선 참고해야 하는지 정리한다.

## 적용 원칙

- 권한을 늘리지 않는다. 스킬은 절차 지식일 뿐이며, 각 봇의 toolset 권한을 우회하지 않는다.
- 위험한 작업은 기존 승인 원칙을 따른다. 배포, 삭제, 외부 전송, 보안 점검은 사용자 승인 범위 안에서만 한다.
- 내부 보조봇은 사용자에게 직접 보고하지 않고, 싱드가 최종 취합한다.
- 스킬이 설치되어 있어도 역할과 맞지 않으면 억지로 쓰지 않는다.

## 공통 적용 스킬

- `one-three-one-rule`
  - 용도: 판단이 필요한 상황에서 선택지 1개 / 이유 3개 / 실행 1개로 정리
  - 대상: 전체 봇
- `code-wiki`
  - 용도: 코드 구조를 문서화하거나 코드베이스 설명서를 만들 때 사용
  - 대상: 전체 봇
- `web-app-hosting`
  - 용도: 웹앱 호스팅, 배포 대상 선택, 도메인/환경변수/공개 URL 검증 절차 확인
  - 대상: 전체 봇

## 봇별 적용

### 싱드 `singde` — 총괄봇 / 메인봇

- 필요한 스킬
  - `one-three-one-rule`: 사용자에게 결론 중심으로 선택지를 정리
  - `code-wiki`: 코드/문서 상태를 전체 관점에서 파악
  - `web-app-hosting`: 웹앱을 외부 URL로 공개해야 할 때 배포 작업을 분리하고 검증 기준을 정함
- 있으면 도움이 되는 스킬
  - `fastmcp`: Hermes/MCP 확장 구조 판단
  - `guidance`, `instructor`, `outlines`: 요청 접수 결과를 구조화할 때 참고
- 어울리는 스킬
  - 기존 `kanban-orchestrator`, `korean-bot-governance`, `writing-plans`

### 도담 `gwplanner` — 기획봇

- 필요한 스킬
  - `one-three-one-rule`: 우선순위와 방향성 판단
  - `code-wiki`: 기존 구조를 이해한 뒤 계획 수립
  - `web-app-hosting`: 호스팅 방식, 도메인 전략, 공개/비공개 범위를 계획
- 있으면 도움이 되는 스킬
  - `instructor`, `guidance`: 요구사항을 구조화된 명세로 정리
- 어울리는 스킬
  - 기존 `plan`, `writing-plans`, `ideation`

### 이룸 `gwbuilder` — 구현봇

- 필요한 스킬
  - `code-wiki`: 기존 코드 구조 파악
  - `rest-graphql-debug`: API/HTTP 연동 문제 디버깅
  - `web-app-hosting`: 배포 가능한 빌드/시작 명령, 런타임, 포트 설정 준비
- 있으면 도움이 되는 스킬
  - `docker-management`: 로컬 컨테이너/Compose 기반 개발 환경 점검
  - `fastmcp`: Hermes용 MCP 도구나 서버 구현이 필요할 때
- 어울리는 스킬
  - 기존 `test-driven-development`, `systematic-debugging`, `spike`

### 바름 `gwreviewer` — 리뷰봇

- 필요한 스킬
  - `code-wiki`: 변경 범위와 구조 이해
  - `rest-graphql-debug`: API 변경 검토
  - `web-app-hosting`: 공개 배포 전 비밀값, 노출 경로, 위험 설정 검토
- 있으면 도움이 되는 스킬
  - `oss-forensics`: GitHub 저장소 변경 이력/공급망 이상 징후 확인
  - `web-pentest`: 허가된 범위 안에서 웹 보안 관점 점검
- 어울리는 스킬
  - 기존 `github-code-review`, `requesting-code-review`, `systematic-debugging`

### 해봄 `gwtester` — 테스트봇

- 필요한 스킬
  - `code-wiki`: 테스트 대상 구조 파악
  - `rest-graphql-debug`: API 테스트와 재현 절차 정리
  - `web-app-hosting`: 배포 URL, 주요 화면/API, 로그 상태 검증
- 있으면 도움이 되는 스킬
  - `docker-management`: 테스트 환경 컨테이너 점검
- 어울리는 스킬
  - 기존 `test-driven-development`, `systematic-debugging`

### 다온 `gwdocs` — 문서봇

- 필요한 스킬
  - `code-wiki`: 코드 기반 문서화
  - `one-three-one-rule`: 설명 문서의 결론/근거/실행 구조화
  - `web-app-hosting`: 배포 결과, 접속 URL, 남은 사용자 조치를 쉬운 문서로 정리
- 있으면 도움이 되는 스킬
  - `pptx-author`: 발표 자료 생성이 필요할 때
  - `excel-author`: 표/정리형 산출물이 필요할 때
- 어울리는 스킬
  - 기존 `humanizer`, `ocr-and-documents`, `powerpoint`

### 지킴 `gwops` — 배포·운영봇

- 필요한 스킬
  - `docker-management`: 컨테이너, 이미지, Compose, 운영 환경 점검
  - `rest-graphql-debug`: 운영 API 장애 재현과 원인 확인
  - `web-app-hosting`: 웹앱 호스팅 실행/점검, 도메인·환경변수·공개 URL 검증
- 있으면 도움이 되는 스킬
  - `oss-forensics`: 저장소/배포 이력 이상 징후 확인
  - `code-wiki`: 운영 문서와 구조 파악
- 어울리는 스킬
  - 기존 `github-pr-workflow`, `github-repo-management`, `hermes-s6-container-supervision`

## 설치 보류/제외

아래 스킬은 후보로 봤지만 이번에는 적용하지 않았다.
세부 재검토 목록은 `/home/wrhrgw/gw/docs/workflow/deferred-skills-after-github.md`에 따로 기록한다.

- `playwright`
  - 이유: 커뮤니티 출처 + 보안 스캔에서 주의 판정으로 자동 차단됨
- `gh-fix-ci`, `gh-address-comments`, `security-best-practices`, `frontend-design`, `define-goal`, `mcp-builder`, `plugin-creator`, `skill-creator`
  - 이유: 동명이 많거나 GitHub API 비인증 제한에 걸려 안전하게 특정 버전을 확정 설치하지 못함
  - 후속 조치: `gh auth login` 또는 `GITHUB_TOKEN` 설정 후 신뢰 가능한 식별자로 재시도
- Cloudflare Pages/Workers 등 선택 플랫폼 전용 스킬
  - 이유: `web-app-hosting` 공통 스킬을 먼저 적용했고, 특정 플랫폼 전용 스킬은 실제 배포 대상이 확정되면 추가 적용

## 검증 방법

```bash
hermes -p singde skills list --enabled-only
hermes -p gwbuilder skills list --enabled-only
hermes -p gwreviewer skills list --enabled-only
hermes -p gwtester skills list --enabled-only
hermes -p gwdocs skills list --enabled-only
hermes -p gwops skills list --enabled-only
```

필요하면 각 프로필에서 아래처럼 개별 스킬을 확인한다.

```bash
hermes -p <profile> skills inspect <skill-name>
```
