# 그룹웨어 Phase 11 조직/직원 일반 화면 1차 범위

## 1. 한 줄 정의

Phase 11의 목표는 `/org`, `/employees` 를 `/admin/users` 와 분리된 일반 업무 모듈로 다시 분명하게 세우고, 다음 구현자가 바로 손댈 수 있을 정도로 화면·API·shared contract·테스트의 dev-safe Production-ready (실구현) 기준을 고정하는 것입니다.

이번 단계도 실제 직원 개인정보 연결, 실운영 사용자 권한 변경, production DB 변경은 하지 않습니다.

## 2. 왜 이번 단계가 필요한가

Phase 2에서 인증/조직 기본 route 와 조회 계약은 이미 열어 두었습니다.
Phase 9~10에서는 `/admin/*` 운영 경계와 감사/정책/사용자 candidate 흐름을 더 구체화했습니다.

하지만 현재 저장소에서 `/org`, `/employees` 는 아직 아래 수준에 머물러 있습니다.

- `/org` 는 부서/역할/권한 API 링크와 주의사항만 보여주는 Production-ready (실구현) 중심 화면입니다.
- `/employees` 는 예상 컬럼과 `/api/employees` 링크만 보여주는 Production-ready (실구현) 중심 화면입니다.
- `/admin/users` 는 운영 사용자-직원 연결, 역할 후보, 상태 변경 diff 를 검토하는 관리자 후보 화면입니다.
- shared/API 쪽에는 기본 조회 schema 와 관리자 candidate schema 가 함께 있지만, 일반 조회 화면이 관리자 흐름과 어디서 갈라지는지 문서가 아직 부족합니다.

즉, 이번 단계는 새 기능을 크게 여는 것이 아니라, "조직/직원 일반 화면은 무엇을 보여주고 무엇을 숨겨야 하는지"를 다시 잠그는 단계입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/architecture/phase-2-auth-org-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- `docs/guides/phase-10-admin-audit-pass-2-handoff.md`
- `README.md`
- `apps/web/app/org/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/admin-Production-ready (실구현)-config.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

현재 저장소 기준으로 확인되는 사실은 아래와 같습니다.

- 제품 비전 문서는 `조직/직원` 을 `/org`, `/employees` 로 직접 진입 가능한 독립 1차 업무 모듈로 봅니다.
- UX 원칙 문서는 일반 업무와 관리자 기능을 섞지 말고, 데스크톱에서는 조직/관리 그룹 안에서 `/org`, `/employees` 를 노출하라고 안내합니다.
- `packages/shared/src/contracts.ts` 에는 `appSections` 에 `/employees`, `/org`, `/admin` 이 모두 등록돼 있어 1차 IA 수준의 분리는 이미 있습니다.
- 같은 shared 파일에는 `employeeSchema`, `departmentSchema`, `roleSchema`, `listEmployeesResponseSchema`, `listDepartmentsResponseSchema`, `listRolesResponseSchema`, `listPermissionsResponseSchema` 가 이미 있습니다.
- `apps/api/src/app.ts` 에는 `/api/companies`, `/api/employees`, `/api/departments`, `/api/roles`, `/api/permissions` 조회 endpoint 가 있고, 회사 범위 필터와 권한 검증을 적용합니다.
- `apps/api/test/auth-org.spec.ts` 에는 직원/부서/역할/권한 조회 권한 테스트와 `/api/admin/users` 가 비관리자에게 막혀야 한다는 회귀가 이미 있습니다.
- `/admin/users` 는 운영 사용자-직원 연결과 역할 diff 를 보는 관리자 candidate 화면이므로, `/employees` 가 이 책임을 가져가면 안 됩니다.

## 4. Phase 11에서 고정하는 핵심 결정

### 결정 A. `/employees` 는 "직원 기본 조회"가 중심이고 "운영 사용자 관리"는 하지 않는다.

`/employees` 는 일반 업무 모듈로 아래를 먼저 보여줍니다.

- 직원 이름
- 소속 부서
- 직책/역할 요약
- 재직 상태(`active`, `on_leave`, `offboarded`)
- 기본 업무 맥락용 상태 요약

이번 단계에서 `/employees` 가 하지 않는 일:

- 계정 초대 실행
- 역할 저장
- 권한 직접 변경
- 계정 비활성화 실행
- 감사 로그 열람 허브 역할

즉, `/employees` 는 "사람을 찾고 상태를 이해하는 화면"이지 "운영 계정을 바꾸는 화면"이 아닙니다.

### 결정 B. `/org` 는 "조직 구조 탐색"이 중심이고 정책/권한 운영 화면이 아니다.

`/org` 는 아래 3개 블록을 한 흐름으로 묶습니다.

1. 부서 구조
2. 역할/직책 요약
3. 권한 체계 안내

다만 이번 단계에서 권한은 "카탈로그/안내" 수준으로만 보입니다.
`/admin/users`, `/admin/policies` 처럼 실제 운영 변경 후보를 검토하는 관리자 기능은 `/org` 에 넣지 않습니다.

즉, `/org` 는 "조직을 이해하는 화면"이고, "운영 정책을 바꾸는 화면"이 아닙니다.

### 결정 C. `/admin/users` 와의 경계는 "조회 목적"과 "행동 위험도"로 나눈다.

이번 Phase 에서는 아래 경계를 고정합니다.

1. `/employees`
   - 목적: 직원 기본정보/소속/상태 조회
   - 위험도: 낮음
   - 허용 액션: 목록 보기, 상태 badge 보기, 상세 진입 후보 보기
2. `/org`
   - 목적: 부서/역할/권한 구조 이해
   - 위험도: 낮음
   - 허용 액션: 부서 탐색, 역할 설명 보기, 권한 체계 안내 보기
3. `/admin/users`
   - 목적: 사용자-직원 연결, 역할 후보, 상태 변경 diff 검토
   - 위험도: 높음
   - 허용 액션: candidate 초대/역할 변경/상태 변경 preview

쉽게 말하면, 일반 화면은 "찾아보고 이해하는 곳"이고, 관리자 화면은 "변경 전 검토하는 곳"입니다.

### 결정 D. 모바일에서는 하단 탭 신규 고정보다 "진입점 강화"를 우선한다.

제품/UX 원칙상 `/org`, `/employees` 는 독립 모듈이지만 모바일 하단 탭 기본 4~6개에 바로 넣는 것이 이번 목표는 아닙니다.
이번 단계에서는 아래를 우선합니다.

- 데스크톱/넓은 화면: 사이드바의 조직/관리 그룹에서 명확히 노출
- 모바일/좁은 화면: 홈/대시보드/섹션 카드에서 진입점 제공
- 목록/카드는 작은 화면에서도 읽기 쉬운 한 줄 요약 중심

즉, IA 는 유지하되 모바일 탭 확장보다 읽기 쉬운 목록 구조와 진입 동선을 먼저 맞춥니다.

### 결정 E. dev-safe Production-ready (실구현) 의 완료 기준은 "실데이터처럼 보이되 실운영 변경은 못 하는 상태"다.

이번 Phase 의 Production-ready (실구현) 은 아래를 만족해야 합니다.

- 일반 사용자가 조직/직원 모듈의 역할을 이해할 수 있음
- 관리자 화면과 경계가 문구/CTA/링크에서 분명함
- shared/API/Web 이 같은 필드 이름과 같은 상태값을 봄
- 개인정보 과노출 없이도 목록/카드 UX 를 설명할 수 있음
- 실제 저장/초대/권한 변경/외부 연동 없이 끝남

## 5. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 11 범위 문서 작성
- `/org`, `/employees`, `/admin/users` 경계 재정리
- 다음 구현자가 바로 읽을 수 있는 handoff 문서 작성
- README에 Phase 11 문서 링크 반영

### 구현 준비 범위

다음 구현 카드에서 허용하는 범위는 아래입니다.

- `/org` 조직/부서/역할 조회 Production-ready (실구현) 보강
- `/employees` 직원 목록/상태/소속/직책 조회 Production-ready (실구현) 보강
- 모바일에서도 읽기 쉬운 기본 카드/목록 레이아웃 보강
- shared contract 에 일반 조직/직원 화면용 UI-friendly summary 필드 추가 검토
- API mock/dev-safe 응답에 조직/직원 화면이 바로 쓸 수 있는 요약 필드 추가 검토
- Web/API/shared/test/docs 동기화

### 이번 Phase에서 제외하는 범위

- 실제 직원 개인정보 원문 연결/반입
- 주민번호, 연락처, 급여, 평가, 민감 인사정보 노출
- 실운영 사용자 생성/초대 발송/비활성화 실행
- 실제 역할/권한 저장
- production DB migration 실행
- 외부 HR/SSO/메일 연동
- 관리자 승인 없이 모바일 하단 탭 정보구조 대개편
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 변경

## 6. 화면별 상세 범위

### A. `/employees`

이번 1차에서 먼저 보여줄 요소:

- 상단 요약
  - 화면 목적 한 줄 설명
  - 관리자 화면과의 차이 안내
- 직원 목록 또는 카드
  - 이름
  - 부서명
  - 역할/직책 요약
  - 재직 상태 badge
- 필터 후보
  - 부서
  - 재직 상태
  - 역할/직책
- 빈 상태/제약 안내
  - 개인정보 상세는 이번 범위 아님
  - 변경은 `/admin/users` 후보 화면에서 검토
- 모바일 고려
  - 테이블 고정보다 카드/2줄 요약 우선

이번 1차에서도 하지 않을 것:

- 개인정보 상세 편집
- 권한 저장
- 초대/잠금/비활성화 실행
- 감사 로그 상세 진입 허브화

### B. `/org`

이번 1차에서 먼저 보여줄 요소:

- 상단 요약
  - 조직 구조를 어디까지 보여주는지 안내
- 부서 구조 블록
  - 상위/하위 부서 관계
  - 활성/비활성 상태
- 역할/직책 블록
  - 역할 이름
  - scope 요약
  - 대표 권한 묶음 설명
- 권한 체계 안내 블록
  - 권한 코드를 직접 수정하지 않는 읽기 전용 안내
  - 관리자 권한 변경은 `/admin/users` 또는 `/admin/policies` 로 분리
- 모바일 고려
  - 긴 표보다 접을 수 있는 카드/섹션 우선

이번 1차에서도 하지 않을 것:

- 조직 개편 저장
- 역할 생성/삭제/권한 부여 저장
- 운영 정책 변경
- cross-company 조직 편집

### C. `/admin/users` 와의 연결 방식

일반 화면에서 허용할 연결은 아래 정도로 제한합니다.

- "운영 사용자/권한 검토는 관리자 화면에서 진행" 안내 문구
- 필요 시 `/admin/users` 로 가는 텍스트 링크 또는 보조 CTA
- 단, 일반 목록의 기본 CTA 를 관리자 액션으로 채우지 않음

즉, `/employees` 가 기본적으로 `/admin/users` 의 전면 대문처럼 보이면 안 됩니다.

## 7. shared/API 계약에서 우선 맞출 것

### shared에서 우선 유지/보강할 것

- 기존 유지
  - `employeeSchema`
  - `departmentSchema`
  - `roleSchema`
  - `listEmployeesResponseSchema`
  - `listDepartmentsResponseSchema`
  - `listRolesResponseSchema`
  - `listPermissionsResponseSchema`
- 보강 후보
  - 직원 화면 전용 summary schema
  - 조직 화면 전용 section/card schema
  - 필터 상태 schema
  - 일반 조회 화면용 empty state / notice 문구 상수

### API에서 우선 유지/보강할 것

- 기존 유지
  - `GET /api/employees`
  - `GET /api/departments`
  - `GET /api/roles`
  - `GET /api/permissions`
- 보강 후보
  - 직원 목록용 정렬/필터 query 후보
  - 조직 화면이 바로 쓸 수 있는 부서-역할 묶음 요약 응답
  - 일반 조회용 안내 메타데이터

중요한 점:
이번 단계의 API 보강은 읽기 전용 mock/dev-safe 응답 보강이지, 저장/변경 endpoint 추가가 아닙니다.

## 8. 구현자가 바로 따라갈 대상 파일

### Web

- `apps/web/app/employees/page.tsx`
  - 직원 목록/상태/소속/직책 Production-ready (실구현) 강화
- `apps/web/app/org/page.tsx`
  - 부서/역할/권한 구조 탐색 Production-ready (실구현) 강화
- `apps/web/app/dashboard/page.tsx`
  - 필요 시 조직/직원 진입점 카드 보강
- `apps/web/app/section-page.tsx`
  - 공통 섹션/카드 패턴 재사용 검토
- 필요 시 `apps/web/app/page.tsx`
  - 모바일 진입점 문구/카드 보강
- `apps/web/app/admin/users/page.tsx`
  - 일반 조회와 관리자 candidate 경계 문구 일관성 확인

### Shared

- `packages/shared/src/contracts.ts`
  - 조직/직원 일반 조회에 필요한 summary/filter/section 계약 보강
- `packages/shared/test/contracts.spec.ts`
  - route/schema/status 값 회귀 보강

### API

- `apps/api/src/app.ts`
  - `/api/employees`, `/api/departments`, `/api/roles`, `/api/permissions` 응답 shape 보강
  - 회사 범위와 권한 검증 회귀 유지
- 필요 시 `apps/api/src/lib/org-directory.ts`
  - 일반 조직/직원 화면용 summary helper 분리

### Test

- `apps/api/test/auth-org.spec.ts`
  - 직원/부서/역할/권한 조회 권한 및 응답 회귀 보강
  - `/api/admin/users` 경계 회귀 유지
- 필요 시 `apps/web/app` 또는 `apps/web` 하위 테스트
  - 일반 화면과 관리자 화면 문구/섹션 계약 회귀 추가
- `packages/shared/test/contracts.spec.ts`
  - status/filter/summary schema 회귀 보강

### Docs

- `README.md`
- `docs/architecture/phase-11-org-employees-scope.md`
- `docs/guides/phase-11-org-employees-handoff.md`

## 9. 권장 테스트 시작점

다음 구현자는 최소한 아래 회귀를 먼저 맞추는 것을 권장합니다.

1. Shared
   - `packages/shared/test/contracts.spec.ts`
2. API
   - `apps/api/test/auth-org.spec.ts`
3. Web
   - `/org`, `/employees`, `/admin/users` 의 역할 구분이 문구/구조에서 드러나는지 확인

우선 확인해야 하는 시나리오는 아래입니다.

- `MANAGER`, `HR_ADMIN`, `COMPANY_ADMIN` 같은 읽기 가능 역할은 `/api/employees`, `/api/departments`, `/api/roles` 를 정상 조회함
- `EMPLOYEE` 는 허용되지 않은 조직/권한 조회에서 계속 403 을 받음
- `/api/admin/users` 는 일반 조회 권한이 있어도 비관리자에게 열리지 않음
- 직원 응답에 민감 인사정보 원문이 섞이지 않음
- 조직 화면은 권한 변경 CTA 대신 읽기용 구조 설명을 우선 노출함
- 모바일에서도 카드/목록이 한 화면 폭에서 읽히는 구조를 유지함

## 10. 완료 기준

Phase 11 1차 구현 준비가 끝났다고 보려면 아래를 만족해야 합니다.

1. `/org`, `/employees`, `/admin/users` 의 역할 차이가 문서에 분명히 적혀 있습니다.
2. 일반 조회 화면과 관리자 candidate 화면의 CTA 경계가 분리돼 있습니다.
3. Web/API/shared/test/docs 대상 파일이 구체적으로 적혀 있습니다.
4. dev-safe Production-ready (실구현) 으로 끝나는 기준이 분명합니다.
5. 개인정보/권한/운영 변경 관련 제외 범위가 분리돼 있습니다.
6. 모바일 진입점과 읽기 구조에 대한 기본 원칙이 적혀 있습니다.
7. 다음 구현자가 바로 시작할 수 있는 테스트 시작점이 적혀 있습니다.

## 11. 다음 작업자 handoff

다음 구현자는 아래 순서로 이어가면 됩니다.

1. `docs/product/groupware-vision-roadmap.md`, `docs/ux/groupware-benchmark-principles.md`, 이 문서를 함께 읽어 제품 원칙과 현재 범위를 맞춥니다.
2. `apps/web/app/employees/page.tsx` 와 `apps/web/app/org/page.tsx` 에서 일반 조회 화면의 정보 블록부터 보강합니다.
3. `/admin/users` 와 문구/CTA 경계가 섞이지 않는지 `apps/web/app/admin/users/page.tsx` 도 같이 확인합니다.
4. `packages/shared/src/contracts.ts` 에서 일반 조직/직원 화면이 재사용할 summary/filter 계약을 먼저 정리합니다.
5. `apps/api/src/app.ts` 에서 `/api/employees`, `/api/departments`, `/api/roles`, `/api/permissions` 응답을 문서와 맞춥니다.
6. `apps/api/test/auth-org.spec.ts` 와 `packages/shared/test/contracts.spec.ts` 로 권한 경계와 응답 계약 회귀를 먼저 잠급니다.
7. README 와 handoff 문서까지 같이 갱신해 다음 리뷰어/구현자가 범위를 바로 이해하게 합니다.

## 12. 이번 단계에서 하지 않는 일 재강조

- 실운영 직원 개인정보 연결/반입
- 실운영 사용자 생성/초대/권한 변경/비활성화 실행
- production DB migration 실행
- 외부 HR/메일/SSO 연동
- 관리자 승인 없는 모바일 정보구조 대개편
- secret 입력/교체
- DNS/custom domain 변경
- 비용 증가 리소스 변경

정리하면 Phase 11의 핵심은 하나입니다.

"조직/직원 일반 화면을 관리자 운영 화면과 분리된 독립 업무 모듈로 다시 또렷하게 만들고, 다음 구현자가 안전하게 Production-ready (실구현) 을 확장할 수 있도록 계약을 잠그는 것"입니다.
