# 그룹웨어 Phase 23 관리자 운영 콘솔 실사용 1차 범위

## 1. 한 줄 정의

Phase 23의 목표는
이미 있는 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 뼈대를 바탕으로,
관리자가 실제 회사 운영 준비를 할 때
"어디서 들어가고, 무엇을 먼저 보고, 무엇은 아직 저장 전 preview 이고, 무엇은 별도 승인인지"
한 번에 읽히게 만드는 것입니다.

이번 단계도
실제 운영 사용자 권한 저장,
production DB 실데이터 변경,
secret 입력,
외부 연동 실행을 여는 단계는 아닙니다.

## 2. 왜 이번 단계가 필요한가

Phase 22에서 우리는
일반 직원 기준 하루 업무 흐름을
`/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees`
순서로 다시 정리했습니다.

하지만 실제 회사 운영 준비 관점에서는
아래 질문이 아직 더 또렷해야 합니다.

- 관리자는 일반 직원 흐름과 별도로 어디서 운영 콘솔로 들어가는가?
- `/admin/users` 는 직원 조회 화면과 어떻게 다르고, 어디까지가 preview 인가?
- `/admin/policies` 는 근태·휴가·결재·게시판·문서 정책을 어떤 형식으로 비교해야 하는가?
- `/admin/audit-logs` 는 조회 중심 화면으로 무엇을 보여 주고 무엇을 숨겨야 하는가?
- 파일·문서·공지 권한과 관리자 운영 경계가 일반 업무 화면과 충돌하지 않는가?
- route/API guard 와 role/permission/adminScope 기준이 화면 설명과 같은 뜻으로 유지되는가?

즉 Phase 22가
"직원 하루 업무 흐름 정리"였다면,
Phase 23은
"운영 관리자 하루 검토 흐름 정리"입니다.

## 3. 이번에 다시 확인한 현재 기준

확인한 문서/파일:

- `docs/product/groupware-vision-roadmap.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/architecture/phase-9-admin-audit-scope.md`
- `docs/architecture/phase-13-admin-console-pass-1-scope.md`
- `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md`
- `docs/guides/phase-13-admin-console-pass-1-handoff.md`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/policies/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/web/admin-preview-guard.ts`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/admin-Production-ready (실구현)-config.ts`
- `packages/shared/src/admin-access.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/test/contracts.spec.ts`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`

현재 저장소 기준으로 확인되는 사실:

- `/dashboard` 는 이미 권한 기반 관리자 shortcut 을 분기하는 구조를 갖고 있다.
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 화면은 이미 존재하고, 각 화면이 review/candidate/read-only 성격을 분명히 적기 시작했다.
- `packages/shared/src/admin-access.ts` 는 role → permission → adminScope → admin route kind 접근 기준을 한곳에 모아 두고 있다.
- `packages/shared/src/contracts.ts` 는 `/api/admin/users`, `/api/admin/policies`, `/api/admin/policies/documents`, `/api/admin/policies/boards`, `/api/admin/audit-logs` 계약을 이미 갖고 있다.
- `apps/api/src/app.ts` 에는 admin users/policies/audit logs mock 응답과 masked metadata 구조가 이미 있다.
- `apps/web/admin-preview-guard.ts` 와 관련 테스트는 익명 preview 차단, 일반 사용자 차단, 감사 전용 사용자 감사 화면 제한 접근을 계속 지키고 있다.
- `apps/api/test/auth-org.spec.ts` 는 `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 경계와 private resource 차단을 실제 테스트로 확인한다.
- 현재 관리자 화면의 eyebrow 와 기본 설명은 여전히 "Phase 13 관리자 콘솔 1차" 중심이어서, 이번 Phase 23에서는 실제 운영 준비 관점의 흐름과 우선순위를 다시 묶을 필요가 있다.

## 4. Phase 23에서 고정하는 핵심 결정

### 결정 A. 관리자 운영 콘솔은 일반 직원 흐름 뒤에 붙는 "별도 운영 레인"으로 본다.

이번 1차에서 기준이 되는 관리자 흐름은 아래입니다.

1. `/dashboard` 에서 권한 기반 운영 CTA 확인
2. `/admin`
3. `/admin/users`
4. `/admin/policies`
5. `/admin/audit-logs`
6. 필요 시 다시 `/employees`, `/org`, `/boards`, `/documents` 로 일반 조회 화면을 대조 확인

핵심은
`/admin/*` 를 일반 직원 기본 흐름에 섞지 않되,
운영자가 실제 회사 준비를 위해
일반 조회 화면과 운영 검토 화면을 오가며 판단할 수 있게 연결하는 것입니다.

### 결정 B. `/admin` 허브는 "오늘 운영자가 먼저 볼 검토판"이어야 한다.

`/admin` 은 아래를 먼저 보여 줘야 합니다.

- 오늘 확인할 사용자/권한 검토
- 정책 변경 후보와 영향 범위
- 최근 감사 확인 필요 항목
- 파일/문서/공지 운영 경계 요약
- 아직 저장 전 preview 인 것과 승인 필요 항목

반대로 아래는 계속 피합니다.

- 실제 저장 완료처럼 읽히는 문구
- 운영 반영이 끝난 것처럼 보이는 success 표현
- 일반 직원 화면에서 바로 실행하는 액션처럼 섞는 것

### 결정 C. `/admin/users` 는 "직원 조회"가 아니라 "운영 변경 후보 검토"다.

이번 Phase 23에서 `/admin/users` 는 아래 순서를 기본으로 봅니다.

1. 사용자-직원 연결 상태
2. 초대/비활성화/권한 diff 후보
3. 부서/역할/관리 scope 확인
4. 고위험 권한(`invite.manage`, `audit.read`) 검토
5. 변경 사유와 감사 candidate

`/employees` 와의 경계:

- `/employees` = 읽기 중심 일반 조회
- `/admin/users` = 저장 전 운영 변경 후보 검토

### 결정 D. `/admin/policies` 는 정책별로 같은 검토 형식을 유지한다.

우선 묶음:

- 근태
- 휴가
- 결재
- 게시판/공지
- 문서/파일

각 카드 공통 요소:

- 현재 기준
- candidate 변경안
- before/after 또는 current/candidate 비교
- 필요한 capability
- 영향 받는 사용자/공간/업무 흐름
- 감사 preview
- 비노출/마스킹 주의사항

특히 문서/파일/공지 쪽은 아래를 계속 강조합니다.

- `board.manage`, `document.space.manage`, `document.file.write` 는 일반 사용자 기본 흐름과 분리한다.
- raw `storageKey`, bucket 이름, public URL, signed URL 전문은 노출하지 않는다.
- 문서 공간 visibility 와 게시판 visibility 는 같은 "권한 검토" 묶음으로 비교하되, 게시판 책임과 파일 보관 책임을 합쳐 쓰지 않는다.

### 결정 E. `/admin/audit-logs` 는 운영 조회 전용 흐름을 먼저 굳힌다.

우선 확인 포인트:

- actor / action / target / category / 기간 필터
- 최근 운영 이벤트 타임라인
- before/after 요약과 masked fields
- company boundary 와 source 표시
- export/download/external sink 미지원 안내

감사 전용 사용자는
이 화면을 기본 진입점으로 보되,
`/admin` 전체 허용처럼 읽히지 않게 유지합니다.

### 결정 F. route/API guard 재검증은 이번 Phase의 필수 범위다.

이번 단계는 화면 문구만 고치는 문서 카드가 아닙니다.
다음 구현/리뷰/테스트 카드가 반드시 아래를 같이 보게 handoff 해야 합니다.

- `packages/shared/src/admin-access.ts` 의 route kind 와 role/permission/adminScope 기준
- `apps/web/admin-preview-guard.ts` 의 익명/일반/감사/관리자 분기
- `apps/api/src/app.ts` 의 `/api/admin/*` mock 응답과 permission guard
- `apps/api/test/auth-org.spec.ts` 의 `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 차단/허용 테스트

즉 관리자 운영 콘솔은
"보이는 화면"만이 아니라
"누가 어디까지 들어갈 수 있는가"까지 함께 검증해야 합니다.

## 5. 역할별 기대 흐름

### 일반 직원

- `/dashboard` 와 일반 업무 화면을 기본으로 본다.
- 관리자 기능은 계속 별도 레인으로 남는다.
- `/boards`, `/documents`, `/employees` 가 운영 변경 화면처럼 오해되지 않아야 한다.

### 팀장 / 승인자

- 일반 업무 흐름을 유지하되,
- 운영 정책 변경은 `/admin/policies` 에서 별도로 검토한다.
- 승인 처리와 운영 정책 변경을 같은 액션처럼 섞지 않는다.

### 인사 / 운영 관리자

- `/dashboard` 에서 운영 CTA 를 확인한 뒤 `/admin` 계열로 들어간다.
- `/admin/users` 에서 사용자/권한/상태 후보를 검토한다.
- `/admin/policies` 에서 근태·휴가·결재·게시판·문서 정책 candidate 를 비교한다.
- `/admin/audit-logs` 에서 변경 이력을 read-only 로 추적한다.

### 감사 전용 사용자

- `/admin/audit-logs` 를 기본 화면으로 본다.
- `/admin`, `/admin/users`, `/admin/policies` 전체 허용처럼 읽히지 않아야 한다.

### 대장 / 최종 판단자

- 무엇이 지금 preview/dev-safe 범위에서 확인 가능하고,
- 무엇이 아직 Production-ready (실구현) 이며,
- 무엇이 별도 승인인지
관리자 관점에서 바로 구분할 수 있어야 한다.

## 6. 이번 Phase에 포함되는 범위

### 문서/기획 범위

- Phase 23 범위 문서 작성
- Phase 23 쉬운 handoff 문서 작성
- 루트 문서를 Phase 23 활성 체인 기준으로 갱신
- 관리자 운영 흐름, 일반 조회 화면 대 운영 검토 화면 경계, 파일/문서/공지 권한 경계를 쉬운 말로 정리
- route/API guard 재검증 포인트를 다음 카드가 바로 따라가게 정리

### 다음 구현 카드에서 허용하는 범위

- `/dashboard` 운영 CTA 와 `/admin` 허브 설명 보강
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 정보구조와 copy 고도화
- `admin-Production-ready (실구현)-config` 와 admin page content/helper 정리
- 필요 시 shared contract 의 admin summary/audit/policy 필드 최소 보강
- 필요 시 admin API mock 응답과 관련 테스트 보강
- 파일/문서/게시판 권한 경계를 관리자 정책/감사 흐름과 연결하는 UI/API/shared/test/docs 동기화

### 이번 Phase에 포함하지 않는 것

- 실제 운영 사용자 초대 발송
- 실제 사용자 비활성화/권한 저장
- production 정책 저장
- production DB migration 실행
- secret 입력/교체
- DNS/custom domain 변경
- 유료 리소스 생성·증설
- 실제 파일 공개 다운로드 확대
- 외부 HR/메시징/SIEM/감사 적재 연동
- 실제 개인정보 원문 처리 확대

## 7. 성공 기준

아래가 충족되면 이번 Phase 23 기획은 성공으로 봅니다.

- 대장이 관리자 운영 콘솔 기준 흐름을 `/dashboard` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서로 바로 따라갈 수 있다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토,
  `/boards`·`/documents` 협업/보관 흐름과 `/admin/policies` 운영 정책,
  `/admin/audit-logs` read-only 감사 추적이 서로 다른 책임으로 읽힌다.
- route/API guard, role/permission/adminScope 설명이 문서와 코드에서 같은 뜻을 유지한다.
- 파일·문서·공지 권한과 관리자 경계 설명이 raw storage 정보 비노출 원칙과 충돌하지 않는다.
- production data, secret, 실권한 변경, 외부 연동, 유료 리소스가 계속 승인 게이트로 남아 있다.

## 8. 다음 작업자에게 넘길 핵심 포인트

1. 이번 단계의 핵심은 새 운영 저장 기능 추가가 아니라 관리자 운영 콘솔을 실제 회사 준비 관점으로 다시 묶는 것이다.
2. 기준 순서는 `/dashboard` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 다.
3. `/employees`, `/org`, `/boards`, `/documents` 는 계속 일반 조회/협업/보관 맥락이고, 운영 변경은 `/admin/*` 로 분리한다.
4. `packages/shared/src/admin-access.ts`, `apps/web/admin-preview-guard.ts`, `apps/api/src/app.ts`, `apps/api/test/auth-org.spec.ts` 를 같이 봐야 한다.
5. `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 는 단순 문구가 아니라 실제 guard 와 테스트 근거가 있는 권한 경계다.
6. production data, secret, 실제 권한 변경, 외부 연동, 유료 리소스는 계속 승인 게이트다.
