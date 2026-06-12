# 그룹웨어 Phase 14 실사용 MVP 통합 1차 범위

## 1. 한 줄 정의

Phase 14의 목표는 지금까지 따로 쌓아 둔 skeleton을 하나의 "사내 검토용 업무 흐름"으로 묶어,
대장이 live preview/dev-safe 환경에서 `/` → `/login` → `/dashboard` → 일반 업무 화면 → 관리자 화면까지 끊김 없이 눌러 볼 수 있게 만드는 것입니다.

이번 단계도 실제 운영 저장, production DB 실데이터 반영, secret 입력, 외부 연동은 하지 않습니다.
핵심은 "실제로 써보는 듯한 연결감"과 "권한 경계가 무너지지 않는 구조"를 동시에 고정하는 것입니다.

## 2. 왜 이번 단계가 필요한가

Phase 11~13까지 아래 조각은 이미 생겼습니다.

- `/org`, `/employees` 일반 조회 흐름
- `/dashboard` 오늘 할 일/대기 요약 구조
- `/attendance` effective policy 기반 근태 skeleton
- `/approvals` 모바일 전자결재 skeleton
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 관리자 콘솔 skeleton
- PWA/manifest/offline/dev-safe 안내 구조

하지만 지금은 "각 화면이 따로는 보이지만, 한 명의 사용자가 한 흐름으로 눌러 보는 느낌"은 아직 약합니다.
부족한 점은 아래와 같습니다.

- 홈(`/`)과 로그인(`/login`)이 최신 대시보드/일반 업무/관리자 경계를 충분히 요약하지 못합니다.
- `/dashboard` 는 업무 시작 화면으로 정리되어 있지만, 실제 각 하위 화면과의 연결 메시지가 더 명확해야 합니다.
- `/org`, `/employees`, `/attendance`, `/approvals` 가 각자 skeleton 이지만 역할별 첫 진입 순서와 목적이 한 세트로 읽히지는 않습니다.
- `/admin/*` 경계는 잘 잡혀 있지만, 일반 사용자 흐름과 관리자 검토 흐름을 같은 MVP 안에서 어떻게 같이 보여 줄지 문서와 구현 포인트가 더 필요합니다.
- smoke 기준 route 목록은 잡혀 있지만, "어떤 role 이 어디까지 봐야 성공인지"가 아직 산발적으로 흩어져 있습니다.

즉 이번 Phase는 새 모듈을 크게 추가하는 단계가 아니라,
이미 있는 화면들을 "실사용 MVP 초안"으로 다시 엮는 단계입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `ROADMAP.md`
- `TASKS.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`
- `CHANGELOG.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-12-dashboard-summary-scope.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `docs/guides/phase-13-admin-console-pass-1-handoff.md`
- `docs/guides/attendance-registration-policy-pass-2-handoff.md`
- `apps/web/app/page.tsx`
- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/org/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/admin-skeleton-config.ts`

현재 저장소 기준으로 확인되는 사실은 아래와 같습니다.

- 홈(`/`)은 PWA 설치/오프라인/핵심 진입점 안내 중심 시작 화면입니다.
- 로그인(`/login`)은 실제 인증 연결이 아니라 placeholder 세션 계약을 설명하는 화면입니다.
- 대시보드(`/dashboard`)는 오늘 할 일, 승인/대기, 근태/휴가, 공지/문서, 운영 요약을 한 화면에 묶고 있습니다.
- `/org`, `/employees` 는 일반 사용자용 읽기 전용 업무 흐름으로 정리돼 있습니다.
- `/attendance` 는 effective policy 기준 허용 방식만 보이는 구조를 이미 갖고 있습니다.
- `/approvals` 는 내 승인함/내 기안함/참조·합의 문서함과 기안 작성 skeleton 을 작은 화면 우선으로 묶고 있습니다.
- `/admin/*` 는 역할 기반 가시성, 감사 전용 접근, dev-safe guardrail 을 이미 전제로 두고 있습니다.
- 대시보드와 관리자 설정 데이터는 `dashboard-config.ts`, `admin-skeleton-config.ts` 로 분리되어 있어 이번 Phase에서 문구/우선순위/카드 구조를 재정리하기 좋습니다.

즉, 이번 Phase는 빈 땅에서 시작하는 것이 아니라 이미 있는 조각을 같은 사용자 시나리오로 정렬하는 작업입니다.

## 4. Phase 14에서 고정하는 핵심 결정

### 결정 A. 이번 MVP의 기준 흐름은 2개로 나눈다.

이번 1차는 한 화면에 모든 역할을 섞지 않고, 아래 2개 흐름을 같은 앱 안에서 연결합니다.

1. 일반 업무 흐름
   - `/`
   - `/login`
   - `/dashboard`
   - `/org`
   - `/employees`
   - `/attendance`
   - `/approvals`
2. 관리자 검토 흐름
   - `/dashboard` 또는 권한 기반 CTA
   - `/admin`
   - `/admin/users`
   - `/admin/policies`
   - `/admin/audit-logs`

쉽게 말하면,
직원용 업무 흐름과 관리자용 운영 흐름을 한 제품 안에서 보여 주되,
같은 메뉴에 다 섞지 않고 역할에 따라 자연스럽게 갈라지게 만듭니다.

### 결정 B. 일반 사용자의 첫 경험은 "오늘 할 일 먼저"로 고정한다.

일반 사용자 기준 첫 흐름은 아래 순서를 기본으로 둡니다.

1. 홈에서 제품 성격과 핵심 진입점 이해
2. 로그인 placeholder 계약 이해
3. 대시보드에서 오늘 할 일 확인
4. 근태/전자결재/조직 조회로 이동
5. 상세 업무는 각 화면에서만 이어서 확인

이번 단계에서는 홈이나 대시보드가 모든 업무를 처리하는 화면이 아니라,
"어디로 들어가면 되는지 가장 빨리 알려 주는 화면"이어야 합니다.

### 결정 C. 관리자 화면은 일반 업무 흐름 안에 섞어 넣지 않는다.

- 일반 사용자 기본 화면에서는 관리자 CTA 를 숨깁니다.
- 권한 있는 사용자에게만 `/admin` 또는 `/admin/audit-logs` 진입 CTA 를 보여 줍니다.
- UI 숨김만으로 끝내지 않고 route/API guard 기준을 계속 유지합니다.
- 익명 공개 preview 에서 `/admin*` 가 일반 skeleton 처럼 열리면 안 됩니다.

즉 이번 MVP 통합은 관리자 기능을 더 공개하는 단계가 아니라,
일반 흐름과 운영 흐름을 더 선명하게 분리하는 단계입니다.

### 결정 D. 이번 1차의 핵심 화면은 8개 route 묶음으로 고정한다.

필수 smoke 대상:

- `/`
- `/login`
- `/dashboard`
- `/org`
- `/employees`
- `/attendance`
- `/approvals`
- `/admin/*`

설명상 연결은 유지하되 이번 필수 smoke 에서 후순위인 항목:

- `/leave`
- `/boards`
- `/documents`
- `/offline`

이 항목들은 대시보드/홈에서 링크와 문맥은 유지하되,
이번 Phase의 성공 판정은 우선 8개 핵심 route 묶음이 자연스럽게 이어지는지로 봅니다.

### 결정 E. mock/dev-safe 정합성은 "같은 약속을 여러 화면에서 같이 쓰는 상태"를 뜻한다.

이번 단계에서 정합성은 아래를 의미합니다.

- 대시보드 카드 문구와 하위 화면 목적이 충돌하지 않음
- `/attendance` 의 정책 안내가 admin 정책 화면과 같은 방향을 가리킴
- `/employees` 일반 조회와 `/admin/users` 운영 변경 검토가 역할상 섞이지 않음
- `/approvals` 의 승인 처리 placeholder 가 실제 저장 완료처럼 보이지 않음
- `/admin/audit-logs` 는 조회/마스킹 원칙을 유지함

즉 같은 mock 데이터나 contract 를 쓴다는 말보다,
"같은 제품 철학과 guardrail 을 공유한다"는 쪽이 이번 통합의 핵심입니다.

### 결정 F. 이번 단계의 성공 기준은 "실운영처럼 보이되, 거짓 완료를 만들지 않는 것"이다.

성공 기준:

- 대장이 live URL 또는 preview 환경에서 핵심 흐름을 한 번에 눌러 볼 수 있다.
- 각 화면이 왜 존재하는지 쉬운 문구로 이해된다.
- 권한 없는 관리 기능 노출/진입이 UI와 route/API 기준에서 같이 막힌다.
- skeleton/dev-safe/placeholder 라는 사실이 문구와 CTA 에서 계속 드러난다.
- production 연결 없이도 다음 구현자가 붙일 우선순위가 분명하다.

## 5. 역할별 화면 목적 정리

### 일반 직원

주요 흐름:

- `/login` → `/dashboard` → `/attendance` → `/approvals` → `/org`/`/employees`

기대하는 경험:

- 오늘 해야 할 일과 내 상태를 먼저 본다.
- 근태/승인 업무로 바로 이동한다.
- 조직/직원 화면은 읽기 전용 조회로 이해한다.
- 관리자 기능은 보이지 않는다.

### 팀장/결재자

주요 흐름:

- `/dashboard` → 승인/대기 요약 → `/approvals`
- 필요 시 `/employees` 에서 기본 인원 상태 조회

기대하는 경험:

- "내 승인 대기"와 "팀/결재 대기"가 먼저 읽힌다.
- 상세 처리는 approvals 에서 이어진다.
- 관리 권한이 없는 한 `/admin/*` 와 혼동되지 않는다.

### 인사/운영 관리자

주요 흐름:

- `/dashboard` → 권한 기반 운영 CTA → `/admin`
- `/admin/users` 와 `/admin/policies` 에서 검토
- 필요 시 일반 조회 화면(`/org`, `/employees`)은 참고용으로만 본다.

기대하는 경험:

- 일반 업무 화면과 운영 검토 화면의 역할이 다름을 분명히 안다.
- 저장보다 diff/candidate/audit preview 를 먼저 본다.
- 일반 사용자용 직원 조회와 관리자용 사용자/권한 검토를 혼동하지 않는다.

### 관리자/감사 전용 사용자

주요 흐름:

- 관리자: `/admin` 허브 → 세부 운영 화면
- 감사 전용: `/admin/audit-logs` 직접 진입

기대하는 경험:

- 감사 전용 경로가 따로 유지된다.
- 조회/마스킹/회사 경계 원칙이 흔들리지 않는다.
- 외부 반출/실저장은 이번 범위가 아니라는 점이 명확하다.

## 6. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 14 범위 문서 작성
- Phase 14 handoff 문서 작성
- 현재 활성 체인을 Phase 14 기준으로 루트 문서에 반영
- 하위 역할 카드가 같은 성공 기준을 보도록 역할별 handoff 포인트 정리

### 구현 준비 범위

다음 구현 카드에서 허용하는 범위는 아래입니다.

- `/`, `/login`, `/dashboard` 문구/카드/CTA 재정리
- `/org`, `/employees`, `/attendance`, `/approvals` 의 흐름 연결 문구 보강
- `/dashboard` 의 역할별 CTA, 운영 경계, 다음 행동 우선순위 보강
- `/admin/*` 의 일반 흐름과의 연결 문구 정리
- 필요 시 shared contract/API mock 의 summary 필드 최소 보강
- Web/API/shared/test/docs 동기화

### 이번 Phase에서 제외하는 범위

- 실제 로그인/인증 provider 연결
- production DB migration 실행
- production 실데이터 연결/수정
- 실제 개인정보 원문 처리
- secret 입력/교체
- DNS/custom domain 변경
- 외부 HR/메신저/SIEM 연동
- 유료 리소스 생성/증설
- 실제 승인/근태/권한 저장 실행
- 실장비 태그/GPS/외부 장치 연결

## 7. 권장 구현 순서

1. 홈(`/`)과 로그인(`/login`)이 최신 업무 흐름을 제대로 소개하는지 먼저 정리합니다.
2. `/dashboard` 에서 일반 직원/팀장/관리자 각자 무엇을 먼저 눌러야 하는지 카드 순서를 고정합니다.
3. `/org`, `/employees`, `/attendance`, `/approvals` 가 대시보드 설명과 같은 언어를 쓰도록 맞춥니다.
4. `/admin/*` 는 일반 업무 화면과 다른 목적이라는 점을 더 명확히 적습니다.
5. 역할별 CTA 와 route/API guard 테스트를 같이 확인합니다.
6. preview/dev-safe smoke 기준을 문서와 검증 카드에 같이 반영합니다.

## 8. 구현자가 특히 먼저 볼 파일

### Web

- `apps/web/app/page.tsx`
- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/org/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-skeleton-config.ts`

### 문서

- `docs/architecture/phase-12-dashboard-summary-scope.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `docs/guides/phase-13-admin-console-pass-1-handoff.md`
- `docs/guides/attendance-registration-policy-pass-2-handoff.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`

## 9. 최소 smoke 기준

이번 Phase에서 최소한 다시 확인해야 할 기준:

1. `/`, `/login`, `/dashboard`, `/org`, `/employees`, `/attendance`, `/approvals` 가 일반 업무 흐름으로 자연스럽게 이어진다.
2. `/dashboard` 에서 관리자 경계가 일반 사용자 기준 숨겨져 있다.
3. 권한 있는 사용자만 `/admin` 또는 `/admin/audit-logs` 진입 CTA 를 본다.
4. 익명 preview 에서 `/admin*` 공개 노출이 없다.
5. `/attendance` 의 허용 방식 안내가 admin 정책 흐름과 충돌하지 않는다.
6. `/employees` 일반 조회와 `/admin/users` 운영 변경 검토가 다른 역할임이 보인다.
7. `/approvals` 의 CTA 가 실제 저장/승인 완료처럼 보이지 않는다.
8. skeleton/dev-safe/placeholder 문구가 핵심 화면에 남아 있다.

## 10. 별도 승인 필요 항목

아래는 이번 통합 1차에서도 계속 별도 승인 대상입니다.

1. 실제 인증/SSO/OAuth 연결
2. production DB 실데이터 반영/수정
3. 실제 관리자 권한 저장/변경 실행
4. 실제 결재 승인/반려 저장
5. 실제 근태 등록/태그 장비/GPS 연동
6. secret 입력/교체
7. DNS/custom domain 변경
8. 외부 알림/메신저/감사 적재 연동
9. 유료 리소스 생성·증설

정리하면 이번 Phase 14는
"기능을 더 많이 여는 단계"가 아니라
"이미 있는 화면을 한 번에 써 볼 수 있는 실사용 MVP 흐름으로 묶는 단계"입니다.
