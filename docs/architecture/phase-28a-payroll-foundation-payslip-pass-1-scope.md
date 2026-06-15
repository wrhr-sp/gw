# Phase 28A 급여 foundation / payslip pass 1 범위

## 한 줄 요약
근태·휴가 다음 단계에 놓이는 독립 `payroll` 모듈의 최소 골격을 추가해, 급여 프로필·지급 기간·수당/공제 항목·직원용 명세서 초안을 같은 계약 언어로 먼저 고정한다.

## 이번 단계에서 여는 것
- `/payroll` 독립 화면과 `/payroll/me` 직원용 명세서 초안 화면
- same-origin API `GET /api/payroll`, `GET /api/payroll/periods/:id`, `GET /api/payroll/me/payslip`
- shared contract 기준 급여 프로필, 급여 기간, 입력 snapshot, line item, review step schema
- 본사 급여 담당 / 지점 관리자 / 일반 직원 역할 분리 설명
- 근태·휴가 입력과 연결되는 preview 문구
- 지원 급여 유형 방향: 월급제, 시급제, 일급제, 연봉제, 포괄임금제
- 항목별 산정 근거 구조: `source`, `quantity`, `unitAmount`, `premiumRate`, `amount`, `note`

## 이번 단계에서 아직 안 여는 것
- 실세액 계산 엔진
- 4대보험 확정 계산
- 실제 지급 이체
- 외부 급여/세무/ERP 연동
- production 급여 원문 저장
- 실데이터 migration

## 역할별 기본 가시성
### 본사 급여 담당
- 급여 프로필과 지급 기간 상태를 넓게 본다.
- 수당/공제 초안과 HQ review step 을 확인한다.
- 이번 단계에서는 저장/확정 대신 placeholder review 설명만 유지한다.

### 지점 관리자
- 자기 지점 근태/휴가/수기 수당 자료 제출 상태만 본다.
- 다른 지점 전체 급여 총액과 상세 명세서는 범위 밖이다.
- branch submit → HQ review 흐름만 확인한다.
- period detail 전체나 직원 self payslip 상세를 직접 보는 역할로 문서화하지 않는다.

### 일반 직원
- `/payroll/me` 에서 자기 급여명세서 초안만 본다.
- 동료 급여, 회사 전체 급여, 실제 지급 완료 문구는 보지 않는다.
- 정정이 필요하면 먼저 근태/휴가 입력 확인 후 담당자 안내를 따른다.

## 급여 유형/계산 메모
- 월급제: 기준급 중심 preview
- 시급제: 근무시간 × 시급, 연장/야간/휴일 가산 line item 추가 가능
- 일급제: 일수 × 일급 방향을 contract 에서 지원
- 연봉제: 연봉 기준 월 환산/지급 주기 설명을 문서에서 분리
- 포괄임금제: 포함 범위 대비 실제 근무시간 비교 경고를 남기고, 부족분 자동 차감은 기본 전제로 쓰지 않는다.

## 빠른 확인 순서
1. `/payroll` — 독립 급여 허브가 work-items/labor 안에 묻히지 않았는지 본다.
2. `/payroll/me` — 직원이 self-only 명세서 초안만 보는지 본다.
3. `/api/payroll` — 프로필/기간/역할별 공개 범위가 응답에 있는지 본다.
4. `/api/payroll/periods/payroll_period_2026_05` — draft, input snapshot, line item, review step 이 한 묶음으로 오는지 본다.
5. `/api/payroll/me/payslip` — employee self-only payslip preview 가 따로 분리됐는지 본다.

## 상태 흐름 메모
1. 급여 기간 생성
2. 근태 자료 수집
3. 지점 관리자 확인/제출
4. 수당/공제 입력
5. 계산 초안 생성
6. 본사 급여 담당 검토
7. 수정/재계산
8. 확정 전 상태 유지
9. 직원 self-only 명세서 초안 공개
10. 문의/정정 요청 skeleton 유지

## guardrail
- 급여는 근태/휴가와 가까운 운영 흐름이지만, grievance/징계 같은 민감 노무 기록과 같은 모듈로 합치지 않는다.
- preview 금액과 실지급 확정값을 같은 문장으로 쓰지 않는다.
- 원천세/4대보험은 placeholder 라는 점을 숨기지 않는다.
- 역할별 범위를 넘는 급여 상세는 열지 않는다.
- 외부 연동과 실데이터는 계속 승인 게이트다.
- 주민등록번호, 계좌번호, 실지급 파일, 홈택스/4대보험 신고 payload 는 이번 문서/route/API 범위에 넣지 않는다.
