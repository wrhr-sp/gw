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
const reconcilerDrain = readFileSync(
  new URL("../../../scripts/wait-reconciler-drain.mjs", import.meta.url),
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
    expect(workflow.match(/\$CLOUDFLARE_API_TOKEN\b/gu)).toHaveLength(12);
    const jobEnvironment = workflow.slice(
      workflow.indexOf("    env:"),
      workflow.indexOf("    steps:"),
    );
    expect(jobEnvironment).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(jobEnvironment).not.toContain("CLOUDFLARE_ACCOUNT_ID");
    const r2Provision = workflow.slice(
      workflow.indexOf("Ensure isolated Preview private R2 bucket"),
      workflow.indexOf("Render API Preview configuration"),
    );
    const r2ReadBack = workflow.slice(
      workflow.indexOf("Verify deployed API private R2 binding"),
      workflow.indexOf("Verify legacy Preview Container provider resource"),
    );
    const containerRetirementReadBack = workflow.slice(
      workflow.indexOf("Verify legacy Preview Container provider resource"),
      workflow.indexOf("Expand Preview account identity lock ACL"),
    );
    for (const step of [r2Provision, r2ReadBack, containerRetirementReadBack]) {
      expect(step).toContain(
        "CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
      );
      expect(step).toContain(
        "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
      );
      expect(step.slice(step.indexOf("        run: |"))).not.toContain("${{");
    }
    expect(r2Provision).toContain("PREVIEW_R2_BUCKET_READY");
    expect(r2Provision).toContain("per_page=1000");
    expect(r2Provision).toContain("result_info.cursor // empty");
    expect(r2Provision).toContain("seen_cursors");
    expect(r2Provision).toContain("all(.result.buckets[];");
    expect(r2Provision).not.toMatch(/container/iu);
    const reconcilerDeploy = workflow.slice(
      workflow.indexOf("Deploy private account reconciler Worker"),
      workflow.indexOf("Deploy private API Worker"),
    );
    const apiDeploy = workflow.slice(
      workflow.indexOf("Deploy private API Worker"),
      workflow.indexOf("Deploy public Web Worker"),
    );
    expect(reconcilerDeploy).not.toContain("RECONCILER_SECRETS_FILE");
    expect(reconcilerDeploy).not.toContain("FILE_PROCESSOR_SHARED_SECRET");
    expect(reconcilerDeploy).toContain("reconciler_deploy_output");
    expect(reconcilerDeploy).toContain('> "$reconciler_deploy_output" 2>&1');
    expect(reconcilerDeploy).toContain('chmod 600 "$reconciler_deploy_output"');
    expect(reconcilerDeploy).not.toContain('cat "$reconciler_deploy_output"');
    expect(reconcilerDeploy).not.toContain("AUTH_TRANSACTION_ENCRYPTION_KEY");
    expect(reconcilerDeploy).not.toContain("ZITADEL_SERVICE_USER_TOKEN");
    expect(reconcilerDeploy).toContain("--strict");
    expect(apiDeploy).toContain("API_SECRETS_FILE");
    expect(apiDeploy).toContain("AUTH_TRANSACTION_ENCRYPTION_KEY");
    expect(apiDeploy).toContain("PREVIEW_FILE_SCANNER_AGENT_TOKEN");
    expect(apiDeploy).toContain("FILE_SCANNER_AGENT_TOKEN");
    expect(workflow).not.toContain("werehere-api-preview-secrets.json");
    const cleanupMarker =
      "      - name: Retire Preview Google Calendar Worker secrets\n";
    const cleanupStart = workflow.indexOf(cleanupMarker);
    const cleanupEnd = workflow.indexOf(
      "\n      - name: ",
      cleanupStart + cleanupMarker.length,
    );
    expect(cleanupStart).toBeGreaterThanOrEqual(0);
    expect(cleanupEnd).toBeGreaterThan(cleanupStart);
    const cleanupStep = workflow.slice(cleanupStart, cleanupEnd);
    expect(cleanupStep).toContain('"FILE_PROCESSOR_SHARED_SECRET"');
    expect(cleanupStep).not.toContain("${{ secrets.FILE_PROCESSOR_SHARED_SECRET }}");
    const dispositionMarker =
      "      - name: Decommission Preview Google Calendar provider artifacts and grants\n";
    const dispositionStart = workflow.indexOf(dispositionMarker);
    const dispositionEnd = workflow.indexOf(
      "\n      - name: ",
      dispositionStart + dispositionMarker.length,
    );
    expect(dispositionStart).toBeGreaterThanOrEqual(0);
    expect(dispositionEnd).toBeGreaterThan(dispositionStart);
    const dispositionStep = workflow.slice(dispositionStart, dispositionEnd);
    const workflowWithoutProviderLifecycle = workflow
      .replace(cleanupStep, "")
      .replace(dispositionStep, "");
    expect(workflowWithoutProviderLifecycle).not.toMatch(
      /GOOGLE_CALENDAR|CALENDAR_CREDENTIAL|CALENDAR_FINGERPRINT/u,
    );
    expect(cleanupStep).not.toMatch(
      /\$\{\{\s*(?:secrets|vars)\.(?:GOOGLE_CALENDAR|CALENDAR_)/u,
    );
    expect(dispositionStep).toContain("        env:\n");
    for (const mapping of [
      "DATABASE_URL_PREVIEW: ${{ secrets.DATABASE_URL_PREVIEW }}",
      "GOOGLE_CALENDAR_OAUTH_CLIENT_ID: ${{ vars.GOOGLE_CALENDAR_OAUTH_CLIENT_ID }}",
      "GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET }}",
      "CALENDAR_CREDENTIAL_AES_KEYRING_JSON: ${{ secrets.CALENDAR_CREDENTIAL_AES_KEYRING_JSON }}",
    ])
      expect(dispositionStep).toContain(mapping);
    const dispositionRun = dispositionStep.slice(
      dispositionStep.indexOf("        run: |"),
    );
    expect(dispositionRun).not.toContain("${{");
    expect(dispositionRun).toContain(
      "node scripts/decommission-google-calendar-preview.mjs",
    );
    expect(dispositionStep).not.toContain(
      "CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON",
    );
    const preflight = workflow.slice(
      workflow.indexOf("Validate required Preview configuration"),
      workflow.indexOf("Verify approved ZITADEL bootstrap identity"),
    );
    expect(preflight).not.toMatch(
      /CLOUDFLARE_(?:ACCOUNT_ID|API_TOKEN):\s*\$\{\{\s*secrets\./u,
    );
    expect(apiDeploy).toMatch(
      /api_secrets_file="\$\(mktemp\)"\n\s*trap 'rm -f "\$api_secrets_file"' EXIT/u,
    );
    for (const name of [
      "AUTH_TRANSACTION_ENCRYPTION_KEY",
      "ZITADEL_SERVICE_USER_TOKEN",
      "ZITADEL_USER_PROVISIONER_TOKEN",
      "PREVIEW_FILE_SCANNER_AGENT_TOKEN",
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
      "PREVIEW_FILE_SCANNER_AGENT_TOKEN",
      "ZITADEL_ISSUER",
      "ZITADEL_CLIENT_ID",
      "ZITADEL_CONSOLE_CLIENT_ID",
      "ZITADEL_REDIRECT_URI",
      "ZITADEL_ORGANIZATION_ID",
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
    expect(missingLines).toHaveLength(required?.length ?? 0);
    expect(new Set(missingLines).size).toBe(required?.length ?? 0);
    expect(preflight.indexOf("unset ZITADEL_PREVIEW_PASSWORD")).toBeGreaterThan(
      preflight.indexOf('for name in "${missing[@]}"'),
    );
    expect(preflight.indexOf("unset ZITADEL_PREVIEW_PASSWORD")).toBeLessThan(
      preflight.indexOf("node <<'NODE'"),
    );

    const canaryValue = (name: string, index: number) =>
      name === "PREVIEW_FILE_SCANNER_AGENT_TOKEN"
        ? `secret-canary-scanner-${"x".repeat(32)}`
        : `secret-canary-${index}`;
    const canaryEnv = Object.fromEntries(
      required!.slice(1).map((name, index) => [name, canaryValue(name, index)]),
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
        required!.map((name, index) => [name, canaryValue(name, index)]),
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
    const stagedIdentityLockSmoke = workflow.slice(
      workflow.indexOf("Verify deployed API accepts staged identity lock ACL"),
      workflow.indexOf("Build OpenNext Web Worker"),
    );
    expect(stagedIdentityLockSmoke).not.toMatch(
      /^\s+ZITADEL_PREVIEW_SUBJECT:/mu,
    );
    expect(stagedIdentityLockSmoke).toContain(
      "node scripts/smoke-zitadel-console-preview.mjs",
    );
    const consoleSmokeCall = "node scripts/smoke-zitadel-console-preview.mjs";
    let consoleSmokeCursor = 0;
    let consoleSmokeCount = 0;
    while (true) {
      const callIndex = workflow.indexOf(consoleSmokeCall, consoleSmokeCursor);
      if (callIndex < 0) break;
      const stepStart = workflow.lastIndexOf("\n      - name:", callIndex);
      expect(stepStart).toBeGreaterThanOrEqual(0);
      const stepBlock = workflow.slice(
        stepStart,
        callIndex + consoleSmokeCall.length,
      );
      expect(stepBlock).not.toMatch(
        /^\s+(?:ZITADEL_PREVIEW_SUBJECT|PREVIEW_BOOTSTRAP_LOGIN_ID):/mu,
      );
      const invocationStart = workflow.lastIndexOf("\n", callIndex) + 1;
      const invocationEnd = workflow.indexOf("\n", callIndex);
      const invocationLine = workflow
        .slice(invocationStart, invocationEnd < 0 ? undefined : invocationEnd)
        .trim();
      expect(invocationLine).toMatch(
        /^(?:run:\s+)?ZITADEL_PREVIEW_SUBJECT=\$\{\{\s*secrets\.ZITADEL_PREVIEW_SUBJECT\s*\}\}\s+PREVIEW_BOOTSTRAP_LOGIN_ID=\$\{\{\s*secrets\.PREVIEW_BOOTSTRAP_LOGIN_ID\s*\}\}\s+node scripts\/smoke-zitadel-console-preview\.mjs$/u,
      );
      consoleSmokeCount += 1;
      consoleSmokeCursor = callIndex + consoleSmokeCall.length;
    }
    expect(consoleSmokeCount).toBeGreaterThan(0);

    const accountSmoke = workflow.slice(
      workflow.indexOf(
        "Verify hosted Preview account management and canonical login before contract",
      ),
      workflow.indexOf(
        "Verify hosted Preview own Calendar and responsive UI before contract",
      ),
    );
    for (const name of [
      "ZITADEL_PREVIEW_SUBJECT",
      "ZITADEL_USER_PROVISIONER_TOKEN",
      "ZITADEL_SERVICE_USER_TOKEN",
    ]) {
      expect(accountSmoke).not.toMatch(new RegExp(`^\\s+${name}:`, "mu"));
    }
    expect(accountSmoke).toContain(
      "ZITADEL_PREVIEW_SUBJECT=${{ secrets.ZITADEL_PREVIEW_SUBJECT }} ZITADEL_USER_PROVISIONER_TOKEN=${{ secrets.ZITADEL_USER_PROVISIONER_TOKEN }} ZITADEL_SERVICE_USER_TOKEN=${{ secrets.ZITADEL_SERVICE_USER_TOKEN }} node scripts/smoke-account-preview.mjs | tee /tmp/preview-account-smoke.log",
    );

    const preCalendarSmoke = workflow.slice(
      workflow.indexOf(
        "Verify hosted Preview own Calendar and responsive UI before contract",
      ),
      workflow.indexOf("Verify exact active Workers after Calendar smoke"),
    );
    expect(preCalendarSmoke).toContain(
      "ZITADEL_PREVIEW_SUBJECT: ${{ secrets.ZITADEL_PREVIEW_SUBJECT }}",
    );
    expect(preCalendarSmoke).not.toContain("PREVIEW_CALENDAR_REQUIRE_MUTATION");
    expect(preCalendarSmoke).toContain(
      "node scripts/smoke-calendar-preview.mjs | tee /tmp/preview-calendar-smoke.log",
    );
    expect(
      preCalendarSmoke.slice(preCalendarSmoke.indexOf("run: |")),
    ).not.toContain("${{");

    const postContract = workflow.slice(
      workflow.indexOf("Contract Neon Preview tenant authority"),
      workflow.indexOf("Record secure session-authority rollback baseline"),
    );
    expect(postContract).toContain('PREVIEW_CALENDAR_REQUIRE_MUTATION: "1"');
    expect(postContract).toContain("node scripts/smoke-calendar-preview.mjs");
    expect(postContract).toContain("PREVIEW_CALENDAR_API_UI_SMOKE_OK");
    expect(postContract).toContain("PREVIEW_CALENDAR_MUTATION_SMOKE_OK");
    const postContractRun = postContract.slice(
      postContract.indexOf(
        "Verify public Preview path and bootstrap mapping after contract",
      ),
      postContract.indexOf(
        "Verify exact active Workers after post-contract own Calendar smoke",
      ),
    );
    expect(postContractRun).toContain(
      "node scripts/smoke-calendar-preview.mjs | tee /tmp/preview-calendar-post-contract-smoke.log",
    );
    expect(postContractRun).not.toContain(
      "ZITADEL_PREVIEW_SUBJECT=${{ secrets.ZITADEL_PREVIEW_SUBJECT }} node scripts/smoke-calendar-preview.mjs",
    );
    expect(postContract).not.toMatch(
      /PROJECTION_EVIDENCE|STRICT_STATUS_DTO|CALLBACK_REPLAY/u,
    );
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
    expect(compatibilityStep).toContain(
      "if: steps.worker_snapshot.outputs.api_existed == 'true' && steps.worker_snapshot.outputs.web_existed == 'true'",
    );
    expect(compatibilityStep).toContain(
      "PREVIEW_RECONCILER_EXISTED: ${{ steps.worker_snapshot.outputs.reconciler_existed }}",
    );
    expect(compatibilityStep).toContain(
      "PREVIEW_UNRESPONSIVE_WORKER_REDEPLOY_COMPLETE_TOPOLOGY_REQUIRED",
    );
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
    expect(ciApiRenderEnvironment).not.toMatch(
      /GOOGLE_CALENDAR|CALENDAR_CREDENTIAL|CALENDAR_FINGERPRINT/u,
    );
    expect(ciWorkflow).not.toMatch(
      /GOOGLE_CALENDAR|CALENDAR_CREDENTIAL|CALENDAR_FINGERPRINT/u,
    );
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
    expect(renderer).toContain(
      '{ binding: "HOTEL_FILES", bucket_name: previewR2BucketName }',
    );
    expect(renderer).not.toContain("RECONCILER_HYPERDRIVE");
    expect(reconcilerRenderer).toContain(
      '{ binding: "RECONCILER_HYPERDRIVE", id: reconcilerHyperdriveId }',
    );
    expect(reconcilerRenderer).not.toContain("HOTEL_FILES");
    expect(reconcilerRenderer).not.toContain("containers");
    expect(reconcilerRenderer).not.toContain("durable_objects");
    expect(reconcilerRenderer).not.toContain("migrations");
    expect(reconcilerRenderer).not.toContain("API_HYPERDRIVE");
    expect(workflow).toContain("PREVIEW_R2_BUCKET_NAME");
    expect(workflow).not.toContain("PREVIEW_FILE_PROCESSOR_IMAGE");
    expect(workflow).not.toContain("wrangler containers");
    expect(workflow).toContain("PREVIEW_R2_BUCKET_READY");
    expect(workflow).toContain("validate-cloudflare-worker-r2-binding.mjs");
    expect(workflow).toContain("PREVIEW_R2_BINDINGS_VERIFIED");
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
    expect(reconcilerEntry).not.toContain(
      "reconcileHotelFileEvidenceFromBindings(env)",
    );
    expect(reconcilerEntry).toContain(
      "reconcileInspectionMaterializationsFromBindings(env)",
    );
    expect(reconcilerEntry).toContain(
      "withPostgresScheduledReconcilerInvocation",
    );
    expect(reconcilerEntry).toContain('resolveDatabaseUrl(env, "RECONCILER")');
    expect(reconcilerEntry).toContain("Promise.allSettled(tasks)");
    expect(reconcilerEntry).toContain("SCHEDULED_RECONCILIATION_FAILED");
    expect(reconcilerEntry).not.toContain("fetch(");
    expect(reconcilerEntry).not.toContain("API_HYPERDRIVE");
  });

  it("dry-runs the Reconciler artifact in CI and fences hosted smoke to exact active Worker versions", () => {
    expect(workflow).toContain("timeout-minutes: 45");
    expect(workflow).not.toContain("timeout-minutes: 25");
    expect(ciWorkflow).toContain("render-reconciler-preview-config.mjs");
    expect(ciWorkflow).toContain("wrangler.reconciler.preview.generated.json");
    expect(ciWorkflow).toContain(
      "RECONCILER_HYPERDRIVE_ID=00000000000000000000000000000000",
    );
    expect(ciWorkflow).toContain(
      "--dry-run --config wrangler.reconciler.preview.generated.json",
    );
    const beforeSmoke = workflow.slice(
      workflow.indexOf("Verify exact active Workers before own Calendar smoke"),
      workflow.indexOf(
        "Verify public Preview path and bootstrap mapping before contract",
      ),
    );
    expect(beforeSmoke).not.toContain("wait-reconciler-drain");
    expect(beforeSmoke).not.toContain("sleep 35");
    const contractDrain = workflow.slice(
      workflow.indexOf(
        "Verify hosted Preview Console credential and callback before contract",
      ),
      workflow.indexOf("Contract Neon Preview tenant authority"),
    );
    expect(contractDrain).toContain("node scripts/wait-reconciler-drain.mjs");
    expect(contractDrain).toContain("RECONCILER_DATABASE_URL_FILE");
    expect(reconcilerDrain).toContain(
      "set_config('lock_timeout','20min',true)",
    );
    expect(contractDrain).toContain(
      "node scripts/decommission-google-calendar-preview.mjs",
    );
    expect(contractDrain).toContain("GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET");
    expect(contractDrain).toContain("CALENDAR_CREDENTIAL_AES_KEYRING_JSON");
    expect(contractDrain.indexOf("wait-reconciler-drain.mjs")).toBeLessThan(
      contractDrain.indexOf("decommission-google-calendar-preview.mjs"),
    );
    expect(contractDrain).not.toContain("sleep 35");
    expect(contractDrain).toContain(
      "printf 'disposition_started=true\\n' >> \"$GITHUB_OUTPUT\"",
    );
    const rollback = workflow.slice(
      workflow.indexOf("Roll back failed Worker release"),
      workflow.indexOf("Remove transient credential files"),
    );
    expect(rollback).toContain(
      "DISPOSITION_STARTED: ${{ steps.google_calendar_disposition.outputs.disposition_started }}",
    );
    expect(rollback).toContain(
      '[[ "$CONTRACT_STARTED" == "true" || "$DISPOSITION_STARTED" == "true" ]]',
    );
    expect(rollback).toContain(
      "PREVIEW_GOOGLE_PROVIDER_DISPOSITION_OPERATOR_RECOVERY_REQUIRED",
    );
    expect(beforeSmoke).toContain(
      "steps.deploy_reconciler.outputs.deployed_version",
    );
    expect(beforeSmoke).toContain("steps.deploy_api.outputs.deployed_version");
    expect(beforeSmoke).toContain("steps.deploy_web.outputs.deployed_version");
    expect(beforeSmoke.match(/percentage == 100/gu)).toHaveLength(1);
    const afterCalendar = workflow.slice(
      workflow.indexOf(
        "Verify hosted Preview own Calendar and responsive UI before contract",
      ),
      workflow.indexOf(
        "Verify hosted Preview Console credential and callback before contract",
      ),
    );
    expect(afterCalendar).toContain(
      "Verify exact active Workers after Calendar smoke",
    );
    expect(afterCalendar).toContain(
      "steps.deploy_reconciler.outputs.deployed_version",
    );
    expect(afterCalendar).toContain(
      "steps.deploy_api.outputs.deployed_version",
    );
    expect(afterCalendar).toContain(
      "steps.deploy_web.outputs.deployed_version",
    );
    const postContract = workflow.slice(
      workflow.indexOf("Contract Neon Preview tenant authority"),
      workflow.indexOf("Record secure session-authority rollback baseline"),
    );
    expect(postContract).toContain(
      "Verify exact active Workers before post-contract own Calendar smoke",
    );
    expect(postContract).toContain(
      "Verify exact active Workers after post-contract own Calendar smoke",
    );
    expect(
      postContract.match(
        /steps\.deploy_reconciler\.outputs\.deployed_version/gu,
      ),
    ).toHaveLength(2);
    expect(
      postContract.match(/steps\.deploy_api\.outputs\.deployed_version/gu),
    ).toHaveLength(2);
    expect(
      postContract.match(/steps\.deploy_web\.outputs\.deployed_version/gu),
    ).toHaveLength(2);
    expect(
      workflow.match(
        /pnpm --filter @werehere\/api exec wrangler deployments list/gu,
      ),
    ).toHaveLength(11);
    expect(workflow).not.toContain("pnpm exec wrangler deployments list");
  });

  it("pins every CI third-party action to the reviewed immutable commit", () => {
    expect(ciWorkflow).toContain(
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    );
    expect(ciWorkflow).toContain(
      "pnpm/action-setup@f520eceda224fe1a4aed5a2a27a194379a409996",
    );
    expect(ciWorkflow).toContain(
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    );
    expect(ciWorkflow).toContain(
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    );
    expect(ciWorkflow).not.toMatch(/uses:\s+(?:actions|pnpm)\/[^@\s]+@v\d+/u);
  });
});
