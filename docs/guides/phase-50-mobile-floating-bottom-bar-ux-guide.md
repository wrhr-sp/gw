# Phase 50 모바일 플로팅 하단바 사용 가이드 + 확인 가이드

## 한 줄 요약
이번 변경은 모바일 하단 메뉴 순서를 바꾸는 작업이 아니라,
기존 5개 탭(`메뉴`·`홈`·`메신저`·`메일`·`알림`)은 그대로 두고
하단 바를 더 누르기 쉽고 덜 답답하게 보이는 floating capsule 형태로 다듬은 작업이다.

## 이 문서가 다루는 범위
- 모바일에서 무엇이 어떻게 바뀌었는지
- 사용자가 어디를 보면 되는지
- QA/UAT에서 무엇을 확인하면 되는지
- 아직 남아 있는 승인 게이트가 무엇인지

이 문서는 PC sidebar 사용법 문서가 아니다.
이번 범위는 모바일 하단 navigation UX/UI 확인에 한정한다.

## 먼저 기억할 6가지
1. 모바일 하단 탭 순서는 계속 `메뉴` → `홈` → `메신저` → `메일` → `알림` 이다.
2. 하단 바는 화면 맨 아래에 딱 붙은 footer 가 아니라 safe-area 위에 살짝 떠 있는 bar 로 본다.
3. 현재 보고 있는 탭만 rounded pill 배경으로 강조된다.
4. 알림 숫자는 0이면 숨고, 1~99는 숫자 그대로, 100 이상은 `99+` 로 보인다.
5. 마지막 카드나 버튼이 하단 바에 가리지 않도록 본문 아래 여백을 같이 늘린다.
6. `/login` 은 예전과 같이 하단 바 없이 로그인 화면만 보여야 한다.

## 실제로 무엇이 바뀌었나

### 1. 하단 바 모양
예전처럼 화면 맨 아래 edge 에 붙은 납작한 띠가 아니라,
좌우 여백이 있고 모서리가 둥글며,
약한 shadow 와 blur 가 들어간 떠 있는 capsule 형태로 읽히게 바뀌었다.

쉽게 말하면
"메뉴가 바뀌었다"기보다
"같은 메뉴를 더 앱답게 보이게 정리했다"에 가깝다.

### 2. 현재 탭 표시
선택된 탭은
아이콘과 글자 뒤에 둥근 pill 배경이 보여서
지금 어느 화면에 있는지 더 빨리 읽을 수 있다.

예시:
- `/dashboard` 에 있으면 `홈` 탭이 강조
- `/menu` 에 있으면 `메뉴` 탭이 강조
- `/notifications` 에 있으면 `알림` 탭이 강조

### 3. 알림 숫자 표시
알림 탭의 숫자는 다음 규칙으로 고정한다.
- 0건: 숫자를 아예 숨김
- 1~99건: 숫자 그대로 표시
- 100건 이상: `99+`

중요:
이 숫자는 same-origin `/api/notifications` unread count 기준이다.
외부 push 발송 성공, 외부 문자 발송 성공 같은 뜻으로 읽으면 안 된다.

### 4. 본문 가림 방지
하단 바가 떠 있기 때문에
본문 마지막 카드, 버튼, 입력 폼이 바 뒤에 숨어버리면 안 된다.
그래서 모바일 본문 아래 padding 도 함께 늘려,
스크롤 맨 아래까지 내려가도 마지막 요소를 누를 수 있어야 한다.

## 사용자는 어디를 누르면 되나

### `메뉴`
전체 메뉴를 여는 입구다.
홈과 다른 정보구조가 아니라,
같은 기능을 더 넓게 펼쳐 보는 화면으로 이해하면 된다.

### `홈`
`/dashboard` 로 가는 기본 시작점이다.
오늘 할 일, 자주 쓰는 기능, 주요 바로가기를 먼저 보는 탭이다.

### `메신저`
메신저 자리다.
현재 단계에서는 Production-ready (실구현) 또는 이후 same-origin 메신저 진입점으로 본다.

### `메일`
메일 자리다.
현재 단계에서는 Production-ready (실구현) 또는 이후 메일함 진입점으로 본다.

### `알림`
알림 inbox 진입점이다.
읽지 않은 알림 숫자를 여기서 보고,
공지/알림 상태를 확인하는 용도로 본다.

## 가장 짧은 사용자 확인 순서
1. 모바일 또는 좁은 화면으로 `/login` 접속
2. 로그인 후 `/dashboard` 진입
3. 하단 바가 화면 맨 아래에 붙지 않고 떠 있는지 확인
4. `메뉴` 탭 눌러 `/menu` 이동 확인
5. `알림` 탭 눌러 `/notifications` 이동 확인
6. 각 화면에서 현재 탭 pill 강조가 맞는지 확인
7. 화면 맨 아래까지 스크롤해서 마지막 카드/버튼이 가리지 않는지 확인

## QA/UAT에서 꼭 볼 route
- `/login`
- `/dashboard`
- `/menu`
- `/messenger`
- `/mail`
- `/notifications`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/me`

## route 별로 무엇을 보면 되나

### `/login`
- 하단 바가 보이면 안 된다.
- 로그인 전용 화면만 보여야 한다.

### `/dashboard`
- `홈` 탭이 active pill 로 보여야 한다.
- 맨 아래까지 내려가도 마지막 요소가 하단 바 뒤로 숨지 않아야 한다.

### `/menu`
- `메뉴` 탭이 active pill 로 보여야 한다.
- 홈과 전혀 다른 사이트맵처럼 읽히지 않아야 한다.

### `/messenger`, `/mail`
- 각 탭 active 상태가 route 와 맞아야 한다.
- Production-ready (실구현) 라면 Production-ready (실구현) 임을 숨기지 않아야 한다.

### `/notifications`
- `알림` 탭이 active pill 로 보여야 한다.
- unread count 가 있으면 숫자 규칙 1~99 / `99+` 가 맞아야 한다.
- unread count 는 외부 발송 완료가 아니라 same-origin inbox count 로 읽혀야 한다.

### `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me`
- 하단 바가 보이는 모바일 화면에서도 마지막 버튼/카드/폼이 가리지 않아야 한다.
- 일반 직원 업무 레인과 운영 관리자 레인이 섞여 보이지 않아야 한다.

## 실제 확인 기준을 쉬운 말로 정리하면
- 떠 있는 하단바처럼 보이는가
- 지금 있는 탭만 동그란 pill 로 강조되는가
- 알림 숫자가 너무 길어지지 않고 `99+` 에서 멈추는가
- 맨 아래 버튼이 눌리지 않게 가려지지 않는가
- `/login` 에서는 하단 바가 아예 안 보이는가
- PC 화면까지 같이 바뀌지는 않았는가

## 현재 코드/테스트 근거
이번 문서는 아래 실제 구현/검증 근거와 맞춘다.
- `apps/web/app/_components/mobile-app-shell.tsx`
  - 모바일 하단 탭 5개 렌더링
  - active route 에 `aria-current="page"` 적용
  - 알림 badge `0 숨김 / 1~99 / 99+` 포맷 적용
  - `/login` 에서는 app shell chrome 제외
- `apps/web/app/globals.css`
  - floating capsule 형태의 bottom nav 스타일
  - safe-area + bottom offset
  - 본문 하단 padding 보강
- `apps/web/mobile-app-shell-admin-boundary.test.tsx`
  - 일반 host 탑바/하단바 기준 유지
  - unread badge `99+` cap 검증
- `apps/web/mobile-app-shell-login.test.tsx`
  - `/login` 에서 navigation chrome 비노출 검증

parent tester 재검증 근거:
- focused web 105 tests passed
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- local `next start` 로그인 smoke
- `/dashboard`, `/notifications`, `/menu` active tab 및 bottom-nav markup 확인

## 남아 있는 승인 게이트
이번 작업은 모바일 하단 UX 문서화와 회귀 확인 범위다.
아래 항목은 이번 카드 범위 밖이며 계속 별도 승인 게이트다.
- production DB 실데이터 변경
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 생성·증액
- 외부 push/SMS/메일 실제 연동
- native 앱 배포
- production backup/restore 실행
- migration
- destructive 작업

## 사용자 확인 포인트
대장이 직접 볼 때는 아래 5가지만 먼저 보면 된다.
1. 모바일에서 하단 바가 떠 있는 capsule 처럼 보이는가
2. `메뉴` / `홈` / `알림` 탭 이동 시 현재 탭 강조가 정확한가
3. 알림 숫자가 길어질 때 `99+` 로 정리되는가
4. 맨 아래 버튼이나 카드가 하단 바에 가리지 않는가
5. 로그인 화면(`/login`)에서는 하단 바가 완전히 사라지는가

## 이 문서를 볼 다음 사람에게
- builder 는 구조를 바꾸더라도 탭 순서 5개를 유지해야 한다.
- reviewer 는 active pill, badge cap, safe-area, 본문 가림 방지를 먼저 보면 된다.
- tester 는 `/dashboard`·`/menu`·`/notifications` 와 긴 스크롤 화면을 우선 확인하면 된다.
- docs 는 "디자인이 예뻐졌다"보다 "어디를 누르면 무엇이 열리는지"를 쉬운 말로 설명해야 한다.

## 같이 보면 좋은 문서
- `docs/architecture/phase-50-mobile-floating-bottom-bar-ux-fit-gap-scope.md`
- `docs/guides/phase-50-mobile-floating-bottom-bar-ux-handoff.md`
- `docs/guides/phase-50-internal-groupware-full-adoption-release-guide.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `HANDOFF.md`
