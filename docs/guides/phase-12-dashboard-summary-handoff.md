# Phase 12 대시보드 운영 요약 1차 handoff

한 줄 요약:
Phase 12는 `/dashboard` 를 "오늘 할 일 + 승인 대기 + 근태/휴가 + 공지/문서 + 운영 진입점"을 한 번에 보여 주는 시작 화면으로 다시 정리하는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

현재 `/dashboard` 는 모바일 진입점 Production-ready (실구현) 로는 열려 있지만, 아직은 안내형 카드가 더 많고 실제 업무 우선순위가 충분히 또렷하지 않습니다.

지금 확인된 상태는 아래와 같습니다.

- 세션 상태, 회사 범위, 권한/가드레일 설명 카드가 먼저 보입니다.
- 출퇴근/휴가/전자결재 바로가기는 있지만, 오늘 무엇을 먼저 해야 하는지 더 짧게 정리되진 않았습니다.
- 게시판/문서, 조직/직원, 관리자 진입점이 대시보드 안에서 아직 한 흐름으로 엮이지 않았습니다.
- 운영 요약처럼 보이는 카드 구조는 아직 약합니다.

그래서 이번 단계는 새 기능을 대거 여는 것이 아니라,
이미 만들어 둔 Production-ready (실구현) 들을 `/dashboard` 에서 "오늘 필요한 순서"대로 다시 묶는 데 초점을 둡니다.

## 2. 이번 단계에서 꼭 기억할 카드 우선순위

### 1) 오늘 할 일

가장 먼저 보여줄 것은 아래입니다.

- 출근/퇴근
- 휴가 신청 또는 잔여 확인
- 승인함 확인

즉, 첫 카드 묶음은 "지금 바로 누를 것"이 먼저여야 합니다.

### 2) 승인/대기 요약

그 다음은 대기 업무입니다.

- 내 승인 대기
- 팀/결재 대기
- 보완/반려 확인 필요 건

즉, 대시보드가 단순 메뉴판이 아니라 병목을 줄이는 화면처럼 보여야 합니다.

### 3) 근태/휴가 상태

여기에는 아래 정도를 먼저 보여주면 됩니다.

- 오늘 근태 상태
- 마지막 기록
- 휴가 잔여 snapshot
- 승인 대기/처리 결과 요약

중요한 점:
실제 급여 반영, GPS, 기기식별, 민감값은 여기서 다루지 않습니다.

### 4) 공지/문서 진입점

여기에는 아래 정도가 적당합니다.

- 읽어야 할 공지/게시판 진입점
- 최근 문서 공간 또는 문서함 진입점
- 읽기 중심 Production-ready (실구현) 라는 안내

즉, 긴 본문을 대시보드에 다 넣기보다 "어디로 들어가면 되는지"를 짧게 보여주는 쪽이 맞습니다.

### 5) 운영 요약

여기에는 아래를 넣되 권한 경계를 분명히 해야 합니다.

- `/org`, `/employees` 일반 조회 진입점
- 관리자에게만 보이는 `/admin` 진입 CTA 또는 운영 검토 카드
- Production-ready (실구현)/preview 한계 안내

즉, 운영 요약 카드는 넣되, 관리자 화면을 일반 업무와 섞어 보이게 만들면 안 됩니다.

## 3. 이번 단계에서 꼭 기억할 권한 경계

대장 요청사항 반영 기준은 아래입니다.

- 일반 사용자에게는 관리자 페이지 진입 버튼을 기본 노출하지 않습니다.
- 관리자 역할/권한이 있는 사용자에게만 운영 진입 CTA 를 보여 줍니다.
- UI 에서 버튼을 숨기는 것만으로 끝내지 않습니다.
- `/admin/*` route guard 와 `/api/admin/*` 권한 guard 는 그대로 유지해야 합니다.
- 권한 없는 사용자는 관리자 화면에 들어가도 redirect/403/404 등 안전한 차단이 유지돼야 합니다.

쉽게 말하면,
대시보드는 관리자 메뉴를 아무에게나 보여 주는 포털이 되면 안 됩니다.

## 4. 다음 구현자가 가장 먼저 손댈 파일

### Web

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- 필요 시 `apps/web/app/page.tsx`
- `apps/web/app/mobile-pwa-config.ts`
- 필요 시 `apps/web/app/_components/page-shell.tsx`
- 필요 시 `apps/web/app/_components/mobile-app-shell.tsx`
- 필요 시 `apps/web/app/admin/page.tsx` (문구/연결 경계 확인용)

### Shared

- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`

### API

- `apps/api/src/app.ts`
- 필요 시 `apps/api/src/lib/dashboard-summary.ts`

### Test

- `apps/web/mobile-pwa.test.ts`
- 필요 시 `apps/web/dashboard-boundary.test.tsx`
- `apps/web/admin-preview-guard.test.ts`
- `apps/api/test/auth-org.spec.ts`
- `packages/shared/test/contracts.spec.ts`

## 5. 우선 고정할 route/API 흐름

다음 구현자는 아래 흐름부터 맞추면 됩니다.

- `/dashboard`
  - 오늘 할 일 카드
  - 승인/대기 요약 카드
  - 근태/휴가 상태 카드
  - 공지/문서 진입 카드
  - 운영 요약 카드
- 읽기용 API 재사용 우선
  - `GET /api/me`
  - `GET /api/attendance/records`
  - `GET /api/leave/balances`
  - `GET /api/leave/requests`
  - `GET /api/approvals/inbox`
  - `GET /api/notices`
  - `GET /api/documents/spaces`

중요한 점:
이번 단계의 기본 방향은 새 대시보드용 백엔드를 크게 만드는 것이 아니라,
이미 있는 읽기용 Production-ready (실구현) 을 카드형으로 다시 조합하는 것입니다.

필요할 때만 아래를 최소 범위로 추가하면 됩니다.

- dashboard summary schema
- role-aware CTA helper
- read-only dashboard summary helper 또는 response

## 6. 테스트에서 꼭 지켜야 할 것

다음 구현자는 아래를 최소 회귀로 잡는 것이 좋습니다.

1. `/dashboard` 가 오늘 할 일 → 대기 상태 → 진입점 → 운영 요약 순서를 유지함
2. 모바일에서도 핵심 카드가 한 화면 폭에서 읽기 쉬움
3. 일반 사용자에게 관리자 CTA 가 기본 노출되지 않음
4. 관리자 권한이 있을 때만 운영 진입 CTA 를 보여 줄 수 있음
5. `/admin*` guard 와 `/api/admin/*` guard 가 기존대로 유지됨
6. Production-ready (실구현) 문구가 실제 운영 완료처럼 보이지 않음
7. 기존 근태/휴가/결재/게시판/문서 계약과 충돌하지 않음

## 7. 이번 저장소에서 실제로 다시 확인된 것

이번 문서는 현재 `/home/wrhrgw/gw` 워크스페이스 기준으로 아래 사실을 다시 확인한 뒤 정리했습니다.

- `apps/web/app/dashboard/page.tsx` 는 현재 세션 상태, 회사 범위, 권한/가드레일, quick action 중심의 얇은 Production-ready (실구현) 입니다.
- `apps/web/app/mobile-pwa-config.ts` 는 현재 `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents` 를 모바일 기본 진입점으로 유지합니다.
- `packages/shared/src/contracts.ts` 에는 대시보드 전용 summary schema 는 아직 없지만, 대시보드가 연결할 주요 route 들은 이미 있습니다.
- `apps/api/src/app.ts` 에는 `GET /api/me`, `GET /api/attendance/records`, `GET /api/leave/balances`, `GET /api/leave/requests`, `GET /api/approvals/inbox`, `GET /api/notices`, `GET /api/documents/spaces` 가 이미 있습니다.
- `apps/web/admin-preview-guard.test.ts` 는 `/admin*` 를 익명 공개 preview 에서 계속 막아야 한다는 기준을 유지합니다.
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md` 와 `phase-11-org-employees-scope.md` 는 일반 조회 화면과 관리자 운영 화면을 섞지 말라는 기준을 이미 고정하고 있습니다.

### 이번에 테스트로 같이 확인된 상태

부모 테스트 카드에서 아래 검증이 모두 통과한 상태를 기준으로 문서를 정리했습니다.

- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/shared typecheck`
- `pnpm --filter @gw/api test`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/web test`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`

쉽게 말하면 지금은 아래가 확인된 상태입니다.

- shared 테스트 9건, api 테스트 57건, web 테스트 23건이 모두 통과했습니다.
- `/dashboard`, `/admin`, `/admin/audit-logs`, `/forbidden` 는 현재 코드 기준으로 빌드가 됩니다.
- `/dashboard` 카드 순서와 일반 사용자 기본 화면의 관리자 CTA 비노출 기준이 web 테스트로 잠겨 있습니다.
- 익명 사용자의 `/admin*` 차단, 일반 로그인 사용자의 `/forbidden` 분기, 관리자/감사 역할 허용 경계도 테스트로 유지됩니다.

하지만 아래는 아직 이번 단계의 확인 범위가 아닙니다.

- 실제 production DB 실데이터 정확성
- 실제 개인정보 원문 연결
- 실제 외부 알림 발송
- 실제 운영 권한 저장/변경
- 실운영 인증 인프라와 연결된 관리자 권한 판정

즉, 지금 문서는 "대시보드 Production-ready (실구현) 과 권한 경계가 코드/테스트 기준으로 맞아 있다"는 상태를 설명하는 것이지, 실운영 데이터 연동 완료를 뜻하지 않습니다.

## 8. 운영자가 먼저 알아둘 내용

- 이번 단계의 `/dashboard` 는 실운영 KPI 화면이 아니라 dev-safe 운영 요약 Production-ready (실구현) 입니다.
- 실제 개인정보 원문, production 통계, 외부 알림, 실제 저장 실행은 아직 붙지 않습니다.
- 관리자 진입 CTA 는 권한 있는 사용자에게만 보여 주는 쪽으로 가야 합니다.
- 일반 사용자용 대시보드와 관리자 운영 화면은 계속 분리돼 있어야 합니다.
- 모바일에서는 긴 표보다 카드형 상태 요약과 짧은 CTA 를 우선합니다.

## 9. 이번 단계에서 여전히 하면 안 되는 것

- 실운영 개인정보 원문 연결/반입
- production DB 통계/실데이터 집계 연결
- 실제 관리자 권한 저장/변경 실행
- 실제 알림 발송/외부 메신저/메일 연동
- production DB migration 실행
- 외부 HR/급여/노무 연동
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 변경

## 10. 별도 승인 필요한 항목

- 실운영 KPI/통계 집계 연결
- 실운영 관리자 권한 저장/변경
- production DB migration 실행
- 외부 알림/메일/메신저 실제 연동
- 외부 HR/급여/노무 시스템 연동
- 개인정보 추가 노출 범위 확장
- 비용이 드는 리소스 생성/증설

## 11. 다음 구현 순서 제안

다음 구현자는 아래 순서로 이어가면 가장 자연스럽습니다.

1. `docs/architecture/phase-12-dashboard-summary-scope.md` 를 먼저 읽고 카드 우선순위와 권한 경계부터 맞춥니다.
2. `apps/web/app/dashboard/page.tsx` 에서 오늘 할 일 / 승인 대기 / 근태·휴가 / 공지·문서 / 운영 요약 카드 순서를 먼저 정리합니다.
3. `apps/web/app/mobile-pwa-config.ts` 와 `apps/web/app/page.tsx` 를 같이 보며 홈/대시보드 문구가 충돌하지 않는지 맞춥니다.
4. 관리자 CTA 를 넣을 때는 일반 노출을 막고, `apps/web/admin-preview-guard.test.ts` 기준 guard 와 충돌하지 않는지 확인합니다.
5. 기존 route 로 충분한지 먼저 확인하고, 부족할 때만 `packages/shared/src/contracts.ts` 와 `apps/api/src/app.ts` 에 최소 summary 계약을 추가합니다.
6. `apps/web/mobile-pwa.test.ts`, 필요 시 dashboard 전용 web 테스트, `apps/api/test/auth-org.spec.ts`, `packages/shared/test/contracts.spec.ts` 로 회귀를 먼저 잠급니다.
7. README 와 handoff 문서까지 같이 갱신해 다음 리뷰어/구현자가 범위를 바로 이해하게 합니다.

## 12. 참고 문서

- 기준 범위 문서: `docs/architecture/phase-12-dashboard-summary-scope.md`
- 모바일/PWA 기준: `docs/architecture/phase-6-mobile-pwa-scope.md`
- 관리자 2차 범위: `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- 조직/직원 일반 화면 범위: `docs/architecture/phase-11-org-employees-scope.md`
- UX 기준: `docs/ux/groupware-benchmark-principles.md`
- 제품 비전/로드맵: `docs/product/groupware-vision-roadmap.md`

정리하면 이번 handoff 의 핵심은 하나입니다.

대시보드를 "오늘 할 일과 운영 요약의 시작 화면"으로 다시 세우되,
기존 업무 Production-ready (실구현) 과 관리자 경계를 흐리지 않는 쪽으로 다음 구현을 시작하면 됩니다.
