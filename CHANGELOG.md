# CHANGELOG

## 2026-06-12

### Changed

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
