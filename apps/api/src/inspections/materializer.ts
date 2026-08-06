import type { InspectionMaterializerRepository } from "@werehere/db";

export type InspectionMaterializationSummary = {
  claimedCount: number;
  completedCount: number;
  createdInspectionCount: number;
  staleClaimCount: number;
};

function claimToken() {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function reconcileInspectionMaterializations(input: {
  batchSize: number;
  repository: InspectionMaterializerRepository;
  tokenFactory?: () => Uint8Array;
}): Promise<InspectionMaterializationSummary> {
  if (!Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 100)
    throw new Error("inspection materialization batch size is invalid");
  const summary: InspectionMaterializationSummary = {
    claimedCount: 0,
    completedCount: 0,
    createdInspectionCount: 0,
    staleClaimCount: 0,
  };
  for (let index = 0; index < input.batchSize; index += 1) {
    const token = (input.tokenFactory ?? claimToken)();
    if (!(token instanceof Uint8Array) || token.byteLength !== 32)
      throw new Error("inspection materialization claim token is invalid");
    const claimResult = await input.repository.claimNext({
      claimToken: token,
      leaseSeconds: 300,
    });
    if (claimResult.status === "NO_WORK") return summary;
    summary.claimedCount += 1;
    const completion = await input.repository.complete({
      claimGeneration: claimResult.claim.claimGeneration,
      claimToken: token,
      companyId: claimResult.claim.companyId,
      routineId: claimResult.claim.routineId,
      traceId: crypto.randomUUID(),
    });
    if (completion.status === "STALE_CLAIM") {
      summary.staleClaimCount += 1;
      continue;
    }
    summary.completedCount += 1;
    summary.createdInspectionCount += completion.createdCount;
  }
  return summary;
}
