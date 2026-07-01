# MEMORY

## ARCHITECTURAL MANDATORY RULE: All Values Must Be Tokenized

- 모든 UI의 색상, 간격(패딩/마진), 테두리 값은 디자인 토큰(CSS 변수 또는 Tailwind 테마 토큰)으로만 구현한다.
- 컴포넌트/페이지/스타일 코드에 #HEX 색상 코드나 px 단위 생 숫자를 직접 입력하지 않는다.
- 필요한 값이 없으면 `apps/web/app/globals.css` 또는 Tailwind 테마 설정에 의미 기반 토큰을 먼저 추가하고 UI에서는 토큰 이름만 참조한다.
- 이 규칙은 공지사항 글쓰기 화면을 포함한 프로젝트 전체 UI에 적용한다.
