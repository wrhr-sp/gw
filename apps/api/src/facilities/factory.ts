import { createPostgresFacilityRepository } from "@werehere/db";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";
import { createFacilityService, FacilityServiceError, type FacilityService } from "./service";
export function createFacilityServiceFromBindings(bindings:DatabaseBindings|undefined):FacilityService{
 const databaseUrl=resolveDatabaseUrl(bindings,"API_RUNTIME");
 if(!databaseUrl) throw new FacilityServiceError("DB_NOT_CONFIGURED",503,false);
 return createFacilityService(createPostgresFacilityRepository(databaseUrl));
}
