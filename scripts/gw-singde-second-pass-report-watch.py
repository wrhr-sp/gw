#!/usr/bin/env python3
"""Singde second-pass Telegram report watcher for Groupware Kanban.

목적:
- 1차 direct Telegram 카드보고를 최종으로 끝내지 않고, 같은 Kanban 이벤트를 싱드 관점으로 한 번 더 해석해 보고한다.
- Telegram 메시지를 봇이 다시 읽는 방식이 아니라 Kanban event/state를 read-only로 다시 확인한다.
- 보고 카드/notify-subscribe를 만들지 않는다.
"""
from __future__ import annotations

import argparse
import fcntl
import html
import json
import os
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path("/home/wrhrgw/gw")
DEFAULT_DB = Path("/home/wrhrgw/gw-dev-bot/.hermes/kanban/boards/groupware/kanban.db")
DEFAULT_ENV = Path("/home/wrhrgw/gw-dev-bot/.hermes/.env")
DEFAULT_STATE = ROOT / ".hermes" / "gw-singde-second-pass-report-watch.state.json"
DEFAULT_LOCK = ROOT / ".hermes" / "gw-singde-second-pass-report-watch.lock"
DEFAULT_CHAT_ID = "8648561062"

CORRUPTION_MARKERS = (
    "database disk image is malformed",
    "file is not a database",
    "disk i/o error",
    "refusing to open corrupt kanban db",
)
REPORT_TITLE_MARKERS = ("최종 보고", "최종 통합 보고", "Telegram 결과보고", "텔레그램 결과보고", "막힘 자동보고")
RESTRICTED_MARKERS = (
    "secret", ".env", "credential", "token", "password", "production", "prod db",
    "dns", "domain", "유료", "비용", "결제", "운영 db", "운영db", "운영 데이터",
    "migration", "마이그레이션", "배포", "외부 공개", "public exposure", "r2 운영",
    "delete", "force", "destructive", "삭제", "강제",
)
AUTO_MARKERS = (
    "review-required", "timeout", "timed out", "crash", "crashed", "stale",
    "protocol violation", "iteration budget", "자동 복구 가능", "복구 가능",
    "pycache", "__pycache__", "cleanup",
)


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def parse_home_channel(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    if value.startswith("telegram:"):
        return value.split(":", 1)[1]
    try:
        data = json.loads(value)
        if isinstance(data, dict):
            return str(data.get("chat_id") or data.get("id") or "") or None
    except Exception:
        pass
    return value or None


def compact(text: str | None, limit: int = 1000) -> str:
    s = " ".join((text or "").split())
    return s[:limit] + ("…" if len(s) > limit else "")


def fmt_time(ts: int | None) -> str:
    if not ts:
        return "-"
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))


def read_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"initialized": False, "last_event_id": 0, "sent": {}, "blocked_seen": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        data.setdefault("sent", {})
        data.setdefault("blocked_seen", {})
        return data
    except Exception:
        return {"initialized": False, "last_event_id": 0, "sent": {}, "blocked_seen": {}}


def write_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(path)


def connect_ro(db: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


def db_health(conn: sqlite3.Connection) -> str:
    return str(conn.execute("pragma integrity_check").fetchone()[0])


def get_max_event_id(conn: sqlite3.Connection) -> int:
    row = conn.execute("select coalesce(max(id), 0) from task_events").fetchone()
    return int(row[0] or 0)


def latest_comment(conn: sqlite3.Connection, task_id: str) -> str:
    row = conn.execute("select body from task_comments where task_id=? order by id desc limit 1", (task_id,)).fetchone()
    return str(row[0]) if row else ""


def linked_ids(conn: sqlite3.Connection, task_id: str, direction: str) -> list[str]:
    if direction == "parents":
        rows = conn.execute("select parent_id from task_links where child_id=? order by parent_id", (task_id,)).fetchall()
        return [str(row[0]) for row in rows]
    rows = conn.execute("select child_id from task_links where parent_id=? order by child_id", (task_id,)).fetchall()
    return [str(row[0]) for row in rows]


def format_ids(ids: list[str], limit: int = 5) -> str:
    if not ids:
        return "-"
    return ", ".join(ids[:limit]) + (f" 외 {len(ids) - limit}개" if len(ids) > limit else "")


def parse_payload(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def load_events(conn: sqlite3.Connection, after_id: int, limit: int) -> list[sqlite3.Row]:
    return list(conn.execute(
        """
        select e.id as event_id, e.task_id, e.kind, e.payload, e.created_at,
               t.title, t.body, t.assignee, t.status, t.result, t.last_failure_error,
               t.created_at as task_created_at, t.started_at, t.completed_at
        from task_events e
        join tasks t on t.id = e.task_id
        where e.id > ?
        order by e.id asc
        limit ?
        """,
        (after_id, limit),
    ))


def latest_run_summary(conn: sqlite3.Connection, task_id: str) -> str:
    try:
        row = conn.execute(
            "select outcome, summary, error, started_at, completed_at from task_runs where task_id=? order by id desc limit 1",
            (task_id,),
        ).fetchone()
    except sqlite3.Error:
        return ""
    if not row:
        return ""
    parts = []
    if row["outcome"]:
        parts.append(f"outcome={row['outcome']}")
    if row["summary"]:
        parts.append(str(row["summary"]))
    if row["error"]:
        parts.append(str(row["error"]))
    return compact(" / ".join(parts), 900)


def evidence(conn: sqlite3.Connection, row: sqlite3.Row) -> str:
    payload = parse_payload(row["payload"])
    candidates = [
        str(payload.get("summary") or ""),
        str(payload.get("reason") or ""),
        str(row["last_failure_error"] or ""),
        str(row["result"] or ""),
        latest_comment(conn, str(row["task_id"])),
        latest_run_summary(conn, str(row["task_id"])),
    ]
    for item in candidates:
        if item.strip():
            return compact(item, 1200)
    return "확인 가능한 요약이 비어 있습니다."


def report_kind(row: sqlite3.Row, state: dict[str, Any]) -> str | None:
    kind = str(row["kind"])
    title = str(row["title"] or "")
    assignee = str(row["assignee"] or "")
    tid = str(row["task_id"])
    if kind == "blocked":
        if "막힘 자동보고" in title:
            return None
        return "막힘 2차 확인"
    if kind == "completed":
        if tid in state.get("blocked_seen", {}):
            return "조치완료 2차 확인"
        if assignee == "singde" and any(marker in title for marker in REPORT_TITLE_MARKERS):
            return "최종보고 2차 확인"
    return None


def classify(title: str, text: str, kind: str) -> tuple[str, str]:
    all_text = f"{title}\n{text}".lower()
    if any(marker in all_text for marker in RESTRICTED_MARKERS):
        return "대장 승인 필요", "비밀값/운영/비용/배포/DNS/production 가능성이 있어 자동 처리하지 않고 승인 요청으로 둡니다."
    if kind.startswith("조치완료") or kind.startswith("최종보고"):
        return "완료 확인", "완료 결과와 남은 미확인 사항만 확인하면 됩니다."
    if any(marker in all_text for marker in AUTO_MARKERS):
        return "자동 조치/복구 후보", "자동화 범위 안의 검증·재시도·정리인지 확인하고, 안전하면 기존 복구 watcher 또는 싱드가 처리합니다."
    return "싱드 확인 필요", "자동 조치 조건이 명확하지 않아 원본 카드/로그를 싱드가 추가 확인해야 합니다."


def build_message(conn: sqlite3.Connection, row: sqlite3.Row, kind: str, state: dict[str, Any]) -> str:
    tid = str(row["task_id"])
    title = str(row["title"] or "(제목 없음)")
    assignee = str(row["assignee"] or "미지정")
    ev = evidence(conn, row)
    classification, next_action = classify(title, ev, kind)
    parents = format_ids(linked_ids(conn, tid, "parents"))
    children = format_ids(linked_ids(conn, tid, "children"))
    icon = "🧭"
    return (
        f"{icon} <b>싱드 2차 확인 보고</b>\n\n"
        f"<b>결론</b>\n"
        f"- 보고 유형: {html.escape(kind)}\n"
        f"- 싱드 판단: {html.escape(classification)}\n"
        f"- 다음 액션: {html.escape(next_action)}\n\n"
        f"<b>원본 카드</b>\n"
        f"- 카드: <code>{html.escape(tid)}</code>\n"
        f"- 제목: {html.escape(compact(title, 180))}\n"
        f"- 담당: {html.escape(assignee)}\n"
        f"- 현재 상태: {html.escape(str(row['status'] or '-'))}\n"
        f"- 이벤트: {html.escape(str(row['kind']))} / {html.escape(fmt_time(int(row['created_at'])))}\n"
        f"- 부모: {html.escape(parents)}\n"
        f"- 후속: {html.escape(children)}\n\n"
        f"<b>확인한 근거</b>\n"
        f"- {html.escape(ev)}\n\n"
        f"<b>처리 기준</b>\n"
        "- 보고 카드/notify-subscribe는 만들지 않습니다.\n"
        "- secret, production DB, DNS, 유료, 외부 공개, 배포, migration은 대장 승인 전 실행하지 않습니다."
    )


def telegram_send(token: str, chat_id: str, text: str, dry_run: bool) -> None:
    if dry_run:
        print("--- DRY-RUN TELEGRAM ---")
        print(text)
        return
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": "true",
    }).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read(512)
        if resp.status >= 300:
            raise RuntimeError(f"Telegram send failed: HTTP {resp.status} {body!r}")


def run_once(args: argparse.Namespace) -> int:
    load_dotenv(Path(args.env_file))
    token = os.environ.get("SINGDE_TELEGRAM_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = args.chat_id or parse_home_channel(os.environ.get("TELEGRAM_HOME_CHANNEL")) or DEFAULT_CHAT_ID
    if not token and not args.dry_run:
        print("SINGDE_TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_TOKEN이 없어 전송하지 못했습니다.", file=sys.stderr)
        return 2
    state_path = Path(args.state_file)
    state = read_state(state_path)
    try:
        conn = connect_ro(Path(args.db))
        health = db_health(conn)
        if health != "ok":
            print(f"DB integrity_check != ok: {health}", file=sys.stderr)
            return 3
        if not state.get("initialized") and not args.include_existing:
            max_id = get_max_event_id(conn)
            state.update({"initialized": True, "last_event_id": max_id, "last_checked_at": int(time.time()), "db_health": "ok"})
            write_state(state_path, state)
            print(f"baseline complete: last_event_id={max_id}")
            return 0
        sent = 0
        events = load_events(conn, int(state.get("last_event_id") or 0), int(args.event_batch_limit))
        for row in events:
            event_id = int(row["event_id"])
            key_prefix = f"{event_id}:{row['task_id']}:{row['kind']}"
            kind = report_kind(row, state)
            if kind and key_prefix not in state.get("sent", {}) and sent < args.max_messages_per_cycle:
                msg = build_message(conn, row, kind, state)
                telegram_send(token, chat_id, msg, args.dry_run)
                state.setdefault("sent", {})[key_prefix] = {"at": int(time.time()), "kind": kind}
                sent += 1
            if str(row["kind"]) == "blocked" and kind:
                state.setdefault("blocked_seen", {})[str(row["task_id"])] = {"event_id": event_id, "at": int(row["created_at"])}
            if str(row["kind"]) == "completed":
                state.setdefault("blocked_seen", {}).pop(str(row["task_id"]), None)
            state["last_event_id"] = event_id
        state.update({"initialized": True, "last_checked_at": int(time.time()), "db_health": "ok"})
        write_state(state_path, state)
        print(f"checked events={len(events)} second_reports={sent} last_event_id={state.get('last_event_id')}")
        return 0
    except sqlite3.Error as exc:
        msg = str(exc).lower()
        if any(marker in msg for marker in CORRUPTION_MARKERS):
            print(f"DB circuit-breaker: {exc}", file=sys.stderr)
            return 75
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Groupware Singde second-pass Telegram report watcher")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--env-file", default=str(DEFAULT_ENV))
    parser.add_argument("--state-file", default=str(DEFAULT_STATE))
    parser.add_argument("--lock-file", default=str(DEFAULT_LOCK))
    parser.add_argument("--chat-id", default=os.environ.get("GW_REPORT_CHAT_ID"))
    parser.add_argument("--interval", type=int, default=75)
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--include-existing", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--max-messages-per-cycle", type=int, default=3)
    parser.add_argument("--event-batch-limit", type=int, default=80)
    parser.add_argument("--corrupt-backoff-seconds", type=int, default=1800)
    args = parser.parse_args()

    Path(args.lock_file).parent.mkdir(parents=True, exist_ok=True)
    with open(args.lock_file, "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("another groupware singde second-pass watcher is already running")
            return 0
        while True:
            code = run_once(args)
            if args.once:
                return code
            time.sleep(args.corrupt_backoff_seconds if code == 75 else max(30, int(args.interval)))


if __name__ == "__main__":
    raise SystemExit(main())
