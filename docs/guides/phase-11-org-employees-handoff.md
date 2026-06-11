# Phase 11 조직/직원 일반 화면 1차 handoff

한 줄 요약:
Phase 11은 `/org`, `/employees` 를 일반 업무용 조회 화면으로 다시 분명하게 세우고, `/admin/users` 는 운영 변경 후보 검토 화면으로 남겨 두는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

현재 저장소에는 조직/직원 관련 API와 기본 route 는 이미 있습니다.
하지만 일반 화면은 아직 너무 얇고, 관리자 화면과의 차이가 구현자 머릿속에만 있는 상태에 가깝습니다.

지금 확인된 상태는 아래와 같습니다.

- `/employees` 는 직원 조회 placeholder 수준입니다.
- `/org` 는 부서/역할/권한 API 링크를 묶어 둔 placeholder 수준입니다.
- `/admin/users` 는 사용자-직원 연결, 역할 diff, 상태 변경 preview 를 검토하는 관리자 candidate 화면입니다.
- API/shared/test 에는 기본 조직/직원 조회 계약과 관리자 users candidate 계약이 같이 들어 있습니다.

그래서 이번 단계는 기능을 크게 늘리기보다, 일반 조회 화면과 관리자 화면의 역할을 다시 또렷하게 나누는 데 초점을 둡니다.

## 2. 이번 단계에서 꼭 기억할 경계

### `/employees`

이 화면은 아래를 먼저 보여주는 일반 조회 화면입니다.

- 직원 이름
- 부서
- 역할/직책 요약
- 재직 상태
- 필요한 경우 조직/관리 모듈로 이어지는 읽기용 링크

하지 않는 것:

- 계정 초대 실행
- 역할 저장
- 권한 변경 실행
- 계정 비활성화 실행

쉽게 말하면 `/employees` 는 "직원을 찾고 상태를 이해하는 곳"입니다.

### `/org`

이 화면은 아래를 먼저 보여주는 조직 구조 탐색 화면입니다.

- 부서 구조
- 역할/직책 구조
- 권한 체계 안내

하지 않는 것:

- 조직/역할 저장
- 운영 정책 변경
- 관리자 candidate 액션 실행

쉽게 말하면 `/org` 는 "조직 구조를 이해하는 곳"입니다.

### `/admin/users`

이 화면은 운영 변경 후보를 검토하는 관리자 화면입니다.

- 사용자-직원 연결 상태
- 역할 before/after
- 고위험 권한 노출
- 상태 변경 diff
- 감사 candidate preview

즉, `/admin/users` 는 계속 "바꾸기 전 검토하는 곳"으로 남아 있어야 합니다.

## 3. 다음 구현자가 가장 먼저 손댈 파일

### Web

- `apps/web/app/employees/page.tsx`
- `apps/web/app/org/page.tsx`
- 필요 시 `apps/web/app/dashboard/page.tsx`
- 필요 시 `apps/web/app/page.tsx`
- `apps/web/app/admin/users/page.tsx` (경계 문구 확인용)
- 필요 시 `apps/web/app/section-page.tsx`

### Shared

- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`

### API

- `apps/api/src/app.ts`
- 필요 시 `apps/api/src/lib/org-directory.ts`

### Test

- `apps/api/test/auth-org.spec.ts`
- `packages/shared/test/contracts.spec.ts`
- 필요 시 web 쪽 조직/직원 화면 회귀 테스트

## 4. 우선 고정할 화면/API 흐름

다음 구현자는 아래 흐름부터 맞추면 됩니다.

- `/employees`
  - 직원 목록/카드
  - 부서/상태/역할 요약
  - 필터 후보
  - 관리자 변경은 `/admin/users` 로 분리된다는 안내
- `/org`
  - 부서 구조
  - 역할/직책 요약
  - 권한 체계 안내
- API
  - `GET /api/employees`
  - `GET /api/departments`
  - `GET /api/roles`
  - `GET /api/permissions`

중요한 점:
이번 단계의 API 보강은 읽기 응답을 더 일반 화면 친화적으로 다듬는 것이지, 저장 endpoint 를 여는 것이 아닙니다.

## 5. 테스트에서 꼭 지켜야 할 것

다음 구현자는 아래를 최소 회귀로 잡는 것이 좋습니다.

1. 일반 읽기 가능 역할은 조직/직원 조회 API 를 계속 읽을 수 있음
2. `EMPLOYEE` 는 허용되지 않은 조직/권한 조회에서 계속 403 을 받음
3. `/api/admin/users` 는 일반 조회 권한이 있어도 비관리자에게 열리지 않음
4. 직원 응답에 민감 인사정보 원문이 섞이지 않음
5. `/employees` 의 기본 CTA 가 관리자 액션처럼 보이지 않음
6. `/org` 가 권한 수정 화면처럼 보이지 않음
7. 모바일에서도 카드/목록이 읽기 쉬운 구조를 유지함

## 6. 이번 저장소에서 실제로 다시 확인된 것

이번 문서는 현재 `/home/wrhrgw/gw` 워크스페이스 기준으로 아래 사실을 다시 확인한 뒤 정리했습니다.

- `apps/web/app/employees/page.tsx` 는 현재 직원 기본정보와 API 링크 정도만 보여주는 얇은 placeholder 입니다.
- `apps/web/app/org/page.tsx` 는 현재 부서/역할/권한 API 링크와 주의사항 정도만 보여주는 얇은 placeholder 입니다.
- `apps/web/app/admin/users/page.tsx` 는 사용자-직원 연결 상태, 고위험 권한 diff, 감사 preview 를 강조하는 관리자 candidate 화면입니다.
- `packages/shared/src/contracts.ts` 에는 `appSections`, 조직/직원 조회 schema, 관리자 users candidate schema 가 이미 같이 들어 있습니다.
- `apps/api/src/app.ts` 에는 `/api/employees`, `/api/departments`, `/api/roles`, `/api/permissions` 가 있고 회사 범위 필터와 권한 검증을 적용합니다.
- `apps/api/test/auth-org.spec.ts` 에는 조직/직원 읽기 권한 회귀와 `/api/admin/users` 차단 회귀가 이미 있습니다.

이번에 부모 리뷰 카드와 회귀 테스트를 함께 보면, 예전에 알려졌던 아래 2개 이슈는 해소된 상태입니다.

- 일반 `/api/employees` 에 `roleCode=COMPANY_ADMIN` 를 붙여도 비관리자에게는 관리자 role filter 가 적용되지 않습니다.
- 잘못된 `employmentStatus` 또는 `roleCode` query 는 이제 500 이 아니라 400 `VALIDATION_ERROR` 로 응답합니다.

즉, 화면 경계 문구뿐 아니라 일반 직원 조회 API 의 기본 필터 guardrail 도 현재 코드/테스트 기준으로 같이 맞춰졌습니다.

## 7. 운영자가 먼저 알아둘 내용

- 이번 단계의 `/org`, `/employees` 는 일반 조회용 skeleton/candidate 화면입니다.
- 여기서 직원을 실제 초대하거나 역할을 저장하는 것이 아닙니다.
- 관리자 성격의 운영 변경 검토는 계속 `/admin/users` 가 맡습니다.
- 실제 직원 개인정보 원문 연결이나 운영 권한 저장은 아직 붙지 않았습니다.
- 현재 `/api/employees` 는 비관리자에게 관리자 role filter 를 무시하고, 잘못된 role/status query 는 400 `VALIDATION_ERROR` 로 돌려줍니다.
- 모바일에서도 보이기 쉬운 카드/목록 구조를 우선하지만, 하단 탭 구조를 이번 단계에서 크게 바꾸는 것은 아닙니다.
- 실운영 직원 개인정보 연결, production DB 변경, 외부 HR 연동은 이번 범위가 아닙니다.

## 8. 이번 단계에서 여전히 하면 안 되는 것

- 실제 직원 개인정보 원문 연결/반입
- 실운영 사용자 생성/초대/비활성화/권한 변경 실행
- production DB migration 실행
- 외부 HR/SSO/메일 연동
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 변경

## 9. 별도 승인 필요한 항목

- 실운영 직원 데이터 반입
- 실운영 사용자/권한 저장
- production DB migration 실행
- 외부 HR/SSO/메일 연동
- 모바일 하단 탭 정보구조 변경
- 개인정보 추가 노출 범위 확장
- 비용이 드는 리소스 생성/증설

## 10. 다음 Phase 구현 순서 제안

다음 구현자는 아래 순서로 이어가면 가장 자연스럽습니다.

1. `docs/architecture/phase-11-org-employees-scope.md` 를 먼저 읽고 경계부터 맞춥니다.
2. `apps/web/app/employees/page.tsx` 에서 직원 카드/목록/필터/제약 안내를 보강합니다.
3. `apps/web/app/org/page.tsx` 에서 부서/역할/권한 구조 안내를 보강합니다.
4. `apps/web/app/admin/users/page.tsx` 와 비교해 일반 조회와 관리자 candidate 문구가 섞이지 않는지 확인합니다.
5. `packages/shared/src/contracts.ts` 에 조직/직원 일반 화면이 바로 쓰는 summary/filter 계약이 필요하면 추가합니다.
6. `apps/api/src/app.ts` 와 `apps/api/test/auth-org.spec.ts` 에서 읽기 응답과 권한 회귀를 같이 맞춥니다.
7. README 와 이 handoff 문서가 코드 상태와 모순되지 않게 같이 갱신합니다.

## 11. 이번에 실제로 확인된 검증 결과

자동 테스트/빌드 쪽에서 다시 확인된 항목:

- `npx pnpm@11.5.2 --filter @gw/shared test -- --runInBand packages/shared/test/contracts.spec.ts` 통과
- `npx pnpm@11.5.2 --filter @gw/web test -- --runInBand apps/web/admin-preview-guard.test.ts apps/web/org-employees-boundary.test.tsx` 통과
- `npx pnpm@11.5.2 --filter @gw/api test -- --runInBand apps/api/test/auth-org.spec.ts` 통과
- `npx pnpm@11.5.2 --filter @gw/web build` 통과

이번 자동 재리뷰 기준으로 아래 동작이 현재 기대값으로 다시 확인됐습니다.

1. `GET /api/employees?roleCode=COMPANY_ADMIN`
   - MANAGER 로 요청해도 200 응답
   - 대신 관리자 role filter 는 무시되고 `filters.roleCode` 는 비어 있음
   - 일반 직원 목록 응답 안에 `employee_admin`, `COMPANY_ADMIN`, `HR_ADMIN` 요약이 섞여 나오지 않음
2. `GET /api/employees?employmentStatus=inactive`
   - 400 `VALIDATION_ERROR`
   - `error.details.field=employmentStatus`
3. `GET /api/employees?roleCode=NOT_A_ROLE`
   - 400 `VALIDATION_ERROR`
   - `error.details.field=roleCode`

중요한 뜻:
테스트와 build 가 통과한 상태에서, 일반 직원 조회 API 의 관리자 경계와 잘못된 query 처리도 이번 범위 기준으로 같이 맞춰졌습니다.

## 12. 남은 리스크

- `/employees`, `/org` 화면 자체는 여전히 일반 조회용 skeleton/candidate 단계라 실제 저장, 초대, 개인정보 원문 연결은 아직 없습니다.
- 관리자 운영 변경은 계속 `/admin/users` 쪽에서만 검토해야 하고, 일반 조회 화면에 운영 액션을 섞지 않도록 다음 phase 에서도 경계를 유지해야 합니다.
- production DB, 외부 HR/SSO, 실제 직원 데이터 반입 같은 운영 연동은 이번 범위 밖이므로 별도 승인 없이 이어서 붙이면 안 됩니다.

## 13. 참고 문서

- 기준 범위 문서: `docs/architecture/phase-11-org-employees-scope.md`
- Phase 2 조직 기본 범위: `docs/architecture/phase-2-auth-org-scope.md`
- Phase 10 관리자 2차 범위: `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- UX 기준: `docs/ux/groupware-benchmark-principles.md`
- 제품 비전/로드맵: `docs/product/groupware-vision-roadmap.md`

정리하면 이번 handoff 의 핵심은 하나입니다.

조직/직원 화면은 일반 사용자가 구조와 사람을 이해하는 곳으로, 관리자 users 화면은 운영 변경 후보를 검토하는 곳으로 역할을 명확히 갈라 두고 다음 구현을 시작하면 됩니다.
