# Phase 44 관리자/담당자 가이드

## 한 줄 요약
관리자와 담당자는 로그인 직후 공통 홈(`/dashboard`)을 거친 뒤, 역할별로 허용된 다음 운영 레인(`/management`, `/admin/users`, `/admin/audit-logs`)만 확인한다.

## 이 가이드의 대상
- 본사 관리자
- 인사 관리자
- 지점 관리자
- 세무/노무/법무/감사 담당자
- 운영 리허설 동행 담당자

## 먼저 기억할 원칙
- `/dashboard` 는 COMPANY_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE 가 공통으로 먼저 닿는 홈이고 `/management` 는 그 뒤 민감 운영 허브다.
- 두 레인을 같은 업무 흐름처럼 설명하면 안 된다.
- 단순 메뉴 숨김이 아니라 route guard, API guard, company+branch scope, capability, read-only 경계가 같이 유지돼야 한다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이다.
- 로그인 전에는 관리자도 내부 화면을 바로 보는 것이 아니라 `/login` 부터 시작하는 것이 정상이다.

## 관리자 레인의 대표 시작점

### 1) 인사 관리자
추천 다음 레인:
- 로그인 직후 `/dashboard`
- admin host `/admin/users`
- 필요 시 `/admin/policies`
- 이후 `/admin/audit-logs`

설명:
- HR_ADMIN 은 로그인 직후 `/dashboard` 를 거친 뒤 사용자/권한 관리가 필요한 경우 admin host `/admin/users` 계열로 이어지는 흐름이 더 맞다.
- 일반 직원 조회(`/employees`)와 운영 변경 검토(`/admin/users`)를 섞지 않는다.

근거 파일:
- `apps/web/app/dashboard/dashboard-config.ts`
- `packages/shared/src/admin-access.ts`

### 2) 운영 관리자 / 지점 관리자
추천 다음 레인:
- 로그인 직후 `/dashboard`
- general host `/management`
- `/work-items/branch`
- `/payroll`
- 역할에 맞는 `tax/labor/legal` 레인

설명:
- 운영 레인은 일반 홈에서 분리된 허브에서 시작한다.
- branch scope 와 company scope 설명을 같은 말처럼 쓰면 안 된다.

### 3) 감사 전용 사용자
추천 다음 레인:
- admin host `/admin/audit-logs`

설명:
- 감사 전용 사용자는 `/admin` 전체 허용 사용자가 아니다.
- 기본 진입 목적은 read-only 추적과 회사 경계 확인이다.

근거 파일:
- `apps/web/app/admin/audit-logs/page.tsx`

## `/management` 에서 보는 주요 화면

### `/management` — 내부관리 허브
역할:
- 일반 직원 홈과 민감 운영 모듈을 분리하는 허브
- 역할별 허용 카드만 보여 주는 시작점

여기서 확인할 것:
- 홈과 관리자 CTA 가 섞이지 않는지
- 역할별 허용 카드만 보이는지
- `/payroll`, `/work-items/*`, `/admin/audit-logs` 의 책임이 구분되는지

근거 파일:
- `apps/web/app/management/page.tsx`

### `/work-items/branch` — 지점 운영
역할:
- 지점 일일 보고와 마감 후속조치를 branch scope 기반으로 본다.

읽는 기준:
- 본사 운영과 지점 관리자 가시 범위를 구분한다.
- 일반 직원 홈에 직접 섞지 않는다.
- company-wide 자유 접근처럼 설명하지 않는다.

근거 파일:
- `apps/web/app/work-items/work-items-config.ts`

### `/payroll` — 급여 내부관리
역할:
- 급여 프로필, 기간 상태, self-only 명세서 preview 연결을 읽는다.

읽는 기준:
- 본사 급여 담당 / 지점 관리자 / 일반 직원 visibility 를 구분한다.
- preview 금액과 실지급 확정값을 같은 뜻으로 설명하지 않는다.
- 근태/휴가 입력을 받아 검토하는 read model 이지, 실제 지급 완료 화면이 아니다.

근거 파일:
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`

### `/payroll/me` — self-only 명세서
역할:
- 직원 본인이 보는 self-only 명세서 preview 와 정정 안내

관리자 관점 확인 포인트:
- 회사 전체 급여 조회와 self-only 흐름이 분리되는지
- 동료 급여 접근이 열려 있지 않은지
- 정정 안내가 근태/휴가 입력 소스와 이어지는지

### `/work-items/tax` — 세무 내부관리
역할:
- 지점 제출, HQ 검토, 전달 패키지 준비를 metadata 중심으로 읽는다.

읽는 기준:
- 지점 제출 책임과 HQ 검토 책임을 섞지 않는다.
- 실제 홈택스 신고, 회계 프로그램 연동, 실세무 원문 업로드는 범위 밖이다.

### `/work-items/labor` — 노무 내부관리
역할:
- 고충, 징계, 사고, 계약, 수당 등 민감 업무를 더 좁은 restricted 경계로 읽는다.

읽는 기준:
- self / branch / restricted 범위를 분리한다.
- 제한 메모 원문과 metadata preview 를 같은 뜻으로 쓰지 않는다.
- 외부 노무사/급여 연동은 승인 게이트다.

### `/work-items/legal` — 법무 업무
역할:
- 계약 검토 요청, 갱신 예정, 분쟁/클레임 후속을 metadata 중심으로 읽는다.

읽는 기준:
- 계약 원문 저장 확대, 외부 변호사/보험사 연동, 기관 제출 자동화는 아직 닫혀 있다.
- company scope 와 branch 요청 보조 레인을 분리한다.

근거 파일:
- `apps/web/app/work-items/work-items-config.ts`

### `/admin/audit-logs` — 감사 / 컴플라이언스 read-only 진입
역할:
- 누가 무엇을 바꿨는지, 어떤 접근이 있었는지, 어떤 candidate 변경이 있었는지 read-only 로 확인한다.

읽는 기준:
- `audit.read` 가 있는 역할만 본다.
- before/after 는 masked preview 로만 읽는다.
- raw storageKey, bucket, signed URL, public URL 전문은 노출하지 않는다.
- dedicated compliance 조치 시스템이 이미 완성된 것처럼 설명하지 않는다.

근거 파일:
- `apps/web/app/admin/audit-logs/page.tsx`

## 역할별 접근 요약
- SUPER_ADMIN: 전역 관리자 레인과 감사 레인을 가장 넓게 본다.
- COMPANY_ADMIN: 회사 관리자 레인, 급여/세무/법무/감사 레인을 company scope 로 본다.
- HR_ADMIN: 사용자/권한, 인사, 근태/휴가, 노무 restricted 일부까지 company scope 로 본다.
- MANAGER: 일반 홈 + 승인/지점/일부 운영 레인을 branch/team 문맥으로 본다.
- AUDITOR: read-only 감사와 추적 중심으로 본다.
- EMPLOYEE: 일반 직원 레인 중심이며 민감 운영 레인을 기본으로 보지 않는다.

권한 근거 파일:
- `packages/shared/src/contracts.ts`
- `packages/shared/src/admin-access.ts`

## 운영자가 자주 확인할 질문
1. 일반 직원 홈과 `/management` 허브가 분리되어 보이는가
2. `/payroll` 과 `/payroll/me` 의 책임 차이가 분명한가
3. `tax`, `labor`, `legal`, `branch` 가 서로 다른 책임과 scope 를 가지는가
4. `/admin/audit-logs` 가 read-only 감사 진입점으로 읽히는가
5. role/capability/company/branch 경계가 문서 문장과 실제 guard 에서 같은 뜻인가

## 아직 하지 않는 것
- 실제 급여 지급
- 은행 이체
- 주민번호/계좌번호 입력 확대
- production 실데이터 보정
- 외부 세무/노무/법무/회계 계정 연동
- 감사 export/download/external sink 자동화
- migration
- destructive/force 작업

## 관리자용 빠른 점검 순서
1. `/login` 에서 시작하는지 확인
2. `/dashboard` 에서 관리자 CTA 위치 확인
3. `/management` 허브 분리 확인
4. `/work-items/branch` branch scope 확인
5. `/payroll` 과 `/payroll/me` 책임 분리 확인
6. `/work-items/tax` / `/work-items/labor` / `/work-items/legal` 역할 분리 확인
7. `/admin/audit-logs` read-only / masked / company boundary 확인
8. 필요 시 Windows Chrome/Edge 설치 후 앱 재실행 시 세션 없으면 `/login` 부터 시작하는지 확인

## 함께 볼 문서
- `docs/guides/phase-44-employee-user-guide.md`
- `docs/guides/phase-44-operator-runbook.md`
- `docs/guides/phase-44-role-access-matrix.md`
- `docs/guides/phase-44-adoption-checklist.md`
