# Phase 20 운영 전 정리 1차 handoff

한 줄 요약:
이번 Phase 20은
새 기능을 크게 더 만드는 단계가 아니라,
지금 저장소를 실제 운영 전 점검표 관점으로 다시 읽히게 만드는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 확인 가능한 것:

- Web/PWA/API/mobile 이 shared contract 를 기준으로 묶여 있다는 점
- 로그인 이후 핵심 업무 흐름과 관리자 경계 기본 구조
- `pnpm check`, `pnpm --filter @gw/mobile typecheck`, 필요 시 `pnpm --filter @gw/web build:cf` 같은 dev-safe 검증 기준
- mobile base URL resolver, secure storage bridge, 상태 4축 같은 guardrail 설명

아직 운영 완료로 보면 안 되는 것:

- placeholder/skeleton 상태의 저장·승인·업로드·배포 표현
- 실제 production 데이터 반영
- 외부 서비스 실연동
- 실제 스토어/실기기 배포

별도 승인 없이는 진행하지 않는 것:

- production DB 실데이터
- secret 입력/교체
- DNS/custom domain/app link
- 유료 리소스
- 외부 사용자 초대/권한 실변경
- App Store / Play Console / TestFlight / EAS 실제 사용
- push/실기기 권한 정책 확정

즉 지금은
"운영 후보를 설명할 수 있는 상태"에 더 가깝고,
"바로 운영 전환이 끝난 상태"는 아닙니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) 확인 포인트는 4축으로 나누고 결론은 3분류로 모은다.

확인 축:

- Web
- PWA
- API
- Mobile

최종 결론표:

- 지금 확인됨
- 아직 skeleton/preview
- 별도 승인 필요

중요:
각 축에서 본 내용을 따로 길게 나열하는 것보다,
최종적으로 무엇이 어느 분류인지 바로 읽히게 만드는 것이 더 중요합니다.

### 2) mobile 은 전체 readiness 의 일부다.

계속 기억할 것:

- mobile 문서가 잘 정리돼도 Web/PWA/API/admin 검토를 대신하지 않는다.
- Web/live 근거가 있어도 mobile 쪽 승인 게이트가 사라지는 것은 아니다.
- `/admin/*` 운영 화면은 mobile 기본 탭이나 일반 직원 핵심 흐름으로 섞지 않는다.

### 3) placeholder/skeleton 은 "아직 운영 전"이라는 뜻을 숨기면 안 된다.

특히 다시 볼 것:

- 저장/승인/배포가 실제 완료처럼 읽히는 문구가 없는지
- empty 와 error 를 섞어 쓰지 않는지
- 권한 부족/회사 scope/정책 미허용/placeholder 제한이 구분되는지
- 승인 항목이 개발 TODO 속에 숨어버리지 않는지

## 3. 대장이 가장 먼저 볼 5가지 질문

1. 지금 저장소에서 바로 확인 가능한 핵심 흐름은 무엇인가?
2. 아직 skeleton/preview 라서 운영 완료처럼 보면 안 되는 것은 무엇인가?
3. production 운영 전에 별도 승인·계정·비용·권한이 필요한 것은 무엇인가?
4. live/PWA/API/mobile 확인 포인트가 서로 다른 말을 하지 않는가?
5. 관리자와 일반 사용자 경계가 route·문서·QA 기준에서 같은 뜻인가?

이 5개 질문에 바로 답이 안 보이면
이번 단계 정리가 덜 된 상태입니다.

## 4. 먼저 볼 파일

### 이번 Phase 20 문서

- `docs/architecture/phase-20-pre-operations-alignment-pass-1-scope.md`
- `docs/guides/phase-20-pre-operations-alignment-pass-1-handoff.md`

### 루트 문서

- `ROADMAP.md`
- `TASKS.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`

### 현재 기준을 보여 주는 구현 근거

- `packages/shared/src/mobile-contracts.ts`
- `apps/mobile/src/workflow.ts`
- `apps/mobile/src/base-url.ts`
- `apps/mobile/src/session-bridge.ts`
- `apps/mobile/README.md`
- `apps/mobile/app.config.ts`

## 5. 권장 구현 순서

1. 루트 문서에서 Phase 19 표현 중 "내부 시범 운영 준비"에 머물러 있는 문장을 찾아, Phase 20의 "운영 전 정리" 문장으로 바꾼다.
2. 되는 것 / 아직 안 되는 것 / 승인 필요 항목이 문서마다 같은 기준으로 보이는지 맞춘다.
3. live/PWA/API/mobile 확인 포인트를 같은 결론표 관점으로 다시 적는다.
4. `/admin/*` 운영 기능과 일반 사용자 핵심 흐름이 섞이는 표현이 없는지 다시 본다.
5. mobile 관련 문구는 유지하되 전체 readiness 중 한 축이라는 점을 분명히 한다.
6. 마지막에 `pnpm check`, `pnpm --filter @gw/mobile typecheck`, 필요 시 `pnpm --filter @gw/web build:cf` 근거를 남긴다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- 문서/README/설명 copy 에서 운영 완료처럼 보이는 표현 줄이기
- 되는 것 / 아직 안 되는 것 / 승인 필요를 파일마다 같은 톤으로 맞추기
- `/admin/*` 와 일반 업무 route 설명이 섞이지 않게 유지하기

피해야 할 것:

- production data/secret/DNS 같은 restricted 범위 작업
- 실제 스토어/외부 배포/실기기 권한 확정
- preview 편의 때문에 guardrail 을 완화하는 변경

### 리뷰어(gwreviewer)

집중할 것:

- placeholder/skeleton 이 실제 운영 완료처럼 읽히지 않는지
- live/PWA/API/mobile 설명이 서로 충돌하지 않는지
- 관리자/일반 사용자 경계가 약해지지 않는지
- 승인 게이트가 구현 TODO에 묻히지 않는지

### 테스터(gwtester)

집중할 것:

- `pnpm check`
- `pnpm --filter @gw/mobile typecheck`
- 필요 시 `pnpm --filter @gw/web build:cf`
- 문서 결론표와 실제 route/contract/build 근거가 어긋나지 않는지

### 문서화(gwdocs)

집중할 것:

- 쉬운 한국어로 되는 것 / 아직 안 되는 것 / 승인 필요 정리
- live/PWA/API/mobile 확인 포인트를 한 장의 운영 전 점검표처럼 읽히게 만들기
- 승인 항목을 기능 설명과 따로 보이게 정리하기

### 운영(gwops)

집중할 것:

- 현재 main 기준 검증 근거가 무엇인지 정리
- live 직접 확인이 막히면 어떤 대체 근거를 썼는지 분리 기록
- 승인 범위 밖 운영 행동 없이도 남길 수 있는 readiness 메모 정리

## 7. 남은 승인 게이트

계속 별도 승인으로 남는 것:

- production DB 실데이터 연결/변경
- secret 입력/교체
- DNS/custom domain/app link 확정
- 유료 리소스 생성·증액
- 외부 HR/메시징/파일 저장 실연동
- 실제 사용자 대량 초대 또는 권한 실변경
- App Store / Play Console / TestFlight / EAS 실제 사용
- push 알림, 실기기 권한 정책, 스토어 배포

## 8. 다음 작업자가 기억할 6가지

1. 이번 Phase 20의 목적은 새 기능 확장이 아니라 운영 전 오해 방지 정리다.
2. 문서 결론은 항상 "지금 확인됨 / 아직 skeleton / 승인 필요" 3분류로 모은다.
3. mobile 은 전체 readiness 의 일부이지 전체를 대신하지 않는다.
4. `/admin/*` 운영 기능과 일반 사용자 핵심 흐름을 다시 섞지 않는다.
5. live/PWA/API/mobile 검증 포인트는 따로 보되 최종 결론은 같은 언어로 맞춘다.
6. production data/secret/DNS/paid/store/external invite 는 계속 승인 게이트다.
