# Phase 36 운영자 설정·회사정책·권한관리 fit-gap 범위

## 한 줄 요약
Phase 36의 목표는
운영자 설정, 회사 정책, 권한 관리가 지금 저장소에서 각각 어디까지 실제로 읽히는지,
어디서 서로 연결되고,
어디서 아직 dev-safe preview 또는 승인 게이트로 남는지
같은 언어로 다시 고정하는 것입니다.

쉽게 말하면 이번 단계는
`/dashboard`·`/menu` 의 홈 바로가기,
`/org`·`/employees` 의 일반 조회,
`/admin/users`·`/admin/policies`·`/admin/audit-logs` 의 운영 검토 흐름을
"운영자 설정 / 회사 정책 / 권한 관리" 3축으로 다시 나눠 보는 단계입니다.

중요한 점은 이번 단계도
실제 권한 저장, 대량 초대, production 정책 저장, 외부 IdP/HR 연동을 여는 것이 아니라,
현재 구현 상태와 목표 gap 을 정리해
다음 구현 카드가 무엇을 건드려야 하는지 분명하게 만드는 단계라는 점입니다.

## 왜 지금 Phase 36이 필요한가
Phase 21에서 회사 설정 4묶음 모델을 정의했고,
Phase 31에서 로그인·홈·경영업무·계정관리 입구를,
Phase 33에서 근태·휴가 정책 안내를,
Phase 34에서 일반 조회와 운영 검토 경계를,
Phase 35에서 민감 관리자 업무 허브를 정리했습니다.

하지만 아직 아래 질문은 한 번에 답하기 어렵습니다.

1. 운영자 설정이 정확히 어디를 뜻하는가?
   - 홈 바로가기/경영업무 진입/계정관리 preview/감사 진입이 한 묶음으로 읽히는가?
2. 회사 정책이 어디서 시작되고 어디서 결과만 노출되는가?
   - `/admin/policies` 의 current/candidate 설명과 `/attendance`·`/leave` 의 실제 안내가 같은 뜻인가?
3. 권한 관리는 어디까지 읽기/검토이고 어디서부터 실변경인가?
   - `/org/roles`, `/org/permissions`, `/admin/users`, 홈 shortcut 노출 기준이 같은 권한 모델을 가리키는가?
4. 홈 바로가기와 관리자 shortcut 이 현재 회사 고정값/사용자 전용값 중 어디까지 구현돼 있는가?
5. 실운영 저장이 아직 없는 부분을 문서나 화면이 과장하고 있지 않은가?

즉 Phase 36은
새 기능을 크게 여는 단계보다,
이미 있는 운영자 설정·정책·권한 흐름을
실제 구현 기준으로 다시 맞춰 보는 fit-gap 단계입니다.

## 이번에 다시 확인한 현재 기준

확인한 문서/파일:
- `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md`
- `docs/guides/phase-21-real-company-settings-model-pass-1-handoff.md`
- `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`
- `apps/web/dashboard-page-content.tsx`
- `apps/web/menu-page-content.tsx`
- `apps/web/home-shortcuts.ts`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/users/admin-users-page-content.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-skeleton-config.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `packages/shared/src/contracts.ts`

현재 저장소 기준으로 확인되는 사실:

### 1) 운영자 설정 입구는 이미 있다.
- `/dashboard` 와 `/menu` 는 둘 다 `/api/home/shortcuts` 를 읽어 회사 공통 고정 바로가기와 사용자 전용 shortcut 을 같이 보여 준다.
- `apps/api/src/app.ts` 의 fallback 구현 기준으로 기본 고정 바로가기는 `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` 이다.
- 관리자 성격 shortcut 은 현재 권한 기반 사용자 전용 항목으로만 붙는다.
  - `invite.manage` 가 있으면 `/admin/users`
  - `audit.read` 가 있으면 `/admin/audit-logs`
- `apps/api/test/auth-org.spec.ts` 기준으로 일반 직원과 지점 관리자는 `/admin*` 또는 `/management` shortcut 을 받지 않는다.

### 2) 회사 정책 read model 은 이미 `/admin/policies` 에 모여 있다.
- `/admin/policies` 는 current/candidate/capability/audit preview 형식을 공통으로 사용한다.
- 회사 설정 4묶음과 정책 축 3개(출퇴근 허용 방식, 휴가/근무 정책, 직원 노출 규칙)를 같은 화면에서 보여 준다.
- 출퇴근 정책 우선순위는 `company default → workplace → department → job type` 으로 그대로 유지된다.
- 휴가/직원 노출 규칙도 같은 회사 설정 모델 아래에서 읽히도록 copy 가 맞춰져 있다.

### 3) 권한 관리는 read-only/preview 중심이다.
- `/org`, `/employees`, `/api/companies`, `/api/departments`, `/api/roles`, `/api/permissions` 는 현재 일반 조회·카탈로그 성격이 강하다.
- `apps/api/test/auth-org.spec.ts` 기준으로 일반 직원은 roles/permissions 조회가 403 이고, 관리자/허용 역할만 읽을 수 있다.
- `/admin/users` 는 실저장 화면이 아니라 역할 diff, 상태 변경 preview, 고위험 권한 후보, dev-safe action form 을 먼저 보여 준다.
- `create invite` API 도 실제 외부 발송이 아니라 `pending_delivery` placeholder skeleton 으로 남아 있다.

### 4) 일반 조회와 운영 검토 경계는 유지되고 있다.
- `/employees` 는 필터/요약/notice 중심 일반 조회 화면이다.
- `apps/api/test/auth-org.spec.ts` 기준으로 non-admin viewer 는 일반 직원 디렉터리에서 `COMPANY_ADMIN`, `HR_ADMIN` 요약을 보지 못한다.
- `/admin/users` 는 같은 조직 데이터를 보더라도 역할 후보, 상태 변경 diff, 감사 후보를 보여 주는 운영 검토 화면이다.
- `/admin/audit-logs` 는 `audit.read` 전용 read-only 화면으로 유지된다.

### 5) 아직 없는 것도 분명하다.
- 회사가 고정 shortcut 집합을 관리하는 별도 관리자 UI는 아직 없다.
- 사용자가 홈 바로가기를 직접 추가/정렬/저장하는 편집 UI도 아직 없다.
- `/admin/users` 는 companySettingsModel 전체를 직접 풀어 보여 주지 않고, 현재는 사용자 preview 중심이다.
- 실제 권한 저장, 외부 IdP, 대량 import, production password policy, 실메일 초대는 이번 범위가 아니다.

## Phase 36에서 고정할 핵심 결정

### 결정 A. Phase 21의 4묶음 모델을 계속 기준점으로 쓴다.
Phase 36도 아래 4묶음을 기본 언어로 유지한다.
1. 회사 기본 설정
2. 조직/직원/권한 설정
3. 근태·휴가·근무 정책 설정
4. 운영 관리자 설정

다만 이번 Phase 36에서는 그 안을 다시 아래 3개의 작업 언어로 압축한다.
- 운영자 설정
- 회사 정책
- 권한 관리

### 결정 B. 운영자 설정은 "홈 진입과 운영 검토 진입을 관리하는 read model"로 본다.
이번 단계에서 운영자 설정은 아래를 뜻한다.
- 회사 공통 고정 shortcut
- 권한 기반 사용자 전용 shortcut
- `/management` 와 `/admin/*` 진입 경계
- 계정관리 preview 와 감사 진입

즉 운영자 설정은 아직
"모든 값을 저장하는 회사 설정 콘솔"이 아니라,
현재 어떤 운영 진입이 누구에게 열리는지 설명하는 read model 에 더 가깝다.

### 결정 C. 회사 정책은 `/admin/policies` 의 candidate 언어를 기준으로 쓴다.
- 정책 설명의 기준 화면은 `/admin/policies` 다.
- 직원 화면(`/attendance`, `/leave`)은 이 정책의 결과만 보여 주는 쪽이다.
- current/candidate/capability/audit preview 구조를 실제 저장 완료처럼 쓰지 않는다.
- 개인별 override, production 저장, 외부 장비 연동은 계속 승인 게이트다.

### 결정 D. 권한 관리는 "카탈로그 + diff preview + guard" 단계로 본다.
이번 단계에서 권한 관리는 아래 세 층으로 나눠 적는다.
1. 카탈로그
   - `/api/roles`, `/api/permissions`, `/api/companies`
2. 일반 조회 guard
   - `/employees` 에서 admin-only 역할을 숨김
3. 운영 검토 preview
   - `/admin/users` 의 role diff, high-risk permission, 상태 변경 preview

즉 현재는
실권한 저장보다
"누가 무엇을 읽고, 무엇을 후보로 검토하는가"가 먼저 정리된 상태로 본다.

### 결정 E. 홈 바로가기 모델은 아직 "회사 고정 + 권한 기반 사용자 전용"까지로 본다.
지금 구현 근거상 홈 바로가기의 현재 상태는 다음과 같다.
- 회사 공통 고정 shortcut: 존재
- 권한 기반 사용자 전용 shortcut: 존재
- 회사가 고정 목록을 바꾸는 관리자 UI: 없음
- 사용자가 직접 편집/정렬/저장하는 UX: 없음 또는 문서화 대상 아님

따라서 현재 문서에서는
"커스터마이징 완성"처럼 쓰지 않고,
"표시 분리와 권한 guard 가 먼저 구현된 상태"로 적는다.

### 결정 F. 승인 게이트는 여전히 별도 목록으로 남긴다.
계속 별도 승인으로 남는 것:
- production DB 실데이터 입력/변경
- 실제 권한 부여/회수 저장
- 대량 사용자 초대/대량 import
- 외부 IdP/SSO/OAuth 연동
- 실메일 발송/실비밀번호 정책 적용
- GPS/실태그/외부 HR 연동
- 회사 정책의 production 저장과 rollout
- migration, destructive 작업, secret 입력/교체

## 3축 fit-gap 표

| 축 | 현재 바로 확인되는 것 | 아직 남은 gap | 다음 구현 우선순위 |
| --- | --- | --- | --- |
| 운영자 설정 | `/dashboard`·`/menu` 의 회사 고정 + 사용자 전용 shortcut, `/management` 와 `/admin*` 진입 경계 | 회사가 shortcut 정책을 관리하는 운영 UI 부재, 사용자 편집/정렬 UX 부재 | shortcut read model 과 운영자 설명을 `/admin` 또는 `/admin/users` 에서 다시 연결 |
| 회사 정책 | `/admin/policies` 의 current/candidate/capability/audit preview, 회사 설정 4묶음, 출퇴근 우선순위 모델 | home layout/shortcut 정책, 권한 정책, 개인 override 제외 범위가 운영자에게 더 즉시 읽히는 UX 부족 | 정책 source 와 직원 화면 결과 문구를 더 직접 연결 |
| 권한 관리 | `/api/roles`·`/api/permissions` 카탈로그, `/employees` 일반 조회 guard, `/admin/users` role/status diff preview, `audit.read` 전용 감사 화면 | role/permission source 를 한 화면에서 쉽게 설명하는 관리자 read model 부족, 실변경 없는 상태가 헷갈릴 수 있음 | `/admin/users` 또는 별도 read-only 섹션에서 역할·권한·shortcut 연결 근거를 노출 |

## 대장이 실제로 볼 추천 순서
1. `/login`
   - `admin / 1234` 로그인
2. `/dashboard`
   - 홈 바로가기에서 회사 고정 vs 사용자 전용 진입을 본다.
3. `/menu`
   - 모바일/메뉴 관점에서도 같은 shortcut 기준을 쓰는지 본다.
4. `/employees`
   - 일반 조회에서 관리자 전용 역할이 과도하게 보이지 않는지 본다.
5. `/org`
   - 회사/부서/역할/권한 조회가 카탈로그 성격인지 본다.
6. `/admin/users`
   - role diff, 상태 변경 preview, 고위험 권한 후보, dev-safe form 을 본다.
7. `/admin/policies`
   - current/candidate/capability/audit preview 와 회사 설정 4묶음 모델을 본다.
8. `/admin/audit-logs`
   - `audit.read` 전용 read-only 경계와 masked detail 을 본다.
9. `/management`
   - 민감 관리자 허브가 일반 홈과 분리된 채 유지되는지 마지막으로 본다.

## 2026-06-16 parent 재검증 반영 메모

이번 범위 문서는 아래 parent 재검증 결과와 어긋나지 않아야 한다.

다시 통과한 검증:
- focused web/admin 테스트 6개 파일
- `apps/api/test/auth-org.spec.ts`
- shared/api/web typecheck
- `pnpm check`
- Next build + Cloudflare build
- local preview admin host smoke

문서에 그대로 유지해야 하는 현재 판정:
- anonymous/general host 는 `/management`, `/admin*` 를 직접 열지 못한다.
- `COMPANY_ADMIN` 은 운영 허브와 admin users/policies 를 계속 읽는다.
- `HR_ADMIN` 은 users/policies 까지만, `AUDITOR` 는 audit-only 까지만 읽는다.
- `MANAGER`, `EMPLOYEE` 는 privileged shortcut 과 admin API 접근이 계속 차단된다.
- `/admin/audit-logs` 의 기준은 "관리자처럼 보이는 역할"이 아니라 실제 `audit.read` capability 다.

따라서 Phase 36 문서에서 운영자 설정·회사 정책·권한 관리를 설명할 때도
role 이름만이 아니라 route guard/API guard/capability 근거를 함께 적는다.

## 이번 단계에서 일부러 하지 않는 것
- 실제 권한 저장/회수
- production password reset/정책 적용
- 외부 메일 발송/초대 링크 delivery
- 외부 IdP/SSO/OAuth 연동
- 회사 shortcut 정책 저장 UI 완료
- 사용자 홈 커스터마이징 영구 저장 UI 완료
- production 정책 저장, 실데이터 반영, migration

## 구현자가 먼저 볼 파일
1. `apps/web/dashboard-page-content.tsx`
2. `apps/web/menu-page-content.tsx`
3. `apps/web/home-shortcuts.ts`
4. `apps/web/app/admin/users/page.tsx`
5. `apps/web/app/admin/users/admin-users-page-content.tsx`
6. `apps/web/app/admin/policies/page.tsx`
7. `apps/web/app/admin/audit-logs/page.tsx`
8. `apps/web/admin-skeleton-config.ts`
9. `apps/api/src/app.ts`
10. `apps/api/test/auth-org.spec.ts`
11. `packages/shared/src/contracts.ts`
12. `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md`
13. `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`
