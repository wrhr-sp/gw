import { createPostgresFileFinalizerRepository } from "@werehere/db";
import {
  resolveDatabaseUrl,
  type ReconcilerDatabaseBindings,
} from "../database";
import {
  createHotelFileFinalizerService,
  FileFinalizerError,
} from "./finalizer";
import { createHttpEvidenceFileProcessor } from "./processor-client";
import { createPrivateR2EvidenceStore, type PrivateR2Binding } from "./r2";
import { reconcileHotelFileEvidence } from "./reconciler";

export type FileReconcilerBindings = ReconcilerDatabaseBindings & {
  FILE_PROCESSOR_SHARED_SECRET?: string;
  FILE_PROCESSOR_URL?: string;
  HOTEL_FILES?: PrivateR2Binding;
};

export async function reconcileHotelFileEvidenceFromBindings(
  bindings: FileReconcilerBindings | undefined,
) {
  const databaseUrl = resolveDatabaseUrl(bindings, "RECONCILER");
  const processorUrl = bindings?.FILE_PROCESSOR_URL?.trim();
  const processorSecret = bindings?.FILE_PROCESSOR_SHARED_SECRET?.trim();
  if (!databaseUrl || !processorUrl || !processorSecret || !bindings?.HOTEL_FILES) {
    throw new FileFinalizerError("FILE_FINALIZER_NOT_CONFIGURED");
  }
  const repository = createPostgresFileFinalizerRepository(databaseUrl);
  const finalizer = createHotelFileFinalizerService({
    processor: createHttpEvidenceFileProcessor({
      sharedSecret: processorSecret,
      url: processorUrl,
    }),
    repository,
    store: createPrivateR2EvidenceStore(bindings.HOTEL_FILES),
  });
  try {
    return await reconcileHotelFileEvidence({
      batchSize: 25,
      finalizer,
      repository,
    });
  } finally {
    await finalizer.close?.();
  }
}
