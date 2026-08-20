import { InquiryWorkspace } from "../../../../components/inquiries/inquiry-workspace";
import { fetchInquiries } from "../../../../lib/server-inquiries";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function InquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ inquiryId?: string }>;
}) {
  const { hotelId } = await params,
    { inquiryId } = await searchParams,
    result = await fetchInquiries(hotelId, inquiryId);
  if (!result.ok && ["FORBIDDEN", "RESOURCE_NOT_FOUND"].includes(result.code))
    notFound();
  if (!result.ok)
    return (
      <section
        role="alert"
        className="rounded-panel border border-border bg-surface p-6"
      >
        <h1 className="text-lg font-semibold">
          문의 화면을 불러오지 못했습니다
        </h1>
        <p className="mt-2 text-sm text-muted">{result.error}</p>
      </section>
    );
  return (
    <InquiryWorkspace
      hotelId={hotelId}
      initialInquiries={result.inquiries}
      initialNotifications={result.notifications}
      initialSelected={result.selected}
      capability={result.capability}
      assignments={result.assignments}
      contact={result.contact}
      settings={result.settings}
    />
  );
}
