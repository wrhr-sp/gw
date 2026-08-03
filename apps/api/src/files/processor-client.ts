import type { EvidenceFileProcessor } from "./finalizer";

const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class FileProcessorClientError extends Error {
  constructor(
    public readonly code:
      | "FILE_PROCESSOR_INTEGRITY"
      | "FILE_PROCESSOR_NOT_CONFIGURED"
      | "FILE_PROCESSOR_UNAVAILABLE",
  ) {
    super(code);
  }
}

function endpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FileProcessorClientError("FILE_PROCESSOR_NOT_CONFIGURED");
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new FileProcessorClientError("FILE_PROCESSOR_NOT_CONFIGURED");
  }
  return new URL("/v1/process", url).toString();
}

export function createHttpEvidenceFileProcessor(input: {
  fetcher?: (request: Request) => Promise<Response>;
  sharedSecret: string;
  timeoutMs?: number;
  url: string;
}): EvidenceFileProcessor {
  if (new TextEncoder().encode(input.sharedSecret).byteLength < 32) {
    throw new FileProcessorClientError("FILE_PROCESSOR_NOT_CONFIGURED");
  }
  const processUrl = endpoint(input.url);
  const timeoutMs = input.timeoutMs ?? 60_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new FileProcessorClientError("FILE_PROCESSOR_NOT_CONFIGURED");
  }
  const fetcher = input.fetcher ?? fetch;
  return {
    async process({ body, declaredMime, maxDimension }) {
      if (
        body.byteLength < 1 ||
        body.byteLength > 20 * 1024 * 1024 ||
        maxDimension !== 2048
      ) {
        throw new FileProcessorClientError("FILE_PROCESSOR_INTEGRITY");
      }
      let response: Response;
      try {
        response = await fetcher(
          new Request(processUrl, {
            body: Uint8Array.from(body).buffer,
            headers: {
              authorization: `Bearer ${input.sharedSecret}`,
              "content-length": String(body.byteLength),
              "content-type": declaredMime,
            },
            method: "POST",
            signal: AbortSignal.timeout(timeoutMs),
          }),
        );
      } catch {
        throw new FileProcessorClientError("FILE_PROCESSOR_UNAVAILABLE");
      }
      if (response.status === 422) {
        const payload = await response.json().catch(() => null);
        if (
          payload &&
          typeof payload === "object" &&
          !Array.isArray(payload) &&
          Object.keys(payload).length === 1 &&
          (payload as { verdict?: unknown }).verdict === "INFECTED"
        ) {
          return { verdict: "INFECTED" };
        }
        throw new FileProcessorClientError("FILE_PROCESSOR_INTEGRITY");
      }
      if (response.status !== 200) {
        throw new FileProcessorClientError(
          response.status === 401
            ? "FILE_PROCESSOR_NOT_CONFIGURED"
            : "FILE_PROCESSOR_UNAVAILABLE",
        );
      }
      const contentLength = Number(response.headers.get("content-length"));
      const mimeType = response.headers.get("content-type")?.split(";", 1)[0];
      const processedMaxDimension = Number(response.headers.get("x-max-dimension"));
      if (
        response.headers.get("x-scan-verdict") !== "CLEAN" ||
        response.headers.get("x-exif-location-removed") !== "true" ||
        !mimeType ||
        !MIME_TYPES.has(mimeType) ||
        !Number.isSafeInteger(contentLength) ||
        contentLength < 1 ||
        contentLength > 20 * 1024 * 1024 ||
        !Number.isSafeInteger(processedMaxDimension) ||
        processedMaxDimension < 1 ||
        processedMaxDimension > maxDimension
      ) {
        throw new FileProcessorClientError("FILE_PROCESSOR_INTEGRITY");
      }
      const processedBody = new Uint8Array(await response.arrayBuffer());
      if (processedBody.byteLength !== contentLength) {
        throw new FileProcessorClientError("FILE_PROCESSOR_INTEGRITY");
      }
      return {
        body: processedBody,
        exifLocationRemoved: true,
        maxDimension: processedMaxDimension,
        mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
        verdict: "CLEAN",
      };
    },
  };
}
