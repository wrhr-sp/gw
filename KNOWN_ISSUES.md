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

### 3. 현재 문서화/검증 기준은 실사용 전환 1차 fit-gap + Phase 31 준비

현재 루트 문서와 handoff 는 로그인/홈/경영업무/계정관리 실사용화 준비를 중심으로 맞춘다.

- 기본 일반 업무 흐름과 관리자 운영 흐름, 공통 `work item` 모듈 흐름은 계속 유지하되, 현재 활성 정리 기준은 그 위에 "대장이 실제로 어디까지 바로 눌러볼 수 있는가"를 다시 분리하는 것이다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.
- 익명 `/login` 200, `/dashboard` 200, `/management` 307, `/admin` 307, `/api/me` 401 과 관리자 `/management` 200, 일반 직원 `/management` 307 `/forbidden`, 관리자 `/api/admin/users` 200, 일반 직원 `/api/admin/users` 403 경계를 문서/테스트/최종 보고에서 같은 뜻으로 유지해야 한다.
- `/dashboard` 는 분리 구조가 작동해도 제목/설명에 아직 `skeleton`, `placeholder/dev-safe` 언어가 남아 있어 실제 홈 체감과 문구 사이 간격이 있다.
- `/dashboard` 홈 바로가기 영역은 구조 자체는 맞지만, `로그인 전 미조회` / `커스텀 없음` / `API load error` 를 문서와 화면에서 같은 뜻으로 계속 유지해야 한다.
- `/admin/users` 는 `GET /api/admin/users` preview 와 dev-safe action 폼이 있지만, 실제 저장이 아니라 303 redirect 결과 문구 중심이라는 점을 숨기면 안 된다.
- `/admin/users` preview 뒤 다시 눌러볼 route(`/management`, `/admin/audit-logs`, 일반 업무 happy path`)를 짧게 고정하지 않으면 계정 preview 가 실제 저장처럼 오해될 수 있다.
- `/boards`, `/documents`, `/me`, `/admin`, `/attendance`, `/leave`, `/approvals` 는 route 진입과 일부 상태 확인은 가능하지만, 아직 happy path 체감이 고르게 닫히지 않았다는 점을 숨기면 안 된다.
- production data, secret, 실제 권한 저장, 외부 연동, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 실사용 전환 1차/Phase 31 단계에서 남아 있는 제품형 리스크

- `admin / 1234` 를 UAT용이 아니라 운영 기본 계정처럼 문서화하면 보안/운영 기대치가 바로 어긋난다.
- `/dashboard` 와 `경영업무`(`/management`) 분리를 흐리게 쓰면 일반 직원 홈과 민감 모듈 허브가 다시 섞일 수 있다.
- 홈 바로가기의 고정/커스텀 분리와 빈 상태 설명을 느슨하게 쓰면 PC/모바일 홈 안내가 다시 어긋날 수 있다.
- `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` 중 일부 route 를 실제 저장/승인/외부 연동 완료처럼 과장하면 fit-gap 우선순위가 무너진다.
- `/admin/users` 와 `/api/admin/users` 의 dev-safe 계정관리 흐름을 실제 메일 초대/SSO/외부 IdP 완료처럼 쓰면 승인 게이트가 사라진다.
- 비밀번호 preview 에 보이는 `1234` 를 production 기본 비밀번호처럼 오해되게 문서화하면 보안 기대치가 바로 깨진다.
- `/management` 와 `/work-items/legal`·`/work-items/hr`·`/work-items/tax` 같은 민감 모듈 진입 구조를 모바일 `홈`/`메뉴`/PC sidebar 에서 다르게 풀면 경영업무 분리 의도와 UAT 안내가 함께 흔들릴 수 있다.
- 익명/관리자/일반 직원의 landing·forbidden 경계를 문서마다 다르게 적으면 권한 테스트 근거와 사용자 체험 설명이 어긋날 수 있다.
- 외부 인증, 실급여 지급, 실신고, production DB, 실제 개인정보 입력 확대를 이번 단계의 후속 happy path 처럼 적으면 승인 범위가 흐려질 수 있다.

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
