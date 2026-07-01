# Phase 21 실제 회사 설정 모델 1차 handoff

한 줄 요약:
이번 Phase 21은
회사/조직/직원/권한/근태·휴가 정책 Production-ready (실구현) 을
"실제 회사라면 어떤 설정 묶음으로 관리될지" 기준으로 다시 묶는 단계입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 확인 가능한 것:

- 회사 scope, 직원, 부서, 역할, 권한의 기본 계약과 조회 API
- `/org`, `/employees`, `/admin/users` 의 일반 조회 대 운영 검토 경계
- 출퇴근 정책의 `company_default < workplace < department < job_type` 우선순위
- `/admin/policies` 와 `/api/attendance/*`, `/api/leave/*` 를 잇는 운영 설명의 뼈대
- 직원 화면에서 권한/회사 scope/정책 미허용/Production-ready (실구현) 제한을 나눠 설명하는 방향

아직 운영 완료로 보면 안 되는 것:

- 실제 회사 master 저장
- 실제 권한 부여/회수 저장
- 개인별 policy override
- 실데이터 대량 입력
- GPS/실태그/외부 HR 같은 실연동

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
"실제 회사 설정 모델처럼 읽히는 구조를 설명할 수 있는 상태"에 더 가깝고,
"이미 실운영 회사 설정이 저장/반영되는 상태"는 아닙니다.

## 2. 이번 Phase를 어떻게 이해하면 되는가

### 1) 회사 설정 모델은 4묶음으로 본다.

이번 Phase 21에서 기억할 큰 묶음은 아래 4개입니다.

- 회사 기본 설정
- 조직/직원/권한 설정
- 근태·휴가·근무 정책 설정
- 운영 관리자 설정(`/admin/users`, `/admin/policies`, `/admin/audit-logs`)

핵심은
메뉴를 무조건 늘리는 것이 아니라,
문서와 UI/API Production-ready (실구현) 이 이 4묶음을 같은 말로 설명하게 만드는 것입니다.

### 2) 회사 기본 설정은 정책의 시작점이다.

이번 단계에서 회사 기본 설정은
단순 회사 소개 카드가 아니라,
정책과 권한 설명이 어디서 시작되는지 보여 주는 기준입니다.

쉽게 말하면:

- 회사 기본 = 출발점
- 근무지/부서/직무 = 더 구체적인 회사 설정
- 직원 화면 = 그 결과를 읽는 곳
- 관리자 화면 = 그 변경 후보를 검토하는 곳

### 3) 일반 조회와 운영 변경은 계속 분리한다.

계속 유지할 경계:

- `/org`, `/employees`
  - 조직과 직원 상태를 이해하는 화면
- `/admin/users`
  - 사용자-직원 연결, 역할 diff, 상태 변경 preview 를 보는 화면
- `/admin/policies`
  - 회사/조직 단위 정책 candidate 를 보는 화면

즉
직원 화면은 "현재 허용된 결과"를 보여 주고,
관리자 화면은 "어떻게 바꿀지 검토하는 후보"를 보여 줍니다.

### 4) 근태 정책 우선순위 모델을 휴가/근무 정책 설명에도 같은 방향으로 확장한다.

현재 가장 강한 구현 근거는 출퇴근 정책 helper 입니다.
이번 Phase 21에서는 이 방향을 휴가/근무 정책 설명에도 최대한 맞춥니다.

유지할 원칙:

- 회사 기본 → 근무지/지점 → 부서/팀 → 직무/역할
- 더 구체적인 조직 단위가 이긴다.
- employee 개인 override 는 이번 단계에 넣지 않는다.
- GPS/실태그는 policy 설명과 별도 승인 게이트로 둔다.

## 3. 대장이 가장 먼저 볼 5가지 질문

1. 회사 기본 설정/조직/직원/권한/정책이 어떤 묶음으로 연결되는지 바로 보이는가?
2. 일반 직원 화면과 관리자 설정 화면의 책임이 분리돼 보이는가?
3. 현재 허용되는 정책만 직원 화면에 보인다는 설명이 분명한가?
4. 출퇴근 정책 우선순위와 휴가/근무 정책 설명 방향이 충돌하지 않는가?
5. GPS/실태그/production data/external HR 같은 실제 운영 연결이 별도 승인 게이트로 남아 있는가?

이 5개 질문에 바로 답이 안 보이면
이번 단계 정리가 덜 된 상태입니다.

빠르게 눌러 볼 추천 순서:

1. `/login`
2. `/dashboard`
3. `/org`, `/employees`
4. `/attendance`, `/leave`
5. `/approvals`
6. `/boards`, `/documents`
7. `/me`
8. `/admin/users`, `/admin/policies`, `/admin/audit-logs`
9. `/admin`

이 순서대로 볼 때도 각 단계가 반드시 "지금 확인 가능 / 아직 Production-ready (실구현) / 승인 필요" 중 어디인지 읽혀야 합니다.

## 4. 먼저 볼 파일

### 이번 Phase 21 문서

- `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md`
- `docs/guides/phase-21-real-company-settings-model-pass-1-handoff.md`

### 루트 문서

- `ROADMAP.md`
- `TASKS.md`
- `SPEC.md`
- `TEST_PLAN.md`
- `QA_CHECKLIST.md`
- `HANDOFF.md`
- `KNOWN_ISSUES.md`

### 현재 기준을 보여 주는 구현 근거

- `DATA_MODEL.md`
- `API.md`
- `packages/shared/src/attendance-policy.ts`
- `packages/shared/src/contracts.ts`
- `apps/web/admin-Production-ready (실구현)-config.ts`
- `apps/api/src/app.ts`

## 5. 권장 구현 순서

1. 회사 기본 설정/조직/직원/권한/정책을 어떤 4묶음으로 설명할지 먼저 맞춘다.
2. `/org`, `/employees`, `/admin/users` 경계를 다시 확인해 일반 조회와 운영 변경이 섞이지 않게 한다.
3. `/admin/policies` 설명을 회사 기본 → 조직 단위 → 직원 허용 결과 흐름으로 읽히게 보강한다.
4. `/attendance`, `/leave` 가 현재 허용된 정책만 보여 주는 흐름인지 확인한다.
5. GPS/실태그/production data/external HR 같은 승인 게이트를 구현 TODO 와 섞지 않고 따로 남긴다.
6. 마지막에 문서/route/API/helper 설명이 같은 뜻인지 검토한다.

## 6. 각 역할 카드에 넘길 핵심 포인트

### 구현자(gwbuilder)

집중할 것:

- `/admin/policies`, `/admin/users`, 관련 shared/API/Web copy 를 실제 회사 설정 모델처럼 정리
- 회사 기본 설정 summary 와 정책 source 설명 정렬
- 직원 화면이 허용된 정책만 보여 준다는 근거 강화

피해야 할 것:

- production 저장/실데이터 입력/실권한 변경
- GPS/실태그/외부 HR 실연동
- 개인 override 저장을 이번 카드에서 열기

### 리뷰어(gwreviewer)

집중할 것:

- 일반 조회와 운영 변경 경계가 흐려지지 않는지
- 출퇴근 정책 우선순위와 휴가 정책 설명이 충돌하지 않는지
- 실제 회사 설정 모델이라는 표현이 실운영 완료처럼 과장되지 않는지

### 테스터(gwtester)

집중할 것:

- 문서 결론과 실제 route/API/helper 설명이 같은지
- 직원 화면이 정책 허용 결과만 보여 준다는 설명이 검증 포인트에 반영됐는지
- 승인 게이트가 구현 TODO 와 섞이지 않았는지

### 문서화(gwdocs)

집중할 것:

- 회사 기본 설정/조직/직원/권한/정책 4묶음을 쉬운 한국어로 정리
- 직원용 화면과 관리자용 화면의 차이를 한눈에 읽히게 정리
- 승인 필요 항목을 별도 목록으로 유지

### 운영(gwops)

집중할 것:

- 실운영 연결이 아닌 preview/dev-safe Production-ready (실구현) 범위임을 계속 분리 기록
- live 확인이 있더라도 production data/GPS/실장비/external HR 미연결 상태를 숨기지 않기

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

## 8. 다음 작업자가 기억할 6가지

1. 이번 Phase 21의 핵심은 실운영 연결이 아니라 실제 회사 설정 모델처럼 읽히는 구조 정리다.
2. 회사 기본 설정은 정책 출발점이고, 조직/직원/권한/정책은 그 아래에서 이어진다.
3. `/org`, `/employees` 일반 조회와 `/admin/users` 운영 검토를 다시 섞지 않는다.
4. 출퇴근 정책 helper 의 우선순위 모델을 휴가/근무 정책 설명에도 같은 방향으로 쓴다.
5. 직원 화면은 허용된 정책만 보여 주고, 관리자 화면은 candidate/diff 를 보여 주는 책임을 유지한다.
6. GPS/실태그/production data/external HR 는 계속 승인 게이트다.
