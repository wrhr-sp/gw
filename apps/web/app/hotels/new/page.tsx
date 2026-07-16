import { PageHeader } from "@werehere/ui";
import { HotelCreateForm } from "../../../components/hotels/hotel-create-form";
import { fetchHotelList } from "../../../lib/server-hotels";

export const dynamic = "force-dynamic";

export default async function NewHotelPage() {
  const access = await fetchHotelList();
  const canCreate = access.ok && access.capabilities.canCreate;

  return (
    <div className="mx-auto flex w-full max-w-hotel-form flex-col gap-6">
        <div><a className="text-sm font-medium text-primary hover:underline" href="/hotels">← 호텔 목록</a></div>
        <PageHeader
          description="필수 기본정보를 저장하면 준비중 상태의 호텔이 생성됩니다."
          eyebrow="지점관리"
          title="호텔 등록"
        />
        {canCreate ? (
          <HotelCreateForm />
        ) : (
          <section className="rounded-panel border border-border bg-surface p-6" role="alert">
            <h2 className="text-base font-semibold text-text">
              {access.ok || access.error.code === "FORBIDDEN"
                ? "호텔 등록 권한이 없습니다"
                : "호텔 등록 화면을 열 수 없습니다"}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {access.ok ? "호텔 조회는 가능하지만 새 호텔을 등록할 회사범위 권한이 없습니다." : access.error.message}
            </p>
          </section>
        )}
    </div>
  );
}
