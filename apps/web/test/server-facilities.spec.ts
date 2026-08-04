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
import { fetchFacilityInitialData } from "../lib/server-facilities";
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
