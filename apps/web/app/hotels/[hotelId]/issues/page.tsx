import { IssueWorkspace } from "../../../../components/issues/issue-workspace";
import { fetchOperationalIssues } from "../../../../lib/server-issues";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OperationalIssuesPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const result = await fetchOperationalIssues(hotelId);
  if (
    !result.ok &&
    ["FORBIDDEN", "RESOURCE_NOT_FOUND"].includes(result.code)
  )
    notFound();
  if (!result.ok)
    return (
      <section
        className="rounded-panel border border-border bg-surface p-6"
        role="alert"
      >
        <h1 className="text-lg font-semibold">
          운영이슈 화면을 불러오지 못했습니다
        </h1>
        <p className="mt-2 text-sm text-muted">{result.error}</p>
      </section>
    );
  return (
    <IssueWorkspace
      assignments={result.assignments}
      capability={result.capability}
      hotelId={hotelId}
      initialIssues={result.issues}
      initialSelected={result.selectedIssue}
    />
  );
}
