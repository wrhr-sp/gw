# TEST_PLAN

## 문서 목적

이 문서는 "무슨 명령을 돌릴지" 뿐 아니라 "왜 그 검증을 다시 해야 하는지"를 함께 정리한 루트 테스트 기준 문서다.

핵심 원칙:
- 명령만 통과했다고 끝내지 않는다.
- 권한/회사 경계/placeholder 오해 방지까지 같이 본다.
- PR 전, merge 후, live smoke, 문서 일관성 확인을 서로 분리해 기록한다.

## 1. 기본 검증 명령

### 1-1. 저장소 공통 확인

```bash
pnpm check
```

왜 돌리나:
- workspace 전체 lint/type/test 흐름이 현재 기준에 맞는지 먼저 확인한다.
- 문서 작업 카드라도 현재 저장소가 이미 깨져 있지는 않은지 빠르게 본다.

### 1-2. shared contract 검증

```bash
pnpm --filter @gw/shared test
pnpm --filter @gw/shared typecheck
```

왜 돌리나:
- `packages/shared/src/contracts.ts` 의 route/schema 가 깨지지 않았는지 확인한다.
- 루트 문서가 설명한 응답 shape 와 실제 contract 가 어긋나지 않는지 보는 가장 빠른 기준이다.

### 1-3. API 검증

```bash
pnpm --filter @gw/api test
pnpm --filter @gw/api typecheck
```

왜 돌리나:
- placeholder route, 권한/회사 scope, validation error, self-approval guardrail, private 문서공간 차단 같은 회귀가 유지되는지 확인한다.

### 1-4. Web 검증

```bash
pnpm --filter @gw/web test
pnpm --filter @gw/web typecheck
pnpm --filter @gw/web build
```

왜 돌리나:
- PWA/route/UI skeleton 과 same-origin web 쪽이 최소한 현재 빌드 가능한지 확인한다.
- 문서에서 `/dashboard`, `/employees`, `/org`, `/admin/*` 같은 route 설명을 바꿨다면 실제 web 구조와 충돌하지 않는지 함께 본다.

Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안에서 특히 다시 볼 것:
- 홈(`/`)이 일반 업무 흐름과 관리자 검토 흐름을 둘 다 소개하는지
- 로그인(`/login`)이 역할별 첫 이동(`/dashboard`, `/approvals`, `/admin`, `/admin/audit-logs`)을 과장 없이 설명하는지
- 대시보드(`/dashboard`) 상단 액션 순서가 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 우선순위를 유지하고, 이후 `/org`·`/employees` 조회 마무리 흐름으로 자연스럽게 이어지는지
- 협업 검토는 `/boards/board_notice`, `/boards/board_general`, `/posts/board_post_board_notice_employee_employee`, `/documents` 같은 현재 placeholder 예시 경로로 다시 눌러 보며 문서 설명과 실제 route 톤이 같은지 확인하는지
- 일반 업무 route(`/attendance`, `/leave`, `/approvals`, `/org`, `/employees`) 설명이 dashboard 와 같은 언어를 쓰는지
- 협업 route(`/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents`)가 핵심 업무 흐름과 끊기지 않으면서도 실제 완성형 협업툴처럼 과장되지 않는지
- `/boards` 가 전사 공지(`board_notice`)와 자유 게시판(`board_general`)을 같은 화면에서 보여 주더라도 notice-only와 일반 작성 책임 차이를 먼저 설명하는지
- `/posts/[postId]` 가 bodyPreview 중심 상세, 댓글, 읽음 확인 CTA 를 분리해 보여 주고 forged/접근 불가 postId 403 경계 설명과 충돌하지 않는지
- `/documents` 가 전사 문서함 대 인사 전용 문서함, metadata 중심 설명, raw storage key/bucket/public URL 비노출 원칙을 한 화면에서 숨기지 않는지
- live `.workers.dev` 직접 fetch 가 막히면 이를 미확인으로 남기고 `pnpm check`, `pnpm --filter @gw/web build:cf`, local preview smoke 같은 대체 근거를 별도로 기록하는지
- 관리자 CTA 가 일반 사용자 preview 기준 숨겨져 있고, 권한 기반 shortcut 으로만 열리는지

### 1-5. Mobile skeleton 검증

```bash
pnpm --filter @gw/mobile typecheck
```

왜 돌리나:
- `apps/mobile` shell 이 Web/PWA와 공유하는 route/auth/session 계약을 깨지 않았는지 가장 빠르게 확인한다.
- `apps/mobile/src/base-url.ts`, `apps/mobile/src/session-bridge.ts`, `packages/shared/src/mobile-contracts.ts` 설명이 실제 타입과 어긋나지 않는지 본다.
- store build 없이도 Phase 22 성공 기준인 실제 하루 업무 흐름 연결, 상태 안내 4축, route/auth/session contract 경계와 승인 게이트 분리 기준을 재검증할 수 있다.

### 1-6. Phase 22 쉬운 실제 업무 흐름 판정 질문

문서/코드 대조를 끝낸 뒤 대장이 짧게 다시 볼 질문:

1. 직원이 로그인한 뒤 무엇을 먼저 하고 어디로 이어지는지 문서와 화면에서 바로 보이는가
2. `/dashboard` 상단 액션과 실제 각 업무 화면 설명이 같은 순서를 가리키는가
3. 출퇴근, 휴가, 결재, 공지/문서, 내 정보, 조직 확인 흐름이 서로 끊기지 않는가
4. mobile/PWA/Web 설명이 같은 route/auth/session contract 와 guardrail 을 가리키는가
5. empty/error/forbidden/offline 상태가 쉬운 사용자 언어로 정리돼도 의미가 섞이지 않는가
6. `/admin/*` 운영 화면과 production data·secret·실연동이 일반 직원 흐름 밖의 승인 게이트로 남아 있는가

이 6개 질문 중 하나라도 흐리면 Phase 22 문서 작업은 완료로 보지 않는다.

### 1-7. 대장이 실제로 눌러 볼 쉬운 확인 순서

문서 정합성을 볼 때는 아래 순서로 보면 가장 빠르다.

1. `/login`
   - placeholder 세션 기준 역할별 첫 이동 설명이 있는지 본다.
   - 실제 운영 로그인 완료처럼 과장하지 않았는지 같이 본다.
2. `/dashboard`
   - 상단 액션 순서가 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 우선순위를 유지하는지 본다.
   - 그 뒤 `/org`·`/employees` 조회 마무리 흐름이 끊기지 않는지, 일반 사용자 흐름과 관리자 운영 흐름이 섞이지 않는지 본다.
3. `/attendance` 와 `/leave`
   - 정책 안내, placeholder 제한, 권한/회사 scope/미허용 이유 설명이 있는지 본다.
   - 실제 운영 저장 성공처럼 읽히는 문구가 없는지 본다.
4. `/approvals`
   - 승인 lane 이 모든 사용자 기본 흐름처럼 쓰이지 않는지 본다.
   - self-approval 금지, 권한 경계 설명과 충돌하지 않는지 본다.
5. `/boards` 와 `/documents`
   - 협업 묶음으로는 설명하되 게시판 책임과 문서 보관 책임을 섞지 않는지 본다.
   - metadata/placeholder 단계가 실제 파일 운영 완료처럼 보이지 않는지 본다.
6. `/me`
   - `me` 조회 중심 설명과 `auth.logout`/session clear 안내가 과장 없이 적혀 있는지 본다.
7. `/org` 와 `/employees`
   - 회사 구조, 부서/직원 상태, 일반 조회 역할이 흐름의 마지막 확인 포인트로 읽히는지 본다.
   - 운영 변경 화면처럼 과장하지 않는지 본다.
8. `/admin/users`, `/admin/policies`, `/admin/audit-logs`
   - 직원 연결/역할 diff, 정책 source/candidate, 감사 read-only 경계가 분리돼 있는지 본다.
9. `/admin`
   - 관리자 확인 포인트가 일반 사용자 핵심 흐름과 분리돼 있는지 본다.
   - `audit.read` 같은 별도 capability 경계가 살아 있는지 본다.
10. 마지막으로 live/PWA/API/mobile 근거를 다시 모은다.
   - 각 축 설명이 달라도 최종 결론은 "지금 확인 가능 / 아직 skeleton / 승인 필요" 셋으로 모여야 한다.

## 2. Cloudflare/Web 배포 후보 검증

```bash
pnpm --filter @gw/web build:cf
```

왜 돌리나:
- Cloudflare 대상 빌드가 깨지지 않는지 본다.
- same-origin bridge, PWA, manifest, preview 배포 전 단계의 가장 중요한 정적 게이트다.

함께 볼 문서:
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `DEPLOYMENT.md`

### 2-1. Phase 16 local preview 대체 근거 메모

`pnpm --filter @gw/web preview:cf` 기본 경로가 세션 환경에서 불안정하면,
같은 build 산출물을 기준으로 아래처럼 대체 smoke 근거를 남길 수 있다.

```bash
cd apps/web
pnpm exec wrangler dev --port 8790 --ip 127.0.0.1
BASE_URL=http://127.0.0.1:8790 bash ../../scripts/gw-admin-host-preview-smoke.sh
```

왜 남기나:
- live `.workers.dev` 직접 fetch 가 막힌 세션에서도 build 결과와 route 경계를 완전히 공백으로 두지 않기 위해서다.
- 단, 이 결과는 live 확인 대체 근거일 뿐이고 live 직접 확인 완료로 쓰면 안 된다.

## 3. 자동화/운영 스크립트 검증

```bash
bash -n scripts/gw-hermes-env.sh
bash -n scripts/gw-review-required-gate.sh
bash -n scripts/gw-review-required-recovery-loop.sh
python3 -m py_compile scripts/gw-hourly-status-report.py
python3 -m unittest discover -s scripts/tests -p "test_*.py"
```

왜 돌리나:
- release/review-required/recovery watcher 관련 운영 안전장치가 문서와 다르게 망가지지 않았는지 본다.
- 문서에서 운영 흐름을 설명할 때, 실제 스크립트가 최소한 문법상/테스트상 살아 있는지 확인한다.

역할봇 판단루프 고도화 작업에서 추가로 볼 것:
- blocked 재판단 순서가 release cleanup → stale/superseded → review-required 재검증 → recovery loop → 승인 필요 순으로 유지되는지 확인한다.
- `already-handled` 로그가 나왔을 때 원본 카드와 생성 체인의 최신 상태를 다시 보는 기준이 있는지 확인한다.
- fixture/dry-run뿐 아니라 service active/status, journal sweep, board stats, blocked list, dispatch dry-run까지 운영 근거가 남는지 확인한다.
- 역할별 책임 경계가 결과에 같이 드러나는지 확인한다. 예: `gwdocs`는 보고양식/blocked 설명, `gwtester`는 실행 명령/보드 근거, `gwops`는 merge/release cleanup 근거를 남긴다.
- Telegram 보고정책 문서가 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 분리하는지 확인한다.
- blocked 분류가 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요로 설명돼 있는지 확인한다.
- 카드 댓글 완료와 사용자 직접 보고 완료를 다른 상태로 구분하는지 확인한다.
- 같은 카드·같은 이유·같은 근거에서 중복/스팸 보고를 막는 기준이 있는지 확인한다.
- scheduled 복구 카드 정리라면 예전 오류 재현 로그만 보지 말고, 최신 저장소에서 `pnpm check`, 관련 test/typecheck/build, 가능하면 `pnpm --filter @gw/web build:cf`, local `preview:cf` smoke 까지 다시 대조해 "지금도 살아 있는 일인지"를 확인한다.

검증자동화 표준 체크 묶음:
1. fixture 또는 카드 샘플로 release cleanup / stale / review-required / already-handled 분기를 재현한다.
2. dry-run 으로 실제 상태 변경 없이 어떤 분류가 나오는지 확인한다.
3. service active/status 또는 대체 가능한 process/journal 근거를 남긴다.
4. board stats, blocked list, dispatch dry-run 으로 현재 보드 상태를 함께 남긴다.
5. GitHub/merge/release cleanup 범위가 섞이면 PR head, merge 상태, main release-gate, remote branch 부재, diff/patch-id 동등성을 분리 확인한다.
6. 최종 결과에는 `자동화가 한 일 / 싱드가 직접 개입한 일 / 자동화가 못 끝낸 이유 / 보완한 자동화` 4축이 실제로 채워졌는지 본다.

## 4. 시나리오 기반 검증 축

아래 시나리오는 기능 변경 카드뿐 아니라 루트 문서 보강 카드에서도 "현재 설명이 코드와 맞는지" 확인할 때 같이 참고한다.

### 4-1. contract/type 축

확인할 것:
- `appRoutes` 가 문서의 endpoint 목록과 맞는가
- shared schema 이름과 설명이 실제 payload 와 맞는가
- placeholder 필드 존재 여부를 문서가 숨기지 않았는가
- `packages/shared/src/mobile-contracts.ts` 의 7개 모바일 1차 화면 mapping 이 `/login`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`·`/documents`, `/me` 설명과 같은가
- `/boards` 와 `/documents` alias 가 같은 협업 묶음 진입으로 설명되되 게시판 책임과 문서 보관 책임을 섞지 않는가

주요 근거:
- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`

### 4-2. 인증/권한 축

확인할 것:
- 무인증 접근은 401 `AUTH_REQUIRED`
- 권한 없는 접근은 403 `FORBIDDEN`
- `/admin/*` 는 일반 업무와 분리돼 있는가
- 관리자 접근 판단이 `roleCode` 이름만이 아니라 실제 permission/capability 기준과 같은 뜻으로 맞는가
- 일반 조회에서 관리자 전용 역할/기능이 과노출되지 않는가

대표 테스트:
- `apps/api/test/auth-org.spec.ts`

### 4-3. 회사 scope 축

확인할 것:
- 다른 회사 데이터/정책/운영 candidate 를 조회·변경하지 못하는가
- 같은 회사 후보만 참조/합의/정책 preview 에 포함되는가

대표 테스트:
- `apps/api/test/auth-org.spec.ts` 의 cross-company 차단 시나리오

### 4-4. placeholder guardrail 축

확인할 것:
- 출퇴근/휴가/결재/업로드가 실제 운영 완료처럼 보이지 않는가
- 게시판/문서/첨부 metadata 흐름이 실제 운영 협업 저장 완료처럼 보이지 않는가
- notices/placeholder 필드가 문서와 코드에서 일관되게 남아 있는가
- "아직 안 되는 것" 을 문서가 숨기지 않는가

근거 문서:
- `SPEC.md`
- `KNOWN_ISSUES.md`
- 각 `docs/architecture/phase-*.md`

### 4-5. self-approval / forged id / private resource 축

확인할 것:
- 자기 결재 자기승인 차단
- forged post/read-receipt/document id 차단
- private 문서공간 비권한 접근 차단
- unknown employee/request/document id 가 성공처럼 보이지 않는가

대표 테스트:
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/document-storage.spec.ts`

### 4-6. same-origin / PWA / build 축

확인할 것:
- API 기본 경로가 same-origin `/api/*` 설명과 맞는가
- manifest 경로와 `start_url` 설명이 맞는가
- 일반 사용자 host 와 관리자 host 의 manifest/start_url/scope 분리가 문서 기준과 맞는가
- 일반 사용자 host 에서 `/admin*` 가 그대로 렌더링되지 않는가
- `build:cf` 가 통과하는가
- `apps/mobile/src/base-url.ts` 가 production 에서는 approved origin 없이는 실패하고, preview/development 는 명시적 origin 또는 mock adapter 로만 풀리는가
- preview 절대 URL 이 모바일 기본값처럼 하드코딩되지 않았는가

대표 근거:
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md`
- `docs/architecture/phase-19-native-mobile-internal-pilot-draft-scope.md`
- web build/test 결과

### 4-7. 문서 일관성 축

확인할 것:
- `DATA_MODEL.md`, `API.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 가 서로 다른 말을 하지 않는가
- phase 문서 링크가 실제 범위를 잘 가리키는가
- skeleton/placeholder 제한이 루트 문서에서 빠지지 않았는가
- Phase 16 문서라면 `/` → `/login` → `/dashboard` → `/attendance`/`/leave`/`/approvals`/`/boards`/`/documents`/`/org`/`/employees` 와 권한 기반 `/admin/*` 흐름이 루트 문서와 handoff 문서에서 같은 순서로 읽히는가
- `/employees` 대 일반 조회와 `/admin/users` 운영 검토, `/attendance`/`/leave` 정책 안내와 `/admin/policies` 운영 정책 설명, `/boards`/`/documents` 협업 흐름과 운영 문서 보관 경계가 문서마다 같은 뜻인가
- Phase 22 문서라면 로그인 → 대시보드 → 출퇴근 → 휴가 → 결재 → 공지/문서 → 내 정보 → 조직/직원 확인 순서, offline/error/empty/forbidden 상태 분류, mobile/Web 계약 비교, `/admin/*` 분리, 승인 게이트 설명이 루트 문서와 handoff 문서에서 같은 뜻인가

### 4-8. 역할봇 판단루프 / 운영 자동화 축

확인할 것:
- blocked 카드가 release cleanup → stale/superseded → review-required 재검증 → recovery loop → 승인 필요 순으로 재분류되는가
- `already-handled` 로그가 나와도 원본 카드와 생성 체인의 최신 상태를 다시 확인하는가
- fixture/dry-run 결과만이 아니라 service active/status, journal sweep, board stats, blocked list, dispatch dry-run 근거가 함께 남는가
- Telegram 보고 문서/결과가 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 분리하는가
- blocked 분류 문서/결과가 방치/자동복구중/승인필요/싱드 직접정리/자동화 보완필요를 같은 뜻으로 쓰는가
- 카드 댓글 작성 완료와 사용자 직접 보고 완료를 분리 기록하는가
- 같은 카드·같은 이유·같은 근거의 반복 알림을 막는 기준이 있는가
- card-scoped `PR merge`/`release gate`/`branch cleanup` 정리가 검증 근거 없이 자동 실행되지 않는가
- restricted 항목이 운영 자동화 범위에 섞여 들어오지 않는가

대표 근거:
- `docs/architecture/rolebot-authority-decision-loop-hardening-scope.md`
- `docs/guides/rolebot-authority-decision-loop-hardening-handoff.md`
- `docs/guides/automation-hardening-review-gate-handoff.md`
- `docs/guides/scheduled-recovery-card-cleanup-report-2026-06-12.md`
- `RUNBOOK.md`
- 관련 Kanban 카드 comment/summary/metadata

scheduled 복구 카드 정리에서 우선 확인할 최신 근거 메모:
- 부모 카드 재검증 기준으로 `pnpm check`, `pnpm --filter @gw/web build:cf`, local `preview:cf` smoke 가 모두 통과했는지 본다.
- local `preview:cf` smoke 는 `/`, `/login`, `/boards`, `/documents`, `/manifest.webmanifest` 200 과 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 의 로그인 유도(307), `/api/health` 200 JSON, `/api/me` 401 JSON 같은 경계가 유지되는지 함께 기록한다.
- 위 최신 근거가 있으면 예전 scheduled reviewer/tester/singde 후속 카드는 단독 유지 이유가 약한지 다시 판단한다.

## 5. 모듈별 대표 회귀 포인트

### 인증/조직

다시 볼 포인트:
- 로그인 placeholder contract
- `/api/me` 무인증 차단
- 직원 목록 필터 validation
- 비관리자 일반 조회에서 admin-only 역할 비노출
- `/api/admin/users` 비관리자 차단

주요 테스트:
- `apps/api/test/auth-org.spec.ts`
- `packages/shared/test/contracts.spec.ts`

### 근태/휴가

다시 볼 포인트:
- check-in / check-out placeholder 응답
- 회사 정책에서 허용한 출퇴근 등록 방식(`mobile`, `pc`, `tag`)만 check-in / check-out 에서 통과하는지
- `company_default -> workplace -> department -> job_type` 우선순위 계산이 같은 순서로 동작하는지
- 각 단계가 union 병합이 아니라 전체 override 로 덮이는지
- 미허용 방식은 403, 잘못된 방식 값은 400 validation 으로 구분되는지
- `/admin/policies` preview 의 적용 인원/샘플 직원 정보가 설명용 preview 로만 보이고 실제 조직 데이터 저장/반영 UI 처럼 읽히지 않는지
- 실제 GPS/위치정보, 단말 연동, 외부 HR 연동 없이도 현재 테스트 범위가 유지되는지
- 근태 기록 조회와 정정 요청
- 휴가 유형/잔여/요청 조회
- 비승인자의 approve/reject 차단
- unknown employee/request id 차단

주요 테스트:
- `apps/api/test/auth-org.spec.ts`

### 전자결재

다시 볼 포인트:
- 양식/결재선 조회
- 문서 생성과 상세 조회
- 내 기안함/승인함 scope 분리
- reference/agreement 후보의 회사 범위
- self-approval 금지

주요 테스트:
- `apps/api/test/auth-org.spec.ts`

### 게시판/문서

다시 볼 포인트:
- 공지/게시판 목록과 접근 가능한 게시판 범위
- notice-only 게시판 쓰기 차단
- forged post id, forged read receipt target id 차단
- private 문서공간 접근 차단
- upload-init allowlist / max-size 제한
- download/delete placeholder action 의 raw storage 정보 비노출

주요 테스트:
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/document-storage.spec.ts`

### 네이티브 모바일 skeleton

다시 볼 포인트:
- `apps/mobile` 이 monorepo 안에서 `packages/shared` 계약만 재사용하고 Web 전용 렌더/PWA 책임을 억지로 끌어오지 않는지
- `apps/mobile/src/base-url.ts` 가 approved origin only / devOrigin / mock adapter 정책과 같은 뜻으로 동작하는지
- `apps/mobile/src/session-bridge.ts` 가 plain async storage, web-cookie-copy, query-string-token 금지 기준을 유지하는지
- 로그인/대시보드/출퇴근/휴가/결재함/공지·문서/내 정보 7개 화면이 placeholder 범위를 넘어서 완성 배포처럼 보이지 않는지
- offline/error/empty/forbidden 상태가 화면 설명과 code path 에서 같은 뜻으로 읽히는지
- `apps/mobile/src/workflow.ts` 가 일반 사용자 첫 액션을 `attendance`, 승인 lane 권한 사용자의 첫 액션을 `approvals` 로 나누는 현재 helper 기준과 같은 뜻인지
- 내 정보 화면 설명이 `me` 조회 중심 흐름과 온라인 `auth.logout`/로컬 `session clear` 안내 경계를 함께 숨기지 않는지
- `/admin/*` 운영 화면이 모바일 기본 탭으로 승격되지 않고 Web fallback 또는 후속 범위로 남는지

주요 테스트:
- `pnpm --filter @gw/mobile typecheck`
- `packages/shared/test/contracts.spec.ts`

### 관리자 정책/감사

다시 볼 포인트:
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 접근 행렬이 문서와 같은지
- `HR_ADMIN` 이 `/admin/audit-logs` 를 자동 허용받지 않고 `audit.read` 기준과 같은 뜻으로 정리됐는지
- `AUDITOR` 가 감사 로그 전용 흐름만 가지는지
- dashboard/admin hub 노출 조건과 직접 route 접근 기준이 같은지
- `adminScope`, `highRiskPermissions`, `capability` 설명이 contract/UI/API 에서 같은지
- `/admin/policies` 에 적용대상 level, 우선순위 안내, before/after diff, 적용 인원 preview 가 함께 보이는지
- 같은 target 중복 정책이 있으면 경고가 읽히는지
- candidate preview 의 masked/summary 정보가 과도 노출 없이 읽히는가
- 감사 로그 timeline/filter 가 validation 과 함께 유지되는가
- 운영 정책과 일반 업무 화면 책임이 섞이지 않는가
- document/board policy candidate 의 masked preview 유지
- cross-company policy candidate 차단
- audit log filter 와 masked metadata 유지

주요 테스트:
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/admin-console-pass1.test.tsx`
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/org-employees-boundary.test.tsx`
- `apps/api/test/auth-org.spec.ts`

### 관리자 host / PWA

다시 볼 포인트:
- host helper 가 preview/local/admin host 후보를 같은 기준으로 판별하는지
- production 모양의 host 라도 `GW_ADMIN_HOSTS` allowlist 에 없으면 admin host 로 오인하지 않는지
- host 판별이 `Host` 헤더만 신뢰하고 `x-forwarded-host` 로 spoof 되지 않는지
- 일반 사용자 host + `/admin*` 요청이 login/forbidden/admin-host redirect 중 문서 기준대로 처리되는지
- 관리자 role 이 일반 host 의 `/admin*` 로 들어왔는데 paired admin host 를 계산할 수 없을 때 allow 되지 않고 차단/forbidden 으로 남는지
- 관리자 host + `/` 요청이 `/admin` 으로 이어지는지
- 관리자 host + 일반 업무 route(`/dashboard`, `/employees` 등) 요청이 `/admin` 으로 되돌아가는지
- 관리자 host 에서 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 권한 경계가 유지되는지
- 일반 사용자 host 는 `/manifest.webmanifest`, 관리자 host 는 `/admin/manifest.webmanifest` 를 광고하고 각 route 가 올바른 manifest identity 를 주는지
- 관리자 host 로 `/manifest.webmanifest` 를 직접 열어도 일반 manifest 가 유지되고, 실제 설치 href 는 `/admin/manifest.webmanifest` 인지
- 관리자 install 안내 copy 가 `/admin` 시작점, 운영용 앱 맥락, same-origin 유지, native/push/background sync 미포함 상태를 숨기지 않는지
- 관리자 offline 안내가 사용자/권한 변경, 정책 적용, 감사 로그 최신성 제약을 성공처럼 포장하지 않는지
- 관리자 manifest 가 `name`, `short_name`, `description`, `id`, `start_url`, `scope`, `display`, `display_override`, `orientation`, `theme_color/background_color`, `lang`, `categories`, `shortcuts`, `icons(any/maskable)` 최소값을 유지하는지
- 관리자 아이콘이 일반 사용자용과 파일명으로 분리되고, placeholder 자산 상태를 문서/문구가 과장하지 않는지
- 온라인 상태 banner 가 install 안내 1~2단계를 보여 주고, 오프라인 전환 시 관리자용 banner title/body 와 `/offline` 링크로 바뀌는지
- 관리자 오프라인 페이지가 `availableNow`/`blockedNow`/`retrySteps` 와 설치 후 바로 확인할 관리자 화면(nav items)을 같은 기준으로 노출하는지
- 터치 CTA 최소 높이 48px, 가로 패딩 18px 기준이 config/test/document 에서 같은 뜻인지
- host 분리가 있어도 API 권한/회사 scope 검증이 약해지지 않는지

주요 테스트:
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/admin-host.test.ts`
- `apps/web/mobile-pwa.test.ts`

현재 재검증 메모(부모 카드 기준):
- 부모 카드 검증 기준으로 `pnpm --filter @gw/shared test -- contracts.spec.ts`, `pnpm --filter @gw/api test -- auth-org.spec.ts`, `pnpm --filter @gw/web test -- admin-console-pass1 admin-preview-guard dashboard-boundary middleware`, `pnpm check`, `pnpm --filter @gw/web build:cf`, `bash scripts/gw-cloudflare-check.sh`, local `preview:cf` smoke 까지 통과했고, PR #39 merge commit `c14bb65` 와 main push `release-gate` run `27398275720` 의 `cloudflare-build`/`cloudflare-deploy` 성공까지 확인됐다.
- `bash scripts/gw-cloudflare-check.sh`, `pnpm --filter @gw/web typecheck`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf` 는 통과 근거가 있다.
- 이번 후속 체인에서는 `pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa`, `pnpm check` 까지 다시 통과시키는 것을 우선 목표로 둔다.
- 일반 host fallback 은 우선 `apps/web/admin-preview-guard.test.ts` 로 잠갔다. paired admin host 를 계산하지 못한 admin role 요청과 spoofed admin-looking host 요청이 모두 `/forbidden` 으로 차단되는지 계속 회귀 확인한다.
- 2026-06-12 재검증 1차: `pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa` 실행 결과 8개 파일, 43개 테스트 통과.
- `apps/web/mobile-pwa.test.ts` 는 일반 manifest 검증 시 실제 브라우저가 받는 구현 경로인 `apps/web/app/manifest.ts` 를 기준으로 본다. 단순히 별도 `route.ts` 의 `GET()` 만 import 해서 같다고 보는 테스트는 false positive 를 만들 수 있으므로 금지한다.
- `apps/web/mobile-pwa.test.ts` 는 관리자 manifest 의 `id`, `display_override`, `shortcuts`, admin icon 경로, install/offline guide, `touchTargetStyle`(48px/18px)까지 같이 회귀 보호한다.
- local `preview:cf` smoke 는 `set -a; . .secrets/cloudflare.env; set +a; pnpm --filter @gw/web preview:cf` 실행 후 별도 터미널에서 `bash scripts/gw-admin-host-preview-smoke.sh` 로 `/manifest.webmanifest`, `/admin/manifest.webmanifest`, general/admin host HTML manifest href, `/admin`, `/`(manual/follow redirect) 를 확인하는 절차로 고정한다.
- 설치 품질 후속에서는 위 preview smoke 에 더해 브라우저 수동 확인으로 설치 메뉴 노출 여부, manifest 패널 핵심값, 관리자 install/offline copy 를 함께 기록하는 것을 권장한다.
- Lighthouse 는 필수 자동화 게이트가 아니라 수동 보조 근거로 우선 사용하고, 확인했다면 어떤 PWA 관련 항목을 봤는지 메모를 남긴다.
- live `.workers.dev` fetch 가 막히면 local `preview:cf` smoke, deployment metadata, 상위 live smoke 메모를 substitute evidence 로 남긴다.

## 2026-06-12 Phase 15 운영 데이터·정책·감사 로그 연결 1차 검증 계획

목표:
- 관리자 정책/권한/감사 preview 가 일반 업무 화면과 API 허용 결과에 왜 그렇게 이어지는지 같은 뜻으로 검증한다.
- blocked/empty/error 상태를 권한 부족, 회사 scope, 정책 미허용, placeholder 제한 4축으로 구분해 확인한다.
- `/attendance` 뿐 아니라 `/leave` 도 운영 정책 연결 보강 대상으로 포함한다.

우선 검증 route:
- `/`
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/employees`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`

우선 검증 API:
- `GET /api/admin/policies/attendance`
- `GET /api/admin/policies/leave`
- `GET /api/admin/users`
- `GET /api/admin/audit-logs`
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/leave/types`
- `GET /api/leave/requests`
- `POST /api/leave/requests`
- `GET/POST /api/approvals/documents`

역할별 핵심 체크:
- 일반 직원: `/attendance` 와 관련 API가 같은 허용/차단 이유를 설명하는지, `/leave` 가 정책 연결 없는 독립 placeholder 처럼 보이지 않는지 확인
- 팀장/결재자: `/approvals` 에서 승인 권한 부족과 정책상 미허용이 다른 이유로 읽히는지 확인
- 인사/운영 관리자: `/admin/users` preview 와 `/dashboard`/`/employees`/`/approvals` 노출이 같은 뜻인지, `/admin/policies` 와 `/attendance`/`/leave` 정책 안내가 같은 방향인지 확인
- 감사 전용 사용자: `/admin/audit-logs` 가 `audit.read` 기준과 masked/company boundary 원칙을 유지하는지 확인

문서 근거 파일:
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-skeleton-config.ts`
- `packages/shared/src/admin-access.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

명령 기준:
- `pnpm check`
- 필요 범위별 `pnpm --filter @gw/shared test typecheck`
- 필요 범위별 `pnpm --filter @gw/api test typecheck`
- 필요 범위별 `pnpm --filter @gw/web test typecheck build`
- Cloudflare 관련 변경이 있으면 `pnpm --filter @gw/web build:cf`

수동 확인 포인트:
- 일반 사용자에게 관리자 CTA, raw 감사 정보, 운영 내부 candidate 가 새지 않는지
- 화면 안내 문구와 API 에러/forbidden 이유가 서로 다른 말을 하지 않는지
- skeleton/dev-safe/placeholder 문구가 빠지지 않는지

대장이 preview/live URL 에서 빠르게 볼 순서:
1. `/dashboard` 에서 일반 업무 요약과 관리자 경계 안내가 같이 읽히는지 본다.
2. `/attendance` 에서 허용 방식, `effective policy`, offline 재시도 안내가 같이 보이는지 본다.
3. `/leave` 에서 권한 부족/회사 scope/정책상 미허용/placeholder 제한 4축 메모가 살아 있는지 본다.
4. `/employees` 와 `/admin/users` 를 비교해 일반 조회와 운영 검토가 서로 다른 책임으로 읽히는지 본다.
5. `/admin/policies` 와 `/admin/audit-logs` 에서 candidate/reason/audit preview 가 read-only 운영 검토 톤으로 유지되는지 본다.

## 6. PR 전 확인

최소 기준:
- `pnpm check`
- 필요한 범위의 package test/typecheck/build
- 문서 링크/설명과 코드/테스트가 모순되지 않는지 확인

문서 카드에서도 남길 것:
- 어떤 파일을 근거로 문장을 수정했는지
- 직접 실행한 명령
- 아직 실행 못 한 검증이 있다면 왜 못 했는지

## 7. main merge 후 release gate 확인

확인할 것:
- GitHub PR 최신 head 기준 check 통과
- main push 후 `release-gate` 실행 결과
- Cloudflare build/deploy 단계 성공 여부

대표 확인 예시:
- PR checks 결과
- `release-gate` run id
- `cloudflare-build`, `cloudflare-deploy` 상태

실무 메모:
- CI 가 없거나 일부 확인이 로컬 대체 증거여야 하면 그 사실을 같이 남긴다.

## 8. live smoke 또는 대체 근거 남기기

기본 smoke route:
- `/`
- `/login`
- `/dashboard`
- `/attendance`
- `/approvals`
- `/employees`
- `/org`
- `/admin` 또는 `/admin/audit-logs` 권한 경계 확인
- `/manifest.webmanifest`

live 확인이 가능할 때:
- status code 또는 기본 응답 확인
- latest deployment/run 과 함께 기록

live fetch 가 환경상 막힐 때 대체 근거:
- `pnpm --filter @gw/web build:cf`
- 관련 로컬 test/build 결과
- `release-gate` 또는 Cloudflare deploy metadata
- same-origin/PWA 관련 문서와 code path 재확인 결과

중요:
- live 확인을 못 했는데 했다고 쓰면 안 된다.
- 대신 무엇으로 대체 확인했는지 분명히 적는다.

## 9. 문서 작업 카드에서 추가로 확인할 것

문서 변경이어도 아래를 같이 본다.
- 링크가 실제 파일을 가리키는가
- 루트 문서 5종이 서로 모순되지 않는가
- placeholder / skeleton / 승인 필요 항목이 빠지지 않는가
- `RUNBOOK.md`, `DEPLOYMENT.md`, `KNOWN_ISSUES.md`, `ARCHITECTURE.md` 와 충돌이 생기지 않는가
- 대장이 preview/live URL 에서 어떤 순서로 눌러 봐야 하는지 쉬운 한국어 체크포인트가 남아 있는가

## 10. 검증 결과를 남기는 형식

가능하면 아래 순서로 남긴다.
- 실행한 명령
- 통과/실패 결과
- 확인한 guardrail
- 못 한 검증과 이유
- live 대체 근거가 있으면 그 근거

예시:
- `pnpm check` 통과
- `pnpm --filter @gw/web build:cf` 통과
- 문서 링크 수동 확인: 루트 문서가 실제 phase 문서를 가리킴
- 미실행: live fetch 직접 확인은 이번 실행 환경에서 생략, release-gate metadata 로 대체

## 11. 재귀적 자기개선 검증 기록

작업 중 반복 가능한 개선점이 발견되면 테스트 결과와 함께 아래를 남긴다.

- 실패/실수 원인: 어떤 테스트, 문서 누락, handoff 누락 때문에 문제가 생겼는가
- 반영 문서: `AGENTS.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md` 중 어디에 반영했는가
- 다음 카드에서 방지되는 문제: 같은 실수나 검증 누락을 어떻게 줄이는가
- 미반영 사유: 카드 범위 밖이거나 승인 필요 항목이면 왜 반영하지 않았는가

금지: 이 기록을 이유로 배포, PR merge, 운영 DB, secret, DNS, 유료 리소스, 다른 보드 작업을 자동 수행하지 않는다.

## 12. 같이 봐야 하는 문서

- `DATA_MODEL.md`
- `API.md`
- `SPEC.md`
- `QA_CHECKLIST.md`
- `DEPLOYMENT.md`
- `RUNBOOK.md`
- `KNOWN_ISSUES.md`
- `docs/workflow/groupware-kanban-automation.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
