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

  it("authenticates before starting shared capability fan-out", async () => {
    let resolvePrincipal!: (value: { displayName: string }) => void;
    layoutLoaders.principal.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePrincipal = resolve;
      }),
    );
    layoutLoaders.account.mockResolvedValue({});
    layoutLoaders.calendar.mockResolvedValue({
      canViewAllHotels: false,
      hotels: [],
    });
    layoutLoaders.dailySales.mockResolvedValue({});
    layoutLoaders.issues.mockResolvedValue({});
    layoutLoaders.inquiries.mockResolvedValue({});

    const pending = HotelsLayout({ children: <div>업무</div> });
    await Promise.resolve();
    for (const loader of [
      layoutLoaders.account,
      layoutLoaders.calendar,
      layoutLoaders.dailySales,
      layoutLoaders.issues,
      layoutLoaders.inquiries,
    ]) {
      expect(loader).not.toHaveBeenCalled();
    }

    resolvePrincipal({ displayName: "관리자" });
    await pending;
    for (const loader of [
      layoutLoaders.account,
      layoutLoaders.calendar,
      layoutLoaders.dailySales,
      layoutLoaders.issues,
      layoutLoaders.inquiries,
    ]) {
      expect(loader).toHaveBeenCalledOnce();
    }
  });
});
