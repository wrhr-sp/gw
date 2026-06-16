# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 38 fit-gap 정리 — 모바일·PC 현장 업무 사용성·알림·오프라인

현재 체인:

1. Phase 38 기획 fit-gap 정리: `t_53c34c58` — 도담(`gwplanner`) — 완료
2. Phase 38 구현: `t_d777ff89` — 이룸(`gwbuilder`) — 완료
3. Phase 38 리뷰: `t_5191cf30` — 바름(`gwreviewer`) — 완료
4. Phase 38 테스트: `t_2f6683c6` — 해봄(`gwtester`) — 완료
5. Phase 38 문서화: `t_1894a9f3` — 다온(`gwdocs`) — 진행 중
6. Phase 38 GitHub PR/CI/merge/branch cleanup: `t_d127425a` — 지킴(`gwops`) — 대기

현재 메모:

7. 직전 Phase 36 문서 기준으로 `/dashboard`·`/menu`, `/org`·`/employees`, `/admin/users`·`/admin/policies` 운영자 설정 언어를 다시 맞췄고, 직전 Phase 37에서는 `/documents`·`/admin/audit-logs`·`work-items`·`/payroll` 저장흐름/approval gate 경계를 다시 묶었다.
8. 이번 카드의 목적은 그 위에서 `/dashboard`, `/menu`, `/notifications`, `/offline`, 공통 app shell, 모바일 하단 탭, PC sidebar, 일반 업무 흐름 대 `경영업무`·`/admin*` 운영 레인을 코드/테스트/문서 기준으로 한 번에 묶는 것이다.
9. parent 테스트(`t_2f6683c6`)는 web focused/full 테스트, root `pnpm check`, Next build, Cloudflare build, local preview admin-host smoke 까지 실제 실행해 현재 범위 blocker 가 없음을 확인했다.
10. 현재 문서화 카드는 그 재검증 결과를 사용자/운영자 가이드, 추천 테스트 경로, 남은 승인 게이트 문장으로 다시 고정하고, 다음 실행자인 `t_d127425a` 가 release gate/PR 정리를 이어 받게 만드는 단계다.

현재 문서 기준 핵심 범위:

- `/dashboard` 를 홈처럼 읽는 시작점과 `/menu` 전체 메뉴가 같은 shortcut/정보구조를 공유한다는 점을 다시 고정한다.
- 모바일 하단 탭 5개(`메뉴`·`홈`·`메신저`·`메일`·`알림`)와 PC sidebar 가 같은 업무 그룹을 가리킨다는 점을 다시 섞지 않는다.
- `/notifications` same-origin inbox/unread count 와 외부 발송 미연결 honesty 를 같은 화면 언어로 정리한다.
- `/offline` 과 status banner 가 가능한 일/막히는 일/재시도 절차를 분리하고, 상태 변경을 가짜 성공처럼 보이게 하지 않는다는 원칙을 다시 고정한다.
- 일반 업무 흐름과 `경영업무`·`/admin*` 운영 메뉴를 같은 책임처럼 섞지 않는다.
- push/background sync/native 배포/production custom domain·secret·실데이터는 계속 승인 게이트로 남긴다.
- production 데이터, secret, DNS/custom domain, 유료 리소스, destructive 작업은 계속 승인 게이트로 남긴다.

## fit-gap 요약

### 현재 바로 확인 가능한 영역
- `/dashboard` 홈 입구, `/menu` 전체 메뉴, 모바일 하단 탭, PC sidebar 의 같은 정보구조
- `/notifications` same-origin inbox/unread count/notices 와 `/offline` 재시도 안내
- `경영업무` 분리 메뉴와 `/admin/users`·`/admin/policies`·`/admin/audit-logs` 운영 레인
- `apps/web/app/page.tsx`, `apps/web/menu-page-content.tsx`, `apps/web/app/notifications/page.tsx`, `apps/web/app/offline/page.tsx`, `apps/web/app/_components/mobile-app-shell.tsx`, `apps/web/app/mobile-pwa-config.ts` 근거
- `apps/api/src/app.ts`, `packages/shared/src/contracts.ts`, `packages/shared/src/mobile-contracts.ts`, `apps/api/test/auth-org.spec.ts` 근거

### gap 이 큰 영역
- 홈 shortcut 을 개인 편집/정렬/영구 저장까지 이미 닫힌 기능처럼 오해할 위험
- notifications inbox 를 외부 push/메일/SMS 발송 완료처럼 오해할 위험
- offline 안내를 실제 상태 변경 성공이나 완전한 offline sync 처럼 오해할 위험
- 일반 업무 홈과 `경영업무`·`/admin*` 운영 메뉴를 같은 책임처럼 읽을 위험
- production custom domain, secret, native 배포, push/background sync 를 현재 범위처럼 적을 위험

## 다음 우선순위

Phase 37 내부 운영 저장흐름 정리 다음 우선순위는
외부 알림/push/native 확장보다
Phase 38 현장 업무 사용성 read model 정리다.

핵심 이유:
- 홈/메뉴/알림/오프라인/운영 분리 구조는 이미 여러 Phase에 흩어져 있지만, 한 번에 읽는 현장 사용성 문장이 아직 약하다.
- 이 영역은 같은 정보구조 유지, 권한 분리, same-origin inbox, 가짜 성공 UX 금지, 승인 게이트 명시가 동시에 연결돼 있어 read model 을 먼저 정리해야 이후 push/native/외부연동 논의도 덜 위험해진다.

대장이 실제로 가장 짧게 따라갈 추천 확인 순서:
- `/dashboard`
- `/menu`
- `/notifications`
- `/offline`
- `/attendance`
- `/leave`
- `/approvals`
- `/management`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`

다음 패스에서 바로 줄여야 할 잔여:
- `/dashboard` 홈 shortcut 과 `/menu` 전체 메뉴의 같은 정보구조 설명 보강
- `/notifications` same-origin inbox 와 외부 발송 미연결 honesty 보강
- `/offline` 가능/불가/재시도 절차와 status banner 연결 보강
- 일반 업무 레인과 `경영업무`·`/admin*` 운영 레인 분리 문구 보강

우선 참고 문서:
- `docs/architecture/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-scope.md`
- `docs/guides/phase-38-mobile-pc-field-usability-notification-offline-fit-gap-handoff.md`
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
- Phase 38 문서화: `t_1894a9f3` — 다온(`gwdocs`) — running
- Phase 38 GitHub PR/CI/merge/branch cleanup: `t_d127425a` — 지킴(`gwops`) — todo

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
