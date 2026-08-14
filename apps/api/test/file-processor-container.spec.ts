import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const containerSource = readFileSync(
  new URL("../src/file-processor-container.ts", import.meta.url),
  "utf8",
);
const factorySource = readFileSync(
  new URL("../src/files/factory.ts", import.meta.url),
  "utf8",
);
const rendererSource = readFileSync(
  new URL(
    "../../../scripts/render-reconciler-preview-config.mjs",
    import.meta.url,
  ),
  "utf8",
);
const workflowSource = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
);

describe("Preview private file processor Container wiring", () => {
  it("routes the Reconciler to one private authenticated Container instance", () => {
    expect(containerSource).toContain(
      "extends Container<FileProcessorContainerEnvironment>",
    );
    expect(containerSource).toContain("defaultPort = 8080");
    expect(containerSource).toContain('pingEndpoint = "/health/ready"');
    expect(containerSource).toContain('sleepAfter = "10m"');
    expect(containerSource).toContain("FILE_PROCESSOR_SHARED_SECRET");
    expect(factorySource).toContain(
      'FILE_PROCESSOR_CONTAINER?.getByName("primary")',
    );
    expect(factorySource).toContain('"https://file-processor.internal"');
    expect(factorySource).toContain("startAndWaitForPorts");
    expect(factorySource).toContain("timeoutMs: 120_000");
    expect(factorySource).toContain("portReadyTimeoutMS: 90_000");
    expect(factorySource).toContain("container.fetch(request)");
  });

  it("renders one isolated standard Container with private R2 and no SSH", () => {
    for (const contract of [
      'class_name: "FileProcessorContainer"',
      'name: "FILE_PROCESSOR_CONTAINER"',
      'instance_type: "standard-1"',
      "max_instances: 1",
      "ssh: { enabled: false }",
      'new_sqlite_classes: ["FileProcessorContainer"]',
      '{ binding: "HOTEL_FILES", bucket_name: previewR2BucketName }',
    ])
      expect(rendererSource).toContain(contract);
    expect(workflowSource).toContain("PREVIEW_CONTAINERS_ACCOUNT_READY");
    expect(workflowSource).toContain("FILE_PROCESSOR_SHARED_SECRET_PREVIEW");
    expect(workflowSource).not.toContain("FILE_PROCESSOR_URL:");
  });
});
