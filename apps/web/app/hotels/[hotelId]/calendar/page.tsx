import { CalendarWorkspace } from "../../../../components/calendar/calendar-workspace";
import { fetchCalendar } from "../../../../lib/server-calendar";

export default async function HotelCalendarPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const result = await fetchCalendar(hotelId);
  if (!result.ok) return <section role="alert" className="rounded-panel border border-border bg-surface p-6"><h1 className="text-lg font-semibold">업무 달력을 불러오지 못했습니다</h1><p className="mt-2 text-sm text-muted">{result.error}</p></section>;
  return <CalendarWorkspace initialData={result.data} initialScope={{ hotelId, mode: "HOTEL" }} />;
}
