# HANDOFF

## 다음 세션/다음 봇이 먼저 볼 것

1. `AGENTS.md` — 실행 규칙과 금지사항
2. `VISION.md` — 제품 방향
3. `ROADMAP.md` — Phase 순서
4. `TASKS.md` — 현재 Kanban 체인
5. `KNOWN_ISSUES.md` — 남은 리스크
6. `RUNBOOK.md` — 운영/장애 대응
7. `DEPLOYMENT.md` — 배포 확인 기준

## 현재 오케스트레이션 상태

- Board: `groupware`
- Repo: `/home/wrhrgw/gw`
- Bot home: `/home/wrhrgw/gw-dev-bot`
- Orchestrator: 싱드(`singde`)
- 역할봇: 도담(`gwplanner`), 이룸(`gwbuilder`), 바름(`gwreviewer`), 해봄(`gwtester`), 다온(`gwdocs`), 지킴(`gwops`)

현재 활성 흐름은 Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안이다. 게시판/공지/문서함/R2 skeleton과 전체 smoke 기준을 다시 묶어, 대장이 preview/live URL에서 핵심 화면·협업 흐름·제한·승인 게이트를 한 번에 검토할 수 있게 만드는 것이 이번 체인의 핵심이다.

현재 기획 상태 요약:

- 이번 Phase의 목적은 게시판/공지/문서함/첨부 metadata 흐름을 전체 제품 검토 기준 안에서 다시 정리해 "사내 검토용 초안"으로 설명 가능한 상태를 만드는 것이다.
- `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 는 협업/문서 보강 route로 보고, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees`, `/org` 와 자연스럽게 이어지게 본다.
- `/admin/policies`, `/admin/users`, `/admin/audit-logs` 는 문서/게시판 운영 정책·권한·감사 추적을 설명하되 일반 업무/협업 화면과 경계를 흐리지 않아야 한다.
- R2 관련 범위는 private-by-default, D1 metadata 우선, binding-aware/dev-safe skeleton 기준까지만 다루고 실제 운영 업로드/public URL 오픈은 하지 않는다.
- 핵심 smoke 기준은 핵심 업무 route + 협업 route + 관리자 route를 함께 보는 것이다.
- live fetch가 환경 gate에 막힐 수 있으므로 `build:cf`, local `preview:cf` smoke, deployment metadata 같은 대체 근거를 같이 남긴다.
- restricted 항목(secret, production data, DNS/custom domain, 유료 리소스, 외부 연동, migration, destructive 작업)은 이번 체인에서도 자동 진행하지 않는다.
- 우선 참고 문서: `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md`, `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md`, `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`, `docs/architecture/phase-5-boards-documents-scope.md`, `docs/architecture/phase-8-r2-storage-scope.md`.

2026-06-12 Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안 메모:

- 기준 흐름은 `/` → `/login` → `/dashboard` → `/attendance`/`/leave`/`/approvals`/`/employees`/`/org` 에서 협업 route(`/boards`, `/documents`)와 관리자 route(`/admin/*`)가 이어지는 구조로 본다.
- `/dashboard` 상단 액션은 `/attendance` → `/approvals` → `/boards` → `/documents` → `/employees` 순서로 읽히고, `/boards` 와 `/documents` 는 아래 읽기 섹션에서도 placeholder honesty 를 보강하는 구조로 유지한다.
- `/boards`, `/boards/[boardId]`, `/posts/[postId]` 는 notice-only와 일반 게시판 책임 분리, 읽기/작성/댓글 흐름, placeholder honesty를 같이 봐야 한다.
- `/documents` 는 문서 공간/첨부 metadata 중심으로 보고, 실제 운영 파일 업로드/다운로드 완료처럼 보이지 않게 해야 한다.
- R2/첨부 흐름은 raw storage key, bucket 이름, public URL 비노출을 계속 유지한다.
- private 문서공간, forged 접근, notice-only 글쓰기 제한 같은 guardrail을 계속 핵심 검증 대상으로 본다.
- `/admin/policies` 는 게시판/문서 운영 정책과 일반 협업 흐름이 같은 방향을 가리켜야 한다.
- `/admin/audit-logs` 는 raw 민감정보 없이 read-only 운영 추적 톤을 유지해야 한다.
- 대장이 확인할 때는 "무엇이 되나" 뿐 아니라 "왜 아직 여기서 멈추는가"와 "어떤 승인 게이트가 남았는가"까지 함께 보여 줘야 한다.

대장이 preview/live URL 에서 바로 눌러 볼 쉬운 확인 순서:
1. `/` 와 `/login` 에서 일반 업무와 협업/운영 검토 입구 설명이 유지되는지 본다.
2. `/dashboard` 에서 근태/휴가/결재와 함께 공지·문서 진입점이 자연스럽게 이어지는지 본다.
3. `/boards` 와 `/boards/board_notice`, `/boards/board_general` 에서 notice-only 공지와 일반 게시판 책임 차이가 먼저 읽히는지 본다.
4. `/posts/board_post_board_general_employee_employee` 같은 예시 상세에서 bodyPreview 중심 본문, 댓글, 읽음 확인 흐름이 과장 없이 이어지는지 본다.
5. `/documents` 에서 전사 문서함/인사 전용 문서함 경계와 첨부 metadata 흐름이 보이되 실운영 업로드 완료처럼 보이지 않는지 본다.
6. `/admin/policies`, `/admin/users`, `/admin/audit-logs` 를 비교해 문서/게시판 운영 설명, 권한 경계, 감사 추적이 일반 업무 화면과 충돌하지 않는지 본다.
7. live fetch가 막히면 어떤 route를 직접 확인하지 못했고 어떤 대체 근거(build:cf, preview smoke, deployment metadata, same-origin `/api/boards*`·`/api/documents*` 확인)를 썼는지 같이 본다.

제한적 재귀적 자기개선 루프가 적용된다.

- 현재 카드 범위 안에서만 반복 실수 방지, 테스트 실패 원인 기록, 체크리스트 보강, handoff 품질 개선을 한다.
- 자기개선 문서 갱신은 `AGENTS.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`로 제한한다.
- 다른 보드/repo/domain/mainbot, 운영 DB, 실데이터, secret, DNS, 유료 리소스, 배포/릴리즈/PR merge, 서비스 재시작, 카드 범위 밖 리팩토링은 자기개선 명목으로 자동 수행하지 않는다.
- 필요하면 “사용자 승인 필요”로 분리해 보고한다.

## 인수인계 원칙

- Kanban DB는 직접 쓰지 않는다.
- active/running/blocked를 먼저 확인한다.
- 승인된 범위 안의 검증 실패는 자동 재수정 루프로 처리하되, 같은 카드/같은 실패군에서 반려·검증 실패·자동 재수정이 3회 이상 반복되면 싱드가 직접 개입해 원인과 중복 worker 여부를 확인한 뒤 기준 복구 카드 1개로 다시 넘긴다.
- restricted 항목은 반드시 사용자 승인으로 분리한다.
- 역할별 기본 책임은 고정한다. `gwplanner`는 범위/승인 게이트, `gwbuilder`는 구현, `gwreviewer`는 리뷰, `gwtester`는 검증, `gwdocs`는 문서·보고 양식, `gwops`는 PR/CI/release cleanup 이다.
- `PR merge`, `release gate`, `branch cleanup`, `review-required 정리`, `stale blocker 정리`, `검증 재실행`은 상시 권한이 아니라 카드 범위에 적힌 경우만 예외로 본다.
- 최종 사용자 보고는 싱드가 쉬운 한국어로 통합한다. 배포가 포함된 작업은 live URL과 사용자가 직접 보면 되는 화면/경로/확인 포인트를 함께 남긴다.
- 사용자-facing 보고는 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 분리해 적는다.
- blocked는 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요로 분류해 남긴다.
- 카드 댓글 작성만으로 사용자 보고 완료라고 보지 않는다. 실제 Telegram/대화 직접 보고 여부를 따로 확인한다.
- 같은 카드·같은 이유·같은 근거의 중복 보고는 금지하고, 상태 변화가 있을 때만 다시 보고한다.

## 다음 작업자가 바로 쓰는 빠른 판단표

### 역할별 기본 판단표
- `gwplanner`: 새 범위 정의, 후속 카드 분리, 승인 게이트 명시
- `gwbuilder`: 코드/스크립트 수정, 테스트 가능한 최소 증거 남김
- `gwreviewer`: 경계/보안/문서 일치 여부 검토, review-required 판단
- `gwtester`: fixture, dry-run, service/journal, board stats, blocked list, dispatch dry-run 확인
- `gwdocs`: 쉬운 한국어 문서, blocked 분류 문구, 보고 템플릿, handoff 정리
- `gwops`: PR/CI/merge/release gate/branch cleanup 안전성 검토

### blocked 분류와 다음 액션
- 방치: 허용 상태가 아니다. 다음 처리 주체가 비어 있으면 싱드가 재분류한다.
- 자동복구중: 표준 검증 재실행, recovery loop, release cleanup 재확인이 실제로 돌고 있는 상태다.
- 승인필요: restricted 항목, 외부 권한, 비용, 비밀값, 제품/운영 결정이 필요한 상태다.
- 싱드 직접정리: 같은 실패 3회 이상 반복, 중복 worker, `already-handled` 반복처럼 오케스트레이터가 직접 원인 분류해야 하는 상태다.
- 자동화 보완필요: 이번 건은 정리했지만 watcher/템플릿/검증 규칙 보강이 필요한 상태다.

### 검증자동화 최소 체크
1. fixture 또는 실제 카드 샘플로 분기(release cleanup / stale / review-required / already-handled)를 확인한다.
2. dry-run 결과만 보지 말고 service/process/journal 근거를 함께 남긴다.
3. board stats, blocked list, dispatch dry-run 으로 현재 보드 상태를 같이 적는다.
4. merge/release cleanup 범위가 섞이면 PR head, merge 상태, main release-gate, remote branch 부재, diff/patch-id 동등성까지 따로 확인한다.
5. 결과 문구는 `자동화가 한 일 / 싱드가 직접 개입한 일 / 자동화가 못 끝낸 이유 / 보완한 자동화` 4축으로 남긴다.
