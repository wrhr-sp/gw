# 출퇴근 등록 방식 정책 선택 1차 범위

## 1. 한 줄 정의

이번 1차의 목표는 출퇴근 등록 방식을 `mobile`, `pc`, `tag` 3가지로 표준화하고, 회사 기본 정책에서 허용할 방식을 선택해 관리자 화면·직원 화면·API 검증에 같은 기준으로 연결하는 것입니다.

중요한 점은 이번 단계가 실제 NFC/RFID/QR 장비 연동이나 GPS 강제 수집을 여는 단계가 아니라,
"어떤 등록 방식을 회사가 허용하는지"를 안전하게 고정하는 단계라는 것입니다.

## 2. 왜 이번 단계가 필요한가

현재 저장소 기준으로 이미 아래 골격은 있습니다.

- `apps/web/app/attendance/page.tsx` 에 출근/퇴근 CTA, 오늘 상태, 최근 기록, 정정 요청 placeholder 가 있습니다.
- `packages/shared/src/contracts.ts` 에 `attendanceSourceSchema = z.enum(["web", "mobile", "admin", "import"])` 가 있고, 근태 기록 `source` 필드가 이 enum 을 사용합니다.
- `apps/api/src/app.ts` 의 placeholder 근태 응답은 현재 `source: "web"` 중심 예시를 사용합니다.
- `apps/web/app/admin/policies/page.tsx` 와 `apps/web/admin-skeleton-config.ts` 에 정책 카드 구조는 있지만, 출퇴근 등록 방식처럼 직원 행동을 직접 제한하는 정책 필드는 아직 명확히 드러나지 않습니다.
- `apps/web/app/employees/page.tsx` 는 일반 조회 화면으로 분리돼 있지만, 회사가 허용한 출퇴근 등록 방식이 직원에게 어떻게 보일지는 아직 정리되지 않았습니다.

즉 지금은 출퇴근 기능과 정책 화면이 각각 따로는 있지만,
"회사 정책에서 어떤 등록 방식을 허용했고, 직원은 그중 무엇을 보며, API 는 어떤 요청을 막아야 하는지"가 한 기준으로 묶여 있지 않습니다.

## 3. 이번에 고정하는 핵심 결정

### 관리자 화면에서 어떻게 선택하는가

관리자는 `/admin/policies` 의 "근태 / 출퇴근 등록 방식 정책" 카드에서 아래 순서로 판단합니다.

1. `현재 허용 방식`에서 지금 직원에게 열려 있는 방식을 먼저 봅니다.
2. `candidate 허용 방식`에서 바꾸려는 조합을 확인합니다.
3. `before / after diff` 와 `필요 capability(attendance.manage)`를 함께 확인합니다.
4. `감사 preview` 와 변경 사유 입력 흐름을 본 뒤 다음 작업으로 넘깁니다.

현재 코드/테스트 기준 예시는 아래와 같습니다.

- 현재 허용 방식: `mobile`, `pc`
- candidate 허용 방식: `mobile`, `tag`
- 태그 상태: `skeleton_only`

즉 지금 문서와 화면은 "모바일/PC 는 허용 가능, 태그는 후보와 안내 카드까지만 보임"을 같은 뜻으로 맞추고 있어야 합니다.

### 결정 A. 회사 정책에서 선택하는 출퇴근 등록 방식은 3가지로 제한한다.

이번 1차에서 허용하는 enum 후보는 아래 3가지입니다.

- `mobile` — 모바일/PWA 또는 모바일 우선 UI 에서 누르는 출퇴근 등록
- `pc` — 데스크톱/웹 화면에서 누르는 출퇴근 등록
- `tag` — 태그 인식 기반 등록을 위한 skeleton 항목

이번 단계에서는 이 3개만 문서/contract/UI/API 에서 공식 용어로 사용합니다.
다른 표현(`web`, `desktop`, `rfid`, `qr`, `nfc`)은 내부 구현 세부나 향후 확장 후보로 남기되, 회사 정책 선택 enum 으로는 쓰지 않습니다.

### 결정 B. 1차 적용 범위는 회사 기본 정책만 다룬다.

확장 후보는 남깁니다.

- 회사별 기본 정책
- 지점별 override
- 부서별 override
- 근무유형별 override

하지만 이번 1차에서 실제 구현 범위는 회사 기본 정책 하나만 다룹니다.
쉽게 말하면 "우리 회사는 모바일/PC/태그 중 무엇을 허용하나"까지만 먼저 고정합니다.

### 결정 C. 직원 화면은 허용된 방식만 보여 준다.

직원 근태 화면에서는 아래 원칙을 유지합니다.

- 허용된 방식만 CTA 또는 안내 문구로 노출한다.
- 허용되지 않은 방식은 숨기거나 "회사 정책에서 미허용" 안내로 남긴다.
- 태그 방식은 실제 장비 연동이 아니라 "사내 태그 단말 연동 예정 / 현재는 안내만 제공" 수준의 skeleton 으로 남긴다.
- 위치/GPS/기기 고유값 수집을 당연한 기본값처럼 문구에 넣지 않는다.

현재 구현 예시 기준으로는 직원 화면 `/attendance` 에서 아래처럼 보여 주는 것이 맞습니다.

- `mobile` 허용 → "모바일 출근 등록" CTA 노출
- `pc` 허용 → "PC 출근 등록" CTA 노출
- `tag` 미허용이지만 candidate/skeleton 이 있으면 → "태그 단말 연동 예정" 안내 카드만 노출

예시:

- `mobile + pc` 허용 시: 모바일 출근/퇴근 버튼과 PC 출근/퇴근 안내 노출, 태그는 미허용 안내 또는 미노출
- `tag`만 허용 시: 태그 단말 사용 안내만 보이고 모바일/PC 버튼은 숨김 또는 비활성 안내

### 결정 D. API 는 요청 방식이 회사 정책에 포함되는지 검사한다.

출근/퇴근 placeholder API 는 단순 권한 체크만 하지 않고, 요청이 어떤 방식으로 들어왔는지와 회사 허용 정책을 함께 봐야 합니다.

이번 1차에서 필요한 검증 기준은 아래와 같습니다.

- 요청 body 또는 contract 에 등록 방식 필드를 명시한다.
- 등록 방식 값은 `mobile | pc | tag` 중 하나여야 한다.
- 회사 정책에 없는 방식이면 403 `FORBIDDEN` 또는 동급 정책 위반 응답으로 막는다.
- 권한이 있어도 미허용 방식이면 성공처럼 처리하지 않는다.
- 태그 방식은 실제 장비 인증 없이도 "정책상 허용 여부"와 "skeleton 경계"까지만 검증한다.

### 결정 E. 기존 attendance record `source` 와 새 정책 enum 은 연결하되, 같은 개념으로 섞어 쓰지 않는다.

주의할 점이 있습니다.
현재 `attendanceSourceSchema` 는 기록이 어디서 생성됐는지 나타내는 내부 source 성격이고,
이번 카드의 등록 방식 정책은 회사가 어떤 입력 경로를 허용하는지 나타내는 정책 성격입니다.

따라서 다음 구현자는 아래 둘 중 하나로 정리해야 합니다.

1. `attendanceSourceSchema` 를 정책 enum 기준에 맞게 재정의하고, 기존 placeholder `web/admin/import` 사용처를 함께 정리한다.
2. 또는 정책 전용 enum/schema 를 별도로 만들고, 기록 `source` 와 정책 `method` 의 책임을 분리한다.

이번 기획의 권장안은 2번입니다.
이유는 아래와 같습니다.

- 정책 허용 기준과 감사/내부 생성 경로를 분리할 수 있습니다.
- 향후 `import`, `admin`, background 보정 같은 내부 source 를 남기기 쉽습니다.
- `pc` 와 기존 `web` 을 억지로 1:1 매핑하다가 문서/테스트 의미가 흐려지는 일을 줄일 수 있습니다.

즉, 권장 방향은 `attendanceRegistrationMethodSchema` 같은 정책 전용 enum 을 새로 두는 것입니다.

## 4. 이번 범위에 포함되는 것

### 문서 범위

- 출퇴근 등록 방식 정책 선택 1차 scope 문서 작성
- 구현자가 바로 따라갈 handoff 문서 작성
- README / ROADMAP / TASKS / HANDOFF / KNOWN_ISSUES / CHANGELOG 최신 기준 반영
- 필요 시 TEST_PLAN / QA_CHECKLIST 에 정책 검증 포인트 추가

### Shared contract 범위

다음 구현 카드에서 우선 검토할 파일:

- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- 필요 시 `packages/shared/test/contracts.spec.ts`

이번 1차에서 허용하는 contract 방향:

- 출퇴근 등록 방식 정책 enum 추가
- 회사 정책 응답/요청 schema 에 허용 방식 배열 필드 추가
- 출근/퇴근 요청 schema 에 선택 방식 필드 추가
- 관리자 정책 candidate 응답에 출퇴근 방식 before/after diff 를 담을 수 있는 구조 추가

권장 필드 예시:

- `allowedAttendanceRegistrationMethods: ("mobile" | "pc" | "tag")[]`
- `attendanceRegistrationMethod: "mobile" | "pc" | "tag"`

주의:

- 빈 배열은 허용하지 않는 쪽이 안전합니다. 최소 1개 이상 선택을 권장합니다.
- 중복 값은 schema 또는 normalization 으로 제거합니다.
- 순서는 UI 표시 우선순위로 재사용할 수 있게 `mobile -> pc -> tag` 기본 정렬 기준을 권장합니다.

### Admin 정책 UI 범위

우선 검토 파일:

- `apps/web/app/admin/policies/page.tsx`
- `apps/web/admin-skeleton-config.ts`
- 필요 시 `apps/web/admin-console-pass1.test.tsx`
- 필요 시 `apps/web/admin-skeleton-config.test.ts`

이번 1차에서 admin 정책 카드에 들어가야 할 정보:

- 현재 허용 방식 요약
- candidate 허용 방식 선택값
- 방식별 안내 문구
  - `mobile`: 모바일/PWA 버튼 기반
  - `pc`: 데스크톱/웹 버튼 기반
  - `tag`: 태그 단말 연동 예정 skeleton
- before/after diff
- 필요한 capability
- 감사 preview
- 태그 방식의 미연결 안내
- GPS/실장비/외부 단말 연동이 이번 범위가 아니라는 경계 문구

권장 표현:

- "허용 방식"
- "현재 운영 기준"
- "candidate 변경안"
- "실장비 연동은 별도 승인"

피해야 할 표현:

- "태그 출근 완료"
- "위치 인증 완료"
- "NFC 연동됨"

### 직원 화면 범위

우선 검토 파일:

- `apps/web/app/attendance/page.tsx`
- 필요 시 `apps/web/app/dashboard/page.tsx`
- 필요 시 `apps/web/app/mobile-pwa-config.ts`
- 필요 시 `apps/web/app/employees/page.tsx`

직원 근태 화면에서 먼저 맞출 기준:

- 허용 방식만 CTA 로 노출
- 허용되지 않은 방식은 숨김 또는 정책 안내 문구 처리
- 태그 방식은 버튼보다 안내 카드 우선
- 작은 화면에서는 가장 자주 쓰는 허용 방식 CTA 를 위로 올림
- 마지막 기록/정정 요청/오프라인 안내와 충돌하지 않게 배치

직원 일반 조회 화면(`employees`)에서 추가로 보여 줄 수 있는 정보는 아래 수준까지만 권장합니다.

- 회사 기본 출퇴근 방식 요약 배지 또는 한 줄 안내
- 예: "기본 등록 방식: 모바일, PC"

하지만 아래는 넣지 않습니다.

- 직원별 예외 편집
- 관리자용 권한 저장
- 실제 단말 식별값

### API 범위

우선 검토 파일:

- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

이번 1차에서 API 에 들어가야 할 기준:

- 회사 정책에서 허용한 방식 목록 placeholder 제공
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- 필요 시 관리자 정책 candidate endpoint

검증 기준:

1. 요청 방식 enum 검증
2. 허용되지 않은 방식 차단
3. 허용된 방식은 기존 placeholder 응답 유지
4. 태그 방식은 실제 장비 인증 없이 skeleton 응답/안내만 유지
5. cross-company 정책 주입 금지
6. 권한 체크와 정책 체크를 서로 다른 단계로 유지

권장 오류 예시:

- 형식 오류: 400 `VALIDATION_ERROR`
- 정책 미허용: 403 `FORBIDDEN`

## 5. 이번 단계에서 하지 않는 것

- 실제 NFC/RFID/QR 장비 연동
- 실제 태그 인증 로직
- GPS/위치 강제 수집 및 저장
- production DB 실데이터 변경
- secret 입력/교체
- 외부 출퇴근 장치/HR API 연동
- 지점/부서/근무유형별 override 실제 저장
- 급여/노무 계산 엔진 연결
- 실운영 개인정보 원문 처리 확대

아래 항목은 특히 별도 승인 없이는 진행하지 않습니다.

- 실제 NFC/RFID/QR 리더기 또는 사내 출입 장비 연결
- GPS/위치정보 강제 수집·저장
- production DB 실데이터 반영 또는 기존 데이터 수정
- 외부 HR/근태/출입 API 실제 연동

## 6. 구현자가 바로 따라야 할 파일 우선순위

### 1순위

- `docs/architecture/attendance-registration-policy-pass-1-scope.md`
- `docs/guides/attendance-registration-policy-pass-1-handoff.md`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/web/app/attendance/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/admin-skeleton-config.ts`

### 2순위

- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/mobile-pwa-config.ts`
- `apps/web/app/employees/page.tsx`
- `packages/shared/test/contracts.spec.ts`
- `apps/web/admin-console-pass1.test.tsx`
- `apps/web/admin-skeleton-config.test.ts`
- 필요 시 새 web boundary test

## 7. 최소 테스트 범위

다음 구현 카드는 아래를 최소 회귀로 잡는 것이 좋습니다.

### Shared / contract

- 출퇴근 등록 방식 enum 이 `mobile | pc | tag` 로 고정되는지
- 회사 정책 allowed methods 배열이 비어 있지 않은지
- 출근/퇴근 요청 schema 가 허용 방식 필드를 요구하는지

### API

- 허용된 방식으로 check-in/check-out 성공
- 미허용 방식으로 check-in/check-out 403 차단
- 잘못된 방식 값으로 400 validation 차단
- 태그 방식 허용 시에도 실제 장비 연동 완료처럼 보이지 않는 placeholder 유지
- cross-company 정책 조작 차단

### Web

- admin 정책 화면에 허용 방식 current/candidate/diff 가 보이는지
- 직원 근태 화면에 허용된 방식만 보이는지
- 태그 방식이 안내형 skeleton 으로 보이는지
- 모바일 우선 CTA 순서가 유지되는지
- 일반 직원 화면과 관리자 정책 화면 책임이 섞이지 않는지

## 8. 완료 기준

이번 1차는 아래 조건을 만족하면 구현 완료로 보기 좋습니다.

1. 출퇴근 등록 방식 정책 enum 이 문서/contract 에서 `mobile`, `pc`, `tag` 로 고정돼 있다.
2. 회사 기본 정책에 허용 방식 필드가 생겼다.
3. admin 정책 화면에서 허용 방식 current/candidate/diff 를 검토할 수 있다.
4. 직원 근태 화면은 회사 정책에서 허용한 방식만 보여 준다.
5. check-in/check-out API 가 요청 방식과 회사 정책 허용 여부를 검증한다.
6. 태그 방식은 실장비 연동이 아니라 skeleton 경계로 남아 있다.
7. 관련 테스트가 허용/차단/validation 경계를 함께 확인한다.

## 9. 별도 승인 필요 항목

아래는 계속 별도 승인 없이는 진행하면 안 됩니다.

1. 실제 태그/NFC/RFID/QR 장비 연동
2. GPS/위치정보 강제 수집·저장
3. production DB 실데이터 변경
4. secret 입력/교체
5. 외부 HR/출입 시스템 연동
6. 유료 리소스 생성·증설
7. 실제 개인정보 원문 처리 확대

정리하면 이번 카드의 핵심은 하나입니다.
출퇴근 등록 방식을 많이 만드는 것이 아니라,
회사가 허용한 방식만 같은 기준으로 보여 주고 검증하는 정책 골격을 먼저 고정하는 것입니다.
