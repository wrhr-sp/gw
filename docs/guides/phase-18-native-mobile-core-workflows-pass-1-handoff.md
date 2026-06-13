# Phase 18 네이티브 모바일앱 핵심 업무 연결 1차 handoff

한 줄 요약:
이번 Phase 18은 스토어 배포를 여는 단계가 아니라,
Phase 17에서 준비한 모바일 skeleton 위에
로그인부터 핵심 업무 확인까지 한 흐름으로 따라갈 수 있는 기준을
화면·상태·검증 단위로 더 촘촘하게 연결하는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 것:

- `apps/mobile` 기본 shell
- `packages/shared/src/mobile-contracts.ts` 기반 route/auth/session 계약
- `apps/mobile/src/base-url.ts` 기반 runtime origin 주입 정책
- `apps/mobile/src/session-bridge.ts` 기반 secure storage bridge 전제
- 로그인, 대시보드, 출퇴근, 휴가, 결재함, 공지/문서, 내 정보 7개 핵심 화면 기준

이번 Phase 18에서 더 분명히 해야 하는 것:

- 각 화면이 어떤 API contract를 보는지
- 사용자가 어떤 순서로 흐름을 따라가는지
- offline/error/empty/권한 없음 상태를 어떻게 보여 줄지
- PWA와 네이티브 앱의 차이를 어디까지 설명할지
- 테스트/리뷰/문서화가 어떤 근거를 공통으로 볼지

즉 이번 단계는
"구조는 있다"에서 한 걸음 더 나아가
"실제 사용 흐름처럼 읽히되 아직 placeholder인 부분과 승인 게이트를 숨기지 않는다"에 가깝습니다.

## 2. 먼저 잡아야 할 기본 흐름

모바일 1차 기본 흐름은 아래 순서로 읽습니다.

1. 로그인
2. 대시보드
3. 출퇴근 / 휴가 / 결재함 중 오늘 필요한 업무
4. 공지/문서 확인
5. 내 정보/세션 확인

핵심 원칙:

- 데스크톱 전체 메뉴를 다 옮기지 않는다.
- 오늘 처리할 일부터 먼저 본다.
- 관리자 정책/운영 설정은 기본 흐름에 억지로 섞지 않는다.

## 3. 화면별로 무엇을 연결해야 하는가

### 로그인

봐야 할 것:

- 회사 이메일/비밀번호 placeholder
- secure storage bridge 안내
- 실제 운영 SSO는 별도 승인 게이트라는 안내

연결 기준:

- `auth.login`
- `me`

주의:

- 로그인 성공을 실제 운영 인증 완료처럼 과장하지 않는다.
- 세션 저장은 Web cookie 복제가 아니라 모바일 bridge를 통과해야 한다.

### 대시보드

봐야 할 것:

- 오늘 할 일 요약
- 승인 대기 카드
- 공지/문서 읽기 진입
- 역할별 첫 액션

연결 기준:

- `me`
- `approvals.inbox`
- `boards.notices`

주의:

- 대시보드는 세부 작업을 다 처리하는 곳이 아니라 다음 액션으로 보내는 허브다.

### 출퇴근

봐야 할 것:

- 출근/퇴근 CTA
- 최근 기록
- 정정 요청 진입
- 오프라인 honesty 안내

연결 기준:

- `attendance.records`
- `attendance.checkIn`
- `attendance.checkOut`

주의:

- offline 상태에서 상태 변경이 성공한 것처럼 보이면 안 된다.
- 정책 변경 화면은 여기 넣지 않는다.

### 휴가

봐야 할 것:

- 잔여 요약
- 신청 카드
- 승인 대기 요약
- 정책 source 메모

연결 기준:

- `leave.balances`
- `leave.requests`
- `leave.types`

주의:

- 신청과 승인 맥락은 보여 줄 수 있지만 관리자 정책 변경까지 섞지 않는다.

### 결재함

봐야 할 것:

- 내 문서
- 승인 대기
- 큰 승인/반려 CTA
- 모바일 상세 drill-down

연결 기준:

- `approvals.inbox`
- `approvals.documents`

주의:

- 모든 로그인 사용자는 내 문서/읽기 범위를 볼 수 있어야 한다.
- 승인 CTA는 승인 가능한 역할 설명과 함께 보여 줘야 한다.
- 모든 사용자가 같은 권한인 것처럼 보이면 안 된다.
- approval lane 강조와 승인/반려 CTA 는 팀장/인사/회사 운영 권한에만 남긴다.

### 공지/문서

봐야 할 것:

- 공지 목록
- 게시판/문서 묶음 진입
- 읽기 중심 placeholder
- 파일 업로드 승인 게이트 안내

연결 기준:

- `boards.notices`
- `boards.boards`
- `documents.spaces`

주의:

- `/boards` 와 `/documents` 를 한 묶음으로 시작할 수는 있어도
  게시판 책임과 문서 보관 책임을 합쳐 쓰지 않는다.
- 실제 저장소 업로드/다운로드 완료처럼 보이게 하지 않는다.

### 내 정보

봐야 할 것:

- 내 세션 요약
- 내 역할/권한
- 보안 설정 안내
- 로그아웃/세션 clear

연결 기준:

- `me`
- 온라인 세션 정리 시 `auth.logout`
- 기본 안내는 secure storage bridge 기반 `session clear`

주의:

- 관리자 운영 변경 화면으로 키우지 않는다.
- 세션/권한 설명과 로그아웃 흐름 중심으로 두되, 항상 온라인 API 성공을 전제한 것처럼 쓰지 않는다.

## 4. 상태 안내를 어떻게 통일할 것인가

이번 Phase 18에서 공통으로 쓸 상태 분류는 4가지입니다.

### 1) offline

- 네트워크 미연결
- mock/dev-safe만 가능한 상태
- 서버 반영이 필요한 액션은 성공처럼 보이면 안 됨

### 2) error

- API target 결정 실패
- 예기치 않은 응답
- 세션 만료 또는 불완전한 상태

### 3) empty

- 처리할 항목이 없는 정상 상태
- 기록/문서/공지/승인 대기가 없을 수 있음

### 4) forbidden

- 로그인은 되었지만 role/scope/capability상 허용되지 않는 상태
- 버그가 아니라 정책/권한 경계일 수 있음

중요:

- empty 를 error처럼 보이게 하지 않는다.
- forbidden 을 숨기지 않는다.
- offline 에서 변경형 CTA가 성공처럼 보이면 안 된다.

## 5. PWA와 네이티브 앱 차이를 어떻게 적을 것인가

같은 점:

- 도메인 의미와 핵심 route 흐름은 최대한 유지
- shared contract, role/scope, 권한 설명 재사용
- 관리자 범위를 일반 사용자 기본 흐름에 섞지 않음

다른 점:

- PWA는 브라우저/manifest/install/offline 안내 중심
- 네이티브 앱은 navigation shell, secure storage bridge, runtime base URL resolver 중심
- 실기기 권한, push, store build, deep link 운영 확정은 아직 별도 승인 범위

즉 차이를 "기능 우열"이 아니라
"실행 환경과 연결 방식 차이"로 설명하면 됩니다.

## 6. 실제로 먼저 볼 파일

### 코드/계약

- `packages/shared/src/mobile-contracts.ts`
- `apps/mobile/src/base-url.ts`
- `apps/mobile/src/session-bridge.ts`
- `apps/mobile/src/screens.ts`
- `apps/mobile/src/shell.ts`

### 문서

- `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md`
- `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md`
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/guides/phase-17-native-mobile-transition-prep-handoff.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

## 7. 권장 구현 순서

1. shared contract 기준으로 화면별 API 연결 표면을 맞춘다.
2. 로그인 → 대시보드 → 핵심 업무 → 내 정보 흐름이 끊기지 않게 skeleton을 정리한다.
3. offline/error/empty/forbidden 상태를 화면 설명이나 placeholder 구조에 드러낸다.
4. 승인자와 일반 사용자의 CTA 차이를 최소한의 설명으로 분리한다.
5. `/admin/*`, 스토어, push, 실기기 권한은 후속 범위로 남긴다.

## 8. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- 화면별 contract 연결
- 상태 분류 4축 반영
- 승인자/일반 사용자 첫 액션 차이
- PWA와 혼동되지 않는 모바일 shell 흐름

피해야 할 것:

- preview URL 기본값 하드코딩
- Web cookie 복제
- 관리자 정책 변경 화면 편입
- production secret/store/push 권한 열기

### 리뷰어(gwreviewer)

집중할 것:

- 상태 안내가 숨겨지지 않는지
- 권한 없음/회사 scope 경계가 흐려지지 않는지
- placeholder 를 완성 배포처럼 보이게 하지 않는지
- PWA와 네이티브 차이 설명이 과장되지 않는지

### 테스터(gwtester)

집중할 것:

- `pnpm --filter @gw/mobile typecheck`
- `packages/shared` contract 검증
- `pnpm check`
- 필요 시 `pnpm --filter @gw/web build:cf`
- 화면별 상태 설명과 code path 정합성

### 문서화(gwdocs)

집중할 것:

- SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF/CHANGELOG 갱신
- 상태 분류 4축을 쉬운 한국어로 정리
- "지금 되는 것 / 아직 placeholder / 승인 필요" 분리

### 운영(gwops)

집중할 것:

- Phase 18 변경이 PR/CI/build 흐름을 깨지 않는지
- mobile 관련 변경이 root check/build 근거로 추적되는지
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

1. 이번 Phase 18의 목적은 모바일 핵심 업무 흐름을 한 번 따라가게 만드는 것이다.
2. 7개 핵심 화면 범위는 유지한다.
3. offline/error/empty/forbidden 상태를 숨기지 않는 것이 중요하다.
4. `/admin/*` 는 여전히 모바일 기본 탭 밖이다.
5. 스토어/푸시/실기기 권한/production 연결은 아직 별도 승인 게이트다.
