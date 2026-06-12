# 관리자 PWA 설치 UX / 오프라인 / manifest 품질 개선 범위

## 1. 한 줄 정의

이번 작업의 목표는 이미 들어가 있는 관리자 host 분리와 관리자 manifest 골격 위에,
"설치 가능한 관리자 앱처럼 보이는 최소 품질"을 문서와 구현 기준으로 고정하는 것입니다.

쉽게 말하면,
관리자 PWA가 단순히 `/admin/manifest.webmanifest` 만 있는 상태를 넘어서
설치 안내, 오프라인 안내, 아이콘 기준, smoke 기준까지 한 세트로 맞추는 단계입니다.

## 2. 왜 이 후속 작업이 필요한가

현재 코드 기준으로 이미 들어가 있는 것:

- 일반 사용자 manifest 와 관리자 manifest 가 분리돼 있다.
- 관리자 host 는 `/admin/manifest.webmanifest` 를 광고할 수 있다.
- 관리자용 아이콘 파일 이름도 일반 사용자용과 분리돼 있다.
- app shell 은 host 에 따라 일반 사용자용 / 관리자용 navigation 을 나눌 수 있다.
- 오프라인 안내 문구와 online/offline status banner skeleton 이 있다.

하지만 아직 아래 gap 이 남아 있습니다.

1. 설치 안내가 아직 일반 사용자용 설명 중심이라, 관리자 앱 설치 이유와 시작점(`/admin`)이 충분히 드러나지 않는다.
2. 오프라인 안내 페이지가 현재는 공통 설명 중심이라, 관리자 host 에서 봤을 때도 관리자 작업 제약이 따로 정리돼 있지 않다.
3. manifest 품질 기준이 "경로 분리" 수준에 머물러 있어, 어떤 세부값을 계속 지켜야 하는지 문서/테스트/리뷰 기준이 더 필요하다.
4. 현재 아이콘은 placeholder SVG 기준이므로, 이번 범위에서 어디까지를 필수 품질로 보고 어디까지를 별도 브랜딩/디자인 작업으로 미루는지 구분이 필요하다.
5. local preview / Lighthouse / 수동 설치 smoke 에서 무엇을 봐야 하는지 한 문서로 잠겨 있지 않다.

즉, 이번 단계는 native 앱이나 앱스토어 전환이 아니라,
"웹앱으로 설치 가능한 관리자 도구"의 최소 신뢰도를 높이는 작업입니다.

## 3. 이번에 고정할 핵심 결정

### 결정 A. 관리자 PWA 정체성은 일반 사용자 앱과 분리된 상태를 유지한다.

반드시 유지할 것:

- 일반 사용자 manifest 경로: `/manifest.webmanifest`
- 관리자 manifest 경로: `/admin/manifest.webmanifest`
- 일반 사용자 `start_url`: `/`
- 관리자 `start_url`: `/admin`
- 일반 사용자 `scope`: `/`
- 관리자 `scope`: `/admin`
- 관리자 앱 이름은 `GW Admin` 계열을 유지한다.

즉, 관리자 앱은 "같은 코드베이스의 다른 메뉴"가 아니라,
설치 시점부터 시작점과 앱 이름이 다른 별도 웹앱 정체성으로 봅니다.

### 결정 B. 이번 범위의 manifest 필수 세부값을 문서/테스트 기준으로 고정한다.

관리자 manifest 에서 계속 지킬 최소 기준:

- `name`, `short_name`, `description`
- `start_url`, `scope`
- `display: standalone`
- `orientation: portrait-primary`
- `background_color`, `theme_color`
- `lang: ko`
- `categories`
- `icons` 에서 `any` 와 `maskable` purpose 분리

선택 검토 항목:

- `id` 필드 추가 여부
- `display_override` 필요 여부
- `shortcuts` 추가 여부
- install prompt 를 돕는 screenshot/related_applications 같은 확장 필드 여부

중요:
이번 카드에서는 확장 필드 전부를 의무로 두지 않습니다.
대신 "왜 넣는지 설명 가능한 값만" 넣고,
브라우저 호환성과 테스트 가능성이 낮은 값은 별도 후속으로 남깁니다.

### 결정 C. 아이콘 품질은 "분리 + 목적성 + smoke 가능성"까지를 이번 필수 기준으로 본다.

이번 범위의 필수:

- 일반 사용자용 / 관리자용 파일명이 분리돼 있어야 한다.
- 관리자 manifest 에는 최소 192/512, any/maskable 구성이 있어야 한다.
- 테스트가 관리자 manifest 아이콘 경로와 purpose 를 회귀 보호해야 한다.
- install 안내/문서에서 "현재는 placeholder 자산"이라는 사실을 숨기지 않는다.

이번 범위에서 아직 강제하지 않는 것:

- 최종 브랜드용 고해상도 PNG 세트 제작
- 디자이너 승인 색상 체계
- 앱스토어 제출용 asset pack

즉, 이번 단계의 목표는 "브랜딩 완성"이 아니라
"설치 품질 기준과 회귀 보호"입니다.

### 결정 D. 설치 안내 UI는 관리자 host 에서 관리자 업무 맥락을 먼저 설명해야 한다.

최소 기준:

- 관리자 host 에서는 설치 안내 첫 문장이 `/admin` 시작점을 명시한다.
- 설치 후 주 사용 화면이 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 라는 점을 드러낸다.
- 일반 사용자용 근태/휴가/결재 앱과 다른 앱이라는 점을 설명한다.
- 실제 push/background sync/native 배포가 아직 없다는 점을 숨기지 않는다.

권장 구현 위치:

- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/app/_components/mobile-app-shell.tsx`
- 필요 시 `apps/web/app/admin/page.tsx` 또는 관리자 landing 설명 컴포넌트

### 결정 E. 오프라인 안내는 "지금 가능한 일 / 안 되는 일 / 재시도"를 관리자 맥락에서도 분리해서 설명한다.

반드시 지킬 것:

- 오프라인 상태에서 성공처럼 보이는 관리자 상태 변경 UX 를 만들지 않는다.
- 관리자 host 에서는 아래 제약이 더 분명히 보여야 한다.
  - 사용자/권한 변경 저장 불가
  - 정책 candidate 저장/적용 불가
  - 감사 로그는 최신 보장 불가
- 읽기 중심 확인과 재접속 후 재시도 절차를 분리한다.

즉, 관리자 오프라인 UX 는 "무엇이 막히는지"가 핵심입니다.

### 결정 F. install prompt 자체보다 install readiness 를 이번 우선순위로 둔다.

이번 카드에서 우선하는 것:

- manifest 값 정합성
- app shell metadata 정합성
- install 안내 UI skeleton
- 아이콘 / maskable 기준
- local preview / Lighthouse / 수동 설치 smoke 기준

이번 카드에서 필수로 두지 않는 것:

- `beforeinstallprompt` 커스텀 캡처/저장
- 브라우저별 설치 버튼 강제 노출
- 푸시, background sync, offline write queue

즉, 브라우저의 기본 설치 UX 를 존중하고,
우리 쪽은 "설치 준비 상태와 안내 문구"를 먼저 고정합니다.

## 4. 포함 범위

### 문서/기획 범위

- 관리자 PWA 설치 품질 기준 문서화
- manifest 세부값 필수/선택 기준 문서화
- 아이콘/maskable 기준 문서화
- 관리자 host 설치 안내/오프라인 안내 요구사항 문서화
- Lighthouse/PWA/manual smoke 기준 문서화
- root 문서(TASKS/HANDOFF/KNOWN_ISSUES/SPEC/TEST_PLAN/QA) 정렬

### 다음 구현 카드에서 허용하는 범위

- `apps/web/app/mobile-pwa-config.ts` 설치/오프라인 config 보강
- `apps/web/app/_components/mobile-app-shell.tsx` status/install 안내 보강
- `apps/web/app/offline/page.tsx` 의 host-aware 오프라인 설명 보강
- 필요 시 관리자 landing 설명 보강
- manifest 값 보강(`id`, 설명, categories 등 안전한 범위)
- 관련 테스트(`apps/web/mobile-pwa.test.ts`) 확대
- 필요 시 local smoke 스크립트/문서 보강

### 검증 범위

최소:

- `pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- `pnpm --filter @gw/web build:cf`
- `pnpm check`

권장 추가:

- local `preview:cf` + `bash scripts/gw-admin-host-preview-smoke.sh`
- DevTools 또는 브라우저 설치 가능 여부 수동 확인
- 가능하면 Lighthouse PWA 관련 핵심 항목 수동 기록

## 5. 제외 범위

이번 카드와 다음 구현 체인에서 하지 않는 것:

- App Store / Play Store / Expo / React Native 전환
- 외부 push 알림 연동
- background sync / offline write queue 고도화
- production DB 실데이터 변경
- secret 입력/교체
- DNS/custom domain 생성·변경
- 유료 리소스 생성·증설
- 최종 브랜드 리디자인/정식 아이콘 패키지 제작

## 6. 구현자가 우선 볼 파일

코드:

- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/app/_components/mobile-app-shell.tsx`
- `apps/web/app/offline/page.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/admin/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/admin/manifest.webmanifest/route.ts`
- `apps/web/app/manifest.webmanifest/route.ts`
- `apps/web/mobile-pwa.test.ts`
- `apps/web/public/icons/*`

문서:

- `docs/architecture/admin-host-pwa-pass-1-scope.md`
- `docs/architecture/admin-host-preview-verification-extension-scope.md`
- `docs/guides/admin-host-pwa-pass-1-handoff.md`
- `docs/guides/admin-host-preview-verification-extension-handoff.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`

## 7. 다음 작업자에게 남기는 핵심 질문

1. 관리자 host 에서 install 안내를 어디까지 별도 UI 로 보여 줄지
   - 최소 카드/배너 수준인지
   - 관리자 landing 섹션까지 둘지
2. 오프라인 안내를 host-aware 로 분기할 때 공통 페이지 하나로 갈지, 관리자용 설명 블록만 추가할지
3. manifest 에 `id` 를 지금 넣을지, 브라우저별 영향 확인 뒤 별도 카드로 뺄지
4. Lighthouse/PWA 체크를 자동화까지 할지, 이번에는 manual/smoke 기준만 문서화할지
5. placeholder SVG 아이콘만으로 유지할지, PNG 자산까지 확대가 필요한지

## 8. 완료 기준

이 체인의 완료 기준은 아래입니다.

- 관리자 PWA가 일반 사용자 앱과 다른 설치 정체성을 유지한다.
- 관리자 host 에서 설치 안내가 관리자 업무 맥락을 제대로 설명한다.
- 오프라인 안내가 관리자 작업 제약을 성공처럼 포장하지 않는다.
- manifest / icons / maskable / install copy / smoke 기준이 문서와 테스트에 같이 남아 있다.
- 리뷰어와 테스터가 무엇을 확인해야 하는지 한 번에 따라갈 수 있다.
