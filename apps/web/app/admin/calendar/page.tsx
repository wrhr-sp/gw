import { notFound } from "next/navigation";
import { CalendarConnectionPanel } from "../../../components/calendar/calendar-connection-panel";
import { HotelShell } from "../../../components/hotels/hotel-shell";
import { fetchAccountCapabilities } from "../../../lib/server-accounts";
import { requireAuthenticatedPrincipal } from "../../../lib/server-auth";
import { fetchCalendarConnectionStatus } from "../../../lib/server-calendar";

export const dynamic = "force-dynamic";
export default async function AdminCalendarPage() {
  const [principal, accountPermissions, connection] = await Promise.all([
    requireAuthenticatedPrincipal(),
    fetchAccountCapabilities(),
    fetchCalendarConnectionStatus(),
  ]);
  if (!connection.ok && connection.forbidden) notFound();
  return (
    <HotelShell
      accountPermissions={accountPermissions}
      canManageCalendarConnection
      currentPath="/admin/calendar"
      hotelName="호텔관리"
      principal={principal}
    >
      {connection.ok ? (
        <CalendarConnectionPanel initialData={connection.data} />
      ) : (
        <section
          className="rounded-panel border border-border bg-surface p-6"
          role="alert"
        >
          <h1 className="font-semibold">
            Google Calendar 연결 상태를 확인하지 못했습니다
          </h1>
          <p className="mt-2 text-sm text-muted">{connection.error}</p>
          <a
            className="mt-4 inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold"
            href="/admin/calendar"
          >
            다시 시도
          </a>
        </section>
      )}
    </HotelShell>
  );
}
