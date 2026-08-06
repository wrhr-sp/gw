import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "" }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../lib/api-transport", () => ({ fetchApi }));

import {
  fetchAllRoomInspectionData,
  fetchRoomInitialData,
} from "../lib/server-rooms";

const hotelId = "50000000-0000-4000-8000-000000000001";

describe("room SSR initial fetch", () => {
  beforeEach(() => {
    fetchApi.mockReset();
    fetchApi.mockImplementation(async (path: string) =>
      path.endsWith("/room-types")
        ? Response.json({ ok: true, data: { roomTypes: [] }, error: null })
        : Response.json({
            ok: true,
            data: {
              capabilities: { canManage: true, canManageTypes: true },
              rooms: [],
              pagination: {
                page: 1,
                pageSize: 20,
                total: 101,
                totalPages: 6,
              },
            },
            error: null,
          }),
    );
  });

  it("uses the same 20-row page contract as client pagination", async () => {
    const result = await fetchRoomInitialData(hotelId);

    expect(result).toMatchObject({
      ok: true,
      data: { pagination: { page: 1, pageSize: 20, totalPages: 6 } },
    });
    expect(fetchApi).toHaveBeenCalledWith(
      `/api/hotels/${hotelId}/rooms?page=1&pageSize=20`,
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(
      fetchApi.mock.calls.some(([path]) =>
        String(path).includes("pageSize=100"),
      ),
    ).toBe(false);
  });

  it("loads every room page for inspection selectors", async () => {
    const rooms = Array.from({ length: 101 }, (_, index) => ({
      id: `52000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      hotelId,
      roomNumber: String(index + 1),
      floorLabel: "1층",
      floorSortKey: 1,
      roomType: {
        id: "51000000-0000-4000-8000-000000000001",
        name: "스탠다드",
        scope: "COMPANY",
      },
      status: "ACTIVE",
      ownerVisibleNote: null,
      internalNote: null,
      version: 1,
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    }));
    fetchApi.mockImplementation(async (path: string) => {
      if (path.endsWith("/room-types"))
        return Response.json({ ok: true, data: { roomTypes: [] }, error: null });
      const page = path.includes("page=2") ? 2 : 1;
      return Response.json({
        ok: true,
        data: {
          capabilities: { canManage: true, canManageTypes: true },
          rooms: page === 1 ? rooms.slice(0, 100) : rooms.slice(100),
          pagination: { page, pageSize: 100, total: 101, totalPages: 2 },
        },
        error: null,
      });
    });
    const result = await fetchAllRoomInspectionData(hotelId);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("room pagination failed");
    expect(result.data.rooms).toHaveLength(101);
    expect(result.data.rooms[100]?.roomNumber).toBe("101");
    expect(fetchApi).toHaveBeenCalledWith(
      `/api/hotels/${hotelId}/rooms?page=2&pageSize=100`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
