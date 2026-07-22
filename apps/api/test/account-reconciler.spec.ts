import { accountCreateCompletionPayloadSchema } from "@werehere/contracts";
import { describe, expect, it, vi } from "vitest";
import { reconcileAccountProviderJobs } from "../src/accounts/reconciler";

const jobs = [
  {
    id: "91000000-0000-4000-8000-000000000001",
    companyId: "10000000-0000-4000-8000-000000000001",
    userId: "21000000-0000-4000-8000-000000000001",
    providerSubject: "zitadel-deactivate-subject",
    jobType: "ACCOUNT_PROVIDER_DEACTIVATE" as const,
    claimToken: "93000000-0000-4000-8000-000000000001",
  },
  {
    id: "91000000-0000-4000-8000-000000000002",
    companyId: "10000000-0000-4000-8000-000000000001",
    userId: "21000000-0000-4000-8000-000000000002",
    providerSubject: "zitadel-compensation-subject",
    jobType: "ACCOUNT_PROVIDER_COMPENSATE" as const,
    claimToken: "93000000-0000-4000-8000-000000000002",
  },
];

const completionPayload = accountCreateCompletionPayloadSchema.parse({
  displayName: "김하우스",
  loginName: "housekeeper01",
  email: "housekeeper-01@example.invalid",
  userType: "HOUSEKEEPING",
  hotelIds: [
    "50000000-0000-4000-8000-000000000001",
    "50000000-0000-4000-8000-000000000001",
    "50000000-0000-4000-8000-000000000002",
  ],
  assignmentStartDate: "2026-07-19",
  reason: "scheduled create recovery",
});

const createJobs = [
  {
    attemptId: "92000000-0000-4000-8000-000000000001",
    companyId: "10000000-0000-4000-8000-000000000001",
    userId: "21000000-0000-4000-8000-000000000011",
    actorUserId: "20000000-0000-4000-8000-000000000001",
    idempotencyKey: "recover-reserved",
    leaseVersion: 2,
    status: "DISPATCHED" as const,
    completionPayload,
  },
  {
    attemptId: "92000000-0000-4000-8000-000000000002",
    companyId: "10000000-0000-4000-8000-000000000001",
    userId: "21000000-0000-4000-8000-000000000012",
    actorUserId: "20000000-0000-4000-8000-000000000001",
    idempotencyKey: "recover-provider-created",
    leaseVersion: 1,
    status: "PROVIDER_CONFIRMED" as const,
    completionPayload,
  },
];

function accountRepository() {
  return {
    markProviderCreated: vi.fn(async () => "UPDATED" as const),
    completeCreate: vi.fn(
      async (input: { accountId: string }) =>
        ({
          status: "CREATED" as const,
          account: { id: input.accountId },
        }) as never,
    ),
    prepareCompensation: vi.fn(async () => ({
      status: "PREPARED" as const,
      providerJobId: "91000000-0000-4000-8000-000000000003",
      providerJobStatus: "PENDING" as const,
      originalErrorCode: "ACCOUNT_DUPLICATE" as const,
    })),
  };
}

describe("account provider outbox reconciler", () => {
  it("claims durable jobs and converges provider deactivation and create compensation", async () => {
    const repository = {
      claimJobs: vi.fn(async () => jobs),
      claimRecoverableCreates: vi.fn(async () => []),
      markCreateMissing: vi.fn(async () => undefined),
      markCreateRecoveryFailed: vi.fn(async () => undefined),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const provider = {
      deactivateHumanUser: vi.fn(async () => "DEACTIVATED" as const),
      humanUserExists: vi.fn(async () => true),
    };

    await expect(
      reconcileAccountProviderJobs({
        repository,
        accountRepository: accountRepository(),
        provider,
        batchSize: 10,
      }),
    ).resolves.toEqual({ claimed: 2, succeeded: 2, failed: 0 });
    expect(provider.deactivateHumanUser).toHaveBeenCalledTimes(2);
    expect(provider.deactivateHumanUser).toHaveBeenNthCalledWith(
      1,
      "zitadel-deactivate-subject",
    );
    expect(provider.deactivateHumanUser).toHaveBeenNthCalledWith(
      2,
      "zitadel-compensation-subject",
    );
    expect(repository.markSucceeded).toHaveBeenCalledTimes(2);
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("keeps compensation provider 404 retryable instead of orphaning a late-visible identity", async () => {
    const repository = {
      claimJobs: vi.fn(async () => [jobs[1]!]),
      claimRecoverableCreates: vi.fn(async () => []),
      markCreateMissing: vi.fn(async () => undefined),
      markCreateRecoveryFailed: vi.fn(async () => undefined),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const provider = {
      deactivateHumanUser: vi.fn(async () => "NOT_FOUND" as const),
      humanUserExists: vi.fn(async () => true),
    };

    await expect(
      reconcileAccountProviderJobs({
        repository,
        accountRepository: accountRepository(),
        provider,
        batchSize: 10,
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 0, failed: 1 });
    expect(repository.markSucceeded).not.toHaveBeenCalled();
    expect(repository.markFailed).toHaveBeenCalledWith(
      jobs[1],
      "PROVIDER_NOT_VISIBLE",
    );
  });

  it("keeps ordinary deactivation 404 idempotent", async () => {
    const repository = {
      claimJobs: vi.fn(async () => [jobs[0]!]),
      claimRecoverableCreates: vi.fn(async () => []),
      markCreateMissing: vi.fn(async () => undefined),
      markCreateRecoveryFailed: vi.fn(async () => undefined),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const provider = {
      deactivateHumanUser: vi.fn(async () => "NOT_FOUND" as const),
      humanUserExists: vi.fn(async () => true),
    };

    await expect(
      reconcileAccountProviderJobs({
        repository,
        accountRepository: accountRepository(),
        provider,
        batchSize: 10,
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    expect(repository.markSucceeded).toHaveBeenCalledWith(jobs[0]);
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("returns failed jobs to durable backoff without claiming success", async () => {
    const repository = {
      claimJobs: vi.fn(async () => [jobs[0]!]),
      claimRecoverableCreates: vi.fn(async () => []),
      markCreateMissing: vi.fn(async () => undefined),
      markCreateRecoveryFailed: vi.fn(async () => undefined),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const provider = {
      deactivateHumanUser: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
      humanUserExists: vi.fn(async () => true),
    };

    await expect(
      reconcileAccountProviderJobs({
        repository,
        accountRepository: accountRepository(),
        provider,
        batchSize: 10,
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 0, failed: 1 });
    expect(repository.markSucceeded).not.toHaveBeenCalled();
    expect(repository.markFailed).toHaveBeenCalledWith(
      jobs[0],
      "EXTERNAL_AUTH_UNAVAILABLE",
    );
  });

  it("recovers stale create attempts by provider read-back and DB-only completion", async () => {
    const repository = {
      claimJobs: vi.fn(async () => []),
      claimRecoverableCreates: vi.fn(async () => createJobs),
      markCreateMissing: vi.fn(async () => undefined),
      markCreateRecoveryFailed: vi.fn(async () => undefined),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const accounts = accountRepository();
    const provider = {
      deactivateHumanUser: vi.fn(async () => "DEACTIVATED" as const),
      humanUserExists: vi.fn(async () => true),
    };

    await expect(
      reconcileAccountProviderJobs({
        repository,
        accountRepository: accounts,
        provider,
        batchSize: 10,
      }),
    ).resolves.toEqual({ claimed: 2, succeeded: 2, failed: 0 });
    expect(provider.humanUserExists).toHaveBeenCalledTimes(1);
    expect(accounts.markProviderCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: createJobs[0]!.userId,
        leaseVersion: createJobs[0]!.leaseVersion,
      }),
    );
    expect(accounts.completeCreate).toHaveBeenCalledTimes(2);
    expect(accounts.completeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: createJobs[1]!.userId,
        assignmentIds: [expect.any(String), expect.any(String)],
        value: completionPayload,
      }),
    );
  });

  it("keeps a provider 404 in durable read-back recovery instead of treating it as terminal", async () => {
    const repository = {
      claimJobs: vi.fn(async () => []),
      claimRecoverableCreates: vi.fn(async () => [createJobs[0]!]),
      markCreateMissing: vi.fn(async () => undefined),
      markCreateRecoveryFailed: vi.fn(async () => undefined),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const accounts = accountRepository();
    const provider = {
      deactivateHumanUser: vi.fn(async () => "DEACTIVATED" as const),
      humanUserExists: vi.fn(async () => false),
    };

    await expect(
      reconcileAccountProviderJobs({
        repository,
        accountRepository: accounts,
        provider,
        batchSize: 10,
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    expect(repository.markCreateMissing).toHaveBeenCalledWith(createJobs[0]);
    expect(accounts.markProviderCreated).not.toHaveBeenCalled();
    expect(accounts.completeCreate).not.toHaveBeenCalled();
  });

  it("hands owned create compensation to the outbox without a parallel provider mutation", async () => {
    const repository = {
      claimJobs: vi.fn(async () => []),
      claimRecoverableCreates: vi.fn(async () => [createJobs[1]!]),
      markCreateMissing: vi.fn(async () => undefined),
      markCreateRecoveryFailed: vi.fn(async () => undefined),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const accounts = accountRepository();
    accounts.completeCreate.mockResolvedValue({ status: "DUPLICATE" } as never);
    const provider = {
      deactivateHumanUser: vi.fn(async () => "DEACTIVATED" as const),
      humanUserExists: vi.fn(async () => true),
    };

    await expect(
      reconcileAccountProviderJobs({
        repository,
        accountRepository: accounts,
        provider,
        batchSize: 10,
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    expect(accounts.prepareCompensation).toHaveBeenCalled();
    expect(provider.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("does not deactivate a provider identity after a stale recovery loses compensation ownership", async () => {
    const repository = {
      claimJobs: vi.fn(async () => []),
      claimRecoverableCreates: vi.fn(async () => [createJobs[1]!]),
      markCreateMissing: vi.fn(async () => undefined),
      markCreateRecoveryFailed: vi.fn(async () => undefined),
      markSucceeded: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const accounts = accountRepository();
    accounts.completeCreate.mockResolvedValue({ status: "DUPLICATE" } as never);
    accounts.prepareCompensation = vi.fn(async () => ({
      status: "STALE_LEASE" as const,
    })) as never;
    const provider = {
      deactivateHumanUser: vi.fn(async () => "DEACTIVATED" as const),
      humanUserExists: vi.fn(async () => true),
    };

    await expect(
      reconcileAccountProviderJobs({
        repository,
        accountRepository: accounts,
        provider,
        batchSize: 10,
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 0, failed: 1 });
    expect(provider.deactivateHumanUser).not.toHaveBeenCalled();
  });
});
