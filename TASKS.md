# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 16 파일·문서·공지·검증 안정화 및 파일럿 초안

현재 체인:

1. 기획: `t_ad8287ab` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_20a7feb8` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_65e57559` — 바름(`gwreviewer`) — parent gate 대기
4. 테스트/재검증: 후속 카드 예정
5. 문서화: 후속 카드 예정
6. GitHub/배포 확인: 후속 카드 예정

현재 문서 기준 핵심 범위:

- `/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents` 를 전체 제품 흐름 안에서 다시 정리해 공지/게시판/문서 공간/첨부 metadata skeleton 연결을 파일럿 검토용 기준으로 고정한다.
- `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees`, `/org` 핵심 업무 흐름과 협업 route(`/boards`, `/documents`)가 같은 제품 안에서 자연스럽게 이어지게 정리한다.
- `/admin/policies`, `/admin/users`, `/admin/audit-logs` 가 게시판/문서 운영 정책, 권한, 감사 추적을 설명하되 일반 업무/협업 화면과 경계를 흐리지 않게 유지한다.
- R2 관련 범위는 private-by-default, D1 metadata 우선, binding-aware/dev-safe skeleton 기준까지만 다루고 실제 운영 업로드/public URL 오픈은 하지 않는다.
- 주요 smoke 기준은 핵심 업무 route(`/`, `/login`, `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/employees`, `/org`) + 협업 보강 route(`/boards`, `/boards/[boardId]`, `/posts/[postId]`, `/documents`) + 관리자 route(`/admin/*`, `/api/health`, `/admin/manifest.webmanifest`)를 함께 본다.
- live URL 검증은 가능하면 직접 확인하되, 환경 gate가 있으면 `build:cf`, local `preview:cf` smoke, deployment metadata 같은 대체 근거를 같이 남긴다.
- restricted 항목(secret, production data, DNS/custom domain, 유료 리소스, 외부 연동, migration, destructive 작업)은 이번 체인에서도 자동 진행하지 않는다.

우선 참고 문서:

- `docs/architecture/phase-16-files-docs-announcements-pilot-scope.md`
- `docs/guides/phase-16-files-docs-announcements-pilot-handoff.md`
- `docs/architecture/phase-15-operational-policy-audit-bridge-pass-1-scope.md`
- `docs/guides/phase-15-operational-policy-audit-bridge-pass-1-handoff.md`
- `docs/architecture/phase-5-boards-documents-scope.md`
- `docs/architecture/phase-8-r2-storage-scope.md`
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
