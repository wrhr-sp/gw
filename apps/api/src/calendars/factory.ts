import { createPostgresCalendarRepository } from "@werehere/db";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";
import { CalendarServiceError, createCalendarService, type CalendarService } from "./service";

export type CalendarBindings = DatabaseBindings;
export function createCalendarServiceFromBindings(bindings: CalendarBindings | undefined): CalendarService {
  const databaseUrl = resolveDatabaseUrl(bindings, "API_RUNTIME");
  if (!databaseUrl) throw new CalendarServiceError("DB_NOT_CONFIGURED", 503);
  return createCalendarService(createPostgresCalendarRepository(databaseUrl));
}
