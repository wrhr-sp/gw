# Groupware blocked remediation event watcher

This directory stores systemd user-unit templates for the groupware Kanban blocked-remediation watcher.

## Goal

Replace minute-by-minute polling with an event-driven inotify watcher:

1. `gw-blocked-remediation-inotify-watch.py` waits on Linux inotify events for the groupware Kanban SQLite files.
2. It filters for `kanban.db`, `kanban.db-wal`, and `kanban.db-shm` close-write/create/move/delete/attrib events.
3. It debounces event bursts, then reads `task_events` through a SQLite read-only URI.
4. It only runs `scripts/gw-blocked-remediation-watch.sh --once --board groupware` when a new `task_events.kind = 'blocked'` event appears.
5. The handler first reads Kanban state through a SQLite read-only URI, so normal no-op checks do not write to `kanban.db` or create a self-trigger loop.
6. If a new safe `blocked` card is found, it uses `hermes kanban` to create a bounded fix → review → verify → recovery chain and dispatch the first card.

## Installed user unit

Copy the template to `/home/werehere/.config/systemd/user/`:

- `gw-blocked-remediation-watch.service`

Then run:

```bash
XDG_RUNTIME_DIR=/run/user/$(id -u) systemctl --user daemon-reload
XDG_RUNTIME_DIR=/run/user/$(id -u) systemctl --user disable --now gw-blocked-remediation-watch.path || true
XDG_RUNTIME_DIR=/run/user/$(id -u) systemctl --user enable --now gw-blocked-remediation-watch.service
```

The service is intentionally event-driven, not a 60-second polling loop.

## Safety rules

- The detector reads `kanban.db` with SQLite `mode=ro` and never writes it directly.
- The inotify daemon baselines historical `task_events` on first start and ignores non-`blocked` events such as heartbeats/comments.
- `hermes kanban` writes are used only when a new remediation chain is actually needed.
- `review-required` remains owned by the review-required gate watcher.
- Secret, production DB/data, DNS/custom domain, paid resources, migrations, and destructive/force operations remain approval-gated.
- Idempotency keys and a state file prevent duplicate remediation-chain creation.
- `EVENT_COOLDOWN_SECONDS=10` still protects the handler from bursty follow-up events after it creates cards.

## Verification

```bash
python3 -m py_compile scripts/gw-blocked-remediation-inotify-watch.py
bash -n scripts/gw-blocked-remediation-watch.sh
scripts/gw-blocked-remediation-watch.sh --once --dry-run --board groupware
XDG_RUNTIME_DIR=/run/user/$(id -u) systemctl --user status gw-blocked-remediation-watch.service
XDG_RUNTIME_DIR=/run/user/$(id -u) journalctl --user -u gw-blocked-remediation-watch.service -n 30 --no-pager
hermes kanban --board groupware stats
```
