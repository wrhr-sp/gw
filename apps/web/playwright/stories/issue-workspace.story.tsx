import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { IssueWorkspace } from "../../components/issues/issue-workspace";

const hotelId = "50000000-0000-4000-8000-000000000001";
const issue = {
  assignee: {
    displayName: "현장 담당",
    userId: "20000000-0000-4000-8000-000000000001",
  },
  createdAt: "2026-08-12T12:00:00.000Z",
  description: "로비에 반복적인 소음 신고가 접수됐습니다.",
  hotelId,
  id: "d9400000-0000-4000-8000-000000000001",
  internalNotes: [],
  isOverdue: false,
  publicComments: [],
  resumeDueAt: null,
  severity: "MAJOR" as const,
  status: "IN_PROGRESS" as const,
  statusHistory: [],
  title: "로비 소음 신고",
  updatedAt: "2026-08-12T12:00:00.000Z",
  version: 3,
  workLogs: [],
};

export function IssueWorkspaceStory() {
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
      <IssueWorkspace
        assignments={[
          {
            assignee: {
              displayName: "현장 담당",
              userId: issue.assignee.userId,
              userType: "INTERNAL_STAFF",
            },
            assignmentType: "PRIMARY",
            createdAt: "2026-08-01T00:00:00.000Z",
            endDate: null,
            hotelId,
            id: "d9600000-0000-4000-8000-000000000001",
            reason: "운영 담당",
            relationshipType: "STAFF",
            startDate: "2026-08-01",
            terminatedAt: null,
            terminationReason: null,
            updatedAt: "2026-08-01T00:00:00.000Z",
            userId: issue.assignee.userId,
            version: 1,
          },
        ]}
        capability={{
          actorUserId: issue.assignee.userId,
          canComment: true,
          canCreate: true,
          canManage: true,
          canRead: true,
          canWork: true,
          hotelId,
          hotelName: "서울호텔",
        }}
        hotelId={hotelId}
        initialIssues={[issue]}
        initialSelected={issue}
      />
    </QueryClientProvider>
  );
}
