# Phase 13 관리자 콘솔 실사용 1차 handoff

한 줄 요약:
이번 1차는 관리자 기능을 바로 운영 반영하는 단계가 아니라, 권한 있는 운영자가 어디서 들어와 무엇을 먼저 검토하는지 `/admin/*` 흐름을 실사용에 가깝게 다시 정리하는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 것:

- `/dashboard` 에 관리자/감사 역할별 바로가기 분기 구조가 있습니다.
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 화면이 이미 있습니다.
- 익명 사용자는 `/login`, 일반 로그인 사용자는 `/forbidden` 으로 막는 preview guard 가 있습니다.
- shared/API 에도 사용자/정책/감사 로그 candidate 구조와 masked 기준이 들어 있습니다.

아직 부족한 것:

- 관리자 허브가 실제 운영자가 매일 보는 콘솔 느낌보다는 설명형 placeholder 에 가깝습니다.
- 각 하위 화면이 "무엇을 먼저 확인해야 하는지"가 더 선명하게 보이지 않습니다.
- 진입점, 화면 구조, guard, 테스트를 다음 구현자가 한 번에 따라가도록 묶은 handoff 가 더 필요합니다.

즉, 이번 단계는 새 보안 체계를 만드는 게 아니라,
이미 있는 관리자 뼈대를 "실사용 콘솔 UX"로 정리하는 작업입니다.

## 2. 운영자가 이 Phase를 어떻게 이해하면 되는가

### 일반 사용자 관점

일반 사용자는 계속 아래 업무 화면을 기본으로 봅니다.

- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/org`
- `/employees`

관리자 메뉴는 일반 사용자 기본 흐름에 섞이지 않습니다.
버튼을 숨기는 것만으로 끝내지 않고, `/admin/*` route/API guard 도 같이 유지합니다.

### 관리자 관점

관리자 역할 사용자는 `/dashboard` 운영 요약 카드나 향후 공통 관리자 CTA 에서 `/admin` 으로 들어옵니다.
`/admin` 은 아래 3개 운영 묶음의 시작 화면으로 이해하면 됩니다.

- `/admin/users` — 사용자/직원 연결, 역할 후보, 상태 변경 preview
- `/admin/policies` — 근태/휴가/결재/문서/게시판 정책 candidate 검토
- `/admin/audit-logs` — 운영 변경 이력 조회와 마스킹 검토

### 감사 전용 사용자 관점

감사 전용 사용자는 `/admin` 전체가 아니라 `/admin/audit-logs` 읽기 흐름이 기본입니다.
이번 단계에서도 이 경계는 유지합니다.

## 3. 이번 Phase에서 고정한 핵심 결정

### 1) 관리자 진입점은 권한 기반 CTA 로 유지한다.

- 관리자 role: `/admin` 진입 CTA 노출
- 감사 role: `/admin/audit-logs` 진입 CTA 노출
- 일반 사용자: 관리자 CTA 미노출
- 익명 사용자: `/login` 으로 차단
- 로그인한 일반 사용자: `/forbidden` 으로 차단

### 2) `/admin` 허브는 "오늘 검토할 운영 콘솔"처럼 보이게 만든다.

허브에서 우선 보여줄 정보:

- 오늘 검토할 운영 체크포인트
- 고위험 권한 요약
- 사용자/정책/감사 로그 바로가기
- dev-safe / approval gate 안내

### 3) `/admin/users` 는 저장보다 검토가 먼저다.

우선순위:

- 사용자-직원 연결 상태
- 고위험 권한 노출 요약
- 역할 before/after diff
- 상태 변경 preview
- 감사 candidate / 변경 사유 placeholder

### 4) `/admin/policies` 는 도메인 카드별 공통 형식을 맞춘다.

각 카드 공통 요소:

- 현재 정책 요약
- candidate 값
- before/after diff
- 필요한 capability
- 변경 사유 placeholder
- 감사 preview
- 비노출/마스킹 주의사항

### 5) `/admin/audit-logs` 는 조회와 비노출 원칙을 먼저 굳힌다.

우선순위:

- actor / action / target / category / time filter
- 최근 이벤트 목록
- 상세 패널
- masked fields / company boundary / source 표시
- export/download 미지원 안내

## 3-1. 이번에 실제로 다시 확인한 결과

부모 테스트 카드 기준으로 아래가 다시 확인됐습니다.

- 익명 사용자는 `/admin*` 로 바로 들어가면 `/login` 으로 차단됩니다.
- 로그인한 일반 사용자는 `/forbidden` 으로 차단됩니다.
- 감사 전용 사용자는 `/admin/audit-logs` 만 허용되고 `/admin`, `/admin/users`, `/admin/policies` 는 계속 차단됩니다.
- 관리자 역할 사용자는 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 화면 렌더링이 정상입니다.
- 관리자 CTA 비노출/허용 경계, admin skeleton 구조, API 권한 경계, build/typecheck 까지 한 번에 통과했습니다.

검증 명령:

- `npx pnpm --filter @gw/web test -- admin-preview-guard admin-skeleton-config admin-console-pass1 dashboard-boundary org-employees-boundary api-same-origin-bridge mobile-pwa`
- `npx pnpm --filter @gw/shared test`
- `npx pnpm --filter @gw/api test -- auth-org.spec.ts`
- `npx pnpm --filter @gw/web typecheck`
- `npx pnpm --filter @gw/web build`

짧게 해석하면:

- 버튼 숨김만 맞춘 상태가 아니라 route/API guard 와 build 까지 같이 맞는 상태입니다.
- 다만 이것이 실제 운영 권한 저장이나 production 반영까지 열렸다는 뜻은 아닙니다.

## 4. 다음 구현자가 가장 먼저 볼 파일

### Web

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/dashboard-config.ts`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-skeleton-config.ts`
- `apps/web/admin-preview-guard.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/app/forbidden/page.tsx`

### Shared

- `packages/shared/src/contracts.ts`

### API

- `apps/api/src/app.ts`

## 5. 구현 순서 권장안

1. `docs/architecture/phase-13-admin-console-pass-1-scope.md` 와 이 handoff 문서를 먼저 읽습니다.
2. `apps/web/app/dashboard/dashboard-config.ts` 에서 역할별 관리자 CTA 문구와 목적을 먼저 고정합니다.
3. `apps/web/admin-skeleton-config.ts` 를 중심으로 허브/사용자/정책/감사 로그 화면에 공통으로 쓸 카드 문구와 체크포인트를 정리합니다.
4. `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 의 정보 블록 순서를 실사용 우선순위로 재배치합니다.
5. shared/API 쪽에서 화면이 필요로 하는 최소 필드만 보강합니다. 큰 새 저장 로직은 만들지 않습니다.
6. `apps/web/admin-preview-guard.test.ts` 와 관련 API/shared 테스트로 권한 경계와 masked 규칙을 회귀로 고정합니다.
7. README/테스트 근거/PR 설명에 이번 단계가 "실제 저장"이 아니라 "운영 검토 콘솔 고도화"임을 분명히 남깁니다.

## 6. 꼭 지켜야 할 guardrail

### 권한 경계

- UI 숨김으로 끝내지 않습니다.
- `/admin/*` route guard 유지
- `/api/admin/*` capability guard 유지
- 감사 전용 사용자의 읽기 허용 범위 유지
- 일반 사용자 기본 흐름과 운영 변경 흐름 분리 유지

### 민감값 비노출

아래 값은 계속 응답/로그/문서에 넣지 않습니다.

- raw `storageKey`
- bucket 이름
- signed URL 전문
- secret/token/password 전문
- 운영 파일 경로 전문
- 개인정보 원문 덤프

### 회사 경계

- cross-company 관리 액션/조회는 candidate 단계에서도 허용하지 않습니다.
- `companyBoundary` 근거를 계속 유지합니다.

## 7. 권장 테스트 포인트

최소 회귀:

1. 익명 사용자는 `/admin*` 로 직접 못 들어감
2. 일반 로그인 사용자는 `/forbidden` 으로 막힘
3. 감사 전용 사용자는 `/admin/audit-logs` 만 허용됨
4. 관리자 role 사용자는 관리자 허브/하위 화면 진입 가능
5. 관리자 CTA 는 권한 있는 role 에게만 보임
6. 감사 로그/정책 candidate 에 raw `storageKey`, bucket, signed URL 전문, secret 이 없음
7. `createdFrom`, `createdTo`, `category` 필터가 유지됨
8. candidate / audit / masked / company boundary 의미가 Web/API/shared 에서 서로 같음

권장 명령:

- `pnpm --filter @gw/web test -- admin-preview-guard`
- `pnpm --filter @gw/web test`
- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/api test`
- `pnpm typecheck`
- `pnpm --filter @gw/web build`
- 필요 시 `pnpm --filter @gw/web build:cf`

## 8. 이번 단계에서 하지 말아야 할 것

- 실제 초대 발송
- 실제 권한 부여/회수 저장
- 실제 사용자 비활성화 실행
- production 정책 저장
- production DB migration 실행
- 실제 개인정보 원문 처리
- secret 입력/교체
- DNS/custom domain 변경
- 외부 감사/SIEM/메신저 연동
- 유료 리소스 생성/증설
- export/download 기반 외부 반출

## 9. 구현 완료로 볼 최소 기준

- 관리자 진입점이 역할별로 더 자연스럽고 분명해짐
- `/admin` 허브가 설명 페이지보다 운영 체크포인트 중심 화면이 됨
- `/admin/users`, `/admin/policies`, `/admin/audit-logs` 가 각각 무엇을 먼저 검토하는지 한눈에 읽힘
- UI 노출 조건과 route/API guard 가 서로 다른 책임으로 유지됨
- 감사 전용 사용자 흐름이 깨지지 않음
- masked / candidate / company boundary 기준이 문서와 코드에서 함께 유지됨

## 10. 별도 승인 필요 항목

아래는 여전히 별도 승인 없이는 하면 안 됩니다.

1. 실제 운영 사용자/권한 변경 실행
2. production 정책 저장
3. production DB migration 실행
4. secret 입력/교체
5. 실제 개인정보 원문 연결
6. DNS/custom domain 변경
7. 외부 감사/로그 적재/메신저 연동
8. 유료 리소스 생성·증설

정리하면 이번 handoff 의 핵심은 하나입니다.
관리자 콘솔 1차는 "운영자가 저장 버튼을 누르는 단계"가 아니라,
"운영자가 어디서 들어와 무엇을 먼저 검토해야 하는지 실사용 흐름을 고정하는 단계"입니다.
