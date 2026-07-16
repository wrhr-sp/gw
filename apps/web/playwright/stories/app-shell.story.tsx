import { Bell, Building2, ClipboardCheck, Home, TriangleAlert } from "lucide-react";
import { AppShell } from "../../components/shell/app-shell";

const navigation = [
  { href: "/hotel-operations", label: "홈", icon: <Home aria-hidden="true" /> },
  { href: "/hotels", label: "호텔", icon: <Building2 aria-hidden="true" /> },
  { href: "/inspections", label: "점검", icon: <ClipboardCheck aria-hidden="true" /> },
  { href: "/issues", label: "이슈", icon: <TriangleAlert aria-hidden="true" /> },
  { href: "/notifications", label: "알림", icon: <Bell aria-hidden="true" /> },
];

export function AppShellStory() {
  return (
    <AppShell
      currentPath="/hotel-operations"
      hotelName="현재 호텔"
      navigation={navigation}
      userDisplayName="로그인 사용자"
    >
      <div>
        <h1 className="text-2xl font-bold lg:text-[28px]">호텔 운영</h1>
      </div>
    </AppShell>
  );
}
