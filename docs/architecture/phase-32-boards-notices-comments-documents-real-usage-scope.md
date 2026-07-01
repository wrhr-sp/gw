# Phase 32 게시판·공지·댓글·문서함 실사용화 범위

## 한 줄 요약
Phase 32의 목표는
대장이 배포 URL에서 `admin / 1234`로 로그인한 뒤
`/boards` → 게시판 상세 → 게시글 상세/댓글/읽음 확인 → `/documents` 흐름을
실제 same-origin API 응답과 권한 차단까지 포함해 직접 눌러볼 수 있게 만드는 것입니다.

쉽게 말하면 이번 단계는
예전 Phase 5/16에서 만든 게시판·문서 Production-ready (실구현)을
"설명용 Production-ready (실구현)"에서
"직접 체험 가능한 협업/공유 흐름"으로 끌어올리는 단계입니다.

## 왜 지금 Phase 32가 필요한가
Phase 31에서 로그인, 홈, 경영업무, 계정관리 입구는 많이 정리됐습니다.
이제 다음으로 체감이 큰 빈칸은 협업 묶음입니다.

현재 대장이 실제로 따라가 보는 기본 흐름은 이미
`/login` → `/dashboard` → `/boards`·`/documents` 까지 이어집니다.
하지만 지금 코드 스냅샷 기준으로는 아래 간격이 남아 있습니다.

1. `/boards`, `/boards/[boardId]`, `/posts/[postId]` 는 실제 API 응답뿐 아니라 preview 생성/댓글/읽음 확인 액션도 누를 수 있지만,
   화면 설명은 아직 richer UX보다 UAT 설명형 비중이 큽니다.
2. 게시글 작성/상세/댓글/읽음 확인 happy path 는 API 테스트와 live panel 로 모두 검증되지만,
   대장이 화면에서 바로 따라가기 쉬운 stepper 정리는 더 보강 여지가 있습니다.
3. `/documents` 는 공간/파일 metadata 응답뿐 아니라 metadata 생성/읽음 확인/권한 차단 probe 도 읽고 있으나,
   문서 상세/첨부 후속 액션과 버전 UX는 더 구체적으로 묶여야 합니다.
4. 공지 작성 권한, 일반 게시판 글쓰기 권한, private 문서공간 차단,
   forged post/read receipt 차단이 문서/화면/테스트에서 같은 말로 더 강하게 묶여야 합니다.
5. 선행 복구/검증 카드와 현재 문서·릴리즈 마무리 카드가 분리된 만큼,
   Phase 32 실사용화는 "지금 눌러볼 수 있는 액션"과 "아직 richer UX·운영 승인 게이트로 남은 것"을 분리해서 handoff 해야 합니다.

즉 이번 단계는
새 메뉴를 늘리는 것이 아니라,
이미 있는 `/boards` 와 `/documents` 를
"지금 실제로 어디까지 되는지 / 아직 무엇이 dev-safe 인지 / 어디가 승인 게이트인지"
한 번에 이해되게 만드는 단계입니다.

## 현재 구현 기준 스냅샷

### 지금 코드에서 바로 확인되는 것
- `apps/web/app/boards/page.tsx`
  - `/api/boards`, `/api/boards/:boardId/posts`, `/api/read-receipts` 링크를 그대로 노출합니다.
  - `BoardsLiveSection` 으로 실제 게시판 목록과 자유 게시판 최신 글을 same-origin API 응답으로 읽습니다.
- `apps/web/app/boards/[boardId]/page.tsx`
  - `board_notice`, `board_general` 대표 boardId 에 따라 공지형/일반형 책임을 구분해 보여 줍니다.
  - 게시글 preview 생성, 현재 세션 guard 확인, 게시글 상세 route 와 문서함 route 로 바로 이어집니다.
- `apps/web/app/posts/[postId]/page.tsx`
  - 댓글 preview 생성, 읽음 확인 등록, forged post 차단 확인을 postId 기준으로 연결합니다.
  - forged postId 는 서버에서 403 으로 막는다는 설명과 버튼이 이미 있습니다.
- `apps/web/app/documents/page.tsx`
  - `DocumentsLiveSection` 으로 `/api/documents/spaces`, `/api/documents/files` 응답을 읽습니다.
  - metadata preview 생성, 문서 읽음 확인, private/missing space 차단 확인, storage key 비노출 가드레일을 화면에 적습니다.
- `apps/web/app/_components/real-usage-panels.tsx`
  - 게시판 목록/최신 글/문서 공간/파일 metadata 를 실제 fetch 로 읽고
    loading/error/empty 상태를 기본 카드로 분리합니다.

### API 테스트로 이미 확인된 것
`apps/api/test/auth-org.spec.ts` 기준:
- EMPLOYEE 로그인으로
  - `/api/notices` 200
  - `/api/boards` 200
  - `/api/boards/board_general/posts` 200
  - 일반 게시글 작성 201
  - 게시글 상세 200
  - 댓글 작성/목록 201/200
  - 읽음 확인 생성 201
- EMPLOYEE 는
  - 게시판 생성 403 (`board.manage` 필요)
  - 문서공간 생성 403 (`document.space.manage` 필요)
  - private 문서공간 파일 목록 403
  - notice-only 게시판 일반 글쓰기 403
  - forged post 상세 조회 403
  - forged read receipt 생성 403
  - 접근 불가 문서공간 metadata 생성 403
- COMPANY_ADMIN 은
  - 게시판 생성 201
  - 문서공간 생성 201
  - 문서 metadata 생성 201
  - 응답에 raw `storageKey` 가 직접 노출되지 않음
  - upload-init / upload-complete / download-init / delete Production-ready (실구현) action 이 존재함

### 지금 바로 체험 가능에 가까운 영역
- `/boards`
  - same-origin API로 실제 게시판 목록과 최신 글 확인
- `/boards/board_notice`
  - notice-only 책임 확인
- `/boards/board_general`
  - 일반 게시판 흐름 확인
- `/posts/[postId]`
  - 댓글/읽음 확인 API 진입점 확인
- `/documents`
  - 문서공간 목록, 파일 metadata, 접근 경계 확인
- `/admin/policies`
  - 협업 화면과 운영 정책 화면 경계 비교

### 아직 Production-ready (실구현)/dev-safe 비중이 큰 영역
- 게시판 상세 화면 자체가 아직 실제 목록/정렬/필터/작성 결과 반영 UX로는 덜 닫혀 있음
- 게시글 상세 화면에 실제 본문/댓글 스레드/읽음 수 요약이 카드 중심 Production-ready (실구현) 설명에 가깝게 남아 있음
- 문서함은 목록/metadata는 있으나 문서 상세 route, 첨부 후속 액션, 버전 비교 UX가 아직 약함
- upload/download/delete 는 API Production-ready (실구현) 동작이 있지만,
  실제 운영 파일 저장·공유 완료처럼 보이면 안 됨
- PostgreSQL 기반 boards/posts/comments/read_receipts/document metadata 전환이 별도 선행 작업으로 남아 있음

## Phase 32에서 고정할 핵심 결정

### 결정 A. 게시판/공지와 문서함은 같은 협업 묶음으로 보되 책임은 섞지 않는다.
- `/boards` 는 공지 전달과 게시판 소통 흐름을 맡습니다.
- `/documents` 는 문서 공간/첨부 metadata/보관 경계를 맡습니다.
- 같은 메뉴 묶음과 추천 클릭 순서 안에 둘 수는 있지만,
  공지 전달 책임과 문서 보관 책임을 한 화면 언어로 섞어 쓰지 않습니다.

### 결정 B. 공지 작성 권한과 일반 게시판 글쓰기 권한을 분리해서 먼저 읽히게 한다.
- notice-only 게시판은 일반 구성원 읽기 중심입니다.
- 일반 구성원은 `board_general` 같은 일반 게시판에서만 글쓰기/댓글/읽음 확인을 직접 체험합니다.
- 공지 작성, 게시판 생성, 운영 정책 저장은 관리자 영역으로 남깁니다.

### 결정 C. 문서함은 metadata 중심 실사용화부터 닫고 raw storage 정보는 계속 숨긴다.
- 문서공간 목록, 파일 metadata, 읽음 확인, 접근 차단까지를 1차 실사용 범위로 봅니다.
- `storageKey`, bucket 내부명, public URL 같은 raw storage 정보는 UI/API에서 직접 노출하지 않습니다.
- 원본 파일 저장소는 R2 유지 가능하지만,
  사용자 체험 언어는 PostgreSQL metadata + 권한 흐름 중심으로 먼저 정리합니다.

### 결정 D. UAT 기준은 "대장이 직접 눌러보고 happy path 와 forbidden 을 같이 설명할 수 있는가"다.
각 기능은 문서와 후속 카드에서 아래를 남겨야 합니다.
- 눌러볼 route
- 사용할 계정/권한
- 직접 해볼 action
- happy path 확인 포인트
- forbidden/empty/error 포인트
- 아직 mock/dev-safe 인 부분
- 별도 승인 필요 항목

### 결정 E. 선행 복구/검증과 문서·릴리즈 마무리를 분리한다.
- `t_c10fc6ce`, `t_ff305819`:
  게시글·댓글 append, company-scoped collab upsert, stale blocker 재검증 정리
- `t_d43e9ca5`:
  현재 route/UAT/guardrail 기준으로 문서 정합성 반영
- `t_854aaa6c`, `t_4faa7030`:
  GitHub/CI/merge/배포 근거 정리와 최종 통합 보고

즉 지금 문서화는
"이제 실제로 눌러볼 수 있는 것"과
"아직 richer UX·운영 승인 게이트로 남은 것"을 분리해서 적어야 합니다.

## fit-gap 표

| 구분 | 지금 대장이 직접 눌러볼 수 있는 것 | 아직 남은 gap | 다음 구현 우선순위 |
| --- | --- | --- | --- |
| 게시판 목록 | `/boards`, 실제 `/api/boards` 응답, 자유 게시판 최신 글 확인 | 목록은 live지만 정렬/필터/작성 진입 체감은 약함 | 목록 카드에서 공지/일반 구분과 다음 액션 더 또렷하게 |
| 게시판 상세 | `/boards/board_notice`, `/boards/board_general` route 진입, preview 생성, 현재 세션 guard 확인 | boardId별 실제 글 목록/작성/상태 반영 UX는 Production-ready (실구현) 비중 큼 | notice-only 대 general 책임을 실제 데이터/CTA 기준으로 강화 |
| 게시글 상세/댓글 | `/posts/[postId]`, 댓글 preview 생성, 읽음 확인 등록, forged 차단 확인 | 실제 스레드/읽음 상태/권한 변화가 설명형 카드에 치우침 | 생성된 게시글 기준 상세→댓글→읽음 확인 stepper 강화 |
| 공지 작성/읽음 | notice-only 읽기 책임, read receipt 공통 endpoint, 관리자 전용 운영 권한 근거 | 공지 작성은 관리자 UX/운영 저장 흐름이 아직 직접 체험형으로 닫히지 않음 | 관리자 기준 공지 작성 preview 또는 실제 dev-safe flow 정리 |
| 문서 공간/metadata | `/documents`, `/api/documents/spaces`, `/api/documents/files`, metadata preview 생성, 문서 읽음 확인, private/missing space 차단 확인 | 문서 상세/버전/첨부 후속 확인 UX가 약함 | space → file metadata → 후속 action → 권한 차단을 한 흐름으로 강화 |
| 권한/forbidden | notice-only 글쓰기 차단, private space 차단, forged post/receipt 차단 테스트 | 화면에서 왜 막히는지 문구/상태 연결이 더 필요 | forbidden 이유를 route와 API에서 같은 언어로 고정 |
| 저장소/R2 경계 | metadata 생성, upload/download/delete Production-ready (실구현) action, raw storage 비노출 | 실제 운영 업로드/외부 공유처럼 오해될 수 있음 | PostgreSQL metadata 우선 + R2 원본 유지 경계를 더 분명히 |

## 대장이 실제로 눌러볼 추천 순서
1. `/login`
   - `admin / 1234` 로 로그인합니다.
2. `/dashboard`
   - 고정 바로가기에서 `/boards`, `/documents` 로 이어질 준비가 되는지 봅니다.
3. `/boards`
   - 실제 게시판 목록과 자유 게시판 최신 글이 API 응답으로 보이는지 봅니다.
4. `/boards/board_notice`
   - 공지 읽기 중심과 notice-only 책임을 봅니다.
5. `/boards/board_general`
   - 일반 게시판 CTA와 게시글 상세 연결을 봅니다.
6. `/posts/board_post_demo`
7. `/posts/board_post_notice_1`
   - 댓글/읽음 확인 API 연결 문맥을 봅니다.
8. `/documents`
   - 전사 문서함 대 민감 문서공간 경계, 파일 metadata, 비노출 원칙을 봅니다.
9. `/admin/policies`
   - 일반 협업 화면 설명과 운영 정책 검토 화면이 같은 뜻인지 비교합니다.

## 기능별 UAT 액션 표

| 기능 | route | 권한 | 직접 해볼 액션 | happy path 확인 포인트 | forbidden/empty/error 포인트 | 현재 dev-safe/mock 잔여 |
| --- | --- | --- | --- | --- | --- | --- |
| 게시판 목록 | `/boards` | EMPLOYEE 이상 | 게시판 목록과 자유 게시판 최신 글 확인 | 실제 `/api/boards`, `/api/boards/:boardId/posts` 응답이 카드에 보임 | fetch 실패 시 error 카드, 글 없으면 빈 카드 | 정렬/필터/검색 UX는 약함 |
| 공지 읽기 | `/boards/board_notice` | EMPLOYEE 이상 읽기, 운영 권한 작성 | 공지형 게시판 책임과 게시글 상세 진입 확인 | notice-only, 읽기 중심, 운영 작성 권한 분리 | 일반 구성원 공지 글쓰기 시 API 403 | 공지 작성 UI는 아직 제한적 |
| 게시판 상세 | `/boards/board_general` | EMPLOYEE 이상 | 게시글 preview 생성 또는 guard 확인 후 상세로 이동 | 게시글/댓글/읽음 확인으로 자연스럽게 이어짐 | 접근 불가 boardId 또는 notice-only 작성 차단은 즉시 확인 | 작성 결과 반영 UX 보강 필요 |
| 게시글 상세 | `/posts/[postId]` | 접근 가능한 게시글 작성자/열람자 | 댓글 preview 생성, 읽음 확인 등록, forged 차단 확인 | 상세 → 댓글 → 읽음 확인 흐름 설명 가능 | forged postId 403, 접근 불가 receipt 403 | 실제 긴 본문/첨부/멘션 UX 없음 |
| 문서함 | `/documents` | EMPLOYEE 이상, private space는 권한자만 | metadata preview 생성, 문서 읽음 확인, private/missing space 차단 확인 | 전사 공간과 민감 공간 차이가 설명됨 | private space 403, metadata 생성 403/space missing 403 | 문서 상세/버전 비교 화면 약함 |
| 운영 정책 비교 | `/admin/policies` | 관리자 | 문서/게시판 운영 정책 후보와 일반 화면 설명 비교 | 협업 화면과 운영 정책 화면 경계가 맞음 | 일반 직원 직접 접근 차단 유지 | 실제 운영 저장/배포 아님 |

## 구현 우선순위

### P0. 현재 직접 눌러보는 액션을 문서/배포 근거와 같은 언어로 고정
우선 카드:
- `t_d43e9ca5`
- `t_854aaa6c`

핵심 범위:
- preview 생성/댓글/읽음 확인/guard probe 설명을 루트 문서와 handoff 에 같은 말로 반영
- live fetch 미확인 시 대체 근거(`pnpm check`, `build:cf`, focused test)를 분리 기록
- 최종 통합 보고가 route·직접 액션·권한 기준·승인 게이트를 바로 인용할 수 있게 정리

### P1. `/boards` 실사용 패널을 진짜 UAT 시작점으로 강화
- 게시판 목록
- 공지형/일반형 구분
- 최신 글/다음 액션
- loading/error/empty 문구 정리

### P2. `/boards/[boardId]` 와 `/posts/[postId]` happy path 닫기
- 게시글 작성 → 상세 → 댓글 → 읽음 확인
- notice-only 차단
- forged 접근 차단 설명
- mobile 카드 우선순위 정리

### P3. `/documents` 문서 공간/metadata/권한 차단 흐름 닫기
- space 목록
- file metadata
- upload/download/delete Production-ready (실구현) action 설명
- private space 차단
- raw storage 비노출 유지

### P4. 운영 정책과 일반 협업 화면의 경계 고정
- `/admin/policies` 와 `/boards`·`/documents` 설명 정렬
- 관리자 전용 운영 저장과 일반 사용자의 읽기/작성 흐름 분리

## 이번 단계에서 일부러 안 하는 것
- 실제 외부 파일 공유 링크 오픈
- 공개 다운로드 정책 확정
- 실개인정보 문서 업로드 확대
- production 공지/댓글/문서 실데이터 반영
- 외부 메일/메신저 알림 연동
- DNS/custom domain, 유료 리소스 증설, destructive migration
- secret 입력/교체

## 구현자가 먼저 볼 파일
1. `apps/web/app/boards/page.tsx`
2. `apps/web/app/boards/[boardId]/page.tsx`
3. `apps/web/app/posts/[postId]/page.tsx`
4. `apps/web/app/documents/page.tsx`
5. `apps/web/app/_components/real-usage-panels.tsx`
6. `apps/api/test/auth-org.spec.ts`
7. `apps/api/src/app.ts`
8. `docs/ux/groupware-benchmark-principles.md`
9. `docs/product/groupware-vision-roadmap.md`

## reviewer/tester가 특히 볼 쟁점
- 게시판/문서함이 same-origin API 응답을 실제로 읽으면서도 Production-ready (실구현) honesty를 잃지 않는지
- notice-only 글쓰기 차단과 일반 게시판 쓰기 허용이 권한 문구/테스트와 같은 뜻인지
- forged post 상세 조회, forged read receipt, private 문서공간 접근 차단이 계속 유지되는지
- 문서 metadata 응답에 raw storage 정보가 직접 노출되지 않는지
- `/boards` 와 `/documents` 가 모바일에서도 다음 액션 우선순위를 잘 보여 주는지
- 관리자 정책 화면과 일반 협업 화면 경계가 다시 섞이지 않는지

## 다음 패스에서 바로 다듬을 항목
1. 게시판 상세에 실제 생성된 게시글 기준 step-by-step 흐름 더 강화
2. 공지 작성 관리자 UX를 dev-safe 범위에서 더 명확히 고정
3. 문서 상세/버전/첨부 후속 액션 화면 보강
4. 배포 검증/live URL 기준 실제 데이터 반영 smoke 문구 재정리
5. `/dashboard` 협업 진입 카드와 `/boards`·`/documents` 설명 문구 밀도 맞추기
