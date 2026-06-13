# 그룹웨어 Phase 18 네이티브 모바일앱 핵심 업무 연결 1차 범위

## 1. 한 줄 정의

Phase 18의 목표는
Phase 17에서 준비한 `apps/mobile` skeleton과 shared contract를 바탕으로
사용자가 모바일 초안 안에서 핵심 업무 흐름을 한 번 따라가 볼 수 있게
화면별 상태, 연결 규칙, 제외 범위를 1차로 고정하는 것입니다.

쉽게 말해 이번 단계는
"모바일 앱 껍데기를 만들었다"에서 끝내지 않고,
"로그인 이후 어떤 업무를 어떤 순서로 보고,
어디까지는 dev-safe skeleton으로 연결하고,
어디서부터는 아직 placeholder/승인 게이트인지"를
더 분명하게 정리하는 단계입니다.

이번 단계도 production 데이터 반영,
실제 사용자 배포,
App Store/Play Console/TestFlight/EAS 유료 빌드,
push 연동,
실기기 권한 확정,
운영 secret 주입은 하지 않습니다.

## 2. 왜 이번 단계가 필요한가

Phase 17에서 이미 정리된 것:

- `apps/mobile` 기본 위치와 monorepo 경계
- `packages/shared/src/mobile-contracts.ts` 기반 route/auth/session 계약
- `apps/mobile/src/base-url.ts` 기반 runtime origin 주입 원칙
- `apps/mobile/src/session-bridge.ts` 기반 secure storage bridge 전제
- 로그인, 대시보드, 출퇴근, 휴가, 결재함, 공지/문서, 내 정보 7개 핵심 화면 우선순위

하지만 아직 비어 있는 설명이 있습니다.

- 각 화면이 어떤 API contract와 연결되는지
- offline/error/empty/권한 없음 상태를 어떤 기준으로 나눌지
- 일반 사용자와 승인자에게 어떤 CTA를 먼저 보여 줄지
- 공지/문서 묶음과 Web/PWA fallback 경계를 어떻게 유지할지
- "지금 되는 것"과 "아직 별도 승인 필요"를 어떻게 문서와 검증에 같이 남길지

즉 Phase 17이 "안전한 진입 구조"를 잠갔다면,
Phase 18은 "업무 흐름을 따라가도 해석이 흔들리지 않게" 만드는 단계입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `TASKS.md`
- `ROADMAP.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `apps/mobile/README.md`
- `apps/mobile/src/base-url.ts`
- `apps/mobile/src/session-bridge.ts`
- `apps/mobile/src/screens.ts`
- `packages/shared/src/mobile-contracts.ts`
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/guides/phase-17-native-mobile-transition-prep-handoff.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

현재 저장소 기준으로 확인되는 사실:

- 모바일 1차 범위는 여전히 7개 핵심 화면 중심이다.
- `packages/shared` 안에는 모바일 route mapping, role/scope, approval gate 기준이 이미 모여 있다.
- 모바일은 브라우저 same-origin을 그대로 쓰는 것이 아니라 runtime base URL resolver로 번역한다.
- 세션 저장은 Web cookie 복제가 아니라 secure storage bridge 전제를 유지한다.
- 협업 영역은 `/boards` 와 `/documents` 를 같은 진입 묶음으로 볼 수 있지만 책임을 합치지는 않는다.
- `/admin/*` 운영 화면은 모바일 기본 탭으로 올리지 않는다.

## 4. Phase 18에서 고정하는 핵심 결정

### 결정 A. 앱 안의 핵심 흐름은 "로그인 → 오늘 할 일 → 상태 변경/확인 → 내 정보" 순서로 읽는다.

1차 기본 흐름:

1. 로그인
2. 대시보드
3. 출퇴근 또는 휴가 또는 결재함
4. 공지/문서 확인
5. 내 정보/세션 확인

설명:

- 모바일은 데스크톱 전체 메뉴를 복제하는 것이 아니다.
- 먼저 오늘 처리할 액션을 짧게 끝내는 흐름을 우선한다.
- 조직/직원 관리나 운영 정책 변경은 이 흐름의 기본선에 넣지 않는다.

### 결정 B. 각 핵심 화면은 API contract와 상태 안내를 함께 가져야 한다.

화면별 기본 연결 기준:

- 로그인: `auth.login`, `me`
- 대시보드: `me`, `approvals.inbox`, `boards.notices`
- 출퇴근: `attendance.records`, `attendance.checkIn`, `attendance.checkOut`
- 휴가: `leave.balances`, `leave.requests`, `leave.types`
- 결재함: `approvals.inbox`, `approvals.documents`
- 공지/문서: `boards.notices`, `boards.boards`, `documents.spaces`
- 내 정보: `me` 중심, 온라인 세션 정리 시 `auth.logout`, 기본 안내는 secure storage bridge 기반 `session clear`

중요한 점:

- API를 실제 운영 연결처럼 과장하지 않는다.
- contract는 연결하되, placeholder/dev-safe 여부를 화면 설명과 테스트 기준에서 숨기지 않는다.

### 결정 C. 상태 안내는 offline/error/empty/forbidden 4축으로 먼저 통일한다.

모바일 1차에서 공통으로 설명해야 할 상태:

1. offline
   - 네트워크가 없거나 mock/dev-safe만 가능한 상태
2. error
   - API target 결정 실패, 예기치 않은 응답, 세션 만료 같은 실패 상태
3. empty
   - 아직 볼 항목이 없는 정상 상태
4. forbidden
   - 로그인은 되었지만 권한/역할/회사 scope상 허용되지 않는 상태

설명 원칙:

- empty 를 error처럼 보이게 하지 않는다.
- forbidden 을 "버그"처럼 숨기지 않는다.
- offline 상태에서 출퇴근/승인 같은 상태 변경이 성공한 것처럼 보이게 하지 않는다.

### 결정 D. 화면별 기본 액션은 오늘 처리할 일 중심으로 고정한다.

- 대시보드: 오늘 할 일 보기, 승인 대기 확인, 공지 읽기
- 출퇴근: 출근/퇴근 CTA, 최근 기록 확인
- 휴가: 잔여 확인, 신청 진입, 승인 대기 요약
- 결재함: 모든 로그인 사용자는 내 문서/읽기 범위를 보고, 승인자만 승인 대기·승인 CTA 를 본다.
- 공지/문서: 공지 읽기, 협업 묶음 진입
- 내 정보: 세션/권한 확인, 로그아웃/세션 clear 안내

금지:

- 모바일 1차에서 관리자 정책 변경 CTA를 핵심 탭 기본 액션처럼 올리지 않는다.
- 오프라인 상태에서 서버 반영이 필요한 CTA를 성공처럼 포장하지 않는다.

### 결정 E. PWA와 네이티브 앱의 차이는 "껍데기"와 "기기 제약" 위주로 설명한다.

이번 단계에서 문서화할 차이:

- PWA는 브라우저/manifest/install 흐름 중심
- 네이티브 앱은 navigation shell, secure storage bridge, runtime base URL resolver 중심
- 공통 도메인 의미와 route mapping은 최대한 유지
- 실기기 권한, push, store build, deep link 운영 확정은 여전히 별도 승인 게이트

즉 "기능이 완전히 다르다"가 아니라
"같은 업무 흐름을 다른 실행 환경에서 안전하게 풀어 쓴다"가 핵심입니다.

### 결정 F. 성공 기준은 연결 가능한 skeleton과 검증 기준을 남기는 것이다.

이번 Phase 18에서 성공으로 보는 것:

- 모바일 7개 핵심 화면이 한 업무 흐름으로 설명된다.
- 각 화면의 route/api/access/state 기준이 문서와 code path에서 같은 뜻으로 보인다.
- offline/error/empty/forbidden 상태 분류가 구현·리뷰·테스트·문서 단계에서 재사용 가능하다.
- PWA 대 네이티브 차이와 별도 승인 게이트가 분리 문서로 남는다.
- unit/contract/typecheck/build/smoke 기준이 후속 카드에서 바로 실행 가능하게 정리된다.

이번 Phase 18에서 성공으로 보지 않는 것:

- 실제 스토어 업로드
- 외부 테스터 배포
- push 토큰 수집
- 실기기 카메라/위치/생체인증 정책 확정
- production 데이터 연결

## 5. 역할별 기대 흐름

### 일반 직원

- 로그인 후 오늘 처리할 일로 바로 들어간다.
- 출퇴근, 휴가, 결재 문서 읽기, 공지 확인을 짧게 처리한다.
- 결재함에서는 내 문서/읽기 범위는 보되 승인 CTA 는 권한 안내와 함께 숨겨진다.
- 빈 상태/권한 없음/오프라인 상태가 무엇인지 이해할 수 있다.

### 팀장/승인자

- 대시보드와 결재함에서 승인 대기 흐름을 먼저 본다.
- 결재함에서 일반 사용자와 같은 문서 읽기 범위 위에 approval lane/승인 CTA 가 추가된다.
- 휴가 승인 맥락을 보되 관리자 정책 변경까지 섞이지 않는다.

### 인사/운영 관리자

- 모바일 1차 범위와 Web 관리자 범위의 경계를 설명할 수 있다.
- 권한 없음/후속 범위/Web fallback 기준이 문서와 화면에서 같은 뜻인지 확인할 수 있다.

### 감사/운영 검토자

- 모바일이 보안 경계를 우회하지 않음을 확인한다.
- 승인 게이트가 여전히 분리돼 있음을 확인한다.

## 6. 이번 Phase에 포함되는 범위

### 문서/기획 범위

- Phase 18 범위 문서 작성
- Phase 18 handoff 문서 작성
- 루트 문서를 Phase 18 활성 체인 기준으로 갱신
- 화면별 흐름, 상태 분류, PWA 대 네이티브 차이, 검증 기준 정리

### 구현 handoff 범위

- 로그인/session placeholder 와 API client contract 연결 정리
- 대시보드/출퇴근/휴가/결재함/공지·문서/내 정보 skeleton 연결 기준 정리
- offline/error/empty/forbidden 상태를 코드와 문서에서 드러내는 방향 고정
- shared contract 재사용 우선, Web 전용 책임 분리 유지

### 검증 범위

- `pnpm --filter @gw/mobile typecheck`
- `packages/shared/test/contracts.spec.ts` 또는 같은 수준 contract 검증
- `pnpm check`
- 필요 시 `pnpm --filter @gw/web build:cf`
- 문서/코드 정합성 재검토

## 7. 이번 Phase에 포함하지 않는 것

- App Store/Play Console/TestFlight/EAS 계정 사용
- 외부 테스터 배포
- push 연동
- 실기기 권한 정책 확정
- production secret/origin/custom domain 확정
- production DB/live data 사용
- 관리자 운영 화면을 모바일 기본 탭에 편입

## 8. 후속 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- 화면별 API contract 연결
- 상태 모델(offline/error/empty/forbidden) 노출 방식
- 일반 사용자/승인자 첫 액션 분리
- PWA와 혼동되지 않는 모바일 shell 흐름

하면 안 되는 것:

- 운영 origin 하드코딩
- Web cookie 복제
- 관리자 정책 변경 화면을 모바일 1차 탭으로 승격
- store/push/실기기 권한을 승인 없이 열기

### 리뷰어(gwreviewer)

집중할 것:

- 상태 분류가 숨겨지지 않는지
- 권한 없음/회사 scope 경계가 흐려지지 않는지
- placeholder 를 실제 배포 완료처럼 보이게 하지 않는지
- PWA와 네이티브 차이 설명이 과장되지 않는지

### 테스터(gwtester)

집중할 것:

- mobile/shared/web/api 타입·계약 정합성
- 화면별 state 설명과 code path 일치 여부
- `pnpm check`, mobile typecheck, shared contract 검증 근거
- store build 없이 남길 수 있는 smoke 증거 정리

### 문서화(gwdocs)

집중할 것:

- SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF/CHANGELOG 최신화
- 상태 분류 4축과 화면별 흐름을 쉬운 한국어로 정리
- "지금 되는 것 / 아직 placeholder / 승인 필요" 구분 강화

### 운영(gwops)

집중할 것:

- Phase 18 변경이 기존 CI/build/deploy 흐름을 깨지 않는지
- mobile 관련 변경이 `pnpm check`, `build:cf`, PR/CI 근거로 추적 가능한지
- 카드 범위 밖 store/release 행동을 실행하지 않는지

## 9. 남은 승인 게이트

계속 별도 승인으로 남는 것:

- Apple Developer / Play Console / TestFlight / EAS 계정 사용
- 유료 빌드/외부 테스터 배포
- 실제 push 알림 연동
- 카메라/위치/생체인증/파일 접근 권한 정책 확정
- 실기기용 secret 발급/주입
- 운영 API origin/custom domain/app link 확정
- production DB 실데이터 반영

## 10. 다음 작업자가 기억할 5가지

1. Phase 18의 핵심은 "모바일 업무 흐름 연결"이지 스토어 배포가 아니다.
2. 7개 핵심 화면은 유지하되, 화면별 API/state/CTA 기준을 더 분명히 해야 한다.
3. offline/error/empty/forbidden 4축 설명을 코드·문서·테스트에서 같은 뜻으로 써야 한다.
4. `/admin/*` 운영 화면은 여전히 모바일 기본 탭 범위 밖이다.
5. PWA와 네이티브 차이는 환경/껍데기 차이로 설명하고, 승인 게이트는 계속 분리한다.
