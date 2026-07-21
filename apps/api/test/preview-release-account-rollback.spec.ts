import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
);

function workflowStep(name: string) {
  const marker = `      - name: ${name}\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) throw new Error(`Workflow step is missing: ${name}`);
  const next = workflow.indexOf("\n      - name: ", start + marker.length);
  return workflow.slice(start, next < 0 ? workflow.length : next);
}

describe("Preview account Worker release safety", () => {
  it("validates Hyperdrive list envelopes and preserves the legacy binding exactly", () => {
    const step = workflowStep("Create or update Preview Hyperdrives");
    expect(step).toContain(".success == true");
    expect(step).toContain('(.result | type) == "array"');
    expect(step).toContain('(.result_info.total_pages | type) == "number"');
    expect(step).toContain(".result_info.total_pages == 1");
    expect(step).toContain("and all(.result[];");
    expect(step).toContain('(.name | type) == "string"');
    expect(step).toContain('(.name | length) > 0');
    expect(step).toContain('(.id | type) == "string"');
    expect(step).toContain('(.id | length) > 0');
    expect(step).toContain('if [[ "$count" -eq 0 ]]');
    expect(step).toContain("id=\"$(jq -er --arg name \"$name\"");
    expect(step).toContain("if [[ \"$count\" -ne 1 ]]");
    expect(step).toContain("ensure_hyperdrive 'werehere-hotel-api-preview'");
    expect(step).not.toContain("ensure_hyperdrive 'werehere-hotel-preview'");
    expect(step).toContain('snapshot_legacy_hyperdrive "$legacy_before"');
    expect(step).toContain('snapshot_legacy_hyperdrive "$legacy_after"');
    expect(step).toContain('cmp -s "$legacy_before" "$legacy_after"');
    expect(step).toContain("PREVIEW_LEGACY_HYPERDRIVE_PRESERVED");
    expect(step).toContain("trap 'rm -rf \"$temp_dir\"' EXIT");
  });

  it("tags and resolves the exact reconciler deployment version inside its own step", () => {
    const step = workflowStep("Deploy private account reconciler Worker");
    expect(step).toContain(
      "DEPLOY_TAG: github-${{ github.run_id }}-${{ github.run_attempt }}-reconciler",
    );
    expect(step).toContain("--strict");
    expect(step).toContain('--tag "$DEPLOY_TAG"');
    expect(step).toContain(
      "deployed_version=\"$(resolve_tagged_version werehere-hotel-account-reconciler-preview \"$DEPLOY_TAG\")\"",
    );
    expect(step).toContain("printf 'deploy_attempted=true\\n' >> \"$GITHUB_OUTPUT\"");
    expect(step).toContain("printf 'deployed_version=%s\\n' \"$deployed_version\" >> \"$GITHUB_OUTPUT\"");
    expect(step).toContain("deployments list --name werehere-hotel-account-reconciler-preview --json");
    expect(step).toContain(".[-1].versions[0].percentage == 100");
    expect(step).toContain(".[-1].versions[0].version_id == $version");
  });

  it("fences reconciler rollback and fails closed for an unfenced first deployment", () => {
    const step = workflowStep("Roll back failed Worker release");
    for (const name of [
      "RECONCILER_PREVIOUS",
      "RECONCILER_EXISTED",
      "RECONCILER_DEPLOY_OUTCOME",
      "RECONCILER_DEPLOYED",
      "RECONCILER_DEPLOY_ATTEMPTED",
      "RECONCILER_DEPLOY_TAG",
    ]) {
      expect(step).toContain(name);
    }
    expect(step).toMatch(
      /rollback_worker werehere-hotel-account-reconciler-preview\s*\\\s*"\$RECONCILER_PREVIOUS" "\$RECONCILER_EXISTED" "\$RECONCILER_DEPLOY_OUTCOME" "\$RECONCILER_DEPLOYED"\s*\\\s*"\$RECONCILER_DEPLOY_ATTEMPTED" "\$RECONCILER_DEPLOY_TAG"/u,
    );
    expect(step).toContain("Worker changed outside this release; refusing rollback");
    expect(step).toContain('[[ "$current" == "$deployed" ]]');
    expect(step).toContain('[[ "$active" == "$previous" ]]');
    expect(step).not.toContain('wrangler delete "$worker_name"');
    expect(step).toContain("First-deploy rollback requires operator recovery");
    expect(step).toContain("PREVIEW_WORKER_ROLLBACK_VERIFICATION_FAILED");
    expect(step).toContain("PREVIEW_WORKER_ROLLBACK_VERIFIED");
  });
});
