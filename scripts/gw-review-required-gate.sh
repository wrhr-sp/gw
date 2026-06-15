#!/usr/bin/env bash
set -euo pipefail

# 그룹웨어 review-required 자동 게이트 처리 스크립트
#
# 목적:
# - worker가 구현/문서/리뷰 결과를 남기고 `review-required` 이유로 blocked 처리한 경우,
#   이를 실패가 아니라 내부 handoff 신호로 본다.
# - 표준 검증 명령이 통과하면 해당 카드를 complete 처리하고 다음 Kanban 단계를 dispatch한다.
# - 검증 실패 시 카드는 blocked 상태로 두고 실패 원인을 comment로 남긴다.
#
# 사용법:
#   ./scripts/gw-review-required-gate.sh
#   ./scripts/gw-review-required-gate.sh --dry-run
#   ./scripts/gw-review-required-gate.sh --task t_xxxxxxxx
#
# 주의:
# - 외부 배포/DB migration/secret 출력은 하지 않는다.
# - /home/wrhrgw/gw 프로젝트의 로컬 검증 명령만 실행한다.

BOARD="groupware"
WORKDIR="/home/wrhrgw/gw"
MAX_DISPATCH="1"
DRY_RUN="0"
ONLY_TASK=""
KANBAN_LOCK="${KANBAN_LOCK:-/home/wrhrgw/gw/.hermes/locks/gw-kanban.lock}"
WEB_BUILD_LOCK="${WEB_BUILD_LOCK:-/home/wrhrgw/gw/.hermes/locks/gw-web-build.lock}"

export HERMES_HOME="${HERMES_HOME:-/home/wrhrgw/gw-dev-bot/.hermes}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN="1"
      shift
      ;;
    --task)
      ONLY_TASK="${2:?--task requires task id}"
      shift 2
      ;;
    --board)
      BOARD="${2:?--board requires board slug}"
      shift 2
      ;;
    --max-dispatch)
      MAX_DISPATCH="${2:?--max-dispatch requires number}"
      shift 2
      ;;
    -h|--help)
      sed -n '1,45p' "$0"
      exit 0
      ;;
    *)
      echo "알 수 없는 옵션: $1" >&2
      exit 2
      ;;
  esac
done

cd "$WORKDIR"
source ./scripts/gw-hermes-env.sh
mkdir -p "$(dirname "$KANBAN_LOCK")"

is_corrupt_kanban_error() {
  local text="${1,,}"
  [[ "$text" == *"database disk image is malformed"* \
    || "$text" == *"file is not a database"* \
    || "$text" == *"disk i/o error"* \
    || "$text" == *"refusing to open corrupt kanban db"* ]]
}

kanban_call() {
  flock "$KANBAN_LOCK" "$HERMES_BIN" kanban --board "$BOARD" "$@"
}

extract_status() {
  local output="$1"
  local line
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*status:[[:space:]]*([a-z_]+)[[:space:]]*$ ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}"
      return 0
    fi
  done <<< "$output"
  printf 'unknown\n'
}

extract_assignee() {
  local output="$1"
  local line
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*assignee:[[:space:]]*([^[:space:]]+)[[:space:]]*$ ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}"
      return 0
    fi
  done <<< "$output"
  printf 'unknown\n'
}

is_review_required() {
  local output="$1"
  # Body 전체를 grep하면 "review-required로 막지 말라" 같은 지시문까지 오탐한다.
  # show 출력에서 worker가 남긴 Latest summary와 Runs의 차단 사유만 선별한다.
  SHOW_OUTPUT="$output" python3 - <<'PY'
import os
import re
import sys

text = os.environ.get("SHOW_OUTPUT", "")
chunks = []

latest = re.search(
    r"Latest summary:\n(?P<body>.*?)(?:\n\n(?:Comments|Events|Runs|Result|Body):|\Z)",
    text,
    flags=re.S,
)
if latest:
    chunks.append(latest.group("body"))

# Runs 영역의 "→ ..." 사유는 worker block reason/result에 가깝고, 카드 Body보다 오탐 위험이 낮다.
runs = re.search(r"Runs \(.*?\):\n(?P<body>.*)\Z", text, flags=re.S)
if runs:
    chunks.append(runs.group("body"))

signal = "\n".join(chunks).lower()
sys.exit(0 if "review-required" in signal else 1)
PY
}

list_blocked_task_ids() {
  local json_output
  if ! json_output="$(kanban_call list --json 2>&1)"; then
    echo "$json_output" >&2
    if is_corrupt_kanban_error "$json_output"; then
      echo "kanban-corrupt-circuit-breaker" >&2
      return 75
    fi
    return 2
  fi
  local json_file
  json_file="$(mktemp)"
  printf '%s' "$json_output" > "$json_file"
  python3 - "$json_file" <<'PY'
import json
import sys
from pathlib import Path
json_file = Path(sys.argv[1])
try:
    tasks = json.loads(json_file.read_text() or "[]")
finally:
    try:
        json_file.unlink()
    except FileNotFoundError:
        pass
for task in tasks:
    if task.get("status") == "blocked":
        print(task.get("id"))
PY
}

run_standard_verification() {
  echo "표준 검증 실행: shared test/typecheck → api test/typecheck → web test/typecheck/build → workspace check"
  # 이 함수는 if 조건 파이프라인 안에서 실행되므로 bash errexit만 믿으면 안 된다.
  # 각 명령 실패를 즉시 return해야 gate가 실패를 성공으로 오판하지 않는다.
  run_step() {
    echo "$ $*"
    "$@" || return 1
  }
  run_step pnpm --filter @gw/shared test || return 1
  run_step pnpm --filter @gw/shared typecheck || return 1
  run_step pnpm --filter @gw/api test || return 1
  run_step pnpm --filter @gw/api typecheck || return 1
  run_step pnpm --filter @gw/web test || return 1
  echo "web 검증 lock 대기: $WEB_BUILD_LOCK"
  flock "$WEB_BUILD_LOCK" bash -lc '
    set -euo pipefail
    export GW_WEB_BUILD_LOCK_HELD=1
    echo "$ pnpm --filter @gw/web typecheck"
    pnpm --filter @gw/web typecheck
    echo "$ rm -rf apps/web/.next apps/web/.open-next"
    rm -rf apps/web/.next apps/web/.open-next
    echo "$ pnpm --filter @gw/web build"
    pnpm --filter @gw/web build
    echo "$ pnpm check"
    pnpm check
  ' || return 1
}

handle_task() {
  local task_id="$1"
  local output status assignee result summary

  if ! output="$(kanban_call show "$task_id" 2>&1)"; then
    echo "카드 확인 실패: $task_id"
    echo "$output"
    if is_corrupt_kanban_error "$output"; then
      echo "kanban-corrupt-circuit-breaker" >&2
      return 75
    fi
    return 1
  fi

  status="$(extract_status "$output")"
  assignee="$(extract_assignee "$output")"

  if [[ "$status" != "blocked" ]]; then
    echo "건너뜀: $task_id 상태가 blocked가 아님(status=$status)"
    return 0
  fi

  if ! is_review_required "$output"; then
    echo "건너뜀: $task_id 는 blocked지만 Latest summary/Runs에 review-required 신호가 없음"
    return 0
  fi

  echo "review-required 감지: $task_id / assignee=$assignee"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "dry-run: 검증/complete/dispatch는 실행하지 않음"
    return 0
  fi

  local verify_log
  verify_log="$(mktemp "$WORKDIR/.hermes/review-required-gate.XXXXXX.log")"
  if run_standard_verification 2>&1 | tee "$verify_log"; then
    result="자동 게이트 처리: review-required handoff 확인 후 표준 검증 통과. 다음 단계로 넘김."
    summary="review-required 자동 처리 완료. 검증 통과: pnpm --filter @gw/shared test/typecheck, pnpm --filter @gw/api test/typecheck, pnpm --filter @gw/web test/typecheck/build, pnpm check."
    kanban_call complete "$task_id" \
      --result "$result" \
      --summary "$summary"
    echo "완료 처리됨: $task_id"
    if rewire_output="$(./scripts/gw-late-blocking-fix-rewire.sh --task "$task_id" 2>&1)"; then
      echo "$rewire_output"
    else
      rewire_rc=$?
      echo "$rewire_output"
      if [[ "$rewire_rc" -ne 0 ]]; then
        echo "late blocking fix 재배선 보강은 실패했지만 review-required complete 는 유지하고 dispatch 를 계속 시도합니다." >&2
      fi
    fi
    echo "다음 카드 dispatch 실행(max=$MAX_DISPATCH)"
    dispatch_output="$(kanban_call dispatch --max "$MAX_DISPATCH" 2>&1)" || {
      echo "$dispatch_output"
      if is_corrupt_kanban_error "$dispatch_output"; then
        echo "kanban-corrupt-circuit-breaker" >&2
        return 75
      fi
      return 1
    }
    echo "$dispatch_output"
  else
    echo "검증 실패: $task_id 는 blocked 상태 유지, 자동 재루프 생성 시도"
    local fail_state_dir fail_state_file fail_log
    fail_state_dir="$WORKDIR/.hermes/review-required-gate-failures"
    mkdir -p "$fail_state_dir"
    fail_state_file="$fail_state_dir/$task_id.state"
    fail_log="$fail_state_dir/$task_id.latest.log"
    cp "$verify_log" "$fail_log"
    if ./scripts/gw-review-required-recovery-loop.sh --task "$task_id" --board "$BOARD" --failure-log "$fail_log" --max-dispatch "$MAX_DISPATCH"; then
      if [[ ! -f "$fail_state_file" ]]; then
        kanban_call comment "$task_id" \
          "review-required 자동 게이트 검증 실패: 표준 검증 명령 중 하나가 실패해 원본 카드는 blocked로 유지하고, 자동 재수정→재리뷰→재검증→싱드 복구 정리 루프를 생성/dispatch했다."
        date '+%F %T' > "$fail_state_file"
      else
        echo "검증 실패 댓글은 이미 남김: $task_id"
      fi
      echo "자동 재루프 생성/dispatch 완료: $task_id"
      return 0
    fi
    if [[ ! -f "$fail_state_file" ]]; then
      kanban_call comment "$task_id" \
        "review-required 자동 게이트 검증 실패: 표준 검증 명령 중 하나가 실패했고 자동 재루프 생성도 실패했다. 카드 상태는 blocked로 유지한다. 같은 막힘은 중복 댓글로 반복하지 않는다."
      date '+%F %T' > "$fail_state_file"
    else
      echo "검증 실패 댓글은 이미 남김: $task_id"
    fi
    return 1
  fi
}

main() {
  local found="0" id

  if [[ -n "$ONLY_TASK" ]]; then
    handle_task "$ONLY_TASK"
    return $?
  fi

  local ids_output rc
  if ids_output="$(list_blocked_task_ids)"; then
    rc=0
  else
    rc=$?
    return "$rc"
  fi

  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    found="1"
    handle_task "$id"
  done <<< "$ids_output"

  if [[ "$found" == "0" ]]; then
    echo "처리할 blocked review-required 카드가 없습니다."
  fi
}

main
