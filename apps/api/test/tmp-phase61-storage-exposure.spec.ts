import { describe, expect, it } from "vitest";
import { appRoutes, authLoginResponseSchema, documentFileUploadInitResponseSchema } from "@gw/shared";
import { app } from "../src/app";
import { buildDocumentAuditPreview } from "../src/lib/document-audit";
import { buildOperationalAuditMetadata } from "../src/lib/operational-audit";

async function loginAndGetCookie(role = "COMPANY_ADMIN") {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({ loginId: "admin", password: "1234" }),
  });
  const payload = authLoginResponseSchema.parse(await response.json());
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("missing cookie");
  return { cookie, session: payload.data.session };
}

describe("phase61 storage exposure repro", () => {
  it("does not expose raw object key preview", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");
    const response = await app.request(appRoutes.documents.uploadInit, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        spaceId: "document_space_public",
        fileName: "review-target.pdf",
        contentType: "application/pdf",
        fileSize: 1024,
        versionLabel: "v1",
        isPublicWithinCompany: false,
      }),
    });

    expect(response.status).toBe(201);
    const payload = documentFileUploadInitResponseSchema.parse(await response.json());
    expect(payload.data.action.objectKeyPreview).not.toContain("companies/company_demo/spaces/");
  });

  it("masks raw filename and storage provider in document audit preview", () => {
    const preview = buildDocumentAuditPreview({
      id: "document_file_phase61",
      spaceId: "document_space_public",
      versionId: "document_version_1",
      fileName: "review-target.pdf",
      storageProvider: "r2",
      storageStatus: "ready",
      status: "active",
    });

    expect(preview.fileName).toBe("masked-file.pdf");
    expect(preview.storageProvider).toBe("managed-storage");
    expect(JSON.stringify(preview)).not.toContain("review-target.pdf");
    expect(JSON.stringify(preview)).not.toContain('"storageProvider":"r2"');
  });

  it.each([
    {
      action: "upload",
      beforeJson: undefined,
      afterJson: {
        fileId: "document_file_phase61",
        spaceId: "document_space_public",
        versionId: "document_version_1",
        fileName: "review-target.pdf",
        storageProvider: "r2",
        storageStatus: "pending",
        status: "active",
        objectKey: "companies/company_demo/spaces/document_space_public/files/document_file_phase61/versions/document_version_1/review-target.pdf",
      },
    },
    {
      action: "download",
      beforeJson: undefined,
      afterJson: JSON.stringify({
        fileId: "document_file_phase61",
        spaceId: "document_space_public",
        versionId: "document_version_1",
        fileName: "review-target.pdf",
        storageProvider: "r2",
        storageStatus: "ready",
        status: "active",
        objectKeyPreview: "companies/company_demo/spaces/document_space_public/files/document_file_phase61/versions/document_version_1/review-target.pdf",
      }),
    },
    {
      action: "delete",
      beforeJson: {
        fileId: "document_file_phase61",
        spaceId: "document_space_public",
        versionId: "document_version_1",
        fileName: "review-target.pdf",
        storageProvider: "r2",
        storageStatus: "ready",
        status: "active",
        bucket: "gw-files",
      },
      afterJson: {
        fileId: "document_file_phase61",
        spaceId: "document_space_public",
        versionId: "document_version_1",
        fileName: "review-target.pdf",
        storageProvider: "r2",
        storageStatus: "deleted",
        status: "archived",
        signedUrl: "https://example.com/signed/review-target.pdf",
      },
    },
  ])("sanitizes $action audit metadata preview", ({ beforeJson, afterJson }) => {
    const getStorageStatus = (value: unknown) => {
      if (typeof value === "string") {
        try {
          return (JSON.parse(value) as { storageStatus?: string }).storageStatus;
        } catch {
          return undefined;
        }
      }
      if (value && typeof value === "object" && "storageStatus" in value) {
        const candidate = (value as { storageStatus?: unknown }).storageStatus;
        return typeof candidate === "string" ? candidate : undefined;
      }
      return undefined;
    };

    const afterStorageStatus = getStorageStatus(afterJson);
    const beforeStorageStatus = getStorageStatus(beforeJson);
    const storageStatus = afterStorageStatus === "ready" ? "linked" : (afterStorageStatus ?? beforeStorageStatus);

    const metadata = buildOperationalAuditMetadata(
      "document_file",
      {
        category: "document_file",
        source: "api-admin",
        maskedFields: ["fileName", "storageProvider"],
        storageRef: {
          fileId: "document_file_phase61",
          spaceId: "document_space_public",
          versionId: "document_version_1",
          storageStatus,
        },
      },
      beforeJson,
      afterJson,
    );

    expect(metadata.before).not.toContain("review-target.pdf");
    expect(metadata.after).not.toContain("review-target.pdf");
    expect(metadata.before).not.toContain('"storageProvider":"r2"');
    expect(metadata.after).not.toContain('"storageProvider":"r2"');
    expect(metadata.before).not.toContain("companies/company_demo/spaces/");
    expect(metadata.after).not.toContain("companies/company_demo/spaces/");
    expect(metadata.before).not.toContain("gw-files");
    expect(metadata.after).not.toContain("https://example.com/signed/review-target.pdf");
    expect(metadata.after).toContain("masked-file.pdf");
    expect(metadata.after).toContain("managed-storage");
    expect(metadata.after).toContain("masked-storage-ref");
    expect(metadata.storageRef?.fileId).toBe("document_file_phase61");
  });
});
