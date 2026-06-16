# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 36 fit-gap 정리 — 운영자 설정·회사정책·권한관리

현재 체인:

1. Phase 36 검증 parent: `t_db951f9d` — 해봄(`gwtester`) — 완료
2. Phase 36 문서화: `t_cd38b241` — 다온(`gwdocs`) — 진행 중
3. Phase 36 GitHub PR/CI/merge/branch cleanup: `t_d45d361c` — 지킴(`gwops`) — 대기

현재 메모:

5. 직전 Phase 35 문서 기준으로 `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 관리자 흐름은 정리됐고, 이번 단계는 그 위에서 운영자 설정·회사 정책·권한 관리 축을 다시 분리해 적는 것이다.
6. 이번 카드의 목적은 `/dashboard`·`/menu` shortcut, `/org`·`/employees` 일반 조회, `/admin/users`·`/admin/policies`·`/admin/audit-logs` 운영 검토를 코드/테스트/문서 기준으로 묶고, 무엇이 이미 read model/preview 로 확인 가능한지와 무엇이 아직 편집 UI 부재·실저장 미지원·승인 게이트인지 분리하는 것이다.
7. 다음 실행자는 Phase 36 handoff 기준으로 운영자 설정 read model 보강이 실제 후속 구현 카드가 필요한지 판단된 범위만 이어 받는다.

현재 문서 기준 핵심 범위:

- `/dashboard`·`/menu` 에서 홈 shortcut 이 회사 고정 항목과 권한 기반 사용자 전용 항목으로 어떻게 나뉘는지 정리한다.
- `/org`, `/employees` 일반 조회와 `/admin/users` 운영 검토 책임을 다시 섞지 않는다.
- `/admin/policies` 의 current/candidate/capability/audit preview 가 `/attendance`·`/leave`·`/employees` 설명과 같은 뜻인지 점검한다.
- role/permission 카탈로그, 일반 조회 guard, 운영 diff preview 를 각각 권한 관리의 다른 층으로 설명한다.
- 실제 권한 저장, 회사 shortcut 정책 편집 저장, 외부 IdP/실메일/production 정책 저장은 계속 승인 게이트로 남긴다.
- production 데이터, 외부 파일 공유, secret, DNS/custom domain, 유료 리소스, migration, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 확인 가능한 영역
- `/dashboard`, `/menu` 의 회사 고정 shortcut + 권한 기반 사용자 전용 shortcut
- `/org`, `/employees` 의 일반 조회 흐름과 admin-only 역할 비과다 노출 guard
- `/admin/users` 의 role diff/상태 변경/high-risk permission preview
- `/admin/policies` 의 current/candidate/capability/audit preview 와 회사 설정 4묶음 설명
- `/admin/audit-logs` 의 필터/타임라인/masked detail/read-only 문맥
- `apps/api/test/auth-org.spec.ts` 기반 shortcut/roles/permissions/admin/users/policies/audit 경계 근거

### gap 이 큰 영역
- 회사가 고정 shortcut 구성을 편집/저장하는 운영 UI 부재
- 사용자가 홈 shortcut 을 직접 편집/정렬/저장하는 UI 부재
- role/permission source 와 shortcut 노출 기준을 한 화면에서 쉽게 읽는 관리자 read model 부족
- 실권한 저장, 대량 초대, 외부 IdP/실메일 연동 부재
- production 정책 저장과 개인 override 부재

## 다음 우선순위

Phase 35 관리자흐름 정리 다음 구현 우선순위는
실권한 저장 확대보다
Phase 36 운영자 설정 read model 보강이다.

핵심 이유:
- 홈/일반 조회/운영 검토 흐름은 이미 여러 Phase에서 존재하지만, 운영자 설정·회사 정책·권한 관리의 설명 층이 섞여 있어 현재 상태를 한눈에 읽기 어렵다.
- 이 영역은 shortcut 노출 기준, 일반 조회 guard, 정책 source 설명, 관리자 preview 경계가 동시에 연결돼 있어 read model 을 먼저 정리해야 이후 저장 UX나 실연동 논의도 덜 위험해진다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/login`
- `/dashboard`
- `/menu`
- `/employees`
- `/org`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/management`

다음 패스에서 바로 줄여야 할 잔여:
- shortcut read model 을 운영자 관점에서 한 번에 읽는 UX 보강
- `/admin/users` 에 role/permission source 와 company settings model 연결 근거 보강
- `/dashboard`·`/menu` 와 `/admin/policies` 의 회사 정책/shortcut 설명 연결 보강
- 실저장/외부 연동이 아직 없다는 점을 UI copy 와 문서에 더 즉시 읽히게 보강

우선 참고 문서:
- `docs/architecture/phase-36-admin-settings-company-policy-permission-fit-gap-scope.md`
- `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md`
- `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`
- `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`
- `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md`
- `docs/guides/phase-21-real-company-settings-model-pass-1-handoff.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- Phase 36 검증 parent: `t_db951f9d` — 해봄(`gwtester`) — done
- Phase 36 문서화: `t_cd38b241` — 다온(`gwdocs`) — running
- Phase 36 release/cleanup: `t_d45d361c` — 지킴(`gwops`) — todo

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```