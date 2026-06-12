# 이전 scheduled 복구 카드 정리 handoff

한 줄 요약:
예전 web build flaky / recovery loop 때문에 남아 있는 scheduled 카드들을 최신 `main` 기준으로 다시 읽고, 이미 끝난 카드와 아직 남겨야 할 카드를 근거와 함께 분리하는 작업입니다.

## 1. 지금 상태를 쉬운 말로 정리하면

이미 끝난 것:
- review-required gate, recovery loop, watcher PATH 보강 같은 자동화 보강 체인은 완료 이력으로 남아 있습니다.
- 관리자 PWA 품질 개선 체인도 최근 PR/CI/merge/release-gate 기준으로 main 반영 근거가 있습니다.
- 따라서 과거 scheduled 카드들 중 일부는 “당시에는 필요했지만 지금은 더 최신 완료 카드가 대신 설명하는 상태”일 가능성이 큽니다.

아직 남은 문제:
- board 에는 예전 scheduled 카드가 남아 있어 현재 활성 이슈와 과거 이슈가 섞여 보일 수 있습니다.
- 같은 실패군에서 파생된 복구 카드가 여러 장 남아 있으면 다음 작업자가 기준 카드를 헷갈릴 수 있습니다.
- 최신 `main` 기준으로 이미 해결된 카드까지 살아 있으면 자동화 품질이 나빠 보이는 착시가 생깁니다.

즉, 이번 단계는 “새 기능 개발”보다
“보드 위 오래된 복구 흔적을 최신 근거에 맞게 재분류하는 정리 단계”입니다.

## 2. 먼저 확인할 것

1. `docs/architecture/scheduled-recovery-card-cleanup-scope.md`
2. 이 handoff 문서
3. `HANDOFF.md`
4. `KNOWN_ISSUES.md`
5. `CHANGELOG.md`
6. 관련 자동화 문서
   - `docs/guides/automation-hardening-review-gate-handoff.md`
   - `docs/workflow/groupware-kanban-automation.md`
   - `scripts/README.md`

## 3. 카드 분류 규칙

### 3-1. 바로 정리 가능한 카드

아래가 확인되면 stale/superseded 후보입니다.

- 같은 목적의 더 최신 카드가 이미 완료됨
- 관련 PR 이 merge 되었고 main 에 반영됨
- 후속 검증 카드까지 완료되어 증거가 남아 있음
- 루트 문서가 이미 “이 작업은 완료 이력”으로 다루고 있음

이때 해야 할 일:
- 카드마다 짧은 근거를 남깁니다.
- “무엇이 대신 기준 카드가 되었는지”를 적습니다.
- 가능하면 중복 카드 여러 장 대신 기준 카드 1장만 남깁니다.

### 3-2. 남겨야 하는 카드

아래면 유지 후보입니다.

- 최신 `main` 기준으로도 실제 미완료 작업이 남아 있음
- 특정 reviewer/tester/ops 후속 단계가 아직 필요함
- 최신 카드가 이 목적을 완전히 흡수하지 못함

이때 해야 할 일:
- 카드 목적을 지금 시점 문장으로 다시 짧게 정리합니다.
- 무엇이 아직 미완료인지 한 줄로 분명히 남깁니다.
- 중복 카드가 있으면 기준 카드 1개만 남기고 나머지는 정리합니다.

### 3-3. 사람 승인 없이는 건드리면 안 되는 카드

아래는 자동 정리 금지입니다.

- secret/production/DNS/유료 리소스/운영 데이터 영향
- dirty worktree 정리나 destructive cleanup 필요
- 근거 없이 대량 archive/삭제해야만 닫을 수 있는 경우

이때 해야 할 일:
- 닫지 말고 reason 을 남깁니다.
- singde 가 사용자 승인 필요 여부를 판단할 수 있게 메모만 남깁니다.

## 4. 추천 작업 순서

1. scheduled 카드 목록을 만든다.
2. 카드별로 부모/자식 체인, 더 최신 완료 카드, 관련 PR/CI/merge 근거를 붙여 본다.
3. 각 카드를 아래 표 형태로 분류한다.

권장 표 컬럼:
- 카드 id
- 원래 목적
- 최신 기준 상태(해결됨 / 유지 / 승인 필요 / 판단 유보)
- 근거
- 후속 액션

4. 기준 카드 1장만 남기고 중복 카드는 stale/superseded 로 정리한다.
5. 루트 문서에 재발 방지 메모가 필요하면 최소 범위로 반영한다.
6. review/test 단계가 필요하면 근거와 함께 다음 카드로 넘긴다.

## 5. 최소 근거 체크리스트

카드 하나를 닫거나 stale 로 분류하기 전 아래 중 가능한 것을 확인합니다.

- 관련 부모 카드 완료 summary/metadata
- 자식 카드 완료 여부
- PR 번호/merge commit
- GitHub Actions check 또는 local substitute evidence
- 최신 `HANDOFF.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md` 설명
- 같은 실패군의 더 최신 자동 재수정 카드 완료 이력

중요:
근거 없이 “아마 끝났을 것”으로 닫지 않습니다.

## 6. 이번 단계에서 하면 안 되는 것

- Kanban DB 직접 수정
- 근거 없는 대량 archive/삭제
- 공유 worktree 강제 청소
- 카드 정리를 핑계로 범위 밖 코드 변경
- secret/production/DNS/유료 리소스 작업

## 7. 문서 반영이 필요하면 어디를 볼지

우선순위:
- `TASKS.md`: 현재 활성 작업/체인 설명
- `HANDOFF.md`: 다음 작업자가 먼저 볼 운영 맥락
- `KNOWN_ISSUES.md`: 자동화 보강 완료 이력 vs 아직 남은 운영 원칙
- `TEST_PLAN.md`: 자동화/정리 작업 재검증 기준
- `QA_CHECKLIST.md`: stale/superseded 정리 전 확인할 체크 추가
- `CHANGELOG.md`: 이번 정리 작업 반영 기록

## 8. 완료 보고에 꼭 들어가야 할 것

- 어떤 scheduled 카드들을 봤는지
- 몇 장을 stale/superseded 로 정리했는지
- 몇 장을 유지했는지
- 유지한 카드의 이유
- 승인 필요 / 판단 유보 카드가 있는지
- 재발 방지로 문서/체크리스트에 무엇을 남겼는지

## 9. 가장 중요한 한 줄

이번 작업의 핵심은 카드를 많이 닫는 것이 아니라, 최신 `main` 기준으로 “어떤 카드가 아직 진짜 일인지”를 안전하게 다시 보이게 만드는 것입니다.