# Phase 55 관리자 계정·권한·조직 실사용화 handoff

## 한 줄 요약

Phase 55의 목적은 `/admin/users` 를 실제 관리자 계정·권한 시작점처럼 읽히게 만들고,
`/employees`, `/org`, `/management`, `/admin/audit-logs` 를 역할별 운영 레인으로 분리해 live URL 기준으로 한 번에 따라가게 정리하는 것이다.

## 지금 바로 봐야 할 파일

1. `apps/web/app/admin/users/admin-users-page-content.tsx`
2. `apps/web/app/employees/page.tsx`
3. `apps/web/app/org/page.tsx`
4. `apps/web/app/management/page.tsx`
5. `apps/web/app/admin/audit-logs/page.tsx`
6. `apps/api/src/app.ts`
7. `apps/api/test/auth-org.spec.ts`
8. `packages/shared/src/contracts.ts`

## 지금 코드에서 이미 있는 것

- `/admin/users` 에 사용자 생성 preview, 역할/권한 diff, 상태 변경/비밀번호 reset preview 흐름이 있다.
- `/employees` 와 `/org` 는 read-only 확인 레인, `/management` 는 운영 허브, `/admin/audit-logs` 는 감사 read-only 레인으로 설명이 이미 갈라져 있다.
- shared contract 에 직원/부서/역할/권한/지점/admin users/audit logs route 묶음이 있다.
- API 에 직원 조회, 부서/역할/권한/지점 조회, admin users, admin audit logs 경로가 있다.
- 테스트에 branch scope, employee filter, admin-only 사용자 목록, audit.read 차단/허용, createdFrom/createdTo 필터 근거가 있다.

## 이번 Phase에서 꼭 같은 뜻으로 맞출 것

### 1. 관리자 계정 entry 문장
- `/admin/users` 는 실제 운영 저장 완료 화면이 아니라 계정 preview 와 역할/권한 diff 를 먼저 검토하는 시작점이다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토를 같은 책임처럼 쓰지 않는다.

### 2. 조직/운영 레인 문장
- `/org` = 부서/역할/권한/지점 구조 read-only 확인
- `/employees` = 직원 상태/소속 일반 조회
- `/management` = 운영 허브
- `/admin/audit-logs` = 감사 read-only 추적
- branch scope 와 company scope 는 같은 full access 가 아니다.

### 3. 권한/차단 문장
- `/admin/users` 는 admin role + `permission.read` 기준이 필요하다.
- `/admin/audit-logs` 는 `audit.read` 기준이 필요하다.
- `MANAGER` 가 직원 조회를 볼 수 있어도 관리자 사용자 목록까지 바로 보는 것은 아니다.
- `AUDITOR` 기본 시작점은 `/admin/audit-logs` 이지만 이것이 `/admin` 전체 허용을 뜻하지는 않는다.

### 4. 비노출 원칙
- raw storage key
- bucket 이름
- signed URL 전문
- public URL 전문
- secret/credential
- 감사 before/after raw 원문 전체

## 구현자에게 넘기는 쉬운 작업 단위

1. `/admin/users` copy 를 관리자 계정 실사용 문장 기준으로 다듬기
2. `/employees`, `/org`, `/management`, `/admin/audit-logs` 책임 분리 문구 정리
3. 역할별 landing 과 다음 레인 문구 정리
4. branch/company scope, admin role, `permission.read`, `audit.read` 차이를 UI 에서 더 분명히 보이게 맞추기

## 리뷰어 체크포인트

- 관리자 사용자 목록이 일반 직원 조회와 같은 뜻으로 풀리지 않는가
- `permission.read` 와 `audit.read` 차단 기준이 route/API/UI 에서 같은 뜻인가
- branch scope 와 company scope 가 같은 full access 처럼 과장되지 않는가
- 감사 로그가 read-only/masked preview 를 유지하는가
- raw secret/storage internals 비노출 원칙이 깨지지 않는가

## 테스터 체크포인트

- `/admin/users` 가 로그인 뒤 관리자 계정 시작점처럼 읽히는가
- `/employees`, `/org`, `/management`, `/admin/audit-logs` 가 역할별 책임대로 이어지는가
- `MANAGER` 의 `/admin/users` 차단, `HR_ADMIN` 의 `/admin/audit-logs` 차단, `AUDITOR` 의 read-only 허용이 구분되는가
- `createdFrom`/`createdTo` 필터와 company boundary 가 유지되는가
- local build/test 근거와 live 직접 확인 근거가 같은 말처럼 섞이지 않는가

## 문서화 체크포인트

- 대장이 live URL 에서 직접 눌러볼 route 순서를 적는다.
- `admin / 1234` 는 dev/test/UAT 전용 계정으로만 적는다.
- 되는 것 / 아직 preview / 승인 필요를 섞지 않는다.

## 운영 체크포인트

- PR/CI/merge/배포 확인
- live `/login`, `/admin/users`, `/employees`, `/org`, `/management`, `/admin/audit-logs` smoke 기준 정리
- 남은 승인 게이트(실초대, 실비밀번호 변경, 외부 IdP/SSO, production data, secret, DNS/custom domain, migration) 분리

## 남은 승인 게이트

- production DB 실데이터
- secret 입력/교체
- 실제 초대 메일/메신저 발송
- 외부 IdP/SSO/SAML/SCIM 연동
- 실제 비밀번호 정책/재설정 운영 전환
- DNS/custom domain
- 유료 리소스
- destructive/migration
