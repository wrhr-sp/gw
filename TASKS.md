# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 24 회사 파일럿 운영 1차

현재 체인:

1. 기획: `t_ea69e768` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_3d628e46` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_3ecca52c` — 바름(`gwreviewer`) — builder 완료 대기
4. 테스트: 후속 reviewer 완료 뒤 같은 체인으로 이어진다.
5. 후속 문서화/운영/최종 보고 카드는 같은 기준으로 이어진다.

현재 문서 기준 핵심 범위:

- 전사 오픈이 아니라 제한된 부서/사용자 기준 파일럿 대상 묶음과 제외 범위를 먼저 고정한다.
- 직원 체험 흐름(`/login` → `/dashboard` → `/attendance` → `/leave` → `/approvals` → `/boards`·`/documents` → `/me` → `/org`·`/employees`)과 운영자 동행 흐름(`/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs`)을 같은 파일럿 시나리오로 다시 묶는다.
- live URL, same-origin API health, PWA/mobile smoke 를 파일럿 선행 체크리스트 언어로 정리한다.
- 사용자 안내, 운영자 매뉴얼, 장애 대응, 피드백 수집 기준을 1차 문서 구조로 고정한다.
- parent Phase 23의 release-gate/cloudflare-deploy success 는 baseline 근거로만 쓰고, 이번 Phase에서는 재검증 완료처럼 과장하지 않는다.
- production data, secret, 실제 계정 발급/권한 저장, 외부 연동, 유료 리소스는 계속 별도 승인 게이트로 분리한다.

현재 구현/기획 메모:

- `docs/architecture/phase-22-real-workflow-integration-pass-1-scope.md` 와 `docs/architecture/phase-23-admin-operations-console-real-usage-pass-1-scope.md` 가 각각 직원 체험 레인과 운영자 레인의 직전 기준 문서다.
- parent Phase 23 최종 보고 metadata 가 현재 live URL(`https://gw-web.werehere31.workers.dev`), 대표 route, release-gate/cloudflare-deploy success baseline 근거다.
- 리뷰/테스트/문서화는 파일럿 대상 범위, 선행 체크리스트, 사용자 안내/운영자 매뉴얼, 승인 게이트 문장이 과장 없이 같은 뜻인지 확인하는 방향으로 이어간다.

우선 참고 문서:

- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md`
- `docs/guides/phase-24-company-pilot-operations-pass-1-handoff.md`
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
