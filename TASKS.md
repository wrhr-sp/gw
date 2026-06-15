# TASKS

## Kanban 연결 원칙

이 문서는 사람이 보는 작업 목록이며, 실제 상태 변경은 Hermes Kanban board `groupware`에서 관리한다. Kanban DB는 직접 수정하지 않고 `hermes kanban --board groupware ...` CLI로만 상태를 바꾼다.

## 현재 활성 작업

작업명: Phase 28A 급여 foundation / payslip 1차

현재 체인:

1. 상위 검증: `t_ae2fa514` — 해봄(`gwtester`) — 완료
2. 문서화: `t_67267353` — 다온(`gwdocs`) — 진행 중
3. 후속 체인: `t_1fc47cdc` — 하위 의존 카드, 문서화 완료 대기

현재 문서 기준 핵심 범위:

- 급여를 labor 하위가 아니라 독립 `payroll` 모듈로 분리해 읽히게 한다.
- 급여 유형은 월급제·시급제·일급제·연봉제·포괄임금제를 같은 contract 언어로 고정한다.
- 본사 급여 담당 / 지점 관리자 / 일반 직원 visibility 와 self-only 명세서 경계를 같은 권한 언어로 맞춘다.
- 지점/호텔 기준 급여 기초자료 수집 → 본사 검토 → 직원 명세서 초안 공개 흐름을 고정한다.
- 실제 지급, 주민등록번호/계좌번호 입력, 홈택스/4대보험 신고, 외부 급여·세무 연동은 계속 승인 게이트로 분리한다.

현재 구현/기획 메모:

- `docs/architecture/phase-27-labor-management-pass-1-scope.md` 가 바로 직전 labor 기준 문서다.
- 이번 Phase는 그 다음 단계로 독립 payroll 구조를 contract/API/UI skeleton 기준으로 올리는 단계다.
- 현재 저장소 기준 contract 는 `monthly`/`hourly`/`daily`/`annual`/`inclusive` pay type 을 지원한다.
- API/test 예시는 HQ monthly profile, manager monthly profile, employee hourly profile 과 payroll period/detail/self payslip 경계를 보여 준다.
- 리뷰/테스트/문서화는 pay type 지원 방향, line item 산정 근거, 지점 관리자 제출 범위, self-only payslip, 포괄임금제 경고, 승인 게이트 문장이 과장 없이 같은 뜻인지 확인하는 방향으로 이어간다.

우선 참고 문서:

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
