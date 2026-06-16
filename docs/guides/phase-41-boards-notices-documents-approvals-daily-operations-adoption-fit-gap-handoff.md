# Phase 41 게시판·공지·문서·결재 일상업무 도입완성 handoff

## 1. 이번 Phase를 한 줄로 말하면

이번 Phase 41은
리허설용 `/uat` 문서를 넘어,
직원과 승인자가 매일 실제로 쓰는 협업 기본 기능을
"지금 바로 내부 도입 가능한 것 / 아직 placeholder 인 것 / 별도 승인 필요한 것"
세 갈래로 다시 고정하는 단계다.

즉 게시판·공지·댓글·읽음·문서함·전자결재를
각자 따로 설명하지 않고,
`/dashboard` 에서 시작하는 하루 업무 흐름 안으로 다시 묶는 handoff 다.

## 2. 이번 Phase에서 꼭 지켜야 할 제품 문장

- `/dashboard` 는 오늘 할 협업 업무의 시작점이며 `/approvals` → `/boards` → `/documents` 순서가 먼저 읽혀야 한다.
- 공지 게시판과 일반 게시판은 같은 게시판 묶음이지만 책임이 다르다. 공지는 읽기 중심이고 일반 게시판은 글/댓글 협업 entry 다.
- 게시글 상세는 댓글, 읽음 확인, forged 차단을 함께 설명해야 하며 단순 상세 preview 로만 적지 않는다.
- 문서함은 외부 공유 완성형이 아니라 내부 보관/열람/권한 경계를 설명하는 화면이다.
- 전자결재는 기안자 lane, 승인자 lane, 운영 정책 lane 을 서로 다른 역할 문맥으로 적는다.
- `approval.document.approve` 권한 부족, self-approval 금지, replay 차단, unknown id 차단은 단순 에러가 아니라 핵심 guardrail 이다.
- `/boards`·`/documents` 일반 협업 흐름과 `/admin/policies`·`/admin/audit-logs` 운영 검토 흐름을 같은 책임처럼 섞지 않는다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이고 production 기본 계정이 아니다.
- raw storage key, bucket, signed URL, secret, 실민감 원문, 실지급, 외부 연동은 계속 승인 게이트다.

## 3. 역할별 추천 도입 레인

### A. 일반 직원 협업 레인
- `/dashboard`
- `/approvals`
- `/boards`
- `/boards/board_general`
- `/posts/board_post_board_general_employee_employee`
- `/documents`
- `/me`

핵심 질문:
- 오늘 승인 대기, 공지 확인, 협업 글 읽기, 문서 확인이 너무 멀리 흩어지지 않는가
- 일반 직원이 notice-only 운영 책임까지 맡는 것처럼 보이지 않는가
- 문서와 게시판이 같은 협업 묶음으로 읽히되 권한 경계는 유지되는가

### B. 승인자/팀장 레인
- `/dashboard`
- `/approvals`
- 필요 시 `/boards`, `/documents`

핵심 질문:
- 승인자는 승인 대기 문서를 먼저 보고 판단할 수 있는가
- self-approval 금지와 replay 차단이 분명한가
- 일반 게시판/문서 확인이 승인 업무를 방해하지 않고 보조 문맥으로만 이어지는가

### C. 운영자 협업 정책 레인
- `/admin/policies`
- `/admin/audit-logs`
- 필요 시 `/boards/board_notice`, `/documents`

핵심 질문:
- 공지 운영, 문서 공간 정책, 감사 read-only preview 가 일반 직원 협업 흐름과 분리되는가
- `board.manage`, `document.space.manage`, `audit.read` 가 같은 권한처럼 적히지 않는가
- masked preview·metadata-only·권한 차단이 문서와 테스트에서 같은 뜻인가

## 4. 이번 Phase에서 바로 이어받아야 할 구현 포인트

### A. 게시판/공지
- `/boards` 첫 화면이 공지 확인과 일반 협업 entry 를 함께 보여 주되 역할을 섞지 않게 유지한다.
- `/boards/board_notice` 는 운영 공지 작성 문맥, `/boards/board_general` 은 일반 협업 글쓰기 문맥이라는 차이를 더 분명히 유지한다.
- `/posts/[postId]` 는 댓글 생성, 읽음 확인, forged 차단 설명이 한 자리에서 읽혀야 한다.
- 게시판 흐름은 `/dashboard` 와 연결돼 "오늘 읽을 공지/게시글" 문맥으로 이어져야 한다.

### B. 문서함
- `/documents` 는 전사 문서함과 민감 문서함 차이를 쉬운 말로 다시 드러내야 한다.
- file metadata 생성은 가능하지만 외부 공유나 raw storage internals 노출과 같은 뜻으로 보이면 안 된다.
- 읽음 확인은 접근 가능한 파일만 허용된다는 점을 계속 강조한다.
- 게시판/결재와 연결되더라도 문서 권한은 문서함 기준 403 이 먼저라는 점을 유지한다.

### C. 전자결재
- `/approvals` 에서 내 승인함과 내 기안함 순서를 명확히 유지한다.
- 기안 작성 stepper 는 양식/결재선/참조자/합의자/제목·요약 순서가 그대로 읽혀야 한다.
- 승인/반려 action 은 서버 검증 전 placeholder 라는 점을 숨기지 않되,
  현재 승인 preview 와 self-approval/replay 차단 근거는 적극적으로 드러낸다.
- 운영 정책(양식/결재선 관리)은 일반 직원 결재함과 다른 위치/문맥으로 적는다.

### D. 홈/shortcut/운영 분리
- `/dashboard` 추천 순서는 `/approvals` → `/boards` → `/documents` → `/me` 가 기본이다.
- `경영업무` 와 `/admin*` 는 이번 협업 도입완성 레인의 보조 또는 운영 검토 레인이지, 일반 직원 홈의 주 흐름이 아니다.
- 모바일/PC 모두 같은 route 를 보되 탐색 껍데기만 다르다는 원칙을 유지한다.

## 5. 현재 구현 근거 파일

### web 근거
- `apps/web/dashboard-page-content.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/boards/[boardId]/page.tsx`
- `apps/web/app/posts/[postId]/page.tsx`
- `apps/web/app/documents/page.tsx`
- `apps/web/app/_components/real-usage-panels.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/admin-preview-guard.ts`

### API/test 근거
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/phase32-regression-repro.spec.ts`
- `apps/api/src/lib/document-storage.ts`
- `apps/api/src/lib/approval-steps.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/phase38-offline-admin.test.tsx`

## 6. 이번 Phase 구현/리뷰/테스트가 꼭 물어야 할 질문

1. 직원이 `/dashboard` 에서 승인 대기, 새 공지/게시글, 문서 확인으로 자연스럽게 이어지는가
2. notice-only 와 general board 책임 차이가 카드/상세/테스트에서 같은 뜻인가
3. 게시글 상세에서 댓글, 읽음 확인, forged 차단이 모두 실제 도입 질문으로 보이는가
4. 문서함에서 public/private/missing space 차단과 metadata-only 설명이 분명한가
5. 전자결재의 기안자 lane 과 승인자 lane 이 서로 섞이지 않는가
6. self-approval 금지, replay 차단, unknown id 차단이 그대로 유지되는가
7. `/admin/policies` 와 `/admin/audit-logs` 가 일반 협업 화면과 다른 운영 검토 위치로 읽히는가
8. 외부 공유, rich editor, 법적 서명, 실운영 발송, production 실데이터가 아직 승인 게이트임을 숨기지 않는가

## 7. 현재 Kanban 체인

- 테스트 재검증: `t_7d912597` — 완료
- 문서화: `t_1650f8bf` — 현재 카드
- GitHub PR/CI/merge/branch cleanup: `t_9f4f5569` — 부모 대기
- 최종 통합 보고: `t_43dc2782` — release gate 이후 부모 대기

상위 parent 메모:
- Phase 40 최종 통합 보고 `t_12730723` 기준 live URL 은 `https://gw-web.wereheresp.workers.dev` 이다.
- dev/test/UAT 전용 테스트 계정은 `admin / 1234` 다.
- 직전 리허설 단계에서는 `/uat` 패키지와 role별 UAT 시나리오가 먼저 정리돼 있다.

2026-06-16 parent 재검증 메모:
- focused web 회귀 23개 파일 / 97개 테스트 통과
- focused API 회귀 14개 파일 통과, 1개 파일 skip / 97개 테스트 통과, 4개 skip
- shared vitest 2개 파일 / 25개 테스트 통과
- web/api/shared typecheck 통과
- `pnpm --filter @gw/web build`, `pnpm check`, `pnpm --filter @gw/web build:cf` 통과
- local admin-host preview smoke(`PREVIEW_PORT=8793 BASE_URL=http://127.0.0.1:8793 bash scripts/gw-admin-host-preview-smoke.sh`) 통과
- preview smoke 기준 일반 host `/admin` → `/login`, admin host `/` → `/admin` redirect 와 manifest split 경계 재확인

## 8. 완료 판단 기준

다음 조건이 동시에 맞아야 이번 Phase가 정리됐다고 본다.

1. scope 문서와 handoff 문서가 있다.
2. 게시판/공지, 문서함, 전자결재가 각자 따로가 아니라 일상 협업 흐름으로 다시 묶여 있다.
3. 일반 직원/승인자/운영자 역할 문맥이 섞이지 않는다.
4. 현재 가능한 것과 아직 placeholder 인 것, 승인 게이트가 분리돼 있다.
5. 다음 builder/reviewer/tester 가 같은 말로 이어받을 수 있다.

## 9. 아직 남겨 두는 승인 게이트

- 실제 운영 공지 발송 자동화
- 외부 메일/메신저/전자서명 연동
- public URL/signed URL 직접 오픈
- OCR/원문 검색/외부 문서보관
- 법적 효력 있는 전자결재 서명
- production 게시글/댓글/문서/결재 실데이터 이관
- production secret/실데이터/DNS/custom domain/유료 리소스/migration/destructive 작업

이번 handoff 이후 구현/리뷰/테스트는 이 게이트를 넘지 않는 범위에서만 움직여야 한다.
