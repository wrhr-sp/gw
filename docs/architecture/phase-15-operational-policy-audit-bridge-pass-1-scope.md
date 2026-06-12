# 그룹웨어 Phase 15 운영 데이터·정책·감사 로그 연결 1차 범위

## 1. 한 줄 정의

Phase 15의 목표는 관리자 영역에서 보이던 정책/권한/감사 skeleton을
직원·팀장·인사 화면과 API 허용 기준에 실제로 이어,
"운영자가 바꾼 기준이 일반 업무 화면에 왜 그렇게 보이는지 설명 가능한 실사용 초안 2차"를 만드는 것입니다.

이번 단계도 실제 production 저장, 실데이터 대량 변경, secret 입력, 외부 감사 적재는 하지 않습니다.
핵심은 "운영 정책이 업무 화면과 API에 같은 뜻으로 반영된다"는 연결감과
"막힘 이유를 화면/API/감사 후보에서 같이 설명한다"는 추적 가능성을 먼저 고정하는 것입니다.

## 2. 왜 이번 단계가 필요한가

Phase 13~14까지 아래 조각은 이미 있습니다.

- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 운영 검토 skeleton
- `/dashboard`, `/attendance`, `/approvals`, `/org`, `/employees` 일반 업무 흐름
- `roleCode + permissionCode + adminScope` 접근 행렬 1차
- 출퇴근 정책 `effective policy` 계산과 check-in/check-out API 허용 기준
- 감사 로그 masked preview, company boundary, `audit.read` 기준

하지만 지금은 아직 다음 질문에 대한 연결 설명이 약합니다.

- 관리자 `/admin/policies` 에서 본 정책 candidate가 직원 `/attendance` 와 `/leave` 에 어떤 차이로 보이는가?
- 관리자 `/admin/users` 에서 본 권한/상태 변경 preview가 팀장 `/approvals`, 일반 직원 `/dashboard`, `/employees` 가시성에 어떻게 이어지는가?
- `/api/admin/policies*` 와 `/api/attendance/*`, `/api/leave/*`, `/api/approvals/*` 가 같은 운영 사유를 설명하는가?
- 막힘/차단/빈 상태가 생겼을 때 운영자가 "권한 부족인지, 회사 scope 문제인지, 정책상 미허용인지"를 한 번에 이해할 수 있는가?
- 감사 로그는 관리자 전용 조회 화면에만 남고 일반 업무 화면에는 아무 설명이 없는 상태로 끝나지 않는가?

즉 Phase 14가 "따로 있던 화면을 한 흐름으로 묶는 단계"였다면,
이번 Phase 15는 "그 흐름이 운영 정책과 실제로 연결돼 보이게 만드는 단계"입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `ROADMAP.md`
- `TASKS.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `API.md`
- `DATA_MODEL.md`
- `docs/architecture/phase-14-real-usable-mvp-pass-1-scope.md`
- `docs/guides/phase-14-real-usable-mvp-pass-1-handoff.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `docs/architecture/admin-role-permission-model-pass-1-scope.md`
- `docs/architecture/attendance-registration-policy-pass-2-scope.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`
- `apps/web/app/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/admin-page-content.tsx`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/dashboard-boundary.test.tsx`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`

현재 저장소 기준으로 확인되는 사실:

- 관리자 정책과 감사 로그 화면은 이미 current/candidate/capability/audit preview 형식을 갖고 있습니다.
- 일반 업무 화면은 `/dashboard` → `/attendance` → `/approvals` → `/org`/`/employees` 흐름으로 정리돼 있습니다.
- `/leave` 화면과 `/api/leave/*` 도 skeleton 으로 존재하지만 현재 핵심 흐름 문서에서는 후순위로 설명되고 있습니다.
- 출퇴근 API 는 이미 employee 기준 `effective policy` 를 계산해 허용/차단하고 있습니다.
- 관리자 접근과 감사 로그 접근은 `audit.read` 중심 guardrail 을 유지하고 있습니다.
- 대시보드 shortcut, 관리자 route guard, 감사 로그 route guard, API 권한 체크는 서로 같은 방향으로 맞추기 시작했지만,
  일반 업무 화면의 안내 문구/빈 상태/오류 설명까지 충분히 묶인 상태는 아닙니다.

즉 이번 단계는 새 운영 엔진을 크게 추가하는 것이 아니라,
이미 있는 admin contract와 업무 skeleton 사이에 "설명 가능한 연결선"을 더 분명히 그리는 작업입니다.

## 4. Phase 15에서 고정하는 핵심 결정

### 결정 A. 이번 1차는 "운영 기준이 실제 업무 허용 기준으로 보이는 연결"에 집중한다.

이번 단계의 핵심 연결 축은 아래 4개입니다.

1. 정책 연결
   - `/admin/policies` ↔ `/attendance` ↔ `/leave` ↔ `/api/attendance/*` ↔ `/api/leave/*`
2. 권한/상태 연결
   - `/admin/users` ↔ `/dashboard` ↔ `/employees` ↔ `/approvals` ↔ 관련 API guard
3. 감사/예외 연결
   - `/admin/audit-logs` ↔ 운영 변경 candidate ↔ 차단 사유/빈 상태/예외 안내
4. 회사 scope 연결
   - admin company boundary ↔ 일반 업무 조회/API 허용 범위

쉽게 말하면,
운영자가 바꾼 값이 관리자 화면 안에서만 보이는 것이 아니라,
직원이 보는 버튼/안내/API 결과와 같은 뜻으로 이어져야 합니다.

### 결정 B. 정책은 "현재 적용 결과 + 왜 그렇게 됐는지"를 같이 보여 준다.

이번 1차에서 정책 연결은 단순히 allowed methods 하나만 노출하는 것으로 끝내지 않습니다.
아래 2가지를 함께 유지합니다.

1. 현재 적용 결과
   - 예: `허용 방식: mobile, pc`
   - 예: `휴가 신청은 연차/반차만 preview 가능`
2. 적용 이유 또는 source
   - 예: `회사 기본 → 판교 오피스 → 현장직 규칙 중 현장직이 최종 적용`
   - 예: `정책상 미허용이라 PC 출근 등록이 차단됨`

즉 직원 화면과 API는 "무엇이 허용되는지"만이 아니라
"왜 그렇게 보이는지"를 최소 한 줄 이상 설명 가능해야 합니다.

### 결정 C. 운영 예외/막힘 사유는 4가지 축으로 정리한다.

일반 업무 화면과 API에서 운영상 막힘을 설명할 때는 최소 아래 4가지 축을 구분합니다.

1. 권한 부족
   - 예: 관리자 전용 변경/감사 조회 접근 차단
2. 회사 scope 불일치
   - 예: 다른 회사 데이터/정책/대상 접근 차단
3. 정책상 미허용
   - 예: 현재 소속 정책에서 허용되지 않은 출퇴근 방식
4. placeholder/dev-safe 제한
   - 예: 실제 저장/승인/반영은 아직 미연결

이 4가지를 섞어 쓰지 않으면,
운영자도 왜 막혔는지 추적하기 쉬워지고
테스터도 기대 결과를 분명히 적을 수 있습니다.

### 결정 D. 감사 로그는 "운영자만 보는 별도 화면"이지만 일반 업무 화면 설명과도 끊기지 않아야 한다.

이번 단계에서 감사 로그 연결은 아래처럼 이해합니다.

- 감사 원문은 계속 `/admin/audit-logs` 에서만 본다.
- 일반 업무 화면에는 raw 로그를 노출하지 않는다.
- 대신 차단/예외/변경 preview 주변에
  `운영 정책 기준`, `권한 검토 필요`, `감사 preview 기준` 같은 설명을 남긴다.
- 관리자 `/admin/users`, `/admin/policies` 의 candidate/reason/audit preview 구조와
  일반 업무/API의 차단 사유가 서로 같은 방향을 가리켜야 한다.

즉 감사 로그를 일반 화면에 퍼뜨리는 단계가 아니라,
감사 가능한 운영 판단이라는 사실을 제품 전체가 같은 말로 설명하게 만드는 단계입니다.

### 결정 E. 일반 업무 핵심 route에 `/leave` 를 연결 보강 대상으로 올린다.

Phase 14의 핵심 smoke route는 8개 묶음이었지만,
이번 Phase 15에서는 운영 정책 연결성을 위해 `/leave` 를 문서/구현/검증 보강 대상으로 함께 봅니다.

우선순위:

1. `/dashboard`
2. `/attendance`
3. `/approvals`
4. `/employees`
5. `/leave`
6. `/admin/users`
7. `/admin/policies`
8. `/admin/audit-logs`

`/leave` 를 추가하는 이유는
근태 정책만 연결되고 휴가 정책은 관리자 화면 안에만 남아 있으면
운영 연결 1차라고 보기 어렵기 때문입니다.

단, 이번 필수 smoke 핵심 route 설명에서는 여전히
`/`, `/login`, `/dashboard`, `/attendance`, `/approvals`, `/org`, `/employees`, `/admin/*` 축을 유지하고,
`/leave` 는 정책 연결 강화용 보강 route로 다룹니다.

### 결정 F. 관리자 정책/권한 변경은 여전히 "preview와 영향 설명"까지만 다룬다.

이번 단계에서도 하지 않는 것:

- 실제 production 권한 저장
- 실제 휴가 정책 저장/반영
- 실제 승인 라인 변경 저장
- 실제 감사 export/external sink 전송
- 실데이터 대량 수정

이번 단계에서 하는 것:

- 영향 받는 화면/버튼/API 설명 정렬
- current/candidate/effective source 연결
- blocked/empty/error 상태 분류 정리
- 테스트와 문서로 운영 연결 근거 남기기

## 5. 역할별 연결 목표

### 일반 직원

주요 기대:

- `/dashboard` 와 `/attendance` 에서 현재 허용 방식과 막힘 이유를 이해한다.
- `/leave` 에서 정책상 가능한 신청 범위가 preview 기준으로 읽힌다.
- `/approvals` 는 결재 상태와 권한 경계가 실제 완료처럼 과장되지 않는다.
- 운영 변경은 직접 보지 않더라도 그 결과가 왜 이렇게 보이는지 한 줄 설명이 남는다.

### 팀장/결재자

주요 기대:

- `/approvals` 와 `/dashboard` 에서 본인 승인 권한과 팀 관련 예외가 섞이지 않는다.
- 휴가/근태/예외 처리에서 "내가 승인 가능한지"와 "정책상 가능한지"가 구분된다.
- 팀 범위를 넘는 요청이나 정책은 회사 scope 기준으로 계속 차단된다.

### 인사/운영 관리자

주요 기대:

- `/admin/users` 에서 본 역할/상태 변경 preview가 `/employees` 와 `/dashboard` 노출 차이에 어떤 영향을 주는지 이해한다.
- `/admin/policies` 에서 본 candidate가 `/attendance`, `/leave` 화면과 API 허용 기준에 같은 뜻으로 이어진다.
- 막힘 사유가 권한/정책/scope/placeholder 중 무엇인지 설명 가능하다.

### 감사 전용 사용자

주요 기대:

- `/admin/audit-logs` 에서 운영 변경 후보와 예외 추적 구조를 확인한다.
- raw 민감값 없이 masked/company boundary/source 원칙이 유지된다.
- 일반 업무 화면에 감사 원문이 새어 나오지 않는 대신, 연결 설명은 같은 방향으로 유지된다.

## 6. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 15 범위 문서 작성
- Phase 15 handoff 문서 작성
- 현재 활성 체인을 Phase 15 기준으로 루트 문서에 반영
- 운영 정책/권한/감사 로그 연결 포인트를 역할별 handoff 로 정리

### 다음 구현 카드에서 허용하는 범위

- `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees` 의 운영 연결 안내 문구/카드 보강
- `/admin/users`, `/admin/policies`, `/admin/audit-logs` 와 일반 업무 화면의 설명 축 정렬
- shared contract/helper 에 필요한 최소 summary/source/error reason 필드 보강
- API 응답의 blocked/empty/explanation 필드 최소 정리
- Web/API/shared/test/docs 동기화

### 이번 Phase에서 제외하는 범위

- 실제 production 정책 저장
- 실제 권한 부여/회수 저장
- production DB migration 실행
- 실제 휴가/결재/근태 완료 저장 고도화
- 외부 SIEM/감사 적재 연동
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 생성/증설
- 실데이터 기반 대량 운영 자동화

## 7. 권장 구현 순서

1. `/admin/policies` 와 `/attendance` 를 먼저 묶어 출퇴근 정책 source/blocked reason 연결을 고정합니다.
2. `/leave` 와 `/api/leave/*` 에도 같은 정책/예외 설명 축을 최소 범위로 맞춥니다.
3. `/admin/users` 와 `/dashboard`/`/employees`/`/approvals` 의 역할·권한·상태 연결을 정리합니다.
4. `/admin/audit-logs` 와 candidate/reason/source 설명이 다른 화면과 같은 뜻인지 확인합니다.
5. blocked/empty/error 상태 문구를 권한/정책/scope/placeholder 4축으로 맞춥니다.
6. 마지막에 Web/API/shared/test/docs 를 같이 회귀 확인합니다.

## 8. 구현자가 특히 먼저 볼 파일

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
- 필요 시 attendance/leave 관련 helper 파일
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

### 문서

- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`
- `docs/guides/phase-15-operational-policy-audit-bridge-pass-1-handoff.md`
- `docs/architecture/phase-14-real-usable-mvp-pass-1-scope.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `docs/architecture/admin-role-permission-model-pass-1-scope.md`
- `docs/architecture/attendance-registration-policy-pass-2-scope.md`

## 9. 최소 smoke / 회귀 기준

이번 Phase에서 최소한 다시 확인해야 할 기준:

1. `/attendance` 와 관련 API가 현재 `effective policy` 와 source/winner 설명을 같은 방향으로 보여 준다.
2. `/leave` 가 관리자 정책과 완전히 분리된 섬처럼 남지 않고, 최소한 policy/placeholder/예외 설명을 공유한다.
3. `/dashboard` 와 `/employees` 가 관리자 `/admin/users` 권한/상태 preview와 충돌하지 않는다.
4. `/approvals` 는 권한 있는 팀장/결재자 흐름과 관리자 운영 변경 흐름을 섞지 않는다.
5. `/admin/audit-logs` 는 감사 전용 접근과 masked/company boundary 원칙을 유지한다.
6. blocked/empty/error 상태가 권한 부족, 회사 scope, 정책 미허용, placeholder 제한 중 무엇인지 구분해 설명된다.
7. 일반 사용자에게 관리자 CTA 나 감사 원문이 새어 나오지 않는다.
8. skeleton/dev-safe/placeholder 문구가 핵심 화면과 API 설명에 남아 있다.

## 10. 별도 승인 필요 항목

아래는 이번 연결 1차에서도 계속 별도 승인 대상입니다.

1. 실제 운영 권한 저장/변경 실행
2. production 정책 저장 또는 실데이터 반영
3. production DB migration 실행
4. 실제 휴가/근태/결재 완료 저장 고도화
5. 외부 감사/SIEM/메신저/HR 연동
6. secret 입력/교체
7. DNS/custom domain 변경
8. 유료 리소스 생성·증설
9. 실제 개인정보 원문 확대 노출

정리하면 이번 Phase 15는
"관리자 화면이 더 많아지는 단계"가 아니라
"관리자 정책과 일반 업무 화면/API가 왜 같은 결과를 내는지 설명 가능한 연결 단계"입니다.
