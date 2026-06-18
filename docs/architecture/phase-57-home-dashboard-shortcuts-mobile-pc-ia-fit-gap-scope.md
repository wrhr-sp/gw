# Phase 57 홈·대시보드 분리, 고정/커스텀 바로가기, 모바일/PC IA fit-gap scope

## 왜 이 Phase를 여는가

Phase 56에서 `/management`, `/payroll`, `/work-items/*`, `/admin/audit-logs` 같은 민감 운영 레인을 일반 직원 홈과 분리해 읽는 기준을 다시 잠갔다면, 그 바로 앞단인 홈 경험도 같은 언어로 다시 잠가야 한다.

현재 저장소에는 이미 아래 축이 함께 존재한다.

- `/dashboard` 중심의 오늘 업무 시작 화면
- `/menu` 중심의 모바일 전체 메뉴 화면
- 회사 공통 고정 + 권한 기반 사용자 전용 홈 바로가기 API
- 모바일 하단 탭 5개(`메뉴`·`홈`·`메신저`·`메일`·`알림`)
- PC/모바일 공통 route 체계를 전제로 한 정보구조

하지만 아직 문서 기준으로는 아래가 한 문장으로 완전히 잠기지 않았다.

- 홈(`/dashboard`)과 전체 메뉴(`/menu`)의 역할 차이
- 회사가 고정하는 필수 바로가기와 사용자 세션 기준 개인 바로가기의 정책 차이
- 모바일 하단 탭, 모바일 전체 메뉴, PC sidebar 가 같은 기능 registry 를 가리킨다는 원칙
- 관리자/감사/경영업무 진입점이 일반 직원 홈 CTA 와 섞이지 않는다는 원칙
- 영구 저장 커스터마이징이 아직 닫히지 않았다는 사실과 dev-safe 전제

이번 Phase의 핵심은 새 앱을 추가로 만드는 것이 아니라, 이미 있는 홈/메뉴/모바일/PWA/권한 기반 노출 구조를 Phase 24 파일럿, Phase 47 모바일 사용성, Phase 56 운영 레인 분리 기준 위에서 다시 정리하는 것이다.

## 이번 Phase의 한 줄 목표

대장이 live URL에서 `/login` 후 `/dashboard` 와 `/menu` 를 직접 눌러 보며,
`오늘 할 일 중심 홈` / `전체 기능 탐색 메뉴` / `회사 공통 고정 바로가기` / `권한 기반 사용자 전용 바로가기` / `모바일 하단 탭` / `PC sidebar` / `운영 레인 분리`가 서로 충돌하지 않고 같은 뜻으로 읽히는 상태를 만드는 것.

## 지금 바로 확인 가능한 범위

### 웹 route
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

### 구현 근거 파일
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/menu-page-content.tsx`
- `apps/web/app/menu/page.tsx`
- `apps/web/app/_components/home-shortcuts-panel.tsx`
- `apps/web/home-shortcuts.ts`
- `apps/web/app/mobile-pwa-config.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/mobile-contracts.ts`

## 이번 Phase에서 다시 잠글 IA 원칙

### 1. 홈(`/dashboard`)은 오늘 할 일 시작 화면이다.
- 홈은 `무엇을 지금 먼저 해야 하는가`를 보여 주는 화면이다.
- 우선순위는 `즉시 액션 → 승인/대기/예외 → 최근 상태 요약 → 자주 가는 진입점 → 참고 링크` 순서를 유지한다.
- `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 상단 액션 흐름을 홈의 기본 축으로 읽는다.
- `/org`, `/employees` 는 읽기 중심 마무리 조회 흐름으로 이어진다.

### 2. 메뉴(`/menu`)는 전체 기능 탐색 화면이다.
- 메뉴는 홈을 대체하는 또 하나의 랜딩 페이지가 아니라 `전체 기능 선택 화면`이다.
- 홈에서 다 보여 주지 않는 기능군, 모바일 전체 메뉴, 역할별 추가 진입점을 구조적으로 정리하는 곳이다.
- 홈과 메뉴는 다른 사이트맵이 아니라 같은 shortcut/권한 registry 를 공유해야 한다.

### 3. 홈 바로가기는 두 층으로 분리한다.
- 회사 공통 고정 바로가기: 모두가 같은 순서로 찾는 기본 업무
- 권한 기반 사용자 전용 바로가기: 현재 세션 권한이 있을 때만 열리는 추가 진입점

현재 코드 기준 해석:
- `scope === "company"` 또는 `isFixed === true` 항목은 고정 바로가기
- `scope === "user"` 이고 `isFixed !== true` 인 항목은 사용자 전용 바로가기

문서 원칙:
- 고정 바로가기는 사용자가 임의로 사라지게 하면 안 된다.
- 사용자 전용 바로가기는 권한이 없으면 빈 상태를 보여 주되 오류처럼 쓰지 않는다.
- 회사 정책 편집 UI나 사용자 영구 저장 커스터마이징이 이미 닫힌 것처럼 쓰지 않는다.

### 4. 모바일과 PC는 같은 정보구조를 가리킨다.
- 모바일 하단 탭은 `메뉴`·`홈`·`메신저`·`메일`·`알림` 5개를 유지한다.
- 실제 업무 진입은 `홈`과 `메뉴`에서 이어진다.
- PC sidebar 는 모바일 전체 메뉴와 같은 메뉴군을 가리킨다.
- 기기별 차이는 탐색 껍데기와 우선순위 재정렬이지, route 의미 차이가 아니다.

### 5. 운영 레인은 홈 기본 흐름과 섞지 않는다.
- `/management` 는 일반 직원 홈의 확장이 아니라 민감 운영 허브다.
- `/admin/users` 는 운영 검토 레인이다.
- `/admin/audit-logs` 는 `audit.read` 기반 read-only 감사 레인이다.
- 관리자/감사/경영업무 진입점은 권한 기반 사용자 전용 바로가기나 별도 운영 CTA 로만 읽혀야 한다.
- 일반 직원 기본 홈 CTA 와 같은 책임처럼 보이면 안 된다.

## 홈과 메뉴의 역할 분담

### 홈(`/dashboard`)에서 먼저 보여 줄 것
- 오늘 출퇴근/휴가/승인 같은 즉시 업무
- 오늘 상태, 예외, 대기, 최근 기록
- 회사 공통 고정 바로가기
- 권한이 있는 경우에만 사용자 전용 바로가기
- 운영/감사 CTA 는 별도 그룹으로 분리

### 메뉴(`/menu`)에서 먼저 보여 줄 것
- 기본 업무 전체 목록
- 공통 업무 엔진 및 확장 모듈 자리
- 내 정보/조회 메뉴
- 협업 placeholder 메뉴
- 역할별 가시 범위에 따른 추가 메뉴
- 홈과 같은 바로가기 데이터를 읽되, 전체 메뉴 탐색 문맥으로 풀어 준 설명

## 이번 Phase의 고정/커스텀 바로가기 정책

### 회사 공통 고정 바로가기
- 대상: 근태, 휴가, 결재처럼 모두가 공통으로 찾는 업무
- 목적: 교육 없이도 같은 위치에서 핵심 기능을 찾게 하는 것
- 노출 위치: 홈(`/dashboard`)과 메뉴(`/menu`) 모두
- 제약: 개인이 임의로 숨기는 기능처럼 설명하지 않는다.

### 권한 기반 사용자 전용 바로가기
- 대상: 관리자, 감사, 경영업무, 역할별 추가 진입점
- 목적: 공통 홈을 어지럽히지 않으면서도 필요한 사람에게만 추가 지름길 제공
- 노출 위치: 홈(`/dashboard`)과 메뉴(`/menu`) 모두
- 제약: 권한 없을 때는 오류가 아니라 `추가 권한 없음` 또는 `노출 안 됨` 상태로 읽혀야 한다.

### 아직 이번 Phase에서 닫지 않는 것
- production DB 기반 영구 개인 커스터마이징 저장
- drag-and-drop 정렬 영구 반영
- 회사 정책 편집 UI로 고정 메뉴를 실시간 변경하는 관리자 기능
- 외부 메신저/메일/푸시 연동

## 권한/노출 기준

- 익명 시작점은 계속 `/login` 뿐이다.
- COMPANY_ADMIN / HR_ADMIN / MANAGER / EMPLOYEE 의 공통 landing 은 `/dashboard` 다.
- AUDITOR 의 공통 landing 은 `/admin/audit-logs` 다.
- 운영/감사/경영업무 shortcut 은 `packages/shared/src/admin-access.ts` 기준을 재사용해야 한다.
- dashboard shortcut, menu shortcut, 직접 route 접근, API guard 가 서로 다른 접근 행렬을 가지면 안 된다.

## 상태 문장 기준

다음 상태는 서로 다른 뜻으로 유지한다.

- empty: 접근 가능하지만 현재 표시할 추가 항목이 없는 정상 상태
- loading: 데이터를 불러오는 중인 상태
- error: 재시도나 운영 확인이 필요한 실패 상태
- forbidden: 권한/회사/범위 차단 상태
- offline: 네트워크가 없어 안내/복구만 가능한 상태
- dev-safe/preview: 실제 영구 저장이나 외부 연동 없이 내부 확인용으로 남겨 둔 상태

특히 사용자 전용 바로가기 없음은 empty 쪽으로 읽히게 해야 하며 error 처럼 쓰면 안 된다.

## 이번 Phase의 산출물

### 필수 문서 산출물
- scope 문서: 이 문서
- handoff 문서: `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-handoff.md`
- guide 문서: `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md`

### 후속 구현/검증 체인에서 확인해야 할 것
- 홈(`/dashboard`)과 메뉴(`/menu`) 역할 문장 분리
- 고정 바로가기와 권한 기반 사용자 전용 바로가기 정책 문장 정리
- 모바일 하단 탭, 메뉴, PC sidebar 의 동일 IA 기준 정리
- 관리자/감사/경영업무 진입점의 분리 노출 정리
- empty/loading/error/forbidden/offline/dev-safe 상태 문장 정리
- live 직접 확인 순서와 대체 검증 근거 분리

## 이번 Phase에서 하지 않는 것

아래 항목은 이번 Phase 완료와 별개 승인 게이트다.

- production DB 실데이터 기반 개인 홈 커스터마이징 영구 저장
- secret 입력/교체
- DNS/custom domain
- 유료 리소스
- 외부 메신저/메일/푸시/SMS 연동
- native 앱 배포
- migration
- destructive 작업

## 추천 확인 순서

1. `/login`
2. `/dashboard`
3. 회사 공통 고정 바로가기 영역
4. 권한 기반 사용자 전용 바로가기 영역
5. `/menu`
6. 하단 탭 5개 설명
7. 기본 업무 / 공통 업무 / 내 정보 / 협업 placeholder 메뉴 묶음
8. 필요 시 `/management`
9. 필요 시 `/admin/users`
10. 필요 시 `/admin/audit-logs`
11. Phase 57 handoff / guide 문서

## 근거 문서

- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`
- `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/guides/phase-47-operational-stability-performance-mobile-pwa-usability-handoff.md`
- `docs/architecture/phase-56-management-admin-live-operations-pass1-fit-gap-scope.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-handoff.md`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/menu-page-content.tsx`
- `apps/web/app/menu/page.tsx`
- `apps/web/app/_components/home-shortcuts-panel.tsx`
- `apps/web/home-shortcuts.ts`
- `apps/web/app/mobile-pwa-config.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/mobile-contracts.ts`
