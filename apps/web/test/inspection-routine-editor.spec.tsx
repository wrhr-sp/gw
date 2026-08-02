import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InspectionRoutineEditor } from "../components/inspections/inspection-routine-editor";

const hotelId = "50000000-0000-4000-8000-000000000001";
const checklistRevisionId = "87000000-0000-4000-8000-000000000001";
const definitions = [
  { id: "85000000-0000-4000-8000-000000000001", name: "객실점검 검토" },
];
const roomTypes = [
  {
    id: "89000000-0000-4000-8000-000000000001",
    hotelId: null,
    name: "스탠다드",
    scope: "COMPANY" as const,
    displayOrder: 10,
    isActive: true,
    version: 1,
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
  },
];
const rooms = [
  {
    id: "8a000000-0000-4000-8000-000000000001",
    roomNumber: "301",
    floorLabel: "3층",
    roomTypeId: roomTypes[0]!.id,
    status: "ACTIVE",
  },
];

describe("inspection routine editor", () => {
  it("renders an honest empty configuration with disabled persistence until prerequisites exist", () => {
    const markup = renderToStaticMarkup(
      <InspectionRoutineEditor
        checklistRevisionId={null}
        definitions={definitions}
        hotelId={hotelId}
        initialRoutines={[]}
        rooms={rooms}
        roomTypes={roomTypes}
      />,
    );
    expect(markup).toContain("정기점검 루틴");
    expect(markup).toContain("체크리스트 revision 미설정");
    expect(markup).toContain("등록된 정기점검 루틴이 없습니다.");
    expect(markup).toContain(
      "해당 날짜가 없는 달은 마지막 날로 당기지 않고 건너뜁니다.",
    );
    expect(markup).toContain("disabled");
    expect(markup).not.toContain("저장하고 다시 확인했습니다");
  });

  it("renders canonical routine cards and real schedule controls", () => {
    const markup = renderToStaticMarkup(
      <InspectionRoutineEditor
        checklistRevisionId={checklistRevisionId}
        definitions={definitions}
        hotelId={hotelId}
        initialRoutines={[
          {
            id: "83000000-0000-4000-8000-000000000001",
            hotelId,
            name: "월말 객실점검",
            status: "ACTIVE",
            version: 2,
            nextDueDate: "2026-08-31",
            materializedThroughDate: null,
            revision: {
              id: "84000000-0000-4000-8000-000000000001",
              version: 2,
              mode: "FIXED",
              recurrence: { type: "MONTHLY", dayOfMonth: 31 },
              startDate: "2026-08-01",
              endDate: null,
              localDueTime: "15:00",
              processDefinitionId: definitions[0]!.id,
              processRevisionId: "86000000-0000-4000-8000-000000000001",
              checklistRevisionId,
              rounds: [
                {
                  id: "88000000-0000-4000-8000-000000000001",
                  order: 1,
                  target: { type: "HOTEL" },
                },
              ],
            },
            createdAt: "2026-08-02T00:00:00.000Z",
            updatedAt: "2026-08-02T00:00:00.000Z",
          },
        ]}
        rooms={rooms}
        roomTypes={roomTypes}
      />,
    );
    expect(markup).toContain("월말 객실점검");
    expect(markup).toContain("다음 기준일 2026-08-31");
    expect(markup).toContain("루틴 이름");
    expect(markup).toContain("호텔 현지 완료시각");
    expect(markup).toContain("호텔 전체");
    expect(markup).toContain("객실유형");
    expect(markup).toContain("개별 객실");
    expect(markup).toContain("루틴 생성");
  });
});
