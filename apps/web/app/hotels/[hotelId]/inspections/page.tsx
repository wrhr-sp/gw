import { notFound } from "next/navigation";
import { InspectionExecutionWorkspace } from "../../../../components/inspections/inspection-execution-workspace";
import {
  fetchInspectionConfiguration,
  fetchInspectionExecutions,
} from "../../../../lib/server-inspections";
import { fetchAllFacilityInspectionData } from "../../../../lib/server-facilities";
import { fetchAllRoomInspectionData } from "../../../../lib/server-rooms";

function Failure({ message }: { message: string }) {
  return (
    <section
      className="rounded-panel border border-border bg-surface p-6"
      role="alert"
    >
      <h1 className="text-lg font-semibold">
        점검 수행 화면을 불러오지 못했습니다
      </h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
    </section>
  );
}

export default async function InspectionExecutionPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const [executions, configuration, roomData, facilityData] = await Promise.all([
    fetchInspectionExecutions(hotelId),
    fetchInspectionConfiguration(hotelId),
    fetchAllRoomInspectionData(hotelId),
    fetchAllFacilityInspectionData(hotelId),
  ]);
  if (!executions.ok && executions.error === "RESOURCE_NOT_FOUND") notFound();
  if (!executions.ok) return <Failure message={executions.error} />;
  if (!configuration.ok) return <Failure message={configuration.error} />;
  if (!roomData.ok) return <Failure message={roomData.error.message} />;
  if (!facilityData.ok)
    return <Failure message={facilityData.error.message} />;

  return (
    <InspectionExecutionWorkspace
      checklistItems={(configuration.checklist?.items ?? []).map((item) => ({
        excludedFacilityTypeIds:
          item.targetType === "FACILITY" ? item.excludedFacilityTypeIds : [],
        excludedRoomTypeIds:
          item.targetType === "ROOM" ? item.excludedRoomTypeIds : [],
        facilityTypeId:
          item.targetType === "FACILITY" ? item.facilityTypeId : null,
        id: item.itemId,
        name: item.name,
        roomTypeId: item.targetType === "ROOM" ? item.roomTypeId : null,
        source: item.source,
        targetType: item.targetType,
      }))}
      facilities={facilityData.data.facilities.map((facility) => ({
        id: facility.id,
        locationName: facility.location.name,
        name: facility.name,
        status: facility.status,
        typeId: facility.facilityType.id,
        typeName: facility.facilityType.name,
      }))}
      hotelId={hotelId}
      initialInspections={executions.inspections}
      initialSelectedInspection={executions.selectedInspection}
      rooms={roomData.data.rooms.map((room) => ({
        floorLabel: room.floorLabel,
        id: room.id,
        roomNumber: room.roomNumber,
        roomTypeId: room.roomType.id,
        status: room.status,
      }))}
    />
  );
}
