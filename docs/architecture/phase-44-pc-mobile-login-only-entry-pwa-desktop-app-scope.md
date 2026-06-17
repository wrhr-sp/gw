# Phase 44 PC/모바일 로그인 단독 진입 + PWA 데스크톱 앱 범위

## 한 줄 요약
이번 Phase의 목표는
PC와 모바일 첫 진입을 모두 `/login` 단독 화면으로 더 강하게 고정하고,
일반 사용자 Web/PWA를 Windows Chrome/Edge에서 "설치형 데스크톱 앱처럼" 쓸 수 있게 하는 1차 기준을 닫는 것입니다.

쉽게 말하면 이번 단계는
"로그인 전엔 아무 것도 안 보이게"와
"설치 후 실행해도 로그인부터 시작하게"를 한 세트로 맞추는 작업입니다.

## 왜 지금 이 단계가 필요한가
Phase 42A에서 이미 로그인 필수 진입 정책을 정리했지만,
현재 저장소에는 아래처럼 아직 남은 틈이 있습니다.

1. `/login` 화면에 dev-safe 역할 미리보기, 기본값 복원, landing 설명처럼 "로그인 외 문맥"이 여전히 남아 있습니다.
2. `apps/web/admin-preview-guard.ts` 에는 general preview host에서 paired admin host를 계산하지 못할 때 `/admin*` 를 allow 하는 예외가 남아 있습니다.
3. 일반 사용자 PWA manifest 는 여전히 `start_url: "/"` 기준이라, 설치 후 첫 실행을 제품 기준에서 더 명확히 `/login` 으로 고정할 필요가 있습니다.
4. 모바일/PC/PWA 문서에는 로그인 필수 진입과 데스크톱 설치 경험이 한 카드 언어로 묶여 있지 않습니다.

즉 이번 Phase의 목적은 새 인증 수단을 늘리는 것이 아니라,
이미 있는 로그인 guard와 PWA 자산을
"로그인 단독 진입 + 설치형 데스크톱 앱" 기준으로 다시 정렬하는 것입니다.

## 확정 요구사항
- PC와 모바일 모두 첫 진입은 `/login` 단독 화면이다.
- 로그인 전에는 홈/대시보드/메뉴/근태/휴가/게시판/문서/경영업무/관리자/오프라인 등 그룹웨어 기능이 보이면 실패다.
- 로그인 화면은 ID, 비밀번호, 로그인 버튼, 최소 보조 옵션(자동 로그인, 아이디 저장 정도)만 허용한다.
- 첨부 이미지는 "로그인 화면만 보이는 상태" 설명용일 뿐, 디자인 복제 지시가 아니다.
- 데스크톱 앱 1차 목표는 PWA 설치형 앱이다. 진짜 `.exe`, Tauri, Electron, 코드서명은 이번 범위가 아니다.
- Windows/Chrome/Edge 기준으로 manifest, icon, metadata, installability, desktop launch 경로를 검증 가능해야 한다.
- production DB 실데이터, secret, DNS/custom domain, 유료 리소스, migration, destructive 작업은 계속 별도 승인 게이트다.

## 현재 구현 기준 fit-gap 요약

### 이미 있는 근거
- `apps/web/middleware.ts`
  - 비정적 page request를 guard로 태운다.
- `apps/web/admin-preview-guard.ts`
  - `/`, `/admin*`, 민감 route, 공개 route를 host + session 기준으로 분기한다.
- `apps/web/app/login/login-form.tsx`
  - ID/비밀번호 입력, 자동 로그인(`rememberSession`) 체크, 로그인 POST 골격이 이미 있다.
- `apps/api/src/app.ts`
  - `gw_session` 발급/삭제와 로그인 API 골격이 있다.
- `apps/web/app/mobile-pwa-config.ts`
  - 일반/관리자 manifest, icons, shortcuts, install/offline 문구 기준이 있다.
- `apps/web/mobile-pwa.test.ts`, `apps/web/admin-preview-guard.test.ts`
  - manifest, install copy, admin/general host 경계 회귀 테스트 근거가 있다.

### 현재 요구를 이미 부분 충족하는 영역
1. `/login` 진입 자체는 이미 있다.
2. 자동 로그인 체크와 세션 유지 계약도 이미 있다.
3. `/admin*` 공개 노출 차단과 `/management` 민감 경계도 일부 이미 있다.
4. PWA manifest/icon/install 기본 뼈대도 이미 있다.

### gap 이 큰 영역
1. 로그인 화면이 아직 단독 업무 입구처럼 충분히 정리되지 않았다.
   - 현재 `미리 볼 역할`, `선택한 landing`, `기본값으로 되돌리기`, `admin / 1234로 로그인` 같은 dev-safe 문맥이 강하다.
2. general preview host 의 `/admin*` 예외 허용 여지가 남아 있다.
   - `isWorkersPreviewGeneralHost(host)` 분기 때문에 paired admin host 계산 실패 시 allow 로 흐를 수 있다.
3. 설치 후 일반 사용자 앱 시작점이 제품 언어상 아직 `/login` 으로 고정돼 있지 않다.
   - 현재 일반 manifest 는 `start_url: "/"`, `id: "/"` 기준이다.
4. 로그인 단독 진입과 데스크톱 설치 안내가 문서/테스트에서 한 세트로 묶여 있지 않다.

## route / host / 앱 시작 정책 기준

### 로그인 전 허용
- `/login`
- 로그인 처리 API
- 정적 자산
- manifest/icon/service worker/installability 확인에 필요한 공개 자산
- 최소 health

### 로그인 전 차단
- `/`
- `/dashboard`
- `/menu`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/notifications`
- `/management`
- `/admin*`
- `/offline` 내부 업무 복구형 노출
- 내부 업무 API

### 일반 사용자 PWA 기준
- 일반 사용자 앱 manifest 는 same-origin 상대 경로를 유지한다.
- 일반 사용자 앱 시작점은 `/login` 으로 본다.
- 설치 후 앱 실행 시 로그인 세션이 없으면 로그인 화면만 보여야 한다.
- 로그인 후에는 역할별 landing 으로 이동해도 되지만, 설치 직후 비로그인 상태에서 업무 화면이 먼저 보이면 안 된다.

### 관리자 앱 기준
- 관리자 manifest 분리는 유지할 수 있다.
- 단, 익명 사용자가 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 에서 admin skeleton 을 먼저 보면 실패다.
- admin host root 역시 결과적으로 로그인 요구 상태를 먼저 만나야 한다.

## 구현 범위

### 1. 로그인 화면 단독화
- `apps/web/app/login/page.tsx`, `apps/web/app/login/login-form.tsx` 를 기준으로
  로그인 화면에서 내부 기능/역할 미리보기 노출을 걷어낸다.
- 필수 요소는 ID, 비밀번호, 로그인 버튼, 자동 로그인, 필요 시 아이디 저장 정도로 제한한다.
- dev-safe 계정 안내가 필요하더라도 운영 제품 기본 UI처럼 보이지 않게 보조 문맥으로 낮춘다.

### 2. 익명 route 차단 재고정
- `apps/web/admin-preview-guard.ts`, `apps/web/middleware.ts` 기준으로
  익명 `/`, `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/notifications`, `/management`, `/admin*` 차단을 다시 잠근다.
- 특히 general preview host에서 `/admin*` 를 allow 하는 예외를 제거하거나, 최소한 `/login` 또는 명시적 차단으로 바꾼다.

### 3. PWA desktop app 1차 정리
- 일반 사용자 manifest 의 `start_url` 과 설치 후 launch 문맥을 로그인 우선 기준으로 맞춘다.
- manifest/icon/meta/install copy 가 "오프라인 업무 가능"이나 "네이티브 앱 완성"처럼 과장되지 않게 유지한다.
- Windows Chrome/Edge 기준 설치 메뉴 노출과 실행 경로를 확인할 수 있게 한다.

### 4. PC/mobile 같은 정보구조 유지
- viewport 가 달라도 비로그인 상태에서는 로그인 화면만 보이게 한다.
- mobile shell/bottom nav/sidebar 가 로그인 전 먼저 드러나지 않게 유지한다.

### 5. 문서/검증 기준 동기화
- scope/handoff, 루트 문서, 테스트 계획, QA 체크리스트를 이번 기준으로 맞춘다.
- 최종 보고에는 live URL, PC 확인 route, 모바일 확인 route, PWA 설치 확인 방법, 남은 승인 게이트를 포함한다.

## 구현자가 바로 볼 파일
- `apps/web/app/login/page.tsx`
- `apps/web/app/login/login-form.tsx`
- `apps/web/middleware.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/mobile-pwa.test.ts`
- `apps/web/app/layout.tsx`
- `apps/api/src/app.ts`
- `docs/architecture/phase-42a-login-required-entry-online-session-offline-exclusion-fit-gap-scope.md`
- `docs/guides/admin-host-pwa-pass-1-handoff.md`

## 테스트 시나리오

### A. 익명 사용자
- `/login` 은 정상 렌더링
- `/`, `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/notifications`, `/management`, `/admin*` 는 `/login` 또는 401/403으로 차단
- `/offline` 이 남아 있어도 업무 복구 링크 없이 로그인 재시도 안내만 보여야 함
- 내부 업무 API 는 401/403 유지

### B. 로그인 화면 단독성
- 로그인 전 화면에 dashboard shortcut, menu, work item, admin 카드, role preview selector 가 노출되지 않음
- 로그인 form copy 가 dev-safe 편의 기능보다 "로그인이 먼저" 문맥을 우선함

### C. 로그인 후 진입
- 로그인 성공 후 역할별 landing 정상
- 일반 직원은 일반 업무만, 관리자/감사/HR 역할은 허용된 운영 route만 접근

### D. PWA desktop app
- `/manifest.webmanifest` 기준 일반 사용자 앱 정체성이 맞음
- 아이콘/이름/설명/시작 경로가 로그인 단독 진입 정책과 충돌하지 않음
- Windows Chrome/Edge 에서 설치 메뉴 노출 또는 installability 확인 가능
- 설치 후 실행 시 세션 없으면 `/login` 부터 시작

### E. 회귀
- `/admin*` 공개 노출 차단 유지
- `/management` 민감 허브 차단 유지
- rememberSession on/off, logout 후 세션 해제 유지
- same-origin `/api/*`, 일반 manifest / 관리자 manifest 분리 원칙 유지

## 승인 게이트
- 진짜 `.exe` 배포
- Tauri/Electron 전환
- 코드서명
- 별도 배포 서버
- DNS/custom domain
- 유료 리소스
- production DB 실데이터
- secret 입력/교체
- migration
- destructive 작업

## 역할별 후속 작업 기준
- builder: login page 단독화, anonymous guard 보강, general PWA start path/manifest/meta 정리, 테스트 보강
- reviewer: 익명 우회, admin 공개 노출, dev-safe UI 잔여, PWA 과장 문구, 벤치마크 복제 여부 리뷰
- tester: PC/mobile anonymous 차단, role landing, manifest/installability, desktop launch, preview smoke 재검증
- docs: 최종 사용자 확인 순서, 설치 확인 방법, 승인 게이트, live URL 보고 형식 정리
- ops: review/test 후 PR/CI/merge/release gate 정리

## 이번 Phase에서 의도적으로 하지 않는 것
- 네이티브 desktop executable 제작
- Electron/Tauri 런타임 도입
- 오프라인 동기화/background sync 확대
- push/native desktop notification 실연동
- production 인증 체계 교체
- secret/DNS/custom domain/유료 리소스 변경
