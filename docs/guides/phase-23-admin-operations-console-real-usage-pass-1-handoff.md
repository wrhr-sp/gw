# Phase 23 관리자 운영 콘솔 실사용 1차 handoff

한 줄 요약:
이번 Phase 23은
관리자 화면을 실제 운영 저장 단계로 여는 작업이 아니라,
운영자가 `/dashboard` 에서 시작해 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 를 어떤 순서로 보고,
무엇이 preview 이고 무엇이 승인 필요인지
쉽게 따라가게 정리하는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 확인 가능한 것:

- `/dashboard` 에 권한 기반 관리자 shortcut 구조가 있다.
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 화면이 이미 있다.
- `packages/shared/src/admin-access.ts` 에 role/permission/adminScope 기준이 모여 있다.
- `packages/shared/src/contracts.ts` 와 `apps/api/src/app.ts` 에 `/api/admin/*` 계약과 mock 응답이 있다.
- `apps/web/admin-preview-guard.ts` 와 `apps/api/test/auth-org.spec.ts` 가 관리자/감사/일반 사용자 경계를 실제 코드와 테스트로 지키고 있다.

아직 운영 완료로 보면 안 되는 것:

- 실제 사용자 초대 발송
- 실제 권한 부여/회수 저장
- 실제 사용자 비활성화 실행
- production 정책 저장
- production DB 변경
- 외부 HR/SIEM/메시징/파일 공개 연동

별도 승인 없이는 진행하지 않는 것:

- production DB 실데이터
- secret 입력/교체
- 실제 사용자 대량 초대/권한 실변경
- DNS/custom domain
- 유료 리소스 생성·증설
- 외부 연동/실감사 적재
- 개인정보 원문 처리 확대

즉 지금은
"관리자 운영 검토 흐름을 설명할 수 있는 상태"를 만드는 단계이지,
"실제 운영 설정이 이미 저장·반영되는 상태"는 아닙니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) 기준 순서는 관리자 운영 검토 흐름이다.

이번 Phase 23의 기본 순서는 아래입니다.

1. `/dashboard`
2. `/admin`
3. `/admin/users`
4. `/admin/policies`
5. `/admin/audit-logs`
6. 필요 시 `/employees`, `/org`, `/boards`, `/documents` 를 다시 대조 확인

핵심은
모든 사용자가 같은 흐름을 탄다는 뜻이 아니라,
문서와 화면이 이 순서를 기준으로
"운영자는 어디서 시작하고 무엇을 차례로 검토하는지"를 같은 말로 설명하는 것입니다.

### 2) `/admin` 허브는 운영 검토 출발점이다.

이번 단계에서 `/admin` 은
설명 페이지보다
오늘 검토할 운영 체크포인트를 먼저 보여 주는 허브로 봅니다.

쉽게 말하면:

- `/admin/users` 는 사용자/권한/상태 후보 검토로 이어진다.
- `/admin/policies` 는 근태·휴가·결재·문서·게시판 정책 비교로 이어진다.
- `/admin/audit-logs` 는 운영 이력 read-only 확인으로 이어진다.
- 일반 직원 기본 흐름과 운영 변경 흐름은 계속 섞지 않는다.

### 3) `/employees` 와 `/admin/users` 는 다른 화면이다.

- `/employees` = 직원 이름, 소속, 상태를 읽는 일반 조회
- `/admin/users` = 초대/비활성화/권한 diff 후보를 저장 전 검토하는 운영 화면

즉 "같은 사람 데이터"를 보더라도
일상 조회와 운영 변경 후보 검토를 같은 화면으로 섞지 않는 것이 핵심입니다.

### 4) `/boards`·`/documents` 와 `/admin/policies` 도 역할이 다르다.

- `/boards`, `/documents` = 협업/읽기/보관 흐름
- `/admin/policies` = 게시판 visibility, 문서 공간 정책, 파일 권한 candidate 검토

특히 아래는 계속 분리해서 읽혀야 합니다.

- 게시판 작성/공지 책임과 운영 정책 변경 책임
- 문서 조회/metadata 확인과 문서 공간 권한 변경 책임
- raw storage 정보 비노출 원칙과 운영 정책 설명

### 5) 감사 화면은 "조회 전용"이라는 뜻이 흔들리면 안 된다.

`/admin/audit-logs` 는 아래를 먼저 보여 주는 화면입니다.

- 누가
- 무엇을
- 어떤 대상에 대해
- 언제
- 어떤 source 에서 확인했는지

그리고 계속 지켜야 할 뜻은 아래와 같습니다.

- masked fields 는 실제 민감값 원문이 아니다.
- company boundary 는 다른 회사 범위를 넘지 않는다는 뜻이다.
- source 는 변경이 일어난 위치 설명이지 외부 전송 완료 뜻이 아니다.
- export/download 미지원은 실제 외부 반출 기능이 아직 없다는 뜻이다.

### 6) route/API guard 재검증이 이번 Phase의 핵심이다.

이번 단계는 copy 정리만이 아니라,
아래 기준을 다음 구현 카드가 반드시 같이 보게 만드는 handoff 단계입니다.

- `packages/shared/src/admin-access.ts` 의 접근 행렬
- `apps/web/admin-preview-guard.ts` 의 익명/일반/감사/관리자 분기
- `apps/api/src/app.ts` 의 `/api/admin/*` 응답과 permission guard
- `apps/api/test/auth-org.spec.ts` 의 `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 차단/허용 검증

## 3. 대장이 가장 먼저 볼 6가지 질문

1. 관리자가 `/dashboard` 에서 운영 콘솔로 어디서 들어가는지 바로 보이는가?
2. `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서가 실제 운영 검토 흐름처럼 읽히는가?
3. `/employees` 일반 조회와 `/admin/users` 운영 검토가 서로 다른 책임으로 보이는가?
4. `/boards`·`/documents` 협업 흐름과 `/admin/policies` 운영 정책 변경 후보가 섞이지 않는가?
5. `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 권한 경계가 문서와 코드에서 같은 뜻인가?
6. production data, secret, 실제 권한 저장, 외부 연동, 유료 리소스가 여전히 승인 게이트로 남아 있는가?

이 6개 질문에 바로 답이 안 보이면
이번 단계 정리가 덜 된 상태입니다.

빠르게 눌러 볼 추천 순서:

1. `/dashboard`
2. `/admin`
3. `/admin/users`
4. `/admin/policies`
5. `/admin/audit-logs`
6. `/employees`
7. `/org`
8. `/boards`, `/documents`

이 순서대로 볼 때도 각 단계가 반드시
"지금 확인 가능 / 아직 skeleton / 승인 필요"
중 어디인지 읽혀야 합니다.

## 4. 먼저 볼 파일

### 이번 Phase 23 문서

- `docs/architecture/phase-23-admin-operations-console-real-usage-pass-1-scope.md`
- `docs/guides/phase-23-admin-operations-console-real-usage-pass-1-handoff.md`

### 루트 문서

- `ROADMAP.md`
- `TASKS.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`

### 현재 기준을 보여 주는 구현 근거

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-preview-guard.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/admin-skeleton-config.ts`
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

## 5. 권장 구현 순서

1. `/dashboard` 의 운영 CTA 와 `/admin` 허브 문장을 먼저 맞춘다.
2. `/admin` 에서 오늘 검토할 일, high-risk 권한, 승인 게이트가 한눈에 읽히게 정리한다.
3. `/admin/users` 에서 직원 조회 화면과 다른 점을 분명히 보여 준다.
4. `/admin/policies` 에서 근태·휴가·결재·게시판·문서 정책을 같은 비교 형식으로 묶는다.
5. `/admin/audit-logs` 에서 조회 필터, timeline, masked/company boundary 의미를 흔들리지 않게 맞춘다.
6. `packages/shared/src/admin-access.ts`, `apps/web/admin-preview-guard.ts`, `apps/api/src/app.ts` 와 테스트를 함께 보며 route/API guard 를 다시 확인한다.
7. `/boards`, `/documents`, `/employees`, `/org` 와의 경계 문구가 다시 흐려지지 않았는지 마지막에 점검한다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- `/dashboard` → `/admin` 진입 설명과 관리자 허브 구조 정리
- `/admin/users`, `/admin/policies`, `/admin/audit-logs` 우선순위와 copy 고도화
- admin helper/contract/API mock/test 를 최소 안전 범위로 동기화
- 파일·문서·게시판 권한과 관리자 경계를 같은 뜻으로 정리

피해야 할 것:

- 실제 초대/권한 저장/비활성화 실행
- production 정책 저장
- `/employees`, `/boards`, `/documents` 를 운영 저장 화면처럼 바꾸는 것
- 외부 연동/secret/restricted 항목을 이번 카드에 섞는 것

### 리뷰어(gwreviewer)

집중할 것:

- 운영 검토 흐름이 실제 회사 준비 관점으로 읽히는지
- `/employees` 대 `/admin/users`, `/boards`·`/documents` 대 `/admin/policies` 경계가 흐려지지 않는지
- `audit.read` 와 감사 전용 사용자 경계가 유지되는지
- raw storage 정보 비노출 원칙이 정책/감사 설명과 충돌하지 않는지

### 테스터(gwtester)

집중할 것:

- route 문구와 실제 page/helper/guard/test 가 같은지
- `pnpm check`, `pnpm --filter @gw/web build:cf`, 관련 web/api/shared test 로 경계가 유지되는지
- `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 차단/허용이 실제 검증 포인트로 반영되는지
- live fetch 가 막히면 local/build/test 근거를 대체 증거로 남기되 live 완료처럼 쓰지 않는지

### 문서화(gwdocs)

집중할 것:

- 관리자 운영 흐름을 쉬운 한국어로 고정
- 되는 것 / 아직 skeleton / 승인 필요 분류를 같은 언어로 정리
- 일반 조회 화면과 운영 검토 화면 경계를 문서마다 일관되게 유지
- 파일·문서·공지 권한과 관리자 경계를 과장 없이 설명

### 운영(gwops)

집중할 것:

- preview/dev-safe skeleton 범위임을 계속 분리 기록
- release gate 와 build/test 근거가 있어도 production data/secret/실권한 변경 미완료 상태를 숨기지 않기
- 최종 보고용 근거를 운영 콘솔 순서와 승인 게이트 기준으로 정리

## 7. 남은 승인 게이트

계속 별도 승인으로 남는 것:

- production DB 실데이터 입력/변경
- secret 입력/교체
- 실제 사용자 대량 초대/권한 실변경
- production 정책 저장
- 외부 HR/메시징/SIEM 연동
- 파일 공개 다운로드/외부 저장 확대
- DNS/custom domain
- 유료 리소스 생성·증설

정리하면 이번 handoff 의 핵심은 하나입니다.
관리자 운영 콘솔 1차는
"운영자가 저장 버튼을 누르는 단계"가 아니라,
"운영자가 실제 회사 준비를 위해 어디서 들어와 무엇을 먼저 검토해야 하는지 고정하는 단계"입니다.
