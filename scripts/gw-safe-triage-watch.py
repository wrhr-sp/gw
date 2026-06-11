#!/usr/bin/env python3
"""Groupware direct Telegram + safe Singde triage watcher.

원칙:
- Kanban DB는 SQLite read-only URI로만 연다.
- 보고 카드/막힘 카드/notify-subscribe를 만들지 않는다.
- 자동 조치는 승인된 안전 스크립트만 호출한다.
- restricted 항목(secret/production DB/DNS/유료/배포/migration 등)은 Telegram 승인요청만 보낸다.
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import html
import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path("/home/wrhrgw/gw")
DEFAULT_DB = Path("/home/wrhrgw/gw-dev-bot/.hermes/kanban/boards/groupware/kanban.db")
DEFAULT_ENV = Path("/home/wrhrgw/gw-dev-bot/.hermes/.env")
DEFAULT_STATE = ROOT / ".hermes" / "gw-safe-triage-watch.state.json"
DEFAULT_LOCK = ROOT / ".hermes" / "gw-safe-triage-watch.lock"
DEFAULT_CHAT_ID = "8648561062"

CORRUPTION_MARKERS = (
    "database disk image is malformed",
    "file is not a database",
    "disk i/o error",
    "refusing to open corrupt kanban db",
)
RESTRICTED_MARKERS = (
    "secret", ".env", "credential", "token", "password", "production", "prod db",
    "dns", "domain", "유료", "비용", "결제", "운영 db", "운영db", "운영 데이터",
    "migration", "마이그레이션", "배포", "외부 공개", "public exposure", "r2 운영",
    "delete", "force", "destructive", "삭제", "강제",
)
AUTO_REVIEW_MARKERS = ("review-required", "검토 필요", "review required")
AUTO_RECOVERY_MARKERS = (
    "timeout", "timed out", "crash", "crashed", "stale", "protocol violation",
    "iteration budget", "iteration-budget", "worker recovery",
    "자동 복구 가능", "복구 가능", "후속 복구", "cleanup", "pycache", "__pycache__",
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


def compact(text: str | None, limit: int = 900) -> str:
    s = " ".join((text or "").split())
    return s[:limit] + ("…" if len(s) > limit else "")


def fmt_time(ts: int | None) -> str:
    if not ts:
        return "-"
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))


def read_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"seen": {}, "last_checked_at": None}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        data.setdefault("seen", {})
        return data
    except Exception:
        return {"seen": {}, "last_checked_at": None}


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


def task_signature(task: sqlite3.Row, reason: str) -> str:
    src = "|".join([
        str(task["id"]),
        str(task["status"]),
        str(task["assignee"] or ""),
        str(task["title"] or ""),
        compact(reason, 400),
    ])
    return hashlib.sha256(src.encode()).hexdigest()[:16]


def blocked_tasks(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return list(conn.execute(
        """
        select id, title, body, assignee, status, result, created_at, started_at, completed_at,
               consecutive_failures, last_failure_error, current_run_id
        from tasks
        where status='blocked'
        order by created_at asc
        """
    ))


def reason_for(conn: sqlite3.Connection, task: sqlite3.Row) -> str:
    return compact(str(task["last_failure_error"] or task["result"] or latest_comment(conn, str(task["id"])) or task["body"] or "막힘 이유가 비어 있음"), 1200)


def classify(title: str, reason: str) -> tuple[str, str, str]:
    text = f"{title}\n{reason}".lower()
    if any(marker in text for marker in RESTRICTED_MARKERS):
        return "대장 승인 필요", "approval-needed", "secret/production DB/DNS/유료/외부 공개/배포/migration/삭제 가능성이 있어 자동 처리하지 않습니다."
    if any(marker in text for marker in AUTO_REVIEW_MARKERS):
        return "자동 조치 후보", "review-gate", "review-required handoff는 표준 검증이 통과하면 카드 생성 없이 완료/다음 단계 진행이 가능합니다."
    if any(marker in text for marker in AUTO_RECOVERY_MARKERS):
        return "자동 복구 후보", "worker-recovery", "timeout/crash/stale, 캐시 정리, 이미 생성된 복구 체인 확인처럼 카드 생성 없이 처리 가능한 범위는 안전 복구 절차로 확인합니다."
    return "싱드 분류 대기", "manual-triage", "자동 조치 조건이 명확하지 않아 Telegram 보고 후 싱드가 직접 확인합니다."


def run_action(action: str, task_id: str, dry_run: bool) -> tuple[str, str]:
    if action == "approval-needed":
        return "승인 요청", "자동 조치하지 않았습니다. 대장 승인이 필요합니다."
    if action == "manual-triage":
        return "수동 확인 필요", "자동 조건이 명확하지 않아 카드 생성 없이 Telegram으로만 보고했습니다."
    if dry_run:
        return "dry-run", f"dry-run이라 {action} 조치를 실행하지 않았습니다."

    env = os.environ.copy()
    env.setdefault("HERMES_HOME", "/home/wrhrgw/gw-dev-bot/.hermes")
    if action == "review-gate":
        cmd = ["./scripts/gw-review-required-gate.sh", "--task", task_id, "--board", "groupware", "--max-dispatch", "1"]
    elif action == "worker-recovery":
        cmd = ["./scripts/gw-worker-recovery-watch.sh", "--once", "--board", "groupware", "--max-age", "1800"]
    else:
        return "알 수 없는 조치", f"지원하지 않는 action={action}"
    proc = subprocess.run(cmd, cwd=ROOT, env=env, text=True, capture_output=True, timeout=900)
    output = compact((proc.stdout or "") + "\n" + (proc.stderr or ""), 1200)
    status = "자동 조치 성공" if proc.returncode == 0 else f"자동 조치 실패(rc={proc.returncode})"
    return status, output or "출력 없음"


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


def build_message(conn: sqlite3.Connection, task: sqlite3.Row, classification: str, action: str, policy: str, action_status: str, action_output: str, reason: str) -> str:
    task_id = str(task["id"])
    title = str(task["title"] or "(제목 없음)")
    assignee = str(task["assignee"] or "미지정")
    parents = format_ids(linked_ids(conn, task_id, "parents"))
    children = format_ids(linked_ids(conn, task_id, "children"))
    icon = "🙋" if action == "approval-needed" else ("🛠️" if action in {"review-gate", "worker-recovery"} else "🚧")
    return (
        f"{icon} <b>그룹웨어 안전 triage 보고</b>\n\n"
        f"<b>결론</b>\n"
        f"- 분류: {html.escape(classification)}\n"
        f"- 조치 상태: {html.escape(action_status)}\n"
        f"- 원칙: {html.escape(policy)}\n\n"
        f"<b>카드 정보</b>\n"
        f"- 카드: <code>{html.escape(task_id)}</code>\n"
        f"- 제목: {html.escape(compact(title, 180))}\n"
        f"- 담당: {html.escape(assignee)}\n"
        f"- 상태: {html.escape(str(task['status']))}\n"
        f"- 생성: {html.escape(fmt_time(int(task['created_at'] or 0)))}\n"
        f"- 부모: {html.escape(parents)}\n"
        f"- 후속: {html.escape(children)}\n\n"
        f"<b>막힌 이유/근거</b>\n"
        f"- {html.escape(reason)}\n\n"
        f"<b>조치 결과</b>\n"
        f"- {html.escape(action_output)}\n\n"
        f"<b>승인 게이트</b>\n"
        "- secret, production DB, DNS, 유료, 외부 공개, 배포, migration, 파괴적 삭제는 대장 승인 전 실행하지 않습니다.\n"
        "- 이 루프는 보고 카드나 notify-subscribe를 만들지 않습니다."
    )


def run_once(args: argparse.Namespace) -> int:
    load_dotenv(Path(args.env_file))
    token = os.environ.get("SINGDE_TELEGRAM_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = args.chat_id or parse_home_channel(os.environ.get("TELEGRAM_HOME_CHANNEL")) or DEFAULT_CHAT_ID
    if not token and not args.dry_run:
        print("SINGDE_TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_TOKEN이 없어 전송하지 못했습니다.", file=sys.stderr)
        return 2
    state_path = Path(args.state_file)
    state = read_state(state_path)
    sent = 0
    try:
        conn = connect_ro(Path(args.db))
        health = db_health(conn)
        if health != "ok":
            print(f"DB integrity_check != ok: {health}", file=sys.stderr)
            return 3
        for task in blocked_tasks(conn):
            if sent >= args.max_messages_per_cycle:
                break
            reason = reason_for(conn, task)
            sig = task_signature(task, reason)
            key = f"{task['id']}:{sig}"
            existing = state.get("seen", {}).get(key)
            if existing:
                retry_after = int(existing.get("retry_after") or 0) if isinstance(existing, dict) else 0
                if not retry_after or int(time.time()) < retry_after:
                    continue
            classification, action, policy = classify(str(task["title"] or ""), reason)
            action_status, action_output = run_action(action, str(task["id"]), args.dry_run)
            msg = build_message(conn, task, classification, action, policy, action_status, action_output, reason)
            telegram_send(token, chat_id, msg, args.dry_run)
            now = int(time.time())
            record = {
                "task_id": str(task["id"]),
                "classification": classification,
                "action": action,
                "action_status": action_status,
                "at": now,
            }
            if action_status.startswith("자동 조치 실패"):
                # 실패한 자동 조치는 같은 blocked 서명이라도 일정 시간 뒤 재시도한다.
                # 단, 매 주기 Telegram 폭주를 막기 위해 기본 10분 backoff를 둔다.
                previous_attempts = 0
                if isinstance(existing, dict):
                    previous_attempts = int(existing.get("attempts") or 0)
                record["attempts"] = previous_attempts + 1
                record["retry_after"] = now + 600
            state.setdefault("seen", {})[key] = record
            sent += 1
        state["last_checked_at"] = int(time.time())
        state["db_health"] = "ok"
        write_state(state_path, state)
        print(f"triage checked blocked={len(blocked_tasks(conn))} sent={sent}")
        return 0
    except sqlite3.Error as exc:
        msg = str(exc).lower()
        if any(marker in msg for marker in CORRUPTION_MARKERS):
            print(f"DB circuit-breaker: {exc}", file=sys.stderr)
            return 75
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Groupware direct Telegram safe triage watcher")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--env-file", default=str(DEFAULT_ENV))
    parser.add_argument("--state-file", default=str(DEFAULT_STATE))
    parser.add_argument("--lock-file", default=str(DEFAULT_LOCK))
    parser.add_argument("--chat-id", default=os.environ.get("GW_REPORT_CHAT_ID"))
    parser.add_argument("--interval", type=int, default=90)
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--max-messages-per-cycle", type=int, default=2)
    parser.add_argument("--corrupt-backoff-seconds", type=int, default=1800)
    args = parser.parse_args()

    Path(args.lock_file).parent.mkdir(parents=True, exist_ok=True)
    with open(args.lock_file, "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("another groupware safe triage watcher is already running")
            return 0
        while True:
            code = run_once(args)
            if args.once:
                return code
            time.sleep(args.corrupt_backoff_seconds if code == 75 else max(30, int(args.interval)))


if __name__ == "__main__":
    raise SystemExit(main())
