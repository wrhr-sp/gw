# 관리자 권한/역할 데이터 모델 1차 범위

## 1. 한 줄 정의

이번 1차의 목표는 관리자 화면 접근 기준을 단순 host 분리에서 끝내지 않고, `roleCode + permissionCode + adminScope` 기준으로 같은 뜻으로 막는 최소 골격을 고정하는 것입니다.

쉽게 말하면:
- 누가 `/admin` 으로 들어갈 수 있는지
- 누가 `/admin/audit-logs` 까지 볼 수 있는지
- 어떤 관리자 메뉴를 누구에게 보여 줄지
- API 와 Web 이 같은 기준으로 판단하는지
를 먼저 흔들리지 않게 맞추는 단계입니다.

이번 단계도 실제 운영 사용자 권한 저장, production DB migration, 실데이터 변경, secret 입력은 하지 않습니다.

## 2. 왜 이번 단계가 필요한가

부모 작업에서 아래는 이미 맞춰졌습니다.

- 일반 사용자 host 와 관리자 host 가 분리돼 있다.
- 익명 사용자는 `/admin*` 에서 `/login` 으로 차단된다.
- 일반 로그인 사용자는 `/forbidden` 으로 차단된다.
- 감사 전용 사용자는 `/admin/audit-logs` 만 허용하는 preview guard 가 있다.
- 관리자 CTA 와 admin skeleton 화면 구조가 이미 있다.

하지만 지금은 host 경계가 강해진 반면, 역할/권한 기준은 아직 1차 골격 수준이라 다음 같은 위험이 남아 있습니다.

1. Web route guard 와 API guard 가 서로 다른 기준으로 벌어질 수 있다.
2. 관리자 역할과 감사 권한을 같은 것으로 취급해 버리면 실제 접근 행렬이 흐려진다.
3. 관리자 CTA 노출, admin hub 카드 노출, `/admin/*` 직접 접근 차단이 각각 따로 움직일 수 있다.
4. 계약 문서에는 역할/권한/범위 정보가 있는데, 구현이 그 의미를 끝까지 재사용하지 않을 수 있다.

즉, 이번 1차는 새 보안 시스템을 크게 만드는 작업이 아니라,
이미 있는 역할/권한 skeleton 을 관리자 접근 통제 기준으로 다시 정리하는 작업입니다.

## 3. 이번에 다시 확인한 현재 사실

확인한 근거 파일:

- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/dashboard-boundary.test.tsx`
- `apps/web/admin-skeleton-config.ts`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `docs/guides/phase-13-admin-console-pass-1-handoff.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

현재 저장소 기준으로 확인되는 사실:

### 역할 코드

현재 role code 는 아래 6개입니다.

- `SUPER_ADMIN`
- `COMPANY_ADMIN`
- `HR_ADMIN`
- `MANAGER`
- `EMPLOYEE`
- `AUDITOR`

### 권한 코드

현재 permission code 는 아래처럼 관리자/업무 권한이 함께 들어 있습니다.

예시:
- `employee.read`
- `employee.write`
- `invite.manage`
- `audit.read`
- `attendance.manage`
- `board.manage`
- `document.space.manage`

### 관리자 데이터 skeleton

shared contract 에 이미 아래 골격이 있습니다.

- `adminScope`: `global | company | audit`
- `adminUserSummary`: `roleCodes`, `permissions`, `employeeLinkStatus`, `highRiskPermissions`, `statusChangePreview`, `roleChangePreview`
- `adminPolicySummary`: `capability`, `reasonRequired`, `diffPreview`
- `adminAuditLog`: `maskedFields`, `companyBoundary`, `source`, `sensitiveMasked`

즉, 관리자 데이터 모델 뼈대는 이미 있고 이번 단계는 이것을 접근 기준까지 연결하는 일입니다.

### 현재 접근 기준의 장점과 틈

장점:
- Web preview guard 는 익명/일반/관리자/감사 전용 경계를 이미 분리한다.
- API 는 `requireAdminRole`, `requirePermission`, `ensureCompanyBoundary` 를 갖고 있다.
- dashboard 는 관리자 shortcut 과 감사 shortcut 을 따로 분기한다.

틈:
- `/api/admin/users`, `/api/admin/policies` 는 `requireAdminRole` 기준이다.
- `/api/admin/audit-logs` 는 `requirePermission("audit.read")` 기준이다.
- 그런데 현재 Web preview guard 는 `HR_ADMIN` 같은 관리자 역할을 `/admin/audit-logs` 화면에도 통과시킬 수 있어, Web 과 API 의 기준이 어긋날 여지가 있다.

이번 카드의 핵심은 이 어긋남을 명시적인 1차 기준으로 정리하는 것입니다.

## 4. 이번 1차에서 고정하는 핵심 결정

### 결정 A. 관리자 접근 판단의 기본 단위는 `roleCode` 하나가 아니라 `roleCode + permissionCode + adminScope` 다.

정리 기준:

1. `roleCode`
   - 사용자의 기본 역할 묶음이다.
2. `permissionCode`
   - 실제 화면/API 접근 capability 판단 기준이다.
3. `adminScope`
   - 관리자 UI 설명과 목록 요약에서 보여 줄 관리자 범위 라벨이다.
   - `global`, `company`, `audit` 로 유지한다.

쉽게 말하면:
- 역할은 "누구 유형인지"
- 권한은 "무엇을 할 수 있는지"
- scope 는 "어느 운영 범위를 보는지"
를 나누는 것입니다.

### 결정 B. `/admin` 계열 route 는 3개 영역으로 나눠 판단한다.

1. 관리자 허브/사용자/정책
   - `/admin`
   - `/admin/users`
   - `/admin/policies`
2. 감사 조회
   - `/admin/audit-logs`
3. 일반 사용자 업무 route
   - `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/org`, `/employees`

이 3개는 같은 관리자 화면처럼 보여도 접근 기준을 분리합니다.

### 결정 C. 1차 접근 행렬은 아래로 고정한다.

| 사용자 유형 | `/admin` | `/admin/users` | `/admin/policies` | `/admin/audit-logs` |
| --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | 허용 | 허용 | 허용 | 허용 |
| `COMPANY_ADMIN` | 허용 | 허용 | 허용 | 허용 |
| `HR_ADMIN` | 허용 | 허용 | 허용 | 차단 |
| `AUDITOR` | 차단 | 차단 | 차단 | 허용 |
| `MANAGER` | 차단 | 차단 | 차단 | 차단 |
| `EMPLOYEE` | 차단 | 차단 | 차단 | 차단 |
| 익명 | `/login` | `/login` | `/login` | `/login` |

이유:
- `HR_ADMIN` 은 운영 관리자지만 현재 permission map 에 `audit.read` 가 없다.
- `AUDITOR` 는 관리자 전체가 아니라 감사 조회 전용 흐름이다.
- 따라서 감사 화면은 `admin role` 이 아니라 `audit.read` 를 실제 판단 기준으로 삼아야 한다.

### 결정 D. navigation 과 route guard 와 API guard 는 같은 행렬을 따라야 한다.

이번 단계에서 맞춰야 하는 것:

1. dashboard shortcut 노출
2. admin hub 카드 노출/비노출 또는 disabled 설명
3. Web route guard
4. API guard
5. 테스트 기대값
6. 문서 표기

즉, 한쪽에서는 보이는데 다른 쪽에서는 막히는 상태를 줄이는 것이 목표입니다.

### 결정 E. high-risk 권한은 1차에서 고정 목록으로 유지한다.

1차 고정 목록:
- `invite.manage`
- `audit.read`
- `board.manage`
- `document.space.manage`

이 값은 관리자 허브/사용자 검토 요약에서 "주의해서 봐야 하는 권한" 용도로 유지합니다.

이번 단계에서는 이 high-risk 목록을 실제 정책 엔진으로 확대하지 않고,
화면/계약/API 가 같은 목록을 공유하는 수준까지만 맞춥니다.

### 결정 F. 이번 1차는 dedicated DB 모델 확장이 아니라 contract/helper 정렬 우선이다.

우선순위:

1. shared contract 와 helper 에서 공통 기준을 먼저 만든다.
2. Web/API 가 그 기준을 재사용하게 한다.
3. 필요하면 테스트 fixture 와 skeleton config 를 같은 기준으로 정리한다.
4. production DB migration, 실권한 저장, 실제 role assignment write 는 하지 않는다.

즉, 이번 단계의 중심은 "새 테이블 추가"가 아니라 "같은 기준을 여러 곳에서 다시 쓰게 만드는 것"입니다.

## 5. 포함 범위

### 문서/기획 범위

- 관리자 권한/역할 데이터 모델 1차 scope 문서 작성
- 접근 행렬, nav 노출 조건, route/API guard 기준 정리
- 구현자가 바로 따라갈 파일/테스트/승인 게이트 handoff 작성
- 루트 문서(TASKS/HANDOFF/KNOWN_ISSUES/TEST_PLAN/QA_CHECKLIST/SPEC/DATA_MODEL 등) 최신 기준 반영

### 다음 구현 카드에서 허용하는 범위

- shared helper 또는 contract 기준 정리
- Web preview guard 를 permission 기준까지 맞추는 수정
- dashboard/admin hub 노출 조건 정리
- admin skeleton config 에 역할/권한 설명 보강
- API/Web/shared 테스트 기대값 정렬
- 문서/QA/HANDOFF 동기화

### 이번 단계에서 제외하는 범위

- 실제 운영 사용자 권한 부여/회수 저장
- production DB migration 실행
- 실데이터 role assignment 변경
- 초대 메일 실제 발송
- 개인정보 원문 연결
- secret 입력/교체
- DNS/custom domain 변경
- 외부 IAM/SSO/감사 시스템 연동
- 유료 리소스 생성/증설

## 6. 구현 기준 상세

### A. 공통 기준을 먼저 한 곳에 모은다.

권장 방향:
- shared 쪽에 관리자 접근 helper 또는 상수 묶음을 둔다.
- Web 과 API 가 가능한 한 같은 기준을 참조한다.

최소한 아래 질문에 같은 답이 나오게 해야 합니다.

- 이 role 이 admin hub 에 들어갈 수 있는가?
- 이 user 가 audit log 를 볼 수 있는가?
- 이 화면 CTA 를 보여 줘야 하는가?
- 이 API 는 어떤 permission 또는 admin capability 를 요구하는가?

### B. `/admin/audit-logs` 는 permission 우선 기준으로 맞춘다.

이번 1차에서 추천하는 해석:
- audit log 는 `audit.read` 가 있는 사용자만 허용
- `AUDITOR` 는 허용
- `COMPANY_ADMIN`/`SUPER_ADMIN` 은 permission 에 `audit.read` 가 있으므로 허용
- `HR_ADMIN` 은 기본 차단

필요하면 UI 에서는 "감사 로그는 별도 권한이 필요함" 같은 안내를 둡니다.

### C. admin hub 는 모든 관리자 카드가 무조건 보이게 두지 않는다.

권장 기준:
- `/admin/users`, `/admin/policies` 카드는 admin role 에게 노출
- `/admin/audit-logs` 카드는 `audit.read` 권한이 있는 사용자에게만 노출하거나, 권한 없음 안내 상태로 분리

이렇게 해야 dashboard 와 hub 와 직접 접근 정책이 같은 방향으로 움직입니다.

### D. 일반 사용자 기본 흐름과 관리자 운영 흐름을 계속 분리한다.

유지할 원칙:
- 일반 사용자 하단 탭/기본 메뉴에 관리자 기능을 섞지 않음
- `/employees`, `/org` 는 일반 조회 책임 유지
- 실제 운영 변경/권한 diff/감사 후보는 `/admin/*` 문맥 유지

## 7. 권장 테스트 포인트

최소 회귀:

1. 익명 사용자는 `/admin*` 직접 접근 시 `/login`
2. `EMPLOYEE`, `MANAGER` 는 `/admin*` 에서 `/forbidden`
3. `COMPANY_ADMIN` 은 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 허용
4. `HR_ADMIN` 은 `/admin`, `/admin/users`, `/admin/policies` 허용, `/admin/audit-logs` 차단
5. `AUDITOR` 는 `/admin/audit-logs` 만 허용
6. dashboard shortcut 이 role/permission 기준과 같은 뜻으로 노출
7. admin hub 의 audit log 카드 노출 규칙이 실제 접근 기준과 어긋나지 않음
8. `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` 가 같은 접근 행렬을 설명 가능하게 유지
9. `adminScope`, `highRiskPermissions`, `requiredPermission` 또는 동등 개념이 문서/계약/API/Web 에서 같은 뜻으로 읽힘

권장 명령:

- `pnpm --filter @gw/web test -- admin-preview-guard dashboard-boundary admin-console-pass1`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/web build`
- 필요 시 `pnpm check`

## 8. 이번 단계에서 하지 말아야 할 것

- 실제 운영 사용자 role assignment 저장
- 실제 권한 부여/회수 실행
- production audit log 저장 정책 변경
- production DB migration 실행
- secret 입력/교체
- 외부 감사/보안 시스템 연동
- 실제 관리자 메뉴를 일반 사용자 업무 메뉴에 섞는 변경

## 9. 구현 완료로 볼 최소 기준

- 관리자 접근 행렬이 문서로 명확해진다.
- Web route guard 와 API guard 와 nav 노출 조건이 같은 뜻으로 설명된다.
- `HR_ADMIN` 과 `AUDITOR` 의 차이가 더 분명해진다.
- `/admin/audit-logs` 접근 기준이 `audit.read` 중심으로 정리된다.
- root 문서, 테스트 기준, handoff 가 다음 구현자가 그대로 따라갈 수준으로 정리된다.

## 10. 별도 승인 필요 항목

아래는 여전히 별도 승인 없이는 하면 안 됩니다.

1. 실제 운영 권한 저장/변경 실행
2. production DB migration 실행
3. 실제 개인정보 원문 연결
4. secret 입력/교체
5. 외부 IAM/SSO/감사 시스템 연동
6. DNS/custom domain 변경
7. 유료 리소스 생성·증설

정리하면 이번 1차의 핵심은 하나입니다.
관리자 화면의 문을 host 만으로 나누는 데서 멈추지 않고,
role/permission/scope skeleton 기준으로 같은 뜻으로 열고 닫는 구조를 먼저 굳히는 것입니다.
