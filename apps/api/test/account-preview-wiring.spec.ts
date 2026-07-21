import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
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

  it("verifies the approved ZITADEL identity before database bootstrap", () => {
    const verifyStep = "Verify approved ZITADEL bootstrap identity";
    const expandStep =
      "Expand Neon Preview database for compatible Worker deploy";
    const contractStep = "Contract Neon Preview tenant authority";
    expect(workflow).toContain(verifyStep);
    expect(workflow).toContain(
      "pnpm exec tsx packages/db/scripts/verify-zitadel-bootstrap.ts",
    );
    expect(workflow.indexOf(verifyStep)).toBeLessThan(
      workflow.indexOf(expandStep),
    );
    expect(workflow.indexOf(verifyStep)).toBeLessThan(
      workflow.indexOf(contractStep),
    );
    expect(workflow).toMatch(
      /Verify approved ZITADEL bootstrap identity[\s\S]*ZITADEL_USER_PROVISIONER_TOKEN:[\s\S]*secrets\.ZITADEL_USER_PROVISIONER_TOKEN/u,
    );
  });

  it("fails closed when only part of the Preview Worker topology exists", () => {
    expect(workflow).toContain("Validate Preview Worker snapshot topology");
    expect(workflow).toContain(
      "Preview Worker topology is partial; refusing release.",
    );
    expect(workflow).toContain(
      'if [[ "$api" == "true" && "$reconciler" == "true" && "$web" == "true" ]]',
    );
    expect(workflow).toContain(
      'if [[ "$api" == "false" && "$reconciler" == "false" && "$web" == "false" ]]',
    );
    expect(workflow).toMatch(
      /Verify previous Workers remain compatible after expand[\s\S]*api_existed == 'true'[\s\S]*reconciler_existed == 'true'[\s\S]*web_existed == 'true'/u,
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
