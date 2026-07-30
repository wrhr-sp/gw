import { createPostgresHotelFileApiRepository } from "@werehere/db";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";
import { createPrivateR2Storage, type R2BucketLike } from "./r2-storage";
import { createHotelFileService, type HotelFileService, type HotelFileStorage } from "./service";

export type HotelFileBindings = DatabaseBindings & {
  HOTEL_FILES?: R2BucketLike;
  PUBLIC_APP_ORIGIN?: string;
};

export class HotelFileConfigurationError extends Error {
  readonly code = "FILE_STORAGE_NOT_CONFIGURED" as const;
}

export function createHotelFileServiceFromBindings(
  bindings: HotelFileBindings | undefined,
  injectedPublicAppOrigin?: string,
): HotelFileService {
  const databaseUrl = resolveDatabaseUrl(bindings, "API_RUNTIME");
  const bucket = bindings?.HOTEL_FILES;
  const publicAppOrigin = injectedPublicAppOrigin ?? bindings?.PUBLIC_APP_ORIGIN;
  if (!databaseUrl || !bucket || !publicAppOrigin) {
    throw new HotelFileConfigurationError("Hotel file API bindings are not configured");
  }
  let canonicalOrigin: string;
  try {
    const parsed = new URL(publicAppOrigin);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("invalid origin");
    }
    canonicalOrigin = parsed.origin;
  } catch {
    throw new HotelFileConfigurationError("Hotel file API public origin is invalid");
  }
  const adapter = createPrivateR2Storage(bucket);
  const storage: HotelFileStorage = {
    async putQuarantine(input) {
      const result = await adapter.putQuarantine({
        key: input.objectKey,
        body: input.body,
        contentType: input.mimeType,
        reservationFingerprint: input.reservationFingerprint,
        declaredSizeBytes: input.sizeBytes,
      });
      if (result.status === "CONFLICT" || result.status === "STORAGE_UNAVAILABLE") return result;
      return {
        status: result.status,
        etag: result.evidence.etag,
        objectVersion: result.evidence.version,
        sizeBytes: result.evidence.sizeBytes,
        mimeType: result.evidence.mimeType,
      };
    },
    async headQuarantine(input) {
      const result = await adapter.headQuarantine({
        key: input.objectKey,
        destinationEtag: input.expectedEtag,
        contentType: input.expectedMimeType,
        reservationFingerprint: input.reservationFingerprint,
        declaredSizeBytes: input.expectedSizeBytes,
      });
      if (result.status !== "FOUND") return result;
      return {
        status: "FOUND",
        etag: result.evidence.etag,
        objectVersion: result.evidence.version,
        sizeBytes: result.evidence.sizeBytes,
        mimeType: result.evidence.mimeType,
      };
    },
    async getClean(input) {
      const result = await adapter.getClean({
        key: input.objectKey,
        destinationEtag: input.expectedEtag,
        objectVersion: input.expectedObjectVersion,
        sha256Hex: input.expectedSha256Hex,
        sizeBytes: input.expectedSizeBytes,
        mimeType: input.expectedMimeType,
      });
      return result.status === "AUTHORIZED"
        ? { status: "AUTHORIZED", body: result.body }
        : result;
    },
  };
  return createHotelFileService({
    publicAppOrigin: canonicalOrigin,
    repository: createPostgresHotelFileApiRepository(databaseUrl),
    storage,
  });
}
