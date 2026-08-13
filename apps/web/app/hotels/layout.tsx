import type { ReactNode } from "react";
import {
  calendarNavigationHref,
  HotelShell,
} from "../../components/hotels/hotel-shell";
import { requireAuthenticatedPrincipal } from "../../lib/server-auth";
import { fetchAccountCapabilities } from "../../lib/server-accounts";
import { fetchCalendarCapabilities } from "../../lib/server-calendar";
import { fetchDailySalesCapabilities } from "../../lib/server-daily-sales";
import { fetchOperationalIssueCapabilities } from "../../lib/server-issues";

export default async function HotelsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [
    principal,
    accountPermissions,
    calendarCapabilities,
    dailySalesCapabilities,
    issueCapabilities,
  ] = await Promise.all([
    requireAuthenticatedPrincipal(),
    fetchAccountCapabilities(),
    fetchCalendarCapabilities(),
    fetchDailySalesCapabilities(),
    fetchOperationalIssueCapabilities(),
  ]);
  const calendarHref = calendarNavigationHref(
    calendarCapabilities.canViewAllHotels,
    calendarCapabilities.hotels,
  );
  return (
    <HotelShell
      accountPermissions={accountPermissions}
      calendarHref={calendarHref}
      currentPath="/hotels"
      dailySalesCapabilities={dailySalesCapabilities}
      hotelName="호텔관리"
      issueCapabilities={issueCapabilities}
      principal={principal}
    >
      {children}
    </HotelShell>
  );
}
