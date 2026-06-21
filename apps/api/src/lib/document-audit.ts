import type { DocumentFile } from "@gw/shared";

const MASKED_FILE_BASENAME = "masked-file";
export const MASKED_STORAGE_PROVIDER_SUMMARY = "managed-storage";
const MASKED_STORAGE_INTERNAL_SUMMARY = "masked-storage-ref";

const STORAGE_INTERNAL_FIELD_NAMES = new Set([
  "storageKey",
  "objectKey",
  "objectKeyPreview",
  "storagePath",
  "bucket",
  "bucketName",
  "provider",
  "signedUrl",
  "publicUrl",
  "downloadUrl",
]);

function extractSafeFileExtension(fileName: string) {
  const trimmed = fileName.trim();
  const lastDotIndex = trimmed.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === trimmed.length - 1) {
    return "";
  }

  const extension = trimmed.slice(lastDotIndex + 1).toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(extension) ? extension : "";
}

export function buildMaskedDocumentAuditFileName(fileName: string) {
  const extension = extractSafeFileExtension(fileName);
  return extension ? `${MASKED_FILE_BASENAME}.${extension}` : MASKED_FILE_BASENAME;
}

export function buildDocumentAuditPreview(
  file: Pick<DocumentFile, "id" | "spaceId" | "versionId" | "fileName" | "storageProvider" | "storageStatus" | "status">,
) {
  return {
    fileId: file.id,
    spaceId: file.spaceId,
    versionId: file.versionId,
    fileName: buildMaskedDocumentAuditFileName(file.fileName),
    storageProvider: MASKED_STORAGE_PROVIDER_SUMMARY,
    storageStatus: file.storageStatus,
    status: file.status,
  };
}

export function sanitizeDocumentAuditSnapshot(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return sanitizeDocumentAuditSnapshot(JSON.parse(value));
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDocumentAuditSnapshot(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = { ...record };

  if (typeof record.fileName === "string") {
    sanitized.fileName = buildMaskedDocumentAuditFileName(record.fileName);
  }

  if (typeof record.storageProvider === "string") {
    sanitized.storageProvider = MASKED_STORAGE_PROVIDER_SUMMARY;
  }

  for (const [key, fieldValue] of Object.entries(record)) {
    if (STORAGE_INTERNAL_FIELD_NAMES.has(key) && typeof fieldValue === "string") {
      sanitized[key] = MASKED_STORAGE_INTERNAL_SUMMARY;
      continue;
    }

    if (fieldValue && typeof fieldValue === "object") {
      sanitized[key] = sanitizeDocumentAuditSnapshot(fieldValue);
    }
  }

  return sanitized;
}
