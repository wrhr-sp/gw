#!/usr/bin/env bash
set -euo pipefail

cd /home/wrhrgw/gw

PROFILE_HOME="${SINGDE_HOME:-/home/wrhrgw/gw-dev-bot/.hermes/profiles/singde/home}"
export HOME="$PROFILE_HOME"
export XDG_CONFIG_HOME="$PROFILE_HOME/.config"
export XDG_STATE_HOME="$PROFILE_HOME/.local/state"

LIMIT="${1:-5}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI를 찾지 못했습니다. GitHub Actions 상태는 GitHub 웹 화면에서 확인해야 합니다." >&2
  exit 127
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh 인증을 확인하지 못했습니다. singde 프로필의 GitHub 인증 상태를 점검하세요." >&2
  exit 1
fi

echo "그룹웨어 GitHub Actions 최근 실행 ${LIMIT}개"
gh run list --limit "$LIMIT"

echo
LATEST_ID="$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
if [[ -z "$LATEST_ID" ]]; then
  echo "최근 GitHub Actions 실행을 찾지 못했습니다."
  exit 0
fi

echo "최신 실행 상세: ${LATEST_ID}"
gh run view "$LATEST_ID"

CONCLUSION="$(gh run view "$LATEST_ID" --json conclusion --jq '.conclusion // empty')"
if [[ "$CONCLUSION" == "failure" || "$CONCLUSION" == "cancelled" || "$CONCLUSION" == "timed_out" || "$CONCLUSION" == "action_required" ]]; then
  echo
  echo "실패/중단 로그 요약"
  gh run view "$LATEST_ID" --log-failed || true
fi
