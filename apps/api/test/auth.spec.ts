import type { AuthenticatedPrincipal } from "@werehere/contracts";
import { describe, expect, it, vi } from "vitest";
import { AuthServiceError, type PasswordResetAuthService } from "../src/auth/service";
import { createApp } from "../src/app";

const principal: AuthenticatedPrincipal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF",
  displayName: "사내 임직원",
};

function createService(overrides: Partial<PasswordResetAuthService> = {}): PasswordResetAuthService {
  return {
    beginLogin: vi.fn(async () => ({
      authorizationUrl: "https://identity.example.test/oauth/v2/authorize",
      browserBinding: "browser-binding-value",
    })),
    completeLogin: vi.fn(async () => ({
      principal,
      redirectTo: "/hotel-operations",
      sessionToken: "opaque-session-token",
    })),
    finalizeCustomLogin: vi.fn(async () => ({
      callbackUrl: "https://hotel.example.test/api/auth/callback?code=code&state=state",
    })),
    logout: vi.fn(async () => true),
    prepareCustomLogin: vi.fn(async () => ({ csrf: "c".repeat(43) })),
    preparePasswordReset: vi.fn(async () => ({ token: `iv.${"t".repeat(64)}` })),
    resetPassword: vi.fn(async () => undefined),
    resolvePrincipal: vi.fn(async () => principal),
    ...overrides,
  };
}

describe("hotel auth API", () => {
  it("fails closed when the ZITADEL provider is not configured", async () => {
    const response = await createApp().request("/api/auth/login");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "AUTH_PROVIDER_NOT_CONFIGURED", retryable: false },
    });
  });

  it("redirects login to the server-generated provider authorization URL", async () => {
    const response = await createApp({ authService: createService() }).request("/api/auth/login");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://identity.example.test/oauth/v2/authorize");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__Host-hotel_oauth_browser=browser-binding-value");
    expect(cookie).toContain("Max-Age=600");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("returns HTTP 429 when anonymous login transaction capacity is exhausted", async () => {
    const service = createService({
      beginLogin: vi.fn(async () => {
        throw new AuthServiceError("AUTH_RATE_LIMITED", 429, true);
      }),
    });
    const response = await createApp({ authService: service }).request("/api/auth/login");
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "AUTH_RATE_LIMITED", retryable: true },
    });
  });

  it("binds a valid auth request to the initiating browser before rendering credentials", async () => {
    const service = createService();
    const response = await createApp({ authService: service }).request(
      "/api/auth/custom-login/start?authRequest=oidc-request-1",
      { headers: { cookie: "__Host-hotel_oauth_browser=browser-binding-value" } },
    );
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!, "https://hotel.example.test");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("authRequest")).toBe("oidc-request-1");
    expect(location.searchParams.get("csrf")).toBe("c".repeat(43));
    expect(service.prepareCustomLogin).toHaveBeenCalledWith("oidc-request-1", "browser-binding-value");
  });

  it("accepts the Login V2 /login suffix appended to the configured base URI", async () => {
    const service = createService();
    const response = await createApp({ authService: service }).request(
      "/api/auth/custom-login/start/login?authRequest=oidc-request-1",
      { headers: { cookie: "__Host-hotel_oauth_browser=browser-binding-value" } },
    );
    expect(response.status).toBe(303);
    expect(service.prepareCustomLogin).toHaveBeenCalledWith("oidc-request-1", "browser-binding-value");

    const unsupported = await createApp({ authService: service }).request(
      "/api/auth/custom-login/start/other?authRequest=oidc-request-1",
      { headers: { cookie: "__Host-hotel_oauth_browser=browser-binding-value" } },
    );
    expect(unsupported.status).toBe(404);
  });

  it("exchanges a fragment-derived same-origin POST body for an HttpOnly token", async () => {
    const service = createService();
    const response = await createApp({ authService: service }).request("/api/auth/password/exchange", {
      body: "userID=subject-1&code=reset-code&orgID=org-1",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://hotel.example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__Host-hotel_password_reset=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain("reset-code");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(service.preparePasswordReset).toHaveBeenCalledWith("subject-1", "reset-code");

    const duplicate = await createApp({ authService: service }).request("/api/auth/password/exchange", {
      body: "userID=subject-1&userID=subject-2&code=reset-code",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "__Host-hotel_password_reset=stale.token",
        origin: "https://hotel.example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(duplicate.status).toBe(400);
    expect(duplicate.headers.get("set-cookie") ?? "").toMatch(/__Host-hotel_password_reset=.*Max-Age=0/i);
    expect(service.preparePasswordReset).toHaveBeenCalledTimes(1);
  });

  it("sets a password only from a same-origin form bound to the encrypted reset cookie", async () => {
    const service = createService();
    const response = await createApp({ authService: service }).request("/api/auth/password/set", {
      body: new URLSearchParams({
        confirmation: "NewPassword-2026!",
        newPassword: "NewPassword-2026!",
      }).toString(),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `__Host-hotel_password_reset=iv.${"t".repeat(64)}`,
        origin: "https://hotel.example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login");
    expect(service.resetPassword).toHaveBeenCalledWith(`iv.${"t".repeat(64)}`, "NewPassword-2026!");
    expect(response.headers.get("set-cookie") ?? "").toMatch(/__Host-hotel_password_reset=.*Max-Age=0/i);
  });

  it("enforces the eight-character letter-number-symbol policy before calling ZITADEL", async () => {
    const service = createService();
    const request = async (password: string) => createApp({ authService: service }).request("/api/auth/password/set", {
      body: new URLSearchParams({ confirmation: password, newPassword: password }).toString(),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `__Host-hotel_password_reset=iv.${"t".repeat(64)}`,
        origin: "https://hotel.example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });

    const accepted = await request("Abcd123!");
    expect(accepted.headers.get("location")).toBe("/login");
    expect(service.resetPassword).toHaveBeenCalledTimes(1);

    for (const rejected of ["Abc123!", "12345678901!", "PasswordOnly!", "PasswordOnly1", "Abcd123 ", "Abcd123한"]) {
      const response = await request(rejected);
      expect(response.headers.get("location")).toBe("/password/set?error=password-policy");
    }
    expect(service.resetPassword).toHaveBeenCalledTimes(1);
  });

  it("preserves the reset cookie for a known password-policy rejection", async () => {
    const service = createService({
      resetPassword: vi.fn(async () => {
        throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
      }),
    });
    const response = await createApp({ authService: service }).request("/api/auth/password/set", {
      body: "newPassword=NewPassword-2026!&confirmation=NewPassword-2026!",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `__Host-hotel_password_reset=iv.${"t".repeat(64)}`,
        origin: "https://hotel.example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(response.headers.get("location")).toBe("/password/set?error=password-rejected");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("expires the reset cookie when the verification code is terminally invalid", async () => {
    const service = createService({
      resetPassword: vi.fn(async () => {
        throw new AuthServiceError("AUTH_FLOW_INVALID", 400, false);
      }),
    });
    const response = await createApp({ authService: service }).request("/api/auth/password/set", {
      body: "newPassword=NewPassword-2026!&confirmation=NewPassword-2026!",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `__Host-hotel_password_reset=iv.${"t".repeat(64)}`,
        origin: "https://hotel.example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(response.headers.get("location")).toBe("/password/set?error=invalid-link");
    expect(response.headers.get("set-cookie") ?? "").toMatch(/__Host-hotel_password_reset=.*Max-Age=0/i);
  });

  it("rejects mismatched or cross-site password reset forms before calling ZITADEL", async () => {
    const service = createService();
    const mismatch = await createApp({ authService: service }).request("/api/auth/password/set", {
      body: "newPassword=NewPassword-2026!&confirmation=DifferentPassword-2026!",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `__Host-hotel_password_reset=iv.${"t".repeat(64)}`,
        origin: "https://hotel.example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(mismatch.status).toBe(303);
    expect(mismatch.headers.get("location")).toBe("/password/set?error=password-mismatch");

    const crossSite = await createApp({ authService: service }).request("/api/auth/password/set", {
      body: "newPassword=NewPassword-2026!&confirmation=NewPassword-2026!",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `__Host-hotel_password_reset=iv.${"t".repeat(64)}`,
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(crossSite.status).toBe(303);
    expect(crossSite.headers.get("location")).toBe("/password/set?error=invalid-link");
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it("shows a generic unavailable error when auth request validation cannot reach the provider", async () => {
    const service = createService({
      prepareCustomLogin: vi.fn(async () => {
        throw new AuthServiceError("AUTH_PROVIDER_UNAVAILABLE", 503, true);
      }),
    });
    const response = await createApp({ authService: service }).request(
      "/api/auth/custom-login/start/login?authRequest=oidc-request-1",
      { headers: { cookie: "__Host-hotel_oauth_browser=browser-binding-value" } },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login?error=unavailable");
  });

  it("finalizes a same-origin hotel credential form through the OIDC callback", async () => {
    const service = createService();
    const response = await createApp({ authService: service }).request("/api/auth/custom-login", {
      body: new URLSearchParams({
        authRequest: "oidc-request-1",
        csrf: "c".repeat(43),
        loginName: "  Hotel-Admin  ",
        password: "password-value",
      }).toString(),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "cf-connecting-ip": "203.0.113.10",
        cookie: "__Host-hotel_oauth_browser=browser-binding-value",
        origin: "https://hotel.example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/api/auth/callback?code=");
    expect(service.finalizeCustomLogin).toHaveBeenCalledWith({
      authRequest: "oidc-request-1",
      browserBinding: "browser-binding-value",
      csrf: "c".repeat(43),
      ipAddress: "203.0.113.10",
      loginName: "Hotel-Admin",
      password: "password-value",
    });
  });

  it("rejects a same-origin credential form without the single-use CSRF", async () => {
    const service = createService();
    const response = await createApp({ authService: service }).request("/api/auth/custom-login", {
      body: "authRequest=request&loginName=user&password=password",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "__Host-hotel_oauth_browser=browser-binding-value",
        origin: "https://hotel.example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login?error=invalid-flow");
    expect(service.finalizeCustomLogin).not.toHaveBeenCalled();
  });

  it("rejects cross-site credential forms before calling ZITADEL", async () => {
    const service = createService();
    const response = await createApp({ authService: service }).request("/api/auth/custom-login", {
      body: "authRequest=request&loginName=user&password=password",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "__Host-hotel_oauth_browser=browser-binding-value",
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login?error=invalid-flow");
    expect(service.finalizeCustomLogin).not.toHaveBeenCalled();
  });

  it("returns one generic hotel error for invalid credentials", async () => {
    const service = createService({
      finalizeCustomLogin: vi.fn(async () => {
        throw new AuthServiceError("AUTH_CREDENTIALS_INVALID", 401, false);
      }),
    });
    const response = await createApp({ authService: service }).request("/api/auth/custom-login", {
      body: `authRequest=request-1&csrf=${"c".repeat(43)}&loginName=user&password=wrong`,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "__Host-hotel_oauth_browser=browser-binding-value",
        origin: "https://hotel.example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    }, { ZITADEL_REDIRECT_URI: "https://hotel.example.test/api/auth/callback" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location"))
      .toBe("/api/auth/custom-login/start?authRequest=request-1&error=invalid-credentials");
  });

  it("rejects callback requests without both code and state", async () => {
    const response = await createApp({ authService: createService() }).request("/api/auth/callback?code=only-code");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "AUTH_FLOW_INVALID" } });
  });

  it("rejects a callback that is not bound to the initiating browser", async () => {
    const service = createService();
    const response = await createApp({ authService: service })
      .request("/api/auth/callback?code=code-value&state=state-value");
    expect(response.status).toBe(400);
    expect(service.completeLogin).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie") ?? "").toMatch(/__Host-hotel_oauth_browser=.*Max-Age=0/i);
  });

  it("sets only the approved host cookie after a valid callback", async () => {
    const response = await createApp({ authService: createService() })
      .request("/api/auth/callback?code=code-value&state=state-value", {
        headers: { cookie: "__Host-hotel_oauth_browser=browser-binding-value" },
      });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/hotel-operations");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__Host-hotel_session=opaque-session-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain=");
    expect(cookie).toContain("__Host-hotel_oauth_browser=");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("rejects a missing or fabricated session cookie", async () => {
    const service = createService({ resolvePrincipal: vi.fn(async () => null) });
    const app = createApp({ authService: service });
    const missing = await app.request("/api/auth/session");
    expect(missing.status).toBe(401);
    const fabricated = await app.request("/api/auth/session", {
      headers: { cookie: "__Host-hotel_session=eyJyb2xlIjoiYWRtaW4ifQ" },
    });
    expect(fabricated.status).toBe(401);
    expect(service.resolvePrincipal).toHaveBeenCalledWith("eyJyb2xlIjoiYWRtaW4ifQ");
  });

  it("rejects duplicate session cookies without choosing either value", async () => {
    const service = createService();
    const response = await createApp({ authService: service }).request("/api/auth/session", {
      headers: {
        cookie: "__Host-hotel_session=opaque-session-token; __Host-hotel_session=attacker-value",
      },
    });
    expect(response.status).toBe(401);
    expect(service.resolvePrincipal).not.toHaveBeenCalled();
  });

  it("returns only the server-derived principal for an active session", async () => {
    const response = await createApp({ authService: createService() }).request("/api/auth/session", {
      headers: { cookie: "__Host-hotel_session=opaque-session-token" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: { authenticated: true, principal },
      error: null,
    });
  });

  it("revokes logout and expires the host cookie", async () => {
    const service = createService();
    const response = await createApp({ authService: service }).request("/api/auth/logout", {
      method: "POST",
      headers: { cookie: "__Host-hotel_session=opaque-session-token" },
    });
    expect(response.status).toBe(204);
    expect(service.logout).toHaveBeenCalledWith("opaque-session-token");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__Host-hotel_session=");
    expect(cookie).toMatch(/Max-Age=0/i);
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("Domain=");
  });
});
