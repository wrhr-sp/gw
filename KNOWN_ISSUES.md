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

### 3. 현재 문서화/검증 기준은 Phase 46 계정·권한·조직 온보딩 리허설 단계

현재 루트 문서와 handoff 는 아래 기준을 함께 설명한다.

- 공통 post-login landing: COMPANY_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE = `/dashboard`, AUDITOR = `/admin/audit-logs`
- HR/계정관리 다음 레인: admin host `/admin/users` → `/employees` → `/org`
- 운영 관리자/지점 관리자 다음 레인: general host `/management` → `/work-items/branch`
- 감사 read-only 레인: admin host `/admin/audit-logs`
- 문서 묶음: Phase 46 scope/handoff + 직전 Phase 45 최종검증 문서 세트

- `/admin/users` 는 dev-safe 생성/권한 diff/상태 변경/비밀번호 초기화 preview 화면이며 실제 저장 완료 화면이 아니다.
- `/employees` 와 `/org` 는 읽기 중심 조회로 유지한다.
- `/management` 는 일반 직원 홈이 아니라 운영 관리자 허브로 유지한다.
- `/admin/audit-logs` 는 감사 read-only 진입점으로 유지한다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.
- production data, 실제 초대 발송, 외부 IdP/SSO/SAML/SCIM, 실제 급여 지급/실신고, 주민번호/계좌번호 확대, 외부 세무/노무/법무/보험/기관 연동, 법령 API 인증키, secret, DNS/custom domain, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 Phase 46 단계에서 남아 있는 제품형 리스크

- 최신 재검증 기준은 focused API 98 passed, remediation 이후 focused web 102 passed, mobile typecheck, web build, local preview 익명 redirect smoke 다. 다만 이 근거도 여전히 내부 검증 baseline 이고 live 직접 확인과 같은 뜻은 아니다.
- `/admin/users` preview 를 실제 저장 완료 화면처럼 읽으면 운영 기대치가 과도하게 올라간다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토가 섞이면 책임 분리가 흐려진다.
- 공통 landing(`/dashboard`)과 역할별 다음 레인(`/admin/users`, `/management`, `/admin/audit-logs`)이 같은 온보딩 절차처럼 뭉개지면 내부통제 기대치가 무너진다.
- 비밀번호 초기화 preview 에 실제 값이 URL/배너/예시 문장에 오래 남으면 dev-safe 경계가 무너질 수 있다.
- 실제 초대 발송, 외부 IdP/SSO, production 비밀번호/실데이터 저장, 외부 연동 승인 게이트가 약해지면 아직 안 닫힌 범위가 이미 가능한 것처럼 오해될 수 있다.

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
