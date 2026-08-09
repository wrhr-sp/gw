import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { repairVisitResponseSchema } from "@werehere/contracts";
import { RepairWorkspace, requestMutation } from "../components/repairs/repair-workspace";
import { createLogicalIdempotencyKeyStore } from "../lib/logical-idempotency";

const hotelId = "50000000-0000-4000-8000-000000000001";
const repair = {
  id: "a1000000-0000-4000-8000-000000000001",
  hotelId,
  status: "OPEN" as const,
  version: 1,
  target: { type: "ROOM" as const, id: "52000000-0000-4000-8000-000000000001", name: "703호", facilityTypeName: null, locationName: null },
  priority: { id: "a3000000-0000-4000-8000-000000000001", version: 1, name: "긴급", sortOrder: 1, color: "RED" },
  source: { type: "DIRECT" as const, description: "욕실 누수", fileVersionIds: [], unavailableReason: "촬영 장비 고장" },
  process: { executionId: "a5000000-0000-4000-8000-000000000001", version: 1, state: "PENDING_INPUT" as const, currentStageName: null },
  visits: [],
  predecessor: null,
  followUpCount: 0,
  calendarProjectionStatus: "NOT_CONNECTED" as const,
  createdAt: "2026-08-06T12:00:00.000Z",
  updatedAt: "2026-08-06T12:00:00.000Z",
};
const workspaceData = {
  assignments: [],
  facilityData: {
    commonAreas: [],
    facilities: [],
    roomLocations: [{ id: repair.target.id, name: repair.target.name }],
  },
  priorities: [{ ...repair.priority, status: "ACTIVE" as const }],
};
function renderWorkspace(node: ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );
}

describe("repair workspace", () => {
  it("maps malformed successful receipts to a safe message and retains the uncertain key", async () => {
    const calls: string[] = [];
    const keys = createLogicalIdempotencyKeyStore(() => "repair-key-stable");
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      calls.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
      return Response.json({ data: {}, error: null, ok: true });
    });
    vi.stubGlobal("fetch", fetcher);
    try {
      for (let attempt = 0; attempt < 2; attempt += 1)
        await expect(
          requestMutation(
            keys,
            "/api/hotels/hotel/repairs/repair/visits",
            "POST",
            { title: "배관 점검" },
            repairVisitResponseSchema,
            "방문일정 응답을 안전하게 확인하지 못했습니다.",
          ),
        ).rejects.toThrow("방문일정 응답을 안전하게 확인하지 못했습니다.");
      expect(calls).toEqual(["repair-key-stable", "repair-key-stable"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("keeps one key for an uncertain repair operation and rotates after definitive completion", () => {
    let sequence = 0;
    const keys = createLogicalIdempotencyKeyStore(() => `repair-key-${++sequence}`);
    const operation = {
      path: "/api/hotels/hotel/repairs/repair/visits",
      body: { startsAt: "2026-08-08T01:00:00.000Z", title: "배관 점검" },
    };
    const first = keys.acquire(operation);
    keys.settle(operation, false);
    expect(keys.acquire({ path: operation.path, body: { ...operation.body } })).toBe(first);
    keys.settle(operation, true);
    expect(keys.acquire(operation)).not.toBe(first);
  });

  it("binds repair mutations to the shared logical-operation key store", () => {
    const source = readFileSync(
      new URL("../components/repairs/repair-workspace.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("idempotencyKeys.acquire(operation)");
    expect(source).toContain("idempotencyKeys.settle(operation, definitive)");
    expect(source).not.toContain('"Idempotency-Key": crypto.randomUUID()');
  });
  it("renders a PC master/detail and a mobile action-first repair card without provider UI", () => {
    const html = renderWorkspace(
      <RepairWorkspace {...workspaceData} hotelId={hotelId} initialRepairs={[repair]} initialSelected={repair} />,
    );
    expect(html).toContain("하자·보수");
    expect(html).toContain("703호");
    expect(html).toContain("긴급");
    expect(html).toContain("일정 미정");
    expect(html).toContain("보수 등록");
    expect(html).not.toContain("Google");
    expect(html).not.toContain("provider");
  });

  it("shows immediate predecessor and follow-up navigation as accessible actions", () => {
    const linked = {
      ...repair,
      predecessor: { id: "a0000000-0000-4000-8000-000000000001", targetName: "703호", completedAt: "2026-08-05T12:00:00.000Z" },
      followUpCount: 2,
    };
    const html = renderWorkspace(
      <RepairWorkspace {...workspaceData} hotelId={hotelId} initialRepairs={[linked]} initialSelected={linked} />,
    );
    expect(html).toContain("이전 보수 보기");
    expect(html).toContain("후속 보수 2건");
  });
});
