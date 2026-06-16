# Phase 39 운영 QA·보안·감사·권한 회귀 안정화 handoff

## 1. 이번 Phase를 한 줄로 말하면

이번 Phase 39는 일반 업무 레인과 운영/감사 레인을 다시 한 번 묶어 보면서,
"누가 어디까지 볼 수 있고, 어디서 막히며, 무엇이 아직 승인 게이트인지"를 내부 도입 직전 기준으로 다시 고정하는 단계다.

즉 새 외부 연동을 여는 단계가 아니라,
route guard, API guard, company+branch scope, masked audit preview, forbidden/error/empty/offline 분리를
다음 구현/리뷰/테스트/릴리즈 작업자가 같은 말로 이어받게 만드는 단계다.

## 2. 이번 Phase에서 꼭 지켜야 할 제품 문장

- 일반 직원 화면과 운영자/감사 화면은 같은 앱 안에 있어도 같은 레인이 아니다.
- 메뉴 숨김만으로 끝나지 않고 route guard, API guard, permission, capability, company+branch scope 가 함께 맞아야 한다.
- forbidden 은 로그인 실패가 아니라 "로그인은 되었지만 이 업무 권한/범위는 없음" 이다.
- error 는 실패 상태, empty 는 정상인데 비어 있는 상태, offline 은 읽기/복구 안내 상태다.
- audit log 는 read-only 이고, 민감정보는 masked/metadata-only/storage preview 수준으로만 다룬다.
- 실데이터, external integration, custom domain, native release, production secret 은 계속 승인 게이트다.

## 3. 현재 기준으로 바로 이어받아야 할 구현/검토 포인트

### A. host / route 경계
- 일반 host 와 admin host 의 복구 동선이 섞이지 않아야 한다.
- admin host 는 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/offline` 중심으로만 복구 맥락을 제공해야 한다.
- 일반 host 에서 admin route 접근 시 paired admin host redirect 또는 forbidden 경계가 유지되어야 한다.

### B. 역할/권한 경계
- `EMPLOYEE`, `MANAGER`, `HR_ADMIN`, `COMPANY_ADMIN`, `AUDITOR` 가 같은 운영자처럼 합쳐지면 안 된다.
- `AUDITOR` 는 감사 검토 레인 중심이고, 일반 운영 변경 권한으로 과장하면 안 된다.
- `/management` 와 `/admin*` 는 둘 다 민감 레인이지만 서로 같은 상세 허용 범위로 쓰지 않는다.

### C. scope / foreign / self 차단
- 타 회사 employee id, foreign request id, unknown placeholder id, self-approval 같은 요청은 차단/검증 실패가 기준이다.
- branch scope 와 self-scope 를 company-wide access 처럼 확장해서 설명하면 안 된다.

### D. 민감정보 비노출
- raw storage key, bucket, signed URL, secret, production identifier 전문을 문서/보고/기본 응답에 노출하지 않는다.
- audit detail 과 문서/첨부 설명은 masked preview, storageRef, metadata 중심으로 유지한다.

### E. 상태 문구
- forbidden/error/empty/offline 을 같은 오류 상태처럼 뭉개지 않는다.
- 운영 화면과 사용자 화면 모두 상태 문장을 쉬운 말로 유지한다.

## 4. 현재 근거 파일

### 문서 기준
- `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`
- `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md`
- `docs/architecture/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-scope.md`
- `docs/guides/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-handoff.md`
- `docs/architecture/phase-39-operational-qa-security-audit-permission-regression-fit-gap-scope.md`

### web 근거
- `apps/web/admin-preview-guard.ts`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/phase38-offline-admin.test.tsx`
- `apps/web/app/admin/users/admin-users-page-content.tsx`
- `apps/web/app/me/page.tsx`

### api 근거
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

## 5. 이번 Phase에서 추천하는 작업 순서

1. `admin-preview-guard.ts` / `middleware.ts` 로 host·route 경계를 다시 확인한다.
2. `admin-preview-guard.test.ts` 로 역할별 접근 허용/차단을 다시 확인한다.
3. `phase38-offline-admin.test.tsx` 로 offline 복구 경계가 host 별로 분리되는지 다시 확인한다.
4. `auth-org.spec.ts` 로 403, validation, foreign/self 차단, raw storage 비노출 근거를 다시 확인한다.
5. 필요한 구현이 생기면 먼저 권한/범위/민감정보/상태 문구 회귀부터 막는다.
6. 리뷰/테스트 단계에서는 happy path 보다 차단 경계와 문장 일치 여부를 우선 확인한다.

## 6. 현재 Kanban 체인

- 기획: `t_f7dbddba` Phase 39 fit-gap 기획 — 완료
- 구현: `t_f77b8265` Phase 39 구현: 운영 QA·보안·감사·권한 회귀 안정화 — 완료
- 리뷰: `t_e91e3b31` Phase 39 리뷰: 운영 QA·보안·감사·권한 회귀 안정화 — 완료
- 테스트: `t_fee8d493` Phase 39 테스트: 운영 QA·보안·감사·권한 회귀 안정화 — 재검증 완료
- 문서화: `t_87da953e` Phase 39 문서화: 운영 QA·보안·감사·권한 회귀 안정화 — 현재 카드
- 릴리즈 게이트: `t_e0192dc8` Phase 39 GitHub PR/CI/merge/branch cleanup: 운영 QA·보안·감사·권한 회귀 안정화 — 다음 단계

## 7. 2026-06-16 parent 재검증에서 이미 확인된 것

- focused web 회귀에서 `admin-preview-guard.test.ts`, `phase38-offline-admin.test.tsx`, `dashboard-boundary.test.tsx`, `menu-page-content.test.tsx` 묶음이 실제 통과했다. 현재 문서 문장은 이 경계를 더 넓게 약속하면 안 된다.
- `apps/api/test/auth-org.spec.ts` 재검증도 실제 통과했다. `AUDITOR`/`HR_ADMIN`/`COMPANY_ADMIN` 차이, foreign/self/company+branch scope 차단, raw storage internals 비노출은 문서가 축소해서도 과장해서도 안 된다.
- `@gw/shared`, `@gw/api`, `@gw/web` typecheck 와 `pnpm check`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf` 가 다시 통과했다. 즉 지금 handoff 는 "새 정책 제안"이 아니라 현재 코드/테스트 기준을 다시 읽기 쉽게 맞춘 문서다.
- local admin-host preview smoke 에서 일반 host `/admin` 은 `/login`, admin host `/` 는 `/admin` 으로 다시 확인됐다. 일반 host 대 admin host 경계를 한 화면처럼 설명하면 안 된다.
- 같은 smoke 에서 일반/관리자 manifest split, admin host `/offline` 복구 범위, follow redirect 최종 200 기준이 다시 확인됐다. `/offline` 는 복구 안내이지 권한 우회나 상태 변경 성공 UX가 아니다.

## 8. 다음 작업자가 빠르게 판단해야 할 질문

- 이 변경이 일반 host 와 admin host 경계를 흐리는가
- 이 변경이 `AUDITOR` / `HR_ADMIN` / `COMPANY_ADMIN` / `MANAGER` 차이를 지우는가
- 이 변경이 company/branch/self scope 를 넓혀 foreign access 를 허용하는가
- 이 변경이 forbidden/error/empty/offline 뜻을 섞는가
- 이 변경이 raw 민감정보 또는 secret 노출 쪽으로 밀어붙이는가
- 이 변경이 승인 게이트 항목을 "이번 Phase에서 바로 한다"로 오해시키는가

## 9. 이번 Phase의 완료 판단 기준

다음 조건이 동시에 맞아야 "이번 Phase가 정리됐다"고 볼 수 있다.

1. 문서상 scope 와 handoff 가 정리되어 있다.
2. 구현이 생기면 host/route/permission/scope/audit/masked state 기준을 깨지 않는다.
3. 리뷰에서 권한 누출, 민감정보 노출, 상태 혼동, 승인 게이트 누락이 blocking issue 없이 정리된다.
4. 테스트에서 forbidden/error/empty/offline, role별 route/API, foreign/self 차단 근거가 실제로 다시 검증된다.
5. 최종 보고에서 live URL/route/계정/확인 포인트/남은 승인 게이트를 분리해서 말할 수 있다.

## 10. 아직 남겨 두는 승인 게이트

- production secret/실계정/실데이터
- 외부 감사/보안/SIEM/기관 연동
- custom domain/DNS
- native app release/store 배포
- migration/destructive 작업
- 주민번호/계좌번호 같은 실민감 원문 입력 확대

이번 handoff 이후의 구현/리뷰/테스트는 이 게이트를 넘지 않는 범위에서만 움직여야 한다.
