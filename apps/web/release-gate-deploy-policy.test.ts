import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflowSource = readFileSync(join(__dirname, "../../.github/workflows/release-gate.yml"), "utf8");

describe("release-gate deployment policy", () => {
  it("deploys preview automatically but keeps production behind manual confirmation", () => {
    expect(workflowSource).toContain("cloudflare-preview-deploy:");
    expect(workflowSource).toContain("pnpm --filter @gw/web deploy:cf:preview");
    expect(workflowSource).toContain("gw-web-preview");

    expect(workflowSource).toContain("workflow_dispatch:");
    expect(workflowSource).toContain("cloudflare-production-deploy:");
    expect(workflowSource).toContain("inputs.confirm_production_deploy == 'DEPLOY_PRODUCTION'");
    expect(workflowSource).toContain("environment: production");
    expect(workflowSource).toContain("pnpm --filter @gw/web deploy:cf:production");

    expect(workflowSource).not.toContain("cloudflare-deploy:");
    expect(workflowSource).not.toContain("if: github.event_name == 'push'");
  });
});
