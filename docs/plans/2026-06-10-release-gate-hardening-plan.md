# Release gate hardening Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: PR/CI/merge 자동화가 흔들리는 원인을 범위별로 분리하고, 최소 필수 CI와 release gate 완료 기준을 안정적으로 고정한다.

Architecture: 이번 작업은 기능 추가보다 gate 정리 작업이다. 먼저 변경 묶음을 PR 단위로 분리하고, 그 위에 GitHub Actions 기본 검증을 올린 뒤, 마지막에 Cloudflare/OpenNext `build:cf` blocker 를 별도 작은 수정으로 닫는다. 생성 산출물(`.next`, `.open-next`, `.wrangler`, `.hermes/*.state`)은 gate 판단 대상에서 빼고 소스/문서/스크립트만 본다.

Tech Stack: pnpm workspace, Next.js App Router, OpenNext Cloudflare, GitHub Actions, shell scripts

---

## 0. 현재 작업트리 분류 기준

이 카드는 planner 런이라 실제 `git status`/`git diff` 실행 결과를 붙이지는 못했다. 대신 현재 저장소에서 확인되는 파일과 기존 handoff 기준으로, 구현자는 아래 분류로 먼저 `git status --short`, `git diff --name-only`, `git ls-files --others --exclude-standard`를 나눠 적어야 한다.

### A. Phase 7 same-origin / admin guard 묶음
- `apps/web/app/api/health/route.ts`
- `apps/web/app/api/me/route.ts`
- `apps/web/same-origin-api-bridge.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`

### B. release automation / PR flow 묶음
- `scripts/gw-pr-flow.sh`
- `scripts/gw-ci-status.sh`
- `scripts/gw-cloudflare-web-preview-check.sh`
- `scripts/gw-cloudflare-readiness.sh`
- 새 workflow 파일: `.github/workflows/release-gate.yml` 또는 동등 파일
- 필요 시 `scripts/README.md`
- 필요 시 `docs/workflow/operation-rules.md`
- 필요 시 `docs/workflow/development-pipeline.md`

### C. watcher / report 정책 묶음
- `scripts/gw-blocked-report-watch.sh`
- `scripts/gw-review-required-gate-watch.sh`
- `scripts/gw-report-action-watch.sh`
- `scripts/gw-hourly-status-report.py`
- `scripts/gw-preventive-handoff-watch.sh`
- `scripts/gw-superseded-chain-cleanup-watch.sh`
- 대응 설명 문서 (`scripts/README.md`, 운영 가이드)

### D. 문서 / 비전 / UX 묶음
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- 기타 scope/guide 문서

### E. release gate 판단에서 제외할 생성물/로컬 상태
- `.next/`
- `.open-next/`
- `.wrangler/`
- `.hermes/*.state`
- `*.tsbuildinfo`

이 제외 목록은 `.gitignore`에도 이미 들어 있다. PR에는 절대 섞지 않는다.

## 1. 권장 PR 분리안

### PR 1: release gate baseline
목적: PR/CI/merge 흐름 자체를 안정화한다.

포함:
- GitHub Actions 기본 workflow 추가
- `scripts/gw-pr-flow.sh` hardening
- `scripts/gw-ci-status.sh` 또는 README/운영 문서의 기준 보강
- dirty worktree, latest-head CI, secret scan, squash-safe cleanup 규칙 반영

제외:
- Phase 7 기능 코드 수정
- admin route 동작 변경
- watcher/report 정책 변경
- 비전/UX 문서 대량 수정

완료 기준:
- CI 없는 저장소 상태를 끝내고, 최소 1개 required workflow가 생긴다.
- PR 생성 전 local preflight와 merge 전 latest-head CI 확인 기준이 문서/스크립트에 둘 다 남는다.

### PR 2: Cloudflare/OpenNext build:cf blocker fix
목적: 현재 release gate blocker 를 작게 재현하고 닫는다.

포함:
- `pnpm --filter @gw/web build:cf` 실패 재현
- `.next/types/app/admin/audit-logs/page.ts not found` 또는 같은 계열 OpenNext/Next artifact mismatch 원인 최소 수정
- 필요한 최소 회귀 테스트/검증 메모

제외:
- PR flow 스크립트 대수술
- watcher/report 스크립트 변경
- 비전/UX 문서 정리

완료 기준:
- 깨끗한 생성물 기준에서 `build:cf`가 통과하거나, 재현 조건과 원인이 CI/문서에 고정된다.
- admin preview guard (`/admin* -> /login`) 회귀가 같이 깨지지 않는다.

### PR 3: watcher/report policy follow-up (조건부)
목적: report/watch 계열을 건드렸을 때만 별도 검토한다.

포함:
- `gw-hourly-status-report.py` 등 남은 감시/보고 스크립트
- 중복 보고/누락 방지 기준
- blocked/review-required/승인 필요 카드 handoff 규칙

제외:
- web/app 기능 코드
- build:cf 수정

완료 기준:
- 자동 보고가 새 release gate 규칙 때문에 막히지 않는다.
- 일반 worker 카드에는 Telegram 구독을 걸지 않는 원칙과 충돌하지 않는다.

참고: 문서/비전/UX 정리는 별도 docs-only PR로 빼는 것이 안전하다. release gate PR에 섞지 않는다.

## 2. GitHub Actions 최소 필수 CI 기준

### 즉시 required 로 둘 baseline job
1. checkout
2. pnpm setup / cache
3. `pnpm install --frozen-lockfile`
4. `pnpm check`
5. `pnpm --filter @gw/web build`

이 baseline job은 merge required 로 둔다. 이유:
- 루트 `package.json` 기준 필수 검증이 이미 `pnpm check`로 정의돼 있다.
- same-origin/admin guard와 별개로 최소 TypeScript/Vitest 회귀를 잡을 수 있다.
- `@gw/web` 일반 build는 현재 문서상 통과 경험이 있다.

### 분리해서 둘 Cloudflare/OpenNext job
권장 job 이름: `cloudflare-build`

초기 단계 기준:
- `pnpm install --frozen-lockfile`
- `pnpm --filter @gw/web build:cf`

운영 원칙:
- blocker 가 살아 있는 동안에는 required 로 올리지 말고, 별도 visibility를 주는 independent job으로 둔다.
- blocker 수정 PR에서 이 job을 녹색으로 만든 뒤, 다음 merge부터 required 승격 여부를 정한다.
- `preview:cf`는 장시간/포트 의존성이 있어 기본 required CI에 넣지 않는다. 로컬 또는 수동 smoke 증빙용으로 둔다.

### 지금 CI에 넣지 말 것
- 실제 Cloudflare deploy
- wrangler production deploy/rollback
- 실제 secret 주입
- DNS/custom domain 작업
- production DB/R2/유료 리소스 작업

## 3. release gate 완료 기준

release gate hardening 자체는 아래 7개가 모두 맞아야 끝난다.

1. 생성물/로컬 상태 파일이 PR 판단에서 제외된다.
2. `gw-pr-flow.sh`가 dirty worktree를 먼저 막는다.
3. merge 전 latest-head CI 확인 규칙이 있다.
4. CI가 없던 저장소에 baseline required workflow가 생긴다.
5. secret scan 또는 최소한 secret/placeholder/no-secrets 규칙이 PR flow에 명시된다.
6. squash merge 뒤 local branch cleanup을 안전하게 처리하는 기준이 있다.
7. `build:cf` blocker 가 "필수 blocker" 로 기록돼, 해결 전 preview 재검증 완료처럼 보고하지 않는다.

## 4. 현재 blocker 메모

문서상 기존 blocker 는 `/admin/users` page artifact 누락으로 기록돼 있었고, 이번 카드 본문/자식 카드에는 `.next/types/app/admin/audit-logs/page.ts not found`가 새 blocker 로 적혀 있다. 현재 저장소에는 다음 사실이 동시에 보인다.

- `apps/web/app/admin/audit-logs/page.tsx` 소스 파일이 존재한다.
- `apps/web/.next/types/app/admin/audit-logs/page.ts` 흔적도 현재 워크트리에는 존재한다.
- 따라서 문제는 "파일이 원래 없다"보다 "clean build/OpenNext artifact generation 타이밍 또는 stale artifact mismatch" 가능성이 높다.

구현자는 반드시 깨끗한 생성물 상태에서 blocker 를 다시 재현하고, handoff 에 아래를 분리해서 적어야 한다.
- 재현 명령
- 실패 로그 핵심 1~3줄
- stale artifact 여부
- 최소 수정 위치
- 수정 후 재검증 결과

## 5. 구현 순서

### Task 1: 작업트리 실제 분류표 작성
Objective: 현재 변경 파일을 PR 묶음별로 나눈다.

Files:
- Modify: handoff comment 또는 작업 메모

Step 1: `git status --short`, `git diff --name-only`, `git ls-files --others --exclude-standard` 결과를 수집한다.
Step 2: 위 0번 분류 기준으로 A/B/C/D/E 라벨을 붙인다.
Step 3: 생성물(E)은 정리 또는 무시 대상으로 분리한다.
Step 4: PR 1/2/3 후보 파일 목록을 확정한다.

### Task 2: baseline GitHub Actions workflow 추가
Objective: merge required 로 둘 최소 CI를 만든다.

Files:
- Create: `.github/workflows/release-gate.yml`
- Modify: 필요 시 `README.md` 또는 `scripts/README.md`

Step 1: checkout + pnpm install + `pnpm check` + `pnpm --filter @gw/web build` job을 작성한다.
Step 2: path/branch 정책이 필요하면 과하지 않게 최소화한다.
Step 3: `build:cf`는 별도 job으로 분리하고 required 승격은 보류한다.
Step 4: workflow 설명을 문서에 한 줄 남긴다.

### Task 3: `gw-pr-flow.sh` baseline hardening
Objective: PR 흐름이 dirty worktree와 latest-head 확인을 강제하게 만든다.

Files:
- Modify: `scripts/gw-pr-flow.sh`
- Test/Doc: `scripts/README.md`

Step 1: dirty worktree면 PR/merge 단계로 못 넘어가게 한다.
Step 2: changed files 분류 출력 또는 최소 요약을 추가한다.
Step 3: local substitute checks(`pnpm check`, `pnpm --filter @gw/web build`)를 명시한다.
Step 4: CI 부재/실패/성공 상태별 메시지를 분리한다.
Step 5: squash merge 뒤 patch-equivalence 확인 후 local branch cleanup 하도록 정리한다.

### Task 4: `build:cf` blocker 재현 테스트 작성/기록
Objective: 현재 blocker 를 stale artifact와 분리해 재현한다.

Files:
- Modify: 필요한 web/open-next 관련 소스 또는 설정
- Test: 필요 시 web 회귀 테스트
- Doc: handoff comment

Step 1: `.next`, `.open-next` 정리 후 실패를 재현한다.
Step 2: `/admin/users` 계열인지 `/admin/audit-logs` 계열인지 실제 최신 로그 기준으로 확정한다.
Step 3: 최소 수정만 적용한다.
Step 4: `pnpm --filter @gw/web build:cf` 재검증 결과를 남긴다.

### Task 5: watcher/report 영향 범위 분리
Objective: 감시/보고 스크립트가 섞였는지 확인하고 별도 PR로 떼어낸다.

Files:
- Modify: 해당될 때만 `scripts/gw-*watch*.sh`, `scripts/README.md`, 운영 문서

Step 1: 이번 branch에 watch/report 스크립트 변경이 실제 있는지 확인한다.
Step 2: 있으면 기능/CI PR과 분리해 별도 PR 3로 뺀다.
Step 3: blocked/review-required 카드 자동 보고가 깨지지 않는지 확인 기준을 문서화한다.

## 6. 검증 명령 기준

필수:
- `pnpm install --frozen-lockfile`
- `pnpm check`
- `pnpm --filter @gw/web build`

blocker 추적:
- `pnpm --filter @gw/web build:cf`

조건부:
- `pnpm --filter @gw/web test`
- `pnpm --filter @gw/web preview:cf`

GitHub/release flow:
- 최신 head CI 확인
- secret scan 또는 no-secret 확인
- squash-safe local/remote branch cleanup 확인

## 7. 구현자에게 남기는 한 줄 지시

한 PR에 섞인 변경을 줄이는 것이 이번 카드의 핵심이다. 먼저 baseline CI/PR flow를 독립 PR로 세우고, `build:cf` blocker 는 그 다음 작은 PR로 닫아라. watcher/report나 문서/비전 정리는 절대 같은 PR에 섞지 마라.
