import {
  createPostgresKnowledgeRepository,
  reconcileDueKnowledge,
} from "@werehere/db";
import {
  resolveDatabaseUrl,
  type DatabaseBindings,
  type ReconcilerDatabaseBindings,
} from "../database";
import {
  createKnowledgeService,
  KnowledgeServiceError,
  type KnowledgeService,
} from "./service";

export type KnowledgeBindings = DatabaseBindings;

function createKnowledgeRepositoryFromBindings(
  bindings: KnowledgeBindings | undefined,
) {
  const databaseUrl = resolveDatabaseUrl(bindings, "API_RUNTIME");
  if (!databaseUrl) throw new KnowledgeServiceError("DB_NOT_CONFIGURED", 503);
  return createPostgresKnowledgeRepository(databaseUrl);
}

export function createKnowledgeServiceFromBindings(
  bindings: KnowledgeBindings | undefined,
): KnowledgeService {
  return createKnowledgeService(createKnowledgeRepositoryFromBindings(bindings));
}

export async function reconcileDueKnowledgeFromBindings(
  bindings: ReconcilerDatabaseBindings | undefined,
) {
  const databaseUrl = resolveDatabaseUrl(bindings, "RECONCILER");
  if (!databaseUrl) throw new Error("KNOWLEDGE_RECONCILER_NOT_CONFIGURED");
  return reconcileDueKnowledge(databaseUrl, 100);
}
