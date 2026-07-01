# Phase 32 게시판·공지·댓글·문서함 실사용화 handoff

한 줄 요약:
이번 Phase 32는
대장이 `admin / 1234`로 로그인한 뒤
`/boards` → 게시판 상세 → 게시글 상세/댓글/읽음 확인 → `/documents`
흐름을 실제 API 응답과 권한 차단까지 포함해 직접 눌러볼 수 있게 만드는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면
이미 있는 것:
- `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` route
- `BoardsLiveSection`, `DocumentsLiveSection` 같은 same-origin API 실응답 패널
- 게시글 작성/상세/댓글/읽음 확인 API 테스트
- notice-only 게시판 쓰기 차단
- private 문서공간 차단
- forged post/read receipt 차단
- 문서 metadata 생성과 raw storage 비노출 테스트

아직 부족한 것:
- 화면이 실제 UAT 흐름보다 설명형 Production-ready (실구현) 비중이 아직 큼
- 게시판 상세/게시글 상세는 preview 생성 결과를 다시 따라가긴 쉬워졌지만 richer stepper 정리는 더 필요함
- 문서함은 목록/metadata/차단 확인은 좋지만 문서 상세/후속 액션 UX가 약함
- 선행 복구/검증 완료 이후 문서 정합성 → GitHub/배포 근거 정리 순서를 문서에서 더 분명히 나눠야 함

즉 지금은
기능이 전혀 없는 상태가 아니라,
이미 있는 API·route·권한 근거를
대장이 "직접 눌러보는 협업 흐름"으로 묶는 단계입니다.

## 2. 이번 Phase 32를 어떻게 이해하면 되는가

### 1) 게시판/공지와 문서함은 같은 협업 묶음으로 본다.
- `/boards` 는 공지 전달 + 게시판 소통 흐름
- `/documents` 는 문서 공간 + 첨부 metadata + 보관 경계

같이 보이더라도
공지 전달 책임과 문서 보관 책임을 섞어 쓰지 않습니다.

### 2) 공지 작성 권한과 일반 게시판 글쓰기 권한을 분리한다.
- notice-only 게시판은 일반 구성원 읽기 중심
- 일반 구성원은 일반 게시판에서 글쓰기/댓글/읽음 확인
- 공지 작성/게시판 생성/운영 저장은 관리자 영역

### 3) 문서함은 metadata 중심 실사용화부터 닫는다.
이번 단계에서 먼저 닫는 것:
- 문서공간 목록
- 파일 metadata
- 접근 차단
- 읽음 확인
- upload/download/delete Production-ready (실구현) action 설명

이번 단계에서 아직 안 여는 것:
- 외부 공유
- public download 정책 확정
- 실운영 파일 업로드 확대
- 실민감 원본 데이터 확대

### 4) 완료 기준은 "대장이 직접 눌러보고 설명할 수 있는가"다.
각 기능은 아래를 남겨야 합니다.
- route
- 권한
- 직접 해볼 action
- happy path 확인 포인트
- forbidden/empty/error 포인트
- 아직 dev-safe/mock 인 부분
- 별도 승인 필요 항목

## 3. 현재 구현 근거를 한 번에 보면

### 화면 기준 실제 스냅샷
- `apps/web/app/boards/page.tsx`
  - `/api/boards`, `/api/boards/:boardId/posts`, `/api/read-receipts` 진입점 노출
  - 게시판 목록과 자유 게시판 최신 글 live panel 존재
- `apps/web/app/boards/[boardId]/page.tsx`
  - `board_notice`, `board_general` 책임 구분
  - 게시글 preview 생성, 현재 세션 guard 확인, post detail / read receipt / documents 로 이어지는 링크 존재
- `apps/web/app/posts/[postId]/page.tsx`
  - 댓글 preview 생성 / 읽음 확인 등록 / forged post 차단 확인 버튼 존재
  - forged postId 차단 설명 존재
- `apps/web/app/documents/page.tsx`
  - 문서공간 목록과 파일 metadata live panel 존재
  - metadata preview 생성, 문서 읽음 확인, private/missing space 차단 확인, storage key 비노출 가드레일 문구 존재
- `apps/web/app/_components/real-usage-panels.tsx`
  - boards/documents route 에서 실제 fetch + loading/error/empty 기본 상태 처리

### API 테스트 기준 실제 검증 근거
`apps/api/test/auth-org.spec.ts` 기준:
- EMPLOYEE
  - notices/boards/posts 조회 가능
  - general 게시글 작성 가능
  - 댓글 작성/조회 가능
  - read receipt 생성 가능
- EMPLOYEE 차단
  - 게시판 생성 403
  - 문서공간 생성 403
  - private 문서공간 파일 목록 403
  - notice-only 게시판 글쓰기 403
  - forged post 상세 403
  - forged read receipt 403
  - private space metadata 생성 403
- COMPANY_ADMIN
  - 게시판 생성 201
  - 문서공간 생성 201
  - 문서 metadata 생성 201
  - storageKey 직접 비노출 유지
  - upload/download/delete Production-ready (실구현) action 존재

## 4. 구현자가 바로 가져갈 핵심 작업

### 작업 A. `/boards` 를 진짜 UAT 시작점으로 만든다.
지금도 live panel 이 있지만,
더 분명히 보여 줘야 하는 것:
- 공지형/일반형 게시판 차이
- 다음 액션이 무엇인지
- 왜 공지는 읽기 중심인지
- 최신 글에서 상세로 넘어가는 이유
- fetch 실패/글 없음/권한 부족을 각각 어떻게 읽는지

### 작업 B. `/boards/[boardId]` → `/posts/[postId]` 흐름을 stepper처럼 닫는다.
필수 연결:
- 일반 게시판 진입
- 게시글 상세 진입
- 댓글 작성/조회
- 읽음 확인
- notice-only 차단 설명
- forged 접근 차단 설명

중요:
실제 운영 협업툴처럼 과장하지 말고,
지금 가능한 흐름과 차단 이유를 먼저 분명히 보여 줍니다.

### 작업 C. `/documents` 에서 space → file metadata → 후속 action → 권한 차단 흐름을 묶는다.
필수 연결:
- 문서공간 목록
- 전사 공간 대 민감 공간 차이
- 파일 metadata
- upload/download/delete Production-ready (실구현) action 설명
- private space 차단
- metadata 생성 차단

중요:
raw storage 내부정보를 보여 주지 않는 원칙은 계속 유지합니다.

### 작업 D. 운영 정책 화면과 일반 협업 화면 경계를 맞춘다.
- `/boards`, `/documents` 는 일반 사용자 협업/보관 화면
- `/admin/policies` 는 운영 정책 검토 화면

둘이 같은 제품 설명 안에 있더라도
누가 읽는지와 누가 저장하는지를 섞지 않습니다.

## 5. 선행 복구 카드와 현재 마무리 카드 관계
이 Phase 32는 두 갈래로 읽으면 됩니다.

### 선행 복구/검증 카드
- `t_c10fc6ce`
- `t_ff305819`
- 목표: 게시글·댓글 append, company-scoped collab upsert, stale blocker 정리 근거 확정

### 현재 마무리 카드
- `t_d43e9ca5`
- `t_854aaa6c`
- `t_4faa7030`
- 목표: 현재 클릭 가능한 UAT 흐름, 권한 guard, 배포/최종 보고 근거를 같은 언어로 닫기

즉 지금은
"이제 눌러볼 수 있게 된 액션"
과
"아직 richer UX·운영 승인 게이트로 남은 부분"
을 한 문장으로 뭉개면 안 됩니다.

## 6. builder가 바로 보면 좋은 실제 파일 순서
1. `docs/architecture/phase-32-boards-notices-comments-documents-real-usage-scope.md`
2. `apps/web/app/boards/page.tsx`
3. `apps/web/app/boards/[boardId]/page.tsx`
4. `apps/web/app/posts/[postId]/page.tsx`
5. `apps/web/app/documents/page.tsx`
6. `apps/web/app/_components/real-usage-panels.tsx`
7. `apps/api/test/auth-org.spec.ts`
8. `apps/api/src/app.ts`
9. `docs/ux/groupware-benchmark-principles.md`
10. `docs/product/groupware-vision-roadmap.md`

## 7. reviewer/tester가 특히 볼 쟁점
- `/boards` 와 `/documents` 가 실제 API 응답을 읽더라도 여전히 Production-ready (실구현) honesty 를 유지하는지
- notice-only 게시판 차단과 general 게시판 쓰기 허용이 같은 언어로 보이는지
- forged post / forged read receipt / private 문서공간 차단이 UI/API/test 에서 같은 뜻인지
- storage key, bucket 내부명, public URL 이 직접 노출되지 않는지
- mobile 카드 우선순위가 "다음 액션 먼저" 원칙을 지키는지
- 운영 정책 화면과 일반 협업 화면이 다시 섞이지 않는지

## 8. 대장이 가장 먼저 볼 6가지 질문
1. `/boards` 에서 공지형과 일반형 게시판 차이가 바로 읽히는가?
2. 일반 게시판은 게시글 상세/댓글/읽음 확인 흐름을 실제로 따라가 볼 수 있는가?
3. notice-only 게시판은 왜 일반 글쓰기가 막히는지 설명 가능한가?
4. `/documents` 에서 전사 공간과 민감 공간 차이가 바로 보이는가?
5. 문서 metadata 는 보이되 raw storage 정보는 계속 숨겨지는가?
6. 아직 dev-safe/mock 인 부분과 별도 승인 게이트가 숨겨지지 않는가?

## 9. 대장이 실제로 바로 눌러볼 추천 순서
1. `/login` — `admin / 1234`
2. `/dashboard` — 협업 진입점 확인
3. `/boards` — 게시판 목록/최신 글 확인
4. `/boards/board_notice` — notice-only 책임 확인
5. `/boards/board_general` — 일반 게시판 흐름 확인 + 게시글 preview 생성/guard 확인
6. `/posts/board_post_demo` — 자유 게시판 대표 글 기준 댓글 preview 생성/읽음 확인 등록/forged 차단 확인
7. `/posts/board_post_notice_1` — 공지형 게시글 상세 기준 읽음 확인/차단 확인
8. `/documents` — metadata preview 생성/문서 읽음 확인/private·missing space 차단 확인
9. `/admin/policies` — 운영 정책 화면과 일반 협업 화면 경계 비교

## 10. 이번 문서화에서 일부러 분리해 적어야 하는 것
- 지금 바로 체험 가능한 route
- API 테스트로 이미 붙잡힌 happy path
- 화면은 있으나 Production-ready (실구현) 비중이 큰 route
- 권한 차단/forged 차단 route
- richer UX/운영 승인 게이트로 남은 항목
- 별도 승인 없이는 열지 않는 항목

## 11. 다음 패스에서 바로 다듬을 항목
1. 생성된 게시글 기준 상세/댓글/읽음 확인 stepper 강화
2. 공지 작성 관리자 UX를 dev-safe 범위에서 더 명확히 정리
3. 문서 상세/버전/첨부 후속 확인 화면 보강
4. 배포 검증/live smoke 기준 문구 재정리
5. `/dashboard` 협업 진입 카드와 `/boards`·`/documents` 설명 밀도 맞추기
