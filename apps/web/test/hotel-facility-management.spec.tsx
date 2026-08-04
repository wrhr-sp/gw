import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FacilityManagementPanel } from "../components/hotels/facility-management-panel";
import type { FacilityInitialData } from "../lib/server-facilities";

const hotelId = "50000000-0000-4000-8000-000000000001";
const timestamps = {
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};
const initialData: FacilityInitialData = {
  capabilities: { canManage: true },
  commonAreas: [
    {
      id: "57000000-0000-4000-8000-000000000001",
      hotelId,
      name: "1층 로비",
      status: "ACTIVE",
      version: 1,
      ...timestamps,
    },
  ],
  facilityTypes: [
    {
      id: "58000000-0000-4000-8000-000000000001",
      hotelId,
      name: "소방설비",
      status: "ACTIVE",
      version: 1,
      ...timestamps,
    },
  ],
  facilities: [
    {
      id: "59000000-0000-4000-8000-000000000001",
      hotelId,
      name: "101호 연기감지기",
      facilityType: {
        id: "58000000-0000-4000-8000-000000000001",
        name: "소방설비",
        status: "ACTIVE",
      },
      location: {
        type: "ROOM",
        roomId: "55000000-0000-4000-8000-000000000001",
        name: "101",
      },
      status: "ACTIVE",
      version: 1,
      ...timestamps,
    },
  ],
  roomLocations: [{ id: "55000000-0000-4000-8000-000000000001", name: "101" }],
  pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};
const source = readFileSync(
  new URL(
    "../components/hotels/facility-management-panel.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("hotel facility management panel", () => {
  it("renders one canonical dataset as a desktop table and mobile action cards", () => {
    const html = renderToStaticMarkup(
      <FacilityManagementPanel hotelId={hotelId} initialData={initialData} />,
    );

    expect(html).toContain('id="hotel-facility-management"');
    expect(html).toContain("시설물 기준정보");
    expect(html).toContain("101호 연기감지기");
    expect(html).toContain("소방설비");
    expect(html).toContain("객실");
    expect(html).toContain("101");
    expect(html).toContain("hidden md:block");
    expect(html).toContain("md:hidden");
    expect(html).toContain("시설물 등록");
  });

  it("does not expose mutation controls to a read-only viewer", () => {
    const html = renderToStaticMarkup(
      <FacilityManagementPanel
        hotelId={hotelId}
        initialData={{
          ...initialData,
          capabilities: { canManage: false },
        }}
      />,
    );

    expect(html).not.toContain("시설물 등록");
    expect(html).not.toContain(">수정<");
    expect(html).not.toContain(">상태변경<");
    expect(html).toContain("101호 연기감지기");
  });

  it("binds forms, schemas, server mutations, rereads, and idempotency", () => {
    expect(source).toContain("useForm<FacilityForm>");
    expect(source).toContain("createHotelFacilityRequestSchema");
    expect(source).toContain("updateHotelFacilityRequestSchema");
    expect(source).toContain("useMutation");
    expect(source).toContain("refetchQueries");
    expect(source).toContain("useOperationIdentity");
    expect(source).toContain("readCanonicalResource");
    expect(source).toContain("assertMaterialReadback");
    expect(source).toContain("useReactTable");
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('event.key === "ArrowRight"');
  });
});
