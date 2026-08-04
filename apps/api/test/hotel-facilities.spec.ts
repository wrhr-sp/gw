import type {
  AuthenticatedPrincipal,
  HotelCommonArea,
  HotelFacility,
  HotelFacilityType,
} from "@werehere/contracts";
import { describe, expect, it, vi } from "vitest";
import type { FacilityRepository } from "@werehere/db";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import {
  createFacilityService,
  type FacilityService,
} from "../src/facilities/service";

const hotelId = "50000000-0000-4000-8000-000000000001";
const resourceId = "54000000-0000-4000-8000-000000000001";
const now = "2026-08-04T00:00:00.000Z";
const principal: AuthenticatedPrincipal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF",
  displayName: "시설 관리자",
};
const commonArea: HotelCommonArea = {
  id: resourceId,
  hotelId,
  name: "로비",
  status: "ACTIVE",
  version: 1,
  createdAt: now,
  updatedAt: now,
};
const facilityType: HotelFacilityType = {
  ...commonArea,
  id: "55000000-0000-4000-8000-000000000001",
  name: "소방설비",
};
const facility: HotelFacility = {
  ...commonArea,
  id: "56000000-0000-4000-8000-000000000001",
  name: "소화기",
  facilityType: {
    id: facilityType.id,
    name: facilityType.name,
    status: "ACTIVE",
  },
  location: {
    type: "COMMON_AREA",
    commonAreaId: commonArea.id,
    name: commonArea.name,
  },
};
const headers = {
  cookie: "__Host-hotel_session=opaque-session-token",
  "content-type": "application/json",
  "idempotency-key": "facility-test-key",
};
function auth(active = true): AuthService {
  return {
    beginCustomLogin: vi.fn(),
    beginLogin: vi.fn(),
    completeLogin: vi.fn(),
    finalizeCustomLogin: vi.fn(),
    logout: vi.fn(),
    prepareCustomLogin: vi.fn(),
    resolvePrincipal: vi.fn(async () => (active ? principal : null)),
  } as AuthService;
}
function service(overrides: Partial<FacilityService> = {}): FacilityService {
  return {
    getResource: vi.fn(async () => ({ status: "OK", resource: facility })),
    getWorkspace: vi.fn(async () => ({
      status: "OK",
      capabilities: { canManage: true },
      commonAreas: [commonArea],
      facilityTypes: [facilityType],
      facilities: [facility],
      roomLocations: [
        { id: "52000000-0000-4000-8000-000000000001", name: "101" },
      ],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })),
    mutate: vi.fn(async () => ({ status: "CREATED", resource: commonArea })),
    ...overrides,
  } as FacilityService;
}
function app(facilityService = service(), active = true) {
  return createApp({ authService: auth(active), facilityService });
}

describe("hotel facility master-data API", () => {
  it("requires an active session", async () => {
    const response = await app(service(), false).request(
      `/api/hotels/${hotelId}/facility-master-data`,
    );
    expect(response.status).toBe(401);
  });
  it("returns the canonical workspace projection", async () => {
    const response = await app().request(
      `/api/hotels/${hotelId}/facility-master-data?page=1&pageSize=20`,
      { headers },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: {
        commonAreas: [{ name: "로비" }],
        facilityTypes: [{ name: "소방설비" }],
        facilities: [{ name: "소화기" }],
        pagination: { total: 1 },
      },
    });
  });
  it("binds mutation identity to method, path, body, and opaque bearer", async () => {
    const mutate = vi.fn(async () => ({
      status: "CREATED" as const,
      resource: commonArea,
    }));
    const repository = {
      close: vi.fn(),
      getWorkspace: vi.fn(),
      mutate,
    } as unknown as FacilityRepository;
    const api = createFacilityService(repository);
    await api.mutate(
      { ...principal, sessionToken: "opaque-session-token" },
      hotelId,
      "COMMON_AREA",
      "CREATE",
      null,
      { name: "로비" },
      "key",
    );
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "COMMON_AREA",
        action: "CREATE",
        httpMethod: "POST",
        operationPath: `/api/hotels/${hotelId}/common-areas`,
        sessionToken: "opaque-session-token",
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    );
  });
  it("rejects mixed typed locations before the service", async () => {
    const mutate = vi.fn();
    const response = await app(service({ mutate })).request(
      `/api/hotels/${hotelId}/facilities`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "소화기",
          facilityTypeId: facilityType.id,
          location: {
            type: "ROOM",
            roomId: "52000000-0000-4000-8000-000000000001",
            commonAreaId: commonArea.id,
          },
        }),
      },
    );
    expect(response.status).toBe(400);
    expect(mutate).not.toHaveBeenCalled();
  });
  it("returns a stable conflict when linked facilities block lifecycle", async () => {
    const response = await app(
      service({
        mutate: vi.fn(async () => ({
          status: "LINKED_ACTIVE_FACILITIES" as const,
        })),
      }),
    ).request(`/api/hotels/${hotelId}/common-areas/${resourceId}/status`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        status: "INACTIVE",
        reason: "운영 중지",
        version: 1,
      }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_STATE_TRANSITION" },
    });
  });
  it("returns a permission-checked canonical resource detail", async () => {
    const getResource = vi.fn(async () => ({
      status: "OK" as const,
      resource: facility,
    }));
    const response = await app(service({ getResource })).request(
      `/api/hotels/${hotelId}/facilities/${facility.id}`,
      { headers },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: {
        resource: {
          id: facility.id,
          name: "소화기",
          location: { type: "COMMON_AREA" },
        },
      },
    });
    expect(getResource).toHaveBeenCalledWith(
      principal,
      hotelId,
      "FACILITY",
      facility.id,
    );
  });
  it.each([
    ["common-areas", { name: "로비" }, "commonAreaName", "공용공간명"],
    [
      "facility-types",
      { name: "소방설비" },
      "facilityTypeName",
      "시설물유형명",
    ],
    [
      "facilities",
      {
        name: "소화기",
        facilityTypeId: facilityType.id,
        location: { type: "COMMON_AREA", commonAreaId: commonArea.id },
      },
      "facilityName",
      "시설물명",
    ],
  ] as const)(
    "maps %s duplicate errors to the entity field",
    async (route, body, field, message) => {
      const response = await app(
        service({
          mutate: vi.fn(async () => ({ status: "DUPLICATE" as const })),
        }),
      ).request(`/api/hotels/${hotelId}/${route}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
          message: expect.stringContaining(message),
          fieldErrors: [{ field }],
        },
      });
    },
  );
});
