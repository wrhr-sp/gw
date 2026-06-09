#!/usr/bin/env bash
set -euo pipefail
cd /home/wrhrgw/gw
source ./scripts/gw-hermes-env.sh
"$HERMES_BIN" kanban --board groupware dispatch --max 1
