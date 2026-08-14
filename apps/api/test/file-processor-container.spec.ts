import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const apiPackage = read("apps/api/package.json");
const apiSource = read("apps/api/src/app.ts");
const batchSource = read("apps/file-processor/src/batch.ts");
const factorySource = read("apps/api/src/files/factory.ts");
const reconcilerSource = read("apps/api/src/reconciler-index.ts");
const rendererSource = read("scripts/render-reconciler-preview-config.mjs");
const releaseWorkflow = read(".github/workflows/preview-release.yml");
const scannerWorkflow = read(".github/workflows/preview-file-scanner.yml");
const clamAvPreparation = read("scripts/prepare-preview-clamav.sh");

describe("Preview free file scanner wiring", () => {
  it("removes every Cloudflare Container runtime dependency", () => {
    for (const source of [
      apiPackage,
      factorySource,
      reconcilerSource,
      rendererSource,
      releaseWorkflow,
    ]) {
      expect(source).not.toContain("@cloudflare/containers");
      expect(source).not.toContain("FILE_PROCESSOR_CONTAINER");
      expect(source).not.toContain("FileProcessorContainer");
      expect(source).not.toContain("wrangler containers");
      expect(source).not.toContain("PREVIEW_FILE_PROCESSOR_IMAGE");
    }
    expect(reconcilerSource).not.toContain(
      "reconcileHotelFileEvidenceFromBindings(env)",
    );
  });

  it("keeps private R2 on the API but not the scan-free Reconciler", () => {
    expect(releaseWorkflow).toContain("PREVIEW_R2_BUCKET_READY");
    expect(releaseWorkflow).toContain(
      "node scripts/render-api-preview-config.mjs",
    );
    expect(rendererSource).not.toContain("config.r2_buckets");
    expect(rendererSource).not.toContain("config.containers");
    expect(rendererSource).not.toContain("config.durable_objects");
    expect(rendererSource).not.toContain("config.migrations");
  });

  it("deploys only the scanner agent secret and retires the legacy processor secret", () => {
    expect(releaseWorkflow).toContain(
      "PREVIEW_FILE_SCANNER_AGENT_TOKEN: ${{ secrets.PREVIEW_FILE_SCANNER_AGENT_TOKEN }}",
    );
    expect(releaseWorkflow).toContain("FILE_SCANNER_AGENT_TOKEN");
    expect(releaseWorkflow).toContain(
      'retired_keys=\'["GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET","CALENDAR_CREDENTIAL_AES_KEYRING_JSON","CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON","FILE_PROCESSOR_SHARED_SECRET"]\'',
    );
    expect(releaseWorkflow).not.toContain(
      "FILE_PROCESSOR_SHARED_SECRET_PREVIEW",
    );
    expect(releaseWorkflow).not.toContain(
      "FILE_PROCESSOR_SHARED_SECRET: ${{ secrets.",
    );
    expect(releaseWorkflow).toContain("/containers/applications");
    expect(releaseWorkflow).toContain(
      "PREVIEW_LEGACY_CONTAINER_APPLICATION_ABSENT",
    );
    expect(releaseWorkflow).not.toContain(
      "PREVIEW_LEGACY_CONTAINER_PROVIDER_INERT_FREE_PLAN",
    );
    expect(releaseWorkflow).not.toContain(
      '[[ "$status" == "401" || "$status" == "403" ]]',
    );
  });

  it("runs one hourly GitHub-hosted batch with no paid runner or billing mutation", () => {
    expect(scannerWorkflow).toContain('cron: "17 * * * *"');
    expect(scannerWorkflow).toContain("workflow_dispatch:");
    expect(scannerWorkflow).toContain("runs-on: ubuntu-latest");
    expect(scannerWorkflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(scannerWorkflow).toContain("environment: preview");
    expect(scannerWorkflow).toContain("timeout-minutes: 15");
    expect(scannerWorkflow).toContain("concurrency:");
    expect(scannerWorkflow).toContain("group: preview-file-scanner");
    expect(releaseWorkflow).toContain("group: preview-file-scanner");
    expect(scannerWorkflow).toContain("PREVIEW_FILE_SCANNER_AGENT_TOKEN");
    expect(
      scannerWorkflow.match(/^\s+PREVIEW_FILE_SCANNER_AGENT_TOKEN:/gmu),
    ).toHaveLength(1);
    const preparationStep = scannerWorkflow.slice(
      scannerWorkflow.indexOf("Prepare trusted ClamAV signatures"),
      scannerWorkflow.indexOf("Scan bounded Preview quarantine batch"),
    );
    expect(preparationStep).not.toContain("PREVIEW_FILE_SCANNER_AGENT_TOKEN");
    expect(scannerWorkflow).toContain(
      "pnpm --filter @werehere/file-processor scan:preview",
    );
    expect(scannerWorkflow).toContain("bash scripts/prepare-preview-clamav.sh");
    const ciWorkflow = read(".github/workflows/ci.yml");
    expect(ciWorkflow).toContain("pnpm audit --audit-level=high");
    expect(ciWorkflow).toContain("bash scripts/prepare-preview-clamav.sh");
    expect(ciWorkflow).not.toContain("Build file processor container");
    expect(ciWorkflow).not.toContain("docker build -f apps/file-processor/Dockerfile");
    expect(clamAvPreparation).toContain("freshclam --quiet");
    expect(clamAvPreparation).toContain("sudo clamd");
    expect(clamAvPreparation).toContain("self-test:clamav");
    expect(clamAvPreparation).toContain("FILE_PROCESSOR_CLAMAV_SELF_TEST_OK");
    expect(scannerWorkflow).not.toContain("self-hosted");
    expect(scannerWorkflow).not.toMatch(/billing|payment|spending-limit/iu);
  });

  it("uses the public Web proxy without exposing the private API Worker", () => {
    expect(apiSource).toContain(
      'hotelApp.post("/api/internal/v1/file-scanner/claim"',
    );
    expect(apiSource).toContain(
      'hotelApp.post("/api/internal/v1/file-scanner/complete"',
    );
    expect(batchSource).toContain(
      'new URL("/api/internal/v1/file-scanner/claim", origin)',
    );
    expect(batchSource).toContain(
      'new URL("/api/internal/v1/file-scanner/complete", origin)',
    );
  });
});
