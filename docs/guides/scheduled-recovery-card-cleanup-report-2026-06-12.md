# Scheduled 복구 카드 정리 보고서 (2026-06-12)

## 한 줄 요약

예전 web build flaky / review-required recovery loop / attendance policy shared helper 재수정 체인에서 남아 있던 scheduled 카드 14장을 다시 확인한 결과, 현재 기준으로는 유지해야 할 scheduled 카드가 없고 모두 stale 또는 superseded 정리 후보로 보는 것이 안전하다.

## 이번 보고서 목적

- 예전 scheduled 복구 카드가 아직도 실제 미해결 작업인지 확인한다.
- 최신 완료 카드, 현재 workspace 상태, 실제 재검증 결과를 같이 대조한다.
- Kanban 상태 변경 전에 싱드가 바로 사용할 수 있는 근거표를 남긴다.

## 확인에 사용한 근거

1. Kanban board 전체 JSON 덤프: `/tmp/groupware_kanban_list.json`
2. 카드 상세 확인:
   - `t_7f611516` done
   - `t_d8354e91` done
   - `t_f4ef8061` done
   - `t_dc4f7a4c` done
   - scheduled 후속 카드들 본문/상태/댓글 확인
3. 현재 저장소 재검증 (`/home/wrhrgw/gw`)
   - `pnpm --filter @gw/web test` 통과 (9 files, 47 tests)
   - `pnpm --filter @gw/web typecheck` 통과
   - `pnpm --filter @gw/web build` 통과
   - `pnpm check` 통과
4. 부모 카드 최신 재검증 근거
   - `pnpm --filter @gw/web build:cf` 통과
   - local `pnpm --filter @gw/web preview:cf` smoke 통과
   - smoke 결과: `/`, `/login`, `/boards`, `/documents`, `/manifest.webmanifest` => 200, `/admin`, `/admin/users`, `/admin/policies`, `/admin/audit-logs` => 307 `/login`, `/api/health` => 200 JSON, `/api/me` => 401 JSON
5. 현재 파일 상태 확인
   - `apps/web/build-cache-targets.mjs` 없음
   - `apps/web/scripts/clean-next-build.mjs` 있음
6. 중복 루프 보류 코멘트 확인
   - 여러 scheduled 카드에 `[singde-overgrowth-guard]` 코멘트가 남아 있으며, 같은 shared worktree에서 중복 builder 루프를 더 돌리지 말라는 의도가 분명함.

## 핵심 판단 기준

- 최신 완료 카드가 이미 같은 목적을 흡수했고 현재 검증도 통과하면 `stale/superseded` 후보로 본다.
- 같은 실패군에서 builder/reviewer/tester/singde 후속 카드가 연쇄로 남아 있어도, 기준 카드가 이미 done이고 현재 재현도 되지 않으면 유지하지 않는다.
- 현재 재현 여부를 볼 때는 가능하면 `pnpm check`와 관련 test/typecheck/build뿐 아니라 `build:cf`, local `preview:cf` smoke 같이 더 최신 배포 경계 근거도 함께 본다.
- restricted 항목(secret, production DB, DNS/custom domain, 유료 리소스, destructive cleanup)은 이번 판단 범위에 없었다.

## 카드별 분류 표

| 카드 | 현재 상태 | 분류 | 근거 |
|---|---|---|---|
| `t_520f3e3c` | scheduled | stale/superseded | `t_7f611516` 완료 이후 현재 `pnpm --filter @gw/web test/typecheck/build`, `pnpm check` 모두 통과. 카드 자체에도 `[singde-overgrowth-guard]` 로 중복 루프 보류 코멘트가 있음. |
| `t_ec7deb89` | scheduled | stale/superseded | 과거 `_not-found/page.js.nft.json` ENOENT 재현 카드였지만 현재 web build 통과. `t_7f611516` 완료와 현재 검증이 더 최신 근거. |
| `t_44694037` | scheduled | stale/superseded | 과거 adminPolicyPreview/build 회귀 재정리 카드. parent `t_540fcd2a`는 이미 done이고, 현재 web test/typecheck/build 모두 통과. 중복 builder 루프 보류 코멘트 존재. |
| `t_de984d19` | scheduled | stale/superseded | `t_44694037`의 reviewer 후속. 부모 builder 카드 목적 자체가 최신 기준에서 해소되어 reviewer 단독 유지 이유가 없음. |
| `t_888d09b6` | scheduled | stale/superseded | `t_44694037`의 tester 후속. 현재 실검증이 이미 통과했고, 더 최신 완료 카드가 존재. |
| `t_8fdf6dd1` | scheduled | stale/superseded | 원본 `t_f4ef8061`은 done. 현재 workspace에는 `apps/web/build-cache-targets.mjs` 자체가 없고, 당시 전제와 현재 상태가 달라졌다. 현재 web test/typecheck/build 통과. |
| `t_cd421ed1` | scheduled | stale/superseded | `t_8fdf6dd1`의 singde 정리 후속. 원본 `t_f4ef8061` done + 현재 검증 통과로 별도 복구 정리 카드 유지 필요가 없다. |
| `t_eee44368` | scheduled | stale/superseded | 원본 `t_dc4f7a4c`가 done이고 shared helper/fixture 관련 수정은 이미 흡수됨. 현재 `pnpm check` 통과로 후속 reviewer 카드 유지 이유가 약하다. |
| `t_0a21375c` | scheduled | stale/superseded | `t_eee44368` 뒤 tester 후속. 현재 shared/api/web 전체 검증이 통과하므로 예전 재검증 카드 단독 유지 필요가 없다. |
| `t_a3de6489` | scheduled | stale/superseded | body 자체가 `t_0a21375c` 결과 기준 정리 카드인데, 지금은 `t_dc4f7a4c` 및 관련 최신 검증으로 이미 판단 가능하다. |
| `t_2bf6c254` | scheduled | stale/superseded | `t_dc4f7a4c`와 같은 실패군의 중복 builder 루프. singde 코멘트상 새 체인을 더 만들지 말아야 하는 상황과도 충돌. |
| `t_7b0de503` | scheduled | stale/superseded | `t_2bf6c254`의 reviewer 후속. 부모 중복 루프가 stale이므로 같이 정리 후보. |
| `t_74652858` | scheduled | stale/superseded | `t_2bf6c254`의 tester 후속. 현재 `pnpm check` 통과로 목적 흡수. |
| `t_e25d32ae` | scheduled | stale/superseded | `t_2bf6c254` 체인의 singde 정리 카드. 원본 목적이 이미 `t_dc4f7a4c` 완료와 현재 검증으로 해소됨. |

## 이번 판단에서 기준으로 본 완료 카드

- `t_7f611516` done
  - 결과: `pnpm --filter @gw/shared test/typecheck`, `pnpm --filter @gw/api test/typecheck`, `pnpm --filter @gw/web test/typecheck/build`, `pnpm check` 통과
- `t_d8354e91` done
  - web typecheck/build 회귀 복구 완료 기록 존재
- `t_f4ef8061` done
  - build-cache-targets.mjs import 정리 및 web test/typecheck/build 통과 기록 존재
- `t_dc4f7a4c` done
  - attendance policy pass2 shared helper/fixture 수정 후 표준 검증 통과 기록 존재

## 유지 대상으로 남길 것이 없는 이유

1. 예전 scheduled 카드들이 가리키던 오류가 현재 실검증에서 다시 나오지 않았다.
2. 원본/기준 카드가 이미 done 상태이고, 더 최신 완료 카드가 같은 목적을 흡수했다.
3. 여러 카드에 남은 `[singde-overgrowth-guard]` 코멘트는 “같은 shared worktree에서 중복 builder 루프를 더 키우지 말라”는 운영 판단을 이미 남기고 있다.
4. 현재 workspace 파일 구성이 일부 카드 본문 전제와 다르다. 예를 들어 `apps/web/build-cache-targets.mjs`는 현재 없는데, 그 파일을 전제로 한 scheduled 재검증 카드는 최신 상태를 반영하지 못한다.

## 대장/싱드가 바로 쓸 수 있는 정리 제안

- 유지 대상 scheduled 카드: 없음
- 정리 대상 scheduled 카드: 위 표의 14장 전부
- 정리 방식: singde가 각 카드에 짧은 근거 댓글을 남긴 뒤 stale/superseded/resolved 성격으로 닫는 방식 권장
- 주의: Kanban DB 직접 수정, 대량 삭제, restricted 항목 처리 없이 카드 상태 정리만 수행

## 남은 불확실성

- 현재 repo는 `HEAD (no branch)` 상태이며 여러 문서 변경이 이미 dirty 상태다. 이번 판단은 branch 정리 여부가 아니라 scheduled 카드 유효성 판단에만 한정했다.
- `build:cf` 와 local `preview:cf` smoke 는 부모 카드 최신 재검증 근거를 사용했다. 이번 문서 카드는 그 근거를 scheduled 카드 생존 여부 판단에 연결하는 정리 작업으로 한정했다.

## 다음 액션 제안

1. singde가 위 14장에 대해 stale/superseded 정리 코멘트를 남긴다.
2. reviewer는 이 보고서와 현재 검증 로그를 기준으로 구현 카드 `t_b8ae373f` 산출물이 충분한지 확인한다.
3. 필요하면 최종 통합 보고에서 “예전 scheduled 복구 카드 정리 완료, 유지 카드 없음”만 짧게 사용자에게 전달한다.
