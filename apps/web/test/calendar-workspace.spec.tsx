import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CalendarWorkspace, calendarProjectionLabel, sameInstant, seoulLocalDateTimeToInstant } from "../components/calendar/calendar-workspace";
import { calendarNavigationHref, HotelShell } from "../components/hotels/hotel-shell";

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

  it("shows Calendar connection navigation only to a confirmed manager",()=>{
    const principal={companyId:"10000000-0000-4000-8000-000000000001",identityId:"20000000-0000-4000-8000-000000000001",sessionId:"30000000-0000-4000-8000-000000000001",userId:"40000000-0000-4000-8000-000000000001",userType:"INTERNAL_STAFF" as const,displayName:"관리자"};
    const allowed=renderToStaticMarkup(<HotelShell canManageCalendarConnection currentPath="/hotels" principal={principal}><div/></HotelShell>);
    const denied=renderToStaticMarkup(<HotelShell currentPath="/hotels" principal={principal}><div/></HotelShell>);
    expect(allowed).toContain('href="/admin/calendar"');expect(allowed).toContain("Calendar 연결");expect(denied).not.toContain('href="/admin/calendar"');
  });

  it("interprets visit datetime-local input as the canonical Seoul timezone", () => {
    expect(seoulLocalDateTimeToInstant("2026-08-07T19:30")).toBe("2026-08-07T10:30:00Z");
    expect(sameInstant("2026-08-07T10:30:00Z", "2026-08-07T10:30:00.000Z")).toBe(true);
  });

  it("maps every canonical Google projection state to a user-facing label", () => {
    expect(calendarProjectionLabel("NOT_CONNECTED")).toBe("Google 미연결");
    expect(calendarProjectionLabel("PENDING")).toBe("Google 반영 대기");
    expect(calendarProjectionLabel("SYNCED")).toBe("Google 반영 완료");
    expect(calendarProjectionLabel("ACTION_REQUIRED")).toBe("Google 확인 필요");
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
