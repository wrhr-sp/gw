import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CalendarWorkspace, sameInstant, seoulLocalDateTimeToInstant } from "../components/calendar/calendar-workspace";
import { calendarNavigationHref } from "../components/hotels/hotel-shell";

const hotelId = "50000000-0000-4000-8000-000000000001";
const data = {
  capabilities: { canCreateVisit: true, canViewAllHotels: false },
  events: [
    {
      businessDate: "2026-08-07",
      detailHref: `/hotels/${hotelId}/inspections`,
      endsAt: null,
      hotelId,
      hotelName: "서울호텔",
      id: "60000000-0000-4000-8000-000000000001",
      startsAt: "2026-08-07T09:00:00.000Z",
      status: "PENDING_INPUT" as const,
      targetSummary: "객실 2곳",
      title: "점검 마감",
      type: "INSPECTION" as const,
    },
    {
      calendarProjectionStatus: "NOT_CONNECTED" as const,
      cancellationReason: null,
      canUpdate: true,
      detailHref: `/hotels/${hotelId}/repairs`,
      endsAt: "2026-08-07T11:00:00.000Z",
      hotelId,
      hotelName: "서울호텔",
      id: "a2000000-0000-4000-8000-000000000001",
      priority: { color: "#dc2626", name: "긴급" },
      startsAt: "2026-08-07T10:00:00.000Z",
      status: "SCHEDULED" as const,
      targetSummary: "703호",
      title: "배관 점검",
      type: "REPAIR_VISIT" as const,
    },
  ],
  hotels: [{ id: hotelId, name: "서울호텔" }],
  pagination: { nextCursor: null },
  range: { from: "2026-08-01", timeZone: "Asia/Seoul" as const, to: "2026-09-12" },
};

describe("Calendar workspace", () => {
  it("routes all-hotel and branch-scoped users only to an authorized Calendar path", () => {
    expect(calendarNavigationHref(true, [{ id: hotelId }])).toBe("/hotels/calendar");
    expect(calendarNavigationHref(false, [{ id: hotelId }])).toBe(`/hotels/${hotelId}/calendar`);
    expect(calendarNavigationHref(false, [])).toBeUndefined();
  });

  it("interprets visit datetime-local input as the canonical Seoul timezone", () => {
    expect(seoulLocalDateTimeToInstant("2026-08-07T19:30")).toBe("2026-08-07T10:30:00Z");
    expect(sameInstant("2026-08-07T10:30:00Z", "2026-08-07T10:30:00.000Z")).toBe(true);
  });

  it("renders product controls and mobile field cards without Google identifiers", () => {
    const html = renderToStaticMarkup(
      <CalendarWorkspace initialData={data} initialScope={{ hotelId, mode: "HOTEL" }} />,
    );
    expect(html).toContain("업무 달력");
    expect(html).toContain("월간");
    expect(html).toContain("주간");
    expect(html).toContain("점검 마감");
    expect(html).toContain("배관 점검");
    expect(html).toContain("Google 미연결");
    expect(html).not.toContain("providerEventId");
    expect(html).not.toContain("calendarId");
  });
});
