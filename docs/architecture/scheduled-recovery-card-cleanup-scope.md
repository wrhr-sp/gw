# 이전 scheduled 복구 카드 정리 범위

## 한 줄 요약

이 작업은 예전 web build flaky / review-required recovery loop 때문에 남아 있는 scheduled 카드들을 최신 `main` 기준으로 다시 분류해, 이미 끝난 카드와 아직 남겨야 할 카드를 안전하게 구분하는 정리 작업입니다.

## 왜 이 작업을 하나

최근 체인에서 관리자 PWA 품질 개선과 관련 PR/CI/merge/release-gate 흐름은 이미 최신 `main` 에 반영됐습니다.
그런데 과거에 build blocker, recovery loop, 자동 재수정, release cleanup 과정에서 만들어진 scheduled 카드들 중 일부는 지금 기준으로 보면:

- 이미 해결된 이슈를 다시 가리키거나
- 더 최신 카드에 흡수돼 중복이 되었거나
- 당시에는 보류가 맞았지만 지금은 근거가 바뀐 카드일 수 있습니다.

이 상태를 그대로 두면 다음 문제가 생깁니다.

1. 보드에서 아직 해야 하는 일과 이미 끝난 일이 섞여 보입니다.
2. 같은 실패군에 대해 복구 카드가 다시 늘어날 수 있습니다.
3. 다음 작업자가 오래된 blocker 를 최신 blocker 로 오해할 수 있습니다.
4. 자동화/복구 루프의 실제 효과를 평가하기 어렵습니다.

## 이번 범위에 포함하는 것

### 1) stale scheduled 카드 식별

대상은 아래 성격의 예전 카드들입니다.

- web build flaky / `build:cf` blocker 관련 scheduled 카드
- review-required gate 실패 후 파생된 recovery/superseded scheduled 카드
- 같은 실패군에서 자동 재수정 카드가 반복 생성되며 남은 카드
- 이미 merged/main 반영으로 의미가 약해진 release cleanup 후속 카드

### 2) 최신 `main` 기준 재분류

각 카드는 아래 4분류 중 하나로 정리합니다.

#### A. 이미 main 에서 해결됨
조건 예시:
- 관련 PR 이 merge 되었고 최신 `main` 에 반영됨
- 후속 구현/리뷰/테스트 카드가 완료되어 실제 검증 근거가 남아 있음
- 같은 주제의 더 최신 카드가 완료되며 이 카드 목적을 흡수함

처리 원칙:
- “왜 이제 stale 인지” 근거를 코멘트나 summary 로 남긴 뒤 complete / archive 후보로 정리
- 가능한 근거: PR 번호, merge commit, CI/run, 부모/자식 카드 완료 이력, 최신 문서 기준

#### B. 아직 남겨야 하는 카드
조건 예시:
- 최신 `main` 에도 실제 미해결 항목이 남아 있음
- 후속 구현/리뷰/테스트/운영 단계가 아직 끝나지 않음
- 현재 활성 체인과 연결되는 유효한 작업 목적이 남아 있음

처리 원칙:
- 카드 목적을 최신 범위에 맞게 좁혀 설명
- 중복 카드가 있으면 기준 카드 1장만 남기고 나머지는 superseded 로 정리
- 남길 카드에는 “무엇이 아직 미완료인지”를 짧게 다시 적음

#### C. restricted / 승인 필요
조건 예시:
- secret, production, DNS/custom domain, 유료 리소스, destructive cleanup 이 실제로 필요함
- 근거 없이 대량 정리를 해야만 닫을 수 있음

처리 원칙:
- 자동으로 닫지 않음
- blocked 또는 scheduled 상태 유지 + 승인 필요 이유 명시

#### D. 근거 부족 / 판단 유보
조건 예시:
- 최신 증거가 부족해 해결/미해결 판단이 애매함
- 카드 설명과 실제 변경 이력이 어긋나 원인 재구성이 먼저 필요함

처리 원칙:
- 억지로 닫지 않음
- singde 가 원본 카드/runs/log/변경 파일을 다시 확인할 수 있게 메모 남김

## 이번 범위에 포함하지 않는 것

- Kanban DB 직접 수정
- `reset --hard`, `git clean -fd` 같은 공유 worktree 파괴적 정리
- production/secret/DNS/custom domain/유료 리소스 작업
- 근거 없는 대량 archive/삭제
- 카드 정리를 핑계로 범위 밖 코드 리팩토링 수행

## 판단 기준으로 우선 볼 근거

1. 해당 카드의 부모/자식 체인 완료 여부
2. 최신 `main` merge 상태와 PR 이력
3. 최신 검증 근거
   - `pnpm check`
   - `pnpm --filter @gw/web build`
   - `pnpm --filter @gw/web build:cf`
   - 관련 test/typecheck 결과
4. `HANDOFF.md`, `KNOWN_ISSUES.md`, `CHANGELOG.md` 의 최신 설명
5. 같은 실패군에서 이미 완료된 더 최신 복구 카드/자동 재수정 카드

## 구현자에게 기대하는 최소 산출물

- stale scheduled 카드 목록과 분류표
- 각 카드별 처리 사유 요약
- “남길 기준 카드”와 “정리할 중복 카드” 구분
- 재발 방지용 체크리스트 또는 운영 메모 반영
- 필요하면 PR/CI/merge/release-gate 근거 링크 또는 식별자 기록

## 성공 기준

이번 정리가 끝나면 최소한 아래가 맞아야 합니다.

1. scheduled 카드 중 무엇이 아직 유효한지 한눈에 구분됩니다.
2. 이미 main 에서 해결된 카드가 계속 살아 있어 혼동을 만들지 않습니다.
3. 같은 실패군 복구 카드가 여러 장 겹쳐 남지 않습니다.
4. restricted / 승인 필요 항목은 자동 정리 대신 별도 게이트로 남습니다.
5. 다음 작업자가 “왜 이 카드를 남겼는지/닫았는지”를 카드 근거만 보고 따라갈 수 있습니다.

## 다음 단계 한 줄 지시

구현 단계에서는 먼저 예전 scheduled 카드들을 목록화하고, 각 카드를 최신 `main` 근거에 대조한 뒤, 기준 카드 1장만 남기는 방향으로 안전하게 정리하세요.