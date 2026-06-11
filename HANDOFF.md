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

현재 활성 흐름은 출퇴근 정책 적용대상/우선순위 2차다. 이번 단계에서는 1차에서 고정한 출퇴근 등록 방식(`mobile`, `pc`, `tag`) 위에 회사 기본값, 근무지/지점, 부서/팀, 직무/역할 정책을 얹고, admin 정책 화면·직원 근태 화면·출근/퇴근 API 검증이 같은 `effective policy` 계산 기준을 보게 한다.

현재 구현 상태 요약:

- 출퇴근 등록 방식 enum 은 계속 `mobile`, `pc`, `tag` 3가지로 제한한다.
- 정책 적용대상 level 은 `company_default`, `workplace`, `department`, `job_type` 4단계만 공식 지원한다.
- 우선순위는 `회사 기본 < 근무지/지점 < 부서/팀 < 직무/역할` 로 고정한다.
- 각 단계는 allowed methods 를 부분 병합하지 않고 전체 override 로 덮는다.
- admin 정책 화면에서는 적용대상 목록, 우선순위, before/after diff, 적용 인원 preview, capability, 감사 preview 순서로 읽히게 한다.
- 직원 근태 화면은 본인 `effective policy` 기준으로 허용된 방식만 CTA 또는 안내로 보여 준다.
- 출근/퇴근 API 는 요청 방식이 본인 `effective policy` 에 포함되는지 검증해야 한다.
- 태그 방식은 실제 장비 연동이 아니라 skeleton/안내/검증 지점까지만 이번 범위에 포함한다.
- 실제 조직 데이터 반영, GPS/위치정보 저장, NFC/RFID/QR 장비 연동, 외부 HR 연동은 이번 단계에 포함되지 않으며 계속 별도 승인 대상이다.
- 우선 참고 문서: `docs/architecture/attendance-registration-policy-pass-2-scope.md`, `docs/guides/attendance-registration-policy-pass-2-handoff.md`.

2026-06-11 pass 2 구현 메모:

- shared 계약에 정책 assignment/rule/preview/effective-policy 구조와 계산 helper 를 추가했다.
- admin 정책 화면은 우선순위 설명, 예상 적용 인원, 샘플 직원 preview, 동일 target 중복 경고를 렌더링한다.
- 직원 `/attendance` 화면은 회사 기본이 아니라 본인 effective policy 요약과 허용 방식만 보여 준다.
- API check-in/check-out 은 employee 기준 effective policy 를 계산해 허용 방식만 201, 나머지는 403 으로 차단한다.
- 최신 재검증에서 `pnpm check`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf` 가 모두 통과했다. 이전 web 빌드 ENOENT 실패 메모는 stale 상태이므로 현재 blocker 로 보지 않는다.
- 부모 검증 기준으로는 shared 18, web 30, api 61 테스트와 package typecheck, web build, Cloudflare build, auth check 가 모두 통과했다. 다음 작업자는 문구를 바꿀 때 이 근거와 모순되지 않는지 먼저 확인한다.

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
