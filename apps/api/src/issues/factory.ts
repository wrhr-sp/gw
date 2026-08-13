import { createPostgresOperationalIssueRepository } from "@werehere/db";
import { resolveDatabaseUrl, type DatabaseBindings } from "../database";
import {
  createOperationalIssueService,
  OperationalIssueServiceError,
  type OperationalIssueService,
} from "./service";

export type OperationalIssueBindings = DatabaseBindings;

export function createOperationalIssueServiceFromBindings(
  bindings: OperationalIssueBindings | undefined,
): OperationalIssueService {
  const databaseUrl = resolveDatabaseUrl(bindings, "API_RUNTIME");
  if (!databaseUrl)
    throw new OperationalIssueServiceError("DB_NOT_CONFIGURED", 503);
  return createOperationalIssueService(
    createPostgresOperationalIssueRepository(databaseUrl),
  );
}
