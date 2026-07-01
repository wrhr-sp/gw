# 그룹웨어 Phase 13 관리자 콘솔 실사용 1차 범위

## 1. 한 줄 정의

Phase 13의 목표는 Phase 9~10에서 만든 `/admin/*` 후보 화면과 감사 규칙을 바탕으로, 실제 회사 운영자가 "어디서 들어가고, 무엇을 먼저 보고, 어떤 순서로 검토하는지"를 더 실사용에 가깝게 고정하는 것입니다.
이번 단계도 실제 운영 사용자/권한 저장, production DB 실데이터 변경, secret 입력은 하지 않습니다.

## 2. 왜 이번 단계가 필요한가

Phase 9~10에서 아래 기준은 이미 잡혔습니다.

- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 일반 업무 화면과 분리함
- 익명 공개 preview 에서 `/admin*` 를 `/login` 으로 돌려 공개 노출을 막음
- 로그인한 일반 사용자는 `/forbidden` 으로 차단하고, 감사 전용 사용자는 `/admin/audit-logs` 만 허용함
- admin API 와 shared contract 에 candidate/audit/masked 기준이 이미 들어 있음
- 감사 로그에는 raw `storageKey`, bucket 이름, signed URL 전문, secret 을 넣지 않는 원칙이 고정돼 있음

하지만 현재 화면은 아직 "관리자도 실제로 쓰는 흐름"보다는 "개념을 설명하는 Production-ready (실구현)" 성격이 강합니다.
지금 상태에서 부족한 점은 아래입니다.

- 관리자 진입점이 문서와 대시보드에만 약하게 연결돼 있어, 실제 운영자가 어디서 관리자 영역으로 들어갈지 더 분명하지 않음
- `/admin` 허브가 실운영 체크포인트, 오늘 검토할 일, 위험 권한, 최근 감사 이력 같은 실사용 맥락보다 설명형 카드 위주임
- `/admin/users`, `/admin/policies`, `/admin/audit-logs` 가 각각 무엇을 먼저 확인해야 하는지 한눈에 읽히는 우선순위가 더 필요함
- UI 노출 조건과 route/API guard 는 이미 분리돼 있지만, 다음 구현자가 그 경계를 깨지 않도록 구현 순서와 회귀 테스트 묶음이 더 명확해야 함

즉, 이번 단계는 "운영 실행 기능을 여는 것"이 아니라,
"운영자가 매일 확인할 관리자 콘솔 형태를 dev-safe 범위에서 먼저 굳히는 단계"입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `PRD.md`
- `SPEC.md`
- `ROADMAP.md`
- `ARCHITECTURE.md`
- `docs/product/groupware-vision-roadmap.md`
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/guides/phase-9-admin-audit-handoff.md`
- `docs/architecture/phase-10-admin-audit-pass-2-scope.md`
- `docs/guides/phase-10-admin-audit-pass-2-handoff.md`
- `docs/architecture/phase-12-dashboard-summary-scope.md`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-Production-ready (실구현)-config.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/app/forbidden/page.tsx`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`

현재 저장소 기준으로 확인되는 사실은 아래와 같습니다.

- `/dashboard` 는 이미 관리자 CTA 를 역할별로 분기할 수 있는 `getDashboardAdminShortcut(...)` 구조를 갖고 있음
- 관리자 역할(`SUPER_ADMIN`, `COMPANY_ADMIN`, `HR_ADMIN`)은 `/admin` 바로가기를, 감사 역할(`AUDITOR`)은 `/admin/audit-logs` 바로가기를 받을 수 있음
- `/admin` 허브와 하위 3개 화면은 존재하지만, 아직 정보 블록이 간단한 bullet/Production-ready (실구현) 중심임
- shared contract 에는 admin users/policies/audit-logs 의 목록/필터/candidate 응답이 이미 있음
- API mock 데이터에도 사용자 요약, 정책 diff preview, 감사 로그 filter/masked metadata 가 이미 있음
- preview guard 는 익명 → `/login`, 일반 로그인 사용자 → `/forbidden`, 감사 전용 사용자 → 감사 로그만 허용 기준을 실제 코드와 테스트로 유지함
- Phase 12 문서에서는 "관리자 진입 버튼은 권한 있는 사용자에게만 노출하고, UI 숨김만 믿지 않고 route/API guard 를 유지한다"는 결정이 이미 고정돼 있음

즉, 이번 Phase는 완전히 새 관리자 시스템을 만드는 것이 아니라,
이미 있는 admin contract/guard 를 실사용 콘솔 구조로 다시 정리하는 작업입니다.

## 4. Phase 13에서 고정하는 핵심 결정

### 결정 A. 관리자 진입점은 "권한 있는 사람에게만 보이는 운영 CTA"로 고정한다.

이번 1차에서는 관리자 진입점을 아래처럼 정리합니다.

1. 일반 사용자의 기본 탐색에는 관리자 메뉴를 섞어 넣지 않습니다.
2. 관리자 역할 사용자는 `/dashboard` 운영 요약 카드 또는 추후 공통 네비게이션의 관리자 CTA 로 `/admin` 에 들어갑니다.
3. 감사 전용 역할은 `/admin` 전체가 아니라 `/admin/audit-logs` 진입이 기본입니다.
4. UI 에서 링크를 숨겨도 route/API guard 는 그대로 유지합니다.
5. 권한 없는 사용자는 계속 `/login` 또는 `/forbidden` 으로 안전하게 차단됩니다.

쉽게 말하면, 이번 Phase에서 관리자 버튼은 "누구나 보이는 메뉴"가 아니라
"권한이 있는 운영자에게만 보이는 별도 입구"입니다.

### 결정 B. `/admin` 허브는 설명 페이지보다 "오늘 검토할 운영 콘솔"에 가깝게 바꾼다.

`/admin` 허브는 아래 4개 블록을 우선으로 둡니다.

1. 오늘 검토할 운영 체크포인트
   - 역할/권한 변경 후보
   - 정책 변경 후보
   - 최근 감사 확인 필요 항목
2. 고위험 권한/영향 범위 요약
   - `invite.manage`
   - `audit.read`
   - `board.manage`
   - `document.space.manage`
3. 바로 가기 카드
   - `/admin/users`
   - `/admin/policies`
   - `/admin/audit-logs`
4. dev-safe / approval gate 안내
   - 실제 저장 아님
   - production 변경 아님
   - 민감값 비노출 유지

즉, 허브는 "관리자 기능이 있습니다"를 설명하는 페이지가 아니라,
"오늘 무엇을 검토해야 하는지 먼저 보여 주는 시작 화면"이 되어야 합니다.

### 결정 C. `/admin/users` 는 사용자 목록보다 "운영 검토 단위"를 먼저 보여 준다.

`/admin/users` 는 아래 순서를 기본 구조로 둡니다.

1. 연결 상태 요약
   - linked / unlinked / review_required
2. 고위험 권한 노출 요약
3. 역할 변경 before/after diff
4. 상태 변경 preview
5. 감사 이벤트 preview + 변경 사유 입력 Production-ready (실구현)

이번 단계의 핵심은 "실제 저장 버튼"이 아니라,
운영자가 역할/권한/상태 변경 영향을 먼저 이해하게 만드는 것입니다.

### 결정 D. `/admin/policies` 는 정책을 도메인 카드로 나누고, 각 카드에 동일한 검토 형식을 맞춘다.

`/admin/policies` 는 최소 아래 묶음을 유지합니다.

- 근태
- 휴가
- 전자결재
- 문서/첨부
- 게시판/공지

각 카드가 공통으로 가져야 할 정보는 아래와 같습니다.

- 현재 정책 요약
- 바꾸려는 candidate 값
- before/after diff
- 필요한 capability
- 변경 사유 Production-ready (실구현)
- 감사 preview
- 마스킹/비노출 주의사항

특히 문서/첨부 정책은 아래를 계속 강조합니다.

- raw `storageKey` 비노출
- bucket 이름 비노출
- signed URL 전문 비노출
- metadata 기준 추적 유지

### 결정 E. `/admin/audit-logs` 는 조회 중심 실사용 화면으로 먼저 고정한다.

`/admin/audit-logs` 는 이번 1차에서 아래를 우선 강화합니다.

- actor / action / target / category / `createdFrom` / `createdTo` 필터
- 최근 운영 이벤트 목록 + 상세 패널 구조
- masked fields, company boundary, source 표시
- 감사 전용 사용자가 이 화면만 이용하는 경우도 이해할 수 있는 안내
- export/download/external sink 미지원 안내

이번 단계의 성공 기준은 "감사 기능이 많아 보이는 것"이 아니라,
"조회 경로와 비노출 원칙이 실사용 화면에서도 흔들리지 않는 것"입니다.

### 결정 F. 관리자 콘솔 1차는 기존 API/contract 를 최대한 재사용하고, 부족한 부분만 최소 보강한다.

우선순위는 아래와 같습니다.

1. 먼저 existing mock/contract 를 UI 에 더 잘 연결합니다.
2. 그 다음에 정말 필요한 필드만 shared contract 에 최소 보강합니다.
3. API 는 여전히 candidate/list/filter 중심 응답을 유지합니다.
4. 실제 저장, 외부 연동, production 반영으로 범위를 넓히지 않습니다.

즉, 이번 Phase의 기본 방향은 "새 관리자 백엔드를 크게 다시 짜는 것"이 아니라,
"이미 만든 guard + contract 를 운영 콘솔 UX로 정리하는 것"입니다.

## 5. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 13 범위 문서 작성
- 관리자 진입점, `/admin/*` 실사용 1차 흐름, guardrail 정리
- 다음 구현자가 바로 따라갈 파일/테스트/승인 게이트 handoff 작성
- README / ROADMAP / HANDOFF 최신 상태 반영

### 구현 준비 범위

다음 구현 카드에서 허용하는 범위는 아래입니다.

- `/dashboard` 또는 공통 탐색에서 역할별 관리자 CTA 문구/배치 보강
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` UI 정보구조 재배치
- `admin-Production-ready (실구현)-config` 의 실사용형 카드/체크리스트/주의사항 보강
- 필요 시 shared contract 의 admin summary 필드 최소 보강
- 필요 시 admin API mock 응답의 카드/요약 필드 최소 보강
- Web/API/shared/test/docs 동기화

### 이번 Phase에서 제외하는 범위

- 실제 운영 사용자 생성/비활성화/권한 저장
- production 정책 저장
- production DB migration 실행
- 실제 개인정보 원문 처리
- secret 입력/교체
- DNS/custom domain 변경
- 외부 HR/감사/SIEM 연동
- 유료 리소스 생성/증설
- 실제 메일/알림 발송
- export/download 를 통한 외부 반출

## 6. 화면별 상세 범위

### A. 관리자 진입점

이번 1차에서 먼저 맞출 요소:

- 관리자 role 사용자에게만 보이는 CTA 문구
- 감사 전용 role 사용자에게는 감사 로그 진입 CTA 우선
- 일반 사용자에게는 관리자 CTA 미노출 유지
- 숨김과 별개로 route/API guard 유지

권장 진입 위치:

- `apps/web/app/dashboard/page.tsx`
- 필요 시 `apps/web/app/dashboard/dashboard-config.ts`
- 필요 시 홈/공통 네비게이션 연계 지점

### B. `/admin`

이번 1차에서 먼저 보여줄 요소:

- 오늘 검토할 운영 체크포인트
- 영역별 바로가기 카드
- 고위험 capability 요약
- 최근 감사 확인 필요 항목 요약
- dev-safe / approval gate 안내

이번 1차에서도 하지 않을 것:

- 실제 저장 버튼 확정
- 운영 완료처럼 보이는 success 문구
- 외부 발송/배포/반영 상태 표시

### C. `/admin/users`

이번 1차에서 먼저 보여줄 요소:

- 사용자-직원 연결 상태 배지
- 역할/권한 diff 요약
- 상태 변경 preview
- 고위험 권한 노출 안내
- 감사 candidate / reason Production-ready (실구현)

이번 1차에서도 하지 않을 것:

- 실제 초대 발송
- 실제 권한 부여/회수 저장
- 실제 계정 잠금/비활성화 실행

### D. `/admin/policies`

이번 1차에서 먼저 보여줄 요소:

- 도메인별 정책 카드
- 각 카드의 현재 요약 / 후보값 / diff / capability / 감사 preview
- 문서/첨부 정책의 비노출 규칙 안내
- 게시판/공지 정책의 일반 작성 흐름 분리 안내

이번 1차에서도 하지 않을 것:

- production 정책 저장
- 실제 운영 파일 정책 실행
- 외부 보관 정책/외부 sink 연결

### E. `/admin/audit-logs`

이번 1차에서 먼저 보여줄 요소:

- 필터 바
- 최근 이벤트 목록
- 상세 패널
- masked fields / company boundary / source 표시
- export/download 미지원 안내

이번 1차에서도 하지 않을 것:

- 파일 반출
- 장기 보관 전송
- 외부 감사 시스템 연동

## 7. 구현자가 우선 확인할 파일

### Web

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-Production-ready (실구현)-config.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/app/forbidden/page.tsx`

### Shared

- `packages/shared/src/contracts.ts`

### API

- `apps/api/src/app.ts`

### Test

- `apps/web/admin-preview-guard.test.ts`
- 필요 시 `apps/web` admin 화면 snapshot/경계 테스트 추가
- 필요 시 `packages/shared/test/contracts.spec.ts`
- 필요 시 `apps/api/test/auth-org.spec.ts`

## 8. 권장 테스트 시나리오

다음 구현자는 최소 아래를 회귀로 유지하는 것이 좋습니다.

1. 익명 사용자는 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 로 직접 들어가지 못함
2. 로그인한 일반 사용자(`EMPLOYEE`, `MANAGER`)는 `/forbidden` 으로 차단됨
3. 감사 전용 사용자(`AUDITOR`)는 `/admin/audit-logs` 는 허용되지만 `/admin`, `/admin/users`, `/admin/policies` 는 차단됨
4. 관리자 역할 사용자는 `/admin` 과 관리 하위 화면 진입이 허용됨
5. 관리자 CTA 는 권한 있는 사용자에게만 렌더링됨
6. 감사 로그 응답과 정책 candidate 에 raw `storageKey`, bucket 이름, signed URL 전문, secret 이 없음
7. `createdFrom`, `createdTo`, `category` 필터가 계속 유지됨
8. candidate/audit/masked 필드가 Web/API/shared 문서와 코드에서 같은 의미를 유지함

권장 검증 명령:

- `pnpm --filter @gw/web test -- admin-preview-guard`
- `pnpm --filter @gw/web test`
- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/api test`
- `pnpm typecheck`
- `pnpm --filter @gw/web build`
- 필요 시 `pnpm --filter @gw/web build:cf`

## 9. 완료 기준

이번 Phase 13 구현 카드가 끝났다고 보기 위한 최소 기준은 아래입니다.

- 관리자 진입 CTA 와 `/admin/*` 화면이 역할별로 더 실사용에 가까운 구조로 정리됨
- 일반 사용자 기본 흐름과 관리자 운영 흐름이 UI 에서 더 분명히 분리됨
- UI 노출 조건과 route/API guard 가 서로 다른 책임으로 유지됨
- 감사 전용 사용자의 `/admin/audit-logs` 읽기 흐름이 계속 보장됨
- candidate / audit / masked / company boundary 규칙이 shared/API/Web/test 에서 어긋나지 않음
- 실제 저장/production 변경 없이도 운영자가 무엇을 검토하는 화면인지 이해할 수 있음

## 9-1. 이번 문서화에서 다시 확인한 검증 근거

부모 테스트 결과 기준으로 아래 항목을 다시 확인했습니다.

- 일반 사용자/익명 사용자는 관리자 CTA 가 기본 노출되지 않고, `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 접근이 계속 차단됩니다.
- 감사 전용 사용자는 `/admin/audit-logs` 읽기 흐름만 허용되고, 다른 관리자 화면은 계속 막힙니다.
- 관리자 역할 사용자는 관리자 허브와 하위 3개 화면 렌더링 흐름을 정상적으로 통과합니다.
- route/UI 경계뿐 아니라 shared/API 계약과 web build 까지 함께 통과해, 문서 설명이 화면/계약/테스트와 어긋나지 않는 상태입니다.

확인된 명령:

- `npx pnpm --filter @gw/web test -- admin-preview-guard admin-Production-ready (실구현)-config admin-console-pass1 dashboard-boundary org-employees-boundary api-same-origin-bridge mobile-pwa`
- `npx pnpm --filter @gw/shared test`
- `npx pnpm --filter @gw/api test -- auth-org.spec.ts`
- `npx pnpm --filter @gw/web typecheck`
- `npx pnpm --filter @gw/web build`

확인된 결과 요약:

- web 테스트 7개 파일, 27개 테스트 통과
- shared 테스트 1개 파일, 9개 테스트 통과
- api 테스트 3개 파일, 57개 테스트 통과
- web typecheck 통과
- web build 통과

주의:

- Next.js build 결과에 `/admin*` route 산출물이 보여도, 실제 공개 노출 허용을 뜻하지는 않습니다.
- 이번 단계의 차단 근거는 `apps/web/admin-preview-guard.test.ts`, `apps/web/admin-console-pass1.test.tsx`, `apps/web/dashboard-boundary.test.tsx`, `apps/web/org-employees-boundary.test.tsx`, `apps/api/test/auth-org.spec.ts` 회귀 결과를 함께 본 판단입니다.

## 10. 별도 승인 필요 사항

아래 항목은 다음 단계에서도 여전히 별도 승인 없이는 하면 안 됩니다.

1. 실제 운영 사용자/권한 변경 실행
2. production 정책 저장
3. production DB migration 실행
4. 실제 개인정보 원문 처리
5. secret 입력/교체
6. DNS/custom domain 변경
7. 외부 감사/SIEM/메신저 연동
8. 유료 리소스 생성/증설
9. export/download 기반 외부 반출

정리하면 이번 Phase 13의 핵심은 하나입니다.
관리자 콘솔의 첫 성공 기준은 "실제로 저장이 된다"가 아니라,
"권한 있는 운영자가 어디서 들어와 무엇을 먼저 검토하는지 실사용 흐름이 분명해진다" 입니다.
