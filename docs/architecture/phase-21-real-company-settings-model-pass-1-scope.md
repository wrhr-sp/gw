# 그룹웨어 Phase 21 실제 회사 설정 모델 1차 범위

## 1. 한 줄 정의

Phase 21의 목표는
지금까지 따로 보이던 회사/조직/직원/권한/근태·휴가 정책 skeleton 을
"실제 회사라면 어떤 설정 묶음으로 관리될지" 기준으로 다시 연결해,
대장이 파일럿 준비 관점에서
무엇이 이미 회사 설정 모델처럼 읽히고
무엇이 아직 preview/skeleton 이며
무엇이 별도 승인 없이는 열리면 안 되는지
한 번에 이해할 수 있게 만드는 것입니다.

중요한 점은 이번 단계도
실제 운영 회사 데이터 입력, 대량 초대, 권한 실변경, 외부 HR 연동을 여는 단계가 아니라,
"실제 회사 구조를 닮은 설정 모델"을 dev-safe/preview 기준으로 고정하는 단계라는 점입니다.

## 2. 왜 이번 단계가 필요한가

Phase 20에서 우리는
preview/skeleton 결과물을 운영 전 점검표 관점으로 다시 정리했습니다.

즉 아래는 이미 많이 맞춰졌습니다.

- 지금 저장소에서 바로 확인 가능한 것 / 아직 skeleton 인 것 / 승인 필요한 것 3분류
- `/login` → `/dashboard` → `/org`·`/employees` → `/attendance`·`/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/admin/users`·`/admin/policies`·`/admin/audit-logs` → `/admin` 확인 순서
- `/admin/*` 운영 화면과 일반 업무 화면의 경계
- live/PWA/API/mobile 을 따로 확인하되 최종 결론은 같은 readiness 언어로 모으는 방식

하지만 아직 아래 질문은 한 번에 답하기 어렵습니다.

- 회사 기본 설정과 조직/직원/권한 모델이 실제 회사 운영 기준으로 어떻게 묶이는가?
- 출퇴근 정책의 `company_default < workplace < department < job_type` 우선순위가 휴가/근무 정책 설명에도 같은 방향으로 이어지는가?
- `/admin/users` 의 사용자-직원-권한 연결과 `/admin/policies` 의 정책 연결이 각각 따로가 아니라 하나의 회사 설정 모델처럼 읽히는가?
- `/employees`, `/attendance`, `/leave` 같은 일반 직원 화면이 "현재 회사 설정상 허용된 것만 보여 주는 흐름"으로 설명되는가?
- GPS/실태그 단말/production data/external HR 같은 운영 연결이 어디서부터 승인 게이트인지 더 분명한가?

즉 Phase 20이
"운영 전 오해 방지 정리"였다면,
Phase 21은
"실제 회사 설정 모델처럼 읽히는 1차 연결 구조 정리"입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-11-org-employees-scope.md`
- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`
- `docs/architecture/attendance-registration-policy-pass-2-scope.md`
- `DATA_MODEL.md`
- `API.md`
- `packages/shared/src/attendance-policy.ts`
- `packages/shared/src/contracts.ts`
- `apps/web/admin-skeleton-config.ts`
- `apps/api/src/app.ts`

현재 저장소 기준으로 확인되는 사실:

- 회사 scope 의 기준 엔티티는 이미 `companies`, `employees`, `departments`, `roles`, `user_roles` 축으로 잡혀 있다.
- `/org`, `/employees` 는 일반 조회 중심 모듈이고, `/admin/users` 는 운영 사용자/권한 검토 candidate 화면으로 분리돼 있다.
- 출퇴근 정책은 이미 `company_default`, `workplace`, `department`, `job_type` 4단계 우선순위와 `effective policy` 계산 helper 를 갖고 있다.
- `/api/admin/policies` 는 근태/휴가/결재/문서/게시판 정책 candidate 조회의 중심 endpoint 로 쓰이고 있다.
- `/api/attendance/*`, `/api/leave/*` 는 정책·권한·회사 scope·placeholder 제한을 분리해 설명하기 시작했다.
- 휴가/근무 정책과 회사 기본 설정은 아직 dedicated 운영 설정 모델보다 preview payload 성격이 더 강하다.
- GPS, 실제 태그 단말, 외부 HR, production DB 실데이터, 대량 사용자 초대 같은 운영 연결은 여전히 승인 게이트로 분리돼 있다.

즉 이번 단계는
새로운 운영 시스템을 통째로 여는 것이 아니라,
이미 있는 조직/권한/정책 조각들을 "실제 회사 설정 모델"이라는 한 문장으로 이어지게 만드는 작업입니다.

## 4. Phase 21에서 고정하는 핵심 결정

### 결정 A. 회사 설정 모델의 최상위 묶음은 4개로 본다.

이번 1차에서 실제 회사 설정 모델은 아래 4개 묶음으로 설명합니다.

1. 회사 기본 설정
   - 회사 기본 정보
   - 회사 scope 기준
   - 기본 정책 출발점
2. 조직/직원/권한 설정
   - 부서/팀
   - 직원 소속/상태
   - 역할/권한
   - 사용자-직원 연결
3. 근태·휴가·근무 정책 설정
   - 출퇴근 허용 방식
   - 휴가 유형/승인 기준
   - 근무지/조직별 예외 정책
4. 운영 관리자 설정
   - `/admin/users`
   - `/admin/policies`
   - `/admin/audit-logs`
   - 감사/승인 게이트

중요한 점은
이 4개를 메뉴를 무조건 늘려서 푼다는 뜻이 아니라,
문서·UI skeleton·API 설명이 이 4묶음 관계를 같은 말로 설명해야 한다는 뜻입니다.

### 결정 B. 회사 기본 설정은 "정책의 시작점"으로 고정한다.

이번 1차에서 회사 기본 설정은 아래 역할을 합니다.

- 모든 정책 계산의 출발점
- 직원/부서/근무지/직무 분류의 상위 회사 scope
- `/api/companies` 와 관리자 정책 card 들을 연결하는 기준
- production company master 저장이 아니라 preview 기준 회사 모델

쉽게 말하면,
회사 기본 설정은 단순 소개 정보가 아니라
"이 회사에서 정책이 어디서 시작되는가"를 설명하는 기준입니다.

### 결정 C. 조직/직원/권한 모델은 일반 조회와 운영 변경을 계속 분리한다.

유지할 경계:

- `/org`, `/employees`
  - 조직 구조와 직원 상태를 이해하는 일반 조회 모듈
- `/admin/users`
  - 사용자-직원 연결, 역할 diff, 상태 변경 preview 를 보는 운영 검토 모듈

Phase 21에서 중요한 것은
이 둘을 합치는 것이 아니라,
둘이 같은 회사 설정 모델 안에 있으면서도 위험도와 책임이 다르다는 점을 더 분명히 적는 것입니다.

즉 일반 화면은
"현재 회사 설정 결과를 읽는 곳"이고,
관리자 화면은
"회사 설정 변경 전 candidate 를 검토하는 곳"입니다.

### 결정 D. 정책 적용 축은 근태에서 시작해 휴가/근무 정책으로 같은 방향을 확장한다.

이번 1차에서 가장 중요한 연결은
이미 구현 근거가 있는 출퇴근 정책 적용 축을
휴가/근무 정책 설명에도 같은 방향으로 가져오는 것입니다.

기준:

- 출퇴근 등록 방식은 `company_default < workplace < department < job_type`
- 휴가 정책 설명도 회사 기본 → 조직 단위 → 역할/직무 예외처럼 읽히게 맞춘다.
- employee 개인 override 는 이번 단계에 넣지 않는다.
- GPS/실태그/GIS/외부 근무기기 연동은 policy 설명과 분리된 승인 게이트로 둔다.

즉 이번 Phase 21의 정책 핵심은
"누가 어떤 회사 설정 때문에 무엇이 허용되는지"를 설명하는 것이지,
실장비나 실연동을 여는 것이 아닙니다.

### 결정 E. 직원 화면은 "허용된 정책만 보이는 흐름"을 더 분명히 한다.

일반 직원 관점에서 유지할 원칙:

- `/attendance` 는 현재 effective policy 기준 허용된 등록 방식만 드러낸다.
- `/leave` 는 현재 회사/조직 정책상 허용되는 유형·승인 기준만 설명한다.
- `/employees` 는 정책 편집 화면처럼 보이면 안 된다.
- 정책상 미허용, 권한 부족, 회사 scope 불일치, placeholder 제한은 계속 4축으로 나눠 설명한다.

쉽게 말하면,
직원 화면은 "관리자가 설정할 수 있는 모든 것"을 보여 주는 곳이 아니라,
"현재 내 회사 설정에서 내가 지금 볼 수 있는 것"만 보여 주는 곳으로 읽혀야 합니다.

### 결정 F. 관리자 UI/API skeleton 은 새 상위 메뉴보다 현재 `/admin/policies`·`/admin/users` 고도화를 우선한다.

이번 1차에서 우선 보는 구현 방향:

- `/admin/policies` 안에서 회사 기본/조직 단위/정책 적용 범위 설명 강화
- `/admin/users` 에서 직원 연결, 역할 diff, 고위험 권한 preview 정렬
- `/api/admin/policies*` 와 `/api/companies`, `/api/departments`, `/api/roles`, `/api/permissions` 설명 축 정렬
- 필요하면 admin 허브 카드의 설명 copy 보강

이번 단계에서 바로 하지 않는 것:

- 새 production 설정 메뉴 대량 추가
- 실제 저장 중심 company settings 콘솔 완성
- 실데이터 일괄 반영 UX

즉 구조를 갈아엎기보다
기존 관리자 뼈대 위에 "실제 회사 설정 모델" 설명을 더 정확히 얹는 것이 우선입니다.

### 결정 G. 승인 게이트는 회사 설정 모델 설명과 섞지 않는다.

계속 별도 승인으로 유지하는 것:

- production DB 실데이터 입력/변경
- secret 입력/교체
- 실제 사용자 대량 초대/권한 실변경
- GPS/위치정보 실검증
- 태그 단말/NFC/RFID/QR 실장비 연결
- 외부 HR/급여/메시징/파일 저장 실연동
- DNS/custom domain/app link 확정
- 유료 리소스 생성·증액

핵심은
"실제 회사 설정 모델"이라는 말이
곧바로 "실운영 연결 완료"라는 뜻처럼 읽히지 않게 하는 것입니다.

## 5. 역할별 기대 흐름

### 일반 직원

- 내가 속한 회사 설정 결과로 어떤 근태/휴가 정책이 보이는지 이해할 수 있어야 한다.
- 정책 편집 기능과 일반 조회 기능이 섞이지 않아야 한다.

### 팀장/승인자

- 팀 승인 권한과 운영 관리자 권한이 다른 것임을 이해할 수 있어야 한다.
- 휴가/근태에서 정책 미허용과 권한 부족이 다른 이유로 읽혀야 한다.

### 인사/운영 관리자

- 회사 기본 설정, 조직/직원 연결, 권한, 정책 candidate 를 같은 회사 설정 모델 안에서 따라갈 수 있어야 한다.
- `/admin/users` 와 `/admin/policies` 가 서로 다른 책임이지만 같은 회사 scope 를 공유한다는 점이 보여야 한다.

### 대장/최종 판단자

- "실제 회사처럼 설정할 수 있는 구조는 어디까지 정리됐는가"와 "아직 승인 필요한 운영 연결은 무엇인가"를 빠르게 볼 수 있어야 한다.

## 6. 이번 Phase에 포함되는 범위

### 문서/기획 범위

- Phase 21 범위 문서 작성
- Phase 21 쉬운 handoff 문서 작성
- 루트 문서를 Phase 21 활성 체인 기준으로 갱신
- 회사 기본 설정/조직/직원/권한/정책 연결 구조를 쉬운 말로 정리
- 직원 화면에는 허용된 정책만 보이고 관리자 화면은 candidate 검토라는 경계를 다시 고정

### 다음 구현 카드에서 허용하는 범위

- `/admin/policies`, `/admin/users`, 관련 shared/API/Web copy 보강
- 회사 기본 설정 summary 와 정책 source 설명 정렬
- attendance policy helper 를 기준으로 leave/work policy explanation 구조 정렬
- 직원 UI/API 가 허용된 정책만 보여 준다는 검증 포인트 보강
- Web/API/shared/test/docs 동기화

### 이번 Phase에 포함하지 않는 것

- production company master 저장
- 실제 회사 실데이터 이관/대량 입력
- 실제 사용자 대량 초대/권한 변경 실행
- 개인별 policy override 저장
- GPS/실태그 단말/외부 HR 실연동
- production DB migration 실행
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 증설

## 7. 성공 기준

아래가 충족되면 이번 Phase 21 기획은 성공으로 봅니다.

- 대장이 회사 기본 설정/조직/직원/권한/정책이 어떤 묶음으로 연결되는지 한 번에 이해할 수 있다.
- 직원 화면은 허용된 정책만 보이고, 관리자 화면은 candidate 검토라는 경계가 문서에서 같은 뜻으로 보인다.
- 출퇴근 정책 우선순위와 휴가/근무 정책 설명 방향이 충돌하지 않는다.
- GPS/실태그/production data/external HR 같은 실제 운영 연결이 여전히 승인 게이트로 분리돼 있다.

## 8. 다음 작업자에게 넘길 핵심 포인트

1. 이번 단계의 핵심은 "실운영 연결"이 아니라 "실제 회사 설정 모델처럼 읽히는 구조 정리"다.
2. 회사 기본 설정은 정책 출발점이고, 조직/직원/권한/정책은 그 아래에서 이어지는 구조로 설명한다.
3. `/org`·`/employees` 일반 조회와 `/admin/users` 운영 검토를 다시 섞지 않는다.
4. 출퇴근 정책 helper 의 우선순위 모델을 휴가/근무 정책 설명에도 같은 방향으로 확장한다.
5. 직원 화면은 허용된 정책만 보여 주고, 관리자 화면은 candidate 와 diff 를 보여 주는 책임을 유지한다.
6. GPS/실태그/production data/external HR 는 계속 승인 게이트다.
