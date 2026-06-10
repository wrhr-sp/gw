# Release gate notes

- Required baseline sequence: `pnpm install --frozen-lockfile` -> `pnpm check` -> `pnpm --filter @gw/web build`
- Visibility-only Cloudflare check: `pnpm --filter @gw/web build:cf` as separate `cloudflare-build` job until branch protection promotes it
- `scripts/gw-pr-flow.sh` blocks PR create/merge/delete on dirty worktrees except generated artifacts (`.next`, `.open-next`, `.wrangler`, `.hermes/*.state`, `*.tsbuildinfo`, `__pycache__`)
- Release gate scope excludes secret output/commit, production DB changes, DNS/custom domain changes, paid resources, and real R2 operations without separate approval
