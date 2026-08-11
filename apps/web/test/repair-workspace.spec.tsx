import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RepairWorkspace } from "../components/repairs/repair-workspace";

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
