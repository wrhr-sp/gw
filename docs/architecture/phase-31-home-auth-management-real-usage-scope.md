# Phase 31 홈·로그인·경영업무·계정관리 실사용화 범위

## 한 줄 요약
Phase 31의 목표는
지금까지 쌓아 둔 업무 모듈들을 그대로 둔 채,
대장이 실제 배포 URL에서 `admin / 1234`로 로그인해서
홈 → 경영업무 → 계정관리 → 주요 업무 route를 직접 눌러 볼 수 있게
진입·권한·계정 seed·기본 예외 상태를 실사용 수준으로 먼저 맞추는 것입니다.

쉽게 말하면 이번 단계는
"새 기능을 또 늘리는 단계"가 아니라,
이미 있는 근태·휴가·전자결재·게시판·문서·공통업무 모듈로
실제 사용자가 들어가는 입구를 먼저 정리하는 단계입니다.

## 왜 Phase 31이 먼저 필요한가
현재 저장소에는 이미 아래처럼
업무 모듈과 route 뼈대가 많이 있습니다.

- 직원 업무: `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me`
- 공통 업무 확장: `/work-items`, `/work-items/hr`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/work-items/branch`
- 운영 허브: `/management`, `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`
- API/권한 골격: `apps/api/src/app.ts`, `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts`

하지만 대장이 직접 체험하는 기준으로 보면
아직 아래 문제가 남아 있습니다.

1. 로그인과 세션이 아직 `dev-placeholder-session` 중심이라
   "누가 어떤 화면으로 들어가야 하는지"가 명확히 닫히지 않았다.
2. `/boards`, `/documents`, `/me`, `/admin` 등 여러 route 는
   아직 placeholder 문구가 중심이라
   happy path 를 눌러 보기 어렵다.
3. 근태/휴가/결재도 화면은 있지만
   실제 상태 전환보다 안내 문구 비중이 높다.
4. 경영업무 허브와 일반 직원 홈의 분리가
   제품 메시지로는 맞지만,
   대장이 바로 눌러 보는 UAT 기준으로는 더 명확한 landing 이 필요하다.
5. 계정 생성/비활성/역할 변경/비밀번호 초기화 같은
   dev-safe 관리자 흐름이 아직 별도 milestone 으로 고정되지 않았다.

그래서 실사용 전환 1차 다음 우선순위는
Phase 30 전체 고도화보다
Phase 31에서 입구와 권한 쉘을 먼저 닫는 것입니다.

## 현재 구현 기준 fit-gap 요약

### 먼저 확인된 현재 검증 근거
- parent 테스트 카드 기준으로 anonymous / admin / employee 세 가지 시점의 route 와 API 경계가 이미 재검증됐다.
- 익명 기준 `/login` 200, `/dashboard` 200, `/management` 307, `/admin` 307, `/api/me` 401 이 확인됐다.
- 관리자 로그인 기준 `/dashboard` 200, `/management` 200, `/work-items/legal` 200, `/api/admin/users` 200 이 확인됐다.
- 일반 직원 로그인 기준 `/dashboard` 200, `/management` 307 `/forbidden`, `/work-items/legal` 307 `/forbidden`, `/api/admin/users` 403 이 확인됐다.
- 따라서 Phase 31의 출발점은 "입구와 권한 분리 자체를 새로 발명하는 것"이 아니라, 이미 확인된 경계 위에 UAT 설명·계정관리 체감·happy path 연결을 더 닫는 것이다.

### 바로 사용 가능에 가까운 영역
아래는 현재 route/test 기준으로
"실제 업무 방향을 설명할 수 있는 영역"입니다.

- `/login`
  - `apps/web/app/login/page.tsx` 에서 `admin / 1234` dev-safe UAT 계정, 역할별 첫 landing, production 금지 문구가 한 화면에 묶여 있다.
- `/dashboard`
  - `apps/web/app/dashboard/page.tsx` 와 `apps/web/dashboard-page-content.tsx` 에서 세션 roleCode 기준으로 관리자 CTA 와 경영업무 카드 노출이 갈린다.
  - `apps/web/app/_components/home-shortcuts-panel.tsx` 기준으로 회사 공통 고정 바로가기와 사용자 전용 커스텀 바로가기를 나눠 보여 준다.
  - 홈 바로가기는 `로그인 전 고정 바로가기 API 미조회`, `사용자 전용 바로가기 없음`, `API load error` 를 서로 다른 상태로 나눠 설명한다.
  - 같은 홈 정보구조를 PC/모바일에서 같이 쓰고, 일반 host 와 관리자 host 는 `apps/web/mobile-pwa.test.ts` 기준 서로 다른 manifest/shortcut 세트를 유지한다.
- `/management`
  - `apps/web/app/management/page.tsx` 에서 민감 모듈 허브를 일반 직원 홈과 분리해 `/admin/users`, `/payroll`, `/work-items/*`, `/admin/audit-logs` 로 연결한다.
- `/admin/users`
  - `apps/web/app/admin/users/page.tsx` 가 `GET /api/admin/users` preview 를 same-origin 으로 읽고, 화면은 dev-safe 계정관리 preview 를 보여 준다.
- `/admin/audit-logs`
  - 감사/컴플라이언스 확인은 read-only 감사 route 로 분리돼 있고, 경영업무 허브와 관리자 검토 레인에서 같은 의미로 연결된다.
- `/work-items*` 계열 공통 업무 허브
  - HR / 세무 / 노무 / 법무 / 지점 업무가 같은 구조로 읽힌다.
  - API와 role boundary 테스트 근거가 있다.
- `/management`
  - 민감 모듈을 일반 직원 업무와 분리하는 허브 의미가 이미 있다.
- 권한/조직/API guard 골격
  - `apps/api/test/auth-org.spec.ts`
  - `apps/api/test/work-items.spec.ts`
  - 일부 web boundary 테스트
- admin 운영 콘솔 정보구조
  - `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 라우트 자체는 이미 있다.
- 로그인 이후 landing 경계의 기본 뼈대
  - 익명/관리자/일반 직원에 따라 redirect 와 차단이 이미 다른 결과를 돌려준다.

### 아직 skeleton 잔여가 큰 영역
아래는 route 는 있지만
아직 바로 사용 가능한 흐름으로 보기 어려운 영역입니다.

- `/login`
  - 화면 문구와 추천 순서는 좋아졌지만, 실제 세션은 여전히 dev-safe placeholder 성격이 강하다.
- `/dashboard`
  - 진입 구조와 경영업무 분리는 작동하지만, 제목/설명 자체가 아직 `skeleton`, `placeholder/dev-safe 요약` 언어를 유지하고 있다.
- `/boards`, `/documents`, `/me`, `/admin`
  - placeholder copy 의존이 남아 있다.
- `/attendance`, `/leave`, `/approvals`
  - 실제 happy path 보다 skeleton 안내 비중이 높다.
- 계정관리
  - `생성/권한/상태/비밀번호` 폼과 redirect preview 는 있지만, `apps/web/app/admin/users/dev-safe-action/route.ts` 기준 실제 저장 없이 결과 문구만 돌려준다.
  - 즉 계정관리는 "preview 가능" 단계이지 "운영 저장 가능" 단계가 아니다.

### 문서에 남길 fit-gap 표 기준
| 구분 | 지금 바로 체험 가능한 것 | 아직 남은 skeleton/dev-safe 성격 | 다음 pass 우선순위 |
| --- | --- | --- | --- |
| 로그인/landing | `admin / 1234`, 익명→로그인 차단, 역할별 landing 분기 | production 기본 계정 아님, seed/초기 비밀번호 운영 절차 별도 | 로그인/로그아웃/세션 만료 copy 보강 |
| 홈/경영업무 | `/dashboard`, `/management`, 관리자 CTA, 민감 모듈 분리, 고정/커스텀 홈 바로가기 | 홈 카드별 happy path 설명과 예외 상태 문구 부족, 일부 route 는 placeholder 비중 차이 큼 | 홈·경영업무 UAT 시나리오 고정 |
| 계정관리 | `/admin/users`, `/api/admin/users`, 권한 guard | 생성/수정/비활성/초기화가 한 덩어리 UX로는 덜 닫힘 | dev-safe CRUD 시나리오 완성 |
| 일반 업무 | `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` route 진입 | 모듈마다 placeholder 비중과 happy path 연결 정도가 다름 | 모듈별 최소 1개 happy path 고정 |
| 민감 모듈 | `/work-items/hr|tax|labor|legal|branch`, `/management` | 외부 연동/실민감 원문/실지급·실신고는 금지 | approval gate 유지 + UAT 설명 보강 |

## Phase 31에서 고정할 핵심 결정

### 결정 A. 대시보드=홈으로 확정한다.
- `/dashboard` 를 제품의 기본 홈으로 본다.
- 로그인 후 첫 landing 은 역할별로 나눈다.
  - 일반 직원: `/dashboard`
  - 지정 관리자: `/management` 또는 `/dashboard` 내 관리자 CTA
- 모바일/PC 모두 같은 정보구조 언어를 쓴다.
- 홈 바로가기는 `회사 공통 고정` 과 `사용자 전용 커스텀` 으로 나눠 보여 준다.
  - 고정 바로가기: 근태·휴가·결재처럼 모두가 같은 순서로 찾는 기본 업무
  - 커스텀 바로가기: 관리자·감사·경영업무처럼 현재 세션 권한에 따라 달라지는 진입점
- 모바일/PWA shortcut 과 관리자 host manifest 도 같은 분리 원칙을 따른다.

### 결정 B. 테스트 로그인 기준을 공식 dev-safe UAT 계정으로 고정한다.
- 테스트 계정: `admin`
- 테스트 비밀번호: `1234`
- 용도: dev/test/UAT 전용
- 문서에 production 금지 원칙을 분명히 적는다.
- 실제 운영에서는 초기 비밀번호 강제 변경 또는 seed 교체 절차가 별도 필요하다고 명시한다.

### 결정 C. 계정관리는 Phase 31의 범위 안에 넣는다.
이번 단계에서 최소한 아래는 직접 눌러 볼 수 있어야 합니다.

- 사용자 생성
- 역할/업무권한 지정
- 활성/비활성 전환
- 비밀번호 초기화/변경
- 역할별 접근 결과 확인

단,
아래는 계속 승인 게이트입니다.

- 실운영 SSO/OAuth/메일 초대 연동
- 실제 인사정보 대량 import
- production 비밀번호 운영 정책 집행
- 외부 IdP 연동

### 결정 D. 경영업무는 민감 모듈 허브로 유지하되 일반 업무와 분리한다.
경영업무 허브에는 아래를 둡니다.

- 인사관리
- 급여정산
- 근태/휴가 관리자 업무
- 세무
- 노무
- 법무
- 지점 운영
- 컴플라이언스/법령 리스크 경고

중요:
- 일반 직원은 자기 업무 중심 홈만 본다.
- 민감 리스크 상세는 지정 관리자/담당자만 본다.
- 단순 메뉴 숨김이 아니라 route guard, API guard, scope, audit 언어를 같이 맞춘다.

### 결정 E. Phase 31의 완료 기준은 "대장이 직접 눌러볼 수 있는가"로 잡는다.
문서/테스트/최종 보고에는 기능별로 아래를 남겨야 합니다.

- 대장이 눌러볼 route
- 사용할 계정/권한
- 직접 해볼 action
- happy path 확인 포인트
- forbidden/empty/error 확인 포인트
- 아직 dev-safe/mock 인 부분
- 별도 승인 필요 항목

## 대장이 직접 눌러볼 UAT 액션 표

| 기능 | route | 대장이 직접 해볼 액션 | happy path 확인 포인트 | forbidden/empty/error 포인트 | 현재 dev-safe/mock 잔여 |
| --- | --- | --- | --- | --- | --- |
| 로그인 | `/login` | `admin / 1234` 로 로그인하고 역할을 바꿔 landing 차이 확인 | dev-safe 계정, 역할별 첫 이동, 로그아웃 경로가 한 화면에 보임 | 익명 상태에서 `/management`, `/admin` 접근 시 redirect/차단 | placeholder 세션 기반, 외부 인증 없음 |
| 홈 | `/dashboard` | 오늘 할 일, 홈 바로가기, 관리자 CTA, 읽기 API 링크를 순서대로 누름 | 일반 업무 시작점과 운영 검토 레인이 한 화면에 정리됨 | 권한 없는 사용자에게 관리자 CTA 숨김 | 일부 카드/문구에 dev-safe 요약과 placeholder 성격 잔여 |
| 홈 바로가기 | `/dashboard` | 회사 공통 고정 바로가기와 내 커스텀 바로가기 구분 확인 | 고정/커스텀 분리, notice 노출, PC/모바일 같은 정보구조 | 로그인 전 고정 바로가기 API 미조회 상태와 load error 배너 | 권한별 커스텀 항목은 preview/API 의존 |
| 경영업무 허브 | `/management` | 경영업무 허브에서 계정관리/급여/세무/노무/법무/감사로 이동 | 일반 홈과 민감 모듈 허브가 분리됨 | 일반 직원은 허브 직접 진입 차단 | 외부 연동/실지급/실신고 없음 |
| 계정관리 | `/admin/users` | 생성 preview, 역할 변경 preview, 상태 변경 preview, 비밀번호 reset preview 확인 | `GET /api/admin/users` preview 와 action 배너가 연결됨 | 세션 없으면 fallback 안내, 권한 없으면 API 403 | 303 redirect 결과 문구만 반환, 실저장 없음 |
| 감사 | `/admin/audit-logs` | 감사 route 로 이동해 읽기 전용 경계 확인 | 운영 변경 흔적을 read-only 로 본다는 메시지 유지 | 권한 없는 사용자 차단 유지 | 실제 기관 제출/외부 감사 연동 없음 |
| 일반 업무 | `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` | 각 route 에서 최소 1개 happy path 후보와 읽기 흐름 확인 | route 진입 자체와 일부 상태/목록/상세 진입 가능 | placeholder, empty, forbidden 설명이 route 마다 다름 | 저장/승인/외부 발송은 아직 제한적 또는 없음 |
| 민감 모듈 | `/work-items/hr|tax|labor|legal|branch` | 경영업무 아래에서만 진입하는지 확인 | 모듈별 역할/범위/승인 게이트 설명 | 일반 직원/비허용 역할은 forbidden | metadata 중심 placeholder, 외부 기관/실원문/실신고 없음 |

## PC/모바일 공통 UAT 체크포인트

이번 Phase 31에서 홈은 PC와 모바일을 다른 제품처럼 설명하지 않습니다.
같은 정보구조를 두 화면 폭에서 같이 확인한다는 점이 핵심입니다.

- 홈 첫 화면 이름은 둘 다 `/dashboard` 기준으로 본다.
- 회사 공통 고정 바로가기는 `근태 → 휴가 → 전자결재` 같은 기본 업무 순서를 유지한다.
- 사용자 전용 커스텀 바로가기는 `경영업무`, `감사`, 관리자 CTA 같이 현재 권한에 따라 달라지는 진입점만 담는다.
- 로그인 전에는 고정 바로가기 API를 읽지 않는다는 점을 빈 상태 문구로 숨기지 않는다.
- 관리자 host/PWA shortcut 은 민감 모듈을 일반 직원용 홈 shortcut 과 섞지 않는다.

## 대장이 실제로 바로 따라갈 추천 클릭 순서

1. `/login`
   - `admin / 1234` 와 production 금지 문구를 먼저 확인한다.
2. `/dashboard`
   - 일반 업무 카드, 홈 바로가기, 관리자 CTA, 경영업무 분리 문구를 본다.
3. `/management`
   - 민감 모듈 허브가 일반 직원 홈과 실제로 분리되는지 본다.
4. `/admin/users`
   - 생성 preview → 역할 diff preview → 상태 변경 preview → 비밀번호 preview 를 각각 눌러 본다.
5. `/attendance` → `/leave` → `/approvals`
   - 일반 직원 happy path 후보를 짧게 확인한다.
6. `/boards` → `/documents` → `/me`
   - 읽기/협업/내 정보 route 진입이 이어지는지 본다.
7. `/admin/audit-logs`
   - 읽기 전용 감사 경계와 관리자 전용 접근 의도를 확인한다.

## Phase 31 1차 우선순위

### P1. 로그인·세션·역할 landing 확정
- `/login`
- 세션 생성/로그아웃
- admin 계정 seed
- 역할별 redirect
- forbidden 처리

### P2. 홈/경영업무 쉘 실사용화
- `/dashboard`
- `/management`
- 관리자 CTA/일반 직원 CTA 분리
- 모바일/PC 공통 바로가기 구조 정리

### P3. 계정관리 dev-safe 흐름 실사용화
- `/admin/users`
- 사용자 생성/수정/비활성/초기화 preview
- 역할별 접근 변화 확인
- 실저장 전환은 별도 승인 게이트로 남김

### P4. 기존 업무 모듈 UAT 연결
- 게시판/문서/근태/휴가/전자결재에서
  최소 1개 happy path 씩 대장이 직접 눌러볼 수 있게 연결
- placeholder 안내만 남은 route 는 fit-gap 표로 분리

## 이번 단계에서 일부러 미루는 것
- Phase 30 전체 통합 대시보드/알림/감사 로그 고도화 전부
- 실제 메일/메신저 외부 연동
- 실급여 지급, 은행 이체, 주민번호/계좌번호 입력 확대
- production DB 실데이터 반영
- 외부 세무/노무/법무 기관 계정 연동
- DNS/custom domain, 유료 리소스, migration, destructive 작업

## 다음 고도화 항목

이번 문서화 기준에서 다음 패스가 바로 잡아야 할 항목은 아래입니다.

1. 홈 카드 문구 다듬기
   - `/dashboard` 에 남아 있는 `dev-safe summary` 성격 badge/copy 를 더 실제 홈 언어로 줄인다.
2. 로그인 예외 상태 보강
   - 세션 만료, forbidden, 로그아웃 직후 재진입 안내를 더 짧고 분명하게 다듬는다.
3. 계정관리 UAT 흐름 묶기
   - `/admin/users` preview 결과 뒤 어떤 route 를 다시 확인해야 하는지 더 짧은 stepper 언어로 고정한다.
4. 일반 업무 happy path 균일화
   - `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` 의 최소 happy path/empty/error 설명 밀도를 비슷하게 맞춘다.
5. 감사/민감모듈 연결 정리
   - `/management` 에서 `/admin/audit-logs`, `/work-items/*`, `/payroll` 로 이어지는 운영 검토 순서를 더 짧은 UAT 언어로 통일한다.

## 구현자가 바로 보면 되는 체크리스트
1. `apps/web/app/login/page.tsx` 와 세션 처리 흐름을 먼저 본다.
2. `apps/web/app/dashboard/page.tsx`, `apps/web/dashboard-page-content.tsx`, `apps/web/app/management/page.tsx` 를 같이 본다.
3. `apps/web/app/admin/*`, `apps/api/src/app.ts`, `packages/shared/src/contracts.ts` 를 함께 본다.
4. `/boards`, `/documents`, `/me`, `/attendance`, `/leave`, `/approvals` 중
   placeholder 비중이 높은 route 를 P4 후보로 묶는다.
5. 기존 `auth-org`, `work-items`, web boundary 테스트를 재사용하고,
   로그인/landing/계정관리 중심 회귀 테스트를 추가한다.

## 현재 코드 스냅샷에서 바로 집어야 할 구현 포인트
- `apps/web/app/login/page.tsx`
  - UAT 계정, 역할별 landing, production 금지 문구는 이미 있다.
  - builder 는 실제 redirect/로그아웃/세션 만료 체감이 문구와 맞는지 먼저 닫는다.
- `apps/web/dashboard-page-content.tsx`
  - 홈 정보구조와 경영업무 분리 카드는 이미 있다.
  - 다만 "대시보드 시작 화면 skeleton", "placeholder/dev-safe 요약" 문구가 남아 있어 실사용 체감과 충돌한다.
- `apps/web/app/management/page.tsx`
  - 민감 모듈 허브 구조는 이미 있으므로 새 메뉴를 더 만드는 것보다 허용 역할/설명/UAT 순서를 다듬는 쪽이 우선이다.
- `apps/web/app/admin/users/page.tsx`
  - API preview + fallback/error 배너까지 있으므로 다음 구현은 "실저장 없는 preview" 경계를 숨기지 않으면서 체감 flow 를 강화하는 쪽이 맞다.
- `apps/web/app/admin/users/dev-safe-action/route.ts`
  - 현재는 303 redirect + 결과 문구 반환 전용이다.
  - 민감값(redaction) 유지, production write 금지 유지가 핵심 guardrail 이다.

## 먼저 같이 볼 문서
- `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`
- `docs/architecture/phase-29-legal-management-pass-1-scope.md`
- `docs/guides/phase-29-legal-management-pass-1-handoff.md`
- `ROADMAP.md`
- `TASKS.md`
- `HANDOFF.md`
