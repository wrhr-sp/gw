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

현재 활성 흐름은 관리자 PWA 설치 UX / 오프라인 / manifest 품질 개선 단계다. 이미 들어간 admin host 분리와 admin manifest 골격 위에, 관리자 앱이 실제 설치 가능한 웹앱처럼 보이도록 설치 안내, 오프라인 안내, 아이콘 기준, manual/Lighthouse smoke 기준을 같은 뜻으로 정리하는 것이 이번 체인의 핵심이다.

현재 기획 상태 요약:

- 일반 사용자 웹과 관리자 웹은 계속 `host + route` 기준으로 분리한다.
- 관리자 앱 설치 기준은 `/admin/manifest.webmanifest`, `id: /admin`, `start_url: /admin`, `scope: /admin`, `GW Admin` 정체성을 유지한다.
- 관리자 host 에서는 설치 안내 첫 문장이 `/admin` 시작점과 운영용 앱 맥락을 설명해야 한다.
- 오프라인 안내는 관리자 상태 변경이 성공처럼 보이지 않도록, 가능한 일/막히는 일/재시도 절차를 분리해 설명해야 한다.
- manifest 세부값은 `name`, `short_name`, `description`, `id`, `start_url`, `scope`, `display`, `display_override`, `orientation`, `theme/background color`, `lang`, `categories`, `shortcuts`, `icons(any/maskable)` 까지를 최소 필수 기준으로 본다.
- 아이콘은 일반/관리자 파일 분리와 192/512, any/maskable 구성을 유지하되, 현재는 placeholder 자산이라는 사실을 숨기지 않는다.
- install prompt 자체를 커스텀 제어하는 것보다 install readiness, host-aware copy, manual/local preview smoke 기준을 우선한다.
- 모바일/관리자 주요 CTA 는 최소 48px 터치 높이와 18px 가로 패딩 기준을 유지한다.
- App Store/Play Store/Expo/native 전환, push/background sync, production DB/secret/DNS/유료 리소스는 계속 범위 밖이다.
- 우선 참고 문서: `docs/architecture/admin-pwa-install-offline-quality-scope.md`, `docs/guides/admin-pwa-install-offline-quality-handoff.md`, `docs/architecture/admin-host-preview-verification-extension-scope.md`, `docs/guides/admin-host-preview-verification-extension-handoff.md`.

2026-06-12 관리자 PWA 품질 개선 메모:

- 현재 `apps/web/app/mobile-pwa-config.ts` 에는 일반 사용자용/관리자용 manifest, nav, install steps, offline guidance 골격이 이미 있다.
- 일반 사용자용 실제 `/manifest.webmanifest` 응답 구현은 `apps/web/app/manifest.ts` 이고, 관리자용 실제 `/admin/manifest.webmanifest` 응답 구현은 `apps/web/app/admin/manifest.webmanifest/route.ts` 이다.
- 현재 `apps/web/app/layout.tsx` 는 host 에 따라 metadata, viewport, manifest href, shell config 를 분기할 수 있다.
- 현재 `apps/web/app/admin/layout.tsx` 는 관리자용 metadata/manifest identity 를 별도로 가진다.
- 현재 `apps/web/app/_components/mobile-app-shell.tsx` 는 온라인 status banner 에 설치 안내 첫 2단계를, 오프라인 전환 시 warning banner 와 `/offline` 링크를 보여 준다.
- 현재 `apps/web/app/offline/page.tsx` 는 host 기준으로 일반/관리자 오프라인 안내를 나누고, 관리자 host 에서는 가능한 일/막히는 일/재시도 절차와 함께 설치 후 우선 확인할 관리자 화면(nav items)도 노출한다.
- 현재 `apps/web/mobile-pwa.test.ts` 는 일반/관리자 manifest identity 분리, `id`/`display_override`/`shortcuts`, 아이콘 경로, host 별 shell/nav/install step, admin offline guide, `touchTargetStyle`(48px/18px)까지 회귀 보호한다. 특히 일반 manifest 는 `app/manifest.ts` 를 기준으로 확인해야 하며, 별도 route `GET()` import 비교만으로 실제 서빙 경로를 대신하면 안 된다.
- 현재 구현 기준으로 관리자 설치 copy 와 오프라인 안내의 운영 맥락/상태 변경 제약은 이미 config 와 오프라인 페이지에 반영돼 있다. 후속은 이를 깨지 않게 preview/manual/Lighthouse 근거를 계속 남기는 쪽에 집중하면 된다.
- placeholder SVG 아이콘은 이미 분리돼 있지만, 최종 브랜드 자산 완성을 의미하지는 않는다. 이번 체인에서는 파일 분리, any/maskable, 회귀 보호를 먼저 고정한다.
- 다음 구현자는 `apps/web/app/mobile-pwa-config.ts`, `apps/web/app/_components/mobile-app-shell.tsx`, `apps/web/app/offline/page.tsx`, `apps/web/mobile-pwa.test.ts` 를 우선 확인하면 된다.
- 검증 기준은 `pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa`, `pnpm --filter @gw/web typecheck`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf`, `pnpm check` 가 최소고, 가능하면 local `preview:cf` + `bash scripts/gw-admin-host-preview-smoke.sh` 와 브라우저 수동 설치/Lighthouse 확인 메모까지 남긴다.

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
- 최종 사용자 보고는 싱드가 쉬운 한국어로 통합한다. 배포가 포함된 작업은 live URL과 사용자가 직접 보면 되는 화면/경로/확인 포인트를 함께 남긴다.
