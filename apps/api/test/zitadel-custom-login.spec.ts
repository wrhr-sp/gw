import { describe, expect, it, vi } from "vitest";
import { createZitadelCustomLoginProvider } from "../src/auth/zitadel-custom-login";

const base = {
  clientId: "hotel-client",
  issuer: "https://identity.example.test",
  redirectUri: "https://hotel.example.test/api/auth/callback",
  serviceUserToken: "service-token",
  now: () => new Date("2026-07-17T00:00:30.000Z"),
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("ZITADEL custom login provider", () => {
  it("finalizes the existing OIDC auth request with the latest password-verified session token", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ authRequest: {
        id: "request-1",
        clientId: "hotel-client",
        redirectUri: base.redirectUri,
        scope: ["openid", "profile"],
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: false } }))
      .mockResolvedValueOnce(json({ sessionId: "session-1", sessionToken: "token-password" }))
      .mockResolvedValueOnce(json({ session: {
        id: "session-1",
        expirationDate: "2026-07-17T00:05:00.000Z",
        factors: {
          user: { id: "subject-1", organizationId: "org-1", verifiedAt: "2026-07-17T00:00:00.000Z" },
          password: { verifiedAt: "2026-07-17T00:00:10.000Z" },
        },
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: false } }))
      .mockResolvedValueOnce(json({ callbackUrl: `${base.redirectUri}?code=authorization-code&state=state-value` }));

    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    const result = await provider.authenticateAndFinalize({
      authRequest: "request-1",
      loginName: "hotel-admin",
      password: "password-value",
    });

    expect(result.callbackUrl).toContain("code=authorization-code");
    const createBody = JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body));
    expect(createBody.checks).toEqual({
      user: { loginName: "hotel-admin" },
      password: { password: "password-value" },
    });
    const callbackBody = JSON.parse(String(fetcher.mock.calls[5]?.[1]?.body));
    expect(callbackBody.session).toEqual({ sessionId: "session-1", sessionToken: "token-password" });
    expect(fetcher.mock.calls.every(([, init]) => init?.redirect === "manual")).toBe(true);
  });

  it("fails closed before credential checks when MFA is mandatory", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ authRequest: {
        id: "request-1",
        clientId: "hotel-client",
        redirectUri: base.redirectUri,
        scope: ["openid", "profile"],
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: true, forceMfaLocalOnly: false } }));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "request-1",
      loginName: "hotel-admin",
      password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_MFA_REQUIRED" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the checked user factor omits its organization", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ authRequest: {
        id: "request-1", clientId: "hotel-client", redirectUri: base.redirectUri,
        scope: ["openid", "profile"],
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: false } }))
      .mockResolvedValueOnce(json({ sessionId: "session-1", sessionToken: "token-password" }))
      .mockResolvedValueOnce(json({ session: {
        id: "session-1",
        expirationDate: "2026-07-17T00:05:00.000Z",
        factors: {
          user: { id: "subject-1", verifiedAt: "2026-07-17T00:00:00.000Z" },
          password: { verifiedAt: "2026-07-17T00:00:10.000Z" },
        },
      } }))
      .mockResolvedValueOnce(json({}));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "request-1", loginName: "hotel-admin", password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_PROVIDER_UNAVAILABLE" });
  });

  it("does not finalize when organization policy requires MFA", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ authRequest: {
        id: "request-1", clientId: "hotel-client", redirectUri: base.redirectUri,
        scope: ["openid", "profile"],
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: false } }))
      .mockResolvedValueOnce(json({ sessionId: "session-1", sessionToken: "token-password" }))
      .mockResolvedValueOnce(json({ session: {
        id: "session-1",
        expirationDate: "2026-07-17T00:05:00.000Z",
        factors: {
          user: { id: "subject-1", organizationId: "org-1", verifiedAt: "2026-07-17T00:00:00.000Z" },
          password: { verifiedAt: "2026-07-17T00:00:10.000Z" },
        },
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: true } }))
      .mockResolvedValueOnce(json({}));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "request-1", loginName: "hotel-admin", password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_MFA_REQUIRED" });
  });

  it("rejects duplicate callback parameters", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ authRequest: {
        id: "request-1", clientId: "hotel-client", redirectUri: base.redirectUri,
        scope: ["openid", "profile"],
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: false } }))
      .mockResolvedValueOnce(json({ sessionId: "session-1", sessionToken: "token-password" }))
      .mockResolvedValueOnce(json({ session: {
        id: "session-1",
        expirationDate: "2026-07-17T00:05:00.000Z",
        factors: {
          user: { id: "subject-1", organizationId: "org-1", verifiedAt: "2026-07-17T00:00:00.000Z" },
          password: { verifiedAt: "2026-07-17T00:00:10.000Z" },
        },
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: false } }))
      .mockResolvedValueOnce(json({
        callbackUrl: `${base.redirectUri}?code=code&state=one&state=two`,
      }))
      .mockResolvedValueOnce(json({}));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "request-1", loginName: "hotel-admin", password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
  });

  it("fails closed when a required login policy field is omitted", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ authRequest: {
        id: "request-1",
        clientId: "hotel-client",
        redirectUri: base.redirectUri,
        scope: ["openid", "profile"],
      } }))
      .mockResolvedValueOnce(json({ settings: {
        allowLocalAuthentication: true,
        forceMfa: false,
      } }));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "request-1",
      loginName: "hotel-admin",
      password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_PROVIDER_UNAVAILABLE" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    { label: "unsupported scope", authRequest: { scope: ["openid", "profile", "email"] } },
    { label: "prompt requirement", authRequest: { prompt: ["login"] } },
    { label: "maxAge requirement", authRequest: { maxAge: "300s" } },
  ])("rejects $label before checking credentials", async ({ authRequest }) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ authRequest: {
      id: "request-1",
      clientId: "hotel-client",
      redirectUri: base.redirectUri,
      scope: ["openid", "profile"],
      ...authRequest,
    } }));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "request-1",
      loginName: "hotel-admin",
      password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects auth requests for another client before checking a password", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ authRequest: {
      id: "request-1",
      clientId: "other-client",
      redirectUri: base.redirectUri,
      scope: ["openid", "profile"],
    } }));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "request-1",
      loginName: "hotel-admin",
      password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("classifies malformed auth request responses as provider unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ authRequest: {
      id: "request-1",
      clientId: "hotel-client",
      redirectUri: base.redirectUri,
    } }));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.validateAuthRequest("request-1"))
      .rejects.toMatchObject({ code: "AUTH_PROVIDER_UNAVAILABLE" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("logs only safe redirect metadata when the provider redirects an API request", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: `${base.issuer}/ui/login?secret=not-logged` },
    }));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.validateAuthRequest("request-1"))
      .rejects.toMatchObject({ code: "AUTH_PROVIDER_UNAVAILABLE" });
    expect(warning).toHaveBeenCalledWith("custom_login_provider_redirect_rejected", {
      pathname: "/ui/login",
      sameOrigin: true,
      status: 302,
    });
    expect(warning.mock.calls.flat().join(" ")).not.toContain("secret");
    warning.mockRestore();
  });
});
