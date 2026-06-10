#!/usr/bin/env python3
"""Read-only Groupware Kanban Telegram report watcher.

원칙:
- Kanban DB는 SQLite read-only URI로만 연다. task/comment/event/notify 테이블에 쓰지 않는다.
- 상태는 별도 JSON 파일에만 저장한다.
- Telegram은 Bot API로 직접 보낸다. Hermes kanban create/complete/dispatch/notify-subscribe를 호출하지 않는다.
- 첫 실행은 기존 이벤트를 baseline 처리해 과거 blocked 카드 폭주 보고를 막는다.
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
DEFAULT_STATE = ROOT / ".hermes" / "gw-telegram-kanban-report-watch.state.json"
DEFAULT_LOCK = ROOT / ".hermes" / "gw-telegram-kanban-report-watch.lock"
DEFAULT_CHAT_ID = "8648561062"
CORRUPTION_MARKERS = (
    "database disk image is malformed",
    "file is not a database",
    "disk i/o error",
    "refusing to open corrupt kanban db",
)
REPORT_TITLE_MARKERS = ("최종 보고", "막힘 자동보고", "결과 보고", "사용자 보고", "자동 조치", "GitHub 작업 판단", "오케스트레이션 동기화 결과")
DIRECT_REPORT_MARKERS = ("Telegram 결과보고", "텔레그램 결과보고")


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def parse_home_channel(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    # 허용 예: 8648561062, telegram:8648561062, {"platform":"telegram","chat_id":"..."}
    if value.startswith("telegram:"):
        return value.split(":", 1)[1]
    try:
        data = json.loads(value)
        if isinstance(data, dict):
            return str(data.get("chat_id") or data.get("id") or "") or None
    except Exception:
        pass
    return value


def compact(text: str | None, limit: int = 700) -> str:
    s = " ".join((text or "").split())
    return s[:limit] + ("…" if len(s) > limit else "")


def fmt_time(ts: int | None) -> str:
    if not ts:
        return "-"
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))


def read_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"initialized": False, "last_event_id": 0, "reported_blocked": {}, "sent": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        data.setdefault("reported_blocked", {})
        data.setdefault("sent", [])
        return data
    except Exception:
        return {"initialized": False, "last_event_id": 0, "reported_blocked": {}, "sent": []}


def write_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(path)


def connect_ro(db: Path) -> sqlite3.Connection:
    uri = f"file:{db}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


def db_health(conn: sqlite3.Connection) -> str:
    return str(conn.execute("pragma integrity_check").fetchone()[0])


def get_max_event_id(conn: sqlite3.Connection) -> int:
    row = conn.execute("select coalesce(max(id), 0) from task_events").fetchone()
    return int(row[0] or 0)


def current_blocked_tasks(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return list(
        conn.execute(
            """
            select id as task_id, title, assignee, status, result
            from tasks
            where status='blocked'
            order by created_at asc
            """
        )
    )


def load_events(conn: sqlite3.Connection, after_id: int, limit: int) -> list[sqlite3.Row]:
    return list(
        conn.execute(
            """
            select e.id as event_id, e.task_id, e.kind, e.payload, e.created_at,
                   t.title, t.assignee, t.status, t.result, t.completed_at
            from task_events e
            join tasks t on t.id = e.task_id
            where e.id > ?
            order by e.id asc
            limit ?
            """,
            (after_id, limit),
        )
    )


def latest_comment(conn: sqlite3.Connection, task_id: str) -> str:
    row = conn.execute(
        "select body from task_comments where task_id=? order by id desc limit 1", (task_id,)
    ).fetchone()
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
    visible = ids[:limit]
    suffix = f" 외 {len(ids) - limit}개" if len(ids) > limit else ""
    return ", ".join(visible) + suffix


def classify_action(reason: str, title: str) -> tuple[str, str]:
    text = f"{title}\n{reason}".lower()
    restricted_markers = (
        "secret", ".env", "credential", "token", "password", "production", "prod db",
        "dns", "domain", "유료", "비용", "결제", "운영 db", "운영db", "운영 데이터",
        "migration", "마이그레이션", "배포", "외부 공개", "public exposure", "r2 운영",
    )
    if any(marker in text for marker in restricted_markers):
        return "대장 승인 필요", "비밀값/운영/비용/배포/DNS/production 가능성이 있어 자동 처리하지 않습니다."
    if "review-required" in text or "검토" in text:
        return "싱드 검토 필요", "리뷰/검증 근거를 확인한 뒤 안전하면 다음 단계로 넘기고, 불확실하면 승인 요청으로 돌립니다."
    if any(marker in text for marker in ("timeout", "timed out", "crash", "stale", "protocol", "iteration")):
        return "자동 복구 후보", "로그와 재검증 결과가 맞으면 싱드/복구 watcher가 안전 범위에서 재시도 또는 정리할 수 있습니다."
    return "싱드 분류 대기", "자동 조치 가능 여부를 먼저 확인하고, 위험하거나 권한이 필요하면 승인 요청으로 보고합니다."


def parse_payload(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def should_completion_report(row: sqlite3.Row, state: dict[str, Any]) -> tuple[bool, str]:
    tid = str(row["task_id"])
    title = str(row["title"] or "")
    assignee = str(row["assignee"] or "")
    blocked_seen = state.get("reported_blocked", {})
    if tid in blocked_seen:
        return True, "조치 완료"
    if any(marker in title for marker in DIRECT_REPORT_MARKERS):
        return True, "Telegram 결과보고"
    if assignee == "singde" and any(marker in title for marker in REPORT_TITLE_MARKERS):
        return True, "완료 보고"
    return False, ""


def build_blocked_message(conn: sqlite3.Connection, row: sqlite3.Row) -> str:
    payload = parse_payload(row["payload"])
    reason = compact(str(payload.get("reason") or row["result"] or latest_comment(conn, row["task_id"]) or "막힘 이유가 비어 있음"), 1200)
    title = str(row["title"] or "(제목 없음)")
    assignee = str(row["assignee"] or "미지정")
    task_id = str(row["task_id"])
    parents = format_ids(linked_ids(conn, task_id, "parents"))
    children = format_ids(linked_ids(conn, task_id, "children"))
    classification, next_action = classify_action(reason, title)
    kind = "검토 필요" if "review-required" in reason.lower() else "막힘 보고"
    return (
        f"🚧 <b>그룹웨어 {html.escape(kind)}</b>\n\n"
        f"<b>결론</b>\n"
        f"- 분류: {html.escape(classification)}\n"
        f"- 다음 처리: {html.escape(next_action)}\n\n"
        f"<b>카드 정보</b>\n"
        f"- 카드: <code>{html.escape(task_id)}</code>\n"
        f"- 제목: {html.escape(compact(title, 180))}\n"
        f"- 담당: {html.escape(assignee)}\n"
        f"- 상태: {html.escape(str(row['status'] or '-'))}\n"
        f"- 발생: {html.escape(fmt_time(int(row['created_at'])))}\n"
        f"- 부모: {html.escape(parents)}\n"
        f"- 후속: {html.escape(children)}\n\n"
        f"<b>막힌 이유/근거</b>\n"
        f"- {html.escape(reason)}\n\n"
        f"<b>처리 원칙</b>\n"
        "- 자동화 범위 안의 재시도/검증/정리는 싱드가 조치합니다.\n"
        "- secret, production DB, DNS, 유료, 외부 공개, 배포, migration은 대장 승인 전 실행하지 않습니다."
    )


def build_completion_message(conn: sqlite3.Connection, row: sqlite3.Row, label: str, state: dict[str, Any]) -> str:
    payload = parse_payload(row["payload"])
    summary = compact(str(payload.get("summary") or row["result"] or latest_comment(conn, row["task_id"]) or "완료 요약이 비어 있음"), 1400)
    title = str(row["title"] or "(제목 없음)")
    assignee = str(row["assignee"] or "미지정")
    task_id = str(row["task_id"])
    parents = format_ids(linked_ids(conn, task_id, "parents"))
    children = format_ids(linked_ids(conn, task_id, "children"))
    if label == "Telegram 결과보고":
        prefix = "📣"
        conclusion = "요청한 사용자-facing 보고가 완료됐습니다."
    elif label == "완료 보고":
        prefix = "✅"
        conclusion = "최종 보고 카드가 완료됐습니다."
    else:
        prefix = "🛠️"
        conclusion = "이전에 막혔던 카드가 조치 완료됐습니다."
    return (
        f"{prefix} <b>그룹웨어 {html.escape(label)}</b>\n\n"
        f"<b>결론</b>\n"
        f"- {html.escape(conclusion)}\n\n"
        f"<b>카드 정보</b>\n"
        f"- 카드: <code>{html.escape(task_id)}</code>\n"
        f"- 제목: {html.escape(compact(title, 180))}\n"
        f"- 담당: {html.escape(assignee)}\n"
        f"- 완료: {html.escape(fmt_time(int(row['created_at'])))}\n"
        f"- 부모: {html.escape(parents)}\n"
        f"- 후속: {html.escape(children)}\n\n"
        f"<b>결과/근거</b>\n"
        f"- {html.escape(summary)}\n\n"
        f"<b>다음 액션</b>\n"
        "- 남은 blocked/todo 카드가 있으면 싱드가 별도 확인합니다.\n"
        "- 배포, DNS, 유료, secret, production DB 작업은 별도 승인 전 진행하지 않습니다."
    )


def telegram_send(token: str, chat_id: str, text: str, dry_run: bool) -> None:
    if dry_run:
        print("--- DRY-RUN TELEGRAM ---")
        print(text)
        return
    data = urllib.parse.urlencode(
        {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": "true",
        }
    ).encode()
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
    sent_this_cycle = 0

    try:
        conn = connect_ro(Path(args.db))
        health = db_health(conn)
        if health != "ok":
            print(f"DB integrity_check != ok: {health}", file=sys.stderr)
            return 3
        max_id = get_max_event_id(conn)

        if not state.get("initialized") and not args.include_existing:
            # 과거 blocked 이벤트를 Telegram으로 쏟아내지는 않는다.
            # 대신 현재 blocked 목록은 별도 상태에 기억해 두었다가, 나중에 done으로 바뀌면
            # “조치 완료”만 1회 보고할 수 있게 한다.
            observed = state.setdefault("reported_blocked", {})
            for task in current_blocked_tasks(conn):
                title = str(task["title"] or "")
                if "막힘 자동보고" in title:
                    continue
                observed[str(task["task_id"])] = {
                    "event_id": max_id,
                    "title": title,
                    "assignee": str(task["assignee"] or ""),
                    "at": int(time.time()),
                    "baseline_only": True,
                }
            state.update({"initialized": True, "last_event_id": max_id, "last_checked_at": int(time.time())})
            write_state(state_path, state)
            print(f"baseline complete: last_event_id={max_id} observed_blocked={len(observed)}")
            return 0

        events = load_events(conn, int(state.get("last_event_id") or 0), int(args.event_batch_limit))
        for row in events:
            event_id = int(row["event_id"])
            kind = str(row["kind"])
            tid = str(row["task_id"])
            title = str(row["title"] or "")

            if sent_this_cycle >= int(args.max_messages_per_cycle):
                break

            if kind == "blocked":
                # 보고 카드 자체가 막힌 경우까지 무한 재보고하지 않도록 제외한다.
                if "막힘 자동보고" in title:
                    state["last_event_id"] = event_id
                    continue
                msg = build_blocked_message(conn, row)
                telegram_send(token, chat_id, msg, args.dry_run)
                state.setdefault("reported_blocked", {})[tid] = {
                    "event_id": event_id,
                    "title": title,
                    "at": int(row["created_at"]),
                }
                sent_this_cycle += 1

            elif kind == "completed":
                ok, label = should_completion_report(row, state)
                if ok:
                    msg = build_completion_message(conn, row, label, state)
                    telegram_send(token, chat_id, msg, args.dry_run)
                    if label == "조치 완료":
                        state.setdefault("reported_blocked", {}).pop(tid, None)
                    sent_this_cycle += 1

            state["last_event_id"] = event_id

        state.update({"initialized": True, "last_checked_at": int(time.time()), "db_health": "ok"})
        write_state(state_path, state)
        print(f"checked events={len(events)} sent={sent_this_cycle} last_event_id={state.get('last_event_id')}")
        return 0
    except sqlite3.Error as exc:
        msg = str(exc).lower()
        if any(marker in msg for marker in CORRUPTION_MARKERS):
            print(f"DB circuit-breaker: {exc}", file=sys.stderr)
            return 75
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Groupware Kanban read-only Telegram report watcher")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--env-file", default=str(DEFAULT_ENV))
    parser.add_argument("--state-file", default=str(DEFAULT_STATE))
    parser.add_argument("--lock-file", default=str(DEFAULT_LOCK))
    parser.add_argument("--chat-id", default=os.environ.get("GW_REPORT_CHAT_ID"))
    parser.add_argument("--interval", type=int, default=60)
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--include-existing", action="store_true", help="첫 실행 때 기존 이벤트도 보고한다. 기본은 baseline만 잡아 폭주 방지.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--max-messages-per-cycle", type=int, default=3)
    parser.add_argument("--event-batch-limit", type=int, default=50)
    parser.add_argument("--corrupt-backoff-seconds", type=int, default=1800)
    args = parser.parse_args()

    Path(args.lock_file).parent.mkdir(parents=True, exist_ok=True)
    with open(args.lock_file, "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("another groupware telegram report watcher is already running")
            return 0

        while True:
            code = run_once(args)
            if args.once:
                return code
            sleep_for = args.corrupt_backoff_seconds if code == 75 else max(10, int(args.interval))
            time.sleep(sleep_for)


if __name__ == "__main__":
    raise SystemExit(main())
