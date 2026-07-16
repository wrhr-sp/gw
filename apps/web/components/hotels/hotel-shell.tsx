import type { AuthenticatedPrincipal } from "@werehere/contracts";
import { Building2, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "../shell/app-shell";

const navigation = [
  { href: "/hotel-operations", icon: <LayoutDashboard />, label: "운영 홈" },
  { href: "/hotels", icon: <Building2 />, label: "호텔 관리" },
];

type HotelShellProps = {
  children: ReactNode;
  currentPath: string;
  hotelName?: string;
  principal: AuthenticatedPrincipal;
};

export function HotelShell({
  children,
  currentPath,
  hotelName = "호텔 미선택",
  principal,
}: HotelShellProps) {
  return (
    <AppShell
      currentPath={currentPath}
      hotelName={hotelName}
      navigation={navigation}
      userDisplayName={principal.displayName}
    >
      {children}
    </AppShell>
  );
}
