import { describe, expect, it } from "vitest";

import { getSelectedDocumentFile } from "./app/_components/real-usage-panels";

function makeFile(overrides: Partial<Parameters<typeof getSelectedDocumentFile>[0][number]> = {}) {
  return {
    id: "file_default",
    spaceId: "document_space_public",
    ownerEmployeeId: "employee_admin",
    versionId: "version_default",
    fileName: "document.pdf",
    contentType: "application/pdf",
    fileSize: 2048,
    versionLabel: "v1",
    isPublicWithinCompany: true,
    storageProvider: "r2" as const,
    storageStatus: "ready" as const,
    checksumSha256: null,
    status: "active" as const,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 54 documents empty-space guard", () => {
  it("keeps selected document empty when the active space has no visible files", () => {
    const foreignSpaceFile = makeFile({
      id: "file_other_space",
      spaceId: "document_space_hr",
      fileName: "hr-only.pdf",
    });

    expect(getSelectedDocumentFile([], foreignSpaceFile.id)).toBeNull();
  });

  it("returns the explicitly selected file only when it belongs to the active space list", () => {
    const visibleFiles = [
      makeFile({ id: "file_public_1" }),
      makeFile({ id: "file_public_2", fileName: "handoff.pdf" }),
    ];

    expect(getSelectedDocumentFile(visibleFiles, "file_public_2")).toEqual(visibleFiles[1]);
  });

  it("falls back to the first visible file instead of another space when the selection is stale", () => {
    const visibleFiles = [
      makeFile({ id: "file_public_1" }),
      makeFile({ id: "file_public_2" }),
    ];

    expect(getSelectedDocumentFile(visibleFiles, "file_other_space")?.id).toBe("file_public_1");
  });
});
