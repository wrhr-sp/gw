#!/usr/bin/env bash
set -euo pipefail
cd /home/wrhrgw/gw
source ./scripts/gw-hermes-env.sh

MAX="${1:-3}"

echo "그룹웨어 자동화 dispatcher dry-run 확인"
echo "최대 확인 개수: ${MAX}"
echo
"$HERMES_BIN" kanban --board groupware dispatch --dry-run --max "$MAX"
