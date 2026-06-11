# KNOWN_ISSUES

## 현재 알려진 제한

### 1. 대부분의 기능은 skeleton/placeholder 단계

- 실제 운영 데이터 저장/처리 완성 단계가 아니다.
- API와 화면은 다음 구현을 위한 contract와 guardrail 중심이다.

### 2. production 데이터/secret/DNS/유료 리소스는 미연결 또는 승인 대기 범위

- production DB 실데이터 변경 없음
- secret 입력/교체 없음
- DNS/custom domain 없음
- 유료 리소스 생성·증액 없음
- 실제 개인정보 처리 없음
- 외부 HR 연동 없음

### 3. 현재 문서화/검증 기준은 Phase 12 대시보드 운영 요약 1차

현재 루트 문서와 handoff 는 Phase 12 대시보드 운영 요약 1차를 기준으로 맞추고 있다.

- `/dashboard` 는 오늘 할 일 → 승인 대기 → 근태/휴가 → 공지/문서 → 운영 요약 순서의 dev-safe skeleton 기준이다.
- shared 테스트 9건, api 테스트 57건, web 테스트 23건, 각 typecheck, web build 가 모두 통과한 상태를 문서 근거로 사용한다.
- 일반 사용자 기본 화면에서는 관리자 CTA 를 노출하지 않고, `/admin/*` 및 `/api/admin/*` 권한 guard 를 유지한다.
- 실제 개인정보 원문, production DB 실데이터, 실제 외부 알림, 실제 운영 권한 저장/변경은 아직 범위 밖이다.

### 4. 자동화 보강분 이력

이전 자동화 보강 작업은 완료 이력으로 남겨 둔다.

대상:

- review-required gate 표준 검증
- safe triage 실패 재시도/backoff
- recovery loop 생성
- systemd watcher PATH 보강

관련 Kanban 체인:

- `t_3cc774a3` → `t_f54c6e19` → `t_27995f12` → `t_cda0641f` → `t_3539349e` → `t_d7f30c03` → `t_3cc826c6`

### 5. 역할봇 스킬 동기화 이슈 이력

- `kanban-automation-recovery` 스킬 누락으로 도담 카드가 crash난 이력이 있다.
- 현재는 도담/이룸/바름/해봄/다온에 동기화했다.
- 앞으로 강제 skill을 붙이는 카드 생성 전 대상 프로필에 skill이 있는지 확인해야 한다.

## 임시 대응 원칙

- 검증 실패는 자동 재수정 루프로 돌린다.
- 사용자 승인 필요 항목은 blocked/scheduled로 분리해 보고한다.
- 막힘 보고는 싱드가 원본 카드/로그를 확인해 쉬운 한국어로 재해석한다.
