import { createPostgresHotelRepository } from "@werehere/db";
import { createHotelService, HotelServiceError, type HotelService } from "./service";

export type HotelBindings = {
  DATABASE_URL?: string;
};

export function createHotelServiceFromBindings(bindings: HotelBindings | undefined): HotelService {
  const databaseUrl = bindings?.DATABASE_URL?.trim();
  if (!databaseUrl) throw new HotelServiceError("DB_NOT_CONFIGURED", 503, false);
  return createHotelService(createPostgresHotelRepository(databaseUrl));
}
