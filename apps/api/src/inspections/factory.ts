import { createPostgresInspectionRepository } from "@werehere/db";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";
import {
  createHotelFileService,
  createPrivateR2EvidenceStore,
  type HotelFileService,
  type PrivateR2Binding,
} from "../files/r2";
import {
  createInspectionService,
  InspectionServiceError,
  type InspectionService,
} from "./service";

export type InspectionBindings = DatabaseBindings & {
  HOTEL_FILES?: PrivateR2Binding;
};

function repository(bindings: InspectionBindings | undefined) {
  const databaseUrl = resolveDatabaseUrl(bindings, "API_RUNTIME");
  if (!databaseUrl) throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
  return createPostgresInspectionRepository(databaseUrl);
}

export function createInspectionServiceFromBindings(
  bindings: InspectionBindings | undefined,
): InspectionService {
  return createInspectionService(repository(bindings));
}

export function createHotelFileServiceFromBindings(
  bindings: InspectionBindings | undefined,
): HotelFileService {
  return createHotelFileService(
    repository(bindings),
    createPrivateR2EvidenceStore(bindings?.HOTEL_FILES),
  );
}
