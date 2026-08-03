import { notFound } from "next/navigation";
import { InspectionReviewWorkspace } from "../../../../../components/inspections/inspection-review-workspace";
import { fetchInspectionReviews } from "../../../../../lib/server-inspections";

function Failure({ message }: { message: string }) {
  return (
    <section
      className="rounded-panel border border-border bg-surface p-6"
      role="alert"
    >
      <h1 className="text-lg font-semibold">
        점검 검토 화면을 불러오지 못했습니다
      </h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
    </section>
  );
}

export default async function InspectionReviewsPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const data = await fetchInspectionReviews(hotelId);
  if (!data.ok && data.error === "RESOURCE_NOT_FOUND") notFound();
  if (!data.ok) return <Failure message={data.error} />;
  return (
    <InspectionReviewWorkspace
      hotelId={hotelId}
      initialPagination={data.pagination}
      initialReviews={data.reviews}
      initialSelectedReview={data.selectedReview}
    />
  );
}
