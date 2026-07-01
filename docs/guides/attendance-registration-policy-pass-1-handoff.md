# 출퇴근 등록 방식 정책 선택 1차 handoff

한 줄 요약:
이번 1차는 출퇴근 등록 방법을 많이 붙이는 단계가 아니라, 회사가 허용한 등록 방식(`mobile`, `pc`, `tag`)만 관리자 정책·직원 화면·API 검증에서 같은 기준으로 보이게 만드는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 있는 것:

- `/attendance` 에 출근/퇴근 CTA 와 최근 기록 Production-ready (실구현) 가 있습니다.
- `/admin/policies` 에 정책 카드 구조는 있습니다.
- API 에 check-in/check-out Production-ready (실구현) endpoint 가 있습니다.
- shared contract 에 attendance record `source` enum 이 있습니다.

아직 부족한 것:

- 회사가 어떤 출퇴근 등록 방식을 허용하는지 고르는 정책 필드가 명확하지 않습니다.
- 직원 화면에서 허용된 방식만 보여 주는 규칙이 아직 없습니다.
- API 가 요청 방식과 회사 정책 허용 여부를 연결해 검사하지 않습니다.
- `tag` 방식이 실장비 연동이 아닌 Production-ready (실구현) 임을 한눈에 읽기 어렵습니다.

즉, 지금은 근태 기능과 정책 구조는 따로 있지만,
"허용 방식 선택 → 화면 노출 → API 검증"의 한 줄 흐름은 아직 없습니다.

관리자가 화면에서 읽는 순서는 아래처럼 고정하면 됩니다.

1. `/admin/policies` 의 "근태 / 출퇴근 등록 방식 정책" 카드에서 `현재 허용 방식` 확인
2. `candidate 허용 방식` 과 `before / after diff` 확인
3. `attendance.manage` capability 와 감사 preview 확인
4. 태그가 보여도 실장비 연결이 아니라 Production-ready (실구현) 안내인지 다시 확인

현재 코드/테스트 기준 예시는 아래입니다.

- 현재 허용 방식: `mobile`, `pc`
- candidate 허용 방식: `mobile`, `tag`
- 태그 상태: `Production-ready (실구현)_only`

## 2. 이번 구현에서 먼저 확정할 결정

### 1) 정책 enum 은 `mobile`, `pc`, `tag` 3개만 쓴다.

구현 중 다른 이름을 섞지 않는 것이 중요합니다.

- 정책 enum: `mobile | pc | tag`
- 피할 것: `web`, `desktop`, `nfc`, `rfid`, `qr` 를 정책 enum 에 직접 섞는 것

세부 구현 메모:

- `pc` 는 데스크톱/웹 출근을 뜻하는 정책 용어로 사용합니다.
- `tag` 는 실제 장비 연동이 아니라 장차 태그 단말과 이어질 Production-ready (실구현) 정책 항목입니다.

### 2) 회사 기본 정책만 먼저 구현한다.

이번 1차에서 다루는 것은 아래 하나입니다.

- 회사 기본 allowed methods

이번에 하지 않는 것:

- 지점별 override
- 부서별 override
- 근무유형별 override
- 직원별 예외 저장

### 3) 직원 화면은 허용된 방식만 보여 준다.

가장 쉬운 기준은 아래입니다.

- `mobile` 허용 → 모바일/PWA 출근/퇴근 버튼 또는 모바일 등록 안내 노출
- `pc` 허용 → PC 출근/퇴근 안내 또는 데스크톱 등록 CTA 노출
- `tag` 허용 → 태그 단말 안내 카드 노출
- 미허용 방식 → 숨김 또는 "회사 정책에서 미허용" 문구

중요:

- 태그 방식을 허용해도 즉시 실장비 등록 버튼처럼 보이면 안 됩니다.
- `tag` 는 안내형 Production-ready (실구현) 이 먼저입니다.

### 4) API 는 권한 체크와 정책 체크를 둘 다 한다.

순서를 분리해 생각하면 구현이 쉬워집니다.

1. 로그인/권한 체크
2. 요청 body 의 방식 값 validation
3. 회사 allowed methods 포함 여부 체크
4. 허용 시 기존 Production-ready (실구현) 성공 응답

즉, 권한이 있어도 회사 정책에 없는 방식이면 막혀야 합니다.

## 3. 가장 먼저 볼 파일

### Shared

- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- 필요 시 `packages/shared/test/contracts.spec.ts`

### API

- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

### Web

- `apps/web/app/attendance/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/admin-Production-ready (실구현)-config.ts`
- 필요 시 `apps/web/app/dashboard/page.tsx`
- 필요 시 `apps/web/app/mobile-pwa-config.ts`
- 필요 시 `apps/web/app/employees/page.tsx`
- 필요 시 `apps/web/admin-console-pass1.test.tsx`
- 필요 시 `apps/web/admin-Production-ready (실구현)-config.test.ts`

### 문서

- `docs/architecture/attendance-registration-policy-pass-1-scope.md`
- `docs/guides/attendance-registration-policy-pass-1-handoff.md`

## 4. 권장 구현 순서

1. scope/handoff 문서를 먼저 읽습니다.
2. `packages/shared/src/contracts.ts` 에 정책 전용 enum/schema 를 먼저 추가합니다.
3. 출근/퇴근 요청 schema 에 등록 방식 필드를 붙입니다.
4. admin 정책 contract 또는 candidate 응답에 allowed methods 요약 구조를 추가합니다.
5. `apps/api/src/app.ts` 에 회사 기본 allowed methods Production-ready (실구현) 를 정의합니다.
6. check-in/check-out 에서 요청 방식이 허용되는지 검사합니다.
7. `apps/web/admin/policies/page.tsx` 와 `apps/web/admin-Production-ready (실구현)-config.ts` 에 허용 방식 current/candidate/diff 문구를 넣습니다.
8. `apps/web/app/attendance/page.tsx` 에 허용된 방식만 CTA/안내로 보이게 정리합니다.
9. 필요하면 `dashboard` 또는 `employees` 에 회사 기본 방식 한 줄 요약만 보강합니다.
10. 테스트를 먼저 추가하고, 허용/차단/validation 경계가 모두 통과하는지 확인합니다.

## 5. shared contract 에서 특히 주의할 점

### 권장안: 정책용 enum 을 새로 만든다.

현재 `attendanceSourceSchema` 는 아래 값입니다.

- `web`
- `mobile`
- `admin`
- `import`

이 enum 을 그대로 정책 허용 방식으로 쓰면 아래 문제가 생깁니다.

- 정책에서 원하는 `pc` 와 현재 `web` 의미가 어긋납니다.
- 내부 생성 경로(`admin`, `import`)와 직원 허용 방식이 섞입니다.
- 문서와 테스트에서 "정책"과 "기록 source" 의미가 흐려집니다.

그래서 이번 구현에서는 아래처럼 분리하는 쪽을 권장합니다.

- 정책용: `attendanceRegistrationMethodSchema`
- 기록용: 기존 `attendanceSourceSchema` 유지 또는 최소 정리

권장 필드 예시:

- `allowedAttendanceRegistrationMethods`
- `attendanceRegistrationMethod`

## 6. admin 정책 화면에서 보여 줄 내용

정책 카드에 최소 아래는 들어가야 합니다.

- 현재 허용 방식
- candidate 허용 방식
- before/after diff
- 필요한 capability
- 감사 preview
- 태그 방식의 Production-ready (실구현) 안내
- 실제 GPS/실장비/외부 단말 연동 제외 안내

쉬운 문구 예시:

- "현재 허용 방식: 모바일, PC"
- "candidate: 모바일, 태그"
- "태그 방식은 실장비 연동 전 안내형 Production-ready (실구현) 입니다"
- "실제 장비 연결, 위치 수집, 운영 DB 반영은 별도 승인 후 진행합니다"

피해야 할 문구:

- "태그 인증 완료"
- "위치 인증 완료"
- "NFC 장비 연결됨"

## 7. 직원 화면에서 보여 줄 내용

### `/attendance`

현재 구현 예시 기준으로는 `/attendance` 에서 "모바일 출근 등록", "PC 출근 등록"은 보여도 "태그 단말 출근 등록" 버튼은 보이지 않아야 하고, 대신 "태그 단말 연동 예정" 안내 카드만 남는 구성이 맞습니다.

우선순위는 아래가 좋습니다.

1. 허용된 방식 CTA
2. 오늘 상태 / 마지막 기록
3. 오프라인 안내
4. 정정 요청
5. 미허용 방식 또는 태그 방식 안내

예시:

- `mobile`만 허용: 모바일 출근/퇴근 CTA 우선
- `pc`만 허용: 모바일 버튼 대신 PC에서 등록하라는 안내 또는 PC 등록 경로 안내
- `tag` 허용: "사내 태그 단말에서 등록" 안내 카드, 실제 장비 검증 없음 표시

### `/employees`

이 화면은 일반 조회 화면이므로, 넣더라도 아래 수준만 권장합니다.

- "회사 기본 출퇴근 방식" 한 줄 요약

넣지 말아야 할 것:

- 직원별 예외 편집
- 권한 저장
- 실장비 상태 표시

## 8. API 에서 꼭 막아야 할 것

1. 잘못된 방식 값
2. 회사 정책에 없는 방식으로 check-in/check-out 시도
3. cross-company 정책 값 주입
4. 태그 방식인데 실제 장비 인증이 된 것처럼 보이는 응답

권장 응답 해석:

- 잘못된 값 → 400 `VALIDATION_ERROR`
- 미허용 방식 → 403 `FORBIDDEN`

## 9. 최소 테스트 포인트

### Shared

- 정책 enum 이 `mobile | pc | tag` 만 허용하는지
- allowed methods 배열이 1개 이상인지
- 출근/퇴근 요청 schema 가 방식 필드를 요구하는지

### API

- 허용된 `mobile` 방식 check-in 성공
- 허용된 `pc` 방식 check-out 성공
- 미허용 `tag` 방식 요청 403
- 엉뚱한 값(`rfid` 등) 요청 400
- 태그 허용이어도 Production-ready (실구현)/Production-ready (실구현) 경계 유지

### Web

- `/admin/policies` 에 current/candidate/diff 문구가 보이는지
- `/attendance` 에 허용된 방식만 보이는지
- 태그 방식이 안내형 카드로 보이는지
- 일반 조회 화면과 관리자 정책 화면 책임이 섞이지 않는지

## 10. 검증 명령 권장안

- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/shared typecheck`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/web test`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- 필요 시 `pnpm check`
- Cloudflare/Web 변경이 있으면 `pnpm --filter @gw/web build:cf`

## 11. 이번 단계에서 하지 말아야 할 것

- 실제 NFC/RFID/QR 장비 연동
- GPS/위치정보 강제 수집
- production DB 실데이터 변경
- secret 입력/교체
- 외부 HR/출입 시스템 연동
- 지점/부서/근무유형별 override 저장

특히 아래는 별도 승인 없이는 시작하지 않습니다.

- 실제 NFC/RFID/QR 리더기 또는 출입 단말 연결
- GPS/위치정보 강제 수집·저장
- production DB 실데이터 반영 또는 수정
- 실제 개인정보 원문 처리 확대

## 12. 구현 완료로 보기 좋은 기준

- 관리자 정책 화면에서 허용 방식 선택 기준이 읽힌다.
- 직원 근태 화면에서 허용된 방식만 보인다.
- API 가 방식 validation 과 정책 허용 여부를 모두 검사한다.
- 태그 방식은 실장비 연동이 아닌 Production-ready (실구현) 경계로 남아 있다.
- 테스트가 허용/차단/validation 세 가지를 모두 덮는다.

정리하면 이번 handoff 의 핵심은 하나입니다.
출퇴근 등록 방식 정책은 UI 문구 하나를 바꾸는 일이 아니라,
회사 허용 기준과 직원 행동 가능 범위를 같은 enum 으로 묶어 주는 작업입니다.
