import {
  createAccountRequestSchema,
  type AuthenticatedPrincipal,
  type CreateAccountRequest,
} from "@werehere/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  createAccountService,
  type AccountRepository,
  type UserProvisioningProvider,
} from "../src/accounts/service";
import { AccountProviderError } from "../src/accounts/zitadel-user-provider";

const principal: AuthenticatedPrincipal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF",
  displayName: "Preview 관리자",
};
const pendingPrincipal: AuthenticatedPrincipal = {
  ...principal,
  mustChangePassword: true,
};
const accountId = "21000000-0000-4000-8000-000000000001";
const hotelId = "50000000-0000-4000-8000-000000000001";
const secondHotelId = "50000000-0000-4000-8000-000000000002";
const request: CreateAccountRequest = {
  displayName: "김하우스",
  loginName: "housekeeper01",
  email: "housekeeper-01@example.invalid",
  userType: "HOUSEKEEPING",
  hotelIds: [hotelId, secondHotelId],
  assignmentStartDate: "2026-07-19",
  reason: "Preview 하우스키핑 배정",
  initialPassword: "Strong-Preview-123!",
};
const account = {
  id: accountId,
  displayName: request.displayName,
  loginName: request.loginName,
  email: request.email,
  userType: request.userType,
  status: "PENDING_SETUP" as const,
  hotelId,
  version: 1,
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
};
const providerJobId = "91000000-0000-4000-8000-000000000001";
const providerJob = {
  id: providerJobId,
  companyId: principal.companyId,
  userId: accountId,
  providerSubject: accountId,
  jobType: "ACCOUNT_PROVIDER_COMPENSATE" as const,
  claimToken: "93000000-0000-4000-8000-000000000001",
  provisioningAttemptId: "92000000-0000-4000-8000-000000000001",
  originalErrorCode: "ACCOUNT_DUPLICATE" as const,
};
const deactivationJob = {
  id: "91000000-0000-4000-8000-000000000002",
  companyId: principal.companyId,
  userId: accountId,
  providerSubject: "zitadel-target-admin-subject",
  jobType: "ACCOUNT_PROVIDER_DEACTIVATE" as const,
  claimToken: "93000000-0000-4000-8000-000000000002",
};

function repository(
  overrides: Partial<AccountRepository> = {},
): AccountRepository {
  return {
    reserveCreate: vi.fn(async () => ({
      status: "RESERVED_NOT_DISPATCHED" as const,
      accountId,
      leaseVersion: 1,
    })),
    markCreateDispatched: vi.fn(async () => "UPDATED" as const),
    markProviderCreated: vi.fn(async () => "UPDATED" as const),
    markCreateRecoveryRequired: vi.fn(async () => "UPDATED" as const),
    completeCreate: vi.fn(async () => ({
      status: "CREATED" as const,
      account,
    })),
    getCreateOutcome: vi.fn(async () => ({
      status: "COMPLETED" as const,
      account,
    })),
    prepareCompensation: vi.fn(async () => ({
      status: "PREPARED" as const,
      providerJobId,
      providerJobStatus: "PENDING" as const,
      originalErrorCode: "ACCOUNT_DUPLICATE" as const,
    })),
    claimExactProviderJob: vi.fn(async () => ({
      status: "CLAIMED" as const,
      job: providerJob,
    })),
    markProviderJobSucceeded: vi.fn(async () => "UPDATED" as const),
    markProviderJobFailed: vi.fn(async () => "UPDATED" as const),
    listAccounts: vi.fn(),
    listEligibleHotels: vi.fn(async () => ({
      status: "OK" as const,
      hotels: [],
    })),
    getAccount: vi.fn(),
    getCapabilities: vi.fn(async () => ({ permissions: [] })),
    deactivateAccount: vi.fn(),
    reserveInitialPassword: vi.fn(async () => ({
      status: "RESERVED_NOT_DISPATCHED" as const,
      subject: principal.userId,
      leaseVersion: 1,
    })),
    markInitialPasswordDispatched: vi.fn(async () => "UPDATED" as const),
    markInitialPasswordRecoveryRequired: vi.fn(async () => "UPDATED" as const),
    confirmInitialPasswordProviderState: vi.fn(async () => "UPDATED" as const),
    markInitialPasswordProviderUpdated: vi.fn(async () => "UPDATED" as const),
    completeInitialPassword: vi.fn(async () => ({
      status: "UPDATED" as const,
    })),
    ...overrides,
  };
}

function provider(
  overrides: Partial<UserProvisioningProvider> = {},
): UserProvisioningProvider {
  return {
    createHumanUser: vi.fn(async () => ({ subject: accountId })),
    humanUserExists: vi.fn(async () => true),
    verifyPassword: vi.fn(async () => true),
    deactivateHumanUser: vi.fn(async () => "DEACTIVATED" as const),
    setPassword: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("account administration service", () => {
  it("returns a generic duplicate before any provider call when the global login ID is already claimed", async () => {
    const repo = repository({
      reserveCreate: vi.fn(async () => ({ status: "LOGIN_ID_CONFLICT" as const })),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(principal, request, "global-login-conflict"),
    ).rejects.toMatchObject({ code: "ACCOUNT_DUPLICATE", httpStatus: 409 });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
    expect(identity.verifyPassword).not.toHaveBeenCalled();
  });

  it.each([
    ["PW-7", "a1!aaaa", ["비밀번호는 8자 이상 입력해 주세요."]],
    ["PW-NO-LOWER", "A1!AAAAA", ["비밀번호에 영문 소문자를 포함해 주세요."]],
    ["PW-NO-NUMBER", "aa!aaaaa", ["비밀번호에 숫자를 포함해 주세요."]],
    ["PW-NO-P/S", "aa1aaaaa", ["비밀번호에 기호를 포함해 주세요."]],
    [
      "PW-201",
      `a1!${"a".repeat(198)}`,
      ["비밀번호는 200자 이하로 입력해 주세요."],
    ],
    [
      "punctuation-only",
      "!!!!!!!!",
      [
        "비밀번호에 영문 소문자를 포함해 주세요.",
        "비밀번호에 숫자를 포함해 주세요.",
      ],
    ],
    [
      "symbol-only",
      "💡💡💡💡💡💡💡💡",
      [
        "비밀번호에 영문 소문자를 포함해 주세요.",
        "비밀번호에 숫자를 포함해 주세요.",
      ],
    ],
  ])(
    "rejects invalid create password %s at the service boundary with zero provider calls",
    async (_fixture, initialPassword, messages) => {
      const repo = repository();
      const identity = provider();
      const service = createAccountService({
        repository: repo,
        provider: identity,
      });
      await expect(
        service.createAccount(
          principal,
          { ...request, initialPassword },
          "invalid-password",
        ),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        httpStatus: 400,
        fieldErrors: messages.map((message) => ({
          field: "initialPassword",
          message,
        })),
      });
      expect(repo.reserveCreate).not.toHaveBeenCalled();
      expect(identity.createHumanUser).not.toHaveBeenCalled();
      expect(identity.verifyPassword).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["PW-7", "a1!aaaa", ["비밀번호는 8자 이상 입력해 주세요."]],
    ["PW-NO-LOWER", "A1!AAAAA", ["비밀번호에 영문 소문자를 포함해 주세요."]],
    ["PW-NO-NUMBER", "aa!aaaaa", ["비밀번호에 숫자를 포함해 주세요."]],
    ["PW-NO-P/S", "aa1aaaaa", ["비밀번호에 기호를 포함해 주세요."]],
    [
      "PW-201",
      `a1!${"a".repeat(198)}`,
      ["비밀번호는 200자 이하로 입력해 주세요."],
    ],
    [
      "punctuation-only",
      "!!!!!!!!",
      [
        "비밀번호에 영문 소문자를 포함해 주세요.",
        "비밀번호에 숫자를 포함해 주세요.",
      ],
    ],
    [
      "symbol-only",
      "💡💡💡💡💡💡💡💡",
      [
        "비밀번호에 영문 소문자를 포함해 주세요.",
        "비밀번호에 숫자를 포함해 주세요.",
      ],
    ],
  ])(
    "rejects invalid forced-change password %s with zero DB/provider calls",
    async (_fixture, newPassword, messages) => {
      const repo = repository();
      const identity = provider();
      const service = createAccountService({
        repository: repo,
        provider: identity,
      });
      await expect(
        service.changeInitialPassword(
          pendingPrincipal,
          { newPassword },
          "invalid-password",
        ),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        httpStatus: 400,
        fieldErrors: messages.map((message) => ({
          field: "newPassword",
          message,
        })),
      });
      expect(repo.reserveInitialPassword).not.toHaveBeenCalled();
      expect(identity.setPassword).not.toHaveBeenCalled();
      expect(identity.verifyPassword).not.toHaveBeenCalled();
    },
  );

  it("creates the provider identity before the tenant-bound DB account and read-back", async () => {
    const repo = repository();
    const identity = provider();
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });

    const canonicalRequest = createAccountRequestSchema.parse({
      ...request,
      hotelIds: [hotelId, hotelId, secondHotelId],
    });
    await expect(
      service.createAccount(principal, canonicalRequest, "account-create-1"),
    ).resolves.toEqual({
      status: "CREATED",
      account,
    });
    expect(identity.createHumanUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: accountId,
        initialPassword: request.initialPassword,
      }),
    );
    expect(repo.markProviderCreated).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, subject: accountId }),
    );
    const reservedTraceId = vi.mocked(repo.reserveCreate).mock.calls[0]?.[0].traceId;
    expect(reservedTraceId).toEqual(expect.any(String));
    expect(repo.reserveCreate).toHaveBeenCalledWith(
      expect.objectContaining({ auditEventId: expect.any(String) }),
    );
    expect(repo.completeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        actorType: principal.userType,
        companyId: principal.companyId,
        actorUserId: principal.userId,
        assignmentIds: [expect.any(String), expect.any(String)],
        traceId: reservedTraceId,
        value: expect.objectContaining({ hotelIds: [hotelId, secondHotelId] }),
        subject: accountId,
      }),
    );
    expect(repo.reserveCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelIds: [hotelId, secondHotelId],
        completionPayload: expect.not.objectContaining({
          hotelId: expect.anything(),
        }),
      }),
    );
    expect(repo.reserveCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelIds: [hotelId, secondHotelId],
        completionPayload: expect.objectContaining({
          hotelIds: [hotelId, secondHotelId],
        }),
      }),
    );
    expect(
      vi.mocked(repo.completeCreate).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(repo.getCreateOutcome).mock.invocationCallOrder.at(-1)!,
    );
    expect(repo.getCreateOutcome).toHaveBeenCalledWith({
      accountId,
      companyId: principal.companyId,
      sessionId: principal.sessionId,
    });
  });

  it("rejects an out-of-tenant hotel before mutating the identity provider", async () => {
    const repo = repository({
      reserveCreate: vi.fn(
        async () => ({ status: "HOTEL_NOT_FOUND" }) as never,
      ),
    });
    const identity = provider();
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });

    await expect(
      service.createAccount(principal, request, "account-create-invalid-hotel"),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND", httpStatus: 404 });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
  });

  it("returns the stored original error for a compensated create replay", async () => {
    const repo = repository({
      reserveCreate: vi.fn(async () => ({
        status: "COMPENSATED" as const,
        originalErrorCode: "ACCOUNT_DUPLICATE" as const,
      })),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(principal, request, "account-create-compensated"),
    ).rejects.toMatchObject({
      code: "ACCOUNT_DUPLICATE",
      httpStatus: 409,
      retryable: false,
    });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("returns the stored retryable internal error for an operationally compensated replay", async () => {
    const repo = repository({
      reserveCreate: vi.fn(async () => ({
        status: "COMPENSATED" as const,
        originalErrorCode: "INTERNAL_ERROR" as const,
      })),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(principal, request, "account-create-internal-compensated"),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      httpStatus: 500,
      retryable: true,
    });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it.each([
    ["ACCOUNT_DUPLICATE", 409, false],
    ["FORBIDDEN", 403, false],
    ["INTERNAL_ERROR", 500, true],
  ] as const)(
    "preserves %s after a pending compensation replay succeeds",
    async (originalErrorCode, httpStatus, retryable) => {
      const repo = repository({
        reserveCreate: vi.fn(async () => ({
          status: "COMPENSATION_REQUIRED" as const,
          accountId,
          providerJobId,
          providerJobStatus: "PENDING" as const,
          originalErrorCode,
        })),
      });
      const identity = provider();
      const service = createAccountService({ repository: repo, provider: identity });

      await expect(
        service.createAccount(
          principal,
          request,
          `account-create-${originalErrorCode.toLowerCase()}-pending`,
        ),
      ).rejects.toMatchObject({
        code: originalErrorCode,
        httpStatus,
        retryable,
      });
      expect(identity.deactivateHumanUser).toHaveBeenCalledWith(accountId);
      expect(repo.markProviderJobSucceeded).toHaveBeenCalled();
    },
  );

  it("keeps a create replay non-2xx while another worker owns compensation", async () => {
    const repo = repository({
      reserveCreate: vi.fn(async () => ({
        status: "COMPENSATION_REQUIRED" as const,
        accountId,
        providerJobId,
        providerJobStatus: "PROCESSING" as const,
        originalErrorCode: "ACCOUNT_DUPLICATE" as const,
      })),
      claimExactProviderJob: vi.fn(async () => ({ status: "BUSY" as const })),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(principal, request, "account-create-compensation-busy"),
    ).rejects.toMatchObject({
      code: "COMPENSATION_REQUIRED",
      httpStatus: 503,
      retryable: true,
    });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("resumes DB completion without recreating a provider user after PROVIDER_CREATED", async () => {
    const repo = repository({
      reserveCreate: vi.fn(
        async () =>
          ({
            status: "PROVIDER_CONFIRMED",
            accountId,
            subject: accountId,
          }) as never,
      ),
    });
    const identity = provider();
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });

    await expect(
      service.createAccount(principal, request, "account-create-resume"),
    ).resolves.toEqual({
      status: "CREATED",
      account,
    });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
    expect(identity.verifyPassword).toHaveBeenCalledWith({
      expectedSubject: accountId,
      loginName: request.loginName,
      password: request.initialPassword,
    });
    expect(repo.completeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, subject: accountId }),
    );
  });

  it("returns a completed create replay only after verifying the submitted credential", async () => {
    const repo = repository({
      reserveCreate: vi.fn(
        async () => ({ status: "REPLAYED", account }) as never,
      ),
    });
    const identity = provider({ verifyPassword: vi.fn(async () => true) });
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(principal, request, "account-create-replay"),
    ).resolves.toEqual({ status: "REPLAYED", account });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
    expect(identity.verifyPassword).toHaveBeenCalledWith({
      expectedSubject: account.id,
      loginName: request.loginName,
      password: request.initialPassword,
    });
  });

  it("rejects a completed create replay when the submitted credential differs", async () => {
    const repo = repository({
      reserveCreate: vi.fn(
        async () => ({ status: "REPLAYED", account }) as never,
      ),
    });
    const identity = provider({ verifyPassword: vi.fn(async () => false) });
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(principal, request, "account-create-replay-mismatch"),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", retryable: false });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
    expect(identity.verifyPassword).toHaveBeenCalledOnce();
  });

  it("does not compensate a deterministic provider identity after losing the create lease", async () => {
    const repo = repository({
      markProviderCreated: vi.fn(async () => "STALE_LEASE" as const),
    });
    const identity = provider();
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });

    await expect(
      service.createAccount(principal, request, "account-create-stale-owner"),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", retryable: true });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("records a duplicate provider result for reconciliation without immediate credential probing", async () => {
    const repo = repository();
    const identity = provider({
      createHumanUser: vi.fn(async () => {
        throw new AccountProviderError("ACCOUNT_DUPLICATE", 409, false);
      }),
    });
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });

    await expect(
      service.createAccount(principal, request, "account-create-recover"),
    ).rejects.toMatchObject({ code: "ACCOUNT_DUPLICATE", retryable: false });
    expect(
      vi.mocked(repo.markCreateDispatched).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(identity.createHumanUser).mock.invocationCallOrder[0]!,
    );
    expect(repo.markCreateRecoveryRequired).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        errorCode: "ACCOUNT_DUPLICATE",
      }),
    );
    expect(identity.humanUserExists).not.toHaveBeenCalled();
    expect(identity.verifyPassword).not.toHaveBeenCalled();
    expect(repo.markProviderCreated).not.toHaveBeenCalled();
    expect(repo.completeCreate).not.toHaveBeenCalled();
  });

  it("records an ambiguous provider timeout without repeating or completing the create", async () => {
    const repo = repository();
    const identity = provider({
      createHumanUser: vi.fn(async () => {
        throw new Error("provider timeout");
      }),
    });
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });

    await expect(
      service.createAccount(
        principal,
        request,
        "account-create-wrong-credential",
      ),
    ).rejects.toMatchObject({
      code: "EXTERNAL_AUTH_UNAVAILABLE",
      retryable: true,
    });
    expect(repo.markCreateRecoveryRequired).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        errorCode: "EXTERNAL_AUTH_UNAVAILABLE",
      }),
    );
    expect(identity.humanUserExists).not.toHaveBeenCalled();
    expect(identity.verifyPassword).not.toHaveBeenCalled();
    expect(repo.markProviderCreated).not.toHaveBeenCalled();
    expect(repo.completeCreate).not.toHaveBeenCalled();
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("reads back an ambiguous DB commit and never compensates a completed account", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => {
        throw new Error("commit response lost");
      }),
      getCreateOutcome: vi.fn(
        async () => ({ status: "COMPLETED", account }) as never,
      ),
    });
    const identity = provider();
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });

    await expect(
      service.createAccount(principal, request, "account-create-2"),
    ).resolves.toEqual({ status: "CREATED", account });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("immediately compensates a DB rollback proven by provider-confirmed read-back", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
      getCreateOutcome: vi.fn(
        async () => ({ status: "PROVIDER_CONFIRMED" }) as never,
      ),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(principal, request, "account-create-proven-rollback"),
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR", retryable: true });
    expect(repo.prepareCompensation).toHaveBeenCalledWith(
      expect.objectContaining({ originalErrorCode: "INTERNAL_ERROR" }),
    );
    expect(identity.deactivateHumanUser).toHaveBeenCalledWith(accountId);
    expect(repo.markProviderJobSucceeded).toHaveBeenCalled();
  });

  it("leaves a DB completion ambiguous when post-failure read-back is unavailable", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
      getCreateOutcome: vi.fn(async () => {
        throw new Error("read-back unavailable");
      }),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(principal, request, "account-create-ambiguous"),
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR", retryable: true });
    expect(repo.prepareCompensation).not.toHaveBeenCalled();
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("resolves a stale compensation owner from DB without deactivating the completed identity", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => ({ status: "DUPLICATE" as const })),
      prepareCompensation: vi.fn(async () => ({
        status: "STALE_LEASE" as const,
      })),
      getCreateOutcome: vi.fn(async () => ({
        status: "COMPLETED" as const,
        account,
      })),
    });
    const identity = provider();
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });

    await expect(
      service.createAccount(
        principal,
        request,
        "account-create-stale-compensation",
      ),
    ).resolves.toEqual({ status: "CREATED", account });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("claims durable compensation and deactivates the provider before returning the original error", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => ({ status: "DUPLICATE" as const })),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(
        principal,
        request,
        "account-create-owned-compensation",
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_DUPLICATE", httpStatus: 409 });
    expect(repo.prepareCompensation).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseVersion: 1,
        originalErrorCode: "ACCOUNT_DUPLICATE",
      }),
    );
    expect(repo.claimExactProviderJob).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: principal.companyId,
        expectedJobType: "ACCOUNT_PROVIDER_COMPENSATE",
        jobId: providerJobId,
        sessionId: principal.sessionId,
      }),
    );
    expect(identity.deactivateHumanUser).toHaveBeenCalledWith(accountId);
    expect(repo.markProviderJobSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ job: providerJob }),
    );
    expect(
      vi.mocked(repo.prepareCompensation).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(repo.claimExactProviderJob).mock.invocationCallOrder[0]!,
    );
    expect(
      vi.mocked(repo.claimExactProviderJob).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(identity.deactivateHumanUser).mock.invocationCallOrder[0]!,
    );
  });

  it("records compensation provider failure and does not return the original business error", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => ({ status: "DUPLICATE" as const })),
    });
    const identity = provider({
      deactivateHumanUser: vi.fn(async () => {
        throw new AccountProviderError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
      }),
    });
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(principal, request, "account-create-compensation-failed"),
    ).rejects.toMatchObject({ code: "COMPENSATION_REQUIRED", httpStatus: 503 });
    expect(repo.markProviderJobFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "EXTERNAL_AUTH_UNAVAILABLE",
        job: providerJob,
      }),
    );
    expect(repo.markProviderJobSucceeded).not.toHaveBeenCalled();
  });

  it("keeps compensation provider NOT_FOUND retryable for a late-visible identity", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => ({ status: "DUPLICATE" as const })),
    });
    const identity = provider({
      deactivateHumanUser: vi.fn(async () => "NOT_FOUND" as const),
    });
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(
      service.createAccount(principal, request, "account-create-compensation-not-found"),
    ).rejects.toMatchObject({ code: "COMPENSATION_REQUIRED", retryable: true });
    expect(repo.markProviderJobFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "PROVIDER_NOT_VISIBLE",
        job: providerJob,
      }),
    );
    expect(repo.markProviderJobSucceeded).not.toHaveBeenCalled();
  });

  it("blocks self-deactivation before calling the provider", async () => {
    const identity = provider();
    const service = createAccountService({
      repository: repository(),
      provider: identity,
    });
    await expect(
      service.deactivateAccount(principal, principal.userId, {
        version: 1,
        reason: "잘못된 요청",
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_SELF_DEACTIVATION_FORBIDDEN" });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("rejects a deactivation idempotency conflict before calling the provider", async () => {
    const repo = repository({
      deactivateAccount: vi.fn(async () => ({
        status: "IDEMPOTENCY_CONFLICT" as const,
      })),
    });
    const identity = provider();
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });
    await expect(
      service.deactivateAccount(
        principal,
        accountId,
        { version: 1, reason: "관리자 중지" },
        "deactivate-key",
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(repo.deactivateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "deactivate-key",
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    );
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("claims the committed deactivation job before calling the provider and returning 2xx", async () => {
    const inactiveAccount = { ...account, status: "INACTIVE" as const, version: 2 };
    const repo = repository({
      deactivateAccount: vi.fn(async () => ({
        status: "UPDATED" as const,
        account: inactiveAccount,
        providerJobId: deactivationJob.id,
        providerJobStatus: "PENDING" as const,
      }) as never),
      claimExactProviderJob: vi.fn(async () => ({
        status: "CLAIMED" as const,
        job: deactivationJob,
      })) as never,
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });
    await expect(
      service.deactivateAccount(
        principal,
        accountId,
        { version: 1, reason: "관리자 중지" },
        "deactivate-success",
      ),
    ).resolves.toMatchObject({
      status: "UPDATED",
      account: { status: "INACTIVE" },
    });
    expect(identity.deactivateHumanUser).toHaveBeenCalledWith(
      "zitadel-target-admin-subject",
    );
    expect(repo.markProviderJobSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ job: deactivationJob }),
    );
    expect(
      vi.mocked(repo.deactivateAccount).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(repo.claimExactProviderJob).mock.invocationCallOrder[0]!,
    );
    expect(
      vi.mocked(repo.claimExactProviderJob).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(identity.deactivateHumanUser).mock.invocationCallOrder[0]!,
    );
  });

  it("treats ordinary provider NOT_FOUND as idempotent deactivation success", async () => {
    const repo = repository({
      deactivateAccount: vi.fn(async () => ({
        status: "UPDATED" as const,
        account: { ...account, status: "INACTIVE" as const, version: 2 },
        providerJobId: deactivationJob.id,
        providerJobStatus: "PENDING" as const,
      }) as never),
      claimExactProviderJob: vi.fn(async () => ({
        status: "CLAIMED" as const,
        job: deactivationJob,
      })) as never,
    });
    const identity = provider({
      deactivateHumanUser: vi.fn(async () => "NOT_FOUND" as const),
    });
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.deactivateAccount(
      principal,
      accountId,
      { version: 1, reason: "관리자 중지" },
      "deactivate-not-found",
    )).resolves.toMatchObject({ status: "UPDATED" });
    expect(repo.markProviderJobSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ job: deactivationJob }),
    );
    expect(repo.markProviderJobFailed).not.toHaveBeenCalled();
  });

  it("does not return 2xx when its provider success marker lost the claim token", async () => {
    const repo = repository({
      deactivateAccount: vi.fn(async () => ({
        status: "UPDATED" as const,
        account: { ...account, status: "INACTIVE" as const, version: 2 },
        providerJobId: deactivationJob.id,
        providerJobStatus: "PENDING" as const,
      }) as never),
      claimExactProviderJob: vi.fn(async () => ({
        status: "CLAIMED" as const,
        job: deactivationJob,
      })) as never,
      markProviderJobSucceeded: vi.fn(async () => "STALE_CLAIM" as const),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.deactivateAccount(
      principal,
      accountId,
      { version: 1, reason: "관리자 중지" },
      "deactivate-stale-marker",
    )).rejects.toMatchObject({
      code: "EXTERNAL_AUTH_UNAVAILABLE",
      httpStatus: 503,
      retryable: true,
    });
  });

  it("persists deactivation provider failure and never returns the committed local account as success", async () => {
    const repo = repository({
      deactivateAccount: vi.fn(async () => ({
        status: "UPDATED" as const,
        account: { ...account, status: "INACTIVE" as const, version: 2 },
        providerJobId: deactivationJob.id,
        providerJobStatus: "PENDING" as const,
      }) as never),
      claimExactProviderJob: vi.fn(async () => ({
        status: "CLAIMED" as const,
        job: deactivationJob,
      })) as never,
    });
    const identity = provider({
      deactivateHumanUser: vi.fn(async () => {
        throw new AccountProviderError("EXTERNAL_AUTH_UNAVAILABLE", 503, true);
      }),
    });
    const service = createAccountService({ repository: repo, provider: identity });
    await expect(
      service.deactivateAccount(
        principal,
        accountId,
        { version: 1, reason: "관리자 중지" },
        "deactivate-failed",
      ),
    ).rejects.toMatchObject({
      code: "EXTERNAL_AUTH_UNAVAILABLE",
      httpStatus: 503,
      retryable: true,
    });
    expect(repo.markProviderJobFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "EXTERNAL_AUTH_UNAVAILABLE",
        job: deactivationJob,
      }),
    );
    expect(repo.markProviderJobSucceeded).not.toHaveBeenCalled();
  });

  it("returns a deactivation replay without another provider call when the exact job succeeded", async () => {
    const repo = repository({
      deactivateAccount: vi.fn(async () => ({
        status: "REPLAYED" as const,
        account: { ...account, status: "INACTIVE" as const, version: 2 },
        providerJobId: deactivationJob.id,
        providerJobStatus: "SUCCEEDED" as const,
      }) as never),
      claimExactProviderJob: vi.fn(async () => ({ status: "SUCCEEDED" as const })) as never,
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.deactivateAccount(
      principal,
      accountId,
      { version: 1, reason: "관리자 중지" },
      "deactivate-replay",
    )).resolves.toMatchObject({ status: "REPLAYED" });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("does not dispatch when another worker owns the exact deactivation job", async () => {
    const repo = repository({
      deactivateAccount: vi.fn(async () => ({
        status: "REPLAYED" as const,
        account: { ...account, status: "INACTIVE" as const, version: 2 },
        providerJobId: deactivationJob.id,
        providerJobStatus: "PROCESSING" as const,
      }) as never),
      claimExactProviderJob: vi.fn(async () => ({ status: "BUSY" as const })) as never,
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.deactivateAccount(
      principal,
      accountId,
      { version: 1, reason: "관리자 중지" },
      "deactivate-busy",
    )).rejects.toMatchObject({ code: "EXTERNAL_AUTH_UNAVAILABLE", retryable: true });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("reserves PENDING_SETUP in DB before changing ZITADEL and clearing the local gate", async () => {
    const repo = repository();
    const identity = provider();
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });
    await service.changeInitialPassword(
      pendingPrincipal,
      { newPassword: "Another-Strong-456!" },
      "password-change-1",
    );
    expect(repo.reserveInitialPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: principal.companyId,
        idempotencyKey: "password-change-1",
        userId: principal.userId,
      }),
    );
    expect(
      vi.mocked(repo.reserveInitialPassword).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(identity.setPassword).mock.invocationCallOrder[0]!,
    );
    expect(identity.setPassword).toHaveBeenCalledWith(
      principal.userId,
      "Another-Strong-456!",
    );
    expect(repo.markInitialPasswordProviderUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: principal.companyId,
        idempotencyKey: "password-change-1",
        leaseVersion: 1,
        userId: principal.userId,
      }),
    );
    expect(repo.completeInitialPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: principal.companyId,
        userId: principal.userId,
        sessionId: principal.sessionId,
        idempotencyKey: "password-change-1",
      }),
    );
  });

  it("does not repeat the provider password write while moving an expired attempt into recovery", async () => {
    const repo = repository({
      reserveInitialPassword: vi.fn(async () => ({
        status: "RECOVERY_REQUIRED" as const,
      })),
    });
    const identity = provider();
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });

    await expect(
      service.changeInitialPassword(
        pendingPrincipal,
        { newPassword: "Another-Strong-456!" },
        "password-change-recovery",
      ),
    ).rejects.toMatchObject({
      code: "PASSWORD_RECOVERY_REQUIRED",
      retryable: true,
    });
    expect(identity.setPassword).not.toHaveBeenCalled();
    expect(identity.verifyPassword).not.toHaveBeenCalled();
    expect(repo.completeInitialPassword).not.toHaveBeenCalled();
  });

  it("proves the known provider password on an explicit recovery retry without rewriting it", async () => {
    const repo = repository({
      reserveInitialPassword: vi.fn(
        async () =>
          ({
            status: "RECOVERY_CONFIRMABLE" as const,
            idempotencyKey: "original-password-operation",
            leaseVersion: 1,
            loginName: "pendinghousekeeper",
            subject: pendingPrincipal.userId,
          }) as never,
      ),
    });
    const identity = provider();
    const service = createAccountService({
      repository: repo,
      provider: identity,
    });

    await expect(
      service.changeInitialPassword(
        pendingPrincipal,
        { newPassword: "Another-Strong-456!" },
        "explicit-recovery-request",
      ),
    ).resolves.toEqual({ status: "UPDATED" });
    expect(identity.setPassword).not.toHaveBeenCalled();
    expect(identity.verifyPassword).toHaveBeenCalledWith({
      expectedSubject: pendingPrincipal.userId,
      loginName: "pendinghousekeeper",
      password: "Another-Strong-456!",
    });
    expect(repo.confirmInitialPasswordProviderState).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: pendingPrincipal.companyId,
        idempotencyKey: "original-password-operation",
        leaseVersion: 1,
        userId: pendingPrincipal.userId,
      }),
    );
    expect(repo.completeInitialPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "original-password-operation",
      }),
    );
  });

  it("does not call ZITADEL initial-password mutation for a normal ACTIVE principal", async () => {
    const identity = provider();
    const service = createAccountService({
      repository: repository(),
      provider: identity,
    });
    await expect(
      service.changeInitialPassword(
        principal,
        { newPassword: "Another-Strong-456!" },
        "password-change-active",
      ),
    ).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
    expect(identity.setPassword).not.toHaveBeenCalled();
  });
});
