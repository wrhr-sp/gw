#!/usr/bin/env bash
set -euo pipefail
cd /home/wrhrgw/gw
source ./scripts/gw-hermes-env.sh

echo "현재 그룹웨어 자동화 보드 상태"
echo
"$HERMES_BIN" kanban --board groupware stats || true
echo
echo "작업 목록"
"$HERMES_BIN" kanban --board groupware list || true
