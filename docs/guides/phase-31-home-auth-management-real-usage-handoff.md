# Phase 31 홈·로그인·경영업무·계정관리 실사용화 handoff

한 줄 요약:
이번 Phase 31은
이미 있는 업무 모듈들을 새로 만들기보다,
대장이 `admin / 1234`로 로그인해서
홈·경영업무·계정관리·주요 업무 route를 직접 눌러 볼 수 있게
입구와 권한 쉘을 먼저 닫는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면
이미 많이 만들어진 것:
- `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me`
- `/work-items`, `/work-items/hr`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/work-items/branch`
- `/management`, `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`
- API 권한/조직 경계 테스트 일부

아직 대장이 직접 눌러 보기엔 부족한 것:
- 로그인/세션/로그아웃/redirect 기준이 UAT 관점에서 덜 닫혀 있음
- `/boards`, `/documents`, `/me`, `/admin` 은 placeholder 의존이 큼
- `/attendance`, `/leave`, `/approvals` 는 happy path 보다 안내 문구 비중이 큼
- 계정 생성/권한 변경/비활성/비밀번호 초기화가 한 묶음 관리 흐름으로 아직 닫히지 않음

즉 지금은
업무 모듈의 "중간 내용"보다
그 모듈들로 들어가는 "입구와 권한 쉘"을 먼저 실사용화해야 하는 시점입니다.

## 2. 이번 Phase 31을 어떻게 이해하면 되는가

### 1) 대시보드=홈으로 확정한다.
- 기본 홈은 `/dashboard`
- 로그인 뒤 일반 직원은 자기 업무 홈으로 간다.
- 지정 관리자는 `/dashboard` 내 관리자 CTA 또는 `/management` 로 이어진다.
- 모바일/PC 에서 같은 정보구조 언어를 쓴다.

### 2) 테스트 로그인 기준을 공식화한다.
- 계정: `admin`
- 비밀번호: `1234`
- 용도: dev/test/UAT 전용
- production 에서는 금지
- 실제 운영은 초기 비밀번호 강제 변경 또는 seed 교체 절차 필요

즉,
이번 계정은 "대장이 바로 눌러볼 UAT 계정"이지
운영 기본 계정이 아닙니다.

### 3) 계정관리도 이번 Phase 범위에 넣는다.
이번 단계에서 최소한 아래는 직접 눌러 볼 수 있어야 합니다.
- 사용자 생성
- 역할/업무권한 지정
- 활성/비활성
- 비밀번호 초기화/변경
- 변경 뒤 접근 결과 확인

단,
아래는 아직 안 엽니다.
- 실제 메일 초대
- SSO/OAuth
- 운영 인사정보 대량 import
- 외부 IdP 연동

### 4) 경영업무는 민감 모듈 허브로 유지한다.
경영업무 허브는
일반 직원 화면과 분리된 관리자 업무 진입점입니다.

포함 대상:
- 인사관리
- 급여정산
- 근태/휴가 관리자 업무
- 세무
- 노무
- 법무
- 지점 운영
- 컴플라이언스/법령 리스크 경고

중요:
- 일반 직원은 자기 업무 중심 화면만 본다.
- 민감 리스크 상세는 관리자/담당자만 본다.
- route guard + API guard + scope 설명이 같이 맞아야 한다.

### 5) 완료 기준은 "대장이 직접 눌러볼 수 있는가"다.
각 기능은 문서와 최종 보고에 아래를 남겨야 합니다.
- 확인 route
- 사용할 계정/권한
- 직접 해볼 action
- happy path 확인 포인트
- forbidden/empty/error 확인 포인트
- 아직 dev-safe/mock 인 부분
- 별도 승인 필요 항목

## 3. 현재 fit-gap을 한 번에 보면

### 먼저 붙잡힌 현재 재검증 근거
- parent 검증 카드 기준으로 `admin / 1234` 로그인 happy path 와 권한 경계가 현재 워크스페이스에서 다시 확인되었습니다.
- 익명 기준 `/login` 200, `/dashboard` 200, `/management` 307, `/admin` 307, `/api/me` 401 이 유지됩니다.
- 관리자 로그인 기준 `/dashboard` 200, `/management` 200, `/work-items/legal` 200, `/api/admin/users` 200 이 확인됐습니다.
- 일반 직원 로그인 기준 `/dashboard` 200, `/management` 307 `/forbidden`, `/work-items/legal` 307 `/forbidden`, `/api/admin/users` 403 이 확인됐습니다.
- 즉 "로그인 후 일반 업무 vs 경영업무/관리자 영역 분리" 자체는 이미 검증 근거가 있고, 이번 문서화의 초점은 그 위에 남은 UAT 설명과 fit-gap을 같은 언어로 고정하는 것입니다.

### 지금 바로 이어쓰기 좋은 기반
- `work-items` 계열 허브와 역할별 모듈 분리
- `management` 허브 개념
- `apps/api/src/app.ts` 의 조직/권한 설명 데이터
- `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts`
- 기존 admin route 구조

### 이번에 우선 닫아야 할 구멍
1. 로그인/세션/redirect
2. 홈/경영업무 landing 분리
3. 계정관리 dev-safe CRUD 흐름
4. 게시판/문서/근태/휴가/결재의 최소 happy path 연결
5. placeholder 잔여 route 를 fit-gap 표로 분리

### 이번 문서에서 고정할 fit-gap 표
| 구분 | 지금 대장이 직접 눌러볼 수 있는 것 | 아직 dev-safe / skeleton 잔여 | 다음 구현 우선순위 |
| --- | --- | --- | --- |
| 로그인/landing | `admin / 1234` 로그인, 익명→로그인 redirect, 일반 직원 vs 관리자 landing 분리 | production 기본 계정으로 쓰면 안 됨, seed 교체/초기 비밀번호 변경 절차는 별도 | 로그인 copy, 로그아웃, 세션 만료/forbidden 안내 다듬기 |
| 홈/경영업무 | `/dashboard`, `/management`, `/work-items*`, 관리자 CTA/민감 모듈 분리 | 홈 카드별 UAT 설명과 오류/빈 상태 문구는 더 보강 필요 | 홈 바로가기·경영업무 허브 문구 정리 |
| 계정관리 | `/admin/users`, `/api/admin/users`, 역할별 admin guard | 생성/수정/비활성/초기화 전체를 한 흐름으로 누르는 체감은 아직 약함 | dev-safe 계정 CRUD 시나리오 1세트 완성 |
| 일반 업무 | `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` route 진입과 일부 상태 확인 | route별 happy path 가 고르게 닫히지 않았고 placeholder 비중 차이가 큼 | 모듈별 최소 1개 happy path + forbidden/empty/error 고정 |
| 민감 모듈 | `/work-items/hr`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/work-items/branch` 와 `/management` 분리 | 실제 외부 연동/실민감 원문 저장/실지급·실신고는 계속 금지 | UAT 설명 강화, approval gate 유지 |

## 4. 구현 우선순위

### P1. 로그인·세션·landing
먼저 해야 하는 이유:
다른 모든 UAT가 여기서 시작하기 때문입니다.

포함:
- `/login`
- 세션 생성/로그아웃
- 역할별 redirect
- admin seed 계정
- forbidden 처리

### P2. 홈·경영업무 쉘
포함:
- `/dashboard`
- `/management`
- 모바일/PC 공통 바로가기 구조
- 관리자 전용 CTA / 일반 직원 CTA 분리

### P3. 계정관리
포함:
- `/admin/users`
- 사용자 생성/수정/비활성/초기화
- 역할 변경 뒤 접근 결과 확인

### P4. 주요 업무 UAT 연결
후보:
- 게시판: 작성 → 상세 → 댓글/읽음 확인
- 문서: 목록 → 상세/첨부 metadata → 권한 차단
- 근태: 출근/퇴근 또는 정정 요청
- 휴가: 신청 → 승인/반려 → 상태 확인
- 전자결재: 기안 → 승인/반려/보완 → 결재함 상태

중요:
모든 모듈을 완전 구현하는 것이 아니라,
대장이 직접 눌러볼 최소 happy path 를 우선 닫습니다.

## 5. 이번 단계에서 일부러 안 하는 것
- Phase 30 전체 알림/감사/통합 대시보드 고도화 전체
- 실메일/실메신저/실SSO 연동
- production 비밀번호 운영 전환
- 실급여 지급, 실민감정보 입력 확대
- 외부 기관 계정/API 연동
- production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업

## 6. 구현자에게 바로 넘길 작업 언어
구현자는 아래 순서로 읽으면 됩니다.

1. 로그인과 세션부터 닫는다.
2. `/dashboard` 와 `/management` 의 역할별 landing 을 닫는다.
3. `/admin/users` 에서 dev-safe 계정관리 흐름을 닫는다.
4. 게시판/문서/근태/휴가/결재 중 UAT 체감이 큰 route 부터 happy path 를 하나씩 연결한다.
5. 남은 placeholder route 는 문서에 숨기지 말고 fit-gap 표로 남긴다.

## 7. 대장이 가장 먼저 볼 7가지 질문
1. `admin / 1234`로 로그인해서 바로 홈/경영업무 흐름을 볼 수 있는가?
2. 일반 직원과 관리자의 landing 이 실제로 갈라지는가?
3. 계정 생성/권한 변경/비활성/초기화가 dev-safe 범위에서 직접 눌러볼 수 있는가?
4. 경영업무 허브에서 민감 모듈이 일반 업무와 분리되어 보이는가?
5. 주요 업무 모듈마다 최소 happy path 하나는 직접 체험 가능한가?
6. forbidden/empty/error 상태가 문서와 화면에서 같이 설명되는가?
7. 아직 mock/dev-safe 인 부분과 승인 필요 항목이 숨겨지지 않고 분리되어 있는가?

## 7-1. 대장이 실제로 바로 눌러볼 추천 순서
1. `/login` — `admin / 1234` 기준 dev-safe UAT 계정 설명과 production 금지 문구를 먼저 봅니다.
2. `/dashboard` — 일반 업무 홈과 관리자 CTA 분리가 보이는지 봅니다.
3. `/management` — 경영업무 허브가 일반 직원 홈과 분리돼 있는지 봅니다.
4. `/admin/users` — 계정관리 진입점과 권한 경계가 같은 언어인지 봅니다.
5. `/attendance` → `/leave` → `/approvals` — 직원 업무 happy path 후보와 예외 상태 문구를 봅니다.
6. `/boards` → `/documents` → `/me` — 협업/보관/내 정보 흐름이 route 진입 기준으로 이어지는지 봅니다.
7. `/work-items/hr|tax|labor|legal|branch` — 민감 모듈이 `경영업무` 아래에서만 읽히는지 봅니다.

## 7-2. 이번 문서화에서 일부러 분리해 적어야 하는 것
- 지금 바로 체험 가능한 route
- 아직 placeholder 비중이 큰 route
- forbidden/empty/error 로 확인해야 하는 route
- dev-safe 계정/fixture 에 기대는 부분
- 별도 승인 없이는 절대 열지 않는 부분

## 8. 먼저 볼 파일
- `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`
- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/dashboard-page-content.tsx`
- `apps/web/app/management/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/api/src/app.ts`
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `ROADMAP.md`
- `TASKS.md`
- `HANDOFF.md`
