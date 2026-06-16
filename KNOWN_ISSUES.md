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

### 3. 현재 문서화/검증 기준은 Phase 37 내부 운영 저장흐름·감사 연결 fit-gap 준비

현재 루트 문서와 handoff 는 내부 운영 저장흐름의 현재 read model 과 남은 gap 을 한 번에 설명하는 준비를 중심으로 맞춘다.

- 기본 일반 업무 흐름과 관리자 운영 흐름은 계속 유지하되, 현재 활성 정리 기준은 그 위에 `/documents` 파일 lifecycle, `/admin/audit-logs` storage preview, `/management`·`/payroll`·`work-items/*` 민감자료 approval gate 가 대장이 실제로 어디까지 바로 읽어볼 수 있는가를 다시 분리하는 것이다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.
- `/documents` 는 upload/download 준비와 `storageStatus` 를 확인할 수 있지만, 외부 공개 다운로드나 public share 가 이미 닫힌 것처럼 쓰면 안 된다.
- `/admin/audit-logs` 는 read-only 감사 흐름이지만 richer 조치 workflow, raw 감사 원문, raw storage 정보 노출이 이미 닫힌 것처럼 쓰면 안 된다.
- `work-items`·`/payroll`·`/management` 는 민감 운영 검토 흐름이지만 실원문 저장, 실지급, 실신고, 외부 제출이 이미 닫힌 것처럼 쓰면 안 된다.
- backup/export/migration 은 현재 근거상 별도 승인 또는 후속 구현 범위라는 점을 문서/화면/테스트에서 같은 뜻으로 유지해야 한다.
- production data, secret, 실제 운영 bucket 연결, 외부 연동, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 Phase 37 단계에서 남아 있는 제품형 리스크

- `/documents` 의 `storageStatus` 와 외부 공유/공개 다운로드를 같은 말처럼 쓰면 현재 구현 범위가 과장될 수 있다.
- 감사 로그의 `storageRef` 나 masked preview 를 raw 파일 열람 기능처럼 쓰면 보안 경계가 흐려질 수 있다.
- `work-items`·`/payroll`·`/management` 의 metadata preview 와 실민감 원문 저장을 같은 말로 쓰면 승인 범위가 흐려질 수 있다.
- backup/export/migration 을 현재 단계 happy path 처럼 적으면 후속 구현 범위와 승인 범위가 함께 흐려질 수 있다.
- production bucket/secret 미연결 상태를 숨기고 실운영 파일 저장이 이미 닫힌 것처럼 적으면 위험하다.

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
