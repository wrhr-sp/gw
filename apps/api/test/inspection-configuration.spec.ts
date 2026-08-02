import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import {
  createInspectionService,
  type InspectionService,
} from "../src/inspections/service";

const principal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  displayName: "점검 설정 관리자",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  sessionToken: "opaque-session-token",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF" as const,
};
const hotelId = "50000000-0000-4000-8000-000000000001";

function repository() {
  return {
    close: vi.fn(),
    command: vi.fn(),
    fileCommand: vi.fn(),
    fileQuery: vi.fn(),
    processCommand: vi.fn(),
    readInspection: vi.fn(),
  };
}

describe("inspection configuration service", () => {
  it("reads company and hotel process definitions through the process authority", async () => {
    const repo = repository();
    repo.processCommand.mockResolvedValue({
      status: "OK",
      payload: {
        definitions: [{ id: "d1000000-0000-4000-8000-000000000001" }],
      },
    });
    const service = createInspectionService(repo);

    await expect(
      service.listProcessDefinitions(principal, hotelId),
    ).resolves.toEqual([{ id: "d1000000-0000-4000-8000-000000000001" }]);
    expect(repo.processCommand).toHaveBeenCalledWith({
      action: "LIST_DEFINITIONS",
      companyId: principal.companyId,
      hotelId,
      resourceId: null,
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
      value: {},
    });
  });

  it("saves a checklist with server-owned IDs and reads the canonical revision", async () => {
    const repo = repository();
    repo.command.mockResolvedValue({
      status: "UPDATED",
      payload: {
        id: "c1000000-0000-4000-8000-000000000001",
        version: 2,
      },
    });
    const service = createInspectionService(repo);
    const input = {
      version: 1,
      reason: "객실 청결 기준 변경",
      items: [
        {
          itemId: null,
          source: "HOTEL_COMMON" as const,
          roomTypeId: null,
          excludedRoomTypeIds: [],
          name: "침구 청결",
          description: null,
          isRequired: true,
          displayOrder: 10,
          defaultSeverity: "MAJOR" as const,
        },
      ],
    };

    await expect(
      service.saveChecklist(principal, hotelId, input, "idem-checklist-save"),
    ).resolves.toMatchObject({ version: 2 });
    expect(repo.command).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SAVE_CHECKLIST",
        companyId: principal.companyId,
        expectedVersion: 1,
        hotelId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
        value: expect.objectContaining({
          items: [expect.objectContaining({ itemId: expect.any(String) })],
          reason: input.reason,
          revisionId: expect.any(String),
        }),
      }),
    );
  });
});

describe("inspection configuration HTTP API", () => {
  it("reads the canonical checklist through the authenticated hotel route", async () => {
    const checklist = {
      id: "c1000000-0000-4000-8000-000000000001",
      hotelId,
      version: 1,
      reason: "최초 객실점검 기준",
      items: [],
      createdBy: principal.userId,
      createdAt: "2026-08-02T00:00:00.000Z",
    };
    const getChecklist = vi.fn(async () => checklist);
    const app = createApp({
      authService: {
        resolvePrincipal: vi.fn(async () => principal),
      } as unknown as AuthService,
      inspectionService: { getChecklist } as unknown as InspectionService,
    });

    const response = await app.request(
      `/api/hotels/${hotelId}/inspection-checklist`,
      {
        headers: { cookie: "__Host-hotel_session=opaque-session-token" },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { checklist: { id: checklist.id, hotelId } },
    });
    expect(getChecklist).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken: "opaque-session-token" }),
      hotelId,
    );
  });
});
