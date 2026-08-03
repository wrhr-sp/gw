import type { FileFinalizerRepository } from "@werehere/db";
import type { HotelFileFinalizerService } from "./finalizer";

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

export async function reconcileHotelFileEvidence(input: {
  batchSize: number;
  finalizer: Pick<HotelFileFinalizerService, "finalize">;
  repository: FileFinalizerRepository;
}) {
  if (
    !Number.isSafeInteger(input.batchSize) ||
    input.batchSize < 1 ||
    input.batchSize > 25
  ) {
    throw new Error("file scan batch size is invalid");
  }
  if (!input.repository.listCandidates) {
    throw new Error("file scan candidate listing is not configured");
  }
  const candidates = await input.repository.listCandidates(input.batchSize);
  let succeeded = 0;
  let failed = 0;
  for (const uploadId of candidates) {
    try {
      await input.finalizer.finalize(uploadId);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }
  return { claimed: candidates.length, failed, succeeded };
}
