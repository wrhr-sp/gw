import { describe, expect, it, vi } from "vitest";
import { createZitadelCustomLoginProvider } from "../src/auth/zitadel-custom-login";

const base = {
  clientId: "hotel-client",
  consoleClientId: "console-client",
  issuer: "https://identity.example.test",
  organizationId: "org-1",
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
      userId: "subject-1",
      password: "password-value",
    });

    expect(result.callbackUrl).toContain("code=authorization-code");
    expect(result.clearBrowserBinding).toBe(false);
    const createBody = JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body));
    expect(createBody.checks).toEqual({
      user: { userId: "subject-1" },
      password: { password: "password-value" },
    });
    const callbackBody = JSON.parse(String(fetcher.mock.calls[5]?.[1]?.body));
    expect(callbackBody.session).toEqual({ sessionId: "session-1", sessionToken: "token-password" });
    expect(fetcher.mock.calls.every(([, init]) => init?.redirect === "manual")).toBe(true);
  });

  it("accepts omitted false booleans in protobuf JSON login settings", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ authRequest: {
        id: "request-proto-defaults",
        clientId: "hotel-client",
        redirectUri: base.redirectUri,
        scope: ["openid", "profile"],
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true } }))
      .mockResolvedValueOnce(json({ sessionId: "session-proto-defaults", sessionToken: "token-proto-defaults" }))
      .mockResolvedValueOnce(json({ session: {
        id: "session-proto-defaults",
        expirationDate: "2026-07-17T00:05:00.000Z",
        factors: {
          user: { id: "subject-1", organizationId: "org-1", verifiedAt: "2026-07-17T00:00:00.000Z" },
          password: { verifiedAt: "2026-07-17T00:00:10.000Z" },
        },
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true } }))
      .mockResolvedValueOnce(json({ callbackUrl: `${base.redirectUri}?code=authorization-code&state=state-value` }));

    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "request-proto-defaults",
      userId: "subject-1",
      password: "password-value",
    })).resolves.toEqual({
      callbackUrl: `${base.redirectUri}?code=authorization-code&state=state-value`,
      clearBrowserBinding: false,
    });
  });

  it("finalizes only the exact built-in Console client tuple to its fixed callback", async () => {
    const consoleRedirectUri = `${base.issuer}/ui/console/auth/callback`;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ authRequest: {
        id: "console-request-1",
        clientId: "console-client",
        redirectUri: consoleRedirectUri,
        scope: ["email", "openid", "profile"],
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: false } }))
      .mockResolvedValueOnce(json({ sessionId: "session-console", sessionToken: "token-console" }))
      .mockResolvedValueOnce(json({ session: {
        id: "session-console",
        expirationDate: "2026-07-17T00:05:00.000Z",
        factors: {
          user: { id: "subject-1", organizationId: "org-1", verifiedAt: "2026-07-17T00:00:00.000Z" },
          password: { verifiedAt: "2026-07-17T00:00:10.000Z" },
        },
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: false } }))
      .mockResolvedValueOnce(json({ callbackUrl: `${consoleRedirectUri}?code=console-code&state=console-state` }));

    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "console-request-1",
      userId: "subject-1",
      password: "password-value",
    })).resolves.toEqual({
      callbackUrl: `${consoleRedirectUri}?code=console-code&state=console-state`,
      clearBrowserBinding: true,
    });
  });

  it.each([
    {
      label: "Console client with hotel redirect",
      clientId: "console-client",
      redirectUri: base.redirectUri,
      scope: ["email", "openid", "profile"],
    },
    {
      label: "hotel client with Console redirect",
      clientId: "hotel-client",
      redirectUri: `${base.issuer}/ui/console/auth/callback`,
      scope: ["openid", "profile"],
    },
    {
      label: "Console client with hotel scopes",
      clientId: "console-client",
      redirectUri: `${base.issuer}/ui/console/auth/callback`,
      scope: ["openid", "profile"],
    },
    {
      label: "Console client with a duplicate scope",
      clientId: "console-client",
      redirectUri: `${base.issuer}/ui/console/auth/callback`,
      scope: ["email", "openid", "profile", "profile"],
    },
  ])("rejects a mixed auth request tuple: $label", async ({ clientId, redirectUri, scope }) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ authRequest: {
      id: "request-1",
      clientId,
      redirectUri,
      scope,
    } }));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.validateAuthRequest("request-1"))
      .rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("terminates the verified session when a Console request returns the hotel callback", async () => {
    const consoleRedirectUri = `${base.issuer}/ui/console/auth/callback`;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ authRequest: {
        id: "console-request-1",
        clientId: "console-client",
        redirectUri: consoleRedirectUri,
        scope: ["email", "openid", "profile"],
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: false } }))
      .mockResolvedValueOnce(json({ sessionId: "session-console", sessionToken: "token-console" }))
      .mockResolvedValueOnce(json({ session: {
        id: "session-console",
        expirationDate: "2026-07-17T00:05:00.000Z",
        factors: {
          user: { id: "subject-1", organizationId: "org-1", verifiedAt: "2026-07-17T00:00:00.000Z" },
          password: { verifiedAt: "2026-07-17T00:00:10.000Z" },
        },
      } }))
      .mockResolvedValueOnce(json({ settings: { allowLocalAuthentication: true, forceMfa: false, forceMfaLocalOnly: false } }))
      .mockResolvedValueOnce(json({ callbackUrl: `${base.redirectUri}?code=wrong-code&state=wrong-state` }))
      .mockResolvedValueOnce(json({ details: {} }));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });

    await expect(provider.authenticateAndFinalize({
      authRequest: "console-request-1",
      userId: "subject-1",
      password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
    expect(fetcher.mock.calls[6]?.[1]?.method).toBe("DELETE");
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
      userId: "subject-1",
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
      authRequest: "request-1", userId: "subject-1", password: "password-value",
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
      authRequest: "request-1", userId: "subject-1", password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_MFA_REQUIRED" });
  });

  it.each([
    {
      callbackUrl: `${base.redirectUri}?code=code&state=one&state=two`,
      label: "duplicate callback state",
    },
    {
      callbackUrl: `${base.redirectUri}?code=code&state=state&iss=https%3A%2F%2Fother.example.test`,
      label: "foreign callback issuer",
    },
  ])("rejects $label", async ({ callbackUrl }) => {
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
      .mockResolvedValueOnce(json({ callbackUrl }))
      .mockResolvedValueOnce(json({}));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "request-1", userId: "subject-1", password: "password-value",
    })).rejects.toMatchObject({ code: "AUTH_FLOW_INVALID" });
  });

  it("fails closed when a login policy field has an invalid type", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ authRequest: {
        id: "request-1",
        clientId: "hotel-client",
        redirectUri: base.redirectUri,
        scope: ["openid", "profile"],
      } }))
      .mockResolvedValueOnce(json({ settings: {
        allowLocalAuthentication: "true",
      } }));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.authenticateAndFinalize({
      authRequest: "request-1",
      userId: "subject-1",
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
      userId: "subject-1",
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
      userId: "subject-1",
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

  it("sets a password only with the one-time verification code and never returns it", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ details: { sequence: "1" } }));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });

    await expect(provider.setPassword({
      code: "reset-code",
      newPassword: "NewPassword-2026!",
      userId: "subject-1",
    })).resolves.toBeUndefined();

    expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://identity.example.test/v2/users/subject-1/password");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      newPassword: { changeRequired: false, password: "NewPassword-2026!" },
      verificationCode: "reset-code",
    });
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("POST");
  });

  it("classifies an expired reset code as a terminal invalid flow", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({
      details: [{ "@type": "type.googleapis.com/zitadel.v1.ErrorDetail", id: "CODE-QvUQ4P" }],
    }, 400));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.setPassword({
      code: "expired-code",
      newPassword: "NewPassword-2026!",
      userId: "subject-1",
    })).rejects.toMatchObject({ code: "AUTH_FLOW_INVALID", httpStatus: 400, retryable: false });
  });

  it("keeps the retry token only for a known password-policy rejection", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({
      details: [{ "@type": "type.googleapis.com/zitadel.v1.ErrorDetail", id: "DOMAIN-VoaRj" }],
    }, 400));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.setPassword({
      code: "valid-code",
      newPassword: "password-without-uppercase-2026!",
      userId: "subject-1",
    })).rejects.toMatchObject({ code: "AUTH_CREDENTIALS_INVALID", httpStatus: 401, retryable: false });
  });

  it("fails closed for an unknown provider 400 payload", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 400));
    const provider = createZitadelCustomLoginProvider({ ...base, fetcher });
    await expect(provider.setPassword({
      code: "unknown-code",
      newPassword: "NewPassword-2026!",
      userId: "subject-1",
    })).rejects.toMatchObject({ code: "AUTH_FLOW_INVALID", httpStatus: 400, retryable: false });
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
