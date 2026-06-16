# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 34 fit-gap 정리 — 인사·지점·알림·감사 운영흐름 실사용화

현재 체인:

1. Phase 34 기획·fit-gap: `t_031a7ba6` — 도담(`gwplanner`) — 진행 중
2. 운영 DB 전환 6차: `t_959f0f18` — 이룸(`gwbuilder`) — todo, 기획 handoff 대기
3. Phase 34 구현: `t_c06b17a6` — 이룸(`gwbuilder`) — todo, DB 전환+기획 handoff 대기
4. 최종 통합 보고 parent: `t_4faa7030` — 싱드(`singde`) — 직전 Phase 32 완료, Phase 33 체인 parent 유지

현재 메모:

5. 직전 Phase 33 문서 기준으로 `/attendance`·`/leave`·`/approvals` 일반 업무 묶음은 정리됐고, 이번 단계는 그 다음 운영 흐름인 인사 조회·지점 업무·알림·감사를 다시 분리해 적는 것이다.
6. 이번 카드의 목적은 `/employees`, `/org`, `/work-items/branch`, `/notifications`, `/admin/audit-logs` 현재 구현 상태를 코드/테스트/문서 기준으로 묶고, 무엇이 이미 DB read fallback 이 있는지와 무엇이 아직 placeholder 인지 분리하는 것이다.
7. 다음 실행자는 `t_959f0f18` 에서 employees/branches/notifications/audit_logs PostgreSQL 기준선을 정리하고, `t_c06b17a6` 에서 실제 UI/API happy path 와 권한·상태 UX 를 강화한다.

현재 문서 기준 핵심 범위:

- `/employees`, `/org`, `/work-items/branch`, `/notifications`, `/admin/audit-logs` 를 "있는 route" 수준이 아니라 대장이 직접 눌러보는 UAT 흐름으로 다시 정리한다.
- 일반 조회(`/employees`, `/org`)와 관리자 운영(`/admin/users`, `/admin/policies`, `/admin/audit-logs`) 책임을 섞지 않는다.
- branch scope, 회사 scope, 권한 부족, placeholder 제한을 최소 4축으로 나눠 설명한다.
- employee directory validation, branch manager 경계, `audit.read` 전용 허용을 route/API/test에서 같은 뜻으로 유지한다.
- production DB, 외부 알림 채널, 민감 인사 원문, secret 입력은 계속 승인 게이트로 남긴다.
- production 데이터, 외부 파일 공유, secret, DNS/custom domain, 유료 리소스, migration, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 사용 가능에 가까운 영역
- `/employees` 의 직원 카드형 일반 조회와 `/admin/users` 분리 문맥
- `/org` 의 부서/역할/권한 읽기 전용 문맥
- `/work-items/branch` 의 branch scope 운영 업무 자리
- `/admin/audit-logs` 의 필터/타임라인/masked detail/read-only 문맥
- `apps/api/test/auth-org.spec.ts` 기반 employee directory, branch scope, `audit.read` 차단 근거

### skeleton 잔여가 큰 영역
- `/notifications` 의 읽음 처리 저장/외부 채널 연동/전송 성공 추적
- branch 독립 마스터(`/branches`) 와 지점 기본정보/배정 운영 UX
- `/employees`, `/org` 의 richer 검색/상세 drill-down
- `/admin/audit-logs` 의 PostgreSQL 실기록 정합성과 richer 상세 drill-down
- production 인사 운영데이터/외부 알림/민감 원문 연동 전까지 남는 승인 게이트

## 다음 우선순위

Phase 33 일반 업무 묶음 정리 다음 구현 우선순위는
Phase 30 전체 고도화보다
Phase 34 인사·지점·알림·감사 운영흐름 실사용화다.

핵심 이유:
- 로그인/홈 입구와 일반 업무 묶음은 앞선 Phase 31~33에서 먼저 정리됐지만, 인사 조회·지점 운영·알림·감사는 완성도 차이가 커서 현재 UAT 언어가 분산돼 있다.
- 네 영역은 employee/branch/company/audit 권한 경계와 PostgreSQL 전환 준비 상태가 동시에 부딪히는 영역이라, 이 흐름이 닫혀야 다음 DB 전환·구현·감사 고도화도 쉬워진다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/employees`
- `/org`
- `/work-items/branch`
- `/notifications`
- `/admin/audit-logs`

다음 패스에서 바로 줄여야 할 잔여:
- `/employees`·`/org` 검색/상세/운영 경계 설명 보강
- `/work-items/branch` happy path 와 branch/company scope 설명 보강
- `/notifications` metadata/API 기준선 정리
- audit_logs DB 전환 후 route/API/test 근거 재정리

우선 참고 문서:
- `docs/architecture/phase-34-hr-branch-notifications-audit-real-usage-scope.md`
- `docs/guides/phase-34-hr-branch-notifications-audit-real-usage-handoff.md`
- `docs/architecture/phase-33-attendance-leave-approvals-real-usage-scope.md`
- `docs/guides/phase-33-attendance-leave-approvals-real-usage-handoff.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- Phase 34 기획·fit-gap: `t_031a7ba6` — 도담(`gwplanner`)
- 운영 DB 전환 6차: `t_959f0f18` — 이룸(`gwbuilder`)
- Phase 34 구현: `t_c06b17a6` — 이룸(`gwbuilder`)

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```