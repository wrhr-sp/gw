# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 32 문서 정합성·릴리즈 정리 — 게시판·공지·댓글·문서함 실사용화

현재 체인:

1. blocked 정리/재검증: `t_ff305819` — 싱드(`singde`) — 완료
2. 문서 정합성 반영: `t_d43e9ca5` — 다온(`gwdocs`) — 진행 중
3. GitHub/CI/merge/branch cleanup: `t_854aaa6c` — 지킴(`gwops`) — 문서 완료 대기
4. 최종 통합 보고: `t_4faa7030` — 싱드(`singde`) — GitHub/배포 근거 대기

현재 메모:

5. `t_c10fc6ce`와 `t_ff305819`에서 게시글·댓글 append, company-scoped collab upsert, stale blocker 정리가 이미 검증됐다.
6. 이번 카드의 목적은 그 결과를 기준 문서와 루트 문서에 같은 언어로 반영하는 것이다.
7. 다음 실행자는 `t_854aaa6c`에서 PR/CI/merge/배포 근거를 닫고, `t_4faa7030`에서 사용자 보고용 통합 결과를 마무리한다.

현재 문서 기준 핵심 범위:

- `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 를 "설명용 skeleton"이 아니라 대장이 직접 눌러보는 협업 묶음 UAT 흐름으로 유지·정리한다.
- 게시글 작성 → 상세 → 댓글 → 읽음 확인, 공지 읽기/운영 작성 권한 분리, 문서공간 목록 → 파일 metadata → 권한 차단을 같은 언어로 정리한다.
- `/boards/board_general` 에서 게시글 preview 생성, `/posts/[postId]` 에서 댓글 preview 생성/읽음 확인 등록/forged 차단 확인, `/documents` 에서 metadata preview 생성/private·missing space 차단 확인을 직접 눌러볼 수 있게 설명한다.
- 일반 협업 화면과 운영 정책 화면(`/admin/policies`)을 분리하고, notice-only·private space·forged post/read receipt 차단을 route/API/test에서 같은 뜻으로 유지한다.
- 파일 원본 저장소는 raw storage 정보를 숨긴 채 metadata 중심으로 먼저 실사용화하고, 외부 공유/실운영 업로드 확대/secret 입력은 계속 승인 게이트로 남긴다.
- production 데이터, 외부 파일 공유, secret, DNS/custom domain, 유료 리소스, migration, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 사용 가능에 가까운 영역
- `/boards` 의 게시판 목록/최신 글 live panel
- `/boards/board_notice`, `/boards/board_general` route 진입
- `/posts/[postId]` 의 댓글/읽음 확인 API 연결 설명
- `/documents` 의 문서공간/파일 metadata live panel
- `apps/api/test/auth-org.spec.ts` 기반 게시판·댓글·읽음 확인·문서 metadata 권한 근거

### skeleton 잔여가 큰 영역
- `/boards/[boardId]` 의 실제 글 목록/작성 결과 반영 UX
- `/posts/[postId]` 의 실제 본문/댓글 스레드/읽음 상태 요약 UX
- `/documents` 의 문서 상세/버전/후속 action 체감
- 관리자 공지 작성/게시판 운영 저장 흐름의 UAT 정리
- 외부 공유/실운영 업로드 확대 전까지 남는 storage/provider gate

## 다음 우선순위

Phase 31 입구 정리 다음 구현 우선순위는
Phase 30 전체 고도화보다
Phase 32 게시판·공지·댓글·문서함 실사용화다.

핵심 이유:
- 로그인/홈 입구는 Phase 31에서 먼저 정리됐지만, 협업 묶음(`/boards`, `/documents`)은 아직 placeholder 설명 비중이 높다.
- 게시판·공지·댓글·문서함은 일반 직원과 관리자 모두 체감이 큰 영역이라, 이 흐름이 닫혀야 다음 공통 업무/알림/감사 고도화도 쉬워진다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/boards`
- `/boards/board_notice`
- `/boards/board_general`
- `/posts/board_post_board_general_employee_employee`
- `/documents`
- `/admin/policies`

다음 패스에서 바로 줄여야 할 잔여:
- `/boards` 목록 카드에서 공지형/일반형 구분과 다음 액션 정리
- `/boards/[boardId]` 와 `/posts/[postId]` 의 상세/댓글/읽음 확인 stepper 보강
- `/documents` 의 space → file metadata → 후속 action → 권한 차단 흐름 정리
- live smoke/배포 검증 근거 문구 재정리

우선 참고 문서:
- `docs/architecture/phase-32-boards-notices-comments-documents-real-usage-scope.md`
- `docs/guides/phase-32-boards-notices-comments-documents-real-usage-handoff.md`
- `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`
- `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- 문서 정합성: `t_d43e9ca5` — 다온(`gwdocs`)
- GitHub/CI/merge/branch cleanup: `t_854aaa6c` — 지킴(`gwops`)
- 최종 통합 보고: `t_4faa7030` — 싱드(`singde`)

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```