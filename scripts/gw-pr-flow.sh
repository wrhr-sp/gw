#!/usr/bin/env bash
set -euo pipefail

# 그룹웨어 GitHub PR 흐름 보조 스크립트
# 기본값은 미리보기/조회다. 생성, merge, branch 삭제는 --approved 없이는 실행하지 않는다.

BASE="main"
HEAD=""
TITLE=""
BODY=""
BODY_FILE=""
CREATE="0"
SHOW_STATUS="0"
WAIT_CI="0"
MERGE="0"
DELETE_BRANCH="0"
APPROVED="0"
MERGE_METHOD="squash"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="${2:?--base requires branch}"; shift 2 ;;
    --head) HEAD="${2:?--head requires branch}"; shift 2 ;;
    --title) TITLE="${2:?--title requires text}"; shift 2 ;;
    --body) BODY="${2:?--body requires text}"; shift 2 ;;
    --body-file) BODY_FILE="${2:?--body-file requires path}"; shift 2 ;;
    --create) CREATE="1"; shift ;;
    --show-status) SHOW_STATUS="1"; shift ;;
    --wait-ci) WAIT_CI="1"; shift ;;
    --merge) MERGE="1"; shift ;;
    --delete-branch) DELETE_BRANCH="1"; shift ;;
    --approved|--yes) APPROVED="1"; shift ;;
    --merge-method) MERGE_METHOD="${2:?--merge-method requires squash|merge|rebase}"; shift 2 ;;
    -h|--help) sed -n '1,80p' "$0"; exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 2 ;;
  esac
done

cd /home/wrhrgw/gw
if [[ ! -d .git ]]; then
  echo "/home/wrhrgw/gw 는 아직 Git 저장소가 아닙니다. PR 자동화는 준비만 된 상태입니다."
  exit 0
fi
if ! command -v gh >/dev/null 2>&1; then echo "gh CLI를 찾지 못했습니다." >&2; exit 127; fi
if ! gh auth status >/dev/null 2>&1; then echo "gh 인증을 확인하지 못했습니다." >&2; exit 1; fi

if [[ -z "$HEAD" ]]; then HEAD="$(git branch --show-current)"; fi
if [[ -z "$HEAD" ]]; then echo "현재 브랜치를 확인하지 못했습니다. --head 를 지정하세요." >&2; exit 2; fi

if [[ -n "$BODY_FILE" ]]; then BODY="$(cat "$BODY_FILE")"; fi

echo "PR 흐름 점검"
echo "base=$BASE"
echo "head=$HEAD"
echo "approved=$APPROVED"
echo "create=$CREATE merge=$MERGE delete_branch=$DELETE_BRANCH wait_ci=$WAIT_CI"
echo

echo "현재 git 상태"
git status --short

echo
if gh pr view "$HEAD" --json number,title,state,url,mergeStateStatus,isDraft,headRefName,baseRefName >/tmp/gw_pr.json 2>/dev/null; then
  echo "기존 PR:"
  gh pr view "$HEAD" --json number,title,state,url,mergeStateStatus,isDraft,headRefName,baseRefName --jq '. | "#\(.number) \(.title) [\(.state)] \(.url) merge=\(.mergeStateStatus) draft=\(.isDraft)"'
else
  echo "기존 PR 없음(head=$HEAD)"
fi

if [[ "$CREATE" == "1" ]]; then
  if [[ "$APPROVED" != "1" ]]; then
    echo "미리보기: PR 생성은 --create --approved 조합에서만 실행합니다."
    echo "예상 명령: gh pr create --base '$BASE' --head '$HEAD' --title '$TITLE' --body '<body>'"
  else
    [[ -n "$TITLE" ]] || { echo "--title 필요" >&2; exit 2; }
    gh pr create --base "$BASE" --head "$HEAD" --title "$TITLE" --body "$BODY"
  fi
fi

if [[ "$SHOW_STATUS" == "1" || "$WAIT_CI" == "1" || "$MERGE" == "1" ]]; then
  echo
  echo "PR/CI 상태"
  gh pr checks "$HEAD" ${WAIT_CI:+--watch} || true
fi

if [[ "$MERGE" == "1" ]]; then
  if [[ "$APPROVED" != "1" ]]; then
    echo "미리보기: PR merge는 --merge --approved 조합에서만 실행합니다."
  else
    gh pr merge "$HEAD" --"$MERGE_METHOD"
  fi
fi

if [[ "$DELETE_BRANCH" == "1" ]]; then
  if [[ "$APPROVED" != "1" ]]; then
    echo "미리보기: branch 삭제는 --delete-branch --approved 조합에서만 실행합니다."
  else
    git branch -d "$HEAD" || true
    git push origin --delete "$HEAD" || true
  fi
fi
