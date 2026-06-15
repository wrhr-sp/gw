# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 29 법무 관리 1차

현재 체인:

1. 기획: `t_205ba6fa` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_7361523e` — 이룸(`gwbuilder`) — 대기 중
3. 후속 체인: `t_8d4717c8` — 하위 의존 카드, 구현 완료 대기

현재 문서 기준 핵심 범위:

- 법무 업무를 독립 포털로 만들지 않고 공통 `work item` 기반 `legal` 모듈 확장으로 읽히게 한다.
- 위탁운영·임대차·용역·협력사·개인정보처리위탁 계약 분류와 계약 검토/갱신 skeleton 을 같은 제품 언어로 고정한다.
- 본사 법무/운영 담당 / 지점 관리자 / 감사 visibility 차이를 같은 권한 언어로 맞춘다.
- 계약 검토 요청 → 배정 → 검토 → 보완 요청 → 승인 게이트, 그리고 분쟁/클레임/보험/사고 후속 흐름을 고정한다.
- 실제 계약 원문 저장 확대, 외부 변호사/보험사/기관 연동, 실분쟁 자료 업로드 확대는 계속 승인 게이트로 분리한다.

현재 구현/기획 메모:

- `docs/architecture/phase-28-tax-management-pass-1-scope.md` 가 바로 앞 세무 기준 문서다.
- 이번 Phase는 그 다음 단계로 공통 `work item` 기반 `legal` 구조를 계약 검토/갱신/분쟁 후속 기준으로 올리는 단계다.
- 현재 저장소에는 `/management`, `/work-items/legal`, `/api/work-items?module=legal`, `/api/work-items/:id/reviews` 가 이미 있고, legal placeholder 도 `work_item_legal_contract_review`(company scope 계약 검토), `work_item_legal_contract_renewal`(branch scope 갱신 검토), `work_item_legal_dispute_intake`(company scope 분쟁/클레임 사실확인) 3건이 있다.
- 이번 기획/구현의 핵심은 legal category 확장, intake/renewal/dispute metadata, 지점 요청 범위 대 HQ 법무 검토 범위를 같은 언어로 맞추는 것이다.
- 리뷰/테스트/문서화는 계약 검토 skeleton, 갱신 예정, 분쟁/클레임/보험 후속, 승인 게이트 문장이 과장 없이 같은 뜻인지 확인하는 방향으로 이어간다.

우선 참고 문서:

- `docs/architecture/phase-29-legal-management-pass-1-scope.md`
- `docs/guides/phase-29-legal-management-pass-1-handoff.md`
- `docs/architecture/phase-28-tax-management-pass-1-scope.md`
- `docs/guides/phase-28-tax-management-pass-1-handoff.md`
- `docs/architecture/phase-28a-payroll-foundation-payslip-pass-1-scope.md`
- `docs/guides/phase-28a-payroll-foundation-payslip-pass-1-handoff.md`
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
