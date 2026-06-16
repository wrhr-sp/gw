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

현재 활성 흐름은 Phase 37 내부 운영 저장흐름·감사 연결 fit-gap 정리다. 직전 Phase 35에서 `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 관리자흐름 UAT 언어를 먼저 정리했고, 직전 Phase 36에서 `/dashboard`·`/menu` shortcut, `/org`·`/employees` 일반 조회, `/admin/users`·`/admin/policies`·`/admin/audit-logs` 운영 검토를 같은 회사 설정 모델 언어로 다시 맞췄다. 이제는 그 위에서 `/documents` 파일 lifecycle, `/admin/audit-logs` storage preview, `work-items`·`/payroll` 민감자료 approval gate 를 같은 내부 운영 저장흐름 언어로 다시 맞추는 것이 다음 체인의 핵심이다.

현재 상태 요약:

- `/login`, `/dashboard`, `/management`, `/admin/users` 는 이미 앞선 Phase 문서에서 입구 영역으로 정리됐다.
- `/employees`, `/org`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 는 현재 운영자 설정·회사 정책·권한 관리 fit-gap 의 핵심 증거 화면이다.
- `apps/api/test/auth-org.spec.ts` 기준으로 home shortcuts, roles/permissions, employee directory guard, admin users/policies/audit 경계 근거가 이미 존재한다.
- `/dashboard`·`/menu` 는 회사 고정 shortcut 과 권한 기반 사용자 전용 shortcut 을 같은 API 기준으로 읽는다.
- `/admin/users` 는 실저장 화면이 아니라 role diff, 상태 변경 preview, 고위험 권한 후보, dev-safe action form 을 먼저 보여 준다.
- `/admin/policies` 는 current/candidate/capability/audit preview 와 회사 설정 4묶음 모델을 정책 기준 화면으로 보여 준다.
- `/admin/audit-logs` 는 `audit.read` 기준 read-only 흐름으로 유지된다.
- 새 기준 문서는 `docs/architecture/phase-36-admin-settings-company-policy-permission-fit-gap-scope.md`, `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md` 다.
- 이번 문서의 목적은 placeholder 와 승인 게이트를 숨기지 않고, "지금 바로 읽을 수 있는 운영자 설정 read model" 과 "아직 편집 UI/실저장/외부 연동이 없는 영역"을 분리해 builder/reviewer/tester/docs/ops가 같은 Phase 36 언어를 쓰게 만드는 것이다.

2026-06-16 Phase 37 fit-gap 메모:

- 바로 확인 가능한 영역: `/documents`, `/admin/audit-logs`, `/management`, `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, 관련 storage lifecycle/masked audit/approval gate 테스트 근거.
- 현재 체인은 `t_e8e6bea1`(재검증 완료) → `t_ecfe96a8`(문서화) → `t_b73a7e86`(release gate) 순서로 이어진다.
- 2026-06-16 parent 재검증 기준으로 focused API/Web 회귀, shared/api/web typecheck·build·OpenNext build·root `pnpm check`, local preview smoke 가 다시 통과했다.
- 로컬 preview smoke 는 기존 8790 포트에 남아 있던 workerd listener 충돌 때문에 127.0.0.1:8791 로 옮겨 재실행했다. 문서에는 "8790 고정"이 아니라 "충돌 없는 동일 build 산출물 포트" 기준으로 남기는 편이 정확하다.
- `apps/api/src/lib/document-storage.ts` 기준으로 파일명 정규화, 허용 MIME, 최대 파일 크기, 안전한 object key 생성 규칙이 이미 있다.
- `apps/api/src/lib/operational-collab.ts` 기준으로 문서 파일은 `storageProvider`, `storageStatus`, `checksumSha256`, `archived` 의미로 읽는 구조가 있다.
- `apps/api/src/lib/operational-admin.ts` 기준으로 감사 로그는 raw 원문이 아니라 masked before/after preview, `maskedFields`, `storageRef(fileId/spaceId/versionId/storageStatus)` 수준으로 읽는다.
- `apps/api/test/auth-org.spec.ts` 기준으로 raw `storageKey`, bucket, signed URL 비노출 검증과 `upload-init` → `upload-complete` → `download-init` → delete 상태 전이 검증 흔적이 있다.
- parent 재검증에서 다시 본 route 는 `/documents`, `/management`, `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 이고 모두 local preview smoke 기준 200 이었다.
- gap 이 큰 영역: backup/export 외부 반출 기능 부재, migration 실행 기준 미정리, production bucket/secret 미연결, 민감 원문 저장 확대 금지, payroll/work-items 첨부를 실원문 열람처럼 오해할 수 있는 copy 잔여.
- 새 기준 문서는 `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`, `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md` 다.
- 이번 문서의 목적은 placeholder 와 승인 게이트를 숨기지 않고, "지금 바로 읽을 수 있는 내부 운영 저장 read model" 과 "아직 export/backup/migration/실운영 연결이 없는 영역"을 분리해 builder/reviewer/tester/docs/ops가 같은 Phase 37 언어를 쓰게 만드는 것이다.

2026-06-16 Phase 36 fit-gap 메모:

- 바로 확인 가능한 영역: `/dashboard`, `/menu`, `/employees`, `/org`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, 관련 shortcut/roles/permissions/admin guard 테스트 근거.
- 2026-06-16 parent 재검증 기준으로 focused web/admin 테스트, `apps/api/test/auth-org.spec.ts`, shared/api/web typecheck, `pnpm check`, Next/Cloudflare build, local preview admin host smoke 가 다시 통과했다.
- 역할별 현재 판정은 `COMPANY_ADMIN` 운영 허브+admin users/policies 허용, `HR_ADMIN` users/policies 허용+audit 차단, `AUDITOR` audit-only 허용, `MANAGER`/`EMPLOYEE` privileged shortcut·`/management`·admin API 차단으로 다시 고정한다.
- gap 이 큰 영역: 회사 shortcut 정책 편집 UI 부재, 사용자 shortcut 편집/정렬/저장 UI 부재, role/permission/shortcut source 를 한 화면에서 읽는 관리자 read model 부족, 실권한 저장/대량 초대/외부 IdP 부재.
- 다음 우선순위는 shortcut read model 보강 → `/admin/users` 에 role/permission/company settings 연결 근거 보강 → `/dashboard`·`/menu` 와 `/admin/policies` 정책 설명 연결 보강 순서다.
- 대장이 실제로 가장 짧게 볼 추천 순서는 `/login` → `/dashboard` → `/menu` → `/employees` → `/org` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/management` 다.
- 일반 조회 화면과 운영 검토 화면은 계속 분리하고, 실제 권한 저장/외부 IdP/실메일/production 정책 저장은 계속 승인 게이트로 남긴다.

2026-06-16 Phase 35 fit-gap 메모:

- 바로 사용 가능에 가까운 영역: `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs`, 관련 payroll/work item/audit 권한 테스트 근거.
- skeleton 잔여가 큰 영역: 실세액/실지급/외부 신고, tax 직접 신고/외부 세무사 연동, labor/legal 실제 원문 저장, dedicated compliance queue 부재.
- 다음 우선순위는 payroll/work-items/audit 운영 DB 기준선 정리 → `/payroll`·`/payroll/me` preview/self-only 경계 설명 보강 → `/work-items/tax`·`/labor`·`/legal` happy path 보강 → compliance 전용 route 필요 여부 판단 → audit read-only UX/DB 근거 재정리 순서다.
- 대장이 실제로 가장 짧게 볼 추천 순서는 `/login` → `/dashboard` → `/management` → `/payroll` → `/payroll/me` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → `/admin/audit-logs` 다.
- 테스트 기준 계정은 dev/test/UAT 전용 `admin / 1234` 로 문서화하되 production 금지와 초기 비밀번호 변경/seed 교체 필요를 함께 적는다.
- 일반 조회 화면과 `경영업무`/감사 허브는 분리 유지하고, 민감 리스크 상세는 지정 관리자/감사 담당자만 보게 한다.

현재 Phase 35 준비 상태 요약:

- `/management` 는 급여·세무·노무·법무·감사 진입 카드와 roleScope 문구가 이미 있다.
- `/payroll`, `/payroll/me` 는 same-origin API와 권한 테스트 근거가 있고, preview/self-only 분리 문구가 이미 있다.
- `apps/api/src/lib/operational-management.ts` 와 `db/postgres/migrations/0003_phase35_payroll_workitems_admin.sql` 이 추가되어 payroll/work-items metadata 를 PostgreSQL operational 패턴으로 읽을 준비가 됐다. migration 이 적용된 DB 에서는 `/api/payroll*`, `/api/work-items*` 가 DB metadata 를 merge 하고, 아직 테이블이 없는 preview/old DB 에서는 degraded fallback 으로 계속 200 을 유지한다.
- `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 은 공통 work item 기반 route 로 존재하고, `apps/api/test/work-items.spec.ts` 기준 visibility/restricted/scope 차단 근거가 있다.
- `/admin/audit-logs` 는 `audit.read` 기준 필터/타임라인/masked detail/read-only 경계를 이미 읽을 수 있고, 현재 컴플라이언스 진입을 겸한다.
- 2026-06-16 parent 재검증 기준으로 Phase 35 focused API/Web 테스트, shared/api/web typecheck, Next/Cloudflare build, root `pnpm check`, local preview smoke 가 다시 통과했다. 문서에 적는 수동 UAT 시작점은 admin host root 가 아니라 일반 host `/dashboard` → `/management` 흐름으로 잡는 편이 정확하다.
- 남은 큰 잔여는 실급여/외부 신고/이체, tax 직접 신고/외부 세무사 연동, labor/legal 실제 원문 저장, dedicated compliance route 부재, audit richer drill-down 과 운영 DB 정합성이다.
- 우선 참고 문서: `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`, `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`, `TASKS.md`, `KNOWN_ISSUES.md`.

2026-06-15 Phase 29 기획 메모:

- 이번 Phase의 목적은 실제 외부 법무/계약 원문 시스템이 아니라 `legal` 모듈 안에서 계약 검토 요청/계약 갱신/분쟁 후속 자리를 먼저 고정하는 것이다.
- 법무 종류 차이는 `contract_review`, `contract_renewal`, `hotel_management_agreement`, `lease_agreement`, `service_agreement`, `partner_agreement`, `personal_data_processing_agreement`, `dispute_intake`, `claim_response`, `insurance_case`, `incident_legal_follow_up` 같은 category 확장으로 먼저 본다.
- 주 상태는 계속 공통 상태(`draft` → `todo` → `in_progress` → `waiting_review` → `blocked` → `done` → `archived`)를 쓰고, 법무 intake/갱신/분쟁 의미는 `intakeStatus`, `renewalStatus`, `disputeStatus`, `approvalGate` 같은 보조 필드 후보로 푼다.
- 본사 법무/운영 담당은 여러 지점 계약 요청/갱신 예정/분쟁 후속을 더 넓게 보고, 지점 관리자는 자기 지점 관련 요청과 보완 요청만 보며, 감사는 상태 변경/접근 흔적을 read-only 로 본다.
- 외부 변호사/보험사/기관 전달은 실제 연동이 아니라 승인 게이트와 준비 상태를 정리하는 단계로만 본다.
- 실제 계약 원문 저장 확대, 외부 변호사/보험사/기관 연동, 실분쟁 원문 업로드, production 법무 데이터 입력은 이번 단계에서도 승인 게이트다.
- 우선 참고 문서: `docs/architecture/phase-29-legal-management-pass-1-scope.md`, `docs/guides/phase-29-legal-management-pass-1-handoff.md`, `docs/architecture/phase-28-tax-management-pass-1-scope.md`, `docs/guides/phase-28-tax-management-pass-1-handoff.md`.

2026-06-15 Phase 29 빠른 확인 순서:

- `/work-items` — 공통 업무 허브에서 법무가 빠지고 일반 업무 entry 만 남는지 본다.
- `/management` — 경영업무 허브에서 민감 모듈 진입과 허용 역할 안내가 분리되는지 본다.
- `/work-items/legal` — 법무 category, 본사 법무/운영 담당/지점 관리자/감사 visibility, 승인 게이트 문구를 본다.
- `/api/work-items?module=legal` — 법무 목록에서 category, 계약 검토/갱신/분쟁 설명이 읽히는지 본다.
- `/api/work-items/:id/reviews` — 내부 검토/보완 요청/승인 대기가 공통 review skeleton 으로 남는지 본다.
- `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts` — legal visibility 와 role boundary 가 회귀 테스트로 남아 있는지 본다.

2026-06-15 Phase 28 빠른 확인 순서:

- `/work-items` — 공통 업무 허브에서 `tax` 모듈 entry 가 먼저 보이는지 본다.
- `/work-items/tax` — 세무 category, 본사 세무 담당/지점 관리자/감사 visibility, 승인 게이트 문구를 본다.
- `/api/work-items?module=tax` — 세무 목록에서 category, 지점 제출 상태, review/deadline 설명이 읽히는지 본다.
- `/api/work-item-deadlines` — 세무 일정이 공통 마감 구조 안에서 읽히는지 본다.
- `/api/work-items/:id/reviews` — HQ 검토/반려/보완 요청이 공통 review skeleton 으로 남는지 본다.
- `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts` — tax visibility 와 role boundary 가 회귀 테스트로 남아 있는지 본다.

2026-06-15 Phase 28A 선행 메모:

- 급여는 labor 하위가 아니라 독립 `payroll` 모듈로 분리했고, 세무는 이번 Phase 28에서 다시 공통 `work item` 기반 `tax` 모듈 확장으로 다룬다.
- 급여 preview 금액과 실지급 확정값, 원천세/4대보험 placeholder 와 실세무 신고를 같은 뜻으로 쓰지 않는다.
- 지점 관리자가 급여 period detail 전체를 직접 보는 역할이 아니라는 경계와, 이번 세무 카드에서 자기 지점 제출 상태만 보는 경계가 서로 충돌하지 않아야 한다.

2026-06-13 Phase 27 기획 메모:

- 이번 단계는 실제 노무 사건 처리 시스템을 여는 것이 아니라, 기존 공통 `work item` 엔진 위에 계약/연차/수당/고충/징계/사고/퇴사 skeleton 을 올리는 문서 단계다.
- labor 종류는 `employment_contract`, `work_condition_change`, `leave_balance_adjustment`, `allowance_review`, `overtime_review`, `grievance`, `discipline_review`, `incident_report`, `offboarding_clearance` 같은 category 확장으로 먼저 본다.
- 주 상태는 계속 공통 상태(`draft` → `todo` → `in_progress` → `waiting_review` → `blocked` → `done` → `archived`)를 쓰고, labor intake 의미는 `intake_status` 같은 보조 필드로 푼다.
- 본사 노무 담당은 여러 지점 labor 이슈를 더 넓게 보고, HR은 계약/조건/퇴사 follow-up 같이 맞닿은 범위를 보며, 지점 관리자는 자기 지점 직원 관련 요약/자료요청/후속조치만 보고, 일반 직원은 자기 요청/안내/제출 범위만 본다. 이번 후속 수정으로 EMPLOYEE self-scope labor placeholder(`work_item_labor_leave_balance_adjustment`) 1건을 실제 API fixture/test 에도 열어 문서와 구현을 다시 맞췄다.
- evidence 와 사건 메모는 1차에서 원문 저장이 아니라 metadata 중심(`evidenceSummary`, `confidentialityLevel`, `requiresAcknowledgement`)으로 시작한다.
- 외부 노무/법무/급여 연동, 실제 계약서/징계/사고 원문 저장, production DB 실데이터 입력은 이번 단계에서도 승인 게이트다.

2026-06-13 Phase 27 빠른 확인 순서:

- `/work-items` — 공통 업무 허브에서 공통 work item/API 골격, 모바일/PC 진입 구조를 먼저 본다.
- `/work-items/labor` — labor category, 본사 노무 담당/HR/지점 관리자/일반 직원 visibility, 승인 게이트 문구를 본다.
- `/api/work-items?module=labor` — 계약/정정/수당/고충/징계/사고 placeholder 와 `viewerScope`, `confidentialityLevel` 설명을 본다. EMPLOYEE 에게는 self-scope `work_item_labor_leave_balance_adjustment` 가 실제로 내려오는지 함께 확인한다.
- `apps/api/test/work-items.spec.ts` — restricted labor 상세/목록 경계가 역할별로 붙들려 있는지 본다.
- `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx` — 허브/labor route copy 와 승인 게이트 문구가 회귀 테스트로 남아 있는지 본다.
- 마지막으로 실제 계약서/징계/사고/급여/production data 가 여전히 승인 게이트로 남았는지 다시 본다.

2026-06-13 Phase 26 기획 메모:

- 이번 단계는 별도 회의 솔루션을 만드는 것이 아니라, 기존 공통 `work item` 엔진 위에 직원 lifecycle 과 HR meeting 구조를 올리는 문서 단계다.
- meeting 종류는 `onboarding`, `one_on_one`, `hr_interview`, `performance_review`, `grievance`, `training_coaching`, `branch_ops_meeting`, `offboarding` 같은 category 확장으로 먼저 본다.
- 주 상태는 계속 공통 상태(`draft` → `todo` → `in_progress` → `waiting_review` → `blocked` → `done` → `archived`)를 쓰고, meeting 일정 의미는 `schedule_status` 같은 보조 필드로 푼다.
- 본사 HR 은 여러 지점 HR meeting/lifecycle 을 더 넓게 보고, 지점 관리자는 자기 지점 직원 관련 일정/후속조치 요약만 보며, 일반 직원은 자기 일정과 자기 follow-up 만 본다.
- 메모와 회의록은 1차에서 원문 저장이 아니라 metadata 중심(`notes_preview`, `private_note_exists`, `confidentiality_level`)으로 시작한다.
- 외부 캘린더/메일/메신저 연동, 실제 민감 인사기록 원문 저장, production DB 실데이터 입력은 이번 단계에서도 승인 게이트다.

2026-06-13 Phase 26 빠른 확인 순서:

- `/work-items` — 공통 업무 허브에서 공통 work item/API 골격, 모바일/PC 진입 구조를 먼저 본다.
- `/work-items/hr` — 직원 lifecycle, meeting 유형, 본사 HR/지점 관리자/일반 직원 visibility 문구를 본다.
- `/api/work-items?module=hr` — onboarding / one_on_one / training_coaching / grievance placeholder 와 `viewerScope`, `confidentialityLevel` 설명을 본다.
- `apps/api/test/work-items.spec.ts` — grievance restricted 상세가 MANAGER 403, HR_ADMIN 200 으로 붙들려 있는지 본다.
- `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx` — 허브/HR route copy 와 승인 게이트 문구가 회귀 테스트로 남아 있는지 본다.
- 마지막으로 외부 캘린더/실민감 원문 저장/production data 가 여전히 승인 게이트로 남았는지 다시 본다.

2026-06-13 Phase 25 기획 메모:

- 이번 단계는 개별 세무/노무/법무 기능 완성보다, 여러 운영 업무를 공통 card/document/review/deadline 구조로 담을 그릇을 먼저 고정하는 문서 단계다.
- 공통 상태 초안은 `draft` → `todo` → `in_progress` → `waiting_review` → `blocked` → `done` → `archived` 로 단순하게 시작하고, 모듈 차이는 `module`, `category`, `review_required`, `contains_sensitive_data` 같은 필드로 푼다.
- 공통 접근 제어는 회사 + 지점/호텔 + 역할 + capability 4축으로 보고, 일반 근무자 / 지점 관리자 / 본사 관리자 / 감사 사용자 가시 범위를 분리한다.
- 모바일 하단 탭은 늘리지 않고 `홈`/`메뉴`, PC sidebar 에 `인사`·`세무`·`노무`·`법무`·`지점 업무` 또는 공통 `업무` 그룹으로 자리를 잡는 방향을 먼저 본다.
- 실민감 문서 원문, production DB 실데이터, 실제 신고/제출 자동화, 외부 세무/노무/법무 계정 연동은 이번 단계에서도 승인 게이트다.

2026-06-13 Phase 25 구현 메모:

- `packages/shared/src/contracts.ts` 는 이제 `appRoutes.workItems` 와 work item/document/attachment/review/deadline/audit schema·response type 을 export 한다.
- `packages/shared/src/admin-access.ts` 는 공통 업무 읽기/관리/검토/마감/감사 권한을 역할 매트릭스에 연결한다.
- `apps/api/src/app.ts` 는 회사/지점/역할 scope 를 설명하는 placeholder work item 데이터와 `/api/work-items`, `/api/work-items/:id`, `/api/work-items/:id/documents`, `/api/work-items/:id/attachments`, `/api/work-items/:id/reviews`, `/api/work-item-deadlines` read-only skeleton route 를 제공한다.
- `apps/web/app/work-items/*` 와 `apps/web/dashboard-page-content.tsx`, `apps/web/app/dashboard/dashboard-config.ts`, `apps/web/app/mobile-pwa-config.ts`, `apps/web/app/menu/page.tsx`, `apps/web/app/management/page.tsx` 는 공통 업무 허브와 HR/세무/노무/지점 업무, 그리고 분리된 경영업무 진입을 모바일/웹에서 실제 route 로 확인하게 만든다.
- 현재 재검증 근거는 `pnpm typecheck`, `pnpm test`, `pnpm build` 통과이며, 특히 `apps/api/test/work-items.spec.ts`, `apps/api/test/auth-org.spec.ts`, `apps/web/work-items.test.tsx`, `apps/web/work-items-boundary.test.tsx`, `apps/web/dashboard-boundary.test.tsx`, `apps/web/admin-preview-guard.test.ts`, `apps/web/middleware.test.ts` 가 공통 업무 엔진의 역할별 가시 범위·민감 첨부 제한·audit 비노출·메뉴/허브 연결·경영업무 route guard 를 붙들고 있다. 새 화면 route 는 `/work-items`, `/work-items/hr`, `/work-items/tax`, `/work-items/labor`, `/management`, `/work-items/legal`, `/work-items/branch` 다.

2026-06-13 Phase 24 기획 메모:

- 이번 단계는 실데이터 투입이나 전사 오픈이 아니라, 작은 대표 사용자 묶음으로 파일럿을 어떻게 시작할지 기준을 고정하는 문서 단계다.
- 추천 파일럿 순서는 사용자 안내 → `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → 필요 시 `/org`·`/employees` → 운영자 동행 `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → 피드백 수집이다.
- 대장이 가장 먼저 확인할 것은 "누구로 시작할지 / 어떤 순서로 볼지 / live·API·PWA·mobile 무엇을 다시 볼지 / 무엇이 승인 필요인지" 4가지다.
- 모바일 `홈` 은 고정 필수 메뉴와 사용자 커스터마이징 층을 같이 설명하고, `메뉴`·PC sidebar 와 같은 기능 registry 를 공유한다는 원칙을 유지한다.
- 호텔 위탁경영사 기준 `지점/호텔 코드` 구조, `지점 배정 필요` 안내, 지점 업무 대 지점 관리 권한 분리를 문서 용어로 먼저 고정한다.
- 사용자 안내/운영자 매뉴얼/장애 대응/피드백 수집 문서는 긴 설명보다 파일럿 당일 바로 따라갈 체크리스트 형태가 우선이다.
- 실제 재검증 결과 채우기는 다음 구현/리뷰/테스트/운영 카드 범위이고, 이번 기획 카드는 baseline 근거와 확인 순서를 고정하는 데 집중한다.

2026-06-13 Phase 24 구현 메모:

- `apps/web/app/_components/mobile-app-shell.tsx` 는 좁은 화면에서 하단 탭 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개를 고정하고, 넓은 화면에서는 접기/펼치기 가능한 왼쪽 사이드바로 같은 메뉴군을 보여 준다.
- `apps/web/app/menu/page.tsx` 는 모바일 `메뉴` 탭에서 여는 전체 기능 선택 화면이며, 기본 업무/내 정보·조회/협업 placeholder 를 같은 IA 로 묶는다.
- `apps/web/app/messenger/page.tsx`, `apps/web/app/mail/page.tsx`, `apps/web/app/notifications/page.tsx` 는 실제 외부 연동 전 단계의 placeholder honesty 를 명확히 보여 준다.
- 관리자 메뉴는 일반 사용자 모바일 하단 탭에 섞지 않고 admin host/sidebar 전용 정보구조로 분리한다.

2026-06-13 Phase 23 구현 메모:

- `apps/web/app/dashboard/page.tsx` 는 이제 고정 EMPLOYEE preview 가 아니라 실제 `gw_session` 쿠키를 읽어 admin/audit CTA 를 계산한다.
- 대시보드 본문은 `apps/web/dashboard-page-content.tsx` 로 분리했고, 여기서 관리자 운영 검토 레인을 `/dashboard` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서로 직접 보여 준다.
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 는 모두 Phase 23 eyebrow 로 올렸고, 일반 조회 대 운영 검토 경계(`/employees` vs `/admin/users`, `/boards`·`/documents` vs `/admin/policies`)와 감사 전용 진입 의미를 각 화면에서 따로 읽히게 했다.
- 대장이 실제로 눌러 볼 때는 `/dashboard` 의 관리자 CTA 확인 → `/admin` 운영 허브 → `/admin/users` 운영 변경 후보 → `/admin/policies` current/candidate 비교 → `/admin/audit-logs` read-only 감사 추적으로 읽으면 현재 화면 순서를 가장 빠르게 이해할 수 있다.
- 회귀 테스트는 `apps/web/dashboard-boundary.test.tsx`, `apps/web/admin-console-pass1.test.tsx`, `apps/web/admin-preview-guard.test.ts`, `apps/api/test/auth-org.spec.ts` 로 다시 확인했고 `pnpm --filter @gw/shared test -- contracts.spec.ts`, `pnpm --filter @gw/web typecheck`, `pnpm --filter @gw/web build:cf`, `pnpm check` 까지 통과했다.

2026-06-13 Phase 22 실제 업무 흐름 통합 1차 메모:

- 지금 저장소를 "실제 하루 업무 흐름을 설명할 수 있는 상태"로 보고, "실운영 업무 저장/반영이 이미 끝났다"처럼 과장하지 않는다.
- 기준 순서는 `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees` 다.
- `/dashboard` 상단 액션 순서와 각 업무 화면 설명이 같은 뜻인지 먼저 본다.
- `packages/shared/src/mobile-contracts.ts`, `apps/mobile/src/workflow.ts` 의 mobile 흐름 helper 가 Web 설명과 충돌하지 않는지 본다.
- 직원 화면 상태 안내는 empty/error/forbidden/offline 4축을 유지하되 실제 사용자 언어로 풀어도 뜻이 변하지 않게 적는다.
- `/admin/*` 운영 화면은 일반 직원 핵심 흐름으로 섞지 않고 Web/admin 책임으로 남긴다.
- production DB, secret, custom domain, 외부 초대, 외부 HR, 실태그 장비, 스토어 사용, push, 실기기 권한은 구현 TODO가 아니라 승인 checklist 로 계속 분리한다.
- 다음 구현자는 `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md`, `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md`, `apps/web/app/login/page.tsx`, `apps/web/app/dashboard/page.tsx`, `apps/web/app/attendance/page.tsx`, `apps/web/app/leave/page.tsx`, `apps/web/app/approvals/page.tsx`, `apps/web/app/boards/page.tsx`, `apps/web/app/documents/page.tsx`, `apps/web/app/me/page.tsx`, `apps/web/app/org/page.tsx`, `apps/web/app/employees/page.tsx`, `packages/shared/src/mobile-contracts.ts`, `apps/mobile/src/workflow.ts` 를 순서대로 보면 기준을 가장 빨리 확인할 수 있다.

대장이 Phase 22 문서를 볼 때 바로 확인할 쉬운 순서:
1. `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md` 에서 포함 범위/제외 범위/결정사항/승인 목록을 먼저 본다.
2. `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md` 에서 기준 업무 순서, 상태 안내, mobile 비교, 승인 필요를 쉬운 말로 본다.
3. `ROADMAP.md`, `TASKS.md`, `KNOWN_ISSUES.md` 에서 현재 활성 체인과 남은 리스크를 본다.
4. `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md` 에서 route/상태/검증 기준이 같은 뜻인지 본다.
5. `apps/web/app/login/page.tsx`, `apps/web/app/dashboard/page.tsx`, `apps/web/app/attendance/page.tsx`, `apps/web/app/leave/page.tsx`, `apps/web/app/approvals/page.tsx`, `apps/web/app/boards/page.tsx`, `apps/web/app/documents/page.tsx`, `apps/web/app/me/page.tsx`, `apps/web/app/org/page.tsx`, `apps/web/app/employees/page.tsx` 에서 실제 흐름 톤을 본다.
6. `packages/shared/src/mobile-contracts.ts`, `apps/mobile/src/workflow.ts`, `apps/mobile/src/session-bridge.ts`, `apps/mobile/src/base-url.ts` 에서 mobile 계약과 guardrail 을 본다.
7. production DB, secret, DNS/custom domain, 유료 리소스, 외부 초대, 외부 HR, GPS/실태그 단말, App Store/Play Console/TestFlight/EAS, push, 실기기 권한이 모두 승인 게이트로 남았는지 확인한다.

대장이 Phase 22 route 를 실제로 따라 볼 때 추천하는 쉬운 순서:
1. `/login` — placeholder 로그인/세션 설명과 역할별 첫 이동이 과장 없이 적혀 있는지 본다.
2. `/dashboard` — 상단 액션이 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서로 읽히고, 그 뒤 `/org`·`/employees` 조회 마무리 흐름과 일반 사용자 대 관리자 경계가 같은 뜻인지 본다.
3. `/attendance` 와 `/leave` — 정책 안내, 미허용 이유, placeholder 제한이 숨겨지지 않는지 본다.
4. `/approvals` — 승인 lane 이 기본 전원 공용 흐름처럼 읽히지 않는지 본다.
5. `/boards` 와 `/documents` — 협업 묶음 설명은 하되 게시판 책임과 문서 보관 책임을 섞지 않는지 본다.
6. `/me` — `me` 조회와 `auth.logout`/session clear 설명이 과장 없이 이어지는지 본다.
7. `/org` 와 `/employees` — 현재 회사 구조/직원 상태를 읽는 일반 조회 흐름인지, 운영 변경 화면처럼 과장하지 않는지 본다.
8. `/admin/users`, `/admin/policies`, `/admin/audit-logs` — 직원 연결/역할 diff, 정책 source/candidate, 감사 read-only 경계가 분리돼 있는지 본다.
9. `/admin` — 관리자 허브 설명이 일반 사용자 흐름과 분리되고 `audit.read` 경계가 유지되는지 본다.
10. 마지막으로 live/PWA/API/mobile 근거를 다시 모아, 각 route 가 "지금 확인 가능 / 아직 skeleton / 승인 필요" 중 어디인지 한 번에 읽히는지 본다.

보관 메모: Phase 16 파일럿 초안 문서를 다시 볼 때 바로 확인할 쉬운 순서:
1. `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md` 의 "2026-06-13 기준 현재 판정 요약"에서 되는 것 / 아직 안 되는 것 / 승인 필요를 먼저 본다.
2. `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md` 의 "2026-06-13 기준 빠른 판정표"와 "preview/live URL에서 바로 볼 쉬운 순서"를 본다.
3. `/dashboard` → `/boards` → `/boards/board_notice` → `/boards/board_general` → `/posts/board_post_board_general_employee_employee` → `/documents` → `/admin/policies` → `/admin/audit-logs` 순서가 현재 문서와 같은 뜻인지 본다.
4. live `.workers.dev` 직접 fetch 가 미확인이면 이를 완료처럼 읽지 말고, `pnpm check`, `pnpm --filter @gw/web build:cf`, local preview smoke 가 대체 근거로 남았는지 확인한다.
5. production data, secret, DNS/custom domain, 유료 리소스, 실제 운영 파일 업로드 확대가 아직 승인 게이트인지 다시 확인한다.

대장이 지금 저장소에서 바로 눌러 볼 쉬운 확인 포인트:
1. `apps/mobile/src/screens.ts` 에서 각 화면이 어떤 guardrail 을 갖는지 본다.
2. `packages/shared/src/mobile-contracts.ts` 에서 각 화면의 `apiRoutes` 와 `access` 메모를 본다.
3. `apps/mobile/src/base-url.ts` 에서 production 은 approved origin only, preview/development 는 명시적 origin 또는 mock adapter 만 허용하는지 본다.
4. `apps/mobile/src/session-bridge.ts` 에서 plain async storage 와 Web cookie copy 금지 기준, session clear 가 어떤 guardrail 로 묶이는지 본다.
5. `apps/mobile/src/workflow.ts` 에서 일반 사용자 첫 액션이 `attendance`, 승인자 첫 액션이 `approvals` 로 나뉘는지 본다.

대장이 Phase 22를 빠르게 판정할 6가지 질문:
1. 직원이 로그인한 뒤 무엇을 먼저 하고 어디로 이어지는지 바로 보이는가?
2. `/dashboard` 상단 액션과 실제 업무 화면 설명이 같은 순서를 가리키는가?
3. 출퇴근·휴가·결재·공지/문서·내 정보·조직 확인 흐름이 끊기지 않는가?
4. mobile/PWA/Web 설명이 같은 contract 와 guardrail 을 가리키는가?
5. empty/error/forbidden/offline 상태가 쉬운 말로 바뀌어도 의미가 섞이지 않는가?
6. `/admin/*` 와 production data/secret/실연동이 별도 승인 게이트로 남아 있는가?

위 6개 질문 중 하나라도 애매하면 아직 실제 업무 흐름 통합 1차 문서가 덜 정리된 상태로 본다.

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
- singde 최종보고 카드는 direct delivery 전에 `사용자 보고 필요`, direct delivery 후에는 `사용자 보고 완료`와 `[singde-direct-delivery]` 코멘트를 남겨 watcher가 누락을 재확인할 수 있게 한다.
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
