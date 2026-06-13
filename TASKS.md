# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 26 HR·미팅 관리 1차

현재 체인:

1. 기획: `t_b2d9cc8e` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_6f1b27b9` — 이룸(`gwbuilder`) — parent gate 대기
3. 리뷰: `t_e48e909c` — 바름(`gwreviewer`) — builder 완료 대기
4. 테스트: 후속 reviewer 완료 뒤 같은 체인으로 이어진다.
5. 후속 문서화/운영/최종 보고 카드는 같은 기준으로 이어진다.

현재 문서 기준 핵심 범위:

- Phase 25 공통 `work item` 엔진 위에 직원 lifecycle 과 HR 미팅/면담/교육/온보딩 skeleton 을 얹는다.
- 1:1, 인사면담, 평가 피드백, 고충, 교육/코칭, 지점 운영 관련 직원 미팅을 같은 제품 언어로 정리한다.
- 본사 HR / 지점 관리자 / 일반 직원 visibility 차이와 비공개 범위를 같은 권한 언어로 맞춘다.
- 모바일 하단 탭을 늘리지 않고 `홈`/`메뉴`와 PC sidebar 안에서 HR 진입 구조를 고정한다.
- 실제 민감 인사기록 원문, production DB 실데이터, 외부 캘린더/메일/메신저 연동은 계속 승인 게이트로 분리한다.

현재 구현/기획 메모:

- `docs/architecture/phase-25-common-work-doc-access-engine-pass-1-scope.md` 가 바로 직전 공통 엔진 기준 문서다.
- 이번 Phase는 그 위에 HR meeting/lifecycle 구조를 문서/contract/API/UI skeleton 기준으로 올리는 단계다.
- 리뷰/테스트/문서화는 공통 상태 대 meeting 보조 상태 분리, 본사 HR/지점 관리자/일반 직원 visibility, metadata-only 메모 원칙, 승인 게이트 문장이 과장 없이 같은 뜻인지 확인하는 방향으로 이어간다.

우선 참고 문서:

- `docs/architecture/phase-26-hr-meeting-management-pass-1-scope.md`
- `docs/guides/phase-26-hr-meeting-management-pass-1-handoff.md`
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
