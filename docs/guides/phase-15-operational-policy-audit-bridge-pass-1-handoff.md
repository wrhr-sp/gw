# Phase 15 운영 데이터·정책·감사 로그 연결 1차 handoff

한 줄 요약:
이번 1차는 관리자 정책/권한/감사 화면을 더 많이 여는 단계가 아니라,
그 기준이 직원·팀장·인사 화면과 API 허용 결과에 왜 그렇게 보이는지
같은 말로 설명되게 만드는 연결 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 것:

- `/admin/users`, `/admin/policies`, `/admin/audit-logs` 운영 검토 skeleton
- `/dashboard`, `/attendance`, `/approvals`, `/org`, `/employees` 일반 업무 흐름
- `/leave` skeleton 과 `/api/leave/*` placeholder API
- `effective policy` 기반 출퇴근 허용/차단 구조
- `audit.read`, company boundary, masked preview 기준

아직 부족한 것:

- 관리자 화면의 정책/권한 preview가 일반 업무 화면과 API 결과에 왜 연결되는지 설명이 약합니다.
- `/attendance` 는 정책 연결이 비교적 있지만 `/leave` 는 운영 정책 연결이 문서/화면 기준으로 약합니다.
- `/admin/users` 의 역할/상태 변경 preview가 `/dashboard`/`/employees`/`/approvals` 에 어떤 차이를 주는지 흐름이 약합니다.
- 막힘 사유가 권한 문제인지, 정책 미허용인지, 회사 scope 문제인지, placeholder 제한인지 한눈에 분리되지 않습니다.

즉 이번 단계의 핵심은 기능 추가보다
"운영 기준이 실제 업무 결과와 같은 뜻으로 읽히게 만드는 것"입니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 일반 직원 관점

기본 흐름:

- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/employees`

기대하는 경험:

- 지금 가능한 행동과 막힌 행동을 이해한다.
- 출퇴근/휴가가 왜 그렇게 허용되는지 최소 한 줄 설명을 본다.
- 관리자 내부 판단 과정을 직접 보지 않아도 결과 이유는 이해한다.

### 팀장/결재자 관점

기본 흐름:

- `/dashboard`
- `/approvals`
- 필요 시 `/employees`
- 필요 시 `/leave`

기대하는 경험:

- 승인 권한 부족과 정책상 불가를 헷갈리지 않는다.
- 팀 범위와 회사 scope 경계가 계속 유지된다.
- 운영 관리자 권한과 결재 권한이 같은 것으로 보이지 않는다.

### 인사/운영 관리자 관점

기본 흐름:

- `/dashboard` 권한 기반 CTA
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- 필요 시 일반 업무 화면과 결과 대조

기대하는 경험:

- 운영 화면에서 본 candidate/reason/audit preview가 실제 일반 화면/API 결과와 연결된다.
- 막힘 사유를 권한/정책/scope/placeholder 중 어디서 생긴 것인지 설명할 수 있다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토가 계속 다른 역할로 보인다.

### 감사 전용 사용자 관점

기본 흐름:

- `/admin/audit-logs`

기대하는 경험:

- 운영 변경 추적과 마스킹 기준을 안전하게 본다.
- 일반 업무 화면에 raw 감사 정보가 섞이지 않는다.
- 대신 제품 전반의 설명 문구는 감사 가능한 운영 판단이라는 사실을 같은 방향으로 가리킨다.

## 3. 이번 Phase에서 고정할 핵심 결정

### 1) 운영 연결은 4개 축으로 본다.

- 정책 연결: `/admin/policies` ↔ `/attendance` ↔ `/leave` ↔ 관련 API
- 권한/상태 연결: `/admin/users` ↔ `/dashboard` ↔ `/employees` ↔ `/approvals`
- 감사/예외 연결: `/admin/audit-logs` ↔ candidate/reason/source 설명
- 회사 scope 연결: admin company boundary ↔ 일반 업무/API 허용 범위

### 2) 결과만이 아니라 이유를 같이 보여 준다.

최소한 아래가 같이 읽혀야 합니다.

- 현재 허용/차단 결과
- 마지막으로 적용된 정책 source 또는 권한 기준
- placeholder/dev-safe 제한 여부

예:

- `현재 적용 정책: 판교 오피스 > 현장직`
- `현재 소속 정책에서 PC 등록은 허용되지 않습니다`
- `실제 저장은 아직 연결되지 않았습니다`

### 3) 막힘 사유는 4가지 축으로 분리한다.

- 권한 부족
- 회사 scope 불일치
- 정책상 미허용
- placeholder/dev-safe 제한

이 4가지를 섞어 쓰지 않는 것이 이번 handoff의 핵심입니다.

### 4) `/leave` 를 이번 연결 보강 대상으로 올린다.

Phase 14에서는 `/leave` 가 후순위였지만,
이번 Phase 15에서는 운영 정책 연결성을 보여 주기 위해
`/attendance` 와 함께 `/leave` 도 최소 보강 대상으로 봅니다.

### 5) 감사 로그는 여전히 관리자 전용이지만 설명 연결은 제품 전체에서 유지한다.

- raw 감사 원문은 `/admin/audit-logs` 에만 둔다.
- 일반 업무 화면에는 원문을 노출하지 않는다.
- 대신 차단/예외/변경 설명이 감사 preview와 같은 방향을 가리키게 만든다.

## 4. 실제로 먼저 볼 파일

### Web

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-page-content.tsx`
- `apps/web/admin-skeleton-config.ts`

### Shared / API

- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

### 문서

- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`
- `docs/guides/phase-15-operational-policy-audit-bridge-pass-1-handoff.md`
- `docs/architecture/phase-14-real-usable-mvp-pass-1-scope.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `docs/architecture/admin-role-permission-model-pass-1-scope.md`
- `docs/architecture/attendance-registration-policy-pass-2-scope.md`

## 5. 권장 구현 순서

1. `/admin/policies` 와 `/attendance` 의 source/blocked reason 연결부터 맞춥니다.
2. `/leave` 에도 같은 정책/예외 설명 축을 최소 범위로 연결합니다.
3. `/admin/users` 와 `/dashboard`/`/employees`/`/approvals` 의 권한/상태 연결을 정리합니다.
4. `/admin/audit-logs` 와 candidate/reason/source 설명이 다른 화면과 같은 뜻인지 맞춥니다.
5. blocked/empty/error 문구를 권한/정책/scope/placeholder 4축으로 맞춥니다.
6. 마지막에 Web/API/shared/test/docs 를 같이 회귀 확인합니다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- `/attendance` 와 `/leave` 의 정책 연결 설명
- `/dashboard`/`/employees`/`/approvals` 와 `/admin/users` 의 권한/상태 연결
- blocked/empty/error 상태의 이유 분리
- current/candidate/effective source 용어 정렬

하면 안 되는 것:

- 실제 production 저장 열기
- 실제 권한 부여/회수 저장
- 실제 감사 export 또는 외부 연동
- 실데이터 대량 수정

### 리뷰어(gwreviewer)

집중할 것:

- 일반 업무 화면에 관리자 내부 정보가 새지 않는지
- 권한 부족 / 정책 미허용 / 회사 scope / placeholder 제한이 서로 섞이지 않는지
- `/employees` 와 `/admin/users` 역할 경계가 흐려지지 않는지
- `/attendance` 와 `/leave` 가 정책 연결에서 서로 다른 말을 하지 않는지
- 감사 로그 연결이 raw 정보 노출로 번지지 않는지

### 테스터(gwtester)

집중할 것:

- `/attendance`, `/leave`, `/approvals`, `/employees`, `/admin/*` 회귀
- API 허용/차단과 화면 설명의 정합성
- blocked/empty/error 분류 확인
- admin/auditor/general role 분기
- build/typecheck/check/build:cf/preview smoke 근거

### 문서화(gwdocs)

집중할 것:

- SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF/CHANGELOG 최신화
- 정책/권한/감사 연결을 쉬운 한국어로 설명
- 사용자가 preview/live URL 에서 어디를 보면 되는지 확인 순서 정리

### 운영(gwops)

집중할 것:

- branch/PR/CI/release gate/cloudflare deploy 확인
- live fetch 가 막히면 substitute evidence 정리
- 정책 연결 관련 smoke route와 API 확인 포인트 정리

## 7. 최소 smoke 기준

이번 1차에서 꼭 다시 볼 기준:

1. `/attendance` 와 관련 API가 같은 허용/차단 이유를 설명한다.
2. `/leave` 가 운영 정책과 동떨어진 placeholder로만 남지 않는다.
3. `/dashboard` 와 `/employees` 설명이 `/admin/users` 권한/상태 preview와 충돌하지 않는다.
4. `/approvals` 는 팀장 권한과 관리자 운영 권한을 섞지 않는다.
5. `/admin/audit-logs` 는 `audit.read`/masked/company boundary 원칙을 유지한다.
6. blocked/empty/error 상태가 권한 부족, 회사 scope, 정책 미허용, placeholder 제한 중 무엇인지 구분된다.
7. 일반 사용자에게 관리자 CTA, 감사 원문, 운영 내부 정보가 새어 나오지 않는다.
8. skeleton/dev-safe/placeholder 문구가 빠지지 않는다.

## 8. 꼭 지켜야 할 guardrail

- 실제 production 정책 저장 금지
- 실제 권한 저장/변경 금지
- production DB 실데이터 변경 금지
- 외부 감사/SIEM/HR 연동 금지
- secret 입력/교체 금지
- DNS/custom domain 변경 금지
- 유료 리소스 생성·증설 금지
- 실제 개인정보 원문 확대 노출 금지

## 9. 완료로 볼 최소 기준

- 운영 정책/권한/감사 기준이 일반 업무 화면과 API 결과에 같은 뜻으로 이어진다.
- 막힘 사유가 최소 4축(권한/정책/scope/placeholder)으로 구분된다.
- `/leave` 까지 포함한 운영 연결 1차가 설명 가능해진다.
- 관리자 내부 정보는 새지 않으면서 운영 연결 설명은 더 선명해진다.
- 다음 단계에서 실제 저장/실데이터 연결을 붙일 우선순위가 문서와 화면에 같이 남는다.

정리하면,
이번 handoff 의 핵심은 하나입니다.
Phase 15는 "운영 화면을 더 화려하게 만드는 단계"가 아니라
"운영 판단이 일반 업무 결과와 왜 같은지 설명 가능한 연결 단계"입니다.
