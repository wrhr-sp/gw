import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { RepairWorkspace } from "../../components/repairs/repair-workspace";

const hotelId = "50000000-0000-4000-8000-000000000001";
const repair = {
  calendarProjectionStatus: "NOT_CONNECTED" as const,
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

const scheduledVisit = {
  calendarProjectionStatus: "NOT_CONNECTED" as const,
  endsAt: "2026-08-10T02:00:00.000Z",
  fileVersionIds: [] as string[],
  id: "b1000000-0000-4000-8000-000000000001",
  performer: { contactName: null, contactPhone: "010-0000-0000", contractorName: "승인된 보수업체", type: "EXTERNAL" as const },
  repairCaseId: repair.id,
  result: null,
  startsAt: "2026-08-10T01:00:00.000Z",
  status: "SCHEDULED" as const,
  title: "기존 배관 점검",
  unavailableReason: null,
  version: 1,
};

export function RepairWorkspaceStory({
  processState = "PENDING_INPUT",
  visitStatus = "SCHEDULED",
  withSecondVisit = false,
  withVisit = false,
}: {
  processState?: "COMPLETED" | "IN_REVIEW" | "PENDING_INPUT";
  visitStatus?: "CANCELLED" | "SCHEDULED";
  withSecondVisit?: boolean;
  withVisit?: boolean;
}) {
  const [client] = React.useState(() => new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  }));
  const initialRepair = withVisit ? {
    ...repair,
    process: { ...repair.process, state: processState },
    visits: [
      { ...scheduledVisit, status: visitStatus },
      ...(withSecondVisit ? [{ calendarProjectionStatus: "NOT_CONNECTED" as const, endsAt: "2026-08-11T02:00:00.000Z", fileVersionIds: [] as string[], id: "b1000000-0000-4000-8000-000000000002", performer: { contactName: null, contactPhone: "010-1111-1111", contractorName: "승인된 보수업체", type: "EXTERNAL" as const }, repairCaseId: repair.id, result: null, startsAt: "2026-08-11T01:00:00.000Z", status: "SCHEDULED" as const, title: "후속 배관 점검", unavailableReason: null, version: 1 }] : []),
    ],
  } : { ...repair, process: { ...repair.process, state: processState } };
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
        initialRepairs={[initialRepair]}
        initialSelected={initialRepair}
        priorities={[{ ...repair.priority, status: "ACTIVE" }]}
      />
    </QueryClientProvider>
  );
}
