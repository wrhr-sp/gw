# 관리자 PWA 설치 UX / 오프라인 / manifest 품질 개선 handoff

한 줄 요약:
이번 후속 작업은 관리자 host 분리 자체를 다시 만드는 작업이 아니라,
이미 존재하는 관리자 PWA 골격을 "설치 가능한 관리자 앱처럼 보이게" 다듬는 작업입니다.

## 1. 먼저 이해해야 할 현재 상태

현재 코드 기준으로 이미 있는 것:

- 일반 사용자용 / 관리자용 manifest identity 분리
- `/manifest.webmanifest` 와 `/admin/manifest.webmanifest` 분리
- 관리자용 아이콘 파일명 분리
- host 에 따라 app shell/nav/install steps 를 바꿀 수 있는 config
- 공통 오프라인 안내 페이지와 online/offline banner skeleton
- 관리자 host route boundary 와 manifest 분기 테스트 기초

즉, 이번 작업은 "없는 기능을 처음 설계"하는 단계가 아니라,
이미 있는 초안을 실제 설치/오프라인 관점에서 더 믿을 수 있게 정리하는 단계입니다.

## 2. 구현자가 가장 먼저 볼 핵심 gap

### gap 1. 설치 안내가 아직 관리자 앱 맥락을 충분히 말해 주지 않는다

현재 일반 설치 문구는 same-origin / relative manifest 원칙 설명에는 도움이 되지만,
관리자 입장에서 아래가 더 선명해야 합니다.

- 설치 후 시작점이 `/admin` 이라는 점
- 이 앱이 관리자 허브/사용자권한/정책/감사 로그용이라는 점
- 일반 사용자용 근태/휴가/결재 앱과 다르다는 점
- push/background sync/native 앱이 아직 아니라는 점

즉, "설치 가능"만이 아니라 "왜 설치하는지"를 관리자 관점으로 보여 줘야 합니다.

### gap 2. 오프라인 안내가 관리자 작업 제약을 따로 드러내지 않는다

현재 오프라인 안내는 공통 제약을 잘 설명하지만,
관리자 host 에서는 아래가 더 분명해야 합니다.

- 사용자/권한 변경 저장은 안 됨
- 정책 candidate 저장/적용은 안 됨
- 감사 로그는 최신성 보장이 안 됨
- 읽기 중심 확인과 재시도 절차를 분리해야 함

### gap 3. manifest 세부값의 "필수/선택" 구분이 아직 약하다

이번 체인에서는 최소한 아래를 문서와 테스트에 같이 남겨야 합니다.

필수:

- `name`, `short_name`, `description`
- `start_url`, `scope`
- `display`, `orientation`
- `background_color`, `theme_color`
- `lang`, `categories`
- `icons` 의 any/maskable 구성

선택 검토:

- `id`
- `display_override`
- `shortcuts`
- 설치 품질을 돕는 추가 필드

중요:
무조건 많이 넣는 것이 목표가 아닙니다.
브라우저별 의미를 설명하기 어려운 값은 별도 후속으로 빼도 됩니다.

### gap 4. placeholder 아이콘 상태를 숨기면 안 된다

현재 관리자 아이콘 파일 분리는 되어 있지만,
이것이 "최종 브랜딩 자산 완성"을 뜻하는 것은 아닙니다.

이번 단계에서는 아래 정도면 충분합니다.

- 일반/관리자 아이콘 파일이 섞이지 않음
- 관리자 manifest 가 192/512, any/maskable 구성을 유지함
- 테스트가 아이콘 경로/purpose 를 회귀 보호함
- 문서가 placeholder 자산 상태를 숨기지 않음

## 3. 구현 우선순위

### 1순위. mobile-pwa-config 를 관리자 설치/오프라인 기준으로 보강

우선 파일:

- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/mobile-pwa.test.ts`

꼭 맞출 것:

1. 관리자 install steps 첫 문장이 `/admin` 시작점을 설명할 것
2. 관리자 앱의 주요 사용 화면(`/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`)을 드러낼 것
3. 관리자 오프라인 제약 문구가 공통 오프라인 안내보다 더 구체적일 것
4. manifest 세부값이 테스트로 보호될 것
5. placeholder 아이콘 상태를 문서/문구가 과장하지 않을 것

### 2순위. app shell / offline page 를 host-aware copy 로 보강

우선 파일:

- `apps/web/app/_components/mobile-app-shell.tsx`
- `apps/web/app/offline/page.tsx`
- 필요 시 `apps/web/app/page.tsx`
- 필요 시 관리자 landing 관련 컴포넌트

꼭 맞출 것:

- 관리자 host 에서 online banner/install 안내가 관리자 앱 기준으로 보일 것
- 오프라인 링크는 그대로 유지하되 설명이 관리자 작업 제약을 숨기지 않을 것
- 일반 사용자용 문구와 관리자용 문구가 섞여 보이지 않을 것

### 3순위. manifest 세부값과 smoke 기준 회귀 보호

우선 파일:

- `apps/web/app/layout.tsx`
- `apps/web/app/admin/layout.tsx`
- `apps/web/app/admin/manifest.webmanifest/route.ts`
- `apps/web/app/manifest.webmanifest/route.ts`
- `apps/web/mobile-pwa.test.ts`

꼭 맞출 것:

- 일반 사용자 host 는 계속 일반 manifest identity 를 유지할 것
- 관리자 host 는 계속 관리자 manifest identity 를 유지할 것
- 필요한 세부값 추가 시 build/type/test 에서 회귀가 없을 것
- 관리자 host 에서 page metadata / manifest href / icon identity 가 같은 뜻일 것

## 4. 테스트/검증 우선순위

최소 검증:

```bash
pnpm --filter @gw/web test -- admin-host admin-preview-guard mobile-pwa
pnpm --filter @gw/web typecheck
pnpm --filter @gw/web build
pnpm --filter @gw/web build:cf
pnpm check
```

권장 추가:

```bash
set -a; . .secrets/cloudflare.env; set +a; pnpm --filter @gw/web preview:cf
bash scripts/gw-admin-host-preview-smoke.sh
```

수동으로 특히 볼 것:

- 일반 host HTML 의 manifest href
- 관리자 host HTML 의 manifest href
- `/manifest.webmanifest` 내용
- `/admin/manifest.webmanifest` 내용
- 설치 안내 배너/카드 문구
- 오프라인 안내 페이지 문구
- 관리자 host 의 `/` 와 `/admin` 진입 흐름

가능하면 남길 것:

- 브라우저에서 설치 메뉴가 보이는지 여부
- DevTools manifest 패널 기준 핵심 누락이 없는지 메모
- Lighthouse 를 썼다면 어떤 항목을 확인했는지 간단 메모

## 5. 리뷰어가 볼 포인트

1. 관리자 설치 안내가 일반 사용자 앱 설명을 재탕하지 않는가
2. 오프라인 안내가 관리자 상태 변경을 성공처럼 포장하지 않는가
3. manifest 세부값이 무의미하게 늘어나지 않고, 넣은 값마다 이유가 있는가
4. 아이콘/maskable 기준이 실제 파일/테스트와 같은가
5. same-origin, host boundary, 권한 guard 가 이 작업 때문에 흐려지지 않는가

## 6. 테스터가 볼 포인트

- 관리자 host 에서 설치 안내 copy 가 관리자 기준인지
- 관리자 host 에서 `/admin/manifest.webmanifest` 가 기대 identity 를 주는지
- 일반 host 의 `/manifest.webmanifest` 가 영향을 받지 않았는지
- 오프라인 안내에서 관리자 제약과 재시도 절차가 보이는지
- `pnpm check`, `build:cf`, 관련 web 테스트가 실제 통과하는지
- local preview smoke 에서 manifest href 와 route 경계가 유지되는지

## 7. 문서화 카드가 반영할 포인트

- `SPEC.md`: 관리자 설치 정체성, 오프라인 제약, manifest 필수값
- `TEST_PLAN.md`: install/manual/Lighthouse smoke 기준
- `QA_CHECKLIST.md`: 관리자 설치 copy, maskable/icons, offline honesty 체크
- `HANDOFF.md`: 현재 활성 체인과 남은 quality gap
- `KNOWN_ISSUES.md`: placeholder icon/native 미포함 범위 명시
- `CHANGELOG.md`: 이번 품질 개선 내용 기록

## 8. 이번 범위에서 하지 말 것

- App Store / Play Store / Expo / React Native 전환
- push 알림 / background sync / offline write queue 구현
- production secret/DNS/실데이터 변경
- 최종 브랜딩 전면 개편
- 유료 리소스 사용이 필요한 이미지/배포 체인 추가

## 9. 완료 판단 기준

다음 조건이 맞으면 이번 체인을 닫아도 됩니다.

- 관리자 PWA 설치 안내가 관리자 업무 앱 정체성을 분명히 설명한다.
- 오프라인 안내가 관리자 상태 변경 제약을 숨기지 않는다.
- 관리자 manifest 세부값과 아이콘/maskable 기준이 테스트로 보호된다.
- local preview/manual smoke 기준이 문서로 남아 있다.
- 리뷰어/테스터/문서화 카드가 같은 말을 한다.
