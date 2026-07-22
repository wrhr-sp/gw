import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
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
  it("uses the exact Cloudflare token environment variable in every shell request", () => {
    expect(workflow).not.toContain("$CLOUD...OKEN");
    expect(workflow.match(/\$CLOUDFLARE_API_TOKEN\b/gu)).toHaveLength(7);
  });

  it("requires separate lifecycle and bootstrap identity inputs", () => {
    for (const name of [
      "ZITADEL_USER_PROVISIONER_TOKEN",
      "ZITADEL_PREVIEW_SUBJECT_SHA256",
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
  });

  it("reports every missing required Preview configuration in one preflight", () => {
    const preflight = workflow.slice(
      workflow.indexOf("Validate required Preview configuration"),
      workflow.indexOf("Verify approved ZITADEL bootstrap identity"),
    );
    const requiredBlock = /required=\(\n([\s\S]*?)\n\s*\)/u.exec(preflight)?.[1];
    const required = requiredBlock
      ?.split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(required).toEqual([
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
      "AUTH_TRANSACTION_ENCRYPTION_KEY",
      "DATABASE_URL",
      "DATABASE_URL_PREVIEW",
      "DATABASE_API_RUNTIME_PASSWORD_PREVIEW",
      "DATABASE_RECONCILER_PASSWORD_PREVIEW",
      "ZITADEL_SERVICE_USER_TOKEN",
      "ZITADEL_USER_PROVISIONER_TOKEN",
      "ZITADEL_PREVIEW_SUBJECT",
      "ZITADEL_PREVIEW_SUBJECT_SHA256",
      "ZITADEL_PREVIEW_PASSWORD",
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
      .map((line) => line.startsWith("          ") ? line.slice(10) : line)
      .join("\n");
    const empty = spawnSync("bash", { input: shell, encoding: "utf8", env: {} });
    expect(empty.status).toBe(1);
    const missingLines = empty.stderr
      .split("\n")
      .filter((line) => line.startsWith("Missing required Preview configuration: "));
    expect(missingLines).toHaveLength(18);
    expect(new Set(missingLines).size).toBe(18);
    expect(preflight.indexOf("unset ZITADEL_PREVIEW_PASSWORD")).toBeGreaterThan(
      preflight.indexOf("for name in \"${missing[@]}\""),
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
      "Missing required Preview configuration: CLOUDFLARE_ACCOUNT_ID",
    );
    expect(`${oneMissing.stdout}\n${oneMissing.stderr}`).not.toContain(
      "secret-canary-",
    );

    const allPresent = spawnSync("bash", {
      input: shell,
      encoding: "utf8",
      env: Object.fromEntries(required!.map((name, index) => [name, `secret-canary-${index}`])),
    });
    expect(allPresent.status).toBe(0);
    expect(`${allPresent.stdout}\n${allPresent.stderr}`).not.toContain(
      "secret-canary-",
    );
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
    expect(workflow).toContain("node scripts/smoke-zitadel-console-preview.mjs");
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
  });

  it("accepts only complete, empty, or the exact reconciler bootstrap Worker topology", () => {
    const topologyStep = workflow.slice(
      workflow.indexOf("Validate Preview Worker snapshot topology"),
      workflow.indexOf("Expand Neon Preview database for compatible Worker deploy"),
    );
    const shell = topologyStep
      .slice(topologyStep.indexOf("          set -euo pipefail"))
      .split("\n")
      .map((line) => line.startsWith("          ") ? line.slice(10) : line)
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
      workflow.indexOf("Verify previous Workers remain compatible after expand"),
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
    expect(reconcilerEntry).not.toContain("fetch(");
    expect(reconcilerEntry).not.toContain("API_HYPERDRIVE");
  });
});
