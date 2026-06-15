# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 33 fit-gap 정리 — 근태·휴가·전자결재 실사용화

현재 체인:

1. Phase 33 기획·fit-gap: `t_a498e76b` — 도담(`gwplanner`) — 진행 중
2. 운영 DB 전환 5차: `t_32c88243` — 이룸(`gwbuilder`) — todo, 기획 handoff 대기
3. Phase 33 구현: `t_268c7c7e` — 이룸(`gwbuilder`) — todo, DB 전환+기획 handoff 대기
4. 최종 통합 보고 parent: `t_4faa7030` — 싱드(`singde`) — 직전 Phase 32 완료, Phase 33 체인 parent 유지

현재 메모:

5. 직전 Phase 32 배포 기준은 이미 `t_4faa7030` 에서 정리됐고, 추천 확인 순서는 `/login` → `/dashboard` → `/boards` → `/documents` 까지 닫혀 있다.
6. 이번 카드의 목적은 그 다음 일반 업무 묶음인 근태·휴가·전자결재를 코드/테스트/문서 기준으로 다시 분리해 적는 것이다.
7. 다음 실행자는 `t_32c88243` 에서 PostgreSQL 전환 범위를 닫고, `t_268c7c7e` 에서 실제 UI/API happy path 를 강화한다.

현재 문서 기준 핵심 범위:

- `/attendance`, `/leave`, `/approvals` 를 "설명용 skeleton"이 아니라 대장이 직접 눌러보는 일반 업무 UAT 흐름으로 다시 정리한다.
- 출퇴근 기록/정정 요청, 휴가 신청/승인, 결재 기안/승인·반려·보완 요청을 같은 문서 묶음 안에서 읽되 책임은 섞지 않는다.
- 정책 미허용, 권한 부족, 회사 scope 차단, placeholder 제한을 최소 4축으로 나눠 설명한다.
- self-approval 금지, unknown/forged id 차단, 운영 정책 화면(`/admin/policies`)과 일반 업무 화면 분리를 route/API/test에서 같은 뜻으로 유지한다.
- production DB, 실급여/실정산, 은행 이체, GPS/실단말, 외부 기관 연동, secret 입력은 계속 승인 게이트로 남긴다.
- production 데이터, 외부 파일 공유, secret, DNS/custom domain, 유료 리소스, migration, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 사용 가능에 가까운 영역
- `/attendance` 의 출퇴근/정책 source/정정 요청 문맥
- `/leave` 의 휴가 유형/잔여/신청 상태 문맥
- `/approvals` 의 기안함/결재함/승인 문맥
- `/admin/policies` 와 일반 업무 화면의 정책 비교
- `apps/api/test/auth-org.spec.ts` 기반 권한·회사 scope·self-approval 차단 근거

### skeleton 잔여가 큰 영역
- `/attendance` 의 실제 현장 장비/GPS/위치정보 연동
- `/leave` 의 실제 급여/정산 반영과 richer 승인 히스토리 UX
- `/approvals` 의 실서명/외부 알림/실원문 장기보관
- 세 모듈 공통 richer stepper 와 실제 업무 히스토리 요약 UX
- production 인사 운영데이터/외부 기관 연동 전까지 남는 승인 게이트

## 다음 우선순위

Phase 32 협업 묶음 정리 다음 구현 우선순위는
Phase 30 전체 고도화보다
Phase 33 근태·휴가·전자결재 실사용화다.

핵심 이유:
- 로그인/홈 입구와 협업 묶음은 앞선 Phase 31~32에서 먼저 정리됐지만, 핵심 일반 업무인 근태·휴가·전자결재는 아직 정책 안내와 preview 액션 설명 비중이 높다.
- 세 모듈은 일반 직원/승인자/관리자 경계와 실제 승인 게이트가 가장 자주 부딪히는 영역이라, 이 흐름이 닫혀야 다음 DB 전환·알림·감사 고도화도 쉬워진다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/attendance`
- `/leave`
- `/approvals`
- `/admin/policies`

다음 패스에서 바로 줄여야 할 잔여:
- `/attendance` 체크인/정정 요청 stepper 보강
- `/leave` 신청자 lane 과 승인자 lane 분리 보강
- `/approvals` 기안 → 승인/반려/보완 요청 stepper 보강
- DB 전환 후 route/API/test 근거 재정리

우선 참고 문서:
- `docs/architecture/phase-33-attendance-leave-approvals-real-usage-scope.md`
- `docs/guides/phase-33-attendance-leave-approvals-real-usage-handoff.md`
- `docs/architecture/phase-32-boards-notices-comments-documents-real-usage-scope.md`
- `docs/guides/phase-32-boards-notices-comments-documents-real-usage-handoff.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- Phase 33 기획·fit-gap: `t_a498e76b` — 도담(`gwplanner`)
- 운영 DB 전환 5차: `t_32c88243` — 이룸(`gwbuilder`)
- Phase 33 구현: `t_268c7c7e` — 이룸(`gwbuilder`)

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```