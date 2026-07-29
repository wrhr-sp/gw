import { randomBytes, randomUUID } from "node:crypto";
import {
  hotelFileUploadStatusSchema,
  type HotelFileFailureCode,
  type HotelFileMimeType,
  type HotelFileParentType,
  type HotelFileUploadState,
  type HotelFileUploadStatus,
} from "@werehere/contracts";
import postgres from "postgres";

export type HotelFileApiActor = {
  sessionId: string;
};

export type InitializeHotelFileUploadInput = {
  actor: HotelFileApiActor;
  uploadId?: string;
  branchId: string;
  parentType: HotelFileParentType;
  parentId: string;
  fileName: string;
  mimeType: HotelFileMimeType;
  sizeBytes: number;
  quarantineObjectKey: string;
  expiresAt: Date;
  idempotencyRecordId?: string;
  idempotencyKey: string;
  requestHash: string;
  traceId?: string;
};

export type CompleteHotelFileUploadInput = {
  actor: HotelFileApiActor;
  uploadId: string;
  sourceEtag: string;
  sourceObjectVersion: string;
  sourceSizeBytes: number;
  sourceMimeType: HotelFileMimeType;
  scanJobId?: string;
  traceId?: string;
};

export type LinkHotelFileInput = {
  actor: HotelFileApiActor;
  fileVersionId: string;
  linkId?: string;
  idempotencyRecordId?: string;
  idempotencyKey: string;
  requestHash: string;
  traceId?: string;
};

export type InitHotelFileUploadResult =
  | {
      status: "CREATED" | "REPLAYED";
      uploadId: string;
      state: "PENDING_UPLOAD";
    }
  | { status: "FORBIDDEN" | "NOT_FOUND" | "IDEMPOTENCY_CONFLICT" };

export type CompleteHotelFileUploadResult =
  | {
      status: "CREATED" | "REPLAYED";
      uploadId: string;
      scanJobId: string;
      state: "QUARANTINED";
    }
  | { status: "FORBIDDEN" | "NOT_FOUND" | "VERSION_CONFLICT" };

export type LinkHotelFileResult =
  | {
      status: "LINKED" | "REPLAYED";
      uploadId: string;
      fileVersionId: string;
      state: HotelFileUploadState;
    }
  | {
      status:
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "IDEMPOTENCY_CONFLICT"
        | "VERSION_CONFLICT";
    };

export type SafeHotelFileStatus = Omit<HotelFileUploadStatus, "updatedAt">;

export type HotelFileStatusResult =
  | { status: "CREATED"; upload: SafeHotelFileStatus }
  | { status: "NOT_FOUND" };

export type ClaimHotelFileScanInput = {
  companyId: string;
  scanJobId: string;
  attemptId?: string;
  leaseSeconds: number;
};

export type ClaimHotelFileScanResult =
  | {
      status: "CLAIMED";
      attemptId: string;
      claimGeneration: number;
      claimToken: string;
      leaseExpiresAt: Date;
      uploadId: string;
      quarantineObjectKey: string;
      sourceEtag: string;
      sourceObjectVersion: string;
      sourceSizeBytes: number;
    }
  | { status: "BUSY" }
  | { status: "FORBIDDEN" | "NOT_FOUND" };

export type CompleteHotelFileScanInput = {
  companyId: string;
  attemptId: string;
  claimGeneration: number;
  claimToken: string;
  callbackBodyHash: Buffer;
  verdict: "CLEAN" | "MALWARE" | "ERROR";
  actualSizeBytes: number;
  sha256: Buffer | null;
  detectedMimeType: string | null;
  engineName: string | null;
  engineVersion: string | null;
  signatureDatabaseVersion: string | null;
  failureCode: HotelFileFailureCode | null;
  retryDelaySeconds: number;
};

export type CompleteHotelFileScanResult =
  | {
      status: "CREATED" | "REPLAYED" | "RETRY_SCHEDULED" | "DEAD_LETTERED";
      uploadId: string;
      uploadState: HotelFileUploadState;
    }
  | {
      status:
        | "FORBIDDEN"
        | "STALE_FENCE"
        | "LEASE_EXPIRED"
        | "COMPLETION_CONFLICT";
    };

export type ReserveHotelFileCleanPromotionInput = {
  companyId: string;
  uploadId: string;
  reservationId?: string;
  fileVersionId?: string;
  cleanObjectKey: string;
  leaseSeconds: number;
};

export type ReserveHotelFileCleanPromotionResult =
  | {
      status: "CREATED" | "REPLAYED";
      reservationId: string;
      fileVersionId: string;
      sourceEtag: string;
      sourceObjectVersion: string;
      sourceSha256: Buffer;
      sourceSizeBytes: number;
      detectedMimeType: string;
      cleanObjectKey: string;
      promotionGeneration: number;
      promotionToken: string;
      leaseExpiresAt: Date;
    }
  | { status: "BUSY" | "FORBIDDEN" | "NOT_FOUND" | "VERSION_CONFLICT" };

export type CompleteHotelFileCleanPromotionInput = {
  companyId: string;
  reservationId: string;
  promotionGeneration: number;
  promotionToken: string;
  fileVersionId: string;
  destinationEtag: string;
  destinationObjectVersion: string;
  destinationSha256: Buffer;
  destinationSizeBytes: number;
  destinationMimeType: string;
};

export type CompleteHotelFileCleanPromotionResult =
  | {
      status: "READY_UNLINKED";
      uploadId: string;
      fileVersionId: string;
      state: "READY_UNLINKED";
    }
  | {
      status: "REPLAYED";
      uploadId: string;
      fileVersionId: string;
      state: "READY_UNLINKED" | "LINKED";
    }
  | { status: "FORBIDDEN" | "NOT_FOUND" | "VERSION_CONFLICT" };

export interface HotelFileApiRepository {
  initializeUpload(
    input: InitializeHotelFileUploadInput,
  ): Promise<InitHotelFileUploadResult>;
  completeUpload(
    input: CompleteHotelFileUploadInput,
  ): Promise<CompleteHotelFileUploadResult>;
  linkCleanVersion(input: LinkHotelFileInput): Promise<LinkHotelFileResult>;
  getStatus(
    actor: HotelFileApiActor,
    uploadId: string,
  ): Promise<HotelFileStatusResult>;
  close(): Promise<void>;
}

export interface HotelFileScannerRepository {
  claimScan(input: ClaimHotelFileScanInput): Promise<ClaimHotelFileScanResult>;
  completeScan(
    input: CompleteHotelFileScanInput,
  ): Promise<CompleteHotelFileScanResult>;
  close(): Promise<void>;
}

export interface HotelFileFinalizerRepository {
  reserveCleanPromotion(
    input: ReserveHotelFileCleanPromotionInput,
  ): Promise<ReserveHotelFileCleanPromotionResult>;
  completeCleanPromotion(
    input: CompleteHotelFileCleanPromotionInput,
  ): Promise<CompleteHotelFileCleanPromotionResult>;
  close(): Promise<void>;
}

type InitUploadRow = {
  result_status: string;
  upload_id: string | null;
  state: string | null;
};

type CompleteUploadRow = InitUploadRow & { scan_job_id: string | null };

type LinkRow = {
  result_status: string;
  upload_id: string | null;
  file_version_id: string | null;
  state: string | null;
};

type StatusRow = LinkRow & { failure_code: HotelFileFailureCode | null };

type ClaimRow = {
  result_status: string;
  attempt_id: string | null;
  claim_generation: number | string | null;
  lease_expires_at: Date | null;
  upload_id: string | null;
  quarantine_key: string | null;
  source_etag: string | null;
  source_object_version: string | null;
  source_size_bytes: number | string | null;
};

type CompleteScanRow = {
  result_status: string;
  upload_id: string | null;
  upload_state: string | null;
};

type ReservePromotionRow = {
  result_status: string;
  reservation_id: string | null;
  source_etag: string | null;
  source_object_version: string | null;
  scanner_sha256: Buffer | null;
  actual_size_bytes: number | string | null;
  detected_mime_type: string | null;
  clean_object_key: string | null;
  promotion_generation: number | string | null;
  lease_expires_at: Date | null;
};

type CompletePromotionRow = LinkRow;

function oneRow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row || rows.length !== 1)
    throw new Error("Unexpected hotel file command result");
  return row;
}

function required<T>(value: T | null): T {
  if (value === null) throw new Error("Incomplete hotel file command result");
  return value;
}

function integer(value: number | string | null): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (parsed === null || !Number.isSafeInteger(parsed)) {
    throw new Error("Invalid hotel file command integer");
  }
  return parsed;
}

function unexpectedStatus(): never {
  throw new Error("Unexpected hotel file command status");
}

function parseUploadState(value: string | null): HotelFileUploadState {
  switch (value) {
    case "PENDING_UPLOAD":
    case "QUARANTINED":
    case "SCANNING":
    case "CLEAN_PENDING_PROMOTION":
    case "READY_UNLINKED":
    case "LINKED":
    case "REJECTED":
    case "SCAN_FAILED":
    case "EXPIRED":
      return value;
    default:
      throw new Error("Unexpected hotel file upload state");
  }
}

function promotionLeaseSeconds(value: number): number {
  if (!Number.isInteger(value) || value < 30 || value > 900) {
    throw new Error("Invalid clean promotion lease seconds");
  }
  return value;
}

function rawTokenBytes(claimToken: string): Buffer {
  const bytes = Buffer.from(claimToken, "base64url");
  if (bytes.length !== 32) throw new Error("Invalid scan claim credential");
  return bytes;
}

const hotelFileStatusSchema = {
  parse(value: SafeHotelFileStatus): SafeHotelFileStatus {
    const parsed = hotelFileUploadStatusSchema.parse({
      ...value,
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
    const { updatedAt: _updatedAt, ...safeStatus } = parsed;
    return safeStatus;
  },
};

export function createPostgresHotelFileApiRepository(
  databaseUrl: string,
): HotelFileApiRepository {
  const sql = postgres(databaseUrl, { max: 5, connect_timeout: 5 });

  return {
    async initializeUpload(input) {
      const rows = await sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
        return transaction<InitUploadRow[]>`
          select * from public.hotel_file_init_upload(
            ${input.uploadId ?? randomUUID()}::uuid,
            ${input.branchId}::uuid,
            ${input.parentType}::text,
            ${input.parentId}::uuid,
            ${input.fileName}::text,
            ${input.mimeType}::text,
            ${input.sizeBytes}::bigint,
            ${input.quarantineObjectKey}::text,
            ${input.expiresAt}::timestamptz,
            ${input.idempotencyRecordId ?? randomUUID()}::uuid,
            ${input.idempotencyKey}::text,
            ${input.requestHash}::text,
            ${input.traceId ?? randomUUID()}::uuid
          )
        `;
      });
      const row = oneRow(rows);
      switch (row.result_status) {
        case "CREATED":
        case "REPLAYED": {
          const state = parseUploadState(row.state);
          if (state !== "PENDING_UPLOAD") return unexpectedStatus();
          return {
            status: row.result_status,
            uploadId: required(row.upload_id),
            state,
          };
        }
        case "FORBIDDEN":
        case "NOT_FOUND":
        case "IDEMPOTENCY_CONFLICT":
          return { status: row.result_status };
        default:
          return unexpectedStatus();
      }
    },

    async completeUpload(input) {
      const rows = await sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
        return transaction<CompleteUploadRow[]>`
          select * from public.hotel_file_complete_upload(
            ${input.uploadId}::uuid,
            ${input.sourceEtag}::text,
            ${input.sourceObjectVersion}::text,
            ${input.sourceSizeBytes}::bigint,
            ${input.sourceMimeType}::text,
            ${input.scanJobId ?? randomUUID()}::uuid,
            ${input.traceId ?? randomUUID()}::uuid
          )
        `;
      });
      const row = oneRow(rows);
      switch (row.result_status) {
        case "CREATED":
        case "REPLAYED": {
          const state = parseUploadState(row.state);
          if (state !== "QUARANTINED") return unexpectedStatus();
          return {
            status: row.result_status,
            uploadId: required(row.upload_id),
            scanJobId: required(row.scan_job_id),
            state,
          };
        }
        case "FORBIDDEN":
        case "NOT_FOUND":
        case "VERSION_CONFLICT":
          return { status: row.result_status };
        default:
          return unexpectedStatus();
      }
    },

    async linkCleanVersion(input) {
      const rows = await sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${input.actor.sessionId}, true)`;
        return transaction<LinkRow[]>`
          select * from public.hotel_file_link_clean_version(
            ${input.fileVersionId}::uuid,
            ${input.linkId ?? randomUUID()}::uuid,
            ${input.idempotencyRecordId ?? randomUUID()}::uuid,
            ${input.idempotencyKey}::text,
            ${input.requestHash}::text,
            ${input.traceId ?? randomUUID()}::uuid
          )
        `;
      });
      const row = oneRow(rows);
      switch (row.result_status) {
        case "LINKED":
        case "REPLAYED":
          return {
            status: row.result_status,
            uploadId: required(row.upload_id),
            fileVersionId: required(row.file_version_id),
            state: parseUploadState(row.state),
          };
        case "FORBIDDEN":
        case "NOT_FOUND":
        case "IDEMPOTENCY_CONFLICT":
        case "VERSION_CONFLICT":
          return { status: row.result_status };
        default:
          return unexpectedStatus();
      }
    },

    async getStatus(actor, uploadId) {
      const rows = await sql.begin(async (transaction) => {
        await transaction`select set_config('app.session_id', ${actor.sessionId}, true)`;
        return transaction<StatusRow[]>`
          select * from public.hotel_file_read_status(${uploadId}::uuid)
        `;
      });
      const row = oneRow(rows);
      if (row.result_status === "NOT_FOUND") return { status: "NOT_FOUND" };
      if (row.result_status !== "CREATED") return unexpectedStatus();
      return {
        status: "CREATED",
        upload: hotelFileStatusSchema.parse({
          id: required(row.upload_id),
          state: parseUploadState(row.state),
          fileVersionId: row.file_version_id,
          failureCode: row.failure_code,
        }),
      };
    },

    async close() {
      await sql.end();
    },
  };
}

export function createPostgresHotelFileScannerRepository(
  databaseUrl: string,
): HotelFileScannerRepository {
  const sql = postgres(databaseUrl, { max: 5, connect_timeout: 5 });

  return {
    async claimScan(input) {
      const claimToken = randomBytes(32).toString("base64url");
      const tokenBytes = rawTokenBytes(claimToken);
      const rows = await sql.begin(async (transaction) => {
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        return transaction<ClaimRow[]>`
          select * from public.hotel_file_claim_scan_attempt(
            ${input.scanJobId}::uuid,
            ${input.attemptId ?? randomUUID()}::uuid,
            pg_catalog.encode(${tokenBytes}::bytea, 'base64')::text,
            ${input.leaseSeconds}::integer
          )
        `;
      });
      const row = oneRow(rows);
      switch (row.result_status) {
        case "CLAIMED":
          return {
            status: "CLAIMED",
            attemptId: required(row.attempt_id),
            claimGeneration: integer(row.claim_generation),
            claimToken,
            leaseExpiresAt: required(row.lease_expires_at),
            uploadId: required(row.upload_id),
            quarantineObjectKey: required(row.quarantine_key),
            sourceEtag: required(row.source_etag),
            sourceObjectVersion: required(row.source_object_version),
            sourceSizeBytes: integer(row.source_size_bytes),
          };
        case "BUSY":
          return { status: "BUSY" };
        case "FORBIDDEN":
        case "NOT_FOUND":
          return { status: row.result_status };
        default:
          return unexpectedStatus();
      }
    },

    async completeScan(input) {
      const claimToken = rawTokenBytes(input.claimToken);
      const rows = await sql.begin(async (transaction) => {
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        return transaction<CompleteScanRow[]>`
          select * from public.hotel_file_complete_scan_attempt(
            ${input.attemptId}::uuid,
            ${input.claimGeneration}::bigint,
            pg_catalog.encode(${claimToken}::bytea, 'base64')::text,
            ${input.callbackBodyHash}::bytea,
            ${input.verdict}::text,
            ${input.actualSizeBytes}::bigint,
            ${input.sha256}::bytea,
            ${input.detectedMimeType}::text,
            ${input.engineName}::text,
            ${input.engineVersion}::text,
            ${input.signatureDatabaseVersion}::text,
            ${input.failureCode}::text,
            ${input.retryDelaySeconds}::integer
          )
        `;
      });
      const row = oneRow(rows);
      switch (row.result_status) {
        case "CREATED":
        case "REPLAYED":
        case "RETRY_SCHEDULED":
        case "DEAD_LETTERED":
          return {
            status: row.result_status,
            uploadId: required(row.upload_id),
            uploadState: parseUploadState(row.upload_state),
          };
        case "FORBIDDEN":
        case "STALE_FENCE":
        case "LEASE_EXPIRED":
        case "COMPLETION_CONFLICT":
          return { status: row.result_status };
        default:
          return unexpectedStatus();
      }
    },

    async close() {
      await sql.end();
    },
  };
}

export function createPostgresHotelFileFinalizerRepository(
  databaseUrl: string,
): HotelFileFinalizerRepository {
  const sql = postgres(databaseUrl, { max: 5, connect_timeout: 5 });

  return {
    async reserveCleanPromotion(input) {
      const reservationId = input.reservationId ?? randomUUID();
      const fileVersionId = input.fileVersionId ?? randomUUID();
      const promotionToken = randomBytes(32).toString("base64url");
      const leaseSeconds = promotionLeaseSeconds(input.leaseSeconds);
      const rows = await sql.begin(async (transaction) => {
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        return transaction<ReservePromotionRow[]>`
          select * from public.hotel_file_reserve_clean_promotion(
            ${input.uploadId}::uuid,
            ${reservationId}::uuid,
            ${fileVersionId}::uuid,
            ${input.cleanObjectKey}::text,
            ${promotionToken}::text,
            ${leaseSeconds}::integer
          )
        `;
      });
      const row = oneRow(rows);
      switch (row.result_status) {
        case "CREATED":
        case "REPLAYED":
          return {
            status: row.result_status,
            reservationId: required(row.reservation_id),
            fileVersionId,
            sourceEtag: required(row.source_etag),
            sourceObjectVersion: required(row.source_object_version),
            sourceSha256: required(row.scanner_sha256),
            sourceSizeBytes: integer(row.actual_size_bytes),
            detectedMimeType: required(row.detected_mime_type),
            cleanObjectKey: required(row.clean_object_key),
            promotionGeneration: integer(row.promotion_generation),
            promotionToken,
            leaseExpiresAt: required(row.lease_expires_at),
          };
        case "BUSY":
        case "FORBIDDEN":
        case "NOT_FOUND":
        case "VERSION_CONFLICT":
          return { status: row.result_status };
        default:
          return unexpectedStatus();
      }
    },

    async completeCleanPromotion(input) {
      const rows = await sql.begin(async (transaction) => {
        await transaction`select set_config('app.reconciler_company_id', ${input.companyId}, true)`;
        return transaction<CompletePromotionRow[]>`
          select * from public.hotel_file_complete_clean_promotion(
            ${input.reservationId}::uuid,
            ${input.promotionGeneration}::bigint,
            ${input.promotionToken}::text,
            ${input.fileVersionId}::uuid,
            ${input.destinationEtag}::text,
            ${input.destinationObjectVersion}::text,
            ${input.destinationSha256}::bytea,
            ${input.destinationSizeBytes}::bigint,
            ${input.destinationMimeType}::text
          )
        `;
      });
      const row = oneRow(rows);
      switch (row.result_status) {
        case "READY_UNLINKED": {
          const state = parseUploadState(row.state);
          if (state !== "READY_UNLINKED") return unexpectedStatus();
          return {
            status: "READY_UNLINKED",
            uploadId: required(row.upload_id),
            fileVersionId: required(row.file_version_id),
            state,
          };
        }
        case "REPLAYED": {
          const state = parseUploadState(row.state);
          if (state !== "READY_UNLINKED" && state !== "LINKED") {
            return unexpectedStatus();
          }
          return {
            status: "REPLAYED",
            uploadId: required(row.upload_id),
            fileVersionId: required(row.file_version_id),
            state,
          };
        }
        case "FORBIDDEN":
        case "NOT_FOUND":
        case "VERSION_CONFLICT":
          return { status: row.result_status };
        default:
          return unexpectedStatus();
      }
    },

    async close() {
      await sql.end();
    },
  };
}
