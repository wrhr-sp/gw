# 출퇴근 정책 적용대상/우선순위 2차 handoff

한 줄 요약:
이번 2차는 출퇴근 등록 방식 자체를 늘리는 작업이 아니라,
회사 기본값 위에 `근무지/지점`, `부서/팀`, `직무/역할` 정책을 얹고
직원 1명에게 실제로 어떤 정책이 최종 적용되는지 같은 기준으로 계산하게 만드는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

1차에서 이미 맞춘 것:

- 정책 방식 enum 은 `mobile`, `pc`, `tag` 3가지다.
- 회사 기본 정책이 허용한 방식만 직원 화면과 API 에서 통과해야 한다.
- `tag` 는 실장비 연동이 아니라 Production-ready (실구현) 안내 항목이다.

아직 부족한 것:

- 본사와 물류센터가 다른 정책을 쓰면 무엇이 먼저 적용되는지 기준이 없다.
- 특정 부서나 직무가 회사 기본값을 덮을 수 있는지 설명 문서가 없다.
- 관리자 화면에서 "왜 이 직원에게 태그만 보이는가"를 추적할 preview 구조가 부족하다.

즉 1차가 "무슨 출퇴근 방식이 가능한가"를 고정했다면,
이번 2차는 "그 방식이 누구에게 적용되는가"를 고정하는 단계입니다.

## 2. 이번 구현에서 먼저 확정할 결정

### 1) 적용대상 level 은 4개만 쓴다.

정책 target level:

- `company_default`
- `workplace`
- `department`
- `job_type`

관리자 UI 문구는 아래처럼 쉬운 한국어를 쓰면 됩니다.

- 회사 기본
- 근무지/지점
- 부서/팀
- 직무/역할

이번 단계에서 하지 않는 것:

- 개인(employee) override
- 복수 근무지/복수 부서 세밀 우선순위
- 실제 조직 master 데이터 대량 변경

### 2) 우선순위는 아래처럼 고정한다.

`company_default < workplace < department < job_type`

쉽게 말하면:

- 회사 기본값에서 시작
- 근무지 정책이 있으면 덮고
- 부서 정책이 있으면 한 번 더 덮고
- 직무/역할 정책이 있으면 마지막으로 덮습니다.

### 3) 이번 2차는 병합이 아니라 전체 override 로 간다.

각 정책은 부분 patch 가 아니라
"이 단계에서 허용하는 출퇴근 방식 전체"를 다시 선언합니다.

예시:

- 회사 기본: `mobile`, `pc`
- 근무지: `mobile`, `tag`
- 부서: `pc`
- 직무/역할: `tag`

최종 winner 가 직무/역할이면 결과는 `tag` 하나입니다.
합집합으로 `mobile`,`pc`,`tag` 를 다 열지 않습니다.

이 규칙이 중요한 이유:

- 관리자에게 설명하기 쉽습니다.
- preview 와 diff 가 단순해집니다.
- API 차단 기준이 흔들리지 않습니다.

### 4) 같은 target 에 활성 정책 2개 이상은 정상 상태가 아니다.

예:

- `workplace=본사` 정책은 활성 1개가 원칙
- `department=인사팀` 정책도 활성 1개가 원칙

혹시 sample/legacy 데이터 때문에 중복이 보이면:

1. 관리자 preview 에 경고를 띄웁니다.
2. 프로덕션 기준 정렬은 `updatedAt desc -> policyId asc` 로 둡니다.
3. 하지만 문서와 리뷰에서는 "데이터 이상 상태"라고 분명히 적습니다.

## 3. 가장 먼저 볼 파일

### 문서

- `docs/architecture/attendance-registration-policy-pass-2-scope.md`
- `docs/guides/attendance-registration-policy-pass-2-handoff.md`
- `docs/architecture/attendance-registration-policy-pass-1-scope.md`
- `docs/guides/attendance-registration-policy-pass-1-handoff.md`

### Shared

- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- 필요 시 `packages/shared/test/contracts.spec.ts`

### API

- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

### Web

- `apps/web/app/admin/policies/page.tsx`
- `apps/web/admin-Production-ready (실구현)-config.ts`
- `apps/web/app/attendance/page.tsx`
- 필요 시 `apps/web/app/dashboard/page.tsx`
- 필요 시 `apps/web/app/employees/page.tsx`
- 필요 시 `apps/web/admin-console-pass1.test.tsx`

## 4. 권장 구현 순서

1. 1차 scope/handoff 와 이번 2차 scope/handoff 를 같이 읽습니다.
2. shared contract 에 policy level / target / priority shape 를 먼저 추가합니다.
3. `effective policy` 응답 구조를 먼저 정합니다.
4. API 에 회사 기본값 → 근무지 → 부서 → 직무/역할 계산 순서를 넣습니다.
5. check-in/check-out 이 최종 effective methods 기준으로 차단되게 만듭니다.
6. admin 정책 화면에 target 목록, 우선순위, before/after diff, 적용 인원 preview 를 넣습니다.
7. 직원 `/attendance` 화면에 현재 나에게 적용된 정책 요약과 허용 방식만 보여 줍니다.
8. 중복 target/충돌 경고가 있으면 관리자 화면에 표시합니다.
9. 테스트를 먼저 추가하고 우선순위/차단 규칙이 맞는지 확인합니다.

## 5. shared contract 에서 특히 주의할 점

### 권장 level enum

- `company_default`
- `workplace`
- `department`
- `job_type`

### 권장 정책 필드 예시

- `policyLevel`
- `policyTargetId`
- `policyTargetLabel`
- `allowedAttendanceRegistrationMethods`
- `priorityRank`

### 권장 직원 적용 결과 예시

- `effectiveAttendanceRegistrationMethods`
- `effectiveAttendancePolicy`
- `matchedAttendancePolicies`
- `effectivePolicySource`

중요:

- 권한 role 과 정책용 `job_type` 을 억지로 같은 필드로 합치지 않는 편이 안전합니다.
- 2차의 목표는 우선순위 계산을 맞추는 것이지, RBAC 모델을 다시 만드는 것이 아닙니다.

## 6. 관리자 정책 화면에서 보여 줄 내용

정책 카드에 최소 아래는 들어가야 합니다.

- 회사 기본 허용 방식
- 적용대상별 정책 목록
- 우선순위 설명
- 선택 target 의 candidate 변경안
- before/after diff
- 예상 적용 인원 수
- sample 직원 preview
- 중복/충돌 경고
- 필요한 capability
- 감사 preview
- `tag` Production-ready (실구현) 안내
- GPS/실장비/외부 연동 제외 안내

쉬운 문구 예시:

- `우선순위: 회사 기본 < 근무지/지점 < 부서/팀 < 직무/역할`
- `예상 적용 인원 18명`
- `샘플 직원 3명 미리보기`
- `현재 effective: 모바일, PC → 변경 후: 태그`
- `동일 target 활성 정책 중복 경고`
- `태그 방식은 사내 단말 연동 전 안내형 Production-ready (실구현) 입니다`

피해야 할 문구:

- `전 직원 즉시 전환 완료`
- `NFC 인증 완료`
- `위치 인증 완료`
- `개인별 예외 저장`

## 7. 직원 화면에서 보여 줄 내용

### `/attendance`

가장 쉬운 기준은 아래입니다.

- 최종 `effective policy` 기준으로 허용된 방식만 CTA 또는 안내 노출
- 가능하면 `현재 나에게 적용된 정책` 한 줄 요약 제공
- `tag` 허용이어도 장비 연동 완료 버튼처럼 보이면 안 됨
- 미허용 방식은 숨김 또는 정책 안내 문구 처리

권장 문구 예시:

- `현재 적용 정책: 부산 물류센터 > 현장직 기준`
- `허용 방식: 태그`
- `모바일/PC 등록은 현재 소속 정책에서 허용되지 않습니다`
- `태그 방식은 사내 단말 안내 기준입니다`

### `/employees`

이 화면은 일반 조회 화면이므로, 넣더라도 아래 수준만 권장합니다.

- 회사 기본 출퇴근 방식 요약
- 본인 effective policy 한 줄 요약

넣지 말아야 할 것:

- 개인별 정책 편집
- 타인 상세 policy override
- 단말 식별값
- GPS/위치 세부 정보

## 8. API 에서 꼭 맞춰야 할 계산 순서

직원 1명 기준 권장 계산 순서:

1. 회사 기본 정책 로드
2. `workplace` match 확인
3. `department` match 확인
4. `job_type` match 확인
5. 가장 높은 우선순위 winner 결정
6. winner 기준 최종 allowed methods 계산
7. matched chain 을 같이 남겨 관리자/직원에게 설명 가능하게 유지
8. check-in/check-out 에서 이 결과로 허용/차단

즉 API 는 단순히 버튼을 숨기는 수준이 아니라,
서버 계산 기준으로도 미허용 방식을 막아야 합니다.

권장 응답 해석:

- 잘못된 방식 값 → 400 `VALIDATION_ERROR`
- 정책 미허용 → 403 `FORBIDDEN`

## 9. 최소 테스트 포인트

### Shared

- level enum 이 `company_default | workplace | department | job_type` 만 허용하는지
- allowed methods 배열이 비어 있지 않은지
- effective policy 응답 shape 가 일관적인지

### API

- 회사 기본값만 있을 때 결과가 맞는지
- workplace 가 company_default 를 덮는지
- department 가 workplace 보다 우선하는지
- job_type 이 마지막 winner 인지
- 미허용 방식이 403 인지
- 잘못된 방식 값이 400 인지
- cross-company target 주입이 막히는지
- `tag` 허용이어도 실장비 성공처럼 보이지 않는지

### Web

- `/admin/policies` 에 적용대상, 우선순위, preview, diff 가 보이는지
- `/attendance` 에 허용된 방식만 보이는지
- 중복 target 경고가 읽히는지
- 관리자 화면과 일반 직원 화면 책임이 섞이지 않는지

## 10. 구현 중 자주 흔들릴 수 있는 포인트

1. `job_type` 과 RBAC role 을 같은 것으로 가정하지 말 것
2. 여러 단계 정책을 union 으로 합치지 말 것
3. 개인 override 를 슬쩍 넣지 말 것
4. `tag` 를 실장비 완료 기능처럼 보이게 만들지 말 것
5. preview 인원 수를 실운영 편집 UI 처럼 오해시키지 말 것
6. 같은 target 중복 정책을 정상 상태처럼 다루지 말 것

## 11. 검증 명령 권장안

- `pnpm --filter @gw/shared test`
- `pnpm --filter @gw/shared typecheck`
- `pnpm --filter @gw/api test -- auth-org.spec.ts`
- `pnpm --filter @gw/api typecheck`
- `pnpm --filter @gw/web test`
- `pnpm --filter @gw/web typecheck`
- `pnpm --filter @gw/web build`
- 필요 시 `pnpm check`
- Cloudflare/Web 변경이 있으면 `pnpm --filter @gw/web build:cf`

## 12. 이번 단계에서 하지 말아야 할 것

- 개인(employee)별 정책 override
- 복수 근무지/복수 부서의 정교한 우선순위 처리
- 실제 조직/인사 실데이터 변경
- production DB 실데이터 migration
- GPS/위치정보 강제 수집
- 실제 NFC/RFID/QR 장비 연동
- 외부 HR/출입 시스템 연동
- secret 입력/교체

특히 아래는 별도 승인 없이는 시작하지 않습니다.

- 실제 태그/NFC/RFID/QR 리더기 또는 출입 단말 연결
- GPS/위치정보 강제 수집·저장
- production DB 실데이터 반영 또는 수정
- 실제 개인정보 원문 처리 확대

## 13. 구현 완료로 보기 좋은 기준

- 관리자 화면에서 적용대상과 우선순위를 설명할 수 있다.
- 적용 인원 preview 와 sample 직원 영향 범위를 읽을 수 있다.
- 직원 화면에서 최종 effective policy 기준 허용 방식만 보인다.
- API 가 같은 effective policy 기준으로 허용/차단한다.
- `tag` 는 여전히 Production-ready (실구현) 경계 안에 있다.
- 테스트가 우선순위와 정책 차단 규칙을 함께 덮는다.

정리하면 이번 handoff 의 핵심은 하나입니다.
출퇴근 정책 2차는 새 기능 버튼을 많이 만드는 작업이 아니라,
"이 직원에게 왜 이 방식만 허용되는가"를 관리자도 직원도 API 도 같은 말로 설명할 수 있게 만드는 작업입니다.
