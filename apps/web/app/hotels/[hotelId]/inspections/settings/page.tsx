import { notFound } from "next/navigation";
import { InspectionConfigurationPanel } from "../../../../../components/inspections/inspection-configuration-panel";
import { fetchInspectionConfiguration } from "../../../../../lib/server-inspections";
import { fetchAllFacilityInspectionData } from "../../../../../lib/server-facilities";
import { fetchAllRoomInspectionData } from "../../../../../lib/server-rooms";

function Failure({
  code,
  message,
  stage,
  status,
}: {
  code: string;
  message: string;
  stage: string;
  status: number;
}) {
  return (
    <section
      className="rounded-panel border border-border bg-surface p-6"
      data-error-code={code}
      data-error-stage={stage}
      data-error-status={status}
      role="alert"
    >
      <h1 className="text-lg font-semibold">점검 설정을 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
    </section>
  );
}

export default async function InspectionSettingsPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const [configuration, roomData, facilityData] = await Promise.all([
    fetchInspectionConfiguration(hotelId),
    fetchAllRoomInspectionData(hotelId),
    fetchAllFacilityInspectionData(hotelId),
  ]);
  if (!configuration.ok && configuration.code === "RESOURCE_NOT_FOUND")
    notFound();
  if (!configuration.ok)
    return (
      <Failure
        code={configuration.code}
        message={configuration.message}
        stage={`CONFIGURATION_${configuration.stage}`}
        status={configuration.status}
      />
    );
  if (!roomData.ok)
    return (
      <Failure
        code={roomData.error.code}
        message={roomData.error.message}
        stage="ROOMS"
        status={roomData.error.status}
      />
    );
  if (!facilityData.ok)
    return (
      <Failure
        code={facilityData.error.code}
        message={facilityData.error.message}
        stage="FACILITIES"
        status={facilityData.error.status}
      />
    );
  return (
    <InspectionConfigurationPanel
      hotelId={hotelId}
      facilities={facilityData.data.facilities}
      facilityTypes={facilityData.data.facilityTypes}
      initialChecklist={configuration.checklist}
      initialRoutines={configuration.routines}
      processDefinitions={configuration.definitions}
      reviewerCandidates={configuration.reviewerCandidates}
      rooms={roomData.data.rooms.map((room) => ({
        floorLabel: room.floorLabel,
        id: room.id,
        roomNumber: room.roomNumber,
        roomTypeId: room.roomType.id,
        status: room.status,
      }))}
      roomTypes={roomData.data.roomTypes}
    />
  );
}
