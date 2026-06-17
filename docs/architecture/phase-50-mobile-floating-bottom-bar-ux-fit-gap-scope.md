# Phase 50 모바일 플로팅 하단바 UX 상세 기준

## 1. 한 줄 요약
이번 작업의 목표는
기존 모바일 하단 탭 5개 구조는 유지하면서,
화면 맨 아래에 붙는 평면 바를
safe-area 위로 살짝 띄운 floating capsule 형태로 바꾸고,
선택 상태·알림 배지·본문 여백·회귀 확인 기준을 한 문서로 잠그는 것이다.

쉽게 말하면 이번 문서는
"모바일에서 어디를 눌러야 하는지" 자체를 바꾸는 문서가 아니라,
이미 정한 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개 하단 탭을
더 손에 잘 닿고 덜 답답하게 보이게 만들기 위한 상세 기준서다.

## 2. 왜 지금 이 작업이 필요한가
Phase 47에서 모바일/PWA 사용성 기준선과 하단 탭 5개 구조를 이미 잠갔다.
하지만 현재 구현은 아래 gap 이 남아 있다.

1. 모바일 하단 바가 화면 아래에 붙은 평면 띠처럼 읽혀서 "앱 shell"보다는 단순 footer 처럼 느껴질 수 있다.
2. 선택된 탭 강조가 충분히 분명하지 않으면 이동 상태를 한눈에 읽기 어렵다.
3. 알림 배지 규칙이 문서/구현/테스트에서 같은 말로 잠기지 않으면 unread 수 표기가 들쭉날쭉해질 수 있다.
4. 플로팅 바로 바꾸면서 본문 하단 padding 을 같이 조정하지 않으면 마지막 카드·버튼·폼이 바에 가릴 수 있다.
5. 모바일 전용 UX 수정이 PC sidebar/layout 변화로 번지면 카드 범위를 벗어난다.

즉 이번 작업은
IA 변경이 아니라,
같은 IA 를 유지한 채 모바일 하단 탐색의 형태·간격·상태 표시·가림 방지 기준을 다시 잠그는 단계다.

## 3. 이번 작업에서 고정할 제품 문장
- 모바일 하단 탐색 기본 순서는 계속 `메뉴` → `홈` → `메신저` → `메일` → `알림` 5개다.
- PC sidebar 와 desktop layout 은 이번 작업 범위에서 바꾸지 않는다.
- 모바일 하단 바는 화면 맨 아래 edge 에 붙지 않고, 하단 safe-area 위로 이격된 floating capsule 로 보여 준다.
- 바 전체에는 좌우 여백, 둥근 모서리, 약한 shadow/blur/card 느낌을 준다.
- 선택된 탭은 아이콘+텍스트 뒤에 rounded pill 배경을 두어 현재 위치를 또렷하게 보여 준다.
- 선택 안 된 탭은 정보 구조를 유지하되 시각 강조를 낮게 둔다.
- 알림 배지는 0이면 숨기고, 1~99는 숫자 그대로, 100 이상은 `99+` 로 표기한다.
- 플로팅 바 때문에 마지막 콘텐츠, CTA, 입력 폼, toast 와 본문이 겹치지 않게 mobile content bottom padding/safe-area 를 함께 조정한다.
- 참고 이미지는 떠 있는 느낌과 구조만 참고하고, 특정 서비스의 문구/색/레이아웃/로고를 복제하지 않는다.

## 4. 상세 UX 기준

### 4-1. 정보구조와 탭 역할
- `메뉴`: 전체 메뉴 화면 진입점
- `홈`: `/dashboard` 성격의 첫 홈 진입점
- `메신저`: 메신저 placeholder 또는 이후 same-origin 메신저 진입점
- `메일`: 메일 placeholder 또는 이후 메일함 진입점
- `알림`: same-origin inbox/unread 진입점

유지 원칙:
- 탭 라벨/순서를 이번 작업에서 바꾸지 않는다.
- 관리자 메뉴는 일반 사용자 하단 탭에 섞지 않는다.
- 탭을 늘려 6개 이상으로 확장하지 않는다.
- 같은 route/IA 를 유지하고 모바일 탐색 껍데기만 다듬는다.

### 4-2. 레이아웃과 간격
- 바 전체는 viewport 좌우에 숨 쉴 여백이 보이도록 inset 형태로 둔다.
- 하단은 `env(safe-area-inset-bottom)` 을 고려해 바닥에서 조금 띄운다.
- 배경은 단색 막대보다 card/capsule 에 가까운 면으로 읽혀야 한다.
- corner radius 는 충분히 커서 독립 카드처럼 읽혀야 한다.
- shadow 는 과하지 않게 두되, 배경과 분리되는 정도는 확보한다.
- blur/glass 느낌을 쓰더라도 가독성을 해치지 않는 약한 수준으로 제한한다.
- 각 탭 hit area 는 최소 44px 이상, 가능하면 48px 기준을 지향한다.
- 아이콘과 텍스트가 세로로 너무 답답하게 붙지 않게 내부 간격을 둔다.
- 다섯 탭 폭은 과도한 불균형 없이 맞추되, 긴 라벨 때문에 특정 탭만 튀지 않게 short label 체계를 유지한다.

### 4-3. 선택 상태 표현
- active 탭만 pill 배경을 가진다.
- pill 은 바 배경과 구분되지만 과도하게 무겁지 않은 대비를 사용한다.
- active 상태에서는 아이콘과 텍스트를 함께 보여 주고 현재 페이지라는 뜻이 분명해야 한다.
- inactive 상태는 클릭 가능하다는 점은 유지하되 active 보다 시각 우선순위를 낮춘다.
- hover 보다 touch 중심 환경이라 press/active/current 상태를 더 우선해서 본다.
- `aria-current="page"` 의미와 시각 강조가 서로 다른 탭을 가리키면 안 된다.

### 4-4. 알림 배지 기준
- 배지는 `알림` 탭에 우선 적용한다.
- 필요 시 다른 탭에 같은 패턴을 재사용할 수 있지만 이번 작업에서 먼저 잠그는 기준은 `알림` 탭이다.
- 표기 규칙:
  - 0건: 배지 숨김
  - 1~9건: 한 자리 숫자
  - 10~99건: 두 자리 숫자
  - 100건 이상: `99+`
- 배지는 pill 또는 탭 전체 활성 강조를 가리지 않는 위치에 둔다.
- 배지 크기 때문에 탭 레이아웃이 흔들리지 않게 absolute/overlay 성격을 우선 검토한다.
- 배지 색은 경고성은 주되 접근성 대비를 해치지 않는 수준으로 유지한다.
- 배지 문구는 실제 외부 push 발송 성공이 아니라 same-origin unread count 임을 계속 전제로 한다.

### 4-5. 본문 가림 방지 기준
- 플로팅 바 높이만큼 본문 하단 padding 을 늘린다.
- 단순 고정값 하나보다 bar height + safe-area 를 합친 여유를 둔다.
- 마지막 카드, form submit 버튼, FAB 성격 CTA, toast, sheet 진입 버튼이 하단바 뒤로 숨어서는 안 된다.
- `/dashboard`, `/menu`, `/notifications`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` 최소 1회씩 하단 겹침을 확인한다.
- 스크롤 끝에서 마지막 요소가 하단바 바로 뒤에 반쯤 숨는 상태를 회귀 버그로 본다.

### 4-6. 접근성 기준
- 하단 네비게이션은 `nav[aria-label]` 구조를 유지한다.
- 현재 탭은 `aria-current="page"` 로 읽혀야 한다.
- 배지 숫자는 시각 표기뿐 아니라 보조기기에서 "읽지 않은 알림 12건"처럼 이해 가능한 추가 문맥을 둘 수 있는지 검토한다.
- 텍스트를 완전히 없애고 아이콘만 남기는 방식은 이번 기준선으로 삼지 않는다.
- 색만으로 active/inactive 를 구분하지 않고 pill, 대비, 굵기, 위치 등 복합 신호를 준다.

## 5. 이번 작업 범위와 제외 범위

### 포함
- 모바일 하단 네비게이션의 floating capsule 스타일 기준
- active pill 강조 기준
- 알림 배지 0/1~99/99+ 규칙
- mobile content bottom padding/safe-area 회피 기준
- 관련 회귀 테스트 포인트 정의

### 제외
- PC sidebar/layout 개편
- 관리자 전용 admin host 탐색 재설계
- 새 탭 추가 또는 IA 개편
- 외부 push/메일/SMS 연동
- native app 전용 제스처/탭바 규칙
- production secret/DB/DNS/custom domain/유료 리소스/destructive 작업

## 6. 구현자가 먼저 볼 파일
- `apps/web/app/_components/mobile-app-shell.tsx`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/mobile-app-shell-login.test.tsx`
- `apps/web/mobile-app-shell-admin-boundary.test.tsx`
- `apps/web/mobile-pwa.test.ts`
- 필요 시 하단 shell style 이 정의된 web stylesheet 계열 파일

## 7. 구현/리뷰/테스트가 꼭 물어야 할 질문
1. 탭 순서가 `메뉴` → `홈` → `메신저` → `메일` → `알림` 으로 유지되는가
2. 모바일 하단 바가 화면 edge 에 붙은 flat footer 가 아니라 safe-area 위 floating capsule 로 읽히는가
3. active 탭만 pill 배경을 가져 현재 위치가 또렷한가
4. 알림 배지 숫자 규칙이 0 숨김 / 1~99 표시 / 99+ capped 로 일관되는가
5. 하단바 때문에 마지막 콘텐츠와 CTA 가 가려지지 않는가
6. 일반 사용자 모바일 shell 수정이 PC sidebar/layout 을 건드리지 않는가
7. same-origin unread count 와 외부 발송 성공 의미가 섞이지 않는가
8. 참고 이미지를 봤더라도 특정 서비스 복제로 읽힐 요소가 없는가

## 8. 회귀 테스트 기준

### 문서/정적 기준
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 가 같은 탭 순서와 same-origin 알림 의미를 유지하는지 본다.

### 화면 기준
- 좁은 화면에서 하단 바가 floating capsule 로 보이는지
- active 탭 pill 강조가 정확한 route 와 맞는지
- `알림` 탭 badge 가 count 에 따라 숨김/표시/99+ 로 바뀌는지
- 마지막 콘텐츠가 바 뒤로 숨지 않는지

### 회귀 route 샘플
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

## 9. 후속 역할별 handoff
- builder: 모바일 shell 구조와 style 을 바꾸되 PC/sidebar 는 건드리지 않고, badge 규칙과 bottom padding 까지 같이 적용한다.
- reviewer: active 상태, 배지 cap, safe-area, 본문 가림, IA 유지, 관리자 메뉴 비혼합을 본다.
- tester: 좁은 화면 기준 route 이동, badge 표기, 마지막 콘텐츠 겹침, login/admin boundary 회귀를 확인한다.
- docs: 최종 사용자 안내에는 "떠 있는 하단바" 자체보다도 어디를 누르면 무엇이 열리는지와 알림 의미를 쉬운 말로 정리한다.
