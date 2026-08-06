import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InspectionExecutionWorkspace } from "../components/inspections/inspection-execution-workspace";

const hotelId = "50000000-0000-4000-8000-000000000001";
const facilityId = "52000000-0000-4000-8000-000000000001";
const targetId = "52000000-0000-4000-8000-000000000002";
const inspectionId = "91000000-0000-4000-8000-000000000001";
const workspaceSource = readFileSync(
  new URL(
    "../components/inspections/inspection-execution-workspace.tsx",
    import.meta.url,
  ),
  "utf8",
);

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
  targets: [
    {
      id: targetId,
      type: "FACILITY" as const,
      facilityId,
      facilityNameSnapshot: "보일러 1호기",
      facilityTypeNameSnapshot: "보일러",
      facilityLocationNameSnapshot: "지하 1층 기계실",
    },
  ],
  items: [
    {
      id: "95000000-0000-4000-8000-000000000001",
      executionTargetId: targetId,
      targetType: "FACILITY" as const,
      itemId: "96000000-0000-4000-8000-000000000001",
      name: "압력 계기 확인",
      description: "압력과 누수를 확인합니다.",
      isRequired: true,
      displayOrder: 10,
      defaultSeverity: "MAJOR" as const,
      result: null,
    },
  ],
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
};

describe("InspectionExecutionWorkspace", () => {
  it("binds retry identity to the request target and preserves collapsed manual drafts", () => {
    expect(workspaceSource).toContain(
      "previous?.inspectionId === inspection.id && previous.body === body",
    );
    expect(workspaceSource).toContain(
      "onClick={() => setManualOpen((current) => !current)}",
    );
    expect(workspaceSource).not.toContain(
      "if (current) manualOperation.current = null",
    );
    expect(workspaceSource).toContain(
      "pagination.totalPages !== totalPages",
    );
    for (const fingerprintCheck of [
      "pagination.page !== page",
      "pagination.pageSize !== expectedPageSize",
      "pagination.total !== expectedTotal",
      "pagination.totalPages !== totalPages",
    ]) {
      expect(workspaceSource).toContain(fingerprintCheck);
    }
    expect(workspaceSource).toContain(
      "setSubmitErrorSequence((current) => current + 1)",
    );
    expect(workspaceSource).toContain("[submitError, submitErrorSequence]");
  });

  it("renders canonical routine work and mobile-first item controls", () => {
    const html = renderToStaticMarkup(
      <InspectionExecutionWorkspace
        checklistItems={[
          {
            excludedFacilityTypeIds: [],
            excludedRoomTypeIds: [],
            facilityTypeId: null,
            id: inspection.items[0]!.itemId,
            name: "압력 계기 확인",
            roomTypeId: null,
            source: "HOTEL_COMMON",
            targetType: "FACILITY",
          },
        ]}
        facilities={[
          {
            id: facilityId,
            locationName: "지하 1층 기계실",
            name: "보일러 1호기",
            status: "ACTIVE",
            typeId: "53000000-0000-4000-8000-000000000001",
            typeName: "보일러",
          },
        ]}
        hotelId={hotelId}
        initialInspections={[inspection]}
        initialSelectedInspection={inspection}
        rooms={[]}
      />,
    );
    expect(html).toContain("오늘 점검");
    expect(html).toContain("보일러 1호기");
    expect(html).toContain("보일러");
    expect(html).toContain("지하 1층 기계실");
    expect(html).toContain("압력 계기 확인");
    expect(html).toContain("정상");
    expect(html).toContain("주의");
    expect(html).toContain("이상");
    expect(html).toContain("저장하고 다음");
    expect(html).toContain("변경사항 저장");
    expect(html).toContain("점검 사진");
    expect(html).toContain("이상 결과를 선택하면 현장 사진을 추가할 수 있습니다");
    expect(html).toContain("검역 통과 사진만 저장됩니다");
    expect(html).toContain("점검 제출");
  });
});
