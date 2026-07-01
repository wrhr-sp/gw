# 그룹웨어 Phase 20 운영 전 정리 1차 범위

## 1. 한 줄 정의

Phase 20의 목표는
지금까지 쌓아 온 preview/Production-ready (실구현) 결과물을
"실제 회사 운영을 바로 시작해도 된다"는 뜻으로 오해하지 않도록 다시 정리하고,
반대로 지금 바로 검토 가능한 것과 별도 승인 없이는 열 수 없는 것을
대장이 한 번에 구분할 수 있게 만드는 것입니다.

쉽게 말해 이번 단계는
새 기능을 크게 더 만드는 단계라기보다,
현재 저장소 기준에서
- 지금 확인 가능한 것
- 아직 Production-ready (실구현)/Production-ready (실구현) 인 것
- 실제 운영 전에 추가 승인·비용·권한이 필요한 것
을 같은 언어로 맞추는 단계입니다.

## 2. 왜 이번 단계가 필요한가

Phase 19까지 오면서 아래는 많이 정리됐습니다.

- Web/PWA/API/mobile 이 같은 shared contract 를 본다는 점
- 로그인, 대시보드, 출퇴근, 휴가, 결재함, 공지·문서, 내 정보 흐름
- 관리자(`/admin/*`)와 일반 업무 화면의 기본 경계
- mobile base URL resolver 와 secure storage bridge guardrail
- live/PWA/API/mobile 검증의 기본 명령과 route 포인트

하지만 아직 아래가 한눈에 보이지 않을 수 있습니다.

- 문서마다 preview/Production-ready (실구현)/운영 준비 표현이 조금씩 다르게 읽힐 수 있다.
- 어떤 화면은 "되는 것"처럼 보이지만 실제로는 Production-ready (실구현) 설명 단계일 수 있다.
- live/PWA/API/mobile 확인 포인트가 한 문서에서는 기능 목록처럼, 다른 문서에서는 운영 readiness 처럼 읽힐 수 있다.
- 관리자/일반 사용자 권한 경계가 route 설명, QA 문장, handoff 문장 사이에서 미세하게 달라질 수 있다.
- 실제 운영 전에 필요한 승인 항목이 모바일 계정 준비물, Web 배포 확인, production secret, 외부 초대 같은 서로 다른 축에 흩어져 있을 수 있다.

즉 Phase 19가
"모바일 내부 시범 운영 초안까지 읽히게 만드는 단계"였다면,
Phase 20은
"현재 저장소 전체를 실제 운영 전 점검표 관점으로 다시 정렬하는 단계"입니다.

## 3. 이번 단계에서 다시 확인한 현재 기준

확인 대상 문서/파일:

- `ROADMAP.md`
- `TASKS.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`
- `CHANGELOG.md`
- `docs/architecture/phase-19-native-mobile-internal-pilot-draft-scope.md`
- `docs/guides/phase-19-native-mobile-internal-pilot-draft-handoff.md`
- `apps/mobile/README.md`
- `apps/mobile/app.config.ts`
- `apps/mobile/src/base-url.ts`
- `apps/mobile/src/session-bridge.ts`
- `apps/mobile/src/workflow.ts`
- `packages/shared/src/mobile-contracts.ts`

현재 저장소 기준으로 확인되는 사실:

- 핵심 업무 흐름은 여전히 `/login` → `/dashboard` → `/attendance`·`/leave`·`/approvals` → `/boards`·`/documents` → `/me` 와 Web/API 대응 route 기준으로 읽힌다.
- 모바일은 `apps/mobile` Production-ready (실구현) + shared contract + typecheck 기준이며, 실제 앱스토어/실기기 배포 단계는 아니다.
- Web/PWA는 same-origin `/api/*`, manifest 상대 경로, Cloudflare build 기준을 유지한다.
- 관리자 기능은 `/admin/*` 로 분리하고, 일반 업무 화면과 책임을 섞지 않는다.
- Production-ready (실구현)/Production-ready (실구현) 은 실제 저장 완료·승인 완료·배포 완료처럼 보이면 안 된다.
- production DB 실데이터, secret, DNS/custom domain, 유료 리소스, 외부 연동, 실제 대량 사용자 초대, 실제 앱스토어/스토어 배포는 계속 별도 승인 범위다.

## 4. Phase 20에서 고정하는 핵심 결정

### 결정 A. 현재 상태는 "운영 준비 점검용 preview/Production-ready (실구현)" 으로 통일해 설명한다.

이 단계에서 중요한 것은
"이미 된다" 또는 "아예 안 된다"의 이분법이 아니라,
아래 세 문장으로 구분하는 것입니다.

1. 지금 저장소에서 바로 확인 가능한 것
   - route 구조
   - contract/typecheck/test/build 근거
   - Production-ready (실구현) 상태 안내
   - 권한/회사 scope/관리자 경계
2. 아직 Production-ready (실구현)/preview 설명 단계인 것
   - 실제 운영 저장
   - 실배포 후 사용자 반응
   - 외부 서비스 실연동
3. 별도 승인 없이는 진행하지 않는 것
   - production data/secret/DNS/paid resource
   - 외부 배포/외부 초대
   - 스토어 계정 사용/실기기 배포

즉 문서와 화면 설명은
"개발용 데모"처럼 가볍게 쓰지도 않고,
"이미 운영 가능"처럼 과장하지도 않게 맞춥니다.

### 결정 B. 확인 포인트는 Web/PWA/API/mobile 4축으로 나누되 같은 결론표로 모은다.

각 축에서 먼저 보는 것:

- Web: route 흐름, 역할별 진입, 일반 업무/관리자 분리
- PWA: manifest/install/offline/same-origin 원칙
- API: 권한, 회사 scope, Production-ready (실구현) 응답 honesty
- Mobile: base URL resolver, secure storage bridge, 7개 핵심 화면, 상태 4축

하지만 최종 결론은 축별로 따로 흩어두지 않고,
아래 3분류로 합쳐 읽게 합니다.

- 지금 확인됨
- 아직 안 열림 또는 Production-ready (실구현)
- 별도 승인 필요

### 결정 C. 운영 전 판정 질문은 "되는 것/안 되는 것/승인 필요" 중심으로 바꾼다.

Phase 20에서 대장이 먼저 볼 질문:

1. 지금 저장소에서 바로 확인 가능한 핵심 흐름이 무엇인가?
2. Production-ready (실구현)/Production-ready (실구현) 이라서 실제 운영 성공처럼 보면 안 되는 항목이 무엇인가?
3. production 운영 전에 별도 승인·계정·비용·권한이 필요한 항목이 무엇인가?
4. live/PWA/API/mobile 확인 포인트가 서로 다른 말을 하지 않는가?
5. 관리자와 일반 사용자 경계가 route/문서/검증 기준에서 같은 뜻인가?

이 질문에 바로 답이 안 나오면
이번 단계 문서 정리가 덜 된 것으로 봅니다.

### 결정 D. 모바일은 전체 운영 준비의 한 축이지 전체를 대신하지 않는다.

계속 유지할 원칙:

- `apps/mobile` 은 중요하지만 현재 저장소 전체 readiness 를 대표하지는 않는다.
- 모바일 문서가 정리돼도 Web/PWA/API/admin 경계 검토를 생략할 수 없다.
- 반대로 Web/live 검증 근거가 있어도 mobile 승인 게이트가 사라진 것은 아니다.

즉 모바일은 별도 축으로 보되,
운영 전 정리 문서에서는 전체 서비스 readiness 안에 위치를 다시 분명히 적습니다.

### 결정 E. 승인 항목은 기능 설명과 분리된 "운영 승인 목록"으로 유지한다.

반드시 따로 보여야 하는 항목:

- production DB 실데이터 연결/변경
- production secret 입력 또는 교체
- custom domain / DNS / app link 확정
- 유료 리소스 생성·증액
- 외부 HR/메시징/파일 저장 등 외부 연동
- 실제 사용자 대량 초대 또는 권한 실변경
- App Store / Play Console / TestFlight / EAS 실제 계정 사용
- push 알림 / 실기기 권한 정책 / 스토어 배포

핵심은
개발 TODO 와 운영 승인 목록을 섞지 않는 것입니다.

## 5. 역할별 기대 흐름

### 일반 직원 관점

- 지금 확인 가능한 업무 흐름과 아직 Production-ready (실구현) 인 흐름을 구분해 이해할 수 있어야 한다.
- 공지/문서/근태/휴가/결재가 어디까지 읽기·검토용인지 과장 없이 보여야 한다.

### 팀장/승인자 관점

- 일반 직원 기본 흐름 위에 승인 lane 이 어떻게 추가되는지 이해할 수 있어야 한다.
- 승인 CTA 가 누구에게만 보여야 하는지 문서/화면/계약 기준이 같아야 한다.

### 인사/운영 관리자 관점

- `/admin/*` 운영 기능과 일반 업무 기능이 섞이지 않는지 바로 판단할 수 있어야 한다.
- 실제 운영 전에 어떤 승인 항목을 별도로 처리해야 하는지 빠르게 볼 수 있어야 한다.

### 대장/최종 판단자 관점

- "지금 당장 검토 가능한 것"과 "운영 전 추가 승인 필요"를 한 번에 구분할 수 있어야 한다.
- live/PWA/API/mobile 근거가 어디에 남는지 쉽게 찾을 수 있어야 한다.

## 6. 이번 Phase에 포함되는 범위

### 문서/기획 범위

- Phase 20 범위 문서 작성
- Phase 20 쉬운 handoff 문서 작성
- 루트 문서를 Phase 20 활성 체인 기준으로 갱신
- 되는 것 / 아직 안 되는 것 / 승인 필요 항목을 같은 언어로 정리
- live/PWA/API/mobile 확인 포인트를 운영 전 점검표 관점으로 재정리
- 관리자/일반 사용자 경계 설명 재점검

### 구현 handoff 범위

- 문서와 실제 저장소 표현이 어긋나는 문구 정리 포인트 제시
- Production-ready (실구현)/Production-ready (실구현) 을 운영 완료처럼 읽히게 만드는 문구 수정 후보 정리
- README/설명 copy/route 메모/guardrail 표현에서 우선 손볼 안전 범위 제시

### 검증 범위

- `pnpm check`
- `pnpm --filter @gw/mobile typecheck`
- 필요 시 `pnpm --filter @gw/web build:cf`
- 문서/route/guardrail 정합성 재검토

## 7. 이번 Phase에 포함하지 않는 것

- production DB 실데이터 연결 또는 변경
- secret 입력/교체
- DNS/custom domain 변경
- 실제 외부 사용자 초대/권한 실변경
- 실제 앱스토어/스토어 업로드
- 실제 TestFlight/EAS/Play Console 운영 사용
- push 실연동
- 외부 HR/파일/메시징 실서비스 연동
- 유료 리소스 생성·증액
- 운영 데이터를 전제로 한 대규모 정책 확정

## 8. 성공 기준

아래가 충족되면 이번 Phase 20 기획은 성공으로 봅니다.

- 대장이 현재 저장소 기준에서 무엇이 이미 검토 가능하고 무엇이 아직 Production-ready (실구현) 인지 바로 구분할 수 있다.
- live/PWA/API/mobile 확인 포인트가 서로 다른 말을 하지 않는다.
- 관리자/일반 사용자 경계와 승인 게이트가 루트 문서와 handoff 에서 같은 뜻으로 정리된다.
- 실제 운영 전에 필요한 별도 승인 항목이 기능 설명 속에 묻히지 않는다.

## 9. 다음 작업자에게 넘길 핵심 포인트

1. 이번 단계의 목적은 새 기능 확대보다 "운영 전 오해 방지 정리"다.
2. 문구를 바꿀 때는 실제 저장/승인/배포 완료처럼 보이는 표현을 먼저 찾는다.
3. mobile 축은 중요하지만 전체 readiness 중 한 축이라는 점을 유지한다.
4. `/admin/*` 와 일반 업무 route 책임을 다시 섞지 않는다.
5. live/PWA/API/mobile 근거는 따로 확인하되 최종 표시는 같은 결론표로 모은다.
6. production data/secret/DNS/paid resource/store/external invite 는 계속 승인 게이트다.
