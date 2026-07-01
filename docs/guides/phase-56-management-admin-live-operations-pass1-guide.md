# Phase 56 관리자 지정 경영업무 1차 실사용 가이드 + UAT 절차 + 운영 체크리스트

## 한 줄 요약
이번 Phase 56에서는 `/login` → `/dashboard` → `/management` 순서로 들어가,
운영 허브 확인 → `/payroll` 운영 급여 preview 확인 → `/payroll/me` self-only 급여 확인 → `/work-items/tax`·`/work-items/labor`·`/work-items/legal` 모듈 확인 → `/admin/audit-logs` 감사 추적 흐름이 실제로 이어지는지,
그리고 일반 직원 차단, 지정 관리자 접근, 감사 read-only, 민감정보 비노출 원칙이 서로 섞이지 않는지만 먼저 확인하면 된다.

## 이 문서가 다루는 범위
- 경영업무 운영 허브 확인 가이드
- 운영 급여 / self-only 급여 확인 가이드
- 세무 / 노무 / 법무 모듈 확인 가이드
- 감사 read-only 확인 가이드
- 권한 없음 / 차단 확인 포인트
- empty/loading/error/forbidden/dev-safe 읽는 법
- UAT 절차
- 운영 체크리스트
- 최종 보고에 넣을 항목

이 문서는 실지급, 실신고, 외부 세무/노무/법무 전문가 연동,
production DB 실데이터 반영, secret 입력/교체, DNS/custom domain,
유료 리소스, migration, destructive 작업 문서가 아니다.
지금 이미 있는 경영업무 route/API/test 기준선을
"대장이 live URL에서 직접 어디를 눌러 무엇을 확인하면 되는가" 중심으로 다시 묶은 문서다.

## 먼저 기억할 13가지
1. 익명 시작점은 `/login` 뿐이다.
2. 테스트 계정은 `admin / 1234` 다.
3. 이 계정은 dev/test/UAT 전용이며 production 기본 계정이 아니다.
4. 지정 관리자 경영업무 실사용 시작점은 `/dashboard` 다음 `/management` 다.
5. `/management` 는 일반 직원 홈 확장이 아니라 민감 운영 허브다.
6. `/payroll` 은 운영/관리자 급여 preview 레인이다.
7. `/payroll/me` 는 self-only 급여 확인 레인이다.
8. `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 은 같은 관리자 기능이 아니라 서로 다른 모듈 책임을 가진다.
9. `/admin/audit-logs` 는 `audit.read` 기반 read-only 감사 레인이다.
10. `AUDITOR` 가 `/admin/audit-logs` 를 본다고 해서 `/management` 나 `/work-items/*` 까지 자동 허용되는 것은 아니다.
11. branch scope, company scope, self scope, restricted scope 는 같은 full access 뜻이 아니다.
12. masked preview 와 raw storage/secret 비노출 원칙은 경영업무 화면과 감사 화면 모두에서 유지돼야 한다.
13. live 직접 확인 근거와 local build/test 대체 근거는 같은 뜻으로 적지 않는다.

## 접속 정보와 현재 근거
- 현재 공개 preview URL 기록: `https://gw-web.wereheresp.workers.dev`
- 로그인 시작점: `/login`
- 테스트 계정: `admin / 1234`
- 현재 핵심 route:
  - `/dashboard`
  - `/management`
  - `/payroll`
  - `/payroll/me`
  - `/work-items/tax`
  - `/work-items/labor`
  - `/work-items/legal`
  - `/admin/audit-logs`
- 현재 핵심 API:
  - `/api/health`
  - `/api/payroll`
  - `/api/payroll/periods/payroll_period_2026_05`
  - `/api/payroll/me/payslip`
  - `/api/work-items?module=tax`
  - `/api/work-items?module=labor`
  - `/api/work-items?module=legal`
  - `/api/work-item-deadlines`
  - `/api/admin/audit-logs`
- parent tester 기준 검증:
  - focused web 회귀 확장 결과: 27 files / 116 passed
  - focused API 회귀 확장 결과: 14 files passed, 1 skipped, 100 tests passed / 4 skipped
  - `pnpm --filter @gw/web typecheck` 통과
  - `pnpm --filter @gw/api typecheck` 통과
  - `pnpm check` 통과
  - `pnpm --filter @gw/web build` 통과
  - local `next start` smoke 재확인 통과
- singde live smoke 재확인 메모:
  - `/login` 200
  - 보호 route `/dashboard`, `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 는 익명 접근 시 `/login` redirect
  - `/api/health` 200 및 `ok` payload 확인

중요:
- 위 수치는 현재 문서가 기대는 최신 parent 검증 근거다.
- 이번 문서 작업에서 live URL을 내가 다시 직접 fetch 한 것은 아니다.
- 따라서 최종 사용자 보고 전에는 singde가 live 직접 확인 메모를 최종 결과에 함께 붙여야 한다.

## 1. 경영업무 운영 허브 확인 가이드

### 추천 순서
1. `/login`
2. `/dashboard`
3. `/management`
4. 운영 허브 카드 확인
5. `/payroll`
6. `/work-items/tax`
7. `/work-items/labor`
8. `/work-items/legal`
9. `/admin/audit-logs`

### 각 화면을 어떻게 읽으면 되는가

#### `/dashboard`
- 공통 landing 이다.
- 지정 관리자라도 먼저 홈으로 들어오지만, 여기서 바로 민감 운영 저장 화면으로 이해하면 안 된다.
- 일반 직원용 shortcut 과 경영업무 진입점은 분리되어 보여야 한다.

#### `/management`
- 지정 관리자 경영업무 실사용 시작 화면이다.
- 먼저 읽어야 할 순서는 "운영 허브 카드 확인 → 운영 급여 확인 → 세무/노무/법무 모듈 확인 → 감사 추적 확인" 이다.
- 일반 직원 홈의 연장처럼 보이면 안 된다.

#### 운영 허브 카드 확인
- 어떤 역할이 어떤 카드를 볼 수 있는지 먼저 확인하는 단계다.
- 허용 카드만 노출되는지, roleScope 문구가 과장되지 않는지 본다.
- 카드가 보여도 실제 외부 연동이나 실운영 저장 완료처럼 쓰면 안 된다.

### 운영 허브에서 바로 확인할 질문
- `/management` 가 정말 민감 운영 허브처럼 읽히는가
- 일반 직원 홈 CTA 와 경영업무 CTA 가 같은 책임처럼 보이지 않는가
- `AUDITOR` 가 감사 read-only 를 넘어서 전체 운영권한처럼 오해되지 않는가
- 허용 역할만 카드가 보인다는 뜻이 route/API guard 와도 맞는가

## 2. 운영 급여 / self-only 급여 확인 가이드

### 추천 순서
1. `/payroll`
2. 급여 overview 확인
3. 급여 기간 상세 확인
4. `/payroll/me`
5. self-only 명세서 초안 확인
6. 정정 안내 확인

### 어떻게 읽으면 되는가

#### `/payroll`
- 운영/관리자 급여 preview 및 검토 레인이다.
- 급여 프로필, 기간 상태, 수당/공제 preview, 역할별 공개 범위를 읽는 자리다.
- 실제 실지급 완료, 은행 이체, 외부 급여시스템 연동 완료처럼 과장하면 안 된다.

#### 급여 기간 상세
- collecting → reviewing → confirmed 흐름을 보는 단계다.
- 이 confirmed 는 외부 지급/세무 처리 완료와 같은 뜻으로 적으면 안 된다.
- 현재는 내부 운영 read model 과 preview 단계라는 점을 같이 적는다.

#### `/payroll/me`
- self-only 급여 확인 레인이다.
- 직원 본인이 자기 명세서 초안과 정정 안내만 보는 자리로 읽혀야 한다.
- 회사 전체 급여 운영 화면과 같은 권한으로 설명하면 안 된다.

#### 정정 안내 확인
- 근태/휴가 입력과 급여 preview 연결을 보는 단계다.
- 정정은 급여 확정 전에 관련 입력 소스를 먼저 보는 절차로 읽혀야 한다.
- 동료 급여 조회, 통장 이체 결과, 외부 신고 제출을 확인하는 화면이 아니다.

### 급여 확인에서 바로 확인할 질문
- `/payroll` 과 `/payroll/me` 가 서로 다른 책임으로 분리돼 읽히는가
- 운영 급여 preview 와 self-only 명세서 preview 가 같은 데이터 범위처럼 과장되지 않는가
- 실지급, 실세액, 4대보험, 외부 신고 미연결 상태를 숨기지 않는가
- 정정 안내가 실제 업무 순서와 맞게 보이는가

## 3. 세무 / 노무 / 법무 모듈 확인 가이드

### 추천 순서
1. `/work-items/tax`
2. 세무 목록 → 상세 → review/deadline 확인
3. `/work-items/labor`
4. 노무 목록 → restricted scope / metadata 확인
5. `/work-items/legal`
6. 법무 목록 → company/branch visibility / review/deadline 확인

### 어떻게 읽으면 되는가

#### `/work-items/tax`
- 세무 자료 요청/검토/마감 흐름이다.
- 지점별 증빙 제출, 세목별 마감, HQ 전달 패키지 준비를 metadata 중심으로 읽는다.
- 실신고, 홈택스 직접 제출, 외부 세무사 계정 연동 완료처럼 적지 않는다.

#### `/work-items/labor`
- 노무 자료 요청/제출/review/document/deadline 흐름이다.
- self/branch/restricted scope 차이를 route/UI/API/test 에서 같은 뜻으로 유지해야 한다.
- 실제 징계 확정, 실제 사고 신고 제출, 외부 노무 연동 완료처럼 적지 않는다.

#### `/work-items/legal`
- 계약 검토/document/deadline 흐름이다.
- 계약 분류, 갱신 예정, 분쟁/클레임/보험 후속 metadata 를 읽는 단계다.
- 실계약서 원문 저장 확대, 외부 변호사/보험사 연동, 실제 제출 자동화 완료처럼 적지 않는다.

### 세 모듈을 함께 볼 때 기준
- 세무/노무/법무를 모두 "관리자 기능" 한 줄로 뭉개지지 않는지 본다.
- company scope, branch scope, self scope, restricted scope 차이가 모듈별로 같은 말로 유지되는지 본다.
- review, deadline, document, evidence 가 실제 외부 제출 완료처럼 읽히지 않는지 본다.
- metadata preview 와 민감 원문 열람은 분리되어 있는지 본다.

### 모듈 확인에서 바로 확인할 질문
- tax / labor / legal 이 각자 다른 책임으로 읽히는가
- branch/company/self/restricted 경계가 실제 사용자 입장에서 이해되게 보이는가
- restricted 건이 그냥 일반 목록처럼 노출되지 않는가
- 외부 전문가/기관 연동이 아직 승인 게이트라는 사실이 문장에서도 유지되는가

## 4. 감사 read-only 확인 가이드

### 추천 순서
1. `/admin/audit-logs`
2. 역할별 route/API guard 요약 확인
3. 조회 필터 확인
4. 최근 이벤트 타임라인 확인
5. 상세 패널 확인
6. storage preview 경계 확인
7. `/api/health` 최소 liveness 확인

### 어떻게 읽으면 되는가

#### `/admin/audit-logs`
- `audit.read` 기반 read-only 감사 레인이다.
- 목적은 누가 무엇을 바꾸려 했는지, 어떤 이벤트가 있었는지 추적하는 것이다.
- 경영업무 운영 저장 화면이나 파일 원문 열람 화면처럼 쓰면 안 된다.

#### 역할별 route/API guard 요약
- `AUDITOR`, `HR_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `EMPLOYEE` 차이를 같은 관리자 묶음처럼 쓰지 않는다.
- `AUDITOR` 는 감사 read-only 허용이지만 `/management` 까지 자동 허용되는 것이 아니다.
- `MANAGER` 의 `/management` 허용 여부와 `/admin/audit-logs` 허용 여부가 같은 뜻은 아니다.

#### storage preview 경계
- before/after 는 raw 원문이 아니라 masked preview 로만 확인한다.
- storageRef 는 fileId / spaceId / versionId / storageStatus 수준 참조 요약이다.
- raw storageKey, bucket, signed URL, public URL 전문은 보이면 안 된다.

#### `/api/health`
- 최소 liveness 확인용이다.
- 전체 관제/자동 복구/backup/restore 완료 의미로 과장하면 안 된다.

### 감사 확인에서 바로 확인할 질문
- `/admin/audit-logs` 가 read-only 추적 레인으로 읽히는가
- `AUDITOR` 를 전체 운영 관리자처럼 오해하게 만들지 않는가
- 감사 화면이 민감 원문, 저장소 원문, 외부 export 화면처럼 보이지 않는가
- `/api/health` 가 최소 상태 확인이라는 뜻을 벗어나지 않는가

## 5. 권한 없음 / 차단 확인 가이드

### 먼저 확인할 대상
- 익명 `/management` 접근
- 익명 `/payroll` 접근
- 익명 `/payroll/me` 접근
- 익명 `/work-items/tax` 접근
- 익명 `/work-items/labor` 접근
- 익명 `/work-items/legal` 접근
- 익명 `/admin/audit-logs` 접근
- 일반 직원의 `/management` 접근
- 일반 직원의 `/work-items/*` 접근
- `AUDITOR` 의 `/management` 접근
- `HR_ADMIN` 의 `/admin/audit-logs` 접근 여부

### 읽는 기준
- UI에서 먼저 막히는지 본다.
- route 차단 안내와 API 차단 이유가 같은 뜻인지 본다.
- 차단 상태인데도 성공 버튼이나 완료 문구가 먼저 보이면 안 된다.
- 차단되면 사용자가 어디로 돌아가야 하는지도 보여야 한다.

### 이번 Phase에서 특히 같이 봐야 하는 예시
- 익명 route 차단: `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 는 로그인 유도
- 일반 직원 차단: `/management` 와 `/work-items/*` 는 일반 업무 홈처럼 허용되지 않음
- self-only 허용: `/payroll/me` 는 자기 명세서 확인 레인으로만 읽힘
- 감사 경계 차단: `audit.read` 없으면 `/admin/audit-logs` 차단
- 내부정보 비노출: raw storage key/bucket/public URL/signed URL/secret 비노출

## 6. 상태 문장은 이렇게 구분한다

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
- 예: 일반 직원의 `/management`, `audit.read` 없는 사용자의 `/admin/audit-logs`

### dev-safe
- 내부 검증용 preview, Production-ready (실구현), 안전한 데모 상태가 남아 있는 것이다.
- 실지급, 실신고, 실저장, 외부 제출 완료와 같은 뜻이 아니다.

## 7. 역할별로 어디까지 보면 되는가
- EMPLOYEE: `/dashboard` 기준 일반 업무만 보고, 경영업무 관련해서는 `/payroll/me` self-only 레인만 확인한다.
- MANAGER: 자기 역할에 허용된 운영 허브/지점/모듈 레인을 확인하되, 모든 경영업무 전권처럼 읽지 않는다.
- HR_ADMIN: 계정/조직/운영 연결 문맥은 볼 수 있어도 감사 read-only 나 모든 민감 모듈이 자동 허용되는 것은 아니다.
- COMPANY_ADMIN: `/management`, `/payroll`, 필요한 `work-items`, `/admin/audit-logs` 전체 운영 흐름을 확인한다.
- AUDITOR: `/admin/audit-logs` read-only 확인이 기본이며, 경영업무 운영권한 전체와 같은 뜻으로 쓰지 않는다.

## 8. UAT 절차

### 8-1. 시작 전 준비
- live URL 이 `https://gw-web.wereheresp.workers.dev` 인지 다시 확인한다.
- 이번 기록이 live 직접 확인인지, local build/test 대체 근거인지 먼저 구분한다.
- 테스트 계정 `admin / 1234` 가 dev/test/UAT 전용 문구로만 쓰이는지 확인한다.

### 8-2. 공통 시작 시나리오
1. `/login` 이 익명 유일 입구인지 확인
2. 로그인 후 `/dashboard` 가 공통 landing 으로 보이는지 확인
3. `/management` 가 일반 홈과 분리된 운영 허브로 보이는지 확인
4. `/payroll` 에서 운영 급여 preview 확인
5. `/payroll/me` 에서 self-only 명세서 preview 확인
6. `/work-items/tax` → `/work-items/labor` → `/work-items/legal` 순서로 모듈 책임 차이 확인
7. `/admin/audit-logs` 에서 감사 read-only 와 storage preview 경계 확인
8. `/api/health` 는 최소 liveness 확인으로만 기록

### 8-3. 역할별 추가 확인

#### 일반 직원
- `/management`, `/work-items/*` 진입이 기본 허용처럼 보이지 않는지 확인
- `/payroll/me` 가 자기 정보만 보여 주는지 확인

#### 지정 관리자
- `/management` 카드 노출이 역할에 맞는지 확인
- `/payroll` 과 `tax/labor/legal` 모듈이 서로 다른 업무 책임으로 읽히는지 확인
- branch/company/self/restricted scope 차이가 설명과 실제 노출에서 맞는지 확인

#### 감사 담당자
- `/admin/audit-logs` 가 read-only 감사 시작점처럼 읽히는지 확인
- `/management` 나 운영 저장 화면까지 자동 허용처럼 보이지 않는지 확인

### 8-4. 기록 형식
각 route마다 아래 5가지를 남긴다.
- happy path: 무엇이 자연스럽게 이어졌는가
- forbidden: 누가 막혀야 했고 실제로 막혔는가
- empty: 빈 상태가 정상 빈 상태로 읽히는가
- error: 실패 문장이 권한 부족과 섞이지 않는가
- dev-safe: preview/Production-ready (실구현) 가 실운영 완료처럼 과장되지 않는가

## 9. 운영 체크리스트
- `/login` 이 익명 시작점으로 유지되는가
- `admin / 1234` 가 dev/test/UAT 전용 계정으로만 적혔는가
- `/management` 와 일반 직원 홈 CTA 가 분리돼 보이는가
- `/payroll` 과 `/payroll/me` 책임이 분리돼 보이는가
- `tax/labor/legal` 모듈 책임이 한 줄로 뭉개지지 않는가
- 일반 직원 차단, 지정 관리자 허용, 감사 read-only 가 같은 뜻으로 설명되는가
- company/branch/self/restricted scope 차이가 route/API/UI 문장과 맞는가
- masked preview 와 raw storage/secret 비노출 원칙이 유지되는가
- live 직접 확인 근거와 local preview/build/test 근거가 분리돼 적혔는가
- 남은 승인 게이트가 빠지지 않았는가

## 10. 최종 보고에 넣을 항목
- live URL
- 테스트 계정 사용 기준 (`admin / 1234` 는 dev/test/UAT 전용)
- 대장이 실제로 눌러볼 route 순서
- 각 route에서 확인할 핵심 포인트
- 일반 직원 차단 / 지정 관리자 허용 / 감사 read-only 구분
- 아직 preview/dev-safe 인 부분
- 별도 승인 게이트로 남긴 항목
- live 직접 확인 근거와 local 검증 근거를 분리한 메모

## 11. 최종 보고 템플릿

### 짧은 요약
- Phase 56 기준으로 `/management` 운영 허브, `/payroll` 운영 급여, `/payroll/me` self-only 급여, `tax/labor/legal` 모듈, `/admin/audit-logs` 감사 read-only 흐름을 live URL에서 직접 따라갈 수 있게 문서와 확인 순서를 정리했다.

### 사용자가 직접 볼 순서
1. `https://gw-web.wereheresp.workers.dev/login`
2. 로그인 후 `/dashboard`
3. `/management`
4. `/payroll`
5. `/payroll/me`
6. `/work-items/tax`
7. `/work-items/labor`
8. `/work-items/legal`
9. `/admin/audit-logs`
10. 필요 시 `/api/health`

### route별 핵심 확인 포인트
- `/management`: 일반 홈과 분리된 운영 허브인지
- `/payroll`: 운영 급여 preview 와 역할별 공개 범위가 보이는지
- `/payroll/me`: self-only 명세서 초안과 정정 안내가 보이는지
- `/work-items/tax`: 세무 제출/검토/마감 metadata 가 보이는지
- `/work-items/labor`: self/branch/restricted 차이가 보이는지
- `/work-items/legal`: company/branch visibility 와 승인 게이트가 보이는지
- `/admin/audit-logs`: audit.read 기반 read-only 추적과 masked preview 가 보이는지

### 아직 preview 또는 승인 게이트인 것
- 실지급, 은행이체, 급여 확정 운영 전환
- 실신고, 외부 세무/노무/법무/보험/기관 연동
- 주민번호/계좌번호 등 민감 원문 확대 저장
- production DB 실데이터
- secret 입력/교체
- DNS/custom domain
- 유료 리소스
- migration
- destructive 작업

## 12. 참고 문서
- `docs/architecture/phase-56-management-admin-live-operations-pass1-fit-gap-scope.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-handoff.md`
- `docs/architecture/phase-55-admin-account-rbac-org-audit-live-operations-fit-gap-scope.md`
- `docs/guides/phase-55-admin-account-rbac-org-audit-live-operations-guide.md`
- `docs/architecture/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-scope.md`
- `apps/web/app/management/page.tsx`
- `apps/web/app/payroll/page.tsx`
- `apps/web/app/payroll/me/page.tsx`
- `apps/web/app/work-items/tax/page.tsx`
- `apps/web/app/work-items/labor/page.tsx`
- `apps/web/app/work-items/legal/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`
- `apps/api/src/app.ts`
- `apps/api/test/auth-org.spec.ts`
- `apps/api/test/work-items.spec.ts`
- `packages/shared/src/contracts.ts`
