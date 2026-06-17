# Phase 44 역할별 권한표

## 한 줄 요약
Phase 44 권한표의 목적은 역할별로 어떤 route 를 열 수 있는지, 어떤 scope 로 읽는지, 무엇이 아직 approval gate 인지 한 표로 빠르게 확인하게 만드는 것이다.

## 읽는 방법
- 허용 route 는 대표 경로만 적었다.
- 차단/비기본 route 는 운영상 섞이면 안 되는 대표 예시를 적었다.
- scope 는 `company`, `branch`, `self-only`, `restricted`, `read-only` 같은 현재 제품 언어를 그대로 쓴다.
- 이 표는 메뉴 노출만이 아니라 route guard / API guard / company+branch scope / capability 기준과 함께 읽어야 한다.

## 역할별 권한표

| 역할 | 대표 허용 route | 대표 비허용/비기본 route | scope 기준 | 비고 |
| --- | --- | --- | --- | --- |
| EMPLOYEE | `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me`, `/org`, `/employees`, `/payroll/me` | `/management`, `/admin*`, 회사 전체 `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/work-items/branch` | 일반 업무 + self-only 급여명세서 preview | 관리자 레인 기본 비노출, `payroll.payslip.read_self` 중심 |
| MANAGER | `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees`, `/management`, `/work-items/branch`, `/payroll`, `/work-items/tax`, `/work-items/legal` | `/admin/users`, `/admin/policies`, restricted `labor` 전체 관리자 레인 | 팀/지점/일부 회사 문맥, branch 운영 보조 | 승인자 문맥 포함, 세무/법무/지점 운영 보조 가능 |
| HR_ADMIN | `/admin/users`, `/attendance`, `/leave`, `/approvals`, `/employees`, `/org`, `/work-items/hr` | `/management`, `/payroll`, `/work-items/labor`, 일부 `/admin/audit-logs` | company, hr 중심 운영 / 일부 restricted grievance 메타데이터 | 사용자/권한/근태/휴가 company 운영 중심, 급여 내부관리·restricted labor 레인은 기본 비허용 |
| COMPANY_ADMIN | `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/management`, `/payroll`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/work-items/branch` | production 실데이터 조치, 외부 기관 직접 연동, destructive 작업 | company, 일부 audit/read scope | 회사 관리자 레인의 가장 넓은 기본 범위 |
| SUPER_ADMIN | COMPANY_ADMIN 범위 전체 + 전역 관리자 route | 승인 없는 production 조치, 외부 연동, destructive 작업 | global + company + audit/read | 가장 넓은 테스트/운영 검토 권한이지만 approval gate 는 그대로 유지 |
| AUDITOR | `/admin/audit-logs`, 읽기 중심 `/dashboard`, `/employees`, `/org`, 일부 `/payroll`, 일부 `work-items/*` 추적 | `/admin/users`, `/admin/policies`, 실제 수정/확정 route, 일반 운영 변경 흐름 | read-only, audit.read, restricted 추적 | 감사 전용 사용자는 `/admin` 전체 허용 사용자가 아님 |

## 모듈별 추가 메모

### 1) `/dashboard`
- 직원 기본 홈이다.
- 관리자도 볼 수 있지만 민감 운영 허브와 같은 책임이 아니다.

### 2) `/management`
- 일반 직원 홈과 분리된 내부관리 허브다.
- 대표 허용 역할: `SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`
- HR_ADMIN 은 실제 운영 작업에 따라 `/admin/users` 계열을 먼저 시작점으로 보는 문맥이 더 자연스럽다.

근거 파일:
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/management/page.tsx`

### 3) `/payroll` 과 `/payroll/me`
- `/payroll` 은 회사/운영 문맥의 내부관리 화면이다.
- `/payroll/me` 는 self-only 명세서 preview 다.
- 두 화면을 같은 급여 조회 권한처럼 쓰면 안 된다.

근거 파일:
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`

### 4) `tax / labor / legal / branch`
- `tax`: 지점 제출 vs HQ 검토 분리
- `labor`: self / branch / restricted 경계가 가장 민감
- `legal`: 계약/갱신/분쟁 metadata 중심
- `branch`: 지점 운영과 본사 운영 연결용

근거 파일:
- `apps/web/app/work-items/work-items-config.ts`

### 5) `/admin/audit-logs`
- `audit.read` 기준 read-only 화면이다.
- 감사 전용 사용자의 대표 진입점이지만, 전체 `/admin` 운영 변경 허용과는 다르다.
- masked preview, company boundary, raw 저장소 정보 비노출 원칙을 지킨다.

근거 파일:
- `apps/web/app/admin/audit-logs/page.tsx`
- `packages/shared/src/admin-access.ts`

## permission 근거 요약
대표 permission 예시:
- `invite.manage`
- `audit.read`
- `attendance.manage`
- `leave.approve`
- `payroll.manage`
- `payroll.review`
- `payroll.payslip.read_self`
- `work_item.review`
- `work_item.audit.read`
- `work_item.grievance.read_restricted`
- `work_item.labor.read_restricted`

실제 매트릭스 근거 파일:
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/contracts.ts`

## approval gate 메모
권한이 있어도 아래는 별도 승인 없이는 진행하지 않는다.
- 실제 급여 지급
- 은행 이체
- 주민번호/계좌번호 입력 확대
- production DB 실데이터 반영
- 외부 세무/노무/법무/회계 계정 연동
- 법령 API 인증키 등록
- DNS/custom domain
- 유료 리소스 생성/증설
- migration
- destructive/force 작업

## 빠른 대조 질문
- EMPLOYEE 에게 `/management` 가 기본 업무처럼 열려 있지 않은가
- AUDITOR 를 관리자 전체 권한처럼 설명하지 않았는가
- `/payroll` 과 `/payroll/me` 를 같은 공개 범위로 적지 않았는가
- labor restricted 범위가 branch/company 와 같은 뜻으로 뭉개지지 않았는가
- route 설명과 permission 설명이 다른 말을 하지 않는가

## 함께 볼 문서
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-operator-runbook.md`
- `docs/guides/phase-44-adoption-checklist.md`
