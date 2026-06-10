# 그룹웨어 Phase 6 모바일/PWA 1차 범위

## 1. Phase 목표

이번 Phase의 목표는 Phase 2~5에서 만든 인증/조직, 근태/휴가, 전자결재, 게시판/문서 skeleton 을 바탕으로, 모바일 화면에서 바로 써야 하는 핵심 업무 흐름을 "작은 화면 기준"으로 다시 정리하고 PWA 시작점과 오프라인 안내 구조를 고정하는 것입니다.

이번 Phase에서 맞추는 기준은 다음과 같습니다.

- 모바일 Web 기준: 작은 화면에서 navigation, spacing, 정보 우선순위, CTA 배치가 무너지지 않게 기본 레이아웃을 정리한다.
- PWA 기준: manifest, 기본 metadata, icon placeholder, 설치 문구 후보를 정리한다.
- 오프라인 기준: 완전한 offline sync 가 아니라 "지금은 무엇을 할 수 있고 무엇은 안 되는지" 안내하는 skeleton 을 만든다.
- 업무 UX 기준: 출퇴근/휴가/전자결재에서 모바일로 자주 쓰는 액션을 먼저 보여 주는 skeleton 을 만든다.
- 접근성 기준: 모바일에서 게시판/문서/전자결재 접근 경로와 터치 타깃, 대비, focus 흐름을 점검한다.
- handoff 기준: Cloudflare preview URL 준비 문서에서 정리한 상대 경로 manifest, same-origin `/api/*` 원칙을 그대로 이어받는다.

## 2. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 6 구현자가 바로 참고할 범위 문서 작성
- 모바일/PWA 1차 목표, 제외 범위, 승인 필요 항목, 완료 기준 문서화
- preview URL 준비 결과를 기준으로 manifest/API/base URL handoff 원칙 명시
- PR/CI/local 검증/release gate/최종 보고 범위를 문서에서 다시 고정

### Web / layout 범위

대상 시작점은 아래와 같습니다.

- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/boards/[boardId]/page.tsx`
- `apps/web/app/posts/[postId]/page.tsx`
- `apps/web/app/documents/page.tsx`
- 필요 시 `apps/web/app/section-page.tsx`
- 필요 시 모바일 공통 navigation/CTA section component

이번 Phase에서 포함되는 1차 화면 범위:

- 작은 화면 기준 상단 헤더/간격/카드 폭/CTA 크기 정리
- 홈 또는 대시보드에서 모바일 핵심 진입점 재배치
- 모바일에서 자주 쓰는 업무를 우선 노출하는 카드/버튼 구조 정리
- 게시판/문서/전자결재 placeholder 화면의 작은 화면 레이아웃 보정
- 모바일에서 가로 스크롤이 강제로 생기지 않게 기본 표/카드 대체 전략 정리
- hover 전용 표현 대신 touch 환경에서도 이해되는 상태 표시 정리

화면 기준:

- native app 수준 제스처, push, 생체인증, background sync 는 넣지 않는다.
- 데스크톱과 완전히 다른 IA 를 새로 만드는 것이 아니라, 현재 route 구조를 유지한 채 모바일 우선 정리부터 한다.
- 실제 운영 데이터를 완성형으로 보여주는 것이 아니라 skeleton/fetch placeholder/안내 문구 수준부터 맞춘다.
- 작은 화면에서도 "placeholder 단계"라는 사실이 흐려지지 않게 문구를 유지한다.

### PWA 범위

대상 시작점은 아래와 같습니다.

- `apps/web/public/manifest.webmanifest`
- `apps/web/app/layout.tsx`
- 필요 시 `apps/web/public/icons/*`
- 필요 시 설치 안내용 문서/가이드

이번 Phase에 포함되는 PWA 항목:

- manifest 필수 필드 재점검
- 앱 이름/short name/description/theme color/background color 검토
- icon placeholder 경로와 규격 후보 정리
- install 가능한 상태를 설명하는 기본 안내 문구 정리
- preview/production 공통으로 재사용 가능한 상대 경로 정책 유지

PWA 기준:

- `start_url` 은 `/` 기준을 유지한다.
- manifest 경로는 `"/manifest.webmanifest"` 기준을 유지한다.
- 특정 preview 도메인이나 production 도메인을 manifest 안에 하드코딩하지 않는다.
- 실제 service worker 고도화, cache 전략 최적화, push notification, background sync 는 이번 Phase에 넣지 않는다.

### 오프라인 안내 skeleton 범위

이번 Phase에 포함되는 범위:

- 오프라인 상태 또는 네트워크 불안정 상태에서 보여 줄 안내 문구 skeleton 정의
- 최소한의 offline fallback 진입점 또는 안내 컴포넌트 위치 합의
- "나중에 다시 시도", "네트워크 연결 확인", "지금 가능한 기능" 정도의 기본 분기 정의

기준:

- 실제 오프라인 write queue, sync replay, conflict resolution 은 제외한다.
- 출퇴근/결재처럼 상태 변경이 중요한 기능은 offline 상태에서 성공처럼 보이게 만들지 않는다.
- 오프라인 안내는 사용자를 안심시키는 문구보다 현재 제약을 명확히 설명하는 쪽을 우선한다.

### 모바일 출퇴근/휴가 UX skeleton 범위

대상 시작점은 아래와 같습니다.

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- 필요 시 관련 공통 component

이번 Phase에서 포함되는 범위:

- 출근/퇴근 CTA 를 작은 화면 기준으로 다시 배치
- 오늘 상태, 마지막 기록, 정정 요청 진입 위치를 모바일 우선으로 재정리
- 휴가 신청/잔여/승인 대기 카드의 정보 우선순위 정리
- 긴 표를 그대로 유지하기보다 카드형 요약 또는 접기 가능한 상세 구조 후보 정리

기준:

- 실제 GPS, 위치 인증, 기기 식별, 생체인증, 푸시 리마인더는 넣지 않는다.
- 오프라인 상태에서 출퇴근 성공처럼 보이는 UX 를 만들지 않는다.
- 민감한 위치/기기 값은 placeholder 단계에서도 저장/노출/로그 출력하지 않는다.

### 모바일 전자결재 UX skeleton 범위

대상 시작점은 아래와 같습니다.

- `apps/web/app/approvals/page.tsx`
- 필요 시 상세/기안/승인함 공통 section component

이번 Phase에서 포함되는 범위:

- 모바일에서 내 기안함/내 승인함/참조함 우선순위 재정리
- 승인/반려 CTA 의 터치 크기와 경고 문구 위치 정리
- 기안 작성 skeleton 의 필드 순서와 입력 부담 최소화 구조 정리
- 결재 문서 상세가 작은 화면에서도 핵심 상태를 먼저 보여주게 구성

기준:

- 실제 전자서명, 법적 효력, 외부 본인확인, PDF 생성/보관 고도화는 넣지 않는다.
- 버튼을 크게 만드는 것만으로 충분하지 않으며, 서버 권한 검증/self-approval guardrail 기준은 그대로 유지한다.

### 모바일 게시판/문서 접근성 점검 범위

대상 시작점은 아래와 같습니다.

- `apps/web/app/boards/page.tsx`
- `apps/web/app/boards/[boardId]/page.tsx`
- `apps/web/app/posts/[postId]/page.tsx`
- `apps/web/app/documents/page.tsx`

이번 Phase에서 포함되는 범위:

- 모바일에서 게시판 목록, 게시글 상세, 댓글 영역, 문서함 목록이 읽기 가능한지 확인
- 작은 화면에서 제목/메타데이터/CTA 우선순위가 맞는지 점검
- 접근성 기본 항목(터치 타깃, 텍스트 대비, heading 구조, focus 이동, 링크 문구) 점검
- 전자결재/게시판/문서 route 가 모바일에서 같은 origin 기준으로 잘 이어지는지 확인

기준:

- 실제 검색/정렬/무한스크롤/오프라인 읽기 고도화는 제외한다.
- attachment 다운로드, preview, 공유 링크 완성형은 이번 Phase에 넣지 않는다.

### 문서/운영/release gate 범위

아래 문서 또는 동급 문서에 Phase 6 기준을 반영합니다.

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
- `docs/architecture/cloudflare-preview-url-preparation.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
- 필요 시 `docs/workflow/groupware-kanban-automation.md`

정리할 내용:

- 로컬 검증 명령과 Cloudflare build 범위
- mobile/PWA UX 리뷰 체크포인트
- preview URL 이후에만 할 수 있는 일과 지금 단계에서 할 수 있는 일 구분
- 실제 외부 공개 URL, 운영 secret, production DB migration, 유료 리소스, DNS/도메인, App Store/Play Store 배포는 별도 승인 필요라는 점
- Singde 최종 보고와 Telegram 후속 보고 확인 기준

## 3. 이번 Phase에서 하지 않는 일

이번 Phase에서 제외하는 일은 아래와 같습니다.

- App Store / Play Store 배포
- Expo / React Native 앱 생성
- 실제 외부 공개 URL 배포
- production DB migration 실행
- 운영 데이터 반입 또는 수정
- secret 입력/교체, DNS/도메인 연결, 유료 리소스 생성
- 실제 push notification, background sync, offline queue, service worker 고도화
- 실제 결제 기능, 모바일 지갑, 생체인증, MDM 연동
- 실제 R2/D1/KV/Queue/Durable Object/Cron 운영 연결

## 4. 별도 승인 필요 사항

아래 항목은 다음 단계 후보로 남기되, 실행 전 별도 승인이 필요합니다.

1. 실제 Cloudflare preview URL 생성 및 외부 노출 범위 확대
2. `wrangler deploy` 또는 동급 외부 공개 배포
3. App Store / Play Store 제출 또는 테스트 배포
4. Expo / React Native 별도 앱 트랙 시작
5. production/staging DB migration 실행
6. production secret 입력, DNS/도메인 연결, 유료 리소스 생성
7. 실제 push/background sync/offline 저장 전략 도입
8. production 운영 데이터 반입, 실제 출퇴근/결재/게시판 데이터 연결
9. 승인된 release gate 범위를 넘어서는 merge/branch delete

## 5. 구현자가 바로 따라야 할 기준

### 파일/폴더 기준

```text
apps/
  web/
    app/
      layout.tsx
      page.tsx
      dashboard/
      attendance/
      leave/
      approvals/
      boards/
      posts/
      documents/
    public/
      manifest.webmanifest
      icons/
docs/
  architecture/
  guides/
  workflow/
```

### 기술 기준

- Phase 6 는 새 백엔드 도메인을 늘리기보다 기존 Web/PWA skeleton 의 모바일 사용성을 먼저 정리한다.
- manifest 와 앱 내부 링크는 상대 경로 정책을 유지한다.
- API 기본 경로는 same-origin `/api/*` 를 우선으로 둔다.
- 모바일 우선 레이아웃을 적용하더라도 데스크톱을 깨는 별도 분기 남발은 피한다.
- 버튼/링크/입력 요소는 touch 환경에서 오동작하지 않을 정도의 간격과 크기를 확보한다.
- 오프라인 상태에서는 성공처럼 보이는 가짜 완료 UX 를 만들지 않는다.
- 설치 안내, 오프라인 안내, placeholder 안내 문구는 과장 없이 현재 제약을 분명히 설명한다.

### 보안/접근성 기준

- 민감한 실제 비밀값, 실제 storage key, 실제 개인 위치/기기 식별 값은 로그/문서/UI placeholder 에 남기지 않는다.
- 모바일에서도 company scope 와 role/permission guardrail 은 서버 기준으로 유지한다.
- 터치 타깃, 색 대비, heading 구조, focus 순서, 링크 문구를 기본 접근성 점검 항목으로 본다.
- 모바일 화면 캡처나 보고에 실데이터/실계정/실비밀값을 포함하지 않는다.

## 6. 최소 검증 기준

이번 Phase 구현 카드가 로컬에서 확인해야 하는 최소 기준은 아래와 같습니다.

- `pnpm install` 가능
- `pnpm check` 통과
- `pnpm build` 통과
- `pnpm typecheck` 통과
- `pnpm test` 통과
- `pnpm --filter @gw/web build:cf` 통과
- `/manifest.webmanifest` 가 같은 origin 기준으로 열림
- 모바일 우선으로 손보는 화면이 build/typecheck 를 깨지 않음
- 모바일/PWA UX 보안·접근성 리뷰 메모가 남아 있음
- README/가이드/아키텍처 문서에 Phase 6 범위와 승인 필요 항목이 반영되어 있음
- preview URL handoff 기준과 API/base URL 정책이 문서와 코드에서 모순되지 않음

주의:

- 실제 외부 공개 URL 없이 가능한 범위 안에서 검증한다.
- 필요하면 브라우저 responsive mode 와 local preview 기준으로 검토하되, 실제 디바이스 설치 테스트는 별도 승인 이후로 미룬다.

## 7. 완료 기준

이번 Phase는 아래 조건을 모두 만족하면 완료로 봅니다.

1. Phase 6 범위 문서가 저장소 안에 있고 구현자가 바로 참조할 수 있다.
2. 모바일/PWA 1차 목표, 제외 범위, 승인 필요 항목, handoff 원칙이 문서로 정리되어 있다.
3. `apps/web` 의 핵심 화면이 작은 화면에서 읽기/탐색/CTA 사용이 가능한 수준으로 정리되어 있다.
4. manifest, 기본 metadata, icon placeholder, offline 안내 skeleton 이 현재 정책과 맞게 정리되어 있다.
5. 모바일 출퇴근/휴가 UX skeleton 과 모바일 전자결재 UX skeleton 이 route 기준으로 연결되어 있다.
6. 모바일에서 게시판/문서/전자결재 접근성 점검 기준이 문서와 리뷰 항목에 반영되어 있다.
7. local check/typecheck/test/build 와 Cloudflare build 검증 범위가 정리되어 있다.
8. PR 생성, CI 또는 로컬 대체 검증, merge, branch cleanup 조건이 release gate 안에서 분명하다.
9. Singde 최종 보고와 Telegram 후속 보고 확인 기준이 남아 있다.

## 8. 승인/리뷰 체크포인트

구현 전에 다시 확인할 항목:

- 모바일 핵심 navigation 을 상단/하단/카드 진입 중 어떤 방식으로 시작할지
- 출퇴근과 결재 CTA 를 홈에 둘지 각 상세 섹션 첫 화면에 둘지
- 오프라인 안내를 별도 route 로 둘지, 공통 banner/component 로 시작할지
- 게시판/문서 목록에서 표를 카드형으로 대체할 범위를 어디까지 볼지
- icon placeholder 를 빈 배열 유지로 둘지, 기본 placeholder asset 을 같이 둘지

구현 후 리뷰에서 반드시 볼 항목:

- 작은 화면에서 가로 스크롤이나 너무 작은 터치 타깃이 생기지 않는지
- 모바일 화면에서 실제 기능이 이미 완성된 것처럼 오해되는 문구가 없는지
- manifest/API/base URL 이 preview 전용 절대 경로를 하드코딩하지 않았는지
- 오프라인 안내가 실패 상태를 성공처럼 보이게 만들지 않는지
- 게시판/문서/전자결재 접근 경계와 기존 guardrail 이 모바일 UX 변경으로 흐려지지 않았는지
- 설치/오프라인/보고 과정에서 실제 비밀값이나 운영 데이터가 노출되지 않는지

## 9. 같이 봐야 할 문서

- `README.md`
- `docs/architecture/cloudflare-preview-url-preparation.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/next-cloudflare-platform-plan.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
- `docs/guides/cloudflare-first-operator-guide.md`
