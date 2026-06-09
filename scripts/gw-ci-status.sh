#!/usr/bin/env bash
set -euo pipefail
cd /home/wrhrgw/gw
LIMIT="${1:-5}"
if ! command -v gh >/dev/null 2>&1; then echo "gh CLI를 찾지 못했습니다." >&2; exit 127; fi
if [[ ! -d .git ]]; then echo "/home/wrhrgw/gw 는 아직 Git 저장소가 아닙니다. GitHub Actions 상태 확인은 보류합니다."; exit 0; fi
if ! gh auth status >/dev/null 2>&1; then echo "gh 인증을 확인하지 못했습니다." >&2; exit 1; fi
echo "그룹웨어 GitHub Actions 최근 실행 ${LIMIT}개"
gh run list --limit "$LIMIT"
LATEST_ID="$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
if [[ -n "$LATEST_ID" ]]; then echo; echo "최신 실행 상세: ${LATEST_ID}"; gh run view "$LATEST_ID"; fi
