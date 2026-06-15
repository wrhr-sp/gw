# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 28 세무 관리 1차

현재 체인:

1. 기획: `t_d869a4e9` — 도담(`gwplanner`) — 진행 중
2. 구현: `t_cbc146d5` — 이룸(`gwbuilder`) — 대기 중
3. 후속 체인: `t_5263f729` — 하위 의존 카드, 구현 완료 대기

현재 문서 기준 핵심 범위:

- 세무 업무를 독립 신고 앱으로 만들지 않고 공통 `work item` 기반 `tax` 모듈 확장으로 읽히게 한다.
- 부가세·원천세·지방세·법인세 등 세목별 마감 skeleton 과 지점별 증빙 수집/보완 요청 흐름을 같은 제품 언어로 고정한다.
- 본사 세무 담당 / 지점 관리자 / 감사 visibility 차이를 같은 권한 언어로 맞춘다.
- 지점 자료 제출 → HQ 세무 검토 → 세무사 전달용 패키지 준비 흐름을 고정한다.
- 실제 신고 제출, 홈택스/회계프로그램/세무사 외부 연동, 실세무 원문 업로드는 계속 승인 게이트로 분리한다.

현재 구현/기획 메모:

- `docs/architecture/phase-28a-payroll-foundation-payslip-pass-1-scope.md` 가 바로 앞 급여 기준 문서다.
- 이번 Phase는 그 다음 단계로 공통 `work item` 기반 `tax` 구조를 세무 일정/증빙/검토/전달 패키지 기준으로 올리는 단계다.
- 현재 저장소에는 `/work-items/tax`, `/api/work-items?module=tax`, `/api/work-item-deadlines`, `/api/work-items/:id/reviews` 와 tax placeholder 1건이 이미 있다.
- 이번 기획/구현의 핵심은 tax category 확장, filing/evidence/package metadata, 지점 제출 범위 대 HQ 세무 검토 범위를 같은 언어로 맞추는 것이다.
- 리뷰/테스트/문서화는 세무 일정 skeleton, 누락/반려/보완 요청, 세무사 전달 패키지 방향, 승인 게이트 문장이 과장 없이 같은 뜻인지 확인하는 방향으로 이어간다.

우선 참고 문서:

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
