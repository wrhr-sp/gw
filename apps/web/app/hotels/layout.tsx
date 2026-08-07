import type { ReactNode } from "react";
import { calendarNavigationHref, HotelShell } from "../../components/hotels/hotel-shell";
import { requireAuthenticatedPrincipal } from "../../lib/server-auth";
import { fetchAccountCapabilities } from "../../lib/server-accounts";
import { fetchCalendarCapabilities } from "../../lib/server-calendar";

export default async function HotelsLayout({ children }: { children: ReactNode }) {
  const [principal, accountPermissions, calendarCapabilities] = await Promise.all([
    requireAuthenticatedPrincipal(),
    fetchAccountCapabilities(),
    fetchCalendarCapabilities(),
  ]);
  const calendarHref = calendarNavigationHref(
    calendarCapabilities.canViewAllHotels,
    calendarCapabilities.hotels,
  );
  return (
    <HotelShell accountPermissions={accountPermissions} calendarHref={calendarHref} currentPath="/hotels" hotelName="호텔관리" principal={principal}>
      {children}
    </HotelShell>
  );
}
