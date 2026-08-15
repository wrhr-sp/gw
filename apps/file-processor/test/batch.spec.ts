import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { runFileScannerBatch } from "../src/batch";

const apiUrl = "https://api.preview.example";
const agentToken = "preview-scanner-agent-" + "A".repeat(32);
const uploadId = "11111111-1111-4111-8111-111111111111";
const claimToken = "B".repeat(43);
const source = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
const sourceSha256 = createHash("sha256").update(source).digest("hex");
const clean = new Uint8Array([0xff, 0xd8, 0xff, 9]);

function claimResponse() {
  return new Response(source, {
    headers: {
      "content-type": "image/jpeg",
      "x-scanner-claim-token": claimToken,
      "x-scanner-generation": "2",
      "x-scanner-source-length": String(source.byteLength),
      "x-scanner-source-sha256": sourceSha256,
      "x-scanner-upload-id": uploadId,
    },
    status: 200,
  });
}

function input(fetcher: (request: Request) => Promise<Response>) {
  return {
    agentToken,
    apiUrl,
    batchSize: 25,
    fetcher,
    optimize: vi.fn(async () => ({
      body: clean,
      exifLocationRemoved: true as const,
      maxDimension: 2048,
      mimeType: "image/jpeg" as const,
    })),
    scan: vi.fn(
      async (): Promise<{ verdict: "CLEAN" | "INFECTED" }> => ({
        verdict: "CLEAN",
      }),
    ),
  };
}

describe("Preview free file scanner batch", () => {
  it("rejects a transport length that disagrees with the scanner source length", async () => {
    const fetcher = vi.fn(async () => {
      const response = claimResponse();
      response.headers.set("content-length", String(source.byteLength + 1));
      return response;
    });

    await expect(runFileScannerBatch(input(fetcher))).rejects.toMatchObject({
      code: "SCANNER_BATCH_INTEGRITY",
    });
  });

  it("claims, scans, optimizes, completes, and stops at an empty queue", async () => {
    const requests: Request[] = [];
    const fetcher = vi.fn(async (request: Request) => {
      requests.push(request);
      if (requests.length === 1) return claimResponse();
      if (requests.length === 2) return new Response(null, { status: 204 });
      return new Response(null, { status: 204 });
    });
    const options = input(fetcher);

    const result = await runFileScannerBatch(options);

    expect(result).toEqual({ claimed: 1, clean: 1, failed: 0, infected: 0 });
    expect(options.scan).toHaveBeenCalledWith(source);
    expect(options.optimize).toHaveBeenCalledWith(source, "image/jpeg");
    const completion = requests[1]!;
    expect(new URL(completion.url).pathname).toBe(
      "/api/internal/v1/file-scanner/complete",
    );
    expect(completion.headers.get("authorization")).toBe(
      `Bearer ${agentToken}`,
    );
    expect(completion.headers.get("x-scanner-verdict")).toBe("CLEAN");
    expect(completion.headers.get("x-scanner-claim-token")).toBe(claimToken);
    expect(new Uint8Array(await completion.arrayBuffer())).toEqual(clean);
  });

  it("submits infected without optimization or file bytes", async () => {
    const requests: Request[] = [];
    const fetcher = vi.fn(async (request: Request) => {
      requests.push(request);
      if (requests.length === 1) return claimResponse();
      if (requests.length === 2) return new Response(null, { status: 204 });
      return new Response(null, { status: 204 });
    });
    const options = input(fetcher);
    vi.mocked(options.scan).mockResolvedValue({ verdict: "INFECTED" });

    await expect(runFileScannerBatch(options)).resolves.toEqual({
      claimed: 1,
      clean: 0,
      failed: 0,
      infected: 1,
    });
    expect(options.optimize).not.toHaveBeenCalled();
    expect(requests[1]!.headers.get("x-scanner-verdict")).toBe("INFECTED");
    expect((await requests[1]!.arrayBuffer()).byteLength).toBe(0);
  });

  it("reports processor failure for retry and never fabricates CLEAN", async () => {
    const requests: Request[] = [];
    const fetcher = vi.fn(async (request: Request) => {
      requests.push(request);
      if (requests.length === 1) return claimResponse();
      if (requests.length === 2) return new Response(null, { status: 204 });
      return new Response(null, { status: 204 });
    });
    const options = input(fetcher);
    vi.mocked(options.scan).mockRejectedValue(
      new Error("provider-secret-body"),
    );

    await expect(runFileScannerBatch(options)).resolves.toEqual({
      claimed: 1,
      clean: 0,
      failed: 1,
      infected: 0,
    });
    expect(requests[1]!.headers.get("x-scanner-verdict")).toBe("FAILED");
    expect(options.optimize).not.toHaveBeenCalled();
  });

  it("fails with a stable code without reflecting API bodies or tokens", async () => {
    const fetcher = vi.fn(
      async () => new Response(`sensitive ${agentToken}`, { status: 503 }),
    );

    await expect(runFileScannerBatch(input(fetcher))).rejects.toThrow(
      "SCANNER_BATCH_API_UNAVAILABLE",
    );
    await expect(runFileScannerBatch(input(fetcher))).rejects.not.toThrow(
      agentToken,
    );
  });

  it("rejects transfer corruption before ClamAV or completion", async () => {
    const fetcher = vi.fn(async () => {
      const response = claimResponse();
      response.headers.set("x-scanner-source-sha256", "d".repeat(64));
      return response;
    });
    const options = input(fetcher);

    await expect(runFileScannerBatch(options)).rejects.toThrow(
      "SCANNER_BATCH_INTEGRITY",
    );
    expect(options.scan).not.toHaveBeenCalled();
    expect(options.optimize).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("cancels a claim stream before reading beyond the declared or global bound", async () => {
    let pulls = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel: () => {
        cancelled = true;
      },
      pull: (controller) => {
        pulls += 1;
        controller.enqueue(new Uint8Array(11 * 1024 * 1024));
        if (pulls === 2) controller.close();
      },
    });
    const response = new Response(stream, {
      headers: {
        "content-length": "1",
        "content-type": "image/jpeg",
        "x-scanner-claim-token": claimToken,
        "x-scanner-generation": "2",
        "x-scanner-source-sha256": "d".repeat(64),
        "x-scanner-upload-id": uploadId,
      },
      status: 200,
    });
    const fetcher = vi.fn(async () => response);
    const options = input(fetcher);

    await expect(runFileScannerBatch(options)).rejects.toThrow(
      "SCANNER_BATCH_INTEGRITY",
    );
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(2);
    expect(options.scan).not.toHaveBeenCalled();
  });

  it("retries the exact completion after response loss", async () => {
    const completions: Request[] = [];
    let call = 0;
    const fetcher = vi.fn(async (request: Request) => {
      call += 1;
      if (call === 1) return claimResponse();
      if (call === 2) {
        completions.push(request.clone());
        throw new Error("response lost after commit");
      }
      if (call === 3) {
        completions.push(request.clone());
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 204 });
    });

    await expect(runFileScannerBatch(input(fetcher))).resolves.toEqual({
      claimed: 1,
      clean: 1,
      failed: 0,
      infected: 0,
    });
    expect(completions).toHaveLength(2);
    expect(completions[0]!.headers.get("x-scanner-claim-token")).toBe(
      completions[1]!.headers.get("x-scanner-claim-token"),
    );
    expect(new Uint8Array(await completions[0]!.arrayBuffer())).toEqual(
      new Uint8Array(await completions[1]!.arrayBuffer()),
    );
  });

  it("rejects unsafe configuration before any network request", async () => {
    const fetcher = vi.fn();
    await expect(
      runFileScannerBatch({ ...input(fetcher), batchSize: 26 }),
    ).rejects.toThrow("SCANNER_BATCH_NOT_CONFIGURED");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
