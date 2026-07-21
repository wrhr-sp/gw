import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capabilities: vi.fn(),
  detail: vi.fn(),
  hotelList: vi.fn(),
  list: vi.fn(),
  notFound: vi.fn(),
  principal: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  usePathname: () => "/admin/users",
}));
vi.mock("../lib/server-auth", () => ({ requireAuthenticatedPrincipal: mocks.principal }));
vi.mock("../lib/server-accounts", () => ({
  fetchAccountCapabilitiesResult: mocks.capabilities,
  fetchAccountDetail: mocks.detail,
  fetchAccountList: mocks.list,
}));
vi.mock("../lib/server-hotels", () => ({ fetchHotelList: mocks.hotelList }));

import AdminUserDetailPage from "../app/admin/users/[userId]/page";
import NewAdminUserPage from "../app/admin/users/new/page";
import AdminUsersPage from "../app/admin/users/page";

const principal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  identityId: "20000000-0000-4000-8000-000000000001",
  sessionId: "30000000-0000-4000-8000-000000000001",
  userId: "40000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF" as const,
  displayName: "호텔 관리자",
};
const capabilityFailure = {
  ok: false as const,
  error: { code: "INTERNAL_ERROR" as const, message: "일시적인 서비스 오류입니다.", status: 503 },
};

describe("account administration server pages", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.principal.mockResolvedValue(principal);
  });

  it("renders retryable capability failures on list, create, and detail pages", async () => {
    mocks.capabilities.mockResolvedValue(capabilityFailure);
    const list = renderToStaticMarkup(await AdminUsersPage({ searchParams: Promise.resolve({}) }));
    const create = renderToStaticMarkup(await NewAdminUserPage());
    const detail = renderToStaticMarkup(await AdminUserDetailPage({
      params: Promise.resolve({ userId: "21000000-0000-4000-8000-000000000001" }),
    }));
    for (const html of [list, create, detail]) {
      expect(html).toContain("사용자 계정 권한 정보를 확인하지 못했습니다");
      expect(html).toContain("다시 시도");
    }
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("keeps actual missing permissions on the not-found path", async () => {
    mocks.capabilities.mockResolvedValue({ ok: true, permissions: [] });
    mocks.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
    await expect(AdminUsersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  });

  it("redirects an out-of-range page while preserving active filters", async () => {
    mocks.capabilities.mockResolvedValue({ ok: true, permissions: ["USER_READ"] });
    mocks.list.mockResolvedValue({
      ok: true,
      accounts: [],
      pagination: { page: 3, pageSize: 20, total: 41, totalPages: 3 },
    });
    mocks.redirect.mockImplementation(() => { throw new Error("REDIRECT"); });
    await expect(AdminUsersPage({ searchParams: Promise.resolve({
      page: "99",
      q: "김",
      status: "ACTIVE",
      userType: "HOUSEKEEPING",
    }) })).rejects.toThrow("REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/users?page=3&q=%EA%B9%80&status=ACTIVE&userType=HOUSEKEEPING",
    );
  });
});
