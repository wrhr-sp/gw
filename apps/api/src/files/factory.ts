import { createPostgresFileFinalizerRepository } from "@werehere/db";
import {
  resolveDatabaseUrl,
  type ReconcilerDatabaseBindings,
} from "../database";
import { recoverExpiredHotelFileAccessGrants } from "./reconciler";

export type FileReconcilerBindings = ReconcilerDatabaseBindings;

export async function recoverExpiredHotelFileAccessGrantsFromBindings(
  bindings: FileReconcilerBindings | undefined,
) {
  const databaseUrl = resolveDatabaseUrl(bindings, "RECONCILER");
  if (!databaseUrl) throw new Error("FILE_ACCESS_RECOVERY_NOT_CONFIGURED");
  const repository = createPostgresFileFinalizerRepository(databaseUrl);
  try {
    return await recoverExpiredHotelFileAccessGrants({
      batchSize: 500,
      repository,
    });
  } finally {
    await repository.close();
  }
}
