# 그룹웨어 Phase 12 대시보드 운영 요약 1차 범위

## 1. 한 줄 정의

Phase 12의 목표는 `/dashboard` 를 "모바일에서도 바로 읽히는 오늘 할 일 + 운영 요약 시작 화면"으로 다시 정리하고, Phase 2~11에서 만든 근태/휴가·전자결재·게시판/문서·조직/직원·관리자 Production-ready (실구현) 을 한 화면에서 안전하게 이어 주는 dev-safe 기준을 고정하는 것입니다.

이번 단계도 실제 개인정보 원문 연결, production DB 실데이터 집계, 실제 알림 발송, 운영 권한 저장은 하지 않습니다.

## 2. 왜 이번 단계가 필요한가

Phase 6에서 `/dashboard` 는 모바일 핵심 진입점 Production-ready (실구현) 로 열렸습니다.
하지만 현재 화면은 아래 수준에 머물러 있습니다.

- 세션 상태, 회사 범위, 권한/가드레일 요약을 보여 주는 안내형 카드 중심입니다.
- 출퇴근/휴가/전자결재 바로가기는 있지만, 오늘 실제로 무엇을 먼저 처리해야 하는지 우선순위가 더 분명하지 않습니다.
- 게시판/문서, 조직/직원, 관리자 경계가 대시보드 안에서 아직 충분히 연결되지 않았습니다.
- 대표/임원 또는 운영자가 기대하는 "운영 요약" 느낌의 카드 구조는 아직 약합니다.

제품 비전과 UX 기준은 이미 아래를 요구하고 있습니다.

- 홈/대시보드는 "오늘 처리할 일"이 먼저여야 합니다.
- 승인 대기, 근태/휴가 상태, 공지/문서 진입점을 한 화면에서 짧게 이해할 수 있어야 합니다.
- 작은 화면에서도 핵심 카드가 먼저 읽혀야 합니다.
- 관리자 기능은 일반 사용자 흐름과 섞지 않아야 합니다.

즉, 이번 단계는 새 업무 모듈을 여는 작업이 아니라, 이미 있는 Production-ready (실구현) 을 `/dashboard` 에서 "업무 시작 순서"대로 다시 묶는 단계입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `ROADMAP.md`
- `PRD.md`
- `SPEC.md`
- `README.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- `docs/architecture/phase-11-org-employees-scope.md`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/documents/page.tsx`
- `apps/web/app/org/page.tsx`
- `apps/web/app/employees/page.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/mobile-pwa.test.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

현재 저장소 기준으로 확인되는 사실은 아래와 같습니다.

- `/dashboard` 는 아직 세션/회사 범위/권한 안내와 quick action 위주의 Phase 6 Production-ready (실구현) 입니다.
- 기존 API에는 `/api/me`, `/api/attendance/records`, `/api/leave/balances`, `/api/leave/requests`, `/api/approvals/inbox`, `/api/notices`, `/api/documents/spaces` 같은 읽기용 시작점이 이미 있습니다.
- `/org`, `/employees` 는 일반 조회용 Production-ready (실구현) 으로 정리돼 있고, `/admin/*` 는 운영 변경 후보/감사 조회용 경계가 따로 있습니다.
- `packages/shared/src/contracts.ts` 에는 현재 대시보드 전용 summary contract 는 없지만, 대시보드가 조합해 쓸 route 와 section 정의는 이미 있습니다.
- 모바일/PWA 기준 문서는 같은 route 구조를 유지하면서 작은 화면 우선 카드 배치를 요구합니다.
- 관리자 preview guard 테스트는 `/admin*` 를 익명 공개 preview 에서 계속 `/login` 으로 막아야 한다는 기준을 유지합니다.

### 부모 테스트 결과로 다시 확인된 검증 상태

이번 문서는 부모 테스트 카드의 실제 재검증 결과도 반영했습니다.

- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/shared typecheck`
- `pnpm --filter @gw/api test`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/web test`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`

위 7개 검증이 모두 통과했고, 세부적으로는 아래가 다시 확인됐습니다.

- shared 테스트 9건, api 테스트 57건, web 테스트 23건이 모두 통과했습니다.
- Next build 기준으로 `/dashboard`, `/admin`, `/admin/audit-logs`, `/forbidden` 등 주요 route 가 정상적으로 빌드됐습니다.
- `apps/web/dashboard-boundary.test.tsx` 기준으로 `/dashboard` 가 오늘 할 일 → 승인/대기 → 근태/휴가 → 공지/문서 → 운영 요약 순서를 유지하고, 일반 사용자 기본 화면에서는 관리자 CTA 를 노출하지 않는 기준이 잠겨 있습니다.
- `apps/web/admin-preview-guard.test.ts` 기준으로 익명 사용자는 `/login` 으로, 일반 로그인 사용자는 `/forbidden` 으로, 권한 있는 관리자/감사 역할은 허용 경로로 분기되는 guard 기준이 유지됩니다.
- `apps/web/app/forbidden/page.tsx` 는 권한 없는 사용자가 관리자 화면으로 들어가려 할 때 안전한 복귀 경로를 안내합니다.

반대로 아직 이번 검증에 포함되지 않은 범위도 분명합니다.

- 실제 production DB 실데이터 정확성
- 실제 개인정보 원문 연결
- 실제 외부 알림 발송
- 실제 운영 권한 저장/변경
- 실운영 인증 인프라와 연결된 관리자 권한 판정

즉, 지금 확인된 것은 "dev-safe Production-ready (실구현) 과 권한 경계가 현재 코드 기준으로 일관되게 맞아 있다"는 점이지, 실운영 데이터 연동이 끝났다는 뜻은 아닙니다.

## 4. Phase 12에서 고정하는 핵심 결정

### 결정 A. `/dashboard` 는 정보 창고가 아니라 "오늘 할 일" 시작 화면이다.

이번 Phase에서 `/dashboard` 는 아래 순서를 기본 우선순위로 둡니다.

1. 지금 바로 처리할 액션
2. 승인/대기/예외 상태
3. 최근 상태 요약
4. 자주 가는 업무 진입점
5. 운영/안내 요약

즉, 모든 데이터를 다 펼치는 화면이 아니라, 다음 행동을 가장 빨리 고르게 하는 화면으로 맞춥니다.

### 결정 B. 첫 1차 카드 묶음은 5개로 고정한다.

이번 1차에서 `/dashboard` 가 먼저 가져야 할 카드 묶음은 아래 5개입니다.

1. 오늘 할 일
   - 출근/퇴근
   - 휴가 신청
   - 승인함 확인
2. 승인/대기 요약
   - 내 승인 대기
   - 팀/결재 대기
   - 보완/반려 확인 필요 건
3. 근태/휴가 상태
   - 오늘 근태 상태
   - 마지막 기록
   - 휴가 잔여/대기 상태
4. 공지/문서 진입점
   - 새 공지/읽을 게시판
   - 최근 문서 공간 또는 문서함 진입점
5. 운영 요약
   - 조직/직원 조회 진입점
   - 관리자에게만 보이는 운영 검토 진입점
   - Production-ready (실구현)/preview 한계 안내

쉽게 말하면 이번 대시보드는 "오늘 일 + 대기 업무 + 읽어야 할 것 + 운영 들어가는 문"을 한 화면에서 짧게 정리하는 구조입니다.

### 결정 C. 관리자 진입 버튼은 권한 있는 사용자에게만 노출한다.

대장 요청사항을 반영해 이번 Phase에서는 아래 경계를 문서로 고정합니다.

- 일반 사용자에게는 관리자 진입 버튼을 기본 노출하지 않습니다.
- 관리자 역할/권한으로 지정된 사용자에게만 `/admin` 또는 관련 운영 요약 CTA 를 보여 줍니다.
- 버튼을 숨기는 UI 처리만 믿지 않고, `/admin/*` route 와 `/api/admin/*` 권한 guard 는 그대로 유지합니다.
- 권한 없는 사용자는 관리자 화면에 들어가도 redirect/403/404 등 안전한 차단이 유지돼야 합니다.

즉, 대시보드가 관리자 메뉴의 우회 입구처럼 보이면 안 됩니다.

### 결정 D. 기존 Phase의 읽기 계약을 먼저 재사용하고, 대시보드 전용 계약은 최소 범위만 추가한다.

권장 우선순위는 아래와 같습니다.

1. 먼저 기존 route를 재사용합니다.
   - `/api/me`
   - `/api/attendance/records`
   - `/api/leave/balances`
   - `/api/leave/requests`
   - `/api/approvals/inbox`
   - `/api/notices`
   - `/api/documents/spaces`
2. 그 다음에도 중복 조합이 너무 많을 때만 대시보드 전용 summary contract 또는 helper 를 최소 범위로 추가합니다.
3. 새 계약을 추가하더라도 읽기 전용 summary/candidate 수준으로 끝냅니다.

즉, 이번 Phase의 기본 방향은 "새 백엔드 제품을 또 만드는 것"이 아니라 "기존 Production-ready (실구현) 들을 대시보드용 카드로 재배치하는 것"입니다.

### 결정 E. 모바일에서는 표보다 카드 우선, 긴 설명보다 한 줄 상태 우선이다.

작은 화면에서는 아래를 우선합니다.

- 카드 제목
- 현재 상태 한 줄
- 바로가기 CTA 1개 또는 2개
- 왜 Production-ready (실구현) 인지 알려 주는 짧은 보조 문구

작은 화면에서 뒤로 미루는 것은 아래입니다.

- 긴 표 전체 노출
- 관리자용 상세 필터 묶음
- 공지/문서/결재 전체 목록의 장문 미리보기
- 실제 운영 통계처럼 보이는 과한 숫자 블록

### 결정 F. dev-safe Production-ready (실구현) 의 완료 기준은 "운영처럼 보이되 운영 완료를 속이지 않는 상태"다.

이번 Phase의 대시보드는 아래를 만족해야 합니다.

- 오늘 처리할 업무의 우선순위를 일반 사용자가 바로 이해할 수 있음
- 결재/근태/휴가/공지/문서 진입점이 서로 끊기지 않음
- 관리자 진입은 권한 있는 사람에게만 보임
- 실제 개인정보/실운영 통계/외부 알림 없이도 운영 요약 느낌을 설명할 수 있음
- Production-ready (실구현)/preview 단계라는 사실이 문구와 CTA 에서 계속 드러남

## 5. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 12 범위 문서 작성
- `/dashboard` 카드 구조와 권한 경계 재정리
- 다음 구현자가 바로 읽을 수 있는 handoff 문서 작성
- README와 ROADMAP에 Phase 12 문서 링크 반영

### 구현 준비 범위

다음 구현 카드에서 허용하는 범위는 아래입니다.

- `/dashboard` 카드/섹션 구조를 오늘 할 일 중심으로 재배치
- 출퇴근/휴가/전자결재/공지/문서/조직/직원 진입점 문구 보강
- 관리자 전용 운영 진입 CTA 조건부 노출
- 필요 시 shared contract 에 dashboard card/summary schema 최소 추가
- 필요 시 API helper 또는 read-only summary 응답 최소 추가
- Web/API/shared/test/docs 동기화

### 이번 Phase에서 제외하는 범위

- 실제 개인정보 원문 연결/반입
- production DB 집계 쿼리 또는 실데이터 통계 연결
- 실제 알림 발송, 푸시, 메일, 외부 메신저 연동
- 실제 관리자 권한 저장/변경 실행
- 실제 결재/근태/휴가 상태 변경 자동 처리
- production DB migration 실행
- 외부 HR/급여/노무 시스템 연동
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 변경

## 6. 화면별 상세 범위

### A. `/dashboard` 상단: 오늘 할 일

이번 1차에서 먼저 보여줄 요소:

- 오늘 해야 하는 대표 액션 3개 안팎
  - 출근/퇴근
  - 휴가 신청 또는 잔여 확인
  - 승인함 확인
- 액션 옆에 현재 상태 한 줄
  - 예: 마지막 기록, 승인 대기 수, 휴가 잔여 snapshot
- Production-ready (실구현) 한계 안내
  - 실제 저장/실행 완료가 아니라 연결 기준과 우선순위를 보여 주는 단계

이번 1차에서도 하지 않을 것:

- 실제 상태 변경 실행 결과를 대시보드 자체에서 완료처럼 확정 표시
- 오프라인에서도 성공처럼 보이는 CTA
- 긴 입력 폼 직접 내장

### B. 승인/대기 요약 카드

이번 1차에서 먼저 보여줄 요소:

- 내 승인 대기 또는 내 확인 필요 건
- 팀장/결재자용 대기 카드 후보
- 보완/반려 확인 필요 상태
- `/approvals` 로 이어지는 짧은 CTA

이번 1차에서도 하지 않을 것:

- 대시보드에서 결재 상세 전체를 다 처리하는 구조
- self-approval guardrail 을 흐리게 만드는 shortcut

### C. 근태/휴가 상태 카드

이번 1차에서 먼저 보여줄 요소:

- 오늘 근태 상태
- 마지막 출퇴근 기록 또는 정정 필요 상태
- 휴가 잔여 snapshot
- 승인 대기/처리 결과 요약
- `/attendance`, `/leave` 로 이어지는 짧은 CTA

이번 1차에서도 하지 않을 것:

- 위치/GPS/기기식별 민감값 노출
- 실제 급여 반영, 정산 상태 노출
- 오프라인 성공 오해를 만드는 문구

### D. 공지/문서 진입 카드

이번 1차에서 먼저 보여줄 요소:

- 읽어야 할 공지/게시판 진입점
- 최근 문서 공간 또는 문서함 진입점
- 문서/공지의 읽기용 성격을 알리는 보조 문구

이번 1차에서도 하지 않을 것:

- 긴 본문 preview 남발
- 민감 문서 raw metadata 또는 storage 내부값 노출
- 업로드/삭제/공유 실행을 대시보드의 기본 CTA 로 승격

### E. 운영 요약 카드

이번 1차에서 먼저 보여줄 요소:

- `/org`, `/employees` 일반 조회 진입점
- 권한 있는 사용자에게만 보이는 `/admin` 진입 버튼 또는 운영 검토 카드
- 관리자/일반 사용자 경계 설명
- preview/Production-ready (실구현) 한계 안내

이번 1차에서도 하지 않을 것:

- 일반 사용자에게 관리자 버튼 기본 노출
- 관리자 통계 전체를 일반 대시보드와 섞기
- 실제 감사 로그/정책 저장/사용자 변경 실행

## 7. shared/API 계약에서 우선 맞출 것

### shared에서 우선 유지/보강할 것

- 기존 유지
  - `appRoutes`
  - `appSections`
  - 기존 attendance/leave/approvals/boards/documents/admin schema
- 보강 후보
  - dashboard 카드 summary schema
  - role-aware CTA schema
  - 운영 요약 notice schema
  - 관리자 진입 노출 조건을 설명하는 UI helper 상수

### API에서 우선 유지/보강할 것

- 기존 재사용 우선
  - `GET /api/me`
  - `GET /api/attendance/records`
  - `GET /api/leave/balances`
  - `GET /api/leave/requests`
  - `GET /api/approvals/inbox`
  - `GET /api/notices`
  - `GET /api/documents/spaces`
- 보강 후보
  - 대시보드가 여러 endpoint 결과를 한 번에 읽기 쉽게 만드는 read-only helper
  - 필요 시 최소 범위의 dashboard summary response
  - 관리자 진입 가능 여부를 설명하는 summary 필드

중요한 점:
이번 단계의 API 보강은 읽기 전용 summary 보강이지, 새로운 운영 실행 endpoint 추가가 아닙니다.

## 8. 구현자가 바로 따라갈 대상 파일

### Web

- `apps/web/app/dashboard/page.tsx`
  - 오늘 할 일 / 승인 대기 / 근태·휴가 / 공지·문서 / 운영 요약 카드 구조 강화
- 필요 시 `apps/web/app/page.tsx`
  - 홈과 대시보드의 진입점 문구 정렬
- `apps/web/app/mobile-pwa-config.ts`
  - quick action / 카드 요약 텍스트 보강
- `apps/web/app/_components/page-shell.tsx`
  - 카드/헤더/CTA 재사용 패턴 보강 검토
- 필요 시 `apps/web/app/_components/mobile-app-shell.tsx`
  - 모바일 탐색과 카드 밀도 점검
- 필요 시 `apps/web/app/admin/page.tsx`
  - 관리자 허브와의 연결 문구 일관성 확인

### Shared

- `packages/shared/src/contracts.ts`
  - dashboard summary/CTA schema 또는 helper 상수 보강
- `packages/shared/test/contracts.spec.ts`
  - route/schema/status 회귀 보강

### API

- `apps/api/src/app.ts`
  - 기존 읽기 endpoint 재사용 또는 최소 dashboard summary 응답 보강
  - `/api/admin/*` guard 와 일반 읽기 endpoint 경계 유지
- 필요 시 `apps/api/src/lib/dashboard-summary.ts`
  - 대시보드 요약 조합 helper 분리

### Test

- `apps/web/mobile-pwa.test.ts`
  - 모바일 우선 대시보드 문구/탐색 회귀 보강
- 필요 시 `apps/web/dashboard-boundary.test.tsx`
  - `/dashboard` 카드 구조와 관리자 CTA 경계 회귀 추가
- `apps/web/admin-preview-guard.test.ts`
  - 관리자 guard 동작 유지 확인
- `apps/api/test/auth-org.spec.ts`
  - 대시보드가 기대는 읽기 endpoint 권한/응답 회귀 유지
  - 필요 시 관리자 진입 가능 여부 관련 summary 필드 회귀 추가
- `packages/shared/test/contracts.spec.ts`
  - dashboard summary schema 회귀 보강

### Docs

- `README.md`
- `ROADMAP.md`
- `docs/architecture/phase-12-dashboard-summary-scope.md`
- `docs/guides/phase-12-dashboard-summary-handoff.md`

## 9. 권장 테스트 시작점

다음 구현자는 최소한 아래 회귀를 먼저 맞추는 것을 권장합니다.

1. Shared
   - `packages/shared/test/contracts.spec.ts`
2. API
   - `apps/api/test/auth-org.spec.ts`
3. Web
   - `apps/web/mobile-pwa.test.ts`
   - 필요 시 `/dashboard` 전용 boundary/render 테스트
4. Build/check
   - `pnpm --filter @gw/web build`
   - `pnpm check`

우선 확인해야 하는 시나리오는 아래입니다.

- `/dashboard` 가 오늘 할 일 → 대기 상태 → 진입점 → 운영 요약 순서를 유지함
- 모바일에서 핵심 카드가 한 화면 폭에서 읽힘
- 일반 사용자에게 관리자 버튼이 기본 노출되지 않음
- 권한 있는 관리자 사용자에게만 운영 진입 CTA 를 보여 줄 수 있음
- `/admin*` 접근 guard 와 `/api/admin/*` guard 가 기존대로 유지됨
- 근태/휴가/결재/공지/문서 링크가 기존 Phase 계약과 충돌하지 않음
- Production-ready (실구현) 문구가 실제 운영 완료처럼 보이지 않음

## 10. 완료 기준

Phase 12 1차 구현 준비가 끝났다고 보려면 아래를 만족해야 합니다.

1. `/dashboard` 카드 우선순위와 포함 블록이 문서에 분명히 적혀 있습니다.
2. 일반 사용자와 관리자 운영 진입 경계가 분리돼 있습니다.
3. 기존 Phase 2~11 계약을 우선 재사용한다는 원칙이 적혀 있습니다.
4. Web/API/shared/test/docs 대상 파일이 구체적으로 적혀 있습니다.
5. 모바일/PWA 작은 화면 기준이 적혀 있습니다.
6. 실제 개인정보/운영 데이터/알림/권한 저장이 제외 범위로 분리돼 있습니다.
7. 다음 구현자가 바로 시작할 수 있는 테스트 시작점이 적혀 있습니다.

## 11. 다음 작업자 handoff

다음 구현자는 아래 순서로 이어가면 됩니다.

1. `docs/product/groupware-vision-roadmap.md`, `docs/ux/groupware-benchmark-principles.md`, 이 문서를 함께 읽고 대시보드의 우선순위 원칙을 먼저 맞춥니다.
2. `apps/web/app/dashboard/page.tsx` 에서 오늘 할 일 / 승인 대기 / 근태·휴가 / 공지·문서 / 운영 요약 카드 구조부터 보강합니다.
3. `apps/web/app/mobile-pwa-config.ts` 와 `apps/web/app/page.tsx` 를 같이 보며 홈/대시보드 메시지가 서로 다른 말을 하지 않게 맞춥니다.
4. 관리자 진입 CTA 를 넣을 때는 일반 노출을 막고, `apps/web/admin-preview-guard.test.ts` 기준 guard 와 충돌하지 않는지 확인합니다.
5. 기존 `appRoutes` 와 읽기 endpoint 로 충분한지 먼저 확인하고, 부족할 때만 `packages/shared/src/contracts.ts` 와 `apps/api/src/app.ts` 에 최소 dashboard summary 계약을 추가합니다.
6. `apps/api/test/auth-org.spec.ts`, `apps/web/mobile-pwa.test.ts`, 필요 시 dashboard 전용 web 테스트로 권한 경계와 카드 구조 회귀를 먼저 잠급니다.
7. README 와 handoff 문서까지 같이 갱신해 다음 리뷰어/구현자가 범위를 바로 이해하게 합니다.

## 12. 이번 단계에서 하지 않는 일 재강조

- 실운영 개인정보 원문 연결/반입
- 실운영 통계/KPI 집계 확정
- 실제 관리자 권한 저장/변경 실행
- 실제 알림 발송/외부 메신저/메일 연동
- production DB migration 실행
- 외부 HR/급여/노무 연동
- secret 입력/교체
- DNS/custom domain 변경
- 비용 증가 리소스 변경

정리하면 Phase 12의 핵심은 하나입니다.

"대시보드를 오늘 할 일과 운영 요약의 시작 화면으로 다시 세우되, 일반 사용자 흐름과 관리자 운영 경계를 흐리지 않고 기존 Production-ready (실구현) 을 안전하게 묶는 것"입니다.
