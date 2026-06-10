#!/usr/bin/env bash
set -euo pipefail
DELAY_SECONDS="${1:-8}"
LOG="/tmp/singde-force-restart-recover.log"
SERVICE="hermes-gateway-singde.service"
ROOT="/home/wrhrgw/gw"
HERMES_HOME_DIR="/home/wrhrgw/gw-dev-bot/.hermes"
HERMES_BIN="/home/wrhrgw/gw-dev-bot/.hermes/hermes-agent/venv/bin/hermes"
PROFILE="singde"
BOARD="groupware"
{
  echo "[$(date -Is)] scheduled FORCE restart recovery delay=${DELAY_SECONDS}s"
  sleep "$DELAY_SECONDS"
  cd "$ROOT"
  export HERMES_HOME="$HERMES_HOME_DIR"
  export HOME="/home/wrhrgw/gw-dev-bot"
  export XDG_CONFIG_HOME="/home/wrhrgw/gw-dev-bot/.config"
  export XDG_STATE_HOME="/home/wrhrgw/gw-dev-bot/.local/state"
  export XDG_CACHE_HOME="/home/wrhrgw/gw-dev-bot/.cache"
  old_pid="$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null || true)"
  echo "[$(date -Is)] before_force_restart old_pid=${old_pid:-unknown} active=$(systemctl is-active "$SERVICE" 2>/dev/null || true)"
  "$HERMES_BIN" --profile "$PROFILE" kanban --board "$BOARD" list --json > /tmp/singde-force-pre-list.json || true
  python3 - <<'PY' >/tmp/singde-force-pre-running.txt || true
import json
try: items=json.load(open('/tmp/singde-force-pre-list.json'))
except Exception: items=[]
for x in items:
    if x.get('status')=='running': print(x.get('id'))
PY
  if [[ -n "${old_pid:-}" && "$old_pid" != "0" ]]; then
    kill -KILL "$old_pid" || true
    echo "[$(date -Is)] sent KILL to pid=$old_pid"
  fi
  for i in {1..60}; do
    sleep 1
    active="$(systemctl is-active "$SERVICE" 2>/dev/null || true)"
    new_pid="$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null || true)"
    if [[ "$active" == "active" && -n "${new_pid:-}" && "$new_pid" != "0" && "$new_pid" != "${old_pid:-}" ]]; then
      echo "[$(date -Is)] restarted active new_pid=$new_pid"
      break
    fi
    [[ "$i" == "60" ]] && echo "[$(date -Is)] force restart wait timeout active=$active new_pid=${new_pid:-unknown}"
  done
  sleep 6
  if [[ -s /tmp/singde-force-pre-running.txt ]]; then
    while read -r tid; do
      [[ -z "$tid" ]] && continue
      status="$($HERMES_BIN --profile "$PROFILE" kanban --board "$BOARD" show "$tid" 2>/dev/null | awk '/status:/ {print $2; exit}' || true)"
      echo "[$(date -Is)] pre-running task $tid current_status=${status:-unknown}"
      if [[ "$status" == "running" ]]; then
        "$HERMES_BIN" --profile "$PROFILE" kanban --board "$BOARD" reclaim "$tid" --reason "system-level singde gateway force-restart recovery" || true
      fi
    done < /tmp/singde-force-pre-running.txt
  fi
  "$HERMES_BIN" --profile "$PROFILE" kanban --board "$BOARD" dispatch --max 3 || true
  "$HERMES_BIN" --profile "$PROFILE" kanban --board "$BOARD" list --json > /tmp/singde-force-post-list.json || true
  python3 - <<'PY' || true
import json
from collections import Counter
try: items=json.load(open('/tmp/singde-force-post-list.json'))
except Exception as e:
    print('post-list-error', e); raise SystemExit
print('post_counts', dict(Counter(x.get('status') for x in items)))
for x in items:
    if x.get('status') in {'blocked','running','ready'}:
        print(x.get('id'), x.get('status'), x.get('assignee'), x.get('title'))
PY
  echo "[$(date -Is)] force restart recovery done"
} >> "$LOG" 2>&1
