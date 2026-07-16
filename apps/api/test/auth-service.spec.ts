import type { AuthRepository, CreateLoginTransactionInput } from "@werehere/db";
import { describe, expect, it, vi } from "vitest";
import {
  AuthServiceError,
  createAuthService,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
  SESSION_IDLE_LIFETIME_SECONDS,
  type IdentityProvider,
} from "../src/auth/service";

async function setup() {
  let loginTransaction: CreateLoginTransactionInput | undefined;
  let nonce = "";
  const repository: AuthRepository = {
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
  const encryptionKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const service = createAuthService({
    encryptionKey,
    provider,
    redirectUri: "https://hotel.example.test/api/auth/callback",
    repository,
  });
  return { provider, repository, service, transaction: () => loginTransaction };
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
