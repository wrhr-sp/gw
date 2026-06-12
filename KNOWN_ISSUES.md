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

### 3. 현재 문서화/검증 기준은 Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안

현재 루트 문서와 handoff 는 게시판/공지/문서함/R2 skeleton 과 전체 smoke 기준을 다시 묶어, 대장이 preview/live URL에서 핵심 업무·협업 route·관리자 route를 함께 검토할 수 있는 Phase 16 체인을 기준으로 맞춘다.

- 핵심 업무 route 묶음은 `/`, `/login`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees`, `/org` 이다.
- 협업 보강 route는 `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 이다.
- 관리자 route는 `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 와 검증용 `/api/health`, `/admin/manifest.webmanifest` 이다.
- 일반 업무 흐름, 협업 흐름, 관리자 검토 흐름은 같은 제품 안에 있어도 노출 목적과 권한 경계를 분리해서 설명해야 한다.
- `/boards` 와 `/documents` 는 같은 협업 묶음이지만 notice-only/게시판 책임과 문서공간/첨부 보관 경계는 분리해 설명해야 한다.
- R2 관련 범위는 private-by-default, D1 metadata 우선, raw storage 정보 비노출 기준까지만 다루며 실제 운영 업로드/public URL 오픈은 여전히 별도 승인이다.
- blocked/empty/error 상태는 권한 부족, 회사 scope, 정책 미허용, placeholder/dev-safe 제한 중 무엇인지 구분해 설명해야 한다.
- live `.workers.dev` fetch 가 환경 gate 에 막히면 local `preview:cf` smoke, build:cf, deployment metadata 같은 대체 근거를 같이 남겨야 한다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 파일럿 초안 단계에서 남아 있는 제품형 리스크

- 게시판/문서 흐름이 보여도 실제 운영 협업툴 완성 상태처럼 오해될 수 있어 placeholder honesty를 계속 관리해야 한다.
- `/documents` 와 첨부 metadata 흐름은 존재하지만, 실제 파일 업로드/다운로드 완성형 기대를 만들지 않도록 문구와 smoke 기준을 더 엄격히 유지해야 한다.
- notice-only/private space/forged 접근 차단이 화면 문구와 테스트에서 같은 뜻으로 읽히지 않으면 운영자가 제한 사유를 오해할 수 있다.
- 일반 업무 화면과 관리자 정책/권한/감사 preview 연결이 약하면 "어디까지 사내 검토 가능 상태인지" 설명이 흐려질 수 있다.
- live URL 직접 fetch가 안 되는 환경에서는 대체 검증 근거를 남기지 않으면 파일럿 검토 신뢰도가 떨어진다.

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
