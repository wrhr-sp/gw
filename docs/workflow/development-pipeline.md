# 그룹웨어 개발 파이프라인

## 기본 파이프라인

```text
기획 → 구현 → 리뷰 → 테스트 → 문서화 → 최종 보고
gwplanner → gwbuilder → gwreviewer → gwtester → gwdocs → singde
```

## 작업 유형별 흐름

- `feature`: `gwplanner → gwbuilder → gwreviewer → gwtester → gwdocs → singde`
- `bugfix`: `gwtester(재현) → gwbuilder(수정) → gwreviewer → gwtester(회귀) → gwdocs → singde`
- `docs`: `gwdocs → gwreviewer → singde`
- `review`: `gwreviewer → gwtester → singde`
- `ops`: `gwops → gwreviewer → singde`

## GitHub 자동화 범위

허용 후보: branch 생성, commit, PR 생성, PR 상태/리뷰 확인, GitHub Actions 상태 확인.

제외: 외부 공개 URL 설정, 유료 리소스 생성, 비밀값 입력/교체.
