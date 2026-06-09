#!/usr/bin/env bash
set -euo pipefail

BOARD="groupware"
MAX_DISPATCH="1"
DRY_RUN="0"
ONLY_TASK=""

cd /home/wrhrgw/gw
source ./scripts/gw-hermes-env.sh

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="1"; shift ;;
    --task) ONLY_TASK="${2:?--task requires task id}"; shift 2 ;;
    --board) BOARD="${2:?--board requires board slug}"; shift 2 ;;
    --max-dispatch) MAX_DISPATCH="${2:?--max-dispatch requires number}"; shift 2 ;;
    -h|--help) sed -n '1,80p' "$0"; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 2 ;;
  esac
done

extract_status() {
  local output="$1" line
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*status:[[:space:]]*([a-z_]+)[[:space:]]*$ ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}"; return 0
    fi
  done <<< "$output"
  printf 'unknown\n'
}

is_review_required() {
  local output="$1"
  [[ "$output" == *"review-required"* ]]
}

list_blocked_task_ids() {
  local output line id status
  output="$($HERMES_BIN kanban --board "$BOARD" list 2>&1)"
  while IFS= read -r line; do
    id=""; status=""
    if [[ "$line" =~ (^|[[:space:]])(t_[0-9a-f]+)[[:space:]]+([a-z_]+)[[:space:]]+ ]]; then
      id="${BASH_REMATCH[2]}"; status="${BASH_REMATCH[3]}"
    fi
    if [[ "$status" == "blocked" ]]; then printf '%s\n' "$id"; fi
  done <<< "$output"
}

run_standard_verification() {
  echo "그룹웨어 표준 검증 후보 실행"
  local ran="0"
  if [[ -f package.json ]]; then
    if command -v pnpm >/dev/null 2>&1; then
      ran="1"
      pnpm test --if-present
      pnpm build --if-present
    elif command -v npm >/dev/null 2>&1; then
      ran="1"
      npm test --if-present
      npm run build --if-present
    fi
  fi
  if [[ -f pyproject.toml || -d tests ]]; then
    if command -v pytest >/dev/null 2>&1; then
      ran="1"
      pytest
    fi
  fi
  if [[ "$ran" == "0" ]]; then
    echo "아직 표준 검증 명령을 찾지 못했습니다. 현재는 검증 명령 없음으로 통과 처리하지 않습니다."
    return 2
  fi
}

handle_task() {
  local task_id="$1" output status result summary
  if ! output="$($HERMES_BIN kanban --board "$BOARD" show "$task_id" 2>&1)"; then
    echo "카드 확인 실패: $task_id"; echo "$output"; return 1
  fi
  status="$(extract_status "$output")"
  if [[ "$status" != "blocked" ]]; then
    echo "건너뜀: $task_id 상태가 blocked가 아님(status=$status)"; return 0
  fi
  if ! is_review_required "$output"; then
    echo "건너뜀: $task_id blocked지만 review-required 신호가 아님"; return 0
  fi
  echo "review-required 감지: $task_id"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "dry-run: 검증/complete/dispatch는 실행하지 않음"; return 0
  fi
  if run_standard_verification; then
    result="자동 게이트 처리: review-required handoff 확인 후 표준 검증 통과. 다음 단계로 넘김."
    summary="review-required 자동 처리 완료. 표준 검증 통과."
    "$HERMES_BIN" kanban --board "$BOARD" complete "$task_id" --result "$result" --summary "$summary"
    "$HERMES_BIN" kanban --board "$BOARD" dispatch --max "$MAX_DISPATCH"
  else
    "$HERMES_BIN" kanban --board "$BOARD" comment "$task_id" "review-required 자동 게이트 검증 미통과 또는 검증 명령 없음. 카드 상태는 blocked로 유지한다."
    return 1
  fi
}

main() {
  local found="0" id
  if [[ -n "$ONLY_TASK" ]]; then handle_task "$ONLY_TASK"; return $?; fi
  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    found="1"; handle_task "$id"
  done < <(list_blocked_task_ids)
  if [[ "$found" == "0" ]]; then echo "처리할 blocked review-required 카드가 없습니다."; fi
}
main
