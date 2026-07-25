import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "" }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../lib/api-transport", () => ({ fetchApi }));

import { fetchRoomInitialData } from "../lib/server-rooms";

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
});
