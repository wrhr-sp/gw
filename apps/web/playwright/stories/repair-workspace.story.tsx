import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { RepairWorkspace } from "../../components/repairs/repair-workspace";

const hotelId = "50000000-0000-4000-8000-000000000001";
const repair = {
  createdAt: "2026-08-06T12:00:00.000Z",
  followUpCount: 0,
  hotelId,
  id: "a1000000-0000-4000-8000-000000000001",
  predecessor: null,
  priority: { color: "RED", id: "a3000000-0000-4000-8000-000000000001", name: "긴급", sortOrder: 1, version: 1 },
  process: { currentStageName: null, executionId: "a5000000-0000-4000-8000-000000000001", state: "PENDING_INPUT" as const, version: 1 },
  source: { description: "욕실 누수", fileVersionIds: [] as string[], type: "DIRECT" as const, unavailableReason: "촬영 장비 고장" },
  status: "OPEN" as const,
  target: { facilityTypeName: null, id: "52000000-0000-4000-8000-000000000001", locationName: null, name: "703호", type: "ROOM" as const },
  updatedAt: "2026-08-06T12:00:00.000Z",
  version: 1,
  visits: [],
};

export function RepairWorkspaceStory() {
  const [client] = React.useState(() => new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  }));
  return (
    <QueryClientProvider client={client}>
      <RepairWorkspace
        assignments={[]}
        facilityData={{
          commonAreas: [],
          facilities: [],
          roomLocations: [{ id: repair.target.id, name: repair.target.name }],
        }}
        hotelId={hotelId}
        initialRepairs={[repair]}
        initialSelected={repair}
        priorities={[{ ...repair.priority, status: "ACTIVE" }]}
      />
    </QueryClientProvider>
  );
}
