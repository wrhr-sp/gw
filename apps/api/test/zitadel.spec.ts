import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { createZitadelProvider } from "../src/auth/zitadel";

const issuer = "https://identity.example.test";
const clientId = "hotel-web-client";

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function signedIdToken(input: {
  audience?: string | string[];
  azp?: string;
  nonce: string;
}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    nonce: input.nonce,
    auth_time: now - 60,
    ...(input.azp ? { azp: input.azp } : {}),
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(input.audience ?? clientId)
    .setSubject("zitadel-subject-1")
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
  return { token, publicJwk: { ...publicJwk, alg: "RS256", kid: "test-key", use: "sig" } };
}

function providerFetcher(idToken: string, publicJwk: Record<string, unknown>) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = requestUrl(input);
    if (url.endsWith("/.well-known/openid-configuration")) {
      return Response.json({
        issuer,
        authorization_endpoint: `${issuer}/oauth/v2/authorize`,
        token_endpoint: `${issuer}/oauth/v2/token`,
        jwks_uri: `${issuer}/oauth/v2/keys`,
        scopes_supported: ["openid", "profile"],
      });
    }
    if (url.endsWith("/oauth/v2/token")) {
      expect(init?.method).toBe("POST");
      const body = init?.body;
      expect(body).toBeInstanceOf(URLSearchParams);
      const params = body as URLSearchParams;
      expect(params.get("grant_type")).toBe("authorization_code");
      expect(params.get("code_verifier")).toBe("a".repeat(43));
      expect(params.get("client_id")).toBe(clientId);
      return Response.json({
        id_token: idToken,
        access_token: "not-stored",
        token_type: "Bearer",
        expires_in: 300,
        scope: "openid profile",
      });
    }
    if (url.endsWith("/oauth/v2/keys")) {
      return Response.json({ keys: [publicJwk] });
    }
    return new Response(null, { status: 404 });
  });
}

describe("ZITADEL provider", () => {
  it("builds an authorization-code PKCE URL from verified discovery", async () => {
    const signed = await signedIdToken({ nonce: "nonce-value" });
    const provider = createZitadelProvider({
      clientId,
      issuer,
      fetcher: providerFetcher(signed.token, signed.publicJwk),
    });
    const authorizationUrl = new URL(await provider.buildAuthorizationUrl({
      codeChallenge: "challenge-value",
      nonce: "nonce-value",
      redirectUri: "https://hotel.example.test/api/auth/callback",
      state: "state-value",
    }));
    expect(authorizationUrl.origin + authorizationUrl.pathname).toBe(`${issuer}/oauth/v2/authorize`);
    expect(Object.fromEntries(authorizationUrl.searchParams)).toMatchObject({
      client_id: clientId,
      code_challenge: "challenge-value",
      code_challenge_method: "S256",
      nonce: "nonce-value",
      redirect_uri: "https://hotel.example.test/api/auth/callback",
      response_type: "code",
      scope: "openid profile",
      state: "state-value",
    });
  });

  it("verifies the RS256 ID token issuer, audience and JWKS", async () => {
    const signed = await signedIdToken({ nonce: "nonce-value" });
    const provider = createZitadelProvider({
      clientId,
      issuer,
      fetcher: providerFetcher(signed.token, signed.publicJwk),
    });
    const identity = await provider.exchangeCode({
      code: "authorization-code",
      codeVerifier: "a".repeat(43),
      redirectUri: "https://hotel.example.test/api/auth/callback",
    });
    expect(identity.subject).toBe("zitadel-subject-1");
    expect(identity.nonce).toBe("nonce-value");
    expect(identity.authTime).toBeInstanceOf(Date);
  });

  it.each([429, 503])("maps token endpoint HTTP %i to provider unavailable", async (status) => {
    const signed = await signedIdToken({ nonce: "nonce-value" });
    const baseFetcher = providerFetcher(signed.token, signed.publicJwk);
    const fetcher = vi.fn<typeof fetch>(async (request, init) => {
      if (requestUrl(request).endsWith("/oauth/v2/token")) {
        return new Response(null, { status });
      }
      return baseFetcher(request, init);
    });
    const provider = createZitadelProvider({ clientId, issuer, fetcher });
    await expect(provider.exchangeCode({
      code: "authorization-code",
      codeVerifier: "a".repeat(43),
      redirectUri: "https://hotel.example.test/api/auth/callback",
    })).rejects.toMatchObject({
      code: "AUTH_PROVIDER_UNAVAILABLE",
      httpStatus: 503,
      retryable: true,
    });
  });

  it("keeps a token endpoint request rejection as an invalid flow", async () => {
    const signed = await signedIdToken({ nonce: "nonce-value" });
    const baseFetcher = providerFetcher(signed.token, signed.publicJwk);
    const fetcher = vi.fn<typeof fetch>(async (request, init) => {
      if (requestUrl(request).endsWith("/oauth/v2/token")) {
        return new Response(null, { status: 400 });
      }
      return baseFetcher(request, init);
    });
    const provider = createZitadelProvider({ clientId, issuer, fetcher });
    await expect(provider.exchangeCode({
      code: "rejected-code",
      codeVerifier: "a".repeat(43),
      redirectUri: "https://hotel.example.test/api/auth/callback",
    })).rejects.toMatchObject({
      code: "AUTH_FLOW_INVALID",
      httpStatus: 400,
      retryable: false,
    });
  });

  it("maps a JWKS HTTP failure to provider unavailable", async () => {
    const signed = await signedIdToken({ nonce: "nonce-value" });
    const baseFetcher = providerFetcher(signed.token, signed.publicJwk);
    const fetcher = vi.fn<typeof fetch>(async (request, init) => {
      if (requestUrl(request).endsWith("/oauth/v2/keys")) {
        return new Response(null, { status: 503 });
      }
      return baseFetcher(request, init);
    });
    const provider = createZitadelProvider({ clientId, issuer, fetcher });
    await expect(provider.exchangeCode({
      code: "authorization-code",
      codeVerifier: "a".repeat(43),
      redirectUri: "https://hotel.example.test/api/auth/callback",
    })).rejects.toMatchObject({
      code: "AUTH_PROVIDER_UNAVAILABLE",
      httpStatus: 503,
      retryable: true,
    });
  });

  it("rejects an ID token issued for another client", async () => {
    const signed = await signedIdToken({ audience: "other-client", nonce: "nonce-value" });
    const provider = createZitadelProvider({
      clientId,
      issuer,
      fetcher: providerFetcher(signed.token, signed.publicJwk),
    });
    await expect(provider.exchangeCode({
      code: "authorization-code",
      codeVerifier: "a".repeat(43),
      redirectUri: "https://hotel.example.test/api/auth/callback",
    })).rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
  });

  it("rejects a multi-audience token whose authorized party is another client", async () => {
    const signed = await signedIdToken({
      audience: [clientId, "other-audience"],
      azp: "other-client",
      nonce: "nonce-value",
    });
    const provider = createZitadelProvider({
      clientId,
      issuer,
      fetcher: providerFetcher(signed.token, signed.publicJwk),
    });
    await expect(provider.exchangeCode({
      code: "authorization-code",
      codeVerifier: "a".repeat(43),
      redirectUri: "https://hotel.example.test/api/auth/callback",
    })).rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
  });
});
