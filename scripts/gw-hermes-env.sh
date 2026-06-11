#!/usr/bin/env bash
# 그룹웨어 자동화 스크립트 공통 Hermes 실행 환경.
# 다른 봇/서비스 환경에서 실행되어도 그룹웨어 bot home과 Singde 기본 profile을 고정한다.

export GW_BOT_HOME="${GW_BOT_HOME:-/home/wrhrgw/gw-dev-bot}"
export HERMES_HOME="${GW_HERMES_HOME:-$GW_BOT_HOME/.hermes}"
export HERMES_PROFILE="${GW_HERMES_PROFILE:-singde}"
export HERMES_KANBAN_BOARD="${GW_KANBAN_BOARD:-groupware}"
export HOME="$GW_BOT_HOME"
export XDG_CONFIG_HOME="$GW_BOT_HOME/.config"
export XDG_STATE_HOME="$GW_BOT_HOME/.local/state"
export XDG_CACHE_HOME="$GW_BOT_HOME/.cache"

# systemd user services run with a small PATH. Keep project toolchain commands
# such as pnpm/node available for review-required gates and local checks.
# HOME is repointed to the bot home above, so derive the real login home from passwd.
GW_LOGIN_HOME="${GW_LOGIN_HOME:-$(getent passwd "$(id -un)" | cut -d: -f6)}"
for gw_path_entry in \
  "$GW_LOGIN_HOME/.local/bin" \
  "$GW_LOGIN_HOME/.local/share/pnpm" \
  "/usr/local/bin" \
  "/usr/bin" \
  "/bin"; do
  if [[ -d "$gw_path_entry" && ":$PATH:" != *":$gw_path_entry:"* ]]; then
    export PATH="$gw_path_entry:$PATH"
  fi
done
export GW_LOGIN_HOME

if [[ -n "${HERMES_BIN:-}" && -x "$HERMES_BIN" ]]; then
  :
elif command -v gw-hermes >/dev/null 2>&1; then
  HERMES_BIN="$(command -v gw-hermes)"
elif [[ -x "$GW_BOT_HOME/.hermes/hermes-agent/venv/bin/hermes" ]]; then
  HERMES_BIN="$GW_BOT_HOME/.hermes/hermes-agent/venv/bin/hermes"
elif command -v hermes >/dev/null 2>&1; then
  HERMES_BIN="$(command -v hermes)"
else
  echo "Hermes 실행 파일을 찾지 못했습니다. HERMES_BIN을 지정하세요." >&2
  exit 127
fi

export HERMES_BIN
