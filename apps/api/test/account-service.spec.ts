import { createAccountRequestSchema, type AuthenticatedPrincipal, type CreateAccountRequest } from "@werehere/contracts";
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
const pendingPrincipal: AuthenticatedPrincipal = { ...principal, mustChangePassword: true };
const accountId = "21000000-0000-4000-8000-000000000001";
const hotelId = "50000000-0000-4000-8000-000000000001";
const secondHotelId = "50000000-0000-4000-8000-000000000002";
const request: CreateAccountRequest = {
  displayName: "김하우스",
  loginName: "housekeeper-01",
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

function repository(overrides: Partial<AccountRepository> = {}): AccountRepository {
  return {
    reserveCreate: vi.fn(async () => ({ status: "RESERVED_NOT_DISPATCHED" as const, accountId, leaseVersion: 1 })),
    markCreateDispatched: vi.fn(async () => "UPDATED" as const),
    markProviderCreated: vi.fn(async () => "UPDATED" as const),
    markCreateRecoveryRequired: vi.fn(async () => "UPDATED" as const),
    completeCreate: vi.fn(async () => ({ status: "CREATED" as const, account })),
    getCreateOutcome: vi.fn(async () => ({ status: "COMPLETED" as const, account })),
    prepareCompensation: vi.fn(async () => "UPDATED" as const),
    listAccounts: vi.fn(),
    listEligibleHotels: vi.fn(async () => ({ status: "OK" as const, hotels: [] })),
    getAccount: vi.fn(),
    getCapabilities: vi.fn(async () => ({ permissions: [] })),
    deactivateAccount: vi.fn(),
    reserveInitialPassword: vi.fn(async () => ({ status: "RESERVED_NOT_DISPATCHED" as const, subject: principal.userId, leaseVersion: 1 })),
    markInitialPasswordDispatched: vi.fn(async () => "UPDATED" as const),
    markInitialPasswordRecoveryRequired: vi.fn(async () => "UPDATED" as const),
    confirmInitialPasswordProviderState: vi.fn(async () => "UPDATED" as const),
    markInitialPasswordProviderUpdated: vi.fn(async () => "UPDATED" as const),
    completeInitialPassword: vi.fn(async () => ({ status: "UPDATED" as const })),
    ...overrides,
  };
}

function provider(overrides: Partial<UserProvisioningProvider> = {}): UserProvisioningProvider {
  return {
    createHumanUser: vi.fn(async () => ({ subject: accountId })),
    humanUserExists: vi.fn(async () => true),
    verifyPassword: vi.fn(async () => true),
    deactivateHumanUser: vi.fn(async () => undefined),
    setPassword: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("account administration service", () => {
  it.each([
    ["PW-7", "a1!aaaa", ["비밀번호는 8자 이상 입력해 주세요."]],
    ["PW-NO-LOWER", "A1!AAAAA", ["비밀번호에 영문 소문자를 포함해 주세요."]],
    ["PW-NO-NUMBER", "aa!aaaaa", ["비밀번호에 숫자를 포함해 주세요."]],
    ["PW-NO-P/S", "aa1aaaaa", ["비밀번호에 기호를 포함해 주세요."]],
    ["PW-201", `a1!${"a".repeat(198)}`, ["비밀번호는 200자 이하로 입력해 주세요."]],
    ["punctuation-only", "!!!!!!!!", [
      "비밀번호에 영문 소문자를 포함해 주세요.",
      "비밀번호에 숫자를 포함해 주세요.",
    ]],
    ["symbol-only", "💡💡💡💡💡💡💡💡", [
      "비밀번호에 영문 소문자를 포함해 주세요.",
      "비밀번호에 숫자를 포함해 주세요.",
    ]],
  ])("rejects invalid create password %s at the service boundary with zero provider calls", async (_fixture, initialPassword, messages) => {
    const repo = repository();
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });
    await expect(service.createAccount(principal, { ...request, initialPassword }, "invalid-password"))
      .rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        httpStatus: 400,
        fieldErrors: messages.map((message) => ({ field: "initialPassword", message })),
      });
    expect(repo.reserveCreate).not.toHaveBeenCalled();
    expect(identity.createHumanUser).not.toHaveBeenCalled();
    expect(identity.verifyPassword).not.toHaveBeenCalled();
  });

  it.each([
    ["PW-7", "a1!aaaa", ["비밀번호는 8자 이상 입력해 주세요."]],
    ["PW-NO-LOWER", "A1!AAAAA", ["비밀번호에 영문 소문자를 포함해 주세요."]],
    ["PW-NO-NUMBER", "aa!aaaaa", ["비밀번호에 숫자를 포함해 주세요."]],
    ["PW-NO-P/S", "aa1aaaaa", ["비밀번호에 기호를 포함해 주세요."]],
    ["PW-201", `a1!${"a".repeat(198)}`, ["비밀번호는 200자 이하로 입력해 주세요."]],
    ["punctuation-only", "!!!!!!!!", [
      "비밀번호에 영문 소문자를 포함해 주세요.",
      "비밀번호에 숫자를 포함해 주세요.",
    ]],
    ["symbol-only", "💡💡💡💡💡💡💡💡", [
      "비밀번호에 영문 소문자를 포함해 주세요.",
      "비밀번호에 숫자를 포함해 주세요.",
    ]],
  ])("rejects invalid forced-change password %s with zero DB/provider calls", async (
    _fixture,
    newPassword,
    messages,
  ) => {
    const repo = repository();
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });
    await expect(service.changeInitialPassword(pendingPrincipal, { newPassword }, "invalid-password"))
      .rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        httpStatus: 400,
        fieldErrors: messages.map((message) => ({ field: "newPassword", message })),
      });
    expect(repo.reserveInitialPassword).not.toHaveBeenCalled();
    expect(identity.setPassword).not.toHaveBeenCalled();
    expect(identity.verifyPassword).not.toHaveBeenCalled();
  });

  it("creates the provider identity before the tenant-bound DB account and read-back", async () => {
    const repo = repository();
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    const canonicalRequest = createAccountRequestSchema.parse({
      ...request,
      hotelIds: [hotelId, hotelId, secondHotelId],
    });
    await expect(service.createAccount(principal, canonicalRequest, "account-create-1")).resolves.toEqual({
      status: "CREATED",
      account,
    });
    expect(identity.createHumanUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: accountId,
      initialPassword: request.initialPassword,
    }));
    expect(repo.markProviderCreated).toHaveBeenCalledWith(expect.objectContaining({ accountId, subject: accountId }));
    expect(repo.completeCreate).toHaveBeenCalledWith(expect.objectContaining({
      accountId,
      companyId: principal.companyId,
      actorUserId: principal.userId,
      assignmentIds: [expect.any(String), expect.any(String)],
      value: expect.objectContaining({ hotelIds: [hotelId, secondHotelId] }),
      subject: accountId,
    }));
    expect(repo.reserveCreate).toHaveBeenCalledWith(expect.objectContaining({
      hotelIds: [hotelId, secondHotelId],
      completionPayload: expect.not.objectContaining({ hotelId: expect.anything() }),
    }));
    expect(repo.reserveCreate).toHaveBeenCalledWith(expect.objectContaining({
      hotelIds: [hotelId, secondHotelId],
      completionPayload: expect.objectContaining({ hotelIds: [hotelId, secondHotelId] }),
    }));
    expect(vi.mocked(repo.completeCreate).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(repo.getCreateOutcome).mock.invocationCallOrder.at(-1)!);
    expect(repo.getCreateOutcome).toHaveBeenCalledWith({
      accountId,
      companyId: principal.companyId,
      sessionId: principal.sessionId,
    });
  });

  it("rejects an out-of-tenant hotel before mutating the identity provider", async () => {
    const repo = repository({
      reserveCreate: vi.fn(async () => ({ status: "HOTEL_NOT_FOUND" } as never)),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, "account-create-invalid-hotel"))
      .rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND", httpStatus: 404 });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
  });

  it.each([
    ["COMPENSATED", "ACCOUNT_DUPLICATE", 409],
    ["COMPENSATION_REQUIRED", "COMPENSATION_REQUIRED", 503],
  ] as const)("returns stable terminal recovery for %s create replay", async (status, code, httpStatus) => {
    const repo = repository({ reserveCreate: vi.fn(async () => ({ status } as never)) });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, `account-create-${status}`))
      .rejects.toMatchObject({ code, httpStatus, retryable: false });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
  });

  it("resumes DB completion without recreating a provider user after PROVIDER_CREATED", async () => {
    const repo = repository({
      reserveCreate: vi.fn(async () => ({ status: "PROVIDER_CONFIRMED", accountId, subject: accountId } as never)),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, "account-create-resume")).resolves.toEqual({
      status: "CREATED",
      account,
    });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
    expect(identity.verifyPassword).toHaveBeenCalledWith({
      expectedSubject: accountId,
      loginName: request.loginName,
      password: request.initialPassword,
    });
    expect(repo.completeCreate).toHaveBeenCalledWith(expect.objectContaining({ accountId, subject: accountId }));
  });

  it("rejects a credential-bearing create replay instead of claiming a different password was applied", async () => {
    const repo = repository({
      reserveCreate: vi.fn(async () => ({ status: "REPLAYED", account } as never)),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, "account-create-replay"))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", retryable: false });
    expect(identity.createHumanUser).not.toHaveBeenCalled();
    expect(identity.verifyPassword).not.toHaveBeenCalled();
  });

  it("does not compensate a deterministic provider identity after losing the create lease", async () => {
    const repo = repository({
      markProviderCreated: vi.fn(async () => "STALE_LEASE" as const),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, "account-create-stale-owner"))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", retryable: true });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("records a duplicate provider result for reconciliation without immediate credential probing", async () => {
    const repo = repository();
    const identity = provider({
      createHumanUser: vi.fn(async () => { throw new AccountProviderError("ACCOUNT_DUPLICATE", 409, false); }),
    });
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, "account-create-recover"))
      .rejects.toMatchObject({ code: "ACCOUNT_DUPLICATE", retryable: false });
    expect(vi.mocked(repo.markCreateDispatched).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(identity.createHumanUser).mock.invocationCallOrder[0]!);
    expect(repo.markCreateRecoveryRequired).toHaveBeenCalledWith(expect.objectContaining({
      accountId,
      errorCode: "ACCOUNT_DUPLICATE",
    }));
    expect(identity.humanUserExists).not.toHaveBeenCalled();
    expect(identity.verifyPassword).not.toHaveBeenCalled();
    expect(repo.markProviderCreated).not.toHaveBeenCalled();
    expect(repo.completeCreate).not.toHaveBeenCalled();
  });

  it("records an ambiguous provider timeout without repeating or completing the create", async () => {
    const repo = repository();
    const identity = provider({
      createHumanUser: vi.fn(async () => { throw new Error("provider timeout"); }),
    });
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, "account-create-wrong-credential"))
      .rejects.toMatchObject({ code: "EXTERNAL_AUTH_UNAVAILABLE", retryable: true });
    expect(repo.markCreateRecoveryRequired).toHaveBeenCalledWith(expect.objectContaining({
      accountId,
      errorCode: "EXTERNAL_AUTH_UNAVAILABLE",
    }));
    expect(identity.humanUserExists).not.toHaveBeenCalled();
    expect(identity.verifyPassword).not.toHaveBeenCalled();
    expect(repo.markProviderCreated).not.toHaveBeenCalled();
    expect(repo.completeCreate).not.toHaveBeenCalled();
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("reads back an ambiguous DB commit and never compensates a completed account", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => { throw new Error("commit response lost"); }),
      getCreateOutcome: vi.fn(async () => ({ status: "COMPLETED", account } as never)),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, "account-create-2"))
      .resolves.toEqual({ status: "CREATED", account });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("leaves an ambiguous provider-created attempt recoverable instead of disabling it", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => { throw new Error("database unavailable"); }),
      getCreateOutcome: vi.fn(async () => ({ status: "PROVIDER_CONFIRMED" } as never)),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, "account-create-ambiguous"))
      .rejects.toMatchObject({ code: "INTERNAL_ERROR", retryable: true });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("resolves a stale compensation owner from DB without deactivating the completed identity", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => ({ status: "DUPLICATE" as const })),
      prepareCompensation: vi.fn(async () => "STALE_LEASE" as const),
      getCreateOutcome: vi.fn(async () => ({ status: "COMPLETED" as const, account })),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, "account-create-stale-compensation"))
      .resolves.toEqual({ status: "CREATED", account });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("durably reserves compensation for the single outbox dispatcher without an API provider call", async () => {
    const repo = repository({
      completeCreate: vi.fn(async () => ({ status: "DUPLICATE" as const })),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.createAccount(principal, request, "account-create-owned-compensation"))
      .rejects.toMatchObject({ code: "COMPENSATION_REQUIRED" });
    expect(repo.prepareCompensation).toHaveBeenCalledWith(expect.objectContaining({ leaseVersion: 1 }));
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("blocks self-deactivation before calling the provider", async () => {
    const identity = provider();
    const service = createAccountService({ repository: repository(), provider: identity });
    await expect(service.deactivateAccount(principal, principal.userId, { version: 1, reason: "잘못된 요청" }))
      .rejects.toMatchObject({ code: "ACCOUNT_SELF_DEACTIVATION_FORBIDDEN" });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("rejects a deactivation idempotency conflict before calling the provider", async () => {
    const repo = repository({ deactivateAccount: vi.fn(async () => ({ status: "IDEMPOTENCY_CONFLICT" as const })) });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });
    await expect(service.deactivateAccount(principal, accountId, { version: 1, reason: "관리자 중지" }, "deactivate-key"))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(repo.deactivateAccount).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "deactivate-key",
      requestHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    }));
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("leaves provider deactivation to the single outbox dispatcher", async () => {
    const repo = repository({
      deactivateAccount: vi.fn(async () => ({
        status: "UPDATED" as const,
        account: { ...account, status: "INACTIVE" as const, version: 2 },
        providerSubject: "zitadel-target-admin-subject",
      } as never)),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });
    await expect(service.deactivateAccount(principal, accountId, { version: 1, reason: "관리자 중지" }, "deactivate-success"))
      .resolves.toMatchObject({ status: "UPDATED", account: { status: "INACTIVE" } });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("does not let provider availability race the committed deactivation outbox", async () => {
    const repo = repository({
      deactivateAccount: vi.fn(async () => ({
        status: "UPDATED" as const,
        account: { ...account, status: "INACTIVE" as const, version: 2 },
        providerSubject: "zitadel-target-admin-subject",
      } as never)),
    });
    const identity = provider({
      deactivateHumanUser: vi.fn(async () => { throw new AccountProviderError("EXTERNAL_AUTH_UNAVAILABLE", 503, true); }),
    });
    const service = createAccountService({ repository: repo, provider: identity });
    await expect(service.deactivateAccount(principal, accountId, { version: 1, reason: "관리자 중지" }, "deactivate-failed"))
      .resolves.toMatchObject({ status: "UPDATED" });
    expect(identity.deactivateHumanUser).not.toHaveBeenCalled();
  });

  it("reserves PENDING_SETUP in DB before changing ZITADEL and clearing the local gate", async () => {
    const repo = repository();
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });
    await service.changeInitialPassword(pendingPrincipal, { newPassword: "Another-Strong-456!" }, "password-change-1");
    expect(repo.reserveInitialPassword).toHaveBeenCalledWith(expect.objectContaining({
      companyId: principal.companyId,
      idempotencyKey: "password-change-1",
      userId: principal.userId,
    }));
    expect(vi.mocked(repo.reserveInitialPassword).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(identity.setPassword).mock.invocationCallOrder[0]!);
    expect(identity.setPassword).toHaveBeenCalledWith(principal.userId, "Another-Strong-456!");
    expect(repo.markInitialPasswordProviderUpdated).toHaveBeenCalledWith(expect.objectContaining({
      companyId: principal.companyId,
      idempotencyKey: "password-change-1",
      leaseVersion: 1,
      userId: principal.userId,
    }));
    expect(repo.completeInitialPassword).toHaveBeenCalledWith(expect.objectContaining({
      companyId: principal.companyId,
      userId: principal.userId,
      sessionId: principal.sessionId,
      idempotencyKey: "password-change-1",
    }));
  });

  it("does not repeat the provider password write while moving an expired attempt into recovery", async () => {
    const repo = repository({
      reserveInitialPassword: vi.fn(async () => ({ status: "RECOVERY_REQUIRED" as const })),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.changeInitialPassword(
      pendingPrincipal,
      { newPassword: "Another-Strong-456!" },
      "password-change-recovery",
    )).rejects.toMatchObject({ code: "PASSWORD_RECOVERY_REQUIRED", retryable: true });
    expect(identity.setPassword).not.toHaveBeenCalled();
    expect(identity.verifyPassword).not.toHaveBeenCalled();
    expect(repo.completeInitialPassword).not.toHaveBeenCalled();
  });

  it("proves the known provider password on an explicit recovery retry without rewriting it", async () => {
    const repo = repository({
      reserveInitialPassword: vi.fn(async () => ({
        status: "RECOVERY_CONFIRMABLE" as const,
        idempotencyKey: "original-password-operation",
        leaseVersion: 1,
        loginName: "pending-housekeeper",
        subject: pendingPrincipal.userId,
      } as never)),
    });
    const identity = provider();
    const service = createAccountService({ repository: repo, provider: identity });

    await expect(service.changeInitialPassword(
      pendingPrincipal,
      { newPassword: "Another-Strong-456!" },
      "explicit-recovery-request",
    )).resolves.toEqual({ status: "UPDATED" });
    expect(identity.setPassword).not.toHaveBeenCalled();
    expect(identity.verifyPassword).toHaveBeenCalledWith({
      expectedSubject: pendingPrincipal.userId,
      loginName: "pending-housekeeper",
      password: "Another-Strong-456!",
    });
    expect(repo.confirmInitialPasswordProviderState).toHaveBeenCalledWith(expect.objectContaining({
      companyId: pendingPrincipal.companyId,
      idempotencyKey: "original-password-operation",
      leaseVersion: 1,
      userId: pendingPrincipal.userId,
    }));
    expect(repo.completeInitialPassword).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "original-password-operation",
    }));
  });

  it("does not call ZITADEL initial-password mutation for a normal ACTIVE principal", async () => {
    const identity = provider();
    const service = createAccountService({ repository: repository(), provider: identity });
    await expect(service.changeInitialPassword(principal, { newPassword: "Another-Strong-456!" }, "password-change-active"))
      .rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
    expect(identity.setPassword).not.toHaveBeenCalled();
  });
});
