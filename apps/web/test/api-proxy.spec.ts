import { afterEach, describe, expect, it, vi } from "vitest";
import { hotelErrorResponseSchema } from "@werehere/contracts";
import { GET, POST } from "../app/api/[...path]/route";

const originalOrigin = process.env.HOTEL_API_ORIGIN;

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.HOTEL_API_ORIGIN;
  else process.env.HOTEL_API_ORIGIN = originalOrigin;
  vi.unstubAllGlobals();
});

describe("same-origin API runtime proxy", () => {
  it("fails closed when the API origin is not configured", async () => {
    delete process.env.HOTEL_API_ORIGIN;
    const response = await GET(
      new Request("https://hotel.example.test/api/auth/login"),
      { params: Promise.resolve({ path: ["auth", "login"] }) },
    );
    expect(response.status).toBe(503);
    const body = hotelErrorResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      ok: false,
      error: { code: "AUTH_PROVIDER_NOT_CONFIGURED" },
    });
  });

  it("returns the shared hotel error contract when the hotel API origin is missing", async () => {
    delete process.env.HOTEL_API_ORIGIN;
    const response = await GET(
      new Request("https://hotel.example.test/api/hotels"),
      { params: Promise.resolve({ path: ["hotels"] }) },
    );
    expect(response.status).toBe(503);
    const body = hotelErrorResponseSchema.parse(await response.json());
    expect(body.error).toMatchObject({
      code: "DB_NOT_CONFIGURED",
      fieldErrors: [],
      retryAfterSeconds: null,
      retryable: false,
    });
  });

  it("forwards query and cookies and preserves redirect response headers", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:8787/api/auth/callback?code=value&state=state");
      expect(new Headers(init?.headers).get("cookie")).toBe("__Host-hotel_oauth_browser=binding");
      expect(init?.redirect).toBe("manual");
      const headers = new Headers({ location: "/hotel-operations" });
      headers.append(
        "set-cookie",
        "__Host-hotel_session=opaque; Path=/; Secure; HttpOnly; SameSite=Lax",
      );
      headers.append(
        "set-cookie",
        "__Host-hotel_oauth_browser=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
      );
      return new Response(null, {
        status: 302,
        headers,
      });
    });
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await GET(
      new Request("https://hotel.example.test/api/auth/callback?code=value&state=state", {
        headers: { cookie: "__Host-hotel_oauth_browser=binding" },
      }),
      { params: Promise.resolve({ path: ["auth", "callback"] }) },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/hotel-operations");
    expect(response.headers.getSetCookie()).toEqual([
      expect.stringContaining("__Host-hotel_session=opaque"),
      expect.stringContaining("__Host-hotel_oauth_browser="),
    ]);
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });

  it("redirects callback transport failures without exposing proxy JSON", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("transport sentinel")));
    const response = await GET(
      new Request("https://hotel.example.test/api/auth/callback?code=value&state=state"),
      { params: Promise.resolve({ path: ["auth", "callback"] }) },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login?error=unavailable");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie") ?? "")
      .toMatch(/__Host-hotel_oauth_browser=.*Max-Age=0/i);
    expect(await response.text()).not.toContain("transport sentinel");
  });

  it("allows only the exact Login V2 suffix appended to the custom login base URI", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe(
        "http://127.0.0.1:8787/api/auth/custom-login/start/login?authRequest=request-1",
      );
      return new Response(null, { status: 303, headers: { location: "/login" } });
    });
    vi.stubGlobal("fetch", upstreamFetch);

    const allowed = await GET(
      new Request("https://hotel.example.test/api/auth/custom-login/start/login?authRequest=request-1"),
      { params: Promise.resolve({ path: ["auth", "custom-login", "start", "login"] }) },
    );
    expect(allowed.status).toBe(303);

    const unapproved = await GET(
      new Request("https://hotel.example.test/api/auth/custom-login/start/other?authRequest=request-1"),
      { params: Promise.resolve({ path: ["auth", "custom-login", "start", "other"] }) },
    );
    expect(unapproved.status).toBe(404);
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });

  it("allows only the exact password-reset exchange and submit endpoints", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      return String(input).endsWith("/api/auth/password/exchange")
        ? new Response(null, {
          headers: { "set-cookie": "__Host-hotel_password_reset=opaque; Path=/; HttpOnly; Secure; SameSite=Strict" },
          status: 204,
        })
        : new Response(null, { status: 303, headers: { location: "/login" } });
    });
    vi.stubGlobal("fetch", upstreamFetch);

    const exchange = await POST(
      new Request("https://hotel.example.test/api/auth/password/exchange", {
        body: "userID=user-1&code=code-1",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["auth", "password", "exchange"] }) },
    );
    expect(exchange.status).toBe(204);
    expect(exchange.headers.get("set-cookie")).toContain("__Host-hotel_password_reset=opaque");
    expect(String(upstreamFetch.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:8787/api/auth/password/exchange",
    );
    expect(new TextDecoder().decode(upstreamFetch.mock.calls[0]?.[1]?.body as ArrayBuffer))
      .toBe("userID=user-1&code=code-1");

    const submit = await POST(
      new Request("https://hotel.example.test/api/auth/password/set", {
        body: "newPassword=NewPassword-2026!&confirmation=NewPassword-2026!",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["auth", "password", "set"] }) },
    );
    expect(submit.status).toBe(303);

    const unapproved = await GET(
      new Request("https://hotel.example.test/api/auth/custom-login/start/password/other"),
      { params: Promise.resolve({ path: ["auth", "custom-login", "start", "password", "other"] }) },
    );
    expect(unapproved.status).toBe(404);
    expect(upstreamFetch).toHaveBeenCalledTimes(2);
  });

  it("expires a stale reset cookie when the exchange upstream is unavailable", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("upstream unavailable")));

    const response = await POST(
      new Request("https://hotel.example.test/api/auth/password/exchange", {
        body: "userID=user-1&code=code-1",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["auth", "password", "exchange"] }) },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie") ?? "").toMatch(/__Host-hotel_password_reset=.*Max-Age=0/i);
  });

  it("rejects a non-HTTPS non-local API origin", async () => {
    process.env.HOTEL_API_ORIGIN = "http://api.example.test";
    const response = await GET(
      new Request("https://hotel.example.test/api/auth/session"),
      { params: Promise.resolve({ path: ["auth", "session"] }) },
    );
    expect(response.status).toBe(503);
  });

  it("proxies only the approved hotel collection and detail methods", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstreamFetch);

    const hotels = await GET(
      new Request("https://hotel.example.test/api/hotels"),
      { params: Promise.resolve({ path: ["hotels"] }) },
    );
    expect(hotels.status).toBe(200);

    const hotelId = "50000000-0000-4000-8000-000000000001";
    const detail = await GET(
      new Request(`https://hotel.example.test/api/hotels/${hotelId}`),
      { params: Promise.resolve({ path: ["hotels", hotelId] }) },
    );
    expect(detail.status).toBe(200);

    const unapprovedPath = await POST(
      new Request(`https://hotel.example.test/api/hotels/${hotelId}/activate`, { method: "POST" }),
      { params: Promise.resolve({ path: ["hotels", hotelId, "activate"] }) },
    );
    expect(unapprovedPath.status).toBe(404);

    const wrongMethod = await POST(
      new Request("https://hotel.example.test/api/auth/session", { method: "POST" }),
      { params: Promise.resolve({ path: ["auth", "session"] }) },
    );
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("GET");
    expect(hotelErrorResponseSchema.parse(await wrongMethod.json())).toMatchObject({
      ok: false,
      error: { code: "RESOURCE_NOT_FOUND", retryable: false },
    });
  });

  it("proxies only approved account collection, detail, deactivate, and password paths", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", upstreamFetch);
    const userId = "21000000-0000-4000-8000-000000000001";
    const collection = await GET(new Request("https://hotel.example.test/api/admin/users"), { params: Promise.resolve({ path: ["admin", "users"] }) });
    const detail = await GET(new Request(`https://hotel.example.test/api/admin/users/${userId}`), { params: Promise.resolve({ path: ["admin", "users", userId] }) });
    const deactivate = await POST(new Request(`https://hotel.example.test/api/admin/users/${userId}/deactivate`, { method: "POST" }), { params: Promise.resolve({ path: ["admin", "users", userId, "deactivate"] }) });
    const password = await POST(new Request("https://hotel.example.test/api/account/initial-password", { method: "POST" }), { params: Promise.resolve({ path: ["account", "initial-password"] }) });
    expect([collection.status, detail.status, deactivate.status, password.status]).toEqual([200, 200, 200, 200]);
    const rejected = await POST(new Request(`https://hotel.example.test/api/admin/users/${userId}/role`, { method: "POST" }), { params: Promise.resolve({ path: ["admin", "users", userId, "role"] }) });
    expect(rejected.status).toBe(404);
    expect(upstreamFetch).toHaveBeenCalledTimes(4);
  });

  it("exposes only the approved API health endpoints", async () => {
    process.env.HOTEL_API_ORIGIN = "http://127.0.0.1:8787";
    const upstreamFetch = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("http://127.0.0.1:8787/api/health/ready");
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", upstreamFetch);

    const ready = await GET(
      new Request("https://hotel.example.test/api/health/ready"),
      { params: Promise.resolve({ path: ["health", "ready"] }) },
    );
    expect(ready.status).toBe(200);

    const unapproved = await GET(
      new Request("https://hotel.example.test/api/health/internal"),
      { params: Promise.resolve({ path: ["health", "internal"] }) },
    );
    expect(unapproved.status).toBe(404);
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });
});
