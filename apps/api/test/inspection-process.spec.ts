import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import {
  createInspectionService,
  type InspectionService,
} from "../src/inspections/service";
import {
  createHotelFileService,
  createPrivateR2EvidenceStore,
  type HotelFileService,
  type PrivateR2Binding,
} from "../src/files/r2";

const inspectionHotelId = "50000000-0000-4000-8000-000000000001";

const principal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  displayName: "점검 담당자",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  sessionToken: "opaque-session-token",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF" as const,
};

describe("inspection process service", () => {
  it("passes the opaque token to the database command and reads the committed inspection back", async () => {
    const command = vi.fn().mockResolvedValue({
      status: "CREATED",
      payload: { id: "c3000000-0000-4000-8000-000000000001" },
    });
    const readInspection = vi.fn().mockResolvedValue({
      status: "OK",
      payload: {
        inspection: {
          id: "c3000000-0000-4000-8000-000000000001",
          hotelId: "50000000-0000-4000-8000-000000000001",
        },
      },
    });
    const service = createInspectionService({
      close: vi.fn(),
      command,
      readInspection,
    });

    const result = await service.createManualInspection(
      principal,
      "50000000-0000-4000-8000-000000000001",
      {
        processDefinitionId: null,
        targets: [
          {
            roomId: "bc000000-0000-4000-8000-000000000001",
            selectedItemIds: ["c5000000-0000-4000-8000-000000000001"],
          },
        ],
      },
      "inspection-create-1",
    );

    expect(command).toHaveBeenCalledTimes(1);
    expect(command.mock.calls[0]?.[0]).toMatchObject({
      action: "CREATE_MANUAL",
      companyId: principal.companyId,
      hotelId: "50000000-0000-4000-8000-000000000001",
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
    });
    expect(readInspection).toHaveBeenCalledWith({
      companyId: principal.companyId,
      hotelId: "50000000-0000-4000-8000-000000000001",
      inspectionId: "c3000000-0000-4000-8000-000000000001",
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
    });
    const readResult = await readInspection.mock.results[0]!.value;
    expect(result).toEqual(readResult.payload.inspection);
  });

  it("adds server-owned IDs and expected version to an abnormal result mutation", async () => {
    const savedInspection = {
      id: "c3000000-0000-4000-8000-000000000001",
      items: [
        {
          id: "c5000000-0000-4000-8000-000000000001",
          result: {
            version: 3,
            result: "ABNORMAL",
            description: "욕실 배관 누수가 확인되었습니다.",
            severity: "MAJOR",
            fileVersionIds: ["c6000000-0000-4000-8000-000000000001"],
          },
        },
      ],
    };
    const command = vi.fn().mockResolvedValue({
      status: "CREATED",
      payload: savedInspection,
    });
    const readInspection = vi.fn().mockResolvedValue({
      status: "OK",
      payload: { inspection: savedInspection },
    });
    const service = createInspectionService({
      close: vi.fn(),
      command,
      readInspection,
    });

    await service.saveResult(
      principal,
      "50000000-0000-4000-8000-000000000001",
      "c3000000-0000-4000-8000-000000000001",
      "c5000000-0000-4000-8000-000000000001",
      {
        itemSnapshotId: "c5000000-0000-4000-8000-000000000001",
        version: 2,
        result: "ABNORMAL",
        description: "욕실 배관 누수가 확인되었습니다.",
        severity: "MAJOR",
        fileVersionIds: ["c6000000-0000-4000-8000-000000000001"],
        changeReason: "현장 재확인 결과 반영",
      },
      "result-save-1",
    );

    const input = command.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      action: "SAVE_RESULT",
      expectedVersion: 2,
      resourceId: "c3000000-0000-4000-8000-000000000001",
      sessionToken: principal.sessionToken,
      value: {
        itemSnapshotId: "c5000000-0000-4000-8000-000000000001",
        result: "ABNORMAL",
        fileVersionIds: ["c6000000-0000-4000-8000-000000000001"],
      },
    });
    expect(input.value.resultId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(input.value.historyId).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("keeps the request hash stable when a committed manual creation is retried", async () => {
    const inspectionId = "c3000000-0000-4000-8000-000000000001";
    const command = vi
      .fn()
      .mockResolvedValueOnce({
        status: "CREATED",
        payload: { id: inspectionId },
      })
      .mockResolvedValueOnce({
        status: "REPLAYED",
        payload: { id: inspectionId },
      });
    const readInspection = vi.fn().mockResolvedValue({
      status: "OK",
      payload: { inspection: { id: inspectionId } },
    });
    const service = createInspectionService({
      close: vi.fn(),
      command,
      readInspection,
    });
    const value = {
      processDefinitionId: null,
      targets: [
        {
          roomId: "bc000000-0000-4000-8000-000000000001",
          selectedItemIds: ["c5000000-0000-4000-8000-000000000001"],
        },
      ],
    };

    await service.createManualInspection(
      principal,
      inspectionHotelId,
      value,
      "committed-response-lost",
    );
    await service.createManualInspection(
      principal,
      inspectionHotelId,
      value,
      "committed-response-lost",
    );

    expect(command).toHaveBeenCalledTimes(2);
    expect(command.mock.calls[0]?.[0].requestHash).toBe(
      command.mock.calls[1]?.[0].requestHash,
    );
    expect(command.mock.calls[0]?.[0].value.processExecutionId).not.toBe(
      command.mock.calls[1]?.[0].value.processExecutionId,
    );
  });

  it("rejects a stale canonical read that differs from the saved result", async () => {
    const expectedResult = {
      version: 1,
      result: "NORMAL",
      description: null,
      severity: null,
      fileVersionIds: [] as string[],
    };
    const itemId = "c5000000-0000-4000-8000-000000000001";
    const command = vi.fn().mockResolvedValue({
      status: "CREATED",
      payload: {
        id: "c3000000-0000-4000-8000-000000000001",
        items: [{ id: itemId, result: expectedResult }],
      },
    });
    const readInspection = vi.fn().mockResolvedValue({
      status: "OK",
      payload: {
        inspection: {
          id: "c3000000-0000-4000-8000-000000000001",
          items: [
            { id: itemId, result: { ...expectedResult, result: "ATTENTION" } },
          ],
        },
      },
    });
    const service = createInspectionService({
      close: vi.fn(),
      command,
      readInspection,
    });

    await expect(
      service.saveResult(
        principal,
        inspectionHotelId,
        "c3000000-0000-4000-8000-000000000001",
        itemId,
        {
          itemSnapshotId: itemId,
          version: 0,
          result: "NORMAL",
          description: null,
          severity: null,
          fileVersionIds: [],
          changeReason: null,
        },
        "stale-canonical-read",
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT", httpStatus: 409 });
  });
});

describe("inspection HTTP API", () => {
  it("creates a manual inspection through the authenticated API route", async () => {
    const inspection = {
      id: "c3000000-0000-4000-8000-000000000001",
      hotelId: "50000000-0000-4000-8000-000000000001",
      source: "MANUAL",
      businessDate: "2026-08-02",
      dueAt: "2026-08-02T09:00:00.000Z",
      status: "PENDING_INPUT",
      version: 1,
      process: {
        executionId: "c4000000-0000-4000-8000-000000000001",
        definitionId: "c1000000-0000-4000-8000-000000000001",
        revisionId: "c2000000-0000-4000-8000-000000000001",
        currentStageKey: null,
        currentStageName: null,
        state: "PENDING_INPUT",
        version: 1,
      },
      rooms: [],
      items: [],
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
    } as const;
    const createManualInspection = vi.fn(async () => inspection);
    const authService = {
      resolvePrincipal: vi.fn(async () => principal),
    } as unknown as AuthService;
    const inspectionService = {
      createManualInspection,
    } as unknown as InspectionService;
    const app = createApp({ authService, inspectionService });

    const response = await app.request(
      "/api/hotels/50000000-0000-4000-8000-000000000001/inspections/manual",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "__Host-hotel_session=opaque-session-token",
          "idempotency-key": "manual-inspection-http-1",
        },
        body: JSON.stringify({
          processDefinitionId: null,
          targets: [
            {
              roomId: "bc000000-0000-4000-8000-000000000001",
              selectedItemIds: ["c5000000-0000-4000-8000-000000000001"],
            },
          ],
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { inspection: { id: inspection.id } },
    });
    expect(createManualInspection).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken: "opaque-session-token" }),
      inspection.hotelId,
      expect.any(Object),
      "manual-inspection-http-1",
    );
  });

  it("streams an authenticated same-origin upload body to the file service", async () => {
    const authorizeAndPut = vi.fn(async () => ({
      etag: '"0123456789abcdef0123456789abcdef"',
    }));
    const authService = {
      resolvePrincipal: vi.fn(async () => principal),
    } as unknown as AuthService;
    const hotelFileService = {
      authorizeAndPut,
      close: vi.fn(),
    } as unknown as HotelFileService;
    const app = createApp({ authService, hotelFileService });

    const response = await app.request(
      "/api/files/uploads/d1000000-0000-4000-8000-000000000001/body",
      {
        method: "PUT",
        headers: {
          "content-length": "3",
          "content-type": "image/jpeg",
          cookie: "__Host-hotel_session=opaque-session-token",
          "if-none-match": "*",
          origin: "http://localhost",
          "sec-fetch-site": "same-origin",
        },
        body: new Uint8Array([1, 2, 3]),
      },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("etag")).toBe(
      '"0123456789abcdef0123456789abcdef"',
    );
    expect(authorizeAndPut).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken: "opaque-session-token" }),
      "d1000000-0000-4000-8000-000000000001",
      expect.any(ReadableStream),
      "image/jpeg",
      3,
    );

    const crossOrigin = await app.request(
      "/api/files/uploads/d1000000-0000-4000-8000-000000000001/body",
      {
        method: "PUT",
        headers: {
          "content-length": "3",
          "content-type": "image/jpeg",
          cookie: "__Host-hotel_session=opaque-session-token",
          "if-none-match": "*",
          origin: "https://attacker.invalid",
          "sec-fetch-site": "cross-site",
        },
        body: new Uint8Array([1, 2, 3]),
      },
    );
    expect(crossOrigin.status).toBe(400);

    const tooLarge = await app.request(
      "/api/files/uploads/d1000000-0000-4000-8000-000000000001/body",
      {
        method: "PUT",
        headers: {
          "content-length": String(20 * 1024 * 1024 + 1),
          "content-type": "image/jpeg",
          cookie: "__Host-hotel_session=opaque-session-token",
          "if-none-match": "*",
          origin: "http://localhost",
          "sec-fetch-site": "same-origin",
        },
        body: new Uint8Array([1]),
      },
    );
    expect(tooLarge.status).toBe(400);
    expect(authorizeAndPut).toHaveBeenCalledTimes(1);
  });
});

describe("private R2 evidence store", () => {
  it("persists a server-owned reservation and completes from R2 HEAD metadata", async () => {
    const uploadId = "d1000000-0000-4000-8000-000000000001";
    const objectKey = `${`quarantine/${uploadId}/`}${"A".repeat(43)}`;
    const fileCommand = vi
      .fn()
      .mockResolvedValueOnce({
        status: "CREATED",
        payload: { id: uploadId, status: "PENDING_UPLOAD" },
      })
      .mockResolvedValueOnce({
        status: "UPDATED",
        payload: { id: uploadId, status: "QUARANTINED" },
      });
    const fileQuery = vi.fn().mockResolvedValue({
      status: "OK",
      payload: {
        id: uploadId,
        quarantineObjectKey: objectKey,
        reservationFingerprint: "a".repeat(64),
        sizeBytes: 3,
        mimeType: "image/jpeg",
        expiresAt: "2026-08-02T00:05:00.000Z",
      },
    });
    const fileUploadScope = vi.fn().mockResolvedValue(inspectionHotelId);
    const putReservedOriginal = vi.fn().mockResolvedValue({
      etag: '"0123456789abcdef0123456789abcdef"',
      objectKey,
    });
    const service = createHotelFileService(
      {
        close: vi.fn(),
        command: vi.fn(),
        fileCommand,
        fileUploadScope,
        fileQuery,
        readInspection: vi.fn(),
      },
      {
        reserveQuarantineKey: vi.fn(() => objectKey),
        putQuarantinedOriginal: vi.fn(),
        putReservedOriginal,
        putCleanVersion: vi.fn(),
        readCleanVersion: vi.fn(),
        readQuarantinedOriginal: vi.fn(),
        headReservedOriginal: vi.fn(async () => ({
          etag: '"0123456789abcdef0123456789abcdef"',
          mimeType: "image/jpeg",
          objectVersion: "r2-version-1",
          sizeBytes: 3,
        })),
      },
    );

    const initialized = await service.init(
      principal,
      inspectionHotelId,
      {
        parent: {
          type: "INSPECTION_ITEM_EVIDENCE",
          inspectionId: "c3000000-0000-4000-8000-000000000001",
          itemSnapshotId: "c5000000-0000-4000-8000-000000000001",
        },
        fileName: "누수사진.jpg",
        sizeBytes: 3,
        mimeType: "image/jpeg",
      },
      "file-init-1",
    );
    expect(initialized).toMatchObject({
      upload: { status: "PENDING_UPLOAD" },
      uploadUrl: expect.stringMatching(
        /^\/api\/files\/uploads\/[0-9a-f-]{36}\/body$/u,
      ),
      requiredHeaders: { "If-None-Match": "*" },
    });
    expect(fileCommand.mock.calls[0]?.[0].value).toMatchObject({
      quarantineObjectKey: objectKey,
      reservationFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    await service.authorizeAndPut(
      principal,
      uploadId,
      stream,
      "image/jpeg",
      3,
    );
    expect(fileUploadScope).toHaveBeenCalledWith({
      companyId: principal.companyId,
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
      uploadId,
    });
    expect(putReservedOriginal).toHaveBeenCalledWith({
      body: stream,
      mimeType: "image/jpeg",
      objectKey,
      uploadId,
    });

    await expect(
      service.authorizeAndPut(
        principal,
        uploadId,
        new ReadableStream<Uint8Array>(),
        "image/jpeg",
        4,
      ),
    ).rejects.toMatchObject({ code: "FILE_INTEGRITY_MISMATCH" });

    await service.complete(
      principal,
      uploadId,
      { etag: '"0123456789abcdef0123456789abcdef"' },
      "file-complete-1",
    );
    expect(fileCommand.mock.calls[1]?.[0].value).toMatchObject({
      etag: '"0123456789abcdef0123456789abcdef"',
      objectVersion: "r2-version-1",
      sizeBytes: 3,
      mimeType: "image/jpeg",
      reservationFingerprint: "a".repeat(64),
      scanJobId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
    });
  });

  it("fails closed when the private binding is missing", async () => {
    const store = createPrivateR2EvidenceStore(undefined);
    await expect(
      store.putQuarantinedOriginal({
        body: new Uint8Array([1, 2, 3]),
        mimeType: "image/jpeg",
        uploadId: "d1000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toMatchObject({
      code: "FILE_STORAGE_NOT_CONFIGURED",
    });
  });

  it("derives a private quarantine key and requires create-only R2 mutation", async () => {
    const put = vi
      .fn()
      .mockResolvedValue({ etag: "0123456789abcdef0123456789abcdef" });
    const binding = { put } as unknown as PrivateR2Binding;
    const store = createPrivateR2EvidenceStore(binding);

    const result = await store.putQuarantinedOriginal({
      body: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
      uploadId: "d1000000-0000-4000-8000-000000000001",
    });

    const objectKey = put.mock.calls[0]?.[0] as string;
    expect(objectKey).toMatch(
      /^quarantine\/d1000000-0000-4000-8000-000000000001\/[A-Za-z0-9_-]{43}$/u,
    );
    expect(put).toHaveBeenCalledWith(objectKey, expect.any(Uint8Array), {
      httpMetadata: { contentType: "image/jpeg" },
      onlyIf: { etagDoesNotMatch: "*" },
    });
    expect(result).toEqual({
      etag: '"0123456789abcdef0123456789abcdef"',
      objectKey,
    });
  });
});
