#!/usr/bin/env bash
set -euo pipefail
cd /home/wrhrgw/gw
source ./scripts/gw-hermes-env.sh

MAX="${1:-1}"

echo "그룹웨어 자동화 dispatcher를 실제로 한 번 실행합니다."
echo "최대 실행 개수: ${MAX}"
echo
"$HERMES_BIN" kanban --board groupware dispatch --max "$MAX"
