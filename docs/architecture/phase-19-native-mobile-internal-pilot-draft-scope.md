# 그룹웨어 Phase 19 네이티브 모바일앱 내부 시범 운영 초안 범위

## 1. 한 줄 정의

Phase 19의 목표는
Phase 17~18에서 정리한 `apps/mobile` skeleton과 모바일 핵심 업무 흐름을 바탕으로,
"사내 내부 시범 운영 후보"로 설명 가능한 기준을 만드는 것입니다.

쉽게 말해 이번 단계는
앱스토어 공개나 실제 외부 배포를 시작하는 것이 아니라,
대장이 내부 시범 운영을 열기 전에
무슨 계정/비용/승인/검증이 필요한지,
어디까지는 지금 dev-safe/preview 기준으로 볼 수 있고,
어디부터는 별도 승인 없이는 열 수 없는지를
한 번에 판단할 수 있게 만드는 단계입니다.

이번 단계도
production 데이터 반영,
실제 App Store/Play Console/TestFlight/EAS 사용,
외부 테스터 배포,
push 연동,
실기기 권한 확정,
운영 secret 주입은 하지 않습니다.

## 2. 왜 이번 단계가 필요한가

Phase 18에서 이미 정리된 것:

- `apps/mobile` 기본 shell과 7개 핵심 화면 우선순위
- `packages/shared/src/mobile-contracts.ts` 기반 route/api/access 계약
- `apps/mobile/src/base-url.ts` 기반 approved origin only / dev-safe base URL resolver 기준
- `apps/mobile/src/session-bridge.ts` 기반 secure storage bridge 전제
- 로그인 → 대시보드 → 출퇴근/휴가/결재함 → 공지·문서 → 내 정보 흐름
- offline/error/empty/forbidden 상태 4축 설명

하지만 아직 아래가 약합니다.

- 내부 시범 운영을 실제로 열려면 Android/iOS 각각 어떤 준비물이 필요한지 한눈에 안 보입니다.
- PWA 검증과 네이티브 앱 검증을 어디서 분리해서 봐야 하는지 문서가 더 분명해야 합니다.
- 설치/로그인/핵심 업무 smoke checklist가 "문서 기준"과 "내부 배포 기준"으로 나뉘어 있지 않습니다.
- Apple Developer, TestFlight, Google Play Console, EAS, signing, 기기 등록, 권한 고지처럼 비용/계정/승인 성격의 항목이 한 묶음으로 정리돼 있지 않습니다.
- 지금 가능한 dev-safe 검증과, 나중에 실제 내부 배포에서만 확인 가능한 항목이 섞여 보일 수 있습니다.

즉 Phase 18이 "핵심 업무 흐름을 연결해 읽히게 만드는 단계"였다면,
Phase 19는 "내부 시범 운영을 시작하려면 무엇이 더 필요하고 무엇은 아직 안 여는지"를 운영 기준으로 분리하는 단계입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `TASKS.md`
- `ROADMAP.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `CHANGELOG.md`
- `apps/mobile/README.md`
- `apps/mobile/app.config.ts`
- `apps/mobile/src/base-url.ts`
- `apps/mobile/src/session-bridge.ts`
- `apps/mobile/src/screens.ts`
- `apps/mobile/src/workflow.ts`
- `packages/shared/src/mobile-contracts.ts`
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/guides/phase-17-native-mobile-transition-prep-handoff.md`
- `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md`
- `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

현재 저장소 기준으로 확인되는 사실:

- `apps/mobile` 은 아직 store upload나 실기기 배포가 아니라 skeleton/contract/typecheck 단계다.
- `app.config.ts` 에도 release gate가 App Store / Play Console / TestFlight / EAS / push / device permission approval required 로 남아 있다.
- 모바일 핵심 화면은 계속 7개(로그인, 대시보드, 출퇴근, 휴가, 결재함, 공지·문서, 내 정보)다.
- 모바일 세션과 API 연결은 Web cookie 복제가 아니라 secure storage bridge, runtime base URL resolver 전제를 유지한다.
- 같은 업무 의미는 PWA와 공유하지만, 네이티브 앱은 설치/배포/서명/기기 권한/스토어 심사 같은 별도 운영 축이 추가된다.
- 현재 저장소만으로는 Apple Developer, TestFlight, Google Play Console, EAS 계정이나 비용 상태를 확인하지 않는다. 따라서 이번 단계에서는 계정 사용이 아니라 준비물/승인 checklist 문서화에 집중해야 한다.

## 4. Phase 19에서 고정하는 핵심 결정

### 결정 A. 내부 시범 운영은 3개 레인으로 나눠 본다.

1. 문서·로컬 검증 레인
   - 현재 저장소에서 바로 가능한 범위
   - `pnpm --filter @gw/mobile typecheck`, `pnpm check`, 필요 시 `pnpm --filter @gw/web build:cf`
   - 모바일 route/contract/guardrail 문서 정합성 확인
2. Android 내부 배포 준비 레인
   - 승인 후 선택 가능한 후보 절차만 문서화
   - Android internal test 또는 Expo preview/dev build 후보 절차
   - signing/배포계정/테스터 모집/설치 안내 초안 정리
3. iOS 내부 배포 준비 레인
   - TestFlight/Apple Developer 준비물과 승인 checklist만 문서화
   - 실제 계정 사용, 기기 등록, 빌드 업로드는 별도 승인 전까지 하지 않음

핵심은
"지금 바로 할 수 있는 것"과
"내부 시범 운영을 열려면 추가 승인이 필요한 것"을
같은 문서 안에서 분리하는 것입니다.

### 결정 B. 내부 시범 운영 전 검증은 Web/PWA 기준과 네이티브 앱 기준을 분리한다.

내부 시범 운영 전 공통 선행 기준:

- live/PWA/API 흐름이 현재 main 기준으로 다시 확인돼 있어야 함
- `/login`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, 관련 `/api/*` 경계가 최신 문서와 같은 뜻이어야 함
- `pnpm check` 와 필요 시 `pnpm --filter @gw/web build:cf` 근거가 있어야 함

그 위에 네이티브 앱 전용 기준을 별도로 본다.

- 설치 가능성(패키징/배포 경로 설명)
- 로그인/세션 bridge 안내
- 모바일 shell navigation
- 7개 핵심 화면 smoke checklist
- 오프라인/권한/빈 상태/오류 상태 표시
- 실기기 권한/푸시/스토어 배포는 여전히 승인 게이트

즉 PWA가 통과했다고 네이티브 내부 시범 운영 준비가 끝난 것이 아니고,
반대로 네이티브 문서를 다 썼다고 Web/PWA 재검증을 건너뛰어도 안 됩니다.

### 결정 C. 내부 시범 운영 smoke checklist는 "설치 → 로그인 → 오늘 할 일 → 협업 확인 → 세션 정리" 순서로 읽는다.

모바일 내부 시범 운영 기준 기본 순서:

1. 설치 또는 설치 후보 안내 확인
2. 로그인
3. 대시보드
4. 출퇴근
5. 휴가
6. 결재함
7. 공지/문서
8. 내 정보 / 로그아웃 / session clear

각 단계에서 같이 적을 것:

- 정상 흐름에서 무엇을 확인하는가
- offline/error/empty/forbidden 중 어떤 상태가 나올 수 있는가
- 실제 운영 데이터 없이 무엇까지 dev-safe로 확인하는가
- 실기기 권한/배포계정/푸시가 없어 아직 못 보는 것은 무엇인가

### 결정 D. Android와 iOS는 같은 업무 흐름을 보되, 운영 준비물은 따로 적는다.

Android에서 따로 봐야 할 것:

- Android internal test를 쓸지 Expo preview/dev build를 쓸지 후보 선택
- 앱 서명 방식과 배포 경로 초안
- 사내 테스터 설치 안내 초안
- 기기별 네트워크/base URL 입력 또는 approved origin 연결 방식 메모

iOS에서 따로 봐야 할 것:

- Apple Developer 계정/팀 권한
- App ID, Bundle ID, signing 준비
- TestFlight 내부 테스터 운영 절차
- 심사/빌드 업로드 이전에 필요한 승인 항목

공통으로 아직 하지 않는 것:

- 실제 스토어 업로드
- 실제 유료 결제/계정 생성
- 외부 테스터 초대
- push certificate/token 연동
- 카메라/위치/생체인증 정책 확정

### 결정 E. PWA와 네이티브 앱의 운영 차이는 "설치·세션·권한·배포" 축으로 설명한다.

PWA 쪽에서 주로 보는 것:

- 브라우저 origin
- manifest/install
- same-origin `/api/*`
- 웹 라우트와 preview/live smoke

네이티브 앱 쪽에서 추가로 보는 것:

- 앱 패키지/배포 경로
- secure storage bridge
- runtime base URL resolver
- 기기 권한 문구와 정책
- 앱 업데이트/배포 채널

즉 기능 자체를 완전히 따로 설계하는 것이 아니라,
같은 업무 흐름에
추가 운영 책임이 붙는다고 설명하는 것이 핵심입니다.

### 결정 F. 비용/계정/권한/secret 요구사항은 구현 항목과 분리한 승인 checklist로 남긴다.

반드시 따로 보이게 할 항목:

- Apple Developer 계정 필요 여부
- TestFlight 사용 권한과 담당자
- Google Play Console 사용 권한과 담당자
- Expo/EAS 사용 여부와 비용 성격
- signing key / certificate / bundle id / package name 준비 여부
- 배포용 secret 또는 API origin 승인 필요 여부
- 사내 테스터 기기/계정 수집 여부

문서 톤 원칙:

- "있으면 좋다"가 아니라 "없으면 여기서 멈춘다"를 분명히 적는다.
- 계정/비용/권한이 필요한 항목은 개발 TODO와 섞지 않는다.
- 아직 미확정인 항목은 완료처럼 쓰지 않는다.

## 5. 역할별 기대 흐름

### 일반 직원(내부 테스터 후보)

- 설치 안내를 보고 어디서 앱을 받는지 이해할 수 있다.
- 로그인 후 오늘 해야 할 일과 핵심 업무 흐름을 짧게 따라갈 수 있다.
- 오프라인/권한 없음/빈 상태/오류 상태가 왜 보이는지 이해할 수 있다.

### 팀장/승인자(내부 테스터 후보)

- 일반 직원과 같은 기본 흐름 위에 결재함/승인 대기 확인이 추가된다.
- 승인 CTA가 누구에게만 보여야 하는지 문서 기준으로 설명할 수 있다.
- 모바일과 PWA에서 같은 업무 의미가 유지되는지 비교할 수 있다.

### 인사/운영 관리자

- 내부 시범 운영을 열기 전에 필요한 계정/권한/비용/기기 모집 항목을 판단할 수 있다.
- 실기기 권한, push, 스토어, production secret이 아직 승인 게이트인지 명확히 볼 수 있다.
- live/PWA/API 선행 검증과 모바일 전용 검증을 분리해 이해할 수 있다.

### 감사/운영 검토자

- 내부 시범 운영 초안이 보안 경계를 우회하지 않는지 확인할 수 있다.
- mobile base URL, secure storage bridge, approval gate가 문서와 같은 뜻인지 확인할 수 있다.
- 실제 사용자 배포 전에 어떤 운영 결재가 더 필요한지 정리할 수 있다.

## 6. 이번 Phase에 포함되는 범위

### 문서/기획 범위

- Phase 19 범위 문서 작성
- Phase 19 쉬운 handoff 문서 작성
- 루트 문서를 Phase 19 활성 체인 기준으로 갱신
- Android/iOS 내부 시범 운영 준비 checklist 초안 정리
- 모바일 smoke checklist와 PWA/live/API 선행 기준 분리
- 비용/계정/권한/secret 승인 체크리스트 정리

### 구현 handoff 범위

- 기존 `apps/mobile` skeleton과 문서 기준을 어긋나지 않게 보강할 포인트 정리
- 필요 시 `apps/mobile/README.md`, `app.config.ts`, mobile guide 문구 보강 후보 제시
- 실제 store/TestFlight/EAS 연동 없이도 남길 수 있는 검증 근거 정리

### 검증 범위

- `pnpm --filter @gw/mobile typecheck`
- `pnpm check`
- 필요 시 `pnpm --filter @gw/web build:cf`
- 문서/코드 정합성 재검토
- 모바일 smoke checklist와 live/PWA/API 선행 기준이 서로 다른 말을 하지 않는지 확인

## 7. 이번 Phase에 포함하지 않는 것

- Apple Developer / Play Console / TestFlight / EAS 실제 계정 사용
- 실제 내부 테스터 초대/배포
- 외부 스토어 배포
- push token / push provider 연동
- 카메라·위치·생체인증 권한 정책 확정
- production secret/origin/custom domain 확정
- production DB/live data 사용
- 실제 결제/유료 리소스 집행

## 8. 후속 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- 문서에서 말한 내부 시범 운영 checklist가 현재 `apps/mobile` 구조와 같은 뜻인지 맞추기
- 필요 시 모바일 README, handoff helper 문구, release gate 메모 보강
- 설치/로그인/핵심 업무/세션 정리 흐름을 문서와 code path에서 쉽게 확인 가능하게 만들기
- 실제 계정/스토어/푸시 없이 남길 수 있는 검증 근거를 정리하기

하면 안 되는 것:

- Apple Developer / Play Console / TestFlight / EAS 계정 사용
- 실제 내부 배포 실행
- 운영 secret 주입
- production origin 하드코딩
- push/실기기 권한을 승인 없이 열기

### 리뷰어(gwreviewer)

집중할 것:

- 내부 시범 운영 초안이 실제 배포 완료처럼 과장되지 않는지
- PWA 기준과 네이티브 기준이 섞이지 않는지
- 계정/비용/권한 요구사항이 TODO가 아니라 승인 checklist로 분리돼 있는지
- 모바일 base URL/session guardrail 설명이 흐려지지 않는지

### 테스터(gwtester)

집중할 것:

- `pnpm --filter @gw/mobile typecheck`
- `pnpm check`
- 필요 시 `pnpm --filter @gw/web build:cf`
- 모바일 smoke checklist와 code path 정합성
- live/PWA/API 선행 기준과 모바일 전용 기준이 분리돼 설명되는지

### 문서화(gwdocs)

집중할 것:

- SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF/CHANGELOG 최신화
- 설치 안내/검증 기준/승인 checklist를 쉬운 한국어로 재정리
- "지금 되는 것 / 승인 후 되는 것 / 아직 안 하는 것" 구분 강화

### 운영(gwops)

집중할 것:

- 현재 main 기준 mobile/web 검증 명령 결과 기록
- live/PWA/API 선행 검증 근거와 모바일 검증 근거 분리
- 내부 시범 운영에 필요한 계정/비용/권한/secret 목록을 운영 체크리스트로 묶기
- 카드 범위 밖 실제 배포/스토어 행동을 실행하지 않기

## 9. 완료로 볼 최소 기준

- 대장이 내부 시범 운영을 열기 전에 필요한 계정/비용/권한/secret/배포 승인 항목을 한눈에 볼 수 있다.
- 현재 dev-safe/preview 기준으로 바로 확인 가능한 모바일 검증 근거와, 승인 후에만 가능한 내부 배포 검증 항목이 분리돼 있다.
- Android/iOS 각각 무엇을 더 준비해야 하는지 쉬운 checklist로 설명된다.
- PWA/live/API 선행 검증과 모바일 내부 시범 운영 smoke 기준이 서로 다른 말을 하지 않는다.
- 다음 구현/리뷰/테스트/문서화/운영 카드가 같은 기준으로 바로 이어질 수 있다.
