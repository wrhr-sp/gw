#!/usr/bin/env bash
# 그룹웨어 스크립트는 OTA/eora 세션 환경에서 호출되어도 반드시 그룹웨어 Hermes 홈을 사용한다.
export GW_BOT_HOME="/home/wrhrgw/gw-dev-bot"
export HERMES_HOME="$GW_BOT_HOME/.hermes"
export HERMES_BIN="$GW_BOT_HOME/.hermes/hermes-agent/venv/bin/hermes"
export HOME="$GW_BOT_HOME"
export XDG_CONFIG_HOME="$GW_BOT_HOME/.config"
export XDG_STATE_HOME="$GW_BOT_HOME/.local/state"
export XDG_CACHE_HOME="$GW_BOT_HOME/.cache"
export HERMES_PROFILE="${GW_HERMES_PROFILE:-singde}"
export HERMES_KANBAN_BOARD="${GW_KANBAN_BOARD:-groupware}"
