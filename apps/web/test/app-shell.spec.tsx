import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Building2, Home } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "../components/shell/app-shell";

const layoutLoaders = vi.hoisted(() => ({
  principal: vi.fn(),
  account: vi.fn(),
  calendar: vi.fn(),
  dailySales: vi.fn(),
  issues: vi.fn(),
  inquiries: vi.fn(),
}));
vi.mock("../lib/server-auth", () => ({
  requireAuthenticatedPrincipal: layoutLoaders.principal,
}));
vi.mock("../lib/server-accounts", () => ({
  fetchAccountCapabilities: layoutLoaders.account,
}));
vi.mock("../lib/server-calendar", () => ({
  fetchCalendarCapabilities: layoutLoaders.calendar,
}));
vi.mock("../lib/server-daily-sales", () => ({
  fetchDailySalesCapabilities: layoutLoaders.dailySales,
}));
vi.mock("../lib/server-issues", () => ({
  fetchOperationalIssueCapabilities: layoutLoaders.issues,
}));
vi.mock("../lib/server-inquiries", () => ({
  fetchInquiryCapabilities: layoutLoaders.inquiries,
}));
vi.mock("../components/hotels/hotel-shell", () => ({
  calendarNavigationHref: () => null,
  HotelShell: () => null,
}));

import HotelsLayout from "../app/hotels/layout";

vi.stubGlobal("React", React);

describe("hotel operations app shell", () => {
  it("renders desktop and mobile navigation from explicit authorized items", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <AppShell
        currentPath="/hotels"
        hotelName="서울호텔"
        navigation={[
          { href: "/hotel-operations", label: "운영 홈", icon: <Home aria-hidden="true" /> },
          { href: "/hotels", label: "호텔", icon: <Building2 aria-hidden="true" /> },
        ]}
        userDisplayName="관리자"
      >
        <div>업무 내용</div>
        </AppShell>
      </QueryClientProvider>,
    );
    expect(html).toContain("서울호텔");
    expect(html).toContain("관리자");
    expect(html).toContain("aria-label=\"호텔 운영 주 메뉴\"");
    expect(html).toContain("aria-label=\"모바일 호텔 운영 메뉴\"");
    expect(html).toContain("aria-current=\"page\"");
    expect(html).toContain("href=\"#main-content\"");
    expect(html).toContain("id=\"main-content\"");
    expect(html).toContain("업무 내용");
  });

  it("serializes shared capability reads after authentication", async () => {
    const deferred = <T,>() => {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    };
    const principal = deferred<{ displayName: string }>();
    const account = deferred<Record<string, never>>();
    const calendar = deferred<{
      canViewAllHotels: boolean;
      hotels: never[];
    }>();
    const dailySales = deferred<Record<string, never>>();
    const issues = deferred<Record<string, never>>();
    const inquiries = deferred<Record<string, never>>();
    for (const loader of Object.values(layoutLoaders)) loader.mockReset();
    layoutLoaders.principal.mockReturnValueOnce(principal.promise);
    layoutLoaders.account.mockReturnValueOnce(account.promise);
    layoutLoaders.calendar.mockReturnValueOnce(calendar.promise);
    layoutLoaders.dailySales.mockReturnValueOnce(dailySales.promise);
    layoutLoaders.issues.mockReturnValueOnce(issues.promise);
    layoutLoaders.inquiries.mockReturnValueOnce(inquiries.promise);

    const pending = HotelsLayout({ children: <div>업무</div> });
    await Promise.resolve();
    expect(layoutLoaders.principal).toHaveBeenCalledOnce();
    expect(layoutLoaders.account).not.toHaveBeenCalled();

    principal.resolve({ displayName: "관리자" });
    await vi.waitFor(() => expect(layoutLoaders.account).toHaveBeenCalledOnce());
    expect(layoutLoaders.calendar).not.toHaveBeenCalled();
    account.resolve({});
    await vi.waitFor(() => expect(layoutLoaders.calendar).toHaveBeenCalledOnce());
    expect(layoutLoaders.dailySales).not.toHaveBeenCalled();
    calendar.resolve({ canViewAllHotels: false, hotels: [] });
    await vi.waitFor(() =>
      expect(layoutLoaders.dailySales).toHaveBeenCalledOnce(),
    );
    expect(layoutLoaders.issues).not.toHaveBeenCalled();
    dailySales.resolve({});
    await vi.waitFor(() => expect(layoutLoaders.issues).toHaveBeenCalledOnce());
    expect(layoutLoaders.inquiries).not.toHaveBeenCalled();
    issues.resolve({});
    await vi.waitFor(() => expect(layoutLoaders.inquiries).toHaveBeenCalledOnce());
    inquiries.resolve({});
    await pending;
  });
});
