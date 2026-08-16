import type { FileFinalizerRepository } from "@werehere/db";
import type { PrivateR2EvidenceStore } from "./r2";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const QUARANTINE_KEY =
  /^quarantine\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[A-Za-z0-9_-]{43}$/u;
const CLAIM_TOKEN = /^[A-Za-z0-9_-]{43}$/u;
const CLEAN_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

type ScanningClaim = {
  generation: number;
  mimeType: string;
  phase: "SCANNING";
  quarantineObjectKey: string;
  sizeBytes: number;
  sourceEtag: string;
  sourceObjectVersion: string;
};

type PromotionClaim = {
  cleanObjectKey: string;
  detectedMime: string;
  fileVersionId: string;
  generation: number;
  phase: "CLEAN_PENDING_PROMOTION";
};

type TerminalClaim = {
  cleanSha256: string | null;
  completionVerdict: "CLEAN" | "FAILED" | "INFECTED" | "SOURCE_INTEGRITY";
  detectedMime: string | null;
  generation: number;
  phase: "TERMINAL";
  quarantineObjectKey: string;
  snapshot: unknown;
  sourceSha256: string;
};

type RetryScheduledClaim = {
  completionVerdict: "FAILED";
  generation: number;
  phase: "RETRY_SCHEDULED";
  sourceSha256: string;
};

type Claim = ScanningClaim | PromotionClaim | RetryScheduledClaim | TerminalClaim;

export type FileScannerAgentClaim = {
  body: Uint8Array;
  claimToken: string;
  declaredMime: string;
  generation: number;
  sourceSha256: string;
  uploadId: string;
};

export type FileScannerAgentCompletion =
  | {
      body: Uint8Array;
      claimToken: string;
      exifLocationRemoved: true;
      generation: number;
      maxDimension: number;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
      sourceSha256: string;
      uploadId: string;
      verdict: "CLEAN";
    }
  | {
      claimToken: string;
      generation: number;
      sourceSha256: string;
      uploadId: string;
      verdict: "FAILED";
    }
  | {
      claimToken: string;
      generation: number;
      sourceSha256: string;
      uploadId: string;
      verdict: "INFECTED";
    };

export class FileScannerAgentError extends Error {
  constructor(
    public readonly code:
      | "SCANNER_AGENT_INTEGRITY"
      | "SCANNER_AGENT_NOT_CONFIGURED"
      | "SCANNER_AGENT_SOURCE_INTEGRITY"
      | "SCANNER_AGENT_STALE_CLAIM",
  ) {
    super(code);
  }
}

export interface FileScannerAgentService {
  claim(): Promise<FileScannerAgentClaim | null>;
  close?(): Promise<void>;
  complete(input: FileScannerAgentCompletion): Promise<unknown>;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
  }
  return value as Record<string, unknown>;
}

function parseClaim(value: unknown): Claim {
  const claim = record(value);
  if (
    typeof claim.generation !== "number" ||
    !Number.isSafeInteger(claim.generation) ||
    claim.generation < 1
  ) {
    throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
  }
  if (claim.phase === "RETRY_SCHEDULED") {
    if (
      claim.completionVerdict !== "FAILED" ||
      typeof claim.sourceSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(claim.sourceSha256)
    ) {
      throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
    }
    return claim as RetryScheduledClaim;
  }
  if (claim.phase === "TERMINAL") {
    if (
      !["CLEAN", "FAILED", "INFECTED", "SOURCE_INTEGRITY"].includes(
        String(claim.completionVerdict),
      ) ||
      typeof claim.sourceSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(claim.sourceSha256) ||
      typeof claim.quarantineObjectKey !== "string" ||
      !QUARANTINE_KEY.test(claim.quarantineObjectKey) ||
      (claim.cleanSha256 !== null &&
        (typeof claim.cleanSha256 !== "string" ||
          !/^[a-f0-9]{64}$/u.test(claim.cleanSha256))) ||
      (claim.detectedMime !== null && typeof claim.detectedMime !== "string") ||
      !claim.snapshot ||
      typeof claim.snapshot !== "object" ||
      Array.isArray(claim.snapshot)
    ) {
      throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
    }
    return claim as TerminalClaim;
  }
  if (claim.phase === "CLEAN_PENDING_PROMOTION") {
    if (
      typeof claim.cleanObjectKey !== "string" ||
      typeof claim.detectedMime !== "string" ||
      typeof claim.fileVersionId !== "string" ||
      !UUID.test(claim.fileVersionId) ||
      claim.cleanObjectKey !== `clean/${claim.fileVersionId}`
    ) {
      throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
    }
    return claim as PromotionClaim;
  }
  if (
    claim.phase !== "SCANNING" ||
    typeof claim.mimeType !== "string" ||
    typeof claim.quarantineObjectKey !== "string" ||
    typeof claim.sizeBytes !== "number" ||
    !Number.isSafeInteger(claim.sizeBytes) ||
    claim.sizeBytes < 1 ||
    claim.sizeBytes > MAX_FILE_SIZE ||
    typeof claim.sourceEtag !== "string" ||
    typeof claim.sourceObjectVersion !== "string"
  ) {
    throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
  }
  return claim as ScanningClaim;
}

function randomClaimToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function sha256(body: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(body));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function deterministicCleanVersionId(
  uploadId: string,
  generation: number,
): Promise<string> {
  const material = new TextEncoder().encode(`${uploadId}\u0000${generation}`);
  const digest = await crypto.subtle.digest("SHA-256", material);
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function accepted(status: string, expected: readonly string[]) {
  if (!expected.includes(status)) {
    throw new FileScannerAgentError(
      status === "STALE_CLAIM" || status === "BUSY"
        ? "SCANNER_AGENT_STALE_CLAIM"
        : "SCANNER_AGENT_INTEGRITY",
    );
  }
}

function verifySource(
  claim: ScanningClaim,
  source: Awaited<
    ReturnType<PrivateR2EvidenceStore["readQuarantinedOriginal"]>
  >,
) {
  return (
    source.etag === claim.sourceEtag &&
    source.objectVersion === claim.sourceObjectVersion &&
    source.sizeBytes === claim.sizeBytes &&
    source.mimeType === claim.mimeType &&
    source.body.byteLength === claim.sizeBytes
  );
}

export function createFileScannerAgentService(input: {
  repository: FileFinalizerRepository;
  store: PrivateR2EvidenceStore;
}): FileScannerAgentService {
  if (!input.repository.listCandidates) {
    throw new FileScannerAgentError("SCANNER_AGENT_NOT_CONFIGURED");
  }

  async function deleteQuarantinedOriginal(objectKey: string) {
    if (!input.store.deleteQuarantinedOriginal)
      throw new FileScannerAgentError("SCANNER_AGENT_NOT_CONFIGURED");
    await input.store.deleteQuarantinedOriginal(objectKey);
  }

  async function command(
    uploadId: string,
    action: "CLAIM" | "FAIL" | "PROMOTE_COMPLETE" | "REJECT" | "SCAN_CLEAN",
    claimToken: string,
    generation: number,
    value: unknown,
  ) {
    return input.repository.command({
      action,
      claimToken,
      generation,
      traceId: crypto.randomUUID(),
      uploadId,
      value,
    });
  }

  async function promote(
    uploadId: string,
    claimToken: string,
    claim: PromotionClaim,
  ) {
    const clean = await input.store.readCleanVersion(claim.cleanObjectKey);
    if (
      clean.mimeType !== claim.detectedMime ||
      clean.sizeBytes < 1 ||
      clean.sizeBytes > MAX_FILE_SIZE ||
      clean.body.byteLength !== clean.sizeBytes
    ) {
      throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
    }
    const result = await command(
      uploadId,
      "PROMOTE_COMPLETE",
      claimToken,
      claim.generation,
      {
        cleanEtag: clean.etag,
        cleanObjectVersion: clean.objectVersion,
        cleanSha256: await sha256(clean.body),
        cleanSize: clean.sizeBytes,
        exifLocationRemoved: true,
        fileVersionId: claim.fileVersionId,
      },
    );
    accepted(result.status, ["COMPLETED", "REPLAYED"]);
    return result.payload;
  }

  async function rejectSource(
    uploadId: string,
    claimToken: string,
    generation: number,
    sourceSha256: string,
    quarantineObjectKey: string,
  ): Promise<never> {
    const rejected = await command(uploadId, "REJECT", claimToken, generation, {
      failureCode: "SOURCE_INTEGRITY",
      sourceSha256,
    });
    accepted(rejected.status, ["REJECTED"]);
    await deleteQuarantinedOriginal(quarantineObjectKey);
    throw new FileScannerAgentError("SCANNER_AGENT_SOURCE_INTEGRITY");
  }

  async function replayTerminal(
    completion: FileScannerAgentCompletion,
    claim: TerminalClaim,
  ) {
    if (
      claim.sourceSha256 !== completion.sourceSha256 ||
      !claim.quarantineObjectKey.startsWith(`quarantine/${completion.uploadId}/`)
    ) {
      throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
    }
    if (claim.completionVerdict === "SOURCE_INTEGRITY") {
      await deleteQuarantinedOriginal(claim.quarantineObjectKey);
      throw new FileScannerAgentError("SCANNER_AGENT_SOURCE_INTEGRITY");
    }
    if (claim.completionVerdict !== completion.verdict) {
      throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
    }
    if (completion.verdict === "CLEAN") {
      if (
        claim.cleanSha256 !== (await sha256(completion.body)) ||
        claim.detectedMime !== completion.mimeType
      ) {
        throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
      }
    } else if (claim.cleanSha256 !== null || claim.detectedMime !== null) {
      throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
    }
    await deleteQuarantinedOriginal(claim.quarantineObjectKey);
    return claim.snapshot;
  }

  return {
    close: () => input.repository.close(),
    async claim() {
      const candidates = await input.repository.listCandidates!(25);
      for (const uploadId of candidates) {
        if (!UUID.test(uploadId)) {
          throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
        }
        const claimToken = randomClaimToken();
        const result = await command(uploadId, "CLAIM", claimToken, 0, {});
        if (result.status === "BUSY") continue;
        accepted(result.status, ["CLAIMED", "REPLAYED"]);
        const claim = parseClaim(result.payload);
        if (claim.phase === "CLEAN_PENDING_PROMOTION") {
          await promote(uploadId, claimToken, claim);
          continue;
        }
        if (claim.phase !== "SCANNING") {
          throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
        }
        let source: Awaited<
          ReturnType<PrivateR2EvidenceStore["readQuarantinedOriginal"]>
        >;
        try {
          source = await input.store.readQuarantinedOriginal(
            claim.quarantineObjectKey,
          );
        } catch (error) {
          await command(
            uploadId,
            "FAIL",
            claimToken,
            claim.generation,
            {
              failureCode: "SCAN_ENGINE",
              sourceSha256: "0".repeat(64),
            },
          ).catch(() => undefined);
          throw error;
        }
        if (!verifySource(claim, source)) {
          return rejectSource(
            uploadId,
            claimToken,
            claim.generation,
            await sha256(source.body),
            claim.quarantineObjectKey,
          );
        }
        return {
          body: source.body,
          claimToken,
          declaredMime: source.mimeType,
          generation: claim.generation,
          sourceSha256: await sha256(source.body),
          uploadId,
        };
      }
      return null;
    },
    async complete(completion) {
      if (
        !UUID.test(completion.uploadId) ||
        !CLAIM_TOKEN.test(completion.claimToken) ||
        !Number.isSafeInteger(completion.generation) ||
        completion.generation < 1 ||
        !/^[a-f0-9]{64}$/u.test(completion.sourceSha256)
      ) {
        throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
      }
      const replay = await command(
        completion.uploadId,
        "CLAIM",
        completion.claimToken,
        completion.generation,
        completion.verdict === "FAILED"
          ? {
              completionVerdict: "FAILED",
              sourceSha256: completion.sourceSha256,
            }
          : {},
      );
      accepted(replay.status, ["CLAIMED", "REPLAYED"]);
      const claim = parseClaim(replay.payload);
      if (claim.generation !== completion.generation) {
        throw new FileScannerAgentError("SCANNER_AGENT_STALE_CLAIM");
      }
      if (claim.phase === "RETRY_SCHEDULED") {
        if (
          completion.verdict !== "FAILED" ||
          claim.sourceSha256 !== completion.sourceSha256
        ) {
          throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
        }
        return null;
      }
      if (claim.phase === "CLEAN_PENDING_PROMOTION") {
        return promote(completion.uploadId, completion.claimToken, claim);
      }
      if (claim.phase === "TERMINAL") {
        return replayTerminal(completion, claim);
      }
      if (claim.phase !== "SCANNING") {
        throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
      }
      const source = await input.store.readQuarantinedOriginal(
        claim.quarantineObjectKey,
      );
      if (
        !verifySource(claim, source) ||
        (await sha256(source.body)) !== completion.sourceSha256
      ) {
        return rejectSource(
          completion.uploadId,
          completion.claimToken,
          completion.generation,
          completion.sourceSha256,
          claim.quarantineObjectKey,
        );
      }
      if (completion.verdict === "FAILED") {
        const failed = await command(
          completion.uploadId,
          "FAIL",
          completion.claimToken,
          completion.generation,
          {
            failureCode: "SCAN_ENGINE",
            sourceSha256: completion.sourceSha256,
          },
        );
        accepted(failed.status, ["RETRY_SCHEDULED", "SCAN_FAILED"]);
        if (failed.status === "SCAN_FAILED")
          await deleteQuarantinedOriginal(claim.quarantineObjectKey);
        return failed.payload;
      }
      if (completion.verdict === "INFECTED") {
        const rejected = await command(
          completion.uploadId,
          "REJECT",
          completion.claimToken,
          completion.generation,
          {
            failureCode: "MALWARE_DETECTED",
            sourceSha256: completion.sourceSha256,
          },
        );
        accepted(rejected.status, ["REJECTED"]);
        await deleteQuarantinedOriginal(claim.quarantineObjectKey);
        return rejected.payload;
      }
      if (
        completion.exifLocationRemoved !== true ||
        !CLEAN_MIME.has(completion.mimeType) ||
        !Number.isSafeInteger(completion.maxDimension) ||
        completion.maxDimension < 1 ||
        completion.maxDimension > 2048 ||
        completion.body.byteLength < 1 ||
        completion.body.byteLength > MAX_FILE_SIZE
      ) {
        throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
      }
      const cleanSha256 = await sha256(completion.body);
      const fileVersionId = await deterministicCleanVersionId(
        completion.uploadId,
        completion.generation,
      );
      let clean: Awaited<ReturnType<PrivateR2EvidenceStore["putCleanVersion"]>>;
      try {
        clean = await input.store.putCleanVersion({
          body: completion.body,
          fileVersionId,
          mimeType: completion.mimeType,
        });
      } catch (error) {
        await command(
          completion.uploadId,
          "FAIL",
          completion.claimToken,
          completion.generation,
          {
            failureCode: "SCAN_ENGINE",
            sourceSha256: completion.sourceSha256,
          },
        ).catch(() => undefined);
        throw error;
      }
      if (
        clean.objectKey !== `clean/${fileVersionId}` ||
        clean.sizeBytes !== completion.body.byteLength
      ) {
        throw new FileScannerAgentError("SCANNER_AGENT_INTEGRITY");
      }
      const scanned = await command(
        completion.uploadId,
        "SCAN_CLEAN",
        completion.claimToken,
        completion.generation,
        {
          cleanObjectKey: clean.objectKey,
          detectedMime: completion.mimeType,
          fileVersionId,
          scannerSha256: completion.sourceSha256,
        },
      );
      accepted(scanned.status, ["RECORDED", "REPLAYED"]);
      const promoted = await command(
        completion.uploadId,
        "PROMOTE_COMPLETE",
        completion.claimToken,
        completion.generation,
        {
          cleanEtag: clean.etag,
          cleanObjectVersion: clean.objectVersion,
          cleanSha256,
          cleanSize: clean.sizeBytes,
          exifLocationRemoved: true,
          fileVersionId,
        },
      );
      accepted(promoted.status, ["COMPLETED", "REPLAYED"]);
      await deleteQuarantinedOriginal(claim.quarantineObjectKey);
      return promoted.payload;
    },
  };
}
