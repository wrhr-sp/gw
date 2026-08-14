import { createPostgresFileFinalizerRepository } from "@werehere/db";
import { resolveDatabaseUrl, type ApiDatabaseBindings } from "../database";
import { createPrivateR2EvidenceStore, type PrivateR2Binding } from "./r2";
import {
  createFileScannerAgentService,
  FileScannerAgentError,
  type FileScannerAgentService,
} from "./scanner-agent";

export type FileScannerAgentBindings = ApiDatabaseBindings & {
  FILE_SCANNER_AGENT_TOKEN?: string;
  HOTEL_FILES?: PrivateR2Binding;
};

export function createFileScannerAgentServiceFromBindings(
  bindings: FileScannerAgentBindings | undefined,
): FileScannerAgentService {
  const databaseUrl = resolveDatabaseUrl(bindings, "API_RUNTIME");
  if (!databaseUrl || !bindings?.HOTEL_FILES) {
    throw new FileScannerAgentError("SCANNER_AGENT_NOT_CONFIGURED");
  }
  return createFileScannerAgentService({
    repository: createPostgresFileFinalizerRepository(databaseUrl),
    store: createPrivateR2EvidenceStore(bindings.HOTEL_FILES),
  });
}
