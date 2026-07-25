import { createPostgresRoomRepository } from "@werehere/db";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";
import {
  createRoomService,
  RoomServiceError,
  type RoomService,
} from "./service";

export type RoomBindings = DatabaseBindings;

export function createRoomServiceFromBindings(
  bindings: RoomBindings | undefined,
): RoomService {
  const databaseUrl = resolveDatabaseUrl(bindings, "API_RUNTIME");
  if (!databaseUrl) throw new RoomServiceError("DB_NOT_CONFIGURED", 503, false);
  return createRoomService(createPostgresRoomRepository(databaseUrl));
}
