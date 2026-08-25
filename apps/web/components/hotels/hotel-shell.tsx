"use client";

import type {
  AccountPermission,
  AuthenticatedPrincipal,
  DailySalesCapability,
  HotelInquiryCapability,
  OperationalIssueCapability,
} from "@werehere/contracts";
import {
  knowledgeCapabilitiesResponseSchema,
  knowledgeRoutes,
} from "@werehere/contracts";
import {
  Banknote,
  BookOpenText,
  Building2,
  CalendarDays,
  CircleAlert,
  MessageCircleQuestion,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
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
  dailySalesCapabilities?: DailySalesCapability[];
  issueCapabilities?: OperationalIssueCapability[];
  inquiryCapabilities?: HotelInquiryCapability[];
  currentPath: string;
  hotelName?: string;
  principal: AuthenticatedPrincipal;
};

export function HotelShell({
  accountPermissions = [],
  calendarHref,
  children,
  currentPath,
  dailySalesCapabilities = [],
  hotelName = "호텔 미선택",
  issueCapabilities = [],
  inquiryCapabilities = [],
  principal,
}: HotelShellProps) {
  const [canReadKnowledge, setCanReadKnowledge] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(knowledgeRoutes.capabilities, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const parsed = knowledgeCapabilitiesResponseSchema.safeParse(
          await response.json().catch(() => undefined),
        );
        setCanReadKnowledge(
          response.ok && parsed.success && parsed.data.data.canRead,
        );
      })
      .catch(() => setCanReadKnowledge(false));
    return () => controller.abort();
  }, []);
  const navigation = [...baseNavigation];
  if (canReadKnowledge)
    navigation.push({
      href: "/knowledge",
      icon: <BookOpenText />,
      label: "운영 지식",
    });
  if (calendarHref)
    navigation.push({
      href: calendarHref,
      icon: <CalendarDays />,
      label: "업무 달력",
    });
  const dailySalesHotel = dailySalesCapabilities.find(
    (capability) => capability.canRead,
  );
  if (dailySalesHotel)
    navigation.push({
      href: `/hotels/${dailySalesHotel.hotelId}/daily-sales`,
      icon: <Banknote />,
      label: "일매출",
    });
  const issueHotel = issueCapabilities.find((capability) => capability.canRead);
  if (issueHotel)
    navigation.push({
      href: `/hotels/${issueHotel.hotelId}/issues`,
      icon: <CircleAlert />,
      label: "운영이슈",
    });
  const inquiryHotel = inquiryCapabilities.find((capability) => capability.canRead);
  if (inquiryHotel)
    navigation.push({
      href: `/hotels/${inquiryHotel.hotelId}/inquiries`,
      icon: <MessageCircleQuestion />,
      label: "소유주 문의",
    });
  if (accountPermissions.includes("USER_READ"))
    navigation.push({
      href: "/admin/users",
      icon: <Users />,
      label: "사용자 계정",
    });
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
