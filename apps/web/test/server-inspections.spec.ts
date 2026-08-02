import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "" }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../lib/api-transport", () => ({ fetchApi }));

import { fetchInspectionExecutions } from "../lib/server-inspections";

const hotelId = "50000000-0000-4000-8000-000000000001";

function execution(id: string, roomNumber: string) {
  return {
    id,
    hotelId,
    source: "ROUTINE" as const,
    businessDate: "2026-08-03",
    dueAt: "2026-08-03T14:59:59.999Z",
    status: "PENDING_INPUT" as const,
    version: 1,
    process: {
      executionId: id.replace(/^91/u, "92"),
      definitionId: "93000000-0000-4000-8000-000000000001",
      revisionId: "94000000-0000-4000-8000-000000000001",
      currentStageKey: null,
      currentStageName: null,
      state: "PENDING_INPUT" as const,
      version: 1,
    },
    rooms: [
      {
        id: id.replace(/^91/u, "52"),
        roomNumber,
        floorLabel: "7층",
        roomTypeName: "스탠다드 더블",
      },
    ],
    items: [
      {
        id: id.replace(/^91/u, "95"),
        roomId: id.replace(/^91/u, "52"),
        itemId: "96000000-0000-4000-8000-000000000001",
        name: "욕실 청결",
        description: null,
        isRequired: true,
        displayOrder: 10,
        defaultSeverity: "MAJOR" as const,
        result: null,
      },
    ],
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
  };
}

function summary(value: ReturnType<typeof execution>) {
  const { items: _items, ...result } = value;
  void _items;
  return result;
}

describe("inspection execution SSR fetch", () => {
  const first = execution("91000000-0000-4000-8000-000000000001", "703");
  const second = execution("91000000-0000-4000-8000-000000000002", "704");

  beforeEach(() => {
    fetchApi.mockReset();
    fetchApi.mockImplementation(async (path: string) => {
      if (path.includes("?page=1&"))
        return Response.json({
          ok: true,
          data: {
            inspections: [summary(first)],
            pagination: { page: 1, pageSize: 100, total: 101, totalPages: 2 },
          },
          error: null,
        });
      if (path.includes("?page=2&"))
        return Response.json({
          ok: true,
          data: {
            inspections: [summary(second)],
            pagination: { page: 2, pageSize: 100, total: 101, totalPages: 2 },
          },
          error: null,
        });
      if (path.endsWith(`/inspections/${first.id}`))
        return Response.json({
          ok: true,
          data: { inspection: first },
          error: null,
        });
      return new Response(null, { status: 404 });
    });
  });

  it("loads every bounded list page before reading the first canonical detail", async () => {
    const result = await fetchInspectionExecutions(hotelId);

    expect(result).toMatchObject({
      ok: true,
      inspections: [{ id: first.id }, { id: second.id }],
      selectedInspection: { id: first.id, items: [{ name: "욕실 청결" }] },
    });
    expect(fetchApi).toHaveBeenCalledWith(
      `/api/hotels/${hotelId}/inspections?page=2&pageSize=100&status=PENDING_INPUT`,
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchApi).toHaveBeenLastCalledWith(
      `/api/hotels/${hotelId}/inspections/${first.id}`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
