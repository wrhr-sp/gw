import { beforeEach, describe, expect, it, vi } from "vitest";
const { fetchApi, redirect } = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "__Host-hotel_session=opaque" }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("../lib/api-transport", () => ({ fetchApi }));
import {
  fetchAllFacilityInspectionData,
  fetchFacilityInitialData,
} from "../lib/server-facilities";
const hotelId = "50000000-0000-4000-8000-000000000001";
const valid = {
  ok: true,
  data: {
    capabilities: { canManage: true },
    commonAreas: [],
    facilityTypes: [],
    facilities: [],
    roomLocations: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  },
  error: null,
};
describe("facility SSR initial fetch", () => {
  beforeEach(() => {
    fetchApi.mockReset();
    redirect.mockReset();
  });
  it("uses the canonical no-store workspace route", async () => {
    fetchApi.mockResolvedValue(Response.json(valid));
    const result = await fetchFacilityInitialData(hotelId);
    expect(result).toMatchObject({
      ok: true,
      data: { capabilities: { canManage: true } },
    });
    expect(fetchApi).toHaveBeenCalledWith(
      `/api/hotels/${hotelId}/facility-master-data?page=1&pageSize=20`,
      expect.objectContaining({
        cache: "no-store",
        headers: expect.any(Headers),
      }),
    );
  });
  it("loads every facility page for inspection selectors", async () => {
    const facilityType = {
      id: "53000000-0000-4000-8000-000000000001",
      hotelId,
      name: "보일러",
      status: "ACTIVE",
      version: 1,
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    };
    const facilities = Array.from({ length: 101 }, (_, index) => ({
      id: `54000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      hotelId,
      name: `시설물 ${index + 1}`,
      status: "ACTIVE",
      version: 1,
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
      facilityType: {
        id: facilityType.id,
        name: facilityType.name,
        status: facilityType.status,
      },
      location: {
        type: "COMMON_AREA",
        commonAreaId: "55000000-0000-4000-8000-000000000001",
        name: "기계실",
      },
    }));
    fetchApi.mockImplementation(async (path: string) => {
      const page = path.includes("page=2") ? 2 : 1;
      return Response.json({
        ok: true,
        data: {
          ...valid.data,
          facilityTypes: [facilityType],
          facilities: page === 1 ? facilities.slice(0, 100) : facilities.slice(100),
          pagination: { page, pageSize: 100, total: 101, totalPages: 2 },
        },
        error: null,
      });
    });
    const result = await fetchAllFacilityInspectionData(hotelId);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("facility pagination failed");
    expect(result.data.facilities).toHaveLength(101);
    expect(result.data.facilities[100]?.name).toBe("시설물 101");
    expect(fetchApi).toHaveBeenCalledWith(
      `/api/hotels/${hotelId}/facility-master-data?page=2&pageSize=100`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("rejects malformed success payloads", async () => {
    fetchApi.mockResolvedValue(
      Response.json({ ok: true, data: { facilities: [] }, error: null }),
    );
    await expect(fetchFacilityInitialData(hotelId)).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", status: 502 },
    });
  });
  it("preserves stable API failures", async () => {
    fetchApi.mockResolvedValue(
      Response.json(
        {
          ok: false,
          data: null,
          error: {
            code: "FORBIDDEN",
            message: "권한이 없습니다.",
            fieldErrors: [],
            retryable: false,
            retryAfterSeconds: null,
            traceId: "70000000-0000-4000-8000-000000000001",
          },
        },
        { status: 403 },
      ),
    );
    await expect(fetchFacilityInitialData(hotelId)).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN", status: 403 },
    });
  });
  it("redirects unauthenticated SSR requests", async () => {
    fetchApi.mockResolvedValue(new Response(null, { status: 401 }));
    await fetchFacilityInitialData(hotelId);
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
