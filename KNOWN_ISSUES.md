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

### 3. 현재 문서화/검증 기준은 역할봇 권한·판단루프·보고정책·검증자동화 고도화

현재 루트 문서와 handoff 는 역할봇 권한 확대보다 싱드/Watcher 판단루프 보강을 우선하는 체인을 기준으로 맞춘다.

- blocked 재판단 순서는 release cleanup → stale/superseded → review-required 재검증 → recovery loop → 승인 필요 순으로 고정하는 방향이다.
- `already-handled` 로그는 해결 완료 확정이 아니라 원본 카드와 생성 체인 상태 재확인 신호로 다뤄야 한다.
- Telegram 보고는 `자동화가 한 일`, `싱드가 직접 개입한 일`, `자동화가 못 끝낸 이유`, `보완한 자동화`를 분리해야 한다.
- 정각 보고 외 raw 이벤트 중계는 계속 금지하며, 카드 댓글만으로 사용자 보고 완료라고 보지 않는다.
- 같은 카드·같은 이유·같은 근거의 중복 보고를 막는 기준과, 카드 댓글 작성 완료/사용자 직접 보고 완료를 분리 기록하는 기준이 필요하다.
- fixture/dry-run/service journal/board state/PR-CI-main gate를 같이 보는 검증 세트가 필요하다.
- 역할별 기본 책임(`gwplanner/gwbuilder/gwreviewer/gwtester/gwdocs/gwops`)과 card-scoped 예외 권한을 문서/결과에서 같은 뜻으로 유지해야 한다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 자동화 보강분 이력

이전 자동화 보강 작업은 완료 이력으로 남겨 둔다.

대상:

- review-required gate 표준 검증
- safe triage 실패 재시도/backoff
- recovery loop 생성
- systemd watcher PATH 보강
- release cleanup/stale blocker 자동 정리 운영 경험

관련 Kanban 체인:

- `t_3cc774a3` → `t_f54c6e19` → `t_27995f12` → `t_cda0641f` → `t_3539349e` → `t_d7f30c03` → `t_3cc826c6`

남은 운영 메모:

- 위 체인은 완료 이력이다. 현재 활성 작업과 섞어 읽지 않는다.
- board 에 남아 있는 예전 scheduled 복구 카드는 문서 기준 재분류가 끝났고, 최신 `main` 기준으로는 stale/superseded 여부 판단 근거가 정리돼 있다.
- 같은 실패군에서 기준 카드 1장만 남기고 중복 카드를 정리하는 원칙은 유지하되, 2026-06-12 정리표 기준으로 새 기준 카드로 남길 scheduled 카드는 없다.
- 2026-06-12 구현 보고서 `docs/guides/scheduled-recovery-card-cleanup-report-2026-06-12.md` 와 부모 재검증 근거 기준으로 web build/attendance recovery loop 관련 scheduled 카드 14장은 모두 stale/superseded 후보다.
- 아직 남은 일은 문서 판단을 board 상태 정리에 안전하게 반영하는 운영 마무리뿐이다.
- 마지막 운영 마무리에서는 card-scoped 예외 권한을 상시 권한처럼 오해하지 않도록 결과 문구를 한 번 더 확인해야 한다.

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
