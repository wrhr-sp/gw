# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 21 실제 회사 설정 모델 1차

현재 체인:

1. 기획: `t_f97c8d87` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_6066a6fe` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_39ce6d0c` — 바름(`gwreviewer`) — builder 완료 대기
4. 후속 테스트/문서화/운영 카드는 review handoff 확정 뒤 같은 기준으로 이어간다.

현재 문서 기준 핵심 범위:

- 회사 기본 설정, 조직/직원/권한, 근태·휴가·근무 정책, 운영 관리자 설정을 실제 회사 설정 묶음처럼 다시 연결한다.
- `/org`·`/employees` 일반 조회와 `/admin/users` 운영 검토, `/admin/policies` 정책 candidate 가 한 회사 설정 모델 안에서 어떻게 이어지는지 같은 언어로 맞춘다.
- 출퇴근 정책의 `company_default < workplace < department < job_type` 우선순위 방향을 휴가/근무 정책 설명에도 같은 방향으로 확장한다.
- 직원 UI/API 는 현재 허용된 정책만 보이는 흐름으로 설명하고, 관리자 화면은 candidate/diff 검토 책임으로 유지한다.
- GPS/실태그 단말/production data/external HR/실권한 변경은 계속 별도 승인 게이트로 분리한다.
- 성공 기준은 실제 회사처럼 보이는 설정 구조와 승인 게이트를 대장이 파일럿 준비 관점에서 오해 없이 판정할 수 있게 만드는 것이다.

현재 구현/기획 메모:

- `DATA_MODEL.md`, `API.md`, `packages/shared/src/attendance-policy.ts`, `packages/shared/src/contracts.ts` 는 현재 회사 설정 모델의 핵심 근거다.
- 이번 Phase 21에서는 mobile/readiness 문장을 유지하되, 회사 기본 설정/조직/직원/권한/정책 연결 구조를 더 앞에 둔다.
- 리뷰/테스트/문서화는 직원 화면이 허용된 정책만 보여 주는지, 관리자 화면이 candidate/diff 책임을 유지하는지, 승인 게이트가 문서마다 같은지 확인하는 방향으로 이어간다.

우선 참고 문서:

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
