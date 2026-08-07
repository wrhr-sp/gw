import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import { createCalendarService } from "../src/calendars/service";

const principal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  displayName: "김달력",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  sessionToken: "opaque-calendar-session-token",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF" as const,
};
const hotelId = "50000000-0000-4000-8000-000000000001";
const query = { from: "2026-08-01", pageSize: 200, to: "2026-09-12" };

function repository(payload: unknown) {
  return {
    close: vi.fn(async () => undefined),
    capabilities: vi.fn(async (): Promise<{ status: string; payload: unknown | null }> => ({ status: "OK", payload: { canViewAllHotels: false, hotels: [] } })),
    events: vi.fn(async (): Promise<{ status: string; payload: unknown | null }> => ({ status: "OK", payload })),
    visitOptions: vi.fn(async (): Promise<{ status: string; payload: unknown | null }> => ({ status: "OK", payload: { internalPerformers: [], repairs: [] } })),
  };
}

describe("Calendar service", () => {
  it("passes the canonical session token and bounded query to the repository", async () => {
    const payload = {
      capabilities: { canCreateVisit: false, canViewAllHotels: false },
      events: [],
      hotels: [{ id: hotelId, name: "서울호텔" }],
      pagination: { nextCursor: null },
      range: { from: query.from, timeZone: "Asia/Seoul", to: query.to },
    };
    const repo = repository(payload);
    const service = createCalendarService(repo);
    await expect(service.listHotelEvents(principal, hotelId, query)).resolves.toEqual(payload);
    expect(repo.events).toHaveBeenCalledWith({
      companyId: principal.companyId,
      hotelId,
      query,
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
    });
  });

  it("uses null hotel scope only for the explicit all-hotels route", async () => {
    const payload = {
      capabilities: { canCreateVisit: false, canViewAllHotels: true },
      events: [], hotels: [], pagination: { nextCursor: null },
      range: { from: query.from, timeZone: "Asia/Seoul", to: query.to },
    };
    const repo = repository(payload);
    const service = createCalendarService(repo);
    await service.listAllEvents(principal, query);
    expect(repo.events).toHaveBeenCalledWith(expect.objectContaining({ hotelId: null }));
  });

  it("does not synthesize visit options when PostgreSQL denies access", async () => {
    const repo = repository(null);
    repo.visitOptions.mockResolvedValueOnce({ status: "FORBIDDEN", payload: null });
    const service = createCalendarService(repo);
    await expect(service.getVisitOptions(principal, hotelId)).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });
});

describe("Calendar route range errors", () => {
  it.each([
    ["/api/calendar?from=2026-08-01&to=2026-09-13", "CALENDAR_RANGE_TOO_LARGE"],
    [`/api/hotels/${hotelId}/calendar?from=2026-08-02&to=2026-08-01`, "CALENDAR_RANGE_INVALID"],
  ])("returns the stable error before calling the repository: %s", async (path, code) => {
    const listAllEvents = vi.fn();
    const listHotelEvents = vi.fn();
    const app = createApp({
      authService: { resolvePrincipal: async () => principal } as unknown as AuthService,
      calendarService: {
        getCapabilities: vi.fn(),
        getVisitOptions: vi.fn(),
        listAllEvents,
        listHotelEvents,
      },
    });
    const response = await app.request(path, {
      headers: { cookie: "__Host-hotel_session=opaque-calendar-session-token" },
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
    expect(listAllEvents).not.toHaveBeenCalled();
    expect(listHotelEvents).not.toHaveBeenCalled();
  });
});
