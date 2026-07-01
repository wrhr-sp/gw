# Phase 51 게시판 실사용화 fit-gap 범위

## 1. 한 줄 요약
이번 Phase 51의 목표는
이미 존재하는 게시판 API·route·테스트 뼈대를
"대장이 live URL에서 직접 눌러서 목록 → 게시판 상세 → 글 작성/공지 확인 → 댓글 → 읽음 확인까지 이어 볼 수 있는 실사용 흐름"으로 끌어올리는 것이다.

쉽게 말하면 이번 단계는
게시판이 "있다"를 넘어서
1) 직원이 어디서 공지를 읽고
2) 일반 게시판에서 어떤 글을 쓰고
3) 상세에서 댓글과 읽음 확인을 어떻게 끝내는지
4) 권한이 없을 때 무엇이 왜 막히는지
를 화면·API·테스트·문서에서 같은 말로 잠그는 단계다.

## 2. 왜 지금 이 Phase가 필요한가
Phase 41에서는 게시판·공지·문서·결재 도입완성 fit-gap 기준을 잠갔고,
Phase 50에서는 내부 그룹웨어 본격 도입 릴리즈 언어로 전체 흐름을 다시 정리했다.

하지만 게시판 영역에는 아직 아래 gap 이 남아 있다.

1. API 와 테스트는 이미 존재하지만, live URL에서 대장이 따라갈 "실사용 순서"는 아직 게시판 전용으로 잠겨 있지 않다.
2. 현재 웹 화면은 `preview`, `guard 확인`, `감사 후보` 같은 내부 검증 언어가 강해 실제 사용자 흐름과 운영 검토 흐름이 섞여 읽힐 수 있다.
3. `/boards`, `/boards/[boardId]`, `/posts/[postId]` 에서 empty/loading/error/forbidden 상태는 일부 컴포넌트 수준에서만 보이고, route 단위 acceptance 기준은 Phase 51 언어로 아직 닫히지 않았다.
4. notice-only 공지 게시판 책임과 일반 게시판 글쓰기 책임, 댓글/읽음 확인 흐름, forged 접근 차단 설명이 사용자 안내 문장으로는 아직 부족하다.
5. dev/test/UAT 계정 `admin / 1234` 기준으로 대장이 직접 확인할 route, 액션, 남은 승인 게이트가 게시판 묶음 전용 문서 세트로 아직 없다.

즉 이번 Phase는
"게시판 관련 코드와 테스트가 있다"에서 한 걸음 더 나아가
"우리 팀이 실제로 게시판 기본업무를 끝까지 눌러볼 수 있는가"를 잠그는 단계다.

## 3. 이번 Phase에서 잠가야 할 제품 문장
- 익명 시작점은 계속 `/login` 뿐이다.
- 직원 일반 업무 레인의 게시판 진입점은 `/dashboard` 다음 `/boards` 다.
- `/boards` 는 공지형 게시판과 일반 게시판을 함께 보여 줄 수 있어도, notice-only 책임과 일반 글쓰기 책임을 먼저 구분해서 읽혀야 한다.
- `/boards/[boardId]` 는 `board_notice`, `board_general` 같은 실제 예시 route 기준으로 읽고, 없는 boardId 를 실제 운영 게시판 생성 완료처럼 포장하지 않는다.
- `/posts/[postId]` 는 글 본문, 댓글, 읽음 확인, forged 차단 확인을 한 흐름으로 읽히게 해야 한다.
- 직원/관리자/권한 없는 사용자별 UI 노출, route guard, API guard 가 같은 뜻으로 맞아야 한다.
- empty/loading/error/forbidden 은 Production-ready (실구현) 가 아니라 실제 사용자가 이해할 수 있는 상태여야 한다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.
- Production-ready (실구현)/Production-ready (실구현)/dev-safe 문구를 최종 산출물처럼 남기지 않는다.

## 4. 현재 바로 재사용할 근거

### 4-1. 주요 route
- `/boards`
- `/boards/board_notice`
- `/boards/board_general`
- `/posts/board_post_demo`
- `/posts/board_post_notice_1`

### 4-2. 현재 구현 근거 파일
- `apps/web/app/boards/page.tsx`
- `apps/web/app/boards/[boardId]/page.tsx`
- `apps/web/app/posts/[postId]/page.tsx`
- `apps/web/app/_components/real-usage-panels.tsx`
- `apps/web/dashboard-page-content.tsx`
- `apps/api/src/app.ts`
- `packages/shared/src/contracts.ts`

### 4-3. 현재 테스트/검증 근거
- `apps/api/test/auth-org.spec.ts`
  - accessible board 목록/상세/글작성/댓글/읽음 확인
  - `board.manage`, `document.space.manage` 권한 차단
  - notice-only 게시판 일반 글쓰기 차단
  - forged post detail / forged read receipt 차단
- `apps/web/phase41-collaboration-adoption.test.tsx`
  - 대시보드 → 게시판/문서 흐름 copy 및 구조 회귀

중요:
- 현재 기준선은 "API/test 근거가 이미 있다"는 점이다.
- 이번 Phase 51의 핵심은 이를 live URL 기준 게시판 실사용 순서와 상태 문장으로 다시 잠그는 것이다.

## 5. 현재 fit-gap 요약

### 5-1. 지금 이미 있는 것
- same-origin 게시판/공지 목록 API
- boardId 기준 게시글 목록/작성 API
- postId 기준 상세/댓글/읽음 확인 API
- notice-only 게시판 일반 글쓰기 차단
- forged post/read receipt 차단 테스트
- 기본 웹 route 와 실응답 패널 구조

### 5-2. 이번 Phase에서 더 닫아야 하는 것
- `/boards` 의 첫 화면을 "실사용 시작점"으로 읽히게 정리
- `/boards/[boardId]` 에서 공지형/일반형 책임 차이를 더 분명히 정리
- `/posts/[postId]` 에서 댓글/읽음 확인/권한 차단을 실제 사용 순서로 정리
- route 단위 empty/loading/error/forbidden 상태 문장 보강
- 대시보드와 게시판 상세가 자연스럽게 이어지는 CTA/copy 정리
- UAT 절차와 최종 보고용 확인 순서 문서화

## 6. 이번 Phase에서 직접 닫아야 할 범위

### 6-1. 게시판 핵심 happy path
1. `/dashboard` 에서 게시판 진입
2. `/boards` 에서 공지형/일반형 구분 확인
3. `/boards/board_general` 에서 글 목록 확인 후 글 작성
4. `/posts/{postId}` 에서 상세 확인 후 댓글 작성
5. 같은 상세에서 읽음 확인 등록

### 6-2. 공지형 게시판 흐름
1. `/boards/board_notice` 에서 notice-only 책임 확인
2. 관리자/권한 있는 사용자 공지 작성 가능 여부 확인
3. 일반 직원 글쓰기 차단이 UI/API 모두에서 같은 뜻인지 확인

### 6-3. 상태/가드 흐름
- empty: 글이 없을 때 다음 액션이 분명한가
- loading: 실응답을 불러오는 중이라는 점이 분명한가
- error: 네트워크/권한/입력 문제를 같은 실패로 뭉개지 않는가
- forbidden: notice-only, forged post, 접근 불가 게시판/글이 분명히 차단되는가

### 6-4. 문서/UAT 흐름
- 대장이 live URL에서 직접 눌러볼 route 순서
- dev/test/UAT 계정 기준 액션
- 남은 승인 게이트와 아직 mock/dev-safe 인 부분 구분

## 7. 구현 우선순위

### P0. 반드시 먼저 닫아야 하는 것
1. `/boards` 목록 화면을 실사용 시작점으로 정리
2. `/boards/[boardId]` 글 목록/작성 흐름 정리
3. `/posts/[postId]` 댓글/읽음 확인 흐름 정리
4. notice-only / forged / 접근 불가 차단 문장 정리
5. empty/loading/error/forbidden route 상태 정리

### P1. 바로 뒤따라야 하는 것
1. 대시보드 → 게시판 연결 copy/CTA 정리
2. focused web/API 테스트를 Phase 51 기준으로 보강
3. live 확인 순서, 사용자/관리자 안내, 최종 보고 문장 정리

### P2. 다음 Phase로 넘겨도 되는 것
1. 문서함/첨부 실사용화 전체 범위
2. 전자결재 실사용화 전체 범위
3. 외부 알림/메일/메신저 연계
4. production 실데이터/secret/custom domain

## 8. 구현 순서 제안
1. `/boards` 리스트 화면에서 notice/general 카드, 첫 액션, 상태 문장을 정리한다.
2. `/boards/[boardId]` 에서 공지형/일반형별 글쓰기 권한 문장과 빈 상태를 정리한다.
3. `/posts/[postId]` 에서 댓글/읽음 확인/forged 차단 문장을 정리한다.
4. dashboard 와 게시판 진입 카피를 맞춘다.
5. focused API/web 테스트를 추가 또는 갱신한다.
6. UAT/가이드/배포 후 확인 문구는 docs/ops 체인으로 넘긴다.

## 9. 테스트 시나리오

### A. 직원 happy path
- `/login` → `/dashboard` → `/boards` → `/boards/board_general` → 글 작성 → `/posts/{postId}` → 댓글 → 읽음 확인

### B. 공지 게시판 책임 확인
- `/boards` → `/boards/board_notice`
- 일반 직원 글쓰기 차단 확인
- 운영 공지 작성 책임 분리 확인

### C. 접근 차단 확인
- forged post id 상세 접근 차단
- forged read receipt target 차단
- notice-only 게시판 일반 글쓰기 차단

### D. 상태 확인
- empty/loading/error/forbidden 이 각자 다른 뜻으로 읽히는지 확인

## 10. 이번 Phase에서 일부러 하지 않는 것
- 문서함/파일 전체 실사용화
- 외부 메신저/메일/알림 연계
- production DB 실데이터 전환/seed/migration
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 생성 또는 증설
- destructive/force 작업

## 11. 역할별 후속 작업 기준
- builder: 게시판 route happy path, 상태 문장, 권한 차단 UX 를 우선 구현
- reviewer: notice/general 책임 혼동, 과장 문구, 권한 우회, forged 차단 누락 점검
- tester: focused API/web 테스트와 가능한 범위의 smoke 로 happy path + 차단 흐름 검증
- docs: live URL 기준 UAT, 사용자/관리자 안내, route 순서, 승인 게이트 정리
- ops: PR/CI/merge/release-gate/cloudflare deploy/live smoke 정리
