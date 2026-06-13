# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 23 관리자 운영 콘솔 실사용 1차

현재 체인:

1. 기획: `t_201dd1bf` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_7ca962f5` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_4c8c7d97` — 바름(`gwreviewer`) — builder 완료 대기
4. 테스트: 후속 reviewer 완료 뒤 같은 체인으로 이어진다.
5. 후속 문서화/운영/최종 보고 카드는 같은 기준으로 이어진다.

현재 문서 기준 핵심 범위:

- 관리자 운영 CTA 와 `/admin` 허브를 실제 회사 운영 준비 관점으로 다시 묶는다.
- 기준 순서는 `/dashboard` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 다.
- `/employees` 일반 조회와 `/admin/users` 운영 검토, `/boards`·`/documents` 협업 흐름과 `/admin/policies` 권한·정책 검토를 분리해 정리한다.
- `invite.manage`, `audit.read`, `board.manage`, `document.space.manage` 권한 경계와 route/API guard 를 다시 확인한다.
- 파일·문서·공지 권한 경계와 관리자 운영 변경 경계가 raw storage 정보 비노출 원칙과 충돌하지 않게 정리한다.
- production data, secret, 실제 권한 저장, 외부 연동, 유료 리소스는 계속 별도 승인 게이트로 분리한다.

현재 구현/기획 메모:

- `apps/web/app/dashboard/page.tsx`, `apps/web/app/admin/page.tsx`, `apps/web/app/admin/users/page.tsx`, `apps/web/app/admin/policies/page.tsx`, `apps/web/app/admin/audit-logs/page.tsx` 가 현재 Web 운영 흐름의 핵심 근거다.
- `packages/shared/src/admin-access.ts`, `packages/shared/src/contracts.ts`, `apps/web/admin-preview-guard.ts`, `apps/api/src/app.ts`, `apps/api/test/auth-org.spec.ts` 가 권한/guard/API 경계의 핵심 근거다.
- 리뷰/테스트/문서화는 운영 콘솔 순서가 끊기지 않는지, 일반 조회 화면과 운영 검토 화면 경계가 같은 뜻인지, high-risk permission 과 승인 게이트가 문서마다 같은지 확인하는 방향으로 이어간다.

우선 참고 문서:

- `docs/architecture/phase-23-admin-operations-console-real-usage-pass-1-scope.md`
- `docs/guides/phase-23-admin-operations-console-real-usage-pass-1-handoff.md`
- `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md`
- `docs/guides/phase-22-real-workflow-integration-pass-1-handoff.md`
- `docs/architecture/phase-21-real-company-settings-model-pass-1-scope.md`
- `docs/guides/phase-21-real-company-settings-model-pass-1-handoff.md`
- `docs/architecture/phase-20-pre-operations-alignment-pass-1-scope.md`
- `docs/guides/phase-20-pre-operations-alignment-pass-1-handoff.md`
- `docs/architecture/phase-19-native-mobile-internal-pilot-draft-scope.md`
- `docs/guides/phase-19-native-mobile-internal-pilot-draft-handoff.md`
- `docs/architecture/phase-18-native-mobile-core-workflows-pass-1-scope.md`
- `docs/guides/phase-18-native-mobile-core-workflows-pass-1-handoff.md`
- `docs/architecture/phase-17-native-mobile-transition-prep-scope.md`
- `docs/guides/phase-17-native-mobile-transition-prep-handoff.md`
- `docs/architecture/phase-6-mobile-pwa-scope.md`
- `docs/architecture/phase-7-api-same-origin-scope.md`
- `docs/ux/groupware-benchmark-principles.md`
- `docs/product/groupware-vision-roadmap.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```
