# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: 실사용 전환 1차 기획·fit-gap — skeleton 제거·업무흐름화

현재 체인:

1. 기획/fit-gap: `t_d618e4e3` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_2a1e72dd` — 이룸(`gwbuilder`) — 기획 완료 대기
3. 리뷰: `t_43e012d3` — 바름(`gwreviewer`) — 구현 완료 대기

추가 후속 체인:

4. 테스트: `t_02c3faec` — 해봄(`gwtester`) — 리뷰 완료 대기
5. 문서화: `t_cd6ca5e4` — 다온(`gwdocs`) — 테스트 완료 대기
6. GitHub/CI/merge/branch cleanup: `t_3a494afd` — 지킴(`gwops`) — 문서화/승인 완료 대기

현재 문서 기준 핵심 범위:

- skeleton/placeholder/dev-safe 를 최종 산출물처럼 두지 않고, 대장이 직접 눌러볼 수 있는 업무 흐름 중심으로 재정렬한다.
- 일반 직원용 홈/업무 화면과 별도 `경영업무` 허브를 분리하고, 민감 모듈은 지정 관리자/담당자만 보게 한다.
- route guard, API guard, company + branch scope, audit 언어를 같이 맞춘다.
- 기능별로 happy path / forbidden / empty / error / 아직 dev-safe 인 부분을 분리해 기록한다.
- 실급여 지급, production DB, 외부 기관 계정 연동, DNS/custom domain, 유료 리소스, migration, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 사용 가능에 가까운 영역
- `/work-items`, `/work-items/hr`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/work-items/branch`
- `/management`
- `apps/api/src/app.ts` 기반 권한/조직/API skeleton
- `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` 기반 role boundary 근거
- `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` 의 정보구조 골격

### skeleton 잔여가 큰 영역
- `/login` 의 세션/redirect/UAT 계정 기준
- `/dashboard` 의 skeleton/dev-safe 문구 잔여
- `/boards`, `/documents`, `/me`, `/admin` 의 placeholder 의존
- `/attendance`, `/leave`, `/approvals` 의 happy path 부족
- 계정 생성/권한 부여/활성 비활성/비밀번호 초기화는 preview 가능하지만 아직 실저장 없는 dev-safe 흐름

## 다음 우선순위

실사용 전환 1차 다음 구현 우선순위는
Phase 30 전체 고도화보다
Phase 31 홈·로그인·경영업무·계정관리 실사용화다.

핵심 이유:
- 이미 있는 업무 모듈은 많지만, 대장이 실제 URL에서 체험하는 입구가 아직 덜 닫혀 있다.
- `admin / 1234` 기반 dev-safe UAT 계정, 로그인, landing, 계정관리 흐름을 먼저 닫아야 이후 모듈 UAT가 빠르다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/management`
- `/admin/users`
- `/attendance` → `/leave` → `/approvals`
- `/boards` → `/documents` → `/me`
- `/admin/audit-logs`

다음 패스에서 바로 줄여야 할 잔여:
- `/dashboard` 의 `dev-safe summary` 성격 문구
- 로그인 세션 만료/forbidden/로그아웃 재진입 안내
- `/admin/users` preview 뒤 다시 확인할 route stepper 정리
- `/attendance`, `/leave`, `/approvals`, `/boards`, `/documents`, `/me` happy path/empty/error 설명 밀도 맞추기

우선 참고 문서:
- `docs/architecture/phase-31-home-auth-management-real-usage-scope.md`
- `docs/guides/phase-31-home-auth-management-real-usage-handoff.md`
- `docs/architecture/phase-29-legal-management-pass-1-scope.md`
- `docs/guides/phase-29-legal-management-pass-1-handoff.md`
- `ROADMAP.md`
- `HANDOFF.md`

생성한 다음 체인:
- 구현: `t_750fe38b` — 이룸(`gwbuilder`)
- 리뷰: `t_9545a42e` — 바름(`gwreviewer`)
- 테스트: `t_20a80b5f` — 해봄(`gwtester`)
- 문서화: `t_9e942a9f` — 다온(`gwdocs`)
- GitHub/CI/merge/branch cleanup: `t_5bbaa57d` — 지킴(`gwops`)

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```