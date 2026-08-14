import { describe, expect, it, vi } from "vitest";
import {
  FileProcessorClientError,
  createHttpEvidenceFileProcessor,
} from "../src/files/processor-client";

const source = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const secret = "S".repeat(32);

describe("HTTP evidence file processor client", () => {
  it("authenticates, sends an exact bounded body, and validates a clean response", async () => {
    const fetcher = vi.fn(async (request: Request) => {
      expect(request.url).toBe("https://processor.internal/v1/process");
      expect(request.headers.get("authorization")).toBe(`Bearer ${secret}`);
      expect(request.headers.get("content-type")).toBe("image/jpeg");
      expect(request.headers.get("content-length")).toBe(
        String(source.byteLength),
      );
      expect(new Uint8Array(await request.arrayBuffer())).toEqual(source);
      return new Response(new Uint8Array([4, 5]).buffer, {
        status: 200,
        headers: {
          "content-length": "2",
          "content-type": "image/jpeg",
          "x-exif-location-removed": "true",
          "x-max-dimension": "2048",
          "x-scan-verdict": "CLEAN",
        },
      });
    });
    const processor = createHttpEvidenceFileProcessor({
      fetcher,
      sharedSecret: secret,
      url: "https://processor.internal",
    });

    await expect(
      processor.process({
        body: source,
        declaredMime: "image/jpeg",
        maxDimension: 2048,
      }),
    ).resolves.toEqual({
      body: new Uint8Array([4, 5]),
      exifLocationRemoved: true,
      maxDimension: 2048,
      mimeType: "image/jpeg",
      verdict: "CLEAN",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("accepts only the processor's exact infected response", async () => {
    const processor = createHttpEvidenceFileProcessor({
      fetcher: vi.fn(async () =>
        Response.json({ verdict: "INFECTED" }, { status: 422 }),
      ),
      sharedSecret: secret,
      url: "https://processor.internal",
    });
    await expect(
      processor.process({
        body: source,
        declaredMime: "image/jpeg",
        maxDimension: 2048,
      }),
    ).resolves.toEqual({ verdict: "INFECTED" });
  });

  it("fails closed for weak configuration and malformed clean metadata", async () => {
    expect(() =>
      createHttpEvidenceFileProcessor({
        fetcher: vi.fn(),
        sharedSecret: "weak",
        url: "https://processor.internal",
      }),
    ).toThrowError(FileProcessorClientError);
    expect(() =>
      createHttpEvidenceFileProcessor({
        fetcher: vi.fn(),
        sharedSecret: secret,
        timeoutMs: 300_001,
        url: "https://processor.internal",
      }),
    ).toThrowError(FileProcessorClientError);
    expect(() =>
      createHttpEvidenceFileProcessor({
        fetcher: vi.fn(),
        sharedSecret: secret,
        timeoutMs: 240_000,
        url: "https://processor.internal",
      }),
    ).not.toThrow();
    const processor = createHttpEvidenceFileProcessor({
      fetcher: vi.fn(
        async () =>
          new Response(new Uint8Array([4, 5]).buffer, {
            status: 200,
            headers: {
              "content-length": "2",
              "content-type": "image/jpeg",
              "x-exif-location-removed": "false",
              "x-max-dimension": "2048",
              "x-scan-verdict": "CLEAN",
            },
          }),
      ),
      sharedSecret: secret,
      url: "https://processor.internal",
    });
    await expect(
      processor.process({
        body: source,
        declaredMime: "image/jpeg",
        maxDimension: 2048,
      }),
    ).rejects.toMatchObject({ code: "FILE_PROCESSOR_INTEGRITY" });
  });
});
