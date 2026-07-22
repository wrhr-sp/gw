import type {
  AccountCreateRecoveryJob,
  AccountProviderJob,
  AccountReconciliationRepository,
  AccountRepository,
} from "@werehere/db";

export type AccountReconciliationProvider = {
  deactivateHumanUser(userId: string): Promise<"DEACTIVATED" | "NOT_FOUND">;
  humanUserExists(userId: string): Promise<boolean>;
};

type ReconcileInput = {
  repository: Pick<
    AccountReconciliationRepository,
    | "claimJobs"
    | "claimRecoverableCreates"
    | "markCreateMissing"
    | "markCreateRecoveryFailed"
    | "markSucceeded"
    | "markFailed"
  >;
  accountRepository: Pick<
    AccountRepository,
    "markProviderCreated" | "completeCreate" | "prepareCompensation"
  >;
  provider: AccountReconciliationProvider;
  batchSize: number;
};

export async function reconcileAccountProviderJobs(input: ReconcileInput) {
  const createJobs = await input.repository.claimRecoverableCreates(
    input.batchSize,
  );
  const remaining = Math.max(1, input.batchSize - createJobs.length);
  const providerJobs = await input.repository.claimJobs(remaining);
  let succeeded = 0;
  let failed = 0;

  for (const job of createJobs) {
    try {
      const recovered = await recoverCreate(input, job);
      if (recovered) succeeded += 1;
      else failed += 1;
    } catch {
      await markCreateRecoveryFailedSafely(input.repository, job);
      failed += 1;
    }
  }

  for (const job of providerJobs) {
    try {
      const outcome = await input.provider.deactivateHumanUser(
        job.providerSubject,
      );
      if (
        job.jobType === "ACCOUNT_PROVIDER_COMPENSATE" &&
        outcome === "NOT_FOUND"
      ) {
        await markFailedSafely(input.repository, job, "PROVIDER_NOT_VISIBLE");
        failed += 1;
        continue;
      }
      await input.repository.markSucceeded(job);
      succeeded += 1;
    } catch {
      await markFailedSafely(
        input.repository,
        job,
        "EXTERNAL_AUTH_UNAVAILABLE",
      );
      failed += 1;
    }
  }

  return {
    claimed: createJobs.length + providerJobs.length,
    succeeded,
    failed,
  };
}

async function recoverCreate(
  input: ReconcileInput,
  job: AccountCreateRecoveryJob,
) {
  if (job.status !== "PROVIDER_CONFIRMED") {
    const exists = await input.provider.humanUserExists(job.userId);
    if (!exists) {
      await input.repository.markCreateMissing(job);
      return true;
    }
    const marked = await input.accountRepository.markProviderCreated({
      accountId: job.userId,
      companyId: job.companyId,
      leaseVersion: job.leaseVersion,
      subject: job.userId,
    });
    if (marked === "STALE_LEASE") return false;
  }

  const assignmentCount =
    job.completionPayload.userType === "HOUSEKEEPING"
      ? (job.completionPayload.hotelIds?.length ?? 0)
      : 1;
  const completed = await input.accountRepository.completeCreate({
    accountId: job.userId,
    ...(job.originActorType ? { actorType: job.originActorType } : {}),
    actorUserId: job.actorUserId,
    assignmentIds: Array.from({ length: assignmentCount }, () =>
      crypto.randomUUID(),
    ),
    auditEventId: crypto.randomUUID(),
    companyId: job.companyId,
    idempotencyKey: job.idempotencyKey,
    leaseVersion: job.leaseVersion,
    ...(job.originSessionId ? { sessionId: job.originSessionId } : {}),
    subject: job.userId,
    traceId: job.traceId ?? job.attemptId,
    value: job.completionPayload,
  });
  if (completed.status === "CREATED" || completed.status === "REPLAYED")
    return true;

  const prepared = await input.accountRepository.prepareCompensation({
    accountId: job.userId,
    companyId: job.companyId,
    leaseVersion: job.leaseVersion,
    originalErrorCode:
      completed.status === "FORBIDDEN" ? "FORBIDDEN" : "ACCOUNT_DUPLICATE",
  });
  if (prepared.status === "STALE_LEASE") return false;
  return true;
}

async function markCreateRecoveryFailedSafely(
  repository: Pick<AccountReconciliationRepository, "markCreateRecoveryFailed">,
  job: AccountCreateRecoveryJob,
) {
  try {
    await repository.markCreateRecoveryFailed(job, "EXTERNAL_AUTH_UNAVAILABLE");
  } catch {
    // The stale reservation/provider-created state remains claimable after its recovery lease.
  }
}

async function markFailedSafely(
  repository: Pick<AccountReconciliationRepository, "markFailed">,
  job: AccountProviderJob,
  errorCode: string,
) {
  try {
    await repository.markFailed(job, errorCode);
  } catch {
    // A stale PROCESSING lock remains reclaimable after the five-minute claim timeout.
  }
}
