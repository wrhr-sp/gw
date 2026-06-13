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

### 3. 현재 문서화/검증 기준은 Phase 23 관리자 운영 콘솔 실사용 1차

현재 루트 문서와 handoff 는 Phase 22 실제 하루 업무 흐름 기준 위에, `/dashboard` 이후 관리자 운영 CTA, `/admin` 허브, `/admin/users`·`/admin/policies`·`/admin/audit-logs` 검토 흐름, 파일·문서·공지 권한 경계를 실제 운영 준비 순서처럼 따라갈 수 있게 정리한 Phase 23 체인을 기준으로 맞춘다.

- 기본 일반 업무 흐름은 계속 유지하되, 현재 활성 정리 기준은 관리자 운영 콘솔 레인을 별도로 고정하는 것이다.
- `/employees` 와 `/admin/users`, `/boards`·`/documents` 와 `/admin/policies`, 일반 업무와 `/admin/audit-logs` read-only 감사 흐름을 계속 분리한다.
- `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 권한 경계가 UI 문구만이 아니라 route/API/test 기준과 같이 유지돼야 한다.
- raw storage key, bucket 이름, signed/public URL 전문 같은 파일/문서 민감 참조는 운영 정책/감사 로그 설명에도 노출하지 않는다.
- production data, secret, 실제 권한 저장, 외부 연동, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 관리자 운영 콘솔 실사용 단계에서 남아 있는 제품형 리스크

- placeholder/skeleton 표현이 문서마다 다르면 일부 관리자 기능이 실제 운영 저장·반영 완료처럼 오해될 수 있다.
- `/dashboard` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서 설명이 문서마다 다르면 대장이 실제 운영 준비 흐름을 잘못 이해할 수 있다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토 경계가 흔들리면 위험한 운영 액션이 일반 조회처럼 읽힐 수 있다.
- `/boards`·`/documents` 협업/보관 흐름과 `/admin/policies` 운영 정책 검토가 섞이면 파일·공지 권한 책임이 흐려질 수 있다.
- `audit.read` 와 감사 전용 사용자 경계가 흔들리면 `/admin` 전체 허용처럼 오해될 수 있다.
- raw storage 정보 비노출 원칙이 정책/감사 설명에서 빠지면 실제 저장소 식별값이 노출돼도 되는 것처럼 오해될 수 있다.
- high-risk permission 이 단순 문구처럼만 쓰이고 route/API/test 근거가 문서에서 빠지면 보안 경계 판단이 흔들릴 수 있다.

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
