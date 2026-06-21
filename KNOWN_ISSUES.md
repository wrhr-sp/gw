# KNOWN_ISSUES

## 현재 알려진 제한

### 1. 대부분의 기능은 아직 실사용 완성 전 단계

- 이 프로젝트의 최종 목표는 우리 회사가 실제 사용할 그룹웨어 완제품이다.
- 현재 일부 API와 화면은 skeleton/placeholder지만, 이는 완제품으로 가기 위한 중간 산출물이다.
- 문서와 작업 카드는 “영구 제외”가 아니라 “별도 승인 후 단계적으로 실사용 연결”할 항목을 구분해야 한다.

### 2. production 데이터/secret/DNS/유료 리소스는 미연결 또는 승인 대기 범위

- production DB 실데이터 변경 없음
- secret 입력/교체 없음
- DNS/custom domain 없음
- 유료 리소스 생성·증액 없음
- 실제 개인정보 처리 없음
- 외부 HR 연동 없음
- 실제 운영 파일 업로드 확대/공개 다운로드 없음
- 실제 앱스토어 배포/외부 테스터 배포 없음

### 3. 현재 문서화/검증 기준은 Phase 61 운영 DB provider·비용·승인 체크리스트와 직전 Phase 60 실사용 1차 내부 사용 릴리즈 노트·사용자/관리자 인수인계 단계를 함께 본다.

현재 루트 문서, handoff 는 아래 기준을 함께 설명한다.

- 운영 DB 문서 묶음: `docs/guides/phase-61-operational-db-provider-cost-approval-checklist.md`, `docs/guides/phase-61-operational-db-secret-cloudflare-rollback-runbook.md`, `docs/guides/phase-61-operational-db-admin-handoff-checklist.md`, `db/postgres/README.md`, `docs/architecture/operational-db-initial-setup.md`, `docs/architecture/operational-db-target-architecture.md`
- 현재 권장 초기 조합: `Neon PostgreSQL 1개 + Cloudflare R2 + PostgreSQL Full Text Search`
- 보류 조합: Redis, Meilisearch 는 초기 고정비 절감을 위해 일단 제외하고 필요 시 중기 도입
- provider 판단: Neon 우선, Supabase 대체 후보
- secret 입력 규칙: 채팅/로그/커밋 금지, git ignored `.secrets` 또는 승인된 secret store 만 허용
- 앱 runtime 연결 규칙: `DATABASE_URL` 우선, 없으면 `APP_ENV=preview` 에서 `DATABASE_URL_PREVIEW`, 그 외에는 `DATABASE_URL_PRODUCTION`
- migration/seed 스크립트 규칙: preview target 은 `DATABASE_URL_PREVIEW` 우선, 수동 preview/local 범위에서만 `--allow-preview-fallback` 으로 `DATABASE_URL` fallback 가능, production target 은 `DATABASE_URL_PRODUCTION` 필수이며 `DATABASE_URL` fallback 금지
- 배포 해석 규칙: `workers.dev` 또는 preview 배포는 preview DB 기준, 승인된 custom domain 또는 production 배포 후보는 production DB 기준 후보이며 production migration/seed 는 host 이름과 무관하게 `DATABASE_URL_PRODUCTION` 없으면 진행하지 않음
- rollback 문장 규칙: code rollback 과 DB rollback 분리, DB rollback 은 destructive down migration 보다 snapshot restore 또는 forward-fix 우선
- 완료 기준 분리: `DB 연결 성공` 과 `권한/API guard·audit·backup/restore·rollback·live smoke 확인 완료` 를 같은 뜻으로 적지 않기
- 승인 게이트: provider 최종 선택, 실제 connection string 제공, 유료 리소스 생성·증설, production migration, 민감정보 원문 저장 확대, 외부기관 연동, DNS/custom domain, destructive 작업
- 실사용/route 기준 문서 묶음: Phase 60 릴리즈 노트·인수인계 문서 + Phase 59 최종 정리 문서 + Phase 44 직원/관리자/체크리스트 문서 + Phase 58 상태 문장 문서 + Phase 57 홈/메뉴 IA 문서 + Phase 56 운영 레인 분리 문서

- `/dashboard`, `/menu`, `/management`, `/admin/users`, `/me` 는 같은 상태 체계를 공유하되 같은 책임 화면처럼 읽히면 안 된다.
- `empty` 는 정상 빈 상태일 수 있고, `forbidden` 은 로그인 실패가 아니라 권한/범위 차단 상태로 읽혀야 한다.
- `error` 는 조회/불러오기 실패, `offline` 은 네트워크 불안정으로 구분돼야 한다.
- `preview`, `dev-safe`, `참고용 요약 데이터`, `내부 확인용 데이터` 는 실저장/실발송/실반영 완료처럼 읽히면 안 된다.
- 통합설정 2차 비밀번호는 현재 `docs/guides/unified-settings-secondary-password-preview-flow.md` 기준으로 설명한다. 즉 설정 관련 진입점 공통 4칸 PIN 게이트, 통합설정 첫 탭 `기본 설정`, `내정보 설정` 안 `2차 비밀번호 변경하기` 버튼이 현재 사용자 설명 기준이다.
- 같은 2차 비밀번호 기능이라도 현재 preview UX 설명과 서버 해시 저장/API 검증/DB 반영/감사 로그 설계는 분리해서 적어야 한다.
- 관리자설정 권한 UI는 현재 단일 카드/토글 묶음이라 조회·열람 권한과 변경·부여 권한이 한 화면에서 섞여 보일 수 있다.
- 최신 분리 기준은 `docs/architecture/admin-settings-access-admin-permission-tabs-scope.md`, `docs/guides/admin-settings-access-admin-permission-tabs-handoff.md` 이며, `접근권한` 은 조회·열람·진입, `관리자 권한` 은 변경·부여·관리 의미로 읽어야 한다.
- 같은 주제라도 read 와 manage 를 같은 항목으로 적지 않는다. 예: 감사 로그 열람과 감사/보안 운영 관리는 다른 권한 축이다.
- HR_ADMIN 의 첫 관리자 레인은 `/management` 가 아니라 `/admin/users` 여야 하고, AUDITOR 는 `/admin/audit-logs` read-only 시작점으로 남아야 한다.
- production data, 실제 초대 발송, 실제 비밀번호 운영 전환, 외부 IdP/SSO/SAML/SCIM, production DB 기반 개인 홈 커스터마이징 영구 저장, 외부 메신저/메일/푸시/SMS 연동, background sync, native 배포, production backup/restore 실행, 외부 SIEM/alerting, secret, DNS/custom domain, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 Phase 61 단계에서 남아 있는 제품형/운영형 리스크

- 운영 DB 문서가 provider 선택, 비용 절감, secret 전달 경로, 승인 게이트를 한 번에 보여 주지 못하면 대장이 무엇을 먼저 승인해야 하는지 다시 흩어져 보일 수 있다.
- 운영자 handoff 문서가 restore/rollback/smoke 순서를 짧게 묶지 못하면 다음 작업자가 backup/restore 준비와 production 실복원을 같은 뜻처럼 오해할 수 있다.
- Neon 우선 / Supabase 대체 후보 기준이 문서마다 흔들리면 provider 선택 질문이 다시 길어질 수 있다.
- Redis/Meilisearch 보류를 `영구 제외`처럼 적거나 반대로 `이미 연결됨`처럼 적으면 초기 범위와 중기 범위가 섞일 수 있다.
- `DB 연결 성공` 과 `운영 준비 완료` 를 같은 완료 문장으로 적으면 production migration, backup/restore, rollback, live smoke 상태를 과장하게 된다.
- secret 입력 규칙이 약하게 적히면 connection string 이 채팅/로그/커밋에 남는 실수가 다시 생길 수 있다.
- production DB, 실제 초대 발송, 실제 비밀번호 운영 전환, 외부 IdP/SSO, 실제 급여 지급, production backup/restore 실행, 외부 SIEM/alerting, secret, DNS/custom domain, 유료 리소스, migration, destructive 작업이 문서 속에서 승인 게이트가 아닌 일반 TODO 처럼 읽힐 수 있다.

### 5. 역할봇 스킬 동기화 이슈 이력

- `kanban-automation-recovery` 스킬 누락으로 도담 카드가 crash난 이력이 있다.
- 현재는 도담/이룸/바름/해봄/다온에 동기화했다.
- 앞으로 강제 skill을 붙이는 카드 생성 전 대상 프로필에 skill이 있는지 확인해야 한다.

### 6. 관리자설정 2차 비밀번호는 아직 운영 보안 기능이 아니라 프론트 preview 단계

- 현재 `apps/web/app/_components/mobile-app-shell.tsx` 구현은 `secondaryPasswordValue` local state 와 `isAdminSettingsUnlocked` 화면 상태 비교로만 관리자설정 게이트를 여는 preview 단계다.
- 새로고침/다른 세션/다른 기기 기준 영속 저장이 없고, 서버 verify session, 실패 제한, 잠금, 감사 로그가 없다.
- 운영 버전은 `docs/architecture/admin-settings-secondary-password-server-policy.md` 초안처럼 사용자별 해시 저장 + 짧은 재인증 세션 + 보호 API 재검증 + 실패 횟수 제한 + 감사 로그 구조로 다시 구현해야 한다.
- 일반 개인 설정 전체를 관리자설정과 같은 게이트로 묶을지 여부도 아직 미확정이며, 현재 권장안은 관리자설정/고위험 변경 액션 중심으로 범위를 좁히는 것이다.
- DB migration, hash 알고리즘, pepper secret, 분실 복구 운영 절차, production rollout 은 별도 승인 게이트다.

### 7. 제한적 재귀적 자기개선 루프 적용 범위

- 현재 카드와 직접 관련 있는 문서·테스트·QA·핸드오프 개선에만 적용한다.
- 반복 실수 방지 규칙, 테스트 실패 원인, 다음 작업자가 참고할 체크리스트는 지정 문서에 남긴다.
- 다른 보드/repo/domain/mainbot, 운영 DB, 실데이터, secret, DNS/custom domain, 유료 리소스, 배포/릴리즈/PR merge, 승인 없는 서비스 재시작, 카드 범위 밖 리팩토링은 자기개선 명목으로 자동 처리하지 않는다.
- 필요한 경우 사용자 승인 필요 항목으로 분리한다.

## 임시 대응 원칙

- 검증 실패는 자동 재수정 루프로 돌린다.
- 같은 카드/같은 실패군에서 반려·검증 실패·자동 재수정이 3회 이상 반복되면 새 재수정 카드를 계속 늘리지 않고 싱드가 직접 개입해 원인과 중복 worker 여부를 확인한다.
- 사용자 승인 필요 항목은 blocked/scheduled로 분리해 보고한다.
- 막힘/자동 조치/최종 결과 보고는 싱드가 원본 카드/로그를 확인해 쉬운 한국어로 재해석한다.
- 배포가 포함된 최종 결과 보고에는 live URL과 사용자가 직접 보면 되는 화면/경로/확인 포인트를 포함한다.
