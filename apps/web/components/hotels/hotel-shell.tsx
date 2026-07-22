import type { AccountPermission, AuthenticatedPrincipal } from "@werehere/contracts";
import { Building2, LayoutDashboard, Users } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "../shell/app-shell";

const baseNavigation = [
  { href: "/hotel-operations", icon: <LayoutDashboard />, label: "운영 홈" },
  { href: "/hotels", icon: <Building2 />, label: "호텔 관리" },
];

type HotelShellProps = {
  children: ReactNode;
  accountPermissions?: AccountPermission[];
  currentPath: string;
  hotelName?: string;
  principal: AuthenticatedPrincipal;
};

export function HotelShell({
  accountPermissions = [],
  children,
  currentPath,
  hotelName = "호텔 미선택",
  principal,
}: HotelShellProps) {
  const navigation = accountPermissions.includes("USER_READ")
    ? [...baseNavigation, { href: "/admin/users", icon: <Users />, label: "사용자 계정" }]
    : baseNavigation;
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
