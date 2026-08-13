import type { AccountPermission, AuthenticatedPrincipal, OperationalIssueCapability } from "@werehere/contracts";
import { Building2, CalendarDays, CircleAlert, LayoutDashboard, Users } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "../shell/app-shell";

const baseNavigation = [
  { href: "/hotel-operations", icon: <LayoutDashboard />, label: "운영 홈" },
  { href: "/hotels", icon: <Building2 />, label: "호텔 관리" },
];

export function calendarNavigationHref(
  canViewAllHotels: boolean,
  hotels: readonly { id: string }[],
) {
  if (canViewAllHotels) return "/hotels/calendar";
  return hotels[0] ? `/hotels/${hotels[0].id}/calendar` : undefined;
}

type HotelShellProps = {
  children: ReactNode;
  accountPermissions?: AccountPermission[];
  calendarHref?: string | undefined;
  issueCapabilities?: OperationalIssueCapability[];
  currentPath: string;
  hotelName?: string;
  principal: AuthenticatedPrincipal;
};

export function HotelShell({
  accountPermissions = [],
  calendarHref,
  children,
  currentPath,
  hotelName = "호텔 미선택",
  issueCapabilities = [],
  principal,
}: HotelShellProps) {
  const navigation = [...baseNavigation];
  if (calendarHref) navigation.push({ href: calendarHref, icon: <CalendarDays />, label: "업무 달력" });
  const issueHotel = issueCapabilities.find((capability) => capability.canRead);
  if (issueHotel) navigation.push({ href: `/hotels/${issueHotel.hotelId}/issues`, icon: <CircleAlert />, label: "운영이슈" });
  if (accountPermissions.includes("USER_READ")) navigation.push({ href: "/admin/users", icon: <Users />, label: "사용자 계정" });
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
