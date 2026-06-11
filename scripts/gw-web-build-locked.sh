#!/usr/bin/env bash
set -euo pipefail

# Serializes commands that read/write apps/web/.next or .open-next.
# This prevents same-worktree Kanban workers from deleting/regenerating Next.js
# build artifacts while another worker is typechecking/building.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${GW_ROOT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
LOCK_FILE="${GW_WEB_BUILD_LOCK:-$ROOT_DIR/.hermes/locks/gw-web-build.lock}"
mkdir -p "$(dirname "$LOCK_FILE")"
cd "$ROOT_DIR/apps/web"
if [[ $# -eq 0 ]]; then
  echo "usage: $0 <command> [args...]" >&2
  exit 2
fi

# Re-entrant guard: some orchestration scripts already hold the same lock
# while invoking package scripts that call this wrapper. A second flock from a
# child process would deadlock, so skip re-locking when the parent exported the
# marker inside the locked section.
if [[ "${GW_WEB_BUILD_LOCK_HELD:-0}" == "1" ]]; then
  exec "$@"
fi

exec env GW_WEB_BUILD_LOCK_HELD=1 flock "$LOCK_FILE" "$@"
