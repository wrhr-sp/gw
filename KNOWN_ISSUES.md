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

### 3. 현재 문서화/검증 기준은 Phase 42 근태·휴가·인사·지점 운영 도입완성 반영 후 release gate 준비

현재 루트 문서와 handoff 는 `/attendance`·`/leave` 직원 기본 업무, `/employees`·`/org` 읽기 중심 조회, `/management` 아래 `/work-items/branch` 운영 레인, 정책 미허용 방식·role boundary·branch scope·승인 게이트를 한 번에 설명하는 준비를 중심으로 맞춘다.

- 최신 tester 재검증에서는 focused shared/API/Web 회귀, `pnpm check`, Next/OpenNext build, local admin-host preview smoke, 익명·직원·매니저·회사관리자 route/API curl smoke 가 모두 통과했다.
- reviewer 단계에서 shared contracts 구문 오류와 홈 관리자 검토 흐름의 `/work-items/branch` 누락이 한 번 발견됐고 자동 재수정 체인으로 해소됐다.
- `/dashboard` 기본 순서는 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 로 다시 고정한다.
- `/employees` 와 `/org` 는 읽기 중심 조회 화면이며 `/admin/users` 운영 검토와 같은 책임으로 설명하지 않는다.
- `/management` 아래 `/work-items/branch` 는 일반 직원 홈이 아니라 branch scope 운영 레인으로 유지한다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.
- production data, secret, 실제 운영 bucket 연결, 외부 SSO/OAuth/SMS/OTP, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 Phase 42 단계에서 남아 있는 제품형 리스크

- `/attendance` 에서 정책 미허용 방식이 성공 UX 처럼 보이면 실제 운영 도입 때 가장 먼저 혼란이 생긴다.
- `/leave` 에서 신청자 lane 과 승인자 lane 이 섞이면 직원 기본 업무와 승인 책임이 뒤엉킬 수 있다.
- `/employees`·`/org` 가 읽기 중심 조회가 아니라 운영 변경 화면처럼 읽히면 `/admin/users`·`/admin/policies` 책임 경계가 무너진다.
- `/management` 와 `/work-items/branch` 가 일반 직원 홈과 섞이면 branch scope 운영 경계와 민감 모듈 허브 분리 의도가 흐려진다.
- 태그 단말, GPS, 외부 HR/급여/세무/노무 시스템, production 실데이터가 아직 승인 게이트라는 점이 문서에서 약해지면 과도한 기대치 리스크가 커진다.

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
