import { Button, PageHeader } from "@werehere/ui";
import { Building2 } from "lucide-react";
import { HotelShell } from "../../components/hotels/hotel-shell";
import { requireAuthenticatedPrincipal } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function HotelOperationsPage() {
  const principal = await requireAuthenticatedPrincipal();

  return (
    <HotelShell currentPath="/hotel-operations" principal={principal}>
      <div className="mx-auto flex w-full max-w-hotel-detail flex-col gap-6">
        <PageHeader
          description="호텔을 등록하고 기본정보를 확인합니다. 객실·담당자·운영지표는 승인된 후속 기능에서 연결합니다."
          eyebrow="호텔관리"
          title="호텔 운영"
        />
        <section className="rounded-panel border border-border bg-surface p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary"><Building2 aria-hidden="true" className="size-5" /><h2 className="text-base font-semibold text-text">호텔 관리</h2></div>
              <p className="mt-2 text-sm text-muted">실제 PostgreSQL에 저장된 호텔 목록과 계약 기본정보를 확인합니다.</p>
            </div>
            <Button asChild><a href="/hotels">호텔 목록 열기</a></Button>
          </div>
        </section>
      </div>
    </HotelShell>
  );
}
