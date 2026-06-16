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

### 3. 현재 문서화/검증 기준은 Phase 42A 로그인 필수 진입 정책 반영 후 release gate 준비

현재 루트 문서와 handoff 는 `/login` 단일 입구, 익명 내부 route/API 차단, 자동 로그인 세션 유지 선택, `/offline` 업무 복구 제거, 로그인 후 `/management`·`/admin*`·민감 API guard 유지 기준을 한 번에 설명하는 준비를 중심으로 맞춘다.

- 최신 tester 재검증에서는 익명 `/`·`/dashboard`·`/management` 차단, `/login` 허용, rememberSession on/off 쿠키 차이, general/admin host 경계, local preview smoke 가 모두 통과했다.
- 다만 release gate 전에는 reviewer가 남긴 교차확인 메모(`admin / 1234` dev-safe fallback 운영 경계, API 기본 요청 rememberSession opt-in 보장)를 다시 본다.
- 로그인 전 허용 route 는 `/login`, 로그인 처리 API, 정적 자산, 최소 health 로 제한한다.
- `/`, `/dashboard`, `/menu`, `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/messenger`, `/mail`, `/notifications`, `/uat`, `/management`, `/admin*`, 내부 업무 API 는 익명 접근 차단 대상으로 다시 고정한다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.
- 자동 로그인은 비밀번호 저장이 아니라 세션 유지 선택이라는 guardrail 언어로 적어야 한다.
- `/offline` 은 업무 복구 링크 모음이 아니라 로그인 재시도 안내 수준으로 축소해야 한다.
- production data, secret, 실제 운영 bucket 연결, 외부 SSO/OAuth/SMS/OTP, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 Phase 42A 단계에서 남아 있는 제품형 리스크

- 익명 사용자가 `/` 또는 내부 route 를 로그인 없이 볼 수 있으면 제품 진입 정책이 바로 무너진다.
- 자동 로그인 구현이 비밀번호 저장처럼 읽히거나 실제로 그렇게 동작하면 보안/기대치 리스크가 커진다.
- `/offline` 에 내부 업무 복구 링크가 남아 있으면 이번 정책과 운영 메시지가 정면 충돌한다.
- login page 가 dev-safe UAT 링크를 너무 많이 유지하면 "첫 진입은 로그인만" 원칙이 흐려질 수 있다.
- 로그인 후 `/management`, `/admin*`, 민감 업무 API guard 가 느슨해지면 로그인 전면 차단보다 더 큰 권한 리스크가 생길 수 있다.

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
