import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { CalendarWorkspace } from "../../components/calendar/calendar-workspace";

export const calendarHotelId = "50000000-0000-4000-8000-000000000001";
export const calendarStoryData = {
  capabilities: { canCreateVisit: true, canViewAllHotels: false },
  events: [
    { businessDate: "2026-08-07", detailHref: `/hotels/${calendarHotelId}/inspections`, endsAt: null, hotelId: calendarHotelId, hotelName: "서울호텔", id: "60000000-0000-4000-8000-000000000001", startsAt: "2026-08-07T09:00:00.000Z", status: "PENDING_INPUT" as const, targetSummary: "객실 2개 대상", title: "점검 마감", type: "INSPECTION" as const },
    { cancellationReason: null, canUpdate: true, detailHref: `/hotels/${calendarHotelId}/repairs`, endsAt: "2026-08-07T11:00:00.000Z", hotelId: calendarHotelId, hotelName: "서울호텔", id: "a2000000-0000-4000-8000-000000000001", priority: { color: "RED", name: "긴급" }, startsAt: "2026-08-07T10:00:00.000Z", status: "SCHEDULED" as const, targetSummary: "703호", title: "배관 점검", type: "REPAIR_VISIT" as const },
  ],
  hotels: [{ id: calendarHotelId, name: "서울호텔" }],
  pagination: { nextCursor: null },
  range: { from: "2026-08-02", timeZone: "Asia/Seoul" as const, to: "2026-08-09" },
};

export function CalendarWorkspaceStory() {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false, staleTime: Infinity } } }));
  return <QueryClientProvider client={client}><CalendarWorkspace initialData={calendarStoryData} initialScope={{ hotelId: calendarHotelId, mode: "HOTEL" }} /></QueryClientProvider>;
}
