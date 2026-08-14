import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrivateR2EvidenceStore } from "../src/files/r2";

const originalFixedLengthStream = Reflect.get(globalThis, "FixedLengthStream");

afterEach(() => {
  if (originalFixedLengthStream === undefined) {
    Reflect.deleteProperty(globalThis, "FixedLengthStream");
  } else {
    Reflect.set(globalThis, "FixedLengthStream", originalFixedLengthStream);
  }
});

describe("private R2 upload stream", () => {
  it("re-establishes the declared length before a service-bound stream reaches R2", async () => {
    const declaredLengths: number[] = [];
    class TestFixedLengthStream {
      readonly readable: ReadableStream<Uint8Array>;
      readonly writable: WritableStream<Uint8Array>;

      constructor(length: number) {
        declaredLengths.push(length);
        const transform = new TransformStream<Uint8Array, Uint8Array>();
        this.readable = transform.readable;
        this.writable = transform.writable;
      }
    }
    Reflect.set(globalThis, "FixedLengthStream", TestFixedLengthStream);

    const received: number[] = [];
    const put = vi.fn(async (_key, value: ReadableStream<Uint8Array>) => {
      const reader = value.getReader();
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        received.push(...chunk);
      }
      return { etag: "a".repeat(32), version: "version-1" };
    });
    const store = createPrivateR2EvidenceStore({ put });
    const uploadId = "10000000-0000-4000-8000-000000000001";
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    });

    const result = await store.putReservedOriginal({
      body: source,
      contentLength: 3,
      mimeType: "image/png",
      objectKey: `quarantine/${uploadId}/${"a".repeat(43)}`,
      uploadId,
    });

    expect(declaredLengths).toEqual([3]);
    expect(received).toEqual([1, 2, 3]);
    expect(result.etag).toBe(`"${"a".repeat(32)}"`);
  });

  it("fails closed when the runtime cannot restore a fixed upload length", async () => {
    Reflect.deleteProperty(globalThis, "FixedLengthStream");
    const put = vi.fn();
    const store = createPrivateR2EvidenceStore({ put });
    const uploadId = "10000000-0000-4000-8000-000000000001";

    await expect(
      store.putReservedOriginal({
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.close();
          },
        }),
        contentLength: 3,
        mimeType: "image/png",
        objectKey: `quarantine/${uploadId}/${"a".repeat(43)}`,
        uploadId,
      }),
    ).rejects.toMatchObject({
      code: "FILE_STORAGE_UNAVAILABLE",
      httpStatus: 503,
      retryable: true,
    });
    expect(put).not.toHaveBeenCalled();
  });
});
