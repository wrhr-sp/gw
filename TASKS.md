# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 25 공통 업무·문서·마감·권한 엔진 1차

현재 체인:

1. 기획: `t_f6756d26` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_1d7f8bb0` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_e3cfacdf` — 바름(`gwreviewer`) — builder 완료 대기
4. 테스트: 후속 reviewer 완료 뒤 같은 체인으로 이어진다.
5. 후속 문서화/운영/최종 보고 카드는 같은 기준으로 이어진다.

현재 문서 기준 핵심 범위:

- HR·세무·노무·법무·지점 운영 업무가 함께 타는 공통 work item 엔진을 먼저 고정한다.
- 공통 문서/첨부/검토/마감/감사 로그 skeleton 을 같은 언어로 정리한다.
- 회사 + 지점/호텔 + 역할 + capability 기준 접근제어를 공통 업무 엔진 관점으로 다시 맞춘다.
- 모바일 하단 탭을 늘리지 않고 `홈`/`메뉴`와 PC sidebar 에 새 업무 그룹 자리를 확보하는 기준을 고정한다.
- 실제 개인정보 원문, 민감 문서, production DB 실데이터, 외부 세무/노무/법무 연동은 계속 승인 게이트로 분리한다.

현재 구현/기획 메모:

- `docs/architecture/phase-24-company-pilot-operations-pass-1-scope.md` 가 직전 파일럿 준비 기준 문서다.
- 이번 Phase는 그 위에 HR·세무·노무·법무·지점 운영 업무를 담는 공통 엔진을 먼저 문서/contract/API/UI skeleton 기준으로 올리는 단계다.
- 리뷰/테스트/문서화는 공통 상태값, 문서/첨부/검토/마감 구조, 지점 scope + 역할 scope, 승인 게이트 문장이 과장 없이 같은 뜻인지 확인하는 방향으로 이어간다.

우선 참고 문서:

- `docs/architecture/phase-25-common-work-doc-access-engine-pass-1-scope.md`
- `docs/guides/phase-25-common-work-doc-access-engine-pass-1-handoff.md`
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
