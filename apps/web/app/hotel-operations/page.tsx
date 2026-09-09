import { Button, FeatureGuide, PageHeader } from "@werehere/ui";
import { Building2 } from "lucide-react";
import { calendarNavigationHref, HotelShell } from "../../components/hotels/hotel-shell";
import { requireAuthenticatedPrincipal } from "../../lib/server-auth";
import { fetchAccountCapabilities } from "../../lib/server-accounts";
import { fetchCalendarCapabilities } from "../../lib/server-calendar";
import { hotelFeatureGuides } from "../../lib/feature-guides";

export const dynamic = "force-dynamic";

export default async function HotelOperationsPage() {
  const principal = await requireAuthenticatedPrincipal();
  const [accountPermissions, calendarCapabilities] = await Promise.all([
    fetchAccountCapabilities(),
    fetchCalendarCapabilities(),
  ]);
  const calendarHref = calendarNavigationHref(
    calendarCapabilities.canViewAllHotels,
    calendarCapabilities.hotels,
  );

  return (
    <HotelShell accountPermissions={accountPermissions} calendarHref={calendarHref} currentPath="/hotel-operations" principal={principal}>
      <div className="mx-auto flex w-full max-w-hotel-detail flex-col gap-6">
        <PageHeader
          titleAccessory={<FeatureGuide content={hotelFeatureGuides["hotel-operations.entry"]} />}
          eyebrow="호텔관리"
          title="호텔 운영"
        />
        <section className="rounded-panel border border-border bg-surface p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary"><Building2 aria-hidden="true" className="size-5" /><h2 className="text-base font-semibold text-text">호텔 관리</h2></div>
              <p className="mt-2 text-sm text-muted">조회할 수 있는 호텔의 기본정보와 업무를 확인합니다.</p>
            </div>
            <Button asChild><a href="/hotels">호텔 목록 열기</a></Button>
          </div>
        </section>
      </div>
    </HotelShell>
  );
}
