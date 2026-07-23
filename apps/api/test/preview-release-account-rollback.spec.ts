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

function validateWorkerHyperdriveBinding(
  value: unknown,
  bindingNames = ["API_HYPERDRIVE"],
) {
  const directory = mkdtempSync(join(tmpdir(), "worker-binding-test-"));
  const fixture = join(directory, "response.json");
  try {
    writeFileSync(fixture, JSON.stringify(value));
    return spawnSync(
      process.execPath,
      [
        new URL(
          "../../../scripts/validate-cloudflare-worker-hyperdrive-binding.mjs",
          import.meta.url,
        ).pathname,
        fixture,
        ...bindingNames,
      ],
      { encoding: "utf8" },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("Preview account Worker release safety", () => {
  it("uses exact Worker binding IDs and preserves or promotes the legacy binding safely", () => {
    const snapshot = workflowStep("Snapshot active Worker versions");
    expect(snapshot).toContain("worker_hyperdrive_id");
    expect(snapshot).toContain(
      "validate-cloudflare-worker-hyperdrive-binding.mjs",
    );
    expect(snapshot).toContain("API_HYPERDRIVE");
    expect(snapshot).toContain("RECONCILER_HYPERDRIVE");
    expect(snapshot).toContain(
      'worker_hyperdrive_id "$worker_name" API_HYPERDRIVE HYPERDRIVE',
    );
    expect(snapshot).toContain("hyperdrive_id=%s");
    const step = workflowStep("Create or update Preview Hyperdrives");
    expect(step).toContain("validate-cloudflare-hyperdrive-list.mjs");
    expect(step).toContain('if [[ "$count" -eq 0 ]]');
    expect(step).toContain("id=\"$(jq -er '.id");
    expect(step).toContain('if [[ "$count" -ne 1 ]]');
    expect(step).toContain("hyperdrive_count");
    expect(step).toContain("write_hyperdrive_config");
    expect(step).toContain("$api_hyperdrive_id");
    expect(step).toContain("ensure_hyperdrive 'werehere-hotel-api-preview'");
    expect(step).not.toContain("ensure_hyperdrive 'werehere-hotel-preview'");
    expect(step).toContain('snapshot_legacy_hyperdrive "$legacy_before"');
    expect(step).toContain('snapshot_legacy_hyperdrive "$legacy_after"');
    expect(step).toContain('cmp -s "$legacy_before" "$legacy_after"');
    expect(step).toContain("PREVIEW_LEGACY_HYPERDRIVE_PRESERVED");
    expect(step).toContain(
      "PREVIEW_LEGACY_HYPERDRIVE_PROMOTED_TO_CANONICAL_API",
    );
    expect(step).toContain("trap 'rm -rf \"$temp_dir\"' EXIT");
    expect(step).toContain("PREVIEW_API_HYPERDRIVE_TARGET_MISMATCH_CONFIRMED");
    expect(step).toContain("hyperdrive_target_state");
    expect(step).toContain("preview-hyperdrive-retarget-contract.mjs");
    expect(step).toContain('decide "$PREVIEW_HYPERDRIVE_RETARGET_APPROVED"');
    expect(step).toContain('if [[ "$allow_mismatch" != "true" ]]');
    expect(step).toContain("Hyperdrive canonical origin read-back failed");
    expect(step).toContain('cmp -s "$current_file" "$verified_file"');
    expect(step).toContain("parse-created-id");
    expect(step).toContain("${output_name}-create-attempted");
    expect(step).toContain("${output_name}-created-id");
    expect(step).toContain(
      '[[ -n "$id" && "$(jq -r \'.id\' "$verified_file")" != "$id" ]]',
    );
    expect(step).toContain('>"$create_output_file" 2>&1');
  });

  it("fails closed for malformed or ambiguous Worker Hyperdrive bindings", () => {
    const id = "11111111111111111111111111111111";
    const validBinding = {
      name: "API_HYPERDRIVE",
      type: "hyperdrive",
      id,
    };
    const acceptedApiBindingNames = ["API_HYPERDRIVE", "HYPERDRIVE"];
    const valid = validateWorkerHyperdriveBinding(
      {
        success: true,
        result: {
          bindings: [
            { name: "OTHER_VALUE", type: "plain_text", text: "fixture" },
            validBinding,
          ],
        },
      },
      acceptedApiBindingNames,
    );
    expect(valid.status).toBe(0);
    expect(valid.stdout).toBe(`${id}\n`);
    expect(valid.stderr).toBe("");

    const legacy = validateWorkerHyperdriveBinding(
      {
        success: true,
        result: {
          bindings: [{ ...validBinding, name: "HYPERDRIVE" }],
        },
      },
      acceptedApiBindingNames,
    );
    expect(legacy.status).toBe(0);
    expect(legacy.stdout).toBe(`${id}\n`);
    expect(legacy.stderr).toBe("");

    const ambiguousAlias = validateWorkerHyperdriveBinding(
      {
        success: true,
        result: {
          bindings: [validBinding, { ...validBinding, name: "HYPERDRIVE" }],
        },
      },
      acceptedApiBindingNames,
    );
    expect(ambiguousAlias.status).not.toBe(0);
    expect(ambiguousAlias.stdout).toBe("");
    expect(ambiguousAlias.stderr).toBe(
      "Worker Hyperdrive binding validation failed.\n",
    );

    const invalid = [
      null,
      { success: false, result: { bindings: [validBinding] } },
      { success: true, result: {} },
      { success: true, result: { bindings: {} } },
      { success: true, result: { bindings: [] } },
      {
        success: true,
        result: {
          bindings: [
            validBinding,
            { name: "API_HYPERDRIVE", type: "hyperdrive" },
          ],
        },
      },
      {
        success: true,
        result: { bindings: [validBinding, { ...validBinding }] },
      },
      {
        success: true,
        result: {
          bindings: [
            {
              name: "API_HYPERDRIVE",
              type: "hyperdrive",
              id: id.toUpperCase().replace("1", "A"),
            },
          ],
        },
      },
      {
        success: true,
        result: {
          bindings: [{ name: "API_HYPERDRIVE", type: "hyperdrive", id: 42 }],
        },
      },
      {
        success: true,
        result: {
          bindings: [{ name: "API_HYPERDRIVE", type: "service", id }],
        },
      },
    ];

    for (const fixture of invalid) {
      const result = validateWorkerHyperdriveBinding(fixture);
      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        "Worker Hyperdrive binding validation failed.\n",
      );
    }
  });

  it("keeps the one-time Hyperdrive retarget gate explicit and default-off", () => {
    expect(workflow).toContain("preview_hyperdrive_retarget:");
    expect(workflow).toContain("default: false");
    const preTarget = workflowStep(
      "Verify previous Workers remain compatible after expand",
    );
    expect(preTarget).toContain("PREVIEW_HYPERDRIVE_RETARGET_APPROVED");
    expect(preTarget).toContain(
      "ZITADEL_PREVIEW_SUBJECT: ${{ secrets.ZITADEL_PREVIEW_SUBJECT }}",
    );
    expect(preTarget).toContain(
      "node scripts/smoke-zitadel-console-preview.mjs",
    );
    const consoleSmokeSteps = workflow
      .split(/\n(?= {6}- name: )/u)
      .filter((step) =>
        step.includes("node scripts/smoke-zitadel-console-preview.mjs"),
      );
    expect(consoleSmokeSteps.length).toBeGreaterThan(0);
    for (const step of consoleSmokeSteps) {
      expect(step).toContain(
        "ZITADEL_PREVIEW_SUBJECT: ${{ secrets.ZITADEL_PREVIEW_SUBJECT }}",
      );
    }
    expect(preTarget).toContain(
      "preview-hyperdrive-retarget-contract.mjs probe",
    );
    expect(preTarget).toContain('readiness_status" -ne 10');
    expect(preTarget).toContain(
      'readiness_classification" != "DB_DEPENDENCY_UNAVAILABLE"',
    );
    expect(preTarget).toContain("retarget_required=true");
    expect(preTarget).toContain("PREVIEW_EXISTING_WORKER_RETARGET_REQUIRED");
    expect(preTarget).toContain('readiness_status" -eq 11');
    expect(preTarget).toContain(
      'readiness_classification" == "SCHEMA_NOT_READY"',
    );
    expect(preTarget).toContain("legacy_schema_recovery_required=true");
    expect(preTarget).toContain(
      "PREVIEW_EXISTING_LEGACY_SCHEMA_RECOVERY_REQUIRED",
    );
    const provisioning = workflowStep("Create or update Preview Hyperdrives");
    expect(provisioning).toContain("retarget_topology=API_WEB_LEGACY");
    expect(provisioning).toContain("retarget_topology=COMPLETE");
    expect(provisioning).toContain(
      '[[ "$api_existed" != "true" || "$web_existed" != "true" ]]',
    );
    expect(provisioning).toContain(
      'DB_DEPENDENCY_UNAVAILABLE "$api_target_state" "$retarget_topology"',
    );
    expect(provisioning).toContain(
      'SCHEMA_NOT_READY "$api_target_state" API_WEB_LEGACY',
    );
    expect(provisioning).toContain("CONTINUE_CANONICAL_LEGACY_RECOVERY");
    expect(provisioning).toContain("legacy_api_promoted=true");
    expect(provisioning).not.toContain(
      "requires a complete existing Worker topology",
    );
    const canonicalTarget = workflowStep(
      "Verify previous Workers use canonical Preview Hyperdrives",
    );
    expect(canonicalTarget).toContain(
      "node scripts/smoke-cloudflare-preview.mjs",
    );
    expect(canonicalTarget).toContain(
      "node scripts/smoke-zitadel-console-preview.mjs",
    );
    expect(canonicalTarget).toContain(
      "PREVIEW_LEGACY_API_POST_RETARGET_SMOKE_DEFERRED",
    );
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
    const hyperdrivePosition = workflow.indexOf(
      "      - name: Create or update Preview Hyperdrives\n",
    );
    const canonicalCompatibilityPosition = workflow.indexOf(
      "      - name: Verify previous Workers use canonical Preview Hyperdrives\n",
    );
    const deployPosition = workflow.indexOf(
      "      - name: Deploy private account reconciler Worker\n",
    );
    const apiDeployPosition = workflow.indexOf(
      "      - name: Deploy private API Worker\n",
    );
    const webDeployPosition = workflow.indexOf(
      "      - name: Deploy public Web Worker\n",
    );
    const preContractSmokePosition = workflow.indexOf(
      "      - name: Verify public Preview path and bootstrap mapping before contract\n",
    );
    const accountSmokePosition = workflow.indexOf(
      "      - name: Verify hosted Preview account management and canonical login before contract\n",
    );
    const contractPosition = workflow.indexOf(
      "      - name: Contract Neon Preview tenant authority\n",
    );
    const smokePosition = workflow.indexOf(
      "      - name: Verify public Preview path and bootstrap mapping after contract\n",
    );
    const baselinePosition = workflow.indexOf(
      "      - name: Record secure session-authority rollback baseline\n",
    );
    expect(snapshotPosition).toBeGreaterThan(-1);
    expect(topologyPosition).toBeGreaterThan(snapshotPosition);
    expect(expandPosition).toBeGreaterThan(topologyPosition);
    expect(compatibilityPosition).toBeGreaterThan(expandPosition);
    expect(hyperdrivePosition).toBeGreaterThan(compatibilityPosition);
    expect(canonicalCompatibilityPosition).toBeGreaterThan(hyperdrivePosition);
    expect(deployPosition).toBeGreaterThan(canonicalCompatibilityPosition);
    expect(apiDeployPosition).toBeGreaterThan(deployPosition);
    expect(webDeployPosition).toBeGreaterThan(apiDeployPosition);
    expect(preContractSmokePosition).toBeGreaterThan(webDeployPosition);
    expect(accountSmokePosition).toBeGreaterThan(preContractSmokePosition);
    expect(contractPosition).toBeGreaterThan(accountSmokePosition);
    expect(smokePosition).toBeGreaterThan(contractPosition);
    expect(baselinePosition).toBeGreaterThan(smokePosition);
    expect(
      workflowStep(
        "Verify hosted Preview account management and canonical login before contract",
      ),
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

  it("classifies Hyperdrive state without an unfenced automatic rollback mutation", () => {
    const step = workflowStep("Roll back failed Worker release");
    expect(step).toContain("classify_hyperdrive_recovery");
    expect(step).toContain("api_id-before.json");
    expect(step).toContain("reconciler_id-before.json");
    expect(step).toContain("api_id-create-attempted");
    expect(step).toContain("reconciler_id-create-attempted");
    expect(step).toContain("api_id-created-id");
    expect(step).toContain("reconciler_id-created-id");
    expect(step).toContain('[[ "$id" =~ ^[0-9a-f]{32}$ ]]');
    expect(step).toContain("printf 'ABSENT\\n'");
    expect(step).toContain("validate-cloudflare-hyperdrive-list.mjs");
    expect(step).toContain(
      "PREVIEW_HYPERDRIVE_SPLIT_TOPOLOGY_OPERATOR_RECOVERY_REQUIRED",
    );
    expect(step).toContain(
      "PREVIEW_HYPERDRIVES_CANONICAL_DURABLE_OPERATOR_RECOVERY_REQUIRED",
    );
    expect(step).toContain("PREVIEW_HYPERDRIVE_RECOVERY_STATE_INDETERMINATE");
    expect(step).not.toContain("wrangler hyperdrive update");
    expect(step).not.toContain("restore_hyperdrive");
  });

  it("fails closed without an unfenced automatic Worker rollback mutation", () => {
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
