import { createHash } from "node:crypto";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const CLAIM_TOKEN = /^[A-Za-z0-9_-]{43}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SOURCE_MIME = new Set([
  "image/heic",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type Claim = {
  body: Uint8Array;
  claimToken: string;
  declaredMime: "image/heic" | "image/jpeg" | "image/png" | "image/webp";
  generation: number;
  sourceSha256: string;
  uploadId: string;
};

type OptimizedImage = {
  body: Uint8Array;
  exifLocationRemoved: true;
  maxDimension: number;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export class FileScannerBatchError extends Error {
  constructor(
    public readonly code:
      | "SCANNER_BATCH_API_UNAVAILABLE"
      | "SCANNER_BATCH_INTEGRITY"
      | "SCANNER_BATCH_NOT_CONFIGURED",
  ) {
    super(code);
  }
}

async function readBoundedResponseBody(
  response: Response,
  expectedLength: number,
): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (
        value.byteLength > expectedLength - total ||
        value.byteLength > MAX_FILE_SIZE - total
      ) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  if (total !== expectedLength) return null;
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function runFileScannerBatch(input: {
  agentToken: string;
  apiUrl: string;
  batchSize: number;
  fetcher?: (request: Request) => Promise<Response>;
  optimize: (
    body: Uint8Array,
    mime: Claim["declaredMime"],
  ) => Promise<OptimizedImage>;
  scan: (body: Uint8Array) => Promise<{ verdict: "CLEAN" | "INFECTED" }>;
}) {
  let origin: URL;
  try {
    origin = new URL(input.apiUrl);
  } catch {
    throw new FileScannerBatchError("SCANNER_BATCH_NOT_CONFIGURED");
  }
  const tokenBytes = new TextEncoder().encode(input.agentToken).byteLength;
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    tokenBytes < 32 ||
    tokenBytes > 256 ||
    !Number.isSafeInteger(input.batchSize) ||
    input.batchSize < 1 ||
    input.batchSize > 25
  ) {
    throw new FileScannerBatchError("SCANNER_BATCH_NOT_CONFIGURED");
  }
  const fetcher = input.fetcher ?? fetch;
  const authorization = `Bearer ${input.agentToken}`;

  async function request(request: Request) {
    try {
      return await fetcher(request);
    } catch {
      throw new FileScannerBatchError("SCANNER_BATCH_API_UNAVAILABLE");
    }
  }

  async function claim(): Promise<Claim | null> {
    const response = await request(
      new Request(new URL("/api/internal/v1/file-scanner/claim", origin), {
        headers: { authorization },
        method: "POST",
        signal: AbortSignal.timeout(60_000),
      }),
    );
    if (response.status === 204) {
      await response.body?.cancel();
      return null;
    }
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new FileScannerBatchError("SCANNER_BATCH_API_UNAVAILABLE");
    }
    const contentLength = Number(response.headers.get("content-length"));
    const declaredMime = response.headers.get("content-type")?.split(";", 1)[0];
    const uploadId = response.headers.get("x-scanner-upload-id") ?? "";
    const claimToken = response.headers.get("x-scanner-claim-token") ?? "";
    const generation = Number(response.headers.get("x-scanner-generation"));
    const sourceSha256 = response.headers.get("x-scanner-source-sha256") ?? "";
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 1 ||
      contentLength > MAX_FILE_SIZE ||
      !declaredMime ||
      !SOURCE_MIME.has(declaredMime) ||
      !UUID.test(uploadId) ||
      !CLAIM_TOKEN.test(claimToken) ||
      !Number.isSafeInteger(generation) ||
      generation < 1 ||
      !SHA256.test(sourceSha256)
    ) {
      await response.body?.cancel();
      throw new FileScannerBatchError("SCANNER_BATCH_INTEGRITY");
    }
    const body = await readBoundedResponseBody(response, contentLength);
    if (
      !body ||
      createHash("sha256").update(body).digest("hex") !== sourceSha256
    ) {
      throw new FileScannerBatchError("SCANNER_BATCH_INTEGRITY");
    }
    return {
      body,
      claimToken,
      declaredMime: declaredMime as Claim["declaredMime"],
      generation,
      sourceSha256,
      uploadId,
    };
  }

  async function complete(
    claimed: Claim,
    completion:
      | { optimized: OptimizedImage; verdict: "CLEAN" }
      | { verdict: "FAILED" | "INFECTED" },
  ) {
    const headers = new Headers({
      authorization,
      "x-scanner-claim-token": claimed.claimToken,
      "x-scanner-generation": String(claimed.generation),
      "x-scanner-source-sha256": claimed.sourceSha256,
      "x-scanner-upload-id": claimed.uploadId,
      "x-scanner-verdict": completion.verdict,
    });
    let body: Uint8Array | undefined;
    if (completion.verdict === "CLEAN") {
      const optimized = completion.optimized;
      headers.set("content-length", String(optimized.body.byteLength));
      headers.set("content-type", optimized.mimeType);
      headers.set("x-scanner-exif-location-removed", "true");
      headers.set("x-scanner-max-dimension", String(optimized.maxDimension));
      body = Uint8Array.from(optimized.body);
    } else {
      headers.set("content-length", "0");
    }
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let response: Response;
      try {
        response = await request(
          new Request(
            new URL("/api/internal/v1/file-scanner/complete", origin),
            {
              ...(body ? { body: Uint8Array.from(body) } : {}),
              headers,
              method: "POST",
              signal: AbortSignal.timeout(60_000),
            },
          ),
        );
      } catch (error) {
        if (attempt < 3) continue;
        throw error;
      }
      if (response.status === 204) {
        await response.body?.cancel();
        return;
      }
      await response.body?.cancel();
      if (response.status < 500 || attempt === 3) {
        throw new FileScannerBatchError("SCANNER_BATCH_API_UNAVAILABLE");
      }
    }
  }

  const result = { claimed: 0, clean: 0, failed: 0, infected: 0 };
  for (let index = 0; index < input.batchSize; index += 1) {
    const claimed = await claim();
    if (!claimed) break;
    result.claimed += 1;
    let scanned: { verdict: "CLEAN" | "INFECTED" };
    try {
      scanned = await input.scan(claimed.body);
    } catch {
      await complete(claimed, { verdict: "FAILED" });
      result.failed += 1;
      continue;
    }
    if (scanned.verdict === "INFECTED") {
      await complete(claimed, { verdict: "INFECTED" });
      result.infected += 1;
      continue;
    }
    let optimized: OptimizedImage;
    try {
      optimized = await input.optimize(claimed.body, claimed.declaredMime);
    } catch {
      await complete(claimed, { verdict: "FAILED" });
      result.failed += 1;
      continue;
    }
    await complete(claimed, { optimized, verdict: "CLEAN" });
    result.clean += 1;
  }
  return result;
}
