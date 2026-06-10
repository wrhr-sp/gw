from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable

REPO = "wrhr-sp/gw"
GENERATED_PREFIXES = (
    ".next/",
    ".open-next/",
    ".wrangler/",
    ".hermes/",
    "__pycache__/",
    "apps/web/.next/",
    "apps/web/.open-next/",
    "apps/web/.wrangler/",
    "scripts/__pycache__/",
)
DOC_PREFIXES = ("docs/",)
SCRIPT_PREFIXES = ("scripts/",)
APP_PREFIXES = ("apps/", "packages/")
WORKFLOW_PREFIX = ".github/workflows/"


def gh_env() -> dict[str, str]:
    env = os.environ.copy()
    xdg_config_home = env.get("XDG_CONFIG_HOME")
    current_hosts = Path(xdg_config_home) / "gh" / "hosts.yml" if xdg_config_home else None
    if current_hosts and current_hosts.exists():
        return env

    default_config_home = Path(env.get("HOME", str(Path.home()))) / ".config"
    default_hosts = default_config_home / "gh" / "hosts.yml"
    if default_hosts.exists():
        env["XDG_CONFIG_HOME"] = str(default_config_home)
    return env


def run(cmd: list[str], check: bool = True, capture_output: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=capture_output, env=gh_env(), check=check)


def current_branch() -> str:
    return run(["git", "branch", "--show-current"]).stdout.strip()


def is_generated_path(path: str) -> bool:
    normalized = path.strip()
    if normalized.startswith("./"):
        normalized = normalized[2:]
    if normalized.endswith(".tsbuildinfo"):
        return True
    if normalized.startswith(".hermes/") and normalized.endswith(".state"):
        return True
    return any(normalized.startswith(prefix) for prefix in GENERATED_PREFIXES)


def filter_dirty_paths(paths: Iterable[str]) -> list[str]:
    return [path for path in paths if not is_generated_path(path)]


def classify_changed_files(paths: Iterable[str]) -> dict[str, list[str]]:
    summary = {"workflow": [], "scripts": [], "docs": [], "app": [], "other": []}
    for path in sorted(paths):
        normalized = path
        if normalized.startswith("./"):
            normalized = normalized[2:]
        if normalized.startswith(WORKFLOW_PREFIX):
            summary["workflow"].append(path)
        elif normalized.startswith(SCRIPT_PREFIXES):
            summary["scripts"].append(path)
        elif normalized == "README.md" or normalized.startswith(DOC_PREFIXES):
            summary["docs"].append(path)
        elif normalized.startswith(APP_PREFIXES):
            summary["app"].append(path)
        else:
            summary["other"].append(path)
    return summary


def local_check_commands(include_cloudflare: bool) -> list[str]:
    commands = ["pnpm check", "pnpm --filter @gw/web build"]
    if include_cloudflare:
        commands.append("pnpm --filter @gw/web build:cf")
    return commands


def branch_cleanup_safe(*, merge_confirmed: bool, branch_matches_main: bool, remote_branch_exists: bool) -> bool:
    return merge_confirmed and branch_matches_main and not remote_branch_exists


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="그룹웨어 PR lifecycle 안전 보조. 기본은 preview/status이며 merge/delete는 --approved 필요.")
    p.add_argument("--base", default="main")
    p.add_argument("--head", default="", help="기본값: 현재 브랜치")
    p.add_argument("--title", default="")
    p.add_argument("--body", default="")
    p.add_argument("--body-file")
    p.add_argument("--create", action="store_true")
    p.add_argument("--show-status", action="store_true")
    p.add_argument("--wait-ci", action="store_true")
    p.add_argument("--merge", action="store_true")
    p.add_argument("--delete-branch", action="store_true")
    p.add_argument("--approved", action="store_true", help="위험 작업 승인 확인")
    p.add_argument("--preview", action="store_true", help="실제 생성/merge/delete 없이 출력")
    p.add_argument("--json", action="store_true")
    p.add_argument("--include-cloudflare-check", action="store_true", help="local substitute check 목록에 build:cf 포함")
    p.add_argument("--allow-local-substitute-checks", action="store_true", help="CI가 없을 때 local evidence로 merge 허용")
    p.add_argument("--local-check-passed", action="append", default=[], help="실행/통과한 local check 명령을 기록")
    return p


def git_status_paths() -> list[str]:
    proc = run(["git", "status", "--short"], check=False)
    paths: list[str] = []
    for raw_line in proc.stdout.splitlines():
        if not raw_line:
            continue
        path_part = raw_line[3:] if len(raw_line) > 3 else raw_line
        if " -> " in path_part:
            path_part = path_part.split(" -> ", 1)[1]
        paths.append(path_part.strip())
    return paths


def pr_view(head: str) -> dict | None:
    proc = run(
        [
            "gh",
            "pr",
            "view",
            head,
            "--repo",
            REPO,
            "--json",
            "number,url,state,mergeStateStatus,statusCheckRollup,headRefName,baseRefName,isDraft",
        ],
        check=False,
    )
    if proc.returncode != 0:
        return None
    return json.loads(proc.stdout)


def pr_checks(number: int, wait: bool) -> int:
    cmd = ["gh", "pr", "checks", str(number), "--repo", REPO]
    if wait:
        cmd.extend(["--watch", "--fail-fast"])
    proc = subprocess.run(cmd, env=gh_env(), text=True)
    return proc.returncode


def checks_green(pr: dict) -> bool:
    checks = pr.get("statusCheckRollup") or []
    if not checks:
        return False
    for check_info in checks:
        if check_info.get("__typename") == "StatusContext":
            if check_info.get("state") != "SUCCESS":
                return False
        elif check_info.get("status") != "COMPLETED" or check_info.get("conclusion") != "SUCCESS":
            return False
    return True


def remote_branch_exists(branch: str) -> bool:
    proc = run(["git", "ls-remote", "--heads", "origin", branch], check=False)
    return bool(proc.stdout.strip())


def branch_matches_base(branch: str, base: str) -> bool:
    diff_proc = run(["git", "diff", "--quiet", f"{branch}..{base}"], check=False, capture_output=True)
    if diff_proc.returncode == 0:
        return True

    branch_patch = run(["git", "diff", "--binary", f"{base}...{branch}"], check=False)
    base_patch = run(["git", "diff", "--binary", f"{branch}...{base}"], check=False)
    if branch_patch.returncode != 0 or base_patch.returncode != 0:
        return False

    branch_patch_id = subprocess.run(
        ["git", "patch-id", "--stable"],
        input=branch_patch.stdout,
        text=True,
        capture_output=True,
        check=False,
        env=gh_env(),
    )
    base_patch_id = subprocess.run(
        ["git", "patch-id", "--stable"],
        input=base_patch.stdout,
        text=True,
        capture_output=True,
        check=False,
        env=gh_env(),
    )
    if branch_patch_id.returncode != 0 or base_patch_id.returncode != 0:
        return False

    branch_ids = {line.split()[0] for line in branch_patch_id.stdout.splitlines() if line.strip()}
    base_ids = {line.split()[0] for line in base_patch_id.stdout.splitlines() if line.strip()}
    return bool(branch_ids) and branch_ids == base_ids


def ensure_worktree_clean_or_exit(paths: list[str], actions: list[str]) -> None:
    relevant = filter_dirty_paths(paths)
    if relevant:
        actions.append("DIRTY_WORKTREE_BLOCKED")
        actions.append(f"relevant changes: {', '.join(relevant)}")
        actions.append("generated artifacts ignored: .next/.open-next/.wrangler/.hermes/*.state/*.tsbuildinfo")
        raise SystemExit(8)


def ensure_local_substitute_or_green(pr: dict, args: argparse.Namespace, actions: list[str]) -> None:
    if checks_green(pr):
        actions.append("CI green on latest head")
        return

    checks = pr.get("statusCheckRollup") or []
    commands = local_check_commands(include_cloudflare=args.include_cloudflare_check)
    if checks:
        raise SystemExit("CI/check가 green이 아니라 merge 차단")
    actions.append("CI 없음: local substitute evidence 필요")
    actions.append("required local checks: " + ", ".join(commands))
    if not args.allow_local_substitute_checks:
        raise SystemExit(9)

    missing = [command for command in commands if command not in args.local_check_passed]
    if missing:
        raise SystemExit("local substitute checks 누락: " + ", ".join(missing))
    actions.append("local substitute checks confirmed: " + ", ".join(args.local_check_passed))


def main() -> int:
    args = parser().parse_args()
    if not shutil.which("gh"):
        print("gh CLI가 필요합니다.", file=sys.stderr)
        return 127

    head = args.head or current_branch()
    body = args.body
    if args.body_file:
        body = Path(args.body_file).read_text()

    actions: list[str] = []
    worktree_paths = git_status_paths()
    relevant_dirty = filter_dirty_paths(worktree_paths)
    if relevant_dirty:
        actions.append("changed file summary: " + json.dumps(classify_changed_files(relevant_dirty), ensure_ascii=False))
    elif worktree_paths:
        actions.append("only generated/local artifacts are dirty; PR gate ignores them")

    needs_clean_worktree = args.create or args.merge or args.delete_branch
    if needs_clean_worktree:
        try:
            ensure_worktree_clean_or_exit(worktree_paths, actions)
        except SystemExit as exc:
            exit_code = exc.code if isinstance(exc.code, int) else 8
            if args.json:
                print(json.dumps({"head": head, "actions": actions, "blocked": "dirty_worktree", "exit_code": exit_code}, ensure_ascii=False, indent=2))
                return exit_code
            for item in actions:
                print(item)
            print("dirty worktree가 있어 PR 생성/merge/branch cleanup 차단", file=sys.stderr)
            return exit_code

    pr = pr_view(head)

    if args.create:
        if pr:
            actions.append(f"기존 PR 사용: #{pr['number']} {pr['url']}")
        elif args.preview or not args.approved:
            actions.append(f"WOULD_CREATE_PR base={args.base} head={head} title={args.title!r}")
        else:
            if not args.title:
                print("--create 실행에는 --title 필요", file=sys.stderr)
                return 2
            cmd = ["gh", "pr", "create", "--repo", REPO, "--base", args.base, "--head", head, "--title", args.title, "--body", body or ""]
            url = run(cmd).stdout.strip()
            actions.append(f"CREATED {url}")
            pr = pr_view(head)

    if args.show_status or args.wait_ci or args.merge or args.delete_branch:
        if not pr:
            print(f"PR 없음: head={head}", file=sys.stderr)
            return 3
        actions.append(f"PR #{pr['number']} {pr['url']} state={pr.get('state')} mergeState={pr.get('mergeStateStatus')}")
        actions.append("local substitute checks: " + ", ".join(local_check_commands(include_cloudflare=args.include_cloudflare_check)))
        actions.append("safety gate: no secret output/commit, no production DB/DNS/paid/R2 ops")
        if args.wait_ci:
            code = pr_checks(pr["number"], wait=True)
            if code != 0:
                return code
            pr = pr_view(head) or pr

    if args.merge:
        if not args.approved:
            print("merge는 --approved 없이는 실행 금지", file=sys.stderr)
            return 4
        if args.preview:
            actions.append("WOULD_MERGE")
        else:
            current_pr = pr_view(head) or pr
            if not current_pr:
                print(f"PR 정보를 다시 읽지 못했습니다: head={head}", file=sys.stderr)
                return 3
            if current_pr.get("mergeStateStatus") not in {"CLEAN", "HAS_HOOKS"}:
                print(f"mergeStateStatus가 안전하지 않음: {current_pr.get('mergeStateStatus')}", file=sys.stderr)
                return 5
            try:
                ensure_local_substitute_or_green(current_pr, args, actions)
            except SystemExit as exc:
                message = str(exc)
                if message and message != str(exc.code):
                    print(message, file=sys.stderr)
                elif exc.code == 9:
                    print("CI 없음: --allow-local-substitute-checks 와 --local-check-passed 증빙 필요", file=sys.stderr)
                return int(exc.code) if isinstance(exc.code, int) else 9
            cmd = ["gh", "pr", "merge", str(current_pr["number"]), "--repo", REPO, "--squash"]
            if args.delete_branch:
                cmd.append("--delete-branch")
            run(cmd)
            actions.append("MERGED")

    if args.delete_branch:
        if not args.approved:
            print("branch delete는 --approved 없이는 실행 금지", file=sys.stderr)
            return 7
        if args.preview:
            actions.append(f"WOULD_DELETE_BRANCH {head}")
        else:
            merged = pr_view(head)
            merge_confirmed = bool(merged and merged.get("state") == "MERGED")
            matches_base = branch_matches_base(head, args.base)
            remote_exists = remote_branch_exists(head)
            actions.append(f"cleanup evidence: merge_confirmed={merge_confirmed} branch_matches_{args.base}={matches_base} remote_exists={remote_exists}")
            if not branch_cleanup_safe(
                merge_confirmed=merge_confirmed,
                branch_matches_main=matches_base,
                remote_branch_exists=remote_exists,
            ):
                print("squash-safe local branch cleanup 근거가 부족해 삭제 차단", file=sys.stderr)
                return 10
            run(["git", "branch", "-d", head], check=False)
            actions.append(f"LOCAL_BRANCH_DELETED {head}")

    if args.json:
        print(json.dumps({"head": head, "actions": actions, "pr": pr}, ensure_ascii=False, indent=2))
    else:
        for item in actions or ["할 작업 없음. --show-status/--create/--wait-ci/--merge 중 하나를 지정하세요."]:
            print(item)
    return 0


if __name__ == "__main__":
    sys.exit(main())
