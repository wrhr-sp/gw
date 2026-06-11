# HANDOFF

## 다음 세션/다음 봇이 먼저 볼 것

1. `AGENTS.md` — 실행 규칙과 금지사항
2. `VISION.md` — 제품 방향
3. `ROADMAP.md` — Phase 순서
4. `TASKS.md` — 현재 Kanban 체인
5. `KNOWN_ISSUES.md` — 남은 리스크
6. `RUNBOOK.md` — 운영/장애 대응
7. `DEPLOYMENT.md` — 배포 확인 기준

## 현재 오케스트레이션 상태

- Board: `groupware`
- Repo: `/home/wrhrgw/gw`
- Bot home: `/home/wrhrgw/gw-dev-bot`
- Orchestrator: 싱드(`singde`)
- 역할봇: 도담(`gwplanner`), 이룸(`gwbuilder`), 바름(`gwreviewer`), 해봄(`gwtester`), 다온(`gwdocs`), 지킴(`gwops`)

현재 활성 흐름은 출퇴근 등록 방식 정책 선택 1차다. 이번 단계에서는 회사 기본 근태 정책에서 허용할 출퇴근 등록 방식(`mobile`, `pc`, `tag`)을 먼저 고정하고, admin 정책 화면·직원 근태 화면·출근/퇴근 API 검증이 같은 기준을 보게 한다.

현재 구현 상태 요약:

- 출퇴근 등록 방식 정책 enum 은 `mobile`, `pc`, `tag` 3가지로 제한한다.
- 1차 적용 범위는 회사 기본 정책만 다루고, 지점/부서/근무유형별 override 는 후속 확장 후보로 남긴다.
- 관리자 정책 화면에서는 current/candidate/diff/capability/audit preview 순서로 판단한다.
- 현재 구현 예시는 `mobile`, `pc` 허용 + `mobile`, `tag` candidate + `tag` skeleton 안내 기준이다.
- 직원 근태 화면은 회사 정책에서 허용한 방식만 CTA 또는 안내로 보여 준다.
- 출근/퇴근 API 는 요청 방식이 회사 정책에 포함되는지 검증해야 한다.
- 태그 방식은 실제 장비 연동이 아니라 skeleton/안내/검증 지점까지만 이번 범위에 포함한다.
- 우선 참고 문서: `docs/architecture/attendance-registration-policy-pass-1-scope.md`, `docs/guides/attendance-registration-policy-pass-1-handoff.md`.

제한적 재귀적 자기개선 루프가 적용된다.

- 현재 카드 범위 안에서만 반복 실수 방지, 테스트 실패 원인 기록, 체크리스트 보강, handoff 품질 개선을 한다.
- 자기개선 문서 갱신은 `AGENTS.md`, `SPEC.md`, `TEST_PLAN.md`, `QA_CHECKLIST.md`, `HANDOFF.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`로 제한한다.
- 다른 보드/repo/domain/mainbot, 운영 DB, 실데이터, secret, DNS, 유료 리소스, 배포/릴리즈/PR merge, 서비스 재시작, 카드 범위 밖 리팩토링은 자기개선 명목으로 자동 수행하지 않는다.
- 필요하면 “사용자 승인 필요”로 분리해 보고한다.

## 인수인계 원칙

- Kanban DB는 직접 쓰지 않는다.
- active/running/blocked를 먼저 확인한다.
- 승인된 범위 안의 검증 실패는 자동 재수정 루프로 처리한다.
- restricted 항목은 반드시 사용자 승인으로 분리한다.
- 최종 사용자 보고는 싱드가 쉬운 한국어로 통합한다.
