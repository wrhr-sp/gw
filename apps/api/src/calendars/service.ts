import {
  calendarCapabilitiesResponseSchema,
  calendarEventsResponseSchema,
  calendarVisitOptionsResponseSchema,
  type AuthenticatedPrincipal,
  type CalendarEventsQuery,
  type HotelErrorCode,
} from "@werehere/contracts";
import type { CalendarRepository } from "@werehere/db";

type SessionPrincipal = AuthenticatedPrincipal & { sessionToken: string };
type CalendarHttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;
export class CalendarServiceError extends Error {
  readonly retryable = false;
  constructor(public readonly code: HotelErrorCode, public readonly httpStatus: CalendarHttpStatus) {
    super(code);
  }
}
const STATUS: Record<string, [HotelErrorCode, CalendarHttpStatus]> = {
  FORBIDDEN: ["FORBIDDEN", 403],
  CALENDAR_ACCESS_FORBIDDEN: ["CALENDAR_ACCESS_FORBIDDEN", 403],
  CALENDAR_RANGE_INVALID: ["CALENDAR_RANGE_INVALID", 400],
  CALENDAR_RANGE_TOO_LARGE: ["CALENDAR_RANGE_TOO_LARGE", 400],
  CALENDAR_CURSOR_INVALID: ["CALENDAR_CURSOR_INVALID", 400],
  CALENDAR_RESULT_TOO_DENSE: ["CALENDAR_RESULT_TOO_DENSE", 422],
  CALENDAR_HOTEL_REQUIRED: ["CALENDAR_HOTEL_REQUIRED", 400],
  VALIDATION_ERROR: ["VALIDATION_ERROR", 400],
};
function fail(status: string): never {
  const mapped = STATUS[status] ?? ["INTERNAL_ERROR", 500];
  throw new CalendarServiceError(mapped[0], mapped[1]);
}
function principalWithToken(principal: AuthenticatedPrincipal): SessionPrincipal {
  const token = "sessionToken" in principal ? (principal as { sessionToken?: unknown }).sessionToken : undefined;
  if (typeof token !== "string") throw new CalendarServiceError("AUTHENTICATION_REQUIRED", 401);
  return principal as SessionPrincipal;
}

export interface CalendarService {
  close?(): Promise<void>;
  getCapabilities(principal: AuthenticatedPrincipal): Promise<unknown>;
  getVisitOptions(principal: AuthenticatedPrincipal, hotelId: string): Promise<unknown>;
  listAllEvents(principal: AuthenticatedPrincipal, query: CalendarEventsQuery): Promise<unknown>;
  listHotelEvents(principal: AuthenticatedPrincipal, hotelId: string, query: CalendarEventsQuery): Promise<unknown>;
}

export function createCalendarService(repository: CalendarRepository): CalendarService {
  async function events(principal: AuthenticatedPrincipal, hotelId: string | null, query: CalendarEventsQuery) {
    const actor = principalWithToken(principal);
    const result = await repository.events({
      companyId: actor.companyId,
      hotelId,
      query,
      sessionId: actor.sessionId,
      sessionToken: actor.sessionToken,
    });
    if (result.status !== "OK" || result.payload === null) fail(result.status);
    const parsed = calendarEventsResponseSchema.safeParse({ ok: true, data: result.payload, error: null });
    if (!parsed.success) throw new CalendarServiceError("INTERNAL_ERROR", 500);
    return parsed.data.data;
  }
  return {
    async close() { await repository.close(); },
    async getCapabilities(principal) {
      const actor = principalWithToken(principal);
      const result = await repository.capabilities({
        companyId: actor.companyId,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null) fail(result.status);
      const parsed = calendarCapabilitiesResponseSchema.safeParse({ ok: true, data: result.payload, error: null });
      if (!parsed.success) throw new CalendarServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async getVisitOptions(principal, hotelId) {
      const actor = principalWithToken(principal);
      const result = await repository.visitOptions({
        companyId: actor.companyId,
        hotelId,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null) fail(result.status);
      const parsed = calendarVisitOptionsResponseSchema.safeParse({ ok: true, data: result.payload, error: null });
      if (!parsed.success) throw new CalendarServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    listAllEvents(principal, query) { return events(principal, null, query); },
    listHotelEvents(principal, hotelId, query) { return events(principal, hotelId, query); },
  };
}
