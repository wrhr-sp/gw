import type {
  AuthenticatedPrincipal,
  HotelActivationReadinessItem,
  HotelAssignment,
  HotelAssignmentView,
  HotelBasicInformation,
} from "@werehere/contracts";
import { describe, expect, it, vi } from "vitest";
import type { AuthService } from "../src/auth/service";
import type { HotelService } from "../src/hotels/service";
import { createApp } from "../src/app";

const principal: AuthenticatedPrincipal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF",
  displayName: "사내 임직원",
};

const hotel: HotelBasicInformation = {
  id: "50000000-0000-4000-8000-000000000001",
  branchCode: "HOTEL-GN",
  name: "위아히어 강남호텔",
  roadAddress: "서울특별시 강남구 테헤란로 1",
  detailAddress: "10층",
  representativePhone: "02-1234-5678",
  contractStartDate: "2026-07-01",
  contractEndDate: "2027-06-30",
  status: "PREPARING",
  version: 1,
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
};

const assignment: HotelAssignment = {
  id: "51000000-0000-4000-8000-000000000001",
  hotelId: hotel.id,
  userId: "20000000-0000-4000-8000-000000000002",
  relationshipType: "STAFF",
  assignmentType: "PRIMARY",
  startDate: "2026-07-24",
  endDate: null,
  reason: "호텔 기본배정",
  terminatedAt: null,
  terminationReason: null,
  version: 1,
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
};

const assignmentView: HotelAssignmentView = {
  ...assignment,
  assignee: {
    userId: assignment.userId,
    displayName: "김민수",
    userType: "INTERNAL_STAFF",
  },
};

function authService(active = true): AuthService {
  return {
    beginCustomLogin: vi.fn(async () => ({
      browserBinding: "b".repeat(43),
      csrf: "c".repeat(43),
    })),
    beginLogin: vi.fn(),
    completeLogin: vi.fn(),
    finalizeCustomLogin: vi.fn(),
    logout: vi.fn(async () => true),
    prepareCustomLogin: vi.fn(),
    resolvePrincipal: vi.fn(async () => (active ? principal : null)),
  } as AuthService;
}

function hotelService(overrides: Partial<HotelService> = {}): HotelService {
  return {
    activateHotel: vi.fn(async () => ({
      status: "READINESS_REQUIRED" as const,
      missing: [
        "OWNER",
        "STAFF",
        "INSPECTION_MANAGER",
        "ROOM",
        "CHECKLIST",
        "SCHEDULE",
        "CONTACT",
      ] satisfies HotelActivationReadinessItem[],
    })),
    createAssignment: vi.fn(),
    createHotel: vi.fn(async () => ({ status: "CREATED" as const, hotel })),
    endAssignment: vi.fn(),
    getHotel: vi.fn(async () => hotel),
    listAssignments: vi.fn(async () => ({
      status: "OK" as const,
      assignments: [assignmentView],
    })),
    listOwnerRelationships: vi.fn(async () => ({
      status: "OK" as const,
      owners: [],
    })),
    listEligibleCandidates: vi.fn(async () => ({
      status: "OK" as const,
      candidates: [assignmentView.assignee],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })),
    listHotels: vi.fn(async () => ({
      status: "OK" as const,
      capabilities: { canCreate: true },
      hotels: [hotel],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })),
    transferOwner: vi.fn(),
    ...overrides,
  };
}

const createBody = {
  branchCode: "HOTEL-GN",
  name: hotel.name,
  roadAddress: hotel.roadAddress,
  detailAddress: hotel.detailAddress,
  representativePhone: hotel.representativePhone,
  contractStartDate: hotel.contractStartDate,
  contractEndDate: hotel.contractEndDate,
};

describe("hotel basic information API", () => {
  it("returns separate minimal assignment and owner read models", async () => {
    const owner: HotelAssignmentView = {
      ...assignmentView,
      relationshipType: "OWNER",
      assignmentType: null,
      assignee: {
        userId: "20000000-0000-4000-8000-000000000003",
        displayName: "호텔 소유주",
        userType: "HOTEL_OWNER",
      },
    };
    const service = hotelService({
      listOwnerRelationships: vi.fn(async () => ({
        status: "OK" as const,
        owners: [owner],
      })),
    });
    const app = createApp({
      authService: authService(),
      hotelService: service,
    });
    const headers = { cookie: "__Host-hotel_session=opaque-session-token" };
    const assignments = await app.request(
      `/api/hotels/${hotel.id}/assignments`,
      { headers },
    );
    const owners = await app.request(`/api/hotels/${hotel.id}/owner`, {
      headers,
    });
    expect(assignments.status).toBe(200);
    expect(await assignments.json()).toMatchObject({
      data: { assignments: [{ assignee: { displayName: "김민수" } }] },
    });
    expect(owners.status).toBe(200);
    const ownerBody = (await owners.json()) as {
      data: { owners: Array<{ assignee: Record<string, unknown> }> };
    };
    expect(ownerBody.data.owners[0]?.assignee).toMatchObject({
      displayName: "호텔 소유주",
      userType: "HOTEL_OWNER",
    });
    expect(ownerBody.data.owners[0]?.assignee).not.toHaveProperty("email");
  });

  it("validates and forwards relationship-specific candidate queries", async () => {
    const listEligibleCandidates = vi.fn(async () => ({
      status: "OK" as const,
      candidates: [assignmentView.assignee],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }));
    const app = createApp({
      authService: authService(),
      hotelService: hotelService({ listEligibleCandidates }),
    });
    const response = await app.request(
      `/api/hotels/${hotel.id}/eligible-candidates?relationshipType=STAFF&assignmentType=PRIMARY&startDate=2026-07-24`,
      { headers: { cookie: "__Host-hotel_session=opaque-session-token" } },
    );
    expect(response.status).toBe(200);
    expect(listEligibleCandidates).toHaveBeenCalledWith(
      principal,
      hotel.id,
      expect.objectContaining({
        relationshipType: "STAFF",
        page: 1,
        pageSize: 20,
      }),
    );
    const ownerResponse = await app.request(
      `/api/hotels/${hotel.id}/eligible-candidates?relationshipType=OWNER`,
      { headers: { cookie: "__Host-hotel_session=opaque-session-token" } },
    );
    expect(ownerResponse.status).toBe(200);
    expect(listEligibleCandidates).toHaveBeenLastCalledWith(
      principal,
      hotel.id,
      expect.not.objectContaining({ startDate: expect.anything() }),
    );
    const invalid = await app.request(
      `/api/hotels/${hotel.id}/eligible-candidates?relationshipType=OWNER&assignmentType=PRIMARY&startDate=2026-07-24`,
      { headers: { cookie: "__Host-hotel_session=opaque-session-token" } },
    );
    expect(invalid.status).toBe(400);
  });

  it("safe-fails activation with every unavailable readiness item and no success", async () => {
    const response = await createApp({
      authService: authService(),
      hotelService: hotelService(),
    }).request(`/api/hotels/${hotel.id}/activate`, {
      method: "POST",
      headers: {
        cookie: "__Host-hotel_session=opaque-session-token",
        "content-type": "application/json",
        "idempotency-key": "activate-safe-failure",
      },
      body: JSON.stringify({ version: 1 }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: {
        code: "HOTEL_ACTIVATION_READINESS_REQUIRED",
        fieldErrors: expect.arrayContaining([
          { field: "ROOM", message: expect.any(String) },
          { field: "CHECKLIST", message: expect.any(String) },
          { field: "SCHEDULE", message: expect.any(String) },
          { field: "CONTACT", message: expect.any(String) },
        ]),
      },
    });
  });

  it("creates and returns a persisted hotel assignment", async () => {
    const service = hotelService({
      createAssignment: vi.fn(async () => ({
        status: "CREATED" as const,
        assignment,
      })),
    });
    const body = {
      userId: assignment.userId,
      relationshipType: "STAFF" as const,
      assignmentType: "PRIMARY" as const,
      startDate: assignment.startDate,
      reason: assignment.reason,
      hotelVersion: 1,
    };
    const response = await createApp({
      authService: authService(),
      hotelService: service,
    }).request(`/api/hotels/${hotel.id}/assignments`, {
      method: "POST",
      headers: {
        cookie: "__Host-hotel_session=opaque-session-token",
        "content-type": "application/json",
        "idempotency-key": "assignment-create",
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { assignment: { id: assignment.id } },
    });
    expect(service.createAssignment).toHaveBeenCalledWith(
      principal,
      hotel.id,
      body,
      "assignment-create",
    );
  });

  it("maps a database relationship overlap to stable 409", async () => {
    const response = await createApp({
      authService: authService(),
      hotelService: hotelService({
        createAssignment: vi.fn(async () => ({
          status: "RELATIONSHIP_CONFLICT" as const,
        })),
      }),
    }).request(`/api/hotels/${hotel.id}/assignments`, {
      method: "POST",
      headers: {
        cookie: "__Host-hotel_session=opaque-session-token",
        "content-type": "application/json",
        "idempotency-key": "assignment-conflict",
      },
      body: JSON.stringify({
        userId: assignment.userId,
        relationshipType: "STAFF",
        assignmentType: "PRIMARY",
        startDate: assignment.startDate,
        reason: assignment.reason,
        hotelVersion: 1,
      }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "HOTEL_RELATIONSHIP_CONFLICT" },
    });
  });

  it("blocks normal assignment end until dependent work reassignment exists", async () => {
    const response = await createApp({
      authService: authService(),
      hotelService: hotelService({
        endAssignment: vi.fn(async () => ({
          status: "DEPENDENT_WORK_REASSIGNMENT_REQUIRED" as const,
        })),
      }),
    }).request(`/api/hotels/${hotel.id}/assignments/${assignment.id}/end`, {
      method: "POST",
      headers: {
        cookie: "__Host-hotel_session=opaque-session-token",
        "content-type": "application/json",
        "idempotency-key": "assignment-normal-end",
      },
      body: JSON.stringify({
        version: 1,
        reason: "정상 종료",
        emergency: false,
      }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "DEPENDENT_WORK_REASSIGNMENT_REQUIRED" },
    });
  });

  it("requires recent authentication for owner transfer", async () => {
    const response = await createApp({
      authService: authService(),
      hotelService: hotelService({
        transferOwner: vi.fn(async () => ({
          status: "REAUTHENTICATION_REQUIRED" as const,
        })),
      }),
    }).request(`/api/hotels/${hotel.id}/owner-transfer`, {
      method: "POST",
      headers: {
        cookie: "__Host-hotel_session=opaque-session-token",
        "content-type": "application/json",
        "idempotency-key": "owner-transfer-reauth",
      },
      body: JSON.stringify({
        newOwnerUserId: "20000000-0000-4000-8000-000000000003",
        version: 1,
        reason: "소유주 변경",
      }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "REAUTHENTICATION_REQUIRED" },
    });
  });

  it("requires an active opaque session", async () => {
    const response = await createApp({
      authService: authService(false),
      hotelService: hotelService(),
    }).request("/api/hotels", {
      headers: { cookie: "__Host-hotel_session=opaque-session-token" },
    });
    expect(response.status).toBe(401);
  });

  it("lists only service-authorized hotels for the server principal", async () => {
    const service = hotelService();
    const response = await createApp({
      authService: authService(),
      hotelService: service,
    }).request("/api/hotels", {
      headers: { cookie: "__Host-hotel_session=opaque-session-token" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { capabilities: { canCreate: true }, hotels: [{ id: hotel.id }] },
    });
    expect(service.listHotels).toHaveBeenCalledWith(principal, {
      page: 1,
      pageSize: 20,
    });
  });

  it("returns 403 instead of disguising missing HOTEL_MANAGE as an empty list", async () => {
    const response = await createApp({
      authService: authService(),
      hotelService: hotelService({
        listHotels: vi.fn(async () => ({ status: "FORBIDDEN" as const })),
      }),
    }).request("/api/hotels", {
      headers: { cookie: "__Host-hotel_session=opaque-session-token" },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("requires Idempotency-Key for hotel creation", async () => {
    const response = await createApp({
      authService: authService(),
      hotelService: hotelService(),
    }).request("/api/hotels", {
      method: "POST",
      headers: {
        cookie: "__Host-hotel_session=opaque-session-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(createBody),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("creates a PREPARING hotel and returns persisted basic information", async () => {
    const service = hotelService();
    const response = await createApp({
      authService: authService(),
      hotelService: service,
    }).request("/api/hotels", {
      method: "POST",
      headers: {
        cookie: "__Host-hotel_session=opaque-session-token",
        "content-type": "application/json",
        "idempotency-key": "hotel-create-1",
      },
      body: JSON.stringify(createBody),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { hotel: { status: "PREPARING", version: 1 } },
    });
    expect(service.createHotel).toHaveBeenCalledWith(
      principal,
      createBody,
      "hotel-create-1",
    );
  });

  it("rejects an invalid contract period with field errors", async () => {
    const response = await createApp({
      authService: authService(),
      hotelService: hotelService(),
    }).request("/api/hotels", {
      method: "POST",
      headers: {
        cookie: "__Host-hotel_session=opaque-session-token",
        "content-type": "application/json",
        "idempotency-key": "hotel-create-invalid",
      },
      body: JSON.stringify({ ...createBody, contractEndDate: "2026-06-30" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: [{ field: "contractEndDate" }],
      },
    });
  });

  it("returns 404 for an inaccessible hotel without revealing tenant existence", async () => {
    const response = await createApp({
      authService: authService(),
      hotelService: hotelService({ getHotel: vi.fn(async () => null) }),
    }).request(`/api/hotels/${hotel.id}`, {
      headers: { cookie: "__Host-hotel_session=opaque-session-token" },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "RESOURCE_NOT_FOUND" },
    });
  });
});
