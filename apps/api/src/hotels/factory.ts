import { createPostgresHotelRepository } from "@werehere/db";
import { createHotelService, HotelServiceError, type HotelService } from "./service";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";

export type HotelBindings = DatabaseBindings;

export function createHotelServiceFromBindings(bindings: HotelBindings | undefined): HotelService {
  const databaseUrl = resolveDatabaseUrl(bindings);
  if (!databaseUrl) throw new HotelServiceError("DB_NOT_CONFIGURED", 503, false);
  return createHotelService(createPostgresHotelRepository(databaseUrl));
}
