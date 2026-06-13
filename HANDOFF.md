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

현재 활성 흐름은 Phase 20 운영 전 정리 1차다. Phase 19까지 정리한 mobile 내부 시범 운영 초안과 기존 Web/PWA/API/admin guardrail 을 바탕으로, 지금 확인 가능한 것 / 아직 skeleton 인 것 / 별도 승인 필요한 것을 실제 운영 전 점검표 관점으로 다시 맞추는 것이 이번 체인의 핵심이다.

현재 기획 상태 요약:

- 이번 Phase의 목적은 새 기능 확대보다 운영 전 오해 방지 정리다.
- 문서 결론은 "지금 확인 가능한 것 / 아직 skeleton 인 것 / 별도 승인 필요" 3분류로 모은다.
- live/PWA/API/mobile 확인 포인트는 각각 유지하되 최종 결론표는 같은 언어로 맞춘다.
- mobile readiness 는 계속 중요하지만 전체 서비스 readiness 중 한 축으로 배치한다.
- `/admin/*` 운영 화면과 일반 업무 흐름은 다시 섞지 않는다.
- production DB, secret, DNS/custom domain, 유료 리소스, 외부 초대/실연동, App Store/Play Console/TestFlight/EAS, push, 실기기 권한은 계속 별도 승인 게이트다.
- 우선 참고 문서: `docs/architecture/phase-20-pre-operations-alignment-pass-1-scope.md`, `docs/guides/phase-20-pre-operations-alignment-pass-1-handoff.md`, `docs/architecture/phase-19-native-mobile-internal-pilot-draft-scope.md`, `docs/guides/phase-19-native-mobile-internal-pilot-draft-handoff.md`, `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md`, `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md`, `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`, `docs/architecture/phase-6-mobile-pwa-scope.md`, `docs/architecture/phase-7-api-same-origin-scope.md`.

2026-06-13 Phase 20 운영 전 정리 1차 메모:

- 지금 저장소를 "운영 후보를 설명할 수 있는 상태"로 보고, "이미 운영 가능"처럼 과장하지 않는다.
- route 이름만 나열하지 말고, 무엇이 지금 확인됨/아직 skeleton/승인 필요인지 같이 적는다.
- live/PWA/API/mobile 은 따로 확인하되 결론은 한 장의 readiness 표처럼 정리한다.
- preview/dev-safe 는 운영 기본값이 아니라 검증용 대체 경로다. 운영 origin 하드코딩이나 secret 주입을 정당화하지 않는다.
- 토큰/세션 저장은 secure storage bridge 계층을 전제로 하고, 평문 저장이나 Web cookie 복제를 기본값처럼 쓰지 않는다.
- 일반 사용자의 첫 액션이 `attendance`, 승인 lane 권한 사용자의 첫 액션이 `approvals` 로 갈라지는 current helper 의미는 유지하되, 이것이 전체 운영 readiness 전부를 뜻하지는 않는다고 본다.
- `/admin/*` 운영 화면은 mobile 기본 탭이나 일반 직원 핵심 흐름으로 섞지 않고 Web/admin 책임으로 남긴다.
- production DB, secret, custom domain, 외부 초대, 스토어 사용, push, 실기기 권한은 구현 TODO가 아니라 승인 checklist 로 계속 분리한다.
- 다음 구현자는 `docs/architecture/phase-20-pre-operations-alignment-pass-1-scope.md`, `docs/guides/phase-20-pre-operations-alignment-pass-1-handoff.md`, `packages/shared/src/mobile-contracts.ts`, `apps/mobile/src/workflow.ts`, `apps/mobile/src/base-url.ts`, `apps/mobile/src/session-bridge.ts`, `apps/mobile/README.md`, `apps/mobile/app.config.ts` 를 순서대로 보면 기준을 가장 빨리 확인할 수 있다.

대장이 Phase 20 문서를 볼 때 바로 확인할 쉬운 순서:
1. `docs/architecture/phase-20-pre-operations-alignment-pass-1-scope.md` 에서 포함 범위/제외 범위/결정사항/승인 목록을 먼저 본다.
2. `docs/guides/phase-20-pre-operations-alignment-pass-1-handoff.md` 에서 되는 것 / 아직 안 되는 것 / 승인 필요를 쉬운 말로 본다.
3. `ROADMAP.md`, `TASKS.md`, `KNOWN_ISSUES.md` 에서 현재 활성 체인과 남은 리스크를 본다.
4. `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 에서 route/권한/검증 기준이 같은 뜻인지 본다.
5. `packages/shared/src/mobile-contracts.ts`, `apps/mobile/src/workflow.ts`, `apps/mobile/src/base-url.ts`, `apps/mobile/src/session-bridge.ts` 에서 mobile guardrail 근거를 본다.
6. `apps/mobile/README.md` 와 `apps/mobile/app.config.ts` 에서 release gate 메모와 현재 범위 설명을 본다.
7. production DB, secret, DNS/custom domain, 유료 리소스, 외부 초대, App Store/Play Console/TestFlight/EAS, push, 실기기 권한이 모두 승인 게이트로 남았는지 확인한다.

대장이 Phase 20 route 를 실제로 따라 볼 때 추천하는 쉬운 순서:
1. `/login` — placeholder 로그인/세션 설명과 역할별 첫 이동이 과장 없이 적혀 있는지 본다.
2. `/dashboard` — 상단 액션 우선순위와 일반 사용자 대 관리자 경계가 같은 뜻인지 본다.
3. `/attendance` 와 `/leave` — 정책 안내, 미허용 이유, placeholder 제한이 숨겨지지 않는지 본다.
4. `/approvals` — 승인 lane 이 기본 전원 공용 흐름처럼 읽히지 않는지 본다.
5. `/boards` 와 `/documents` — 협업 묶음 설명은 하되 게시판 책임과 문서 보관 책임을 섞지 않는지 본다.
6. `/me` — `me` 조회와 `auth.logout`/session clear 설명이 과장 없이 이어지는지 본다.
7. `/admin`, `/admin/policies`, `/admin/audit-logs` — 관리자 확인 포인트가 일반 사용자 흐름과 분리되고 `audit.read` 경계가 유지되는지 본다.
8. 마지막으로 live/PWA/API/mobile 근거를 다시 모아, 각 route 가 "지금 확인 가능 / 아직 skeleton / 승인 필요" 중 어디인지 한 번에 읽히는지 본다.

보관 메모: Phase 16 파일럿 초안 문서를 다시 볼 때 바로 확인할 쉬운 순서:
1. `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md` 의 "2026-06-13 기준 현재 판정 요약"에서 되는 것 / 아직 안 되는 것 / 승인 필요를 먼저 본다.
2. `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md` 의 "2026-06-13 기준 빠른 판정표"와 "preview/live URL에서 바로 볼 쉬운 순서"를 본다.
3. `/dashboard` → `/boards` → `/boards/board_notice` → `/posts/board_post_board_notice_employee_employee` → `/documents` → `/admin/policies` → `/admin/audit-logs` 순서가 현재 문서와 같은 뜻인지 본다.
4. live `.workers.dev` 직접 fetch 가 미확인이면 이를 완료처럼 읽지 말고, `pnpm check`, `pnpm --filter @gw/web build:cf`, local preview smoke 가 대체 근거로 남았는지 확인한다.
5. production data, secret, DNS/custom domain, 유료 리소스, 실제 운영 파일 업로드 확대가 아직 승인 게이트인지 다시 확인한다.

대장이 지금 저장소에서 바로 눌러 볼 쉬운 확인 포인트:
1. `apps/mobile/src/screens.ts` 에서 각 화면이 어떤 guardrail 을 갖는지 본다.
2. `packages/shared/src/mobile-contracts.ts` 에서 각 화면의 `apiRoutes` 와 `access` 메모를 본다.
3. `apps/mobile/src/base-url.ts` 에서 production 은 approved origin only, preview/development 는 명시적 origin 또는 mock adapter 만 허용하는지 본다.
4. `apps/mobile/src/session-bridge.ts` 에서 plain async storage 와 Web cookie copy 금지 기준, session clear 가 어떤 guardrail 로 묶이는지 본다.
5. `apps/mobile/src/workflow.ts` 에서 일반 사용자 첫 액션이 `attendance`, 승인자 첫 액션이 `approvals` 로 나뉘는지 본다.

대장이 Phase 20을 빠르게 판정할 5가지 질문:
1. 지금 저장소에서 바로 확인 가능한 핵심 흐름이 무엇인지 바로 보이는가?
2. 아직 skeleton/preview 라서 운영 완료처럼 보면 안 되는 항목이 분리돼 보이는가?
3. 별도 승인·계정·비용·권한이 필요한 항목이 따로 보이는가?
4. live/PWA/API/mobile 확인 포인트가 서로 다른 말을 하지 않는가?
5. 관리자와 일반 사용자 경계가 route·문서·QA 기준에서 같은 뜻인가?

위 5개 질문 중 하나라도 애매하면 아직 운영 전 정리 문서가 덜 정리된 상태로 본다.

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
- `gwops`: PR/CI/merge/release cleanup 안전성 검토

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
