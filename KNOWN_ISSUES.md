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

### 3. 현재 문서화/검증 기준은 Phase 41 게시판·공지·문서·결재 일상업무 도입완성 문서화/릴리즈 게이트 준비

현재 루트 문서와 handoff 는 `/dashboard` 기준 오늘 할 협업 업무, `/approvals` 승인 대기, `/boards` 공지/일반 게시판, `/posts/[postId]` 댓글/읽음/forged 차단, `/documents` 문서 metadata/space 권한 경계, `/admin/policies`·`/admin/audit-logs` 운영 검토를 한 번에 설명하는 준비를 중심으로 맞춘다.

- 일반 협업 흐름과 운영 검토 흐름은 계속 유지하되, 현재 활성 정리 기준은 그 위에 `/dashboard` → `/approvals` → `/boards` → `/documents` 직원 협업 레인과 `/admin/policies`·`/admin/audit-logs` 운영 레인을 서로 다른 책임 문맥으로 다시 분리하는 것이다.
- 2026-06-16 parent 재검증 기준 focused web/API/shared 회귀, typecheck, `pnpm check`, Next/Cloudflare build, local admin-host preview smoke 는 다시 통과했고 현재 남은 일은 문서화 → release gate → 최종 통합 보고 체인 정리다.
- `admin / 1234` 는 dev/test/UAT 전용 계정이며 production 기본 계정이 아니다.
- 공지 게시판과 일반 게시판 책임, 게시글 댓글/읽음 확인/forged 차단, 문서 public/private/missing space 차단, 전자결재 self-approval/replay 차단은 같은 guardrail 언어로 적어야 한다.
- `/boards`, `/documents`, `/approvals` 는 내부 협업 기본 업무 흐름으로 적되, rich editor 완성형, 외부 공유, 법적 효력 있는 전자서명, 실제 운영 발송은 아직 승인 게이트다.
- live URL, 테스트 계정, 역할별 추천 시나리오, 남은 승인 게이트를 최종 보고에서 같이 적을 수 있어야 한다.
- production data, secret, 실제 운영 bucket 연결, 외부 연동, 유료 리소스는 계속 별도 승인 게이트다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, migration, destructive 작업)은 계속 별도 승인 범위다.

### 4. 현재 Phase 41 단계에서 남아 있는 제품형 리스크

- `/dashboard` 협업 shortcut 과 실제 `/approvals`·`/boards`·`/documents` 화면 설명이 어긋나면 직원 도입 흐름이 끊길 수 있다.
- 공지 게시판과 일반 게시판 책임을 같은 게시판 UX처럼 적으면 운영 공지와 일반 협업 경계가 흐려질 수 있다.
- 문서 metadata/read receipt/private space 차단을 외부 공유 완성 기능처럼 과장하면 보안 기대치가 왜곡될 수 있다.
- 전자결재의 기안자 lane, 승인자 lane, 운영 정책 lane 을 같은 흐름처럼 적으면 역할 책임과 권한 경계가 흐려질 수 있다.
- self-approval/replay/forged/private space 차단을 단순 에러처럼만 적으면 핵심 guardrail 우선순위가 약해질 수 있다.
- external integration, production secret/실데이터, custom domain, 법적 효력 있는 전자서명 미확정 상태를 숨기고 내부 도입이 이미 닫힌 것처럼 적으면 위험하다.

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
