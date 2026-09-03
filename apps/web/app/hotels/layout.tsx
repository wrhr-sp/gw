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
import { fetchInquiryCapabilities } from "../../lib/server-inquiries";

export default async function HotelsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const principal = await requireAuthenticatedPrincipal();
  const accountPermissions = await fetchAccountCapabilities();
  const calendarCapabilities = await fetchCalendarCapabilities();
  const dailySalesCapabilities = await fetchDailySalesCapabilities();
  const issueCapabilities = await fetchOperationalIssueCapabilities();
  const inquiryCapabilities = await fetchInquiryCapabilities();
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
      inquiryCapabilities={inquiryCapabilities}
      principal={principal}
    >
      {children}
    </HotelShell>
  );
}
