import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DailySalesWorkspace } from "../components/daily-sales/daily-sales-workspace";
const hotelId = "50000000-0000-4000-8000-000000000001";
const categoryId = "da510000-0000-4000-8000-000000000001";
const paymentMethodId = "da520000-0000-4000-8000-000000000001";
const line = {
  categoryId,
  paymentMethodId,
  grossAmount: 150000,
  discountAmount: 10000,
  refundAmount: 5000,
  refundReason: "고객 요청",
};
const draft = {
  id: "da500000-0000-4000-8000-000000000001",
  hotelId,
  businessDate: "2026-08-13",
  status: "DRAFT" as const,
  version: 2,
  totals: {
    grossAmount: 150000,
    discountAmount: 10000,
    refundAmount: 5000,
    netAmount: 135000,
  },
  lines: [line],
  evidence: [],
  corrections: [],
  confirmedAt: null,
  updatedAt: "2026-08-13T10:00:00.000Z",
  internalMemo: "마감 전 확인",
  createdBy: {
    userId: "2f000000-0000-4000-8000-000000000001",
    displayName: "김담당",
  },
};
const locked = {
  ...draft,
  id: "da500000-0000-4000-8000-000000000002",
  businessDate: "2026-08-12",
  status: "LOCKED" as const,
  confirmedAt: "2026-08-12T12:00:00.000Z",
  evidence: [
    {
      fileVersionId: "da560000-0000-4000-8000-000000000001",
      displayName: "마감증빙.png",
    },
  ],
};
const capability = {
  hotelId,
  hotelName: "서울호텔",
  canRead: true,
  canManage: true,
  canConfirm: true,
  canCorrect: true,
  ownerView: false,
};
const references = {
  categories: [{ id: categoryId, name: "객실매출" }],
  paymentMethods: [{ id: paymentMethodId, name: "카드" }],
};
function render(node: ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      {node}
    </QueryClientProvider>,
  );
}
describe("daily sales workspace", () => {
  it("renders PC ledger and mobile action-first draft flow", () => {
    const html = render(
      <DailySalesWorkspace
        hotelId={hotelId}
        capability={capability}
        references={references}
        initialSales={[draft, locked]}
        initialSelected={draft}
      />,
    );
    expect(html).toContain("일매출 장부");
    expect(html).toContain("업무일");
    expect(html).toContain("총매출");
    expect(html).toContain("순매출");
    expect(html).toContain("임시저장");
    expect(html).toContain("확정");
    expect(html).toContain("날짜별 매출 카드");
    expect(html).toContain("135,000원");
  });
  it("shows correction instead of draft mutation for locked sales", () => {
    const html = render(
      <DailySalesWorkspace
        hotelId={hotelId}
        capability={capability}
        references={references}
        initialSales={[locked]}
        initialSelected={locked}
      />,
    );
    expect(html).toContain("정정 등록");
    expect(html).toContain("마감증빙.png 보기");
    expect(html).toContain(
      `/api/hotels/${hotelId}/daily-sales/${locked.id}/files/${locked.evidence[0]!.fileVersionId}/view`,
    );
    expect(html).not.toContain(">임시저장</button>");
    expect(html).not.toContain(">확정</button>");
  });
  it("keeps owner projection read-only without private fields", () => {
    const owner = {
      id: locked.id,
      hotelId,
      businessDate: locked.businessDate,
      status: "LOCKED" as const,
      version: locked.version,
      totals: locked.totals,
      lines: locked.lines,
      evidence: locked.evidence,
      corrections: [],
      confirmedAt: locked.confirmedAt!,
      updatedAt: locked.updatedAt,
    };
    const html = render(
      <DailySalesWorkspace
        hotelId={hotelId}
        capability={{
          ...capability,
          canManage: false,
          canConfirm: false,
          canCorrect: false,
          ownerView: true,
        }}
        references={references}
        initialSales={[owner]}
        initialSelected={owner}
      />,
    );
    expect(html).not.toContain("내부 메모");
    expect(html).not.toContain("작성자");
    expect(html).not.toContain("정정 등록");
  });
  it("keeps forbidden direct routes on not-found path", () => {
    const source = readFileSync(
      new URL("../app/hotels/[hotelId]/daily-sales/page.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      '["FORBIDDEN", "RESOURCE_NOT_FOUND"].includes(result.code)',
    );
    expect(source).toContain("notFound();");
  });
});
