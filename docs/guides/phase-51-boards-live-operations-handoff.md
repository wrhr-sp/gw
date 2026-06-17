# Phase 51 게시판 실사용화 handoff

## 1. 이번 Phase를 한 줄로 말하면
이번 Phase는 게시판을
"코드와 테스트가 있는 기능"에서
"대장이 live URL에서 직접 목록 → 상세 → 글 작성 → 댓글 → 읽음 확인까지 눌러볼 수 있는 기능"으로 끌어올리는 단계다.

## 2. 다음 작업자가 먼저 기억할 문장
- 익명 시작점은 `/login` 뿐이다.
- 게시판 시작점은 `/dashboard` 다음 `/boards` 다.
- `/boards` 는 공지형과 일반형을 같이 보여 줄 수 있어도 책임은 먼저 분리해서 읽혀야 한다.
- `/boards/board_notice` 는 notice-only 책임 확인용 대표 route 다.
- `/boards/board_general` 은 일반 글쓰기/댓글 흐름 확인용 대표 route 다.
- `/posts/[postId]` 는 본문·댓글·읽음 확인·forged 차단을 함께 확인하는 핵심 상세 route 다.
- 직원/관리자/권한 없음 사용자별 UI/route/API guard 가 같은 뜻으로 맞아야 한다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이다.

## 3. 지금 바로 따라갈 추천 확인 순서
1. `/login`
2. `/dashboard`
3. `/boards`
4. `/boards/board_notice`
5. `/boards/board_general`
6. `/posts/board_post_demo`
7. `/posts/board_post_notice_1`

## 4. builder가 바로 봐야 할 구현 순서
1. `/boards`
   - notice/general 구분
   - 첫 액션 CTA
   - empty/loading/error/forbidden 문장
2. `/boards/[boardId]`
   - 공지형/일반형 책임 분리
   - 글 목록/빈 상태
   - 현재 세션 기준 작성 가능/차단 안내
3. `/posts/[postId]`
   - 댓글 작성
   - 읽음 확인 등록
   - forged/no-access 차단 안내
4. `/dashboard` 연결 copy
   - 게시판이 일반 업무 흐름 안에서 자연스럽게 이어지되 운영 레인과 섞이지 않게 정리

## 5. reviewer가 꼭 볼 질문
1. notice-only 와 일반 게시판 책임이 한 화면에서 섞이지 않는가
2. `preview`, `guard 확인` 같은 내부 검증 문구가 사용자 실사용 문구를 덮지 않는가
3. 권한 없는 사용자의 글쓰기/상세/읽음 확인 차단이 UI 와 API 에서 같은 뜻인가
4. forged post/read receipt 차단 설명이 누락되지 않았는가
5. empty/loading/error/forbidden 이 서로 다른 뜻으로 유지되는가

## 6. tester가 꼭 볼 질문
1. 직원 happy path 가 실제로 이어지는가
2. notice-only 게시판 일반 글쓰기 차단이 유지되는가
3. forged post detail / forged read receipt 차단이 유지되는가
4. focused API/web 테스트가 Phase 51 기준으로 충분한가
5. live 직접 확인 근거와 local build/test 대체 근거가 섞이지 않는가

## 7. docs가 이어받아야 할 정리 포인트
- live URL 에서 직접 눌러볼 route 순서
- dev/test/UAT 계정 기준 액션
- 일반 직원이 보는 게시판 흐름과 운영 공지 책임 차이
- empty/loading/error/forbidden 을 사용자가 이해할 수 있는 쉬운 말로 정리
- 아직 mock/dev-safe 인 부분과 승인 게이트 분리

## 8. ops가 이어받아야 할 정리 포인트
- branch/commit/PR/CI/merge
- release-gate 와 cloudflare deploy
- 가능 범위의 live smoke
- live 직접 확인 불가 시 local preview/build/test 대체 근거 분리

## 9. 현재 재사용 가능한 근거
- 구현 파일: `apps/web/app/boards/page.tsx`, `apps/web/app/boards/[boardId]/page.tsx`, `apps/web/app/posts/[postId]/page.tsx`, `apps/web/app/_components/real-usage-panels.tsx`
- API/contract: `apps/api/src/app.ts`, `packages/shared/src/contracts.ts`
- API 테스트: `apps/api/test/auth-org.spec.ts`
- 웹 회귀 단서: `apps/web/phase41-collaboration-adoption.test.tsx`

## 10. 현재 체인
1. Phase 51 기획·fit-gap: `t_e5d1a842` — 도담(`gwplanner`) — 진행 중
2. Phase 51 구현: `t_fc067f42` — 이룸(`gwbuilder`) — 부모 대기
3. Phase 51 리뷰: `t_864ddcd9` — 바름(`gwreviewer`) — 부모 대기
4. Phase 51 테스트: `t_5148f5f8` — 해봄(`gwtester`) — 부모 대기
5. Phase 51 문서화: `t_d9aeae19` — 다온(`gwdocs`) — 부모 대기
6. Phase 51 GitHub/배포 후속: `t_b681caf3` — 지킴(`gwops`) — 부모 대기

## 11. 이번 Phase에서 하지 않는 것
- 문서함/파일 전체 실사용화
- 전자결재 전체 실사용화
- 외부 메신저/메일/알림 연계
- production DB 실데이터 반영/seed/migration
- secret 입력/교체
- DNS/custom domain
- 유료 리소스 증설
- destructive/force 작업
