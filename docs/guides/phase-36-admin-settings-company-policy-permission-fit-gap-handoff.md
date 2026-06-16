# Phase 36 운영자 설정·회사정책·권한관리 fit-gap handoff

## 한 줄 요약
이번 Phase 36은
운영자 설정, 회사 정책, 권한 관리가
지금 어디까지 실제로 읽히고
어디서 아직 preview/dev-safe/승인 게이트로 남는지
한 번에 설명할 수 있게 만드는 문서 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 확인 가능한 것:
- `/dashboard`, `/menu` 가 같은 홈 shortcut API를 읽는다.
- 회사 공통 고정 shortcut 과 권한 기반 사용자 전용 shortcut 이 분리돼 있다.
- `/employees`, `/org` 는 일반 조회 흐름이다.
- `/admin/users` 는 실저장 없이 역할 diff, 상태 변경 preview, 고위험 권한 후보를 보여 준다.
- `/admin/policies` 는 회사 설정 4묶음과 정책 current/candidate/capability/audit preview 를 보여 준다.
- `/admin/audit-logs` 는 `audit.read` 전용 read-only 흐름이다.

아직 운영 완료로 보면 안 되는 것:
- 회사가 shortcut 구성을 실제로 저장/배포하는 운영 UI
- 사용자가 홈 바로가기를 직접 편집/정렬/저장하는 UI
- 실제 권한 부여/회수 저장
- production password reset/실메일 초대/외부 IdP 연동
- production 정책 저장, 개인별 override 저장

별도 승인 없이는 진행하지 않는 것:
- production DB 실데이터 변경
- secret 입력/교체
- 실제 사용자 대량 초대/대량 import
- 외부 IdP/SSO/OAuth 연동
- GPS/실태그/외부 HR 연동
- migration, destructive 작업

즉 지금은
"실제 운영자 설정과 권한 구조를 설명할 수 있는 read model"
쪽에 더 가깝고,
"실운영 저장과 대량 반영이 이미 닫힌 상태"는 아닙니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) Phase 21의 4묶음은 계속 유지한다.
이번 단계도 기본 뼈대는 아래 4개입니다.
- 회사 기본 설정
- 조직/직원/권한 설정
- 근태·휴가·근무 정책 설정
- 운영 관리자 설정

다만 Phase 36에서는 이를 실무 언어로 다시 세 갈래로 읽습니다.
- 운영자 설정
- 회사 정책
- 권한 관리

### 2) 운영자 설정은 현재 "진입 제어와 preview" 중심이다.
쉽게 말하면 현재 운영자 설정은
"무슨 값이 DB에 저장되느냐"보다
"누가 어떤 운영 화면으로 들어가느냐"를 더 잘 설명합니다.

지금 확인되는 요소:
- 회사 고정 shortcut
- 권한 기반 사용자 전용 shortcut
- `/management` 와 `/admin*` 진입 경계
- 계정관리 preview
- 감사 진입

### 3) 회사 정책은 `/admin/policies` 가 기준 화면이다.
현재 회사 정책 설명은
`/admin/policies` 에 가장 잘 모여 있습니다.

기억할 점:
- current/candidate/capability/audit preview 구조
- 회사 설정 4묶음
- 출퇴근 우선순위 `company default → workplace → department → job type`
- 직원 화면은 정책 결과만 본다는 원칙

즉 `/attendance`, `/leave` 는
정책을 바꾸는 화면이 아니라
현재 정책 결과를 읽는 화면입니다.

### 4) 권한 관리는 현재 "카탈로그 + diff preview + guard" 단계다.
현재 권한 관리는 세 단계로 읽으면 쉽습니다.

1. 카탈로그
- `/api/roles`, `/api/permissions`, `/api/companies`

2. 일반 조회 guard
- `/employees` 에서 admin-only 역할/요약을 그대로 노출하지 않음

3. 운영 검토 preview
- `/admin/users` 에서 역할 후보, 상태 변경 diff, 고위험 권한 후보를 검토

즉 아직은
실제 저장보다
"어떤 권한 구조를 누구에게 어떻게 보여 주는가"가 먼저 정리된 상태입니다.

### 5) 홈 바로가기는 아직 완성 커스터마이징이 아니다.
지금 문서에서 가장 조심해야 할 부분입니다.

현재 확인되는 것:
- 회사 공통 고정 shortcut
- 권한 기반 사용자 전용 shortcut

현재 확인되지 않은 것:
- 회사가 고정 shortcut 구성을 편집/저장하는 관리자 UI
- 사용자가 직접 홈 shortcut 을 추가/정렬/저장하는 편집 UX

그래서 문서에서는
"홈 커스터마이징 완성"
처럼 쓰지 말고,
"고정 shortcut 과 권한 기반 shortcut 분리가 먼저 구현된 상태"
로 적어야 합니다.

## 3. 대장이 먼저 볼 6가지 질문
1. 운영자 설정이 지금 무엇을 뜻하는지 바로 보이는가?
2. 홈 shortcut, `/management`, `/admin/users`, `/admin/audit-logs` 가 같은 운영 진입 모델로 읽히는가?
3. `/admin/policies` 의 정책 설명과 `/attendance`·`/leave` 의 실제 안내가 같은 뜻인가?
4. `/employees` 일반 조회와 `/admin/users` 운영 검토가 계속 분리돼 보이는가?
5. 권한 관리가 카탈로그/guard/preview 3단계로 읽히는가?
6. 실제 저장·외부 연동·대량 반영이 여전히 승인 게이트로 남아 있는가?

이 6개 질문 중 하나라도 흐리면
이번 Phase 36 정리가 덜 된 상태입니다.

## 4. 빠르게 눌러 볼 추천 순서
1. `/login`
2. `/dashboard`
3. `/menu`
4. `/employees`
5. `/org`
6. `/admin/users`
7. `/admin/policies`
8. `/admin/audit-logs`
9. `/management`

빠르게 볼 때 포인트:
- `/dashboard`, `/menu` 에서 shortcut 기준이 같은가
- `/employees`, `/org` 가 일반 조회로 남아 있는가
- `/admin/users` 가 실저장 화면이 아니라 preview/diff 중심인가
- `/admin/policies` 가 회사 정책 기준 화면인가
- `/admin/audit-logs` 가 read-only 인가

## 4-1. 2026-06-16 parent 재검증으로 다시 확인된 것

이번 문서는 parent 재검증 결과까지 반영해 다시 읽습니다.

다시 통과한 검증 명령:
- `pnpm --filter @gw/web test -- admin-console-pass1.test.tsx dashboard-boundary.test.tsx menu-page-content.test.tsx admin-users-dev-safe-action.test.ts org-employees-boundary.test.tsx admin-preview-guard.test.ts`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/shared typecheck`
- `pnpm --filter @gw/web build`
- `pnpm check`
- `pnpm --filter @gw/web build:cf`
- `BASE_URL=http://127.0.0.1:8790 bash scripts/gw-admin-host-preview-smoke.sh`

이번 재검증에서 문서에 바로 반영할 핵심 판정:
- 비로그인 일반 host 는 Phase 36 보호 route 를 `/login` 으로 돌리고 `/api/me`, `/api/admin/users` 는 계속 막힌다.
- `COMPANY_ADMIN` 은 `/management`, `/admin/users`, `/admin/policies`, `/api/admin/users` 를 계속 읽을 수 있다.
- `HR_ADMIN` 은 `/admin/users`, `/admin/policies` 는 열리지만 `/admin/audit-logs` 와 audit API 는 계속 막힌다.
- `AUDITOR` 는 `/admin/audit-logs` 만 read-only 로 열리고 `/admin/users`, `/admin/policies` 는 계속 막힌다.
- `MANAGER`, `EMPLOYEE` 는 privileged shortcut 을 받지 않고 `/management`, admin API 접근도 계속 차단된다.

즉 Phase 36 문서는 이제 단순 설명 문서가 아니라,
실제 route/API/preview smoke 로 다시 확인한 역할 경계를 바탕으로 읽어야 합니다.

## 5. 구현자에게 넘길 핵심 포인트
### gwbuilder
집중할 것:
- 운영자 설정 read model 을 조금 더 직접 읽히게 보강
- `/admin/users` 에 role/permission/shortcut 연결 근거를 더 보이게 정리
- `/dashboard`·`/menu` 와 `/admin/*` 의 shortcut/권한 설명을 같은 기준으로 맞춤

피해야 할 것:
- 실제 권한 저장/회수
- production password policy
- 외부 IdP/실메일 발송
- production 정책 저장과 migration

### gwreviewer
집중할 것:
- 일반 조회와 운영 검토 책임이 흐려지지 않는지
- shortcut 설명이 구현보다 과장되지 않는지
- `/admin/policies` 와 직원 화면 정책 설명이 충돌하지 않는지

### gwtester
집중할 것:
- `/api/home/shortcuts`, `/api/roles`, `/api/permissions`, `/api/admin/users`, `/api/admin/policies`, `/api/admin/audit-logs` 근거가 문서와 같은지
- 일반 직원/지점 관리자에게 privileged shortcut 이 숨겨지는지
- `audit.read` 전용 경계가 유지되는지

### gwdocs
집중할 것:
- 운영자 설정 / 회사 정책 / 권한 관리 3축을 쉬운 한국어로 구분
- 아직 없는 편집/저장 기능을 과장하지 않기
- 승인 게이트를 구현 TODO 와 섞지 않기

## 6. 후속 구현 제안
이번 fit-gap 결과 기준으로 바로 다음 구현은
"실권한 저장"보다
"운영자 설정 read model 정리"
쪽이 더 안전하고 명확합니다.

추천 방향:
1. `/admin/users` 또는 `/admin` 에서
   - 회사 고정 shortcut
   - 권한 기반 사용자 전용 shortcut
   - 역할/권한 카탈로그 출처
   - 현재 dev-safe 경계
   를 한 번에 보이게 만든다.
2. `/admin/policies` 의 회사 설정 모델과 `/dashboard`·`/menu` 의 홈 shortcut 설명을 연결한다.
3. 실저장/외부 연동은 계속 승인 게이트로 남긴다.

## 7. 다음 작업자가 기억할 7가지
1. 이번 Phase 36은 실운영 저장이 아니라 fit-gap 정리다.
2. 운영자 설정은 현재 진입/노출/preview 기준으로 읽는다.
3. 회사 정책 기준 화면은 `/admin/policies` 다.
4. 권한 관리는 카탈로그 + guard + diff preview 단계다.
5. 홈 shortcut 은 아직 회사 고정 + 권한 기반 사용자 전용 수준으로 이해한다.
6. `/employees` 일반 조회와 `/admin/users` 운영 검토를 다시 섞지 않는다.
7. 대량 초대, 실권한 저장, 외부 IdP, production 정책 저장은 계속 승인 게이트다.
