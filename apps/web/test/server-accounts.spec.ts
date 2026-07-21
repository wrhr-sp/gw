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

import { fetchAccountCapabilitiesResult } from "../lib/server-accounts";

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
