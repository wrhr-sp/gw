import { House } from "lucide-react";
import { AppShell } from "../../components/shell/app-shell";
import { requireAuthenticatedPrincipal } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function HotelOperationsPage() {
  const principal = await requireAuthenticatedPrincipal();

  return (
    <AppShell
      currentPath="/hotel-operations"
      hotelName="호텔 미선택"
      navigation={[{
        href: "/hotel-operations",
        icon: <House aria-hidden="true" />,
        label: "운영 홈",
      }]}
      userDisplayName={principal.displayName}
    >
      <section aria-labelledby="hotel-operations-title" className="max-w-3xl">
        <h1 className="text-2xl font-bold text-text" id="hotel-operations-title">호텔 운영</h1>
        <div className="mt-6 rounded-card border border-border bg-surface p-6">
          <p className="text-base font-semibold text-text">로그인 확인 완료</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            서버에서 활성 세션과 사용자·회사 상태를 확인했습니다.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
