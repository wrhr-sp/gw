# `apps/mobile`

한 줄 요약:
이 디렉터리는 Phase 17 네이티브 모바일앱 전환 준비용 skeleton 이며,
아직 실제 App Store/Play Console/TestFlight/EAS 배포나 실기기 권한 연결을 수행하지 않습니다.

## 이번 단계에서 들어 있는 것

- `app.config.ts`
  - Expo/React Native 앱 shell 후보 메타데이터
  - store/EAS/push/권한 항목이 승인 게이트라는 점을 `extra` 메모로 분리
- `src/shell.ts`
  - 모바일 기본 탭과 7개 핵심 화면 placeholder 설명
- `src/base-url.ts`
  - same-origin 철학을 모바일에서 runtime origin injection 으로 번역하는 base URL resolver
- `src/session-bridge.ts`
  - Web cookie 복제가 아니라 secure storage bridge 전제를 유지하는 session guardrail
- `src/screens.ts`
  - 로그인/대시보드/출퇴근/휴가/결재함/공지·문서/내 정보 wireframe 메모

## 이번 단계에서 하지 않는 것

- Expo SDK 실제 설치/업그레이드
- App Store / Play Console / TestFlight / EAS 계정 사용
- 외부 테스터 배포
- push token 연동
- 카메라·위치·생체인증 권한 정책 확정
- production secret 주입

## 다음 구현자가 바로 확인할 포인트

1. `packages/shared/src/mobile-contracts.ts` 에서 Web/PWA와 공유할 route/auth/session/승인 게이트 기준을 먼저 본다.
2. `src/base-url.ts` 에서 production 은 approved origin 만, dev/preview 는 명시적 origin 또는 mock adapter 만 허용하는지 확인한다.
3. `src/session-bridge.ts` 에서 plain async storage 나 Web cookie copy 가 금지되는지 확인한다.
4. `src/screens.ts` 에서 `/admin/*` 가 모바일 기본 탭에 포함되지 않는지 확인한다.

## 현재 검증 메모

- 이 단계의 성공 기준은 스토어 업로드가 아니라 skeleton/contract/typecheck 기준이 맞는지 확인하는 것이다.
- 실제 구현 전에도 `packages/shared` 테스트와 `apps/mobile` TypeScript 점검으로 route/auth/session 경계가 깨지지 않는지 먼저 확인한다.
