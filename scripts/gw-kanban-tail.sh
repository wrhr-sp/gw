#!/usr/bin/env bash
set -euo pipefail
cd /home/wrhrgw/gw
source ./scripts/gw-hermes-env.sh

if [ "$#" -lt 1 ]; then
  echo "사용법: $(basename "$0") <task_id>" >&2
  echo "예: $(basename "$0") t_abc123" >&2
  exit 1
fi

"$HERMES_BIN" kanban --board groupware tail "$1"
