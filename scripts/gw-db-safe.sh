#!/usr/bin/env bash
set -euo pipefail

python3 - "$@" <<'PY'
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from urllib.parse import urlparse

VALID_MODES = {"status", "migrate-preview", "migrate-apply", "seed-preview", "seed-apply"}
VALID_ENVS = {"dev", "staging", "prod"}


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="그룹웨어 DB 안전 래퍼. DATABASE_URL 원문은 출력하지 않습니다.")
    p.add_argument("--env", choices=sorted(VALID_ENVS), required=True, help="대상 환경")
    p.add_argument("--mode", choices=sorted(VALID_MODES), required=True, help="실행 모드")
    p.add_argument("--approved", action="store_true", help="사용자 승인 확인 후 실제 실행 허용")
    p.add_argument("--allow-seed", action="store_true", help="dev/staging seed-apply 허용")
    p.add_argument("--json", action="store_true")
    p.add_argument("--preview", action="store_true", help="실제 실행 없이 예정 작업만 출력")
    return p


def masked_db() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        return "DATABASE_URL 없음"
    parsed = urlparse(url)
    host = parsed.hostname or "unknown"
    if len(host) > 12:
        host = host[:4] + "…" + host[-6:]
    return f"scheme={parsed.scheme or 'unknown'} host={host} db={(parsed.path or '/').lstrip('/') or 'unknown'}"


def run_cmd(cmd: list[str]) -> int:
    print("실행 명령:", " ".join(cmd))
    proc = subprocess.run(cmd, text=True)
    return proc.returncode


def main() -> int:
    args = parser().parse_args()
    planned: list[str] = []
    allowed = True
    reason = ""

    if args.mode == "status":
        planned = ["pnpm", "exec", "prisma", "migrate", "status"]
    elif args.mode in {"migrate-preview", "migrate-apply"}:
        planned = ["pnpm", "exec", "prisma", "migrate", "deploy"]
        if args.mode == "migrate-apply" and not args.approved:
            allowed = False
            reason = "migrate-apply는 --approved 없이는 실행 금지"
    elif args.mode in {"seed-preview", "seed-apply"}:
        planned = ["pnpm", "db:seed"]
        if args.mode == "seed-apply":
            if args.env == "prod":
                allowed = False
                reason = "prod seed-apply는 이 스크립트에서 기본 금지"
            elif not (args.approved and args.allow_seed):
                allowed = False
                reason = "seed-apply는 dev/staging + --allow-seed + --approved 필요"

    is_preview = args.preview or args.mode.endswith("preview") or not allowed
    payload = {"env": args.env, "mode": args.mode, "db": masked_db(), "planned_command": planned, "will_execute": not is_preview, "allowed": allowed, "reason": reason}
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"대상 환경: {args.env}")
        print(f"DB: {masked_db()}")
        print("예정 명령:", " ".join(planned))
        print("실행 여부:", "실행" if not is_preview else "미리보기/차단")
        if reason:
            print("차단 이유:", reason)

    if is_preview:
        return 2 if not allowed and args.mode.endswith("apply") else 0
    return run_cmd(planned)

if __name__ == "__main__":
    sys.exit(main())
PY
