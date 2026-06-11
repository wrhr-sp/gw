# release gate 운영 가이드

## 한 줄 요약

release gate는 "이 변경을 지금 PR로 올려도 되는지, merge해도 되는지, merge 뒤 브랜치를 지워도 되는지"를 순서대로 확인하는 안전 절차입니다.

## 이 문서가 다루는 범위

이 문서는 현재 저장소에 들어 있는 아래 실제 기준을 설명합니다.

- GitHub Actions workflow: `.github/workflows/release-gate.yml`
- PR 흐름 스크립트: `scripts/gw-pr-flow.sh` → 내부적으로 `scripts/gw_pr_flow.py` 실행
- 공통 운영 원칙: `docs/workflow/operation-rules.md`, `scripts/README.md`

## 1. PR을 왜 나눠야 하나

이번 저장소 기준 release gate의 핵심은 "섞인 변경을 한 번에 합치지 않는 것"입니다.

특히 아래는 PR을 분리하는 편이 안전합니다.

1. CI/PR 흐름 정리
   - 예: `.github/workflows/release-gate.yml`, `scripts/gw-pr-flow.sh`, `scripts/README.md`
2. 앱/빌드 blocker 수정
   - 예: `apps/web/**`, `packages/**`, `build:cf` 관련 수정
3. watcher/보고 자동화 변경
   - 예: `scripts/gw-*watch*.sh`, `gw-telegram-kanban-report-watch.py`, 운영 문서
4. 문서-only 변경
   - 예: `README.md`, `docs/**`

쉽게 말하면:
- CI를 고치는 PR
- 앱 버그를 고치는 PR
- watcher를 고치는 PR
- 문서 PR
를 가능하면 따로 봅니다.

이유는 간단합니다.
- 실패 원인을 빨리 좁힐 수 있습니다.
- 리뷰 범위가 작아집니다.
- `build:cf` 같은 blocker가 있어도 다른 문서/운영 변경까지 같이 막히지 않습니다.
- merge 뒤 "어느 변경 때문에 깨졌는지"를 추적하기 쉽습니다.

## 2. GitHub Actions CI가 실제로 하는 일

현재 `.github/workflows/release-gate.yml`에는 job이 2개 있습니다.

### 2-1. baseline job

이 job은 기본 검증입니다.

순서:
1. 저장소 checkout
2. pnpm 설정
3. Node 22 + pnpm cache 준비
4. `pnpm install --frozen-lockfile`
5. `pnpm check`
6. `pnpm --filter @gw/web build`

이 job이 보는 것은 아래와 같습니다.
- workspace 기본 설치가 되는지
- 타입/테스트 묶음인 `pnpm check`가 통과하는지
- 일반 web production build가 되는지

### 2-2. cloudflare-build job

이 job은 Cloudflare/OpenNext 전용 빌드 확인입니다.

순서:
1. 저장소 checkout
2. pnpm 설정
3. Node 22 + pnpm cache 준비
4. `pnpm install --frozen-lockfile`
5. `pnpm --filter @gw/web build:cf`

이 job은 아래 질문에 답합니다.
- "일반 build는 되는데 Cloudflare/OpenNext용 build에서만 깨지는가?"

즉 baseline과 cloudflare-build를 나눠 둔 이유는,
"기본 품질 문제"와 "Cloudflare 전용 blocker"를 따로 보기 위해서입니다.

## 3. local substitute checks와 GitHub CI의 차이

둘은 비슷해 보여도 역할이 다릅니다.

### GitHub CI

GitHub Actions 안에서 자동으로 도는 검증입니다.

장점:
- 같은 조건에서 반복 확인됩니다.
- PR 화면에서 모두가 같은 결과를 봅니다.
- merge 전 latest head 기준 상태를 확인하기 쉽습니다.

현재 기본 기준:
- `pnpm check`
- `pnpm --filter @gw/web build`
- 필요 시 `pnpm --filter @gw/web build:cf` 별도 확인

### local substitute checks

CI가 아직 없거나, PR에 check가 안 붙었거나, 임시로 근거를 남겨야 할 때 로컬에서 대신 확인하는 검증입니다.

`gw-pr-flow` 기준 기본 local substitute checks:
- `pnpm check`
- `pnpm --filter @gw/web build`

선택적으로 Cloudflare blocker까지 같이 확인할 때:
- `pnpm --filter @gw/web build:cf`

중요한 점:
- local check는 "CI를 영원히 대신하는 것"이 아닙니다.
- CI가 붙어 있고 실패했다면 local 통과만으로 merge하면 안 됩니다.
- CI가 아예 없을 때만, 실행한 명령과 통과 사실을 증빙으로 남기는 용도입니다.

즉,
- CI가 있으면: GitHub CI를 우선 봅니다.
- CI가 없으면: local substitute checks를 기록해 임시 근거로 씁니다.

## 4. `build:cf` gate가 실패했을 때 처리 순서

`build:cf` 실패는 "Cloudflare용 최종 게이트 blocker"로 취급합니다.

권장 순서는 아래와 같습니다.

1. 먼저 일반 baseline이 깨졌는지 확인
   - `pnpm check`
   - `pnpm --filter @gw/web build`
2. 그다음 Cloudflare 전용 실패인지 확인
   - `pnpm --filter @gw/web build:cf`
3. 생성물 때문에 헷갈리지 않게 정리
   - `.next/`, `.open-next/`, `.wrangler/`, `.hermes/*.state`, `*.tsbuildinfo` 같은 생성물/로컬 상태는 gate 판단에서 제외
4. 실패 로그 핵심만 남김
   - 어떤 명령으로 재현됐는지
   - 에러 핵심 1~3줄
   - stale artifact 가능성이 있었는지
5. 수정 범위를 작게 유지
   - 가능하면 `build:cf` blocker만 닫는 작은 PR로 분리
6. 수정 후 다시 확인
   - `pnpm --filter @gw/web build:cf`
7. 공개 preview나 재배포 완료처럼 과장해서 쓰지 않음
   - `build:cf`가 아직 실패면 "preview 재검증 완료"라고 보고하면 안 됨

쉽게 말하면,
"일반 build는 괜찮은데 Cloudflare build만 깨지는지"를 먼저 나누고,
맞다면 그 문제만 작은 PR로 닫는 흐름입니다.

## 5. branch / PR / merge / cleanup 절차

현재 저장소의 `gw-pr-flow`는 아래 순서를 기준으로 움직입니다.

### 5-1. branch에서 먼저 볼 것

PR 생성, merge, branch 삭제 전에는 dirty worktree를 먼저 봅니다.

중요:
- 소스/문서/스크립트 변경이 남아 있으면 진행을 막습니다.
- 아래 생성물은 무시 대상입니다.
  - `.next/`
  - `.open-next/`
  - `.wrangler/`
  - `.hermes/*.state`
  - `*.tsbuildinfo`

즉, "빌드 찌꺼기만 더럽다"면 무시할 수 있지만,
실제 수정 파일이 남아 있으면 PR/merge/cleanup을 멈춥니다.

### 5-2. PR 상태 확인

보통 아래처럼 확인합니다.

```bash
./scripts/gw-pr-flow.sh --head <branch> --show-status --wait-ci
```

이 단계에서 보는 것:
- PR이 이미 있는지
- latest head 기준 CI/check가 통과했는지
- local substitute checks로 무엇을 봐야 하는지
- secret/production DB/DNS/유료/R2 운영 작업이 섞이지 않았는지

### 5-3. merge 기준

merge는 아무 때나 하면 안 됩니다.

필수 기준:
1. 카드 작업범위에 merge/release gate가 포함되어 있거나 별도 승인됨
2. `--approved` 사용
3. PR 상태가 안전함
4. latest head 기준 CI가 green 이거나, CI가 아예 없을 때만 local substitute 증빙이 있음

예시:

```bash
./scripts/gw-pr-flow.sh --head <branch> --show-status --wait-ci --merge --approved
```

주의:
- CI가 붙어 있는데 실패하면 merge 차단입니다.
- CI가 없을 때만 local substitute checks를 근거로 남깁니다.

### 5-4. branch cleanup 기준

squash merge 뒤에는 로컬 branch 삭제를 바로 시도하면 실패할 수 있습니다.
그래서 아래 3가지를 같이 확인합니다.

1. PR이 정말 merged 상태인지
2. branch 내용이 base(`main`)와 사실상 같은지
   - `git diff <branch>..main` 또는 patch-id 동등성 확인
3. 원격 branch가 이미 정리됐는지
   - `git ls-remote --heads origin <branch>`

이 3개가 맞을 때만 로컬 branch cleanup을 진행합니다.

예시:

```bash
./scripts/gw-pr-flow.sh --head <branch> --show-status --wait-ci --merge --delete-branch --approved
```

## 6. release gate에서 금지하는 범위

아래 항목은 이번 release gate 운영 범위에 넣지 않습니다.

- secret 값 출력, 저장, 커밋
- production DB migration/실데이터 변경
- DNS/custom domain 변경
- 유료 리소스 생성·증액
- 실제 R2 bucket 생성, 운영 업로드
- 실제 production deploy/rollback 같은 운영 작업

즉, release gate는 주로 아래까지만 다룹니다.
- PR 생성
- CI 확인
- local substitute checks 기록
- merge 여부 판단
- branch cleanup 여부 판단
- blocker 문서화

## 7. 실무에서 자주 쓰는 빠른 순서

1. 변경을 PR 단위로 나눕니다.
2. `gw-pr-flow`로 PR 상태와 CI를 봅니다.
3. baseline과 `build:cf`를 구분해 봅니다.
4. `build:cf` blocker는 작은 PR로 따로 닫습니다.
5. merge 전 latest head 기준 CI를 다시 확인합니다.
6. merge 뒤에는 branch/base 동등성과 원격 branch 삭제 여부를 확인한 뒤 cleanup 합니다.

## 8. 기억할 문장 5개

- 한 PR에 모든 변경을 섞지 않습니다.
- baseline CI와 `build:cf` blocker는 따로 봅니다.
- CI가 있으면 GitHub CI가 우선입니다.
- CI가 없을 때만 local substitute checks를 임시 근거로 씁니다.
- secret, production DB, DNS, custom domain, 유료 리소스, R2 운영 작업은 release gate 범위 밖입니다.
