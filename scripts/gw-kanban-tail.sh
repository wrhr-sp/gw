#!/usr/bin/env bash
set -euo pipefail
cd /home/wrhrgw/gw
source ./scripts/gw-hermes-env.sh
if [[ $# -lt 1 ]]; then echo "usage: $0 <task_id>" >&2; exit 2; fi
"$HERMES_BIN" kanban --board groupware tail "$1"
