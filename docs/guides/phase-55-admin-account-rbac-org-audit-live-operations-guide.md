# Phase 55 관리자 계정·권한·조직 실사용 가이드 + UAT 절차 + 운영 체크리스트

## 한 줄 요약
이번 Phase 55에서는 `/login` → `/dashboard` → `/admin/users` 순서로 들어가,
계정 preview 확인 → 역할/권한 diff 확인 → `/employees` 일반 조회 → `/org` 구조 확인 → `/management` 운영 허브 → `/admin/audit-logs` 감사 추적 흐름이 실제로 이어지는지,
그리고 일반 조회 lane, 운영 검토 lane, 감사 read-only lane 이 서로 섞이지 않는지만 먼저 확인하면 된다.

## 이 문서가 다루는 범위
- 관리자 계정·권한 확인 가이드
- 직원/조직 read model 확인 가이드
- 운영 허브 / 감사 로그 확인 가이드
- 권한 없음 / 차단 확인 포인트
- empty/loading/error/forbidden/dev-safe 읽는 법
- UAT 절차
- 운영 체크리스트
- 최종 보고에 넣을 항목

이 문서는 production 계정 초대 발송, 실제 비밀번호 운영 전환, 외부 IdP/SSO, production DB 변경 문서가 아니다.
지금 이미 있는 admin/org route/API/test 기준선을
"대장이 live URL에서 직접 어디를 눌러 무엇을 확인하면 되는가" 중심으로 다시 묶은 문서다.

## 먼저 기억할 12가지
1. 익명 시작점은 `/login` 뿐이다.
2. 테스트 계정은 `admin / 1234` 다.
3. 이 계정은 dev/test/UAT 전용이며 production 기본 계정이 아니다.
4. 관리자 계정 실사용 시작점은 `/dashboard` 다음 `/admin/users` 다.
5. `/admin/users` 는 실제 저장 완료 화면이 아니라 사용자 생성·역할 변경·상태 변경·비밀번호 reset preview 를 먼저 보는 운영 시작점이다.
6. `/employees` 는 일반 직원 조회 lane 이고 `/admin/users` 와 같은 책임이 아니다.
7. `/org` 는 부서·역할·권한·지점 구조를 읽는 read-only lane 이다.
8. `/management` 는 운영 허브이고 일반 직원 홈과 같은 흐름이 아니다.
9. `/admin/audit-logs` 는 감사 read-only lane 이고 운영 변경 저장 화면이 아니다.
10. `MANAGER` 가 `/employees` 를 볼 수 있어도 `/admin/users` 까지 자동 허용되는 것은 아니다.
11. `AUDITOR` 의 기본 시작점이 `/admin/audit-logs` 라고 해서 `/admin` 전체 허용처럼 읽으면 안 된다.
12. live 직접 확인 근거와 local build/test 대체 근거는 같은 뜻으로 적지 않는다.

## 접속 정보와 현재 근거
- 현재 공개 preview URL 기록: `https://gw-web.wereheresp.workers.dev`
- 로그인 시작점: `/login`
- 테스트 계정: `admin / 1234`
- 현재 핵심 route:
  - `/dashboard`
  - `/admin/users`
  - `/employees`
  - `/org`
  - `/management`
  - `/admin/audit-logs`
- 현재 핵심 API:
  - `/api/admin/users`
  - `/api/employees`
  - `/api/departments`
  - `/api/roles`
  - `/api/permissions`
  - `/api/branches`
  - `/api/admin/audit-logs`
  - `/api/health`
- parent tester 기준 검증:
  - focused web 회귀 확장 결과: 27 files / 116 passed
  - focused API 회귀 확장 결과: 14 files passed, 1 skipped, 100 tests passed / 4 skipped
  - `pnpm --filter @gw/web typecheck` 통과
  - `pnpm --filter @gw/api typecheck` 통과
  - `pnpm check` 통과
  - `pnpm --filter @gw/web build` 통과
  - local `next start` smoke 재확인 통과
- parent tester 기준 local smoke 핵심 메모:
  - 익명 `/admin/users`, `/employees`, `/org`, `/management`, `/admin/audit-logs` 는 `/login` 으로 redirect
  - `/employees`, `/org` 는 인증된 read lane 으로 유지
  - `/management`, `/admin/users`, `/admin/audit-logs` 는 role/host/API guard 기준이 실제 응답과 일치
  - `AUDITOR` 는 admin host 에서만 `/admin/audit-logs` 진입, 일반 host 에서는 `/forbidden`
  - `MANAGER` 는 `/employees` 는 볼 수 있어도 `/admin/users` 는 차단
  - `HR_ADMIN` 는 `/admin/users` 는 볼 수 있어도 `audit.read` 없으면 `/admin/audit-logs` 차단

중요:
- 위 수치는 현재 문서가 기대는 최신 parent 검증 근거다.
- 이번 문서 작업에서 live URL을 다시 직접 fetch 한 것은 아니다.
- 따라서 최종 사용자 보고 전에는 live 직접 확인 메모를 별도로 다시 붙여야 한다.

## 1. 관리자 계정·권한 확인 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/admin/users`
4. 사용자 생성 preview 확인
5. 역할/권한 diff 확인
6. 활성/비활성 preview 확인
7. 비밀번호 reset preview 확인
8. `/employees`
9. `/org`

### 각 화면을 어떻게 읽으면 되는가

#### `/dashboard`
- 홈이다.
- 관리자도 먼저 공통 landing 으로 들어오지만, 여기서 곧바로 운영 저장 화면으로 이해하면 안 된다.
- 일반 홈 shortcut 과 민감 운영 진입점은 섞이지 않아야 한다.

#### `/admin/users`
- 관리자 계정·권한 실사용 시작 화면이다.
- 먼저 읽어야 할 순서는 "사용자 생성 preview → 역할/권한 diff → 상태 변경 preview → 비밀번호 reset preview" 다.
- 이 화면은 실제 저장 완료나 실계정 배포 완료를 보여 주는 화면이 아니다.

#### 사용자 생성 preview 확인
- 새 사용자가 어떤 조직/역할 문맥으로 들어갈지 먼저 검토하는 단계다.
- preview 다음에는 `/employees`, `/org` 로 가서 read model 이 어떻게 읽히는지 이어서 본다.

#### 역할/권한 diff 확인
- 어떤 role/permission 이 바뀌는지 확인하는 단계다.
- `permission.read`, `audit.read`, 고위험 capability 는 diff 와 차단 문구가 함께 읽혀야 한다.
- diff 가 보여도 실제 영구 저장 완료처럼 쓰면 안 된다.

#### 활성/비활성 preview 확인
- 계정 상태 변경이 어떤 업무 차단으로 이어질지 미리 확인하는 단계다.
- 비활성화 preview 뒤에는 로그아웃/재로그인 시나리오와 landing 차단이 어떻게 읽히는지만 본다.

#### 비밀번호 reset preview 확인
- 비밀번호 재설정 preview 결과를 보는 단계다.
- 실제 임시 비밀번호 값이 URL/배너/문서에 오래 남으면 안 된다.
- production 비밀번호 정책 전환과 같은 뜻으로 적지 않는다.

### 관리자 계정 확인에서 바로 확인할 질문
- `/admin/users` 가 정말 관리자 계정 시작 화면처럼 읽히는가
- 사용자 생성 preview 와 역할/권한 diff 가 실제 저장 완료처럼 과장되지 않는가
- `/employees` 일반 조회와 `/admin/users` 운영 검토가 바로 구분되는가
- `permission.read` 와 `audit.read` 차이가 문장으로도 분리되는가

## 2. 직원 / 조직 read model 확인 가이드

### 추천 순서
1. `/employees`
2. 직원 상태/소속 목록 확인
3. 부서 / 재직 상태 / 역할 필터 확인
4. `/org`
5. 부서 구조 확인
6. 역할/직책 요약 확인
7. 권한 카탈로그 / 지점 scope 확인

### 어떻게 읽으면 되는가

#### `/employees`
- 일반 직원 조회 lane 이다.
- 먼저 보아야 하는 것은 이름, 소속, 상태, 역할 요약 같은 read model 이다.
- 이 화면에서 권한 저장, 초대 발송, 민감 편집이 열리면 안 된다.

#### `/org`
- 조직 구조 read-only lane 이다.
- 부서, 역할, 권한, 지점 scope 를 이해하는 것이 목적이다.
- 정책 변경이나 사용자 저장은 `/admin/users`, `/admin/policies` 로 분리되어야 한다.

#### branch scope 와 company scope 확인
- branch scope 는 필요한 범위만 보는 운영 문맥이다.
- company scope 와 같은 full access 처럼 읽히면 안 된다.
- 특히 지점관리자 lane 과 본사 운영 lane 을 같은 관리자 권한처럼 적지 않는다.

### 여기서 바로 확인할 질문
- `/employees` 가 일반 조회 lane 으로 읽히는가
- `/org` 가 구조 확인 lane 으로 읽히는가
- 일반 조회와 운영 저장 검토가 같은 책임처럼 보이지 않는가
- branch scope 와 company scope 가 같은 full access 처럼 과장되지 않는가

## 3. 운영 허브 / 감사 로그 확인 가이드

### 운영 관리자 추천 순서
1. `/dashboard`
2. `/management`
3. `/admin/users`
4. `/admin/audit-logs`
5. `/api/health`

### 감사 담당자 추천 순서
1. `/login`
2. `/admin/audit-logs`
3. 필요 시 `/employees`
4. 필요 시 `/org`

### 어떻게 읽으면 되는가

#### `/management`
- 일반 직원 홈의 연장이 아니라 별도 운영 허브다.
- 운영 관리자/지점관리자에게만 필요한 민감 레인을 모아 둔 entry 로 읽는다.
- `/employees`, `/org` 읽기 화면과 `/admin/users` preview 화면을 한 책임처럼 섞지 않는다.

#### `/admin/audit-logs`
- 감사 read-only lane 이다.
- 목적은 누가 무엇을 바꾸려 했는지, 어떤 이벤트가 있었는지 추적하는 것이다.
- before/after 는 raw 원문이 아니라 masked preview 로만 읽어야 한다.
- raw storage key, bucket, signed URL, public URL 전문은 그대로 드러나면 안 된다.

#### `/api/health`
- 최소 liveness 확인용이다.
- 전체 모니터링/관제/복구 자동화 완료 의미로 과장하면 안 된다.

### 운영 / 감사에서 바로 확인할 질문
- `/management` 가 일반 홈과 분리된 운영 허브로 읽히는가
- `/admin/audit-logs` 가 read-only 추적 lane 으로 읽히는가
- `AUDITOR` 를 전체 운영 관리자처럼 오해하게 만들지 않는가
- 감사 화면이 storage/raw secret 원문 열람 화면처럼 보이지 않는가

## 4. 권한 없음 / 차단 확인 가이드

### 먼저 확인할 대상
- 익명 `/admin/users` 접근
- 익명 `/employees` 접근
- 익명 `/org` 접근
- 익명 `/management` 접근
- 익명 `/admin/audit-logs` 접근
- `MANAGER` 의 `/admin/users` 접근
- `HR_ADMIN` 의 `/admin/audit-logs` 접근
- 일반 host 에서 `AUDITOR` 의 `/admin/audit-logs` 접근

### 읽는 기준
- UI에서 먼저 막히는지 본다.
- route 차단 안내와 API 차단 이유가 같은 뜻인지 본다.
- 차단 상태인데도 성공 버튼이나 저장 완료 문구가 먼저 보이면 안 된다.
- 차단되면 사용자가 어디로 돌아가야 하는지도 보여야 한다.

### 이번 Phase에서 특히 같이 봐야 하는 예시
- 익명 route 차단: `/admin/users`, `/employees`, `/org`, `/management`, `/admin/audit-logs` 는 로그인 유도
- 관리자 경계 차단: `MANAGER` 는 `/employees` 는 가능해도 `/admin/users` 는 차단
- 감사 경계 차단: `HR_ADMIN` 는 `audit.read` 없으면 `/admin/audit-logs` 차단
- host 경계 차단: `AUDITOR` 는 admin host 외 경로에서 `/forbidden`
- 내부정보 비노출: raw storage key/bucket/public URL/signed URL/secret 비노출

## 5. 상태 문장은 이렇게 구분한다

### empty
- 정상적으로 열렸지만 지금 보여 줄 항목이 없는 상태다.
- 권한 부족이나 오류와 같은 뜻이 아니다.

### loading
- 실제 same-origin API 응답을 불러오는 중이다.
- 성공도 실패도 아니다.

### error
- 조회 또는 preview 불러오기가 실패한 상태다.
- forbidden 과 같은 뜻으로 쓰면 안 된다.

### forbidden
- 로그인은 되었지만 지금 이 운영 레인 권한이 없는 상태다.
- 예: `MANAGER` 의 `/admin/users`, `HR_ADMIN` 의 `/admin/audit-logs`

### dev-safe
- 내부 검증용 preview, placeholder, 안전한 데모 상태가 남아 있는 것이다.
- 실저장, 실초대, 실비밀번호 운영 전환과 같은 뜻이 아니다.

## 6. 역할별로 어디까지 보면 되는가
- EMPLOYEE: `/dashboard` 기준 일반 업무만 보고 `/admin/users`, `/management`, `/admin/audit-logs` 는 기본 차단 확인
- MANAGER: `/employees`, `/org`, `/work-items/branch`, `/management` 중심 확인 후 `/admin/users` 차단 확인
- HR_ADMIN: `/admin/users` 중심으로 계정 preview 와 권한 diff 확인, `/admin/audit-logs` 는 차단이면 차단 이유 확인
- COMPANY_ADMIN: `/management`, `/admin/users`, `/admin/audit-logs` 전체 운영 흐름 확인
- AUDITOR: `/admin/audit-logs` read-only 확인, 필요 시 `/employees`, `/org` read lane 확인

## 7. UAT 절차

### 7-1. 시작 전 준비
- live URL 이 `https://gw-web.wereheresp.workers.dev` 인지 다시 확인한다.
- 이번 기록이 live 직접 확인인지, local build/test 대체 근거인지 먼저 구분한다.
- 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰이는지 확인한다.

### 7-2. 공통 시작 시나리오
1. `/login` 이 익명 유일 입구인지 확인
2. 로그인 후 `/dashboard` 또는 역할별 landing 이 맞는지 확인
3. `/admin/users`, `/employees`, `/org`, `/management`, `/admin/audit-logs` 가 각자 다른 책임으로 읽히는지 확인
4. empty/loading/error/forbidden/dev-safe 문장이 서로 다른 뜻인지 확인

### 7-3. 관리자 계정 happy path UAT
추천 순서:
- `/dashboard` → `/admin/users` → 사용자 생성 preview → 역할/권한 diff → 상태 변경 preview → 비밀번호 reset preview → `/employees` → `/org`

기록할 질문:
- 관리자 계정 시작 화면이 자연스럽게 읽히는가
- preview 뒤 read model 확인 순서가 자연스러운가
- 저장 완료처럼 과장되는 문장이 없는가

### 7-4. 조직 / 일반 조회 UAT
추천 순서:
- `/employees` → 부서/상태/역할 필터 확인 → `/org` → 부서 구조 → 역할/권한 → 지점 scope

기록할 질문:
- 일반 조회와 구조 확인이 실제 운영 저장과 분리돼 보이는가
- branch scope/company scope 차이가 이해되는가
- 일반 조회 lane 이 민감 운영 lane 으로 오해되지 않는가

### 7-5. 운영 / 감사 UAT
추천 순서:
- `/management` → `/admin/users` → `/admin/audit-logs` → `/api/health`

기록할 질문:
- 운영 허브가 일반 홈과 분리되는가
- 감사 로그가 read-only 로 읽히는가
- masked preview 와 비노출 원칙이 유지되는가

### 7-6. 차단 / guard UAT
추천 순서:
- 익명 `/admin/users` 접근
- 익명 `/employees`, `/org`, `/management`, `/admin/audit-logs` 접근
- `MANAGER` 의 `/admin/users` 접근
- `HR_ADMIN` 의 `/admin/audit-logs` 접근
- 일반 host 에서 `AUDITOR` 의 `/admin/audit-logs` 접근

기록할 질문:
- 차단이 성공 화면보다 먼저 보이는가
- UI/route/API 가 같은 이유를 말하는가
- 로그인 부족, 권한 부족, host 경계, 정상 빈 상태가 서로 다른 뜻으로 읽히는가

### 7-7. 이슈 분류 기준
- blocker: 지금 관리자 계정/조직 시나리오를 더 진행할 수 없게 막는 문제
- major: 진행은 되지만 실사용 의미를 크게 흔드는 문제
- minor: 흐름은 되지만 다듬어야 하는 문제
- copy-doc: 화면 문구/문서 정합성 문제
- approval-needed: 기능 문제가 아니라 별도 승인 없이는 진행하면 안 되는 항목

## 8. 운영 체크리스트

### 운영 전
- [ ] `/login` 이 유일한 익명 시작점으로 유지된다.
- [ ] 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰인다.
- [ ] live 직접 확인 근거와 local build/test 대체 근거를 분리해 적는다.

### 운영 중
- [ ] `/admin/users` 가 관리자 계정 실사용 시작점처럼 읽힌다.
- [ ] `/employees` 일반 조회, `/org` 구조 확인, `/management` 운영 허브, `/admin/audit-logs` 감사 read-only 책임이 구분된다.
- [ ] 사용자 생성 preview → 역할/권한 diff → 조직 read model 확인 → 운영 허브 → 감사 추적 흐름이 실제로 이어진다.
- [ ] `MANAGER` `/admin/users` 차단, `HR_ADMIN` `/admin/audit-logs` 차단, `AUDITOR` read-only 허용이 유지된다.
- [ ] admin role, `permission.read`, `audit.read`, company scope, branch scope 차이가 과장되지 않는다.
- [ ] masked preview 와 raw storage key/bucket/public URL/signed URL/secret 비노출 원칙이 유지된다.
- [ ] empty/loading/error/forbidden/dev-safe 가 서로 다른 뜻으로 읽힌다.

### 운영 후
- [ ] 관리자 계정 happy path, 조직 read model, 운영/감사, 차단 확인 결과를 따로 기록했다.
- [ ] blocker 와 approval-needed 를 분리했다.
- [ ] 최종 보고에 live URL, 테스트 계정, 추천 route, 직접 해볼 액션, 남은 승인 게이트를 넣을 수 있게 정리했다.

## 9. 최종 보고에 꼭 넣을 항목
- live URL
- 로그인 시작점 `/login`
- 테스트 계정 `admin / 1234`
- 관리자 계정 확인 추천 순서
- 조직/일반 조회 추천 순서
- 운영/감사 추천 순서
- 직접 해볼 액션: 사용자 생성 preview, 역할/권한 diff, 직원 조회, 조직 구조 확인, 운영 허브 확인, 감사 로그 확인, 차단 확인
- live 직접 확인 근거
- local build/test/release gate 대체 근거
- 아직 mock/dev-safe 이거나 승인 게이트인 부분

## 10. 최종 보고 템플릿
- 결론:
- live URL:
- 로그인 시작점:
- 테스트 계정:
- 관리자 계정 확인 순서:
- 조직/일반 조회 확인 순서:
- 운영/감사 확인 순서:
- 직접 해볼 액션:
- 확인한 근거:
  - live 직접 확인:
  - local/build/test 대체 근거:
- 주요 이슈:
  - blocker:
  - major:
  - minor:
  - copy-doc:
  - approval-needed:
- 남은 승인 게이트:
- 대장이 직접 보면 되는 route:

## 11. 남아 있는 승인 게이트
- production DB 실데이터
- secret 입력/교체
- 실제 계정 초대 메일/메신저 발송
- 실제 비밀번호 운영 전환
- 외부 IdP/SSO/SAML/SCIM 연동
- DNS/custom domain
- 유료 리소스
- destructive/migration