import type { InspectionRepository } from "@werehere/db";
import { describe, expect, it, vi } from "vitest";
import {
  createHotelFileService,
  type PrivateR2EvidenceStore,
} from "../src/files/r2";

const principal = {
  companyId: "11111111-1111-4111-8111-111111111111",
  displayName: "작성자",
  identityId: "22222222-2222-4222-8222-222222222222",
  sessionId: "33333333-3333-4333-8333-333333333333",
  sessionToken: "S".repeat(43),
  userId: "44444444-4444-4444-8444-444444444444",
  userType: "INTERNAL_STAFF" as const,
};
const knowledgeId = "55555555-5555-4555-8555-555555555555";
const otherKnowledgeId = "66666666-6666-4666-8666-666666666666";

function store(): PrivateR2EvidenceStore {
  return {
    headReservedOriginal: vi.fn(),
    putQuarantinedOriginal: vi.fn(),
    putReservedOriginal: vi.fn(),
    putCleanVersion: vi.fn(),
    readQuarantinedOriginal: vi.fn(),
    readCleanVersion: vi.fn(),
    reserveQuarantineKey: (uploadId, suffix = "q".repeat(43)) =>
      `quarantine/${uploadId}/${suffix}`,
  };
}

function repository(overrides: Record<string, unknown> = {}) {
  return {
    close: vi.fn(),
    knowledgeFileCommand: vi.fn(async () => ({
      status: "CREATED",
      payload: {
        id: "77777777-7777-4777-8777-777777777777",
        status: "PENDING_UPLOAD",
      },
    })),
    knowledgeFileParentScope: vi.fn(async () => ({ hotelId: null })),
    knowledgeFileUploadScope: vi.fn(async () => ({
      hotelId: null,
      knowledgeId,
    })),
    ...overrides,
  } as unknown as InspectionRepository;
}

describe("knowledge private R2 authority", () => {
  it("initializes a company-common upload with an exact knowledge parent and null hotel", async () => {
    const repo = repository();
    const service = createHotelFileService(repo, store());
    await expect(
      service.knowledgeInit(
        principal,
        knowledgeId,
        {
          fileName: "현장사진.png",
          mimeType: "image/png",
          parent: { type: "KNOWLEDGE_ATTACHMENT", knowledgeId },
          sizeBytes: 12,
        },
        "knowledge-file-init-key",
      ),
    ).resolves.toMatchObject({
      upload: { status: "PENDING_UPLOAD" },
      requiredHeaders: { "If-None-Match": "*" },
    });
    expect(repo.knowledgeFileCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPLOAD_INIT",
        hotelId: null,
        operationPath: `/api/knowledge/${knowledgeId}/files/upload-init`,
        value: expect.objectContaining({
          parent: { type: "KNOWLEDGE_ATTACHMENT", knowledgeId },
        }),
      }),
    );
  });

  it("initializes a hotel-scoped upload with the canonical DB hotel", async () => {
    const hotelId = "88888888-8888-4888-8888-888888888888";
    const repo = repository({
      knowledgeFileParentScope: vi.fn(async () => ({ hotelId })),
    });
    const service = createHotelFileService(repo, store());
    await service.knowledgeInit(
      principal,
      knowledgeId,
      {
        fileName: "호텔현장사진.png",
        mimeType: "image/png",
        parent: { type: "KNOWLEDGE_ATTACHMENT", knowledgeId },
        sizeBytes: 12,
      },
      "hotel-knowledge-file-init-key",
    );
    expect(repo.knowledgeFileCommand).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPLOAD_INIT", hotelId }),
    );
    expect(repo.knowledgeFileParentScope).toHaveBeenCalledWith({
      companyId: principal.companyId,
      knowledgeId,
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
    });
  });

  it("fails closed when a status route names another knowledge entry", async () => {
    const repo = repository({
      knowledgeFileCommand: vi.fn(async () => ({
        status: "OK",
        payload: { id: "77777777-7777-4777-8777-777777777777", status: "READY_UNLINKED" },
      })),
    });
    const service = createHotelFileService(repo, store());
    await expect(
      service.knowledgeStatus(
        principal,
        otherKnowledgeId,
        "77777777-7777-4777-8777-777777777777",
      ),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(repo.knowledgeFileCommand).not.toHaveBeenCalled();
  });

  it("keeps upload-init identity stable across session rotation", async () => {
    const command = vi.fn(
      async (input: { action: string; resourceId: string; value: unknown }) => ({
        status: "CREATED",
        payload: { id: input.resourceId, status: "PENDING_UPLOAD" },
      }),
    );
    const service = createHotelFileService(
      repository({ knowledgeFileCommand: command }),
      store(),
    );
    const body = {
      fileName: "현장사진.png",
      mimeType: "image/png" as const,
      parent: { type: "KNOWLEDGE_ATTACHMENT" as const, knowledgeId },
      sizeBytes: 12,
    };
    const first = await service.knowledgeInit(
      principal,
      knowledgeId,
      body,
      "rotate-init-key",
    );
    const replay = await service.knowledgeInit(
      {
        ...principal,
        sessionId: "99999999-9999-4999-8999-999999999999",
        sessionToken: "T".repeat(43),
      },
      knowledgeId,
      body,
      "rotate-init-key",
    );
    expect(
      (replay as { upload: { id: string } }).upload.id,
    ).toBe((first as { upload: { id: string } }).upload.id);
    expect(command.mock.calls[1]?.[0].value).toEqual(command.mock.calls[0]?.[0].value);
  });

  it("keeps upload-complete scan identity and request hash stable across session rotation", async () => {
    const uploadId = "77777777-7777-4777-8777-777777777777";
    const authorizedUpload = {
      expiresAt: "2027-01-01T00:00:00.000Z",
      id: uploadId,
      mimeType: "image/png",
      quarantineObjectKey: `quarantine/${uploadId}/${"q".repeat(43)}`,
      reservationFingerprint: "a".repeat(64),
      sizeBytes: 12,
    };
    const command = vi.fn(
      async (input: { action: string; requestHash: string; value: unknown }) =>
      input.action === "UPLOAD_AUTHORIZE"
        ? { status: "OK", payload: authorizedUpload }
        : { status: "UPDATED", payload: { id: uploadId, status: "QUARANTINED" } },
    );
    const r2 = store();
    vi.mocked(r2.headReservedOriginal).mockResolvedValue({
      etag: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      mimeType: "image/png",
      objectVersion: "source-v1",
      sizeBytes: 12,
    });
    const service = createHotelFileService(
      repository({ knowledgeFileCommand: command }),
      r2,
    );
    const completion = {
      etag: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      objectVersion: "source-v1",
      sizeBytes: 12,
    };
    await service.complete(principal, uploadId, completion, "rotate-complete-key");
    await service.complete(
      {
        ...principal,
        sessionId: "99999999-9999-4999-8999-999999999999",
        sessionToken: "T".repeat(43),
      },
      uploadId,
      completion,
      "rotate-complete-key",
    );
    const firstComplete = command.mock.calls[1]![0];
    const replayComplete = command.mock.calls[3]![0];
    const firstValue = firstComplete.value as { scanJobId: string };
    const replayValue = replayComplete.value as { scanJobId: string };
    expect(replayValue.scanJobId).toBe(firstValue.scanJobId);
    expect(replayComplete.requestHash).toBe(firstComplete.requestHash);
  });
});
