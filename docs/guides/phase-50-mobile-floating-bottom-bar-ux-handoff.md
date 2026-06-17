# Phase 50 모바일 플로팅 하단바 UX handoff

## 1. 이번 작업을 한 줄로 말하면
모바일 하단 탐색 5개 구조는 그대로 두고,
하단 바를 safe-area 위에 떠 있는 floating capsule 로 바꾸며,
선택 pill·알림 배지·본문 하단 여백·회귀 질문을 구현자가 바로 쓸 수 있게 정리한 handoff 다.

## 2. 반드시 유지할 기준
- 탭 순서: `메뉴` → `홈` → `메신저` → `메일` → `알림`
- 범위: 모바일 하단 navigation UX/UI 만 수정
- 제외: PC sidebar/layout 변경 금지
- active 탭: 아이콘+텍스트 뒤 rounded pill 로 강조
- 알림 배지: 0 숨김 / 1~99 숫자 / 100 이상 `99+`
- floating bar 때문에 마지막 콘텐츠/CTA 가 가려지지 않도록 bottom padding/safe-area 동시 조정
- 관리자 메뉴를 일반 사용자 모바일 하단 탭에 섞지 않음
- same-origin unread count 의미를 외부 push 성공처럼 과장하지 않음

## 3. 구현자가 바로 할 일
1. `apps/web/app/_components/mobile-app-shell.tsx` 에서 모바일 bottom nav 구조와 active 표시 지점을 먼저 본다.
2. 하단 바 컨테이너를 화면 edge 고정 띠가 아니라 inset floating capsule 로 읽히게 style 을 조정한다.
3. active 탭만 pill 배경을 가지게 맞춘다.
4. `알림` 탭 unread count 주입 경로가 있으면 badge 규칙 0/1~99/99+ 를 적용하고, 아직 값이 없으면 확장 가능한 자리와 테스트 기준을 남긴다.
5. `app-shell__body` 또는 같은 역할의 모바일 본문 래퍼에 하단바 높이 + safe-area 를 고려한 bottom padding 을 준다.
6. 좁은 화면 외 구간, login route, admin host boundary 회귀가 깨지지 않는지 함께 확인한다.

## 4. 리뷰어가 꼭 볼 질문
1. 실제로 floating capsule 로 읽히는가, 아니면 여전히 flat footer 처럼 보이는가
2. active pill 이 현재 route 와 정확히 맞는가
3. badge cap 이 99+ 로 잘리는가
4. badge 가 active pill 또는 라벨 가독성을 가리지 않는가
5. 마지막 카드/버튼/폼이 하단바에 가리지 않는가
6. PC sidebar/layout diff 가 섞이지 않았는가
7. 관리자 탐색과 일반 사용자 탐색 경계가 유지되는가

## 5. 테스터가 꼭 볼 route
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

확인 포인트:
- 각 route 에서 현재 탭 active 가 올바른지
- 스크롤 맨 아래에서 마지막 요소가 가리지 않는지
- 알림 배지가 0/두 자리/99+ 규칙을 지키는지
- `/login` 은 기존처럼 app shell 바깥 처리인지
- admin host/mobile boundary 테스트가 일반 사용자 하단 탭과 섞이지 않는지

## 6. 관련 문서
- `docs/architecture/phase-50-mobile-floating-bottom-bar-ux-fit-gap-scope.md`
- `docs/architecture/phase-50-internal-groupware-full-adoption-release-fit-gap-scope.md`
- `docs/guides/phase-50-internal-groupware-full-adoption-release-handoff.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

## 7. 이번 작업에서 일부러 하지 않는 것
- 새 탭 추가
- 관리자 하단 탭 신설
- PC sidebar 재설계
- 외부 push/메일/SMS 연동
- native 전용 패턴 도입
- production secret/DB/DNS/custom domain/유료 리소스 작업
