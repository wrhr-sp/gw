import { fetchAllFacilityInspectionData } from "./server-facilities";
import { fetchInspectionConfiguration } from "./server-inspections";
import { fetchAllRoomInspectionData } from "./server-rooms";

type InspectionSettingsLoaders = {
  configuration: typeof fetchInspectionConfiguration;
  facilities: typeof fetchAllFacilityInspectionData;
  rooms: typeof fetchAllRoomInspectionData;
};

const inspectionSettingsLoaders: InspectionSettingsLoaders = {
  configuration: fetchInspectionConfiguration,
  facilities: fetchAllFacilityInspectionData,
  rooms: fetchAllRoomInspectionData,
};

export async function loadInspectionSettingsPageData(
  hotelId: string,
  loaders: InspectionSettingsLoaders = inspectionSettingsLoaders,
) {
  const configuration = await loaders.configuration(hotelId);
  if (!configuration.ok) return { configuration };
  const [roomData, facilityData] = await Promise.all([
    loaders.rooms(hotelId),
    loaders.facilities(hotelId),
  ]);
  return { configuration, roomData, facilityData };
}
