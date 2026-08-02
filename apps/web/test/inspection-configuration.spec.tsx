import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InspectionConfigurationPanel } from "../components/inspections/inspection-configuration-panel";

const hotelId = "50000000-0000-4000-8000-000000000001";

describe("inspection configuration panel", () => {
  it("renders an accessible empty checklist action without static success", () => {
    const markup = renderToStaticMarkup(
      <InspectionConfigurationPanel
        hotelId={hotelId}
        initialChecklist={null}
        processDefinitions={[]}
        roomTypes={[
          {
            id: "b1000000-0000-4000-8000-000000000001",
            name: "스탠다드",
            scope: "HOTEL",
            hotelId,
            displayOrder: 1,
            isActive: true,
            version: 1,
            createdAt: "2026-08-02T00:00:00.000Z",
            updatedAt: "2026-08-02T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(markup).toContain("점검항목 추가");
    expect(markup).toContain("체크리스트 저장");
    expect(markup).toContain('aria-live="polite"');
    expect(markup).not.toContain("저장하고 다시 확인했습니다");
  });
});
