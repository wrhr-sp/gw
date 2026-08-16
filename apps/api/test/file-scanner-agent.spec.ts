import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { FileFinalizerRepository } from "@werehere/db";
import {
  createPrivateR2EvidenceStore,
  type PrivateR2EvidenceStore,
} from "../src/files/r2";
import { createFileScannerAgentService } from "../src/files/scanner-agent";

const uploadId = "11111111-1111-4111-8111-111111111111";
const fileVersionId = "22222222-2222-4222-8222-222222222222";
const sourceBody = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]);
const cleanBody = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 9, 8, 7]);
const source = {
  body: sourceBody,
  etag: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
  mimeType: "image/jpeg",
  objectVersion: "source-version-1",
  sizeBytes: sourceBody.byteLength,
};

function claimSnapshot(generation = 1) {
  return {
    generation,
    jobId: "33333333-3333-4333-8333-333333333333",
    mimeType: source.mimeType,
    phase: "SCANNING",
    quarantineObjectKey: `quarantine/${uploadId}/${"Q".repeat(43)}`,
    sizeBytes: source.sizeBytes,
    sourceEtag: source.etag,
    sourceObjectVersion: source.objectVersion,
  };
}

function fixture(command = vi.fn()) {
  const repository = {
    close: vi.fn(async () => undefined),
    command,
    listCandidates: vi.fn(async () => [uploadId]),
  } satisfies FileFinalizerRepository;
  const store = {
    deleteQuarantinedOriginal: vi.fn(async () => undefined),
    putCleanVersion: vi.fn(async (input: { fileVersionId: string }) => ({
      etag: '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"',
      objectKey: `clean/${input.fileVersionId}`,
      objectVersion: "clean-version-1",
      sizeBytes: cleanBody.byteLength,
    })),
    readQuarantinedOriginal: vi.fn(async () => source),
  } as unknown as PrivateR2EvidenceStore;
  return { repository, store };
}

function expectedSha(body: Uint8Array) {
  return createHash("sha256").update(body).digest("hex");
}

function expectedClaimCleanVersionId(generation: number) {
  const bytes = createHash("sha256")
    .update(`${uploadId}\u0000${generation}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

describe("file scanner agent service", () => {
  it("claims one fenced job and returns only the verified quarantined source", async () => {
    const { repository, store } = fixture(
      vi.fn(async () => ({ payload: claimSnapshot(), status: "CLAIMED" })),
    );
    const service = createFileScannerAgentService({ repository, store });

    const claimed = await service.claim();

    expect(claimed).toMatchObject({
      body: sourceBody,
      declaredMime: "image/jpeg",
      generation: 1,
      sourceSha256: expectedSha(sourceBody),
      uploadId,
    });
    expect(claimed?.claimToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(store.readQuarantinedOriginal).toHaveBeenCalledWith(
      `quarantine/${uploadId}/${"Q".repeat(43)}`,
    );
  });

  it("replays the lease, re-reads the source, and promotes a clean result", async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce({ payload: claimSnapshot(), status: "REPLAYED" })
      .mockResolvedValueOnce({
        payload: {
          cleanObjectKey: `clean/${fileVersionId}`,
          fileVersionId,
          generation: 1,
        },
        status: "RECORDED",
      })
      .mockResolvedValueOnce({
        payload: { status: "READY_UNLINKED" },
        status: "COMPLETED",
      });
    const { repository, store } = fixture(command);
    const service = createFileScannerAgentService({ repository, store });

    const completed = await service.complete({
      body: cleanBody,
      claimToken: "A".repeat(43),
      exifLocationRemoved: true,
      generation: 1,
      maxDimension: 2048,
      mimeType: "image/jpeg",
      sourceSha256: expectedSha(sourceBody),
      uploadId,
      verdict: "CLEAN",
    });

    expect(completed).toEqual({ status: "READY_UNLINKED" });
    expect(store.readQuarantinedOriginal).toHaveBeenCalledTimes(1);
    expect(store.putCleanVersion).toHaveBeenCalledWith({
      body: cleanBody,
      fileVersionId: expectedClaimCleanVersionId(1),
      mimeType: "image/jpeg",
    });
    expect(store.deleteQuarantinedOriginal).toHaveBeenCalledWith(
      `quarantine/${uploadId}/${"Q".repeat(43)}`,
    );
    expect(command.mock.calls.map(([input]) => input.action)).toEqual([
      "CLAIM",
      "SCAN_CLEAN",
      "PROMOTE_COMPLETE",
    ]);
    expect(command.mock.calls[1]?.[0].value).toMatchObject({
      scannerSha256: expectedSha(sourceBody),
    });
  });

  it("replays the durable terminal receipt and idempotently retries quarantine deletion", async () => {
    const command = vi.fn(async () => ({
      payload: {
        cleanSha256: expectedSha(cleanBody),
        completionVerdict: "CLEAN",
        detectedMime: "image/jpeg",
        generation: 1,
        phase: "TERMINAL",
        quarantineObjectKey: `quarantine/${uploadId}/${"Q".repeat(43)}`,
        snapshot: { status: "READY_UNLINKED" },
        sourceSha256: expectedSha(sourceBody),
      },
      status: "REPLAYED",
    }));
    const { repository, store } = fixture(command);
    const service = createFileScannerAgentService({ repository, store });

    await expect(
      service.complete({
        body: cleanBody,
        claimToken: "R".repeat(43),
        exifLocationRemoved: true,
        generation: 1,
        maxDimension: 2048,
        mimeType: "image/jpeg",
        sourceSha256: expectedSha(sourceBody),
        uploadId,
        verdict: "CLEAN",
      }),
    ).resolves.toEqual({ status: "READY_UNLINKED" });
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CLAIM", generation: 1 }),
    );
    expect(store.readQuarantinedOriginal).not.toHaveBeenCalled();
    expect(store.putCleanVersion).not.toHaveBeenCalled();
    expect(store.deleteQuarantinedOriginal).toHaveBeenCalledWith(
      `quarantine/${uploadId}/${"Q".repeat(43)}`,
    );
  });

  it("recovers a terminal DB commit after the first quarantine delete fails", async () => {
    const command = vi.fn(async () => ({
      payload: {
        cleanSha256: expectedSha(cleanBody),
        completionVerdict: "CLEAN",
        detectedMime: "image/jpeg",
        generation: 1,
        phase: "TERMINAL",
        quarantineObjectKey: `quarantine/${uploadId}/${"Q".repeat(43)}`,
        snapshot: { status: "READY_UNLINKED" },
        sourceSha256: expectedSha(sourceBody),
      },
      status: "REPLAYED",
    }));
    const { repository, store } = fixture(command);
    vi.mocked(store.deleteQuarantinedOriginal!).mockRejectedValueOnce(
      new Error("transient R2"),
    );
    const service = createFileScannerAgentService({ repository, store });
    const completion = {
      body: cleanBody,
      claimToken: "T".repeat(43),
      exifLocationRemoved: true as const,
      generation: 1,
      maxDimension: 2048,
      mimeType: "image/jpeg" as const,
      sourceSha256: expectedSha(sourceBody),
      uploadId,
      verdict: "CLEAN" as const,
    };

    await expect(service.complete(completion)).rejects.toThrow("transient R2");
    await expect(service.complete(completion)).resolves.toEqual({
      status: "READY_UNLINKED",
    });
    expect(store.deleteQuarantinedOriginal).toHaveBeenCalledTimes(2);
  });

  it("replays an exact retry-scheduled failed completion without a new claim", async () => {
    const command = vi.fn(async () => ({
      payload: {
        completionVerdict: "FAILED",
        generation: 1,
        phase: "RETRY_SCHEDULED",
        sourceSha256: expectedSha(sourceBody),
      },
      status: "REPLAYED",
    }));
    const { repository, store } = fixture(command);
    const service = createFileScannerAgentService({ repository, store });

    await expect(
      service.complete({
        claimToken: "E".repeat(43),
        generation: 1,
        sourceSha256: expectedSha(sourceBody),
        uploadId,
        verdict: "FAILED",
      }),
    ).resolves.toBeNull();
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CLAIM",
        value: {
          completionVerdict: "FAILED",
          sourceSha256: expectedSha(sourceBody),
        },
      }),
    );
    expect(store.readQuarantinedOriginal).not.toHaveBeenCalled();
    expect(store.putCleanVersion).not.toHaveBeenCalled();
    expect(store.deleteQuarantinedOriginal).not.toHaveBeenCalled();
  });

  it("deletes the quarantined source when scan-engine retries are exhausted", async () => {
    const command = vi.fn(async ({ action }: { action: string }) =>
      action === "CLAIM"
        ? { payload: claimSnapshot(), status: "CLAIMED" }
        : { payload: { status: "SCAN_FAILED" }, status: "SCAN_FAILED" },
    );
    const { repository, store } = fixture(command);
    const service = createFileScannerAgentService({ repository, store });

    await expect(
      service.complete({
        claimToken: "F".repeat(43),
        generation: 1,
        sourceSha256: expectedSha(sourceBody),
        uploadId,
        verdict: "FAILED",
      }),
    ).resolves.toEqual({ status: "SCAN_FAILED" });
    expect(store.deleteQuarantinedOriginal).toHaveBeenCalledWith(
      `quarantine/${uploadId}/${"Q".repeat(43)}`,
    );
    expect(command.mock.calls.map(([input]) => input.action)).toEqual([
      "CLAIM",
      "FAIL",
    ]);
  });

  it("recovers a SCAN_FAILED terminal commit after the first quarantine delete fails", async () => {
    const key = `quarantine/${uploadId}/${"Q".repeat(43)}`;
    const command = vi
      .fn()
      .mockResolvedValueOnce({ payload: claimSnapshot(), status: "CLAIMED" })
      .mockResolvedValueOnce({
        payload: { status: "SCAN_FAILED" },
        status: "SCAN_FAILED",
      })
      .mockResolvedValueOnce({
        payload: {
          cleanSha256: null,
          completionVerdict: "FAILED",
          detectedMime: null,
          generation: 1,
          phase: "TERMINAL",
          quarantineObjectKey: key,
          snapshot: { status: "SCAN_FAILED" },
          sourceSha256: expectedSha(sourceBody),
        },
        status: "REPLAYED",
      });
    const { repository, store } = fixture(command);
    vi.mocked(store.deleteQuarantinedOriginal!).mockRejectedValueOnce(
      new Error("transient R2"),
    );
    const service = createFileScannerAgentService({ repository, store });
    const completion = {
      claimToken: "F".repeat(43),
      generation: 1,
      sourceSha256: expectedSha(sourceBody),
      uploadId,
      verdict: "FAILED" as const,
    };

    await expect(service.complete(completion)).rejects.toThrow("transient R2");
    await expect(service.complete(completion)).resolves.toEqual({
      status: "SCAN_FAILED",
    });
    expect(store.deleteQuarantinedOriginal).toHaveBeenNthCalledWith(1, key);
    expect(store.deleteQuarantinedOriginal).toHaveBeenNthCalledWith(2, key);
    expect(command.mock.calls.map(([input]) => input.action)).toEqual([
      "CLAIM",
      "FAIL",
      "CLAIM",
    ]);
  });

  it("records an infected result without writing a clean object", async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce({ payload: claimSnapshot(), status: "REPLAYED" })
      .mockResolvedValueOnce({
        payload: { status: "REJECTED" },
        status: "REJECTED",
      });
    const { repository, store } = fixture(command);
    const service = createFileScannerAgentService({ repository, store });

    await expect(
      service.complete({
        claimToken: "B".repeat(43),
        generation: 1,
        sourceSha256: expectedSha(sourceBody),
        uploadId,
        verdict: "INFECTED",
      }),
    ).resolves.toEqual({ status: "REJECTED" });
    expect(store.putCleanVersion).not.toHaveBeenCalled();
    expect(store.deleteQuarantinedOriginal).toHaveBeenCalledWith(
      `quarantine/${uploadId}/${"Q".repeat(43)}`,
    );
    expect(command.mock.calls.map(([input]) => input.action)).toEqual([
      "CLAIM",
      "REJECT",
    ]);
  });

  it("rejects a stale lease before any R2 mutation", async () => {
    const { repository, store } = fixture(
      vi.fn(async () => ({ payload: null, status: "BUSY" })),
    );
    const service = createFileScannerAgentService({ repository, store });

    await expect(
      service.complete({
        claimToken: "C".repeat(43),
        generation: 1,
        sourceSha256: expectedSha(sourceBody),
        uploadId,
        verdict: "INFECTED",
      }),
    ).rejects.toMatchObject({ code: "SCANNER_AGENT_STALE_CLAIM" });
    expect(store.readQuarantinedOriginal).not.toHaveBeenCalled();
    expect(store.putCleanVersion).not.toHaveBeenCalled();
  });

  it("rejects source drift and never accepts the runner verdict", async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce({ payload: claimSnapshot(), status: "REPLAYED" })
      .mockResolvedValueOnce({
        payload: { status: "REJECTED" },
        status: "REJECTED",
      });
    const { repository, store } = fixture(command);
    vi.mocked(store.readQuarantinedOriginal).mockResolvedValue({
      ...source,
      etag: '"cccccccccccccccccccccccccccccccc"',
    });
    const service = createFileScannerAgentService({ repository, store });

    await expect(
      service.complete({
        claimToken: "D".repeat(43),
        generation: 1,
        sourceSha256: expectedSha(sourceBody),
        uploadId,
        verdict: "INFECTED",
      }),
    ).rejects.toMatchObject({ code: "SCANNER_AGENT_SOURCE_INTEGRITY" });
    expect(store.putCleanVersion).not.toHaveBeenCalled();
    expect(command.mock.calls.map(([input]) => input.action)).toEqual([
      "CLAIM",
      "REJECT",
    ]);
  });
});

describe("private R2 bounded reads", () => {
  const privateKey = `quarantine/${uploadId}/${"A".repeat(43)}`;
  const cleanKey = `clean/${fileVersionId}`;
  const metadata = {
    etag: "a".repeat(32),
    httpMetadata: { contentType: "image/jpeg" },
    version: "version-1",
  };

  it("rejects oversized metadata before reading any quarantine bytes", async () => {
    const getReader = vi.fn();
    const arrayBuffer = vi.fn();
    const store = createPrivateR2EvidenceStore({
      get: vi.fn(async () => ({
        ...metadata,
        arrayBuffer,
        body: { getReader } as unknown as ReadableStream<Uint8Array>,
        size: 20 * 1024 * 1024 + 1,
      })),
      put: vi.fn(),
    });

    await expect(store.readQuarantinedOriginal(privateKey)).rejects.toMatchObject({
      code: "FILE_INTEGRITY_MISMATCH",
    });
    expect(getReader).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("cancels a clean object stream that exceeds its declared size", async () => {
    const cancel = vi.fn(async () => undefined);
    const releaseLock = vi.fn();
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2]) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([3, 4]) });
    const getReader = vi.fn(() => ({ cancel, read, releaseLock }));
    const arrayBuffer = vi.fn();
    const store = createPrivateR2EvidenceStore({
      get: vi.fn(async () => ({
        ...metadata,
        arrayBuffer,
        body: { getReader } as unknown as ReadableStream<Uint8Array>,
        size: 3,
      })),
      put: vi.fn(),
    });

    await expect(store.readCleanVersion(cleanKey)).rejects.toMatchObject({
      code: "FILE_INTEGRITY_MISMATCH",
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("reuses an exact existing deterministic clean object after conditional put ambiguity", async () => {
    const body = new Uint8Array([9, 8, 7]);
    const store = createPrivateR2EvidenceStore({
      get: vi.fn(async () => ({
        ...metadata,
        arrayBuffer: vi.fn(),
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(body);
            controller.close();
          },
        }),
        size: body.byteLength,
      })),
      put: vi.fn(async () => null),
    });

    await expect(
      store.putCleanVersion({ body, fileVersionId, mimeType: "image/jpeg" }),
    ).resolves.toEqual({
      etag: `"${"a".repeat(32)}"`,
      objectKey: cleanKey,
      objectVersion: "version-1",
      sizeBytes: body.byteLength,
    });
  });
});
