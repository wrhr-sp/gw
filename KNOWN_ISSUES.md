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

### 3. 현재 문서화/검증 기준은 Phase 32 게시판·공지·댓글·문서함 실사용화 준비

현재 루트 문서와 handoff 는 게시판·공지·댓글·문서함 협업 흐름을 실제 UAT 단계로 끌어올리는 준비를 중심으로 맞춘다.

- 기본 일반 업무 흐름과 관리자 운영 흐름, 공통 `work item` 모듈 흐름은 계속 유지하되, 현재 활성 정리 기준은 그 위에 `/boards` 와 `/documents` 가 대장이 실제로 어디까지 바로 눌러볼 수 있는가를 다시 분리하는 것이다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.
- `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 는 route 진입과 live panel 확인뿐 아니라 preview 생성/읽음 확인/guard probe 일부까지 가능하지만, 아직 게시판 상세/게시글 상세/문서 상세 UAT 체감이 완전히 닫힌 것은 아니라는 점을 숨기면 안 된다.
- EMPLOYEE 기준 general 게시글 작성·댓글·read receipt 가능, notice-only 글쓰기 차단, private space 차단, forged post/read receipt 차단을 문서/화면/테스트에서 같은 뜻으로 유지해야 한다.
- COMPANY_ADMIN 기준 게시판 생성, 문서공간 생성, 문서 metadata 생성은 가능하지만 raw `storageKey` 비노출 원칙을 계속 지켜야 한다.
- richer editor, 상세 스레드/버전 UX, 외부 공유, 실운영 업로드 확대가 닫히지 않으면 화면 실사용화와 실제 운영 협업 체감 사이 간격이 계속 남는다.
- production data, secret, 실제 권한 저장, 외부 연동, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 Phase 32 단계에서 남아 있는 제품형 리스크

- notice-only 게시판과 general 게시판 책임을 흐리게 쓰면 공지 전달과 일반 소통 규칙이 다시 섞일 수 있다.
- `/boards/[boardId]` 와 `/posts/[postId]` 를 실제 협업 완성품처럼 과장하면 placeholder honesty 가 무너진다.
- EMPLOYEE 의 general 게시글 작성 허용과 notice/private/forged 차단을 문서마다 다르게 적으면 권한 테스트 근거와 UAT 설명이 어긋날 수 있다.
- `/documents` 의 metadata 중심 범위를 문서 상세/원본 저장/외부 공유 완료처럼 쓰면 storage 승인 게이트가 사라질 수 있다.
- raw `storageKey`, bucket 내부명, public URL 같은 storage 내부정보가 화면/문서/API 예시에 드러나면 Phase 32의 보안 경계가 바로 무너진다.
- PostgreSQL/R2 전환 전 상태와 전환 후 목표를 한 문장으로 섞어 쓰면 builder/reviewer/tester가 서로 다른 완료 기준을 잡게 된다.
- `/boards` 와 `/documents` 를 모바일 `홈`/`메뉴`/PC sidebar 에서 다른 우선순위로 풀어 쓰면 UX 안내가 다시 흔들릴 수 있다.
- 외부 공유, production 문서 실데이터, secret, paid resource, migration 을 이번 단계의 후속 happy path 처럼 적으면 승인 범위가 흐려질 수 있다.

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
