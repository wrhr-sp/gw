import type { ReactNode } from "react";
import { HotelShell } from "../../components/hotels/hotel-shell";
import { requireAuthenticatedPrincipal } from "../../lib/server-auth";
import { fetchAccountCapabilities } from "../../lib/server-accounts";

export default async function HotelsLayout({ children }: { children: ReactNode }) {
  const [principal, accountPermissions] = await Promise.all([
    requireAuthenticatedPrincipal(),
    fetchAccountCapabilities(),
  ]);
  return (
    <HotelShell accountPermissions={accountPermissions} currentPath="/hotels" hotelName="호텔관리" principal={principal}>
      {children}
    </HotelShell>
  );
}
