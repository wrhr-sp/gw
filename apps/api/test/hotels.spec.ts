import type { AuthenticatedPrincipal, HotelBasicInformation } from "@werehere/contracts";
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

function authService(active = true): AuthService {
  return {
    beginLogin: vi.fn(),
    completeLogin: vi.fn(),
    finalizeCustomLogin: vi.fn(),
    logout: vi.fn(async () => true),
    prepareCustomLogin: vi.fn(),
    resolvePrincipal: vi.fn(async () => active ? principal : null),
  } as AuthService;
}

function hotelService(overrides: Partial<HotelService> = {}): HotelService {
  return {
    createHotel: vi.fn(async () => ({ status: "CREATED" as const, hotel })),
    getHotel: vi.fn(async () => hotel),
    listHotels: vi.fn(async () => ({
      status: "OK" as const,
      capabilities: { canCreate: true },
      hotels: [hotel],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })),
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
  it("requires an active opaque session", async () => {
    const response = await createApp({ authService: authService(false), hotelService: hotelService() })
      .request("/api/hotels", { headers: { cookie: "__Host-hotel_session=opaque-session-token" } });
    expect(response.status).toBe(401);
  });

  it("lists only service-authorized hotels for the server principal", async () => {
    const service = hotelService();
    const response = await createApp({ authService: authService(), hotelService: service })
      .request("/api/hotels", { headers: { cookie: "__Host-hotel_session=opaque-session-token" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { capabilities: { canCreate: true }, hotels: [{ id: hotel.id }] },
    });
    expect(service.listHotels).toHaveBeenCalledWith(principal, { page: 1, pageSize: 20 });
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
    expect(await response.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("requires Idempotency-Key for hotel creation", async () => {
    const response = await createApp({ authService: authService(), hotelService: hotelService() })
      .request("/api/hotels", {
        method: "POST",
        headers: { cookie: "__Host-hotel_session=opaque-session-token", "content-type": "application/json" },
        body: JSON.stringify(createBody),
      });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("creates a PREPARING hotel and returns persisted basic information", async () => {
    const service = hotelService();
    const response = await createApp({ authService: authService(), hotelService: service })
      .request("/api/hotels", {
        method: "POST",
        headers: {
          cookie: "__Host-hotel_session=opaque-session-token",
          "content-type": "application/json",
          "idempotency-key": "hotel-create-1",
        },
        body: JSON.stringify(createBody),
      });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { hotel: { status: "PREPARING", version: 1 } } });
    expect(service.createHotel).toHaveBeenCalledWith(principal, createBody, "hotel-create-1");
  });

  it("rejects an invalid contract period with field errors", async () => {
    const response = await createApp({ authService: authService(), hotelService: hotelService() })
      .request("/api/hotels", {
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
      error: { code: "VALIDATION_ERROR", fieldErrors: [{ field: "contractEndDate" }] },
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
    expect(await response.json()).toMatchObject({ error: { code: "RESOURCE_NOT_FOUND" } });
  });

});
