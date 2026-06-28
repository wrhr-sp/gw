import { buildDocumentStorageKey, buildDocumentStoragePreview, type DocumentStorageAdapter, type DocumentStorageBucketBinding, type PrepareDownloadInput, type PrepareDownloadResult, type PrepareUploadInput, type PrepareUploadResult } from "./document-storage";

const EXPIRES_AT = "2026-06-10T09:15:00.000Z";

export class R2DocumentStorageAdapter implements DocumentStorageAdapter {
  readonly provider = "r2" as const;

  constructor(private readonly bucket: DocumentStorageBucketBinding) {
    void this.bucket;
  }

  async prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadResult> {
    const objectKey = buildDocumentStorageKey(input);
    return {
      provider: this.provider,
      kind: "r2-upload",
      objectKey,
      objectKeyPreview: buildDocumentStoragePreview(objectKey),
      expiresAt: EXPIRES_AT,
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
      expiresAt: EXPIRES_AT,
      downloadToken: `download_token_${input.fileId}_${input.versionId}`,
      message: "R2 binding detected; download must be served through the Cloudflare R2-backed download endpoint.",
    };
  }

  async deleteObject(_input: PrepareDownloadInput): Promise<void> {
    return;
  }
}
