# Phase 39 운영 QA·보안·감사·권한 회귀 안정화 fit-gap 범위

## 1. 한 줄 결론

이번 Phase 39의 목적은 `/dashboard`·`/management`·`/admin*`·`/offline`·공통 same-origin API 흐름을 다시 한 묶음으로 보면서,
"일반 직원/관리자/감사 사용자가 자기 레인 밖으로 새지 않는가"와
"forbidden/error/empty/offline, 민감정보 비노출, 감사 로그 read-only, 회사+지점 scope 가 회귀 테스트 기준으로 안정적인가"를 쉬운 언어로 다시 고정하는 것이다.

핵심은 새 외부 연동을 여는 것이 아니라,
이미 있는 route guard/API guard/host 경계/민감정보 마스킹/회귀 테스트를 "도입 전 최종 안전장치" 언어로 다시 묶는 것이다.

## 2. 왜 지금 이 Phase가 필요한가

직전 Phase 36에서는 `/admin/users`·`/admin/policies`·`/admin/audit-logs` 와 회사 설정 모델, 역할/권한 경계를 다시 맞췄다.
직전 Phase 37에서는 `/documents` 파일 lifecycle, `/admin/audit-logs` storage preview, 민감자료 approval gate 와 raw storage 비노출 원칙을 다시 묶었다.
직전 Phase 38에서는 `/dashboard`·`/menu`·`/notifications`·`/offline` 와 공통 app shell, 일반 업무 레인 대 운영 레인 분리를 현장 사용성 언어로 다시 맞췄다.

그 다음 단계에서는 "잘 보이는 입구"만이 아니라 "잘 막히는 경계"를 다시 확인해야 한다.
특히 내부 도입 직전에는 아래 여섯 축이 같은 뜻으로 읽혀야 한다.

1. 일반 host 와 admin host 가 서로 다른 레인을 강제로 유지하는가
2. `/management`·`/admin*`·민감 work item 이 role/permission 없이 열리지 않는가
3. 회사/지점 scope 밖 요청, unknown/foreign id, self-approval 같은 위험 요청이 403 또는 적절한 validation 으로 막히는가
4. audit log 와 민감 첨부/문서 정보가 read-only·masked·metadata-only 원칙을 유지하는가
5. forbidden/error/empty/offline 이 같은 상태처럼 섞이지 않는가
6. 이 모든 경계가 route/API/test/docs 에서 같은 언어를 쓰는가

이 여섯 축을 같은 제품 언어로 다시 묶는 것이 이번 fit-gap의 핵심이다.

## 3. 이번 Phase에서 직접 다루는 범위

### 3-1. host 경계와 route guard 를 운영 QA 언어로 다시 고정한다

이번 Phase에서는 일반 host 와 admin host 분리를 단순 메뉴 차이로 적지 않는다.
운영 레인을 잘못 타면 어디서 막히는지까지 함께 적는다.

문서화 기준은 아래와 같다.

- 일반 host 에서는 `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/work-items`, `/management` 같은 일반/민감 업무 레인을 읽는다.
- admin host 에서는 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/offline` 안에서만 맥락을 복구한다고 적는다.
- admin host 에서 일반 업무 route 를 그대로 렌더링하지 않고 `/admin` 경계로 되돌린다고 적는다.
- paired admin host 를 계산할 수 없는 일반 host 에서 admin route 를 억지 허용하지 않는다고 적는다.
- workers preview 예외 허용과 production 승인 조건을 같은 뜻으로 섞지 않는다.

### 3-2. 권한 누출 방지와 운영/감사 레인 분리를 다시 맞춘다

이번 Phase 39는 "보인다/안 보인다"보다 "누가 어디까지 볼 수 있는가"를 더 엄격하게 본다.

- `COMPANY_ADMIN`, `HR_ADMIN`, `AUDITOR`, `MANAGER`, `EMPLOYEE` 가 같은 관리자처럼 읽히지 않게 적는다.
- `AUDITOR` 는 `/admin/audit-logs` 와 read-only 검토 레인 중심이라고 적고 `/admin` 전체 허용처럼 쓰지 않는다.
- `HR_ADMIN` 은 운영 사용자/정책 검토가 가능해도 `audit.read` 없이는 감사 로그가 열리지 않는다고 적는다.
- `/management` 와 `work-items/*` 는 민감 업무 허브이지만, 모든 관리자에게 같은 상세 열람을 주는 곳처럼 쓰지 않는다.
- 메뉴 숨김이 끝이 아니라 route guard, API guard, permission, capability, company/branch scope 가 함께 움직인다고 적는다.

### 3-3. forbidden/error/empty/offline 을 서로 다른 상태로 다시 고정한다

이번 Phase에서는 차단 상태를 "그냥 실패"로 뭉개지 않는다.

- forbidden 은 로그인 실패가 아니라 "로그인은 되었지만 지금 권한/범위가 없는 상태"로 적는다.
- error 는 네트워크/서버/예상치 못한 실패 상태로 적는다.
- empty 는 정상 응답이지만 현재 보여 줄 항목이 없는 상태로 적는다.
- offline 은 읽기 중심 복구/재시도 안내 상태로 적고 상태 변경 성공처럼 쓰지 않는다.
- 운영 문서와 화면 문구에서 이 네 가지를 같은 말처럼 섞지 않는다.

### 3-4. 민감정보 비노출과 감사 로그 read-only 원칙을 다시 맞춘다

이번 Phase는 민감 데이터를 "있다"고 설명하더라도 원문 노출과 같은 뜻으로 쓰면 안 된다.

- `/admin/audit-logs` 는 read-only 감사 조회로 적는다.
- audit detail 은 masked before/after preview, `maskedFields`, `storageRef(fileId/spaceId/versionId/storageStatus)` 수준으로 적는다.
- raw `storageKey`, bucket, signed URL, 실제 secret, production identifier 전문은 기본 설명과 보고에서 노출하지 않는다.
- 문서/첨부/민감 work item 은 metadata preview/review/approval gate 중심으로 적고, 실원문 저장 확대와 같은 말로 섞지 않는다.
- 감사 로그가 있다고 해서 운영 변경이 완료되었다는 뜻처럼 쓰지 않는다.

### 3-5. 회사·지점 scope 와 forged/foreign id 차단을 같은 보안 언어로 다시 고정한다

이번 Phase에서는 권한만 맞으면 다 보인다고 쓰지 않는다.
company 와 branch 경계, 자기 것/남의 것 경계까지 함께 적는다.

- 다른 회사 employee id, foreign request id, unknown Production-ready (실구현) id 는 403 또는 validation 으로 막히는 흐름으로 적는다.
- 지점 관리자는 자기 지점 범위와 self-scope 범위를 넘는 상세를 다 본다고 쓰지 않는다.
- self-approval 금지, forged 접근 차단, branch/company scope 차단을 공통 guardrail 로 적는다.
- `/management` 와 `work-items/*` 에서도 company-wide card 와 branch scope card 를 같은 열람권처럼 쓰지 않는다.

### 3-6. 문서·화면·API·테스트 증거를 한 문장으로 연결한다

이번 Phase 문서는 새로운 정책 선언문이 아니라 이미 있는 경계 근거를 묶는 기준 문서여야 한다.
그래서 아래 계층을 같이 근거로 삼는다.

- 문서 기준: Phase 34, Phase 36, Phase 37, Phase 38 관련 scope/handoff
- 공유/권한 기준: `packages/shared/src/contracts.ts`, `packages/shared/src/mobile-contracts.ts`
- Web 기준: `apps/web/admin-preview-guard.ts`, `apps/web/middleware.ts`, `apps/web/app/offline/page.tsx`, `apps/web/app/admin/users/admin-users-page-content.tsx`, `apps/web/app/me/page.tsx`
- API 기준: `apps/api/src/app.ts`
- 테스트 기준: `apps/web/admin-preview-guard.test.ts`, `apps/web/phase38-offline-admin.test.tsx`, `apps/api/test/auth-org.spec.ts`

## 4. 이번 Phase에서 일부러 하지 않는 것

이번 Phase는 아래를 구현 완료처럼 약속하지 않는다.

- 외부 SIEM, 메일/SMS/push 보안 알림, 외부 감사 시스템 연동
- production secret 입력/교체
- production DB 실데이터 정비
- 주민번호/계좌번호 같은 실민감 원문 입력 확대
- custom domain/DNS 확정
- native app 배포/스토어 배포
- migration, destructive 작업, 강제 데이터 정리
- 실제 법무/세무/노무 외부 기관 계정 연동

즉 이번 Phase는 "새 보안 기능 확장"보다 "현재 guardrail 회귀 안정화"가 우선이다.

## 5. 현재 확인된 대표 근거

### host 경계와 route guard
- `apps/web/admin-preview-guard.ts`
  - admin host 허용 경계, 일반 host admin redirect, 민감 workbench route 접근 판정, preview 예외 허용 로직이 있다.
- `apps/web/middleware.ts`
  - trusted host 와 session token 을 읽어 route guard 결과를 실제 redirect 에 연결한다.
- `apps/web/admin-preview-guard.test.ts`
  - 익명 `/admin`·`/management` redirect, admin host `/admin` 허용, `HR_ADMIN` 의 `/admin/audit-logs` 차단, `AUDITOR` 의 audit-only 허용, spoofed host 차단이 회귀 테스트로 있다.

### offline / forbidden / 복구 경계
- `apps/web/phase38-offline-admin.test.tsx`
  - 일반 host `/offline` 는 `/dashboard`·`/menu`·`/notifications`·`/offline` 복구 범위를 유지하고, admin host `/offline` 는 `/admin`·`/admin/users`·`/admin/policies`·`/admin/audit-logs`·`/offline` 복구 범위만 유지한다.
- `apps/web/app/me/page.tsx`
  - forbidden/error/offline/empty 뜻을 쉬운 문구로 나눠 적는 현재 UI 기준이 있다.
- `apps/web/app/admin/users/admin-users-page-content.tsx`
  - forbidden / empty / error / dev-safe 경계를 운영 화면에서도 같이 설명하는 기준이 있다.

### API 권한, scope, 민감정보 비노출
- `apps/api/src/app.ts`
  - `audit.read`, `work_item.audit.read`, 민감 첨부 제한, company/branch scope, payroll/work item visibility, masked audit preview 기준이 있다.
- `apps/api/test/auth-org.spec.ts`
  - 출퇴근 허용 방식 차단 403, leave self-approval 금지, foreign/unknown id 차단, 타 회사 employee id 차단, raw storage internals 비노출, 문서/감사/권한 관련 회귀 근거가 있다.

## 6. 이번 fit-gap의 핵심 판정 질문

문서/코드 대조 후 아래 질문에 같은 답이 나와야 한다.

1. 일반 host 와 admin host 가 서로 다른 복구/탐색 레인을 유지하는가
2. `/management`·`/admin*`·민감 work item 이 역할/권한 없이 열리지 않는가
3. `AUDITOR`, `HR_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `EMPLOYEE` 가 같은 관리자처럼 뭉개지지 않는가
4. forbidden/error/empty/offline 이 서로 다른 상태로 읽히는가
5. audit log 와 민감자료 설명이 masked/read-only/metadata-only 경계를 지키는가
6. 회사/지점 scope 밖 요청, foreign id, self-approval, disallowed method 가 403 또는 validation 으로 막히는가
7. production secret/실데이터/외부 연동/custom domain/native 배포가 계속 승인 게이트로 남는가

## 7. 이번 Phase에서 권장하는 쉬운 확인 순서

1. `/dashboard`
2. `/management`
3. `/admin`
4. `/admin/users`
5. `/admin/policies`
6. `/admin/audit-logs`
7. `/offline`
8. `/me`
9. `apps/web/admin-preview-guard.test.ts`
10. `apps/web/phase38-offline-admin.test.tsx`
11. `apps/api/test/auth-org.spec.ts`

이 순서는 "일반 업무 입구 → 민감 운영 허브 → 감사/권한 차단 → 상태 예외 → 회귀 근거" 순서를 유지하기 위한 것이다.

## 8. 다음 작업자에게 넘길 핵심 문장

- 이번 Phase 39는 운영 QA·보안·감사·권한 경계를 실제 내부 도입 전 점검표 언어로 다시 고정하는 fit-gap 단계다.
- 핵심은 host 경계, role/permission, company+branch scope, forbidden/error/empty/offline 분리, 민감정보 비노출, audit read-only 를 한 문장으로 맞추는 것이다.
- 이미 근거가 있는 것은 admin route guard, offline 복구 경계, same-origin API 403/validation, masked audit preview, foreign/self 차단 테스트다.
- 외부 보안 연동, production secret/실데이터, native 배포, custom domain, 실제 기관 연동은 여전히 범위 밖이며 승인 게이트다.
- 후속 구현이 생겨도 먼저 "권한 누출 금지, raw 민감정보 비노출, 상태 혼동 금지, 회사+지점 scope 유지" 원칙을 깨지 않는지부터 확인해야 한다.
