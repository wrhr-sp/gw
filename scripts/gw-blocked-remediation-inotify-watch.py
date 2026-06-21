#!/usr/bin/env python3
"""Event-driven groupware Kanban blocked-remediation watcher.

Uses Linux inotify via ctypes so it does not need the inotify-tools package.
It wakes on SQLite DB close-write/create/move events, debounces the burst,
runs the bounded remediation handler when a blocked event appears, and also
performs a low-frequency sweep so resolved stale blockers are not left until
a human asks for status.
"""
from __future__ import annotations

import argparse
import ctypes
import ctypes.util
import json
import os
import select
import sqlite3
import struct
import subprocess
import sys
import time
from pathlib import Path

IN_CLOSE_WRITE = 0x00000008
IN_MOVED_TO = 0x00000080
IN_CREATE = 0x00000100
IN_DELETE = 0x00000200
IN_ATTRIB = 0x00000004
IN_Q_OVERFLOW = 0x00004000
IN_IGNORED = 0x00008000
WATCH_MASK = IN_CLOSE_WRITE | IN_MOVED_TO | IN_CREATE | IN_DELETE | IN_ATTRIB
WATCH_NAMES = {"kanban.db", "kanban.db-wal", "kanban.db-shm"}


def load_libc() -> ctypes.CDLL:
    path = ctypes.util.find_library("c")
    if not path:
        raise RuntimeError("libc not found")
    libc = ctypes.CDLL(path, use_errno=True)
    libc.inotify_init1.argtypes = [ctypes.c_int]
    libc.inotify_init1.restype = ctypes.c_int
    libc.inotify_add_watch.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_uint32]
    libc.inotify_add_watch.restype = ctypes.c_int
    return libc


def add_watch(libc: ctypes.CDLL, fd: int, path: Path, mask: int) -> int:
    wd = libc.inotify_add_watch(fd, os.fsencode(path), mask)
    if wd < 0:
        err = ctypes.get_errno()
        raise OSError(err, f"inotify_add_watch failed for {path}: {os.strerror(err)}")
    return wd


def iter_events(buf: bytes):
    offset = 0
    header = struct.Struct("iIII")
    while offset + header.size <= len(buf):
        wd, mask, cookie, length = header.unpack_from(buf, offset)
        offset += header.size
        raw = buf[offset : offset + length]
        offset += length
        name = raw.split(b"\0", 1)[0].decode(errors="ignore") if raw else ""
        yield wd, mask, cookie, name



def load_event_state(path: Path, db_path: Path) -> dict:
    if path.exists():
        try:
            data = json.loads(path.read_text())
            data.setdefault("last_event_id", 0)
            return data
        except Exception:
            pass
    # Baseline historical events on first start. This avoids creating chains for old blocked cards.
    last = latest_event_id(db_path)
    data = {"last_event_id": last, "created_at": int(time.time())}
    save_event_state(path, data)
    return data


def save_event_state(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    tmp.replace(path)


def latest_event_id(db_path: Path) -> int:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        row = con.execute("select coalesce(max(id), 0) from task_events").fetchone()
        return int(row[0] or 0)
    finally:
        con.close()


def has_new_blocked_event(db_path: Path, state_path: Path) -> bool:
    state = load_event_state(state_path, db_path)
    last_seen = int(state.get("last_event_id") or 0)
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        rows = con.execute(
            "select id, task_id, kind, payload from task_events where id > ? order by id asc",
            (last_seen,),
        ).fetchall()
    finally:
        con.close()
    if not rows:
        return False
    state["last_event_id"] = int(rows[-1][0])
    state["updated_at"] = int(time.time())
    save_event_state(state_path, state)
    for _event_id, _task_id, kind, _payload in rows:
        # `blocked` is the obvious path, but some role bots complete a review card
        # with result/comment like `changes-requested` or `승인 불가` and the
        # downstream verifier may start before a remediation chain is created.
        # Wake the bounded handler on terminal/comment events too; the handler is
        # idempotent, uses cooldown, and only writes when it finds a real safe
        # remediation candidate.
        if kind in {"blocked", "completed", "commented"}:
            return True
    return False


def run_handler(handler: str, board: str, root: Path) -> int:
    env = os.environ.copy()
    env.setdefault("MAX_DISPATCH", "1")
    env.setdefault("EVENT_COOLDOWN_SECONDS", "10")
    cmd = [handler, "--once", "--board", board]
    started = time.strftime("%F %T")
    print(f"[{started}] blocked remediation event handler start: {' '.join(cmd)}", flush=True)
    proc = subprocess.run(cmd, cwd=root, env=env, text=True, capture_output=True)
    if proc.stdout:
        print(proc.stdout.rstrip(), flush=True)
    if proc.stderr:
        print(proc.stderr.rstrip(), file=sys.stderr, flush=True)
    ended = time.strftime("%F %T")
    print(f"[{ended}] blocked remediation event handler exit={proc.returncode}", flush=True)
    return proc.returncode


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--board", default="groupware")
    parser.add_argument("--root", default="/home/wrhrgw/gw")
    parser.add_argument("--db-dir", default="/home/wrhrgw/gw-dev-bot/.hermes/kanban/boards/groupware")
    parser.add_argument("--handler", default="/home/wrhrgw/gw/scripts/gw-blocked-remediation-watch.sh")
    parser.add_argument("--state", default="/home/wrhrgw/gw/.hermes/gw-blocked-remediation-inotify.state.json")
    parser.add_argument("--debounce", type=float, default=2.0)
    parser.add_argument("--sweep-interval", type=float, default=120.0, help="Run the handler periodically to clean stale/resolved blockers even when only comments/completions changed.")
    args = parser.parse_args()

    root = Path(args.root)
    db_dir = Path(args.db_dir)
    db_path = db_dir / "kanban.db"
    state_path = Path(args.state)
    if not db_dir.is_dir():
        print(f"DB directory not found: {db_dir}", file=sys.stderr)
        return 2

    libc = load_libc()
    flags = getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_CLOEXEC", 0)
    fd = libc.inotify_init1(flags)
    if fd < 0:
        err = ctypes.get_errno()
        raise OSError(err, f"inotify_init1 failed: {os.strerror(err)}")

    add_watch(libc, fd, db_dir, WATCH_MASK)
    if db_path.exists():
        add_watch(libc, fd, db_path, WATCH_MASK)
    load_event_state(state_path, db_path)

    print(
        f"groupware blocked remediation inotify watcher started: db_dir={db_dir}, debounce={args.debounce}s",
        flush=True,
    )

    poller = select.poll()
    poller.register(fd, select.POLLIN)
    pending = False
    due_at = 0.0
    next_sweep_at = time.monotonic() + max(args.sweep_interval, 10.0)

    while True:
        now = time.monotonic()
        timeout_ms = max(0, int((next_sweep_at - now) * 1000))
        if pending:
            timeout_ms = min(timeout_ms, max(0, int((due_at - now) * 1000)))
        events = poller.poll(timeout_ms)
        now = time.monotonic()
        if events:
            try:
                buf = os.read(fd, 65536)
            except BlockingIOError:
                buf = b""
            for _wd, mask, _cookie, name in iter_events(buf):
                if mask & IN_Q_OVERFLOW:
                    pending = True
                    due_at = now + args.debounce
                    continue
                if mask & IN_IGNORED:
                    continue
                if name and name not in WATCH_NAMES:
                    continue
                pending = True
                due_at = now + args.debounce
        if pending and time.monotonic() >= due_at:
            pending = False
            try:
                should_run = has_new_blocked_event(db_path, state_path)
            except sqlite3.Error as exc:
                print(f"read-only event check failed: {exc}", file=sys.stderr, flush=True)
                should_run = False
            if should_run:
                run_handler(args.handler, args.board, root)
                next_sweep_at = time.monotonic() + max(args.sweep_interval, 10.0)
        if time.monotonic() >= next_sweep_at:
            # Periodic safety net: catches stale/superseded blocked cards that become
            # resolvable after review/verify completion comments, even when no new
            # blocked event is emitted. The handler itself is idempotent and reads
            # Kanban state before writing.
            run_handler(args.handler, args.board, root)
            next_sweep_at = time.monotonic() + max(args.sweep_interval, 10.0)


if __name__ == "__main__":
    raise SystemExit(main())
