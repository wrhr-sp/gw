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

현재 활성 흐름은 이전 scheduled 복구 카드 정리 단계다. 과거 web build flaky / review-required recovery loop / 자동 재수정 과정에서 남은 scheduled 카드들을 최신 `main` 기준으로 다시 분류해, 이미 끝난 카드와 아직 남겨야 할 카드를 안전하게 구분하는 것이 이번 체인의 핵심이다.

현재 기획 상태 요약:

- 카드 정리의 목적은 많이 닫는 것이 아니라, 최신 `main` 기준으로 무엇이 아직 진짜 일인지 다시 보이게 만드는 것이다.
- 이미 merge/main 반영/검증 완료로 목적이 흡수된 카드는 stale 또는 superseded 후보로 본다.
- 아직 미완료 목적이 남아 있으면 기준 카드 1장만 남기고 중복 카드는 정리한다.
- restricted 항목(secret, production, DNS/custom domain, 유료 리소스, destructive cleanup)은 자동 정리하지 않는다.
- Kanban DB 직접 수정이나 근거 없는 대량 archive/삭제는 하지 않는다.
- 자동화 보강 완료 이력과 현재 활성 체인을 섞지 않도록, 완료 이력은 `KNOWN_ISSUES.md` 에 남기고 현재 정리 대상만 이번 체인에 둔다.
- 우선 참고 문서: `docs/architecture/scheduled-recovery-card-cleanup-scope.md`, `docs/guides/scheduled-recovery-card-cleanup-handoff.md`, `docs/guides/automation-hardening-review-gate-handoff.md`, `docs/workflow/groupware-kanban-automation.md`, `scripts/README.md`.

2026-06-12 scheduled 복구 카드 정리 메모:

- review-required gate, safe triage 실패 재시도/backoff, recovery loop 생성, systemd watcher PATH 보강은 이미 완료 이력으로 남아 있다.
- 최근 관리자 PWA 품질 개선 체인은 PR/CI/merge/release-gate 근거가 있어 과거 복구 카드 일부를 흡수했을 가능성이 높다.
- 따라서 구현 단계에서는 먼저 예전 scheduled 카드 목록을 만들고, 각 카드를 더 최신 완료 카드·부모/자식 체인·PR/CI 근거와 대조해야 한다.
- 카드 분류는 최소한 `해결됨`, `유지`, `승인 필요`, `판단 유보` 4가지로 나누는 것이 안전하다.
- 같은 실패군에서 카드가 여러 장 남아 있으면 기준 카드 1장만 남기고 나머지는 stale/superseded 근거를 남기는 방향을 우선한다.
- 다음 구현자는 카드별 근거 표를 먼저 만들고, 그 뒤 실제 상태 정리와 문서 반영 순서로 움직이는 편이 안전하다.
- 2026-06-12 구현 결과 보고서는 `docs/guides/scheduled-recovery-card-cleanup-report-2026-06-12.md` 에 정리했다.
- 이번 정리표 기준으로는 유지해야 할 scheduled 카드는 없고, 예전 web build/attendance recovery loop 관련 scheduled 카드 14장은 모두 stale 또는 superseded 후보다.
- 핵심 근거 완료 카드는 `t_7f611516`, `t_d8354e91`, `t_f4ef8061`, `t_dc4f7a4c` 이다.
- 최신 부모 검증 기준으로 `/home/wrhrgw/gw` 에서 `pnpm check`, `pnpm --filter @gw/web build:cf`, local `pnpm --filter @gw/web preview:cf` smoke 까지 통과했다.
- preview smoke 핵심 결과는 `/`, `/login`, `/boards`, `/documents`, `/manifest.webmanifest` 200, `/admin*` 로그인 유도 307, `/api/health` 200 JSON, `/api/me` 401 JSON 이다.
- 즉, 문서 기준 재분류는 끝났고 board 상태 정리는 singde 가 카드별 근거 코멘트를 남기며 마무리하면 된다.

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
