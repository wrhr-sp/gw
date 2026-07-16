# 호텔 Web 시각 회귀 기준

## 범위

- `login-*.png`는 실제 `/login` Server Component를 Chromium에 mount한 기준이다.
- `app-shell-*.png`는 제품 route가 아니라 `playwright/stories/app-shell.story.tsx`의 구조 전용 component 기준이다.
- AppShell story의 호텔명·사용자명·메뉴는 레이아웃 검증용 문구이며 업무 API 성공이나 사용자 권한을 흉내 내지 않는다.
- 실제 업무 route screenshot은 서버 세션, 실제 API, PostgreSQL 저장·재조회가 연결된 뒤 추가한다.
- 승인 디자인 PNG는 수동 참고자료다. Pillow 생성 이미지와 브라우저 snapshot을 직접 pixel diff하지 않는다.

## Viewport

- PC: 1440×900, 240px sidebar
- 노트북: 1024×768, 72px 접힌 sidebar
- 모바일: 390×844, 56px topbar와 64px bottom navigation

## 명령

```text
pnpm run test:visual
pnpm run test:visual:update
```

baseline 갱신은 실제 결과 이미지를 직접 확인하고 디자인 변경이 의도된 경우에만 수행한다. CI에서는 baseline을 갱신하지 않는다.
