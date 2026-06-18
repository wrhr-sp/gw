# Phase 57 홈·대시보드 분리, 고정/커스텀 바로가기, 모바일/PC IA handoff

## 이 문서의 목적

다음 작업자가 Phase 57을 다시 해석하지 않도록,
현재 코드에서 이미 확인 가능한 홈/메뉴/바로가기/모바일 navigation 근거와 이번 Phase에서 반드시 지켜야 할 문장 기준을 쉬운 한국어로 묶어 넘긴다.

## 이번 Phase의 핵심 해석

- `/dashboard` 는 오늘 할 일을 먼저 처리하는 홈이다.
- `/menu` 는 전체 기능 탐색 화면이다.
- 홈과 메뉴는 다른 사이트맵이 아니라 같은 shortcut/권한 registry 를 공유한다.
- 홈 바로가기는 `회사 공통 고정` 과 `권한 기반 사용자 전용` 두 층으로 나뉜다.
- 모바일 하단 탭 5개, 모바일 전체 메뉴, PC sidebar 는 같은 정보구조를 다른 탐색 껍데기로 보여 주는 것이다.
- `/management`, `/admin/users`, `/admin/audit-logs` 운영 레인은 홈 기본 CTA 와 섞지 않는다.
- production DB 영구 저장 커스터마이징, 외부 메신저/메일/푸시 연동은 아직 이번 Phase 완료 기준이 아니다.

## 지금 바로 볼 파일

### 기획 문서
- `docs/architecture/phase-57-home-dashboard-shortcuts-mobile-pc-ia-fit-gap-scope.md`
- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/architecture/phase-56-management-admin-live-operations-pass1-fit-gap-scope.md`

### 웹 구현
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/menu/page.tsx`
- `apps/web/menu-page-content.tsx`
- `apps/web/app/_components/home-shortcuts-panel.tsx`
- `apps/web/home-shortcuts.ts`
- `apps/web/app/mobile-pwa-config.ts`

### shared / contract / access
- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/mobile-contracts.ts`

## 사용자에게 어떻게 읽혀야 하는가

### 1. 일반 직원
- 익명 시작점은 계속 `/login` 뿐이다.
- 로그인 후 일반 직원의 기본 레인은 `/dashboard` 중심이다.
- 홈에서 먼저 읽는 순서는 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 다.
- `/menu` 는 홈에서 다 보지 못한 전체 기능을 찾는 화면이다.
- 운영/감사/경영업무 shortcut 이 기본 홈 CTA 와 섞여 보이면 안 된다.

### 2. 관리자/담당자
- 공통 landing 은 여전히 `/dashboard` 다.
- 다만 운영 관련 진입은 일반 직원 CTA 와 같은 줄로 읽히지 않게 별도 shortcut 또는 별도 CTA 로 보여야 한다.
- `/management` 는 경영업무 허브, `/admin/users` 는 운영 검토, `/admin/audit-logs` 는 감사 read-only 라는 책임 분리를 유지한다.

### 3. 감사 담당자
- 공통 landing 은 `/admin/audit-logs` 다.
- 감사 사용자가 홈 전체 구조를 볼 수 있다고 해서 운영 변경 권한을 자동으로 가진 사용자인 것은 아니다.

## 구현/리뷰 단계에서 먼저 볼 질문

1. `/dashboard` 와 `/menu` 가 같은 홈/메뉴를 두 번 설명하는 중복 화면처럼 읽히지 않는가?
2. 회사 공통 고정 바로가기와 권한 기반 사용자 전용 바로가기가 같은 정책처럼 뭉개지지 않는가?
3. `scope === company`, `isFixed === true`, `scope === user` 해석이 UI 문장과 어긋나지 않는가?
4. 모바일 하단 탭 5개, 모바일 전체 메뉴, PC sidebar 가 서로 다른 사이트맵처럼 설명되지 않는가?
5. `/management`, `/admin/users`, `/admin/audit-logs` 운영 레인이 홈 기본 CTA 와 섞이지 않는가?
6. empty / loading / error / forbidden / offline / dev-safe 상태가 서로 다른 뜻으로 유지되는가?
7. 영구 저장 커스터마이징과 외부 연동이 이미 완료된 것처럼 과장되지 않는가?

## 테스트 단계에서 꼭 다시 볼 것

- 익명 접근은 `/login` 단독 시작으로 유지되는지
- `/dashboard` 와 `/menu` 가 같은 shortcut 데이터를 읽고 같은 권한 기준을 쓰는지
- 고정 바로가기 없음을 로그인 전 상태로, 사용자 전용 바로가기 없음을 정상 empty 상태로 읽을 수 있는지
- 권한 없는 세션에 운영/감사/경영업무 shortcut 이 노출되지 않는지
- 모바일 하단 탭 5개 설명과 실제 메뉴 구조가 같은 뜻인지
- PC sidebar 문장과 모바일 전체 메뉴 문장이 같은 메뉴군을 가리키는지
- live 직접 확인 근거와 local preview/build/test 근거가 섞이지 않는지

## 문서화 단계에서 이어서 볼 것

아래 내용은 `docs/guides/phase-57-home-dashboard-shortcuts-mobile-pc-ia-guide.md` 에 쉬운 한국어 guide 로 묶어 둔다.

- live URL 기준 추천 확인 순서
- 홈과 메뉴를 각각 어떻게 읽는지
- 고정 바로가기 / 사용자 전용 바로가기 확인 포인트
- 모바일 하단 탭 / 모바일 전체 메뉴 / PC sidebar 확인 포인트
- 관리자/감사/경영업무 분리 노출 확인 포인트
- UAT 절차
- 운영 체크리스트
- 최종 보고 템플릿
- 승인 게이트 목록

## 현재 연결된 Kanban 체인

- 기획: `t_e662066c`
- 구현: `t_4c83b740`

## 계속 승인 게이트로 남기는 것

- production DB 실데이터 기반 개인 홈 커스터마이징 영구 저장
- drag-and-drop 정렬 영구 반영
- 회사 정책 편집 UI로 홈 고정 메뉴 즉시 변경
- 외부 메신저/메일/푸시/SMS 연동
- native 앱 배포
- secret 입력/교체
- DNS/custom domain
- 유료 리소스
- migration
- destructive 작업

## 추천 확인 순서

1. `/login`
2. `/dashboard`
3. 회사 공통 고정 바로가기
4. 권한 기반 사용자 전용 바로가기
5. `/menu`
6. 하단 탭 5개 설명
7. 기본 업무 / 공통 업무 / 내 정보 / 협업 placeholder 메뉴 섹션
8. 필요 시 `/management`
9. 필요 시 `/admin/users`
10. 필요 시 `/admin/audit-logs`
11. Phase 57 scope 문서
