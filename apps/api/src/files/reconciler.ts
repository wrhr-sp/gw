import type { FileFinalizerRepository } from "@werehere/db";

export async function recoverExpiredHotelFileAccessGrants(input: {
  batchSize: number;
  repository: Pick<FileFinalizerRepository, "recoverExpiredAccessGrants">;
}) {
  if (
    !Number.isSafeInteger(input.batchSize) ||
    input.batchSize < 1 ||
    input.batchSize > 500
  ) {
    throw new Error("file access recovery batch size is invalid");
  }
  if (!input.repository.recoverExpiredAccessGrants) {
    throw new Error("file access recovery is not configured");
  }
  const recovered = await input.repository.recoverExpiredAccessGrants(
    input.batchSize,
  );
  return { recovered };
}
