import { createPostgresRepairRepository } from "@werehere/db";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";
import { createRepairService, RepairServiceError, type RepairService } from "./service";

export type RepairBindings = DatabaseBindings;
export function createRepairServiceFromBindings(bindings: RepairBindings | undefined): RepairService {
  const databaseUrl=resolveDatabaseUrl(bindings,"API_RUNTIME");
  if(!databaseUrl) throw new RepairServiceError("DB_NOT_CONFIGURED",503);
  return createRepairService(createPostgresRepairRepository(databaseUrl));
}
