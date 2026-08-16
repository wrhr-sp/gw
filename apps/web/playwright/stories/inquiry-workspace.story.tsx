import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { InquiryWorkspace } from "../../components/inquiries/inquiry-workspace";

const hotelId = "50000000-0000-4000-8000-000000000001";
const inquiry = {
  answeredAt: null,
  assignee: { displayName: "정산 담당" },
  categoryCode: "SALES_SETTLEMENT" as const,
  categoryName: "매출·정산",
  closedAt: null,
  createdAt: "2026-08-15T09:00:00.000Z",
  hotelId,
  id: "1a500000-0000-4000-8000-000000000001",
  messages: [
    {
      actor: { displayName: "호텔 소유주" },
      attachments: [
        {
          displayName: "7월-정산근거.png",
          fileVersionId: "1a560000-0000-4000-8000-000000000001",
        },
      ],
      body: "7월 정산자료를 확인해 주세요.",
      createdAt: "2026-08-15T09:00:00.000Z",
      id: "1a570000-0000-4000-8000-000000000001",
      visibility: "PUBLIC" as const,
    },
  ],
  reopenUntil: null,
  status: "ANSWERING" as const,
  title: "7월 정산자료 확인 요청",
  updatedAt: "2026-08-15T10:00:00.000Z",
  version: 3,
};

export function InquiryWorkspaceStory() {
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
      <main className="p-4 sm:p-6" data-inquiry-workspace>
        <InquiryWorkspace
          assignments={[]}
          capability={{
            canAssign: false,
            canCreate: true,
            canManageSettings: false,
            canRead: true,
            canReply: false,
            hotelId,
            hotelName: "서울호텔",
            ownerView: true,
          }}
          contact={{
            email: "hotel@example.invalid",
            operatingHours: "평일 09:00~18:00",
            phone: "02-000-0000",
            version: 1,
          }}
          hotelId={hotelId}
          initialInquiries={[inquiry]}
          initialSelected={inquiry}
          settings={null}
        />
      </main>
    </QueryClientProvider>
  );
}
