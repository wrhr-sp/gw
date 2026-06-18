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

### 3. 현재 문서화/검증 기준은 Phase 57 홈·대시보드 분리, 고정/커스텀 바로가기, 모바일/PC IA 단계

현재 루트 문서, handoff 는 아래 기준을 함께 설명한다.

- 로그인 시작점: 익명은 `/login` 만 허용
- 홈 확인 시작 레인: `/dashboard`
- 전체 탐색 확인 레인: `/menu`
- 사용자/운영 확인 레인: 회사 공통 고정 바로가기 확인 → 권한 기반 사용자 전용 바로가기 확인 → 하단 탭 5개 → 필요 시 `/management`·`/admin/users`·`/admin/audit-logs`
- 차단 확인 레인: 권한 없는 운영 shortcut 비노출, 운영/감사 route 분리, empty/error/offline/dev-safe 구분
- 운영 설명 레인: 일반 직원 홈 CTA 와 운영/감사/경영업무 진입점은 분리
- 문서 묶음: Phase 57 scope/handoff/guide + Phase 56 운영 레인 분리 문서 + Phase 47 모바일/PWA 기준 문서 + Phase 24 파일럿 IA 문서

- `/dashboard` 는 오늘 할 일 시작 홈처럼 먼저 읽혀야 하고, `/menu` 는 전체 기능 탐색 화면처럼 읽혀야 한다.
- 회사 공통 고정 바로가기와 권한 기반 사용자 전용 바로가기는 서로 다른 정책으로 읽혀야 한다.
- `/management`·`/admin/users`·`/admin/audit-logs` 는 운영/감사 레인이며, 일반 직원 홈 확장처럼 보이면 안 된다.
- 모바일 하단 탭 5개, 모바일 전체 메뉴, PC sidebar 는 같은 정보구조를 가리켜야 하며 서로 다른 사이트맵처럼 풀리면 안 된다.
- 권한 기반 shortcut 노출 기준, 직접 route 접근 기준, API guard 기준은 shared helper 기준선이 있어도 live URL에서의 사용자 문장과 route 상태는 이번 Phase에서 다시 잠가야 한다.
- production data, 실제 초대 발송, 실제 비밀번호 운영 전환, 외부 IdP/SSO/SAML/SCIM, production DB 기반 개인 홈 커스터마이징 영구 저장, 외부 메신저/메일/푸시/SMS 연동, background sync, native 배포, production backup/restore 실행, 외부 SIEM/alerting, secret, DNS/custom domain, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 Phase 57 단계에서 남아 있는 제품형 리스크

- `packages/shared/src/contracts.ts`, `packages/shared/src/admin-access.ts`, `packages/shared/src/mobile-contracts.ts` 기준선은 충분하지만, live URL 기준 홈/메뉴 실사용 탐색 흐름 문장, 역할별 가이드, UAT 절차가 약하면 "코드는 있는데 실제로는 어떻게 찾고 써야 하는지"가 흐려질 수 있다.
- `/dashboard` 와 `/menu` 의 책임 차이가 문장상 흐려지면 홈과 전체 메뉴가 중복 랜딩처럼 보이는 과장 리스크가 생긴다.
- 고정 바로가기와 사용자 전용 바로가기의 책임 차이가 흐려지면 권한 없는 사용자도 운영 메뉴를 기대하게 될 수 있다.
- `/management`·`/admin/users`·`/admin/audit-logs` 운영 레인이 홈 CTA 와 같은 화면 설명에서 섞이면 사용자 권한 기대치가 무너질 수 있다.
- 모바일 하단 탭 5개, 전체 메뉴, PC sidebar 가 서로 다른 사이트맵처럼 읽히면 실제 현장 사용자가 메뉴 위치를 헷갈릴 수 있다.
- empty/loading/error/forbidden/offline/dev-safe 가 route 기준으로 다시 잠기지 않으면 최종 보고가 happy path 위주로만 적혀 실제 사용 리스크를 숨기게 된다.
- live 직접 확인 근거와 local build/test/release gate 대체 근거가 섞이면 홈·메뉴 IA 실사용 확인 수준이 과장될 수 있다.

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
