# Phase 22 실제 업무 흐름 통합 1차 handoff

한 줄 요약:
이번 Phase 22는
직원이 로그인한 뒤
대시보드에서 출퇴근, 휴가, 결재, 공지/문서, 내 정보, 조직 확인까지
"오늘 실제로 무엇을 먼저 하고 어디로 이동하는지"
한 번에 따라가게 다시 묶는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 확인 가능한 것:

- `/login` 에서 placeholder 인증 범위와 역할별 첫 이동 설명이 있다.
- `/dashboard` 는 오늘 할 일, 상단 액션 우선순위, 승인 대기, 공지/문서 진입, 일반 조회 진입을 먼저 보여 주는 허브로 잡혀 있다.
- `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me`, `/org`, `/employees` route 는 각각 존재한다.
- mobile 쪽은 shared contract 와 workflow helper 로 7개 핵심 흐름을 이미 코드 기준으로 정리해 두었다.
- 상태 안내는 offline/error/empty/forbidden 4축을 유지하는 방향이 이미 있다.

아직 운영 완료로 보면 안 되는 것:

- production 실데이터 저장/반영
- 실제 대량 사용자 초대/권한 변경
- external HR/급여/메시징/파일 저장 실연동
- GPS/실태그/NFC/RFID/QR 같은 실장비 연동
- 앱스토어/외부 테스터 실배포

별도 승인 없이는 진행하지 않는 것:

- production DB 실데이터
- secret 입력/교체
- 실제 사용자 대량 초대/권한 실변경
- GPS/위치정보 실검증
- 태그 단말/NFC/RFID/QR 실장비 연결
- 외부 HR/급여/메시징/파일 저장 연동
- DNS/custom domain/app link
- 유료 리소스 증설

즉 지금은
"직원의 하루 업무 흐름을 설명할 수 있는 상태"를 만드는 단계에 가깝고,
"이미 실운영 업무가 저장·반영되는 상태"는 아닙니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) 기준 순서는 직원 하루 업무 흐름이다.

이번 Phase 22에서 기본 순서는 아래입니다.

1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/leave`
5. `/approvals`
6. `/boards`, `/documents`
7. `/me`
8. `/org`, `/employees`

핵심은
모든 사용자가 똑같은 메뉴를 누른다는 뜻이 아니라,
문서와 화면이 이 순서를 기준으로
"어디서 시작하고 무엇이 이어지는지"를 같은 말로 설명하는 것입니다.

### 2) 대시보드는 오늘 업무 허브다.

이번 단계에서 `/dashboard` 는
관리자 허브가 아니라
오늘 할 일을 먼저 정리해 주는 출발점으로 봅니다.

쉽게 말하면:

- 직원은 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 상단 액션을 먼저 따라가고, 마지막에 `/org`·`/employees` 로 회사 맥락을 다시 확인합니다.
- 승인자는 같은 허브에서 시작하되 approvals 비중이 더 크고 mobile helper 상 첫 액션도 `approvals` 를 우선합니다.
- 관리자도 일반 직원 흐름 설명과 운영 변경 설명을 섞지 않는다

### 3) Phase 21의 회사 설정 모델은 없애지 않고 이유 설명으로 재사용한다.

Phase 21이 정리한 것은
"왜 이 화면이 이렇게 보이는가"입니다.

Phase 22가 정리하는 것은
"그래서 로그인 후 무엇을 먼저 하는가"입니다.

즉 아래처럼 이어집니다.

- 회사 설정 모델 = 업무 노출 이유
- 실제 업무 흐름 = 업무 처리 순서

### 4) 상태 안내는 쉬운 말로 바꾸되 4축을 유지한다.

계속 유지할 축:

- offline
- error
- empty
- forbidden

쉽게 바꿔 말해도 아래 뜻은 유지해야 합니다.

- empty = 할 일이 없는 정상 상태
- error = 다시 확인이 필요한 실패 상태
- forbidden = 로그인은 되었지만 지금 이 업무 권한이 없는 상태
- offline = 읽기 중심 확인만 가능하고 서버 반영형 작업은 성공처럼 보이면 안 되는 상태

### 5) 공지/문서와 내 정보/조직 확인은 흐름의 뒷부분으로 읽힌다.

이번 단계에서는
출퇴근/휴가/결재가 오늘 처리할 액션 중심이라면,
공지/문서는 읽기 중심 협업 진입,
내 정보/조직/직원은 내 역할과 회사 구조를 다시 확인하는 조회 중심 흐름으로 읽히게 맞춥니다.

### 6) mobile/PWA/Web 은 같은 contract 를 보되 설명 순서를 맞춘다.

이번 Phase 22에서 mobile 비교는
새 앱 기능 확대가 아니라 아래 확인이 핵심입니다.

- shared route contract 가 같은가
- session bridge 와 base URL 정책 설명이 같은 guardrail 을 가리키는가
- 일반 사용자 첫 액션 `attendance`, 승인자 첫 액션 `approvals` 분기가 Web 설명과 충돌하지 않는가
- 협업/내 정보 흐름이 mobile에서도 같은 책임으로 읽히는가

### 7) `/admin/*` 는 계속 별도 운영 확인 포인트다.

이번 Phase의 핵심은 일반 직원 하루 흐름입니다.
따라서 `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/admin` 은
일반 업무 흐름 본문에 섞지 않고,
"운영 관리자는 따로 보는 화면"으로 계속 남깁니다.

## 3. 대장이 가장 먼저 볼 6가지 질문

1. 직원이 로그인한 뒤 무엇을 먼저 하고 어디로 이어지는지 바로 보이는가?
2. `/dashboard` 상단 액션과 실제 각 업무 화면 설명이 같은 순서를 가리키는가?
3. 출퇴근, 휴가, 결재, 공지/문서, 내 정보, 조직 확인 흐름이 서로 끊기지 않는가?
4. mobile/PWA/Web 설명이 같은 contract 와 같은 guardrail 을 가리키는가?
5. empty/error/forbidden/offline 상태가 쉬운 말로 바뀌어도 서로 다른 뜻을 유지하는가?
6. `/admin/*` 운영 화면이 일반 직원 핵심 흐름에 섞이지 않고 별도 승인/운영 확인 포인트로 남아 있는가?

이 6개 질문에 바로 답이 안 보이면
이번 단계 정리가 덜 된 상태입니다.

빠르게 눌러 볼 추천 순서:

1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/leave`
5. `/approvals`
6. `/boards`, `/documents`
7. `/me`
8. `/org`, `/employees`
9. 마지막에 필요하면 `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/admin`

이 순서대로 볼 때도 각 단계가 반드시
"지금 확인 가능 / 아직 skeleton / 승인 필요"
중 어디인지 읽혀야 합니다.

## 4. 먼저 볼 파일

### 이번 Phase 22 문서

- `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md`
- `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md`

### 루트 문서

- `ROADMAP.md`
- `TASKS.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`

### 현재 기준을 보여 주는 구현 근거

- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/boards/page.tsx`
- `apps/web/app/documents/page.tsx`
- `apps/web/app/me/page.tsx`
- `apps/web/app/org/page.tsx`
- `apps/web/app/employees/page.tsx`
- `packages/shared/src/mobile-contracts.ts`
- `apps/mobile/src/workflow.ts`
- `apps/mobile/src/session-bridge.ts`
- `apps/mobile/src/base-url.ts`

## 5. 권장 구현 순서

1. `/login` 과 `/dashboard` 의 연결 문장을 먼저 맞춘다.
2. `/dashboard` 상단 액션 우선순위와 실제 route 설명이 같은 순서를 가리키는지 맞춘다.
3. `/attendance`, `/leave`, `/approvals` 가 오늘 처리할 액션 흐름으로 자연스럽게 이어지는지 본다.
4. `/boards`, `/documents` 를 읽기 중심 협업 흐름으로, `/me`, `/org`, `/employees` 를 확인/조회 흐름으로 정리한다.
5. mobile workflow helper 와 Web 설명이 같은 뜻인지 맞춘다.
6. empty/error/forbidden/offline 상태 안내를 쉬운 사용자 언어로 정리하되 의미는 섞지 않는다.
7. `/admin/*` 운영 화면이 일반 직원 흐름에 다시 섞이지 않았는지 마지막에 점검한다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- 로그인/session placeholder 와 dashboard 허브 설명을 실제 업무 흐름 기준으로 정렬
- attendance/leave/approvals/boards/documents/me/org/employees 문구와 연결성 보강
- shared/mobile workflow helper 와 Web 설명이 같은 뜻이 되게 정리
- empty/error/forbidden/offline 상태 문구를 실제 사용자 언어로 정리

피해야 할 것:

- production 저장/실데이터 입력/실권한 변경
- `/admin/*` 를 일반 직원 흐름에 섞는 것
- external HR/GPS/실태그/스토어 배포를 이번 카드 범위에 넣는 것

### 리뷰어(gwreviewer)

집중할 것:

- 일반 직원 하루 흐름이 끊기지 않는지
- `/dashboard` 와 각 route 설명 순서가 충돌하지 않는지
- mobile/Web/PWA 설명이 같은 contract 를 가리키는지
- `/admin/*` 운영 경계가 흐려지지 않는지

### 테스터(gwtester)

집중할 것:

- route 문구와 실제 page/helper/contract 가 같은지
- `pnpm check`, `pnpm --filter @gw/mobile typecheck`, `pnpm --filter @gw/web build:cf` 기준 검증
- live fetch 가 막히면 local preview/deployment metadata 대체 근거를 남기되 live 완료처럼 쓰지 않는지
- empty/error/forbidden/offline 분류가 실제 검증 포인트로 반영됐는지

### 문서화(gwdocs)

집중할 것:

- 로그인 → 대시보드 → 핵심 업무 → 협업 → 내 정보/조직 확인 순서를 쉬운 한국어로 고정
- 되는 것 / 아직 skeleton / 승인 필요 분류를 같은 언어로 정리
- 관리자 운영 화면은 별도 확인 포인트로 남긴다는 점을 문서마다 일관되게 유지

### 운영(gwops)

집중할 것:

- preview/dev-safe skeleton 범위임을 계속 분리 기록
- release gate 와 live evidence 가 있더라도 production data/secret/실연동 미완료 상태를 숨기지 않기
- 최종 보고용 근거를 route 순서와 승인 게이트 기준으로 정리

## 7. 남은 승인 게이트

계속 별도 승인으로 남는 것:

- production DB 실데이터 입력/변경
- secret 입력/교체
- 실제 사용자 대량 초대/권한 실변경
- GPS/위치정보 실검증
- 태그 단말/NFC/RFID/QR 실장비 연결
- 외부 HR/급여/메시징/파일 저장 연동
- DNS/custom domain/app link 확정
- 유료 리소스 생성·증액
- 앱스토어/외부 테스터 실제 배포 실행

## 8. 다음 작업자가 기억할 7가지

1. 이번 Phase 22의 핵심은 실제 하루 업무 흐름 연결 정리다.
2. 기준 순서는 `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees` 다.
3. Phase 21 회사 설정 모델 설명은 각 업무 흐름의 이유 설명으로 재사용한다.
4. mobile 근거는 `packages/shared/src/mobile-contracts.ts` 와 `apps/mobile/src/workflow.ts` 를 먼저 본다.
5. empty/error/forbidden/offline 상태는 쉬운 말로 바꿔도 의미를 섞지 않는다.
6. `/admin/*` 는 계속 별도 운영 확인 포인트다.
7. production data, secret, 실연동, 외부 배포는 계속 승인 게이트다.
