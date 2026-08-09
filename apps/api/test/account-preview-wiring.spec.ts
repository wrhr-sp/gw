import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
);
const passwordResetWorkflowUrl = new URL(
  "../../../.github/workflows/preview-bootstrap-password-reset.yml",
  import.meta.url,
);
const approvedEmailCaptureWorkflowUrl = new URL(
  "../../../.github/workflows/preview-capture-approved-email.yml",
  import.meta.url,
);
const ciWorkflow = readFileSync(
  new URL("../../../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);
const renderer = readFileSync(
  new URL("../../../scripts/render-api-preview-config.mjs", import.meta.url),
  "utf8",
);
const reconcilerRenderer = readFileSync(
  new URL(
    "../../../scripts/render-reconciler-preview-config.mjs",
    import.meta.url,
  ),
  "utf8",
);
const previewConfig = readFileSync(
  new URL("../wrangler.preview.jsonc", import.meta.url),
  "utf8",
);
const reconcilerConfig = readFileSync(
  new URL("../wrangler.reconciler.preview.jsonc", import.meta.url),
  "utf8",
);
const apiEntry = readFileSync(
  new URL("../src/index.ts", import.meta.url),
  "utf8",
);
const reconcilerEntry = readFileSync(
  new URL("../src/reconciler-index.ts", import.meta.url),
  "utf8",
);

describe("Preview account provisioning wiring", () => {
  it("scopes Cloudflare credentials to mutation steps and separates Worker secret bundles", () => {
    expect(workflow).not.toContain("$CLOUD...OKEN");
    expect(workflow.match(/\$CLOUDFLARE_API_TOKEN\b/gu)).toHaveLength(7);
    const jobEnvironment = workflow.slice(
      workflow.indexOf("    env:"),
      workflow.indexOf("    steps:"),
    );
    expect(jobEnvironment).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(jobEnvironment).not.toContain("CLOUDFLARE_ACCOUNT_ID");
    const reconcilerDeploy = workflow.slice(
      workflow.indexOf("Deploy private account reconciler Worker"),
      workflow.indexOf("Deploy private API Worker"),
    );
    const apiDeploy = workflow.slice(
      workflow.indexOf("Deploy private API Worker"),
      workflow.indexOf("Deploy public Web Worker"),
    );
    expect(reconcilerDeploy).toContain("RECONCILER_SECRETS_FILE");
    expect(reconcilerDeploy).not.toContain("AUTH_TRANSACTION_ENCRYPTION_KEY");
    expect(reconcilerDeploy).not.toContain("ZITADEL_SERVICE_USER_TOKEN");
    expect(apiDeploy).toContain("API_SECRETS_FILE");
    expect(apiDeploy).toContain("AUTH_TRANSACTION_ENCRYPTION_KEY");
    expect(workflow).not.toContain("werehere-api-preview-secrets.json");
    const preflight = workflow.slice(
      workflow.indexOf("Validate required Preview configuration"),
      workflow.indexOf("Verify approved ZITADEL bootstrap identity"),
    );
    expect(preflight).not.toMatch(
      /CLOUDFLARE_(?:ACCOUNT_ID|API_TOKEN):\s*\$\{\{\s*secrets\./u,
    );
    expect(reconcilerDeploy).toMatch(
      /reconciler_secrets_file="\$\(mktemp\)"\n\s*trap 'rm -f "\$reconciler_secrets_file"' EXIT/u,
    );
    expect(apiDeploy).toMatch(
      /api_secrets_file="\$\(mktemp\)"\n\s*trap 'rm -f "\$api_secrets_file"' EXIT/u,
    );
    const preflightNode = preflight.slice(0, preflight.indexOf("node <<'NODE'"));
    for (const name of [
      "GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET",
      "CALENDAR_CREDENTIAL_AES_KEYRING_JSON",
      "CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON",
      "DATABASE_URL",
      "DATABASE_URL_PREVIEW",
      "DATABASE_API_RUNTIME_PASSWORD_PREVIEW",
      "DATABASE_RECONCILER_PASSWORD_PREVIEW",
      "ZITADEL_SERVICE_USER_TOKEN",
      "ZITADEL_USER_PROVISIONER_TOKEN",
      "ZITADEL_PREVIEW_SUBJECT",
      "ZITADEL_PREVIEW_SUBJECT_SHA256",
      "PREVIEW_BOOTSTRAP_LOGIN_ID",
      "ZITADEL_PREVIEW_PASSWORD",
    ])
      expect(preflightNode).toContain(`unset ${name}`);
    expect(reconcilerDeploy.indexOf('rm -f "$reconciler_secrets_file"')).toBeLessThan(
      reconcilerDeploy.indexOf('deployments_file="$(mktemp)"'),
    );
    expect(apiDeploy.indexOf('rm -f "$api_secrets_file"')).toBeLessThan(
      apiDeploy.indexOf('deployments_file="$(mktemp)"'),
    );
    for (const name of [
      "GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET",
      "CALENDAR_CREDENTIAL_AES_KEYRING_JSON",
      "CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON",
    ])
      expect(reconcilerDeploy).toContain(`unset ${name}`);
    for (const name of [
      "AUTH_TRANSACTION_ENCRYPTION_KEY",
      "GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET",
      "CALENDAR_CREDENTIAL_AES_KEYRING_JSON",
      "CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON",
      "ZITADEL_SERVICE_USER_TOKEN",
      "ZITADEL_USER_PROVISIONER_TOKEN",
    ])
      expect(apiDeploy).toContain(`unset ${name}`);
  });

  it("requires separate lifecycle and bootstrap identity inputs", () => {
    for (const name of [
      "ZITADEL_USER_PROVISIONER_TOKEN",
      "ZITADEL_PREVIEW_SUBJECT_SHA256",
      "PREVIEW_BOOTSTRAP_LOGIN_ID",
      "ZITADEL_ORGANIZATION_ID",
      "PREVIEW_BOOTSTRAP_APPROVAL_REF",
    ])
      expect(workflow).toContain(name);
    expect(workflow).toMatch(
      /ZITADEL_USER_PROVISIONER_TOKEN:\s*\$\{\{\s*secrets\.ZITADEL_USER_PROVISIONER_TOKEN\s*\}\}/u,
    );
    expect(workflow).not.toMatch(
      /ZITADEL_USER_PROVISIONER_TOKEN:\s*\$\{\{\s*secrets\.ZITADEL_SERVICE_USER_TOKEN\s*\}\}/u,
    );
    expect(workflow).toMatch(
      /PREVIEW_BOOTSTRAP_LOGIN_ID:\s*\$\{\{\s*secrets\.PREVIEW_BOOTSTRAP_LOGIN_ID\s*\}\}/u,
    );
  });

  it("reports every missing required Preview configuration in one preflight", () => {
    const preflight = workflow.slice(
      workflow.indexOf("Validate required Preview configuration"),
      workflow.indexOf("Verify approved ZITADEL bootstrap identity"),
    );
    const requiredBlock = /required=\(\n([\s\S]*?)\n\s*\)/u.exec(
      preflight,
    )?.[1];
    const required = requiredBlock
      ?.split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(required).toEqual([
      "AUTH_TRANSACTION_ENCRYPTION_KEY",
      "GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET",
      "CALENDAR_CREDENTIAL_AES_KEYRING_JSON",
      "CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON",
      "DATABASE_URL",
      "DATABASE_URL_PREVIEW",
      "DATABASE_API_RUNTIME_PASSWORD_PREVIEW",
      "DATABASE_RECONCILER_PASSWORD_PREVIEW",
      "ZITADEL_SERVICE_USER_TOKEN",
      "ZITADEL_USER_PROVISIONER_TOKEN",
      "ZITADEL_PREVIEW_SUBJECT",
      "ZITADEL_PREVIEW_SUBJECT_SHA256",
      "PREVIEW_BOOTSTRAP_LOGIN_ID",
      "ZITADEL_PREVIEW_PASSWORD",
      "ZITADEL_ISSUER",
      "ZITADEL_CLIENT_ID",
      "ZITADEL_CONSOLE_CLIENT_ID",
      "ZITADEL_REDIRECT_URI",
      "ZITADEL_ORGANIZATION_ID",
      "GOOGLE_CALENDAR_OAUTH_CLIENT_ID",
      "GOOGLE_CALENDAR_OAUTH_REDIRECT_URI",
      "CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION",
      "CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION",
      "PREVIEW_BOOTSTRAP_APPROVAL_REF",
    ]);

    const shellStart = preflight.indexOf("          set -euo pipefail");
    const shellEnd = preflight.indexOf("          node <<'NODE'", shellStart);
    const shell = preflight
      .slice(shellStart, shellEnd)
      .split("\n")
      .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
      .join("\n");
    const empty = spawnSync("bash", {
      input: shell,
      encoding: "utf8",
      env: {},
    });
    expect(empty.status).toBe(1);
    const missingLines = empty.stderr
      .split("\n")
      .filter((line) =>
        line.startsWith("Missing required Preview configuration: "),
      );
    expect(missingLines).toHaveLength(24);
    expect(new Set(missingLines).size).toBe(24);
    expect(preflight.indexOf("unset ZITADEL_PREVIEW_PASSWORD")).toBeGreaterThan(
      preflight.indexOf('for name in "${missing[@]}"'),
    );
    expect(preflight.indexOf("unset ZITADEL_PREVIEW_PASSWORD")).toBeLessThan(
      preflight.indexOf("node <<'NODE'"),
    );

    const canaryEnv = Object.fromEntries(
      required!.slice(1).map((name, index) => [name, `secret-canary-${index}`]),
    );
    const oneMissing = spawnSync("bash", {
      input: shell,
      encoding: "utf8",
      env: canaryEnv,
    });
    expect(oneMissing.status).toBe(1);
    expect(oneMissing.stderr).toContain(
      "Missing required Preview configuration: AUTH_TRANSACTION_ENCRYPTION_KEY",
    );
    expect(`${oneMissing.stdout}\n${oneMissing.stderr}`).not.toContain(
      "secret-canary-",
    );

    const allPresent = spawnSync("bash", {
      input: shell,
      encoding: "utf8",
      env: Object.fromEntries(
        required!.map((name, index) => [name, `secret-canary-${index}`]),
      ),
    });
    expect(allPresent.status).toBe(0);
    expect(`${allPresent.stdout}\n${allPresent.stderr}`).not.toContain(
      "secret-canary-",
    );
  });

  it("removes one-time approved-email capture and password-reset dispatch surfaces", () => {
    expect(existsSync(approvedEmailCaptureWorkflowUrl)).toBe(false);
    expect(existsSync(passwordResetWorkflowUrl)).toBe(false);
  });

  it("verifies the approved ZITADEL identity before database bootstrap", () => {
    const verifyStep = "Verify approved ZITADEL bootstrap identity";
    const expandStep =
      "Expand Neon Preview database for compatible Worker deploy";
    const contractStep = "Contract Neon Preview tenant authority";
    const accountLoginStep =
      "Verify hosted Preview account management and canonical login before contract";
    const consoleCredentialStep =
      "Verify hosted Preview Console credential and callback before contract";
    const mappingStep =
      "Verify public Preview path and bootstrap mapping before contract";
    expect(workflow).toContain(verifyStep);
    expect(workflow).toContain(accountLoginStep);
    expect(workflow).toContain(consoleCredentialStep);
    expect(workflow).toContain(
      "node scripts/smoke-zitadel-console-preview.mjs",
    );
    expect(workflow).toContain(
      "pnpm exec tsx packages/db/scripts/verify-zitadel-bootstrap.ts",
    );
    expect(workflow.indexOf(verifyStep)).toBeLessThan(
      workflow.indexOf(expandStep),
    );
    expect(workflow.indexOf(verifyStep)).toBeLessThan(
      workflow.indexOf(contractStep),
    );
    expect(workflow.indexOf(expandStep)).toBeLessThan(
      workflow.indexOf(mappingStep),
    );
    expect(workflow.indexOf(mappingStep)).toBeLessThan(
      workflow.indexOf(accountLoginStep),
    );
    expect(workflow.indexOf(accountLoginStep)).toBeLessThan(
      workflow.indexOf(consoleCredentialStep),
    );
    expect(workflow.indexOf(consoleCredentialStep)).toBeLessThan(
      workflow.indexOf(contractStep),
    );
    expect(workflow).toMatch(
      /Verify hosted Preview Console credential and callback before contract[\s\S]*ZITADEL_PREVIEW_PASSWORD:\s*\$\{\{\s*secrets\.ZITADEL_PREVIEW_PASSWORD\s*\}\}[\s\S]*node scripts\/smoke-zitadel-console-preview\.mjs/u,
    );
    expect(workflow.slice(0, workflow.indexOf("steps:"))).not.toContain(
      "ZITADEL_PREVIEW_PASSWORD",
    );
    expect(workflow).toMatch(
      /Verify approved ZITADEL bootstrap identity[\s\S]*ZITADEL_USER_PROVISIONER_TOKEN:[\s\S]*secrets\.ZITADEL_USER_PROVISIONER_TOKEN/u,
    );
    const postContract = workflow.slice(
      workflow.indexOf("Contract Neon Preview tenant authority"),
      workflow.indexOf("Record secure session-authority rollback baseline"),
    );
    expect(postContract).toContain("node scripts/smoke-calendar-preview.mjs");
    for (const marker of [
      "PREVIEW_CALENDAR_PROJECTION_EVIDENCE_SMOKE_OK",
      "PREVIEW_CALENDAR_STRICT_STATUS_DTO_SMOKE_OK",
      "PREVIEW_CALENDAR_CALLBACK_REPLAY_COOKIE_SMOKE_OK",
      "PREVIEW_CALENDAR_API_UI_SMOKE_OK",
    ])
      expect(postContract).toContain(marker);
  });

  it("accepts only complete, empty, or the exact reconciler bootstrap Worker topology", () => {
    const topologyStep = workflow.slice(
      workflow.indexOf("Validate Preview Worker snapshot topology"),
      workflow.indexOf(
        "Expand Neon Preview database for compatible Worker deploy",
      ),
    );
    const shell = topologyStep
      .slice(topologyStep.indexOf("          set -euo pipefail"))
      .split("\n")
      .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
      .join("\n")
      .replace(
        'api="${{ steps.worker_snapshot.outputs.api_existed }}"',
        'api="$API_EXISTS"',
      )
      .replace(
        'reconciler="${{ steps.worker_snapshot.outputs.reconciler_existed }}"',
        'reconciler="$RECONCILER_EXISTS"',
      )
      .replace(
        'web="${{ steps.worker_snapshot.outputs.web_existed }}"',
        'web="$WEB_EXISTS"',
      );
    const runTopology = (api: boolean, reconciler: boolean, web: boolean) =>
      spawnSync("bash", {
        input: shell,
        encoding: "utf8",
        env: {
          API_EXISTS: String(api),
          RECONCILER_EXISTS: String(reconciler),
          WEB_EXISTS: String(web),
        },
      });

    for (const topology of [
      [true, true, true],
      [false, false, false],
      [true, false, true],
    ] as const) {
      const [api, reconciler, web] = topology;
      expect(runTopology(api, reconciler, web).status).toBe(0);
    }
    for (const topology of [
      [true, true, false],
      [true, false, false],
      [false, true, true],
      [false, true, false],
      [false, false, true],
    ] as const) {
      const [api, reconciler, web] = topology;
      const result = runTopology(api, reconciler, web);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Preview Worker topology is partial; refusing release.",
      );
    }
  });

  it("fails closed for every unapproved partial Preview Worker topology", () => {
    expect(workflow).toContain("Validate Preview Worker snapshot topology");
    expect(workflow).toContain(
      "Preview Worker topology is partial; refusing release.",
    );
    expect(workflow).toContain(
      'if [[ "$api" == "true" && "$reconciler" == "true" && "$web" == "true" ]]',
    );
    expect(workflow).toContain(
      'if [[ "$api" == "true" && "$reconciler" == "false" && "$web" == "true" ]]',
    );
    expect(workflow).toContain(
      "Preview reconciler bootstrap topology accepted.",
    );
    expect(workflow).toContain(
      'if [[ "$api" == "false" && "$reconciler" == "false" && "$web" == "false" ]]',
    );
    const compatibilityStep = workflow.slice(
      workflow.indexOf(
        "Verify previous Workers remain compatible after expand",
      ),
      workflow.indexOf("Create or update Preview Hyperdrives"),
    );
    expect(compatibilityStep).toContain("api_existed == 'true'");
    expect(compatibilityStep).toContain("web_existed == 'true'");
    expect(compatibilityStep).not.toContain("reconciler_existed");
  });

  it("uses a stable protected-environment bootstrap approval reference", () => {
    expect(workflow).toContain(
      "PREVIEW_BOOTSTRAP_APPROVAL_REF: ${{ vars.PREVIEW_BOOTSTRAP_APPROVAL_REF }}",
    );
    expect(workflow).not.toMatch(
      /PREVIEW_BOOTSTRAP_APPROVAL_REF:\s*github-run-/u,
    );
  });

  it("injects the organization as a non-secret Worker variable and both PATs as distinct secrets", () => {
    expect(renderer).toContain(
      'ZITADEL_ORGANIZATION_ID: required("ZITADEL_ORGANIZATION_ID")',
    );
    expect(workflow).toContain(
      "'ZITADEL_SERVICE_USER_TOKEN': os.environ['ZITADEL_SERVICE_USER_TOKEN']",
    );
    expect(workflow).toContain(
      "'ZITADEL_USER_PROVISIONER_TOKEN': os.environ['ZITADEL_USER_PROVISIONER_TOKEN']",
    );
  });

  it("renders one isolated Hyperdrive binding per Worker artifact", () => {
    const apiRenderStart = ciWorkflow.indexOf(
      "API_HYPERDRIVE_ID=00000000000000000000000000000000",
    );
    const apiRendererStart = ciWorkflow.indexOf(
      "node scripts/render-api-preview-config.mjs",
      apiRenderStart,
    );
    expect(apiRenderStart).toBeGreaterThanOrEqual(0);
    expect(apiRendererStart).toBeGreaterThan(apiRenderStart);
    const ciApiRenderEnvironment = ciWorkflow.slice(
      apiRenderStart,
      apiRendererStart,
    );
    const ciApiRenderEnvironmentLines = ciApiRenderEnvironment
      .trim()
      .split("\n")
      .map((line) => line.trim());
    expect(ciApiRenderEnvironmentLines.length).toBeGreaterThan(0);
    expect(
      ciApiRenderEnvironmentLines.every((line) =>
        /^[A-Z][A-Z0-9_]*=\S+ \\$/u.test(line),
      ),
    ).toBe(true);
    expect(ciApiRenderEnvironment).toContain(
      "GOOGLE_CALENDAR_OAUTH_CLIENT_ID=preview-calendar-client",
    );
    expect(ciApiRenderEnvironment).toContain(
      "GOOGLE_CALENDAR_OAUTH_REDIRECT_URI=https://preview.invalid/api/admin/calendar-connections/oauth/callback",
    );
    expect(ciApiRenderEnvironment).toContain(
      "CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION=1",
    );
    expect(ciApiRenderEnvironment).toContain(
      "CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION=1",
    );
    expect(ciWorkflow).not.toContain("GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET");
    expect(ciWorkflow).toContain(
      "API_HYPERDRIVE_ID=00000000000000000000000000000000",
    );
    expect(ciWorkflow).toContain(
      "ZITADEL_ORGANIZATION_ID=preview-organization",
    );
    expect(ciWorkflow).not.toContain("\n          HYPERDRIVE_ID=");
    expect(workflow).toContain(
      "API_HYPERDRIVE_ID=00000000000000000000000000000000",
    );
    expect(workflow).not.toContain("\n          HYPERDRIVE_ID=");
    for (const name of [
      "DATABASE_API_RUNTIME_PASSWORD_PREVIEW",
      "DATABASE_RECONCILER_PASSWORD_PREVIEW",
      "API_RUNTIME_DATABASE_URL_FILE",
      "RECONCILER_DATABASE_URL_FILE",
      "API_HYPERDRIVE_ID",
      "RECONCILER_HYPERDRIVE_ID",
    ])
      expect(workflow).toContain(name);
    expect(renderer).toContain(
      '{ binding: "API_HYPERDRIVE", id: apiHyperdriveId }',
    );
    expect(renderer).not.toContain("RECONCILER_HYPERDRIVE");
    expect(reconcilerRenderer).toContain(
      '{ binding: "RECONCILER_HYPERDRIVE", id: reconcilerHyperdriveId }',
    );
    expect(reconcilerRenderer).not.toContain("API_HYPERDRIVE");
    expect(workflow).toContain("wrangler.reconciler.preview.generated.json");
    expect(workflow).toContain("werehere-hotel-account-reconciler-preview");
  });

  it("keeps HTTP and scheduled handlers in separate Worker artifacts", () => {
    expect(previewConfig).not.toContain('"crons"');
    expect(previewConfig).toContain('"main": "src/index.ts"');
    expect(reconcilerConfig).toContain('"main": "src/reconciler-index.ts"');
    expect(reconcilerConfig).toMatch(/\*\/5 \* \* \* \*/u);
    expect(apiEntry).toContain("fetch(");
    expect(apiEntry).not.toContain("scheduled(");
    expect(apiEntry).not.toContain("RECONCILER_HYPERDRIVE");
    expect(reconcilerEntry).toContain("scheduled(");
    expect(reconcilerEntry).toContain(
      "reconcileAccountProviderJobsFromBindings(env)",
    );
    expect(reconcilerEntry).toContain(
      "reconcileHotelFileEvidenceFromBindings(env)",
    );
    expect(reconcilerEntry).toContain(
      "reconcileInspectionMaterializationsFromBindings(env)",
    );
    expect(reconcilerEntry).toContain("Promise.allSettled(tasks)");
    expect(reconcilerEntry).toContain("SCHEDULED_RECONCILIATION_FAILED");
    expect(reconcilerEntry).not.toContain("fetch(");
    expect(reconcilerEntry).not.toContain("API_HYPERDRIVE");
  });

  it("dry-runs the Reconciler artifact in CI and fences hosted smoke to exact active Worker versions", () => {
    expect(ciWorkflow).toContain("render-reconciler-preview-config.mjs");
    expect(ciWorkflow).toContain("wrangler.reconciler.preview.generated.json");
    expect(ciWorkflow).toContain("RECONCILER_HYPERDRIVE_ID=00000000000000000000000000000000");
    expect(ciWorkflow).toContain("--dry-run --config wrangler.reconciler.preview.generated.json");
    const beforeSmoke = workflow.slice(
      workflow.indexOf("Drain previous scheduled executions and verify exact active Workers"),
      workflow.indexOf("Verify public Preview path and bootstrap mapping before contract"),
    );
    expect(beforeSmoke).toContain("node scripts/wait-reconciler-drain.mjs");
    expect(beforeSmoke).not.toContain("sleep 35");
    expect(beforeSmoke).toContain("steps.deploy_reconciler.outputs.deployed_version");
    expect(beforeSmoke).toContain("steps.deploy_api.outputs.deployed_version");
    expect(beforeSmoke).toContain("steps.deploy_web.outputs.deployed_version");
    expect(beforeSmoke.match(/percentage == 100/gu)).toHaveLength(1);
    const afterCalendar = workflow.slice(
      workflow.indexOf("Verify hosted Preview Calendar API and responsive UI before contract"),
      workflow.indexOf("Verify hosted Preview Console credential and callback before contract"),
    );
    expect(afterCalendar).toContain("Verify exact active Workers after Calendar smoke");
    expect(afterCalendar).toContain("steps.deploy_reconciler.outputs.deployed_version");
    expect(afterCalendar).toContain("steps.deploy_api.outputs.deployed_version");
    expect(afterCalendar).toContain("steps.deploy_web.outputs.deployed_version");
    const postContract = workflow.slice(
      workflow.indexOf("Contract Neon Preview tenant authority"),
      workflow.indexOf("Record secure session-authority rollback baseline"),
    );
    expect(postContract).toContain("Verify exact active Workers before post-contract Calendar smoke");
    expect(postContract).toContain("Verify exact active Workers after post-contract Calendar smoke");
    expect(postContract.match(/steps\.deploy_reconciler\.outputs\.deployed_version/gu)).toHaveLength(2);
    expect(postContract.match(/steps\.deploy_api\.outputs\.deployed_version/gu)).toHaveLength(2);
    expect(postContract.match(/steps\.deploy_web\.outputs\.deployed_version/gu)).toHaveLength(2);
    expect(workflow.match(/pnpm --filter @werehere\/api exec wrangler deployments list/gu)).toHaveLength(10);
    expect(workflow).not.toContain("pnpm exec wrangler deployments list");
  });

  it("pins every CI third-party action to the reviewed immutable commit", () => {
    expect(ciWorkflow).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1");
    expect(ciWorkflow).toContain("pnpm/action-setup@f520eceda224fe1a4aed5a2a27a194379a409996");
    expect(ciWorkflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020");
    expect(ciWorkflow).toContain("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a");
    expect(ciWorkflow).not.toMatch(/uses:\s+(?:actions|pnpm)\/[^@\s]+@v\d+/u);
  });
});
