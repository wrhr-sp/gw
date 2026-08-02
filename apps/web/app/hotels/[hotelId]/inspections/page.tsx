import { notFound } from "next/navigation";
import { InspectionExecutionWorkspace } from "../../../../components/inspections/inspection-execution-workspace";
import {
  fetchInspectionConfiguration,
  fetchInspectionExecutions,
} from "../../../../lib/server-inspections";
import { fetchRoomInitialData } from "../../../../lib/server-rooms";

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
  const [executions, configuration, roomData] = await Promise.all([
    fetchInspectionExecutions(hotelId),
    fetchInspectionConfiguration(hotelId),
    fetchRoomInitialData(hotelId),
  ]);
  if (!executions.ok && executions.error === "RESOURCE_NOT_FOUND") notFound();
  if (!executions.ok) return <Failure message={executions.error} />;
  if (!configuration.ok) return <Failure message={configuration.error} />;
  if (!roomData.ok) return <Failure message={roomData.error.message} />;

  return (
    <InspectionExecutionWorkspace
      checklistItems={(configuration.checklist?.items ?? []).map((item) => ({
        id: item.itemId,
        name: item.name,
      }))}
      hotelId={hotelId}
      initialInspections={executions.inspections}
      initialSelectedInspection={executions.selectedInspection}
      rooms={roomData.data.rooms.map((room) => ({
        floorLabel: room.floorLabel,
        id: room.id,
        roomNumber: room.roomNumber,
        status: room.status,
      }))}
    />
  );
}
