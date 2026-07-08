# 프론트엔드 전체 화면 전면 리팩토링 큐

## 한 줄 요약

이 문서는 `docs/ux/werehere-frontend-ui-standard.md`를 최상위 기준으로 기존 전체 프론트엔드 화면을 전면 리팩토링하기 위한 화면 단위 실행 큐다.

## 산정 기준

- 기준 문서: `docs/ux/werehere-frontend-ui-standard.md`
- 공통 컴포넌트: `apps/web/app/_components/ui-standard.tsx`
- 디자인 시스템: `apps/web/design-system/*`
- 목록 화면 표준: `PageHeader → FilterBar → DataTable → Pagination`
- 상세 화면 표준: `PageHeader → SummaryCard → DetailSection → AttachmentPanel → AuditLogPanel`
- 작성 화면 표준: `PageHeader → FormSection → ActionButtonGroup → ConfirmDialog`
- ZITADEL 원칙: 프론트엔드는 ZITADEL API를 직접 호출하지 않고 위아히어 백엔드 API만 호출한다.
- 오픈소스 UI 원칙: shadcn-admin, shadcn/ui, Tailwind CSS, TanStack Table/Query, React Hook Form, Zod, Tremor는 그대로 복사하지 않고 위아히어 디자인 시스템으로 재구성한다.

## 전수 스캔 결과

- 총 route page: 71개
- `legacy-custom`: 28개
- `legacy-shell`: 43개
- `standard-baseline`: 0개
- P0: 3개
- P1: 58개
- P2: 10개

`legacy-shell`은 기존 `PageShell` 또는 `SurfaceSection` 계열을 쓰고 있지만 새 최상위 UI 표준의 공통 컴포넌트 패턴으로 아직 재분류되지 않은 화면이다. `legacy-custom`은 화면별 개별 구조가 더 강한 화면이다.

## 실행 원칙

1. 한 번에 전체 화면을 동시에 수정하지 않는다.
2. 화면 또는 기능 묶음 단위 PR로 진행한다.
3. 각 PR은 표준 컴포넌트 적용, 기존 API/권한/저장 흐름 회귀 방지, focused test, `pnpm check`, `build:cf`, PR CI, preview smoke, Obsidian 백업까지 완료한다.
4. production/custom domain, production DB 실데이터, secret, DNS, 유료 리소스는 별도 승인 게이트로 둔다.
5. UI 문구는 사용자가 말한 것만 유지하며 개발/상태 설명문을 화면에 추가하지 않는다.

## P0: 기준 샘플/고위험 화면

기준 샘플/고위험 화면. 계정관리와 사원정보관리처럼 권한·계정·저장 흐름이 있는 화면을 먼저 표준화한다.

1. `/admin` — `apps/web/app/admin/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
2. `/admin/users` — `apps/web/app/admin/users/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
3. `/management-support/hr` — `apps/web/app/management-support/hr/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검

### P0 권장 순서

1. `/admin/users` 계정관리 기준 샘플 완성
2. `/admin` 관리자 허브의 메뉴/요약 구조를 기준 샘플과 정렬
3. `/management-support/hr` 사원정보관리의 기존 TanStack Table·상세패널·탭 구조를 공통 컴포넌트로 승격

## P1: 업무 확장 핵심 화면

업무 확장 핵심 화면. 전자결재, 문서, 사업장/지점, ERP/경영지원, 운영/관리 화면을 기능 단위로 전환한다.

1. `/Advertising Business` — `apps/web/app/Advertising Business/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
2. `/CEO` — `apps/web/app/CEO/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
3. `/Management Support` — `apps/web/app/Management Support/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
4. `/Operations Management` — `apps/web/app/Operations Management/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
5. `/Place of business/[branchId]` — `apps/web/app/Place of business/[branchId]/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
6. `/Place of business` — `apps/web/app/Place of business/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
7. `/Sales Management` — `apps/web/app/Sales Management/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
8. `/Strategic Planning` — `apps/web/app/Strategic Planning/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
9. `/admin/audit-logs` — `apps/web/app/admin/audit-logs/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
10. `/admin/policies` — `apps/web/app/admin/policies/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
11. `/advertising-business` — `apps/web/app/advertising-business/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
12. `/approvals/[documentId]` — `apps/web/app/approvals/[documentId]/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
13. `/approvals` — `apps/web/app/approvals/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
14. `/boards/[boardId]` — `apps/web/app/boards/[boardId]/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
15. `/branches` — `apps/web/app/branches/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
16. `/dashboard` — `apps/web/app/dashboard/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
17. `/documents` — `apps/web/app/documents/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
18. `/forbidden` — `apps/web/app/forbidden/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
19. `/home` — `apps/web/app/home/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
20. `/login` — `apps/web/app/login/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
21. `/management-support/attendance` — `apps/web/app/management-support/attendance/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
22. `/management-support/branches` — `apps/web/app/management-support/branches/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
23. `/management-support/budget` — `apps/web/app/management-support/budget/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
24. `/management-support/erp/accounting-mappings` — `apps/web/app/management-support/erp/accounting-mappings/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
25. `/management-support/erp/billings` — `apps/web/app/management-support/erp/billings/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
26. `/management-support/erp/evidence` — `apps/web/app/management-support/erp/evidence/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
27. `/management-support/erp/expenses` — `apps/web/app/management-support/erp/expenses/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
28. `/management-support/erp/integration-events` — `apps/web/app/management-support/erp/integration-events/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
29. `/management-support/erp/journals` — `apps/web/app/management-support/erp/journals/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
30. `/management-support/erp/ledgers` — `apps/web/app/management-support/erp/ledgers/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
31. `/management-support/erp/payment-records` — `apps/web/app/management-support/erp/payment-records/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
32. `/management-support/erp/taxes` — `apps/web/app/management-support/erp/taxes/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
33. `/management-support/erp/vendors` — `apps/web/app/management-support/erp/vendors/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
34. `/management-support` — `apps/web/app/management-support/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
35. `/management-support/payroll` — `apps/web/app/management-support/payroll/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
36. `/management-support/sales-purchases` — `apps/web/app/management-support/sales-purchases/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
37. `/management-support/vendors` — `apps/web/app/management-support/vendors/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
38. `/management` — `apps/web/app/management/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
39. `/menu` — `apps/web/app/menu/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
40. `/offline` — `apps/web/app/offline/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
41. `/operations-management` — `apps/web/app/operations-management/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
42. `/operations/branches/[branchId]` — `apps/web/app/operations/branches/[branchId]/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
43. `/operations` — `apps/web/app/operations/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
44. `/` — `apps/web/app/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
45. `/place-of-business/[branchId]` — `apps/web/app/place-of-business/[branchId]/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
46. `/place-of-business` — `apps/web/app/place-of-business/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
47. `/posts/[postId]` — `apps/web/app/posts/[postId]/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
48. `/refresh` — `apps/web/app/refresh/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
49. `/sales-management` — `apps/web/app/sales-management/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
50. `/sales` — `apps/web/app/sales/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
51. `/strategic-planning` — `apps/web/app/strategic-planning/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
52. `/uat` — `apps/web/app/uat/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
53. `/vehicle-operation` — `apps/web/app/vehicle-operation/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
54. `/work-items/branch` — `apps/web/app/work-items/branch/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
55. `/work-items/hr` — `apps/web/app/work-items/hr/page.tsx` — 현재 `legacy-custom` — 목록/상세/작성 패턴 점검
56. `/work-items/labor` — `apps/web/app/work-items/labor/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
57. `/work-items/legal` — `apps/web/app/work-items/legal/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
58. `/work-items/tax` — `apps/web/app/work-items/tax/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검

### P1 권장 묶음

1. 관리자/감사/정책: `/admin/policies`, `/admin/audit-logs`
2. 전자결재/문서/업무: `/approvals`, `/approvals/[documentId]`, `/documents`, `/work-items/*`
3. 사업장/지점/운영: `/branches`, `/Place of business`, `/operations`, `/operations/branches/[branchId]`
4. 경영지원/ERP: `/management-support/*`, `/management-support/erp/*`
5. 포털/허브/상태 화면: `/home`, `/dashboard`, `/menu`, `/offline`, `/refresh`, 부서 포털 alias 화면

## P2: 기존 협업·개인업무 핵심 화면

기존 협업·개인업무 핵심 화면. 메일, 메신저, 게시판, 직원/조직, 근태/휴가/급여 등 회귀 위험이 큰 화면은 샘플 완성 후 진행한다.

1. `/attendance` — `apps/web/app/attendance/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
2. `/boards` — `apps/web/app/boards/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
3. `/employees` — `apps/web/app/employees/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
4. `/leave` — `apps/web/app/leave/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
5. `/mail` — `apps/web/app/mail/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
6. `/me` — `apps/web/app/me/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
7. `/messenger` — `apps/web/app/messenger/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화
8. `/org` — `apps/web/app/org/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
9. `/payroll/me` — `apps/web/app/payroll/me/page.tsx` — 현재 `legacy-shell` — 목록/상세/작성 패턴 점검
10. `/payroll` — `apps/web/app/payroll/page.tsx` — 현재 `legacy-shell` — 폼/작성 패턴 표준화

### P2 권장 묶음

1. 협업 핵심: `/mail`, `/messenger`, `/boards`, `/boards/[boardId]`
2. 직원/조직/개인: `/employees`, `/org`, `/me`
3. 근태/휴가/급여: `/attendance`, `/leave`, `/payroll`, `/payroll/me`

## 첫 구현 PR 후보

다음 구현 PR은 `P0-1 /admin/users 계정관리 기준 샘플 완성`으로 둔다.

완료 기준은 다음과 같다.

- 목록: `PageHeader → FilterBar → DataTable → Pagination`
- 상세: `PageHeader → SummaryCard → DetailSection → AttachmentPanel → AuditLogPanel`
- 작성/생성: `PageHeader → FormSection → ActionButtonGroup → ConfirmDialog`
- 계정 생성 Wizard, 계정 수정, 상태 변경, 권한 템플릿, 접근범위, 로그인 보안, 감사로그를 계정관리 화면 안에서 표준 패턴으로 재배치
- 기존 관리자 API, 권한, 감사로그, 저장/재조회 흐름 유지
- `/login` 회원가입 신청/승인 흐름은 되살리지 않음
- frontend에서 ZITADEL 직접 호출 금지 유지
