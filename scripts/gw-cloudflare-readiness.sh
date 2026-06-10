#!/usr/bin/env bash
set -euo pipefail

python3 - "$@" <<'PY'
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="gw-cloudflare-readiness.sh",
        description="Cloudflare 전환 준비 상태를 secret 값 출력 없이 점검합니다. 기본값은 strict 실패 전파입니다.",
    )
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="실패 항목이 있어도 보고용으로 exit code 0을 반환합니다. CI/배포 게이트에서는 사용하지 마세요.",
    )
    return parser.parse_args()


args = parse_args()
root = Path.cwd()
checks = []

def add(name: str, ok: bool, detail: str) -> None:
    checks.append({"name": name, "ok": ok, "detail": detail})

add("repo-root", (root / "package.json").exists() and (root / "apps").exists(), str(root))
add("web-app", (root / "apps/web/package.json").exists(), "apps/web")
add("api-app", (root / "apps/api/package.json").exists(), "apps/api")
add("api-cloudflare-app", (root / "apps/api-cloudflare/package.json").exists(), "apps/api-cloudflare")
add("prisma-schema", (root / "prisma/schema.prisma").exists(), "prisma/schema.prisma")
add("cloudflare-target-doc", (root / "docs/architecture/cloudflare-target-architecture.md").exists(), "docs/architecture/cloudflare-target-architecture.md")
add("cloudflare-plan-doc", (root / "docs/plans/cloudflare-full-stack-migration-plan.md").exists(), "docs/plans/cloudflare-full-stack-migration-plan.md")
add("cloudflare-workers-bootstrap-doc", (root / "docs/plans/cloudflare-workers-api-hyperdrive-bootstrap.md").exists(), "docs/plans/cloudflare-workers-api-hyperdrive-bootstrap.md")
add("wrangler-cli", shutil.which("wrangler") is not None or shutil.which("npx") is not None, "wrangler direct or via npx")
wrangler_path = root / "apps/api-cloudflare/wrangler.toml"
if wrangler_path.exists():
    wrangler_text = wrangler_path.read_text(errors="replace")
    add("wrangler-hyperdrive-binding", "[[hyperdrive]]" in wrangler_text, "apps/api-cloudflare/wrangler.toml has hyperdrive binding")
    add("wrangler-no-d1-default", "[[d1_databases]]" not in wrangler_text, "apps/api-cloudflare/wrangler.toml avoids default d1 binding")
else:
    add("wrangler-hyperdrive-binding", False, "apps/api-cloudflare/wrangler.toml missing")
    add("wrangler-no-d1-default", False, "apps/api-cloudflare/wrangler.toml missing")
secret_path = root / ".secrets/cloudflare.env"
add("cloudflare-secret-file", secret_path.exists(), ".secrets/cloudflare.env")
if secret_path.exists():
    text = secret_path.read_text(errors="replace")
    for key in ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]:
        add(f"secret-{key}", f"{key}=" in text, f"{key} present")
else:
    for key in ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]:
        add(f"secret-{key}", False, "secret file missing")

ok = all(c["ok"] for c in checks)
print(json.dumps({"ok": ok, "checks": checks, "strict": not args.report_only}, ensure_ascii=False, indent=2))
if not ok and not args.report_only:
    sys.exit(1)
PY
