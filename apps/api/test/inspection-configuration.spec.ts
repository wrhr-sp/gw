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
    processDefaultRead: vi.fn(),
    processReviewerCandidates: vi.fn(),
    processMutation: vi.fn(),
    routineRead: vi.fn(),
    routineMutation: vi.fn(),
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

  it("lists only canonical process reviewer candidate payloads", async () => {
    const repo = repository();
    const candidates = [
      {
        id: "21000000-0000-4000-8000-000000000001",
        displayName: "객실 점검 검토자",
      },
    ];
    repo.processReviewerCandidates.mockResolvedValue({
      status: "OK",
      payload: { candidates },
    });
    const service = createInspectionService(repo);

    await expect(
      service.listProcessReviewerCandidates(principal, hotelId),
    ).resolves.toEqual(candidates);
    expect(repo.processReviewerCandidates).toHaveBeenCalledWith({
      companyId: principal.companyId,
      hotelId,
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
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

  it("saves a routine through the dedicated canonical authority", async () => {
    const repo = repository();
    const routine = {
      id: "83000000-0000-4000-8000-000000000001",
      hotelId,
      name: "월간 객실점검",
      version: 1,
    };
    repo.routineMutation.mockResolvedValue({ status: "OK", payload: routine });
    repo.routineRead.mockResolvedValue({
      status: "OK",
      payload: { routines: [routine] },
    });
    const service = createInspectionService(repo);
    const value = {
      name: routine.name,
      status: "ACTIVE" as const,
      version: 0,
      mode: "FIXED" as const,
      recurrence: { type: "MONTHLY" as const, dayOfMonth: 31 },
      startDate: "2026-08-01",
      endDate: null,
      localDueTime: "15:00",
      processDefinitionId: null,
      rounds: [{ order: 1, target: { type: "HOTEL" as const } }],
    };

    await expect(
      service.saveRoutine(principal, hotelId, null, value, "routine-save-1"),
    ).resolves.toEqual(routine);
    expect(repo.routineMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: principal.companyId,
        expectedVersion: 0,
        hotelId,
        httpMethod: "POST",
        operationPath: `/api/hotels/${hotelId}/inspection-routines`,
        sessionToken: principal.sessionToken,
        value,
      }),
    );
    await expect(service.listRoutines(principal, hotelId)).resolves.toEqual([
      routine,
    ]);
  });

  it("saves server-owned process graph IDs and reads back a versioned default", async () => {
    const repo = repository();
    const definitionId = "d1000000-0000-4000-8000-000000000001";
    const definition = { id: definitionId, version: 1 };
    repo.processMutation
      .mockResolvedValueOnce({ status: "CREATED", payload: definition })
      .mockResolvedValueOnce({ status: "UPDATED", payload: definition });
    repo.processDefaultRead.mockResolvedValue({
      status: "OK",
      payload: {
        hotelId,
        applicationType: "ROOM_INSPECTION",
        definition,
        version: 1,
        updatedAt: "2026-08-02T00:00:00.000Z",
      },
    });
    const service = createInspectionService(repo);
    const input = {
      name: "객실점검 공통검토",
      applicationType: "ROOM_INSPECTION" as const,
      scope: "HOTEL" as const,
      hotelId,
      version: 0,
      startStageKey: "review",
      stages: [
        {
          key: "review",
          name: "점검 검토",
          reviewerUserId: principal.userId,
          delegate: null,
          due: null,
          isFinal: true,
        },
      ],
      transitions: [],
    };

    await service.saveProcessDefinition(
      principal,
      null,
      input,
      "process-save-1",
    );
    expect(repo.processMutation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "SAVE_DEFINITION",
        hotelId,
        value: expect.objectContaining({
          revisionId: expect.any(String),
          stages: [expect.objectContaining({ id: expect.any(String) })],
        }),
      }),
    );

    await expect(
      service.setDefaultProcess(
        principal,
        hotelId,
        { processDefinitionId: definitionId, version: 0 },
        "default-save-1",
      ),
    ).resolves.toMatchObject({ version: 1, definition: { id: definitionId } });
    expect(repo.processDefaultRead).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelId,
        sessionToken: principal.sessionToken,
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

  it("returns minimal reviewer candidates through the authenticated hotel route", async () => {
    const candidates = [
      {
        id: "21000000-0000-4000-8000-000000000001",
        displayName: "객실 점검 검토자",
      },
    ];
    const listProcessReviewerCandidates = vi.fn(async () => candidates);
    const app = createApp({
      authService: {
        resolvePrincipal: vi.fn(async () => principal),
      } as unknown as AuthService,
      inspectionService: {
        listProcessReviewerCandidates,
      } as unknown as InspectionService,
    });
    const response = await app.request(
      `/api/hotels/${hotelId}/process-reviewer-candidates`,
      { headers: { cookie: "__Host-hotel_session=opaque-session-token" } },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: { candidates },
      error: null,
    });
    expect(listProcessReviewerCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken: "opaque-session-token" }),
      hotelId,
    );
  });

  it("returns a nullable versioned hotel process default", async () => {
    const getDefaultProcess = vi.fn(async () => null);
    const app = createApp({
      authService: {
        resolvePrincipal: vi.fn(async () => principal),
      } as unknown as AuthService,
      inspectionService: { getDefaultProcess } as unknown as InspectionService,
    });
    const response = await app.request(
      `/api/hotels/${hotelId}/process-defaults/room-inspection`,
      { headers: { cookie: "__Host-hotel_session=opaque-session-token" } },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { default: null },
    });
    expect(getDefaultProcess).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken: "opaque-session-token" }),
      hotelId,
    );
  });

  it("creates and returns a canonical inspection routine", async () => {
    const routine = {
      id: "83000000-0000-4000-8000-000000000001",
      hotelId,
      name: "월간 객실점검",
      status: "ACTIVE" as const,
      version: 1,
      nextDueDate: "2026-08-31",
      materializedThroughDate: null,
      revision: {
        id: "84000000-0000-4000-8000-000000000001",
        version: 1,
        mode: "FIXED" as const,
        recurrence: { type: "MONTHLY" as const, dayOfMonth: 31 },
        startDate: "2026-08-01",
        endDate: null,
        localDueTime: "15:00",
        processDefinitionId: "85000000-0000-4000-8000-000000000001",
        processRevisionId: "86000000-0000-4000-8000-000000000001",
        checklistRevisionId: "87000000-0000-4000-8000-000000000001",
        rounds: [
          {
            id: "88000000-0000-4000-8000-000000000001",
            order: 1,
            target: { type: "HOTEL" as const },
          },
        ],
      },
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
    };
    const saveRoutine = vi.fn(async () => routine);
    const app = createApp({
      authService: {
        resolvePrincipal: vi.fn(async () => principal),
      } as unknown as AuthService,
      inspectionService: { saveRoutine } as unknown as InspectionService,
    });
    const request = {
      name: routine.name,
      status: "ACTIVE",
      version: 0,
      mode: "FIXED",
      recurrence: { type: "MONTHLY", dayOfMonth: 31 },
      startDate: "2026-08-01",
      endDate: null,
      localDueTime: "15:00",
      processDefinitionId: null,
      rounds: [{ order: 1, target: { type: "HOTEL" } }],
    };
    const response = await app.request(
      `/api/hotels/${hotelId}/inspection-routines`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "__Host-hotel_session=opaque-session-token",
          "idempotency-key": "routine-http-1",
        },
        body: JSON.stringify(request),
      },
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ok: true,
      data: { routine },
      error: null,
    });
    expect(saveRoutine).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken: "opaque-session-token" }),
      hotelId,
      null,
      request,
      "routine-http-1",
    );
  });
});
