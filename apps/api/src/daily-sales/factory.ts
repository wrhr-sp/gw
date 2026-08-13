import { createPostgresDailySalesRepository } from "@werehere/db";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";
import {
  createDailySalesService,
  DailySalesServiceError,
  type DailySalesService,
} from "./service";

export type DailySalesBindings = DatabaseBindings;

export function createDailySalesServiceFromBindings(
  bindings: DailySalesBindings | undefined,
): DailySalesService {
  const databaseUrl = resolveDatabaseUrl(bindings, "API_RUNTIME");
  if (!databaseUrl) throw new DailySalesServiceError("DB_NOT_CONFIGURED", 503);
  return createDailySalesService(createPostgresDailySalesRepository(databaseUrl));
}
