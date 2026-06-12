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

현재 활성 흐름은 Admin host 분리 + PWA 웹앱 1차다. 이번 단계에서는 기존 `/admin/*` 권한 경계와 Phase 6 PWA 골격 위에 host 기준 관리자 웹 분리, 관리자 전용 manifest(`start_url: /admin`, `scope: /admin`), localhost/preview admin host 후보를 얹고, 일반 사용자 host 에서는 `/admin*` 를 그대로 렌더링하지 않는 방향으로 다음 구현을 이어간다.

현재 기획 상태 요약:

- 일반 사용자 웹과 관리자 웹은 `route` 만이 아니라 `host + route` 기준으로 분리한다.
- production admin host 후보는 `admin.<승인된-domain>` 이지만 실제 DNS/custom domain 연결은 이번 범위에 넣지 않는다.
- preview admin host 후보는 별도 `.workers.dev` admin host 를 우선으로 두고, localhost/dev 에서는 `admin.localhost` 또는 host header override 를 허용한다.
- 일반 사용자 host 에서는 `/admin*` 를 그대로 렌더링하지 않고 숨김/redirect/차단 중 하나로 처리한다.
- 관리자 host 에서는 `/` 를 `/admin` 으로 보내고, 관리자 전용 manifest(`name: GW Admin`, `start_url: /admin`, `scope: /admin`)를 분리한다.
- host 분리는 노출/설치 경험 경계이고, 실제 보안 경계는 기존 session/role/capability/API 검증을 그대로 유지한다.
- 실제 DNS/custom domain, secret, production DB 실데이터, 실제 운영 사용자/권한 변경은 이번 단계에 포함되지 않으며 계속 별도 승인 대상이다.
- 우선 참고 문서: `docs/architecture/admin-host-pwa-pass-1-scope.md`, `docs/guides/admin-host-pwa-pass-1-handoff.md`.

2026-06-12 문서/검증 기준 메모:

- 현재 host helper 는 `apps/web/admin-host.ts` 에 있고, 신뢰 경계는 `Host` 헤더만 사용한다. `x-forwarded-host` 는 spoof 가능하므로 admin host 판별 근거로 쓰지 않는다.
- preview admin host 는 `gw-admin.*.workers.dev`, 로컬 후보는 `admin.localhost`, `admin.127.0.0.1.nip.io` 로 잡혀 있다.
- production admin host 는 `GW_ADMIN_HOSTS` allowlist 에 들어간 host 만 인정한다. 따라서 `admin.example.com` 같은 모양만으로는 자동 허용되지 않는다.
- 현재 manifest 는 `/manifest.webmanifest` 단일 route 에서 host 를 읽어 일반 사용자용 또는 관리자용 manifest 를 동적으로 돌려준다. 관리자용 값은 `name: GW Admin`, `start_url: /admin`, `scope: /admin`, 관리자 전용 icon prefix 다.
- 관리자 host 에서는 `/` 가 `/admin` 으로 redirect 되고, `/dashboard` 같은 일반 업무 route 도 `/admin` 으로 되돌아간다. 허용 route 는 사실상 `/admin*`, `/login`, `/forbidden`, `/manifest.webmanifest`, `/offline` 중심이다.
- 부모 검증 기준으로 `bash scripts/gw-cloudflare-check.sh`, `pnpm --filter @gw/web typecheck`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf` 는 통과했다.
- 반면 `pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa` 와 `pnpm check` 는 stale 기대값 6건 때문에 실패했다. 핵심 원인은 기존 테스트 일부가 `admin.example.com` 을 기본 허용 host 로 가정해 현재 allowlist 구현과 어긋나는 점이다.
- 다음 작업자는 문서 문구보다 테스트 기대값을 먼저 고쳐야 한다. 특히 `admin-host.test.ts`, `admin-preview-guard.test.ts`, `mobile-pwa.test.ts` 의 host/manifest 기대값을 현재 구현(`GW_ADMIN_HOSTS`, 단일 manifest route, admin host route boundary)에 맞춰 다시 확인한다.

2026-06-11 pass 2 구현 메모:

- shared 계약에 정책 assignment/rule/preview/effective-policy 구조와 계산 helper 를 추가했다.
- admin 정책 화면은 우선순위 설명, 예상 적용 인원, 샘플 직원 preview, 동일 target 중복 경고를 렌더링한다.
- 직원 `/attendance` 화면은 회사 기본이 아니라 본인 effective policy 요약과 허용 방식만 보여 준다.
- API check-in/check-out 은 employee 기준 effective policy 를 계산해 허용 방식만 201, 나머지는 403 으로 차단한다.
- 최신 재검증에서 `pnpm check`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf` 가 모두 통과했다. 이전 web 빌드 ENOENT 실패 메모는 stale 상태이므로 현재 blocker 로 보지 않는다.
- 부모 검증 기준으로는 shared 18, web 30, api 61 테스트와 package typecheck, web build, Cloudflare build, auth check 가 모두 통과했다. 다음 작업자는 문구를 바꿀 때 이 근거와 모순되지 않는지 먼저 확인한다.

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
