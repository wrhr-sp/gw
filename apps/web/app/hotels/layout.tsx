import type { ReactNode } from "react";
import { calendarNavigationHref, HotelShell } from "../../components/hotels/hotel-shell";
import { requireAuthenticatedPrincipal } from "../../lib/server-auth";
import { fetchAccountCapabilities } from "../../lib/server-accounts";
import { fetchCalendarCapabilities, fetchCalendarConnectionStatus } from "../../lib/server-calendar";

export default async function HotelsLayout({ children }: { children: ReactNode }) {
  const [principal, accountPermissions, calendarCapabilities, calendarConnection] = await Promise.all([
    requireAuthenticatedPrincipal(),
    fetchAccountCapabilities(),
    fetchCalendarCapabilities(),
    fetchCalendarConnectionStatus(),
  ]);
  const calendarHref = calendarNavigationHref(
    calendarCapabilities.canViewAllHotels,
    calendarCapabilities.hotels,
  );
  return (
    <HotelShell accountPermissions={accountPermissions} calendarHref={calendarHref} canManageCalendarConnection={calendarConnection.ok} currentPath="/hotels" hotelName="호텔관리" principal={principal}>
      {children}
    </HotelShell>
  );
}
