import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { KnowledgeWorkspace } from "../../components/knowledge/knowledge-workspace";
import { knowledgeStoryEntry } from "./knowledge-workspace.fixture";

const hotelId = "55555555-5555-4555-8555-555555555555";

export function KnowledgeWorkspaceStory() {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <KnowledgeWorkspace
        capabilities={{
          canArchive: true,
          canCreate: true,
          canPublish: true,
          canRead: true,
          canReview: true,
          company: {
            canArchive: true,
            canCreate: true,
            canHighRiskPublish: true,
            canPublish: true,
            canRead: true,
            canReview: true,
          },
          hotels: [
            {
              hotelId,
              hotelName: "서울호텔",
              permissions: {
                canArchive: true,
                canCreate: true,
                canHighRiskPublish: true,
                canPublish: true,
                canRead: true,
                canReview: true,
              },
            },
          ],
        }}
        initialEntries={[
          {
            id: knowledgeStoryEntry.id,
            scopeType: knowledgeStoryEntry.scopeType,
            hotelId: knowledgeStoryEntry.hotelId,
            hotelName: "서울호텔",
            title: knowledgeStoryEntry.title,
            summary: knowledgeStoryEntry.summary,
            knowledgeType: knowledgeStoryEntry.knowledgeType,
            riskClassification: knowledgeStoryEntry.riskClassification,
            tags: knowledgeStoryEntry.tags,
            status: knowledgeStoryEntry.status,
            version: knowledgeStoryEntry.version,
            updatedAt: knowledgeStoryEntry.updatedAt,
            isStale: knowledgeStoryEntry.isStale,
          },
        ]}
        initialReviewerCandidates={[
          { userId: "77777777-7777-4777-8777-777777777777", displayName: "지정 검토자" },
        ]}
        initialSelected={knowledgeStoryEntry}
        initialTotalCount={1}
      />
    </QueryClientProvider>
  );
}
