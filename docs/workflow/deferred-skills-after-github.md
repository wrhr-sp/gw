# GitHub 연결 후 재검토할 그룹웨어 봇 팀 스킬 후보

## 목적

현재 GitHub 인증이 연결되지 않아 신뢰 가능한 출처 확인이나 설치가 보류된 스킬을 따로 기록한다. 나중에 `gh auth login` 또는 `GITHUB_TOKEN` 설정이 완료되면 이 목록을 기준으로 다시 확인하고 필요한 봇에게 설치한다.

## 재검토 조건

아래 중 하나가 완료되면 재검토한다.

- `gh auth login` 완료
- `GITHUB_TOKEN` 설정 완료
- Hermes 스킬 허브/GitHub 검색에서 신뢰 가능한 식별자 확인 가능

## 보류 후보

### GitHub/개발 자동화 후보

- `gh-fix-ci`
  - 예상 용도: CI 실패 자동 분석/수정
  - 후보 대상: 구현봇 `gwbuilder`, 리뷰봇 `gwreviewer`, 테스트봇 `gwtester`, 운영봇 `gwops`
- `gh-address-comments`
  - 예상 용도: PR 리뷰 코멘트 반영
  - 후보 대상: 구현봇 `gwbuilder`, 리뷰봇 `gwreviewer`
- `security-best-practices`
  - 예상 용도: 보안 기본 원칙 점검
  - 후보 대상: 리뷰봇 `gwreviewer`, 운영봇 `gwops`
- `frontend-design`
  - 예상 용도: 프론트엔드 UI/UX 구현 보조
  - 후보 대상: 기획봇 `gwplanner`, 구현봇 `gwbuilder`, 리뷰봇 `gwreviewer`
- `define-goal`
  - 예상 용도: 모호한 요청을 목표/범위로 정리
  - 후보 대상: 싱드 `singde`, 기획봇 `gwplanner`
- `mcp-builder`
  - 예상 용도: MCP 서버/도구 제작
  - 후보 대상: 구현봇 `gwbuilder`, 싱드 `singde`
- `plugin-creator`
  - 예상 용도: Hermes 플러그인 제작
  - 후보 대상: 구현봇 `gwbuilder`, 싱드 `singde`
- `skill-creator`
  - 예상 용도: 스킬 작성/정리 자동화
  - 후보 대상: 싱드 `singde`, 문서봇 `gwdocs`

### 플랫폼 전용 배포 후보

현재는 공통 스킬 `web-app-hosting`을 설치해두었다. 아래는 실제 배포 플랫폼이 확정되면 추가 검토한다.

- Cloudflare Pages/Workers 전용 스킬
  - 후보 대상: 운영봇 `gwops`, 구현봇 `gwbuilder`, 테스트봇 `gwtester`
- Cloudflare Pages/Workers 전용 스킬
  - 후보 대상: 운영봇 `gwops`, 구현봇 `gwbuilder`, 테스트봇 `gwtester`
- Netlify 전용 스킬
  - 후보 대상: 운영봇 `gwops`, 구현봇 `gwbuilder`, 테스트봇 `gwtester`
- Cloudflare API/DB 운영 보조 스킬
  - 후보 대상: 운영봇 `gwops`, 구현봇 `gwbuilder`, 테스트봇 `gwtester`
- Railway/Fly.io 전용 스킬
  - 후보 대상: 운영봇 `gwops`, 구현봇 `gwbuilder`, 테스트봇 `gwtester`

## 설치 전 확인 원칙

- 출처가 신뢰 가능한지 확인한다.
- 동명이 많은 스킬은 GitHub 저장소/작성자/내용을 확인한 뒤 설치한다.
- 권한을 늘리지 않는다. 스킬은 절차 지식이며 toolset 권한을 우회하지 않는다.
- 배포, 삭제, 외부 전송, 보안 점검 관련 스킬은 사용자 승인 범위 안에서만 사용한다.
- 설치 후 `/home/wrhrgw/gw/docs/workflow/bot-skill-application.md`를 갱신한다.
