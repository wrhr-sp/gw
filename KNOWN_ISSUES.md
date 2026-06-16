# KNOWN_ISSUES

## 현재 알려진 제한

### 1. 대부분의 기능은 아직 실사용 완성 전 단계

- 이 프로젝트의 최종 목표는 우리 회사가 실제 사용할 그룹웨어 완제품이다.
- 현재 일부 API와 화면은 skeleton/placeholder지만, 이는 완제품으로 가기 위한 중간 산출물이다.
- 문서와 작업 카드는 “영구 제외”가 아니라 “별도 승인 후 단계적으로 실사용 연결”할 항목을 구분해야 한다.

### 2. production 데이터/secret/DNS/유료 리소스는 미연결 또는 승인 대기 범위

- production DB 실데이터 변경 없음
- secret 입력/교체 없음
- DNS/custom domain 없음
- 유료 리소스 생성·증액 없음
- 실제 개인정보 처리 없음
- 외부 HR 연동 없음
- 실제 운영 파일 업로드 확대/공개 다운로드 없음
- 실제 앱스토어 배포/외부 테스터 배포 없음

### 3. 현재 문서화/검증 기준은 Phase 36 운영자 설정·회사정책·권한관리 fit-gap 준비

현재 루트 문서와 handoff 는 운영자 설정·회사정책·권한관리의 현재 read model 과 남은 gap 을 한 번에 설명하는 준비를 중심으로 맞춘다.

- 기본 일반 업무 흐름과 관리자 운영 흐름은 계속 유지하되, 현재 활성 정리 기준은 그 위에 `/dashboard`·`/menu` 홈 shortcut, `/org`·`/employees` 일반 조회, `/admin/users`·`/admin/policies`·`/admin/audit-logs` 운영 검토가 대장이 실제로 어디까지 바로 읽어볼 수 있는가를 다시 분리하는 것이다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.
- `/dashboard`·`/menu` 는 shortcut API와 권한 기반 노출 차이를 확인할 수 있지만, 회사 shortcut 정책 편집 UI나 사용자 영구 저장 커스터마이징이 이미 닫힌 것처럼 쓰면 안 된다.
- `/employees`·`/org` 는 일반 조회/카탈로그 흐름이고, `/admin/users` 는 운영 검토 preview 흐름이라는 책임 차이를 숨기면 안 된다.
- `/admin/policies` 는 정책 기준 화면이지만 production 정책 저장/개인 override/실장비 연동이 이미 닫힌 것처럼 쓰면 안 된다.
- `/admin/audit-logs` 는 read-only 감사 흐름이지만 richer 조치 workflow 나 raw 감사 원문 노출이 닫힌 것처럼 쓰면 안 된다.
- role/permission 카탈로그, shortcut 노출 기준, 운영 diff preview 가 각각 다른 층이라는 점을 문서/화면/테스트에서 같은 뜻으로 유지해야 한다.
- production data, secret, 실제 권한 저장, 외부 IdP/실메일/외부 연동, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 Phase 36 단계에서 남아 있는 제품형 리스크

- 회사 고정 shortcut 과 권한 기반 사용자 전용 shortcut 을 완성 커스터마이징처럼 쓰면 현재 구현 범위가 과장될 수 있다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토를 같은 계정관리 화면처럼 쓰면 권한 책임이 흐려질 수 있다.
- `/admin/policies` 의 current/candidate 설명과 `/attendance`·`/leave` 의 결과 안내를 다른 뜻으로 쓰면 회사 정책 모델이 흔들릴 수 있다.
- role/permission 카탈로그 조회와 실제 권한 저장을 같은 말로 쓰면 승인 범위가 흐려질 수 있다.
- `/admin/audit-logs` read-only 경계를 숨기고 richer 조치 workflow 가 이미 있는 것처럼 적으면 후속 구현 범위가 흐려질 수 있다.
- 외부 IdP/실메일/대량 초대/production 정책 저장을 현재 단계 happy path 처럼 적으면 승인 범위가 흐려질 수 있다.

### 5. 역할봇 스킬 동기화 이슈 이력

- `kanban-automation-recovery` 스킬 누락으로 도담 카드가 crash난 이력이 있다.
- 현재는 도담/이룸/바름/해봄/다온에 동기화했다.
- 앞으로 강제 skill을 붙이는 카드 생성 전 대상 프로필에 skill이 있는지 확인해야 한다.

### 6. 제한적 재귀적 자기개선 루프 적용 범위

- 현재 카드와 직접 관련 있는 문서·테스트·QA·핸드오프 개선에만 적용한다.
- 반복 실수 방지 규칙, 테스트 실패 원인, 다음 작업자가 참고할 체크리스트는 지정 문서에 남긴다.
- 다른 보드/repo/domain/mainbot, 운영 DB, 실데이터, secret, DNS/custom domain, 유료 리소스, 배포/릴리즈/PR merge, 승인 없는 서비스 재시작, 카드 범위 밖 리팩토링은 자기개선 명목으로 자동 처리하지 않는다.
- 필요한 경우 사용자 승인 필요 항목으로 분리한다.

## 임시 대응 원칙

- 검증 실패는 자동 재수정 루프로 돌린다.
- 같은 카드/같은 실패군에서 반려·검증 실패·자동 재수정이 3회 이상 반복되면 새 재수정 카드를 계속 늘리지 않고 싱드가 직접 개입해 원인과 중복 worker 여부를 확인한다.
- 사용자 승인 필요 항목은 blocked/scheduled로 분리해 보고한다.
- 막힘/자동 조치/최종 결과 보고는 싱드가 원본 카드/로그를 확인해 쉬운 한국어로 재해석한다.
- 배포가 포함된 최종 결과 보고에는 live URL과 사용자가 직접 보면 되는 화면/경로/확인 포인트를 포함한다.
