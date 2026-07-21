import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

function validateHyperdriveList(value: unknown) {
  const directory = mkdtempSync(join(tmpdir(), "hyperdrive-list-test-"));
  const fixture = join(directory, "response.json");
  try {
    writeFileSync(fixture, JSON.stringify(value));
    return spawnSync(
      process.execPath,
      [
        new URL(
          "../../../scripts/validate-cloudflare-hyperdrive-list.mjs",
          import.meta.url,
        ).pathname,
        fixture,
      ],
      { encoding: "utf8" },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("Preview account Worker release safety", () => {
  it("validates Hyperdrive list envelopes and preserves the legacy binding exactly", () => {
    const step = workflowStep("Create or update Preview Hyperdrives");
    expect(step).toContain("validate-cloudflare-hyperdrive-list.mjs");
    expect(step).toContain('if [[ "$count" -eq 0 ]]');
    expect(step).toContain('id="$(jq -er --arg name "$name"');
    expect(step).toContain('if [[ "$count" -ne 1 ]]');
    expect(step).toContain("ensure_hyperdrive 'werehere-hotel-api-preview'");
    expect(step).not.toContain("ensure_hyperdrive 'werehere-hotel-preview'");
    expect(step).toContain('snapshot_legacy_hyperdrive "$legacy_before"');
    expect(step).toContain('snapshot_legacy_hyperdrive "$legacy_after"');
    expect(step).toContain('cmp -s "$legacy_before" "$legacy_after"');
    expect(step).toContain("PREVIEW_LEGACY_HYPERDRIVE_PRESERVED");
    expect(step).toContain("trap 'rm -rf \"$temp_dir\"' EXIT");
  });

  it("rejects malformed or contradictory Hyperdrive pagination before mutation", () => {
    const valid = {
      success: true,
      result: [{ id: "hyperdrive-1", name: "werehere-hotel-preview" }],
      result_info: {
        page: 1,
        per_page: 100,
        count: 1,
        total_count: 1,
        total_pages: 1,
      },
    };
    expect(validateHyperdriveList(valid).status).toBe(0);
    for (const invalid of [
      null,
      { ...valid, result_info: null },
      { ...valid, result_info: { ...valid.result_info, page: 2 } },
      { ...valid, result_info: { ...valid.result_info, count: 0 } },
      { ...valid, result_info: { ...valid.result_info, total_count: 2 } },
      { ...valid, result_info: { ...valid.result_info, total_pages: 2 } },
      { ...valid, result: [{ id: null, name: "werehere-hotel-preview" }] },
      { ...valid, result: [{ id: "hyperdrive-1", name: null }] },
      {
        ...valid,
        result: [
          { id: "hyperdrive-1", name: "a" },
          { id: "hyperdrive-1", name: "b" },
        ],
        result_info: { ...valid.result_info, count: 2, total_count: 2 },
      },
    ]) {
      expect(validateHyperdriveList(invalid).status).not.toBe(0);
    }
  });

  it("tags and resolves the exact reconciler deployment version inside its own step", () => {
    const step = workflowStep("Deploy private account reconciler Worker");
    expect(step).toContain(
      "DEPLOY_TAG: github-${{ github.run_id }}-${{ github.run_attempt }}-reconciler",
    );
    expect(step).toContain("--strict");
    expect(step).toContain('--tag "$DEPLOY_TAG"');
    expect(step).toContain(
      'deployed_version="$(resolve_tagged_version werehere-hotel-account-reconciler-preview "$DEPLOY_TAG")"',
    );
    expect(step).toContain(
      "printf 'deploy_attempted=true\\n' >> \"$GITHUB_OUTPUT\"",
    );
    expect(step).toContain(
      'printf \'deployed_version=%s\\n\' "$deployed_version" >> "$GITHUB_OUTPUT"',
    );
    expect(step).toContain(
      "deployments list --name werehere-hotel-account-reconciler-preview --json",
    );
    expect(step).toContain(".[-1].versions[0].percentage == 100");
    expect(step).toContain(".[-1].versions[0].version_id == $version");
  });

  it("records the secure API version only after Preview smoke and an active-version read-back", () => {
    const deploy = workflowStep("Deploy private API Worker");
    expect(deploy).toContain(
      "DEPLOY_TAG: secure-session-authority-v1-github-${{ github.run_id }}-${{ github.run_attempt }}-api",
    );
    expect(deploy).toContain("--strict");
    expect(deploy).toContain('--tag "$DEPLOY_TAG"');
    expect(deploy).toContain(
      'deployed_version="$(resolve_tagged_version werehere-hotel-api-preview "$DEPLOY_TAG")"',
    );

    const snapshotPosition = workflow.indexOf(
      "      - name: Snapshot active Worker versions\n",
    );
    const topologyPosition = workflow.indexOf(
      "      - name: Validate Preview Worker snapshot topology\n",
    );
    const expandPosition = workflow.indexOf(
      "      - name: Expand Neon Preview database for compatible Worker deploy\n",
    );
    const compatibilityPosition = workflow.indexOf(
      "      - name: Verify previous Workers remain compatible after expand\n",
    );
    const deployPosition = workflow.indexOf(
      "      - name: Deploy private account reconciler Worker\n",
    );
    const preContractSmokePosition = workflow.indexOf(
      "      - name: Verify public Preview path before contract\n",
    );
    const contractPosition = workflow.indexOf(
      "      - name: Contract Neon Preview tenant authority\n",
    );
    const smokePosition = workflow.indexOf(
      "      - name: Verify public Preview path after contract\n",
    );
    const baselinePosition = workflow.indexOf(
      "      - name: Record secure session-authority rollback baseline\n",
    );
    const accountSmokePosition = workflow.indexOf(
      "      - name: Verify hosted Preview account management journey\n",
    );
    expect(snapshotPosition).toBeGreaterThan(-1);
    expect(topologyPosition).toBeGreaterThan(snapshotPosition);
    expect(expandPosition).toBeGreaterThan(topologyPosition);
    expect(compatibilityPosition).toBeGreaterThan(expandPosition);
    expect(deployPosition).toBeGreaterThan(compatibilityPosition);
    expect(preContractSmokePosition).toBeGreaterThan(deployPosition);
    expect(contractPosition).toBeGreaterThan(preContractSmokePosition);
    expect(smokePosition).toBeGreaterThan(contractPosition);
    expect(accountSmokePosition).toBeGreaterThan(smokePosition);
    expect(baselinePosition).toBeGreaterThan(accountSmokePosition);
    expect(
      workflowStep("Verify hosted Preview account management journey"),
    ).toContain("node scripts/smoke-account-preview.mjs");
    const baseline = workflowStep(
      "Record secure session-authority rollback baseline",
    );
    expect(baseline).toContain("steps.deploy_api.outputs.deployed_version");
    expect(baseline).toContain("deployments list");
    expect(baseline).toContain(".[-1].versions[0].percentage == 100");
    expect(baseline).toContain(".[-1].versions[0].version_id == $version");
    expect(baseline).toContain("session-derived-tenant-authority-v1");
    expect(baseline).toContain("$GITHUB_STEP_SUMMARY");
    expect(baseline).toContain("PREVIEW_SECURE_ROLLBACK_BASELINE_VERIFIED");

    const rollback = workflowStep("Roll back failed Worker release");
    expect(rollback).toContain(
      "API_DEPLOY_TAG: secure-session-authority-v1-github-${{ github.run_id }}-${{ github.run_attempt }}-api",
    );
  });

  it("fails closed without an unfenced automatic rollback mutation", () => {
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
    expect(step).toContain(
      "Worker changed outside this release; refusing rollback",
    );
    expect(step).toContain('[[ "$current" != "$deployed" ]]');
    expect(step).not.toContain("wrangler rollback");
    expect(step).toContain(
      "Conditional rollback is unavailable; operator recovery required",
    );
    expect(step).not.toContain('wrangler delete "$worker_name"');
    expect(step).toContain("First-deploy rollback requires operator recovery");
    expect(step).toContain("PREVIEW_WORKER_OPERATOR_RECOVERY_REQUIRED");
    expect(step).toContain("PREVIEW_WORKER_ROLLBACK_VERIFIED");
  });
});
