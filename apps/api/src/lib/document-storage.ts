import type { DocumentFileAction, DocumentStorageProvider } from "@gw/shared";
import { MockDocumentStorageAdapter } from "./document-storage.mock";
import { R2DocumentStorageAdapter } from "./document-storage.r2";

export const DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.hancom.hwp",
  "application/vnd.hancom.hwpx",
] as const;

export const DEFAULT_MAX_DOCUMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const OBJECT_SAFE_SEGMENT_REGEX = /^[a-zA-Z0-9_-]+$/;
const VERSION_SAFE_SEGMENT_REGEX = /^[a-zA-Z0-9_-]+$/;
const MIME_ALIAS: Record<string, (typeof DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES)[number]> = {
  "application/x-hwp": "application/vnd.hancom.hwp",
};

export type DocumentStorageBucketBinding = {
  head?: (...args: unknown[]) => unknown;
  get?: (...args: unknown[]) => unknown;
  put?: (...args: unknown[]) => unknown;
  delete?: (...args: unknown[]) => unknown;
};

export type DocumentStorageEnv = {
  FILES_BUCKET?: DocumentStorageBucketBinding;
};

export type BuildDocumentStorageKeyInput = {
  companyId: string;
  spaceId: string;
  fileId: string;
  versionId: string;
  fileName: string;
};

export type PrepareUploadInput = BuildDocumentStorageKeyInput & {
  contentType: string;
  fileSize: number;
};

export type PrepareUploadResult = {
  provider: DocumentStorageProvider;
  kind: DocumentFileAction["kind"];
  objectKey: string;
  objectKeyPreview: string;
  expiresAt: string;
  uploadToken: string;
  message: string;
};

export type PrepareDownloadInput = BuildDocumentStorageKeyInput;

export type PrepareDownloadResult = {
  provider: DocumentStorageProvider;
  kind: DocumentFileAction["kind"];
  objectKey: string;
  objectKeyPreview: string;
  expiresAt: string;
  downloadToken: string;
  message: string;
};

export type DeleteStoredObjectInput = BuildDocumentStorageKeyInput;

export interface DocumentStorageAdapter {
  readonly provider: DocumentStorageProvider;
  prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadResult>;
  prepareDownload(input: PrepareDownloadInput): Promise<PrepareDownloadResult>;
  deleteObject(input: DeleteStoredObjectInput): Promise<void>;
}

export function normalizeDocumentContentType(contentType: string) {
  return MIME_ALIAS[contentType] ?? contentType;
}

export function sanitizeDocumentFileName(fileName: string) {
  const trimmed = fileName.trim().toLowerCase();
  const collapsed = trimmed
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  return collapsed.length > 0 ? collapsed : "file";
}

function assertSafeSegment(kind: string, value: string, regex: RegExp = OBJECT_SAFE_SEGMENT_REGEX) {
  if (!regex.test(value)) {
    throw new Error(`unsafe ${kind}`);
  }
}

export function buildDocumentStorageKey(input: BuildDocumentStorageKeyInput) {
  assertSafeSegment("companyId", input.companyId);
  assertSafeSegment("spaceId", input.spaceId);
  assertSafeSegment("fileId", input.fileId);
  assertSafeSegment("versionId", input.versionId, VERSION_SAFE_SEGMENT_REGEX);

  const safeFileName = sanitizeDocumentFileName(input.fileName);
  return `companies/${input.companyId}/spaces/${input.spaceId}/files/${input.fileId}/versions/${input.versionId}/${safeFileName}`;
}

export function buildDocumentStoragePreview(objectKey: string) {
  const segments = objectKey.split("/").filter(Boolean);

  if (
    segments.length >= 9 &&
    segments[0] === "companies" &&
    segments[2] === "spaces" &&
    segments[4] === "files" &&
    segments[6] === "versions"
  ) {
    const [, companyId, , spaceId, , fileId, , versionId] = segments;
    return `masked-object/${companyId}/${spaceId}/${fileId}/${versionId}`;
  }

  return "masked-object/redacted";
}

export function ensureDocumentUploadPolicy(input: { contentType: string; fileSize: number }) {
  const normalizedContentType = normalizeDocumentContentType(input.contentType);
  const contentTypeAllowed = DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES.includes(
    normalizedContentType as (typeof DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES)[number],
  );

  return {
    normalizedContentType,
    contentTypeAllowed,
    fileSizeAllowed: input.fileSize <= DEFAULT_MAX_DOCUMENT_FILE_SIZE_BYTES,
  };
}

export function createDocumentStorageAdapter(env: DocumentStorageEnv): DocumentStorageAdapter {
  if (env.FILES_BUCKET) {
    return new R2DocumentStorageAdapter(env.FILES_BUCKET);
  }

  return new MockDocumentStorageAdapter();
}
