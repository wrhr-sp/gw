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

### 3. 현재 문서화/검증 기준은 Phase 59 UAT·사용자/관리자 가이드·도입 체크리스트 최종 정리 단계

현재 루트 문서, handoff 는 아래 기준을 함께 설명한다.

- 로그인 시작점: 익명은 `/login` 만 허용
- 홈 확인 시작 레인: `/dashboard`
- 전체 탐색 확인 레인: `/menu`
- 운영/관리 확인 레인: 필요 시 `/management` → `/admin/users` → `/admin/audit-logs` → `/me`
- 차단 확인 레인: `empty`/`forbidden`, `error`/`offline`, `preview`/`dev-safe` 구분
- 역할 확인 레인: EMPLOYEE/MANAGER/HR_ADMIN/COMPANY_ADMIN/AUDITOR 시작점과 차단 레인 분리
- 문서 묶음: Phase 59 최종 정리 문서 + Phase 44 직원/관리자/체크리스트 문서 + Phase 58 상태 문장 문서 + Phase 57 홈/메뉴 IA 문서 + Phase 56 운영 레인 분리 문서

- `/dashboard`, `/menu`, `/management`, `/admin/users`, `/me` 는 같은 상태 체계를 공유하되 같은 책임 화면처럼 읽히면 안 된다.
- `empty` 는 정상 빈 상태일 수 있고, `forbidden` 은 로그인 실패가 아니라 권한/범위 차단 상태로 읽혀야 한다.
- `error` 는 조회/불러오기 실패, `offline` 은 네트워크 불안정으로 구분돼야 한다.
- `preview`, `dev-safe`, `참고용 요약 데이터`, `내부 확인용 데이터` 는 실저장/실발송/실반영 완료처럼 읽히면 안 된다.
- HR_ADMIN 의 첫 관리자 레인은 `/management` 가 아니라 `/admin/users` 여야 하고, AUDITOR 는 `/admin/audit-logs` read-only 시작점으로 남아야 한다.
- production data, 실제 초대 발송, 실제 비밀번호 운영 전환, 외부 IdP/SSO/SAML/SCIM, production DB 기반 개인 홈 커스터마이징 영구 저장, 외부 메신저/메일/푸시/SMS 연동, background sync, native 배포, production backup/restore 실행, 외부 SIEM/alerting, secret, DNS/custom domain, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 Phase 59 단계에서 남아 있는 제품형 리스크

- 상태 문장이 route마다 조금씩 다르면 같은 `empty` 도 어떤 화면에서는 정상, 어떤 화면에서는 실패처럼 읽혀 사용자 기대치가 흔들릴 수 있다.
- `/dashboard` 와 `/menu` 를 같은 홈 흐름처럼 적으면 사용자 가이드와 체크리스트가 다시 어긋날 수 있다.
- `forbidden` 을 로그인 실패나 네트워크 오류처럼 적으면 권한 이슈와 접속 이슈가 한데 섞여 운영 대응이 늦어질 수 있다.
- `preview/dev-safe` 와 실제 저장 완료를 분리하지 못하면 `/management` 와 `/admin/users` 의 현재 범위를 과장하게 된다.
- HR_ADMIN/MANAGER/COMPANY_ADMIN/AUDITOR 의 첫 진입점과 차단 레인이 흐려지면 홈, 운영 허브, 감사 레인 경계가 다시 무너질 수 있다.
- `/me` 를 세션·권한·개인 확인이 아니라 관리자 설정 화면처럼 읽게 되면 일반 사용자와 운영자 문맥이 다시 섞일 수 있다.
- live 직접 확인 근거와 local build/test/release gate 대체 근거가 섞이면 상태 문장 정비 수준이 과장될 수 있다.

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
