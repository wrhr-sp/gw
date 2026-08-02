import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InspectionExecutionWorkspace } from "../components/inspections/inspection-execution-workspace";

const hotelId = "50000000-0000-4000-8000-000000000001";
const roomId = "52000000-0000-4000-8000-000000000001";
const inspectionId = "91000000-0000-4000-8000-000000000001";

const inspection = {
  id: inspectionId,
  hotelId,
  source: "ROUTINE" as const,
  businessDate: "2026-08-03",
  dueAt: "2026-08-03T14:59:59.999Z",
  status: "PENDING_INPUT" as const,
  version: 1,
  process: {
    executionId: "92000000-0000-4000-8000-000000000001",
    definitionId: "93000000-0000-4000-8000-000000000001",
    revisionId: "94000000-0000-4000-8000-000000000001",
    currentStageKey: null,
    currentStageName: null,
    state: "PENDING_INPUT" as const,
    version: 1,
  },
  rooms: [
    {
      id: roomId,
      roomNumber: "703",
      floorLabel: "7층",
      roomTypeName: "스탠다드 더블",
    },
  ],
  items: [
    {
      id: "95000000-0000-4000-8000-000000000001",
      roomId,
      itemId: "96000000-0000-4000-8000-000000000001",
      name: "욕실 청결",
      description: "배수와 누수를 확인합니다.",
      isRequired: true,
      displayOrder: 10,
      defaultSeverity: "MAJOR" as const,
      result: null,
    },
  ],
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
};

describe("inspection execution workspace", () => {
  it("renders canonical routine work and mobile-first item controls", () => {
    const html = renderToStaticMarkup(
      <InspectionExecutionWorkspace
        checklistItems={[
          { id: inspection.items[0]!.itemId, name: "욕실 청결" },
        ]}
        hotelId={hotelId}
        initialInspections={[inspection]}
        initialSelectedInspection={inspection}
        rooms={[
          {
            floorLabel: "7층",
            id: roomId,
            roomNumber: "703",
            status: "ACTIVE",
          },
        ]}
      />,
    );
    expect(html).toContain("오늘 점검");
    expect(html).toContain("703호");
    expect(html).toContain("욕실 청결");
    expect(html).toContain("정상");
    expect(html).toContain("주의");
    expect(html).toContain("이상");
    expect(html).toContain("저장하고 다음");
    expect(html).toContain("변경사항 저장");
  });
});
