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

### 3. 현재 문서화/검증 기준은 관리자 PWA 설치 UX / 오프라인 / manifest 품질 개선

현재 루트 문서와 handoff 는 관리자 PWA 설치 품질 개선 체인을 기준으로 맞추고 있다.

- 현재 코드에는 관리자 host 분리, `/admin/manifest.webmanifest`, 관리자용 metadata/app shell/nav/install step 골격, 공통 offline 안내, 관리자/일반 아이콘 파일 분리가 이미 들어와 있다.
- 현재 manifest 분리는 되어 있지만, 관리자 설치 안내와 오프라인 안내는 아직 공통 설명 중심이라 관리자 운영 맥락을 더 또렷하게 보여 주는 후속이 필요하다.
- 현재 관리자 아이콘 파일은 placeholder SVG 자산이다. 이번 체인에서는 일반/관리자 파일 분리, 192/512, any/maskable, 테스트 회귀 보호를 우선하고 최종 브랜드 자산 제작은 별도 범위로 남긴다.
- install prompt 커스텀 제어, push, background sync, offline write queue, native 전환은 아직 범위 밖이다.
- local preview/manual smoke/Lighthouse 확인 기준은 이번 체인에서 더 분명히 문서화하지만, 브라우저/환경 차이 때문에 완전 자동화까지는 아직 고정하지 않는다.
- 실제 운영 사용자/권한 저장, production DB migration, secret, DNS/custom domain, 유료 리소스, 외부 IAM/SSO/감사 시스템 연동은 계속 범위 밖이다.

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
