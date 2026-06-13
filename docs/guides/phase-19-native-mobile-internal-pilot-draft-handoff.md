# Phase 19 네이티브 모바일앱 내부 시범 운영 초안 handoff

한 줄 요약:
이번 Phase 19는 앱을 바로 배포하는 단계가 아니라,
내부 시범 운영을 열기 전에
무슨 준비물이 더 필요하고 무엇은 아직 승인 없이는 못 하는지
쉽게 판단할 수 있게 만드는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 것:

- `apps/mobile` 기본 shell
- 로그인, 대시보드, 출퇴근, 휴가, 결재함, 공지·문서, 내 정보 7개 핵심 화면 기준
- `packages/shared/src/mobile-contracts.ts` 기반 route/api/access 계약
- `apps/mobile/src/base-url.ts` 기반 mobile base URL guardrail
- `apps/mobile/src/session-bridge.ts` 기반 secure storage bridge 전제
- offline/error/empty/forbidden 상태 4축 설명

아직 없는 것 또는 승인 없이는 안 하는 것:

- 실제 App Store / Play Console / TestFlight / EAS 사용
- 실제 내부 테스터 배포
- push 연동
- 실기기 권한 정책 확정
- production secret/origin 주입

즉 지금은
"모바일 핵심 흐름을 읽을 수 있는 상태"까지는 왔지만,
"사내에 실제로 뿌려도 되는가"를 판단하려면
운영 checklist가 더 필요한 상태입니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) 내부 시범 운영은 3개 레인으로 나눠 본다.

레인 A. 지금 바로 가능한 것

- `pnpm --filter @gw/mobile typecheck`
- `pnpm check`
- 필요 시 `pnpm --filter @gw/web build:cf`
- 모바일 문서와 code path 정합성 점검

레인 B. Android 내부 배포 준비

- Android internal test 또는 Expo preview/dev build 후보 절차 문서화
- 설치 안내 초안
- signing/배포 담당자/기기 준비물 정리

레인 C. iOS 내부 배포 준비

- Apple Developer / TestFlight 준비 checklist 문서화
- 팀 권한, App ID, signing, 내부 테스터 절차 정리

중요:
지금 하는 일은
레인 B/C를 실제로 실행하는 것이 아니라,
무엇이 더 필요하고 어디서 막히는지 문서로 분리하는 것입니다.

### 2) Web/PWA 검증과 모바일 내부 시범 검증은 따로 본다.

먼저 확인할 것:

- live/PWA/API 흐름이 최신 main 기준으로 다시 맞는지
- `/login`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/api/*` 설명이 여전히 같은 뜻인지

그 다음 따로 볼 것:

- 모바일 설치/설치 후보 안내
- 로그인과 session bridge 안내
- 핵심 7개 화면 smoke 흐름
- 내 정보/로그아웃/session clear 설명
- 실기기 권한/푸시/스토어 승인 게이트

즉
PWA가 된다고 내부 모바일 시범 운영 준비가 끝난 것은 아니고,
모바일 문서를 정리했다고 Web/API 검증을 생략해도 되는 것도 아닙니다.

## 3. 내부 시범 운영 smoke checklist 기본 순서

1. 설치 또는 설치 후보 안내 확인
2. 로그인
3. 대시보드
4. 출퇴근
5. 휴가
6. 결재함
7. 공지/문서
8. 내 정보 / 로그아웃 / session clear

각 화면에서 같이 적을 것:

- 정상일 때 사용자가 무엇을 해야 하는가
- offline/error/empty/forbidden 중 어떤 상태가 나올 수 있는가
- 현재 dev-safe 기준으로 무엇까지 볼 수 있는가
- 아직 승인 없이는 확인 못 하는 것은 무엇인가

## 4. Android와 iOS에서 따로 챙길 것

### Android

봐야 할 것:

- Android internal test를 쓸지 Expo preview/dev build를 쓸지
- 사내 설치 안내를 어떻게 할지
- signing 또는 패키징 준비가 필요한지
- 승인된 origin 또는 dev-safe base URL 안내를 어떻게 적을지

주의:

- 실제 Play Console 사용은 아직 안 한다.
- 실제 사내 배포도 승인 전에는 안 한다.

### iOS

봐야 할 것:

- Apple Developer 계정/팀 권한 필요 여부
- App ID / Bundle ID / signing 준비
- TestFlight 내부 테스터 절차
- 빌드 업로드 전에 필요한 승인 항목

주의:

- 실제 Apple Developer / TestFlight 사용은 아직 안 한다.
- 실제 기기 등록이나 배포는 승인 전에는 안 한다.

## 5. PWA와 네이티브 앱 차이를 어떻게 설명할 것인가

PWA에서 주로 보는 것:

- 브라우저에서 바로 열림
- manifest/install
- same-origin `/api/*`
- web route smoke

네이티브 앱에서 추가로 보는 것:

- 앱 설치 경로
- secure storage bridge
- runtime base URL resolver
- 기기 권한
- 앱 배포 채널

즉 기능을 다르게 약속하는 것이 아니라,
같은 업무를 다른 운영 껍데기에서 안전하게 다루는 것입니다.

## 6. 먼저 볼 파일

### 모바일 코드/계약

- `packages/shared/src/mobile-contracts.ts`
- `apps/mobile/src/base-url.ts`
- `apps/mobile/src/session-bridge.ts`
- `apps/mobile/src/screens.ts`
- `apps/mobile/src/workflow.ts`
- `apps/mobile/app.config.ts`
- `apps/mobile/README.md`

### 문서

- `docs/architecture/phase-19-native-mobile-internal-pilot-draft-scope.md`
- `docs/guides/phase-19-native-mobile-internal-pilot-draft-handoff.md`
- `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md`
- `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md`
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/guides/phase-17-native-mobile-transition-prep-handoff.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

## 7. 권장 구현 순서

1. Phase 19 문서에서 말한 내부 시범 운영 checklist를 현재 `apps/mobile` 구조와 대조한다.
2. `apps/mobile/README.md` 와 필요 시 관련 안내 문구에서 "지금 되는 것 / 승인 후 되는 것 / 아직 안 하는 것"을 더 분명히 한다.
3. 설치 → 로그인 → 핵심 업무 → 내 정보 흐름이 문서와 code path에서 쉽게 확인되게 보강한다.
4. 계정/비용/권한/secret 요구사항은 구현 TODO가 아니라 승인 checklist로 분리해 둔다.
5. 마지막에 `pnpm --filter @gw/mobile typecheck`, `pnpm check`, 필요 시 `pnpm --filter @gw/web build:cf` 근거를 남긴다.

## 8. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- 모바일 README, handoff helper, release gate 문구처럼 문서와 가까운 안전 범위부터 맞추기
- 내부 시범 운영 smoke checklist가 현재 코드 구조와 같은 뜻인지 확인하기
- 설치/로그인/핵심 업무/세션 정리 흐름을 대장이 쉽게 읽게 만들기

피해야 할 것:

- 실제 App Store / Play Console / TestFlight / EAS 사용
- 실제 내부 배포 실행
- 운영 secret 주입
- production origin 하드코딩
- push/권한 정책 확정

### 리뷰어(gwreviewer)

집중할 것:

- 문서가 실제 배포 완료처럼 보이지 않는지
- PWA 기준과 네이티브 기준이 섞이지 않는지
- 승인 checklist가 구현 TODO에 묻히지 않는지
- mobile base URL / secure storage guardrail 설명이 약해지지 않는지

### 테스터(gwtester)

집중할 것:

- `pnpm --filter @gw/mobile typecheck`
- `pnpm check`
- 필요 시 `pnpm --filter @gw/web build:cf`
- mobile smoke checklist와 code path 정합성
- live/PWA/API 선행 기준과 mobile 전용 기준 분리 여부

### 문서화(gwdocs)

집중할 것:

- SPEC/TEST_PLAN/QA_CHECKLIST/HANDOFF/CHANGELOG 최신화
- 승인 checklist를 쉬운 한국어로 요약
- Android/iOS 준비물 차이와 공통 guardrail 정리

### 운영(gwops)

집중할 것:

- 현재 main 기준 mobile/web 검증 근거 기록
- live/PWA/API 선행 검증과 mobile 검증을 분리해 남기기
- 실제 계정/배포 행동 없이도 남길 수 있는 운영 checklist 정리

## 9. 남은 승인 게이트

계속 별도 승인으로 남는 것:

- Apple Developer / Play Console / TestFlight / EAS 계정 사용
- 실제 내부 테스터 배포
- 외부 스토어 배포
- push 알림 연동
- 카메라/위치/생체인증/파일 접근 권한 정책 확정
- 실기기용 secret 발급/주입
- 운영 API origin/custom domain/app link 확정
- production DB 실데이터 반영
- 실제 유료 리소스 사용

## 10. 다음 작업자가 기억할 6가지

1. 이번 Phase 19의 목적은 내부 시범 운영 준비 기준을 정리하는 것이지 실제 배포를 시작하는 것이 아니다.
2. 기본 7개 핵심 화면 범위는 그대로 유지한다.
3. live/PWA/API 선행 검증과 mobile 전용 검증은 분리해서 본다.
4. Android와 iOS는 같은 업무 흐름을 보되 준비물 checklist는 따로 적는다.
5. 계정/비용/권한/secret 요구사항은 구현 TODO가 아니라 승인 checklist다.
6. App Store/Play Console/TestFlight/EAS, push, 실기기 권한, production 연결은 아직 별도 승인 게이트다.
