import {
  calendarCapabilitiesResponseSchema,
  calendarEventsResponseSchema,
  calendarRoutes,
  hotelErrorResponseSchema,
  type CalendarEventsResponse,
} from "@werehere/contracts";
import { Temporal } from "temporal-polyfill";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";

type CalendarPageData = CalendarEventsResponse["data"];
async function request(path: string) {
  const headers = new Headers();
  const cookieHeader = (await cookies()).toString();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  try { return await fetchApi(path, { cache: "no-store", headers }); }
  catch { return new Response(null, { status: 503 }); }
}
function currentRange() {
  const today = Temporal.Now.zonedDateTimeISO("Asia/Seoul").toPlainDate();
  const daysSinceSunday = today.dayOfWeek % 7;
  const from = today.subtract({ days: daysSinceSunday });
  return { from: from.toString(), to: from.add({ days: 42 }).toString() };
}
function errorMessage(payload: unknown, fallback: string) {
  const parsed = hotelErrorResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : fallback;
}

export async function fetchCalendarCapabilities() {
  const response = await request(calendarRoutes.capabilities);
  if (response.status === 401) redirect("/login");
  if (!response.ok) return { canViewAllHotels: false, hotels: [] };
  const parsed = calendarCapabilitiesResponseSchema.safeParse(await response.json().catch(() => undefined));
  return parsed.success ? parsed.data.data : { canViewAllHotels: false, hotels: [] };
}

export async function fetchCalendar(hotelId: string | null) {
  const range = currentRange();
  const base = hotelId ? calendarRoutes.hotel(hotelId) : calendarRoutes.all;
  let cursor: string | null = null;
  let first: CalendarPageData | null = null;
  const events: CalendarPageData["events"] = [];
  for (let page = 0; page < 25; page += 1) {
    const query = new URLSearchParams({ from: range.from, to: range.to, pageSize: "200" });
    if (cursor) query.set("cursor", cursor);
    const response = await request(`${base}?${query}`);
    if (response.status === 401) redirect("/login");
    const payload = await response.json().catch(() => undefined);
    if (!response.ok) return { ok: false as const, error: errorMessage(payload, "업무 달력을 불러오지 못했습니다.") };
    const parsed = calendarEventsResponseSchema.safeParse(payload);
    if (!parsed.success) return { ok: false as const, error: "업무 달력 응답을 안전하게 확인하지 못했습니다." };
    first ??= parsed.data.data;
    events.push(...parsed.data.data.events);
    cursor = parsed.data.data.pagination.nextCursor;
    if (!cursor) return { ok: true as const, data: { ...first, events, pagination: { nextCursor: null } } };
  }
  return { ok: false as const, error: "일정이 너무 많습니다. 호텔 또는 기간을 좁혀 주세요." };
}
