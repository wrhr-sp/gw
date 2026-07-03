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

  it("stores, retrieves, and deletes document objects through the R2 binding", async () => {
    const stored = new Map<string, { body: ArrayBuffer; contentType: string }>();
    const adapter = createDocumentStorageAdapter({
      FILES_BUCKET: {
        put: async (key, value, options) => {
          stored.set(key, { body: value, contentType: options?.httpMetadata?.contentType ?? "application/octet-stream" });
        },
        get: async (key) => {
          const item = stored.get(key);
          if (!item) return null;
          return {
            body: item.body,
            httpEtag: "etag-test",
            writeHttpMetadata: (headers: Headers) => headers.set("content-type", item.contentType),
          };
        },
        delete: async (key) => {
          stored.delete(key);
        },
      },
    });
    const input = {
      companyId: "company_demo",
      spaceId: "document_space_public",
      fileId: "document_file_phase8",
      versionId: "document_version_1",
      fileName: "phase8-plan.pdf",
      contentType: "application/pdf",
      fileSize: 3,
    };
    const body = new Uint8Array([1, 2, 3]).buffer;
    const objectKey = await adapter.putObject(input, body);
    expect(objectKey).toContain("companies/company_demo/spaces/document_space_public");
    const downloaded = await adapter.getObject(input);
    expect(downloaded?.headers.get("content-type")).toBe("application/pdf");
    expect(downloaded?.headers.get("content-disposition")).toContain("phase8-plan.pdf");
    await adapter.deleteObject(input);
    expect(await adapter.getObject(input)).toBeNull();
  });

  it("exports allowlist and max-size defaults for endpoint validation", () => {
    expect(DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES).toContain("application/pdf");
    expect(DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES).toContain("application/vnd.hancom.hwpx");
    expect(DEFAULT_MAX_DOCUMENT_FILE_SIZE_BYTES).toBe(25 * 1024 * 1024);
  });
});
