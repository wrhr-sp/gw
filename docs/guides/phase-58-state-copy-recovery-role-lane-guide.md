# Phase 58 상태 문장, 복구 안내, 역할별 차단 레인 가이드 + UAT 절차 + 운영 체크리스트

## 한 줄 요약
이번 Phase 58에서는 `/dashboard`, `/menu`, `/management`, `/admin/users`, `/admin/audit-logs`, `/me` 를 직접 눌러 보며,
`loading / empty / error / forbidden / offline / dev-safe` 가 서로 다른 뜻으로 읽히고,
역할별 첫 진입점과 차단 레인이 홈·운영·감사 화면에서 같은 문장으로 유지되는지만 먼저 확인하면 된다.

## 이 문서가 다루는 범위
- 상태별 뜻과 복구 방법
- 홈(`/dashboard`) 확인 가이드
- 메뉴(`/menu`) 확인 가이드
- 운영 허브(`/management`) 확인 가이드
- 관리자 계정관리(`/admin/users`) 확인 가이드
- 감사(`/admin/audit-logs`)와 내 정보(`/me`) 확인 가이드
- 역할별 첫 진입점 / 차단 레인 가이드
- UAT 절차
- 운영 체크리스트
- 최종 보고에 넣을 항목

이 문서는 production DB 변경,
실제 사용자 초대 메일 발송,
외부 IdP/SSO/SAML/SCIM,
실제 비밀번호 운영 전환,
secret 입력/교체, DNS/custom domain, 유료 리소스,
native 앱 배포, migration, destructive 작업 문서가 아니다.

## 먼저 기억할 12가지
1. 익명 시작점은 `/login` 뿐이다.
2. `loading` 은 아직 불러오는 중인 상태다.
3. `empty` 는 정상 빈 상태일 수 있다.
4. `error` 는 조회/불러오기 실패 상태다.
5. `forbidden` 은 로그인 실패가 아니라 권한/범위 차단 상태다.
6. `offline` 은 네트워크 불안정 상태다.
7. `dev-safe`, `preview`, `내부 확인용 데이터`, `참고용 요약 데이터` 는 실운영 완료가 아니다.
8. EMPLOYEE, MANAGER, HR_ADMIN, COMPANY_ADMIN 의 기본 시작점은 `/dashboard` 다.
9. AUDITOR 의 기본 시작점은 `/admin/audit-logs` 다.
10. HR_ADMIN 의 첫 관리자 레인은 `/management` 가 아니라 `/admin/users` 다.
11. 일반 직원 홈과 운영/감사 레인은 같은 CTA 묶음처럼 섞이면 안 된다.
12. live 직접 확인 근거와 local preview/build/test 근거는 구분해서 적어야 한다.

## 접속 정보와 현재 근거
- 현재 공개 preview URL 기록: `https://gw-web.wereheresp.workers.dev`
- 로그인 시작점: `/login`
- 테스트 계정: `admin / 1234`
- 현재 핵심 route:
  - `/dashboard`
  - `/menu`
  - `/management`
  - `/admin/users`
  - `/admin/audit-logs`
  - `/me`
  - `/notifications`
  - `/boards`
  - `/offline`
- 현재 핵심 구현 파일:
  - `apps/web/dashboard-page-content.tsx`
  - `apps/web/menu-page-content.tsx`
  - `apps/web/app/management/page.tsx`
  - `apps/web/app/admin/users/admin-users-page-content.tsx`
  - `apps/web/app/me/page.tsx`
  - `apps/web/app/_components/real-usage-panels.tsx`
  - `apps/web/app/_components/phase35-live-sections.tsx`
- 현재 shared/access 근거:
  - `packages/shared/src/admin-access.ts`
  - `packages/shared/src/contracts.ts`

중요:
- 이번 기획 카드에서는 live URL을 다시 직접 fetch 하거나 테스트를 실행하지 않았다.
- 따라서 최종 사용자 보고 전에는 구현/테스트 카드가 실제 실행 근거를 붙여야 한다.

## 1. 상태별 뜻과 복구 방법

### loading
- 뜻: 아직 내용을 불러오는 중인 상태
- 오해하면 안 되는 것: 성공 직전, 저장 완료, 권한 부족
- 복구: 잠시 기다린 뒤 홈 또는 메뉴에서 다시 확인

### empty
- 뜻: 현재 권한과 현재 시점에 표시할 추가 항목이 없는 정상 상태
- 오해하면 안 되는 것: 실패, 권한 차단
- 복구: 지금 할 일이 없는지, 권한 기반 추가 항목이 없는지 먼저 확인

### error
- 뜻: 조회나 불러오기에 실패한 상태
- 오해하면 안 되는 것: offline, forbidden, empty
- 복구: 같은 화면에서 반복 저장을 시도하지 말고 다시 조회하거나 운영 확인 경로로 이동

### forbidden
- 뜻: 로그인은 되었지만 현재 업무 권한/범위가 없는 상태
- 오해하면 안 되는 것: 로그인 실패, 네트워크 오류
- 복구: 허용된 역할 레인으로 되돌아가고 필요한 경우 지정 담당자에게 넘김

### offline
- 뜻: 네트워크가 불안정해 읽기 중심 확인만 가능하고 서버 반영형 작업은 막힐 수 있는 상태
- 오해하면 안 되는 것: 권한 차단, 단순 빈 상태
- 복구: 가능한 일 / 막히는 일 / 재시도 절차 확인 후 안정적 네트워크에서 다시 시도

### dev-safe / preview / 내부 확인용 데이터
- 뜻: 내부 확인용 요약, placeholder, preview 상태
- 오해하면 안 되는 것: 실제 저장 완료, 실제 메일 발송, 실제 정책 반영
- 복구: 완료 보고 대신 `preview`, `dev-safe`, `승인 게이트` 문구를 유지

## 2. 홈(`/dashboard`) 확인 가이드

### 추천 순서
1. `/dashboard`
2. 상태 안내 기준선 카드 확인
3. 오늘 액션 / 대기 / 예외 흐름 확인
4. 운영 CTA 분리 확인

### 어떻게 읽으면 되는가
- `/dashboard` 는 오늘 할 일 시작 홈이다.
- 상태 카드는 홈에서 자주 마주치는 `loading / empty / error / forbidden / offline / 참고용 요약 데이터` 뜻을 먼저 고정한다.
- 운영 관련 CTA 는 일반 직원 기본 업무 카드와 다른 레인으로 읽혀야 한다.

### 바로 확인할 질문
- 홈에서 `forbidden` 을 로그인 실패처럼 적지 않았는가
- `empty` 를 실패처럼 과장하지 않았는가
- 운영/감사 CTA 가 기본 홈 카드와 섞이지 않는가

## 3. 메뉴(`/menu`) 확인 가이드

### 추천 순서
1. `/menu`
2. 모바일 상태 문장 가이드 확인
3. 전체 기능 탐색 구조 확인
4. 복구 경로 카드 확인

### 어떻게 읽으면 되는가
- `/menu` 는 전체 기능 탐색 허브다.
- 홈과 같은 상태 체계를 쓰되, 복구와 재탐색에 더 가까운 문장으로 읽힌다.
- `forbidden` 이면 숨겨진 운영 메뉴를 대신 열지 않는다는 원칙이 살아 있어야 한다.

### 바로 확인할 질문
- 홈과 메뉴의 상태 문장이 서로 충돌하지 않는가
- `error` 뒤 복구 경로가 `/offline` 또는 허용된 메뉴로 자연스럽게 이어지는가
- 전체 메뉴가 권한 없는 운영 route 우회 통로처럼 읽히지 않는가

## 4. 운영 허브(`/management`) 확인 가이드

### 추천 순서
1. `/management`
2. 운영 상태 문장 가이드 확인
3. 운영 레인 순서 확인
4. 일반 홈과 섞이지 않는지 확인

### 어떻게 읽으면 되는가
- `/management` 는 민감 운영 허브다.
- `forbidden` 은 허용되지 않은 역할이 운영 레인에 섞여 들어오지 않는다는 뜻이다.
- `empty / error / loading` 은 저장 성공처럼 보이면 안 된다.
- `참고용 요약 데이터` 는 실반영 완료가 아니라 현재 읽기 기준선이다.

### 바로 확인할 질문
- 운영 허브가 일반 직원 홈의 다음 단계처럼 읽히지 않는가
- `forbidden` 이 역할/범위 차단으로 분명한가
- `error` 와 `loading` 이 같은 실패로 뭉개지지 않는가

## 5. 관리자 계정관리(`/admin/users`) 확인 가이드

### 추천 순서
1. `/admin/users`
2. 상태 배너와 경고 배너 확인
3. `forbidden / empty / error / dev-safe` 경계 확인
4. 연결 화면 / 근거 섹션 확인

### 어떻게 읽으면 되는가
- `/admin/users` 는 첫 HR 운영 검토 레인이다.
- `empty` 는 현재 회사 scope 에 계정이나 검토 큐가 없는 정상 상태일 수 있다.
- `error` 는 API preview 나 dev-safe action 실패다.
- `dev-safe` 는 실제 메일 발송, 외부 IdP, production password policy 가 아직 열리지 않았다는 뜻이다.

### 바로 확인할 질문
- HR_ADMIN의 첫 관리자 진입점이 `/management` 처럼 보이지 않는가
- `empty` 와 `forbidden` 이 섞이지 않는가
- `dev-safe` 가 실저장 완료처럼 보이지 않는가

## 6. 감사(`/admin/audit-logs`)와 내 정보(`/me`) 확인 가이드

### 감사(`/admin/audit-logs`)
- AUDITOR 의 기본 시작점이다.
- 운영 변경 레인이 아니라 read-only 추적 레인으로 읽혀야 한다.
- 관리자 전체 권한과 같은 뜻으로 쓰면 안 된다.

### 내 정보(`/me`)
- 세션·권한·개인 확인 마무리 화면이다.
- `forbidden` 은 로그인 실패가 아니라 현재 업무 권한이 없는 상태라고 적혀야 한다.
- 관리자 설정 변경 화면처럼 과장하지 않는다.

## 7. 역할별 첫 진입점 / 차단 레인 가이드

### EMPLOYEE
- 시작점: `/dashboard`
- 기본 확인: `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`
- 차단 레인: `/management`, `/admin/users`, `/admin/audit-logs`

### MANAGER
- 시작점: `/dashboard`
- 기본 확인 뒤 필요 시 `/management`
- `/employees`, `/org` 는 읽기 확인용

### HR_ADMIN
- 시작점: `/dashboard`
- 첫 관리자 레인: `/admin/users`
- `/management` 를 첫 진입점으로 적지 않음

### COMPANY_ADMIN
- 시작점: `/dashboard`
- 운영 레인: `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs`

### AUDITOR
- 시작점: `/admin/audit-logs`
- 차단 레인: 운영 저장/변경 레인 기본 진입 차단

## 8. UAT 절차

1. 익명 상태에서 `/login` 외 내부 route 가 열리지 않는지 확인
2. 로그인 후 `/dashboard` 상태 카드와 일반 홈 흐름 확인
3. `/menu` 상태 카드와 복구 경로 확인
4. 권한 있는 세션에서 `/management` 운영 상태 문장 확인
5. HR 관리자 세션에서 `/admin/users` 경계 문장 확인
6. 감사 세션에서 `/admin/audit-logs` read-only 시작점 확인
7. `/me` 에서 세션·권한·개인 확인 문구 확인
8. `empty`, `forbidden`, `error`, `offline`, `dev-safe` 를 서로 다른 이슈 분류로 기록

## 9. 운영 체크리스트

- `empty` 를 실패처럼 적지 않았는가
- `forbidden` 을 로그인 실패처럼 적지 않았는가
- `error` 와 `offline` 을 같은 장애처럼 적지 않았는가
- `dev-safe/preview` 를 실운영 완료처럼 적지 않았는가
- EMPLOYEE / MANAGER / HR_ADMIN / COMPANY_ADMIN / AUDITOR 시작점이 문서와 화면에서 같은가
- 운영/감사 레인이 홈 기본 CTA 와 섞이지 않는가
- live 직접 확인 근거와 local preview/build/test 근거를 분리했는가

## 10. route별 UAT 체크리스트

### `/dashboard`
- 상태 카드가 `loading / empty / error / forbidden / offline / 참고용 요약 데이터` 를 서로 다른 뜻으로 보여 주는가
- 일반 직원 기본 카드와 운영 CTA 가 한 묶음처럼 섞이지 않는가
- `forbidden` 을 로그인 실패처럼 적지 않았는가

### `/menu`
- 홈과 같은 상태 체계를 쓰되 전체 탐색 허브 문맥으로 읽히는가
- 복구 경로가 허용된 메뉴 재탐색 또는 `/offline` 로 자연스럽게 이어지는가
- 권한 없는 운영 메뉴를 우회 통로처럼 보이게 하지 않는가

### `/management`
- 민감 운영 허브라는 설명이 먼저 보이는가
- `empty / error / loading / 참고용 요약 데이터` 가 저장 성공처럼 보이지 않는가
- 권한 없는 세션에서 `forbidden` 이 역할/범위 차단으로 읽히는가

### `/admin/users`
- HR 운영 검토 시작점으로 읽히는가
- `empty` 는 정상 빈 상태, `error` 는 API/조회 실패, `dev-safe` 는 미연결 운영 게이트로 분리되는가
- 실제 메일 발송/외부 IdP/production 비밀번호 정책이 아직 승인 게이트라는 점이 숨겨지지 않는가

### `/admin/audit-logs`
- AUDITOR 의 read-only 시작점으로 읽히는가
- 운영 저장/변경 화면처럼 과장되지 않는가
- 감사 read-only 와 회사 전체 관리자 권한을 같은 뜻으로 적지 않는가

### `/me`
- 세션·권한·개인 확인 마무리 화면으로 읽히는가
- 관리자 설정 완료 화면처럼 과장되지 않는가
- `forbidden` 을 로그인 실패가 아니라 현재 업무 권한 부족으로 설명하는가

### 역할별 빠른 체크
- EMPLOYEE: `/dashboard` 시작, 운영/감사 route 는 기본 레인이 아니다
- MANAGER: `/dashboard` 시작, 필요 시 `/management` 로 이동
- HR_ADMIN: `/dashboard` 시작, 첫 관리자 레인은 `/admin/users`
- COMPANY_ADMIN: `/dashboard` 시작, 운영 레인은 `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs`
- AUDITOR: `/admin/audit-logs` 시작, 운영 변경 레인 기본 진입 차단

## 11. 최종 보고에 넣을 항목

- 어떤 route 의 상태 문장을 맞췄는지
- 어떤 역할별 첫 진입점 / 차단 레인을 다시 고정했는지
- 아직 `preview`, `dev-safe`, `승인 게이트` 로 남는 항목이 무엇인지
- live 직접 확인 여부와 local preview/test/build 대체 근거 여부
- 후속 구현/리뷰/테스트에서 다시 볼 핵심 질문

## 12. 계속 승인 게이트로 남기는 것

- production DB 실데이터 변경
- 실제 초대 메일 발송
- 외부 IdP/SSO/SAML/SCIM
- 실제 비밀번호 운영 전환
- secret 입력/교체
- DNS/custom domain
- 유료 리소스
- native 앱 배포
- migration
- destructive 작업
