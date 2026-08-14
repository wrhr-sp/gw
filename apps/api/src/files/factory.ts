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
import {
  reconcileHotelFileEvidence,
  recoverExpiredHotelFileAccessGrants,
} from "./reconciler";

export type FileReconcilerBindings = ReconcilerDatabaseBindings & {
  FILE_PROCESSOR_CONTAINER?: {
    getByName(name: string): {
      fetch(request: Request): Promise<Response>;
      startAndWaitForPorts(options: {
        cancellationOptions: {
          instanceGetTimeoutMS: number;
          portReadyTimeoutMS: number;
          waitInterval: number;
        };
        ports: number;
      }): Promise<void>;
    };
  };
  FILE_PROCESSOR_SHARED_SECRET?: string;
  FILE_PROCESSOR_URL?: string;
  HOTEL_FILES?: PrivateR2Binding;
};

export async function recoverExpiredHotelFileAccessGrantsFromBindings(
  bindings: FileReconcilerBindings | undefined,
) {
  const databaseUrl = resolveDatabaseUrl(bindings, "RECONCILER");
  if (!databaseUrl) {
    throw new FileFinalizerError("FILE_FINALIZER_NOT_CONFIGURED");
  }
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

export async function reconcileHotelFileEvidenceFromBindings(
  bindings: FileReconcilerBindings | undefined,
) {
  const databaseUrl = resolveDatabaseUrl(bindings, "RECONCILER");
  const processorUrl = bindings?.FILE_PROCESSOR_URL?.trim();
  const processorSecret = bindings?.FILE_PROCESSOR_SHARED_SECRET?.trim();
  const container = bindings?.FILE_PROCESSOR_CONTAINER?.getByName("primary");
  if (
    !databaseUrl ||
    (!container && !processorUrl) ||
    !processorSecret ||
    !bindings?.HOTEL_FILES
  ) {
    throw new FileFinalizerError("FILE_FINALIZER_NOT_CONFIGURED");
  }
  const repository = createPostgresFileFinalizerRepository(databaseUrl);
  const finalizer = createHotelFileFinalizerService({
    processor: createHttpEvidenceFileProcessor({
      sharedSecret: processorSecret,
      ...(container ? { timeoutMs: 120_000 } : {}),
      url: container ? "https://file-processor.internal" : processorUrl!,
      ...(container
        ? {
            fetcher: async (request: Request) => {
              await container.startAndWaitForPorts({
                cancellationOptions: {
                  instanceGetTimeoutMS: 30_000,
                  portReadyTimeoutMS: 90_000,
                  waitInterval: 1_000,
                },
                ports: 8080,
              });
              return container.fetch(request);
            },
          }
        : {}),
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
