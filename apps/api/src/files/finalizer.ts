import type { FileFinalizerRepository } from "@werehere/db";
import type { PrivateR2EvidenceStore } from "./r2";

export type MalwareScanResult =
  | {
      detectedMime: "image/heic" | "image/jpeg" | "image/png" | "image/webp";
      scannerSha256: string;
      verdict: "CLEAN";
    }
  | { verdict: "INFECTED" };

export interface MalwareScanner {
  scan(input: {
    body: Uint8Array;
    declaredMime: string;
  }): Promise<MalwareScanResult>;
}

export interface ClamAvConnection {
  close(): void;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

export type ClamAvConnectionFactory = (input: {
  hostname: string;
  port: number;
}) => ClamAvConnection;

function detectedImageMime(
  body: Uint8Array,
): "image/heic" | "image/jpeg" | "image/png" | "image/webp" {
  if (
    body.length >= 3 &&
    body[0] === 0xff &&
    body[1] === 0xd8 &&
    body[2] === 0xff
  )
    return "image/jpeg";
  if (
    body.length >= 8 &&
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47 &&
    body[4] === 0x0d &&
    body[5] === 0x0a &&
    body[6] === 0x1a &&
    body[7] === 0x0a
  )
    return "image/png";
  if (
    body.length >= 12 &&
    String.fromCharCode(...body.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...body.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  if (
    body.length >= 12 &&
    String.fromCharCode(...body.slice(4, 8)) === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(
      String.fromCharCode(...body.slice(8, 12)),
    )
  )
    return "image/heic";
  throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");
}

export function createClamAvInstreamScanner(input: {
  connect: ClamAvConnectionFactory;
  hostname: string;
  port: number;
  timeoutMs?: number;
}): MalwareScanner {
  if (
    !input.hostname.trim() ||
    !Number.isSafeInteger(input.port) ||
    input.port < 1 ||
    input.port > 65_535
  )
    throw new FileFinalizerError("FILE_FINALIZER_NOT_CONFIGURED");
  const timeoutMs = input.timeoutMs ?? 30_000;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1_000 ||
    timeoutMs > 60_000
  )
    throw new FileFinalizerError("FILE_FINALIZER_NOT_CONFIGURED");

  return {
    async scan({ body, declaredMime }) {
      const detectedMime = detectedImageMime(body);
      if (declaredMime !== detectedMime)
        throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");
      const connection = input.connect({
        hostname: input.hostname,
        port: input.port,
      });
      const writer = connection.writable.getWriter();
      const reader = connection.readable.getReader();
      let timeoutHandle: ReturnType<typeof setTimeout>;
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new FileFinalizerError("FILE_FINALIZER_INTEGRITY")),
          timeoutMs,
        );
      });
      try {
        await writer.write(new TextEncoder().encode("zINSTREAM\0"));
        for (let offset = 0; offset < body.byteLength; offset += 64 * 1024) {
          const chunk = body.slice(offset, offset + 64 * 1024);
          const frame = new Uint8Array(4 + chunk.byteLength);
          new DataView(frame.buffer).setUint32(0, chunk.byteLength, false);
          frame.set(chunk, 4);
          await writer.write(frame);
        }
        await writer.write(new Uint8Array(4));
        await writer.close();

        const response = await Promise.race([
          (async () => {
            const bytes: number[] = [];
            while (bytes.length <= 4096) {
              const next = await reader.read();
              if (next.done) break;
              for (const byte of next.value) {
                if (byte === 0 || byte === 10)
                  return new TextDecoder().decode(new Uint8Array(bytes));
                bytes.push(byte);
              }
            }
            return new TextDecoder().decode(new Uint8Array(bytes));
          })(),
          timeout,
        ]);
        if (/^stream: OK$/u.test(response)) {
          return {
            detectedMime,
            scannerSha256: await hexDigest(body),
            verdict: "CLEAN",
          };
        }
        if (/^stream: .+ FOUND$/u.test(response))
          return { verdict: "INFECTED" };
        throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");
      } finally {
        clearTimeout(timeoutHandle!);
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
        connection.close();
      }
    },
  };
}

export interface EvidenceImageProcessor {
  optimizeAndStripLocation(input: {
    body: Uint8Array;
    detectedMime: "image/heic" | "image/jpeg" | "image/png" | "image/webp";
    maxDimension: 2048;
  }): Promise<{
    body: Uint8Array;
    exifLocationRemoved: true;
    maxDimension: number;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
  }>;
}

export class FileFinalizerError extends Error {
  constructor(
    public readonly code:
      | "FILE_FINALIZER_INTEGRITY"
      | "FILE_FINALIZER_NOT_CONFIGURED"
      | "FILE_FINALIZER_REJECTED"
      | "FILE_FINALIZER_STALE_CLAIM",
  ) {
    super(code);
  }
}

type ScanningClaimSnapshot = {
  generation: number;
  mimeType: string;
  phase: "SCANNING";
  quarantineObjectKey: string;
  sizeBytes: number;
  sourceEtag: string;
  sourceObjectVersion: string;
};

type PromotionClaimSnapshot = {
  cleanObjectKey: string;
  detectedMime: string;
  fileVersionId: string;
  generation: number;
  phase: "CLEAN_PENDING_PROMOTION";
};

type ClaimSnapshot = ScanningClaimSnapshot | PromotionClaimSnapshot;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");
  return value as Record<string, unknown>;
}

function claimSnapshot(value: unknown): ClaimSnapshot {
  const snapshot = record(value);
  if (
    typeof snapshot.generation !== "number" ||
    !Number.isSafeInteger(snapshot.generation) ||
    snapshot.generation < 1
  )
    throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");
  if (snapshot.phase === "CLEAN_PENDING_PROMOTION") {
    if (
      typeof snapshot.cleanObjectKey !== "string" ||
      typeof snapshot.detectedMime !== "string" ||
      typeof snapshot.fileVersionId !== "string"
    )
      throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");
    return snapshot as PromotionClaimSnapshot;
  }
  if (
    snapshot.phase !== "SCANNING" ||
    typeof snapshot.mimeType !== "string" ||
    typeof snapshot.quarantineObjectKey !== "string" ||
    typeof snapshot.sizeBytes !== "number" ||
    typeof snapshot.sourceEtag !== "string" ||
    typeof snapshot.sourceObjectVersion !== "string"
  )
    throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");
  return snapshot as ScanningClaimSnapshot;
}

function claimToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function hexDigest(body: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(body).buffer,
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function commandAccepted(status: string, accepted: readonly string[]) {
  if (status === "STALE_CLAIM")
    throw new FileFinalizerError("FILE_FINALIZER_STALE_CLAIM");
  if (!accepted.includes(status))
    throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");
}

export interface HotelFileFinalizerService {
  close?(): Promise<void>;
  finalize(uploadId: string): Promise<unknown>;
}

export function createHotelFileFinalizerService(input: {
  imageProcessor?: EvidenceImageProcessor;
  repository: FileFinalizerRepository;
  scanner?: MalwareScanner;
  store: PrivateR2EvidenceStore;
}): HotelFileFinalizerService {
  if (!input.scanner || !input.imageProcessor)
    throw new FileFinalizerError("FILE_FINALIZER_NOT_CONFIGURED");
  const scanner = input.scanner;
  const imageProcessor = input.imageProcessor;

  async function command(
    uploadId: string,
    action: "CLAIM" | "PROMOTE_COMPLETE" | "REJECT" | "SCAN_CLEAN",
    token: string,
    generation: number,
    value: unknown,
  ) {
    return input.repository.command({
      action,
      claimToken: token,
      generation,
      traceId: crypto.randomUUID(),
      uploadId,
      value,
    });
  }

  return {
    close: () => input.repository.close(),
    async finalize(uploadId) {
      const token = claimToken();
      const claimed = await command(uploadId, "CLAIM", token, 0, {});
      commandAccepted(claimed.status, ["CLAIMED", "REPLAYED"]);
      const claim = claimSnapshot(claimed.payload);
      if (claim.phase === "CLEAN_PENDING_PROMOTION") {
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
            claim.fileVersionId,
          ) ||
          claim.cleanObjectKey !== `clean/${claim.fileVersionId}`
        )
          throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");
        const clean = await input.store.readCleanVersion(claim.cleanObjectKey);
        if (
          clean.mimeType !== claim.detectedMime ||
          clean.sizeBytes < 1 ||
          clean.sizeBytes > 20 * 1024 * 1024
        )
          throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");
        const promoted = await command(
          uploadId,
          "PROMOTE_COMPLETE",
          token,
          claim.generation,
          {
            cleanEtag: clean.etag,
            cleanObjectVersion: clean.objectVersion,
            cleanSha256: await hexDigest(clean.body),
            cleanSize: clean.sizeBytes,
            exifLocationRemoved: true,
            fileVersionId: claim.fileVersionId,
          },
        );
        commandAccepted(promoted.status, ["COMPLETED", "REPLAYED"]);
        return promoted.payload;
      }
      const source = await input.store.readQuarantinedOriginal(
        claim.quarantineObjectKey,
      );
      if (
        source.etag !== claim.sourceEtag ||
        source.objectVersion !== claim.sourceObjectVersion ||
        source.sizeBytes !== claim.sizeBytes ||
        source.mimeType !== claim.mimeType
      ) {
        const rejected = await command(
          uploadId,
          "REJECT",
          token,
          claim.generation,
          { failureCode: "SOURCE_INTEGRITY" },
        );
        commandAccepted(rejected.status, ["REJECTED"]);
        throw new FileFinalizerError("FILE_FINALIZER_REJECTED");
      }

      const scan = await scanner.scan({
        body: source.body,
        declaredMime: source.mimeType,
      });
      if (scan.verdict === "INFECTED") {
        const rejected = await command(
          uploadId,
          "REJECT",
          token,
          claim.generation,
          { failureCode: "MALWARE_DETECTED" },
        );
        commandAccepted(rejected.status, ["REJECTED"]);
        throw new FileFinalizerError("FILE_FINALIZER_REJECTED");
      }
      if (!/^[a-f0-9]{64}$/u.test(scan.scannerSha256))
        throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");

      const processed = await imageProcessor.optimizeAndStripLocation({
        body: source.body,
        detectedMime: scan.detectedMime,
        maxDimension: 2048,
      });
      if (
        processed.exifLocationRemoved !== true ||
        processed.maxDimension > 2048 ||
        processed.body.byteLength < 1 ||
        processed.body.byteLength > 20 * 1024 * 1024
      )
        throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");

      const fileVersionId = crypto.randomUUID();
      const cleanObjectKey = `clean/${fileVersionId}`;
      const cleanSha256 = await hexDigest(processed.body);
      const clean = await input.store.putCleanVersion({
        body: processed.body,
        fileVersionId,
        mimeType: processed.mimeType,
      });
      if (clean.objectKey !== cleanObjectKey)
        throw new FileFinalizerError("FILE_FINALIZER_INTEGRITY");

      const scanned = await command(
        uploadId,
        "SCAN_CLEAN",
        token,
        claim.generation,
        {
          cleanObjectKey,
          detectedMime: processed.mimeType,
          fileVersionId,
          scannerSha256: scan.scannerSha256,
        },
      );
      commandAccepted(scanned.status, ["RECORDED", "REPLAYED"]);
      const promoted = await command(
        uploadId,
        "PROMOTE_COMPLETE",
        token,
        claim.generation,
        {
          cleanEtag: clean.etag,
          cleanObjectVersion: clean.objectVersion,
          cleanSha256,
          cleanSize: clean.sizeBytes,
          exifLocationRemoved: true,
          fileVersionId,
        },
      );
      commandAccepted(promoted.status, ["COMPLETED", "REPLAYED"]);
      return promoted.payload;
    },
  };
}
