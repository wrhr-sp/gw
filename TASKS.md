# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 37 fit-gap 정리 — 내부 운영 저장흐름·감사 연결

현재 체인:

1. Phase 37 저장흐름·감사 연결 재검증: `t_e8e6bea1` — 해봄(`gwtester`) — 완료
2. Phase 37 문서화: `t_ecfe96a8` — 다온(`gwdocs`) — 진행 중
3. Phase 37 GitHub PR/CI/merge/branch cleanup child: `t_b73a7e86` — 지킴(`gwops`) — 대기

현재 메모:

5. 직전 Phase 35 문서 기준으로 `/management`, `/payroll`, `/payroll/me`, `/work-items/tax`, `/work-items/labor`, `/work-items/legal`, `/admin/audit-logs` 관리자 흐름은 정리됐고, 직전 Phase 36에서는 `/dashboard`·`/menu`, `/org`·`/employees`, `/admin/users`·`/admin/policies` 운영자 설정 언어를 다시 맞췄다.
6. 이번 카드의 목적은 그 위에서 `/documents` 파일 lifecycle, `/admin/audit-logs` storage preview, `work-items`·`/payroll` 민감자료 approval gate 를 코드/테스트/문서 기준으로 한 번에 묶고, 무엇이 이미 metadata/preview/read-only 로 확인 가능한지와 무엇이 아직 export/backup/migration/실운영 승인 게이트인지 분리하는 것이다.
7. 이번 문서 카드에서는 parent 재검증 결과를 root 문서와 Phase 37 scope/handoff 에 다시 반영하고, 다음 실행자는 그 기준으로 release gate 와 branch cleanup 만 이어 받는다.

현재 문서 기준 핵심 범위:

- `/documents` 의 `upload-init` → `upload-complete` → `download-init` → delete/archive 흐름을 metadata/preview/read-only 언어로 다시 정리한다.
- `/admin/audit-logs` 의 masked preview, `storageRef`, company boundary, read-only 경계를 다시 섞지 않는다.
- `work-items`, `/payroll`, `/management` 에서 첨부/민감자료/approval gate 를 raw 원문 저장과 같은 말로 쓰지 않는다.
- raw `storageKey`, bucket 이름, public URL, signed URL 전문 비노출 원칙을 문서/루트 기준에 다시 고정한다.
- backup/export/migration/production bucket/secret/실운영 외부 반출은 계속 승인 게이트로 남긴다.
- production 데이터, secret, DNS/custom domain, 유료 리소스, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 확인 가능한 영역
- `/documents` 의 파일 메타데이터, upload/download 준비, `storageStatus` 상태 전이
- `/admin/audit-logs` 의 masked detail, `storageRef`, read-only 감사 문맥
- `/management`, `/payroll`, `work-items/*` 의 preview/review/approval gate 중심 운영 검토 흐름
- `apps/api/src/lib/document-storage.ts`, `apps/api/src/lib/operational-collab.ts`, `apps/api/src/lib/operational-admin.ts`, `apps/api/src/lib/operational-management.ts` 근거
- `apps/api/test/auth-org.spec.ts` 기반 storage masking/upload lifecycle/audit 경계 근거

### gap 이 큰 영역
- backup/export 외부 반출 기능 부재
- 운영 DB migration 실행/정착 기준 미연결
- production bucket/secret 연결 없는 상태에서 문서 파일을 실운영 공유처럼 쓰면 과장될 위험
- payroll/work-items 민감자료를 metadata preview 와 실원문 저장으로 섞어 읽을 위험
- 감사 로그 storage 흔적을 raw 파일 열람 기능처럼 오해할 위험

## 다음 우선순위

Phase 36 운영자 설정 정리 다음 우선순위는
실행형 backup/export/migration 확대보다
Phase 37 내부 운영 저장흐름 read model 정리다.

핵심 이유:
- 문서 파일 lifecycle, 감사 preview, 민감 운영 모듈 approval gate 는 이미 여러 Phase에 흩어져 있지만 한 번에 읽는 기준 문장이 아직 약하다.
- 이 영역은 raw storage 비노출, metadata-only, read-only audit, approval gate 경계가 동시에 연결돼 있어 read model 을 먼저 정리해야 이후 export/backup/migration 논의도 덜 위험해진다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/dashboard`
- `/documents`
- `/admin/audit-logs`
- `/management`
- `/payroll`
- `/work-items/tax`
- `/work-items/labor`
- `/work-items/legal`

다음 패스에서 바로 줄여야 할 잔여:
- `/documents` 상태 copy 와 storage lifecycle 설명 보강
- `/admin/audit-logs` 에 storage preview 와 masked detail 경계 설명 보강
- `work-items`·`/payroll` 첨부/민감자료를 metadata preview 와 approval gate 로 더 즉시 읽히게 보강
- backup/export/migration 이 아직 별도 승인 범위라는 점을 UI copy 와 문서에 더 즉시 읽히게 보강

우선 참고 문서:
- `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`
- `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md`
- `docs/architecture/phase-36-admin-settings-company-policy-permission-fit-gap-scope.md`
- `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md`
- `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`
- `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
- `docs/guides/phase-8-r2-storage-handoff.md`
- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- Phase 37 저장흐름·감사 연결 재검증: `t_e8e6bea1` — 해봄(`gwtester`) — done
- Phase 37 문서화: `t_ecfe96a8` — 다온(`gwdocs`) — running
- Phase 37 GitHub PR/CI/merge/branch cleanup child: `t_b73a7e86` — 지킴(`gwops`) — todo

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
