# Phase 57 홈·대시보드 분리, 고정/커스텀 바로가기, 모바일/PC IA 가이드 + UAT 절차 + 운영 체크리스트

## 한 줄 요약
이번 Phase 57에서는 `/login` 후 `/dashboard` 와 `/menu` 를 직접 눌러 보며,
홈은 `오늘 할 일 시작 화면`, 메뉴는 `전체 기능 탐색 화면`, 바로가기는 `회사 공통 고정` 과 `권한 기반 사용자 전용`, 모바일/PC 는 `같은 정보구조의 다른 껍데기`라는 기준이 실제로 유지되는지만 먼저 확인하면 된다.

## 이 문서가 다루는 범위
- 홈(`/dashboard`) 확인 가이드
- 메뉴(`/menu`) 확인 가이드
- 고정 바로가기 / 사용자 전용 바로가기 확인 가이드
- 내 정보(`/me`) 기준 사용자 설정·세션 안내 가이드
- 모바일 하단 탭 / 모바일 전체 메뉴 / PC sidebar IA 확인 가이드
- 관리자/감사/경영업무 분리 노출 확인 가이드
- empty/loading/error/forbidden/offline/dev-safe 읽는 법
- UAT 절차
- 운영 체크리스트
- 최종 보고에 넣을 항목

이 문서는 production DB 기반 영구 개인 홈 커스터마이징 저장,
외부 메신저/메일/푸시 연동, native 앱 배포,
secret 입력/교체, DNS/custom domain, 유료 리소스,
migration, destructive 작업 문서가 아니다.
지금 이미 있는 홈/메뉴/권한 기반 바로가기 구조를
"대장이 live URL에서 직접 어디를 눌러 무엇을 확인하면 되는가" 중심으로 다시 묶은 문서다.

## 먼저 기억할 15가지
1. 익명 시작점은 `/login` 뿐이다.
2. 테스트 계정은 `admin / 1234` 다.
3. 이 계정은 dev/test/UAT 전용이며 production 기본 계정이 아니다.
4. 일반 직원/관리자/담당자의 공통 landing 은 `/dashboard` 다.
5. 감사 전용 사용자의 공통 landing 은 `/admin/audit-logs` 다.
6. `/dashboard` 는 오늘 할 일을 먼저 처리하는 홈이다.
7. `/menu` 는 전체 기능 탐색 화면이다.
8. 홈과 메뉴는 같은 shortcut/권한 registry 를 공유해야 한다.
9. 홈 바로가기는 회사 공통 고정과 권한 기반 사용자 전용 두 층으로 나뉜다.
10. 고정 바로가기는 개인이 임의로 사라지게 할 기능처럼 적지 않는다.
11. 사용자 전용 바로가기가 없을 때는 오류가 아니라 정상 empty 상태로 읽혀야 한다.
12. 모바일 하단 탭 5개와 PC sidebar 는 같은 메뉴군을 가리킨다.
13. `/me` 는 사용자 설정을 바꾸는 운영 콘솔이 아니라 내 세션·역할·개인 확인 흐름을 마무리하는 화면이다.
14. `/management`, `/admin/users`, `/admin/audit-logs` 운영 레인은 홈 기본 CTA 와 섞지 않는다.
15. 영구 저장 커스터마이징과 외부 연동은 아직 승인 게이트다.

## 접속 정보와 현재 근거
- 현재 공개 preview URL 기록: `https://gw-web.wereheresp.workers.dev`
- 로그인 시작점: `/login`
- 테스트 계정: `admin / 1234`
- 현재 핵심 route:
  - `/dashboard`
  - `/menu`
  - `/attendance`
  - `/leave`
  - `/approvals`
  - `/boards`
  - `/documents`
  - `/me`
  - `/org`
  - `/employees`
  - `/management`
  - `/admin/users`
  - `/admin/audit-logs`
  - `/offline`
- 현재 핵심 구현 파일:
  - `apps/web/app/dashboard/dashboard-config.ts`
  - `apps/web/menu-page-content.tsx`
  - `apps/web/app/_components/home-shortcuts-panel.tsx`
  - `apps/web/home-shortcuts.ts`
  - `apps/web/app/mobile-pwa-config.ts`
- 현재 shared/access 근거:
  - `packages/shared/src/contracts.ts`
  - `packages/shared/src/admin-access.ts`
  - `packages/shared/src/mobile-contracts.ts`
- parent tester 재검증 근거:
  - focused vitest 20건 통과
  - `pnpm typecheck` 통과
  - `pnpm build` 통과
  - local `next start` smoke 기준 익명 `/dashboard`·`/menu`·`/management`·`/admin/users`·`/admin/audit-logs` 가 모두 `/login` redirect

중요:
- 이번 문서 작업에서 live URL을 내가 다시 직접 fetch 한 것은 아니다.
- 따라서 최종 사용자 보고 전에는 singde가 live 직접 확인 메모를 최종 결과에 함께 붙여야 한다.

## 1. 홈(`/dashboard`) 확인 가이드

### 추천 순서
1. `/dashboard`
2. 오늘 액션 카드 순서 확인
3. 상태 요약/대기/예외 카드 확인
4. 회사 공통 고정 바로가기 확인
5. 권한 기반 사용자 전용 바로가기 확인
6. 운영/감사 CTA 분리 확인

### 어떻게 읽으면 되는가

#### `/dashboard`
- 오늘 해야 할 일을 먼저 처리하는 홈이다.
- 첫 질문은 "무엇을 지금 먼저 눌러야 하는가" 여야 한다.
- 기본 흐름은 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 다.
- `/org`, `/employees` 는 마무리 조회 흐름이다.

#### 오늘 액션 카드
- 즉시 업무 CTA 를 앞에 둔다.
- 상세 처리 자체를 홈에서 끝내는 것이 아니라 각 업무 화면으로 넘긴다.
- 홈은 요약과 진입 순서를 정리하는 자리다.

#### 운영/감사 CTA 분리
- 운영 관련 CTA 는 홈 기본 업무 카드와 다른 맥락으로 읽혀야 한다.
- 일반 직원에게는 숨기고, 권한 있는 세션에서만 별도 바로가기 또는 별도 운영 카드로 보여야 한다.

### 홈에서 바로 확인할 질문
- `/dashboard` 가 정말 오늘 업무 시작 화면처럼 읽히는가
- 즉시 액션과 참고 링크의 우선순위가 뒤바뀌지 않는가
- 일반 업무 CTA 와 운영/감사 CTA 가 같은 홈 카드처럼 섞이지 않는가
- 홈 바로가기 영역이 고정/사용자 전용 정책을 분명히 드러내는가

## 2. 메뉴(`/menu`) 확인 가이드

### 추천 순서
1. `/menu`
2. 홈 바로가기 요약 확인
3. 하단 탭 5개 설명 확인
4. 기본 업무 섹션 확인
5. 공통 업무 엔진 섹션 확인
6. 내 정보 / 조회 섹션 확인
7. 협업 placeholder 섹션 확인
8. 필요 시 경영업무 분리 메뉴 확인

### 어떻게 읽으면 되는가

#### `/menu`
- 홈의 복사본이 아니라 전체 기능 탐색 화면이다.
- 홈에서 우선순위상 뒤로 밀린 기능과 전체 메뉴 구조를 설명한다.
- 홈과 다른 데이터 소스를 쓰는 것이 아니라 같은 shortcut/권한 기준을 다른 문맥으로 풀어 주는 화면이다.

#### 메뉴 섹션
- 기본 업무: 파일럿 참여자가 가장 먼저 누를 핵심 흐름
- 공통 업무 엔진: 하단 탭을 늘리지 않고 홈/메뉴/PC sidebar 안에서 자리를 확보한 업무군
- 내 정보 / 조회: 업무 처리 뒤 읽는 마무리 메뉴
- 협업 placeholder: 실제 외부 연동 전 honesty 를 유지하는 안내 메뉴

### 메뉴에서 바로 확인할 질문
- `/menu` 가 홈과 다른 책임을 가진 탐색 화면처럼 읽히는가
- 같은 홈 바로가기 데이터를 읽되 설명 문맥만 다른 것이 드러나는가
- 섹션 제목과 설명이 모바일/PC 같은 IA 원칙과 충돌하지 않는가
- 공통 업무 엔진 자리가 하단 탭 추가 없이 확보돼 있는가

## 3. 내 정보(`/me`) 기준 사용자 설정·세션 안내 가이드

### 추천 순서
1. `/me`
2. 내 세션 상태 확인
3. 내 역할과 권한 설명 확인
4. `/payroll/me` 연결 확인
5. `/org`, `/employees` 읽기 흐름 연결 확인
6. 보안 / 승인 게이트 메모 확인

### 어떻게 읽으면 되는가

#### `/me`
- 홈과 메뉴를 둘러본 뒤 마지막에 보는 개인 확인 화면이다.
- 실제 회사 설정을 바꾸는 관리자 콘솔이 아니다.
- 현재 구현 기준으로는 내 세션, 역할, 로그아웃 동작, self-only 급여 초안 연결, 조직/직원 조회 연결을 한 번에 읽는 자리다.

#### 내 세션 상태
- same-origin 세션 확인 기준을 다시 보여 주는 자리다.
- 세션 만료, 응답 실패, 연결 오류는 success 처럼 넘기면 안 된다.

#### 내 역할과 권한
- 기본 직원 흐름에서 무엇을 할 수 있는지 다시 정리하는 단계다.
- 관리자 운영 변경 화면으로 넘어가는 CTA 처럼 읽히면 안 된다.

#### 사용자 설정이라고 부를 때 주의할 점
- 지금 단계의 `/me` 는 프로필 영구 저장, 비밀번호 변경, MFA, SSO, 생체인증, 외부 초대 메일 설정 화면이 아니다.
- 따라서 `사용자 설정 완료` 라는 표현보다 `내 세션·권한·개인 확인 안내` 라고 적는 편이 정확하다.

### `/me` 에서 바로 확인할 질문
- `/me` 가 관리자 설정 화면처럼 과장되지 않는가
- 세션 상태, 역할 설명, 로그아웃 동작이 같은 개인 확인 흐름으로 읽히는가
- `/payroll/me` 연결이 회사 전체 급여 운영 화면처럼 보이지 않는가
- `/org`, `/employees` 가 읽기 전용 마무리 조회로 이어지고 `/admin/users` 운영 변경과 섞이지 않는가

## 4. 고정 바로가기 / 사용자 전용 바로가기 확인 가이드

### 고정 바로가기
- 모두가 같은 순서로 찾는 업무를 가리킨다.
- 현재 코드 해석 기준은 `isFixed === true` 또는 `scope === company` 다.
- 로그인 뒤에 표시되며, 로그인 전에는 `불러오지 않음` 안내가 나오는 것이 정상이다.

### 사용자 전용 바로가기
- 관리자/감사/경영업무처럼 현재 세션 권한이 있을 때만 열린다.
- 현재 코드 해석 기준은 `scope === user` 이고 `isFixed !== true` 인 항목이다.
- 없을 때는 `추가 권한 없음` 또는 동급 empty 상태로 읽어야 한다.

### 바로가기에서 바로 확인할 질문
- 고정 바로가기와 사용자 전용 바로가기가 같은 정책처럼 뭉개지지 않는가
- 권한 없는 세션에 운영/감사 shortcut 이 노출되지 않는가
- 로그인 전 빈 상태, 로그인 후 고정 항목 없음, 권한 기반 추가 항목 없음이 서로 다른 뜻으로 읽히는가
- 아직 없는 영구 저장 편집/정렬 기능을 완료품처럼 적지 않는가

## 5. 모바일 하단 탭 / 모바일 전체 메뉴 / PC sidebar IA 확인 가이드

### 하단 탭 5개
- `메뉴`·`홈`·`메신저`·`메일`·`알림`
- 이 5개는 고정 순서를 유지한다.
- 실제 업무 진입은 `홈`과 `메뉴`에서 이어진다.

### 모바일 전체 메뉴
- 하단 탭을 늘리지 않고 전체 기능을 한 번에 찾게 해 주는 화면이다.
- 홈과 같은 route 의미를 유지하되 탐색 밀도를 높이는 역할이다.

### PC sidebar
- 모바일 전체 메뉴와 같은 메뉴군을 가리킨다.
- 화면이 넓어졌다고 완전히 다른 사이트맵이 되면 안 된다.

### IA 확인에서 바로 확인할 질문
- 하단 탭 5개와 PC sidebar 가 서로 다른 사이트맵처럼 설명되지 않는가
- 모바일은 축소판이 아니라 우선순위 재정렬 버전이라는 기준이 유지되는가
- 새 업무군 자리를 하단 탭 추가가 아니라 홈/메뉴/sidebar 그룹으로 확보한다는 원칙이 살아 있는가
- 메신저/메일/알림 placeholder honesty 가 유지되는가

## 6. 관리자/감사/경영업무 분리 노출 확인 가이드

### `/management`
- 경영업무 허브다.
- 일반 직원 홈 연장처럼 보이면 안 된다.

### `/admin/users`
- 운영 검토 레인이다.
- 일반 조회나 홈 기본 업무와 같은 책임처럼 읽히면 안 된다.

### `/admin/audit-logs`
- `audit.read` 기반 read-only 감사 레인이다.
- 감사 landing 이 전체 운영권한 허용처럼 읽히면 안 된다.

### 분리 노출에서 바로 확인할 질문
- 운영/감사 진입점이 홈 기본 액션 카드와 같은 층위로 섞이지 않는가
- 권한 기반 사용자 전용 shortcut, 운영 CTA, 직접 route 접근, API guard 가 같은 기준을 쓰는가
- AUDITOR 와 관리자 역할이 같은 운영 권한 사용자처럼 쓰이지 않는가

## 7. 상태 문장을 어떻게 읽을 것인가

- empty: 접근 가능하지만 추가 항목이 없는 정상 상태
- loading: 읽는 중인 상태
- error: 다시 시도하거나 운영 확인이 필요한 실패 상태
- forbidden: 권한/회사/범위 차단 상태
- offline: 연결 복구 안내만 가능한 상태
- dev-safe/preview: 실제 영구 저장이나 외부 연동 없이 내부 확인용으로 남긴 상태

특히 아래 둘을 섞지 않는다.
- `사용자 전용 바로가기 없음` = empty
- `홈 바로가기 API 응답 실패` = error

## 8. UAT 절차

### A. 일반 직원 기준
1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/leave`
5. `/approvals`
6. `/boards`
7. `/documents`
8. `/menu`
9. `/me`
10. `/org`
11. `/employees`
12. 하단 탭과 전체 메뉴가 같은 정보구조를 가리키는지 확인

### B. 관리자/담당자 기준
1. `/login`
2. `/dashboard`
3. 고정/사용자 전용 바로가기 분리 확인
4. `/menu`
5. `/me` 에서 세션/권한 요약 확인
6. 운영 관련 메뉴 노출 방식 확인
7. `/management`
8. `/admin/users`
9. 필요 시 `/admin/audit-logs`

### C. 감사 기준
1. `/login`
2. `/admin/audit-logs`
3. 감사 landing 이 홈 기본업무와 섞이지 않는지 확인
4. 권한 없는 운영 레인으로 자연스럽게 넘어가지 않는지 확인

## 9. 운영 체크리스트

- 홈과 메뉴의 역할이 서로 다른 문장으로 분리돼 있는가
- `/me` 가 세션/개인 확인 흐름으로 읽히고 관리자 설정 화면처럼 과장되지 않는가
- 홈 바로가기가 고정/사용자 전용 두 층으로 읽히는가
- 권한 없는 세션에 운영/감사 shortcut 이 보이지 않는가
- 모바일 하단 탭 5개와 PC sidebar 가 같은 메뉴군을 가리키는가
- 메신저/메일/알림은 placeholder honesty 를 유지하는가
- 운영 레인(`/management`, `/admin/users`, `/admin/audit-logs`)이 일반 직원 홈과 섞이지 않는가
- `/payroll/me`, `/org`, `/employees` 가 `/me` 이후 개인 확인/읽기 흐름으로 이어지고 운영 변경 화면과 섞이지 않는가
- 영구 저장 커스터마이징과 외부 연동이 아직 승인 게이트라는 사실이 유지되는가
- live 직접 확인 근거와 local build/test 대체 근거가 분리되어 적히는가

## 10. 최종 보고에 넣을 항목

- 확인한 live URL 또는 route 목록
- 홈(`/dashboard`)과 메뉴(`/menu`) 역할 분리 요약
- `/me` 사용자 설정/세션 안내를 어떻게 읽어야 하는지 요약
- 고정 바로가기 / 사용자 전용 바로가기 정책 요약
- 모바일 하단 탭 / 전체 메뉴 / PC sidebar IA 요약
- 운영/감사/경영업무 분리 노출 요약
- 아직 dev-safe / placeholder / 승인 게이트로 남는 항목
- live 직접 확인 근거와 local build/test 근거를 분리한 메모

## 계속 승인 게이트로 남기는 것
- production DB 실데이터 기반 개인 홈 커스터마이징 영구 저장
- drag-and-drop 정렬 영구 반영
- 회사 정책 편집 UI로 고정 메뉴 즉시 변경
- 외부 메신저/메일/푸시/SMS 연동
- native 앱 배포
- secret 입력/교체
- DNS/custom domain
- 유료 리소스
- migration
- destructive 작업

## 같이 보면 좋은 문서
- `docs/architecture/phase-57-home-dashboard-shortcuts-mobile-pc-ia-fit-gap-scope.md`
- `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-handoff.md`
- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/architecture/phase-56-management-admin-live-operations-pass1-fit-gap-scope.md`
