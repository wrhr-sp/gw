import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import {
  FileScannerAgentError,
  type FileScannerAgentService,
} from "../src/files/scanner-agent";

const agentToken = "scanner-agent-token-" + "A".repeat(32);
const uploadId = "11111111-1111-4111-8111-111111111111";
const claimToken = "B".repeat(43);
const sourceSha256 = "c".repeat(64);
const auth = { authorization: `Bearer ${agentToken}` };

function service(
  overrides: Partial<FileScannerAgentService> = {},
): FileScannerAgentService {
  return {
    claim: vi.fn(async () => null),
    complete: vi.fn(async () => ({ status: "READY_UNLINKED" })),
    ...overrides,
  };
}

describe("Preview file scanner agent routes", () => {
  it("bounds streamed completion bytes by declared length before accumulation", () => {
    const source = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    expect(source).toContain("value.byteLength > expectedLength - total");
  });

  it("rejects missing and wrong bearer credentials before creating work", async () => {
    const scanner = service();
    const app = createApp({
      fileScannerAgentService: scanner,
      fileScannerAgentToken: agentToken,
    });

    const missing = await app.request("/api/internal/v1/file-scanner/claim", {
      method: "POST",
    });
    const wrong = await app.request("/api/internal/v1/file-scanner/claim", {
      headers: { authorization: "Bearer wrong" },
      method: "POST",
    });

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    expect(wrong.headers.get("cache-control")).toBe("no-store");
    expect(await missing.text()).toBe("");
    expect(await wrong.text()).toBe("");
    expect(scanner.claim).not.toHaveBeenCalled();
  });

  it("returns one quarantined source with a fenced receipt only in headers", async () => {
    const body = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    const scanner = service({
      claim: vi.fn(async () => ({
        body,
        claimToken,
        declaredMime: "image/jpeg",
        generation: 2,
        sourceSha256,
        uploadId,
      })),
    });
    const app = createApp({
      fileScannerAgentService: scanner,
      fileScannerAgentToken: agentToken,
    });

    const response = await app.request("/api/internal/v1/file-scanner/claim", {
      headers: auth,
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("x-scanner-upload-id")).toBe(uploadId);
    expect(response.headers.get("x-scanner-claim-token")).toBe(claimToken);
    expect(response.headers.get("x-scanner-generation")).toBe("2");
    expect(response.headers.get("x-scanner-source-length")).toBe(
      String(body.byteLength),
    );
    expect(response.headers.get("x-scanner-source-sha256")).toBe(sourceSha256);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
  });

  it("returns 204 without details when no scan candidate is available", async () => {
    const app = createApp({
      fileScannerAgentService: service(),
      fileScannerAgentToken: agentToken,
    });
    const response = await app.request("/api/internal/v1/file-scanner/claim", {
      headers: auth,
      method: "POST",
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("accepts a bounded clean result and returns no database payload", async () => {
    const scanner = service();
    const app = createApp({
      fileScannerAgentService: scanner,
      fileScannerAgentToken: agentToken,
    });
    const body = new Uint8Array([0xff, 0xd8, 0xff, 9]);

    const response = await app.request(
      "/api/internal/v1/file-scanner/complete",
      {
        body,
        headers: {
          ...auth,
          "content-length": String(body.byteLength),
          "content-type": "image/jpeg",
          "x-scanner-claim-token": claimToken,
          "x-scanner-exif-location-removed": "true",
          "x-scanner-generation": "2",
          "x-scanner-max-dimension": "2048",
          "x-scanner-source-sha256": sourceSha256,
          "x-scanner-upload-id": uploadId,
          "x-scanner-verdict": "CLEAN",
        },
        method: "POST",
      },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(scanner.complete).toHaveBeenCalledWith({
      body,
      claimToken,
      exifLocationRemoved: true,
      generation: 2,
      maxDimension: 2048,
      mimeType: "image/jpeg",
      sourceSha256,
      uploadId,
      verdict: "CLEAN",
    });
  });

  it("rejects oversized and malformed completions before service mutation", async () => {
    const scanner = service();
    const app = createApp({
      fileScannerAgentService: scanner,
      fileScannerAgentToken: agentToken,
    });
    const response = await app.request(
      "/api/internal/v1/file-scanner/complete",
      {
        body: new Uint8Array([1]),
        headers: {
          ...auth,
          "content-length": String(20 * 1024 * 1024 + 1),
          "x-scanner-claim-token": claimToken,
          "x-scanner-generation": "2",
          "x-scanner-source-sha256": sourceSha256,
          "x-scanner-upload-id": uploadId,
          "x-scanner-verdict": "CLEAN",
        },
        method: "POST",
      },
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(scanner.complete).not.toHaveBeenCalled();
  });

  it("cancels a completion stream as soon as actual bytes exceed the bound", async () => {
    const scanner = service();
    const app = createApp({
      fileScannerAgentService: scanner,
      fileScannerAgentToken: agentToken,
    });
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel: () => {
        cancelled = true;
      },
      pull: (controller) => {
        controller.enqueue(new Uint8Array(11 * 1024 * 1024));
      },
    });
    const request = new Request(
      "http://localhost/api/internal/v1/file-scanner/complete",
      {
        body: stream,
        duplex: "half",
        headers: {
          ...auth,
          "content-length": "1",
          "content-type": "image/jpeg",
          "x-scanner-claim-token": claimToken,
          "x-scanner-exif-location-removed": "true",
          "x-scanner-generation": "2",
          "x-scanner-max-dimension": "2048",
          "x-scanner-source-sha256": sourceSha256,
          "x-scanner-upload-id": uploadId,
          "x-scanner-verdict": "CLEAN",
        },
        method: "POST",
      } as RequestInit & { duplex: "half" },
    );

    const response = await app.request(request);

    expect(response.status).toBe(400);
    expect(cancelled).toBe(true);
    expect(scanner.complete).not.toHaveBeenCalled();
  });

  it("maps dependency failures to stable 503 responses", async () => {
    const scanner = service({
      claim: vi.fn(async () => {
        throw new Error("sensitive database failure");
      }),
      complete: vi.fn(async () => {
        throw new Error("sensitive object-store failure");
      }),
    });
    const app = createApp({
      fileScannerAgentService: scanner,
      fileScannerAgentToken: agentToken,
    });
    const claimResponse = await app.request(
      "/api/internal/v1/file-scanner/claim",
      { headers: auth, method: "POST" },
    );
    expect(claimResponse.status).toBe(503);
    expect(claimResponse.headers.get("cache-control")).toBe("no-store");
    expect(await claimResponse.json()).toEqual({
      code: "SCANNER_AGENT_UNAVAILABLE",
    });

    const completionResponse = await app.request(
      "/api/internal/v1/file-scanner/complete",
      {
        headers: {
          ...auth,
          "content-length": "0",
          "x-scanner-claim-token": claimToken,
          "x-scanner-generation": "2",
          "x-scanner-source-sha256": sourceSha256,
          "x-scanner-upload-id": uploadId,
          "x-scanner-verdict": "INFECTED",
        },
        method: "POST",
      },
    );
    expect(completionResponse.status).toBe(503);
    expect(await completionResponse.json()).toEqual({
      code: "SCANNER_AGENT_UNAVAILABLE",
    });
  });

  it("maps stale claims to a stable conflict without provider details", async () => {
    const scanner = service({
      complete: vi.fn(async () => {
        throw new FileScannerAgentError("SCANNER_AGENT_STALE_CLAIM");
      }),
    });
    const app = createApp({
      fileScannerAgentService: scanner,
      fileScannerAgentToken: agentToken,
    });
    const response = await app.request(
      "/api/internal/v1/file-scanner/complete",
      {
        headers: {
          ...auth,
          "content-length": "0",
          "x-scanner-claim-token": claimToken,
          "x-scanner-generation": "2",
          "x-scanner-source-sha256": sourceSha256,
          "x-scanner-upload-id": uploadId,
          "x-scanner-verdict": "INFECTED",
        },
        method: "POST",
      },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "SCANNER_AGENT_STALE_CLAIM",
    });
  });
});
