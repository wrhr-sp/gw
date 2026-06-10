#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from __future__ import annotations

import json
import os
import sys

TRUE_VALUES = {"1", "true", "yes", "on"}
PUBLIC_ENV_VALUES = {"production", "prod", "public"}
PUBLIC_VISIBILITY_VALUES = {"public", "external", "internet"}
PRODUCTION_BRANCHES = {"main", "master", "production", "prod"}

def enabled(name: str) -> bool:
    value = os.environ.get(name, "").strip().lower()
    return value in TRUE_VALUES

def lowered(name: str) -> str:
    return os.environ.get(name, "").strip().lower()

enable_test_auth = enabled("ENABLE_TEST_AUTH")
deploy_env = lowered("DEPLOY_ENV") or lowered("NODE_ENV")
deploy_visibility = lowered("DEPLOY_VISIBILITY")
cf_pages_branch = lowered("CF_PAGES_BRANCH")
public_preview = enabled("CLOUDFLARE_PUBLIC_PREVIEW")

is_public_target = (
    deploy_env in PUBLIC_ENV_VALUES
    or deploy_visibility in PUBLIC_VISIBILITY_VALUES
    or cf_pages_branch in PRODUCTION_BRANCHES
    or public_preview
)

result = {
    "ok": not (enable_test_auth and is_public_target),
    "checks": {
        "enable_test_auth": enable_test_auth,
        "deploy_env": deploy_env or None,
        "deploy_visibility": deploy_visibility or None,
        "cf_pages_branch": cf_pages_branch or None,
        "cloudflare_public_preview": public_preview,
        "public_target": is_public_target,
    },
    "message": "public/prod 배포에서는 ENABLE_TEST_AUTH를 켜지 마세요.",
    "how_to_fix": [
        "공개 Preview/production 배포 전 ENABLE_TEST_AUTH=false로 내립니다.",
        "검증용 mock 예약은 비공개 dev/staging 환경에서만 확인합니다.",
        "배포 파이프라인에서는 DEPLOY_ENV 또는 DEPLOY_VISIBILITY를 함께 넘겨 가드를 확실히 켭니다.",
    ],
}

print(json.dumps(result, ensure_ascii=False, indent=2))

if not result["ok"]:
    sys.exit(1)
PY