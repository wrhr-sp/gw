import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  idempotentSettingsPut,
  InquirySettingsPanel,
} from "../components/inquiries/inquiry-settings-panel";
import {
  idempotentFetch,
  InquiryWorkspace,
} from "../components/inquiries/inquiry-workspace";
const hotelId = "50000000-0000-4000-8000-000000000001",
  userId = "20000000-0000-4000-8000-000000000001",
  item = {
    id: "1a500000-0000-4000-8000-000000000001",
    hotelId,
    categoryCode: "SALES_SETTLEMENT" as const,
    categoryName: "매출·정산",
    title: "정산 문의",
    status: "ANSWERING" as const,
    version: 3,
    assignee: { displayName: "담당자" },
    messages: [
      {
        id: "1a510000-0000-4000-8000-000000000001",
        body: "공개 답변 준비 중입니다.",
        actor: { displayName: "담당자" },
        createdAt: "2026-08-15T00:00:00.000Z",
        visibility: "PUBLIC" as const,
        attachments: [],
      },
    ],
    answeredAt: null,
    closedAt: null,
    reopenUntil: null,
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
  };
function render(internal = false) {
  const selected = internal
    ? {
        ...item,
        assignee: { ...item.assignee, userId },
        messages: [
          ...item.messages.map((message) => ({
            ...message,
            actor: { ...message.actor, userId },
          })),
          {
            id: "1a520000-0000-4000-8000-000000000001",
            body: "내부 정산 확인",
            actor: { userId, displayName: "담당자" },
            createdAt: "2026-08-15T00:01:00.000Z",
            visibility: "INTERNAL" as const,
            attachments: [],
          },
        ],
        statusHistory: [],
      }
    : item;
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <InquiryWorkspace
        hotelId={hotelId}
        initialInquiries={[item]}
        initialSelected={selected}
        contact={{
          phone: "02-1234-5678",
          email: "hotel@example.com",
          operatingHours: "평일 09:00~18:00",
          version: 1,
        }}
        capability={{
          hotelId,
          hotelName: "서울호텔",
          ownerView: !internal,
          canRead: true,
          canCreate: !internal,
          canReply: internal,
          canAssign: internal,
          canManageSettings: false,
        }}
        settings={null}
        assignments={[]}
      />
    </QueryClientProvider>,
  );
}
describe("inquiry workspace", () => {
  it("renders PC master/detail, contact, guide, and action-first controls", () => {
    const html = render(false);
    expect(html).toContain("호텔 소유주 문의");
    expect(html).toContain("문의처");
    expect(html).toContain("정산 문의");
    expect(html).toContain("메시지 저장");
    expect(html).toContain("새 문의");
    expect(html).toContain('aria-controls="owner-inquiry-create-form"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("min-h-11");
  });
  it("exposes the collapsed settings panel state to assistive technology", () => {
    const html = renderToStaticMarkup(
      <InquirySettingsPanel
        hotelId={hotelId}
        capability={{
          hotelId,
          hotelName: "서울호텔",
          ownerView: false,
          canRead: true,
          canCreate: false,
          canReply: true,
          canAssign: true,
          canManageSettings: true,
        }}
        initialSettings={{ contact: null, groups: [], routes: [] }}
      />,
    );
    expect(html).toContain('aria-controls="owner-inquiry-settings-fields"');
    expect(html).toContain('aria-expanded="false"');
  });
  it("shows internal notes only in internal projection", () => {
    expect(render(true)).toContain("내부 정산 확인");
    expect(render(false)).not.toContain("내부 정산 확인");
  });
  it("wires the route and feature guide", () => {
    const page = readFileSync(
        new URL("../app/hotels/[hotelId]/inquiries/page.tsx", import.meta.url),
        "utf8",
      ),
      guide = readFileSync(
        new URL("../lib/feature-guides.ts", import.meta.url),
        "utf8",
      );
    expect(page).toContain("InquiryWorkspace");
    expect(guide).toContain("hotel-owner-inquiry.lifecycle");
  });
  it("retries a transient mutation with the same idempotency key and body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const response = await idempotentFetch(
        "/api/inquiries",
        { title: "정산" },
        "fixed-logical-operation-key",
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const first = fetchMock.mock.calls[0]?.[1],
        second = fetchMock.mock.calls[1]?.[1];
      expect(first?.body).toBe(second?.body);
      expect((first?.headers as Record<string, string>)["Idempotency-Key"]).toBe(
        "fixed-logical-operation-key",
      );
      expect((second?.headers as Record<string, string>)["Idempotency-Key"]).toBe(
        "fixed-logical-operation-key",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("retries settings with the same logical key and serialized body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { contact: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await idempotentSettingsPut(
        "/api/inquiry-settings",
        { version: 1, phone: "02-1234-5678" },
        "fixed-settings-key",
      );
      const first = fetchMock.mock.calls[0]?.[1],
        second = fetchMock.mock.calls[1]?.[1];
      expect(first?.body).toBe(second?.body);
      expect((first?.headers as Record<string, string>)["Idempotency-Key"]).toBe(
        "fixed-settings-key",
      );
      expect((second?.headers as Record<string, string>)["Idempotency-Key"]).toBe(
        "fixed-settings-key",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("includes hotelId when polling an inquiry upload", () => {
    const source = readFileSync(
      new URL(
        "../components/inquiries/inquiry-workspace.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain(
      "`${hotelFileRoutes.uploadStatus(init.data.data.upload.id)}?hotelId=${encodeURIComponent(hotelId)}`",
    );
  });
  it("uses a role-compatible live status element when inquiry contact is absent", () => {
    const source = readFileSync(
      new URL("../components/inquiries/inquiry-workspace.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      '<div\n          className="rounded-panel border border-warning/40 bg-warning/5 p-4 text-sm"\n          role="status"',
    );
    expect(source).not.toContain(
      '<aside\n          className="rounded-panel border border-warning/40 bg-warning/5 p-4 text-sm"\n          role="status"',
    );
  });
  it("selects only an inquiry id present in the authorized server list", () => {
    const pageSource = readFileSync(
      new URL("../app/hotels/[hotelId]/inquiries/page.tsx", import.meta.url),
      "utf8",
    );
    const serverSource = readFileSync(
      new URL("../lib/server-inquiries.ts", import.meta.url),
      "utf8",
    );
    expect(pageSource).toContain("fetchInquiries(hotelId, inquiryId)");
    expect(pageSource).toContain("data-error-stage={result.stage}");
    expect(serverSource).toContain("async function requestCriticalList(path: string)");
    expect(serverSource).toContain("response.status >= 500 ? request(path) : response");
    expect(serverSource).toContain("const listResponse = await requestCriticalList(");
    for (const stage of ["LIST_REQUEST", "LIST_PARSE", "SETTINGS", "DETAIL_REQUEST", "DETAIL_RESPONSE"])
      expect(serverSource).toContain(`stage: "${stage}" as const`);
    expect(serverSource).toContain("list.data.data.inquiries.find(");
    expect(serverSource).toContain(
      "(inquiry) => inquiry.id === preferredInquiryId",
    );
  });
  it("links create field errors, focuses the first invalid field, and preserves pending action identity", () => {
    const source = readFileSync(
      new URL("../components/inquiries/inquiry-workspace.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("noValidate");
    expect(source).toContain('id="inquiry-create-title-error"');
    expect(source).toContain('id="inquiry-create-body-error"');
    expect(source).toContain('aria-invalid={Boolean(createForm.formState.errors.title)}');
    expect(source).toContain('createForm.setFocus("title")');
    expect(source).toContain("pendingActionsRef.current.get(key)");
    expect(source).toContain("pending.idempotencyKey");
    expect(source).toContain("pendingActionsRef.current.delete(key)");
  });
});
