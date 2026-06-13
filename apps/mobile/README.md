# `apps/mobile`

한 줄 요약:
이 디렉터리는 Phase 20 운영 전 정리 1차 기준으로 다시 맞춘 모바일 readiness skeleton 이며,
모바일은 전체 운영 준비의 한 축일 뿐이고 아직 실제 App Store/Play Console/TestFlight/EAS 배포나 실기기 권한 연결을 수행하지 않습니다.

## 이번 단계에서 들어 있는 것

- `app.config.ts`
  - Expo/React Native 앱 shell 후보 메타데이터
  - store/EAS/push/권한 항목이 승인 게이트라는 점을 `extra` 메모로 분리
  - 운영 전 readiness 레인 id 와 smoke checklist step id 를 함께 남김
- `src/shell.ts`
  - 모바일 기본 탭과 7개 핵심 화면 placeholder 설명
  - 운영 전 readiness 3개 레인, 스토어 제출 전 체크리스트, smoke checklist 메타데이터
- `src/base-url.ts`
  - same-origin 철학을 모바일에서 runtime origin injection 으로 번역하는 base URL resolver
- `src/session-bridge.ts`
  - Web cookie 복제가 아니라 secure storage bridge 전제를 유지하는 session guardrail
- `src/screens.ts`
  - 로그인/대시보드/출퇴근/휴가/결재함/공지·문서/내 정보 wireframe 메모
  - 화면별 smoke focus 포인트 연결
- `src/workflow.ts`
  - 화면별 offline/error/empty/forbidden 상태 설명과 역할별 첫 액션 흐름 preview helper
  - 단계별 smoke checklist 포인트 연결

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
5. `src/workflow.ts` 에서 화면 상태 4축과 일반 사용자/승인자 첫 액션 분기가 같은 contract 뜻으로 계산되는지 확인한다.

## Phase 20 운영 전 readiness 레인

1. 문서·로컬 검증 레인
   - `pnpm --filter @gw/mobile typecheck`
   - `pnpm check`
   - 필요 시 `pnpm --filter @gw/web build:cf`
   - 모바일 route/auth/session/base-url 문서 정합성 확인
2. Android 내부 배포 준비 레인
   - Android internal test 또는 Expo preview/dev build 후보 절차 문서화
   - 사내 설치 안내 초안
   - signing/패키징/배포 담당자 메모
3. iOS 내부 배포 준비 레인
   - Apple Developer/TestFlight 준비 checklist
   - App ID / Bundle ID / signing / 내부 테스터 절차 메모

중요:

- 1번 레인은 지금 저장소에서 바로 검토 가능한 mobile 축 근거이고, 전체 운영 readiness 전부를 대신하지 않는다.
- 2번, 3번 레인은 이번 저장소 안에서 "실행"하는 일이 아니라 "승인 전에 필요한 준비물"을 분리해 두는 일이다.
- 계정/비용/권한/secret 요구사항은 개발 TODO 가 아니라 승인 checklist 로 남긴다.

## 운영 전 mobile smoke checklist

기본 순서:

1. 설치 또는 설치 후보 안내
2. 로그인
3. 대시보드
4. 출퇴근
5. 휴가
6. 결재함
7. 공지/문서
8. 내 정보 / 로그아웃 / session clear

각 단계에서 같이 볼 것:

- 정상 흐름에서 무엇을 확인하는지
- offline/error/empty/forbidden 중 어떤 상태가 나올 수 있는지
- 현재 dev-safe/preview 기준으로 어디까지 볼 수 있는지
- 승인 없이는 아직 못 여는 항목이 무엇인지

## 현재 검증 메모

- 이 단계의 성공 기준은 스토어 업로드가 아니라 skeleton/contract/typecheck 기준과 운영 전 안내 문구가 같은 뜻인지 확인하는 것이다.
- 실제 구현 전에도 `packages/shared` 테스트와 `apps/mobile` TypeScript 점검으로 route/auth/session 경계가 깨지지 않는지 먼저 확인한다.
- live/PWA/API 선행 검증과 mobile 전용 smoke 검증은 같은 체크로 합치지 말고 분리해서 기록한다.
- `/admin/*` 운영 기능은 모바일 기본 탭 완료 범위처럼 섞지 않고, Web fallback 또는 후속 승인 범위로 남긴다.
