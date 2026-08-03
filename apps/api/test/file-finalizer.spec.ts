import { describe, expect, it, vi } from "vitest";
import {
  FileFinalizerError,
  createClamAvInstreamScanner,
  createHotelFileFinalizerService,
} from "../src/files/finalizer";
import type { PrivateR2EvidenceStore } from "../src/files/r2";

const uploadId = "c6000000-0000-4000-8000-000000000001";
const sourceKey = `${`quarantine/${uploadId}/`}${"A".repeat(43)}`;
const source = new Uint8Array([1, 2, 3]);

function store(overrides: Partial<PrivateR2EvidenceStore> = {}) {
  return {
    headReservedOriginal: vi.fn(),
    putCleanVersion: vi.fn(async ({ body, fileVersionId }) => ({
      etag: '"cccccccccccccccccccccccccccccccc"',
      objectKey: `clean/${fileVersionId}`,
      objectVersion: "clean-version-1",
      sizeBytes: body.byteLength,
    })),
    putQuarantinedOriginal: vi.fn(),
    putReservedOriginal: vi.fn(),
    readCleanVersion: vi.fn(async () => ({
      body: new Uint8Array([4, 5]),
      etag: '"cccccccccccccccccccccccccccccccc"',
      mimeType: "image/jpeg",
      objectVersion: "clean-version-1",
      sizeBytes: 2,
    })),
    readQuarantinedOriginal: vi.fn(async () => ({
      body: source,
      etag: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      mimeType: "image/jpeg",
      objectVersion: "source-version-1",
      sizeBytes: source.byteLength,
    })),
    reserveQuarantineKey: vi.fn(),
    ...overrides,
  } satisfies PrivateR2EvidenceStore;
}

function claim() {
  return {
    generation: 1,
    mimeType: "image/jpeg",
    phase: "SCANNING" as const,
    quarantineObjectKey: sourceKey,
    sizeBytes: source.byteLength,
    sourceEtag: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
    sourceObjectVersion: "source-version-1",
  };
}

function clamConnection(
  response: string,
  writes: Uint8Array[],
  close = vi.fn(),
) {
  return {
    close,
    readable: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`${response}\0`));
        controller.close();
      },
    }),
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        writes.push(new Uint8Array(chunk));
      },
    }),
  };
}

describe("hotel file finalizer", () => {
  it("uses ClamAV INSTREAM framing and returns CLEAN only for an exact OK response", async () => {
    const writes: Uint8Array[] = [];
    const close = vi.fn();
    const scanner = createClamAvInstreamScanner({
      connect: () => clamConnection("stream: OK", writes, close),
      hostname: "clamav.internal",
      port: 3310,
    });
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);

    await expect(
      scanner.scan({ body: jpeg, declaredMime: "image/jpeg" }),
    ).resolves.toMatchObject({
      detectedMime: "image/jpeg",
      scannerSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      verdict: "CLEAN",
    });
    expect(new TextDecoder().decode(writes[0])).toBe("zINSTREAM\0");
    expect(new DataView(writes[1]!.buffer).getUint32(0, false)).toBe(
      jpeg.byteLength,
    );
    expect(Array.from(writes[1]!.slice(4))).toEqual(Array.from(jpeg));
    expect(writes.at(-1)).toEqual(new Uint8Array(4));
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns INFECTED for FOUND and rejects a declared MIME mismatch before connecting", async () => {
    const writes: Uint8Array[] = [];
    const connect = vi.fn(() =>
      clamConnection("stream: Eicar-Test-Signature FOUND", writes),
    );
    const scanner = createClamAvInstreamScanner({
      connect,
      hostname: "clamav.internal",
      port: 3310,
    });
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);

    await expect(
      scanner.scan({ body: jpeg, declaredMime: "image/jpeg" }),
    ).resolves.toEqual({ verdict: "INFECTED" });
    connect.mockClear();
    await expect(
      scanner.scan({ body: jpeg, declaredMime: "image/png" }),
    ).rejects.toMatchObject({ code: "FILE_FINALIZER_INTEGRITY" });
    expect(connect).not.toHaveBeenCalled();
  });
  it("fails before claiming when scanner or image processing is not configured", () => {
    const command = vi.fn();
    expect(() =>
      createHotelFileFinalizerService({
        repository: { close: vi.fn(), command },
        store: store(),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "FILE_FINALIZER_NOT_CONFIGURED" }),
    );
    expect(command).not.toHaveBeenCalled();
  });

  it("records only a clean, optimized and location-stripped private object", async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce({ status: "CLAIMED", payload: claim() })
      .mockResolvedValueOnce({
        status: "RECORDED",
        payload: { generation: 1 },
      })
      .mockResolvedValueOnce({
        status: "COMPLETED",
        payload: { id: uploadId, status: "READY_UNLINKED" },
      });
    const evidenceStore = store();
    const processor = {
      process: vi.fn(async () => ({
        body: new Uint8Array([4, 5]),
        exifLocationRemoved: true as const,
        maxDimension: 2048,
        mimeType: "image/jpeg" as const,
        verdict: "CLEAN" as const,
      })),
    };
    const service = createHotelFileFinalizerService({
      repository: { close: vi.fn(), command },
      processor,
      store: evidenceStore,
    });

    await expect(service.finalize(uploadId)).resolves.toMatchObject({
      id: uploadId,
      status: "READY_UNLINKED",
    });
    expect(command.mock.calls.map(([input]) => input.action)).toEqual([
      "CLAIM",
      "SCAN_CLEAN",
      "PROMOTE_COMPLETE",
    ]);
    expect(command.mock.calls[1]?.[0].value).toMatchObject({
      cleanObjectKey: expect.stringMatching(/^clean\/[0-9a-f-]{36}$/u),
      detectedMime: "image/jpeg",
      scannerSha256:
        "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
    });
    expect(command.mock.calls[2]?.[0].value).toMatchObject({
      cleanEtag: '"cccccccccccccccccccccccccccccccc"',
      cleanObjectVersion: "clean-version-1",
      cleanSize: 2,
      exifLocationRemoved: true,
    });
  });

  it("rejects a source whose R2 metadata differs from the claimed DB snapshot", async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce({ status: "CLAIMED", payload: claim() })
      .mockResolvedValueOnce({
        status: "REJECTED",
        payload: { id: uploadId, status: "REJECTED" },
      });
    const service = createHotelFileFinalizerService({
      repository: { close: vi.fn(), command },
      scanner: { scan: vi.fn() },
      imageProcessor: { optimizeAndStripLocation: vi.fn() },
      store: store({
        readQuarantinedOriginal: vi.fn(async () => ({
          body: source,
          etag: '"dddddddddddddddddddddddddddddddd"',
          mimeType: "image/jpeg",
          objectVersion: "source-version-1",
          sizeBytes: source.byteLength,
        })),
      }),
    });

    await expect(service.finalize(uploadId)).rejects.toBeInstanceOf(
      FileFinalizerError,
    );
    expect(command.mock.calls.map(([input]) => input.action)).toEqual([
      "CLAIM",
      "REJECT",
    ]);
    expect(command.mock.calls[1]?.[0].value).toEqual({
      failureCode: "SOURCE_INTEGRITY",
    });
  });

  it("resumes promotion with the immutable clean object without rescanning", async () => {
    const fileVersionId = "c7000000-0000-4000-8000-000000000002";
    const command = vi
      .fn()
      .mockResolvedValueOnce({
        status: "CLAIMED",
        payload: {
          cleanObjectKey: `clean/${fileVersionId}`,
          detectedMime: "image/jpeg",
          fileVersionId,
          generation: 8,
          phase: "CLEAN_PENDING_PROMOTION",
        },
      })
      .mockResolvedValueOnce({
        status: "COMPLETED",
        payload: { id: uploadId, status: "READY_UNLINKED" },
      });
    const scanner = { scan: vi.fn() };
    const imageProcessor = { optimizeAndStripLocation: vi.fn() };
    const evidenceStore = store();
    const service = createHotelFileFinalizerService({
      repository: { close: vi.fn(), command },
      scanner,
      imageProcessor,
      store: evidenceStore,
    });

    await expect(service.finalize(uploadId)).resolves.toMatchObject({
      status: "READY_UNLINKED",
    });
    expect(command.mock.calls.map(([input]) => input.action)).toEqual([
      "CLAIM",
      "PROMOTE_COMPLETE",
    ]);
    expect(evidenceStore.readCleanVersion).toHaveBeenCalledWith(
      `clean/${fileVersionId}`,
    );
    expect(scanner.scan).not.toHaveBeenCalled();
    expect(imageProcessor.optimizeAndStripLocation).not.toHaveBeenCalled();
    expect(command.mock.calls[1]?.[0]).toMatchObject({
      generation: 8,
      value: {
        cleanEtag: '"cccccccccccccccccccccccccccccccc"',
        cleanObjectVersion: "clean-version-1",
        cleanSize: 2,
        exifLocationRemoved: true,
        fileVersionId,
      },
    });
  });

  it("records processor unavailability through the fenced durable retry path", async () => {
    const unavailable = new Error("processor unavailable");
    const command = vi
      .fn()
      .mockResolvedValueOnce({ status: "CLAIMED", payload: claim() })
      .mockResolvedValueOnce({ status: "RETRY_SCHEDULED", payload: null });
    const service = createHotelFileFinalizerService({
      processor: { process: vi.fn(async () => Promise.reject(unavailable)) },
      repository: { close: vi.fn(), command },
      store: store(),
    });

    await expect(service.finalize(uploadId)).rejects.toBe(unavailable);
    expect(command.mock.calls.map(([input]) => input.action)).toEqual([
      "CLAIM",
      "FAIL",
    ]);
    expect(command.mock.calls[1]?.[0]).toMatchObject({
      generation: 1,
      uploadId,
      value: {},
    });
  });
});
