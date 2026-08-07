import { describe, expect, it, vi } from "vitest";
import { createRepairService } from "../src/repairs/service";

const principal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  displayName: "김보수",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  sessionToken: "opaque-repair-session-token",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF" as const,
};
const hotelId = "50000000-0000-4000-8000-000000000001";
const repairId = "a1000000-0000-4000-8000-000000000001";
const repair = {
  calendarProjectionStatus: "NOT_CONNECTED" as const,
  createdAt: "2026-08-06T12:00:00.000Z",
  followUpCount: 0,
  hotelId,
  id: repairId,
  predecessor: null,
  priority: {
    color: "#dc2626",
    id: "a3000000-0000-4000-8000-000000000001",
    name: "긴급",
    sortOrder: 1,
    version: 1,
  },
  process: {
    currentStageName: null,
    executionId: "a4000000-0000-4000-8000-000000000001",
    state: "PENDING_INPUT",
    version: 1,
  },
  source: {
    description: "욕실 누수",
    fileVersionIds: [],
    type: "DIRECT",
    unavailableReason: "촬영 장비 고장",
  },
  status: "OPEN" as const,
  target: {
    facilityTypeName: null,
    id: "52000000-0000-4000-8000-000000000001",
    locationName: "2층",
    name: "201호",
    type: "ROOM" as const,
  },
  updatedAt: "2026-08-06T12:00:00.000Z",
  version: 1,
  visits: [],
};

function repository(payload: unknown) {
  return {
    close: vi.fn(),
    read: vi.fn().mockResolvedValue({ status: "OK", payload }),
    caseCommand: vi.fn().mockResolvedValue({ status: "CREATED", payload }),
    priorityCommand: vi.fn(),
    transitionCommand: vi.fn(),
    visitCommand: vi.fn(),
  };
}

describe("repair service", () => {
  it("returns the canonical DB detail and does not synthesize provider success", async () => {
    const repo = repository({ repair });
    const service = createRepairService(repo);

    await expect(service.getRepair(principal, hotelId, repairId)).resolves.toEqual(repair);
    expect(repo.read).toHaveBeenCalledWith({
      companyId: principal.companyId,
      hotelId,
      repairId,
      query: {},
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
    });
  });

  it("uses the canonical method/path/body hash boundary for direct creation", async () => {
    const payload = { repair };
    const repo = repository(payload);
    const service = createRepairService(repo);
    const request = {
      repairCaseId: repairId,
      source: { type: "DIRECT" as const, description: "욕실 누수", fileVersionIds: [], unavailableReason: "촬영 장비 고장" },
      target: { type: "ROOM" as const, roomId: "52000000-0000-4000-8000-000000000001" },
      priorityId: "a3000000-0000-4000-8000-000000000001",
      followUpOfRepairCaseId: null,
      followUpParentVersion: null,
    };

    await service.createRepair(principal, hotelId, request, "repair-create-key");
    expect(repo.caseCommand).toHaveBeenCalledWith(expect.objectContaining({
      action: "CREATE_DIRECT",
      companyId: principal.companyId,
      hotelId,
      idempotencyKey: "repair-create-key",
      method: "POST",
      operationPath: `/api/hotels/${hotelId}/repairs`,
      sessionToken: principal.sessionToken,
      value: request,
    }));
  });

  it("reads active priorities from the repository instead of synthesizing defaults", async () => {
    const priorities = [{
      color: "#dc2626",
      id: "a3000000-0000-4000-8000-000000000001",
      name: "긴급",
      sortOrder: 1,
      status: "ACTIVE" as const,
      version: 1,
    }];
    const repo = repository({ priorities });
    const service = createRepairService(repo);

    await expect(service.listPriorities(principal, hotelId)).resolves.toEqual({ priorities });
    expect(repo.read).toHaveBeenCalledWith({
      companyId: principal.companyId,
      hotelId,
      repairId: null,
      query: { kind: "PRIORITIES" },
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
    });
  });
});
