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

현재 활성 흐름은 Phase 18 네이티브 모바일앱 핵심 업무 연결 1차다. Phase 17에서 만든 `apps/mobile` skeleton과 shared contract를 바탕으로 로그인·대시보드·출퇴근·휴가·결재함·공지/문서·내 정보까지 한 흐름으로 따라가고, offline/error/empty/forbidden 상태와 dev-safe 검증 기준을 함께 잠그는 것이 이번 체인의 핵심이다.

현재 기획 상태 요약:

- 이번 Phase의 목적은 앱스토어 배포를 시작하는 것이 아니라 모바일 핵심 업무 흐름을 1차로 연결하는 것이다.
- 기본 7개 핵심 화면 범위는 유지하되, 화면별 API contract 연결과 상태 안내 기준을 더 분명히 맞춘다.
- 로그인 → 대시보드 → 출퇴근/휴가/결재함 → 공지/문서 → 내 정보 순서가 한 번에 읽히게 한다.
- same-origin `/api/*` 철학은 유지하되, 네이티브 앱에서는 base URL resolver 와 mock/dev-safe bridge 층으로 번역한다.
- Web cookie 동작을 모바일 세션 기본값처럼 가정하지 않고 secure storage bridge 기준을 계속 유지한다.
- `/admin/*` 운영 화면, 실기기 권한, 푸시, App Store/Play Console/TestFlight/EAS, secret, custom domain, production origin 확정은 별도 승인 게이트다.
- 우선 참고 문서: `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md`, `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md`, `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`, `docs/architecture/phase-6-mobile-pwa-scope.md`, `docs/architecture/phase-7-api-same-origin-scope.md`.

2026-06-13 Phase 18 네이티브 모바일앱 핵심 업무 연결 1차 메모:

- 기준 흐름은 로그인 → 대시보드 → 오늘 필요한 업무(출퇴근/휴가/결재함) → 공지/문서 → 내 정보 순서다.
- 화면 설명은 route 이름만 적지 말고 offline/error/empty/forbidden 4축 상태를 같이 적는다.
- `/boards`·`/documents` 는 협업 묶음 진입으로 설명할 수 있지만 게시판 책임과 문서 보관 책임을 합쳐 쓰지 않는다.
- 승인자용 CTA 와 일반 사용자용 CTA 차이는 보여 주되, 관리자 정책 변경 화면은 모바일 기본 탭에 넣지 않는다.
- preview/dev-safe는 운영 기본값이 아니라 검증용 대체 경로다. 운영 origin 하드코딩이나 secret 주입을 정당화하지 않는다.
- 토큰/세션 저장은 secure storage bridge 계층을 전제로 하고, 평문 저장이나 Web cookie 복제를 기본값처럼 쓰지 않는다.
- 일반 사용자의 첫 액션은 `attendance`, 승인 lane 권한이 있는 사용자의 첫 액션은 `approvals` 로 갈라진다는 점을 `apps/mobile/src/workflow.ts` 기준으로 함께 본다.
- 내 정보 화면은 `me` 조회가 기본이고, 로그아웃은 온라인 `auth.logout` 가능 여부와 별개로 secure storage bridge 기반 session clear 안내를 같이 본다.
- 대장이 확인할 때는 "어떤 업무 흐름을 한 번 따라갈 수 있는가"와 함께 "어떤 상태가 아직 placeholder/승인 게이트인가"를 같이 보여 줘야 한다.
- 다음 구현자는 `packages/shared/src/mobile-contracts.ts`, `apps/mobile/src/screens.ts`, `apps/mobile/src/base-url.ts`, `apps/mobile/src/session-bridge.ts`, `apps/mobile/src/workflow.ts` 를 순서대로 보면 화면 흐름과 guardrail 을 가장 빨리 확인할 수 있다.
- `apps/mobile/src/workflow.ts` 는 화면별 offline/error/empty/forbidden 상태 문구와 일반 사용자/승인자의 첫 액션 분기를 shared contract 기준으로 계산하는 preview helper 다.

대장이 Phase 18 문서를 볼 때 바로 확인할 쉬운 순서:
1. `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md` 에서 포함 범위/제외 범위/상태 분류 4축을 먼저 본다.
2. `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md` 에서 로그인부터 내 정보까지 기본 흐름을 본다.
3. `packages/shared/src/mobile-contracts.ts` 에서 화면별 route/api/access 기준을 본다.
4. `apps/mobile/src/screens.ts` 에서 7개 화면의 section/guardrail 구성을 본다.
5. `apps/mobile/src/base-url.ts` 와 `apps/mobile/src/session-bridge.ts` 에서 운영 origin 하드코딩 금지, secure storage bridge 기준을 본다.
6. App Store/Play Console/TestFlight/EAS, push, 실기기 권한, secret, custom domain 이 모두 승인 게이트로 남았는지 확인한다.

대장이 지금 저장소에서 바로 눌러 볼 쉬운 확인 포인트:
1. `apps/mobile/src/screens.ts` 에서 각 화면이 어떤 guardrail 을 갖는지 본다.
2. `packages/shared/src/mobile-contracts.ts` 에서 각 화면의 `apiRoutes` 와 `access` 메모를 본다.
3. `apps/mobile/src/base-url.ts` 에서 production 은 approved origin only, preview/development 는 명시적 origin 또는 mock adapter 만 허용하는지 본다.
4. `apps/mobile/src/session-bridge.ts` 에서 plain async storage 와 Web cookie copy 금지 기준, session clear 가 어떤 guardrail 로 묶이는지 본다.
5. `apps/mobile/src/workflow.ts` 에서 일반 사용자 첫 액션이 `attendance`, 승인자 첫 액션이 `approvals` 로 나뉘는지 본다.

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
