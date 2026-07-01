# 그룹웨어 Phase 22 실제 업무 흐름 통합 1차 범위

## 1. 한 줄 정의

Phase 22의 목표는
직원이 로그인한 뒤
`/dashboard` 에서 시작해
`/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees`
순서로
"오늘 실제로 무엇을 하고 어디로 이동하는지"를
한 번에 따라갈 수 있게 다시 묶는 것입니다.

중요한 점은 이번 단계도
실운영 데이터 입력, 외부 공개, secret 주입, 실권한 변경을 여는 단계가 아니라,
preview/dev-safe Production-ready (실구현) 안에서
업무 흐름 연결성과 상태 안내 언어를 정리하는 단계라는 점입니다.

## 2. 왜 이번 단계가 필요한가

Phase 21에서 우리는
회사 기본 설정, 조직, 직원, 권한, 근태·휴가 정책을
"실제 회사 설정 모델"처럼 읽히게 정리했습니다.

하지만 아직 아래 질문은 더 분명히 다듬을 필요가 있습니다.

- 직원이 로그인한 뒤 무엇을 먼저 눌러야 하는가?
- 대시보드의 상단 액션과 실제 업무 화면 설명이 같은 순서를 가리키는가?
- 출퇴근, 휴가, 결재, 공지/문서, 내 정보, 조직 확인 흐름이 서로 따로 놀지 않는가?
- Web/PWA와 mobile이 같은 route contract 를 보면서도 같은 업무 흐름을 설명하는가?
- empty/error/forbidden/offline 상태가 화면마다 다른 뜻으로 풀리지 않는가?
- `/admin/*` 운영 화면이 일반 직원의 하루 업무 흐름에 섞여 들어오지 않는가?

즉 Phase 21이
"실제 회사 설정 모델 정리"였다면,
Phase 22는
"실제 하루 업무 흐름 정리"입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md`
- `docs/guides/phase-21-real-company-settings-model-pass-1-handoff.md`
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

현재 저장소 기준으로 확인되는 사실:

- `/dashboard` 는 이미 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 상단 액션과, 그 뒤 `/org`·`/employees` 조회 마무리 흐름을 설명하는 허브로 잡혀 있다.
- 로그인 페이지와 mobile session bridge 설명은 Production-ready (실구현) 인증 범위와 역할별 첫 이동을 분리해 적기 시작했다.
- attendance/leave/approvals/boards/documents/me/org/employees route 는 각각 존재하지만, "하루 흐름" 관점 설명은 문서와 화면에서 더 단단히 맞출 여지가 있다.
- mobile 쪽은 `packages/shared/src/mobile-contracts.ts` 와 `apps/mobile/src/workflow.ts` 로 로그인 → 대시보드 → 출퇴근 → 휴가 → 결재함 → 공지/문서 → 내 정보 7개 핵심 흐름을 이미 코드 helper 로 갖고 있다.
- mobile 은 일반 사용자 첫 액션을 `attendance`, 승인 lane 권한 사용자의 첫 액션을 `approvals` 로 분기한다.
- `offline`, `error`, `empty`, `forbidden` 상태 안내는 shared/mobile 계약에 있지만, Web/PWA 쪽 업무 흐름 문장과 완전히 같은 언어로 묶는 작업은 더 필요하다.
- `/admin/*` 운영 화면은 계속 별도 경계로 유지해야 하며, 일반 직원 흐름에 섞이면 안 된다.

## 4. Phase 22에서 고정하는 핵심 결정

### 결정 A. 이번 Phase의 기준 흐름은 "직원 하루 업무 순서"다.

이번 1차에서 기준이 되는 대표 흐름은 아래입니다.

1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/leave`
5. `/approvals`
6. `/boards`, `/documents`
7. `/me`
8. `/org`, `/employees`

중요한 점은
모든 사용자가 이 route 를 똑같이 실행한다는 뜻이 아니라,
문서와 화면 설명이 이 순서를 기준으로
"어디서 시작하고 어디로 이어지는지"를 이해시키는 것을 우선한다는 뜻입니다.

### 결정 B. 대시보드는 업무 흐름 허브이고, 관리자 허브가 아니다.

`/dashboard` 는 아래를 먼저 보여 줘야 합니다.

- 오늘 해야 할 일
- 바로 눌러야 할 상단 액션
- 승인 대기/병목 후보
- 공지/문서 읽기 진입
- 일반 조회 진입

반대로 아래는 계속 섞지 않습니다.

- 관리자 운영 변경 CTA를 일반 직원 기본 흐름처럼 전면 노출하는 것
- `/admin/*` 를 대시보드 기본 완료 경로처럼 설명하는 것
- 실운영 KPI/발송/실저장 완료처럼 과장하는 것

### 결정 C. Phase 21의 "회사 설정 모델"을 Phase 22의 "업무 흐름 이유"로 재사용한다.

Phase 22는 Phase 21을 버리는 단계가 아닙니다.
오히려 아래처럼 이어집니다.

- 회사 설정 모델 = 왜 이 직원에게 이런 업무가 보이는지 설명하는 기준
- 실제 업무 흐름 = 그 직원이 로그인 후 무엇을 순서대로 처리하는지 설명하는 기준

쉽게 말하면:

- Phase 21은 "왜 이렇게 보이는가"
- Phase 22는 "그래서 무엇을 먼저 하는가"

를 정리하는 단계입니다.

### 결정 D. 상태 안내는 업무 흐름 문장 안에서도 4축을 유지한다.

계속 유지할 상태 축:

- offline
- error
- empty
- forbidden

Phase 22에서는 여기에
실제 사용자 언어를 더 맞춥니다.

예:

- empty = "할 일이 없는 정상 상태"
- error = "다시 확인이 필요한 실패 상태"
- forbidden = "로그인은 되었지만 지금 이 업무 권한이 없는 상태"
- offline = "읽기 중심 확인만 가능하고 서버 반영형 작업은 성공처럼 보이면 안 되는 상태"

핵심은
정상 빈 상태와 실패 상태,
권한 부족과 정책 미허용 상태를
한 문장으로 뭉개지 않는 것입니다.

### 결정 E. 공지/문서와 내 정보/조직 확인은 "업무 마무리 확인" 흐름으로 묶는다.

이번 Phase에서
`/boards`·`/documents` 는
업무 중간에 필요한 읽기/협업 진입점으로 보고,
`/me`·`/org`·`/employees` 는
내 정보와 회사 맥락을 다시 확인하는 마무리 확인 흐름으로 둡니다.

즉 아래처럼 읽히면 됩니다.

- 출퇴근/휴가/결재 = 오늘 처리할 액션 중심
- 공지/문서 = 읽고 확인할 협업 정보 중심
- 내 정보/조직/직원 = 내 역할과 회사 구조를 다시 확인하는 조회 중심

### 결정 F. mobile/PWA 비교는 "같은 contract, 다른 껍데기" 원칙으로 본다.

Phase 22에서 mobile 비교는
새 앱 기능 추가가 아니라 아래를 확인하는 방향으로 둡니다.

- Web/PWA와 mobile이 같은 핵심 route contract 를 공유하는가
- 로그인/session 설명이 secure storage bridge 전제를 숨기지 않는가
- 일반 사용자 첫 액션과 승인자 첫 액션 분기가 Web 설명과 충돌하지 않는가
- 협업(`boards`/`documents`)과 내 정보(`me`)가 mobile에서도 같은 책임으로 읽히는가

즉 mobile은 축소판이 아니라
같은 업무 흐름을 작은 화면 우선순위로 재배열한 버전으로 봅니다.

### 결정 G. `/admin/*` 는 이번 Phase에서도 별도 확인 포인트다.

이번 Phase의 핵심은 직원 하루 흐름 통합입니다.
따라서 아래 원칙을 유지합니다.

- `/admin/users`, `/admin/policies`, `/admin/audit-logs`, `/admin` 은 일반 직원 하루 흐름에 섞지 않는다.
- 다만 Phase 21에서 정리한 회사 설정 모델과 충돌하지 않는지, 그리고 일반 직원 흐름 설명을 깨지 않는지는 계속 확인한다.
- 관리자 운영 화면은 "나중에 별도로 보는 운영 확인 포인트"로 남긴다.

## 5. 역할별 기대 흐름

### 일반 직원

- 로그인 후 오늘 할 일, 출퇴근, 휴가, 결재, 공지/문서, 내 정보, 조직 확인 흐름을 무리 없이 따라갈 수 있어야 한다.
- 정책 편집이나 관리자 운영 변경 화면이 일반 업무처럼 섞이지 않아야 한다.

### 팀장/승인자

- 기본 직원 흐름 위에 approvals 우선순위가 더 강하게 보일 수 있어야 한다.
- 승인 CTA 와 일반 읽기/조회 CTA 가 섞이지 않아야 한다.

### 인사/운영 관리자

- 일반 직원 핵심 흐름을 이해하되, 운영 변경 화면은 별도 admin 확인 포인트로 분리돼 보여야 한다.
- 회사 설정 모델 설명과 직원 실제 흐름 설명이 서로 충돌하지 않아야 한다.

### 대장/최종 판단자

- "직원이 로그인 후 무엇을 먼저 하고 무엇을 나중에 보는지"를 바로 파악할 수 있어야 한다.
- 무엇이 이미 따라가 볼 수 있고, 무엇이 아직 Production-ready (실구현) 이며, 무엇이 승인 필요인지 쉽게 구분할 수 있어야 한다.

## 6. 이번 Phase에 포함되는 범위

### 문서/기획 범위

- Phase 22 범위 문서 작성
- Phase 22 쉬운 handoff 문서 작성
- 루트 문서를 Phase 22 활성 체인 기준으로 갱신
- login → dashboard → 핵심 업무 route → 협업 → 내 정보/조직 확인 흐름을 쉬운 말로 정리
- Web/PWA/mobile 비교 기준과 상태 안내 언어를 같은 뜻으로 정리

### 다음 구현 카드에서 허용하는 범위

- 로그인/session Production-ready (실구현) 와 핵심 업무 route 연결 copy 보강
- dashboard 상단 액션과 실제 각 route 문구 정렬
- attendance/leave/approvals/boards/documents/me/org/employees 설명 연결 보강
- mobile workflow/helper 와 Web route 문장 정렬
- empty/error/forbidden/offline 상태 안내를 실제 사용자 언어로 정리
- 관련 Web/API/shared/test/docs 동기화

### 이번 Phase에 포함하지 않는 것

- production DB 실데이터 입력/변경
- secret 입력/교체
- 실제 사용자 대량 초대/권한 실변경
- external HR/급여/메시징/파일 저장 실연동
- GPS/실태그/NFC/RFID/QR 실장비 연동
- custom domain/DNS 변경
- 유료 리소스 생성·증액
- 앱스토어/외부 테스터 실제 배포 실행
- production migration 실행

## 7. 성공 기준

아래가 충족되면 이번 Phase 22 기획은 성공으로 봅니다.

- 대장이 직원 로그인 후 하루 업무 흐름을 문서와 화면 기준으로 바로 따라갈 수 있다.
- `/dashboard` 와 각 핵심 업무 route 가 같은 순서와 같은 언어를 쓴다.
- 공지/문서, 내 정보, 조직 확인 흐름이 출퇴근/휴가/결재 흐름과 끊기지 않는다.
- mobile/PWA/Web 설명이 같은 contract 와 같은 guardrail 을 가리킨다.
- empty/error/forbidden/offline 상태가 사용자 언어로 정리돼도 의미가 섞이지 않는다.
- `/admin/*` 운영 화면이 일반 직원 핵심 업무 흐름에 섞이지 않는다.
- production data, secret, 실연동, 외부 배포는 계속 승인 게이트로 분리돼 있다.

## 8. 다음 작업자에게 넘길 핵심 포인트

1. 이번 단계의 핵심은 새 기능 대량 추가가 아니라 실제 하루 업무 흐름 연결 정리다.
2. 기준 순서는 `/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees` 다.
3. Phase 21의 회사 설정 모델 설명은 지우지 말고, 각 업무 흐름이 왜 그렇게 보이는지 설명하는 근거로 재사용한다.
4. mobile 쪽은 `packages/shared/src/mobile-contracts.ts` 와 `apps/mobile/src/workflow.ts` 를 기준 근거로 삼는다.
5. `/admin/*` 는 계속 별도 운영 확인 포인트이며 일반 직원 흐름에 섞지 않는다.
6. production data, secret, GPS/실태그, external HR, app store/외부 배포는 계속 승인 게이트다.
