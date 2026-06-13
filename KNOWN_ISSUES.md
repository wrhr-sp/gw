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

### 3. 현재 문서화/검증 기준은 Phase 19 네이티브 모바일앱 내부 시범 운영 초안

현재 루트 문서와 handoff 는 Phase 17~18에서 준비한 `apps/mobile` 구조와 shared contract 위에, 내부 시범 운영 전에 필요한 준비물과 승인 게이트를 한 번에 따라갈 수 있게 정리한 Phase 19 체인을 기준으로 맞춘다.

- 기본 7개 핵심 화면 묶음은 로그인, 대시보드, 출퇴근, 휴가, 결재함, 공지/문서, 내 정보다.
- 설치 안내 확인 → 로그인 → 대시보드 → 출퇴근/휴가/결재함 → 공지/문서 → 내 정보/session clear 흐름을 우선 기준으로 본다.
- `/admin/*` 운영 화면은 모바일 기본 탭 범위에 자동 포함하지 않고 후속 범위 또는 Web fallback 후보로 본다.
- same-origin `/api/*` 원칙은 유지하되 네이티브 앱에서는 base URL resolver 와 mock/dev-safe bridge 층으로 번역해야 한다.
- Web cookie 동작을 모바일 세션 기본값처럼 가정하지 않고 secure storage bridge 기준을 먼저 둔다.
- 상태 안내는 offline, error, empty, forbidden 4축으로 먼저 나눠 설명한다.
- live/PWA/API 선행 검증 기준과 mobile 전용 smoke 기준은 따로 적는다.
- Android internal test 또는 Expo preview/dev build 후보, Apple Developer/TestFlight 준비 checklist, App Store/Play Console/TestFlight/EAS, push, 실기기 권한, secret, custom domain, production origin 확정은 별도 승인 게이트다.
- 현재 `apps/mobile` 은 store build 단계가 아니라 contract/typecheck/skeleton 연결 단계다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 모바일 내부 시범 운영 초안 단계에서 남아 있는 제품형 리스크

- offline/error/empty/forbidden 상태 설명이 흔들리면 사용자에게 정상 빈 상태와 실패 상태가 섞여 보일 수 있다.
- 모바일 편의 때문에 role/scope/auth/session 경계를 느슨하게 만들면 Web/API 보안 모델과 충돌할 수 있다.
- `apps/mobile` 과 Web UI 공용화를 과하게 밀면 오히려 monorepo 의존성이 복잡해질 수 있다.
- 관리자 화면까지 모바일 1차 범위에 무리하게 넣으면 일반 사용자 핵심 흐름 우선 원칙이 약해질 수 있다.
- 스토어/실기기/푸시/권한/유료 빌드가 문서에서 충분히 분리되지 않으면 "이미 배포 가능한 상태"처럼 오해될 수 있다.
- live/PWA/API 선행 검증과 mobile 전용 설치/배포 준비 기준이 섞이면 내부 시범 운영 readiness 판단이 흐려질 수 있다.
- Apple Developer, TestFlight, Play Console, EAS 같은 계정/비용 항목이 구현 TODO에 묻히면 실제 승인 게이트가 누락될 수 있다.

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
