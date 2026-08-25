import { knowledgeListQuerySchema } from "@werehere/contracts";
import { KnowledgeWorkspace } from "../../components/knowledge/knowledge-workspace";
import { fetchKnowledgeWorkspace } from "../../lib/server-knowledge";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{
    hotelId?: string;
    knowledgeId?: string;
    knowledgeType?: string;
    scopeType?: string;
    search?: string;
    status?: string;
  }>;
}) {
  const parameters = await searchParams;
  const parsedQuery = knowledgeListQuerySchema.safeParse({
    ...(parameters.hotelId ? { hotelId: parameters.hotelId } : {}),
    ...(parameters.knowledgeType
      ? { knowledgeType: parameters.knowledgeType }
      : {}),
    page: 1,
    pageSize: 20,
    ...(parameters.scopeType ? { scopeType: parameters.scopeType } : {}),
    ...(parameters.search ? { search: parameters.search } : {}),
    ...(parameters.status ? { status: parameters.status } : {}),
  });
  const result = await fetchKnowledgeWorkspace(
    parsedQuery.success
      ? parsedQuery.data
      : { page: 1, pageSize: 20, search: "" },
    parameters.knowledgeId,
  );

  if (!result.ok)
    return (
      <main className="min-h-screen bg-app-bg px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-card border border-border bg-surface p-6">
          <h1 className="text-xl font-bold">운영 지식뱅크</h1>
          <p className="mt-3 text-sm text-destructive" role="alert">
            {result.error}
          </p>
          <a
            className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground"
            href="/knowledge"
          >
            다시 불러오기
          </a>
        </section>
      </main>
    );

  return (
    <KnowledgeWorkspace
      capabilities={result.capabilities}
      initialEntries={result.entries}
      initialReviewerCandidates={result.reviewerCandidates}
      initialSelected={result.selected}
      initialTotalCount={result.totalCount}
    />
  );
}
