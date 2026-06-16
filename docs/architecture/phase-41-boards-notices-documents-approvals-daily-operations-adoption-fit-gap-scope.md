# Phase 41 게시판·공지·문서·결재 일상업무 도입완성 fit-gap 범위

## 1. 한 줄 결론

이번 Phase 41의 목적은
이미 Phase 32·33·37·40에서 만들어 둔 게시판/공지/댓글/읽음/문서함/전자결재 흐름을
"실제 회사 내부에서 매일 쓰는 협업 기본 업무" 관점으로 다시 묶는 것이다.

핵심은 새 외부 연동을 여는 것이 아니라,
직원과 승인자가 `/dashboard` 에서 시작해 `/approvals`, `/boards`, `/documents` 를 자연스럽게 오가고,
운영자는 공지/문서 정책/권한/audit 경계를 별도 레인으로 관리하며,
각 화면이 placeholder 를 숨기지 않으면서도 "지금 내부 도입 가능한 수준"으로 읽히게 만드는 것이다.

## 2. 왜 지금 이 Phase가 필요한가

직전 Phase 40에서는
내부 도입 리허설용 `/uat` 패키지, 역할별 UAT 레인, 이슈 분류 기준, 교육자료 초안, 최종 보고 형식을 먼저 정리했다.

하지만 실제 내부 도입을 위해서는
"리허설 문서가 있다"에서 한 단계 더 가서,
아래 네 묶음이 일상업무 관점으로 다시 맞아야 한다.

1. 게시판/공지/댓글/읽음 흐름이 단순 preview 가 아니라 실제 공지 확인과 협업 대화 시작점으로 읽히는가
2. 문서함/첨부 metadata/읽음 흐름이 보관·열람·권한 경계 언어로 자연스럽게 이어지는가
3. 전자결재가 기안자/승인자/참조자 문맥으로 나뉘고 self-approval 금지, replay 차단, 권한 부족이 같은 말로 설명되는가
4. `/dashboard` 와 홈 shortcut 에서 오늘 할 일, 읽지 않은 공지/문서, 승인 대기, 운영 검토 레인이 서로 섞이지 않는가

즉 이번 Phase는
"UAT 패키지 설명"에서
"실제 일상 협업 도입 언어"로 넘어가는 연결 단계다.

## 3. 현재 확인된 구현 근거

이번 fit-gap은 없는 기능을 상상해서 적지 않고,
아래 현재 코드/테스트 근거 위에서 무엇을 닫아야 하는지 정리한다.

### 3-1. 게시판/공지/댓글/읽음 근거

- `apps/web/app/boards/page.tsx`
  - 공지형 게시판과 일반 게시판을 분리해 보여 준다.
- `apps/web/app/boards/[boardId]/page.tsx`
  - boardId 기준 게시판 상세, 글쓰기 preview, 현재 세션 guard 확인 버튼이 있다.
- `apps/web/app/posts/[postId]/page.tsx`
  - 게시글 상세, 댓글 preview 생성, 읽음 확인 등록, forged post 차단 확인 버튼이 있다.
- `apps/web/app/_components/real-usage-panels.tsx`
  - `BoardsLiveSection`, `BoardDetailLiveSection`, `PostDetailLiveSection` 이 same-origin API 실응답과 mutation 을 직접 보여 준다.
- `apps/api/test/auth-org.spec.ts`
  - 직원이 일반 게시판에서 게시글/댓글/읽음 확인을 할 수 있고,
    notice-only 게시판 일반 글쓰기 차단,
    forged post detail/read receipt 차단이 확인돼 있다.
- `apps/api/test/phase32-regression-repro.spec.ts`
  - 반복 게시글/댓글 생성 시 overwrite 되지 않고 append 되는 회귀가 있다.

### 3-2. 문서함/첨부 metadata/읽음 근거

- `apps/web/app/documents/page.tsx`
  - 문서 공간 카드, file metadata preview 생성, private/missing space 차단 확인, 문서 읽음 확인 흐름이 있다.
- `apps/web/app/_components/real-usage-panels.tsx`
  - `DocumentsLiveSection` 에서 same-origin `/api/documents/*` 응답과 metadata 생성 mutation 을 직접 확인할 수 있다.
- `apps/api/test/auth-org.spec.ts`
  - 직원은 public space 만 보고 private HR space 는 403,
    missing space metadata 생성도 차단,
    accessible document_file read receipt 만 허용되는 근거가 있다.
- `apps/api/src/lib/document-storage.ts`
  - 안전한 file metadata/lifecycle 전제가 있고 raw storage key/bucket/signed URL 전문 비노출 원칙이 있다.

### 3-3. 전자결재 근거

- `apps/web/app/approvals/page.tsx`
  - 내 승인함/내 기안함/참조·합의 문서함,
    기안 stepper,
    승인/반려 placeholder,
    권한 부족/self-approval/company scope/placeholder 제한 4축을 보여 준다.
- `apps/web/app/_components/real-usage-panels.tsx`
  - `ApprovalsLiveSection` 에서 실제 결재함 조회, 기안 preview 생성, 팀 문서 승인/반려 mutation 을 직접 검증할 수 있다.
- `apps/api/test/auth-org.spec.ts`
  - 승인 권한 없는 직원 inbox 403,
    self-approval 차단,
    current approver 1회 승인 허용,
    같은 문서 replay reject 차단,
    unknown approval document id 차단 근거가 있다.

### 3-4. 홈/역할 분리/운영 경계 근거

- `apps/web/dashboard-page-content.tsx`
  - `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서의 오늘 할 일 흐름이 있다.
- `apps/web/admin-page-content.tsx`, `apps/web/app/admin/policies/page.tsx`
  - `/boards`, `/documents` 일반 협업 흐름과 `/admin/*` 운영 정책 검토 흐름을 분리하고 있다.
- `apps/web/admin-preview-guard.ts`, `apps/web/middleware.ts`
  - general host 와 admin host, 일반 업무와 운영 route guard 경계가 있다.
- `apps/web/admin-preview-guard.test.ts`, `apps/web/phase38-offline-admin.test.tsx`
  - 감사/운영 권한 차이와 admin host offline 복구 레인이 회귀로 고정돼 있다.

## 4. 이번 Phase에서 직접 닫아야 할 범위

### 4-1. 게시판/공지 묶음을 "도입 가능한 협업 기본 기능"으로 다시 고정한다

이번 Phase에서는 게시판을 더 이상 단순 Phase 32 preview 로만 적지 않는다.
다만 rich editor 완성형처럼 과장하지도 않는다.

이번 문서 기준에서 닫아야 할 것은 아래다.

- 공지 게시판과 일반 게시판 책임 분리
  - 공지는 운영/관리 권한이 쓰고 일반 구성원은 읽기 중심
  - 일반 게시판은 게시글/댓글/읽음 확인이 직원 협업 entry 로 동작
- 게시글 상세의 핵심 행동 고정
  - 제목/본문 preview
  - 댓글 생성
  - 읽음 확인
  - forged id 차단
- 홈/대시보드 연결
  - 새 공지 확인과 일반 게시판 이동이 `/dashboard` shortcut 문맥과 같은 뜻을 가리켜야 함
- audit 후보
  - `board.post.create`, `board.comment.create`, `read receipt` 같은 action 흔적이 운영 검토 언어와 연결돼야 함

### 4-2. 문서함을 "보관/열람/권한 경계" 묶음으로 다시 고정한다

이번 Phase에서 문서함은
실제 외부 공유/전자서명/OCR 완성 기능이 아니라,
회사용 문서 보관과 내부 열람 흐름을 안전하게 설명하는 것이 핵심이다.

닫아야 할 포인트:

- public space 와 private HR space 차이
- metadata 생성은 가능하지만 raw storage internals 는 비노출
- 문서 읽음 확인은 접근 가능한 파일만 허용
- `storageStatus` 와 문서 `status` 를 같은 뜻으로 섞지 않음
- 게시판/결재에서 참조하는 문서가 있더라도 권한 경계는 문서함 기준으로 유지

### 4-3. 전자결재를 "기안자 lane / 승인자 lane / 운영 정책 lane" 으로 다시 고정한다

이번 Phase에서 전자결재는 아래 세 lane 을 분리해서 적어야 한다.

1. 기안자 lane
   - 양식 선택
   - 결재선 선택
   - 참조/합의자 선택
   - 제목/요약 입력
   - 내 문서함 상태 확인
2. 승인자 lane
   - 내 승인함 진입
   - 문서 상세 검토
   - 승인/반려 판단
   - replay 불가 확인
3. 운영 정책 lane
   - 양식/결재선/권한은 `/admin*` 또는 운영 정책 설명으로 분리
   - 일반 직원 결재함과 같은 화면 책임으로 섞지 않음

특히 아래 guardrail 은 이번 Phase 핵심 질문으로 남긴다.

- `approval.document.approve` 권한 없는 inbox 접근 차단
- self-approval 금지
- forged/unknown document id 차단
- 1회 승인 후 replay 차단
- placeholder note 와 실운영 법적 효력을 같은 뜻으로 적지 않기

### 4-4. 홈/대시보드에서 "오늘 할 협업 업무"를 먼저 읽히게 맞춘다

이번 Phase에서는 `/dashboard` 가 단순 메뉴 목록이 아니라,
일상 협업 기능의 실제 시작점처럼 읽혀야 한다.

즉 아래 순서가 자연스러워야 한다.

1. 승인 대기 확인(`/approvals`)
2. 새 공지/게시판 확인(`/boards`)
3. 문서 공간 확인(`/documents`)
4. 자기 상태/세션 확인(`/me`)

동시에 아래는 섞이면 안 된다.

- `/management` 의 민감 운영 업무
- `/admin*` 의 운영 정책/감사 검토
- 공지 읽기와 공지 운영 정책 저장
- 문서 열람과 문서 공간 관리 권한

### 4-5. 운영자 검토 언어를 협업 일반 화면과 분리한다

이번 Phase는 일반 직원 협업 기능 도입완성이 목적이지만,
운영자가 같이 봐야 하는 정책/감사 포인트도 분리해 남겨야 한다.

운영자 문맥에서 다시 고정할 것:

- notice-only 게시판은 일반 구성원 글쓰기 금지
- `board.manage`, `document.space.manage`, `approval.document.approve`, `audit.read` 는 서로 다른 권한 축
- `/admin/policies` 는 협업 화면 자체가 아니라 운영 정책 candidate 검토 위치
- `/admin/audit-logs` 는 read-only/masked preview 경계 유지

## 5. 이번 Phase에서 일부러 하지 않는 것

이번 Phase는 아래를 구현 완료처럼 약속하지 않는다.

- 외부 메일/메신저/전자서명/카카오/Slack/Teams 연동
- 실제 운영 공지 발송 자동화
- rich editor 완성형, 첨부 inline preview, 외부 공유 링크 오픈
- public URL, signed URL 직접 노출
- OCR, 원문 인덱싱, 외부 문서보관/DRM
- 법적 효력 있는 전자결재 서명/타임스탬프
- production 게시글/댓글/문서/결재 실데이터 이관
- 주민번호/계좌번호/실급여/실이체/기관 제출/외부 전문가 연동
- migration, destructive 정리, secret 입력/교체, DNS/custom domain, 유료 리소스 증설

즉 이번 Phase는
"회사 내부에서 협업 기본 업무를 daily routine 으로 돌릴 수 있는가"를 보는 단계이지,
외부 연동과 실법적 효력을 여는 단계가 아니다.

## 6. 핵심 fit-gap 질문

문서/코드 대조 후 아래 질문에 같은 답이 나와야 한다.

1. 직원이 `/dashboard` 에서 `/approvals` → `/boards` → `/documents` 로 이어지는 협업 흐름을 쉽게 따라갈 수 있는가
2. 공지 게시판과 일반 게시판의 책임이 화면/API/test 에서 같은 뜻으로 유지되는가
3. 게시글 상세에서 댓글/읽음 확인/forged 차단이 실제 도입 질문으로 읽히는가
4. 문서함에서 public/private/missing space 차단과 metadata-only 경계가 분명한가
5. 전자결재에서 기안자 lane 과 승인자 lane, 운영 정책 lane 이 서로 섞이지 않는가
6. self-approval 금지, replay 차단, permission 차단이 단순 에러가 아니라 핵심 guardrail 로 분명한가
7. `/boards`·`/documents` 일반 협업 흐름과 `/admin/policies`·`/admin/audit-logs` 운영 검토 흐름이 섞이지 않는가
8. 여전히 placeholder 인 것과 지금 바로 내부 도입 가능한 것을 같은 말로 쓰지 않는가

## 7. 권장 확인 순서

1. `/dashboard`
2. `/approvals`
3. `/boards`
4. `/boards/board_notice`
5. `/boards/board_general`
6. `/posts/board_post_board_general_employee_employee`
7. `/documents`
8. `/admin/policies`
9. `/admin/audit-logs`
10. `apps/web/app/_components/real-usage-panels.tsx`
11. `apps/api/test/auth-org.spec.ts`
12. `apps/api/test/phase32-regression-repro.spec.ts`
13. `apps/web/admin-preview-guard.test.ts`

## 8. 다음 작업자에게 넘길 핵심 문장

- 이번 Phase 41은 `/uat` 리허설 설명 다음 단계로, 게시판·공지·문서·결재를 실제 일상 협업 기본 업무 언어로 닫는 단계다.
- 이미 있는 강한 근거는 게시글/댓글/읽음 확인 생성과 forged 차단, 문서 metadata/read receipt/private space 차단, 전자결재 기안/승인 preview 와 self-approval/replay 차단, 홈 shortcut 와 운영 route 분리다.
- 이번 구현 범위는 새 외부 연동이 아니라 직원 협업 흐름, 승인자 흐름, 운영 정책 경계, 감사 언어를 같은 말로 맞추는 것이다.
- rich editor, 외부 공유, 법적 서명, 실제 운영 발송, production 실데이터는 계속 범위 밖이며 승인 게이트다.
