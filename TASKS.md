# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 56 기획·fit-gap — 관리자 지정 경영업무 1차 실사용화

### 메인 체인 (Phase 56 관리자 지정 경영업무 1차 실사용화 묶음)
1. Phase 56 기획·fit-gap: `t_0d629234` — 도담(`gwplanner`) — 진행 중
2. Phase 56 구현: `t_6090c4b8` — 이룸(`gwbuilder`) — 부모 대기
3. Phase 56 리뷰: `t_6f8ecbd2` — 바름(`gwreviewer`) — 부모 대기
4. Phase 56 테스트: `t_9aa0fc51` — 해봄(`gwtester`) — 부모 대기
5. Phase 56 문서화: `t_1f522af2` — 다온(`gwdocs`) — 부모 대기
6. Phase 56 GitHub PR/CI/merge/배포 확인: `t_055dbbf6` — 지킴(`gwops`) — 부모 대기

직전 메인 체인 참고:
- Phase 55 기획 `t_14966b8c` / 구현 `t_0c6e5a3d` / 리뷰 `t_0ff86f94` / 테스트 `t_c1cd2dec` / 문서화 `t_6a0f7311` / GitHub·배포 후속 `t_34df084c`

## Phase 56 현재 메모

1. 이번 Phase의 목적은 경영업무 route/API/test 기준선을 실제 운영 흐름으로 정리해, 대장이 live URL에서 `/management` → `/payroll` → `/payroll/me` → `/work-items/tax` → `/work-items/labor` → `/work-items/legal` → `/admin/audit-logs` 를 직접 눌러 지정 관리자 접근 경계, self-only 급여 확인, 세무/노무/법무 실사용 패널, 감사 read-only 흐름을 이어 볼 수 있게 만드는 것이다.
2. 현재 근거는 `apps/web/app/management/page.tsx`, `apps/web/app/payroll/page.tsx`, `apps/web/app/payroll/me/page.tsx`, `apps/web/app/work-items/work-items-config.ts`, `apps/web/app/work-items/tax/page.tsx`, `apps/web/app/work-items/labor/page.tsx`, `apps/web/app/work-items/legal/page.tsx`, `apps/web/app/admin/audit-logs/page.tsx`, `apps/api/src/app.ts`, `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts`, `packages/shared/src/contracts.ts` 에 걸쳐 있다.
3. 핵심은 `/management` 운영 허브 lane, `/payroll` 운영 급여 lane, `/payroll/me` self-only lane, `/work-items/tax|labor|legal` 모듈 lane, `/admin/audit-logs` 감사 lane 책임을 분리하고, company/branch/self/restricted scope 차이와 masked preview/비노출 원칙을 같은 언어로 잠그는 것이다.
4. empty/loading/error/forbidden/dev-safe 상태를 컴포넌트 단위 표시에서 끝내지 않고 route/UAT 기준으로 다시 잠가야 한다.
5. production DB, secret, DNS/custom domain, 유료 리소스, 실제 실지급/실신고, 외부 세무/노무/법무 전문가 연동, migration, destructive 작업은 계속 별도 승인 게이트다.

## Phase 56 핵심 범위

- `/management` 화면을 민감 운영 허브 시작점으로 재정리
- `/payroll` 운영 급여 lane 과 `/payroll/me` self-only lane 책임 분리 정리
- `/work-items/tax`, `/work-items/labor`, `/work-items/legal` 모듈별 scope/visibility/approval gate 차이 정리
- 지정 관리자/일반 직원/감사 담당자별 UI/route/API guard 정리
- company scope, branch scope, self scope, restricted scope 차단 설명 정리
- masked preview 유지, raw storage key/bucket/public URL/signed URL/secret 비노출, empty/loading/error/forbidden/dev-safe 상태 문장과 UAT 확인 순서 정리
- live URL / 테스트 계정 / 지정 관리자 전용 확인 route / 승인 게이트를 같은 패키지로 정리

현재 기준 문서 세트:
- `docs/architecture/phase-56-management-admin-live-operations-pass1-fit-gap-scope.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-handoff.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md`
- `docs/architecture/phase-55-admin-account-rbac-org-audit-live-operations-fit-gap-scope.md`
- `docs/guides/phase-55-admin-account-rbac-org-audit-live-operations-handoff.md`
- `docs/guides/phase-55-admin-account-rbac-org-audit-live-operations-guide.md`
- `docs/architecture/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-scope.md`
- `docs/guides/phase-43-payroll-tax-labor-legal-internal-management-adoption-fit-gap-handoff.md`

## Phase 56 현재 검증 메모

1. 현재 API 기준선은 `apps/api/test/auth-org.spec.ts`, `apps/api/test/work-items.spec.ts` 에서 급여 self-only, 감사 read-only, work item module별 허용/차단, branch/company/restricted 경계를 이미 확인 가능하다.
2. 현재 웹 기준선은 `apps/web/app/management/page.tsx`, `apps/web/app/payroll/page.tsx`, `apps/web/app/payroll/me/page.tsx`, `apps/web/app/work-items/tax/page.tsx`, `apps/web/app/work-items/labor/page.tsx`, `apps/web/app/work-items/legal/page.tsx`, `apps/web/app/admin/audit-logs/page.tsx` 에 있다.
3. current route 는 내부 검증용 `preview`, `read-only`, `guard 확인`, `실사용 패널` 문구 비중이 있어 실사용 운영 문장 정리가 추가로 필요하다.
4. 이번 Phase에서는 existing API/test 근거를 유지하면서 live URL에서 따라갈 지정 관리자 경영업무 실사용 순서를 더 짧고 명확하게 잠그는 것이 핵심이다.

## Phase 56 다음 우선순위

1. 구현 카드 `t_6090c4b8` 에서 `/management`, `/payroll`, `/payroll/me`, `/work-items/tax|labor|legal`, `/admin/audit-logs` 의 역할별 happy path 와 lane 분리 문장 정리
2. 리뷰/테스트 카드 `t_6f8ecbd2`, `t_9aa0fc51` 에서 일반 직원 차단, self-only 급여, branch/company/restricted scope, `audit.read`, masked preview, empty/loading/error/forbidden/dev-safe 누락 점검
3. 문서/ops 카드 `t_1f522af2`, `t_055dbbf6` 에서 live 확인 순서, 사용자/UAT 가이드, release gate, live smoke 근거를 지정 관리자 경영업무 전용 결과 형식으로 정리

### Phase 50 세부 UX 포커스 체인: 모바일 플로팅 하단바
1. 기획: `t_c2551b81` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_b05b8631` — 이룸(`gwbuilder`) — 부모 대기
3. 리뷰: `t_72fc15aa` — 바름(`gwreviewer`) — 부모 대기

세부 목표:
- 모바일 하단바를 safe-area 위 floating capsule 로 정리
- 탭 순서 `메뉴` → `홈` → `메신저` → `메일` → `알림` 유지
- active pill 강조, 알림 배지 `0 숨김 / 1~99 / 99+`, 본문 하단 padding 회귀 기준 잠그기

- 세부 기준 문서:
- `docs/architecture/phase-50-mobile-floating-bottom-bar-ux-fit-gap-scope.md`
- `docs/guides/phase-50-mobile-floating-bottom-bar-ux-handoff.md`
- `docs/guides/phase-50-mobile-floating-bottom-bar-ux-guide.md`

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
- `docs/guides/phase-56-management-admin-live-operations-pass1-guide.md`
- `docs/guides/phase-56-management-admin-live-operations-pass1-handoff.md`

## Phase 56 승인 게이트

- 실지급, 은행이체, 급여 확정 운영 전환
- 실신고, 외부 세무/노무/법무/보험/기관 연동
- production DB 실데이터
- production backup/restore 실행
- 실제 incident paging / 외부 alerting / SIEM 연동
- DNS/custom domain
- 유료 리소스
- secret 입력/교체
- migration
- destructive 작업

우선 참고 문서:
- `docs/architecture/phase-48-audit-security-backup-restore-incident-ops-fit-gap-scope.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-handoff.md`
- `docs/guides/phase-48-audit-security-backup-restore-incident-ops-guide.md`
- `docs/architecture/phase-47-operational-stability-performance-mobile-pwa-usability-fit-gap-scope.md`
- `docs/guides/phase-47-operational-stability-performance-mobile-pwa-usability-handoff.md`
- `RUNBOOK.md`
- `DEPLOYMENT.md`
- `ROADMAP.md`
- `HANDOFF.md`

## 작업 카드 생성 기준

- 기능 개발: 기획 → 구현 → 리뷰 → 테스트 → 문서화 → GitHub/배포 확인 → 최종보고
- 버그/검증 실패: 재현 → 수정 → 리뷰 → 재검증 → 문서화 → 최종보고
- 운영 자동화: 지킴/리뷰/테스트 중심으로 진행하되 systemd, DB, secret, DNS, 유료 리소스는 승인 게이트를 분리한다.

## 확인 명령

```bash
HOME=/home/wrhrgw/gw-dev-bot HERMES_HOME=/home/wrhrgw/gw-dev-bot/.hermes HERMES_PROFILE=singde hermes kanban --board groupware stats
```