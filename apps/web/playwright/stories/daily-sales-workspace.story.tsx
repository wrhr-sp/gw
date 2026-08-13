import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { DailySalesWorkspace } from "../../components/daily-sales/daily-sales-workspace";

const hotelId = "50000000-0000-4000-8000-000000000001";
const categoryId = "da510000-0000-4000-8000-000000000001";
const paymentMethodId = "da520000-0000-4000-8000-000000000001";
const selected = {
  businessDate: "2026-08-13",
  confirmedAt: null,
  corrections: [],
  createdBy: {
    displayName: "김담당",
    userId: "2f000000-0000-4000-8000-000000000001",
  },
  evidence: [],
  hotelId,
  id: "da500000-0000-4000-8000-000000000001",
  internalMemo: "야간 마감 전 카드 매출 확인",
  lines: [
    {
      categoryId,
      discountAmount: 10000,
      grossAmount: 150000,
      paymentMethodId,
      refundAmount: 5000,
      refundReason: "고객 요청 당일 환불",
    },
  ],
  status: "DRAFT" as const,
  totals: {
    discountAmount: 10000,
    grossAmount: 150000,
    netAmount: 135000,
    refundAmount: 5000,
  },
  updatedAt: "2026-08-13T10:00:00.000Z",
  version: 2,
};

export function DailySalesWorkspaceStory() {
  const [client] = React.useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <main className="mx-auto min-h-screen max-w-[1440px] bg-background p-4 md:p-6">
        <DailySalesWorkspace
          capability={{
            canConfirm: true,
            canCorrect: true,
            canManage: true,
            canRead: true,
            hotelId,
            hotelName: "서울호텔",
            ownerView: false,
          }}
          hotelId={hotelId}
          initialSales={[
            selected,
            {
              ...selected,
              businessDate: "2026-08-12",
              confirmedAt: "2026-08-12T12:00:00.000Z",
              evidence: [
                {
                  displayName: "마감증빙.png",
                  fileVersionId: "da560000-0000-4000-8000-000000000001",
                },
              ],
              id: "da500000-0000-4000-8000-000000000002",
              status: "LOCKED",
            },
          ]}
          initialSelected={selected}
          references={{
            categories: [{ id: categoryId, name: "객실매출" }],
            paymentMethods: [{ id: paymentMethodId, name: "카드" }],
          }}
        />
      </main>
    </QueryClientProvider>
  );
}
