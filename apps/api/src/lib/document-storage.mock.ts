import { buildDocumentStorageKey, buildDocumentStoragePreview, type DocumentStorageAdapter, type PrepareDownloadInput, type PrepareDownloadResult, type PrepareUploadInput, type PrepareUploadResult } from "./document-storage";

const EXPIRES_AT = "2026-06-10T09:15:00.000Z";

export class MockDocumentStorageAdapter implements DocumentStorageAdapter {
  readonly provider = "mock" as const;

  async prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadResult> {
    const objectKey = buildDocumentStorageKey(input);
    return {
      provider: this.provider,
      kind: "mock-upload",
      objectKey,
      objectKeyPreview: buildDocumentStoragePreview(objectKey),
      expiresAt: EXPIRES_AT,
      uploadToken: `upload_token_${input.fileId}_${input.versionId}`,
      message: "mock/local-safe upload placeholder",
    };
  }

  async prepareDownload(input: PrepareDownloadInput): Promise<PrepareDownloadResult> {
    const objectKey = buildDocumentStorageKey(input);
    return {
      provider: this.provider,
      kind: "mock-download",
      objectKey,
      objectKeyPreview: buildDocumentStoragePreview(objectKey),
      expiresAt: EXPIRES_AT,
      downloadToken: `download_token_${input.fileId}_${input.versionId}`,
      message: "mock/local-safe download placeholder",
    };
  }

  async deleteObject(_input: PrepareDownloadInput): Promise<void> {
    return;
  }
}
