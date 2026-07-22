export type HyperdriveBinding = {
  connectionString: string;
};

export type ApiDatabaseBindings = {
  API_RUNTIME_DATABASE_URL?: string;
  API_HYPERDRIVE?: HyperdriveBinding;
};

export type ReconcilerDatabaseBindings = {
  RECONCILER_DATABASE_URL?: string;
  RECONCILER_HYPERDRIVE?: HyperdriveBinding;
};

export type DatabasePurpose = "API_RUNTIME" | "RECONCILER";
export type DatabaseBindings = ApiDatabaseBindings & ReconcilerDatabaseBindings;

export function resolveDatabaseUrl(
  bindings: Partial<DatabaseBindings> | undefined,
  purpose: DatabasePurpose,
): string | undefined {
  const hyperdrive = purpose === "API_RUNTIME"
    ? bindings?.API_HYPERDRIVE
    : bindings?.RECONCILER_HYPERDRIVE;
  const hyperdriveUrl = hyperdrive?.connectionString?.trim();
  if (hyperdriveUrl) return hyperdriveUrl;

  const directUrl = purpose === "API_RUNTIME"
    ? bindings?.API_RUNTIME_DATABASE_URL?.trim()
    : bindings?.RECONCILER_DATABASE_URL?.trim();
  return directUrl || undefined;
}
