import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scripts.gw_pr_flow as gw_pr_flow
from scripts.gw_pr_flow import (
    branch_cleanup_safe,
    branch_matches_base,
    classify_changed_files,
    filter_dirty_paths,
    gh_env,
    local_check_commands,
)


class GwPrFlowTests(unittest.TestCase):
    def git(self, cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env.update(
            {
                "GIT_AUTHOR_NAME": "Test User",
                "GIT_AUTHOR_EMAIL": "test@example.com",
                "GIT_COMMITTER_NAME": "Test User",
                "GIT_COMMITTER_EMAIL": "test@example.com",
            }
        )
        return subprocess.run(
            ["git", *args],
            cwd=cwd,
            env=env,
            text=True,
            capture_output=True,
            check=check,
        )

    def test_filter_dirty_paths_ignores_generated_artifacts(self):
        paths = [
            "apps/web/.next/server/app.js",
            "apps/web/.open-next/worker.js",
            "apps/web/.wrangler/tmp/state.json",
            ".hermes/run.state",
            "apps/web/tsconfig.tsbuildinfo",
            "scripts/__pycache__/gw_pr_flow.cpython-311.pyc",
            "scripts/gw-pr-flow.sh",
        ]

        self.assertEqual(filter_dirty_paths(paths), ["scripts/gw-pr-flow.sh"])

    def test_classify_changed_files_groups_paths_by_area(self):
        summary = classify_changed_files(
            [
                "apps/web/app/admin/audit-logs/page.tsx",
                "scripts/gw-pr-flow.sh",
                "docs/plans/release-gate.md",
                ".github/workflows/release-gate.yml",
                "README.md",
            ]
        )

        self.assertEqual(summary["app"], ["apps/web/app/admin/audit-logs/page.tsx"])
        self.assertEqual(summary["scripts"], ["scripts/gw-pr-flow.sh"])
        self.assertEqual(summary["docs"], ["README.md", "docs/plans/release-gate.md"])
        self.assertEqual(summary["workflow"], [".github/workflows/release-gate.yml"])
        self.assertEqual(summary["other"], [])

    def test_local_check_commands_include_cloudflare_build_optionally(self):
        self.assertEqual(
            local_check_commands(include_cloudflare=False),
            ["pnpm check", "pnpm --filter @gw/web build"],
        )
        self.assertEqual(
            local_check_commands(include_cloudflare=True),
            ["pnpm check", "pnpm --filter @gw/web build", "pnpm --filter @gw/web build:cf"],
        )

    def test_branch_cleanup_requires_merge_equivalence_and_remote_cleanup(self):
        self.assertFalse(
            branch_cleanup_safe(
                merge_confirmed=False,
                branch_matches_main=True,
                remote_branch_exists=False,
            )
        )
        self.assertFalse(
            branch_cleanup_safe(
                merge_confirmed=True,
                branch_matches_main=False,
                remote_branch_exists=False,
            )
        )
        self.assertFalse(
            branch_cleanup_safe(
                merge_confirmed=True,
                branch_matches_main=True,
                remote_branch_exists=True,
            )
        )
        self.assertTrue(
            branch_cleanup_safe(
                merge_confirmed=True,
                branch_matches_main=True,
                remote_branch_exists=False,
            )
        )

    def test_gh_env_prefers_existing_xdg_hosts_and_falls_back_to_home_config(self):
        with patch.dict(gw_pr_flow.os.environ, {"XDG_CONFIG_HOME": "/tmp/xdg", "HOME": "/tmp/home"}, clear=True):
            with patch.object(gw_pr_flow.Path, "exists", autospec=True, side_effect=lambda path: str(path) == "/tmp/xdg/gh/hosts.yml"):
                self.assertEqual(gh_env()["XDG_CONFIG_HOME"], "/tmp/xdg")

        with patch.dict(gw_pr_flow.os.environ, {"HOME": "/tmp/home"}, clear=True):
            with patch.object(gw_pr_flow.Path, "exists", autospec=True, side_effect=lambda path: str(path) == "/tmp/home/.config/gh/hosts.yml"):
                self.assertEqual(gh_env()["XDG_CONFIG_HOME"], "/tmp/home/.config")

        with patch.dict(gw_pr_flow.os.environ, {"HOME": "/tmp/home"}, clear=True):
            with patch.object(gw_pr_flow.Path, "exists", autospec=True, return_value=False):
                self.assertNotIn("XDG_CONFIG_HOME", gh_env())

    def test_shell_wrapper_matches_python_entrypoint_for_dirty_worktree_block(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = Path(tmpdir)
            self.git(repo, "init", "-b", "main")
            (repo / "tracked.txt").write_text("base\n")
            self.git(repo, "add", "tracked.txt")
            self.git(repo, "commit", "-m", "init")
            (repo / "tracked.txt").write_text("dirty\n")

            wrapper = subprocess.run(
                ["bash", "/home/wrhrgw/gw/scripts/gw-pr-flow.sh", "--create", "--title", "test", "--preview", "--json"],
                cwd=repo,
                text=True,
                capture_output=True,
            )
            python_entry = subprocess.run(
                ["python3", "/home/wrhrgw/gw/scripts/gw_pr_flow.py", "--create", "--title", "test", "--preview", "--json"],
                cwd=repo,
                text=True,
                capture_output=True,
            )

            self.assertEqual(wrapper.returncode, python_entry.returncode)
            self.assertEqual(wrapper.stdout, python_entry.stdout)

    def test_branch_matches_base_accepts_squash_merged_equivalent_branch(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = Path(tmpdir)
            self.git(repo, "init", "-b", "main")
            (repo / "app.txt").write_text("base\n")
            self.git(repo, "add", "app.txt")
            self.git(repo, "commit", "-m", "base")
            self.git(repo, "checkout", "-b", "feature/squash-safe")
            (repo / "app.txt").write_text("feature change\n")
            self.git(repo, "commit", "-am", "feature work")
            self.git(repo, "checkout", "main")
            (repo / "app.txt").write_text("feature change\n")
            self.git(repo, "commit", "-am", "squash merge feature")

            with patch.object(gw_pr_flow, "run", wraps=gw_pr_flow.run):
                previous_cwd = Path.cwd()
                try:
                    os.chdir(repo)
                    self.assertTrue(branch_matches_base("feature/squash-safe", "main"))
                finally:
                    os.chdir(previous_cwd)


if __name__ == "__main__":
    unittest.main()
