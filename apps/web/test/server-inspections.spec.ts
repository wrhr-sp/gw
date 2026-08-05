import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "" }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../lib/api-transport", () => ({ fetchApi }));

import {
  fetchInspectionConfiguration,
  fetchInspectionExecutions,
  fetchInspectionReviews,
} from "../lib/server-inspections";

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


describe("inspection review SSR structured errors", () => {
  const envelope = (code: string, message: string, retryable: boolean) => ({
    data: null,
    error: { code, fieldErrors: [], message, retryable, retryAfterSeconds: null,
      traceId: "9f000000-0000-4000-8000-000000000001" },
    ok: false,
  });

  it("preserves list RESOURCE_NOT_FOUND for the route 404 branch", async () => {
    fetchApi.mockResolvedValueOnce(Response.json(envelope("RESOURCE_NOT_FOUND", "호텔 없음", false), { status: 404 }));
    await expect(fetchInspectionReviews(hotelId)).resolves.toMatchObject({
      code: "RESOURCE_NOT_FOUND", error: "RESOURCE_NOT_FOUND", message: "호텔 없음", ok: false, retryable: false,
    });
  });

  it("preserves a retryable list error", async () => {
    fetchApi.mockResolvedValueOnce(Response.json(envelope("INTERNAL_ERROR", "잠시 후 재시도", true), { status: 503 }));
    await expect(fetchInspectionReviews(hotelId)).resolves.toMatchObject({
      code: "INTERNAL_ERROR", error: "잠시 후 재시도", message: "잠시 후 재시도", ok: false, retryable: true,
    });
  });

  it("preserves a structured detail error", async () => {
    fetchApi.mockResolvedValueOnce(Response.json({ data: {
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      reviews: [{ id: "91000000-0000-4000-8000-000000000001", hotelId,
        source: "ROUTINE", businessDate: "2026-08-03", dueAt: "2026-08-03T14:59:59.999Z",
        targetSummary: "703호", itemCount: 1, abnormalCount: 1, cautionCount: 0,
        process: { executionId: "92000000-0000-4000-8000-000000000001", version: 2,
          currentStageName: "관리자 검토", reviewer: { id: "20000000-0000-4000-8000-000000000001", displayName: "김검토" },
          delegate: null, dueAt: null, overdue: false } }],
    }, error: null, ok: true }));
    fetchApi.mockResolvedValueOnce(Response.json(envelope("FORBIDDEN", "상세 권한 없음", false), { status: 403 }));
    await expect(fetchInspectionReviews(hotelId)).resolves.toMatchObject({
      code: "FORBIDDEN", error: "상세 권한 없음", message: "상세 권한 없음", ok: false, retryable: false,
    });
  });
});

describe("inspection configuration SSR v2 fetch", () => {
  it("reads the typed ROOM/FACILITY checklist from the additive v2 route", async () => {
    fetchApi.mockReset();
    fetchApi
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          data: {
            checklist: {
              id: "d8100000-0000-4000-8000-000000000001",
              hotelId,
              version: 2,
              reason: "시설물 점검항목",
              items: [
                {
                  itemId: "d8200000-0000-4000-8000-000000000001",
                  targetType: "FACILITY",
                  source: "TARGET_TYPE_ADDED",
                  facilityTypeId: "53000000-0000-4000-8000-000000000001",
                  excludedFacilityTypeIds: [],
                  name: "소화기 압력",
                  description: null,
                  isRequired: true,
                  displayOrder: 10,
                  defaultSeverity: "MAJOR",
                },
              ],
              createdBy: "2f000000-0000-4000-8000-000000000001",
              createdAt: "2026-08-04T00:00:00.000Z",
            },
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true, data: { definitions: [] }, error: null }),
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true, data: { default: null }, error: null }),
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true, data: { candidates: [] }, error: null }),
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true, data: { routines: [] }, error: null }),
      );

    await expect(fetchInspectionConfiguration(hotelId)).resolves.toMatchObject({
      ok: true,
      checklist: {
        items: [{ targetType: "FACILITY", name: "소화기 압력" }],
      },
    });
    expect(fetchApi).toHaveBeenNthCalledWith(
      1,
      `/api/hotels/${hotelId}/inspection-checklist/v2`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("preserves a structured checklist error for route decisions", async () => {
    fetchApi.mockReset();
    fetchApi
      .mockResolvedValueOnce(
        Response.json(
          {
            ok: false,
            data: null,
            error: {
              code: "RESOURCE_NOT_FOUND",
              fieldErrors: [],
              message: "호텔을 찾을 수 없습니다.",
              retryable: false,
              retryAfterSeconds: null,
              traceId: "9f000000-0000-4000-8000-000000000001",
            },
          },
          { status: 404 },
        ),
      )
      .mockResolvedValue(Response.json({ ok: true, data: {}, error: null }));

    await expect(fetchInspectionConfiguration(hotelId)).resolves.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      error: "RESOURCE_NOT_FOUND",
      message: "호텔을 찾을 수 없습니다.",
      ok: false,
      retryable: false,
    });
  });
});