export type LogicalMutationOperation = { body: unknown; path: string };

function canonicalOperationValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalOperationValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalOperationValue(nested)]),
    );
  return value;
}

function logicalOperationIdentity(operation: LogicalMutationOperation) {
  return `${operation.path}\u0000${JSON.stringify(canonicalOperationValue(operation.body))}`;
}

export function createLogicalIdempotencyKeyStore(
  generate: () => string = () => crypto.randomUUID(),
) {
  const keys = new Map<string, string>();
  return {
    acquire(operation: LogicalMutationOperation) {
      const identity = logicalOperationIdentity(operation);
      const current = keys.get(identity);
      if (current) return current;
      const created = generate();
      keys.set(identity, created);
      return created;
    },
    complete(operation: LogicalMutationOperation) {
      keys.delete(logicalOperationIdentity(operation));
    },
    settle(operation: LogicalMutationOperation, definitive: boolean) {
      if (definitive) keys.delete(logicalOperationIdentity(operation));
    },
  };
}
