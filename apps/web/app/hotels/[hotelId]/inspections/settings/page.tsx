import { notFound } from "next/navigation";
import { InspectionConfigurationPanel } from "../../../../../components/inspections/inspection-configuration-panel";
import { fetchInspectionConfiguration } from "../../../../../lib/server-inspections";
import { fetchRoomInitialData } from "../../../../../lib/server-rooms";

function Failure({ message }: { message: string }) {
  return (
    <section
      className="rounded-panel border border-border bg-surface p-6"
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
  const [configuration, roomData] = await Promise.all([
    fetchInspectionConfiguration(hotelId),
    fetchRoomInitialData(hotelId),
  ]);
  if (!configuration.ok && configuration.error === "RESOURCE_NOT_FOUND")
    notFound();
  if (!configuration.ok) return <Failure message={configuration.error} />;
  if (!roomData.ok) return <Failure message={roomData.error.message} />;
  return (
    <InspectionConfigurationPanel
      hotelId={hotelId}
      initialChecklist={configuration.checklist}
      processDefinitions={configuration.definitions}
      reviewerCandidates={configuration.reviewerCandidates}
      roomTypes={roomData.data.roomTypes}
    />
  );
}
