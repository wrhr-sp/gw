#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/wrhrgw/gw"
BOT_HOME="/home/wrhrgw/gw-dev-bot"
HERMES_HOME="$BOT_HOME/.hermes"
HERMES_BIN="$HERMES_HOME/hermes-agent/venv/bin/hermes"
SINGDE_WRAPPER="$HERMES_HOME/profiles/singde/bin/singde-gateway.py"
LOG_DIR="$ROOT/.hermes/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/groupware-gateway-restart-$(date +%Y%m%d-%H%M%S).log"

export HOME="$BOT_HOME"
export GW_BOT_HOME="$BOT_HOME"
export HERMES_HOME="$HERMES_HOME"
export GW_HERMES_HOME="$HERMES_HOME"
export XDG_CONFIG_HOME="$BOT_HOME/.config"
export XDG_STATE_HOME="$BOT_HOME/.local/state"
export XDG_CACHE_HOME="$BOT_HOME/.cache"
export PATH="/home/werehere/.local/bin:/home/werehere/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin:$PATH"

# Load secrets only into environment; never print them.
if [[ -f "$HERMES_HOME/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$HERMES_HOME/.env"
  set +a
fi

profiles=(gwplanner gwbuilder gwreviewer gwtester gwdocs gwops singde)
if [[ "${1:-}" == "roles-only" ]]; then
  profiles=(gwplanner gwbuilder gwreviewer gwtester gwdocs gwops)
elif [[ "${1:-}" == "singde-only" ]]; then
  profiles=(singde)
elif [[ $# -gt 0 ]]; then
  profiles=("$@")
fi

read_pid() {
  local profile="$1"
  local pid_file="$HERMES_HOME/profiles/$profile/gateway.pid"
  python3 - "$pid_file" <<'PY'
import json, sys
from pathlib import Path
p = Path(sys.argv[1])
if not p.exists():
    sys.exit(0)
try:
    data = json.loads(p.read_text())
    pid = data.get('pid')
except Exception:
    txt = p.read_text().strip()
    pid = int(txt) if txt.isdigit() else None
if pid:
    print(pid)
PY
}

stop_profile() {
  local profile="$1"
  local pid="$(read_pid "$profile" || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "stopping $profile pid=$pid" >> "$LOG_FILE"
    kill -TERM "$pid" 2>/dev/null || true
    for _ in {1..20}; do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 0.25
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "force-stopping $profile pid=$pid" >> "$LOG_FILE"
      kill -KILL "$pid" 2>/dev/null || true
      sleep 0.5
    fi
  else
    echo "no-live-pid $profile" >> "$LOG_FILE"
  fi
}

start_profile() {
  local profile="$1"
  echo "starting $profile" >> "$LOG_FILE"
  if [[ "$profile" == "singde" ]]; then
    if [[ -z "${SINGDE_TELEGRAM_BOT_TOKEN:-}" ]]; then
      echo "missing SINGDE_TELEGRAM_BOT_TOKEN; singde not started" >> "$LOG_FILE"
      return 1
    fi
    setsid "$HERMES_HOME/hermes-agent/venv/bin/python" "$SINGDE_WRAPPER" >> "$LOG_FILE" 2>&1 &
  else
    setsid "$HERMES_BIN" --profile "$profile" gateway run --replace >> "$LOG_FILE" 2>&1 &
  fi
  sleep 1
}

restart_serial_guard() {
  if pgrep -f 'gw-serial-graph-watch.sh' >/dev/null 2>&1; then
    echo "stopping serial graph watchers" >> "$LOG_FILE"
    pkill -TERM -f 'gw-serial-graph-watch.sh' || true
    sleep 1
    pkill -KILL -f 'gw-serial-graph-watch.sh' || true
    sleep 0.5
  fi
  echo "starting serial graph watcher" >> "$LOG_FILE"
  cd "$ROOT"
  setsid "$ROOT/scripts/gw-serial-graph-watch.sh" --interval 60 --board groupware >> "$LOG_FILE" 2>&1 &
}

{
  echo "restart-start $(date -Is) profiles=${profiles[*]}"
  for p in "${profiles[@]}"; do
    stop_profile "$p"
  done
  for p in "${profiles[@]}"; do
    start_profile "$p"
  done
  if [[ " ${profiles[*]} " == *" singde "* || "${1:-}" == "roles-only" ]]; then
    restart_serial_guard || true
  fi
  sleep 3
  echo "gateway-list-after"
  "$HERMES_BIN" gateway list || true
  echo "processes-after"
  ps -eo pid,ppid,user,stat,etime,cmd | grep -E '/home/wrhrgw/gw-dev-bot/.hermes.*(gateway run|singde-gateway.py)|gw-serial-graph-watch.sh' | grep -v grep || true
  echo "restart-end $(date -Is)"
} >> "$LOG_FILE" 2>&1

echo "$LOG_FILE"
