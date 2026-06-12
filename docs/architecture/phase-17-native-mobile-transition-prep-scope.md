# 그룹웨어 Phase 17 네이티브 모바일앱 전환 준비 범위

## 1. 한 줄 정의

Phase 17의 목표는
Phase 16 PWA 파일럿 초안 이후에
Expo/React Native 기반 네이티브 모바일앱으로 안전하게 넘어갈 수 있도록
앱 shell 구조, API 계약, 인증/권한 경계, 화면 우선순위, 승인 게이트를 먼저 고정하는 것입니다.

쉽게 말해 이번 단계는
앱스토어 배포를 바로 시작하는 단계가 아니라,
"어디까지는 지금 monorepo 안에서 안전하게 준비할 수 있고,
어디부터는 비용/계정/실기기/스토어 승인 게이트가 필요한가"를
문서와 skeleton 기준으로 분리하는 단계입니다.

이번 단계도 production 데이터 반영, 실제 사용자 배포,
App Store/Play Console/TestFlight/EAS 유료 빌드,
push 토큰 연동, secret 교체, 외부 기기 권한 확정은 하지 않습니다.
핵심은 다음 구현자가 `apps/mobile` 계열 작업을 시작해도
Web/PWA와 운영 경계가 흔들리지 않게 기준을 잠그는 것입니다.

## 2. 왜 이번 단계가 필요한가

지금까지 이미 있는 기반은 아래와 같습니다.

- `apps/web` 중심 Next.js App Router + PWA skeleton
- `apps/api` 중심 same-origin `/api/*` 계약과 role/scope 기반 API skeleton
- `packages/shared` 중심 공통 contract/type/schema 구조
- 모바일 UX 원칙과 PWA 흐름 문서
- 관리자 host 분리, preview/dev-safe 검증 기준, restricted 승인 게이트 정리
- Phase 16 기준 핵심 업무 route + 협업 route + 관리자 route 파일럿 동선 정리

하지만 아직 아래가 비어 있습니다.

- 네이티브 앱을 monorepo 어디에 두고 어떤 패키지를 Web과 공유할지 명확한 기준
- PWA에서 네이티브 앱으로 옮겨도 유지해야 할 same-origin/API 원칙과 예외 기준
- 웹 세션을 그대로 흉내 내지 않고 모바일에 맞는 auth/session 보관 기준
- 어떤 화면을 1차 앱에 넣고, 어떤 화면은 WebView/후순위로 미루는지 우선순위
- 실기기/스토어/EAS/푸시/권한/유료 리소스를 언제 승인 게이트로 분리할지 기준

즉 Phase 16이 "모바일에서도 읽고 검토할 수 있는 PWA 초안"을 안정화했다면,
Phase 17은 그 다음 단계인
"네이티브 앱 구현을 시작해도 안전한 경계"를 정리하는 단계입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `README.md`
- `ROADMAP.md`
- `TASKS.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md`
- `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `ARCHITECTURE.md`
- `package.json`
- `packages/shared/package.json`
- `packages/shared/src/contracts.ts`
- `apps/web/app/mobile-pwa-config.ts`

현재 저장소 기준으로 확인되는 사실:

- monorepo 루트에는 이미 `apps/web`, `apps/api`, `packages/shared`, `db/migrations` 구조가 있습니다.
- 모바일/PWA UX 기준은 "작은 화면용 다른 정보구조"가 아니라 같은 route 체계를 다른 껍데기로 보여 주는 쪽입니다.
- Web/PWA 기본 API 원칙은 same-origin `/api/*` 상대 경로 유지입니다.
- 관리자와 일반 사용자 경계는 route와 role/scope 기준으로 분리되어 있습니다.
- preview/dev-safe 검증 문화가 이미 있어도, 그것이 네이티브 앱에서 절대 운영 경계를 완화하는 근거가 되지는 않습니다.

즉 이번 단계는 새로운 아키텍처로 갈아엎는 것이 아니라,
기존 monorepo와 shared/API 계약을 기준으로
네이티브 앱 진입점을 하나 더 추가하는 방향을 문서화하는 작업입니다.

## 4. Phase 17에서 고정하는 핵심 결정

### 결정 A. monorepo 기본 배치는 `apps/mobile` + `packages/shared` 재사용 구조를 우선한다.

이번 단계의 기본안은 아래입니다.

1. 새 앱 위치
   - `apps/mobile`
2. 계속 공유할 것
   - `packages/shared` 의 route/schema/type/role/scope 계약
   - 공통 도메인 타입과 mock/skeleton 데이터 shape
3. 분리할 것
   - Web 전용 렌더/UI 컴포넌트
   - 브라우저/PWA 전용 install/offline UX
   - 모바일 전용 navigation shell, secure storage, deep link 설정

왜 이렇게 보나:

- 지금 저장소의 monorepo 구조를 가장 덜 흔드는 기본안입니다.
- Web/API/shared 책임이 이미 나뉘어 있어 모바일 앱을 같은 패턴으로 넣기 쉽습니다.
- React Native 코드가 Web 렌더링 의존성을 직접 끌어오지 않게 경계를 만들 수 있습니다.

후보 비교 메모:

- 후보 1: `apps/mobile` 독립 Expo 앱 + `packages/shared` 재사용 → 기본안
- 후보 2: Web 코드와 UI까지 최대한 공용화 → 지금 단계에서는 과도한 결합 위험이 있어 보류
- 후보 3: 모바일을 별도 repo로 분리 → 현재 handoff/검증/계약 재사용성이 떨어져 이번 단계 기본안으로는 채택하지 않음

### 결정 B. 네이티브 앱도 제품 기본 계약은 same-origin 원칙을 유지하되, dev-safe bridge를 별도 층으로 둔다.

Web/PWA에서 유지하던 원칙은 계속 유지합니다.

- 제품 기본 API 계약은 `/api/*` same-origin 기준으로 설명한다.
- preview 절대 URL 을 제품 기본값으로 문서/코드에 박아 넣지 않는다.
- 모바일 때문에 API 권한 검증이나 origin 경계를 완화하지 않는다.

다만 네이티브 앱은 브라우저 same-origin 을 그대로 쓸 수 없으므로,
이번 단계에서 아래 dev-safe 대체 기준을 따로 둡니다.

- `apps/mobile` 에서는 "runtime base URL resolver" 층을 따로 둔다.
- production 기본값은 승인된 운영 origin 만 허용한다.
- local/dev 에서는 명시적 환경값 또는 mock adapter 를 통해서만 API에 접근한다.
- preview/dev-safe 검증은 mock/stub/local-safe endpoint 또는 승인된 preview origin 메모로 제한한다.

즉 same-origin 원칙을 버리는 것이 아니라,
네이티브 앱에서는 "운영 origin을 한곳에서 안전하게 주입하는 방식"으로 번역합니다.

### 결정 C. 인증/세션은 "웹 쿠키를 그대로 복제"하지 말고 모바일 전용 session bridge를 준비한다.

이번 단계에서 문서 기준은 아래처럼 고정합니다.

1. 로그인 흐름
   - 1차 앱 화면에 로그인 진입은 포함
   - 실제 운영 SSO/사내 IdP 확장은 별도 승인
2. 세션 보관
   - 브라우저 쿠키 동작을 그대로 가정하지 않음
   - secure storage 후보(예: Expo SecureStore 급)와 token/session bridge 계층을 분리 설계
3. 권한 판정
   - role/scope/capability 기준은 계속 `packages/shared` 계약을 재사용
4. 금지
   - 토큰을 일반 AsyncStorage 평문 저장 전제로 문서화하지 않음
   - Web admin cookie 흐름을 모바일 전체 공통 기본값으로 확정하지 않음

즉 이번 단계의 핵심은
"모바일도 로그인은 필요하다"가 아니라
"웹 세션과 모바일 세션의 저장 방식 차이를 먼저 인정하고 경계를 설계한다"입니다.

### 결정 D. 모바일 1차 핵심 화면은 7개 묶음만 우선한다.

네이티브 앱 1차 우선 화면은 아래로 고정합니다.

1. 로그인
2. 대시보드
3. 출퇴근
4. 휴가
5. 결재함
6. 공지/문서
7. 내 정보

설명:

- 근태/휴가/승인/공지 확인처럼 "오늘 바로 처리하는 일"을 우선합니다.
- `/org`, `/employees`, `/admin/*` 전부를 모바일 하단 탭 기본 메뉴에 올리지 않습니다.
- 관리자 화면은 앱 1차 범위에서 별도 검토 또는 Web fallback 후보로 둡니다.
- 게시판과 문서는 모바일에서 분리 탭이 아니라 협업 묶음 진입으로 시작할 수 있습니다.

즉 모바일은 데스크톱 메뉴 축소판이 아니라
핵심 액션 우선 재배열 버전이라는 기존 UX 원칙을 그대로 잇습니다.

### 결정 E. route mapping은 "같은 제품 흐름, 다른 탐색 shell" 원칙을 유지한다.

Phase 17 기본 mapping 표준안:

- 웹 `/login` → 모바일 로그인 화면
- 웹 `/dashboard` → 모바일 홈/대시보드
- 웹 `/attendance` → 모바일 출퇴근
- 웹 `/leave` → 모바일 휴가
- 웹 `/approvals` → 모바일 결재함
- 웹 `/boards`, `/documents` → 모바일 공지/문서 묶음
- 웹 `/me` 또는 프로필 성격 route → 모바일 내 정보
- 웹 `/admin/*` → 1차 앱 기본 탭 제외, 필요 시 관리자 전용 후속 범위 또는 Web fallback 후보

중요한 점:

- route 이름과 도메인 의미는 최대한 유지합니다.
- 모바일에서 정보구조를 새로 invent 하지 않습니다.
- 대신 하단 탭/스택 네비게이션/상세 진입 방식만 모바일에 맞게 바꿉니다.

### 결정 F. preview/dev-safe 검증은 앱스토어 없이 가능한 범위까지만 성공 기준으로 본다.

이번 Phase 17에서 성공 근거로 인정하는 것:

- monorepo 배치와 package 경계가 문서로 확정됨
- `apps/mobile` skeleton 또는 그에 준하는 구조 기준이 생김
- 공통 contract/auth/route mapping 문서가 정리됨
- 로컬 타입체크/계약 검증/문서 정합성 확인 가능
- mock 또는 dev-safe API 연결 기준이 남음

이번 Phase 17에서 성공 근거로 보지 않는 것:

- 실제 App Store/Play Console/TestFlight 업로드
- EAS 유료 빌드 성공
- 실기기 push 토큰 수집
- 실제 카메라/위치/생체인증 권한 정책 확정
- 운영 사용자 배포

즉 "앱이 스토어에 올라갔다"가 아니라
"다음 구현자가 앱 작업을 시작해도 운영 경계를 깨지 않는다"가 성공 기준입니다.

### 결정 G. 승인 게이트는 모바일 특화 항목으로 따로 분리한다.

이번 단계에서 별도 승인 게이트로 분리할 모바일 특화 항목은 아래입니다.

- Apple Developer / Play Console / TestFlight / EAS 계정 사용
- 유료 빌드/스토어 제출/외부 테스터 배포
- 실제 push 알림 연동
- 카메라, 위치, 생체인증, 파일 접근 권한 정책 확정
- 실기기 배포용 secret 발급/주입
- 운영 API origin, custom domain, 앱 링크/딥링크 도메인 확정

즉 모바일 구현을 이유로
restricted 범위를 "개발 편의"로 우회하지 않습니다.

## 5. 역할별 기대 흐름

### 일반 직원

주요 기대:

- 로그인 후 오늘 처리할 일 중심 화면으로 바로 들어간다.
- 출퇴근, 휴가, 결재, 공지 확인을 작은 화면에서도 짧게 끝낸다.
- 관리자 기능이나 복잡한 설정이 앱 첫 화면을 어지럽히지 않는다.

### 팀장/승인자

주요 기대:

- 승인 대기, 휴가 승인, 공지 확인 같은 빠른 처리 흐름이 먼저 보인다.
- 급한 승인 정도는 모바일에서 처리 가능하되 고위험 관리 설정은 섞이지 않는다.

### 인사/운영 관리자

주요 기대:

- 모바일 1차 범위에 무엇을 넣고 무엇을 관리자 후속 범위로 뺄지 설명 가능하다.
- role/scope/session 경계가 Web과 다르게 흐트러지지 않음을 확인할 수 있다.

### 감사/운영 검토자

주요 기대:

- 모바일 도입이 권한 완화나 운영 secret 노출로 이어지지 않음을 확인한다.
- 스토어/기기/푸시/유료 빌드가 별도 승인 게이트로 분리돼 있음을 확인한다.

## 6. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 17 범위 문서 작성
- Phase 17 handoff 문서 작성
- 루트 문서의 현재 활성 체인을 Phase 17 기준으로 갱신
- 앱 shell 구조, 공유 패키지 경계, route mapping, auth/session, 승인 게이트를 정리

### 다음 구현 카드에서 허용하는 범위

- `apps/mobile` skeleton 또는 Expo 앱 기본 구조 추가
- mobile navigation shell / screen placeholder 추가
- `packages/shared` 재사용 기준에 맞춘 모바일 계약 연결
- dev-safe base URL resolver, mock adapter, route mapping 보강
- 문서/테스트/QA 기준에 모바일 검증 항목 추가

### 이번 Phase에서 제외하는 범위

- 운영 앱스토어 배포
- App Store / Play Console / TestFlight / EAS 유료 빌드 실사용
- 실기기 push/권한/생체인증 정책 최종 확정
- production secret 발급/교체
- 운영 origin/custom domain/DNS/app link 최종 연결
- production DB 실데이터 반영

## 7. 다음 구현자에게 넘길 최소 구현 계획

1. monorepo 안에 `apps/mobile` 위치를 만들고 Expo/React Native 기본 shell을 둔다.
2. 모바일이 재사용할 `packages/shared` 계약과 Web 전용 코드를 분리한다.
3. 로그인/대시보드/출퇴근/휴가/결재/공지·문서/내 정보 7개 화면 placeholder를 먼저 만든다.
4. API 호출은 same-origin 절대가 아니라 안전한 base URL resolver + 환경 주입 방식으로 둔다.
5. 세션 저장은 secure storage bridge 계층을 전제로 하고, Web cookie 복제를 기본값으로 삼지 않는다.
6. 관리자 route, 실기기 권한, 스토어 배포, 유료 빌드는 별도 게이트로 남긴다.

## 8. 성공 기준 다시 정리

이번 Phase 17 성공은 아래가 모두 충족될 때입니다.

- 네이티브 앱 구조와 공유 경계가 문서로 분명하다.
- 모바일 1차 화면 범위와 제외 범위가 정리돼 있다.
- Web/PWA와 공통으로 유지할 API/role/scope 계약이 고정돼 있다.
- same-origin 원칙을 모바일에 어떻게 번역할지 dev-safe 기준이 적혀 있다.
- 스토어/실기기/유료/secret 관련 승인 게이트가 따로 분리돼 있다.

이 기준이 있어야 다음 구현자가
불필요하게 운영 리스크를 건드리지 않고
모바일 skeleton 작업을 바로 시작할 수 있습니다.
