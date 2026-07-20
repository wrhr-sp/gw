import type { AuthRepository, CreateLoginTransactionInput } from "@werehere/db";
import { describe, expect, it, vi } from "vitest";
import {
  AuthServiceError,
  createAuthService,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
  SESSION_IDLE_LIFETIME_SECONDS,
  type CustomLoginProvider,
  type IdentityProvider,
} from "../src/auth/service";

async function setup() {
  let loginTransaction: CreateLoginTransactionInput | undefined;
  let nonce = "";
  const repository: AuthRepository = {
    createCustomLoginTransaction: vi.fn(async (input) => {
      loginTransaction = input;
      return { status: "CREATED" as const };
    }),
    createLoginTransaction: vi.fn(async (input) => {
      loginTransaction = input;
      return { status: "CREATED" as const };
    }),
    consumeLoginTransaction: vi.fn(async () => loginTransaction ? {
      codeVerifierCiphertext: loginTransaction.codeVerifierCiphertext,
      codeVerifierIv: loginTransaction.codeVerifierIv,
      encryptionKeyVersion: loginTransaction.encryptionKeyVersion,
      nonceHash: loginTransaction.nonceHash,
      redirectUri: loginTransaction.redirectUri,
    } : null),
    consumeCustomLoginAttempt: vi.fn(async () => ({ status: "CONSUMED" as const })),
    createSession: vi.fn(async (input) => ({
      status: "CREATED" as const,
      principal: {
        companyId: "10000000-0000-4000-8000-000000000001",
        identityId: "30000000-0000-4000-8000-000000000001",
        sessionId: input.sessionId,
        userId: "20000000-0000-4000-8000-000000000001",
        userType: "INTERNAL_STAFF" as const,
        displayName: "사내 임직원",
      },
    })),
    prepareCustomLogin: vi.fn(async () => ({ status: "PREPARED" as const })),
    reserveCustomLoginValidation: vi.fn(async () => ({ status: "RESERVED" as const })),
    reserveCustomLoginStart: vi.fn(async () => ({ status: "RESERVED" as const })),
    resolvePrincipal: vi.fn(async () => null),
    revokeSession: vi.fn(async () => true),
  };
  const provider: IdentityProvider = {
    buildAuthorizationUrl: vi.fn(async (input) => {
      nonce = input.nonce;
      return `https://identity.example.test/authorize?state=${input.state}`;
    }),
    exchangeCode: vi.fn(async () => ({
      authTime: new Date("2026-07-16T00:00:00.000Z"),
      nonce,
      subject: "subject-1",
    })),
  };
  const customLoginProvider: CustomLoginProvider = {
    validateAuthRequest: vi.fn(async () => undefined),
    authenticateAndFinalize: vi.fn(async () => ({
      callbackUrl: "https://hotel.example.test/api/auth/callback?code=code&state=state",
    })),
    setPassword: vi.fn(async () => undefined),
  };
  const encryptionKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const rateLimitKey = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"],
  );
  const service = createAuthService({
    customLoginProvider,
    encryptionKey,
    provider,
    rateLimitKey,
    redirectUri: "https://hotel.example.test/api/auth/callback",
    repository,
  });
  return { customLoginProvider, provider, repository, service, transaction: () => loginTransaction };
}

describe("auth service", () => {
  it("creates a short-lived server-side PKCE transaction", async () => {
    const { provider, service, transaction } = await setup();
    const login = await service.beginLogin();
    expect(login.authorizationUrl).toContain("https://identity.example.test/authorize");
    expect(login.browserBinding).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = transaction();
    expect(stored?.stateHash).toBeInstanceOf(Uint8Array);
    expect(stored?.stateHash).toHaveLength(32);
    expect(stored?.browserBindingHash).toHaveLength(32);
    expect(stored?.nonceHash).toHaveLength(32);
    expect(stored?.codeVerifierCiphertext.byteLength).toBeGreaterThanOrEqual(59);
    expect(stored?.codeVerifierIv).toHaveLength(12);
    expect(stored?.encryptionKeyVersion).toBe(1);
    expect(stored?.lifetimeSeconds).toBe(600);
    expect(provider.buildAuthorizationUrl).toHaveBeenCalledWith(expect.objectContaining({
      codeChallenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      redirectUri: "https://hotel.example.test/api/auth/callback",
    }));
  });

  it("binds an external custom auth request to the transaction created for the same browser", async () => {
    const { repository, service, transaction } = await setup();
    const login = await service.beginLogin();
    const prepared = await service.prepareCustomLogin("console-request-1", login.browserBinding);

    expect(prepared.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    const stored = transaction();
    const reservation = vi.mocked(repository.reserveCustomLoginValidation).mock.calls[0]?.[0];
    expect(reservation?.browserBindingHash).toEqual(stored?.browserBindingHash);
    expect(vi.mocked(repository.createLoginTransaction).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(repository.reserveCustomLoginValidation).mock.invocationCallOrder[0]!);
  });

  it("validates an external auth request before creating its browser transaction", async () => {
    const { customLoginProvider, repository, service } = await setup();
    const prepared = await service.beginCustomLogin("console-request-1", "203.0.113.10");

    expect(prepared.browserBinding).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(prepared.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(vi.mocked(customLoginProvider.validateAuthRequest).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(repository.createCustomLoginTransaction).mock.invocationCallOrder[0]!);
  });

  it("does not create a transaction for an invalid external auth request", async () => {
    const { customLoginProvider, repository, service } = await setup();
    vi.mocked(customLoginProvider.validateAuthRequest).mockRejectedValue(
      new AuthServiceError("AUTH_FLOW_INVALID", 400, false),
    );

    await expect(service.beginCustomLogin("invalid-request", "203.0.113.10")).rejects.toMatchObject({
      code: "AUTH_FLOW_INVALID",
    });
    expect(repository.createLoginTransaction).not.toHaveBeenCalled();
    expect(repository.createCustomLoginTransaction).not.toHaveBeenCalled();
  });

  it("rejects a replayed external auth request without creating another transaction", async () => {
    const { repository, service } = await setup();
    vi.mocked(repository.createCustomLoginTransaction).mockResolvedValue({ status: "REPLAYED" });

    await expect(service.beginCustomLogin("console-request-1", "203.0.113.10"))
      .rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
    expect(repository.createCustomLoginTransaction).toHaveBeenCalledOnce();
    expect(repository.createLoginTransaction).not.toHaveBeenCalled();
  });

  it("rate limits external auth request validation by IP before calling the provider", async () => {
    const { customLoginProvider, repository, service } = await setup();
    vi.mocked(repository.reserveCustomLoginStart).mockResolvedValue({ status: "RATE_LIMITED" });

    await expect(service.beginCustomLogin("console-request-1", "203.0.113.10"))
      .rejects.toMatchObject({ code: "AUTH_RATE_LIMITED", httpStatus: 429 });
    expect(customLoginProvider.validateAuthRequest).not.toHaveBeenCalled();
    expect(repository.createCustomLoginTransaction).not.toHaveBeenCalled();
  });

  it("uses independent IP buckets for custom login starts and credential attempts", async () => {
    const { repository, service } = await setup();
    await service.beginCustomLogin("console-request-1", "203.0.113.10");
    const startIpHash = vi.mocked(repository.reserveCustomLoginStart).mock.calls[0]?.[0];

    await service.finalizeCustomLogin({
      authRequest: "console-request-1",
      browserBinding: "browser-binding",
      csrf: "csrf-value",
      ipAddress: "203.0.113.10",
      loginName: "Hotel-Admin",
      password: "password-value",
    });
    const credentialIpHash = vi.mocked(repository.consumeCustomLoginAttempt).mock.calls[0]?.[0].ipHash;

    expect(startIpHash).toBeInstanceOf(Uint8Array);
    expect(credentialIpHash).toBeInstanceOf(Uint8Array);
    expect(startIpHash).not.toEqual(credentialIpHash);
  });

  it("does not persist a transaction when provider discovery fails", async () => {
    const { provider, repository, service } = await setup();
    vi.mocked(provider.buildAuthorizationUrl).mockRejectedValue(
      new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true),
    );
    await expect(service.beginLogin()).rejects.toMatchObject({
      code: "AUTH_PROVIDER_UNAVAILABLE",
    });
    expect(repository.createLoginTransaction).not.toHaveBeenCalled();
  });

  it("returns a stable rate-limit error when login transaction capacity is exhausted", async () => {
    const { repository, service } = await setup();
    vi.mocked(repository.createLoginTransaction).mockResolvedValue({ status: "CAPACITY_EXCEEDED" });
    await expect(service.beginLogin()).rejects.toMatchObject({
      code: "AUTH_RATE_LIMITED",
      httpStatus: 429,
      retryable: true,
    });
  });

  it("consumes the browser-bound single-use CSRF attempt before sending credentials", async () => {
    const { customLoginProvider, repository, service } = await setup();
    const prepared = await service.prepareCustomLogin("request-1", "browser-binding");
    expect(prepared.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(customLoginProvider.validateAuthRequest).toHaveBeenCalledWith("request-1");
    expect(repository.prepareCustomLogin).toHaveBeenCalledWith(expect.objectContaining({
      authRequestHash: expect.any(Uint8Array),
      browserBindingHash: expect.any(Uint8Array),
      csrfHash: expect.any(Uint8Array),
    }));

    await service.finalizeCustomLogin({
      authRequest: "request-1",
      browserBinding: "browser-binding",
      csrf: prepared.csrf,
      ipAddress: "203.0.113.10",
      loginName: "Hotel-Admin",
      password: "password-value",
    });
    expect(vi.mocked(repository.consumeCustomLoginAttempt).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(customLoginProvider.authenticateAndFinalize).mock.invocationCallOrder[0]!);
    expect(repository.consumeCustomLoginAttempt).toHaveBeenCalledWith(expect.objectContaining({
      accountHash: expect.any(Uint8Array),
      ipHash: expect.any(Uint8Array),
    }));

    const firstAccountHash = vi.mocked(repository.consumeCustomLoginAttempt).mock.calls[0]?.[0].accountHash;
    await service.finalizeCustomLogin({
      authRequest: "request-1",
      browserBinding: "browser-binding",
      csrf: prepared.csrf,
      ipAddress: "203.0.113.10",
      loginName: "ＨＯＴＥＬ-ＡＤＭＩＮ",
      password: "password-value",
    });
    const variantAccountHash = vi.mocked(repository.consumeCustomLoginAttempt).mock.calls[1]?.[0].accountHash;
    expect(variantAccountHash).toEqual(firstAccountHash);
    expect(customLoginProvider.authenticateAndFinalize).toHaveBeenLastCalledWith(expect.objectContaining({
      loginName: "ＨＯＴＥＬ-ＡＤＭＩＮ",
    }));

    vi.mocked(repository.consumeCustomLoginAttempt).mockResolvedValueOnce({ status: "FLOW_INVALID" });
    await expect(service.finalizeCustomLogin({
      authRequest: "request-1",
      browserBinding: "browser-binding",
      csrf: prepared.csrf,
      ipAddress: "203.0.113.10",
      loginName: "Hotel-Admin",
      password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
  });

  it("reissues CSRF without revalidating an already validated auth request", async () => {
    const { customLoginProvider, repository, service } = await setup();
    vi.mocked(repository.reserveCustomLoginValidation)
      .mockResolvedValueOnce({ status: "RESERVED" })
      .mockResolvedValueOnce({ status: "VALIDATED" });

    const first = await service.prepareCustomLogin("request-1", "browser-binding");
    const second = await service.prepareCustomLogin("request-1", "browser-binding");

    expect(first.csrf).not.toBe(second.csrf);
    expect(customLoginProvider.validateAuthRequest).toHaveBeenCalledTimes(1);
    expect(repository.prepareCustomLogin).toHaveBeenCalledTimes(2);
  });

  it("rate limits auth request validation before calling the provider", async () => {
    const { customLoginProvider, repository, service } = await setup();
    vi.mocked(repository.reserveCustomLoginValidation).mockResolvedValue({ status: "RATE_LIMITED" });

    await expect(service.prepareCustomLogin("request-1", "browser-binding"))
      .rejects.toMatchObject({ code: "AUTH_RATE_LIMITED", httpStatus: 429 });
    expect(customLoginProvider.validateAuthRequest).not.toHaveBeenCalled();
    expect(repository.prepareCustomLogin).not.toHaveBeenCalled();
  });

  it("exchanges a reset code for an encrypted short-lived cookie token and rejects tampering", async () => {
    const { customLoginProvider, service } = await setup();
    const prepared = await service.preparePasswordReset("subject-1", "reset-code-value");

    expect(prepared.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
    expect(prepared.token).not.toContain("subject-1");
    expect(prepared.token).not.toContain("reset-code-value");

    await service.resetPassword(prepared.token, "Abcd123!");
    expect(customLoginProvider.setPassword).toHaveBeenCalledWith({
      code: "reset-code-value",
      newPassword: "Abcd123!",
      userId: "subject-1",
    });

    for (const invalidPassword of ["Abc123!", "1234567!", "Password!", "Password1", "Abcd123 ", "Abcd123한"]) {
      await expect(service.resetPassword(prepared.token, invalidPassword))
        .rejects.toMatchObject({ code: "AUTH_CREDENTIALS_INVALID" });
    }
    expect(customLoginProvider.setPassword).toHaveBeenCalledTimes(1);

    const [iv, ciphertext] = prepared.token.split(".") as [string, string];
    const tamperedCiphertext = `${ciphertext.startsWith("a") ? "b" : "a"}${ciphertext.slice(1)}`;
    const tampered = `${iv}.${tamperedCiphertext}`;
    await expect(service.resetPassword(tampered, "AnotherPassword-2026!"))
      .rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
    await expect(service.resetPassword("a".repeat(4097), "AnotherPassword-2026!"))
      .rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
    await expect(service.resetPassword(`${prepared.token}=`, "AnotherPassword-2026!"))
      .rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
    await expect(service.resetPassword(`a.${ciphertext}`, "AnotherPassword-2026!"))
      .rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });

    const expiring = await service.preparePasswordReset("subject-1", "second-reset-code");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 11 * 60 * 1000);
      await expect(service.resetPassword(expiring.token, "AnotherPassword-2026!"))
        .rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
    } finally {
      vi.useRealTimers();
    }
    expect(customLoginProvider.setPassword).toHaveBeenCalledTimes(1);
  });

  it("creates only a token hash with the approved 8h/24h lifetimes", async () => {
    const { repository, service } = await setup();
    const login = await service.beginLogin();
    const state = new URL(login.authorizationUrl).searchParams.get("state");
    if (!state) throw new Error("state missing");
    const result = await service.completeLogin("authorization-code", state, login.browserBinding);
    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.createSession).toHaveBeenCalledWith(expect.objectContaining({
      idleLifetimeSeconds: SESSION_IDLE_LIFETIME_SECONDS,
      absoluteLifetimeSeconds: SESSION_ABSOLUTE_LIFETIME_SECONDS,
      tokenHash: expect.any(Uint8Array),
      providerSubject: "subject-1",
    }));
    const createInput = vi.mocked(repository.createSession).mock.calls[0]?.[0];
    expect(createInput?.tokenHash).toHaveLength(32);
    expect(JSON.stringify(createInput)).not.toContain(result.sessionToken);
  });

  it("rejects replayed or nonce-mismatched callbacks", async () => {
    const replay = await setup();
    vi.mocked(replay.repository.consumeLoginTransaction).mockResolvedValue(null);
    await expect(replay.service.completeLogin("code", "state", "browser-binding"))
      .rejects.toMatchObject({
        code: "AUTH_FLOW_INVALID",
      });

    const mismatch = await setup();
    const login = await mismatch.service.beginLogin();
    const state = new URL(login.authorizationUrl).searchParams.get("state");
    if (!state) throw new Error("state missing");
    vi.mocked(mismatch.provider.exchangeCode).mockResolvedValue({
      authTime: new Date(), nonce: "wrong-nonce", subject: "subject-1",
    });
    await expect(mismatch.service.completeLogin("code", state, login.browserBinding))
      .rejects.toMatchObject({
        code: "AUTH_FLOW_INVALID",
      });
  });

  it("does not auto-provision unknown provider identities", async () => {
    const { repository, service } = await setup();
    const login = await service.beginLogin();
    const state = new URL(login.authorizationUrl).searchParams.get("state");
    if (!state) throw new Error("state missing");
    vi.mocked(repository.createSession).mockResolvedValue({ status: "IDENTITY_NOT_PROVISIONED" });
    await expect(service.completeLogin("code", state, login.browserBinding)).rejects.toMatchObject({
      code: "IDENTITY_NOT_PROVISIONED",
    });
  });

  it("rejects fabricated claim-shaped cookies before a DB lookup", async () => {
    const { repository, service } = await setup();
    await expect(service.resolvePrincipal("eyJyb2xlIjoiYWRtaW4ifQ")).resolves.toBeNull();
    expect(repository.resolvePrincipal).not.toHaveBeenCalled();
    await expect(service.logout("eyJyb2xlIjoiYWRtaW4ifQ")).resolves.toBe(false);
    expect(repository.revokeSession).not.toHaveBeenCalled();
  });
});
