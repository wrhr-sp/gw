import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hotelFileRoutes, type AuthenticatedPrincipal, type HotelFileAccessRequest, type HotelFileUploadInitRequest, type HotelFileUploadStatus } from "@werehere/contracts";
import type { HotelFileApiRepository } from "@werehere/db";

export type HotelFileStorageEvidence = {
  etag: string;
  objectVersion: string;
  sizeBytes: number;
  mimeType: string;
};

export type HotelFileStorage = {
  putQuarantine(input: {
    objectKey: string;
    body: ReadableStream<Uint8Array>;
    sizeBytes: number;
    mimeType: string;
    reservationFingerprint: string;
  }): Promise<
    | ({ status: "CREATED" | "REPLAYED" } & HotelFileStorageEvidence)
    | { status: "CONFLICT" | "STORAGE_UNAVAILABLE" }
  >;
  headQuarantine(input: {
    objectKey: string;
    expectedEtag: string;
    expectedSizeBytes: number;
    expectedMimeType: string;
    reservationFingerprint: string;
  }): Promise<
    | ({ status: "FOUND" } & HotelFileStorageEvidence)
    | { status: "NOT_FOUND" | "EVIDENCE_MISMATCH" | "STORAGE_UNAVAILABLE" }
  >;
  getClean(input: {
    objectKey: string;
    expectedEtag: string;
    expectedObjectVersion: string;
    expectedSha256Hex: string;
    expectedSizeBytes: number;
    expectedMimeType: string;
  }): Promise<
    | { status: "AUTHORIZED"; body: ReadableStream<Uint8Array> }
    | { status: "NOT_FOUND" | "EVIDENCE_MISMATCH" | "STORAGE_UNAVAILABLE" }
  >;
};

export type HotelFileServiceResult<T> =
  | { status: "OK"; value: T }
  | {
      status:
        | "BAD_LENGTH"
        | "CONFLICT"
        | "FORBIDDEN"
        | "IDEMPOTENCY_CONFLICT"
        | "NOT_FOUND"
        | "RATE_LIMITED"
        | "STORAGE_UNAVAILABLE"
        | "VERSION_CONFLICT";
    };

export type HotelFileAccessStream = {
  body: ReadableStream<Uint8Array>;
  disposition: "INLINE" | "ATTACHMENT";
  etag: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export interface HotelFileService {
  initializeUpload(principal: AuthenticatedPrincipal, input: HotelFileUploadInitRequest, idempotencyKey: string): Promise<HotelFileServiceResult<{
    id: string;
    expiresAt: string;
    expiresInSeconds: number;
    mimeType: HotelFileUploadInitRequest["mimeType"];
    uploadUrl: string;
  }>>;
  uploadBody(principal: AuthenticatedPrincipal, input: {
    uploadId: string;
    body: ReadableStream<Uint8Array> | null;
    contentLength: string | undefined;
    contentType: string | undefined;
    ifNoneMatch: string | undefined;
  }): Promise<HotelFileServiceResult<{ id: string; etag: string }>>;
  completeUpload(principal: AuthenticatedPrincipal, uploadId: string, etag: string): Promise<HotelFileServiceResult<{ id: string; state: "QUARANTINED" }>>;
  getStatus(principal: AuthenticatedPrincipal, uploadId: string): Promise<HotelFileServiceResult<HotelFileUploadStatus>>;
  issueAccess(principal: AuthenticatedPrincipal, fileVersionId: string, input: HotelFileAccessRequest, disposition: "INLINE" | "ATTACHMENT"): Promise<HotelFileServiceResult<{
    accessUrl: string;
    cookieToken: string;
    disposition: "VIEW" | "DOWNLOAD";
    expiresAt: string;
    expiresInSeconds: number;
    grantId: string;
  }>>;
  denyAccess(principal: AuthenticatedPrincipal, grantId: string, reason: "MISSING_OR_MALFORMED_COOKIE"): Promise<void>;
  resolveAccess(principal: AuthenticatedPrincipal, grantId: string, rawToken: string): Promise<HotelFileServiceResult<HotelFileAccessStream>>;
  close?(): Promise<void>;
}

const actor = (principal: AuthenticatedPrincipal) => ({ sessionId: principal.sessionId });
const toHttpEtag = (etag: string) => (etag.startsWith('"') ? etag : `"${etag}"`);
const fromHttpEtag = (etag: string) => etag.replace(/^"|"$/gu, "");
const stableHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const tokenHash = (rawToken: string) => createHash("sha256").update(rawToken).digest();

export function createHotelFileService(dependencies: {
  now?: () => Date;
  publicAppOrigin: string;
  repository: HotelFileApiRepository;
  storage: HotelFileStorage;
}): HotelFileService {
  const origin = new URL(dependencies.publicAppOrigin).origin;
  const now = dependencies.now ?? (() => new Date());
  const remainingTtlSeconds = (expiresAt: Date) =>
    Math.min(300, Math.ceil((expiresAt.getTime() - now().getTime()) / 1000));
  const { repository, storage } = dependencies;
  return {
    async initializeUpload(principal, input, idempotencyKey) {
      const uploadId = randomUUID();
      const result = await repository.initializeUpload({
        actor: actor(principal),
        uploadId,
        branchId: input.hotelId,
        parentType: input.parentType,
        parentId: input.parentId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        quarantineObjectKey: `quarantine/${randomBytes(32).toString("hex")}`,
        ttlSeconds: 300,
        reservationFingerprint: randomBytes(32).toString("base64url"),
        idempotencyRecordId: randomUUID(),
        idempotencyKey,
        requestHash: stableHash(input),
        traceId: randomUUID(),
      });
      if (!("uploadId" in result)) return { status: result.status };
      const expiresInSeconds = remainingTtlSeconds(result.expiresAt);
      if (expiresInSeconds <= 0) return { status: "NOT_FOUND" };
      return {
        status: "OK",
        value: {
          id: result.uploadId,
          expiresAt: result.expiresAt.toISOString(),
          expiresInSeconds,
          mimeType: input.mimeType,
          uploadUrl: new URL(hotelFileRoutes.uploadBody(result.uploadId), origin).toString(),
        },
      };
    },

    async uploadBody(principal, input) {
      if (!input.body || !input.contentLength || !/^[1-9][0-9]*$/u.test(input.contentLength)) return { status: "BAD_LENGTH" };
      const authority = await repository.authorizeUploadBody({ actor: actor(principal), uploadId: input.uploadId });
      if (authority.status === "NOT_FOUND" || authority.uploadState !== "PENDING_UPLOAD") return { status: "NOT_FOUND" };
      const declaredLength = Number(input.contentLength);
      if (!Number.isSafeInteger(declaredLength) || declaredLength !== authority.reservedSizeBytes || input.contentType !== authority.declaredMimeType || input.ifNoneMatch !== "*") return { status: "BAD_LENGTH" };
      const stored = await storage.putQuarantine({
        objectKey: authority.quarantineObjectKey,
        body: input.body,
        sizeBytes: authority.reservedSizeBytes,
        mimeType: authority.declaredMimeType,
        reservationFingerprint: authority.reservationFingerprint,
      });
      if (!("etag" in stored)) return { status: stored.status };
      return { status: "OK", value: { id: authority.uploadId, etag: toHttpEtag(stored.etag) } };
    },

    async completeUpload(principal, uploadId, etag) {
      const authority = await repository.authorizeUploadBody({ actor: actor(principal), uploadId });
      if (authority.status === "NOT_FOUND") return { status: "NOT_FOUND" };
      if (authority.uploadState === "QUARANTINED") {
        if (!authority.sourceEtag || !authority.sourceObjectVersion || authority.sourceEtag !== fromHttpEtag(etag)) {
          return { status: "VERSION_CONFLICT" };
        }
        const replay = await repository.completeUpload({
          actor: actor(principal), uploadId,
          reservationFingerprint: authority.reservationFingerprint,
          sourceEtag: authority.sourceEtag,
          sourceObjectVersion: authority.sourceObjectVersion,
          sourceSizeBytes: authority.reservedSizeBytes,
          sourceMimeType: authority.declaredMimeType,
          scanJobId: randomUUID(), traceId: randomUUID(),
        });
        return "uploadId" in replay
          ? { status: "OK", value: { id: replay.uploadId, state: "QUARANTINED" } }
          : { status: replay.status };
      }
      const evidence = await storage.headQuarantine({
        objectKey: authority.quarantineObjectKey,
        expectedEtag: fromHttpEtag(etag),
        expectedSizeBytes: authority.reservedSizeBytes,
        expectedMimeType: authority.declaredMimeType,
        reservationFingerprint: authority.reservationFingerprint,
      });
      if (evidence.status === "NOT_FOUND" || evidence.status === "EVIDENCE_MISMATCH") return { status: "VERSION_CONFLICT" };
      if (!("etag" in evidence)) return { status: evidence.status };
      const result = await repository.completeUpload({
        actor: actor(principal),
        uploadId,
        reservationFingerprint: authority.reservationFingerprint,
        sourceEtag: evidence.etag,
        sourceObjectVersion: evidence.objectVersion,
        sourceSizeBytes: evidence.sizeBytes,
        sourceMimeType: authority.declaredMimeType,
        scanJobId: randomUUID(),
        traceId: randomUUID(),
      });
      if (!("uploadId" in result)) return { status: result.status };
      return { status: "OK", value: { id: result.uploadId, state: "QUARANTINED" } };
    },

    async getStatus(principal, uploadId) {
      const result = await repository.getStatus(actor(principal), uploadId);
      return result.status === "NOT_FOUND" ? { status: "NOT_FOUND" } : { status: "OK", value: result.upload };
    },

    async issueAccess(principal, fileVersionId, input, disposition) {
      const rawToken = randomBytes(32).toString("base64url");
      const grantId = randomUUID();
      const result = await repository.issueAccessGrant({
        actor: actor(principal),
        grantId,
        fileVersionId,
        parentType: input.parentType,
        parentId: input.parentId,
        disposition,
        grantTokenHash: tokenHash(rawToken),
        ttlSeconds: 300,
        traceId: randomUUID(),
      });
      if (!("grantId" in result)) return { status: result.status };
      const expiresInSeconds = remainingTtlSeconds(result.expiresAt);
      if (expiresInSeconds <= 0) return { status: "NOT_FOUND" };
      return {
        status: "OK",
        value: {
          accessUrl: new URL(hotelFileRoutes.access(result.grantId), origin).toString(),
          cookieToken: rawToken,
          disposition: disposition === "INLINE" ? "VIEW" : "DOWNLOAD",
          expiresAt: result.expiresAt.toISOString(),
          expiresInSeconds,
          grantId: result.grantId,
        },
      };
    },

    async resolveAccess(principal, grantId, rawToken) {
      const hash = tokenHash(rawToken);
      const grant = await repository.resolveAccessGrant({ actor: actor(principal), grantId, grantTokenHash: hash, traceId: randomUUID() });
      if (grant.status === "NOT_FOUND") return { status: "NOT_FOUND" };
      const started = await repository.recordAccessOutcome({ actor: actor(principal), grantTokenHash: hash, outcome: "STARTED", traceId: randomUUID() });
      if (started.status !== "RECORDED") return { status: "NOT_FOUND" };
      const recordFailure = async () => {
        const failed = await repository.recordAccessOutcome({ actor: actor(principal), grantTokenHash: hash, outcome: "FAILED", traceId: randomUUID() });
        if (failed.status !== "RECORDED") throw new Error("Hotel file access failure audit rejected");
      };
      let object;
      try {
        object = await storage.getClean({
          objectKey: grant.cleanObjectKey,
          expectedEtag: grant.destinationEtag,
          expectedObjectVersion: grant.destinationObjectVersion,
          expectedSha256Hex: grant.sha256.toString("hex"),
          expectedSizeBytes: grant.sizeBytes,
          expectedMimeType: grant.mimeType,
        });
      } catch (error) {
        await recordFailure();
        throw error;
      }
      if (object.status !== "AUTHORIZED") {
        await recordFailure();
        return { status: object.status === "STORAGE_UNAVAILABLE" ? "STORAGE_UNAVAILABLE" : "NOT_FOUND" };
      }
      const reader = object.body.getReader();
      let terminalRecorded = false;
      const recordTerminal = async (outcome: "SUCCEEDED" | "FAILED" | "ABORTED") => {
        if (terminalRecorded) return;
        terminalRecorded = true;
        try {
          const recorded = await repository.recordAccessOutcome({ actor: actor(principal), grantTokenHash: hash, outcome, traceId: randomUUID() });
          if (recorded.status !== "RECORDED") throw new Error("Hotel file access audit rejected");
        } finally {
          await repository.close();
        }
      };
      const auditedBody = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const chunk = await reader.read();
            if (chunk.done) {
              await recordTerminal("SUCCEEDED");
              controller.close();
            } else {
              controller.enqueue(chunk.value);
            }
          } catch (error) {
            await recordTerminal("FAILED").catch(() => undefined);
            controller.error(error);
          }
        },
        async cancel(reason) {
          const audit = recordTerminal("ABORTED");
          try {
            await reader.cancel(reason);
          } finally {
            await audit;
          }
        },
      });
      return {
        status: "OK",
        value: {
          body: auditedBody,
          disposition: grant.disposition,
          etag: toHttpEtag(grant.destinationEtag),
          fileName: grant.fileName,
          mimeType: grant.mimeType,
          sizeBytes: grant.sizeBytes,
        },
      };
    },

    async denyAccess(principal, grantId, reason) {
      const recorded = await repository.recordAccessDenial({
        actor: actor(principal), grantId, reason, traceId: randomUUID(),
      });
      if (recorded.status !== "RECORDED") throw new Error("Hotel file access denial audit rejected");
    },

    close: () => repository.close(),
  };
}
