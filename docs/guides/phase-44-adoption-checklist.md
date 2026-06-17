# Phase 44 도입 체크리스트

## 한 줄 요약
이 체크리스트는 "로그인 전에는 로그인 화면만 보이는지", "직원 레인과 관리자 레인이 섞이지 않는지", "PC에서 PWA를 앱처럼 설치해도 로그인부터 시작하는지"를 빠르게 다시 보는 용도다.

## 먼저 알아둘 점
- 현재 공개 UAT 기준 URL은 `https://gw-web.wereheresp.workers.dev` 이다.
- 테스트 계정 `admin / 1234` 는 dev/test/UAT 전용이다.
- 이번 범위의 데스크톱 앱은 Windows Chrome/Edge 에서 설치하는 PWA 다.
- 진짜 `.exe`, Electron, Tauri, 코드서명은 이번 체크리스트 범위가 아니다.

## 1. 시작 전 준비
- [ ] 접속 URL을 확인했다: `https://gw-web.wereheresp.workers.dev`
- [ ] 테스트 계정이 dev/test/UAT 전용이라는 점을 팀에 먼저 알렸다.
- [ ] 직원 레인과 관리자 레인을 같은 시나리오로 섞지 않기로 합의했다.
- [ ] production 실데이터, secret, 외부 기관 연동, DNS/custom domain, 유료 리소스가 이번 범위 밖이라는 점을 다시 확인했다.

## 2. 로그인 전 노출 기준

### 2-1. 로그인 전 정상으로 봐야 하는 것
- [ ] PC 첫 진입이 `/login` 으로 보인다.
- [ ] 모바일 첫 진입이 `/login` 으로 보인다.
- [ ] 로그인 화면이 ID, 비밀번호, 로그인 버튼, 자동 로그인, 아이디 저장 정도만 보여 준다.

### 2-2. 로그인 전 보이면 안 되는 것
아래는 직접 보이면 실패로 본다.

- [ ] `/`
- [ ] `/dashboard`
- [ ] `/menu`
- [ ] `/attendance`
- [ ] `/leave`
- [ ] `/approvals`
- [ ] `/boards`
- [ ] `/documents`
- [ ] `/notifications`
- [ ] `/management`
- [ ] `/admin`
- [ ] `/admin/users`
- [ ] `/admin/policies`
- [ ] `/admin/audit-logs`
- [ ] 내부 업무 API 가 인증 없이 200 업무 결과를 주지 않는다.

쉽게 말하면,
로그인 전에는 "그룹웨어 안쪽"이 보이지 않고
"로그인부터 하세요"만 보여야 정상이다.

## 3. 로그인 후 직원 기본 레인 체크
- [ ] `/dashboard` 가 홈처럼 읽힌다.
- [ ] `/attendance` 가 오늘 근태 시작점처럼 이어진다.
- [ ] `/leave` 가 잔여/신청/상태 확인 흐름으로 이어진다.
- [ ] `/approvals` 가 협업 흐름으로 이어진다.
- [ ] `/boards` 와 `/documents` 가 자연스럽게 이어진다.
- [ ] `/management` 와 `/admin*` 가 직원 기본 레인에 섞이지 않는다.

추천 확인 순서:
`/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me`

## 4. 로그인 후 관리자/담당자 레인 체크
- [ ] `/management` 가 일반 홈과 분리된 내부관리 허브로 보인다.
- [ ] `/work-items/branch` 가 branch scope 운영 문맥으로 읽힌다.
- [ ] `/payroll` 과 `/payroll/me` 책임이 섞이지 않는다.
- [ ] `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 이 서로 다른 민감 레인으로 보인다.
- [ ] `/admin/audit-logs` 가 read-only 감사 진입점으로 읽힌다.

추천 확인 순서:
`/management` → `/work-items/branch` → `/payroll` → `/payroll/me` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → `/admin/audit-logs`

## 5. PC에서 앱처럼 설치하는 방법

### Windows Chrome
1. `https://gw-web.wereheresp.workers.dev/login` 에 접속한다.
2. 주소창 오른쪽의 설치 아이콘 또는 브라우저 메뉴의 "설치" 항목을 찾는다.
3. 설치를 누른다.
4. 바탕화면/시작 메뉴에 앱이 생겼는지 확인한다.
5. 앱을 다시 열었을 때 세션이 없으면 `/login` 부터 시작하는지 본다.

### Windows Edge
1. `https://gw-web.wereheresp.workers.dev/login` 에 접속한다.
2. 우측 상단 메뉴에서 `앱` 또는 `이 사이트를 앱으로 설치`를 찾는다.
3. 설치를 진행한다.
4. 작업 표시줄/시작 메뉴/바탕화면 고정 여부를 선택한다.
5. 설치된 앱을 다시 열었을 때 세션이 없으면 `/login` 부터 시작하는지 본다.

### 설치 후 확인 포인트
- [ ] 주소창 없는 앱 창처럼 열린다.
- [ ] 로그인 세션이 없으면 `/login` 부터 시작한다.
- [ ] 로그인 후에는 역할에 맞는 landing 으로 이동한다.
- [ ] 설치형 앱처럼 실행돼도 same-origin `/api/*` 와 manifest 정책 설명이 바뀌지 않는다.

## 6. 모바일 확인 포인트
- [ ] 모바일 viewport 에서도 로그인 전 하단 탭/업무 메뉴가 먼저 보이지 않는다.
- [ ] 로그인 후에만 `/dashboard`, `/menu`, `/notifications` 같은 화면으로 이어진다.
- [ ] 로그인 전에는 기능 소개보다 로그인 입구가 먼저 보인다.

## 7. 현재 단계에서 숨기면 안 되는 제한
- [ ] 이번 범위는 PWA 설치형 앱이지 네이티브 실행파일이 아니다.
- [ ] Windows Chrome/Edge 설치 확인이지 모든 데스크톱 환경 완성 보장은 아니다.
- [ ] 실제 급여 지급, 은행 이체, 외부 신고, production 실데이터, 외부 기관 계정 연동은 이번 단계가 아니다.
- [ ] secret 입력/교체, DNS/custom domain, 유료 리소스, migration, destructive 작업은 계속 승인 게이트다.

## 8. 마지막 한 번 더 볼 질문
1. 로그인 전에는 정말 로그인 화면만 보이는가?
2. 직원 레인과 관리자 레인이 같은 홈 흐름처럼 섞이지 않는가?
3. PC에서 설치한 앱도 세션이 없으면 `/login` 부터 시작하는가?
4. 이번 단계가 PWA 설치형 앱이지 네이티브 앱 완성 단계가 아니라는 점이 문서에 분명한가?
5. 승인 게이트가 빠지지 않았는가?

## 함께 볼 문서
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-admin-manager-guide.md`
- `docs/guides/phase-44-operator-runbook.md`
- `docs/guides/phase-44-role-access-matrix.md`
- `docs/guides/phase-44-pc-mobile-login-only-entry-pwa-desktop-app-handoff.md`