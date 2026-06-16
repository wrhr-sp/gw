# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 35 fit-gap 정리 — 급여·세무·노무·법무·컴플라이언스 관리자흐름 UAT

현재 체인:

1. Phase 35 기획·fit-gap: `t_2e1397d4` — 도담(`gwplanner`) — 진행 중
2. 운영 DB 전환 7차: `t_ce50b30c` — 이룸(`gwbuilder`) — todo, 기획 handoff 대기
3. Phase 35 구현: `t_9a260e35` — 이룸(`gwbuilder`) — todo, DB 전환+기획 handoff 대기
4. 최종 통합 보고 parent: `t_5ff4261d` — 싱드(`singde`) — Phase 34 완료, Phase 35 체인 parent 유지

현재 메모:

5. 직전 Phase 34 문서 기준으로 `/employees`·`/org`·`/work-items/branch`·`/notifications`·`/admin/audit-logs` 운영흐름은 정리됐고, 이번 단계는 그 다음 관리자 흐름인 급여·세무·노무·법무·컴플라이언스를 다시 분리해 적는 것이다.
6. 이번 카드의 목적은 `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 현재 구현 상태를 코드/테스트/문서 기준으로 묶고, 무엇이 이미 same-origin API/권한 테스트가 있는지와 무엇이 아직 preview/skeleton/compliance gap 인지 분리하는 것이다.
7. 다음 실행자는 `t_ce50b30c` 에서 payroll/work-items/audit 중심 운영 DB 전환 기준선을 정리하고, `t_9a260e35` 에서 실제 관리자 UAT happy path 와 권한·상태 UX 를 강화한다.

현재 문서 기준 핵심 범위:

- `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 를 "있는 route" 수준이 아니라 대장이 직접 눌러보는 관리자 UAT 흐름으로 다시 정리한다.
- 급여(`/payroll`)와 세무(`/work-items/tax`) 책임을 섞지 않는다.
- self-only, branch scope, company scope, restricted labor/legal, placeholder 제한, `audit.read` 전용 허용을 최소 5축으로 나눠 설명한다.
- payroll role split, tax branch/company 경계, labor restricted 경계, legal visibility, compliance 전용 route 부재를 route/API/test에서 같은 뜻으로 유지한다.
- production DB, 실제 급여 지급, 외부 세무/노무/법무/법령 API 연동, 민감 원문, secret 입력은 계속 승인 게이트로 남긴다.
- production 데이터, 외부 파일 공유, secret, DNS/custom domain, 유료 리소스, migration, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 사용 가능에 가까운 영역
- `/management` 의 민감 관리자 모듈 허브
- `/payroll` 과 `/payroll/me` 의 preview/self-only 급여 흐름
- `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 의 공통 work item 기반 관리자 모듈 자리
- `/admin/audit-logs` 의 필터/타임라인/masked detail/read-only 문맥
- `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` 기반 payroll/tax/labor/legal/audit 경계 근거

### skeleton 잔여가 큰 영역
- `/payroll` 의 실세액 계산/실지급/외부 신고/이체 연동
- `/work-items/tax` 의 직접 신고/외부 세무사 연동/실원문 전송
- `/work-items/labor`, `/work-items/legal` 의 실제 원문 저장/외부 노무·법무 연동
- dedicated compliance queue 또는 법령 리스크 조치 route 부재
- production 운영데이터/민감 원문/외부 기관 연동 전까지 남는 승인 게이트

## 다음 우선순위

Phase 34 운영흐름 정리 다음 구현 우선순위는
Phase 30 전체 고도화보다
Phase 35 급여·세무·노무·법무·컴플라이언스 관리자흐름 UAT다.

핵심 이유:
- 로그인/홈 입구와 일반 업무/운영흐름은 앞선 Phase 31~34에서 먼저 정리됐지만, 급여·세무·노무·법무·컴플라이언스는 완성도 차이가 커서 현재 관리자 UAT 언어가 분산돼 있다.
- 이 영역은 payroll role split, branch/company scope, restricted labor/legal, audit/compliance 경계와 운영 DB 전환 준비 상태가 동시에 부딪히는 영역이라, 이 흐름이 닫혀야 다음 DB 전환·구현·감사 고도화도 쉬워진다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/management`
- `/payroll`
- `/payroll/me`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`
- `/admin/audit-logs`

다음 패스에서 바로 줄여야 할 잔여:
- `/payroll`·`/payroll/me` preview/self-only 경계 설명 보강
- `/work-items/tax` branch/company scope 설명 보강
- `/work-items/labor`·`/work-items/legal` restricted/visibility 설명 보강
- dedicated compliance route 필요 여부와 audit_logs 연결 기준 정리

우선 참고 문서:
- `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`
- `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`
- `docs/architecture/phase-34-hr-branch-notifications-audit-real-usage-scope.md`
- `docs/guides/phase-34-hr-branch-notifications-audit-real-usage-handoff.md`
- `docs/architecture/phase-33-attendance-leave-approvals-real-usage-scope.md`
- `docs/guides/phase-33-attendance-leave-approvals-real-usage-handoff.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- Phase 35 기획·fit-gap: `t_2e1397d4` — 도담(`gwplanner`)
- 운영 DB 전환 7차: `t_ce50b30c` — 이룸(`gwbuilder`)
- Phase 35 구현: `t_9a260e35` — 이룸(`gwbuilder`)

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```