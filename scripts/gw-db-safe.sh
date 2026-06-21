#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEON_ENV="$ROOT/.secrets/neon.env"
if [[ -f "$NEON_ENV" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$NEON_ENV"; set +a
fi

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


def resolve_target(env_name: str) -> str:
    return "production" if env_name == "prod" else "preview"


def resolve_db_target(env_name: str, *, allow_preview_fallback: bool = False) -> tuple[str, str, bool, str]:
    target = resolve_target(env_name)
    preview_url = (os.environ.get("DATABASE_URL_PREVIEW") or "").strip()
    production_url = (os.environ.get("DATABASE_URL_PRODUCTION") or "").strip()
    explicit_url = (os.environ.get("DATABASE_URL") or "").strip()

    if target == "preview":
        if preview_url:
            return preview_url, "DATABASE_URL_PREVIEW", False, ""
        if allow_preview_fallback and explicit_url:
            return explicit_url, "DATABASE_URL", True, ""
        reason = (
            "DATABASE_URL_PREVIEW 없음"
            if not allow_preview_fallback
            else "DATABASE_URL_PREVIEW / DATABASE_URL 모두 없음"
        )
        return "", "", False, reason

    if production_url:
        return production_url, "DATABASE_URL_PRODUCTION", False, ""

    return "", "", False, "production 은 DATABASE_URL_PRODUCTION 필수, DATABASE_URL fallback 금지"


def seed_command(target: str) -> list[str]:
    return ["pnpm", f"db:pg:seed:{target}"]


def migration_command(target: str, apply: bool, json_output: bool) -> list[str]:
    cmd = ["node", "scripts/apply-operational-postgres-migrations.mjs", target]
    if apply:
        cmd.append("--apply")
    if json_output:
        cmd.append("--json")
    return cmd


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="그룹웨어 DB 안전 래퍼. DATABASE_URL 원문은 출력하지 않습니다.")
    p.add_argument("--env", choices=sorted(VALID_ENVS), required=True, help="대상 환경")
    p.add_argument("--mode", choices=sorted(VALID_MODES), required=True, help="실행 모드")
    p.add_argument("--approved", action="store_true", help="사용자 승인 확인 후 실제 실행 허용")
    p.add_argument("--allow-seed", action="store_true", help="dev/staging seed-apply 허용")
    p.add_argument(
        "--allow-preview-fallback",
        action="store_true",
        help="수동 preview/local 점검에서만 DATABASE_URL 을 preview fallback 으로 허용",
    )
    p.add_argument("--json", action="store_true")
    p.add_argument("--preview", action="store_true", help="실제 실행 없이 예정 작업만 출력")
    return p


def masked_db(url: str) -> str:
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
    target = resolve_target(args.env)
    db_url, source_env, used_fallback, db_reason = resolve_db_target(
        args.env,
        allow_preview_fallback=args.allow_preview_fallback,
    )

    if args.mode == "status":
        planned = migration_command(target, apply=False, json_output=args.json)
    elif args.mode in {"migrate-preview", "migrate-apply"}:
        planned = migration_command(target, apply=args.mode == "migrate-apply", json_output=args.json)
        if args.mode == "migrate-apply" and not args.approved:
            allowed = False
            reason = "migrate-apply는 --approved 없이는 실행 금지"
    elif args.mode in {"seed-preview", "seed-apply"}:
        planned = seed_command(target)
        if args.mode == "seed-apply":
            if args.env == "prod":
                allowed = False
                reason = "prod seed-apply는 이 스크립트에서 기본 금지"
            elif not (args.approved and args.allow_seed):
                allowed = False
                reason = "seed-apply는 dev/staging + --allow-seed + --approved 필요"

    is_preview = args.preview or args.mode.endswith("preview") or not allowed
    if db_reason:
        allowed = False
        reason = db_reason if not reason else f"{reason}; {db_reason}"
        is_preview = True

    payload = {
        "env": args.env,
        "target": target,
        "mode": args.mode,
        "db": masked_db(db_url),
        "source_env": source_env or None,
        "preview_fallback": used_fallback,
        "planned_command": planned,
        "will_execute": not is_preview,
        "allowed": allowed,
        "reason": reason,
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"대상 환경: {args.env}")
        print(f"대상 DB: {target}")
        print(f"DB: {payload['db']}")
        print("선택 변수:", payload["source_env"] or "없음")
        print("preview fallback:", "허용 사용" if payload["preview_fallback"] else "미사용")
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
