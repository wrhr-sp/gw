[CRITICAL: 이 문서의 목업 데이터 및 임시 레이아웃 지침은 Phase 7 프로덕션 모드에 의해 완전히 폐기(Deprecated)되었습니다. 모든 코드는 실기능 통신 코드로만 짭니다.]

# 그룹웨어 Phase 3 근태/휴가 1차 범위

## 1. Phase 목표

이번 Phase의 목표는 Phase 2에서 정리한 사용자/직원/조직/권한 골격 위에 근태와 휴가의 1차 업무 흐름을 얹어서, 다음 Phase에서 전자결재/급여/노무 확장에 재사용할 수 있는 데이터·API·화면·문서 시작점을 만드는 것이다.

이번 Phase에서 맞추는 기준은 다음과 같다.

- DB 기준: Cloudflare D1 migration 확장
- API 기준: Cloudflare Workers + Hono 기반 근태/휴가 REST Production-ready (실구현)
- 공통 계약 기준: `packages/shared` 에 attendance/leave 타입, route contract, zod schema, 공통 응답 schema 추가
- Web 기준: 출퇴근/근태기록/휴가신청/승인 기본 화면 Production-ready (실구현) 정리
- 운영 기준: 승인 흐름, 권한, 로그, release gate 범위 명확화

## 2. 이번 Phase에 포함되는 범위

### 문서 범위

- Phase 3 구현자가 바로 참고할 범위 문서 작성
- 근태/휴가 1차 API, 데이터 모델, 화면 골격 범위 정의
- 출퇴근/정정/휴가신청/휴가승인 흐름의 역할 기준 정리
- 승인 없이 하지 않을 작업과 별도 승인 필요 작업 분리
- GitHub PR/CI/merge/branch cleanup 이 승인된 release gate 범위에 포함된다는 점 명시

### DB / migration 범위

아래 항목을 D1 기준 1차 골격으로 확장한다.

- `attendance_records`
- `attendance_correction_requests`
- `leave_types`
- `leave_requests`
- `leave_balances`

권장 보조 컬럼/연결 기준:

- 모든 업무 테이블은 `company_id`, `employee_id`, `status`, `created_at`, `updated_at` 기본 컬럼을 가진다.
- 수정/승인 흐름이 있는 테이블은 `requested_by`, `reviewed_by`, `reviewed_at`, `reason` 또는 동급 추적 컬럼을 둔다.
- 근태 기록은 최소한 `work_date`, `check_in_at`, `check_out_at`, `source`, `note` 후보를 가진다.
- 휴가 요청은 최소한 `leave_type_id`, `start_date`, `end_date`, `unit`, `days`, `approval_status` 후보를 가진다.
- 연차 잔여는 자동 계산 완성형이 아니라, 이후 계산 확장을 막지 않는 snapshot/start balance 구조를 우선 둔다.

기준:

- 기존 `db/migrations/0002_auth_org_phase2.sql` 이후 후속 migration 파일로 추가한다.
- 실제 운영 migration 실행이 아니라 로컬 검증 가능한 SQL Production-ready (실구현) 까지만 다룬다.
- 급여/노무 자동 계산을 강제하는 복잡한 수식 컬럼은 이번 Phase에 넣지 않는다.
- employee/company/role 구조는 Phase 2 계약을 그대로 재사용한다.

### API 범위

대상 파일 기준 시작점은 아래와 같다.

- `apps/api/src/app.ts`
- `packages/shared/src/contracts.ts`
- `packages/shared/src/index.ts`
- `apps/api/test/*.spec.ts`

이번 Phase에 포함되는 1차 endpoint 범위:

- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/attendance/records`
- `POST /api/attendance/corrections`
- `GET /api/leave/types`
- `GET /api/leave/balances`
- `GET /api/leave/requests`
- `POST /api/leave/requests`
- `POST /api/leave/requests/:id/approve`
- `POST /api/leave/requests/:id/reject`

API 기준:

- Hono route Production-ready (실구현) + request/response schema 검증까지 맞춘다.
- 실제 운영 근태/휴가 계산 엔진 대신 local/mock/dev Production-ready (실구현) 흐름으로 둔다.
- 인증 상태, 권한 부족, 미구현 상태를 공통 응답 형식으로 돌려준다.
- 출퇴근/정정/휴가 승인처럼 상태 변경이 있는 endpoint 는 감사 로그 후보로 표시할 수 있는 구조를 남긴다.
- employee 본인 요청과 관리자/승인자 처리 권한을 분리할 수 있게 route 계약을 잡는다.

### shared 계약 범위

`packages/shared` 에 아래를 추가한다.

- attendance route 상수
- leave route 상수
- 출근/퇴근 요청/응답 schema
- 근태 기록 목록 schema
- 근태 정정 요청 생성 schema
- 휴가 유형/잔여/신청/승인 응답 schema
- attendance/leave 권한 코드와 공통 에러 코드 확장
- 공통 응답 wrapper 재사용

기준:

- Web과 API가 같이 보는 계약은 shared 에서 먼저 정의한다.
- `health`, `auth`, `org` 계약과 같은 방식으로 zod schema + type export 를 같이 둔다.
- 이후 전자결재/급여 export/PWA 확장에서 재사용할 수 있어야 한다.

### Web 범위

대상 시작점은 아래와 같다.

- `apps/web/app/attendance/page.tsx`
- `apps/web/app/leave/page.tsx`
- 필요 시 `apps/web/app/dashboard/page.tsx`
- 필요 시 공통 section component

이번 Phase에 포함되는 화면 범위:

- 출근/퇴근 버튼과 오늘 상태 표시 Production-ready (실구현)
- 근태 기록 목록/필터 Production-ready (실구현)
- 근태 정정 요청 입력 Production-ready (실구현)
- 휴가 유형/잔여 표시 Production-ready (실구현)
- 휴가 신청 폼 Production-ready (실구현)
- 휴가 승인/반려 대기 목록 Production-ready (실구현)

화면 기준:

- 실제 GPS, 지오펜싱, 디바이스 인증, 푸시 같은 운영 기능은 구현하지 않는다.
- API 계약이 아직 mock 이어도, 이후 실제 API 호출 구조로 바꾸기 쉬운 컴포넌트 경계를 잡는다.
- 승인 권한이 없는 사용자가 보는 안내 상태와 승인자가 보는 화면 상태를 구분할 수 있게 한다.
- 화면 문구가 실제 법정 근태/급여 계산이 끝난 것처럼 오해되지 않게 Production-ready (실구현) 표시를 유지한다.

### 문서/운영 범위

아래 문서 또는 동급 문서에 Phase 3 기준을 반영한다.

- `README.md`
- `docs/guides/cloudflare-first-developer-guide.md`
- `docs/guides/cloudflare-first-user-guide.md`
- 필요 시 `docs/guides/cloudflare-first-operator-guide.md`
- `docs/architecture/next-cloudflare-platform-plan.md`

정리할 내용:

- 로컬 검증 명령
- Production-ready (실구현) 근태/휴가 흐름의 한계
- 승인 권한/감사 로그/민감 정보 주의
- GitHub PR/CI/merge/branch cleanup 이 승인된 release gate 안에 있다는 점
- 실제 운영 데이터/실제 배포/production DB migration 은 별도 승인 없이는 하지 않는다는 점

## 3. 이번 Phase에서 하지 않는 일

이번 Phase에서 제외하는 일은 아래와 같다.

- 실제 운영 근태 데이터 입력 또는 보정
- 실제 연차 자동 차감/이월/소멸 계산 확정
- 급여/노무 자동 계산 연동
- 실제 출입/GPS/지문기기/외부 출퇴근 시스템 연동
- production DB migration 실행
- 외부 공개 배포, DNS/R2/도메인 작업
- 유료 리소스 생성 또는 비용 발생 작업
- 실제 알림 발송, 메일/메신저 승인 알림 연결
- 법정 근로시간/야간/연장/휴일 수당 계산 확정 기능

## 4. 별도 승인 필요 사항

아래 항목은 다음 단계 후보로 남기되, 실행 전 별도 승인이 필요하다.

1. 실제 운영/스테이징 DB 대상 migration 실행
2. 실사용 근태/휴가 데이터 반입 또는 수정
3. 급여/노무 계산 로직 연결
4. 외부 출퇴근 장치, 위치 인증, 사내 출입 시스템 연동
5. 메일/메신저/푸시 승인 알림 연동
6. 외부 공개 URL 오픈 또는 도메인 연결
7. 유료 플랜/리소스 사용
8. 승인된 오케스트레이션 범위 밖의 GitHub merge 및 branch delete

## 5. 구현자가 바로 따라야 할 기준

### 파일/폴더 기준

```text
apps/
  api/
    src/app.ts
    test/
  web/
    app/attendance/
    app/leave/
    app/dashboard/
packages/
  shared/
    src/contracts.ts
    src/index.ts
db/
  migrations/
docs/
  architecture/
  guides/
```

### 기술 기준

- 근태 1차는 employee 본인 출근/퇴근 + 관리자/승인자 정정 요청 처리 구조를 기준으로 문서화한다.
- 휴가 1차는 연차/반차/병가 등 기본 휴가 유형 조회 + 신청/승인 Production-ready (실구현) 을 기준으로 문서화한다.
- 실제 계산식, 누적 규칙, 회사별 정책 엔진은 Production-ready (실구현) 로 남긴다.
- API 는 Hono REST 형식을 유지하고 공통 응답 wrapper 를 강제한다.
- 민감 데이터는 로그에 남기지 않는다.
- Web 에서 버튼을 숨겨도 API 에서 서버 측 권한 검증을 한다는 전제를 유지한다.

### 데이터/권한 기준

- 회사 기준 멀티테넌시를 깨지 않도록 `company_id` 범위를 명확히 둔다.
- 근태/휴가 데이터는 employee 본인 소유 데이터와 관리자 승인 데이터 구분이 가능해야 한다.
- 최소 권한 후보는 `attendance.read`, `attendance.manage`, `leave.request`, `leave.approve` 를 시작점으로 둔다.
- 승인/반려/정정 요청은 상태값과 처리 주체를 추적할 수 있어야 한다.
- 감사 로그 후보는 최소한 actor, action, target, created_at 정도의 기본 골격을 가진다.

## 6. 최소 검증 기준

이번 Phase 구현 카드가 로컬에서 확인해야 하는 최소 기준은 아래와 같다.

- `pnpm install` 가능
- `pnpm check` 통과
- `pnpm build` 또는 저장소 표준 build 명령 통과
- `pnpm typecheck` 통과
- `pnpm test` 통과
- attendance/leave shared schema 테스트 추가 및 통과
- API 테스트에 출퇴근/근태 조회/정정 요청/휴가 신청/승인의 기본 케이스 포함
- Web Production-ready (실구현) 이 최소한 build 또는 typecheck 를 깨지 않음
- README/가이드에 로컬 검증 순서가 정리됨

주의:

- 실제 운영 비밀값 없이 가능한 범위 안에서만 검증한다.
- 일부 명령이 패키지 구조상 filter 기반으로 나뉘면 저장소 표준 명령과 함께 결과를 남긴다.

## 7. 완료 기준

이번 Phase는 아래 조건을 모두 만족하면 완료로 본다.

1. Phase 3 범위 문서가 저장소 안에 있고 구현자가 바로 참조할 수 있다.
2. D1 migration 에 근태/휴가 1차 골격이 추가되어 있다.
3. `packages/shared` 에 attendance/leave 계약과 공통 응답 schema 확장이 정리되어 있다.
4. `apps/api` 에 출근/퇴근/근태기록/정정요청/휴가유형/휴가신청/휴가승인 기본 endpoint Production-ready (실구현) 이 있다.
5. `apps/web` 에 근태/휴가 기본 화면 Production-ready (실구현) 이 있다.
6. 권한/승인/민감정보 노출 금지 사항이 문서와 리뷰 기준에 반영되어 있다.
7. 승인된 release gate 범위 안에서 PR 생성, CI 확인, merge, branch cleanup 처리 조건이 분명하다.
8. 다음 Phase의 전자결재/급여 확장을 막지 않는 수준으로 handoff 정보가 정리되어 있다.

## 8. 승인/리뷰 체크포인트

구현 전에 다시 확인할 항목:

- 휴가 승인/반려를 별도 endpoint 두 개로 둘지, 상태 변경 endpoint 하나로 둘지
- 연차 잔여를 단순 mock/snapshot 으로 둘지, 기본 차감 계산 Production-ready (실구현) 를 넣을지

구현 후 리뷰에서 반드시 볼 항목:

- 출퇴근/정정/휴가 요청 payload 에 민감한 실운영 값이 남지 않았는지
- company scope 누락으로 타 회사 데이터가 섞일 여지가 없는지
- 본인 요청과 승인자 권한이 뒤섞이지 않았는지
- Web Production-ready (실구현) 가 실제 근태 마감/급여 반영 완료처럼 오해되지 않는지
- mock 응답이 이후 실제 정책 엔진/API 계약과 충돌하지 않는지

## 9. 다음 작업자 handoff

다음 구현 카드는 아래 순서로 진행하면 된다.

1. `packages/shared` 에 attendance/leave route, schema, 타입을 먼저 추가한다.
2. API 테스트에서 출퇴근/근태 조회/휴가 신청/승인의 기대 응답을 먼저 고정한다.
3. `apps/api/src/app.ts` 에 근태/휴가 route Production-ready (실구현) 을 추가한다.
4. `db/migrations` 에 후속 근태/휴가 migration 파일을 추가한다.
5. `apps/web` 근태/휴가 화면을 shared 계약 기준 Production-ready (실구현) 로 연결한다.
6. README/개발 가이드/사용자 가이드/운영 가이드의 검증 명령과 주의사항을 맞춘다.
7. `pnpm install/check/build/typecheck/test` 가능한 범위를 실제로 확인하고 결과를 handoff 에 남긴다.

주의 사항:

- 실제 근태/휴가 데이터 반입은 하지 않는다.
- production DB, 외부 출퇴근 장비, 유료 알림 리소스, 공개 배포는 별도 승인 전까지 건드리지 않는다.
- 승인 흐름은 이후 전자결재 Phase 와 겹치더라도 이번 Phase에서는 근태/휴가 자체 승인 Production-ready (실구현) 에 집중한다.
