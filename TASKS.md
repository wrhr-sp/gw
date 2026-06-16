# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 41 문서화 — 게시판·공지·문서·결재 일상업무 도입완성

현재 체인:

1. Phase 41 테스트 재검증 완료: `t_7d912597` — 해봄(`gwtester`) — 완료
2. Phase 41 문서화: `t_1650f8bf` — 다온(`gwdocs`) — 진행 중
3. Phase 41 GitHub PR/CI/merge/branch cleanup: `t_9f4f5569` — 지킴(`gwops`) — 부모 대기
4. Phase 41 최종 통합 보고: `t_43dc2782` — 싱드(`singde`) — 부모 대기

현재 메모:

1. 직전 Phase 40에서 `/uat` 실행 패키지, 역할별 UAT 레인, blocker/major/minor/copy-doc/approval-needed 분류, 교육자료 초안, final report 형식이 먼저 정리됐다.
2. 이번 카드의 목적은 그 위에서 `/dashboard` 기준 오늘 할 협업 업무, `/approvals` 승인 대기, `/boards` 공지/일반 게시판, `/posts/[postId]` 댓글/읽음/forged 차단, `/documents` 문서 metadata/space 권한 경계, `/admin/policies`·`/admin/audit-logs` 운영 검토를 한 세트의 일상업무 도입 언어로 묶는 것이다.
3. 2026-06-16 parent 재검증(`t_7d912597`) 기준 focused web/API/shared 회귀, web/api/shared typecheck, `pnpm check`, Next build, OpenNext Cloudflare build, local admin-host preview smoke 가 모두 다시 통과했고 현재 범위 재현 blocker 는 없었다.
4. 구현 근거는 `apps/web/app/approvals/page.tsx`, `apps/web/app/boards/page.tsx`, `apps/web/app/boards/[boardId]/page.tsx`, `apps/web/app/posts/[postId]/page.tsx`, `apps/web/app/documents/page.tsx`, `apps/web/app/_components/real-usage-panels.tsx`, `apps/api/test/auth-org.spec.ts`, `apps/api/test/phase32-regression-repro.spec.ts`, `apps/web/admin-preview-guard.test.ts`, `apps/web/phase38-offline-admin.test.tsx` 에 걸쳐 있다.
5. parent 최종 통합 보고 기준 live URL 은 `https://gw-web.wereheresp.workers.dev` 이고, 테스트 계정 `admin / 1234` 는 dev/test/UAT 전용 계정이다.

현재 문서 기준 핵심 범위:

- 일반 직원 협업 레인(`/dashboard` → `/approvals` → `/boards` → `/documents` → `/me`)을 일상업무 기본 시작점으로 다시 고정한다.
- 공지 게시판과 일반 게시판 책임을 분리하고, 게시글 상세에서 댓글/읽음/forged 차단을 실제 도입 질문으로 다시 고정한다.
- 문서함에서 public/private/missing space 차단, metadata-only, read receipt 경계를 같은 언어로 다시 고정한다.
- 전자결재에서 기안자 lane, 승인자 lane, 운영 정책 lane 을 분리하고 self-approval 금지, replay 차단, permission 차단을 핵심 guardrail 로 다시 고정한다.
- `/boards`·`/documents` 일반 협업 흐름과 `/admin/policies`·`/admin/audit-logs` 운영 검토 흐름을 섞지 않는다.
- production 데이터, secret, DNS/custom domain, 유료 리소스, 외부 연동, 실제 급여 지급, migration, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 확인 가능한 영역
- `/dashboard` shortcut 기준 `/approvals` → `/boards` → `/documents` 협업 흐름
- `/boards`, `/boards/board_notice`, `/boards/board_general`, `/posts/[postId]` 기준 게시글/댓글/읽음/forged 차단 흐름
- `/documents` 기준 metadata preview 생성, 문서 읽음 확인, private/missing space 차단 흐름
- `/approvals` 기준 기안 preview, 승인 preview, self-approval/replay/permission 차단 흐름
- `/admin/policies`, `/admin/audit-logs` 기준 협업 정책/감사 read-only 운영 검토 흐름

### gap 이 큰 영역
- 게시판·문서·결재가 각각은 보이지만 "직원이 매일 쓰는 협업 묶음"으로 한 번에 읽히는 문장이 아직 약함
- 공지 운영 책임과 일반 게시판 협업 책임이 화면/문서에서 더 분명하게 분리될 필요가 있음
- 문서 보관/열람 권한과 외부 공유 미지원 상태를 같은 말로 오해할 위험이 남아 있음
- 결재의 기안자 lane, 승인자 lane, 운영 정책 lane 이 후속 구현/리뷰/테스트에서도 같은 문장으로 유지돼야 함

## 다음 우선순위

Phase 41의 다음 우선순위는
외부 연동이나 실데이터 확대보다
협업 기본 기능 4묶음(게시판·공지 / 문서함 / 전자결재 / 홈 shortcut)을
내부 도입 가능한 daily routine 언어로 닫는 것이다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/dashboard`
- `/approvals`
- `/boards`
- `/boards/board_notice`
- `/boards/board_general`
- `/posts/board_post_board_general_employee_employee`
- `/documents`
- `/admin/policies`
- `/admin/audit-logs`
- `apps/web/app/_components/real-usage-panels.tsx`
- `apps/api/test/auth-org.spec.ts`

다음 패스에서 바로 줄여야 할 잔여:
- 홈 shortcut 과 실제 협업 route 설명을 같은 우선순위로 맞추기
- 공지 운영 책임과 일반 게시판 협업 책임을 더 분명히 나누기
- 문서 metadata/read receipt/private space 차단을 사용자 문구와 운영 문구에서 같은 뜻으로 맞추기
- 결재 기안/승인 lane 과 운영 정책 lane 을 문서·리뷰·테스트에서 같은 기준으로 유지하기

우선 참고 문서:
- `docs/architecture/phase-41-boards-notices-documents-approvals-daily-operations-adoption-fit-gap-scope.md`
- `docs/guides/phase-41-boards-notices-documents-approvals-daily-operations-adoption-fit-gap-handoff.md`
- `docs/architecture/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-scope.md`
- `docs/guides/phase-40-internal-adoption-rehearsal-admin-employee-uat-package-fit-gap-handoff.md`
- `docs/guides/phase-33-attendance-leave-approvals-real-usage-handoff.md`
- `docs/architecture/phase-32-boards-notices-comments-documents-real-usage-scope.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- Phase 41 GitHub PR/CI/merge/branch cleanup: `t_9f4f5569` — 지킴(`gwops`) — parent-gated
- Phase 41 최종 통합 보고: `t_43dc2782` — 싱드(`singde`) — parent-gated

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
