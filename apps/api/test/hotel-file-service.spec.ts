import type { AuthenticatedPrincipal } from "@werehere/contracts";
import type { HotelFileApiRepository } from "@werehere/db";
import { describe, expect, it, vi } from "vitest";
import { createHotelFileService, type HotelFileStorage } from "../src/hotel-files/service";

const principal: AuthenticatedPrincipal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF",
  displayName: "파일 담당자",
};
const uploadId = "52000000-0000-4000-8000-000000000001";
const grantId = "54000000-0000-4000-8000-000000000001";
const authority = {
  status: "AUTHORIZED" as const,
  uploadId,
  uploadState: "PENDING_UPLOAD" as const,
  quarantineObjectKey: `quarantine/${"a".repeat(64)}`,
  reservedSizeBytes: 4,
  declaredMimeType: "image/jpeg" as const,
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  reservationFingerprint: "f".repeat(43),
  sourceEtag: null,
  sourceObjectVersion: null,
};

function repository(overrides: Partial<HotelFileApiRepository> = {}): HotelFileApiRepository {
  return {
    initializeUpload: vi.fn(), completeUpload: vi.fn(), authorizeUploadBody: vi.fn(),
    issueAccessGrant: vi.fn(), resolveAccessGrant: vi.fn(), recordAccessOutcome: vi.fn(),
    recordAccessDenial: vi.fn(),
    getStatus: vi.fn(), linkCleanVersion: vi.fn(), claimScan: vi.fn(), completeScan: vi.fn(),
    reserveCleanPromotion: vi.fn(), completeCleanPromotion: vi.fn(), close: vi.fn(),
    ...overrides,
  } as HotelFileApiRepository;
}

function storage(overrides: Partial<HotelFileStorage> = {}): HotelFileStorage {
  return {
    putQuarantine: vi.fn(), headQuarantine: vi.fn(), getClean: vi.fn(), ...overrides,
  } as HotelFileStorage;
}

function cleanGrant() {
  return {
    status: "AUTHORIZED" as const,
    fileVersionId: "53000000-0000-4000-8000-000000000001",
    cleanObjectKey: "clean/object",
    destinationEtag: "etag-clean",
    destinationObjectVersion: "version-clean",
    sha256: Buffer.alloc(32, 1),
    sizeBytes: 4,
    mimeType: "image/jpeg",
    fileName: "clean.jpg",
    disposition: "ATTACHMENT" as const,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  };
}

describe("hotel file service orchestration", () => {
  it("creates a DB-compatible opaque 64-hex quarantine key", async () => {
    const initializeUpload = vi.fn(async (input) => ({
      status: "CREATED" as const,
      uploadId: input.uploadId!,
      state: "PENDING_UPLOAD" as const,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    }));
    const service = createHotelFileService({ publicAppOrigin: "https://hotel.example", repository: repository({ initializeUpload }), storage: storage() });
    await service.initializeUpload(principal, {
      hotelId: "50000000-0000-4000-8000-000000000001",
      parentType: "INSPECTION_RESULT",
      parentId: "51000000-0000-4000-8000-000000000001",
      fileName: "inspection.jpg",
      sizeBytes: 4,
      mimeType: "image/jpeg",
    }, "file-init-12345678");
    expect(initializeUpload.mock.calls[0]?.[0].quarantineObjectKey).toMatch(/^quarantine\/[0-9a-f]{64}$/u);
  });

  it("fails closed when an upload-init replay expires before the response is built", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const initializeUpload = vi.fn(async () => ({
      status: "REPLAYED" as const,
      uploadId,
      state: "PENDING_UPLOAD" as const,
      expiresAt,
    }));
    const service = createHotelFileService({
      now: () => new Date("2030-01-01T00:00:00.001Z"),
      publicAppOrigin: "https://hotel.example",
      repository: repository({ initializeUpload }),
      storage: storage(),
    });
    await expect(service.initializeUpload(principal, {
      hotelId: "50000000-0000-4000-8000-000000000001",
      parentType: "INSPECTION_RESULT",
      parentId: "51000000-0000-4000-8000-000000000001",
      fileName: "inspection.jpg",
      sizeBytes: 4,
      mimeType: "image/jpeg",
    }, "file-init-expired-replay")).resolves.toEqual({ status: "NOT_FOUND" });
  });

  it("replays complete without a second R2 HEAD after DB is already QUARANTINED", async () => {
    const authorizeUploadBody = vi
      .fn()
      .mockResolvedValueOnce(authority)
      .mockResolvedValueOnce({ ...authority, uploadState: "QUARANTINED", sourceEtag: "etag-1", sourceObjectVersion: "version-1" });
    const completeUpload = vi
      .fn()
      .mockResolvedValueOnce({ status: "CREATED", uploadId, scanJobId: grantId, state: "QUARANTINED" })
      .mockResolvedValueOnce({ status: "REPLAYED", uploadId, scanJobId: grantId, state: "QUARANTINED" });
    const headQuarantine = vi.fn(async () => ({ status: "FOUND" as const, etag: "etag-1", objectVersion: "version-1", sizeBytes: 4, mimeType: "image/jpeg" }));
    const service = createHotelFileService({ publicAppOrigin: "https://hotel.example", repository: repository({ authorizeUploadBody, completeUpload }), storage: storage({ headQuarantine }) });
    await expect(service.completeUpload(principal, uploadId, '"etag-1"')).resolves.toMatchObject({ status: "OK" });
    await expect(service.completeUpload(principal, uploadId, '"etag-1"')).resolves.toMatchObject({ status: "OK" });
    expect(headQuarantine).toHaveBeenCalledTimes(1);
  });

  it("binds grantId and records STARTED then SUCCEEDED only after stream completion", async () => {
    const outcomes: string[] = [];
    const repo = repository({
      resolveAccessGrant: vi.fn(async (input) => {
        expect(input.grantId).toBe(grantId);
        return cleanGrant();
      }),
      recordAccessOutcome: vi.fn(async (input) => {
        outcomes.push(input.outcome);
        return { status: "RECORDED" as const };
      }),
    });
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3, 4])); controller.close(); } });
    const service = createHotelFileService({ publicAppOrigin: "https://hotel.example", repository: repo, storage: storage({ getClean: vi.fn(async () => ({ status: "AUTHORIZED" as const, body })) }) });
    const result = await service.resolveAccess(principal, grantId, "g".repeat(43));
    expect(result.status).toBe("OK");
    expect(outcomes).toEqual(["STARTED"]);
    if (result.status !== "OK") throw new Error("not authorized");
    await new Response(result.value.body).arrayBuffer();
    expect(outcomes).toEqual(["STARTED", "SUCCEEDED"]);
  });

  it.each([
    ["cancel", "ABORTED"],
    ["error", "FAILED"],
  ] as const)("records %s stream terminal state as %s", async (mode, expected) => {
    const outcomes: string[] = [];
    const source = mode === "cancel"
      ? new ReadableStream<Uint8Array>({ pull() {} })
      : new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error("stream failed")); } });
    const service = createHotelFileService({
      publicAppOrigin: "https://hotel.example",
      repository: repository({
        resolveAccessGrant: vi.fn(async () => cleanGrant()),
        recordAccessOutcome: vi.fn(async (input) => { outcomes.push(input.outcome); return { status: "RECORDED" as const }; }),
      }),
      storage: storage({ getClean: vi.fn(async () => ({ status: "AUTHORIZED" as const, body: source })) }),
    });
    const result = await service.resolveAccess(principal, grantId, "g".repeat(43));
    if (result.status !== "OK") throw new Error("not authorized");
    if (mode === "cancel") await result.value.body.cancel("client disconnected");
    else await expect(new Response(result.value.body).arrayBuffer()).rejects.toThrow("stream failed");
    expect(outcomes).toEqual(["STARTED", expected]);
  });

  it("fails closed before opening CLEAN storage when STARTED audit is rejected", async () => {
    const getClean = vi.fn();
    const service = createHotelFileService({
      publicAppOrigin: "https://hotel.example",
      repository: repository({
        resolveAccessGrant: vi.fn(async () => cleanGrant()),
        recordAccessOutcome: vi.fn(async () => ({ status: "NOT_FOUND" as const })),
      }),
      storage: storage({ getClean }),
    });
    await expect(service.resolveAccess(principal, grantId, "g".repeat(43))).resolves.toEqual({ status: "NOT_FOUND" });
    expect(getClean).not.toHaveBeenCalled();
  });

  it("fails the response and closes the repository when terminal audit is rejected", async () => {
    const close = vi.fn(async () => undefined);
    const recordAccessOutcome = vi
      .fn()
      .mockResolvedValueOnce({ status: "RECORDED" as const })
      .mockResolvedValueOnce({ status: "NOT_FOUND" as const });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    const service = createHotelFileService({
      publicAppOrigin: "https://hotel.example",
      repository: repository({
        close,
        resolveAccessGrant: vi.fn(async () => cleanGrant()),
        recordAccessOutcome,
      }),
      storage: storage({ getClean: vi.fn(async () => ({ status: "AUTHORIZED" as const, body })) }),
    });
    const result = await service.resolveAccess(principal, grantId, "g".repeat(43));
    if (result.status !== "OK") throw new Error("not authorized");
    await expect(new Response(result.value.body).arrayBuffer()).rejects.toThrow(
      "Hotel file access audit rejected",
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("records STARTED then FAILED when CLEAN storage lookup fails", async () => {
    const outcomes: string[] = [];
    const service = createHotelFileService({
      publicAppOrigin: "https://hotel.example",
      repository: repository({
        resolveAccessGrant: vi.fn(async () => cleanGrant()),
        recordAccessOutcome: vi.fn(async (input) => {
          outcomes.push(input.outcome);
          return { status: "RECORDED" as const };
        }),
      }),
      storage: storage({ getClean: vi.fn(async () => ({ status: "NOT_FOUND" as const })) }),
    });
    await expect(service.resolveAccess(principal, grantId, "g".repeat(43))).resolves.toEqual({ status: "NOT_FOUND" });
    expect(outcomes).toEqual(["STARTED", "FAILED"]);
  });

  it("does not open CLEAN storage when STARTED audit throws", async () => {
    const getClean = vi.fn();
    const service = createHotelFileService({
      publicAppOrigin: "https://hotel.example",
      repository: repository({
        resolveAccessGrant: vi.fn(async () => cleanGrant()),
        recordAccessOutcome: vi.fn(async () => { throw new Error("audit unavailable"); }),
      }),
      storage: storage({ getClean }),
    });
    await expect(service.resolveAccess(principal, grantId, "g".repeat(43))).rejects.toThrow("audit unavailable");
    expect(getClean).not.toHaveBeenCalled();
  });
});
