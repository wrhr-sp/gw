# Phase 34 인사·지점·알림·감사 운영흐름 실사용화 handoff

## 한 줄 요약
지금 기준으로 `/employees`, `/org`, `/work-items/branch`, `/notifications`, `/admin/audit-logs` 는
모두 route 는 있지만
완성도와 연결 수준이 서로 다릅니다.

이번 Phase 34 문서는
무엇이 이미 same-origin API/권한 테스트/DB read fallback까지 붙어 있는지,
무엇이 아직 placeholder 안내 화면인지,
무엇이 PostgreSQL 전환과 다음 구현 과제로 남는지
한 번에 구분해 주는 기준입니다.

## 이번 Phase에서 대장이 기대해도 되는 것
이번 문서는 다음 다섯 가지를 같은 말로 묶는 기준입니다.

1. 인사 조회 route 와 관리자 인사 운영 route의 경계
2. 지점 업무가 현재 어떤 route와 scope로 노출되는지
3. 알림 inbox 가 어디까지 same-origin 실응답이고 어디부터 외부 발송 placeholder 인지
4. 감사 로그가 어떤 권한으로 읽히고 무엇을 숨기는지
5. PostgreSQL 전환이 이미 시작된 영역과 아직 아닌 영역

즉
"인사가 된다"
"지점이 된다"
"알림이 된다"
"감사가 된다"
를 막연하게 말하지 않고,
지금 무엇이 되고
무엇은 아직 preview/dev-safe 이며
무엇은 DB 전환과 운영 승인 게이트인지
분리해서 적는 문서입니다.

## 지금 바로 눌러볼 추천 순서
1. `/login`
   - `admin / 1234` 로 로그인합니다.
   - 이 계정은 dev/test/UAT 전용입니다.
2. `/dashboard`
   - 인사 조회와 관리자 감사 흐름이 어디서 갈리는지 봅니다.
3. `/employees`
   - 일반 조회 카드와 `/admin/users` 분리 문구를 봅니다.
4. `/org`
   - 읽기 전용 조직/역할/권한 블록을 봅니다.
5. `/work-items/branch`
   - 지점 업무가 공통 work item branch module로 노출되는지 봅니다.
6. `/notifications`
   - 실제 발송이 아니라 안내형 placeholder 인지 봅니다.
7. `/admin/audit-logs`
   - 감사 전용 진입, 필터, masked detail, read-only 경계를 봅니다.

## 지금 기준으로 분명히 말할 수 있는 것

### 1) `/employees`
지금 볼 수 있는 것:
- 직원 카드형 일반 조회
- 부서/재직 상태/역할 요약
- `/admin/users` 와 운영 변경 분리 안내
- `/api/employees`, `/api/departments` 연결 포인트

이미 있는 근거:
- `apps/api/src/app.ts` 의 `GET /api/employees`
- `apps/api/src/lib/operational-org.ts` 의 PostgreSQL employee/departments read fallback
- `apps/api/test/auth-org.spec.ts` 의 directory summary/filter/validation 경계 테스트

아직 남은 것:
- richer 검색/상세 drill-down
- 지점 배정/인사 운영 후속 UX
- 일반 조회에서 branch 운영 상황까지 함께 읽는 연결 정리

쉽게 말하면:
"직원 기본 조회와 관리자 운영 분리는 이미 볼 수 있지만,
실운영 인사 콘솔처럼 깊게 이어지는 단계는 아직 아니다"
입니다.

### 2) `/org`
지금 볼 수 있는 것:
- 부서 구조
- 역할/직책 요약
- 권한 체계 안내
- `/admin/users`, `/admin/policies` 와의 분리

이미 있는 근거:
- `GET /api/departments`, `GET /api/roles`, `GET /api/permissions`
- `operational-org.ts` 의 department/role/permission read fallback

아직 남은 것:
- 조직 구조 상세 drill-down
- branch/department/role 관계를 업무 흐름과 더 자연스럽게 잇는 UX
- 조직 개편 저장/운영 변경 기능

쉽게 말하면:
"조직을 읽는 화면은 있지만,
조직 운영을 바꾸는 화면은 아니다"
로 보면 됩니다.

### 3) `/work-items/branch`
지금 볼 수 있는 것:
- 지점 업무가 별도 앱이 아니라 branch scope work item 모듈로 노출된다는 점
- 지점 일일 보고/마감 후속이라는 현재 제품 언어
- branch manager/company scope 경계가 존재한다는 점
- `/api/branches` 읽기 전용 요약으로 같은 회사/지점 범위를 함께 확인할 수 있다는 점

이미 있는 근거:
- `packages/shared/src/contracts.ts` 의 `module: "branch"`, branch scope 필드
- `apps/api/src/app.ts` 의 `work_item_branch_daily_report`, branch deadline/document 데이터
- `apps/api/src/app.ts` 의 `GET /api/branches`
- `apps/api/test/auth-org.spec.ts` 의 branch scope/detail/deadline 경계 테스트

아직 남은 것:
- 독립 `/branches` 또는 지점 마스터 화면
- 지점 기본정보/배정/상태를 직접 다루는 운영 UX
- branch 운영 이력과 알림/감사 연동 정리

쉽게 말하면:
"지점 개념은 이미 읽기 API와 scope에 있지만,
사용자-facing 운영 화면은 아직 branch 업무 중심이고 독립 지점 마스터는 아니다"
입니다.

### 4) `/notifications`
지금 볼 수 있는 것:
- same-origin inbox 목록, unread count, category/status 카드
- 운영 가드레일과 audit hint
- 이 탭이 실제 푸시/메일/메신저 발송 완료 화면이 아니라는 명확한 안내
- `/dashboard`, `/menu` 로 복귀하는 다음 행동 안내

이미 있는 근거:
- `apps/web/app/notifications/page.tsx`
- `apps/web/app/_components/phase34-live-sections.tsx` 의 `NotificationsLiveSection`
- `apps/api/src/app.ts` 의 `GET /api/notifications`
- `apps/api/src/lib/operational-notifications.ts`
- `apps/api/test/auth-org.spec.ts` 의 notification inbox payload 테스트
- `apps/api/test/phase34-degraded-routes.spec.ts` 의 degraded DB fallback 테스트
- `mobile-pwa-config.ts` 와 메뉴 구조 안의 route 존재

아직 남은 것:
- 읽음 처리 저장/상태 변경 액션
- 알림 category/source 를 더 풍부하게 다루는 운영 UX
- 외부 발송 provider 연동
- 실발송 성공/실패/재시도 추적

쉽게 말하면:
"알림 inbox 조회는 이미 same-origin 으로 볼 수 있지만,
외부 발송 시스템이나 실전송 추적까지 닫힌 것은 아니다"
입니다.

### 5) `/admin/audit-logs`
지금 볼 수 있는 것:
- 감사 전용 진입 의미
- actor/action/category/date 필터
- 최근 이벤트 타임라인
- masked detail
- read-only/company boundary 설명

이미 있는 근거:
- `GET /api/admin/audit-logs`
- `apps/api/test/auth-org.spec.ts` 의 `audit.read` 허용/차단 및 createdFrom/createdTo 필터 테스트
- `apps/api/src/lib/operational-admin.ts` 의 operational audit_logs read fallback
- `apps/api/test/phase34-degraded-routes.spec.ts` 의 degraded DB fallback 테스트
- `apps/web/app/admin/audit-logs/page.tsx`

아직 남은 것:
- PostgreSQL 실기록 append/read 정합성
- branch/notification/employee 변화가 하나의 감사 흐름으로 묶이는 richer UX
- 더 깊은 상세 drill-down

쉽게 말하면:
"감사 조회와 권한 경계는 이미 읽을 수 있지만,
실운영 audit pipeline 전체가 닫힌 상태로 보면 안 된다"
입니다.

## 다음 구현자가 바로 기억할 경계

### 인사 조회와 관리자 운영을 섞지 말 것
- `/employees`, `/org` 는 일반 조회
- `/admin/users`, `/admin/policies` 는 운영 검토
- 같은 사람/조직 데이터를 보더라도 목적이 다르므로 화면 책임을 합치지 말아야 합니다.

### 지점은 일단 branch scope 업무흐름으로 먼저 볼 것
- 현재 지점 route 기준은 `/work-items/branch`
- 독립 지점 마스터 화면이 아직 없다는 사실을 숨기면 안 됩니다.

### 알림은 placeholder honesty를 깨면 안 됨
- 읽음/발송/재시도/API/외부 채널이 아직 없으면 있다고 쓰지 않습니다.
- 이번 단계에서는 "어디까지 아직 안 됨" 이 중요한 정보입니다.

### 감사는 `audit.read` 전용 read-only 흐름으로 적을 것
- 감사 조회 가능과 관리자 전체 허용을 같은 뜻으로 적지 않습니다.
- masked metadata와 raw 원문을 혼동하면 안 됩니다.

### DB 전환 진행 상태를 하나로 뭉개지 말 것
- employees/departments/roles/permissions 는 일부 PostgreSQL read fallback 있음
- branch는 `/api/branches` 읽기 요약과 scope 근거는 있으나 독립 지점 마스터 저장/운영 UX 정리 미완
- notifications 는 same-origin inbox API 와 operational read fallback 이 있으나 외부 발송/재시도/상태 변경은 후속
- audit logs 는 read route/권한/필터와 operational read fallback 이 있으나 richer drill-down/append 운영 정합성은 후속

## 다음 작업자가 가장 먼저 볼 파일
### Web
- `apps/web/app/employees/page.tsx`
- `apps/web/app/org/page.tsx`
- `apps/web/app/work-items/branch/page.tsx`
- `apps/web/app/work-items/work-items-config.ts`
- `apps/web/app/notifications/page.tsx`
- `apps/web/app/admin/audit-logs/page.tsx`

### API / DB read
- `apps/api/src/app.ts`
- `apps/api/src/lib/operational-org.ts`

### Shared / Test
- `packages/shared/src/contracts.ts`
- `apps/api/test/auth-org.spec.ts`
- 필요 시 `apps/web/org-employees-boundary.test.tsx`
- 필요 시 `apps/web/work-items.test.tsx`
- 필요 시 `apps/web/admin-console-pass1.test.tsx`

## 다음 구현 우선순위
1. `t_959f0f18`
   - employees/branches/notifications/audit_logs PostgreSQL 기준선 정리
2. `t_c06b17a6`
   - `/employees`, `/org`, `/work-items/branch`, `/notifications`, `/admin/audit-logs` happy path/권한/state UX 보강
3. 이후 reviewer/tester/docs/ops
   - route/API/test/문서 언어를 다시 맞추고,
     대장이 실제로 눌러볼 route와 승인 게이트를 최종 보고로 정리

## 마지막 한 줄 정리
Phase 34는
인사·지점·알림·감사를
"자리만 있는 화면"
에서
"무엇은 이미 연결됐고 무엇은 아직 placeholder/DB 전환 과제인지 설명 가능한 운영 흐름"
으로 끌어올리는 기준 단계입니다.
