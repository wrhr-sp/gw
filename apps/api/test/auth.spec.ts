import type { AuthenticatedPrincipal } from "@werehere/contracts";
import { describe, expect, it, vi } from "vitest";
import { AuthServiceError, type AuthService } from "../src/auth/service";
import { createApp } from "../src/app";

const principal: AuthenticatedPrincipal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF",
  displayName: "사내 임직원",
};

function createService(overrides: Partial<AuthService> = {}): AuthService {
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
    logout: vi.fn(async () => true),
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
