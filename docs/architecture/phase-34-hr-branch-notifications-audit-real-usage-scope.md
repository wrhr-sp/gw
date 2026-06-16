# Phase 34 인사·지점·알림·감사 운영흐름 실사용화 범위

## 한 줄 요약
Phase 34의 목표는
대장이 배포 URL에서 `admin / 1234` 로 로그인한 뒤
`/employees` → `/org` → `/work-items/branch` → `/notifications` → `/admin/audit-logs` 흐름을
같은 회사/지점 scope, 역할 경계, PostgreSQL 전환 준비 상태까지 포함해
정직하게 직접 눌러볼 수 있게 만드는 것입니다.

쉽게 말하면 이번 단계는
이미 있는 인사 조회, 지점 업무 자리, 알림 탭, 감사 로그를
"있긴 한 화면" 에서
"지금 어디까지 실제로 연결돼 있고 어디부터가 placeholder 인지 분명한 운영 흐름"
으로 끌어올리는 단계입니다.

## 왜 지금 Phase 34가 필요한가
Phase 31에서 로그인/홈/경영업무/계정관리 입구를 정리했고,
Phase 32에서 게시판·공지·댓글·문서함 협업 묶음을 정리했고,
Phase 33에서 근태·휴가·전자결재 일반 업무 흐름을 다시 묶었습니다.

그 다음으로 대장이 운영 관점에서 바로 확인하게 되는 묶음은
인사 조회, 지점 운영, 알림, 감사입니다.

현재 코드 스냅샷 기준으로는 아래 간격이 남아 있습니다.

1. `/employees` 와 `/org` 는 route 와 same-origin API가 이미 있지만,
   화면 톤은 아직 "일반 조회 skeleton" 비중이 높고 운영 흐름 설명은 약합니다.
2. 지점 관련 데이터는 `branches` 와 branch scope가 API/공통 contract 안에 있고 `GET /api/branches` 읽기 응답도 있지만,
   사용자-facing route 는 아직 독립 `/branches` 가 아니라 `/work-items/branch` 운영 흐름 중심입니다.
3. `/notifications` 는 현재 same-origin inbox 조회와 unread count 까지는 있으나,
   외부 발송/재시도/전송 성공 추적은 아직 미구현이라 경계를 분리 설명해야 합니다.
4. `/admin/audit-logs` 는 read-only 감사 조회 route 와 필터, masking, 권한 차단 테스트 근거가 있지만,
   운영 감사와 일반 알림/업무 상태가 어디서 갈리는지 문서 정리가 더 필요합니다.
5. 운영 DB 전환 흐름상 employees/branches/notifications/audit_logs 를 PostgreSQL 기준으로 맞추려면,
   이미 DB fallback이 있는 영역과 아직 fixture/placeholder 인 영역을 먼저 분리해 적어야 합니다.

즉 이번 단계는
새 모듈을 크게 늘리는 것이 아니라,
이미 있는 인사·지점·알림·감사 진입점을
"지금 실제로 어디까지 되는지 / 아직 무엇이 dev-safe 인지 / 무엇이 DB 전환과 구현 과제로 남는지"
한 번에 이해되게 만드는 단계입니다.

## 현재 구현 기준 스냅샷

### 지금 코드에서 바로 확인되는 것
- `apps/web/app/employees/page.tsx`
  - 직원 이름, 소속, 역할/직책 요약, 재직 상태를 카드형 일반 조회로 보여 줍니다.
  - `/admin/users` 와의 경계, 개인정보/권한 변경 제외 범위를 화면에 직접 적어 둡니다.
- `apps/web/app/org/page.tsx`
  - 부서 구조, 역할/직책, 권한 체계 안내를 읽기 전용으로 묶고
    `/admin/users`, `/admin/policies` 와 분리합니다.
- `apps/web/app/work-items/branch/page.tsx`
  - 현재 지점 업무 route 는 독립 지점 마스터가 아니라 공통 work item 모듈 page입니다.
  - `work-items-config.ts` 기준으로 "지점 일일 보고/마감 후속" placeholder 자리를 설명합니다.
- `apps/web/app/notifications/page.tsx`
  - 실제 푸시/메일/메신저 발송 완료 화면이 아니라는 점을 분명히 적습니다.
  - same-origin inbox, unread count, 운영 가드레일을 보여 주되 외부 채널 성공처럼 보이지 않습니다.
- `apps/web/app/admin/audit-logs/page.tsx`
  - 감사 전용 진입 의미, 조회 필터, 최근 이벤트 타임라인, masked detail, 회사 경계를 분리해 보여 줍니다.
- `apps/api/src/app.ts`
  - `GET /api/employees`, `GET /api/departments`, `GET /api/roles`, `GET /api/permissions` 가 same-origin 조회 route로 열려 있습니다.
  - `GET /api/branches`, `GET /api/notifications` 가 same-origin 읽기 route 로 열려 있습니다.
  - `GET /api/admin/audit-logs` 가 `audit.read` 권한 기준 read-only 감사 조회로 열려 있습니다.
  - 공통 work item 데이터 안에 `module: "branch"` 인 `work_item_branch_daily_report` 와 branch deadline/document가 있습니다.
- `apps/api/src/lib/operational-org.ts`
  - employees/departments/roles/permissions 는 PostgreSQL operational read fallback이 이미 있습니다.
  - 회사와 branch 목록 집계도 `companies`/`branches` 기준 read path가 일부 존재합니다.
- `apps/api/src/lib/operational-notifications.ts`
  - notifications 는 PostgreSQL operational read fallback 이 있고 실패 시 placeholder 목록으로 내려갑니다.
- `apps/api/src/lib/operational-admin.ts`
  - audit_logs 는 PostgreSQL operational read fallback 이 있고 실패 시 placeholder 감사 목록으로 내려갑니다.
- `packages/shared/src/contracts.ts`
  - 조직/직원 API route, 감사 route, work item branch scope 필드와 module schema가 이미 정의돼 있습니다.

### API 테스트로 이미 확인된 것
`apps/api/test/auth-org.spec.ts` 기준:

- 직원/조직 조회
  - employee directory summaries, filters, admin boundary notices 응답이 이미 검증됩니다.
  - 비관리자에게는 관리자 role filter가 일반 직원 조회에 그대로 노출되지 않습니다.
  - 잘못된 employee directory query는 500이 아니라 400 `VALIDATION_ERROR` 로 차단됩니다.
- 감사 로그
  - `audit.read` 권한 사용자는 masked admin audit logs를 읽을 수 있습니다.
  - `HR_ADMIN` 처럼 감사 권한이 없는 역할은 `/api/admin/audit-logs` 에서 403 을 받습니다.
  - `createdFrom`, `createdTo`, category 필터가 실제 테스트로 확인됩니다.
- 지점 scope
  - branch-only work item 은 HR_ADMIN 공통 목록에서 섞여 나오지 않습니다.
  - branch manager는 자기 지점 관련 tax/work item detail, attachment, review, deadline만 볼 수 있고 company scope 항목은 차단됩니다.

### 지금 바로 체험 가능에 가까운 영역
- `/employees`
  - 직원 카드형 일반 조회와 운영 변경 분리 메시지 확인
- `/org`
  - 부서/역할/권한 읽기 전용 블록과 관리자 경계 확인
- `/work-items/branch`
  - 지점 업무가 독립 앱이 아니라 공통 work item branch module 임을 확인
- `/notifications`
  - same-origin inbox 목록과 unread count, placeholder honesty 를 함께 확인
- `/admin/audit-logs`
  - 필터/타임라인/masked detail/read-only 경계 확인
- `apps/api/test/auth-org.spec.ts`
  - employee directory, branch scope, audit permission 차단 근거 재확인

### 아직 placeholder/dev-safe 비중이 큰 영역
- `/employees`, `/org` 화면 자체의 richer 검색/상세 drill-down/운영 후속 UX
- branch master를 직접 보여 주는 독립 `/branches` 또는 지점 관리 route
- `/notifications` 의 읽음 처리 액션, 발송 채널 연동, 실전송 추적
- `/admin/audit-logs` 의 richer drill-down 과 append 운영 정합성
- notification metadata, audit log append, branch 운영 이력의 운영 DB 일관화

## Phase 34에서 고정할 핵심 결정

### 결정 A. 인사 조회와 관리자 인사 운영은 계속 분리한다.
- `/employees` 는 사람을 찾고 상태를 이해하는 일반 조회입니다.
- `/org` 는 조직 구조와 역할 체계를 읽는 일반 조회입니다.
- `/admin/users` 는 사용자 연결/권한 diff/상태 변경 preview를 검토하는 관리자 흐름입니다.
- 즉 직원 조회와 계정/권한 운영을 한 화면 책임으로 섞지 않습니다.

### 결정 B. 지점 업무는 당장은 독립 마스터보다 branch scope 운영흐름으로 먼저 본다.
- 현재 사용자-facing 지점 진입점은 `/work-items/branch` 입니다.
- 이번 Phase 34 문서에서는 지점을 "지점 업무 보고/마감 후속" 관점으로 먼저 적습니다.
- branch master CRUD, 실호텔/지점 기본정보 관리 UI, 대량 배정 기능은 이번 단계 완료품처럼 적지 않습니다.

### 결정 C. 알림은 same-origin inbox 까지는 현재 구현으로 적고, 외부 발송은 계속 placeholder honesty를 유지한다.
- `/notifications` 는 unread count 와 inbox 항목을 실제 응답으로 보여 주지만 push/메일/메신저 발송 성공 화면처럼 적지 않습니다.
- 현재는 파일럿 inbox 조회, 기대치 관리, 다음 행동 유도 역할까지를 적습니다.
- 읽음 처리 저장, 큐, 채널별 실패/재시도, 외부 provider 연동은 다음 구현 과제로 분리합니다.

### 결정 D. 감사는 read-only 추적과 masked metadata를 먼저 보여 주고 운영 변경과 섞지 않는다.
- `/admin/audit-logs` 는 `audit.read` 기준 별도 허용 route로 유지합니다.
- 감사 로그는 상태 변경·사유·source·masked fields·company boundary를 보여 주되 raw 원문을 노출하지 않습니다.
- 감사 조회 권한과 `/admin/users` 또는 `/admin/policies` 운영 권한을 같은 뜻으로 적지 않습니다.

### 결정 E. PostgreSQL 전환이 일부 진행된 영역과 아직 후속이 큰 영역을 분리해서 적는다.
- employees/departments/roles/permissions 는 `operational-org.ts` 기준 DB read fallback이 이미 있습니다.
- branch는 공통 work item/회사·지점 scope 데이터와 `/api/branches` 읽기 요약이 있지만 독립 branch 운영 저장소와 UI는 완전히 정리되지 않았습니다.
- notifications 는 same-origin API 와 operational read fallback 이 있지만 외부 발송/재시도/상태 변경은 후속 과제입니다.
- audit logs 는 read API, 필터/권한 근거, operational read fallback 이 있지만 richer drill-down 과 append/read 운영 정합성은 후속 과제입니다.

## fit-gap 표

| 구분 | 지금 대장이 직접 눌러볼 수 있는 것 | 아직 남은 gap | 다음 구현 우선순위 |
| --- | --- | --- | --- |
| 인사 조회 | `/employees`, `/org`, same-origin employee/department/role/permission API, 관리자 경계 문구 | richer 검색/상세 drill-down, branch 기반 인사 운영 흐름 연결 약함 | 일반 조회는 유지하고 DB read 근거와 운영 경계 문구를 더 또렷하게 |
| 지점 업무 | `/work-items/branch`, `/api/branches`, branch scope work item/deadline/document 개념, branch manager 경계 테스트 | 독립 `/branches` 화면 없음, branch master/assignment/운영 상태 UX 약함 | branch scope 기반 happy path를 먼저 닫고 필요 시 별도 지점 관리 화면 후속 분리 |
| 알림 | `/notifications`, `/api/notifications`, unread count, inbox preview, `/dashboard`·`/menu` 복귀 흐름 | 읽음 처리 저장, 외부 채널, 재시도/전송 성공 추적 부족 | placeholder를 숨기지 말고 same-origin inbox 범위와 외부 발송 경계를 builder handoff로 명확화 |
| 감사 | `/admin/audit-logs`, 필터/타임라인/masked detail, `audit.read` 권한 차단, operational read fallback | PostgreSQL append 정합성, richer drill-down, notification/branch 연계 감사 정리 부족 | audit_logs DB화와 read-only UX를 같은 언어로 정리 |
| 권한/범위 | employee directory 비관리자 role filter 차단, branch scope 차단, audit.read 전용 허용 | 화면에서 왜 막히는지 더 즉시 읽히는 UX 보강 필요 | 권한 부족/회사 scope/branch scope/placeholder 제한 문구를 route/API/문서에서 통일 |
| 운영 데이터/실연동 | employees 일부 DB read fallback, audit read route, branch scope fixture | notifications DB/API 없음, branch 독립 저장소/감사 append 부족 | `t_959f0f18` 에서 PostgreSQL 기준선 정리 후 `t_c06b17a6` 구현 연결 |

## 대장이 실제로 눌러볼 추천 순서
1. `/login`
   - `admin / 1234` 로 로그인합니다.
2. `/dashboard`
   - 인사 조회, 지점 업무, 관리자 감사 흐름으로 어디서 갈리는지 봅니다.
3. `/employees`
   - 직원 카드형 조회와 `/admin/users` 분리 메시지를 봅니다.
4. `/org`
   - 부서/역할/권한 안내가 읽기 전용인지 봅니다.
5. `/work-items/branch`
   - 지점 업무가 독립 운영 앱이 아니라 branch scope placeholder 임을 확인합니다.
6. `/notifications`
   - 실제 발송이 아니라 안내 탭이라는 점이 숨겨지지 않는지 봅니다.
7. `/admin/audit-logs`
   - 감사 전용 진입, 필터, masked detail, read-only 경계를 봅니다.

## 기능별 UAT 액션 표

| 기능 | route | 권한 | 직접 해볼 액션 | happy path 확인 포인트 | forbidden/empty/error 포인트 | 현재 dev-safe/mock 잔여 |
| --- | --- | --- | --- | --- | --- | --- |
| 직원 조회 | `/employees` | employee.read | 카드, 필터 후보, 관리자 경계 문구 확인 | 직원 상태/소속/역할 요약과 `/api/employees` 링크가 보임 | 관리자 role filter 비노출, 잘못된 query 400 근거 | richer 상세/편집 없음 |
| 조직 조회 | `/org` | department.read/role.read/permission.read | 부서/역할/권한 블록 확인 | 읽기 전용 구조와 관리자 경계가 분리됨 | 운영 변경 CTA 과장 금지 | 조직 개편 저장 없음 |
| 지점 업무 | `/work-items/branch` | branch scope 허용 역할 | 지점 일일 보고/마감 placeholder 확인 | branch module 이 공통 work item 일부로 읽힘 | company scope 아님/권한 없음 차단은 API 테스트 근거로 확인 | 독립 지점 관리 UI 없음 |
| 알림 안내 | `/notifications` | 로그인 사용자 | unread count, inbox 카드, placeholder 안내와 복귀 흐름 확인 | same-origin inbox 와 외부 발송 없음 경계가 동시에 읽힘 | 성공 발송처럼 보이지 않아야 함 | 읽음 처리 저장/외부 채널 없음 |
| 감사 조회 | `/admin/audit-logs` | `audit.read` | 필터, 타임라인, masked detail 확인 | read-only 감사 추적과 company boundary가 읽힘 | `audit.read` 없으면 403 | DB append/read 실정합성과 richer drill-down 후속 |

## 구현 우선순위

### P0. 현재 직접 눌러보는 인사·지점·알림·감사 흐름을 같은 언어로 고정
우선 카드:
- `t_031a7ba6`
- `t_959f0f18`
- `t_c06b17a6`

핵심 범위:
- `/employees`, `/org`, `/work-items/branch`, `/notifications`, `/admin/audit-logs` 현재 route/UAT/guardrail/승인 게이트 문구 고정
- DB 전환 카드와 구현 카드의 완료 기준 분리
- 대장이 직접 인용할 route, action, 권한, 남은 승인 게이트를 같은 말로 정리

### P1. employees/org 일반 조회와 DB read 근거 정렬
- employee directory summaries/filterOptions/notices와 UI 문구 정렬
- branch 이름/부서/역할/권한 정보를 화면에서 더 읽기 쉽게 연결
- `/admin/users` 와 일반 조회 경계 유지

### P2. branch scope 운영흐름을 user-facing route 기준으로 강화
- `/work-items/branch` happy path
- branch manager와 company scope 차단 이유 정리
- 필요 시 독립 `/branches` 여부는 별도 후속으로 분리

### P3. notifications metadata/API 최소 기준선 정리
- 읽음/미읽음/카테고리/발생 source 같은 최소 metadata 설계
- UI placeholder와 실제 저장/발송 범위 분리
- 외부 provider 연동은 승인 게이트 유지

### P4. audit read-only UX와 audit_logs DB 전환 기준 정리
- 필터, category, createdFrom/createdTo, masked fields 설명 고정
- `audit.read` 와 관리자 운영 권한 분리
- branch/employee/notification 변경 흔적이 audit에 어떻게 남을지 builder handoff로 연결

## 이번 단계에서 일부러 안 하는 것
- 주민번호/계좌번호 같은 민감 인사 원문 확대
- 실직원 대량 반입과 운영 권한 저장 확대
- branch master 대량 편집/배정 운영 UI 완성
- 실제 push/메일/SMS/메신저 외부 발송 연동
- raw 감사 원문/secret/storage key 노출
- production DB 실데이터 변경, migration, DNS/custom domain, 유료 리소스, destructive 작업

## 구현자가 먼저 볼 파일
1. `apps/web/app/employees/page.tsx`
2. `apps/web/app/org/page.tsx`
3. `apps/web/app/work-items/branch/page.tsx`
4. `apps/web/app/work-items/work-items-config.ts`
5. `apps/web/app/notifications/page.tsx`
6. `apps/web/app/admin/audit-logs/page.tsx`
7. `apps/api/src/app.ts`
8. `apps/api/src/lib/operational-org.ts`
9. `apps/api/test/auth-org.spec.ts`
10. `packages/shared/src/contracts.ts`

## 승인 게이트
- production DB 실데이터 변경
- secret 입력/교체
- 외부 알림 채널 실연동
- 민감 인사 원문 확대
- migration, DNS/custom domain, 유료 리소스, destructive 작업
