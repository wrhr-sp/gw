# CHANGELOG

## 2026-06-13

### Changed

- Phase 22 문서를 현재 `/dashboard` 구현 기준으로 다시 맞춰 상단 액션 순서를 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 로, 이후 `/org`·`/employees` 를 마무리 조회 흐름으로 읽는 설명을 `SPEC.md`, `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md`, `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 에 반영했다.
- `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md` 와 `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md` 를 추가해 로그인 이후 대시보드·출퇴근·휴가·결재·공지/문서·내 정보·조직 확인 흐름을 실제 하루 업무 순서처럼 다시 읽는 기준, 상태 안내 4축, mobile/Web 계약 비교, `/admin/*` 분리, 승인 게이트를 쉬운 한국어로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 22 활성 체인 기준으로 갱신해 현재 카드 ids, 실제 업무 흐름 목표, 기준 route 순서, mobile 비교 포인트, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 Phase 22 기준으로 보강해 로그인 후 실제 하루 업무 흐름 판정 질문, 상태 안내 4축의 쉬운 사용자 언어, dashboard 와 실제 업무 화면 순서 정렬, `/admin/*` 분리 기준을 루트 검증 문서에 반영했다.
- `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md` 와 `docs/guides/phase-21-real-company-settings-model-pass-1-handoff.md` 를 추가해 회사 기본 설정/조직/직원/권한/근태·휴가 정책을 실제 회사 설정 묶음처럼 다시 읽는 기준, 직원용 화면 대 관리자용 화면 경계, 출퇴근 정책 우선순위 방향, 승인 게이트를 쉬운 한국어로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 21 활성 체인 기준으로 갱신해 현재 카드 ids, 실제 회사 설정 모델 목표, 회사 설정 4묶음, 직원 화면 대 관리자 화면 경계, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 Phase 21 기준으로 보강해 회사 기본 설정/조직/직원/권한/정책 연결 질문, 직원 UI/API 가 현재 허용된 정책만 보이는지 확인하는 기준, GPS·실태그·production data·external HR 승인 게이트 분리를 루트 검증 문서에 반영했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 다시 보강해 Phase 21 문서가 `/login` → `/dashboard` → `/org`·`/employees` → `/attendance`·`/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/admin/users`·`/admin/policies`·`/admin/audit-logs` → `/admin` 순서의 쉬운 확인 포인트와 "지금 확인 가능 / 아직 skeleton / 승인 필요" 3분류를 같은 언어로 보여 주도록 맞췄다.
- `docs/architecture/phase-20-pre-operations-alignment-pass-1-scope.md` 와 `docs/guides/phase-20-pre-operations-alignment-pass-1-handoff.md` 를 추가해 preview/skeleton 결과물을 실제 운영 전 점검표 관점으로 다시 읽는 기준, 되는 것/아직 skeleton/승인 필요 3분류, live/PWA/API/mobile 정렬, 관리자/일반 사용자 경계, 승인 목록을 쉬운 한국어로 고정했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 20 활성 체인 기준으로 갱신해 현재 카드 ids, 운영 전 정리 목표, 핵심 질문 5가지, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 Phase 20 기준으로 보강해 mobile 중심 내부 시범 운영 문장을 전체 운영 readiness 문장으로 확장하고, 되는 것/아직 안 되는 것/승인 필요 분류와 live/PWA/API/mobile 결론 정렬 기준을 루트 검증 문서에 반영했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 한 번 더 다듬어 Phase 19 내부 시범 운영 readiness 를 대장이 바로 판정할 4가지 질문(선행 검증 분리, 설치→session clear 흐름, Android/iOS 준비물 분리, 남은 승인 게이트 명시)으로 고정했다.
- Phase 16 회고용 문서도 실제 구현/리뷰/테스트 결과 기준으로 다시 정리해, `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md`, `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 에 "되는 것 / 아직 안 되는 것 / 승인 필요 / live fetch gate 대체 근거" 를 같은 언어로 반영했다.
- `docs/architecture/phase-19-native-mobile-internal-pilot-draft-scope.md` 와 `docs/guides/phase-19-native-mobile-internal-pilot-draft-handoff.md` 를 추가해 내부 시범 운영 전에 필요한 Android/iOS 준비물, live/PWA/API 선행 검증과 mobile 전용 smoke 기준 분리, 비용/계정/권한 승인 checklist, 남은 배포 게이트를 쉬운 한국어로 고정했다.
- `TASKS.md`, `ROADMAP.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 19 활성 체인 기준으로 갱신해 현재 카드 ids, 내부 시범 운영 핵심 범위, 설치→로그인→핵심 업무→세션 정리 순서, App Store/Play Console/TestFlight/EAS 승인 게이트를 한 번에 따라가게 정리했다.
- `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md` 와 `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md` 를 추가해 Phase 17 모바일 skeleton 이후 로그인→대시보드→출퇴근/휴가/결재함→공지·문서→내 정보 흐름, offline/error/empty/forbidden 상태 4축, PWA 대 네이티브 차이, 승인 게이트를 쉬운 한국어로 다시 고정했다.
- `packages/shared/src/mobile-contracts.ts` 에 Phase 18용 workflow/state guidance, PWA 대 네이티브 차이 메모, 화면 lookup helper 를 추가했고 `apps/mobile/src/workflow.ts` 를 새로 만들어 화면별 상태 설명과 일반 사용자/승인자 첫 액션 분기를 실제 코드 helper 로 연결했다.
- `TASKS.md`, `ROADMAP.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 18 활성 체인 기준으로 갱신해 현재 카드 ids, 포함/제외 범위, 구현자 확인 순서, 남은 승인 게이트를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 에 Phase 18 모바일 핵심 업무 연결 기준을 반영해 7개 우선 화면, 상태 분류 4축, mobile typecheck/contract 검증 포인트, 문서 일관성 점검 기준을 최신 handoff 와 같은 뜻으로 맞췄다.
- Phase 18 문서를 한 번 더 다듬어 `apps/mobile/src/workflow.ts` 의 일반 사용자/승인자 첫 액션 분기와 내 정보 화면의 `me` 중심 + `auth.logout`/session clear 경계를 쉬운 확인 포인트로 다시 고정했다.

- `apps/mobile` skeleton(`app.config.ts`, `src/shell.ts`, `src/base-url.ts`, `src/session-bridge.ts`, `src/screens.ts`, `README.md`)을 추가하고, `packages/shared/src/mobile-contracts.ts` 를 신설해 Web/PWA와 네이티브 앱이 공유할 route mapping, auth/session guardrail, same-origin 번역용 base URL policy, 승인 게이트 기준을 코드로 고정했다.
- `packages/shared/test/contracts.spec.ts` 에 Phase 17 모바일 전환 계약 회귀 테스트를 추가했고, 루트 `pnpm check` 가 `@gw/mobile` typecheck 를 함께 수행하도록 `apps/mobile/package.json` 을 보강했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 에 현재 `apps/mobile` skeleton 위치와 검증 포인트를 추가해 다음 구현자가 base URL resolver / secure storage bridge / 승인 게이트를 바로 확인할 수 있게 정리했다.
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md` 와 `docs/guides/phase-17-native-mobile-transition-prep-handoff.md` 를 추가해 Phase 16 PWA 파일럿 이후 Expo/React Native 네이티브 앱 전환을 어떻게 안전하게 시작할지 문서화했다. 핵심은 `apps/mobile` 기본 배치, `packages/shared` 재사용 경계, 모바일 1차 화면 7개, same-origin 철학의 mobile base URL resolver 번역, secure storage 전제 auth/session 기준, 앱스토어/실기기/유료 빌드 승인 게이트 분리다.
- `TASKS.md`, `ROADMAP.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 17 네이티브 모바일앱 전환 준비 기준으로 갱신해 현재 활성 체인, 모바일 범위/제외 범위, route mapping, dev-safe 검증 기준, 별도 승인 필요 항목을 다시 맞췄다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 추가로 보강해 Phase 17 문서화 카드에서도 `apps/mobile` 7개 핵심 화면, `/boards`·`/documents` 협업 묶음, base URL resolver, secure storage bridge, App Store/Play Console/TestFlight/EAS 승인 게이트, `@gw/mobile` typecheck 근거를 루트 문서와 쉬운 확인 포인트 기준으로 다시 맞췄다.

## 2026-06-12

### Changed

- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 Phase 16 대시보드 현재 UI 기준으로 다시 맞춰 `/dashboard` 상단 액션 순서(`/attendance` → `/approvals` → `/boards` → `/documents` → `/employees`)와 Phase 16 eyebrow 문구를 같은 뜻으로 정리했다.
- 같은 Phase 16 루트 문서에 `/boards/board_notice`, `/boards/board_general`, 예시 게시글 상세, 전사 문서함 대 인사 전용 문서함 같은 실제 placeholder route 예시를 추가해 live URL 파일럿 확인 순서와 notice-only/R2 metadata 경계를 더 쉽게 따라가게 정리했다.
- `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md` 와 `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md` 를 추가해 게시판/공지/문서함/R2 skeleton, 전체 smoke 기준, live URL 파일럿 확인 포인트, 남은 승인 게이트를 한 번에 설명하는 Phase 16 범위와 handoff 를 문서화했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안 기준으로 갱신해 현재 활성 체인, 핵심 업무 route + 협업 route + 관리자 route 묶음, 파일럿 검토 순서, restricted 승인 게이트를 다시 맞췄다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 보강해 `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 협업 흐름, R2 binding-aware/dev-safe 경계, notice-only/private space/raw storage 비노출 guardrail, live smoke 대체 근거 기준을 루트 문서에 반영했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 현재 Phase 15 화면/API 근거에 다시 맞춰 `/leave` 4축 운영 메모, `/admin/users` 와 일반 조회/결재 책임 분리, `/admin/audit-logs` read-only 경계, 대장이 preview/live URL 에서 바로 볼 쉬운 확인 순서를 더 분명히 적었다.
- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md` 와 `docs/guides/phase-15-operational-policy-audit-bridge-pass-1-handoff.md` 를 추가해 관리자 정책/권한/감사 skeleton 이 `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees` 및 관련 API 허용 기준에 왜 그렇게 반영되는지 설명하는 Phase 15 운영 연결 1차 범위와 handoff 를 문서화했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 15 운영 데이터·정책·감사 로그 연결 1차 기준으로 갱신해 현재 활성 체인, 핵심 운영 연결 포인트, `/leave` 정책 보강 대상, blocked/empty/error 4축(권한/회사 scope/정책 미허용/placeholder 제한) 설명 기준을 다시 맞췄다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 보강해 `/attendance` 와 `/leave` 의 정책 source/미허용 이유 설명, 운영 연결형 검증 route/API, blocked/empty/error 분류 체크를 문서 기준으로 추가했다.
- `docs/architecture/phase-14-real-usable-mvp-pass-1-scope.md` 와 `docs/guides/phase-14-real-usable-mvp-pass-1-handoff.md` 를 추가해 홈/로그인/대시보드/일반 업무/관리자 skeleton 을 한 번에 눌러 볼 수 있는 실사용 MVP 통합 1차 범위, 역할별 진입 흐름, smoke 기준, guardrail 을 문서화했다.
- `ROADMAP.md`, `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 Phase 14 실사용 MVP 통합 1차 기준으로 갱신해 현재 활성 체인, 핵심 route 묶음(`/`, `/login`, `/dashboard`, `/org`, `/employees`, `/attendance`, `/approvals`, `/admin/*`), 일반 업무/관리자 경계, 후속 handoff 참조 문서를 다시 맞췄다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`, `docs/workflow/groupware-kanban-automation.md`, `scripts/README.md` 를 다시 보강해 역할별 기본 책임 매트릭스, card-scoped 예외 권한 원칙, blocked 분류별 다음 액션, fixture/dry-run/service journal/board state/PR gate를 묶어 보는 검증자동화 체크 기준을 더 분명히 적었다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 Phase 14 현재 UI 기준으로 다시 맞춰 홈/로그인/대시보드의 역할별 흐름, 핵심 smoke route(`/`, `/login`, `/dashboard`, `/attendance`, `/approvals`, `/org`, `/employees`, `/admin/*`), `/employees` 대 `/admin/users`, `/attendance` 대 `/admin/policies` 경계, 대장이 preview/live URL 에서 따라 볼 쉬운 확인 순서를 한 번에 정리했다.
- `docs/architecture/rolebot-authority-decision-loop-hardening-scope.md` 와 `docs/guides/rolebot-authority-decision-loop-hardening-handoff.md` 를 추가해 역할봇 권한 확대 대신 싱드/Watcher 판단루프 보강을 우선하는 운영 설계, blocked 재판단 순서, Telegram 보고 분리 기준, 검증자동화 handoff 를 문서화했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 현재 역할봇 권한·판단루프·보고정책·검증자동화 고도화 체인 기준으로 갱신했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 에 blocked 재판단 순서, `already-handled` 재확인 기준, Telegram 보고 4분류, fixture/dry-run/service sweep/board state/PR-CI-main gate 검증 축을 반영했다.
- 역할봇 판단형 Telegram 보고정책 문서를 더 보강해 blocked 5분류 설명, 쉬운 한국어 최종 보고 예시, 카드 댓글 완료와 사용자 직접 보고 완료 분리, 같은 카드·같은 이유·같은 근거 중복 보고 방지 기준을 `docs/guides/rolebot-authority-decision-loop-hardening-handoff.md`, `docs/architecture/rolebot-authority-decision-loop-hardening-scope.md`, `HANDOFF.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `scripts/README.md`, `KNOWN_ISSUES.md` 에 반영했다.
- `docs/architecture/scheduled-recovery-card-cleanup-scope.md` 와 `docs/guides/scheduled-recovery-card-cleanup-handoff.md` 를 추가해 예전 web build flaky / recovery loop 관련 scheduled 카드들을 최신 `main` 기준으로 재분류하는 범위, 제외 범위, 안전한 정리 순서를 문서화했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 현재 활성 체인이 "이전 scheduled 복구 카드 정리" 단계임이 드러나도록 갱신했다.
- `TEST_PLAN.md`, `QA_CHECKLIST.md` 에 scheduled/stale/superseded 카드 정리 시 확인해야 할 근거와 restricted 분리 체크를 추가했다.
- `docs/guides/scheduled-recovery-card-cleanup-report-2026-06-12.md` 를 추가해 예전 web build/attendance recovery loop 관련 scheduled 카드 14장을 최신 완료 카드와 현재 검증 결과 기준으로 다시 분류했고, 유지 대상 scheduled 카드는 없다는 판단 근거를 표로 정리했다.
- `docs/architecture/admin-pwa-install-offline-quality-scope.md` 와 `docs/guides/admin-pwa-install-offline-quality-handoff.md` 를 추가해 관리자 PWA 설치 UX, 오프라인 안내, manifest 세부값, icons/maskable, manual/Lighthouse smoke 기준을 한 세트로 문서화했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`, `ROADMAP.md` 를 현재 관리자 PWA 품질 개선 체인 기준으로 갱신했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 에 관리자 설치 copy, 오프라인 honesty, manifest 필수값, icons/maskable, local preview/manual install/Lighthouse 체크 기준을 반영했다.
- `docs/architecture/admin-role-permission-model-pass-1-scope.md` 와 `docs/guides/admin-role-permission-model-pass-1-handoff.md` 를 추가해 관리자 권한/역할 데이터 모델 1차 범위, 접근 행렬, 구현 기준, 다음 단계 handoff 를 문서화했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 현재 관리자 권한/역할 데이터 모델 1차 체인 기준으로 갱신했다.
- `SPEC.md`, `DATA_MODEL.md` 에 관리자 접근 skeleton 과 `audit.read` 중심 감사 로그 접근 기준을 반영했다.
- `TEST_PLAN.md`, `QA_CHECKLIST.md` 에 `/admin` 계열 접근 행렬, `HR_ADMIN`/`AUDITOR` 경계, dashboard/admin hub/API guard 정합성 검증 항목을 추가했다.
- `TASKS.md`, `HANDOFF.md`, `KNOWN_ISSUES.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 를 현재 Admin host 운영 설계 + preview 검증 확장 체인 기준으로 다시 맞췄다.
- `apps/web/public/manifest.webmanifest` 를 일반 manifest 기준 파일로 두고, shadow 되던 `apps/web/app/manifest.webmanifest/route.ts` 는 제거했다.
- `scripts/gw-admin-host-preview-smoke.sh` 를 추가해 `preview:cf` 상태에서 Host 헤더 기준 `/manifest.webmanifest`, `/admin/manifest.webmanifest`, general/admin host HTML manifest href, `/admin`, `/` manual/follow redirect smoke 를 재현할 수 있게 했다.
- 새 범위 문서 `docs/architecture/admin-host-preview-verification-extension-scope.md` 와 handoff 문서 `docs/guides/admin-host-preview-verification-extension-handoff.md` 를 추가했다.
- `apps/web/admin-preview-guard.ts` 에서 일반 host admin fallback 을 강화해, paired admin host 를 계산할 수 없으면 allow 대신 `/forbidden` 으로 차단하도록 바꿨다.
- `packages/shared/src/admin-access.ts` 를 추가해 role → permission/adminScope/admin route 접근 행렬을 shared helper 로 모으고, API role scope/고위험 권한 계산·Web preview guard·dashboard shortcut·admin hub 카드 노출이 같은 기준을 재사용하도록 맞췄다.
- `apps/web/app/admin/page.tsx`, `apps/web/admin-page-content.tsx`, `apps/web/admin-page-access.ts` 를 분리해 관리자 허브 카드 노출을 viewer role/permission 기준으로 계산하고, `HR_ADMIN` 은 `/admin/users`·`/admin/policies` 만, `AUDITOR` 는 `/admin/audit-logs` 만 보이도록 정리했다.
- `apps/web/admin-preview-guard.test.ts` 에 paired admin host 미계산 케이스와 spoofed admin-looking host(`admin.attacker.example`) 차단 회귀 테스트를 추가했다.
- 관리자 host 페이지가 `/admin/manifest.webmanifest` 를 광고하도록 `apps/web/app/layout.tsx`, `apps/web/app/mobile-pwa-config.ts` 를 보강했고 local preview smoke 에서 일반/관리자 manifest 경로를 분리 확인했다.
- `pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa` 재검증에서 8개 파일, 43개 테스트가 통과했다.
- live `.workers.dev` fetch 가 막힐 때 `build:cf`, `pnpm check`, local `preview:cf` smoke, deployment metadata 를 substitute evidence 로 남기는 검증 기준을 문서에 추가했다.
- `SPEC.md`, `TEST_PLAN.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 를 최신 구현 기준으로 다시 맞춰 `packages/shared/src/admin-access.ts` 단일 접근 행렬, `/admin/audit-logs` 의 `audit.read` 기준, 부모 카드 검증 근거(PR #39 merge commit `c14bb65`, `release-gate` run `27398275720`)를 한 번에 따라가게 정리했다.
- `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md` 를 다시 맞춰 관리자 PWA 문서 기준에 `id`/`display_override`/`shortcuts`, 온라인/오프라인 banner 동작, 관리자 offline 페이지 nav 노출, `touchTargetStyle`(48px/18px) 회귀 보호 기준을 반영했다.
- scheduled 복구 카드 정리 문서를 한 번 더 다듬어, stale/superseded 판단이 예전 실패 로그만이 아니라 최신 `pnpm check`·`build:cf`·local `preview:cf` smoke 같은 현재 검증 근거와 함께 이뤄져야 한다는 기준을 `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `KNOWN_ISSUES.md` 에 반영했다.

## 2026-06-11

### Added

- Admin host 분리 + PWA 웹앱 1차 범위 문서 `docs/architecture/admin-host-pwa-pass-1-scope.md` 추가.
- Admin host 분리 + PWA 웹앱 1차 handoff 문서 `docs/guides/admin-host-pwa-pass-1-handoff.md` 추가.
- Phase 11 조직/직원 일반 화면 1차 완료 및 PR #21 main merge/Cloudflare deploy 확인.
- review-required gate, safe triage, recovery loop 자동화 보강 작업 체인 시작.
- 루트 표준 문서 세트 추가: VISION, ROADMAP, PRD, SPEC, ARCHITECTURE, DATA_MODEL, API, TASKS, TEST_PLAN, QA_CHECKLIST, HANDOFF, DECISIONS, RUNBOOK, DEPLOYMENT, KNOWN_ISSUES.
- Phase 13 관리자 콘솔 실사용 1차 범위 문서 `docs/architecture/phase-13-admin-console-pass-1-scope.md` 추가.
- Phase 13 관리자 콘솔 실사용 1차 handoff 문서 `docs/guides/phase-13-admin-console-pass-1-handoff.md` 추가.
- Phase 13 관리자 콘솔 1차 렌더 회귀 테스트 `apps/web/admin-console-pass1.test.tsx` 추가.
- 출퇴근 등록 방식 정책 선택 1차 범위 문서 `docs/architecture/attendance-registration-policy-pass-1-scope.md` 추가.
- 출퇴근 등록 방식 정책 선택 1차 handoff 문서 `docs/guides/attendance-registration-policy-pass-1-handoff.md` 추가.
- 출퇴근 정책 적용대상/우선순위 2차 범위 문서 `docs/architecture/attendance-registration-policy-pass-2-scope.md` 추가.
- 출퇴근 정책 적용대상/우선순위 2차 handoff 문서 `docs/guides/attendance-registration-policy-pass-2-handoff.md` 추가.

### Changed

- ROADMAP/README/TASKS/HANDOFF/KNOWN_ISSUES/SPEC/TEST_PLAN/QA_CHECKLIST 기준 최신 활성 작업을 Admin host 분리 + PWA 웹앱 1차로 갱신했다.
- 일반 사용자 host 와 관리자 host 를 `host + route` 기준으로 분리하고, 관리자용 manifest(`start_url: /admin`, `scope: /admin`)를 별도 정체성으로 다룬다는 기획 기준을 문서에 추가했다.
- production admin host 후보(`admin.<승인된-domain>`), preview `.workers.dev` admin host 후보, localhost/dev host 시뮬레이션 후보를 문서에 고정했다.
- 현재 진행 작업은 배포까지 자동 승인으로 처리하고, 완료 후 후속 수정/추가 변경은 배포 전 재승인 기준으로 분리.
- role worker 스킬 누락으로 인한 crash는 제품 실패가 아니라 카드/프로필 설정 문제로 분류하고 복구.
- 개발 카드에 제한적 재귀적 자기개선 루프를 적용하기로 했다. 범위는 현재 카드 관련 문서·테스트·QA·핸드오프 개선으로 제한하고, 운영 DB/secret/DNS/유료/배포/PR merge/다른 보드 작업은 자동 수행하지 않는다.
- ROADMAP/README/HANDOFF 기준 최신 활성 Phase를 Phase 13 관리자 콘솔 실사용 1차로 갱신.
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 화면을 운영 체크포인트·권한 경계·current/candidate/capability·감사 타임라인 중심 구조로 재정리했다.
- `apps/web/admin-skeleton-config.ts` 를 operations-first 데이터 구조로 확장해 허브/사용자/정책/감사 로그 화면이 같은 guardrail 문구와 회사 경계 기준을 공유하도록 맞췄다.
- Phase 13 문서 세트(README/TASKS/TEST_PLAN/KNOWN_ISSUES/phase 13 scope+handoff)에 부모 테스트 근거를 반영해 관리자 CTA 경계, 감사 전용 진입 경로, 최신 테스트·typecheck·build 통과 상태를 다시 맞췄다.
- ROADMAP/README/TASKS/HANDOFF/KNOWN_ISSUES 기준 최신 활성 작업을 출퇴근 등록 방식 정책 선택 1차로 갱신했다.
- 출퇴근 등록 방식 정책 1차에서 회사 기본 allowed methods(`mobile`, `pc`, `tag`)를 admin 정책 화면·직원 근태 화면·출근/퇴근 API 검증에 같은 기준으로 연결하는 handoff 를 문서화했다.
- scope/handoff/SPEC/QA/HANDOFF/KNOWN_ISSUES 문구를 현재 구현 예시(`mobile`,`pc` 허용 + `mobile`,`tag` candidate + `tag` skeleton 안내)와 부모 테스트 근거에 맞춰 다시 정리했다.
- ROADMAP/README/TASKS/HANDOFF/KNOWN_ISSUES/SPEC/TEST_PLAN/QA_CHECKLIST 기준 최신 활성 작업을 출퇴근 정책 적용대상/우선순위 2차로 갱신했다.
- 출퇴근 정책 2차에서 적용대상을 `company_default`, `workplace`, `department`, `job_type` 4단계로 고정하고, 우선순위를 `회사 기본 < 근무지/지점 < 부서/팀 < 직무/역할` 로 문서화했다.
- 직원 화면/API 가 같은 `effective policy` 계산 기준을 쓰고, 관리자 화면은 적용 인원 preview 와 winner 설명이 가능해야 한다는 handoff 를 추가했다.
- shared helper(`attendance-policy.ts`)와 admin/api/web 테스트를 추가해 정책 scope/priority/effective policy 계산을 회귀 보호한다.
- admin 정책 화면과 `/attendance` 화면은 pass 2 preview/effective policy 문구를 실제로 렌더링하도록 바꿨다.
- API check-in/check-out 은 employee 기준 effective policy 를 계산해 403 details 에 winner source 를 함께 돌려준다.
- 루트 문서(API/SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF)를 부모 검증 결과에 맞춰 다시 맞추고, 실제 조직 데이터 반영·위치정보·장비·외부 HR 연동이 별도 승인 항목임을 더 분명히 적었다.

### Guardrails

- secret, production DB, DNS/custom domain, 유료 리소스, 실제 개인정보 처리, 외부 HR 연동은 계속 별도 승인 대상.
