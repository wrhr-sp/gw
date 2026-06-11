# 그룹웨어 개발 파이프라인

## 기본 파이프라인

이 파이프라인은 아리아가 싱드에게 전달한 뒤에도 바로 시작하지 않는다. 대장이 싱드에게 직접 요청한 경우에도 바로 시작하지 않는다. 싱드가 대장에게 오케스트레이션 실행 승인을 다시 요청하고, 대장이 승인한 뒤에만 Kanban 작업 그래프를 생성한다.

```text
도담(기획) → 이룸(구현) → 바름(리뷰) → 해봄(테스트) → 다온(문서화) → 최종 보고
도담(gwplanner) → 이룸(gwbuilder) → 바름(gwreviewer) → 해봄(gwtester) → 다온(gwdocs) → singde
```

## 작업 유형별 흐름

- `feature`: `도담(gwplanner) → 이룸(gwbuilder) → 바름(gwreviewer) → 해봄(gwtester) → 다온(gwdocs) → singde`
- `bugfix`: `해봄(gwtester, 재현) → 이룸(gwbuilder, 수정) → 바름(gwreviewer) → 해봄(gwtester, 회귀) → 다온(gwdocs) → singde`
- `docs`: `다온(gwdocs) → 바름(gwreviewer) → singde`
- `review`: `바름(gwreviewer) → 해봄(gwtester) → singde`
- `ops`: `지킴(gwops) → 바름(gwreviewer) → singde`

## GitHub 자동화 범위

허용 후보: branch 생성, commit, PR 생성, PR 상태/리뷰 확인, GitHub Actions 상태 확인, PR merge, 원격/로컬 branch 삭제.

제외: 외부 공개 URL 설정, 유료 리소스 생성, 비밀값 입력/교체.

release gate를 실제로 운영할 때는 `docs/plans/release-gate.md`를 기준으로 PR 분리, baseline CI, local substitute checks, `build:cf` blocker 처리, branch cleanup 순서를 맞춘다.
