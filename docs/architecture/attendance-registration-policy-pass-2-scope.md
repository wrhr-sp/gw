# 출퇴근 정책 적용대상/우선순위 2차 범위

## 1. 한 줄 정의

이번 2차의 목표는 출퇴근 등록 방식 정책을 회사 기본값 하나에서 끝내지 않고,
`회사 기본값 → 근무지/지점 → 부서/팀 → 직무/역할` 순서의 적용대상과 우선순위로 확장해
관리자 화면, 직원 화면, API 가 모두 같은 `effective policy` 계산 기준을 쓰게 만드는 것입니다.

중요한 점은 이번 단계도 실제 운영 조직 데이터를 대량 변경하거나,
개인별 예외, GPS, NFC/RFID/QR 장비 연동을 여는 단계가 아니라,
"누구에게 어떤 정책이 우선 적용되는지"를 예측 가능하게 고정하는 단계라는 것입니다.

## 2. 왜 이번 단계가 필요한가

1차에서 이미 아래 기준은 정리됐습니다.

- 출퇴근 등록 방식 정책 enum 은 `mobile`, `pc`, `tag` 3가지로 제한한다.
- 회사 기본 정책 allowed methods 를 admin 정책 화면, 직원 근태 화면, 출근/퇴근 API 검증에 같은 기준으로 연결한다.
- `tag` 는 실장비 연동이 아니라 skeleton/안내/검증 지점까지만 먼저 잡는다.

하지만 아직 아래 질문에는 답이 없습니다.

- 본사는 `mobile`, 물류센터는 `tag` 중심이면 누구 기준이 우선인가?
- 같은 직원이 특정 지점 소속이면서 특정 부서에 속하면 어느 정책이 이긴다고 설명할 것인가?
- 직원 화면의 버튼 노출과 API 허용/차단이 왜 그렇게 나왔는지 관리자가 다시 추적할 수 있는가?

즉 1차가 "무슨 방식이 가능한가"를 고정한 단계였다면,
이번 2차는 "그 방식이 누구에게 적용되는가"를 고정하는 단계입니다.

## 3. 이번에 고정하는 핵심 결정

### 결정 A. 적용대상 계층은 4단계만 공식 지원한다.

이번 2차에서 공식 지원하는 정책 적용대상 후보는 아래 4가지입니다.

1. `company_default`
   - 회사 전체 기본값
   - 모든 직원이 최소한 이 기준에서 시작합니다.
2. `workplace`
   - 근무지/지점 단위 적용
   - 예: 본사, 판교 오피스, 부산 물류센터
3. `department`
   - 부서/팀 단위 적용
   - 예: 인사팀, 영업1팀, CS운영팀
4. `job_type`
   - 직무/역할 단위 적용
   - 예: 현장직, 사무직, 계약직, 보안요원

이번 단계에서는 위 4개만 정책 target type 으로 사용합니다.
`employee` 개인 예외는 의도적으로 넣지 않습니다.

이유:

- 개인 override 를 열면 설명과 검증이 급격히 어려워집니다.
- 현재 카드 목표는 "조직 정책 우선순위"를 먼저 잠그는 것입니다.
- 개인 예외는 별도 승인과 별도 감사 기준이 필요한 후속 단계로 분리하는 편이 안전합니다.

### 결정 B. 우선순위는 "더 구체적인 조직 단위가 이긴다"로 고정한다.

기본 우선순위는 아래처럼 고정합니다.

`company_default < workplace < department < job_type`

쉽게 말하면:

- 회사 기본값은 출발점입니다.
- 근무지/지점 정책이 있으면 회사 기본값을 덮습니다.
- 부서/팀 정책이 있으면 근무지 정책보다 더 우선합니다.
- 직무/역할 정책이 있으면 가장 마지막에 덮습니다.

권장 이유:

- 관리자에게 설명하기 쉽습니다.
- 직원 화면과 API 가 같은 계산식을 쓰기 쉽습니다.
- preview 에서 "어느 줄이 마지막으로 이겼는지"를 보여 주기 쉽습니다.

### 결정 C. 2차에서는 "병합"보다 "전체 대체 override"를 기본으로 한다.

이번 2차에서는 각 target 정책이 `allowedAttendanceRegistrationMethods` 를 부분 patch 하지 않고,
해당 단계의 허용 방식 전체를 다시 선언하는 방식으로 갑니다.

예시:

- 회사 기본값: `mobile`, `pc`
- 부산 물류센터(workplace): `mobile`, `tag`
- CS운영팀(department): `pc`
- 현장직(job_type): `tag`

직원이 부산 물류센터 + CS운영팀 + 현장직에 모두 해당하면,
최종 결과는 `tag` 입니다.
즉 상위 단계와 합집합으로 섞지 않습니다.

이번 단계에서 union/intersection 병합을 하지 않는 이유:

- 관리자 preview 설명이 복잡해집니다.
- API 차단 사유가 모호해집니다.
- 테스트 케이스가 급격히 늘어납니다.

따라서 2차 기본 규칙은 아래처럼 이해하면 됩니다.

- 각 단계는 "이 단계에서 최종 허용하는 방식 전체"를 선언한다.
- 더 높은 우선순위가 있으면 아래 단계를 완전히 덮는다.

### 결정 D. 같은 우선순위 안에서는 한 target 당 활성 정책 1개를 원칙으로 한다.

예:

- `workplace=본사` 에 대해 활성 정책은 1개만 허용
- `department=인사팀` 에 대해 활성 정책은 1개만 허용
- `job_type=현장직` 에 대해 활성 정책은 1개만 허용

만약 sample/legacy 데이터 때문에 같은 target 에 활성 정책이 2개 이상 보이면,
UI 와 API 는 아래 순서로 안전하게 동작해야 합니다.

1. 관리자 preview 에 경고 배지 노출
2. 정렬 기준은 임시로 `updatedAt desc -> policyId asc`
3. 그러나 구현/운영 문서에는 "중복 활성 정책은 데이터 이상 상태"라고 분명히 남김

즉 이번 2차의 정상 상태는 "같은 우선순위, 같은 target 중복 없음"입니다.

### 결정 E. target 명칭은 사용자 용어와 내부 key 를 분리한다.

관리자 UI 에서는 아래처럼 쉬운 한국어를 우선 씁니다.

- 회사 기본
- 근무지/지점
- 부서/팀
- 직무/역할

하지만 contract/internal key 는 아래처럼 고정하는 쪽을 권장합니다.

- `company_default`
- `workplace`
- `department`
- `job_type`

이렇게 나누면 문서/코드/테스트가 덜 흔들립니다.

### 결정 F. `effective policy` 는 직원 1명 기준으로 "매칭 체인"을 남겨 설명 가능해야 한다.

직원에게 실제 적용되는 정책은 단순한 최종 allowed methods 만 주지 않고,
최소한 아래 설명 정보도 같이 계산 가능해야 합니다.

- 시작 기준: 회사 기본값
- 매칭된 workplace 정책
- 매칭된 department 정책
- 매칭된 job_type 정책
- 마지막으로 승리한 정책 레벨과 target
- 최종 allowed methods

예시:

- baseline: 회사 기본 `mobile`, `pc`
- workplace match: 부산 물류센터 `mobile`, `tag`
- department match: 없음
- job_type match: 현장직 `tag`
- winner: `job_type:현장직`
- effective methods: `tag`

이 정보가 있어야 관리자도 설명할 수 있고,
직원 화면과 API 차단 사유도 같은 뜻으로 맞출 수 있습니다.

## 4. 적용대상별 의미 정의

### 4-1. 회사 기본값 (`company_default`)

- 회사 전체에 적용되는 출발점
- 모든 직원이 최소한 이 값에서 시작
- 비어 있으면 안 됨
- 최소 1개 이상의 allowed method 필요

### 4-2. 근무지/지점 (`workplace`)

- 직원이 속한 주 근무지 또는 지점 기준
- 공개 UI 문구는 "근무지/지점"으로 표현 가능
- 내부 key 는 `workplace` 하나로 통일 권장

이번 단계에서의 가정:

- 직원당 대표 근무지 1개를 기준으로 계산
- 다중 근무지/순환근무의 세부 우선순위는 후속 단계로 미룸

### 4-3. 부서/팀 (`department`)

- 직원의 기본 부서 또는 팀 기준
- 공개 UI 문구는 "부서/팀"으로 표현 가능
- 내부 key 는 `department` 하나로 통일 권장

이번 단계에서의 가정:

- 직원당 대표 부서 1개를 기준으로 계산
- 겸직/복수 부서 membership 우선순위는 후속 단계로 미룸

### 4-4. 직무/역할 (`job_type`)

- 정책 관점에서의 근무 형태/직무 구분
- 예: 현장직, 사무직, 계약직, 파트타이머, 보안요원
- 공개 UI 문구는 "직무/역할"로 보여 줄 수 있음
- 내부 key 는 `job_type` 하나로 유지 권장

주의:

- 이 값은 현재 RBAC permission role 과 같은 뜻이 아닐 수 있습니다.
- 권한 roleCode 와 출퇴근 정책용 job type 을 무리하게 1:1 로 섞지 않는 편이 안전합니다.
- 2차에서는 우선 sample/config 기준으로 분리된 policy target value 를 두는 쪽을 권장합니다.

## 5. 관리자 화면에서 보여 줄 내용

우선 검토 파일:

- `apps/web/app/admin/policies/page.tsx`
- `apps/web/admin-skeleton-config.ts`
- 필요 시 `apps/web/admin-console-pass1.test.tsx`
- 필요 시 새 정책 preview 테스트

관리자 `/admin/policies` 의 출퇴근 정책 카드는 아래 순서로 읽히는 것이 좋습니다.

1. 회사 기본 허용 방식
2. 적용대상별 정책 목록
3. 우선순위 설명
4. 선택한 target 의 candidate 변경안
5. 적용 인원 preview
6. effective policy 예시 미리보기
7. capability / 감사 preview / 제외 범위 안내

### 관리자 카드에 최소 들어가야 할 정보

- `현재 회사 기본값`
- `적용대상별 활성 정책 수`
- `우선순위 안내: 회사 기본 < 근무지/지점 < 부서/팀 < 직무/역할`
- target row 별 현재 허용 방식
- target row 별 예상 적용 인원 수
- 선택 target 변경 시 before/after diff
- 변경이 영향을 주는 직원 sample preview
- 중복/충돌 경고 배지
- `attendance.manage` capability 안내
- 감사 preview
- `tag` 가 실장비 연동이 아니라 skeleton 이라는 안내

### 적용 인원 preview 는 이렇게 보이는 것이 좋다

권장 정보:

- `예상 적용 인원 18명`
- `샘플 직원: 김민지, 박도윤, 이서현 외 15명`
- `현재 effective: 모바일, PC → 변경 후: 태그`
- `상위 정책에 덮이는 대상 3명` 또는 `동일 target 중복 경고`

주의:

- 실제 개인정보 원문을 과하게 노출하지 않는다.
- preview 는 설명용 sample 이지 실데이터 대량 편집 UI 가 아니다.
- 적용 인원 수가 계산 불가한 sample 환경이면 `sample preview` 라고 분명히 표시한다.

### 피해야 할 UI 표현

- "전 직원 즉시 태그 출근 전환 완료"
- "NFC 인증 완료"
- "위치 인증 자동 적용"
- "개인별 예외 저장"

## 6. 직원 화면에서 보여 줄 내용

우선 검토 파일:

- `apps/web/app/attendance/page.tsx`
- 필요 시 `apps/web/app/dashboard/page.tsx`
- 필요 시 `apps/web/app/employees/page.tsx`

직원 화면의 핵심은 "왜 이 버튼이 보이는지"를 직원이 이해할 수 있게 만드는 것입니다.

### `/attendance` 기준

최소 기준:

- 최종 `effective policy` 기준으로 허용된 방식만 CTA 또는 안내를 노출
- 가능하면 "현재 나에게 적용된 정책" 한 줄 요약 제공
- `tag` 만 허용돼도 실장비 완료처럼 보이는 버튼은 만들지 않음
- 미허용 방식은 숨기거나 정책 안내 문구로 처리

권장 문구 예시:

- `현재 적용 정책: 부산 물류센터 > 현장직 기준`
- `허용 방식: 태그`
- `모바일/PC 등록은 현재 소속 정책에서 허용되지 않습니다`
- `태그 방식은 사내 단말 연동 안내 기준입니다`

### `/employees` 또는 일반 조회 화면 기준

넣더라도 아래 수준만 권장합니다.

- 회사 기본 출퇴근 방식 요약
- 본인 effective policy 한 줄 요약

넣지 말아야 할 것:

- 개인별 정책 편집
- 타인의 상세 policy override 경로
- 실제 단말 식별값
- GPS/위치 세부값

## 7. API 와 contract 에서 고정할 기준

우선 검토 파일:

- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- 필요 시 `packages/shared/test/contracts.spec.ts`

### 권장 contract 방향

정책 기본 필드 예시:

- `policyLevel: "company_default" | "workplace" | "department" | "job_type"`
- `policyTargetId: string | null`
- `policyTargetLabel: string`
- `allowedAttendanceRegistrationMethods: ("mobile" | "pc" | "tag")[]`
- `priorityRank: number`

직원 적용 결과 예시:

- `effectiveAttendancePolicy`
- `matchedAttendancePolicies`
- `effectiveAttendanceRegistrationMethods`
- `effectivePolicySource`

중요:

- 2차에서는 target matching 과 결과 설명 필드를 먼저 맞추는 것이 핵심입니다.
- 실제 production 조직 master 를 직접 수정하는 migration/동기화는 이번 범위가 아닙니다.

### API 계산 기준

직원 1명 기준 `effective policy` 계산 권장 순서:

1. 회사 기본 정책 로드
2. 직원의 대표 `workplace` 정책 매칭
3. 직원의 대표 `department` 정책 매칭
4. 직원의 `job_type` 정책 매칭
5. 우선순위가 가장 높은 매칭값으로 최종 allowed methods 결정
6. matched chain 과 winner 를 응답 또는 내부 계산 근거로 유지
7. check-in/check-out 은 이 최종 결과 기준으로 허용/차단

### check-in/check-out 검증 기준

- 요청 body 의 등록 방식 값이 `mobile | pc | tag` 인지 먼저 검사
- 로그인/권한 체크와 정책 체크를 분리
- 최종 `effectiveAttendanceRegistrationMethods` 에 없는 값이면 403
- `tag` 허용이어도 실제 장비 인증 성공처럼 응답하지 않음
- 다른 회사 정책/target 주입은 차단

## 8. 이번 단계에 포함되는 것

### 문서 범위

- 2차 scope 문서 작성
- 2차 쉬운 handoff 문서 작성
- README / ROADMAP / TASKS / HANDOFF / SPEC / TEST_PLAN / QA_CHECKLIST / KNOWN_ISSUES / CHANGELOG 최신 기준 반영

### 구현 skeleton 범위

- target level/priority 모델 설계
- 관리자 preview 정보 구조 설계
- 직원 effective policy 계산 기준 설계
- API 허용/차단 기준 설계
- 테스트 포인트 정의

## 9. 이번 단계에서 하지 않는 것

- 개인(employee)별 정책 override
- 다중 근무지/복수 부서 membership 의 세밀한 우선순위
- 실제 운영 조직 데이터 대량 변경
- production DB 실데이터 migration
- GPS/위치정보 강제 수집 및 저장
- 실제 NFC/RFID/QR 장비 연동
- 외부 HR/출입 장치 API 연동
- secret 입력/교체
- 유료 리소스 생성

## 10. 구현자가 바로 따라야 할 파일 우선순위

### 1순위

- `docs/architecture/attendance-registration-policy-pass-2-scope.md`
- `docs/guides/attendance-registration-policy-pass-2-handoff.md`
- `packages/shared/src/contracts.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/attendance/page.tsx`
- `apps/web/admin-skeleton-config.ts`

### 2순위

- `packages/shared/test/contracts.spec.ts`
- `apps/web/admin-console-pass1.test.tsx`
- 필요 시 새 web policy preview test
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/employees/page.tsx`

## 11. 최소 테스트 범위

### Shared / contract

- policy level enum 이 `company_default | workplace | department | job_type` 로 고정되는지
- target level 별 필수 필드가 맞는지
- allowed methods 배열이 비어 있지 않은지
- effective policy 응답 필드 shape 가 일관적인지

### API

- 회사 기본값만 있을 때 계산이 맞는지
- workplace 정책이 회사 기본값을 덮는지
- department 정책이 workplace 정책보다 우선하는지
- job_type 정책이 가장 마지막에 이기는지
- 미허용 방식 요청이 403 으로 차단되는지
- 잘못된 방식 값이 400 으로 차단되는지
- 다른 회사 target 주입이 막히는지
- `tag` 허용이어도 실장비 인증 성공처럼 보이지 않는지

### Web

- `/admin/policies` 에 적용대상, 우선순위, preview, diff 가 읽히는지
- 직원 `/attendance` 에 effective policy 기준 허용 방식만 보이는지
- 미허용 방식이 성공 CTA 처럼 보이지 않는지
- 관리자 화면과 일반 직원 화면 책임이 섞이지 않는지
- 중복 target 경고가 있으면 읽히는지

## 12. 완료 기준

이번 2차는 아래 조건을 만족하면 구현 완료로 보기 좋습니다.

1. 정책 적용대상 level 이 `company_default`, `workplace`, `department`, `job_type` 로 문서/contract/UI/API 에서 일관된다.
2. 우선순위가 `회사 기본 < 근무지/지점 < 부서/팀 < 직무/역할` 로 고정돼 있다.
3. 각 단계는 allowed methods 전체 override 로 동작한다.
4. 관리자 화면에서 target 목록, 우선순위, 적용 인원 preview, before/after diff 를 확인할 수 있다.
5. 직원 화면과 API 가 같은 `effective policy` 계산 기준을 쓴다.
6. 미허용 방식은 UI 와 API 모두에서 성공처럼 보이지 않는다.
7. `tag` 는 여전히 skeleton/안내 경계 안에 남아 있다.
8. 관련 테스트가 우선순위와 차단 규칙을 함께 확인한다.

## 13. 별도 승인 필요 항목

아래는 계속 별도 승인 없이는 진행하면 안 됩니다.

1. 개인(employee)별 정책 override
2. 실제 태그/NFC/RFID/QR 장비 연동
3. GPS/위치정보 강제 수집·저장
4. production DB 실데이터 변경
5. 외부 HR/출입 시스템 연동
6. secret 입력/교체
7. 유료 리소스 생성·증설
8. 실제 개인정보 원문 처리 확대

정리하면 이번 카드의 핵심은 하나입니다.
출퇴근 등록 방식을 더 많이 추가하는 것이 아니라,
직원 1명에게 실제로 어떤 정책이 적용되는지를 예측 가능하게 계산하고 설명할 수 있게 만드는 것입니다.
