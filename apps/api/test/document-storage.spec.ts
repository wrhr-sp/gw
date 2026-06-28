import { describe, expect, it } from "vitest";
import {
  buildDocumentStorageKey,
  createDocumentStorageAdapter,
  DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES,
  DEFAULT_MAX_DOCUMENT_FILE_SIZE_BYTES,
  normalizeDocumentContentType,
  sanitizeDocumentFileName,
} from "../src/lib/document-storage";

describe("document storage skeleton", () => {
  it("sanitizes object-key filenames and enforces company-prefixed key layout", () => {
    expect(sanitizeDocumentFileName("phase8-plan v1.pdf")).toBe("phase8-plan-v1.pdf");

    const key = buildDocumentStorageKey({
      companyId: "company_demo",
      spaceId: "document_space_public",
      fileId: "document_file_phase8",
      versionId: "document_version_1",
      fileName: "phase8-plan v1.pdf",
    });

    expect(key).toBe(
      "companies/company_demo/spaces/document_space_public/files/document_file_phase8/versions/document_version_1/phase8-plan-v1.pdf",
    );
  });

  it("normalizes office mime aliases and rejects unsafe ids", () => {
    expect(normalizeDocumentContentType("application/x-hwp")).toBe("application/vnd.hancom.hwp");
    expect(() =>
      buildDocumentStorageKey({
        companyId: "company_demo/../../other",
        spaceId: "document_space_public",
        fileId: "document_file_phase8",
        versionId: "document_version_1",
        fileName: "phase8-plan.pdf",
      }),
    ).toThrow(/unsafe companyId/i);
  });

  it("requires FILES_BUCKET R2 binding instead of falling back to a mock adapter", () => {
    expect(() => createDocumentStorageAdapter({})).toThrow(/FILES_BUCKET R2 binding is required/i);
  });

  it("exports allowlist and max-size defaults for endpoint validation", () => {
    expect(DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES).toContain("application/pdf");
    expect(DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES).toContain("application/vnd.hancom.hwpx");
    expect(DEFAULT_MAX_DOCUMENT_FILE_SIZE_BYTES).toBe(25 * 1024 * 1024);
  });
});
