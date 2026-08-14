import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createPrivateFileProcessorFetcher } from "../src/files/factory";

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
const dockerfileSource = readFileSync(
  new URL("../../file-processor/Dockerfile", import.meta.url),
  "utf8",
);

describe("Preview private file processor Container wiring", () => {
  it("routes the Reconciler to one isolated authenticated Container instance", () => {
    expect(containerSource).toContain(
      "extends Container<FileProcessorContainerEnvironment>",
    );
    expect(containerSource).toContain("defaultPort = 8080");
    expect(containerSource).toContain(
      'pingEndpoint = "localhost/health/ready"',
    );
    expect(containerSource).toContain("enableInternet = false");
    expect(containerSource).toContain('sleepAfter = "10m"');
    expect(containerSource).toContain("FILE_PROCESSOR_SHARED_SECRET");
    expect(factorySource).toContain(
      'FILE_PROCESSOR_CONTAINER?.getByName("primary")',
    );
    expect(factorySource).toContain('"https://file-processor.internal"');
    expect(factorySource).toContain("startAndWaitForPorts");
    expect(factorySource).toContain("timeoutMs: 240_000");
    expect(factorySource).toContain("portReadyTimeoutMS: 90_000");
    expect(factorySource).toContain("container.fetch(request)");
    expect(dockerfileSource).toContain("&& freshclam \\");
    expect(dockerfileSource).toContain(
      'CMD ["sh", "-ec", "clamd && exec node dist/src/index.js"]',
    );
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
      "image: previewFileProcessorImage",
    ])
      expect(rendererSource).toContain(contract);
    expect(rendererSource).toContain(
      "PREVIEW_FILE_PROCESSOR_IMAGE was not digest-pinned",
    );
    expect(rendererSource).not.toContain(
      'image: "../file-processor/Dockerfile"',
    );
    expect(workflowSource).toContain("PREVIEW_CONTAINERS_ACCOUNT_READY");
    expect(workflowSource).toContain("FILE_PROCESSOR_SHARED_SECRET_PREVIEW");
    expect(workflowSource).not.toContain("FILE_PROCESSOR_URL:");
  });

  it("waits for HTTP readiness before forwarding a processing request", async () => {
    const order: string[] = [];
    const container = {
      startAndWaitForPorts: vi.fn(async () => {
        order.push("start");
      }),
      fetch: vi.fn(async (request: Request) => {
        if (request.url.endsWith("/health/ready")) {
          order.push("ready");
          return Response.json({ status: "ready" });
        }
        order.push("process");
        return new Response(null, { status: 200 });
      }),
    };
    const response = await createPrivateFileProcessorFetcher(container)(
      new Request("https://file-processor.internal/v1/process", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(order).toEqual(["start", "ready", "process"]);
    expect(container.startAndWaitForPorts).toHaveBeenCalledWith({
      cancellationOptions: {
        instanceGetTimeoutMS: 30_000,
        portReadyTimeoutMS: 90_000,
        waitInterval: 1_000,
      },
      ports: 8080,
    });
  });

  it("fails closed before processing when HTTP readiness is unavailable", async () => {
    const processRequest = vi.fn();
    const container = {
      startAndWaitForPorts: vi.fn(async () => undefined),
      fetch: vi.fn(async (request: Request) => {
        if (request.url.endsWith("/health/ready")) {
          return Response.json({ status: "unavailable" }, { status: 503 });
        }
        processRequest();
        return new Response(null, { status: 200 });
      }),
    };
    await expect(
      createPrivateFileProcessorFetcher(container)(
        new Request("https://file-processor.internal/v1/process", {
          method: "POST",
        }),
      ),
    ).rejects.toThrow("FILE_PROCESSOR_NOT_READY");
    expect(processRequest).not.toHaveBeenCalled();
  });
});
