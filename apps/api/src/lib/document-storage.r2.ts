import {
  buildDocumentStorageKey,
  buildDocumentStoragePreview,
  type DeleteStoredObjectInput,
  type DocumentStorageAdapter,
  type DocumentStorageBucketBinding,
  type PrepareDownloadInput,
  type PrepareDownloadResult,
  type PrepareUploadInput,
  type PrepareUploadResult,
} from "./document-storage";

const DOWNLOAD_EXPIRES_IN_MINUTES = 15;

function expiresAtFromNow() {
  return new Date(Date.now() + DOWNLOAD_EXPIRES_IN_MINUTES * 60 * 1000).toISOString();
}

export class R2DocumentStorageAdapter implements DocumentStorageAdapter {
  readonly provider = "r2" as const;

  constructor(private readonly bucket: DocumentStorageBucketBinding) {}

  async prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadResult> {
    const objectKey = buildDocumentStorageKey(input);
    return {
      provider: this.provider,
      kind: "r2-upload",
      objectKey,
      objectKeyPreview: buildDocumentStoragePreview(objectKey),
      expiresAt: expiresAtFromNow(),
      uploadToken: `upload_token_${input.fileId}_${input.versionId}`,
      message: "R2 binding detected; upload must be completed through the Cloudflare R2-backed upload endpoint.",
    };
  }

  async prepareDownload(input: PrepareDownloadInput): Promise<PrepareDownloadResult> {
    const objectKey = buildDocumentStorageKey(input);
    return {
      provider: this.provider,
      kind: "r2-download",
      objectKey,
      objectKeyPreview: buildDocumentStoragePreview(objectKey),
      expiresAt: expiresAtFromNow(),
      downloadToken: `download_token_${input.fileId}_${input.versionId}_${crypto.randomUUID()}`,
      message: "R2 binding detected; download must be served through the Cloudflare R2-backed download endpoint.",
    };
  }

  async putObject(input: PrepareUploadInput, body: ArrayBuffer) {
    if (!this.bucket.put) {
      throw new Error("FILES_BUCKET R2 put binding is required for document upload.");
    }
    const objectKey = buildDocumentStorageKey(input);
    await this.bucket.put(objectKey, body, { httpMetadata: { contentType: input.contentType } });
    return objectKey;
  }

  async getObject(input: PrepareDownloadInput) {
    if (!this.bucket.get) {
      throw new Error("FILES_BUCKET R2 get binding is required for document download.");
    }
    const objectKey = buildDocumentStorageKey(input);
    const object = await this.bucket.get(objectKey);
    if (!object?.body) return null;

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("content-disposition", `attachment; filename="${encodeURIComponent(input.fileName)}"`);
    return { body: object.body, headers, etag: object.httpEtag };
  }

  async deleteObject(input: DeleteStoredObjectInput): Promise<void> {
    if (!this.bucket.delete) return;
    await this.bucket.delete(buildDocumentStorageKey(input));
  }
}
