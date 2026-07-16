import type { ReactNode } from "react";
import { HotelShell } from "../../components/hotels/hotel-shell";
import { requireAuthenticatedPrincipal } from "../../lib/server-auth";

export default async function HotelsLayout({ children }: { children: ReactNode }) {
  const principal = await requireAuthenticatedPrincipal();
  return (
    <HotelShell currentPath="/hotels" hotelName="호텔관리" principal={principal}>
      {children}
    </HotelShell>
  );
}
