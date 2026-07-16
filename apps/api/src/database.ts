export type HyperdriveBinding = {
  connectionString: string;
};

export type DatabaseBindings = {
  DATABASE_URL?: string;
  HYPERDRIVE?: HyperdriveBinding;
};

export function resolveDatabaseUrl(bindings: DatabaseBindings | undefined): string | undefined {
  const hyperdriveUrl = bindings?.HYPERDRIVE?.connectionString?.trim();
  if (hyperdriveUrl) return hyperdriveUrl;

  const directUrl = bindings?.DATABASE_URL?.trim();
  return directUrl || undefined;
}
