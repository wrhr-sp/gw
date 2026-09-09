import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loaders = vi.hoisted(() => ({
  authenticate: vi.fn(),
  accounts: vi.fn(),
  calendar: vi.fn(),
}));
vi.mock("../lib/server-auth", () => ({ requireAuthenticatedPrincipal: loaders.authenticate }));
vi.mock("../lib/server-accounts", () => ({ fetchAccountCapabilities: loaders.accounts }));
vi.mock("../lib/server-calendar", () => ({ fetchCalendarCapabilities: loaders.calendar }));
vi.mock("../components/hotels/hotel-shell", () => ({
  HotelShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  calendarNavigationHref: () => { throw new Error("SERVER_CALLED_CLIENT_EXPORT"); },
}));
import HotelOperationsPage from "../app/hotel-operations/page";

describe("hotel operations entry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loaders.authenticate.mockResolvedValue({});
    loaders.accounts.mockResolvedValue([]);
    loaders.calendar.mockResolvedValue({ canViewAllHotels: false, hotels: [] });
  });

  it("renders the real hotel-list entry with the shared operational guide and no stale implementation copy", async () => {
    const html = renderToStaticMarkup(await HotelOperationsPage());
    expect(html).toContain('href="/hotels"');
    expect(html).toContain("호텔 목록 열기");
    expect(html).toContain('aria-label="호텔 운영 도움말"');
    expect(html).not.toMatch(/후속 기능|PostgreSQL|승인된 후속/);
  });

  it("does not start capability reads while authentication is unresolved", async () => {
    let resolve!: (value: object) => void;
    loaders.authenticate.mockImplementation(() => new Promise<object>((done) => { resolve = done; }));
    const pending = HotelOperationsPage();
    try {
      expect(loaders.accounts).not.toHaveBeenCalled();
      expect(loaders.calendar).not.toHaveBeenCalled();
    } finally {
      resolve({});
      await pending;
    }
    expect(loaders.accounts).toHaveBeenCalledOnce();
    expect(loaders.calendar).toHaveBeenCalledOnce();
  });

  it("does not start capability reads after authentication rejection", async () => {
    const rejection = new Error("AUTHENTICATION_REQUIRED");
    loaders.authenticate.mockRejectedValue(rejection);
    await expect(HotelOperationsPage()).rejects.toBe(rejection);
    expect(loaders.accounts).not.toHaveBeenCalled();
    expect(loaders.calendar).not.toHaveBeenCalled();
  });
});
