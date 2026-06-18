# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다.
Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` 또는 kanban tool로만 상태를 바꾼다.

## 현재 활성 작업

메인 작업명: Phase 54 기획·fit-gap — 문서함·파일 실사용화

### 메인 체인 (Phase 54 문서함·파일 실사용화 묶음)
1. Phase 54 기획·fit-gap: `t_886df9dc` — 도담(`gwplanner`) — 진행 중
2. Phase 54 구현: `t_77a2a381` — 이룸(`gwbuilder`) — 부모 대기
3. Phase 54 리뷰: `t_014205de` — 바름(`gwreviewer`) — 부모 대기
4. Phase 54 테스트: `t_0c905be8` — 해봄(`gwtester`) — 부모 대기
5. Phase 54 문서화: `t_d349f165` — 다온(`gwdocs`) — 부모 대기
6. Phase 54 GitHub PR/CI/merge/배포 확인: `t_efc8bfb3` — 지킴(`gwops`) — 부모 대기

직전 메인 체인 참고:
- Phase 53 기획 `t_88f64ab6` / 구현 `t_b729d0a6` / 리뷰 `t_40689590` / 테스트 `t_c157ce5b` / 문서화 `t_e92efde2` / GitHub·배포 후속 `t_42d0a17a`

## Phase 54 현재 메모

1. 이번 Phase의 목적은 문서함·파일 API·route·테스트 기준선을 실제 실사용 흐름으로 정리해, 대장이 live URL에서 `/documents` 를 직접 눌러 문서 공간 확인 → 파일 metadata 확인 → 업로드 준비/완료 상태 확인 → 다운로드 준비 → 읽음 확인 → 권한 차단 확인 흐름을 이어 볼 수 있게 만드는 것이다.
2. 현재 근거는 `apps/web/app/documents/page.tsx`, `apps/web/app/_components/real-usage-panels.tsx`, `apps/api/src/app.ts`, `apps/api/test/auth-org.spec.ts`, `packages/shared/src/contracts.ts` 에 걸쳐 있다.
3. 핵심은 전사 문서함 lane, 인사 전용 문서함 lane, 운영 설명 lane 책임을 분리하고, 권한 부족·private/missing space·company scope·placeholder 제한 4축, raw storage internals 비노출, `storageStatus` 대 문서 `status` 구분을 같은 언어로 잠그는 것이다.
4. empty/loading/error/forbidden/dev-safe 상태를 컴포넌트 단위 표시에서 끝내지 않고 route/UAT 기준으로 다시 잠가야 한다.
5. production DB, secret, DNS/custom domain, 유료 리소스, 외부 연동은 계속 별도 승인 게이트다.

## Phase 54 핵심 범위

- `/documents` 화면을 실사용 시작점으로 재정리
- 전사 문서함과 인사 전용 문서함 책임 분리 정리
- 파일 metadata 확인 → 업로드 준비 → 업로드 완료 → 다운로드 준비 → 읽음 확인 흐름 정리
- 사용자/운영자/권한 없음 사용자별 UI/route/API guard 정리
- raw storage key/bucket/public URL/signed URL 비노출, private/missing space 차단, company scope 차단 설명 정리
- `storageStatus` 와 문서 `status` 의미 분리, empty/loading/error/forbidden/dev-safe 상태 문장과 UAT 확인 순서 정리
- live URL / 테스트 계정 / 문서함 전용 확인 route / 승인 게이트를 같은 패키지로 정리

현재 기준 문서 세트:
- `docs/architecture/phase-54-documents-files-live-operations-fit-gap-scope.md`
- `docs/guides/phase-54-documents-files-live-operations-handoff.md`
- `docs/guides/phase-54-documents-files-live-operations-guide.md`
- `docs/architecture/phase-37-internal-operational-storage-audit-fit-gap-scope.md`
- `docs/guides/phase-32-boards-notices-comments-documents-real-usage-handoff.md`
- `docs/architecture/phase-53-leave-attendance-live-operations-fit-gap-scope.md`
- `docs/guides/phase-53-leave-attendance-live-operations-handoff.md`
- `docs/guides/phase-53-leave-attendance-live-operations-guide.md`

## Phase 54 현재 검증 메모

1. 현재 문서 API 기준선은 `apps/api/test/auth-org.spec.ts` 에서 upload-init/upload-complete/download-init, private/missing space 차단, auth/org/company boundary, raw storage 비노출까지 이미 확인 가능하다.
2. 현재 웹 기준선은 `apps/web/app/documents/page.tsx`, `apps/web/app/_components/real-usage-panels.tsx` 에 있다.
3. current route 는 내부 검증용 `preview`, `placeholder`, `guard 확인` 문구 비중이 있어 실사용 문장 정리가 추가로 필요하다.
4. 이번 Phase에서는 existing API/test 근거를 유지하면서 live URL에서 따라갈 문서함·파일 실사용 순서를 더 짧고 명확하게 잠그는 것이 핵심이다.

## Phase 54 다음 우선순위

1. 구현 카드 `t_77a2a381` 에서 `/documents` 의 사용자 happy path, 문서 공간 분리, 상태 문장 정리
2. 리뷰/테스트 카드 `t_014205de`, `t_0c905be8` 에서 권한 분리, private/missing space, company scope, raw storage 비노출, empty/loading/error/forbidden/dev-safe 누락 점검
3. 문서/ops 카드 `t_d349f165`, `t_efc8bfb3` 에서 live 확인 순서, 사용자/UAT 가이드, release gate, live smoke 근거를 문서함·파일 전용 결과 형식으로 정리

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
- `/attendance`
- `/leave`
- `/approvals`
- `/boards`
- `/documents`
- `/work-items/branch`
- `/management`
- `/admin/users`
- `/admin/policies`
- `/admin/audit-logs`
- `/api/health`
- `RUNBOOK.md`
- `DEPLOYMENT.md`

## Phase 50 승인 게이트

- production backup/restore 실행
- production DB 실데이터
- 실제 incident paging / 외부 alerting / SIEM 연동
- 정기 restore drill 자동화
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