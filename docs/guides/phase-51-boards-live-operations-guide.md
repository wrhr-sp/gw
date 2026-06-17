# Phase 51 게시판 실사용 가이드 + UAT 절차 + 운영 체크리스트

## 한 줄 요약
이번 Phase 51에서는 `/login` → `/dashboard` → `/boards` → `/boards/board_general` → `/posts/{postId}` 순서로 들어가,
게시판 목록 → 글 작성 → 댓글 → 읽음 확인이 실제로 이어지는지,
그리고 `/boards/board_notice` 에서 공지 책임과 일반 글쓰기 책임이 섞이지 않는지만 먼저 확인하면 된다.

## 이 문서가 다루는 범위
- 일반 직원 게시판 사용 가이드
- 운영 관리자 공지 확인 가이드
- 권한 없음/차단 확인 포인트
- empty/loading/error/forbidden 읽는 법
- UAT 절차
- 운영 체크리스트
- 최종 보고에 넣을 항목

이 문서는 외부 메신저 연동이나 production 데이터 전환 문서가 아니다.
지금 이미 있는 게시판 route/API/test 기준선을
"대장이 live URL에서 직접 어디를 눌러 무엇을 확인하면 되는가" 중심으로 다시 묶은 문서다.

## 먼저 기억할 8가지
1. 익명 시작점은 `/login` 뿐이다.
2. 테스트 계정은 `admin / 1234` 다.
3. 이 계정은 dev/test/UAT 전용이며 production 기본 계정이 아니다.
4. 게시판 실사용 시작점은 `/dashboard` 다음 `/boards` 다.
5. `/boards/board_notice` 는 공지 읽기와 운영 공지 책임 확인용이다.
6. `/boards/board_general` 은 일반 글쓰기, 댓글, 읽음 확인 happy path 확인용이다.
7. `/posts/[postId]` 는 댓글·읽음 확인·forged 차단을 함께 확인하는 핵심 상세 route 다.
8. live 직접 확인 근거와 local build/test 대체 근거는 같은 뜻으로 적지 않는다.

## 접속 정보와 현재 근거
- live URL: `https://gw-web.wereheresp.workers.dev`
- 로그인 시작점: `/login`
- 테스트 계정: `admin / 1234`
- parent 기준 focused API: 15 files / 99 passed / 4 skipped
- parent 기준 focused web: 25 files / 107 passed
- parent 기준 shared test: 2 files / 25 passed
- parent 기준 `pnpm typecheck`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf`, `pnpm check` 통과
- parent 기준 localhost smoke: `/dashboard` → `/boards` → `/boards/board_general` → `/posts/board_post_demo`, 게시글 작성, 댓글 작성, 읽음 확인, notice-only 차단 403, forged 차단 403 확인

중요:
- 위 수치는 현재 문서가 기대는 최신 parent 검증 근거다.
- 이번 문서 작업에서 live URL을 다시 직접 fetch 한 것은 아니다.
- 따라서 최종 사용자 보고 전에는 live 직접 확인 메모를 별도로 다시 붙여야 한다.

## 1. 일반 직원이 따라갈 게시판 사용 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/boards`
4. `/boards/board_general`
5. 글 작성
6. `/posts/{postId}`
7. 댓글 작성
8. 읽음 확인 등록

### 각 화면을 어떻게 읽으면 되는가

#### `/dashboard`
- 홈이다.
- 게시판은 여기서 바로 들어가는 일반 업무 레인이다.
- 운영 공지 책임과 일반 협업 게시판 책임이 섞여 보이면 안 된다.

#### `/boards`
- 게시판 전체 시작점이다.
- 공지형 게시판과 일반 게시판을 같이 보여 줄 수 있지만,
  먼저 "공지 읽기" 와 "일반 글쓰기" 책임을 구분해서 읽혀야 한다.
- 작은 화면에서도 다음 행동이 바로 보여야 한다.

#### `/boards/board_general`
- 일반 직원이 가장 먼저 확인할 실사용 게시판이다.
- 글 목록을 보고,
  작성 폼으로 새 글을 만든 뒤,
  상세 route 로 이동하는 흐름이 한 번에 이어져야 한다.
- 현재 세션이 글을 쓸 수 없는 경우에는 성공처럼 보이지 말고 차단 이유가 먼저 보여야 한다.

#### `/posts/{postId}`
- 게시글 상세 확인 화면이다.
- 제목/본문 요약 확인 → 댓글 작성 → 읽음 확인 등록 순서로 본다.
- forged 또는 허용되지 않은 postId 라면 성공형 상세 화면보다 차단 안내가 먼저 보여야 한다.

### 일반 직원이 바로 확인할 질문
- `/boards` 에서 공지형/일반형 책임이 바로 구분되는가
- `/boards/board_general` 에서 글 작성이 실제로 되는가
- 상세에서 댓글 작성과 읽음 확인이 실제로 이어지는가
- 빈 상태/권한 차단/오류가 서로 다른 뜻으로 읽히는가

## 2. 운영 관리자 공지 확인 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/boards`
4. `/boards/board_notice`
5. `/posts/board_post_notice_1`
6. 필요 시 `/boards/board_general` 과 비교

### 어떻게 읽으면 되는가

#### `/boards/board_notice`
- 전사 공지 확인 레인이다.
- 일반 구성원은 읽기와 읽음 확인 중심,
  운영 권한 사용자는 공지 등록 책임까지 확인한다.
- 일반 글쓰기 게시판처럼 보이면 안 된다.

#### `/posts/board_post_notice_1`
- 공지 상세 예시 route 다.
- 공지 제목과 본문 요약,
  읽음 확인,
  일반 구성원 공지 등록 차단 기대치를 함께 확인한다.

### 운영 관리자가 바로 확인할 질문
- 공지 게시판이 일반 게시판과 다른 책임으로 읽히는가
- 공지 등록 가능/불가가 현재 세션 권한과 같은 뜻으로 보이는가
- 일반 직원에게 공지 작성 CTA 가 성공 흐름처럼 보이지 않는가

## 3. 권한 없음 / 차단 확인 가이드

### 먼저 확인할 대상
- notice-only 게시판에서 일반 글쓰기 시도
- 허용되지 않은 boardId 접근
- forged post detail 접근
- forged read receipt target 접근

### 읽는 기준
- UI에서 먼저 막히는지 본다.
- route 차단 안내와 API 차단 이유가 같은 뜻인지 본다.
- 차단 상태인데도 댓글/읽음 확인 CTA 가 보이면 안 된다.
- 차단되면 `/boards` 또는 허용된 상세 route 로 돌아가게 안내해야 한다.

## 4. 상태 문장은 이렇게 구분한다

### empty
- 정상적으로 열렸지만 아직 글이나 댓글이 없는 상태다.
- 다음 행동, 예를 들면 "첫 글 작성" 또는 "첫 댓글 작성"이 보여야 한다.

### loading
- 실제 API 응답을 불러오는 중이다.
- 성공도 실패도 아니다.

### error
- 조회 또는 저장이 실패한 상태다.
- 권한 부족과 같은 뜻으로 쓰면 안 된다.

### forbidden
- 로그인은 되었지만 지금 이 게시판/게시글/행동 권한이 없는 상태다.
- 로그인 실패나 네트워크 오류와 같은 뜻이 아니다.

## 5. 역할별로 어디까지 보면 되는가
- COMPANY_ADMIN: `/dashboard` → `/boards` → `/boards/board_notice` 와 `/boards/board_general` 둘 다 확인
- HR_ADMIN: `/dashboard` → `/boards` → 공지 책임/운영 공지 차이 확인
- MANAGER: `/dashboard` → `/boards` → 일반 게시판 글 흐름 + 공지 확인 차이 확인
- EMPLOYEE: `/dashboard` → `/boards` → `/boards/board_general` → `/posts/{postId}` 기본 happy path 확인
- AUDITOR: 게시판이 첫 landing 은 아니므로 감사 레인과 섞지 말고, 필요 시 게시판 관련 차단/기록 설명만 별도로 확인

## 6. UAT 절차

### 6-1. 시작 전 준비
- live URL 이 `https://gw-web.wereheresp.workers.dev` 인지 다시 확인한다.
- 이번 기록이 live 직접 확인인지, local build/test 대체 근거인지 먼저 구분한다.
- 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰이는지 확인한다.

### 6-2. 공통 시작 시나리오
1. `/login` 이 익명 유일 입구인지 확인
2. 로그인 후 `/dashboard` 로 시작하는지 확인
3. `/boards` 진입이 자연스러운지 확인
4. 공지형/일반형 게시판 책임이 바로 구분되는지 확인

### 6-3. 일반 직원 happy path UAT
추천 순서:
- `/dashboard` → `/boards` → `/boards/board_general` → 글 작성 → `/posts/{postId}` → 댓글 작성 → 읽음 확인

기록할 질문:
- 목록에서 상세로 자연스럽게 이어지는가
- 작성 성공 뒤 상세 이동이 자연스러운가
- 댓글과 읽음 확인이 같은 상세 흐름 안에 있는가
- empty/loading/error/forbidden 이 서로 다른 뜻으로 읽히는가

### 6-4. 공지 책임 UAT
추천 순서:
- `/boards` → `/boards/board_notice` → `/posts/board_post_notice_1`

기록할 질문:
- 공지 읽기와 운영 공지 책임이 분리되는가
- 일반 구성원 글쓰기 차단이 보이는가
- 공지 상세에서 읽음 확인 흐름이 자연스러운가

### 6-5. 차단/guard UAT
추천 순서:
- notice-only 게시판에서 일반 글쓰기 시도
- 허용되지 않은 boardId 접근
- forged post detail 확인
- forged read receipt 차단 확인

기록할 질문:
- 차단이 성공 화면보다 먼저 보이는가
- UI/route/API 가 같은 이유를 말하는가
- 사용자가 다시 어디로 가야 하는지 바로 보이는가

### 6-6. 이슈 분류 기준
- blocker: 지금 게시판 시나리오를 더 진행할 수 없게 막는 문제
- major: 진행은 되지만 실사용 의미를 크게 흔드는 문제
- minor: 흐름은 되지만 다듬어야 하는 문제
- copy-doc: 화면 문구/문서 정합성 문제
- approval-needed: 기능 문제가 아니라 별도 승인 없이는 진행하면 안 되는 항목

## 7. 운영 체크리스트

### 운영 전
- [ ] `/login` 이 유일한 익명 시작점으로 유지된다.
- [ ] 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰인다.
- [ ] live 직접 확인 근거와 local build/test 대체 근거를 분리해 적는다.

### 운영 중
- [ ] `/boards` 가 게시판 실사용 시작점처럼 읽힌다.
- [ ] `/boards/board_notice` 와 `/boards/board_general` 이 다른 책임으로 읽힌다.
- [ ] 일반 게시판에서 글 작성 → 상세 → 댓글 → 읽음 확인이 실제로 이어진다.
- [ ] notice-only 게시판 일반 글쓰기 차단이 유지된다.
- [ ] forged post detail / forged read receipt 차단이 유지된다.
- [ ] empty/loading/error/forbidden 이 서로 다른 뜻으로 읽힌다.

### 운영 후
- [ ] 일반 직원 happy path 와 공지 책임 확인 결과를 따로 기록했다.
- [ ] blocker 와 approval-needed 를 분리했다.
- [ ] 최종 보고에 live URL, 테스트 계정, 추천 route, 직접 해볼 액션, 남은 승인 게이트를 넣을 수 있게 정리했다.

## 8. 최종 보고에 꼭 넣을 항목
- live URL
- 로그인 시작점 `/login`
- 테스트 계정 `admin / 1234`
- 직원이 따라갈 추천 순서
- 운영 관리자가 공지 책임을 확인할 추천 순서
- 직접 해볼 액션: 글 작성, 댓글 작성, 읽음 확인, notice-only 차단 확인, forged 차단 확인
- live 직접 확인 근거
- local build/test/release gate 대체 근거
- 아직 mock/dev-safe 이거나 승인 게이트인 부분

## 9. 최종 보고 템플릿
- 결론:
- live URL:
- 로그인 시작점:
- 테스트 계정:
- 직원 확인 순서:
- 관리자 확인 순서:
- 직접 해볼 액션:
- 확인한 근거:
  - live 직접 확인:
  - local/build/test 대체 근거:
- 주요 이슈:
  - blocker:
  - major:
  - minor:
  - copy-doc:
  - approval-needed:
- 남은 승인 게이트:
- 대장이 직접 보면 되는 route:

## 10. 남아 있는 승인 게이트
- production DB 실데이터 반영/seed/migration
- secret 입력/교체
- 실제 운영 공지 발행 정책 저장
- 외부 메일/메신저/알림 연동
- DNS/custom domain
- 유료 리소스 생성·증설
- destructive 작업
