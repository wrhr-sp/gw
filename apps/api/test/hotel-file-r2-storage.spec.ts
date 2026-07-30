import { describe, expect, it, vi } from "vitest";

import {
  createPrivateR2Storage,
  type R2BucketLike,
  type R2ObjectBodyLike,
  type R2ObjectLike,
} from "../src/hotel-files/r2-storage.js";

const key = "opaque/db-derived/object-key";
const contentType = "application/pdf";
const reservationFingerprint = "reservation-fingerprint";
const declaredSizeBytes = 4;

function stream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>();
}

function object(overrides: Partial<R2ObjectLike> = {}): R2ObjectLike {
  return {
    key,
    etag: "etag-1",
    version: "version-1",
    size: declaredSizeBytes,
    httpMetadata: { contentType },
    customMetadata: {
      reservationFingerprint,
      declaredSizeBytes: String(declaredSizeBytes),
    },
    ...overrides,
  };
}

function cleanObject(overrides: Partial<R2ObjectBodyLike> = {}): R2ObjectBodyLike {
  return {
    ...object({ customMetadata: { sha256: "a".repeat(64) } }),
    body: stream(),
    ...overrides,
  };
}

function bucket(overrides: Partial<R2BucketLike> = {}): R2BucketLike {
  return {
    put: vi.fn(),
    head: vi.fn(),
    get: vi.fn(),
    ...overrides,
  };
}

const quarantineRequest = (body: ReadableStream<Uint8Array>) => ({
  key,
  body,
  contentType,
  reservationFingerprint,
  declaredSizeBytes,
});

const cleanRequest = {
  key,
  destinationEtag: "etag-1",
  objectVersion: "version-1",
  sha256Hex: "a".repeat(64),
  sizeBytes: declaredSizeBytes,
  mimeType: contentType,
};

describe("private R2 hotel-file storage", () => {
  it("conditionally creates quarantine content without buffering or changing its opaque key", async () => {
    const body = stream();
    const created = object();
    const put = vi.fn().mockResolvedValue(created);
    const storage = createPrivateR2Storage(bucket({ put }));

    const result = await storage.putQuarantine(quarantineRequest(body));

    expect(put).toHaveBeenCalledWith(key, body, {
      onlyIf: { etagDoesNotMatch: "*" },
      httpMetadata: { contentType },
      customMetadata: {
        reservationFingerprint,
        declaredSizeBytes: String(declaredSizeBytes),
      },
    });
    expect(result).toEqual({
      status: "CREATED",
      evidence: {
        key,
        etag: "etag-1",
        version: "version-1",
        sizeBytes: declaredSizeBytes,
        mimeType: contentType,
        reservationFingerprint,
      },
    });
  });

  it("returns REPLAYED only when conditional failure read-back has identical evidence", async () => {
    const head = vi.fn().mockResolvedValue(object());
    const storage = createPrivateR2Storage(
      bucket({ put: vi.fn().mockResolvedValue(null), head }),
    );

    await expect(storage.putQuarantine(quarantineRequest(stream()))).resolves.toEqual({
      status: "REPLAYED",
      evidence: {
        key,
        etag: "etag-1",
        version: "version-1",
        sizeBytes: declaredSizeBytes,
        mimeType: contentType,
        reservationFingerprint,
      },
    });
    expect(head).toHaveBeenCalledWith(key);
  });

  it.each([
    ["fingerprint", { customMetadata: { reservationFingerprint: "other", declaredSizeBytes: "4" } }],
    ["size", { size: 5 }],
    ["mime", { httpMetadata: { contentType: "text/plain" } }],
  ])("returns CONFLICT for a replay %s mismatch", async (_name, mismatch) => {
    const storage = createPrivateR2Storage(
      bucket({
        put: vi.fn().mockResolvedValue(null),
        head: vi.fn().mockResolvedValue(object(mismatch)),
      }),
    );

    await expect(storage.putQuarantine(quarantineRequest(stream()))).resolves.toEqual({
      status: "CONFLICT",
    });
  });

  it("does not manufacture success when put throws", async () => {
    const head = vi.fn();
    const storage = createPrivateR2Storage(
      bucket({ put: vi.fn().mockRejectedValue(new Error("R2 unavailable")), head }),
    );

    await expect(storage.putQuarantine(quarantineRequest(stream()))).resolves.toEqual({
      status: "STORAGE_UNAVAILABLE",
    });
    expect(head).not.toHaveBeenCalled();
  });

  it("returns exact quarantine HEAD evidence for completion", async () => {
    const storage = createPrivateR2Storage(bucket({ head: vi.fn().mockResolvedValue(object()) }));
    await expect(storage.headQuarantine({
      key,
      destinationEtag: "etag-1",
      contentType,
      reservationFingerprint,
      declaredSizeBytes,
    })).resolves.toMatchObject({ status: "FOUND", evidence: { etag: "etag-1", version: "version-1" } });
  });

  it.each([
    ["etag", { etag: "other" }],
    ["fingerprint", { customMetadata: { reservationFingerprint: "other", declaredSizeBytes: "4" } }],
    ["size", { size: 5 }],
    ["mime", { httpMetadata: { contentType: "text/plain" } }],
  ])("rejects quarantine HEAD %s mismatch", async (_name, mismatch) => {
    const storage = createPrivateR2Storage(bucket({ head: vi.fn().mockResolvedValue(object(mismatch)) }));
    await expect(storage.headQuarantine({
      key,
      destinationEtag: "etag-1",
      contentType,
      reservationFingerprint,
      declaredSizeBytes,
    })).resolves.toEqual({ status: "EVIDENCE_MISMATCH" });
  });

  it("authorizes clean content only when every expected evidence field matches", async () => {
    const stored = cleanObject();
    const storage = createPrivateR2Storage(bucket({ get: vi.fn().mockResolvedValue(stored) }));

    const result = await storage.getClean(cleanRequest);

    expect(result).toEqual({
      status: "AUTHORIZED",
      body: stored.body,
      file: {
        sizeBytes: declaredSizeBytes,
        mimeType: contentType,
        sha256Hex: "a".repeat(64),
        etag: "etag-1",
        version: "version-1",
      },
    });
  });

  it.each([
    ["key", { key: "another-key" }],
    ["etag", { etag: "another-etag" }],
    ["version", { version: "another-version" }],
    ["size", { size: 5 }],
    ["mime", { httpMetadata: { contentType: "text/plain" } }],
    ["sha256", { customMetadata: { sha256: "b".repeat(64) } }],
  ])("rejects clean content when %s evidence mismatches", async (_name, mismatch) => {
    const stored = cleanObject(mismatch);
    const cancel = vi.spyOn(stored.body, "cancel");
    const storage = createPrivateR2Storage(
      bucket({ get: vi.fn().mockResolvedValue(stored) }),
    );

    await expect(storage.getClean(cleanRequest)).resolves.toEqual({
      status: "EVIDENCE_MISMATCH",
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND when the exact clean key does not exist", async () => {
    const storage = createPrivateR2Storage(bucket({ get: vi.fn().mockResolvedValue(null) }));

    await expect(storage.getClean(cleanRequest)).resolves.toEqual({ status: "NOT_FOUND" });
  });

  it("returns STORAGE_UNAVAILABLE when clean retrieval throws", async () => {
    const storage = createPrivateR2Storage(
      bucket({ get: vi.fn().mockRejectedValue(new Error("R2 unavailable")) }),
    );

    await expect(storage.getClean(cleanRequest)).resolves.toEqual({
      status: "STORAGE_UNAVAILABLE",
    });
  });
});
