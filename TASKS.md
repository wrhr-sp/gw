# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 39 fit-gap 정리 — 운영 QA·보안·감사·권한 회귀 안정화

현재 체인:

1. Phase 39 기획 fit-gap 정리: `t_f7dbddba` — 도담(`gwplanner`) — 진행 중
2. Phase 39 구현: `t_f77b8265` — 이룸(`gwbuilder`) — 완료
3. Phase 39 리뷰: `t_e91e3b31` — 바름(`gwreviewer`) — 완료
4. Phase 39 테스트: `t_fee8d493` — 해봄(`gwtester`) — 재검증 완료
5. Phase 39 문서화: `t_87da953e` — 다온(`gwdocs`) — 진행 중
6. Phase 39 GitHub PR/CI/merge/branch cleanup: `t_e0192dc8` — 지킴(`gwops`) — 대기

현재 메모:

7. 직전 Phase 36 문서 기준으로 `/dashboard`·`/menu`, `/org`·`/employees`, `/admin/users`·`/admin/policies` 운영자 설정 언어를 다시 맞췄고, 직전 Phase 37에서는 `/documents`·`/admin/audit-logs`·`work-items`·`/payroll` 저장흐름/approval gate 경계를 다시 묶었으며, 직전 Phase 38에서는 `/dashboard`·`/menu`·`/notifications`·`/offline` 와 공통 app shell, 일반 업무 흐름 대 `경영업무`·`/admin*` 운영 레인을 현장 사용성 언어로 다시 맞췄다.
8. 이번 카드의 목적은 그 위에서 일반 host 대 admin host 경계, `/management`·`/admin*`·민감 work item 권한, company+branch scope, foreign/self 차단, forbidden/error/empty/offline 분리, masked audit preview 와 raw 민감정보 비노출을 코드/테스트/문서 기준으로 한 번에 묶는 것이다.
9. 현재 기획 근거는 `apps/web/admin-preview-guard.ts`, `apps/web/middleware.ts`, `apps/web/admin-preview-guard.test.ts`, `apps/web/phase38-offline-admin.test.tsx`, `apps/api/src/app.ts`, `apps/api/test/auth-org.spec.ts` 에 걸쳐 있다.
10. 이번 문서의 목적은 "운영 QA·보안·감사·권한 회귀 체크리스트" 를 builder/reviewer/tester/docs/ops 체인이 같은 언어로 이어받게 만드는 것이다.
11. 2026-06-16 parent 재검증에서는 focused web 회귀, `apps/api/test/auth-org.spec.ts`, shared/api/web typecheck, `pnpm check`, `pnpm --filter @gw/web build`, `pnpm --filter @gw/web build:cf`, local admin-host preview smoke 까지 다시 통과했다.
12. 현재 문서화 카드에서는 위 재검증 결과를 기준으로 일반 host 대 admin host 경계, `AUDITOR`/`HR_ADMIN`/`COMPANY_ADMIN` 차이, forbidden/error/empty/offline 분리, raw 민감정보 비노출 문장을 실제 테스트 근거와 어긋나지 않게 다시 고정하는 것이 우선이다.

현재 문서 기준 핵심 범위:

- 일반 host 와 admin host 가 같은 복구/탐색 레인처럼 섞이지 않도록 host 경계를 다시 고정한다.
- `/management`, `/admin/users`, `/admin/policies`, `/admin/audit-logs`, 민감 work item 이 역할/권한/회사+지점 scope 없이 열리지 않는다는 점을 다시 고정한다.
- `/offline`, `/me`, 운영 화면 안내에서 forbidden/error/empty/offline 뜻이 같은 실패 상태처럼 섞이지 않게 다시 고정한다.
- audit log 와 문서/첨부/민감자료 설명이 masked preview·metadata-only·read-only 경계를 유지한다는 점을 다시 고정한다.
- foreign id, 타 회사 employee id, self-approval, disallowed attendance method 가 403 또는 validation 으로 막힌다는 점을 다시 고정한다.
- external security/audit integration, production secret·실데이터, custom domain, native 배포, migration/destructive 작업은 계속 승인 게이트로 남긴다.
- production 데이터, secret, DNS/custom domain, 유료 리소스, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 확인 가능한 영역
- `apps/web/admin-preview-guard.ts`, `apps/web/middleware.ts` 기준 일반 host/admin host route guard 경계
- `apps/web/admin-preview-guard.test.ts` 기준 익명 redirect, `HR_ADMIN` audit 차단, `AUDITOR` audit-only 허용, spoofed host 차단 근거
- `apps/web/phase38-offline-admin.test.tsx` 기준 일반 host/admin host `/offline` 복구 경계 분리
- `apps/api/src/app.ts` 기준 `audit.read`, `work_item.audit.read`, 회사+지점 scope, 민감 첨부 제한, masked audit preview 근거
- `apps/api/test/auth-org.spec.ts` 기준 disallowed attendance method 403, foreign/self 차단, raw storage internals 비노출 근거

### gap 이 큰 영역
- `AUDITOR`·`HR_ADMIN`·`COMPANY_ADMIN`·`MANAGER` 를 같은 관리자처럼 뭉뚱그려 적어 권한 차이를 흐릴 위험
- 일반 host 와 admin host 복구 경계를 같은 화면처럼 설명해 운영 레인을 흐릴 위험
- forbidden/error/empty/offline 을 같은 실패 상태처럼 뭉개 적어 상태 이해를 흐릴 위험
- audit storage preview 와 raw 민감정보 노출 금지 경계를 섞어 적을 위험
- foreign/self/company+branch scope 차단을 단순 메뉴 숨김 수준으로 축소해 적을 위험

## 다음 우선순위

Phase 38 현장 업무 사용성 정리 다음 우선순위는
외부 보안 연동이나 실데이터 확대보다
Phase 39 운영 QA·보안·감사·권한 회귀 read model 정리다.

핵심 이유:
- 일반 host/admin host 경계, `/management`·`/admin*`·민감 work item 권한, company+branch scope, masked audit preview, foreign/self 차단은 이미 구현과 테스트 근거가 있지만 한 번에 읽는 운영 QA 문장이 아직 약하다.
- 이 영역은 권한 누출 방지, 민감정보 비노출, 상태 혼동 금지, 승인 게이트 명시가 동시에 연결돼 있어 read model 을 먼저 정리해야 이후 외부 연동/실데이터/security 확장 논의도 덜 위험해진다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/dashboard`
- `/management`
- `/admin`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/offline`
- `/me`
- `apps/web/admin-preview-guard.test.ts`
- `apps/web/phase38-offline-admin.test.tsx`
- `apps/api/test/auth-org.spec.ts`

다음 패스에서 바로 줄여야 할 잔여:
- 일반 host/admin host 경계와 route guard 설명 보강
- 역할별 `/management`·`/admin*`·audit 레인 차이 문구 보강
- forbidden/error/empty/offline 상태 분리 문구 보강
- foreign/self/company+branch scope 차단과 raw 민감정보 비노출 문구 보강

우선 참고 문서:
- `docs/architecture/phase-39-operational-qa-security-audit-permission-regression-fit-gap-scope.md`
- `docs/guides/phase-39-operational-qa-security-audit-permission-regression-fit-gap-handoff.md`
- `docs/architecture/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-scope.md`
- `docs/guides/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-handoff.md`
- `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`
- `docs/guides/phase-37-internal-operational-storage-audit-fit-gap-handoff.md`
- `docs/architecture/phase-36-admin-settings-company-policy-permission-fit-gap-scope.md`
- `docs/guides/phase-36-admin-settings-company-policy-permission-fit-gap-handoff.md`
- `docs/architecture/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-scope.md`
- `docs/guides/phase-35-payroll-tax-labor-legal-compliance-management-real-usage-handoff.md`
- `ROADMAP.md`
- `HANDOFF.md`

현재 연결된 다음 체인:
- Phase 39 구현: `t_f77b8265` — 이룸(`gwbuilder`) — done
- Phase 39 리뷰: `t_e91e3b31` — 바름(`gwreviewer`) — done
- Phase 39 테스트: `t_fee8d493` — 해봄(`gwtester`) — done
- Phase 39 문서화: `t_87da953e` — 다온(`gwdocs`) — running
- Phase 39 GitHub PR/CI/merge/branch cleanup: `t_e0192dc8` — 지킴(`gwops`) — todo

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
