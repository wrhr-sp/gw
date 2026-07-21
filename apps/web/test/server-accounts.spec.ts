import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "session=test" }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../lib/api-transport", () => ({ fetchApi: mocks.fetchApi }));

import { fetchAccountCapabilitiesResult, fetchEligibleHotels } from "../lib/server-accounts";

describe("server account capabilities", () => {
  beforeEach(() => {
    mocks.fetchApi.mockReset();
    mocks.redirect.mockReset();
  });

  it("returns a typed failure for provider 503 instead of empty permissions", async () => {
    mocks.fetchApi.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(fetchAccountCapabilitiesResult()).resolves.toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "사용자 계정 정보를 불러올 수 없습니다.",
        status: 503,
      },
    });
  });

  it("returns a typed 502 failure for malformed success JSON", async () => {
    mocks.fetchApi.mockResolvedValue(Response.json({ permissions: "invalid" }));
    await expect(fetchAccountCapabilitiesResult()).resolves.toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "사용자 계정 권한 응답이 올바르지 않습니다.",
        status: 502,
      },
    });
  });

  it("keeps a valid empty capability set as a successful result", async () => {
    mocks.fetchApi.mockResolvedValue(Response.json({ data: { permissions: [] } }));
    await expect(fetchAccountCapabilitiesResult()).resolves.toEqual({ ok: true, permissions: [] });
  });
});

describe("server eligible hotels", () => {
  beforeEach(() => {
    mocks.fetchApi.mockReset();
    mocks.redirect.mockReset();
  });

  it("returns the complete typed selector payload", async () => {
    const hotels = [
      { id: "50000000-0000-4000-8000-000000000001", name: "위아히어 강남호텔" },
      { id: "50000000-0000-4000-8000-000000000002", name: "위아히어 부산호텔" },
    ];
    mocks.fetchApi.mockResolvedValue(Response.json({ ok: true, data: { hotels }, error: null }));
    await expect(fetchEligibleHotels()).resolves.toEqual({ ok: true, hotels });
    expect(mocks.fetchApi).toHaveBeenCalledWith(
      "/api/admin/users/eligible-hotels",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("preserves a valid empty selector and rejects malformed success JSON", async () => {
    mocks.fetchApi.mockResolvedValueOnce(Response.json({ ok: true, data: { hotels: [] }, error: null }));
    await expect(fetchEligibleHotels()).resolves.toEqual({ ok: true, hotels: [] });

    mocks.fetchApi.mockResolvedValueOnce(Response.json({ ok: true, data: { hotels: [{ id: "bad" }] }, error: null }));
    await expect(fetchEligibleHotels()).resolves.toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "배정 가능한 호텔 응답이 올바르지 않습니다.",
        status: 502,
      },
    });
  });
});
