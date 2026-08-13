import {
  hotelFileRoutes,
  type AuthenticatedPrincipal,
  type HotelFileUploadCompleteRequest,
  type HotelFileUploadInitRequest,
} from "@werehere/contracts";
import type { InspectionRepository } from "@werehere/db";
import { sha256 } from "../auth/crypto";

export interface PrivateR2Binding {
  get?(key: string): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    body?: ReadableStream<Uint8Array>;
    etag?: string;
    httpMetadata?: { contentType?: string };
    size?: number;
    version?: string;
  } | null>;
  put(
    key: string,
    value: Uint8Array | ArrayBuffer | ReadableStream,
    options: {
      httpMetadata: { contentType: string };
      onlyIf: { etagDoesNotMatch: "*" };
    },
  ): Promise<{ etag?: string; version?: string } | null>;
  head?(key: string): Promise<{
    etag?: string;
    httpMetadata?: { contentType?: string };
    size?: number;
    version?: string;
  } | null>;
}

export class FileStorageError extends Error {
  constructor(
    public readonly code:
      | "FILE_INTEGRITY_MISMATCH"
      | "FILE_NOT_READY"
      | "FILE_RATE_LIMITED"
      | "FILE_STORAGE_NOT_CONFIGURED"
      | "RESOURCE_NOT_FOUND",
    public readonly httpStatus: 404 | 409 | 429 | 500 | 503 = code ===
    "RESOURCE_NOT_FOUND"
      ? 404
      : code === "FILE_RATE_LIMITED"
        ? 429
        : code === "FILE_STORAGE_NOT_CONFIGURED"
          ? 503
          : 409,
    public readonly retryable = false,
  ) {
    super(code);
  }
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PRIVATE_KEY =
  /^quarantine\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/[A-Za-z0-9_-]{43}$/u;
const CLEAN_KEY =
  /^clean\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;

function privateSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function quotedEtag(etag: string | undefined): string {
  if (!etag || !/^[a-f0-9]{32}$/u.test(etag))
    throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
  return `"${etag}"`;
}

export interface PrivateR2EvidenceStore {
  headReservedOriginal(objectKey: string): Promise<{
    etag: string;
    mimeType: string;
    objectVersion: string;
    sizeBytes: number;
  }>;
  putQuarantinedOriginal(input: {
    body: Uint8Array | ArrayBuffer | ReadableStream;
    mimeType: string;
    uploadId: string;
  }): Promise<{ etag: string; objectKey: string }>;
  putReservedOriginal(input: {
    body: Uint8Array | ArrayBuffer | ReadableStream;
    mimeType: string;
    objectKey: string;
    uploadId: string;
  }): Promise<{ etag: string; objectKey: string }>;
  putCleanVersion(input: {
    body: Uint8Array;
    fileVersionId: string;
    mimeType: string;
  }): Promise<{
    etag: string;
    objectKey: string;
    objectVersion: string;
    sizeBytes: number;
  }>;
  readQuarantinedOriginal(objectKey: string): Promise<{
    body: Uint8Array;
    etag: string;
    mimeType: string;
    objectVersion: string;
    sizeBytes: number;
  }>;
  openCleanVersion?(objectKey: string): Promise<{
    body: ReadableStream<Uint8Array>;
    etag: string;
    mimeType: string;
    objectVersion: string;
    sizeBytes: number;
  }>;
  readCleanVersion(objectKey: string): Promise<{
    body: Uint8Array;
    etag: string;
    mimeType: string;
    objectVersion: string;
    sizeBytes: number;
  }>;
  reserveQuarantineKey(uploadId: string): string;
}

export function createPrivateR2EvidenceStore(
  binding: PrivateR2Binding | undefined,
): PrivateR2EvidenceStore {
  function requireBinding(): PrivateR2Binding {
    if (!binding) throw new FileStorageError("FILE_STORAGE_NOT_CONFIGURED");
    return binding;
  }
  function reserveQuarantineKey(uploadId: string): string {
    if (!UUID.test(uploadId))
      throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
    return `quarantine/${uploadId}/${privateSuffix()}`;
  }
  async function putReservedOriginal(input: {
    body: Uint8Array | ArrayBuffer | ReadableStream;
    mimeType: string;
    objectKey: string;
    uploadId: string;
  }) {
    const match = PRIVATE_KEY.exec(input.objectKey);
    if (!match || match[1] !== input.uploadId)
      throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
    const stored = await requireBinding().put(input.objectKey, input.body, {
      httpMetadata: { contentType: input.mimeType },
      onlyIf: { etagDoesNotMatch: "*" },
    });
    return {
      etag: quotedEtag(stored?.etag),
      objectKey: input.objectKey,
    };
  }
  return {
    async headReservedOriginal(objectKey) {
      if (!PRIVATE_KEY.test(objectKey))
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      const configured = requireBinding();
      if (!configured.head)
        throw new FileStorageError("FILE_STORAGE_NOT_CONFIGURED");
      const object = await configured.head(objectKey);
      if (
        !object?.version ||
        typeof object.size !== "number" ||
        !object.httpMetadata?.contentType
      )
        throw new FileStorageError("FILE_NOT_READY");
      return {
        etag: quotedEtag(object.etag),
        mimeType: object.httpMetadata.contentType,
        objectVersion: object.version,
        sizeBytes: object.size,
      };
    },
    async putCleanVersion(input) {
      const objectKey = `clean/${input.fileVersionId}`;
      if (!CLEAN_KEY.test(objectKey))
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      const stored = await requireBinding().put(objectKey, input.body, {
        httpMetadata: { contentType: input.mimeType },
        onlyIf: { etagDoesNotMatch: "*" },
      });
      if (!stored?.version)
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      return {
        etag: quotedEtag(stored.etag),
        objectKey,
        objectVersion: stored.version,
        sizeBytes: input.body.byteLength,
      };
    },
    async putQuarantinedOriginal(input) {
      return putReservedOriginal({
        ...input,
        objectKey: reserveQuarantineKey(input.uploadId),
      });
    },
    putReservedOriginal,
    async readQuarantinedOriginal(objectKey) {
      if (!PRIVATE_KEY.test(objectKey))
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      const configured = requireBinding();
      if (!configured.get)
        throw new FileStorageError("FILE_STORAGE_NOT_CONFIGURED");
      const object = await configured.get(objectKey);
      if (
        !object?.version ||
        typeof object.size !== "number" ||
        !object.httpMetadata?.contentType
      )
        throw new FileStorageError("FILE_NOT_READY");
      const body = new Uint8Array(await object.arrayBuffer());
      if (body.byteLength !== object.size)
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      return {
        body,
        etag: quotedEtag(object.etag),
        mimeType: object.httpMetadata.contentType,
        objectVersion: object.version,
        sizeBytes: object.size,
      };
    },
    async openCleanVersion(objectKey) {
      if (!CLEAN_KEY.test(objectKey))
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      const configured = requireBinding();
      if (!configured.get)
        throw new FileStorageError("FILE_STORAGE_NOT_CONFIGURED");
      const object = await configured.get(objectKey);
      if (
        !object?.body ||
        !object.version ||
        typeof object.size !== "number" ||
        !object.httpMetadata?.contentType
      )
        throw new FileStorageError("FILE_NOT_READY");
      return {
        body: object.body,
        etag: quotedEtag(object.etag),
        mimeType: object.httpMetadata.contentType,
        objectVersion: object.version,
        sizeBytes: object.size,
      };
    },
    async readCleanVersion(objectKey) {
      if (!CLEAN_KEY.test(objectKey))
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      const configured = requireBinding();
      if (!configured.get)
        throw new FileStorageError("FILE_STORAGE_NOT_CONFIGURED");
      const object = await configured.get(objectKey);
      if (
        !object?.version ||
        typeof object.size !== "number" ||
        !object.httpMetadata?.contentType
      )
        throw new FileStorageError("FILE_NOT_READY");
      const body = new Uint8Array(await object.arrayBuffer());
      if (body.byteLength !== object.size)
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      return {
        body,
        etag: quotedEtag(object.etag),
        mimeType: object.httpMetadata.contentType,
        objectVersion: object.version,
        sizeBytes: object.size,
      };
    },
    reserveQuarantineKey,
  };
}

type FilePrincipal = AuthenticatedPrincipal & { sessionToken: string };

type AuthorizedView = {
  cleanObjectKey: string;
  displayName: string;
  etag: string;
  grantId: string;
  mimeType: string;
  objectVersion: string;
  sha256: string;
  sizeBytes: number;
};

type AuthorizedUpload = {
  expiresAt: string;
  id: string;
  mimeType: string;
  quarantineObjectKey: string;
  reservationFingerprint: string;
  sizeBytes: number;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
  return value as Record<string, unknown>;
}

function authorized(value: unknown): AuthorizedUpload {
  const record = object(value);
  if (
    typeof record.id !== "string" ||
    typeof record.expiresAt !== "string" ||
    typeof record.mimeType !== "string" ||
    typeof record.quarantineObjectKey !== "string" ||
    typeof record.reservationFingerprint !== "string" ||
    typeof record.sizeBytes !== "number"
  )
    throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
  return record as AuthorizedUpload;
}

function authorizedView(value: unknown, fileVersionId: string): AuthorizedView {
  const record = object(value);
  if (
    record.cleanObjectKey !== `clean/${fileVersionId}` ||
    typeof record.displayName !== "string" ||
    !record.displayName.trim() ||
    typeof record.etag !== "string" ||
    !/^"[a-f0-9]{32}"$/u.test(record.etag) ||
    typeof record.grantId !== "string" ||
    !UUID.test(record.grantId) ||
    typeof record.mimeType !== "string" ||
    !["image/jpeg", "image/png", "image/webp", "image/heic"].includes(
      record.mimeType,
    ) ||
    typeof record.objectVersion !== "string" ||
    !record.objectVersion ||
    typeof record.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(record.sha256) ||
    typeof record.sizeBytes !== "number" ||
    !Number.isInteger(record.sizeBytes) ||
    record.sizeBytes < 1 ||
    record.sizeBytes > 20 * 1024 * 1024
  )
    throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
  return record as AuthorizedView;
}

function randomCompletionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");
}

async function hexHash(value: unknown): Promise<string> {
  const digest = await sha256(JSON.stringify(value));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export interface HotelFileService {
  close?(): Promise<void>;
  authorizeAndPut(
    principal: FilePrincipal,
    uploadId: string,
    body: ReadableStream<Uint8Array>,
    mimeType: string,
    contentLength: number,
  ): Promise<{ etag: string }>;
  complete(
    principal: FilePrincipal,
    uploadId: string,
    value: HotelFileUploadCompleteRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  init(
    principal: FilePrincipal,
    hotelId: string,
    value: HotelFileUploadInitRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  status(
    principal: FilePrincipal,
    hotelId: string,
    uploadId: string,
  ): Promise<unknown>;
  view(
    principal: FilePrincipal,
    hotelId: string,
    inspectionId: string,
    fileVersionId: string,
    parentType?: "DAILY_SALES" | "INSPECTION" | "REPAIR",
  ): Promise<{
    body: ReadableStream<Uint8Array>;
    displayName: string;
    etag: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  repairView(
    principal: FilePrincipal,
    hotelId: string,
    repairId: string,
    fileVersionId: string,
  ): Promise<{
    body: ReadableStream<Uint8Array>;
    displayName: string;
    etag: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  dailySalesView(
    principal: FilePrincipal,
    hotelId: string,
    salesId: string,
    fileVersionId: string,
  ): Promise<{
    body: ReadableStream<Uint8Array>;
    displayName: string;
    etag: string;
    mimeType: string;
    sizeBytes: number;
  }>;
}

export function createHotelFileService(
  repository: InspectionRepository,
  store: PrivateR2EvidenceStore,
): HotelFileService {
  async function canonicalScope(
    principal: FilePrincipal,
    uploadId: string,
  ): Promise<string> {
    if (!repository.fileUploadScope)
      throw new FileStorageError("FILE_STORAGE_NOT_CONFIGURED");
    const hotelId = await repository.fileUploadScope({
      companyId: principal.companyId,
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
      uploadId,
    });
    if (!hotelId) throw new FileStorageError("RESOURCE_NOT_FOUND");
    return hotelId;
  }
  async function authorize(
    principal: FilePrincipal,
    uploadId: string,
  ): Promise<{ hotelId: string; upload: AuthorizedUpload }> {
    const hotelId = await canonicalScope(principal, uploadId);
    const result = await repository.fileQuery({
      action: "UPLOAD_AUTHORIZE",
      companyId: principal.companyId,
      hotelId,
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
      uploadId,
    });
    if (result.status !== "OK")
      throw new FileStorageError("RESOURCE_NOT_FOUND");
    return { hotelId, upload: authorized(result.payload) };
  }
  async function mutate(
    principal: FilePrincipal,
    hotelId: string,
    uploadId: string,
    action: "UPLOAD_COMPLETE" | "UPLOAD_INIT",
    value: unknown,
    path: string,
    idempotencyKey: string,
  ) {
    const repairInit =
      action === "UPLOAD_INIT" &&
      typeof value === "object" &&
      value !== null &&
      "parentType" in value &&
      (value as { parentType?: unknown }).parentType !==
        "INSPECTION_ITEM_EVIDENCE"
        ? (
            repository as InspectionRepository & {
              repairFileUploadInit?: InspectionRepository["fileCommand"];
            }
          ).repairFileUploadInit
        : undefined;
    const command = repairInit ?? repository.fileCommand;
    const result = await command({
      action,
      auditEventId: crypto.randomUUID(),
      companyId: principal.companyId,
      expectedVersion: 0,
      hotelId,
      httpMethod: "POST",
      idempotencyKey,
      idempotencyRecordId: crypto.randomUUID(),
      operationPath: path,
      requestHash: await hexHash({ action, path, value }),
      resourceId: uploadId,
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
      traceId: crypto.randomUUID(),
      value,
    });
    if (!["CREATED", "UPDATED", "REPLAYED"].includes(result.status)) {
      if (result.status === "FILE_INTEGRITY_MISMATCH")
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      if (result.status === "FILE_UPLOAD_EXPIRED")
        throw new FileStorageError("FILE_NOT_READY");
      throw new FileStorageError("RESOURCE_NOT_FOUND");
    }
    return result.payload;
  }
  async function viewCommand(
    principal: FilePrincipal,
    hotelId: string,
    parentType: "DAILY_SALES" | "INSPECTION" | "REPAIR",
    parentId: string,
    fileVersionId: string,
    action: "ABORTED" | "AUTHORIZE" | "FAILED" | "SUCCEEDED",
    traceId: string,
    grantId: string,
    completionToken: string,
  ) {
    const shared = {
      action,
      alertAuditEventId: crypto.randomUUID(),
      auditEventId: crypto.randomUUID(),
      companyId: principal.companyId,
      completionToken,
      fileVersionId,
      grantId,
      hotelId,
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
      traceId,
    };
    if (parentType === "REPAIR") {
      const command = repository.repairFileViewCommand;
      if (!command) throw new FileStorageError("FILE_STORAGE_NOT_CONFIGURED");
      return command({ ...shared, repairId: parentId });
    }
    if (parentType === "DAILY_SALES") {
      const command = repository.dailySalesFileViewCommand;
      if (!command) throw new FileStorageError("FILE_STORAGE_NOT_CONFIGURED");
      return command({ ...shared, salesId: parentId });
    }
    const command = repository.fileViewCommand;
    if (!command) throw new FileStorageError("FILE_STORAGE_NOT_CONFIGURED");
    return command({ ...shared, inspectionId: parentId });
  }

  return {
    close: () => repository.close(),
    async authorizeAndPut(principal, uploadId, body, mimeType, contentLength) {
      const { upload } = await authorize(principal, uploadId);
      if (contentLength !== upload.sizeBytes || mimeType !== upload.mimeType)
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      const result = await store.putReservedOriginal({
        body,
        mimeType,
        objectKey: upload.quarantineObjectKey,
        uploadId,
      });
      return { etag: result.etag };
    },
    async complete(principal, uploadId, value, idempotencyKey) {
      const { hotelId, upload } = await authorize(principal, uploadId);
      const objectState = await store.headReservedOriginal(
        upload.quarantineObjectKey,
      );
      if (
        objectState.etag !== value.etag ||
        objectState.mimeType !== upload.mimeType ||
        objectState.sizeBytes !== upload.sizeBytes
      )
        throw new FileStorageError("FILE_INTEGRITY_MISMATCH");
      return mutate(
        principal,
        hotelId,
        uploadId,
        "UPLOAD_COMPLETE",
        {
          ...objectState,
          reservationFingerprint: upload.reservationFingerprint,
          scanJobId: crypto.randomUUID(),
        },
        hotelFileRoutes.uploadComplete(uploadId),
        idempotencyKey,
      );
    },
    async init(principal, hotelId, value, idempotencyKey) {
      const uploadId = crypto.randomUUID();
      const quarantineObjectKey = store.reserveQuarantineKey(uploadId);
      const reservationFingerprint = await hexHash({
        companyId: principal.companyId,
        hotelId,
        mimeType: value.mimeType,
        quarantineObjectKey,
        sizeBytes: value.sizeBytes,
        uploadId,
      });
      const parentPayload =
        value.parent.type === "INSPECTION_ITEM_EVIDENCE"
          ? {
              parentType: value.parent.type,
              inspectionId: value.parent.inspectionId,
              itemSnapshotId: value.parent.itemSnapshotId,
            }
          : value.parent.type === "REPAIR_CASE_EVIDENCE"
            ? {
                parentType: value.parent.type,
                repairCaseId: value.parent.repairCaseId,
              }
            : value.parent.type === "REPAIR_VISIT_COMPLETION_EVIDENCE"
              ? {
                  parentType: value.parent.type,
                  repairCaseId: value.parent.repairCaseId,
                  repairVisitId: value.parent.repairVisitId,
                }
              : {
                  parentType: value.parent.type,
                  dailySalesId: value.parent.salesId,
                };
      const payload = await mutate(
        principal,
        hotelId,
        uploadId,
        "UPLOAD_INIT",
        {
          fileName: value.fileName,
          ...parentPayload,
          mimeType: value.mimeType,
          quarantineObjectKey,
          reservationFingerprint,
          sizeBytes: value.sizeBytes,
        },
        hotelFileRoutes.uploadInit(hotelId),
        idempotencyKey,
      );
      const upload = object(payload);
      return {
        upload: { id: upload.id, status: upload.status },
        uploadUrl: hotelFileRoutes.uploadBody(uploadId),
        expiresInSeconds: 300,
        requiredHeaders: {
          "Content-Type": value.mimeType,
          "If-None-Match": "*" as const,
        },
      };
    },
    async status(principal, hotelId, uploadId) {
      const result = await repository.fileQuery({
        action: "STATUS",
        companyId: principal.companyId,
        hotelId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
        uploadId,
      });
      if (result.status !== "OK")
        throw new FileStorageError("RESOURCE_NOT_FOUND");
      return result.payload;
    },
    async view(
      principal,
      hotelId,
      inspectionId,
      fileVersionId,
      parentType = "INSPECTION",
    ) {
      const traceId = crypto.randomUUID();
      const grantId = crypto.randomUUID();
      const completionToken = randomCompletionToken();
      const authorization = await viewCommand(
        principal,
        hotelId,
        parentType,
        inspectionId,
        fileVersionId,
        "AUTHORIZE",
        traceId,
        grantId,
        completionToken,
      );
      if (authorization.status === "RATE_LIMITED")
        throw new FileStorageError("FILE_RATE_LIMITED", 429, true);
      if (authorization.status !== "OK")
        throw new FileStorageError("RESOURCE_NOT_FOUND");

      let finalized = false;
      let finalization: Promise<void> | null = null;
      const finalize = (action: "ABORTED" | "FAILED" | "SUCCEEDED") => {
        if (finalized) return Promise.resolve();
        if (finalization) return finalization;
        finalization = (async () => {
          let failure: unknown;
          try {
            for (let attempt = 0; attempt < 3; attempt += 1) {
              try {
                const recorded = await viewCommand(
                  principal,
                  hotelId,
                  parentType,
                  inspectionId,
                  fileVersionId,
                  action,
                  traceId,
                  grantId,
                  completionToken,
                );
                if (recorded.status !== "RECORDED")
                  throw new FileStorageError("FILE_INTEGRITY_MISMATCH", 500);
                finalized = true;
                return;
              } catch (error) {
                failure = error;
              }
            }
            throw failure;
          } finally {
            if (finalized || failure) await repository.close();
            if (!finalized) finalization = null;
          }
        })();
        return finalization;
      };

      try {
        const expected = authorizedView(authorization.payload, fileVersionId);
        if (expected.grantId !== grantId)
          throw new FileStorageError("FILE_INTEGRITY_MISMATCH", 500);
        const openCleanVersion = store.openCleanVersion;
        if (!openCleanVersion)
          throw new FileStorageError("FILE_STORAGE_NOT_CONFIGURED");
        const objectState = await openCleanVersion(expected.cleanObjectKey);
        if (
          objectState.etag !== expected.etag ||
          objectState.objectVersion !== expected.objectVersion ||
          objectState.mimeType !== expected.mimeType ||
          objectState.sizeBytes !== expected.sizeBytes
        )
          throw new FileStorageError("FILE_INTEGRITY_MISMATCH", 500);

        const reader = objectState.body.getReader();
        let cancellationRequested = false;
        const body = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const result = await reader.read();
              if (result.done) {
                await finalize(cancellationRequested ? "ABORTED" : "SUCCEEDED");
                controller.close();
              } else {
                controller.enqueue(result.value);
              }
            } catch (error) {
              await finalize(
                cancellationRequested ? "ABORTED" : "FAILED",
              ).catch(() => undefined);
              controller.error(error);
            }
          },
          async cancel(reason) {
            cancellationRequested = true;
            try {
              await reader.cancel(reason);
            } finally {
              await finalize("ABORTED");
            }
          },
        });
        return {
          body,
          displayName: expected.displayName,
          etag: objectState.etag,
          mimeType: objectState.mimeType,
          sizeBytes: objectState.sizeBytes,
        };
      } catch (error) {
        await finalize("FAILED").catch(() => undefined);
        throw error;
      }
    },
    async repairView(principal, hotelId, repairId, fileVersionId) {
      return this.view(principal, hotelId, repairId, fileVersionId, "REPAIR");
    },
    async dailySalesView(principal, hotelId, salesId, fileVersionId) {
      return this.view(
        principal,
        hotelId,
        salesId,
        fileVersionId,
        "DAILY_SALES",
      );
    },
  };
}
