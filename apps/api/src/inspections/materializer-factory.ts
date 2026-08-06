import { createPostgresInspectionMaterializerRepository } from "@werehere/db";
import {
  resolveDatabaseUrl,
  type ReconcilerDatabaseBindings,
} from "../database";
import { reconcileInspectionMaterializations } from "./materializer";

export type InspectionMaterializerBindings = ReconcilerDatabaseBindings;

export async function reconcileInspectionMaterializationsFromBindings(
  bindings: InspectionMaterializerBindings | undefined,
) {
  const databaseUrl = resolveDatabaseUrl(bindings, "RECONCILER");
  if (!databaseUrl)
    throw new Error("INSPECTION_MATERIALIZER_NOT_CONFIGURED");
  const repository = createPostgresInspectionMaterializerRepository(databaseUrl);
  try {
    return await reconcileInspectionMaterializations({
      batchSize: 100,
      repository,
    });
  } finally {
    await repository.close();
  }
}
