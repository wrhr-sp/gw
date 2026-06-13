# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 27 노무 관리 1차

현재 체인:

1. 기획: `t_c840c0af` — 도담(`gwplanner`) — 완료
2. 구현 1차: `t_ef60f4db` — 이룸(`gwbuilder`) — 완료
3. 리뷰 1차: `t_be4f3ec4` — 바름(`gwreviewer`) — 완료, EMPLOYEE self-scope labor 경계 불일치 1건 확인
4. 후속 수정: `t_7e3fdeb2` — 이룸(`gwbuilder`) — review-required 상태로 보류, self-scope labor placeholder 추가 반영 후 승인/unblock 대기
5. 테스트: `t_677258d9` — 해봄(`gwtester`) — 완료
6. 문서화: `t_6f206961` — 다온(`gwdocs`) — 진행 중
7. GitHub/배포 확인: `t_a7119a71` — 지킴(`gwops`) — 문서화 완료 대기

현재 문서 기준 핵심 범위:

- Phase 25 공통 `work item` 엔진과 Phase 26 HR lifecycle 기준 위에 근로계약·근무조건·연차/수당·고충/징계/사고·퇴사 skeleton 을 얹는다.
- 계약/조건 변경, 연차 정정, 수당/초과근무 검토, 고충, 징계, 사고, 퇴사 follow-up 을 같은 제품 언어로 정리한다.
- 본사 노무 담당 / HR / 지점 관리자 / 일반 직원 visibility 차이와 restricted 경계를 같은 권한 언어로 맞춘다.
- 모바일 하단 탭을 늘리지 않고 `홈`/`메뉴`와 PC sidebar 안에서 노무 진입 구조를 고정한다.
- 실제 계약서/징계/사고 원문, production DB 실데이터, 외부 노무/법무/급여 연동은 계속 승인 게이트로 분리한다.

현재 구현/기획 메모:

- `docs/architecture/phase-26-hr-meeting-management-pass-1-scope.md` 가 바로 직전 HR/lifecycle 기준 문서다.
- 이번 Phase는 그 위에 labor issue 구조를 문서/contract/API/UI skeleton 기준으로 올리는 단계다.
- 현재 저장소 기준으로는 `work_item_labor_overtime_review`, `work_item_labor_leave_balance_adjustment`, `work_item_labor_grievance_intake`, `work_item_labor_discipline_review` placeholder 가 API/test 에 연결돼 있다.
- 후속 수정으로 EMPLOYEE self-scope labor 카드 `work_item_labor_leave_balance_adjustment` 가 실제 fixture/test 에도 반영됐고, MANAGER 는 같은 카드에 계속 403 경계를 유지한다.
- 리뷰/테스트/문서화는 공통 상태 대 labor intake 보조 상태 분리, 본사 노무 담당/HR/지점 관리자/일반 직원 visibility, metadata-only evidence 원칙, 승인 게이트 문장이 과장 없이 같은 뜻인지 확인하는 방향으로 이어간다.

우선 참고 문서:

- `docs/architecture/phase-27-labor-management-pass-1-scope.md`
- `docs/guides/phase-27-labor-management-pass-1-handoff.md`
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
