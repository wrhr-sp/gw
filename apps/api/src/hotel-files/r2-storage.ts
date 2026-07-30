export interface R2HttpMetadataLike {
  readonly contentType?: string;
}

export interface R2ObjectLike {
  readonly key: string;
  readonly etag: string;
  readonly version: string;
  readonly size: number;
  readonly httpMetadata?: R2HttpMetadataLike;
  readonly customMetadata?: Readonly<Record<string, string>>;
}

export interface R2ObjectBodyLike extends R2ObjectLike {
  readonly body: ReadableStream<Uint8Array>;
}

export interface R2PutOptionsLike {
  readonly onlyIf: { readonly etagDoesNotMatch: "*" };
  readonly httpMetadata: { readonly contentType: string };
  readonly customMetadata: Readonly<Record<string, string>>;
}

export interface R2BucketLike {
  put(
    key: string,
    body: ReadableStream<Uint8Array>,
    options: R2PutOptionsLike,
  ): Promise<R2ObjectLike | null>;
  head(key: string): Promise<R2ObjectLike | null>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
}

export interface PutQuarantineRequest {
  /** Opaque object key reserved and persisted by the database. */
  readonly key: string;
  readonly body: ReadableStream<Uint8Array>;
  readonly contentType: string;
  readonly reservationFingerprint: string;
  readonly declaredSizeBytes: number;
  /** Extra database-bound evidence; reserved fields cannot be overridden. */
  readonly customMetadata?: Readonly<Record<string, string>>;
}

export interface QuarantineObjectEvidence {
  readonly key: string;
  readonly etag: string;
  readonly version: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly reservationFingerprint: string;
}

export type PutQuarantineResult =
  | { readonly status: "CREATED"; readonly evidence: QuarantineObjectEvidence }
  | { readonly status: "REPLAYED"; readonly evidence: QuarantineObjectEvidence }
  | { readonly status: "CONFLICT" }
  | { readonly status: "STORAGE_UNAVAILABLE" };

export interface HeadQuarantineRequest {
  readonly key: string;
  readonly destinationEtag: string;
  readonly contentType: string;
  readonly reservationFingerprint: string;
  readonly declaredSizeBytes: number;
}

export type HeadQuarantineResult =
  | { readonly status: "FOUND"; readonly evidence: QuarantineObjectEvidence }
  | { readonly status: "EVIDENCE_MISMATCH" }
  | { readonly status: "NOT_FOUND" }
  | { readonly status: "STORAGE_UNAVAILABLE" };

export interface GetCleanRequest {
  /** Exact destination object key persisted by the database. */
  readonly key: string;
  readonly destinationEtag: string;
  readonly objectVersion: string;
  readonly sha256Hex: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
}

export interface AuthorizedCleanFileMetadata {
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly sha256Hex: string;
  readonly etag: string;
  readonly version: string;
}

export type GetCleanResult =
  | {
      readonly status: "AUTHORIZED";
      readonly body: ReadableStream<Uint8Array>;
      readonly file: AuthorizedCleanFileMetadata;
    }
  | { readonly status: "EVIDENCE_MISMATCH" }
  | { readonly status: "NOT_FOUND" }
  | { readonly status: "STORAGE_UNAVAILABLE" };

export interface PrivateR2Storage {
  putQuarantine(request: PutQuarantineRequest): Promise<PutQuarantineResult>;
  headQuarantine(request: HeadQuarantineRequest): Promise<HeadQuarantineResult>;
  getClean(request: GetCleanRequest): Promise<GetCleanResult>;
}

const RESERVED_FINGERPRINT = "reservationFingerprint";
const RESERVED_DECLARED_SIZE = "declaredSizeBytes";
const CLEAN_SHA256 = "sha256";

function quarantineEvidence(
  object: R2ObjectLike,
  request: PutQuarantineRequest,
  expectedCustomMetadata: Readonly<Record<string, string>>,
): QuarantineObjectEvidence | null {
  if (
    object.key !== request.key ||
    object.etag.length === 0 ||
    object.version.length === 0 ||
    object.size !== request.declaredSizeBytes ||
    object.httpMetadata?.contentType !== request.contentType
  ) {
    return null;
  }

  const customMetadata = object.customMetadata;
  if (customMetadata === undefined) {
    return null;
  }
  for (const [name, value] of Object.entries(expectedCustomMetadata)) {
    if (customMetadata[name] !== value) {
      return null;
    }
  }

  return {
    key: object.key,
    etag: object.etag,
    version: object.version,
    sizeBytes: object.size,
    mimeType: object.httpMetadata.contentType,
    reservationFingerprint: customMetadata[RESERVED_FINGERPRINT]!,
  };
}

function expectedQuarantineMetadata(
  request: PutQuarantineRequest,
): Readonly<Record<string, string>> {
  return {
    ...request.customMetadata,
    [RESERVED_FINGERPRINT]: request.reservationFingerprint,
    [RESERVED_DECLARED_SIZE]: String(request.declaredSizeBytes),
  };
}

export function createPrivateR2Storage(bucket: R2BucketLike): PrivateR2Storage {
  return {
    async putQuarantine(request) {
      const customMetadata = expectedQuarantineMetadata(request);
      let stored: R2ObjectLike | null;

      try {
        stored = await bucket.put(request.key, request.body, {
          onlyIf: { etagDoesNotMatch: "*" },
          httpMetadata: { contentType: request.contentType },
          customMetadata,
        });
      } catch {
        return { status: "STORAGE_UNAVAILABLE" };
      }

      if (stored !== null) {
        const evidence = quarantineEvidence(stored, request, customMetadata);
        return evidence === null
          ? { status: "CONFLICT" }
          : { status: "CREATED", evidence };
      }

      try {
        const existing = await bucket.head(request.key);
        if (existing === null) {
          return { status: "CONFLICT" };
        }
        const evidence = quarantineEvidence(existing, request, customMetadata);
        return evidence === null
          ? { status: "CONFLICT" }
          : { status: "REPLAYED", evidence };
      } catch {
        return { status: "STORAGE_UNAVAILABLE" };
      }
    },

    async headQuarantine(request) {
      let stored: R2ObjectLike | null;
      try {
        stored = await bucket.head(request.key);
      } catch {
        return { status: "STORAGE_UNAVAILABLE" };
      }
      if (stored === null) return { status: "NOT_FOUND" };
      const evidence = quarantineEvidence(
        stored,
        {
          key: request.key,
          body: new ReadableStream<Uint8Array>(),
          contentType: request.contentType,
          reservationFingerprint: request.reservationFingerprint,
          declaredSizeBytes: request.declaredSizeBytes,
        },
        {
          [RESERVED_FINGERPRINT]: request.reservationFingerprint,
          [RESERVED_DECLARED_SIZE]: String(request.declaredSizeBytes),
        },
      );
      if (evidence === null || evidence.etag !== request.destinationEtag) {
        return { status: "EVIDENCE_MISMATCH" };
      }
      return { status: "FOUND", evidence };
    },

    async getClean(request) {
      let stored: R2ObjectBodyLike | null;
      try {
        stored = await bucket.get(request.key);
      } catch {
        return { status: "STORAGE_UNAVAILABLE" };
      }

      if (stored === null) {
        return { status: "NOT_FOUND" };
      }

      if (
        stored.key !== request.key ||
        stored.etag !== request.destinationEtag ||
        stored.version !== request.objectVersion ||
        stored.size !== request.sizeBytes ||
        stored.httpMetadata?.contentType !== request.mimeType ||
        stored.customMetadata?.[CLEAN_SHA256] !== request.sha256Hex
      ) {
        await stored.body.cancel().catch(() => undefined);
        return { status: "EVIDENCE_MISMATCH" };
      }

      return {
        status: "AUTHORIZED",
        body: stored.body,
        file: {
          sizeBytes: stored.size,
          mimeType: stored.httpMetadata.contentType,
          sha256Hex: stored.customMetadata[CLEAN_SHA256]!,
          etag: stored.etag,
          version: stored.version,
        },
      };
    },
  };
}
