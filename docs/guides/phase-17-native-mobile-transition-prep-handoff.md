# Phase 17 네이티브 모바일앱 전환 준비 handoff

한 줄 요약:
이번 Phase 17은 앱스토어 배포를 여는 단계가 아니라,
Expo/React Native 네이티브 앱을 monorepo 안에서 안전하게 시작할 수 있도록
앱 위치, 공유 계약, 인증/세션 경계, 핵심 화면 우선순위, 승인 게이트를 먼저 고정하는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 것:

- `apps/web` 중심 PWA Production-ready (실구현)
- `apps/api` 중심 same-origin `/api/*` 계약
- `packages/shared` 중심 공통 type/schema/role/scope 계약
- 모바일 UX 원칙: "모바일은 축소판이 아니라 핵심 행동 우선 재배열"
- Phase 16 기준 파일럿 route 묶음과 preview/dev-safe 검증 문화

아직 부족한 것:

- 네이티브 앱을 monorepo 어디에 둘지
- Web과 무엇을 공유하고 무엇을 분리할지
- 모바일에서 API base URL과 세션 저장을 어떻게 다룰지
- 모바일 1차 화면 범위를 어디까지로 볼지
- 앱스토어/EAS/실기기/푸시/권한 정책을 언제 승인 게이트로 분리할지

즉 이번 단계는
"앱을 바로 배포한다"가 아니라
"앱 작업을 시작해도 운영 경계를 깨지 않게 설계한다"에 가깝습니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 일반 직원 관점

기본 흐름:

- 로그인
- 대시보드
- 출퇴근
- 휴가
- 결재함
- 공지/문서
- 내 정보

기대하는 경험:

- 오늘 할 일을 모바일에서도 짧게 끝냅니다.
- 관리자 메뉴가 기본 하단 탭에 섞이지 않습니다.
- 공지/문서와 결재/근태가 같은 제품 흐름 안에서 이어집니다.

### 팀장/승인자 관점

기본 흐름:

- 대시보드
- 결재함
- 휴가
- 필요 시 공지/문서

기대하는 경험:

- 급한 승인과 확인 업무를 먼저 처리할 수 있습니다.
- 고위험 운영 설정은 모바일 1차 범위에 억지로 넣지 않습니다.

### 인사/운영 관리자 관점

기본 흐름:

- 모바일 1차 핵심 업무 범위 검토
- role/scope/session 경계 검토
- 필요 시 Web 관리자 화면과 비교

기대하는 경험:

- 모바일에 넣을 것과 Web 관리자에 남길 것을 구분할 수 있습니다.
- Web 세션을 그대로 복제하지 않고 모바일 세션 경계를 따로 설명할 수 있습니다.

### 감사/운영 검토자 관점

기본 흐름:

- 모바일 구조 문서 확인
- API/auth/session/승인 게이트 확인

기대하는 경험:

- 모바일 도입이 권한 완화나 secret 노출로 이어지지 않음을 확인합니다.
- 앱스토어/실기기/유료 항목이 별도 승인 범위라는 점이 분명해야 합니다.

## 3. 이번 Phase에서 고정할 핵심 결정

### 1) 기본 monorepo 구조는 `apps/mobile` 추가안을 우선한다.

- 새 Expo/React Native 앱 위치는 `apps/mobile`
- 공통 계약은 `packages/shared` 재사용
- Web 전용 UI/PWA install/offline UX는 그대로 `apps/web` 책임
- 모바일 전용 navigation, secure storage, deep link는 모바일 책임

즉 "한 저장소, 역할 분리" 구조로 갑니다.

### 2) same-origin 원칙은 유지하되, 모바일에서는 base URL resolver 층으로 번역한다.

- 제품 기본 API 계약은 계속 `/api/*` same-origin 철학을 따른다.
- 다만 네이티브 앱은 브라우저 same-origin을 직접 쓸 수 없으므로
  base URL resolver 층을 별도로 둔다.
- production 기본값은 승인된 운영 origin만 허용한다.
- dev/local 은 명시적 환경값 또는 mock adapter 로만 푼다.
- preview 절대 URL 을 코드 기본값으로 박아 넣지 않는다.

### 3) 인증/세션은 모바일 전용 저장 경계를 따로 둔다.

- 로그인 화면은 모바일 1차 범위에 포함
- role/scope/capability 판정은 shared 계약 재사용
- 세션 저장은 secure storage bridge 계층 전제
- Web cookie 모델을 모바일 전체 기본값으로 확정하지 않음
- 평문 저장 전제를 문서 기본안으로 두지 않음

### 4) 모바일 1차 핵심 화면은 7개만 우선한다.

우선 화면:

- 로그인
- 대시보드
- 출퇴근
- 휴가
- 결재함
- 공지/문서
- 내 정보

후순위 또는 별도 검토:

- `/admin/*` 운영 화면
- 복잡한 조직/직원 관리 화면
- 실기기 권한을 많이 요구하는 확장 기능

### 5) route mapping은 같은 제품 흐름을 유지한다.

- `/login` → 모바일 로그인
- `/dashboard` → 모바일 홈
- `/attendance` → 모바일 출퇴근
- `/leave` → 모바일 휴가
- `/approvals` → 모바일 결재함
- `/boards`, `/documents` → 모바일 공지/문서 묶음
- `/admin/*` → 모바일 기본 탭 제외, 후속 범위 또는 Web fallback 후보

### 6) 이번 단계의 성공 기준은 store build가 아니라 Production-ready (실구현) 준비 완료다.

성공으로 보는 것:

- `apps/mobile` 구조 기준 확정
- 공유 패키지 경계 확정
- auth/session/route mapping 문서화
- dev-safe 연결 기준 정리
- 승인 게이트 분리

성공으로 보지 않는 것:

- App Store/Play Console 업로드
- TestFlight/EAS 유료 빌드
- 실기기 push 토큰 수집
- 운영 사용자 배포

## 4. 실제로 먼저 볼 파일

### 문서

- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/guides/phase-17-native-mobile-transition-prep-handoff.md`
- `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md`
- `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

### 현재 구조 참고

- `README.md`
- `ARCHITECTURE.md`
- `package.json`
- `apps/web/app/mobile-pwa-config.ts`
- `packages/shared/src/contracts.ts`

## 5. 권장 구현 순서

1. `apps/mobile` 위치와 Expo 앱 초기 구조를 만든다.
2. `packages/shared` 재사용 범위와 Web 전용 의존성을 분리한다.
3. 로그인/대시보드/출퇴근/휴가/결재/공지·문서/내 정보 7개 Production-ready (실구현)를 먼저 만든다.
4. 모바일 API 연결은 base URL resolver + mock/dev-safe adapter 기준으로 둔다.
5. 세션 저장은 secure storage bridge 전제로 구성하고 Web cookie 직접 복제를 피한다.
6. 관리자 화면, 스토어 배포, 푸시, 실기기 권한은 별도 승인 게이트로 남긴다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- `apps/mobile` Production-ready (실구현) 또는 Expo app shell
- navigation shell + 7개 핵심 화면 Production-ready (실구현)
- `packages/shared` 재사용 기준에 맞는 route/type 연결
- base URL resolver / mock adapter / dev-safe 환경 기준

하면 안 되는 것:

- 운영 origin 하드코딩
- production secret 주입
- 실제 앱스토어 배포
- 푸시/실기기 권한을 승인 없이 확정

### 리뷰어(gwreviewer)

집중할 것:

- 모바일 도입이 role/scope/auth 경계를 흐리지 않는지
- Web 전용 코드와 모바일 전용 코드가 과도하게 섞이지 않는지
- preview/dev-safe가 운영 기본값처럼 문서화되지 않는지
- Production-ready (실구현)를 실제 배포 완료처럼 보이게 하는 문구가 없는지

### 테스터(gwtester)

집중할 것:

- mobile/shared/web/api 타입·계약 정합성
- monorepo build/typecheck/test 기준이 유지되는지
- base URL resolver 와 mock/dev-safe 경계가 테스트 가능하게 남는지
- store build 없이도 검증 가능한 증거가 정리되는지

### 문서화(gwdocs)

집중할 것:

- SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF/CHANGELOG 최신화
- 모바일 1차 화면 범위와 제외 범위 정리
- 승인 게이트를 쉬운 한국어로 분리
- "지금 되는 것 / 아직 안 하는 것 / 승인 필요" 구분 강화

### 운영(gwops)

집중할 것:

- PR/CI/merge/release-gate 관점에서 mobile 추가가 기존 Web/API 흐름을 깨지 않는지
- store/EAS/외부 배포가 카드 범위 밖이면 실행하지 않는지
- branch cleanup 전에 merge/diff 동등성 근거를 남기는지

## 7. 남은 승인 게이트

계속 별도 승인으로 남는 것:

- Apple Developer / Play Console / TestFlight / EAS 계정 사용
- 유료 빌드/외부 테스터 배포
- 실제 push 알림 연동
- 카메라/위치/생체인증/파일 접근 권한 정책 확정
- 실기기용 secret 발급/주입
- 운영 API origin/custom domain/app link 확정
- production DB 실데이터 반영

## 8. 다음 작업자가 기억할 5가지

1. 기본 monorepo 안은 `apps/mobile` 추가안이다.
2. shared 계약은 재사용하되 Web UI까지 억지로 공용화하지 않는다.
3. 모바일도 권한 기준은 그대로 shared 계약을 쓴다.
4. same-origin 철학은 유지하지만, 모바일은 base URL resolver 층으로 번역한다.
5. 앱스토어/실기기/유료/secret은 이번 단계 성공 기준이 아니라 별도 승인 게이트다.
